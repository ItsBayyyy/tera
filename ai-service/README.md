---
title: Tera AI Service
colorFrom: gray
colorTo: green
sdk: docker
app_port: 7860
pinned: false
short_description: Dog photo quality check, detection and re-ID embedding
---

# Tera AI service

Stateless FastAPI service used by the Tera Next.js route handlers. For one dog photo it
returns a quality verdict, the detected dog head box and a MiewID re-identification
embedding. **Matching is not done here**: the embedding is stored and compared in
Postgres/pgvector (`match_dogs()`). Uploaded photos and embeddings are never written to
disk or logged.

## API

All endpoints except `GET /health` require the header `X-Service-Key: <AI_SERVICE_KEY>`
(constant-time compare). Otherwise: `401 {"error":"unauthorized"}`.

`GET /health` → `{"status":"ok","model_version":"owlvit-base-patch32+miewid-msv3","embedding_dim":2152}`

`POST /v1/analyze` — `multipart/form-data` with one file field named `image` (max 5 MB).

```json
{
  "quality": {"ok": true, "reasons": [], "blur": 412.3, "brightness": 118.2, "width": 1024, "height": 768},
  "detection": {"found": true, "box": [x1, y1, x2, y2], "score": 0.87},
  "embedding": [/* 2152 float32 values, L2-normalized */],
  "model_version": "owlvit-base-patch32+miewid-msv3"
}
```

| Case | Response |
|---|---|
| file > 5 MB | `413 {"error":"too_large"}` |
| not decodable / no `image` field | `400 {"error":"invalid_image"}` |
| unexpected failure | `500 {"error":"internal_error"}` |
| photo rejected | `200`, `embedding: null`, `quality.ok: false`, `quality.reasons` non-empty |

Field semantics:

- `quality.ok` is `true` exactly when `embedding` is not null (no reasons at all).
- `quality.reasons` (ordered, show the first one to the user):
  `TOO_SMALL` (shorter image side < 224 px, or head box < 64 px),
  `TOO_DARK` / `TOO_BRIGHT` (mean gray level < 45 / > 215),
  `BLUR` (variance of Laplacian < 20 on the head crop resized to 256 px; on the whole frame when no dog is found),
  `NO_DOG` (whole-dog detection score < 0.15),
  `FACE_NOT_VISIBLE` (a dog is detected but no "dog's face" box with score ≥ 0.02 lies inside it — e.g. dog seen from behind or head hidden).
  `TOO_SMALL`/`TOO_DARK`/`TOO_BRIGHT` on the whole image skip detection (`detection.found=false`, `score=0`).
- `quality.blur` / `brightness` are the measured values; `width`/`height` are the uploaded image size after EXIF rotation.
- `detection.box` is the head box used for the embedding, in pixel coordinates of the uploaded image; `null` when not found.
  `detection.score` is always the whole-dog confidence (also when not found, so near-misses are visible in logs).
- `embedding` length equals `embedding_dim` from `/health` (2152, float32 in the model; JSON numbers on the wire).
  Store it as `halfvec(2152)` in pgvector (HNSW on `vector` is limited to 2000 dims).

Every response carries `X-Request-Id` (taken from the request header if present). Each request is
logged as one JSON line: request id, path, status, outcome, reasons, per-stage latency, image size,
detection score — never image bytes or embeddings.

## Pipeline

1. **Decode** (Pillow, EXIF orientation applied, decompression-bomb limit 40 MP). The analysis copy is
   downscaled to ≤ 1024 px (the PWA already sends ≤ 1024 px).
2. **Quality gate** (OpenCV): resolution, mean brightness, then blur on the head crop.
3. **Detection**: OWL-ViT base-patch32 (`google/owlvit-base-patch32`, pinned revision) with two text
   queries in one pass, "a photo of a dog" and "a photo of a dog's face".
4. **Embedding**: MiewID msv3 (`conservationxlabs/miewid-msv3`, pinned revision) on the head crop plus
   10% margin, resized to 440×440, ImageNet mean/std (exactly as in the model card), L2-normalized.

