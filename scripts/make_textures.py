#!/usr/bin/env python3
"""Generate Explora texture assets.

Default run: only procedural-by-design assets (footprints, road tiles).
--placeholders: ALSO regenerate placeholder art (clouds, avatar, land
tiles) — OVERWRITES installed generated art; only for fresh setups.
"""
import sys

REGEN_PLACEHOLDERS = "--placeholders" in sys.argv
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

img.save(f"{ASSETS}/clouds.png") if REGEN_PLACEHOLDERS else None

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

av.save(f"{ASSETS}/avatar.png") if REGEN_PLACEHOLDERS else None
print("wrote placeholder clouds/avatar" if REGEN_PLACEHOLDERS else "skipped placeholders (use --placeholders)")

# ---------- kawaii land pattern tiles ----------
def wrap_ellipse(d, cx, cy, rx, ry, color):
    for ox in (-SIZE, 0, SIZE):
        for oy in (-SIZE, 0, SIZE):
            d.ellipse([cx + ox - rx, cy + oy - ry, cx + ox + rx, cy + oy + ry], fill=color)


def flower(d, cx, cy, petal, center, r=5):
    for i in range(5):
        a = i / 5 * 2 * math.pi
        wrap_ellipse(d, cx + math.cos(a) * r, cy + math.sin(a) * r, r * 0.72, r * 0.72, petal)
    wrap_ellipse(d, cx, cy, r * 0.62, r * 0.62, center)


rng2 = random.Random(11)

# grass: pastel meadow, darker tufts, tiny flowers
grass = Image.new("RGBA", (SIZE, SIZE), (168, 224, 135, 255))
gd = ImageDraw.Draw(grass)
for _ in range(70):
    wrap_ellipse(gd, rng2.uniform(0, SIZE), rng2.uniform(0, SIZE),
                 rng2.uniform(7, 16), rng2.uniform(5, 10), (143, 208, 112, 255))
for _ in range(12):
    flower(gd, rng2.uniform(0, SIZE), rng2.uniform(0, SIZE),
           (255, 255, 255, 255), (255, 214, 92, 255))
for _ in range(5):
    flower(gd, rng2.uniform(0, SIZE), rng2.uniform(0, SIZE),
           (255, 189, 214, 255), (255, 255, 255, 255))
grass.save(f"{ASSETS}/grass.png") if REGEN_PLACEHOLDERS else None

# water: soft blue with wave curls
water = Image.new("RGBA", (SIZE, SIZE), (124, 207, 238, 255))
wd = ImageDraw.Draw(water)
for _ in range(26):
    wrap_ellipse(wd, rng2.uniform(0, SIZE), rng2.uniform(0, SIZE),
                 rng2.uniform(14, 30), rng2.uniform(9, 16), (140, 217, 244, 255))
for _ in range(16):
    x, y = rng2.uniform(0, SIZE), rng2.uniform(0, SIZE)
    w = rng2.uniform(14, 22)
    for ox in (-SIZE, 0, SIZE):
        for oy in (-SIZE, 0, SIZE):
            wd.arc([x + ox - w, y + oy - w * 0.6, x + ox + w, y + oy + w * 0.9],
                   start=195, end=345, fill=(226, 246, 253, 255), width=5)
water.save(f"{ASSETS}/water.png") if REGEN_PLACEHOLDERS else None

# forest: clustered round trees with highlights
forest = Image.new("RGBA", (SIZE, SIZE), (124, 203, 102, 255))
fd = ImageDraw.Draw(forest)
for _ in range(20):
    x, y = rng2.uniform(0, SIZE), rng2.uniform(0, SIZE)
    for i in range(rng2.randint(2, 3)):
        tx = x + rng2.uniform(-16, 16)
        ty = y + rng2.uniform(-12, 12)
        r = rng2.uniform(12, 19)
        wrap_ellipse(fd, tx, ty, r, r * 0.92, (92, 177, 78, 255))
        wrap_ellipse(fd, tx - r * 0.3, ty - r * 0.35, r * 0.42, r * 0.36, (143, 220, 120, 255))
forest.save(f"{ASSETS}/forest.png") if REGEN_PLACEHOLDERS else None
print("wrote placeholder land tiles" if REGEN_PLACEHOLDERS else "skipped placeholder land tiles")

# ---------- footprint trail strip ----------
# IMPORTANT: MapLibre line-pattern crops the image at NATIVE pixel scale to
# the line width — it does not scale. Strip height must fit inside
# line-width(pt) * devicePixelRatio (11pt * 3 = 33px), or prints get sliced.
FP_FILL = (240, 198, 138, 255)
FP_LINE = (166, 120, 70, 255)

