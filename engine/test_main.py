
from contextlib import nullcontext
from types import SimpleNamespace
import sys

import pytest
from fastapi.testclient import TestClient

from engine import main


def make_client(monkeypatch):
    monkeypatch.setattr(main, "load_model", lambda: None)
    monkeypatch.setattr(main, "MODEL_ID", "")
    monkeypatch.setattr(main, "ADAPTER_PATH", "")
    monkeypatch.setattr(main, "model", None)
    monkeypatch.setattr(main, "tokenizer", None)
    monkeypatch.setattr(main, "load_error", "Model is not configured.")
    return TestClient(main.app)


class FakeTensor:
    def __init__(self, data):
        self.data = data

    @property
    def shape(self):
        return (len(self.data), len(self.data[0]))

    def to(self, device):
        return self

    def __getitem__(self, index):
        if isinstance(index, slice):
            if len(self.data) == 1:
                return self.data[0][index]
            return self.data[index]

        value = self.data[index]
        if isinstance(value, list):
            return FakeTensor([value])
        return value


class FakeTokenizer:
    eos_token_id = 0

    def __init__(self, generated_content):
        self.generated_content = generated_content
        self.messages = None

    def apply_chat_template(self, messages, **kwargs):
        self.messages = messages
        assert messages[0]["role"] == "system"
        assert messages[1]["role"] == "user"
        assert kwargs["add_generation_prompt"] is True
        return {"input_ids": FakeTensor([[1, 2]])}

    def decode(self, tokens, skip_special_tokens=True):
        assert tokens == [99, 100]
        return self.generated_content


class FakeModel:
    def get_input_embeddings(self):
        return SimpleNamespace(weight=SimpleNamespace(device="cpu"))

    def generate(self, **kwargs):
        assert kwargs["max_new_tokens"] == main.MAX_NEW_TOKENS
        return FakeTensor([[1, 2, 99, 100]])


def install_fake_model(monkeypatch, content):
    fake_torch = SimpleNamespace(inference_mode=nullcontext)
    monkeypatch.setitem(sys.modules, "torch", fake_torch)

    tokenizer = FakeTokenizer(content)
    monkeypatch.setattr(main, "MODEL_ID", "test/local-model")
    monkeypatch.setattr(main, "ADAPTER_PATH", "")
    monkeypatch.setattr(main, "model", FakeModel())
    monkeypatch.setattr(main, "tokenizer", tokenizer)

    return tokenizer


def generation_payload(idea="Write a social post for a car wash."):
    return {
        "idea": idea,
        "format": "Social post",
        "audience": "Local car owners",
        "tone": "Professional and friendly",
        "language": "English",
    }


def test_health_reports_unconfigured_engine(monkeypatch):
    with make_client(monkeypatch) as client:
        response = client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "not_ready"
    assert data["model"] is None
    assert data["adapter_loaded"] is False


def test_health_exposes_runtime_configuration(monkeypatch):
    monkeypatch.setattr(main, "DEVICE_MODE", "cpu")
    monkeypatch.setattr(main, "MAX_NEW_TOKENS", 128)

    with make_client(monkeypatch) as client:
        response = client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["device_mode"] == "cpu"
    assert data["max_new_tokens"] == 128


def test_load_model_clears_stale_model_when_unconfigured(monkeypatch):
    monkeypatch.setattr(main, "MODEL_ID", "")
    monkeypatch.setattr(main, "model", object())
    monkeypatch.setattr(main, "tokenizer", object())

    main.load_model()

    assert main.model is None
    assert main.tokenizer is None
    assert main.load_error == "GROWTHFLOW_MODEL_ID is not configured."


def test_generation_fails_when_model_is_not_loaded(monkeypatch):
    with make_client(monkeypatch) as client:
        response = client.post(
            "/v1/generate",
            json=generation_payload("Write a launch announcement."),
        )

    assert response.status_code == 503
    assert "not loaded" in response.json()["detail"]


def test_generation_rejects_unsupported_format(monkeypatch):
    payload = generation_payload()
    payload["format"] = "Unsupported format"

    with make_client(monkeypatch) as client:
        response = client.post("/v1/generate", json=payload)

    assert response.status_code == 422


def test_generation_rejects_oversized_idea(monkeypatch):
    payload = generation_payload("x" * 10001)

    with make_client(monkeypatch) as client:
        response = client.post("/v1/generate", json=payload)

    assert response.status_code == 422


