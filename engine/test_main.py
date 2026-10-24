
from contextlib import nullcontext
from types import SimpleNamespace
import sys

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
    payload = {
        "idea": "Write a launch announcement.",
        "format": "Social post",
        "audience": "Small business owners",
        "tone": "Clear and confident",
        "language": "English",
    }

    with make_client(monkeypatch) as client:
        response = client.post("/v1/generate", json=payload)

    assert response.status_code == 503
    assert "not loaded" in response.json()["detail"]


def test_generation_rejects_unsupported_format(monkeypatch):
    payload = {
        "idea": "Write a launch announcement.",
        "format": "Unsupported format",
    }

    with make_client(monkeypatch) as client:
        response = client.post("/v1/generate", json=payload)

    assert response.status_code == 422


def test_generation_rejects_oversized_idea(monkeypatch):
    payload = {
        "idea": "x" * 10001,
        "format": "Social post",
    }

    with make_client(monkeypatch) as client:
        response = client.post("/v1/generate", json=payload)

    assert response.status_code == 422


def test_generation_returns_expected_api_shape_with_fake_model(monkeypatch):
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

        def apply_chat_template(self, messages, **kwargs):
            assert messages[0]["role"] == "system"
            assert messages[1]["role"] == "user"
            assert kwargs["add_generation_prompt"] is True
            return {"input_ids": FakeTensor([[1, 2]])}

        def decode(self, tokens, skip_special_tokens=True):
            assert tokens == [99, 100]
            return "A clear launch announcement."

    class FakeModel:
        def get_input_embeddings(self):
            return SimpleNamespace(weight=SimpleNamespace(device="cpu"))

        def generate(self, **kwargs):
            assert kwargs["max_new_tokens"] == main.MAX_NEW_TOKENS
            return FakeTensor([[1, 2, 99, 100]])

    fake_torch = SimpleNamespace(inference_mode=nullcontext)
    monkeypatch.setitem(sys.modules, "torch", fake_torch)

    payload = {
        "idea": "Announce our new service.",
        "format": "Social post",
        "audience": "Local business owners",
        "tone": "Confident",
        "language": "English",
    }

    with make_client(monkeypatch) as client:
        monkeypatch.setattr(main, "MODEL_ID", "test/local-model")
        monkeypatch.setattr(main, "ADAPTER_PATH", "")
        monkeypatch.setattr(main, "model", FakeModel())
        monkeypatch.setattr(main, "tokenizer", FakeTokenizer())

        response = client.post("/v1/generate", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["content"] == "A clear launch announcement."
    assert data["model"] == "test/local-model"
    assert data["adapter"] is None
    assert isinstance(data["id"], str)
    assert len(data["id"]) == 32
