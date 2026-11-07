import importlib.util
import re
import sys
from pathlib import Path

from PIL import Image

SPEC = importlib.util.spec_from_file_location("seed_demo", Path(__file__).resolve().parents[1] / "seed_demo.py")
seed_demo = importlib.util.module_from_spec(SPEC)
sys.modules["seed_demo"] = seed_demo  # dataclasses look the module up by name
SPEC.loader.exec_module(seed_demo)

PROBE_PATTERN = re.compile(r"^demo-probes/[A-Za-z0-9_-]+__[A-Za-z0-9_.-]+\.jpe?g$")


def make_photo(path: Path, size=(1600, 1200)) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", size, (120, 90, 60)).save(path)


def test_plan_holds_out_the_last_photo_as_probe(tmp_path: Path) -> None:
    for name in ("b.jpg", "a.jpg", "c.jpg"):
        make_photo(tmp_path / "Belang" / name)
    dogs = seed_demo.plan_dogs(tmp_path)
    assert len(dogs) == 1
    assert [p.name for p in dogs[0].gallery] == ["a.jpg", "b.jpg"]
    assert [p.name for p in dogs[0].probes] == ["c.jpg"]


def test_plan_skips_dogs_with_a_single_photo(tmp_path: Path) -> None:
    make_photo(tmp_path / "Sendiri" / "a.jpg")
    assert seed_demo.plan_dogs(tmp_path) == []


def test_plan_handles_a_missing_folder(tmp_path: Path) -> None:
    assert seed_demo.plan_dogs(tmp_path / "nope") == []


def test_slug_matches_the_probe_path_pattern_used_by_the_app() -> None:
    for name in ("Si Belang", "anjing#1", "Kintamani putih", "!!!"):
        assert PROBE_PATTERN.match(f"demo-probes/{seed_demo.slugify(name)}__1.jpg")


def test_jpeg_is_resized_like_the_browser(tmp_path: Path) -> None:
    make_photo(tmp_path / "x.png", size=(3000, 1500))
    data = seed_demo.to_jpeg(tmp_path / "x.png")
    out = tmp_path / "out.jpg"
    out.write_bytes(data)
    with Image.open(out) as img:
        assert img.format == "JPEG"
        assert max(img.size) == 1024
        assert "exif" not in img.info
