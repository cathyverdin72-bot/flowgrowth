
"""Run one real model inference check manually.

Model weights are downloaded only when this script is explicitly run.
"""
import os
import time

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer


MODEL_ID = os.getenv(
    "GROWTHFLOW_MODEL_ID",
    "Qwen/Qwen2.5-0.5B-Instruct",
).strip()

MAX_NEW_TOKENS = max(
    16,
    min(int(os.getenv("GROWTHFLOW_MAX_NEW_TOKENS", "96")), 128),
)


def main():
    if not MODEL_ID:
        raise SystemExit("Set GROWTHFLOW_MODEL_ID to a model repository ID.")

    device = "cuda" if torch.cuda.is_available() else "cpu"

    print(f"Model: {MODEL_ID}")
    print(f"Device: {device}")
    print("Loading model; the first run needs an internet connection.")

    started = time.perf_counter()
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)

    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        torch_dtype="auto",
        device_map="auto" if device == "cuda" else None,
        low_cpu_mem_usage=True,
    )

    if device == "cpu":
        model.to("cpu")

    model.eval()
    loaded_at = time.perf_counter()

    messages = [
        {
            "role": "system",
            "content": (
                "You are GrowthFlow, a helpful content production "
                "assistant. Create concise, useful content."
            ),
        },
        {
            "role": "user",
            "content": (
                "Create a confident English social post for small business "
                "owners in Côte d'Ivoire. Announce a new service that helps "
                "local businesses organize customer enquiries and follow up "
                "professionally."
            ),
        },
    ]

    inputs = tokenizer.apply_chat_template(
        messages,
        add_generation_prompt=True,
        tokenize=True,
        return_dict=True,
        return_tensors="pt",
    )

    inputs = {
        key: value.to(model.device)
        for key, value in inputs.items()
    }

    with torch.inference_mode():
        outputs = model.generate(
            **inputs,
            max_new_tokens=MAX_NEW_TOKENS,
            do_sample=False,
            pad_token_id=tokenizer.eos_token_id,
        )

    prompt_length = inputs["input_ids"].shape[-1]
    result = tokenizer.decode(
        outputs[0][prompt_length:],
        skip_special_tokens=True,
    ).strip()

    print("\n=== REAL MODEL OUTPUT ===\n")
    print(result or "[Empty output]")

    print("\n=== RUN SUMMARY ===")
    print(f"Model load time: {loaded_at - started:.1f} seconds")
    print(f"Total time: {time.perf_counter() - started:.1f} seconds")
    print(f"Generated tokens: {outputs.shape[-1] - prompt_length}")

    if not result:
        raise SystemExit("Smoke test failed: model output was empty.")


if __name__ == "__main__":
    main()
