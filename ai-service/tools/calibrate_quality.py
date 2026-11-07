"""Print quality-metric distributions to pick initial quality thresholds.

For each real photo it measures brightness and the head-crop blur score exactly as
the service does, then repeats on synthetic degradations (Gaussian blur, under- and
over-exposure). Thresholds are chosen between the "real" and "degraded" percentiles.

Usage (from ai-service/):
    .venv/Scripts/python tools/calibrate_quality.py ../data/samples ../data/eval --limit 300
"""

from __future__ import annotations

import argparse
import random
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import Settings  # noqa: E402
from app.detector import OwlDetector  # noqa: E402
from app.pipeline import expand_box  # noqa: E402
from app.quality import blur_score, brightness, to_gray  # noqa: E402

PERCENTILES = [1, 5, 10, 25, 50, 75, 95, 99]


def collect(paths: list[str], limit: int, seed: int) -> list[Path]:
    files: list[Path] = []
    for path in paths:
        files.extend(p for p in Path(path).rglob("*") if p.suffix.lower() in {".jpg", ".jpeg", ".png"})
    files.sort()
    random.Random(seed).shuffle(files)
    return files[:limit]


def load(path: Path, max_side: int) -> np.ndarray:
    image = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    image.thumbnail((max_side, max_side))
    return np.asarray(image)


def degrade(rgb: np.ndarray, kind: str, box: tuple[int, int, int, int]) -> np.ndarray:
    if kind.startswith("blur"):
        # Sigma relative to the head size (1% or 2% of the box side = ~2.5 or ~5 px at the
        # 256 px blur scale), so the degradation is comparable across photo sizes.
        side = max(box[2] - box[0], box[3] - box[1])
        sigma = max(1.0, (0.01 if kind == "blur_mild" else 0.02) * side)
        return cv2.GaussianBlur(rgb, (0, 0), sigma)
    if kind == "dark":
        return (rgb.astype(np.float32) * 0.2).astype(np.uint8)
    if kind == "bright":
        return np.clip(rgb.astype(np.float32) * 2.2 + 60, 0, 255).astype(np.uint8)
    raise ValueError(kind)


def show(name: str, values: list[float]) -> None:
    if not values:
        return
    pct = np.percentile(values, PERCENTILES)
    digits = 3 if max(values) <= 1.0 else 1
    cells = " ".join(f"p{p}={v:.{digits}f}" for p, v in zip(PERCENTILES, pct, strict=False))
    print(f"{name:20s} n={len(values):4d} min={min(values):.{digits}f} {cells} max={max(values):.{digits}f}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("paths", nargs="+")
    parser.add_argument("--limit", type=int, default=300)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()

    settings = Settings(service_key=None)
    detector = OwlDetector(
        settings.detector_model, settings.device, settings.detector_input_size, settings.detector_revision
    )
    stats: dict[str, list[float]] = {
        k: []
        for k in [
            "brightness",
            "blur_real",
            "blur_mild",
            "blur_strong",
            "brightness_dark",
            "brightness_bright",
            "dog_score",
            "face_score",
            "crop_short_side",
        ]
    }
    for path in collect(args.paths, args.limit, args.seed):
        rgb = load(path, settings.max_side)
        detections = detector.detect(Image.fromarray(rgb))
        if detections.dog is None or detections.face is None:
            continue
        stats["dog_score"].append(detections.dog.score)
        stats["face_score"].append(detections.face.score)
        if detections.dog.score < settings.detection.dog:
            continue
        head = detections.face
        box = expand_box(head, 0.0, rgb.shape[1], rgb.shape[0])
        stats["crop_short_side"].append(min(box[2] - box[0], box[3] - box[1]))
        gray = to_gray(rgb)
        stats["brightness"].append(brightness(gray))
        stats["blur_real"].append(blur_score(gray, box))
        stats["blur_mild"].append(blur_score(to_gray(degrade(rgb, "blur_mild", box)), box))
        stats["blur_strong"].append(blur_score(to_gray(degrade(rgb, "blur_strong", box)), box))
        stats["brightness_dark"].append(brightness(to_gray(degrade(rgb, "dark", box))))
        stats["brightness_bright"].append(brightness(to_gray(degrade(rgb, "bright", box))))
    for name, values in stats.items():
        show(name, values)
    return 0


if __name__ == "__main__":
    sys.exit(main())
