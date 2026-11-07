from __future__ import annotations

import io
import os
import sys
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

SERVICE_ROOT = Path(__file__).resolve().parents[1]
SAMPLES = SERVICE_ROOT.parent / "data" / "samples"
sys.path.insert(0, str(SERVICE_ROOT))
# Keep model downloads inside the repo-local, gitignored cache unless the caller chose one.
os.environ.setdefault("HF_HOME", str(SERVICE_ROOT / ".cache" / "hf"))

from app.boxes import Box, Detections  # noqa: E402
from app.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402
from app.pipeline import Pipeline  # noqa: E402

SERVICE_KEY = "test-service-key"


class FakeDetector:
    """Treats saturated red pixels as 'the dog'. Lets tests steer detection with pixels."""

    name = "fake-detector"

    def detect(self, image: Image.Image) -> Detections:
        rgb = np.asarray(image).astype(np.int16)
        mask = (rgb[..., 0] > 200) & (rgb[..., 1] < 110) & (rgb[..., 2] < 110)
        if mask.sum() < 50:
            return Detections(face=None, dog=Box(0, 0, image.width, image.height, 0.01))
        ys, xs = np.nonzero(mask)
        box = (float(xs.min()), float(ys.min()), float(xs.max() + 1), float(ys.max() + 1))
        return Detections(face=Box(*box, score=0.5), dog=Box(*box, score=0.9))


class FakeEmbedder:
    """Deterministic 16-d embedding from a 4x4 grid of mean intensities."""

    name = "fake-embedder"
    dim = 16

    def embed(self, images: list[Image.Image]) -> np.ndarray:
        rows = []
        for image in images:
            gray = np.asarray(image.convert("L").resize((4, 4), Image.BILINEAR), dtype=np.float32).ravel() + 1.0
            rows.append(gray / np.linalg.norm(gray))
        return np.stack(rows)


def fake_pipeline(_: Settings) -> Pipeline:
    return Pipeline(FakeDetector(), FakeEmbedder())


def jpeg_bytes(array: np.ndarray, quality: int = 92) -> bytes:
    buffer = io.BytesIO()
    Image.fromarray(array.astype(np.uint8)).save(buffer, format="JPEG", quality=quality)
    return buffer.getvalue()


def textured(height: int = 480, width: int = 640, seed: int = 0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    return rng.integers(60, 200, size=(height, width, 3)).astype(np.uint8)


def with_red_dog(array: np.ndarray, seed: int = 1) -> np.ndarray:
    """Paint a textured red 'dog' patch (sharp, so it passes the blur gate)."""
    out = array.copy()
    rng = np.random.default_rng(seed)
    h, w = out.shape[:2]
    y1, y2, x1, x2 = h // 4, 3 * h // 4, w // 4, 3 * w // 4
    out[y1:y2, x1:x2, 0] = 255
    out[y1:y2, x1:x2, 1:] = rng.integers(0, 100, size=(y2 - y1, x2 - x1, 2))
    return out


@pytest.fixture(scope="session")
def client() -> TestClient:
    app = create_app(Settings(service_key=SERVICE_KEY), pipeline_factory=fake_pipeline)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def auth() -> dict[str, str]:
    return {"X-Service-Key": SERVICE_KEY}
