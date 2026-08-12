import { gridDisk, latLngToCell } from "h3-js";
import polygonClipping, { type MultiPolygon as ClipMultiPolygon } from "polygon-clipping";
import type { Feature, MultiPolygon, Polygon } from "geojson";

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
export const VISION_RADIUS_M = 75;

/** A point as [lng, lat] (GeoJSON order). */
export type LngLat = [number, number];

/**
 * A puffy "cloud hole": a circle with gentle lobes, phase-seeded from the
 * position so neighbouring puffs interlock organically instead of
 * repeating. Their union gives the fog its fluffy Don't-Starve edge.
 */
function circle(lng: number, lat: number, scale = 1, steps = 36): ClipMultiPolygon {
  const ring: [number, number][] = [];
  const r = VISION_RADIUS_M * scale;
  const dLat = r / 111_320;
  const dLng = r / (111_320 * Math.cos((lat * Math.PI) / 180));
  const phase = (Math.abs(Math.sin(lng * 12.9898 + lat * 78.233)) * 43758.5453) % (2 * Math.PI);
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    const lobe = 1 + 0.09 * Math.sin(5 * a + phase) + 0.05 * Math.sin(9 * a + phase * 2);
    ring.push([
      lng + Math.cos(a) * dLng * lobe,
      lat + Math.sin(a) * dLat * lobe,
    ]);
  }
  return [[ring]];
}

/** Drop points closer than minDistM to the previously kept one. */
export function thinPoints(points: LngLat[], minDistM = 30): LngLat[] {
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
export function circlesUnion(points: LngLat[], scale = 1): ClipMultiPolygon {
  if (points.length === 0) return [];
  const geoms = points.map(([lng, lat]) => circle(lng, lat, scale));
  let acc = geoms[0];
  for (let i = 1; i < geoms.length; i += 25) {
    acc = polygonClipping.union(acc, ...geoms.slice(i, i + 25));
  }
  return acc;
}

/**
 * The persistent revealed mask: circle sweeps along every recorded trail
 * plus circles at passive visit points. Smooth capsules, no hexagons.
 * scale < 1 shrinks every puff — used to draw the pale rim band.
 */
export function buildRevealMask(
  trails: LngLat[][],
  visits: LngLat[],
  scale = 1,
): ClipMultiPolygon {
  const points = [...trails.flatMap((t) => thinPoints(t)), ...visits];
  return circlesUnion(points, scale);
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

/**
 * The rim band: the annulus between the full-size reveal mask and the
 * shrunken one, i.e. a thin halo hugging the inside of every cleared edge.
 *
 * This must stay a band. Painting the rim as another world-covering fog
 * polygon puts an opaque sheet under the clouds and blacks out the map —
 * the mist is only misty because nothing solid sits beneath it.
 */
export function buildRimShape(
  mask: ClipMultiPolygon,
  rimMask: ClipMultiPolygon,
): Feature<MultiPolygon> {
  const band =
    mask.length === 0 || rimMask.length === 0
      ? mask
      : polygonClipping.difference(mask, rimMask);
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "MultiPolygon", coordinates: band },
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
