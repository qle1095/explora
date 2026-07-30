import {
  cellsToMultiPolygon,
  gridDisk,
  gridPathCells,
  latLngToCell,
} from "h3-js";
import type { Feature, Polygon } from "geojson";

/**
 * H3 resolution 9: cells ~170m across (~0.1 km^2).
 * This is the canonical "revealed" unit for the whole product.
 */
export const REVEAL_RES = 9;

/** Rough number of res-9 cells covering Earth's surface, for the stats HUD. */
const EARTH_CELLS_R9 = 4_842_432_842;

// Outer ring covering the world (web-mercator safe latitudes).
// Fog = this polygon, with revealed areas punched out as holes.
const WORLD_RING: [number, number][] = [
  [-180, -85.051129],
  [180, -85.051129],
  [180, 85.051129],
  [-180, 85.051129],
  [-180, -85.051129],
];

/** Demo seed: a few explored blobs + a walking route, around downtown SF. */
export function seedCells(): Set<string> {
  const cells = new Set<string>();

  const blobs: Array<{ lat: number; lng: number; radius: number }> = [
    { lat: 37.7793, lng: -122.4193, radius: 3 }, // Civic Center
    { lat: 37.8087, lng: -122.4098, radius: 2 }, // Fisherman's Wharf
    { lat: 37.7694, lng: -122.4862, radius: 2 }, // Golden Gate Park
    { lat: 37.8021, lng: -122.4488, radius: 1 }, // Marina
  ];
  for (const b of blobs) {
    for (const c of gridDisk(latLngToCell(b.lat, b.lng, REVEAL_RES), b.radius)) {
      cells.add(c);
    }
  }

  // A "trail" from Civic Center to the Wharf: the corridor of cells along the path.
  const path = gridPathCells(
    latLngToCell(37.7793, -122.4193, REVEAL_RES),
    latLngToCell(37.8087, -122.4098, REVEAL_RES),
  );
  for (const c of path) {
    cells.add(c);
    for (const n of gridDisk(c, 1)) cells.add(n);
  }

  return cells;
}

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
  const pct = (cells.size / EARTH_CELLS_R9) * 100;
  return {
    count: cells.size,
    areaKm2: cells.size * 0.105,
    earthPct: pct < 0.0001 ? "<0.0001" : pct.toFixed(4),
  };
}
