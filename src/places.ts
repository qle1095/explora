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
  /** Distance from the user when listed via nearby lookup. */
  distM?: number;
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
 * Category preference for the nearby list — the order travelers care
 * about: attractions first, then food, then essentials, then the rest.
 * Reorder or extend this array to change the sort.
 */
const CATEGORY_PREFERENCE: Array<{
  emoji: string;
  match: (t: Record<string, string>) => boolean;
}> = [
  {
    emoji: "🏛️",
    match: (t) =>
      "tourism" in t ||
      "historic" in t ||
      t.leisure === "park" ||
      t.leisure === "garden" ||
      t.leisure === "nature_reserve" ||
      t.amenity === "place_of_worship" ||
      t.amenity === "theatre" ||
      t.amenity === "arts_centre",
  },
  {
    emoji: "🍜",
    match: (t) =>
      ["restaurant", "cafe", "bar", "pub", "fast_food", "ice_cream", "food_court", "biergarten"].includes(
        t.amenity ?? "",
      ) || t.shop === "bakery",
  },
  {
    emoji: "🏪",
    match: (t) =>
      ["convenience", "supermarket", "mall", "department_store", "kiosk"].includes(
        t.shop ?? "",
      ) ||
      t.amenity === "pharmacy" ||
      t.amenity === "marketplace",
  },
];

function categoryRank(tags: Record<string, string>): {
  rank: number;
  emoji: string;
} {
  for (let i = 0; i < CATEGORY_PREFERENCE.length; i++) {
    if (CATEGORY_PREFERENCE[i].match(tags)) {
      return { rank: i, emoji: CATEGORY_PREFERENCE[i].emoji };
    }
  }
  return { rank: CATEGORY_PREFERENCE.length, emoji: "📍" };
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
      nwr${around}[name][historic];
      nwr${around}[name][leisure]; );
    out center 40;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: HEADERS,
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { elements: OverpassElement[] };

  const seen = new Set<string>();
  const results: (PlaceResult & { distM: number; rank: number })[] = [];
  for (const el of data.elements) {
    const name = el.tags?.name;
    const pLat = el.lat ?? el.center?.lat;
    const pLng = el.lon ?? el.center?.lon;
    if (!name || pLat == null || pLng == null || seen.has(name)) continue;
    seen.add(name);
    const tags = el.tags ?? {};
    const kind =
      tags.amenity ?? tags.shop ?? tags.tourism ?? tags.historic ?? tags.leisure ?? "";
    const { rank, emoji } = categoryRank(tags);
    const distM = Math.hypot(
      (pLat - lat) * 111_320,
      (pLng - lng) * 111_320 * Math.cos((lat * Math.PI) / 180),
    );
    results.push({
      name,
      detail: `${emoji} ${kind.replace(/_/g, " ")} · ${Math.round(distM)}m away`,
      lat: pLat,
      lng: pLng,
      distM,
      rank,
    });
  }
  // Right-here places first, then by category preference, then distance.
  return results
    .sort((a, b) => {
      const hereA = a.distM <= 60 ? -1 : a.rank;
      const hereB = b.distM <= 60 ? -1 : b.rank;
      if (hereA !== hereB) return hereA - hereB;
      return a.distM - b.distM;
    })
    .slice(0, 20)
    .map(({ rank: _r, ...r }) => r);
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
