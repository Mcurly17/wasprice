"""Generates docs/demo/img/radio-prix.png, the only image of the demo shop (case E).

Deterministic: Pillow's built-in default font, no timestamp or metadata in the PNG.
That font has no euro sign, so the sign is drawn with an arc and two bars.
Run from the repository root with Pillow pinned in requirements-dev.txt:

    python scripts/make_demo_images.py

The output hash is pinned in docs/demo/SHA256SUMS; never regenerate it after the push.
"""

import hashlib
import pathlib

from PIL import Image, ImageDraw, ImageFont

OUT = pathlib.Path(__file__).resolve().parents[1] / "docs" / "demo" / "img" / "radio-prix.png"


def euro(draw: ImageDraw.ImageDraw, x: int, y: int, h: int, color: tuple) -> None:
    """Draws a euro sign of height h whose top-left corner is (x, y)."""
    w = int(h * 0.8)
    stroke = max(4, h // 9)
    draw.arc((x + h // 6, y, x + h // 6 + w, y + h), start=45, end=315, fill=color, width=stroke)
    for frac in (0.40, 0.58):
        yy = y + int(h * frac)
        draw.rectangle((x, yy, x + int(w * 0.75), yy + stroke - 1), fill=color)


def main() -> None:
    red = (180, 20, 20)
    img = Image.new("RGB", (800, 400), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, 799, 399), outline=(40, 40, 40), width=4)
    draw.rectangle((0, 0, 800, 56), fill=(255, 243, 205))
    draw.text((24, 14), "DEMO - fictional shop, not a real offer", fill=(90, 70, 0), font=ImageFont.load_default(size=26))
    draw.text((60, 110), "Radio DAB+", fill=(30, 30, 30), font=ImageFont.load_default(size=64))
    price_font = ImageFont.load_default(size=110)
    draw.text((60, 205), "24,90", fill=red, font=price_font)
    right = int(draw.textlength("24,90", font=price_font))
    euro(draw, 60 + right + 28, 232, 84, red)
    draw.text((60, 352), "Demo Maison - prix TTC", fill=(90, 90, 90), font=ImageFont.load_default(size=22))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, format="PNG", optimize=False)
    data = OUT.read_bytes()
    print(f"{OUT.name}: {len(data)} bytes, sha256 {hashlib.sha256(data).hexdigest()}")


if __name__ == "__main__":
    main()
