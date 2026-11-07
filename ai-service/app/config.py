"""Runtime settings, read once from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass, field

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
DEFAULT_DETECTOR = "google/owlvit-base-patch32"
# Pinned so detection scores (and the calibrated thresholds) cannot drift with upstream edits.
DEFAULT_DETECTOR_REVISION = "cbc355fb364588351c5d51c7f74465e8e7ec6f72"


class ConfigError(RuntimeError):
    pass


@dataclass(frozen=True)
class QualityThresholds:
    """Initial thresholds from tools/calibrate_quality.py.

    Numbers and method: README.md, section "Thresholds and how they were chosen".
    """

    min_image_side: int = 224  # px, shorter side of the uploaded image
    min_crop_side: int = 64  # px, shorter side of the detected head box (original pixels)
    min_brightness: float = 45.0  # mean gray level 0-255 of the downscaled photo
    max_brightness: float = 215.0
    min_blur: float = 20.0  # variance of Laplacian on the head crop resized to 256 px


@dataclass(frozen=True)
class DetectionThresholds:
    # OWL-ViT base-patch32 sigmoid scores; see README.md "Thresholds and how they were chosen".
    dog: float = 0.15  # "a photo of a dog" score needed to say a dog is present
    face: float = 0.02  # "a photo of a dog's face" score needed for a box inside the dog


@dataclass(frozen=True)
class Settings:
    service_key: str | None
    detector_model: str = DEFAULT_DETECTOR
    detector_revision: str | None = DEFAULT_DETECTOR_REVISION
    detector_input_size: int | None = None
    device: str = "cpu"
    max_side: int = 1024  # images are downscaled to this before analysis
    crop_margin: float = 0.10
    quality: QualityThresholds = field(default_factory=QualityThresholds)
    detection: DetectionThresholds = field(default_factory=DetectionThresholds)

    @classmethod
    def from_env(cls) -> Settings:
        key = os.environ.get("AI_SERVICE_KEY") or None
        if key is None and os.environ.get("ALLOW_NO_KEY") != "1":
            raise ConfigError("AI_SERVICE_KEY is not set (set ALLOW_NO_KEY=1 only for local tests)")
        input_size = os.environ.get("DETECTOR_INPUT_SIZE")
        detector = os.environ.get("DETECTOR_MODEL", DEFAULT_DETECTOR)
        default_revision = DEFAULT_DETECTOR_REVISION if detector == DEFAULT_DETECTOR else None
        return cls(
            service_key=key,
            detector_model=detector,
            detector_revision=os.environ.get("DETECTOR_REVISION", default_revision),
            detector_input_size=int(input_size) if input_size else None,
            device=os.environ.get("DEVICE", "cpu"),
            detection=DetectionThresholds(
                dog=float(os.environ.get("DOG_THRESHOLD", DetectionThresholds.dog)),
                face=float(os.environ.get("FACE_THRESHOLD", DetectionThresholds.face)),
            ),
        )