### Why MiewID is loaded without `trust_remote_code`

The checkpoint's own `modeling_miewid.py` targets transformers 4.45 and fails on transformers 5.x
(`'MiewIdNet' object has no attribute 'all_tied_weights_keys'`). It would also execute code downloaded at
runtime. `app/embedder.py` rebuilds the same network (timm `efficientnetv2_rw_m` + GeM + BatchNorm1d) and
loads `model.safetensors` with `strict=True`. `tools/verify_miewid_equivalence.py` (run in a throwaway
venv with transformers 4.46.3) compared both on the 14 photos then in `data/samples`: worst cosine
similarity 1.000000 (printed to 6 decimals), output dim 2152 for both.

### What the "head box" really is (important limitation)

With OWL-ViT base-patch32 the "dog's face" query almost always returns the same box as the whole dog
(checked visually on 16 photos; a second OWL-ViT pass on the dog crop also returned boxes covering
94–99% of the dog in 13 of 16). So for full-body photos MiewID embeds the whole dog; for close-up
face photos (what the field UI asks for) the box is effectively the head. OWLv2 at 960 px did find real
face boxes on some photos but takes ~5 s per image on this CPU. A proper dog-face detector is the
biggest expected accuracy gain (DogFaceNet aligned face crops reach far higher rank-1 than raw photos,
see `docs/EVALUATION.md`).

## Measurements (all measured on this repo, 2026-11-08)

Hardware: laptop CPU "Intel64 Family 6 Model 141" (11th-gen Core H), 12 logical CPUs, torch 2.15.0+cpu
using 6 threads, Windows 11, no GPU. Embedding: **2152 dims, float32**, L2 norm 1 (± 1e-4 in tests).

**`/v1/analyze` latency** (photos prepared like the PWA: ≤ 1024 px, JPEG q80; first request = warm-up, excluded):

| Run | N | p50 | p95 |
|---|---|---|---|
| HTTP, `scripts/benchmark_latency.py`, run 1 | 40 | 831 ms | 882 ms |
| HTTP, run 2 (2 demo photos differed) | 40 | 902 ms | 946 ms |
| In-process total | 40 | 876 ms | 905 ms |
| — decode / quality | 40 | 4 / 2 ms | 8 / 3 ms |
| — detect (OWL-ViT B/32) | 40 | 572 ms | 594 ms |
| — embed (MiewID) | 36 | 297 ms | 325 ms |
| In-process, eval run over DogFaceNet raw photos | 1516 | 899 ms | 954 ms |

Target was p50 ≤ 3 s: met with ~3× margin. Model load at startup: ~13 s (weights cached).

**Detector alternatives** (detection stage only, same 14 Commons sample photos, ≤ 1280 px, p50 over 13
after warm-up; dog score = "a photo of a dog" sigmoid score):

| Detector | Detect p50 / max | Dog score on dogs | Dog score on cat / monkey / coffee | Verdict |
|---|---|---|---|---|
| OWLv2 base-patch16-ensemble @ 960 (native) | 5152 / 5331 ms | 0.448–0.842 | (not run on cat/monkey) / ≤ 0.005 | too slow alone (> 3 s budget) |
| OWLv2 base-patch16-ensemble @ 480 (interpolated pos. emb.) | 1021 / 1122 ms | 0.219–0.770 | 0.105 / **0.248** / 0.012 | monkey scores above a real dog: no clean threshold |
| **OWL-ViT base-patch32 @ 768 (chosen)** | 571 / 621 ms | 0.251–0.930 | 0.082 / 0.087 / ≤ 0.005 | fastest, clean separation |
| OWL-ViT base-patch16 | — | — | — | not measured: process hit a memory-allocation failure while loading on the shared laptop |

**Effect on re-ID metrics** (`scripts/eval.py --max-dogs 60`: the same 60 random DogFaceNet raw-photo dogs,
301 photos, same thresholds, same split; full tables in `docs/EVALUATION.md`, runs `zz-detector-compare-*`):

