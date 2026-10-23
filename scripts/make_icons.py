#!/usr/bin/env python3
"""Generate Fate v6 PWA icons: gold fate-wheel on near-black."""
from PIL import Image, ImageDraw
import math
import os

OUT = "/home/z/my-project/public/icons"
os.makedirs(OUT, exist_ok=True)

BG = (12, 10, 9)          # stone-950
GOLD = (245, 184, 74)     # amber gold
GOLD_DIM = (146, 104, 38)
CREAM = (255, 244, 224)
SS = 4  # supersample factor


def draw_wheel(size: int, safe_zone: float = 1.0) -> Image.Image:
    """Draw the fate wheel at `size` px. safe_zone scales content (maskable padding)."""
    big = size * SS
    img = Image.new("RGB", (big, big), BG)
    d = ImageDraw.Draw(img)

    cx = cy = big / 2
    R = (big / 2) * 0.86 * safe_zone

    # subtle concentric backdrop rings
    for i in range(3):
        rr = R * (1.35 + i * 0.22)
        w = max(1, int(2 * SS * (3 - i) / 3))
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=GOLD, width=w)

    # outer ring (thick) + inner ring (thin)
    d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=GOLD, width=int(9 * SS))
    r2 = R * 0.78
    d.ellipse([cx - r2, cy - r2, cx + r2, cy + r2], outline=GOLD_DIM, width=int(3 * SS))

    # 8 spokes
    for k in range(8):
        ang = k * (math.pi / 4)
        x1 = cx + r2 * 0.12 * -math.cos(ang)
        y1 = cy + r2 * 0.12 * -math.sin(ang)
        x2 = cx + r2 * math.cos(ang)
        y2 = cy + r2 * math.sin(ang)
        d.line([x1, y1, x2, y2], fill=GOLD_DIM, width=int(3 * SS))

    # center gem (diamond)
    gr = R * 0.22
    d.polygon([(cx, cy - gr), (cx + gr, cy), (cx, cy + gr), (cx - gr, cy)], fill=GOLD)
    d.polygon(
        [
            (cx, cy - gr * 0.5),
            (cx + gr * 0.5, cy),
            (cx, cy + gr * 0.5),
            (cx - gr * 0.5, cy),
        ],
        fill=CREAM,
    )

    # orbit dots on outer ring
    for k in range(8):
        ang = k * (math.pi / 4) + math.pi / 8
        px = cx + R * math.cos(ang)
        py = cy + R * math.sin(ang)
        pr = 5.5 * SS
        d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=CREAM)

    # tiny stars
    for (sx, sy, sr) in [
        (0.16, 0.14, 3.2), (0.86, 0.2, 2.4), (0.2, 0.84, 2.4), (0.84, 0.85, 3.2),
        (0.5, 0.075, 2.0), (0.075, 0.5, 2.0), (0.925, 0.5, 2.0), (0.5, 0.925, 2.0),
    ]:
        px, py, pr = sx * big, sy * big, sr * SS * safe_zone
        d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=GOLD)

    return img.resize((size, size), Image.LANCZOS)


def save(img: Image.Image, path: str):
    img.save(path, "PNG", optimize=True)
    print("wrote", path)


for s in (192, 512):
    save(draw_wheel(s), os.path.join(OUT, f"icon-{s}.png"))

for s in (192, 512):
    save(draw_wheel(s, safe_zone=0.8), os.path.join(OUT, f"maskable-{s}.png"))

save(draw_wheel(180), "/home/z/my-project/public/apple-touch-icon.png")
print("done")
