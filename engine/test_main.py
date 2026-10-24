
from fastapi.testclient import TestClient

from engine import main


def make_client(monkeypatch):
    # Prevent startup from attempting to download or load a model.
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