| Detector | Photos accepted | Rank-1 | Rank-5 | TAR@FAR=1% | Detect p50 / p95 | Total p50 |
|---|---|---|---|---|---|---|
| **OWL-ViT base-patch32 (chosen)** | 278 / 301 | 82.2% (n=101 probes) | 94.1% | 74.3% | 594 / 634 ms | 903 ms |
| OWLv2 base-patch16-ensemble @ 960 | 282 / 301 | 73.8% (n=103 probes) | 85.4% | 68.9% | 5117 / 5240 ms | 5426 ms |

The slower detector was not more accurate on this subset, so OWL-ViT B/32 stays. Small subset (41 gallery
dogs): treat the difference as indicative only.

**ONNX**: not attempted. The PyTorch pipeline already meets the latency target by ~3×, and an ONNX path
would add `onnxruntime` plus export code for two models that then need their own ≥ 0.999 cosine check.
Revisit only if the hosted CPU turns out too slow.

### Thresholds and how they were chosen

`tools/calibrate_quality.py ../data/samples ../data/eval --limit 300` measured 298 real photos in which a
dog was detected (DogFaceNet raw photos + Commons samples, analysed exactly like the service) and the same
photos after synthetic degradation:

| Metric | Real photos | Degraded | Threshold |
|---|---|---|---|
| Blur (Laplacian var., head crop @256 px) | min 2.7, p1 24.2, p5 64.8, p50 537 | Gaussian σ = 1% of head size: max 16.5; σ = 2%: max 4.8 | `< 20` → `BLUR` (all synthetic blur rejected, ≈ 1% of real photos) |
| Mean brightness | min 56.4, p1 72.8, max 197.9 | ×0.2 (dark): max 39.4; ×2.2+60 (over-exposed): p25 218.8, min 155.8 | `< 45` → `TOO_DARK`, `> 215` → `TOO_BRIGHT` (no real photo rejected; ~75% of the synthetic over-exposure caught — mean brightness is a weak over-exposure signal) |
| Head box shorter side | p1 76.8 px, p5 118.8 px | — | `< 64 px` → `TOO_SMALL` |
| Dog score (OWL-ViT) | p1 0.195, p5 0.520 (n=300) | cat 0.082, monkey 0.087, coffee ≤ 0.006 | `< 0.15` → `NO_DOG` |
| Face score inside dog | p1 0.017, p5 0.030 | — | `< 0.02` → `FACE_NOT_VISIBLE` (≈ 1–2% of real face-visible photos; see eval rejection counts) |

Synthetic check of `FACE_NOT_VISIBLE` vs `NO_DOG`: 8 dogs were each cut into a left and right half
(16 crops). 12 of 16 crops scored below 0.15 on the dog query (typically the half without the head), so a
dog seen from behind usually yields `NO_DOG`; the 4 crops above 0.15 contained the head and had face
scores ≥ 0.022. `FACE_NOT_VISIBLE` fires when the dog query matches but the face query does not. Both mean "show the dog's face to the
camera". All thresholds are initial values from public photos, not from Bali field photos.

## Run locally

```bash
# from the repo root
uv venv --python 3.11 ai-service/.venv
uv pip install --python ai-service/.venv/Scripts/python.exe -r ai-service/requirements-dev.txt   # Linux/macOS: .venv/bin/python
cd ai-service
cp .env.example .env            # then set AI_SERVICE_KEY
# first start downloads ~0.8 GB of weights into HF_HOME (ai-service/.cache/hf from .env)
.venv/Scripts/uvicorn --factory app.main:create_app --env-file .env --host 127.0.0.1 --port 8000
```

Smoke test:

```bash
curl http://127.0.0.1:8000/health
curl -H "X-Service-Key: $AI_SERVICE_KEY" -F image=@../data/samples/dog_boxer_front.jpg http://127.0.0.1:8000/v1/analyze
```

Tests (from `ai-service/`):

