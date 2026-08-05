#!/usr/bin/env python3
"""Generate assets/mapstyle.json: a storybook recolor of OpenFreeMap liberty."""
import json
import subprocess

SRC = "https://tiles.openfreemap.org/styles/liberty"

# storybook palette
PAPER = "#f6efdd"
WATER = "#7cc9e8"
GRASS = "#b5e3a5"
WOOD = "#96d489"
SAND = "#f4e3b2"
BUILDING = "#f0dcb4"
BUILDING_LINE = "#ddc292"
ROAD_MINOR = "#ffffff"
ROAD_MAJOR = "#ffd88f"
MOTORWAY = "#ffc768"
CASING = "#e6d7b6"
PATH = "#e9e0cd"
RAIL = "#cdb493"
TEXT = "#49584f"
HALO = "#f9f3e3"

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


for layer in style["layers"]:
    lid = layer["id"].lower()
    ltype = layer["type"]
    paint = layer.setdefault("paint", {})

    if ltype == "background":
        paint["background-color"] = PAPER

    elif ltype == "fill":
        if has(lid, "water"):
            paint["fill-color"] = WATER
        elif has(lid, "wood", "forest"):
            paint["fill-color"] = WOOD
        elif has(lid, "grass", "park", "green", "cemetery", "golf", "garden", "landcover", "landuse"):
            paint["fill-color"] = GRASS
        elif has(lid, "sand", "beach"):
            paint["fill-color"] = SAND
        elif has(lid, "building"):
            paint["fill-color"] = BUILDING
            paint["fill-outline-color"] = BUILDING_LINE
        elif has(lid, "residential", "industrial", "commercial", "hospital", "school", "university", "aeroway", "pier"):
            paint["fill-color"] = PAPER
        paint.pop("fill-pattern", None)

    elif ltype == "fill-extrusion":
        paint["fill-extrusion-color"] = BUILDING

    elif ltype == "line":
        if has(lid, "water", "river", "stream", "canal"):
            paint["line-color"] = WATER
        elif has(lid, "casing"):
            paint["line-color"] = CASING
        elif has(lid, "motorway", "trunk"):
            paint["line-color"] = MOTORWAY
        elif has(lid, "primary", "secondary", "tertiary", "major"):
            paint["line-color"] = ROAD_MAJOR
        elif has(lid, "path", "footway", "steps", "cycleway", "pedestrian"):
            paint["line-color"] = PATH
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

with open("assets/mapstyle.json", "w") as f:
    json.dump(style, f)
print(f"wrote assets/mapstyle.json ({len(style['layers'])} layers)")
