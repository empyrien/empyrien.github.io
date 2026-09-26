#!/usr/bin/env python3
"""Raster icons from the nine-pointed star (the same geometry as tools/star.py).

  pip install pillow
  python3 tools/make-icons.py

Writes favicon.ico (16/32/48), favicon-32.png and apple-touch-icon.png to the
site root. favicon.svg is the vector original and is edited by hand.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

from star import pt

ROOT = Path(__file__).resolve().parent.parent
NIGHT = (11, 12, 18)
GOLD = (220, 192, 138)
SS = 8  # supersampling factor, for clean anti-aliased edges


def star_points(cx, cy, R, ratio):
    pts = []
    for k in range(9):
        x, y = pt(R, k)
        pts.append((cx + x, cy + y))
        x, y = pt(R * ratio, k + 0.5)
        pts.append((cx + x, cy + y))
    return pts


def favicon(size):
    """Rounded night tile with a gold star — matches favicon.svg."""
    s = size * SS
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, s - 1, s - 1), radius=round(s * 7 / 32), fill=NIGHT)
    d.polygon(star_points(s / 2, s * 16.3 / 32, s * 11.6 / 32, 0.58), fill=GOLD)
    return im.resize((size, size), Image.LANCZOS)


def touch_icon(size=180):
    """Full-bleed square (iOS rounds the corners itself), with a soft dawn glow."""
    s = size * SS
    im = Image.new("RGB", (s, s), NIGHT)
    glow = Image.new("L", (s, s), 0)
    ImageDraw.Draw(glow).ellipse((s * 0.14, s * 0.14, s * 0.86, s * 0.86), fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(s * 0.12))
    im.paste(Image.new("RGB", (s, s), (240, 194, 123)), (0, 0), glow)
    d = ImageDraw.Draw(im)
    d.polygon(star_points(s / 2, s * 0.51, s * 0.3, 0.58), fill=GOLD)
    return im.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    icons = {n: favicon(n) for n in (16, 32, 48)}
    icons[48].save(ROOT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)],
                   append_images=[icons[16], icons[32]])
    icons[32].save(ROOT / "favicon-32.png")
    touch_icon().save(ROOT / "apple-touch-icon.png")
    print("wrote favicon.ico, favicon-32.png, apple-touch-icon.png")
