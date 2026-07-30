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
