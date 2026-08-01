#!/usr/bin/env python3
"""Generate the fog cloud tile and the placeholder profile avatar."""
import math
import random

from PIL import Image, ImageDraw

ASSETS = "assets"

# ---------- seamless cloud tile ----------
SIZE = 512
BASE = (34, 51, 58, 255)        # dark slate-teal
PUFF = (46, 68, 77, 255)        # lighter puff
GLOW = (58, 85, 95, 255)        # puff highlight

img = Image.new("RGBA", (SIZE, SIZE), BASE)
d = ImageDraw.Draw(img)
rng = random.Random(7)


def blob(cx, cy, rx, ry, color):
    """Ellipse drawn with wrap-around so the tile stays seamless."""
    for ox in (-SIZE, 0, SIZE):
        for oy in (-SIZE, 0, SIZE):
            d.ellipse(
                [cx + ox - rx, cy + oy - ry, cx + ox + rx, cy + oy + ry],
                fill=color,
            )


def cloud(cx, cy, scale):
    puffs = rng.randint(3, 5)
    for i in range(puffs):
        a = (i / puffs) * 2 * math.pi + rng.uniform(0, 1)
        px = cx + math.cos(a) * scale * rng.uniform(0.3, 0.75)
        py = cy + math.sin(a) * scale * rng.uniform(0.2, 0.45)
        r = scale * rng.uniform(0.45, 0.7)
        blob(px, py, r, r * 0.78, PUFF)
    # top highlight puff
    blob(cx - scale * 0.15, cy - scale * 0.3, scale * 0.42, scale * 0.3, GLOW)


# jittered grid placement for even, seamless coverage
for gx in range(4):
    for gy in range(4):
        cloud(
            gx * SIZE / 4 + rng.uniform(0, SIZE / 4),
            gy * SIZE / 4 + rng.uniform(0, SIZE / 4),
            rng.uniform(28, 56),
        )

img.save(f"{ASSETS}/clouds.png")

# ---------- placeholder avatar ----------
A = 128
av = Image.new("RGBA", (A, A), (0, 0, 0, 0))
d = ImageDraw.Draw(av)
c = A // 2

# white ring + teal face disc
d.ellipse([2, 2, A - 2, A - 2], fill=(255, 255, 255, 255))
d.ellipse([10, 10, A - 10, A - 10], fill=(67, 184, 176, 255))

# eyes
for ex in (-18, 18):
    d.ellipse([c + ex - 8, c - 14, c + ex + 8, c + 2], fill=(20, 34, 37, 255))
    d.ellipse([c + ex - 1, c - 11, c + ex + 5, c - 5], fill=(255, 255, 255, 255))

# rosy cheeks
for ex in (-30, 30):
    d.ellipse([c + ex - 7, c + 8, c + ex + 7, c + 20], fill=(240, 150, 130, 200))

# smile
d.arc([c - 16, c - 2, c + 16, c + 26], start=20, end=160, fill=(20, 34, 37, 255), width=5)

av.save(f"{ASSETS}/avatar.png")
print("wrote assets/clouds.png and assets/avatar.png")
