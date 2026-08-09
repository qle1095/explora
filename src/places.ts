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

/** Overpass is a free shared service; the main instance 504s under load. */
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

/**
 * Run an Overpass query, falling back across mirrors. Throws when every
 * endpoint fails — callers must not confuse "lookup broke" with "nothing
 * is around you", which is what silently returning [] used to do.
 */
async function overpass(query: string): Promise<OverpassElement[]> {
  let lastError: unknown = new Error("No Overpass endpoint reachable");
  for (const url of OVERPASS_ENDPOINTS) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 30_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: HEADERS,
        body: `data=${encodeURIComponent(query)}`,
        signal: abort.signal,
      });
      if (!res.ok) throw new Error(`Overpass ${res.status} from ${url}`);
      const data = (await res.json()) as {
        elements?: OverpassElement[];
        remark?: string;
      };
      // A server-side timeout still arrives as HTTP 200 carrying a `remark`
      // and an empty/truncated element list — a failure, not an empty area.
      if (data.remark) throw new Error(`Overpass remark: ${data.remark}`);
      return data.elements ?? [];
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

/**
 * Exclusion list for the nearby check-in list: everyday-errand and
 * service spots travelers don't check into. Everything else shows,
 * sorted purely by distance. Edit this set to tune the noise filter.
 */
const EXCLUDED_KINDS = new Set([
  // services & errands
  "laundry", "dry_cleaning", "atm", "bank", "bureau_de_change",
  "post_office", "courier", "copyshop", "estate_agent", "insurance",
  "lawyer", "notary", "employment_agency", "self_storage", "storage_rental",
  // health & personal care
  "pharmacy", "dentist", "doctors", "clinic", "hospital", "veterinary",
  "hairdresser", "beauty", "nails", "massage", "tanning", "optician",
  // vehicles & infrastructure
  "fuel", "car_repair", "car_wash", "car", "car_parts", "car_rental",
  "charging_station", "parking", "bicycle_parking", "driving_school",
  // misc noise
  "vending_machine", "toilets", "recycling", "waste_disposal",
  "tattoo", "cannabis", "e-cigarette", "funeral_directors",
  "kindergarten", "childcare", "school", "college", "tutoring",
  "mobile_phone", "hardware", "doityourself", "trade",
]);

function isExcluded(tags: Record<string, string>): boolean {
  return [tags.amenity, tags.shop, tags.leisure, tags.office].some(
    (v) => v != null && EXCLUDED_KINDS.has(v),
  );
}

/** Category emoji, purely decorative — makes rows scannable. */
function categoryEmoji(t: Record<string, string>): string {
  if ("tourism" in t || "historic" in t) return "🏛️";
  if (
    ["bar", "pub", "nightclub", "biergarten", "juice_bar"].includes(t.amenity ?? "") ||
    ["alcohol", "beverages", "wine", "coffee", "tea", "bubble_tea"].includes(t.shop ?? "")
  )
    return "🍹";
  if (
    ["restaurant", "cafe", "fast_food", "ice_cream", "food_court"].includes(t.amenity ?? "") ||
    t.shop === "bakery"
  )
    return "🍜";
  if (["convenience", "supermarket", "mall", "department_store", "kiosk"].includes(t.shop ?? ""))
    return "🏪";
  if ("leisure" in t) return "🌳";
  return "📍";
}

const NEARBY_RADIUS_M = 250;
const NEARBY_LIMIT = 20;

/**
 * Named POIs within ~250m of a point (Overpass API — keyless, fine for
 * prototype volumes). The checkpoint flow: "what's around me right now?"
 *
 * Throws if the lookup fails, so the UI can offer a retry instead of
 * pretending the neighbourhood is empty.
 */
export async function nearbyPlaces(
  lat: number,
  lng: number,
): Promise<PlaceResult[]> {
  const around = `(around:${NEARBY_RADIUS_M},${lat},${lng})`;
  // No `out` limit on purpose. Overpass emits in id order (and all nodes
  // before any way), never by distance, so any cap truncates arbitrarily —
  // dropping a shop 50m away while keeping one at 240m, and hiding
  // building-mapped POIs entirely once enough named nodes exist. Fetch the
  // whole radius and rank it here; 250m bounds the payload on its own.
  const query = `
    [out:json][timeout:25];
    ( nwr${around}[name][amenity];
      nwr${around}[name][shop];
      nwr${around}[name][tourism];
      nwr${around}[name][historic];
      nwr${around}[name][leisure]; );
    out center;`;
  const elements = await overpass(query);

  const scored: (PlaceResult & { distM: number })[] = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    const name = tags.name;
    const pLat = el.lat ?? el.center?.lat;
    const pLng = el.lon ?? el.center?.lon;
    if (!name || pLat == null || pLng == null || isExcluded(tags)) continue;
    const kind =
      tags.amenity ?? tags.shop ?? tags.tourism ?? tags.historic ?? tags.leisure ?? "";
    const distM = Math.hypot(
      (pLat - lat) * 111_320,
      (pLng - lng) * 111_320 * Math.cos((lat * Math.PI) / 180),
    );
    scored.push({
      name,
      detail: `${categoryEmoji(tags)} ${kind.replace(/_/g, " ")} · ${Math.round(distM)}m away`,
      lat: pLat,
      lng: pLng,
      distM,
    });
  }

  // Sort before deduping so the nearest branch of a chain wins, and key on
  // position as well as name so two real branches both survive. ~4dp is
  // ~11m, enough to collapse a POI mapped as both a node and a building.
  scored.sort((a, b) => a.distM - b.distM);
  const seen = new Set<string>();
  const results: PlaceResult[] = [];
  for (const place of scored) {
    const key = `${place.name}@${place.lat.toFixed(4)},${place.lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(place);
    if (results.length === NEARBY_LIMIT) break;
  }
  return results;
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
