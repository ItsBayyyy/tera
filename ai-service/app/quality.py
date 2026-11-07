"""Photo quality measurements (OpenCV)."""

from __future__ import annotations

import cv2
import numpy as np

# Blur is measured at a fixed scale so the score does not depend on photo resolution.
BLUR_REFERENCE_SIDE = 256


def to_gray(rgb: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)


def brightness(gray: np.ndarray) -> float:
    return float(gray.mean())


def blur_score(gray: np.ndarray, box: tuple[int, int, int, int] | None = None) -> float:
    """Variance of the Laplacian of `box` (or the whole image), resized so its longer side is 256 px.

    Higher is sharper. Measuring on the head crop rather than the full frame keeps an
    intentionally blurred background from failing an otherwise sharp face photo.
    """
    region = gray
    if box is not None:
        x1, y1, x2, y2 = box
        if x2 - x1 >= 2 and y2 - y1 >= 2:
            region = gray[y1:y2, x1:x2]
    height, width = region.shape
    scale = BLUR_REFERENCE_SIDE / max(height, width)
    size = (max(1, round(width * scale)), max(1, round(height * scale)))
    interpolation = cv2.INTER_AREA if scale < 1 else cv2.INTER_LINEAR
    resized = cv2.resize(region, size, interpolation=interpolation)
    return float(cv2.Laplacian(resized, cv2.CV_64F).var())
