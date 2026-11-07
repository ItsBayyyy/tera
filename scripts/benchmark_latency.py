"""Measure /v1/analyze latency on CPU.

Each photo is first prepared like the PWA does (longest side <= 1024 px, JPEG ~0.8,
no EXIF). The first request is a warm-up and is excluded from the statistics.

HTTP mode (end-to-end, includes multipart + JSON):
    ai-service/.venv/Scripts/python scripts/benchmark_latency.py --url http://127.0.0.1:8000 --key $AI_SERVICE_KEY
In-process mode (per-stage timings, no server needed):
    ai-service/.venv/Scripts/python scripts/benchmark_latency.py --in-process
"""

from __future__ import annotations

import argparse
import io
import json
import os
import platform
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

REPO = Path(__file__).resolve().parents[1]
DEFAULT_DIRS = [REPO / "data" / "samples", REPO / "data" / "demo", REPO / "data" / "eval"]


def client_compress(path: Path, max_side: int = 1024, quality: int = 80) -> bytes:
    image = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    image.thumbnail((max_side, max_side))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=quality)  # PIL writes no EXIF unless asked
    return buffer.getvalue()


def collect(dirs: list[Path], limit: int) -> list[Path]:
    files: list[Path] = []
    for folder in dirs:
        if folder.exists():
            files += sorted(p for p in folder.rglob("*") if p.suffix.lower() in {".jpg", ".jpeg", ".png"})
    return files[:limit]


def stats(values: list[float]) -> dict[str, float]:
    array = np.asarray(values)
    return {
        "n": len(values),
        "p50_ms": round(float(np.percentile(array, 50)), 1),
        "p95_ms": round(float(np.percentile(array, 95)), 1),
        "max_ms": round(float(array.max()), 1),
    }


def bench_http(payloads: list[bytes], url: str, key: str) -> dict:
    import httpx

    totals, outcomes = [], {}
    with httpx.Client(base_url=url, timeout=60) as client:
        health = client.get("/health").json()
        for index, data in enumerate(payloads):
            started = time.perf_counter()
            response = client.post(
                "/v1/analyze", files={"image": ("photo.jpg", data, "image/jpeg")}, headers={"X-Service-Key": key}
            )
            elapsed = (time.perf_counter() - started) * 1000
            response.raise_for_status()
            if index == 0:
                continue  # warm-up
            totals.append(elapsed)
            reasons = response.json()["quality"]["reasons"]
            outcome = "accepted" if not reasons else reasons[0]
            outcomes[outcome] = outcomes.get(outcome, 0) + 1
    return {"mode": "http", "model_version": health["model_version"], "total": stats(totals), "outcomes": outcomes}


def bench_in_process(payloads: list[bytes]) -> dict:
    sys.path.insert(0, str(REPO / "ai-service"))
    from app.config import Settings
    from app.main import load_pipeline

    os.environ.setdefault("ALLOW_NO_KEY", "1")  # in-process: no HTTP, so no key is needed
    pipeline = load_pipeline(Settings.from_env())
    totals, stages, outcomes = [], {}, {}
    for index, data in enumerate(payloads):
        started = time.perf_counter()
        analysis = pipeline.analyze_bytes(data)
        elapsed = (time.perf_counter() - started) * 1000
        if index == 0:
            continue
        totals.append(elapsed)
        for stage, value in analysis.timings_ms.items():
            stages.setdefault(stage, []).append(value)
        outcome = "accepted" if not analysis.reasons else analysis.reasons[0]
        outcomes[outcome] = outcomes.get(outcome, 0) + 1
    return {
        "mode": "in-process",
        "model_version": pipeline.model_version,
        "total": stats(totals),
        "stages": {stage: stats(values) for stage, values in stages.items()},
        "outcomes": outcomes,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--url")
    parser.add_argument("--key", default=os.environ.get("AI_SERVICE_KEY", ""))
    parser.add_argument("--in-process", action="store_true")
    parser.add_argument("--dirs", nargs="*", type=Path, default=DEFAULT_DIRS)
    parser.add_argument("--limit", type=int, default=41, help="photos to send (first one is warm-up)")
    args = parser.parse_args()

    files = collect(args.dirs, args.limit)
    if len(files) < 21:
        print(f"need at least 21 photos (found {len(files)}); fetch samples or prepare data/eval first")
        return 1
    payloads = [client_compress(path) for path in files]
    result = (
        bench_in_process(payloads)
        if args.in_process
        else bench_http(payloads, args.url or "http://127.0.0.1:8000", args.key)
    )
    result["photos_measured"] = len(payloads) - 1
    result["hardware"] = f"{platform.processor() or platform.machine()}, {os.cpu_count()} logical CPUs"
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
