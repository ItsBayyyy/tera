"""Check that app.embedder reproduces the official MiewID remote code.

The official `modeling_miewid.py` only loads on transformers 4.x, so run this in a
separate throwaway venv (it is not a service dependency):

    uv venv --python 3.11 /tmp/miewid-ref
    uv pip install --python /tmp/miewid-ref/Scripts/python.exe \
        --index-url https://download.pytorch.org/whl/cpu torch
    uv pip install --python /tmp/miewid-ref/Scripts/python.exe \
        "transformers==4.46.3" timm safetensors pillow numpy
    cd ai-service && /tmp/miewid-ref/Scripts/python.exe tools/verify_miewid_equivalence.py ../data/samples

Prints the cosine similarity per image between the official and local embeddings.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
from transformers import AutoModel

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.embedder import MIEWID_REPO, MIEWID_REVISION, MiewIdEmbedder, preprocess  # noqa: E402


def main(image_dir: str) -> int:
    official = AutoModel.from_pretrained(MIEWID_REPO, trust_remote_code=True, revision=MIEWID_REVISION).eval()
    local = MiewIdEmbedder()
    paths = sorted(Path(image_dir).glob("*.jpg"))
    if not paths:
        print(f"no .jpg files in {image_dir}")
        return 1
    worst = 1.0
    for path in paths:
        image = Image.open(path).convert("RGB")
        with torch.no_grad():
            reference = F.normalize(official(preprocess([image])), dim=1).numpy()[0]
        ours = local.embed([image])[0]
        cosine = float(np.dot(reference, ours))
        worst = min(worst, cosine)
        print(f"{path.name}: dim={ours.shape[0]} cosine={cosine:.6f}")
    print(f"worst cosine over {len(paths)} images: {worst:.6f}")
    return 0 if worst >= 0.9999 else 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "../data/samples"))
