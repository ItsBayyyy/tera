"""Seed the DEMO banjar from local photos.

Layout: data/demo/<dog_name>/*.jpg with at least 2 photos per dog. All photos except the last
(in name order) are registered through the real AI service; the last one is uploaded as an
unregistered "test photo" (probe) so judges can check whether the system recognises it.

Re-running replaces earlier seed data. With an empty or missing data/demo/ the script explains
how to fill it and exits without changing anything.

Usage (from the repo root, local stack and AI service running):
    ai-service/.venv/Scripts/python scripts/seed_demo.py          # Windows
    ai-service/.venv/bin/python scripts/seed_demo.py              # Linux/macOS
Environment (falls back to .env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY,
AI_SERVICE_URL, AI_SERVICE_KEY.
"""

from __future__ import annotations

import io
import os
import re
import sys
import uuid
from dataclasses import dataclass
from pathlib import Path

import httpx
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
DEMO_DIR = ROOT / "data" / "demo"
PROBE_PREFIX = "demo-probes"
MAX_SIDE = 1024
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


@dataclass
class DemoDog:
    slug: str
    gallery: list[Path]
    probes: list[Path]


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


def slugify(name: str) -> str:
    """Probe file names must match the app's pattern [A-Za-z0-9_-]+."""
    slug = re.sub(r"[^A-Za-z0-9_-]+", "-", name).strip("-")
    return slug or "anjing"


def plan_dogs(demo_dir: Path) -> list[DemoDog]:
    """Every folder with ≥2 photos becomes one demo dog; the last photo is held out as a probe."""
    dogs: list[DemoDog] = []
    if not demo_dir.is_dir():
        return dogs
    for folder in sorted(p for p in demo_dir.iterdir() if p.is_dir()):
        photos = sorted(p for p in folder.iterdir() if p.suffix.lower() in IMAGE_SUFFIXES)
        if len(photos) < 2:
            print(f"  lewati {folder.name}: butuh minimal 2 foto, ada {len(photos)}")
            continue
        dogs.append(DemoDog(slug=slugify(folder.name), gallery=photos[:-1], probes=photos[-1:]))
    return dogs


def to_jpeg(path: Path) -> bytes:
    """Mirror the browser: honour EXIF rotation, longest side ≤1024 px, JPEG q80, no metadata."""
    with Image.open(path) as img:
        img = ImageOps.exif_transpose(img).convert("RGB")
        img.thumbnail((MAX_SIDE, MAX_SIDE))
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=80)
        return out.getvalue()


