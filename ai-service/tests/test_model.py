"""Real-model tests (OWL-ViT + MiewID). Run with: pytest -m model

Skipped when the weights are not in the local Hugging Face cache or when the sample
photos have not been fetched (ai-service/tools/fetch_samples.py).
"""

from __future__ import annotations

import io

import cv2
import numpy as np
import pytest
from conftest import SAMPLES, SERVICE_KEY, jpeg_bytes
from fastapi.testclient import TestClient
from huggingface_hub import try_to_load_from_cache
from PIL import Image

from app.config import Settings
from app.embedder import MIEWID_REPO, MIEWID_REVISION
from app.main import create_app, load_pipeline

pytestmark = pytest.mark.model

DOG_PHOTOS = ["dog_boxer_front.jpg", "dog_kintamani_black.jpg", "dog_street_gianyar.jpg"]
NOT_DOG_PHOTOS = ["not_dog_coffee.jpg", "not_dog_cat.jpg", "not_dog_monkey.jpg"]


def weights_cached() -> bool:
    detector = Settings(service_key=None).detector_model
    return all(
        isinstance(path, str)
        for path in (
            try_to_load_from_cache(MIEWID_REPO, "model.safetensors", revision=MIEWID_REVISION),
            try_to_load_from_cache(detector, "config.json"),
        )
    )


@pytest.fixture(scope="module")
def real_client() -> TestClient:
    if not weights_cached():
        pytest.skip("model weights not cached; start the service once (or run the Docker build) to download them")
    app = create_app(Settings(service_key=SERVICE_KEY), pipeline_factory=load_pipeline)
    with TestClient(app) as client:
        yield client


def sample(name: str) -> bytes:
    path = SAMPLES / name
    if not path.exists():
        pytest.skip(f"{path} missing; run ai-service/tools/fetch_samples.py")
    return path.read_bytes()


def analyze(client: TestClient, data: bytes) -> dict:
    response = client.post(
        "/v1/analyze", files={"image": ("photo.jpg", data, "image/jpeg")}, headers={"X-Service-Key": SERVICE_KEY}
    )
    assert response.status_code == 200
    return response.json()


def test_health_reports_real_dimension(real_client):
    body = real_client.get("/health").json()
    assert body == {"status": "ok", "model_version": "owlvit-base-patch32+miewid-msv3", "embedding_dim": 2152}


@pytest.mark.parametrize("name", DOG_PHOTOS)
def test_dog_photo_is_accepted_with_normalized_embedding(real_client, name):
    body = analyze(real_client, sample(name))
    assert body["quality"]["reasons"] == []
    assert body["detection"]["found"] is True
    embedding = np.asarray(body["embedding"], dtype=np.float64)
    assert embedding.shape == (2152,)
    assert np.linalg.norm(embedding) == pytest.approx(1.0, abs=1e-4)


@pytest.mark.parametrize("name", NOT_DOG_PHOTOS)
def test_non_dog_photo_is_rejected(real_client, name):
    body = analyze(real_client, sample(name))
    assert body["embedding"] is None
    assert body["quality"]["reasons"] == ["NO_DOG"]
    assert body["detection"]["found"] is False and body["detection"]["box"] is None


def test_synthetically_blurred_dog_is_rejected(real_client):
    image = np.asarray(Image.open(io.BytesIO(sample("dog_boxer_front.jpg"))).convert("RGB"))
    blurred = cv2.GaussianBlur(image, (0, 0), 0.02 * max(image.shape[:2]))
    body = analyze(real_client, jpeg_bytes(blurred))
    assert body["embedding"] is None
    assert "BLUR" in body["quality"]["reasons"]


def test_same_photo_twice_has_similarity_one(real_client):
    data = sample("dog_kintamani_white.jpg")
    first = np.asarray(analyze(real_client, data)["embedding"])
    second = np.asarray(analyze(real_client, data)["embedding"])
    assert float(first @ second) == pytest.approx(1.0, abs=1e-5)


def test_different_dogs_are_less_similar_than_same_photo(real_client):
    a = np.asarray(analyze(real_client, sample("dog_kintamani_white.jpg"))["embedding"])
    b = np.asarray(analyze(real_client, sample("dog_boxer_front.jpg"))["embedding"])
    assert float(a @ b) < 0.9
