"""Quality gate -> dog/face detection -> MiewID embedding.

The pipeline only depends on the small `Detector` and `Embedder` protocols, so tests
can inject lightweight fakes while production wires in OWL-ViT and MiewID.
"""

from __future__ import annotations

import io
import threading
import time
from dataclasses import dataclass, field
from typing import Protocol

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

from .boxes import Box, Detections, intersection_over_first
from .config import DetectionThresholds, QualityThresholds
from .quality import blur_score, brightness, to_gray

# Reject decompression bombs early; real uploads are <= 1024 px after client compression.
Image.MAX_IMAGE_PIXELS = 40_000_000

# Reason codes, in the order the UI should show them (first = most actionable).
TOO_SMALL = "TOO_SMALL"
TOO_DARK = "TOO_DARK"
TOO_BRIGHT = "TOO_BRIGHT"
BLUR = "BLUR"
NO_DOG = "NO_DOG"
FACE_NOT_VISIBLE = "FACE_NOT_VISIBLE"


class InvalidImageError(ValueError):
    pass


class Detector(Protocol):
    name: str

    def detect(self, image: Image.Image) -> Detections: ...


class Embedder(Protocol):
    name: str
    dim: int

    def embed(self, images: list[Image.Image]) -> np.ndarray: ...


@dataclass
class Analysis:
    reasons: list[str]
    blur: float
    brightness: float
    width: int
    height: int
    found: bool = False
    box: list[int] | None = None
    score: float = 0.0
    embedding: list[float] | None = None
    timings_ms: dict[str, float] = field(default_factory=dict)

    def to_response(self, model_version: str) -> dict:
        return {
            "quality": {
                "ok": not self.reasons,
                "reasons": self.reasons,
                "blur": round(self.blur, 2),
                "brightness": round(self.brightness, 2),
                "width": self.width,
                "height": self.height,
            },
            "detection": {"found": self.found, "box": self.box, "score": round(self.score, 4)},
            "embedding": self.embedding,
            "model_version": model_version,
        }


def decode_image(data: bytes) -> Image.Image:
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
        image = ImageOps.exif_transpose(image)
        return image.convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, SyntaxError) as exc:
        raise InvalidImageError(str(exc)) from exc


def expand_box(box: Box, margin: float, width: int, height: int) -> tuple[int, int, int, int]:
    dx = (box.x2 - box.x1) * margin
    dy = (box.y2 - box.y1) * margin
    return (
        max(0, int(box.x1 - dx)),
        max(0, int(box.y1 - dy)),
        min(width, int(round(box.x2 + dx))),
        min(height, int(round(box.y2 + dy))),
    )


def scale_box(box: Box, factor: float) -> Box:
    return Box(box.x1 * factor, box.y1 * factor, box.x2 * factor, box.y2 * factor, box.score)


class Pipeline:
    def __init__(
        self,
        detector: Detector,
        embedder: Embedder,
        quality: QualityThresholds | None = None,
        detection: DetectionThresholds | None = None,
        max_side: int = 1024,
        crop_margin: float = 0.10,
    ) -> None:
        self.detector = detector
        self.embedder = embedder
        self.quality = quality or QualityThresholds()
        self.detection = detection or DetectionThresholds()
        self.max_side = max_side
        self.crop_margin = crop_margin
        # Torch already uses all cores per call; serializing requests avoids thrashing.
        self._lock = threading.Lock()

    @property
    def model_version(self) -> str:
        return f"{self.detector.name}+{self.embedder.name}"

    @property
    def embedding_dim(self) -> int:
        return self.embedder.dim

    def analyze_bytes(self, data: bytes) -> Analysis:
        started = time.perf_counter()
        image = decode_image(data)
        decode_ms = _ms(started)
        analysis = self.analyze(image)
        analysis.timings_ms = {"decode": decode_ms, **analysis.timings_ms}
        return analysis

    def analyze(self, image: Image.Image) -> Analysis:
        timings: dict[str, float] = {}
        t0 = time.perf_counter()
        width, height = image.size
        factor = min(1.0, self.max_side / max(width, height))
        work = (
            image
            if factor == 1.0
            else image.resize((max(1, round(width * factor)), max(1, round(height * factor))), Image.BILINEAR)
        )
        gray = to_gray(np.asarray(work))
        light = brightness(gray)
        reasons: list[str] = []
        if min(width, height) < self.quality.min_image_side:
            reasons.append(TOO_SMALL)
        if light < self.quality.min_brightness:
            reasons.append(TOO_DARK)
        elif light > self.quality.max_brightness:
            reasons.append(TOO_BRIGHT)
        timings["quality"] = _ms(t0)

        analysis = Analysis(reasons, blur_score(gray), light, width, height, timings_ms=timings)
        if reasons:
            # Detection on a photo we already reject would only add latency.
            return analysis

        t1 = time.perf_counter()
        with self._lock:
            detections = self.detector.detect(work)
        timings["detect"] = _ms(t1)
        head = self._select_head(detections, analysis)
        if head is None:
            if analysis.blur < self.quality.min_blur:
                # A very blurry frame often hides the dog too; "retake sharper" is the useful hint.
                analysis.reasons.insert(0, BLUR)
            return analysis

        head = scale_box(head, 1 / factor)
        analysis.found, analysis.box = True, head.as_list()
        analysis.blur = blur_score(gray, expand_box(scale_box(head, factor), 0.0, work.width, work.height))
        if min(head.x2 - head.x1, head.y2 - head.y1) < self.quality.min_crop_side:
            reasons.append(TOO_SMALL)
        if analysis.blur < self.quality.min_blur:
            reasons.append(BLUR)
        if reasons:
            return analysis

        t2 = time.perf_counter()
        crop = image.crop(expand_box(head, self.crop_margin, width, height))
        with self._lock:
            vector = self.embedder.embed([crop])[0]
        analysis.embedding = [float(v) for v in vector]
        timings["embed"] = _ms(t2)
        return analysis

    def _select_head(self, detections: Detections, analysis: Analysis) -> Box | None:
        """Return the face/head box to embed, or record why there is none.

        `analysis.score` is always the whole-dog confidence, the most interpretable number.
        NO_DOG: the whole-dog query is below threshold (nothing dog-like in frame).
        FACE_NOT_VISIBLE: a dog is present but no face box above threshold lies inside
        it (dog seen from behind, head cut off, or face hidden).
        """
        dog, face = detections.dog, detections.face
        analysis.score = dog.score if dog else 0.0
        if dog is None or dog.score < self.detection.dog:
            analysis.reasons.append(NO_DOG)
            return None
        if face is None or face.score < self.detection.face or intersection_over_first(face, dog) < 0.6:
            analysis.reasons.append(FACE_NOT_VISIBLE)
            return None
        return face


def _ms(start: float) -> float:
    return round((time.perf_counter() - start) * 1000, 1)
