"""Decision logic of the pipeline with scripted detections (no models)."""

from __future__ import annotations

import cv2
from conftest import FakeEmbedder, textured
from PIL import Image

from app.boxes import Box, Detections
from app.pipeline import Pipeline


class ScriptedDetector:
    name = "scripted"

    def __init__(self, detections: Detections) -> None:
        self.detections = detections

    def detect(self, image: Image.Image) -> Detections:
        return self.detections


def run(detections: Detections, array=None):
    image = Image.fromarray(textured() if array is None else array)
    return Pipeline(ScriptedDetector(detections), FakeEmbedder()).analyze(image)


DOG = Box(100, 100, 500, 400, 0.8)


def test_face_inside_dog_is_embedded_and_score_is_dog_confidence():
    result = run(Detections(face=Box(150, 120, 350, 300, 0.1), dog=DOG))
    assert result.reasons == [] and result.found
    assert result.box == [150, 120, 350, 300]
    assert result.score == 0.8
    assert result.embedding is not None


def test_dog_without_face_is_face_not_visible():
    result = run(Detections(face=None, dog=DOG))
    assert result.reasons == ["FACE_NOT_VISIBLE"]
    assert not result.found and result.box is None and result.embedding is None
    assert result.score == 0.8


def test_low_face_score_is_face_not_visible():
    assert run(Detections(face=Box(150, 120, 350, 300, 0.001), dog=DOG)).reasons == ["FACE_NOT_VISIBLE"]


def test_face_outside_dog_is_face_not_visible():
    assert run(Detections(face=Box(520, 10, 630, 90, 0.3), dog=DOG)).reasons == ["FACE_NOT_VISIBLE"]


def test_weak_dog_score_is_no_dog():
    result = run(Detections(face=Box(150, 120, 350, 300, 0.3), dog=Box(100, 100, 500, 400, 0.05)))
    assert result.reasons == ["NO_DOG"] and result.score == 0.05


def test_tiny_head_is_too_small():
    result = run(Detections(face=Box(200, 200, 240, 240, 0.3), dog=DOG))
    assert result.reasons[0] == "TOO_SMALL" and result.found and result.embedding is None


def test_blurry_frame_without_dog_reports_blur_first():
    blurred = cv2.GaussianBlur(textured(), (0, 0), 8)
    assert run(Detections(face=None, dog=None), blurred).reasons == ["BLUR", "NO_DOG"]