def fp_stamp(angle):
    st = Image.new("RGBA", (48, 28), (0, 0, 0, 0))
    d = ImageDraw.Draw(st)
    d.ellipse([16, 9, 38, 21], fill=FP_FILL, outline=FP_LINE, width=2)  # sole
    d.ellipse([7, 11, 15, 20], fill=FP_FILL, outline=FP_LINE, width=2)  # heel
    return st.rotate(angle, expand=False, resample=Image.BICUBIC)

fp = Image.new("RGBA", (128, 32), (0, 0, 0, 0))
up, down = fp_stamp(8), fp_stamp(-8)
fp.paste(up, (8, -3), up)
fp.paste(down, (70, 7), down)
fp_bbox = fp.getchannel("A").getbbox()
assert fp_bbox[1] >= 1 and fp_bbox[3] <= 31, f"footprints clipped: {fp_bbox}"
fp.save(f"{ASSETS}/footprints.png")
print("wrote footprints strip", fp_bbox)

# ---------- road & path textures (both-axis seamless small stones) ----------
# Line patterns are cropped at native scale to the line width, so road
# texture must look right in ANY horizontal slice: small stones, seamless
# in both axes. Palette sampled from the generated cobble art.
def cobble_tile(size, base, stones, outline, stone_r, jitter, name):
    tile = Image.new("RGBA", (size, size), base)
    d = ImageDraw.Draw(tile)
    rngc = random.Random(23)
    step = stone_r * 2 + 3
    row = 0
    y = 0
    while y < size + step:
        offset = (step // 2) if row % 2 else 0
        x = offset
        while x < size + step:
            r = stone_r + rngc.uniform(-jitter, jitter)
            cx = x + rngc.uniform(-1.5, 1.5)
            cy = y + rngc.uniform(-1.5, 1.5)
            color = stones[rngc.randrange(len(stones))]
            for ox in (-size, 0, size):
                for oy in (-size, 0, size):
                    d.ellipse(
                        [cx + ox - r, cy + oy - r * 0.85, cx + ox + r, cy + oy + r * 0.85],
                        fill=color, outline=outline, width=2,
                    )
            x += step
        y += step
        row += 1
    tile.save(f"{ASSETS}/{name}")
    print("wrote", name)

cobble_tile(
    64,
    base=(227, 177, 99, 255),
    stones=[(248, 221, 165, 255), (245, 216, 158, 255), (250, 226, 172, 255), (243, 208, 145, 255)],
    outline=(210, 160, 88, 255),
    stone_r=7, jitter=1.5,
    name="road-main.png",
)

# path: sparse pale pebbles on transparent, small strip
path = Image.new("RGBA", (64, 16), (0, 0, 0, 0))
pd = ImageDraw.Draw(path)
rngp = random.Random(5)
for x in range(4, 64, 13):
    r = rngp.uniform(3.5, 5)
    cy = 8 + rngp.uniform(-2, 2)
    for ox in (-64, 0, 64):
        pd.ellipse([x + ox - r, cy - r * 0.8, x + ox + r, cy + r * 0.8],
                   fill=(238, 228, 200, 255), outline=(203, 176, 131, 255), width=2)
pbbox = path.getchannel("A").getbbox()
assert pbbox[1] >= 0 and pbbox[3] <= 16, f"path clipped: {pbbox}"
path.save(f"{ASSETS}/road-path.png")
print("wrote road-path strip", pbbox)

# ---------- POI pin badges (food + attractions) ----------
def pin_badge(base, name, glyph):
    """Teardrop map pin with white inner disc and a simple glyph."""
    img = Image.new("RGBA", (64, 76), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    OUT = (146, 100, 58, 255)
    d.polygon([(15, 43), (49, 43), (32, 70)], fill=base, outline=OUT)
    d.ellipse([7, 4, 57, 54], fill=base, outline=OUT, width=3)
    d.polygon([(17, 44), (47, 44), (32, 67)], fill=base)  # cover seam
    d.ellipse([15, 12, 49, 46], fill=(255, 252, 244, 255))
    glyph(d)
    return img

def food_glyph(d):
    base = (247, 127, 95, 255)
    d.pieslice([21, 26, 43, 44], 0, 180, fill=base)                    # bowl
    d.rectangle([20, 33, 44, 35], fill=base)                           # rim
    for x in (27, 33, 39):                                             # steam
        d.arc([x - 3, 16, x + 3, 28], 90, 270, fill=base, width=2)

def star_glyph(d):
    import math
    cx, cy, R, r = 32, 29, 12, 5
    pts = []
    for i in range(10):
        rad = R if i % 2 == 0 else r
        a = -math.pi / 2 + i * math.pi / 5
        pts.append((cx + rad * math.cos(a), cy + rad * math.sin(a)))
    d.polygon(pts, fill=(242, 183, 75, 255))

pin_badge((247, 127, 95, 255), "food", food_glyph).save(f"{ASSETS}/pin-food.png")
pin_badge((242, 183, 75, 255), "sight", star_glyph).save(f"{ASSETS}/pin-sight.png")
print("wrote pin-food.png and pin-sight.png")
