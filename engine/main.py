
import os
import threading
from typing import Literal

import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer


MODEL_ID = os.getenv("GROWTHFLOW_MODEL_ID", "").strip()
ADAPTER_PATH = os.getenv("GROWTHFLOW_LORA_PATH", "").strip()
MAX_NEW_TOKENS = int(os.getenv("GROWTHFLOW_MAX_NEW_TOKENS", "700"))

app = FastAPI(
    title="GrowthFlow Self-Hosted AI Engine",
    version="0.1.0",
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


def load_model() -> None:
    global tokenizer, model, load_error

    if not MODEL_ID:
        load_error = "GROWTHFLOW_MODEL_ID is not configured."
        return

    try:
        tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)

        loaded_model = AutoModelForCausalLM.from_pretrained(
            MODEL_ID,
            torch_dtype="auto",
            device_map="auto",
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

    instructions = [
        "You are GrowthFlow, a content production assistant.",
        "Create useful, original content based on the user's brief.",
        "Follow the requested format, audience, tone, and language.",
        "Do not claim that research or fact-checking occurred unless it did.",
        "Return the content itself, without unnecessary commentary.",
    ]

    prompt = "\n".join(instructions)
    prompt += f"\nFormat: {request.format}"
    prompt += f"\nAudience: {request.audience or 'Not specified'}"
    prompt += f"\nTone: {request.tone or 'Natural and engaging'}"
    prompt += f"\nLanguage: {request.language or 'English'}"
    prompt += f"\nBrief:\n{idea}"

    messages = [{"role": "user", "content": prompt}]

    try:
        inputs = tokenizer.apply_chat_template(
            messages,
            tokenize=True,
            add_generation_prompt=True,
            return_tensors="pt",
            return_dict=True,
        )

        device = model.get_input_embeddings().weight.device
        inputs = {key: value.to(device) for key, value in inputs.items()}

        with model_lock, torch.inference_mode():
            output = model.generate(
                **inputs,
                max_new_tokens=MAX_NEW_TOKENS,
                do_sample=True,
                temperature=0.7,
                top_p=0.9,
                pad_token_id=tokenizer.eos_token_id,
            )

        input_length = inputs["input_ids"].shape[1]
        generated_tokens = output[0][input_length:]

        content = tokenizer.decode(
            generated_tokens,
            skip_special_tokens=True,
        ).strip()

        if not content:
            raise HTTPException(
                status_code=500,
                detail="The model returned empty content.",
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
