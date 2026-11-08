"""Download a few public-domain / CC0 test photos from Wikimedia Commons.

Each file's license is read live from the Commons API and the download is refused
unless it is CC0 or public domain. Source URL, author and license are written to
`data/samples/SOURCES.json`. `data/` is gitignored: these images are for local
tests and calibration only and are never committed.

Usage (from the repo root):
    ai-service/.venv/Scripts/python ai-service/tools/fetch_samples.py
"""

from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

import httpx

API = "https://commons.wikimedia.org/w/api.php"
# Wikimedia wants a descriptive User-Agent and answered 403 to httpx's default br/zstd Accept-Encoding.
HEADERS = {"User-Agent": "Tera-dev/0.1 (local test fixtures)", "Accept-Encoding": "gzip"}
THUMB_WIDTH = 1024  # matches the PWA, which re-encodes photos to <=1024 px before upload

# name -> (Commons file title, role). "dog" photos show a dog face; "not_dog" must not.
SAMPLES = {
    "dog_boxer_front": "File:A front view of the face of the boxer dog breed.jpg",
    "dog_kintamani_black": "File:Kintamani dog black.jpg",
    "dog_kintamani_white": "File:Kintamani dog white.jpg",
    "dog_street_gianyar": "File:Street dog-Gianyar Bali-2009.jpeg",
    "dog_black_head_tilt": "File:Black dog head tilt.jpg",
    "dog_stray_pixabay": "File:Stray Dog Pixabay.jpg",
    "dog_portrait": "File:Dog-portrait-1367008135LpJ.jpg",
    "dog_half_sleeping": "File:Half sleeping face dog.jpg",
    "dog_gsd_portrait": "File:GSD Portrait.jpg",
    "dog_beach": "File:Dog on a beach.jpg",
    "dog_dirt_road": "File:Dog on dirt road.jpg",
    "dog_feral": "File:Feral Dog.jpg",
    "not_dog_coffee": "File:Coffee cup and coffee bean.jpg",
    "not_dog_coffee_beans": "File:Coffee cup surrounded by coffee beans.jpg",
    "not_dog_cat": "File:A pet cat curiously looking at the camera man.jpg",
    "not_dog_monkey": "File:A monkey is sitting on the pillar of a house on the mountain.jpg",
}
ALLOWED = re.compile(r"(cc0|public domain)", re.IGNORECASE)


def strip_html(value: str) -> str:
    return re.sub(r"<[^>]+>", "", value).strip()


def fetch_info(client: httpx.Client, title: str) -> dict:
    params = {
        "action": "query",
        "format": "json",
        "titles": title,
        "prop": "imageinfo",
        "iiprop": "url|extmetadata",
        "iiurlwidth": str(THUMB_WIDTH),
        "iiextmetadatafilter": "LicenseShortName|LicenseUrl|Artist|UsageTerms",
    }
    for attempt in range(5):
        response = client.get(API, params=params)
        if response.status_code == 200:
            page = next(iter(response.json()["query"]["pages"].values()))
            return page["imageinfo"][0]
        # Commons throttles bursts of anonymous API calls; back off and retry.
        time.sleep(2 * (attempt + 1))
    response.raise_for_status()
    raise RuntimeError(f"Commons API returned {response.status_code} for {title}")


def main() -> int:
    out_dir = Path(__file__).resolve().parents[2] / "data" / "samples"
    out_dir.mkdir(parents=True, exist_ok=True)
    sources = {}
    with httpx.Client(headers=HEADERS, timeout=60, follow_redirects=True) as client:
        for name, title in SAMPLES.items():
            info = fetch_info(client, title)
            meta = info["extmetadata"]
            license_name = meta.get("LicenseShortName", {}).get("value", "")
            if not ALLOWED.search(license_name):
                print(f"skip {name}: license '{license_name}' is not CC0/public domain")
                continue
            target = out_dir / f"{name}.jpg"
            if not target.exists():
                response = client.get(info.get("thumburl") or info["url"])
                response.raise_for_status()
                target.write_bytes(response.content)
            sources[target.name] = {
                "title": title,
                "page": info["descriptionurl"],
                "license": license_name,
                "license_url": meta.get("LicenseUrl", {}).get("value", ""),
                "author": strip_html(meta.get("Artist", {}).get("value", "")),
                "role": "not_dog" if name.startswith("not_dog") else "dog",
            }
            print(f"ok   {name}: {license_name}")
    (out_dir / "SOURCES.json").write_text(json.dumps(sources, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
