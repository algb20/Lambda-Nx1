# Branding assets

Logo files conformed to the Pi app uploader's requirement: **PNG or JPG, exactly
1024x1024 px, at most 1.1 MB**.

| File | Dimensions | Format | Size |
| --- | --- | --- | --- |
| `world-pi-logo-radar-1024.png` | 1024x1024 | PNG | 797 KB |
| `world-pi-logo-wp-1024.png` | 1024x1024 | PNG | 436 KB |

Both were produced from the original 1254x1254 artwork by
`scripts/prepare-logo.py`, which only resamples (Lanczos) to the required size.
Nothing was cropped, recoloured, added or removed — the artwork is the original,
at the size the uploader demands.

To regenerate, or to conform a new logo:

```bash
pip install pillow
python3 scripts/prepare-logo.py path/to/logo.png --out-dir public/branding
```

The script pads a non-square source with its own border colour rather than
cropping it, and only falls back to JPEG when a PNG would exceed the byte limit.
Tests: `python3 scripts/prepare-logo.test.py`.