```bash
.venv/Scripts/python tools/fetch_samples.py      # CC0/public-domain photos from Wikimedia Commons -> data/samples
.venv/Scripts/python -m pytest -m "not model"    # contract + logic tests with fake models (no weights)
.venv/Scripts/python -m pytest                   # also real-model tests (skipped if weights/samples missing)
```

## Deploy

### Modal (used for the live app)

`modal_app.py` serves the same FastAPI app on Modal: the image is built from `requirements.txt`, the
pinned weights are baked in at build time, one container (2 CPU, 4 GB) scales to zero 15 minutes after the
last request. `AI_SERVICE_KEY` comes from the Modal secret `tera-ai`. Steps: `../docs/DEPLOY.md`.

```bash
modal secret create tera-ai AI_SERVICE_KEY=change-me
modal deploy ai-service/modal_app.py
```

### Docker (any container host)

```bash
docker build -t tera-ai ai-service
docker run --rm -p 7860:7860 -e AI_SERVICE_KEY=change-me tera-ai
```

The image is CPU-only (`python:3.11-slim`, CPU torch wheels), runs as non-root uid 1000 and listens on
`$PORT` (default 7860, what Spaces expects). **Weights are downloaded at build time**
(`tools/download_models.py`) and the container then runs with `HF_HUB_OFFLINE=1`: cold starts do not
depend on the Hub and every replica runs the same pinned revisions, at the cost of a bigger image.
Set `AI_SERVICE_KEY` as a secret on the host; without it the container refuses to start. Hugging Face
Spaces now require a paid plan for Docker Spaces, which is why the live app uses Modal instead.

## Licenses

Checked on 2026-11-08:

| Component | License found | Source |
|---|---|---|
| MiewID msv3 weights (`conservationxlabs/miewid-msv3`) | **Not stated.** The model card has no `license` field and the repo has no LICENSE file (same for msv2). | https://huggingface.co/conservationxlabs/miewid-msv3 , https://huggingface.co/api/models/conservationxlabs/miewid-msv3 |
| MiewID code (`WildMeOrg/wbia-plugin-miew-id`) | **Not stated.** GitHub reports no license (`/license` → 404); README only says "Copyright Conservation X Labs 2025"; `setup.py` has no license field. | https://github.com/WildMeOrg/wbia-plugin-miew-id |
| MiewID backbone architecture (timm `efficientnetv2_rw_m`) | Apache-2.0 (timm). Only the architecture code is used; the ImageNet weights are not downloaded. | https://github.com/huggingface/pytorch-image-models |
| OWL-ViT detector (`google/owlvit-base-patch32`) | Apache-2.0 (model card `license: apache-2.0`) | https://huggingface.co/google/owlvit-base-patch32 |
| OWLv2 (`google/owlv2-base-patch16-ensemble`, evaluated, not used) | Apache-2.0 | https://huggingface.co/google/owlv2-base-patch16-ensemble |
| DogFaceNet (evaluation only, never committed) | CC-BY-4.0 per the Zenodo record metadata | https://zenodo.org/records/12578449 |
| Test photos in `data/samples` (never committed) | CC0 / public domain per Wikimedia Commons; per-file source and author in `data/samples/SOURCES.json` | https://commons.wikimedia.org |

Without a stated license, MiewID's code and weights default to "all rights reserved". Until Conservation X
Labs / Wild Me confirm terms, treat using them in a public deployment as unresolved.

## Files

- `app/main.py` — FastAPI app factory, auth, upload limits, logging
- `app/pipeline.py` — quality → detection → embedding decisions (models injected, testable with fakes)
- `app/detector.py`, `app/embedder.py`, `app/quality.py`, `app/boxes.py`, `app/config.py`, `app/logging_setup.py`
- `tools/` — sample download, quality calibration, DogFaceNet preparation, MiewID equivalence check, model download
- `tests/` — `test_contract.py` (HTTP contract, fake models), `test_pipeline.py` (decision logic), `test_model.py` (`@pytest.mark.model`, real weights)
