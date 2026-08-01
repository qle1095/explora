import { cellsToMultiPolygon, gridDisk, latLngToCell } from "h3-js";
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

/**
 * Build the fog polygon: world-covering ring with the union of revealed
 * cells punched out as holes. cellsToMultiPolygon merges adjacent cells,
 * so each connected explored area becomes a single smooth hole.
 */
export function buildFogShape(cells: Set<string>): Feature<Polygon> {
  const merged = cellsToMultiPolygon([...cells], true);
  const holes = merged.map((polygon) => polygon[0]);
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
