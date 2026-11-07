"""MiewID re-identification embedder.

The official checkpoint ships `modeling_miewid.py` for `trust_remote_code`, but that
code targets transformers 4.45 and fails to load on transformers 5.x. It is also
code downloaded and executed at runtime. We therefore rebuild the exact same
network here (timm backbone + GeM pooling + BatchNorm1d) and load the published
safetensors with `strict=True`, pinned to a fixed revision. Equivalence with the
official code was checked with `tools/verify_miewid_equivalence.py`.
"""

from __future__ import annotations

import numpy as np
import timm
import torch
import torch.nn as nn
import torch.nn.functional as F
from huggingface_hub import hf_hub_download
from PIL import Image
from safetensors.torch import load_file

MIEWID_REPO = "conservationxlabs/miewid-msv3"
# Pinned so a silent upstream change cannot alter embeddings already stored in pgvector.
MIEWID_REVISION = "4f1d7f2b521149e5fe34bb85f377248ce9971a7d"
MIEWID_BACKBONE = "efficientnetv2_rw_m"
# Values from the model card usage snippet (Resize 440x440, ImageNet mean/std).
INPUT_SIZE = 440
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


class GeM(nn.Module):
    """Generalized-mean pooling, parameter name `p` matches the checkpoint."""

    def __init__(self, p: float = 3.0, eps: float = 1e-6) -> None:
        super().__init__()
        self.p = nn.Parameter(torch.ones(1) * p)
        self.eps = eps

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        pooled = F.avg_pool2d(x.clamp(min=self.eps).pow(self.p), (x.size(-2), x.size(-1)))
        return pooled.pow(1.0 / self.p)


class MiewIdNet(nn.Module):
    def __init__(self, feature_dim: int) -> None:
        super().__init__()
        self.backbone = timm.create_model(MIEWID_BACKBONE, pretrained=False, num_classes=0)
        self.backbone.global_pool = GeM()
        self.bn = nn.BatchNorm1d(feature_dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        features = self.backbone(x).view(x.shape[0], -1)
        return self.bn(features)


def preprocess(images: list[Image.Image]) -> torch.Tensor:
    """Bilinear resize to 440x440 + ToTensor + ImageNet normalize, as in the model card."""
    arrays = []
    for image in images:
        resized = image.convert("RGB").resize((INPUT_SIZE, INPUT_SIZE), Image.BILINEAR)
        array = np.asarray(resized, dtype=np.float32) / 255.0
        arrays.append(((array - IMAGENET_MEAN) / IMAGENET_STD).transpose(2, 0, 1))
    return torch.from_numpy(np.stack(arrays))


class MiewIdEmbedder:
    name = "miewid-msv3"

    def __init__(self, device: str = "cpu", cache_dir: str | None = None) -> None:
        weights_path = hf_hub_download(MIEWID_REPO, "model.safetensors", revision=MIEWID_REVISION, cache_dir=cache_dir)
        state = load_file(weights_path)
        # The checkpoint also stores a 10-class training head ("final.*") that is unused
        # at inference; everything else must match exactly.
        state = {k: v for k, v in state.items() if not k.startswith("final.")}
        feature_dim = state["bn.weight"].shape[0]
        model = MiewIdNet(feature_dim)
        model.load_state_dict(state, strict=True)
        self.model = model.eval().to(device)
        self.device = device
        self.dim = feature_dim

    @torch.inference_mode()
    def embed(self, images: list[Image.Image]) -> np.ndarray:
        """Return L2-normalized float32 embeddings, shape (len(images), dim)."""
        batch = preprocess(images).to(self.device)
        features = self.model(batch).float()
        return F.normalize(features, dim=1).cpu().numpy()