class Seeder:
    def __init__(self, supabase_url: str, secret: str, ai_url: str, ai_key: str) -> None:
        self.rest = httpx.Client(
            base_url=f"{supabase_url.rstrip('/')}/rest/v1",
            headers={"apikey": secret, "Authorization": f"Bearer {secret}", "Content-Type": "application/json"},
            timeout=30,
        )
        self.storage = httpx.Client(
            base_url=f"{supabase_url.rstrip('/')}/storage/v1",
            headers={"apikey": secret, "Authorization": f"Bearer {secret}"},
            timeout=60,
        )
        self.ai = httpx.Client(base_url=ai_url.rstrip("/"), headers={"X-Service-Key": ai_key}, timeout=120)

    def demo_banjar(self) -> str:
        rows = self.rest.get("/banjars", params={"select": "id", "is_demo": "eq.true"}).raise_for_status().json()
        if not rows:
            sys.exit("Banjar DEMO tidak ada. Jalankan `npx supabase db reset` dulu.")
        return rows[0]["id"]

    def clear_previous(self, banjar_id: str) -> None:
        dogs = (
            self.rest.get(
                "/dogs",
                params={"select": "id,dog_photos(storage_path)", "banjar_id": f"eq.{banjar_id}", "demo_seed": "eq.true"},
            )
            .raise_for_status()
            .json()
        )
        paths = [p["storage_path"] for d in dogs for p in d["dog_photos"]]
        probes = (
            self.storage.post("/object/list/dog-photos", json={"prefix": PROBE_PREFIX, "limit": 1000})
            .raise_for_status()
            .json()
        )
        paths += [f"{PROBE_PREFIX}/{p['name']}" for p in probes]
        if paths:
            self.storage.request("DELETE", "/object/dog-photos", json={"prefixes": paths}).raise_for_status()
        if dogs:
            ids = ",".join(d["id"] for d in dogs)
            self.rest.delete("/dogs", params={"id": f"in.({ids})"}).raise_for_status()
        print(f"  dihapus: {len(dogs)} anjing seed, {len(paths)} file")

    def upload(self, path: str, data: bytes) -> None:
        self.storage.post(
            f"/object/dog-photos/{path}", content=data, headers={"Content-Type": "image/jpeg", "x-upsert": "true"}
        ).raise_for_status()

    def analyze(self, data: bytes) -> dict:
        return self.ai.post("/v1/analyze", files={"image": ("photo.jpg", data, "image/jpeg")}).raise_for_status().json()

    def seed_dog(self, banjar_id: str, dog: DemoDog, vaccinate: bool) -> int:
        created = (
            self.rest.post(
                "/dogs",
                headers={"Prefer": "return=representation"},
                json={
                    "banjar_id": banjar_id,
                    "nickname": dog.slug,
                    "color": "Belum dicatat (demo)",
                    "sex": "unknown",
                    "ownership": "unknown",
                    "demo_seed": True,
                    "created_by": None,
                },
            )
            .raise_for_status()
            .json()[0]
        )
        stored = 0
        for photo in dog.gallery:
            data = to_jpeg(photo)
            result = self.analyze(data)
            if result["embedding"] is None:
                print(f"    {photo.name}: ditolak ({', '.join(result['quality']['reasons'])}), tidak didaftarkan")
                continue
            storage_path = f"{banjar_id}/{created['id']}/{uuid.uuid4()}.jpg"
            self.upload(storage_path, data)
            self.rest.post(
                "/dog_photos",
                json={
                    "dog_id": created["id"],
                    "storage_path": storage_path,
                    "quality_score": result["detection"]["score"],
                    "embedding": result["embedding"],
                    "model_version": result["model_version"],
                },
            ).raise_for_status()
            stored += 1
        if stored == 0:
            self.rest.delete("/dogs", params={"id": f"eq.{created['id']}"}).raise_for_status()
            print(f"  {dog.slug}: tidak ada foto yang lolos, anjing tidak didaftarkan")
            return 0
        if vaccinate:
            # Demo-only record so the gallery shows both vaccine states; it lives in the DEMO banjar.
            self.rest.post("/vaccinations", json={"dog_id": created["id"], "ai_status": "verified", "officer_id": None}).raise_for_status()
        for index, probe in enumerate(dog.probes, start=1):
            self.upload(f"{PROBE_PREFIX}/{dog.slug}__{index}.jpg", to_jpeg(probe))
        print(f"  {dog.slug}: {stored} foto terdaftar, {len(dog.probes)} foto uji")
        return stored


def main() -> int:
    load_env_file(ROOT / ".env.local")
    dogs = plan_dogs(DEMO_DIR)
    if not dogs:
        print(
            "Folder data/demo/ kosong.\n"
            "Isi dengan data/demo/<nama_anjing>/*.jpg (minimal 2 foto per anjing, lisensi jelas),\n"
            "lalu jalankan skrip ini lagi. Halaman /demo tetap berfungsi dengan state kosong."
        )
        return 0

    missing = [k for k in ("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "AI_SERVICE_URL", "AI_SERVICE_KEY") if not os.environ.get(k)]
    if missing:
        sys.exit(f"Variabel lingkungan belum diisi: {', '.join(missing)}")

    seeder = Seeder(
        os.environ["NEXT_PUBLIC_SUPABASE_URL"],
        os.environ["SUPABASE_SECRET_KEY"],
        os.environ["AI_SERVICE_URL"],
        os.environ["AI_SERVICE_KEY"],
    )
    try:
        seeder.ai.get("/health").raise_for_status()
    except httpx.HTTPError:
        sys.exit("AI service tidak bisa dihubungi. Jalankan ai-service dulu (lihat ai-service/README.md).")

    banjar_id = seeder.demo_banjar()
    print(f"Seed banjar DEMO ({len(dogs)} anjing)")
    seeder.clear_previous(banjar_id)
    total = sum(seeder.seed_dog(banjar_id, dog, vaccinate=i % 2 == 0) for i, dog in enumerate(dogs))
    print(f"Selesai: {total} foto terdaftar.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
