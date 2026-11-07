"""Detection result types, kept free of torch/transformers so fakes and tests stay light."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Box:
    x1: float
    y1: float
    x2: float
    y2: float
    score: float

    @property
    def area(self) -> float:
        return max(0.0, self.x2 - self.x1) * max(0.0, self.y2 - self.y1)

    def as_list(self) -> list[int]:
        return [round(self.x1), round(self.y1), round(self.x2), round(self.y2)]


@dataclass(frozen=True)
class Detections:
    face: Box | None  # best face/head candidate regardless of threshold
    dog: Box | None  # best whole-dog candidate regardless of threshold


def intersection_over_first(a: Box, b: Box) -> float:
    """Fraction of box `a` covered by box `b`."""
    if a.area == 0:
        return 0.0
    w = max(0.0, min(a.x2, b.x2) - max(a.x1, b.x1))
    h = max(0.0, min(a.y2, b.y2) - max(a.y1, b.y1))
    return (w * h) / a.area
