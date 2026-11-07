"""Download (into HF_HOME) and smoke-load the pinned detector + MiewID weights.

Used by the Dockerfile at build time so the container never downloads at startup.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import Settings  # noqa: E402
from app.main import load_pipeline  # noqa: E402

if __name__ == "__main__":
    pipeline = load_pipeline(Settings(service_key=None))
    print(f"ready: {pipeline.model_version}, embedding_dim={pipeline.embedding_dim}")
