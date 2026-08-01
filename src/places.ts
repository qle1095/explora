/**
 * Place search via OSM Nominatim — keyless, fine for prototype volumes
 * (max 1 req/s, identified via User-Agent per their usage policy).
 * Swap for the Foursquare-backed `places` table in M2+.
 */

export interface PlaceResult {
  name: string;
  detail: string;
  lat: number;
  lng: number;
}

const HEADERS = {
  "User-Agent": "Explora-prototype/0.1 (solo dev prototype)",
  Accept: "application/json",
};

interface NominatimRow {
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
}

function toResult(row: NominatimRow): PlaceResult {
  const parts = row.display_name.split(", ");
  return {
    name: row.name || parts[0],
    detail: parts.slice(1, 4).join(", "),
    lat: Number(row.lat),
    lng: Number(row.lon),
  };
}

export async function searchPlaces(
  query: string,
  near?: [number, number],
): Promise<PlaceResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "8",
  });
  if (near) {
    const [lng, lat] = near;
    const d = 0.35;
    params.set(
      "viewbox",
      `${lng - d},${lat + d},${lng + d},${lat - d}`,
    );
  }
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: HEADERS },
  );
  if (!res.ok) return [];
  const rows = (await res.json()) as NominatimRow[];
  return rows.map(toResult);
}

interface OverpassElement {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/**
 * Named POIs within ~250m of a point (Overpass API — keyless, fine for
 * prototype volumes). The checkpoint flow: "what's around me right now?"
 */
export async function nearbyPlaces(
  lat: number,
  lng: number,
): Promise<PlaceResult[]> {
  const around = `(around:250,${lat},${lng})`;
  const query = `
    [out:json][timeout:10];
    ( nwr${around}[name][amenity];
      nwr${around}[name][shop];
      nwr${around}[name][tourism];
      nwr${around}[name][leisure]; );
    out center 30;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: HEADERS,
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { elements: OverpassElement[] };

  const seen = new Set<string>();
  const results: (PlaceResult & { distM: number })[] = [];
  for (const el of data.elements) {
    const name = el.tags?.name;
    const pLat = el.lat ?? el.center?.lat;
    const pLng = el.lon ?? el.center?.lon;
    if (!name || pLat == null || pLng == null || seen.has(name)) continue;
    seen.add(name);
    const kind =
      el.tags?.amenity ?? el.tags?.shop ?? el.tags?.tourism ?? el.tags?.leisure ?? "";
    const distM = Math.hypot(
      (pLat - lat) * 111_320,
      (pLng - lng) * 111_320 * Math.cos((lat * Math.PI) / 180),
    );
    results.push({
      name,
      detail: `${kind.replace(/_/g, " ")} · ${Math.round(distM)}m away`,
      lat: pLat,
      lng: pLng,
      distM,
    });
  }
  return results
    .sort((a, b) => a.distM - b.distM)
    .slice(0, 15)
    .map(({ distM: _d, ...r }) => r);
}

export async function reversePlace(
  lat: number,
  lng: number,
): Promise<PlaceResult | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&zoom=17`,
    { headers: HEADERS },
  );
  if (!res.ok) return null;
  const row = (await res.json()) as NominatimRow & { error?: string };
  if (row.error) return null;
  return { ...toResult(row), lat, lng };
}
