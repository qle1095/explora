import { cellsToMultiPolygon, gridDisk, latLngToCell } from "h3-js";
import polygonClipping, { type MultiPolygon as ClipMultiPolygon } from "polygon-clipping";
import type { Feature, Polygon } from "geojson";

/**
 * H3 resolution 10: cells ~120m across (~0.015 km^2).
 * This is the canonical "revealed" unit for the whole product.
 */
export const REVEAL_RES = 10;

/** Rough number of res-10 cells covering Earth's surface, for the stats HUD. */
const EARTH_CELLS = 33_897_029_882;

// Outer ring covering the world (web-mercator safe latitudes).
// Fog = this polygon, with revealed areas punched out as holes.
const WORLD_RING: [number, number][] = [
  [-180, -85.051129],
  [180, -85.051129],
  [180, 85.051129],
  [-180, 85.051129],
  [-180, -85.051129],
];

/** Reveal the cell at a coordinate (plus optional surrounding ring). */
export function revealAt(
  cells: Set<string>,
  lat: number,
  lng: number,
  ringSize = 1,
): Set<string> {
  const next = new Set(cells);
  for (const c of gridDisk(latLngToCell(lat, lng, REVEAL_RES), ringSize)) {
    next.add(c);
  }
  return next;
}

/** Live vision radius around the player, meters. Not persisted. */
export const VISION_RADIUS_M = 130;

/** Merge revealed cells into multipolygon coordinates (memoize per cells). */
export function mergeCells(cells: Set<string>): ClipMultiPolygon {
  return cellsToMultiPolygon([...cells], true) as ClipMultiPolygon;
}

function visionCircle(lat: number, lng: number): ClipMultiPolygon {
  const ring: [number, number][] = [];
  const dLat = VISION_RADIUS_M / 111_320;
  const dLng = VISION_RADIUS_M / (111_320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * 2 * Math.PI;
    ring.push([lng + Math.cos(a) * dLng, lat + Math.sin(a) * dLat]);
  }
  return [[ring]];
}

/**
 * Build the fog polygon: world-covering ring with holes for everything
 * currently visible — the permanent revealed area unioned with the live
 * vision circle around the player, so the circle melts into the map
 * edges and glides in real time as they move.
 */
export function buildFogShape(
  merged: ClipMultiPolygon,
  vision: [number, number] | null,
): Feature<Polygon> {
  const visible = vision
    ? polygonClipping.union(merged, visionCircle(vision[1], vision[0]))
    : merged;
  const holes = visible.map((polygon) => polygon[0]);
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [WORLD_RING, ...holes],
    },
  };
}

export function exploredStats(cells: Set<string>) {
  const pct = (cells.size / EARTH_CELLS) * 100;
  return {
    count: cells.size,
    areaKm2: cells.size * 0.015,
    earthPct: pct < 0.0001 ? "<0.0001" : pct.toFixed(4),
  };
}
