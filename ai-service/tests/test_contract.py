"""Endpoint contract tests. Run against fake models (fast, no weights needed)."""

from __future__ import annotations

import json
import logging

import cv2
import numpy as np
import pytest
from conftest import jpeg_bytes, textured, with_red_dog

from app.config import MAX_UPLOAD_BYTES, ConfigError, Settings
from app.logging_setup import JsonFormatter

ANALYZE = "/v1/analyze"


def post_image(client, data: bytes, headers: dict | None = None, field: str = "image"):
    return client.post(ANALYZE, files={field: ("photo.jpg", data, "image/jpeg")}, headers=headers or {})


def test_health_is_public(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "model_version": "fake-detector+fake-embedder", "embedding_dim": 16}


@pytest.mark.parametrize("headers", [{}, {"X-Service-Key": "wrong"}, {"X-Service-Key": ""}])
def test_analyze_requires_service_key(client, headers):
    response = post_image(client, jpeg_bytes(with_red_dog(textured())), headers)
    assert response.status_code == 401
    assert response.json() == {"error": "unauthorized"}


def test_unknown_paths_also_require_key(client):
    assert client.get("/docs").status_code == 401


def test_accepted_photo_matches_contract(client, auth):
    response = post_image(client, jpeg_bytes(with_red_dog(textured())), auth)
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"quality", "detection", "embedding", "model_version"}
    assert set(body["quality"]) == {"ok", "reasons", "blur", "brightness", "width", "height"}
    assert body["quality"]["ok"] is True and body["quality"]["reasons"] == []
    assert (body["quality"]["width"], body["quality"]["height"]) == (640, 480)
    assert set(body["detection"]) == {"found", "box", "score"}
    assert body["detection"]["found"] is True
    x1, y1, x2, y2 = body["detection"]["box"]
    assert all(isinstance(v, int) for v in body["detection"]["box"])
    assert 0 <= x1 < x2 <= 640 and 0 <= y1 < y2 <= 480
    assert body["model_version"] == "fake-detector+fake-embedder"
    assert len(body["embedding"]) == 16
    assert np.linalg.norm(body["embedding"]) == pytest.approx(1.0, abs=1e-5)
    assert response.headers["X-Request-Id"]


def test_box_is_in_original_pixel_coordinates(client, auth):
    # 2048 px wide: the service analyzes a 1024 px copy and must scale the box back.
    big = cv2.resize(with_red_dog(textured()), (2048, 1536), interpolation=cv2.INTER_NEAREST)
    body = post_image(client, jpeg_bytes(big), auth).json()
    x1, y1, x2, y2 = body["detection"]["box"]
    assert abs(x1 - 512) <= 8 and abs(x2 - 1536) <= 8
    assert abs(y1 - 384) <= 8 and abs(y2 - 1152) <= 8


def test_no_dog_returns_null_embedding(client, auth):
    body = post_image(client, jpeg_bytes(textured()), auth).json()
    assert body["embedding"] is None
    assert body["quality"]["ok"] is False
    assert body["quality"]["reasons"] == ["NO_DOG"]
    assert body["detection"] == {"found": False, "box": None, "score": 0.01}


def test_blurred_photo_is_rejected(client, auth):
    blurred = cv2.GaussianBlur(with_red_dog(textured()), (0, 0), 6)
    body = post_image(client, jpeg_bytes(blurred), auth).json()
    assert body["embedding"] is None
    assert "BLUR" in body["quality"]["reasons"]
    assert body["detection"]["found"] is True


def test_dark_photo_is_rejected_before_detection(client, auth):
    dark = (with_red_dog(textured()) * 0.1).astype(np.uint8)
    body = post_image(client, jpeg_bytes(dark), auth).json()
    assert body["quality"]["reasons"] == ["TOO_DARK"]
    assert body["detection"] == {"found": False, "box": None, "score": 0.0}
    assert body["embedding"] is None


def test_bright_photo_is_rejected(client, auth):
    bright = np.full((480, 640, 3), 250, dtype=np.uint8)
    assert post_image(client, jpeg_bytes(bright), auth).json()["quality"]["reasons"] == ["TOO_BRIGHT"]


def test_small_photo_is_rejected(client, auth):
    small = with_red_dog(textured(height=150, width=200))
    assert "TOO_SMALL" in post_image(client, jpeg_bytes(small), auth).json()["quality"]["reasons"]


def test_same_photo_twice_gives_same_embedding(client, auth):
    data = jpeg_bytes(with_red_dog(textured()))
    first = np.array(post_image(client, data, auth).json()["embedding"])
    second = np.array(post_image(client, data, auth).json()["embedding"])
    assert float(first @ second) == pytest.approx(1.0, abs=1e-6)


def test_too_large_upload_is_413(client, auth):
    response = post_image(client, b"\xff" * (MAX_UPLOAD_BYTES + 1), auth)
    assert response.status_code == 413
    assert response.json() == {"error": "too_large"}


def test_exactly_max_size_is_not_rejected_as_too_large(client, auth):
    data = jpeg_bytes(with_red_dog(textured()))
    padded = data + b"\x00" * (MAX_UPLOAD_BYTES - len(data))  # trailing bytes after EOI are ignored
    assert post_image(client, padded, auth).status_code == 200


@pytest.mark.parametrize("payload", [b"not an image", b"", b"\x89PNG\r\n\x1a\n" + b"\x00" * 100])
def test_undecodable_upload_is_400(client, auth, payload):
    response = post_image(client, payload, auth)
    assert response.status_code == 400
    assert response.json() == {"error": "invalid_image"}


def test_wrong_field_name_is_400(client, auth):
    response = post_image(client, jpeg_bytes(textured()), auth, field="photo")
    assert response.status_code == 400
    assert response.json() == {"error": "invalid_image"}


def test_request_log_has_no_image_or_embedding(client, auth):
    records: list[logging.LogRecord] = []

    class Collect(logging.Handler):
        def emit(self, record):
            records.append(record)

    handler = Collect()
    logger = logging.getLogger("tera.ai")
    logger.addHandler(handler)
    try:
        post_image(client, jpeg_bytes(with_red_dog(textured())), {**auth, "X-Request-Id": "req-123"})
    finally:
        logger.removeHandler(handler)
    line = json.loads(JsonFormatter().format(records[-1]))
    assert line["request_id"] == "req-123"
    assert line["outcome"] == "accepted"
    assert {"decode", "quality", "detect", "embed"} <= set(line["stage_ms"])
    assert "embedding" not in line and "image" not in line


def test_missing_service_key_refuses_to_start(monkeypatch):
    monkeypatch.delenv("AI_SERVICE_KEY", raising=False)
    monkeypatch.delenv("ALLOW_NO_KEY", raising=False)
    with pytest.raises(ConfigError):
        Settings.from_env()
    monkeypatch.setenv("ALLOW_NO_KEY", "1")
    assert Settings.from_env().service_key is None
