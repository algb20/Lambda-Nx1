#!/usr/bin/env python3
"""Tests for scripts/prepare-logo.py. Run: python3 scripts/prepare-logo.test.py

Uses only the standard library's unittest plus Pillow (which the script already needs).
"""

from __future__ import annotations

import importlib.util
import random
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

SCRIPT = Path(__file__).with_name("prepare-logo.py")
_spec = importlib.util.spec_from_file_location("prepare_logo", SCRIPT)
prepare_logo = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(prepare_logo)


def logo_like(size: tuple[int, int], background=(5, 8, 20)) -> Image.Image:
    """A dark square-ish image with a bright mark on it, shaped like the real logos."""
    image = Image.new("RGB", size, background)
    width, height = size
    for x in range(width // 3, 2 * width // 3):
        for y in range(height // 3, 2 * height // 3, 3):
            image.putpixel((x, y), (230, 170, 20))
    return image


class PrepareLogoTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)
        self.addCleanup(self._tmp.cleanup)

    def prepare(self, image: Image.Image, name: str = "logo.png"):
        src = self.tmp / name
        image.save(src)
        return prepare_logo.prepare(src, self.tmp / "out" / f"{Path(name).stem}-1024.png")

    def assertMeetsSpec(self, path: Path) -> None:
        with Image.open(path) as out:
            self.assertEqual(out.size, (1024, 1024), f"{path.name} is not 1024x1024")
            self.assertIn(out.format, ("PNG", "JPEG"), f"{path.name} is not PNG or JPEG")
        self.assertLessEqual(
            path.stat().st_size, prepare_logo.MAX_BYTES, f"{path.name} exceeds the size limit"
        )

    def test_oversized_square_is_resampled_without_padding(self) -> None:
        (self.tmp / "out").mkdir()
        written, _size, encoding, padded = self.prepare(logo_like((1248, 1248)))
        self.assertFalse(padded, "a square source must not be padded")
        self.assertEqual(encoding, "PNG")
        self.assertMeetsSpec(written)

    def test_undersized_square_is_upscaled(self) -> None:
        (self.tmp / "out").mkdir()
        written, _size, _encoding, padded = self.prepare(logo_like((512, 512)))
        self.assertFalse(padded)
        self.assertMeetsSpec(written)

    def test_already_correct_size_still_produces_a_valid_file(self) -> None:
        (self.tmp / "out").mkdir()
        written, _size, _encoding, padded = self.prepare(logo_like((1024, 1024)))
        self.assertFalse(padded)
        self.assertMeetsSpec(written)

    def test_non_square_is_padded_not_cropped(self) -> None:
        (self.tmp / "out").mkdir()
        source = logo_like((1400, 900))
        written, _size, _encoding, padded = self.prepare(source, "wide.png")
        self.assertTrue(padded, "a non-square source must be padded to square")
        self.assertMeetsSpec(written)
        # The padding takes the artwork's own border colour, so the new edge matches.
        with Image.open(written) as out:
            self.assertEqual(out.convert("RGB").getpixel((512, 2)), (5, 8, 20))

    def test_padding_keeps_the_full_artwork(self) -> None:
        """A mark touching the top edge of a wide source survives padding."""
        (self.tmp / "out").mkdir()
        source = Image.new("RGB", (800, 400), (0, 0, 0))
        for x in range(800):
            source.putpixel((x, 0), (255, 255, 255))
        written, _size, _encoding, padded = self.prepare(source, "edge.png")
        self.assertTrue(padded)
        with Image.open(written) as out:
            rgb = out.convert("RGB")
            column = [rgb.getpixel((512, y))[0] for y in range(1024)]
        self.assertGreater(max(column), 200, "the white edge stripe was cropped away")

    def test_transparency_is_preserved_when_the_png_fits(self) -> None:
        (self.tmp / "out").mkdir()
        source = Image.new("RGBA", (600, 600), (0, 0, 0, 0))
        source.paste(Image.new("RGBA", (300, 300), (255, 0, 0, 255)), (150, 150))
        written, _size, encoding, _padded = self.prepare(source, "alpha.png")
        self.assertEqual(encoding, "PNG")
        self.assertMeetsSpec(written)
        with Image.open(written) as out:
            self.assertEqual(out.mode, "RGBA")
            self.assertEqual(out.getpixel((10, 10))[3], 0, "transparent corner was filled in")

    def test_heavy_image_falls_back_to_jpeg_within_the_limit(self) -> None:
        (self.tmp / "out").mkdir()
        random.seed(11)
        noisy = Image.new("RGB", (2000, 2000))
        noisy.putdata(
            [
                (random.randrange(256), random.randrange(256), random.randrange(256))
                for _ in range(2000 * 2000)
            ]
        )
        written, _size, encoding, _padded = self.prepare(noisy, "noise.png")
        self.assertTrue(encoding.startswith("JPEG"), f"expected a JPEG fallback, got {encoding}")
        self.assertEqual(written.suffix, ".jpg")
        self.assertMeetsSpec(written)
        self.assertFalse(written.with_suffix(".png").exists(), "the oversized PNG was left behind")

    def test_jpeg_source_is_accepted(self) -> None:
        (self.tmp / "out").mkdir()
        written, _size, _encoding, _padded = self.prepare(logo_like((1300, 1300)), "logo.jpg")
        self.assertMeetsSpec(written)

    def test_cli_reports_missing_input(self) -> None:
        out_dir = self.tmp / "cli-out"
        code = prepare_logo.main([str(self.tmp / "nope.png"), "--out-dir", str(out_dir)])
        self.assertEqual(code, 1)

    def test_cli_writes_every_input(self) -> None:
        first = self.tmp / "one.png"
        second = self.tmp / "two.png"
        logo_like((1248, 1248)).save(first)
        logo_like((900, 1200)).save(second)
        out_dir = self.tmp / "cli-out"
        code = prepare_logo.main([str(first), str(second), "--out-dir", str(out_dir)])
        self.assertEqual(code, 0)
        written = sorted(out_dir.iterdir())
        self.assertEqual(len(written), 2)
        for path in written:
            self.assertMeetsSpec(path)


if __name__ == "__main__":
    unittest.main(verbosity=2, argv=[sys.argv[0]])
