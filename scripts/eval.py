"""Evaluate dog re-identification the way the product matches: cosine similarity,
best score per dog over that dog's gallery photos (mirrors SQL match_dogs()).

Reads data/<dataset>/<dog_id>/*.jpg, splits by individual dog (registered dogs give
gallery + probe photos, held-out dogs are "unregistered" for open-set testing), runs
every photo through the AI service pipeline in-process, and reports rank-1, rank-5,
TAR@FAR=1%, recommended match_strong / match_unsure thresholds, the rejection rate of
unregistered dogs at those thresholds, and latency. Each run is saved to
data/eval_results/<name>.json and docs/EVALUATION.md is regenerated from all saved
runs, so the document only ever contains measured numbers.

Usage (from the repo root, with the AI service venv):
    ai-service/.venv/Scripts/python scripts/eval.py                       # data/eval
    ai-service/.venv/Scripts/python scripts/eval.py --data-dir data/eval_aligned --name dogfacenet-aligned
    ai-service/.venv/Scripts/python scripts/eval.py --mode whole-image    # ablation: no quality gate/detector
    ai-service/.venv/Scripts/python scripts/eval.py --render-only         # rebuild docs/EVALUATION.md
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[1]
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png"}
TARGET_FAR = 0.01  # TAR is reported at this false-accept rate
STRONG_MAX_ERROR = 0.01  # at most 1% of "strong" answers may name the wrong dog
STRONG_MIN_SUPPORT = 20  # a "strong" threshold must cover at least this many probes to count
DUPLICATE_COSINE = 0.97  # photos this similar are the same picture (resized/re-encoded), not a new view
TABLE_THRESHOLDS = [round(0.30 + 0.05 * i, 2) for i in range(11)]  # 0.30 ... 0.80


# ---------------------------------------------------------------- splitting


def split_dogs(dog_ids: list[str], unregistered_fraction: float, seed: int) -> tuple[list[str], list[str]]:
    """Split by individual (never by photo) into registered and unregistered dogs."""
    ids = sorted(dog_ids)
    random.Random(seed).shuffle(ids)
    n_unregistered = int(round(len(ids) * unregistered_fraction))
    return sorted(ids[n_unregistered:]), sorted(ids[:n_unregistered])


def split_gallery_probe(items: list, gallery_per_dog: int, seed: int) -> tuple[list, list]:
    """Gallery gets up to `gallery_per_dog` photos but always leaves at least one probe."""
    shuffled = list(items)
    random.Random(seed).shuffle(shuffled)
    n_gallery = max(1, min(gallery_per_dog, len(shuffled) - 1))
    return shuffled[:n_gallery], shuffled[n_gallery:]


# ---------------------------------------------------------------- metrics


def per_dog_scores(probes: np.ndarray, gallery: np.ndarray, gallery_dog: np.ndarray, n_dogs: int) -> np.ndarray:
    """(n_probes, n_dogs) matrix of the best cosine similarity to each dog's gallery photos.

    Embeddings must already be L2-normalized, so the dot product is the cosine similarity.
    """
    sims = probes @ gallery.T
    scores = np.full((probes.shape[0], n_dogs), -np.inf, dtype=np.float64)
    for dog in range(n_dogs):
        columns = gallery_dog == dog
        if columns.any():
            scores[:, dog] = sims[:, columns].max(axis=1)
    return scores


def rank_k_accuracy(scores: np.ndarray, true_dog: np.ndarray, k: int) -> float:
    true_scores = scores[np.arange(len(true_dog)), true_dog]
    # Rank = 1 + number of dogs scoring strictly higher than the true dog.
    ranks = 1 + (scores > true_scores[:, None]).sum(axis=1)
    return float((ranks <= k).mean())


def genuine_and_impostor(
    scores: np.ndarray, true_dog: np.ndarray, unregistered_scores: np.ndarray
) -> tuple[np.ndarray, np.ndarray]:
    rows = np.arange(len(true_dog))
    genuine = scores[rows, true_dog]
    mask = np.ones_like(scores, dtype=bool)
    mask[rows, true_dog] = False
    impostor = np.concatenate([scores[mask], unregistered_scores.ravel()])
    return genuine, impostor


def tar_at_far(genuine: np.ndarray, impostor: np.ndarray, far: float) -> tuple[float, float]:
    """True-accept rate at the smallest threshold whose false-accept rate is <= `far`."""
    threshold = threshold_for_far(impostor, far)
    return float((genuine >= threshold).mean()), threshold


def threshold_for_far(impostor: np.ndarray, far: float) -> float:
    ordered = np.sort(impostor)[::-1]
    allowed = int(np.floor(far * len(ordered)))
    if allowed >= len(ordered):
        return float(ordered[-1])
    # Accept iff score >= threshold; nudge above the first impostor that must be rejected.
    return float(np.nextafter(ordered[allowed], np.inf))


def strong_threshold(
    top1_scores: np.ndarray, top1_correct: np.ndarray, max_error: float, min_support: int = STRONG_MIN_SUPPORT
) -> float | None:
    """Lowest threshold t such that, among probes whose best score >= t, at most `max_error` are wrong.

    Probes from unregistered dogs are always wrong (their dog is not in the gallery).
    Thresholds selecting fewer than `min_support` probes are ignored (too few to trust).
    """
    order = np.argsort(-top1_scores, kind="stable")
    scores, wrong = top1_scores[order], ~top1_correct[order]
    errors = np.cumsum(wrong) / np.arange(1, len(wrong) + 1)
    best = None
    for i in range(len(scores)):
        # Only cut between distinct scores so the threshold reproduces this exact set.
        if i + 1 < len(scores) and scores[i + 1] == scores[i]:
            continue
        if errors[i] <= max_error and i + 1 >= min_support:
            best = float(scores[i])
    return best


def threshold_table(
    registered_top1: np.ndarray, registered_correct: np.ndarray, unregistered_best: np.ndarray, thresholds: list[float]
) -> list[dict]:
    """What a single cut-off would do: share of registered probes answered correctly / wrongly
    at or above it, and share of unregistered probes wrongly reaching it."""
    rows = []
    for t in thresholds:
        above = registered_top1 >= t
        rows.append(
            {
                "threshold": t,
                "registered_correct": float((above & registered_correct).mean()),
                "registered_wrong": float((above & ~registered_correct).mean()),
                "unregistered_accepted": float((unregistered_best >= t).mean()),
            }
        )
    return rows


def deduplicate(
    photos: dict[str, list[tuple[str, np.ndarray]]], threshold: float
) -> tuple[dict[str, list[np.ndarray]], dict]:
    """Clean dataset label noise using near-identical photos (cosine >= threshold).

    - Two folders sharing a near-identical photo are the same dog listed twice: merged.
    - Near-identical photos within one dog are kept once (a copy is not a new view and
      would make matching look easier than it is).
    """
    dogs = sorted(d for d in photos if photos[d])
    parent = {d: d for d in dogs}

    def root(d: str) -> str:
        while parent[d] != d:
            parent[d] = parent[parent[d]]
            d = parent[d]
        return d

    owners = [d for d in dogs for _ in photos[d]]
    if owners:
        matrix = np.stack([v for d in dogs for _, v in photos[d]])
        sims = matrix @ matrix.T
        rows, cols = np.nonzero(np.triu(sims >= threshold, k=1))
        for r, c in zip(rows, cols, strict=False):
            if owners[r] != owners[c]:
                parent[root(owners[r])] = root(owners[c])
    merged: dict[str, list[np.ndarray]] = {}
    dropped = 0
    for dog in dogs:
        kept = merged.setdefault(root(dog), [])
        for _, vector in photos[dog]:
            if any(float(vector @ other) >= threshold for other in kept):
                dropped += 1
            else:
                kept.append(vector)
    groups = len(dogs) - len(merged)
    return merged, {"folders_merged": groups, "duplicate_photos_dropped": dropped}


def unsure_threshold(genuine: np.ndarray, unregistered_best: np.ndarray) -> float:
    """Equal-error point between missing a registered dog and letting an unregistered one through.

    Returns t where the share of registered probes whose own dog scores below t is closest
    to the share of unregistered probes whose best score is >= t. Below t the app answers
    "none" (offer to register), so this balances both mistakes instead of favouring one.
    """
    candidates = np.unique(np.concatenate([genuine, unregistered_best]))
    miss = np.array([(genuine < t).mean() for t in candidates])
    false_pass = np.array([(unregistered_best >= t).mean() for t in candidates])
    return float(candidates[int(np.argmin(np.abs(miss - false_pass)))])


def rejection_rate(unregistered_best: np.ndarray, threshold: float) -> float:
    return float((unregistered_best < threshold).mean())


def summarize_latency(values: list[float]) -> dict[str, float] | None:
    if not values:
        return None
    array = np.asarray(values)
    return {
        "p50": round(float(np.percentile(array, 50)), 1),
        "p95": round(float(np.percentile(array, 95)), 1),
        "n": len(values),
    }


def compute_metrics(
    embeddings: dict[str, list[np.ndarray]],
    registered: list[str],
    unregistered: list[str],
    gallery_per_dog: int,
    seed: int,
) -> dict:
    """`embeddings` maps dog id -> accepted (L2-normalized) embeddings of that dog."""
    gallery_vectors, gallery_dog, probe_vectors, probe_dog = [], [], [], []
    dog_index: dict[str, int] = {}
    dropped = []
    for dog in registered:
        vectors = embeddings.get(dog, [])
        if len(vectors) < 2:
            dropped.append(dog)  # needs at least one gallery and one probe photo
            continue
        index = dog_index.setdefault(dog, len(dog_index))
        gallery, probes = split_gallery_probe(vectors, gallery_per_dog, seed + index)
        gallery_vectors += gallery
        gallery_dog += [index] * len(gallery)
        probe_vectors += probes
        probe_dog += [index] * len(probes)
    unregistered_vectors = [v for dog in unregistered for v in embeddings.get(dog, [])]
    if not probe_vectors or not unregistered_vectors:
        raise ValueError("not enough accepted photos: need registered dogs with >= 2 photos and unregistered photos")

    n_dogs = len(dog_index)
    gallery_matrix = np.stack(gallery_vectors)
    gallery_dog_array = np.asarray(gallery_dog)
    scores = per_dog_scores(np.stack(probe_vectors), gallery_matrix, gallery_dog_array, n_dogs)
    unregistered_scores = per_dog_scores(np.stack(unregistered_vectors), gallery_matrix, gallery_dog_array, n_dogs)
    true_dog = np.asarray(probe_dog)

    genuine, impostor = genuine_and_impostor(scores, true_dog, unregistered_scores)
    tar, far_threshold = tar_at_far(genuine, impostor, TARGET_FAR)
    unregistered_best = unregistered_scores.max(axis=1)
    top1_scores = np.concatenate([scores.max(axis=1), unregistered_best])
    top1_correct = np.concatenate([scores.argmax(axis=1) == true_dog, np.zeros(len(unregistered_best), dtype=bool)])
    strong = strong_threshold(top1_scores, top1_correct, STRONG_MAX_ERROR)
    unsure = unsure_threshold(genuine, unregistered_scores.max(axis=1))
    if strong is not None:
        unsure = min(unsure, strong)
    registered_top1 = scores.max(axis=1)
    registered_correct = scores.argmax(axis=1) == true_dog
    table = threshold_table(registered_top1, registered_correct, unregistered_best, TABLE_THRESHOLDS)

    return {
        "gallery_dogs": n_dogs,
        "gallery_photos": len(gallery_vectors),
        "probe_photos": len(probe_vectors),
        "unregistered_dogs": sum(1 for dog in unregistered if embeddings.get(dog)),
        "unregistered_photos": len(unregistered_vectors),
        "registered_dogs_dropped": len(dropped),
        "rank1": rank_k_accuracy(scores, true_dog, 1),
        "rank5": rank_k_accuracy(scores, true_dog, 5),
        "tar_at_far_1pct": tar,
        "far_1pct_threshold": far_threshold,
        "match_strong": strong,
        "match_unsure": unsure,
        "strong_zone_registered_correct": float(((registered_top1 >= strong) & registered_correct).mean())
        if strong is not None
        else None,
        "strong_zone_registered_wrong": float(((registered_top1 >= strong) & ~registered_correct).mean())
        if strong is not None
        else None,
        "registered_own_dog_at_or_above_unsure": float((genuine >= unsure).mean()),
        "unregistered_rejected_at_unsure": rejection_rate(unregistered_best, unsure),
        "unregistered_rejected_at_strong": rejection_rate(unregistered_best, strong) if strong is not None else None,
        "genuine_score_median": float(np.median(genuine)),
        "unregistered_best_score_median": float(np.median(unregistered_best)),
        "threshold_table": table,
    }


# ---------------------------------------------------------------- running the model


@dataclass
class PhotoResult:
    path: str
    dog: str
    embedding: np.ndarray | None
    reasons: list[str]
    timings_ms: dict[str, float]
    total_ms: float


def list_dataset(data_dir: Path) -> dict[str, list[Path]]:
    dogs = {}
    for folder in sorted(p for p in data_dir.iterdir() if p.is_dir()):
        photos = sorted(p for p in folder.iterdir() if p.suffix.lower() in IMAGE_SUFFIXES)
        if photos:
            dogs[folder.name] = photos
    return dogs


def load_service():
    """Same settings as the service (DETECTOR_MODEL, DOG_THRESHOLD, ... env vars apply)."""
    import os

    sys.path.insert(0, str(REPO / "ai-service"))
    from app.config import Settings
    from app.main import load_pipeline

    os.environ.setdefault("ALLOW_NO_KEY", "1")  # no HTTP server here, so no key is needed
    return load_pipeline(Settings.from_env())


def run_photos(pipeline, dataset: dict[str, list[Path]], mode: str, cache_file: Path) -> list[PhotoResult]:
    from PIL import Image

    cache = json.loads(cache_file.read_text()) if cache_file.exists() else {}
    results = []
    total = sum(len(v) for v in dataset.values())
    done = 0
    for dog, photos in dataset.items():
        for path in photos:
            key = f"{path.relative_to(REPO).as_posix()}:{hashlib.sha1(path.read_bytes()).hexdigest()[:12]}"
            if key not in cache:
                started = time.perf_counter()
                try:
                    if mode == "pipeline":
                        analysis = pipeline.analyze_bytes(path.read_bytes())
                        vector, reasons, timings = analysis.embedding, analysis.reasons, analysis.timings_ms
                    else:
                        image = Image.open(path).convert("RGB")
                        vector, reasons, timings = pipeline.embedder.embed([image])[0].tolist(), [], {}
                except (ValueError, OSError):
                    # Corrupt file (the service answers 400 invalid_image); counts as a rejection.
                    vector, reasons, timings = None, ["INVALID_IMAGE"], {}
                cache[key] = {
                    "embedding": vector,
                    "reasons": reasons,
                    "timings_ms": timings,
                    "total_ms": round((time.perf_counter() - started) * 1000, 1),
                }
            entry = cache[key]
            vector = np.asarray(entry["embedding"], dtype=np.float32) if entry["embedding"] is not None else None
            results.append(
                PhotoResult(str(path), dog, vector, entry["reasons"], entry["timings_ms"], entry["total_ms"])
            )
            done += 1
            if done % 100 == 0:
                print(f"  {done}/{total} photos", flush=True)
                cache_file.write_text(json.dumps(cache))
    cache_file.write_text(json.dumps(cache))
    return results


def rejection_summary(results: list[PhotoResult]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for result in results:
        if result.embedding is None:
            first = result.reasons[0] if result.reasons else "UNKNOWN"
            counts[first] = counts.get(first, 0) + 1
    return dict(sorted(counts.items()))


def latency_summary(results: list[PhotoResult]) -> dict:
    stages: dict[str, list[float]] = {}
    for result in results:
        for stage, value in result.timings_ms.items():
            stages.setdefault(stage, []).append(value)
    accepted = [r.total_ms for r in results if r.embedding is not None]
    return {
        "total_all_photos": summarize_latency([r.total_ms for r in results]),
        "total_accepted_photos": summarize_latency(accepted),
        "stages": {stage: summarize_latency(values) for stage, values in stages.items()},
    }


def hardware() -> str:
    import os
    import platform

    import torch

    return f"{platform.processor() or platform.machine()}, {os.cpu_count()} logical CPUs, torch {torch.__version__} threads={torch.get_num_threads()}, CPU only"


# ---------------------------------------------------------------- report


def fmt(value: float | None, digits: int = 3) -> str:
    return "-" if value is None else f"{value:.{digits}f}"


def pct(value: float | None) -> str:
    return "-" if value is None else f"{value * 100:.1f}%"


def render_markdown(runs: list[dict]) -> str:
    lines = [
        "# Evaluasi AI — re-identifikasi anjing",
        "",
        "> Dokumen ini dibuat otomatis oleh `scripts/eval.py` dari hasil yang benar-benar diukur",
        "> (`data/eval_results/*.json`). Jangan mengedit angka secara manual.",
        "",
    ]
    if not runs:
        lines += ["**Belum dievaluasi pada data nyata.**", ""]
    else:
        lines += [
            "**Status:** dievaluasi pada dataset publik (lihat tabel). **Belum dievaluasi pada data lapangan Bali**;",
            "angka di bawah tidak boleh dikutip sebagai akurasi di lapangan.",
            "",
        ]
        for run in runs:
            lines += render_run(run)
    lines += [
        "## Cara menjalankan",
        "",
        "1. Siapkan foto: `data/eval/<id_anjing>/*.jpg` (minimal 2 foto per anjing; folder `data/` di-gitignore).",
        "   Untuk DogFaceNet: unduh dari https://zenodo.org/records/12578449 lalu jalankan",
        "   `ai-service/tools/prepare_dogfacenet.py` (lihat docstring-nya).",
        "2. Siapkan venv layanan AI (lihat `ai-service/README.md`).",
        "3. Dari root repo:",
        "",
        "```bash",
        "ai-service/.venv/Scripts/python scripts/eval.py                      # data/eval, pipeline lengkap",
        "ai-service/.venv/Scripts/python scripts/eval.py --data-dir data/eval_aligned --name dogfacenet-aligned",
        "ai-service/.venv/Scripts/python scripts/eval.py --mode whole-image   # ablasi tanpa quality gate/detektor",
        "ai-service/.venv/Scripts/python -m pytest scripts/tests               # uji fungsi metrik",
        "```",
        "",
        "## Definisi",
        "",
        "- **Pembagian per individu anjing** (bukan per foto): sebagian anjing *terdaftar* (foto galeri + foto probe),",
        "  sisanya *tak terdaftar* (semua fotonya jadi probe open-set). Seed tetap, jadi hasil dapat diulang.",
        "- **Skor anjing** = kemiripan kosinus maksimum antara foto probe dan semua foto galeri anjing itu",
        "  (sama dengan `match_dogs()` di Postgres).",
        "- **Rank-1 / Rank-5**: probe dari anjing terdaftar yang anjing aslinya ada di urutan 1 / 5 besar.",
        "- **TAR@FAR=1%**: proporsi pasangan asli (probe, anjingnya) yang diterima pada ambang yang hanya",
        "  meloloskan 1% pasangan palsu (probe, anjing lain) — termasuk semua pasangan dari anjing tak terdaftar.",
        "- **match_strong**: ambang terendah sehingga dari semua probe yang skor teratasnya >= ambang, paling banyak",
        f"  {STRONG_MAX_ERROR:.0%} menunjuk anjing yang salah (probe anjing tak terdaftar selalu dihitung salah).",
        "- **match_unsure**: titik *equal error*: proporsi probe terdaftar yang skor anjing aslinya < ambang",
        "  sama dengan proporsi probe anjing tak terdaftar yang skor teratasnya >= ambang (maks. sama dengan match_strong).",
        f"  Ambang strong yang hanya mencakup < {STRONG_MIN_SUPPORT} probe diabaikan; jika tidak ada ambang yang memenuhi, ditulis `-`.",
        "- **Pembersihan label**: foto dengan kosinus >= "
        f"{DUPLICATE_COSINE} dianggap gambar yang sama (bukan pengambilan baru). Folder yang berbagi foto seperti itu digabung,"
        " duplikat dalam satu anjing disimpan sekali.",
        "- **Penolakan anjing tak terdaftar**: proporsi probe anjing tak terdaftar yang skor teratasnya di bawah ambang",
        "  (di bawah match_unsure = zona *none*, aplikasi menawarkan pendaftaran anjing baru).",
        "- **Latensi** diukur in-process (decode → kualitas → deteksi → embedding), tanpa overhead HTTP;",
        "  lihat `scripts/benchmark_latency.py` untuk latensi lewat HTTP.",
        "",
    ]
    return "\n".join(lines)


def render_run(run: dict) -> list[str]:
    m = run["metrics"]
    lat = run["latency"]
    lines = [
        f"## {run['name']}",
        "",
        f"- Diukur: {run['measured_at']} · mode `{run['mode']}` · model `{run['model_version']}`",
        f"- Dataset: `{run['data_dir']}` — {run['dataset']['dogs']} anjing, {run['dataset']['photos']} foto"
        f" ({run['dataset'].get('source', 'sumber tidak dicatat')})",
        f"- Foto lolos pipeline: {run['accepted_photos']} dari {run['dataset']['photos']}; ditolak per alasan pertama: "
        + (", ".join(f"`{k}` {v}" for k, v in run["rejections"].items()) or "tidak ada"),
        f"- Pembersihan label: {run.get('cleaning', {}).get('folders_merged', 0)} folder digabung karena berisi foto (hampir) identik"
        f" dengan folder lain (anjing yang sama tercatat dua kali), {run.get('cleaning', {}).get('duplicate_photos_dropped', 0)} foto duplikat"
        f" dalam satu anjing dibuang (kosinus >= {DUPLICATE_COSINE})",
        f"- Split (seed {run['seed']}): {m['gallery_dogs']} anjing terdaftar ({m['gallery_photos']} foto galeri,"
        f" maks. {run['gallery_per_dog']}/anjing; {m['probe_photos']} probe), {m['unregistered_dogs']} anjing tak terdaftar"
        f" ({m['unregistered_photos']} probe); {m['registered_dogs_dropped']} anjing terdaftar dibuang karena < 2 foto lolos",
        f"- Perangkat: {run['hardware']}",
        "",
        "| Metrik | Nilai |",
        "|---|---|",
        f"| Rank-1 | {pct(m['rank1'])} |",
        f"| Rank-5 | {pct(m['rank5'])} |",
        f"| TAR@FAR=1% | {pct(m['tar_at_far_1pct'])} (ambang {fmt(m['far_1pct_threshold'])}) |",
        f"| Rekomendasi `match_strong` | {fmt(m['match_strong'])} |",
        f"| Rekomendasi `match_unsure` | {fmt(m['match_unsure'])} |",
        f"| Probe terdaftar di zona strong & benar / salah | {pct(m['strong_zone_registered_correct'])} / {pct(m['strong_zone_registered_wrong'])} |",
        f"| Probe terdaftar yang skor anjing aslinya >= `match_unsure` | {pct(m.get('registered_own_dog_at_or_above_unsure'))} |",
        f"| Anjing tak terdaftar ditolak pada `match_unsure` (zona none) | {pct(m['unregistered_rejected_at_unsure'])} |",
        f"| Anjing tak terdaftar tidak masuk zona strong | {pct(m['unregistered_rejected_at_strong'])} |",
        f"| Median skor anjing asli / skor teratas anjing tak terdaftar | {fmt(m['genuine_score_median'])} / {fmt(m['unregistered_best_score_median'])} |",
    ]
    if lat["total_all_photos"]:
        lines.append(
            f"| Latensi per foto p50 / p95 (semua foto, n={lat['total_all_photos']['n']}) |"
            f" {lat['total_all_photos']['p50']:.0f} / {lat['total_all_photos']['p95']:.0f} ms |"
        )
    if lat["total_accepted_photos"]:
        lines.append(
            f"| Latensi per foto lolos p50 / p95 (n={lat['total_accepted_photos']['n']}) |"
            f" {lat['total_accepted_photos']['p50']:.0f} / {lat['total_accepted_photos']['p95']:.0f} ms |"
        )
    for stage, summary in lat["stages"].items():
        if summary:
            lines.append(
                f"| Tahap `{stage}` p50 / p95 (n={summary['n']}) | {summary['p50']:.0f} / {summary['p95']:.0f} ms |"
            )
    lines += [
        "",
        "Pengaruh satu ambang (probe terdaftar dijawab benar / salah pada skor >= ambang; probe anjing tak terdaftar yang lolos ambang):",
        "",
        "| Ambang | Terdaftar benar | Terdaftar salah | Tak terdaftar lolos |",
        "|---|---|---|---|",
    ]
    for row in m.get("threshold_table", []):
        lines.append(
            f"| {row['threshold']:.2f} | {pct(row['registered_correct'])} | {pct(row['registered_wrong'])} | {pct(row['unregistered_accepted'])} |"
        )
    lines.append("")
    if run.get("notes"):
        lines += [f"Catatan: {run['notes']}", ""]
    return lines


def render_document(results_dir: Path, doc_path: Path) -> None:
    runs = [json.loads(p.read_text()) for p in sorted(results_dir.glob("*.json"))] if results_dir.exists() else []
    doc_path.parent.mkdir(parents=True, exist_ok=True)
    doc_path.write_text(render_markdown(runs), encoding="utf-8")
    print(f"wrote {doc_path} ({len(runs)} run(s))")


# ---------------------------------------------------------------- main


def dataset_source(data_dir: Path) -> str:
    meta = data_dir / "DATASET.json"
    if not meta.exists():
        return "sumber tidak dicatat"
    info = json.loads(meta.read_text())
    return (
        f"{info.get('dataset')}, {info.get('subset')}; sumber {info.get('source_url')}; lisensi {info.get('license')}"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data-dir", type=Path, default=REPO / "data" / "eval")
    parser.add_argument("--name", help="run name (default: data dir name + mode)")
    parser.add_argument("--mode", choices=["pipeline", "whole-image"], default="pipeline")
    parser.add_argument("--unregistered-fraction", type=float, default=0.3)
    parser.add_argument("--gallery-per-dog", type=int, default=2)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument(
        "--max-dogs", type=int, help="evaluate a seeded random subset of dogs (e.g. to compare slow detectors)"
    )
    parser.add_argument("--notes", default="")
    parser.add_argument("--results-dir", type=Path, default=REPO / "data" / "eval_results")
    parser.add_argument("--doc", type=Path, default=REPO / "docs" / "EVALUATION.md")
    parser.add_argument("--render-only", action="store_true")
    args = parser.parse_args()

    if args.render_only:
        render_document(args.results_dir, args.doc)
        return 0
    data_dir = args.data_dir.resolve()
    dataset = list_dataset(data_dir) if data_dir.exists() else {}
    if sum(len(p) for p in dataset.values()) == 0:
        print(f"no photos under {data_dir}; nothing evaluated")
        render_document(args.results_dir, args.doc)
        return 1

    if args.max_dogs and args.max_dogs < len(dataset):
        chosen = sorted(random.Random(args.seed + 1).sample(sorted(dataset), args.max_dogs))
        dataset = {dog: dataset[dog] for dog in chosen}
    name = args.name or f"{data_dir.name}-{args.mode}"
    pipeline = load_service()
    cache_dir = REPO / "data" / "eval_cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    # Keyed by data + mode + model, so subsets and re-runs reuse already computed photos.
    cache_file = cache_dir / f"{data_dir.name}__{args.mode}__{pipeline.model_version}.json"
    print(f"evaluating {name}: {len(dataset)} dogs with {pipeline.model_version}")
    results = run_photos(pipeline, dataset, args.mode, cache_file)

    photos: dict[str, list[tuple[str, np.ndarray]]] = {}
    for result in results:
        if result.embedding is not None:
            photos.setdefault(result.dog, []).append((result.path, result.embedding))
    accepted, cleaning = deduplicate(photos, DUPLICATE_COSINE)
    registered, unregistered = split_dogs(list(accepted), args.unregistered_fraction, args.seed)
    metrics = compute_metrics(accepted, registered, unregistered, args.gallery_per_dog, args.seed)

    run = {
        "name": name,
        "measured_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "mode": args.mode,
        "model_version": pipeline.model_version
        if args.mode == "pipeline"
        else f"{pipeline.embedder.name} (seluruh gambar)",
        "data_dir": data_dir.relative_to(REPO).as_posix() if data_dir.is_relative_to(REPO) else str(data_dir),
        "dataset": {"dogs": len(dataset), "photos": len(results), "source": dataset_source(data_dir)},
        "accepted_photos": sum(1 for r in results if r.embedding is not None),
        "cleaning": cleaning,
        "rejections": rejection_summary(results),
        "seed": args.seed,
        "gallery_per_dog": args.gallery_per_dog,
        "unregistered_fraction": args.unregistered_fraction,
        "metrics": metrics,
        "latency": latency_summary(results),
        "hardware": hardware(),
        "notes": args.notes,
    }
    args.results_dir.mkdir(parents=True, exist_ok=True)
    (args.results_dir / f"{name}.json").write_text(json.dumps(run, indent=2))
    print(json.dumps(metrics, indent=2))
    render_document(args.results_dir, args.doc)
    return 0


if __name__ == "__main__":
    sys.exit(main())
