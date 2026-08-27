#!/usr/bin/env python3
"""Prepare a logo file for an uploader that demands exactly 1024x1024 PNG/JPG under 1.1 MB.

The point of this script is that it does *not* redesign anything. It only does what
is needed to satisfy the uploader:

  * resamples the image to exactly 1024x1024 (Lanczos, so the artwork stays sharp),
  * pads a non-square image to square first, using the image's own border colour, so
    that no part of the artwork is ever cropped away,
  * writes PNG, and only if the PNG exceeds the byte limit falls back to JPEG (also
    an accepted format) at the highest quality that fits.

Nothing is added to, removed from, or recoloured in the artwork.

Usage:
    python3 scripts/prepare-logo.py INPUT [INPUT ...] --out-dir DIR
    python3 scripts/prepare-logo.py logo.png --out logo-1024.png
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from pathlib import Path

try:
    from PIL import Image, ImageFile
except ImportError:  # pragma: no cover - dependency guard
    sys.exit("Pillow is required: pip install pillow")

# The JPEG encoder writes through a fixed-size buffer and raises "Suspension not
# allowed here" when a single optimized scan does not fit in it. A 1024x1024 frame
# never needs more than its own pixel count.
ImageFile.MAXBLOCK = max(ImageFile.MAXBLOCK, 1024 * 1024 * 4)

TARGET_SIZE = 1024
# The uploader says "max 1.1MB". Decimal megabytes is the smaller reading of that, so
# targeting it satisfies either interpretation.
MAX_BYTES = 1_100_000
JPEG_QUALITIES = (95, 92, 90, 87, 85, 82, 80, 75, 70)


def border_colour(image: Image.Image) -> tuple[int, int, int]:
    """Most common colour along the image border — used as padding for non-square art."""
    rgb = image.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    samples: list[tuple[int, int, int]] = []
    for x in range(width):
        samples.append(pixels[x, 0])
        samples.append(pixels[x, height - 1])
    for y in range(height):
        samples.append(pixels[0, y])
        samples.append(pixels[width - 1, y])
    return Counter(samples).most_common(1)[0][0]


def make_square(image: Image.Image) -> tuple[Image.Image, bool]:
    """Return a square version of the image. Pads (never crops) so no artwork is lost."""
    width, height = image.size
    if width == height:
        return image, False

    side = max(width, height)
    has_alpha = image.mode in ("RGBA", "LA") or "transparency" in image.info
    if has_alpha:
        canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        source = image.convert("RGBA")
    else:
        canvas = Image.new("RGB", (side, side), border_colour(image))
        source = image.convert("RGB")
    canvas.paste(source, ((side - width) // 2, (side - height) // 2))
    return canvas, True


def encode(image: Image.Image, out_path: Path) -> tuple[Path, int, str]:
    """Write the image at or under the byte limit, preferring PNG then JPEG."""
    png_path = out_path.with_suffix(".png")
    png_image = image if image.mode in ("RGB", "RGBA") else image.convert("RGBA")
    png_image.save(png_path, format="PNG", optimize=True)
    png_size = png_path.stat().st_size
    if png_size <= MAX_BYTES:
        return png_path, png_size, "PNG"

    # PNG is lossless but too heavy for the limit; JPEG is equally accepted by the
    # uploader. Flatten any transparency onto the artwork's own border colour so the
    # visible result is identical.
    flat = Image.new("RGB", image.size, border_colour(image))
    if image.mode in ("RGBA", "LA"):
        flat.paste(image, mask=image.split()[-1])
    else:
        flat.paste(image.convert("RGB"))

    jpg_path = out_path.with_suffix(".jpg")
    try:
        for quality in JPEG_QUALITIES:
            flat.save(jpg_path, format="JPEG", quality=quality, optimize=True, subsampling=0)
            size = jpg_path.stat().st_size
            if size <= MAX_BYTES:
                png_path.unlink(missing_ok=True)
                return jpg_path, size, f"JPEG q{quality}"
    except Exception:
        jpg_path.unlink(missing_ok=True)
        raise

    jpg_path.unlink(missing_ok=True)
    png_path.unlink(missing_ok=True)
    raise RuntimeError(
        f"could not reach {MAX_BYTES:,} bytes even at JPEG q{JPEG_QUALITIES[-1]} "
        f"(smallest was {size:,} bytes)"
    )


def prepare(src: Path, out_path: Path) -> tuple[Path, int, str, bool]:
    with Image.open(src) as opened:
        opened.load()
        original = opened.size
        squared, padded = make_square(opened)
        resized = squared.resize((TARGET_SIZE, TARGET_SIZE), Image.LANCZOS)
    written, size, encoding = encode(resized, out_path)
    print(
        f"{src.name}: {original[0]}x{original[1]} -> {TARGET_SIZE}x{TARGET_SIZE}"
        f"{' (padded to square)' if padded else ''} | {encoding} | "
        f"{size:,} bytes -> {written}"
    )
    return written, size, encoding, padded


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("inputs", nargs="+", type=Path, help="source image file(s)")
    parser.add_argument("--out-dir", type=Path, help="directory for the prepared files")
    parser.add_argument("--out", type=Path, help="explicit output path (single input only)")
    args = parser.parse_args(argv)

    if args.out and len(args.inputs) > 1:
        parser.error("--out takes a single input; use --out-dir for several")
    if not args.out and not args.out_dir:
        parser.error("give --out or --out-dir")

    if args.out_dir:
        args.out_dir.mkdir(parents=True, exist_ok=True)

    failures = 0
    for src in args.inputs:
        if not src.is_file():
            print(f"{src}: not found", file=sys.stderr)
            failures += 1
            continue
        out_path = args.out or (args.out_dir / f"{src.stem}-1024{src.suffix}")
        try:
            prepare(src, out_path)
        except Exception as error:  # noqa: BLE001 - report and continue with the rest
            print(f"{src.name}: {error}", file=sys.stderr)
            failures += 1

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
