"""Copy a DogFaceNet subset into the layouts expected by scripts/eval.py and the demo seed.

DogFaceNet (Mougeot et al., PRICAI 2019) is published on Zenodo record 12578449 under
CC-BY-4.0. Download it yourself first (nothing here fetches it):

    https://zenodo.org/records/12578449  -> DogFaceNet_large.zip, DogFaceNet_224resized.zip,
                                            classes_test.txt

Outputs (all under the gitignored data/ folder, local use only):
    data/eval/<dog_id>/*.jpg          raw photos, N identities with >= 3 photos   (--raw-dir)
    data/eval_aligned/<dog_id>/*.jpg  aligned 224 px face crops, official test split (--aligned-dir)
    data/demo/<dog_name>/*.jpg        6 dogs x 3 raw photos not used in data/eval (--raw-dir)

Usage (from the repo root):
    ai-service/.venv/Scripts/python ai-service/tools/prepare_dogfacenet.py \
        --raw-dir data/downloads/dogfacenet/xlarge/images_2 \
        --aligned-dir data/downloads/dogfacenet/x224/after_4_bis \
        --test-classes data/downloads/dogfacenet/classes_test.txt
"""

from __future__ import annotations

import argparse
import json
import random
import re
import shutil
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parents[2] / "data"
SOURCE = {
    "dataset": "DogFaceNet",
    "source_url": "https://zenodo.org/records/12578449",
    "code_repo": "https://github.com/GuillaumeMougeot/DogFaceNet",
    "license": "cc-by-4.0 (as stated on the Zenodo record metadata)",
    "citation": "Mougeot, Li, Jia. A Deep Learning Approach for Dog Face Verification and Recognition. PRICAI 2019.",
    "note": (
        "Local evaluation only; never commit these images. "
        "The Zenodo record notes DogFaceNet_large is not fully curated."
    ),
}


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9_-]+", "-", name.lower()).strip("-")[:40] or "dog"


def photos(folder: Path) -> list[Path]:
    return sorted(p for p in folder.iterdir() if p.suffix.lower() in {".jpg", ".jpeg"})


def copy_dog(files: list[Path], target: Path) -> None:
    target.mkdir(parents=True, exist_ok=True)
    for index, file in enumerate(files):
        shutil.copyfile(file, target / f"{index:02d}{file.suffix.lower()}")


def write_source(folder: Path, extra: dict) -> None:
    (folder / "DATASET.json").write_text(json.dumps({**SOURCE, **extra}, indent=2))


def prepare_raw(raw_dir: Path, n_dogs: int, n_demo: int, seed: int) -> None:
    dogs = [d for d in sorted(raw_dir.iterdir()) if d.is_dir() and 3 <= len(photos(d)) <= 20]
    random.Random(seed).shuffle(dogs)
    eval_dogs, rest = dogs[:n_dogs], dogs[n_dogs:]
    out = DATA / "eval"
    for dog in eval_dogs:
        copy_dog(photos(dog), out / f"dfn-{slug(dog.name)}")
    write_source(
        out, {"subset": f"DogFaceNet_large: {len(eval_dogs)} random identities (seed {seed}) with 3-20 photos"}
    )
    print(f"eval: {len(eval_dogs)} dogs -> {out}")

    # Demo dogs: folders named like a pet name (letters only), not used for evaluation.
    named = [d for d in rest if re.fullmatch(r"[A-Za-z]{3,12}", d.name) and len(photos(d)) >= 3]
    demo = DATA / "demo"
    for dog in named[:n_demo]:
        copy_dog(photos(dog)[:3], demo / slug(dog.name))
    write_source(
        demo, {"subset": f"DogFaceNet_large: {min(n_demo, len(named))} identities x 3 photos, disjoint from data/eval"}
    )
    print(f"demo: {min(n_demo, len(named))} dogs -> {demo}")


def prepare_aligned(aligned_dir: Path, test_classes: Path) -> None:
    test_ids = {line.strip() for line in test_classes.read_text().splitlines() if line.strip()}
    out = DATA / "eval_aligned"
    count = 0
    for dog_id in sorted(test_ids, key=int):
        files = photos(aligned_dir / dog_id)
        if len(files) >= 2:
            copy_dog(files, out / f"dfn224-{dog_id}")
            count += 1
    write_source(out, {"subset": f"DogFaceNet_224resized official test split: {count} identities"})
    print(f"aligned: {count} dogs -> {out}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw-dir", type=Path)
    parser.add_argument("--aligned-dir", type=Path)
    parser.add_argument("--test-classes", type=Path)
    parser.add_argument("--dogs", type=int, default=300)
    parser.add_argument("--demo", type=int, default=6)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()
    if args.raw_dir:
        prepare_raw(args.raw_dir, args.dogs, args.demo, args.seed)
    if args.aligned_dir and args.test_classes:
        prepare_aligned(args.aligned_dir, args.test_classes)
    return 0


if __name__ == "__main__":
    sys.exit(main())
