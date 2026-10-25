import os
import re
import threading
from typing import Literal
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
MODEL_ID = os.getenv("GROWTHFLOW_MODEL_ID", "").strip()
ADAPTER_PATH = os.getenv("GROWTHFLOW_LORA_PATH", "").strip()
DEVICE_MODE = os.getenv("GROWTHFLOW_DEVICE_MODE", "auto").strip().lower()
try:
    MAX_NEW_TOKENS = int(os.getenv("GROWTHFLOW_MAX_NEW_TOKENS", "256"))
except ValueError:
    MAX_NEW_TOKENS = 256
MAX_NEW_TOKENS = max(16, min(MAX_NEW_TOKENS, 1024))
if DEVICE_MODE not in {"auto", "cpu"}:
    DEVICE_MODE = "auto"
DEFAULT_ALLOWED_ORIGINS = (
    "http://localhost:5173,"
    "http://127.0.0.1:5173"
)
ALLOWED_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "GROWTHFLOW_ALLOWED_ORIGINS",
        DEFAULT_ALLOWED_ORIGINS,
    ).split(",")
    if origin.strip() and origin.strip() != "*"
]
app = FastAPI(
    title="GrowthFlow Self-Hosted AI Engine",
    version="0.3.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Accept", "Authorization"],
)
tokenizer = None
model = None
model_lock = threading.Lock()
load_error = None
class GenerationRequest(BaseModel):
    idea: str = Field(min_length=1, max_length=10000)
    format: Literal[
        "Social post",
        "Story",
        "Video script",
        "Image concept",
    ]
    audience: str | None = Field(default=None, max_length=500)
    tone: str | None = Field(default=None, max_length=300)
    language: str | None = Field(default=None, max_length=100)
class GenerationResponse(BaseModel):
    id: str
    content: str
    model: str
    adapter: str | None = None