@pytest.mark.parametrize(
    ("content", "expected_label"),
    [
        (
            "We open our doors on Monday!",
            "opening date or weekday",
        ),
        (
            "Our eco-friendly process uses water recycling.",
            "unverified business capability or credential",
        ),
        (
            "Our service costs 5000 CFA.",
            "specific price or discount",
        ),
        (
            "Our service costs FCFA 5000.",
            "specific price or discount",
        ),
        (
            "Save 20% on every wash!",
            "specific price or discount",
        ),
        (
            "Celebrate our 10th anniversary with us.",
            "unverified business identity or milestone",
        ),
        (
            "Welcome to our grand opening.",
            "unverified business identity or milestone",
        ),
        (
            "Our team is working tirelessly for you.",
            "unverified staff, customer, or service claim",
        ),
        (
            "Our services include trucks and minivans.",
            "unverified staff, customer, or service claim",
        ),
        (
            "We are open daily.",
            "unverified business hours",
        ),
        (
            "We are open from 8 AM.",
            "unverified business hours",
        ),
        (
            "Find us at our convenient spot right here in Grand-Bassam.",
            "unverified launch or location claim",
        ),
    ],
)
def test_claim_checker_flags_unsupported_claims(content, expected_label):
    findings = main.find_unsupported_claims(
        content,
        "Write a car wash post. No prices, hours, services, or milestones provided.",
    )

    assert expected_label in findings


def test_claim_checker_allows_plain_copy_without_flagged_claims():
    findings = main.find_unsupported_claims(
        "Keep your car looking its best. Visit us when it suits you.",
        "Write a social post for a car wash.",
    )

    assert findings == []


def test_claim_checker_does_not_treat_prohibited_weekday_as_verified():
    findings = main.find_unsupported_claims(
        "We open on Monday.",
        "Do not mention Monday. No opening date was provided.",
    )

    assert "opening date or weekday" in findings


def test_claim_checker_allows_weekday_confirmed_in_brief():
    findings = main.find_unsupported_claims(
        "We open on Monday.",
        "The business confirms: We open on Monday.",
    )

    assert findings == []


def test_claim_checker_allows_exactly_supported_price():
    findings = main.find_unsupported_claims(
        "Our service costs 5000 CFA.",
        "The business confirms: Our service costs 5000 CFA.",
    )

    assert findings == []


def test_claim_checker_flags_unverified_claim_even_if_related_fact_is_present():
    findings = main.find_unsupported_claims(
        "Our service costs 5000 CFA and includes free delivery.",
        "The business confirms: Our service costs 5000 CFA.",
    )

    assert "specific price or discount" in findings


def test_generation_returns_502_for_unsupported_claim(monkeypatch):
    with make_client(monkeypatch) as client:
        tokenizer = install_fake_model(
            monkeypatch,
            "We open our doors on Monday!",
        )

        response = client.post(
            "/v1/generate",
            json=generation_payload(
                "Write a social post for a car wash in Grand-Bassam."
            ),
        )

    assert response.status_code == 502
    assert "not supported" in response.json()["detail"]
    assert "Monday" not in response.text
    assert tokenizer.messages is not None


def test_generation_returns_502_for_unsupported_business_claim(monkeypatch):
    with make_client(monkeypatch) as client:
        install_fake_model(
            monkeypatch,
            "Our experienced team guarantees spotless results.",
        )

        response = client.post(
            "/v1/generate",
            json=generation_payload(),
        )

    assert response.status_code == 502
    assert "No generated content was returned." in response.json()["detail"]


def test_generation_returns_expected_api_shape_with_fake_model(monkeypatch):
    with make_client(monkeypatch) as client:
        fake_tokenizer = install_fake_model(
            monkeypatch,
            "Keep your car looking its best. Visit us when it suits you.",
        )

        response = client.post(
            "/v1/generate",
            json=generation_payload("Write a friendly car wash social post."),
        )

    assert response.status_code == 200

    data = response.json()
    assert data["content"] == (
        "Keep your car looking its best. Visit us when it suits you."
    )
    assert data["model"] == "test/local-model"
    assert data["adapter"] is None
    assert isinstance(data["id"], str)
    assert len(data["id"]) == 32

    system_prompt = fake_tokenizer.messages[0]["content"].lower()
    assert "never invent" in system_prompt
    assert "prices" in system_prompt
    assert "discounts" in system_prompt
    assert "guarantees" in system_prompt
    assert "write complete, coherent content" in system_prompt
    assert "do not invent a booking method or offer" in system_prompt
