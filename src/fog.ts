import { gridDisk, latLngToCell } from "h3-js";
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

/** Vision radius around the player, meters. The sweep of this circle IS
 * the revealed area — the map keeps a smooth capsule trail of it. */
export const VISION_RADIUS_M = 130;

/** A point as [lng, lat] (GeoJSON order). */
export type LngLat = [number, number];

function circle(lng: number, lat: number, steps = 24): ClipMultiPolygon {
  const ring: [number, number][] = [];
  const dLat = VISION_RADIUS_M / 111_320;
  const dLng = VISION_RADIUS_M / (111_320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push([lng + Math.cos(a) * dLng, lat + Math.sin(a) * dLat]);
  }
  return [[ring]];
}

/** Drop points closer than minDistM to the previously kept one. */
export function thinPoints(points: LngLat[], minDistM = 50): LngLat[] {
  const kept: LngLat[] = [];
  for (const p of points) {
    const last = kept[kept.length - 1];
    if (
      !last ||
      Math.hypot(
        (p[1] - last[1]) * 111_320,
        (p[0] - last[0]) * 111_320 * Math.cos((p[1] * Math.PI) / 180),
      ) >= minDistM
    ) {
      kept.push(p);
    }
  }
  return kept;
}

/** Union vision circles at every point (chunked to keep unions shallow). */
export function circlesUnion(points: LngLat[]): ClipMultiPolygon {
  if (points.length === 0) return [];
  const geoms = points.map(([lng, lat]) => circle(lng, lat));
  let acc = geoms[0];
  for (let i = 1; i < geoms.length; i += 25) {
    acc = polygonClipping.union(acc, ...geoms.slice(i, i + 25));
  }
  return acc;
}

/**
 * The persistent revealed mask: circle sweeps along every recorded trail
 * plus circles at passive visit points. Smooth capsules, no hexagons.
 */
export function buildRevealMask(
  trails: LngLat[][],
  visits: LngLat[],
): ClipMultiPolygon {
  const points = [...trails.flatMap((t) => thinPoints(t)), ...visits];
  return circlesUnion(points);
}

export function unionMasks(
  a: ClipMultiPolygon,
  b: ClipMultiPolygon,
): ClipMultiPolygon {
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  return polygonClipping.union(a, b);
}

/**
 * Build the fog polygon: world-covering ring with the visible area
 * punched out as holes.
 */
export function buildFogShape(visible: ClipMultiPolygon): Feature<Polygon> {
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
