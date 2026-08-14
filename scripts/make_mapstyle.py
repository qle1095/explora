#!/usr/bin/env python3
"""Generate assets/mapstyle.json: a storybook recolor of OpenFreeMap liberty."""
import json
import subprocess

SRC = "https://tiles.openfreemap.org/styles/liberty"

# Every label on the map, in English where OSM has one. The planet tiles carry
# name:en, name:latin and name:nonlatin on each of place/poi/transportation_name
# (verified against the TileJSON), so this coalesce always lands somewhere.
LABEL_EN = ["coalesce", ["get", "name:en"], ["get", "name:latin"], ["get", "name"]]

# kawaii palette
PAPER = "#f9f0d8"
WATER = "#7ccfee"
GRASS = "#a8e087"
WOOD = "#7ccb66"
SAND = "#f7e3a6"
BUILDING = "#eddfb8"
ROAD_MINOR = "#ffffff"
ROAD_MAJOR = "#ffd166"
MOTORWAY = "#ffab4a"
CASING = "#e3d3a8"
PATH = "#eee4c8"
RAIL = "#cdb493"
TEXT = "#47563d"
HALO = "#faf3dd"

# Pattern names registered by the app's <Images> — the kawaii textures.
PATTERN_WATER = "waterTile"
PATTERN_GRASS = "grassTile"
PATTERN_FOREST = "forestTile"
PATTERN_ROAD = "roadMain"
PATTERN_PATH = "roadPath"

# Navigation-app clutter, dropped for the game look.
DROP = (
    "poi", "oneway", "one_way", "housenumber", "house_num", "rail",
    "transit", "ferry", "aerialway", "airport", "aeroway", "helipad",
    "building-3d", "building_3d", "road_shield", "shield",
)

style = json.loads(
    subprocess.run(
        ["curl", "-sf", "-A", "Mozilla/5.0 (Macintosh)", SRC],
        capture_output=True,
        check=True,
    ).stdout
)

style["name"] = "explora-storybook"


def has(layer_id, *words):
    return any(w in layer_id for w in words)


style["layers"] = [
    l for l in style["layers"] if not any(w in l["id"].lower() for w in DROP)
]

for layer in style["layers"]:
    lid = layer["id"].lower()
    ltype = layer["type"]
    paint = layer.setdefault("paint", {})

    if ltype == "line":
        layout = layer.setdefault("layout", {})
        layout["line-cap"] = "round"
        layout["line-join"] = "round"

    if ltype == "background":
        paint["background-color"] = PAPER

    elif ltype == "fill":
        had_pattern = paint.pop("fill-pattern", None) is not None
        if has(lid, "water"):
            paint["fill-color"] = WATER
            paint["fill-pattern"] = PATTERN_WATER
        elif has(lid, "wood", "forest"):
            paint["fill-color"] = WOOD
            paint["fill-pattern"] = PATTERN_FOREST
        elif has(lid, "grass", "park", "green", "cemetery", "golf", "garden", "landcover", "landuse"):
            paint["fill-color"] = GRASS
            paint["fill-pattern"] = PATTERN_GRASS
        elif has(lid, "sand", "beach"):
            paint["fill-color"] = SAND
        elif has(lid, "building"):
            paint["fill-color"] = BUILDING
            paint["fill-opacity"] = 0.45
            paint.pop("fill-outline-color", None)
        elif has(lid, "residential", "industrial", "commercial", "hospital", "school", "university", "pier"):
            paint["fill-color"] = PAPER
        elif had_pattern:
            # pattern removed and no rule matched — avoid default-black fills
            paint["fill-color"] = PAPER

    elif ltype == "fill-extrusion":
        paint["fill-extrusion-color"] = BUILDING

    elif ltype == "line":
        if has(lid, "water", "river", "stream", "canal"):
            paint["line-color"] = WATER
        elif has(lid, "casing"):
            paint["line-color"] = CASING
        elif has(lid, "motorway", "trunk"):
            paint["line-pattern"] = PATTERN_ROAD
        elif has(lid, "primary", "secondary", "tertiary", "major"):
            paint["line-pattern"] = PATTERN_ROAD
        elif has(lid, "path", "footway", "steps", "cycleway", "pedestrian"):
            paint["line-pattern"] = PATTERN_PATH
            paint.pop("line-dasharray", None)
        elif has(lid, "rail", "transit"):
            paint["line-color"] = RAIL
        elif has(lid, "road", "street", "minor", "service", "link", "highway"):
            paint["line-color"] = ROAD_MINOR
        elif has(lid, "boundary", "admin"):
            paint["line-color"] = "#c9a9c4"
        elif has(lid, "bridge", "tunnel"):
            paint["line-color"] = CASING

    elif ltype == "symbol":
        paint["text-color"] = TEXT
        paint["text-halo-color"] = HALO
        paint["text-halo-width"] = 1.4
        # Liberty ships `case has(name:nonlatin) -> concat(name:latin, name:nonlatin)`,
        # which renders Tokyo twice over — and consults `name_en` only in the
        # branch that never fires there. Explora answers "where have you been",
        # so a traveler has to be able to read the map of a place they don't
        # live in. English name, else a transliteration, else the local name.
        if (layer.get("layout") or {}).get("text-field") is not None:
            layer["layout"]["text-field"] = LABEL_EN

# Curated POIs: only food & attractions, with our cute pin badges.
# Everything else (random shops, services) stays hidden.
FOOD_CLASSES = [
    "restaurant", "fast_food", "cafe", "bar", "ice_cream", "beer",
    "bakery", "food_court",
]
SIGHT_CLASSES = [
    "attraction", "museum", "monument", "gallery", "art_gallery", "zoo",
    "aquarium", "castle", "theatre", "viewpoint", "theme_park",
]
style["layers"].append({
    "id": "explora-poi",
    "type": "symbol",
    "source": "openmaptiles",
    "source-layer": "poi",
    "minzoom": 14,
    "filter": [
        "all",
        ["match", ["geometry-type"], ["Point", "MultiPoint"], True, False],
        ["match", ["get", "class"], FOOD_CLASSES + SIGHT_CLASSES, True, False],
    ],
    "layout": {
        "icon-image": [
            "match", ["get", "class"], FOOD_CLASSES, "pinFood", "pinSight",
        ],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 14, 0.3, 17, 0.48],
        "icon-anchor": "bottom",
        "text-field": LABEL_EN,
        "text-font": ["Noto Sans Italic"],
        "text-size": 10.5,
        "text-anchor": "top",
        "text-offset": [0, 0.3],
        "text-optional": True,
        "text-max-width": 7,
    },
    "paint": {
        "text-color": TEXT,
        "text-halo-color": HALO,
        "text-halo-width": 1.3,
    },
})

with open("assets/mapstyle.json", "w") as f:
    json.dump(style, f)
print(f"wrote assets/mapstyle.json ({len(style['layers'])} layers)")