# Conservative checks for common unsupported marketing claims.
# This is a heuristic, not a complete fact-checking system.
UNSUPPORTED_CLAIM_PATTERNS = (
    (
        "opening date or weekday",
        re.compile(
            r"\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "specific price or discount",
        re.compile(
            r"(?:[$€£]|\b(?:FCFA|CFA francs?)\b)\s?\d|"
            r"\b\d+(?:[.,]\d+)?\s?(?:%|percent|per cent)\b|"
            r"\b(?:discount|special offer|save \d|half[- ]price|free trial)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "unverified business capability or credential",
        re.compile(
            r"\b(?:cutting[- ]edge|state[- ]of[- ]the[- ]art|"
            r"eco[- ]friendly|water recycling|energy[- ]efficient|"
            r"award[- ]winning|certified|guaranteed|industry[- ]leading|"
            r"professional team|team of experts|cheapest|lowest prices?)\b",
            re.IGNORECASE,
        ),
    ),
)
def find_unsupported_claims(
    content: str,
    source_brief: str,
) -> list[str]:
    """Identify known high-risk claims absent from the supplied brief."""
    findings = []
    normalized_brief = source_brief.casefold()
    for label, pattern in UNSUPPORTED_CLAIM_PATTERNS:
        matches = pattern.findall(content)
        if matches and not all(
            str(match).casefold() in normalized_brief
            for match in matches
        ):
            findings.append(label)
    return findings
def load_model() -> None:
    """Load the configured open-weight model during application startup."""
    global tokenizer, model, load_error
    tokenizer = None
    model = None
    if not MODEL_ID:
        load_error = "GROWTHFLOW_MODEL_ID is not configured."
        return
    try:
        import torch
        from peft import PeftModel
        from transformers import AutoModelForCausalLM, AutoTokenizer
        tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
        load_options = {
            "torch_dtype": (
                torch.float32 if DEVICE_MODE == "cpu" else "auto"
            ),
            "low_cpu_mem_usage": True,
        }
        if DEVICE_MODE == "cpu":
            loaded_model = AutoModelForCausalLM.from_pretrained(
                MODEL_ID,
                **load_options,
            )
            loaded_model.to("cpu")
        else:
            loaded_model = AutoModelForCausalLM.from_pretrained(
                MODEL_ID,
                device_map="auto",
                **load_options,
            )
        if ADAPTER_PATH:
            loaded_model = PeftModel.from_pretrained(
                loaded_model,
                ADAPTER_PATH,
            )
        loaded_model.eval()
        model = loaded_model
        load_error = None
    except Exception as exc:
        tokenizer = None
        model = None
        load_error = f"Model loading failed: {type(exc).__name__}"
@app.on_event("startup")
def startup() -> None:
    load_model()
@app.get("/health")
def health() -> dict:
    ready = model is not None and tokenizer is not None
    return {
        "status": "ok" if ready else "not_ready",
        "engine": "GrowthFlow Self-Hosted Engine",
        "model": MODEL_ID or None,
        "device_mode": DEVICE_MODE,
        "max_new_tokens": MAX_NEW_TOKENS,
        "adapter_loaded": bool(ADAPTER_PATH) and ready,
        "message": (
            "Model loaded and ready."
            if ready
            else load_error or "Model is not ready."
        ),
    }
@app.post("/v1/generate", response_model=GenerationResponse)
def generate(request: GenerationRequest) -> GenerationResponse:
    if model is None or tokenizer is None:
        raise HTTPException(
            status_code=503,
            detail="Our own model is not loaded. No generation was completed.",
        )
    idea = request.idea.strip()
    if not idea:
        raise HTTPException(
            status_code=422,
            detail="The idea cannot be empty.",
        )
    import torch
    system_prompt = (
        "You are GrowthFlow, a careful business content assistant. "
        "Create useful, original content in the requested format, audience, "
        "tone, and language. Use only facts supplied in the brief. "
        "Never invent or imply prices, discounts, promotions, guarantees, "
        "rankings, credentials, customer reviews, business hours, dates, "
        "locations, services, equipment, environmental practices, results, "
        "or availability. If a detail is not provided, omit it or use neutral "
        "wording rather than guessing. Do not turn an unverified claim into "
        "a verified fact. Do not claim that research, browsing, or "
        "fact-checking occurred unless it actually did. Write complete, "
        "coherent content. Include a clear call to action when appropriate, "
        "but do not invent a booking method or offer. Return only the "
        "requested content without commentary about these rules."
    )
    user_prompt = (
        f"Format: {request.format}\n"
        f"Audience: {request.audience or 'Not specified'}\n"
        f"Tone: {request.tone or 'Natural and engaging'}\n"
        f"Language: {request.language or 'English'}\n"
        f"Brief:\n{idea}"
    )
    try:
        inputs = tokenizer.apply_chat_template(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            tokenize=True,
            add_generation_prompt=True,
            return_tensors="pt",
            return_dict=True,
        )
        device = model.get_input_embeddings().weight.device
        inputs = {
            key: value.to(device)
            for key, value in inputs.items()
        }
        generation_options = {
            "max_new_tokens": MAX_NEW_TOKENS,
            "do_sample": True,
            "temperature": 0.7,
            "top_p": 0.9,
        }
        if tokenizer.eos_token_id is not None:
            generation_options["pad_token_id"] = tokenizer.eos_token_id
        with model_lock, torch.inference_mode():
            output = model.generate(**inputs, **generation_options)
        input_length = inputs["input_ids"].shape[1]
        content = tokenizer.decode(
            output[0][input_length:],
            skip_special_tokens=True,
        ).strip()
        if not content:
            raise HTTPException(
                status_code=500,
                detail="The model returned empty content.",
            )
        unsupported_claims = find_unsupported_claims(content, idea)
        if unsupported_claims:
            raise HTTPException(
                status_code=502,
                detail=(
                    "The model generated claims that were not supported by "
                    "the supplied brief. Please add verified details and try "
                    "again. No generated content was returned."
                ),
            )
        return GenerationResponse(
            id=os.urandom(16).hex(),
            content=content,
            model=MODEL_ID,
            adapter=ADAPTER_PATH or None,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Generation failed: {type(exc).__name__}",
        ) from exc
