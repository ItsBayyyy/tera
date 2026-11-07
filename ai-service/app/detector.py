"""Open-vocabulary dog detector (OWL-ViT / OWLv2 via transformers).

Two text queries are scored in one forward pass: the whole dog and the dog's face.
The detector reports the best box for each; the pipeline decides what is accepted.
"""

from __future__ import annotations

import torch
from PIL import Image
from transformers import AutoProcessor, Owlv2ForObjectDetection, OwlViTForObjectDetection

from .boxes import Box, Detections, intersection_over_first

FACE_QUERY = "a photo of a dog's face"
DOG_QUERY = "a photo of a dog"


class OwlDetector:
    def __init__(
        self, model_id: str, device: str = "cpu", input_size: int | None = None, revision: str | None = None
    ) -> None:
        self.model_id = model_id
        self.is_v2 = "owlv2" in model_id
        self.name = model_id.split("/")[-1] + (f"@{input_size}" if input_size else "")
        model_cls = Owlv2ForObjectDetection if self.is_v2 else OwlViTForObjectDetection
        self.processor = AutoProcessor.from_pretrained(model_id, revision=revision)
        self.model = model_cls.from_pretrained(model_id, revision=revision).eval().to(device)
        self.device = device
        # Optional smaller square input (with interpolated position embeddings) to trade
        # accuracy for CPU latency. None keeps the checkpoint's native resolution.
        self.input_size = input_size
        text_inputs = self.processor(text=[[FACE_QUERY, DOG_QUERY]], return_tensors="pt")
        self.text_inputs = {k: v.to(device) for k, v in text_inputs.items()}

    def _pixel_values(self, image: Image.Image) -> torch.Tensor:
        kwargs = {}
        if self.input_size:
            kwargs["size"] = {"height": self.input_size, "width": self.input_size}
        pixels = self.processor(images=image, return_tensors="pt", **kwargs)["pixel_values"]
        return pixels.to(self.device)

    @torch.inference_mode()
    def detect(self, image: Image.Image) -> Detections:
        width, height = image.size
        outputs = self.model(
            pixel_values=self._pixel_values(image),
            interpolate_pos_encoding=bool(self.input_size),
            **self.text_inputs,
        )
        # OWLv2 pads the image to a square (bottom/right) before resizing, so its
        # normalized boxes are relative to the padded square, not the original frame.
        if self.is_v2:
            side = max(width, height)
            scale = torch.tensor([side, side, side, side], dtype=torch.float32)
        else:
            scale = torch.tensor([width, height, width, height], dtype=torch.float32)
        logits = outputs.logits[0].float()  # (num_patches, num_queries)
        cx, cy, w, h = outputs.pred_boxes[0].float().unbind(-1)
        boxes = torch.stack([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], dim=-1) * scale
        boxes[:, 0::2] = boxes[:, 0::2].clamp(0, width)
        boxes[:, 1::2] = boxes[:, 1::2].clamp(0, height)
        scores = logits.sigmoid()
        return Detections(
            face=self._best_face(boxes, scores[:, 0], scores[:, 1]),
            dog=self._to_box(boxes, scores[:, 1], int(scores[:, 1].argmax())),
        )

    def _best_face(self, boxes: torch.Tensor, face_scores: torch.Tensor, dog_scores: torch.Tensor) -> Box | None:
        dog = self._to_box(boxes, dog_scores, int(dog_scores.argmax()))
        order = torch.argsort(face_scores, descending=True)[:10]
        candidates = [self._to_box(boxes, face_scores, int(i)) for i in order]
        candidates = [c for c in candidates if c is not None]
        if not candidates:
            return None
        if dog is not None:
            inside = [c for c in candidates if intersection_over_first(c, dog) >= 0.6]
            if inside:
                return inside[0]
        return candidates[0]

    @staticmethod
    def _to_box(boxes: torch.Tensor, scores: torch.Tensor, index: int) -> Box | None:
        x1, y1, x2, y2 = (float(v) for v in boxes[index])
        if x2 - x1 < 1 or y2 - y1 < 1:
            return None
        return Box(x1, y1, x2, y2, float(scores[index]))
