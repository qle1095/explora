/**
 * Place search via OSM Nominatim — keyless, fine for prototype volumes
 * (max 1 req/s, identified via User-Agent per their usage policy).
 * Swap for the Foursquare-backed `places` table in M2+.
 */

import { cacheNearby, findCachedNearby } from "./db";
import { clockMatchesPlace, isOpenNow } from "./openingHours";

export interface PlaceResult {
  name: string;
  detail: string;
  lat: number;
  lng: number;
  /** Distance from the user when listed via nearby lookup. */
  distM?: number;

  // --- Nearby-lookup extras. All optional: search and reverse-geocode
  // results carry none of them, so every consumer must tolerate absence.
  /** The local-script name, when `name` came from `name:en` instead. */
  localName?: string;
  /** Readable category, cuisine-first — "Ramen" rather than "Restaurant". */
  kind?: string;
  emoji?: string;
  /** 8-point compass bearing from the user. */
  bearing?: string;
  /** Only set when `opening_hours` was readable; absent means unknown. */
  openNow?: boolean;
  /** Floor inside a multi-storey building — "3F", "B1". */
  level?: string;
  /** An errand rather than a destination — ranked below everything else. */
  everyday?: boolean;
  /** Raw `opening_hours`, shown verbatim when we can't reduce it to open/closed. */
  hours?: string;
  phone?: string;
  website?: string;
  /** Street address, where OSM has one — 88% in SF, 11% in Tokyo. */
  address?: string;
  /** OSM `wheelchair`: "yes" | "limited" | "no". */
  wheelchair?: string;
}

const HEADERS = {
  "User-Agent": "Explora-prototype/0.1 (solo dev prototype)",
  Accept: "application/json",
  // Nominatim localises administrative names off this header, so it covers
  // every call below at once. A place's own proper name is untouched — Tokyo
  // reads "Shinjuku, Tokyo, Japan" but the station stays JR新宿駅.
  "Accept-Language": "en",
};

interface NominatimRow {
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
  /** The OSM key/value that classifies the hit, e.g. amenity / restaurant. */
  category?: string;
  type?: string;
  extratags?: Record<string, string>;
  namedetails?: Record<string, string>;
}

/**
 * Flatten a Nominatim hit back into the OSM tag shape the enrichment helpers
 * already speak, so search results get the same treatment as nearby ones
 * instead of being a second, poorer kind of row in the same list.
 */
function rowToTags(row: NominatimRow): Record<string, string> {
  const tags: Record<string, string> = {
    ...(row.namedetails ?? {}),
    ...(row.extratags ?? {}),
  };
  if (row.category && row.type) tags[row.category] = row.type;
  if (!tags.name && row.name) tags.name = row.name;
  return tags;
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
    // Same fields Overpass gives us: hours, phone, website, cuisine, name:en.
    extratags: "1",
    namedetails: "1",
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
  // Throw rather than return []. The same distinction `overpass()` makes:
  // "the search broke" and "nothing matched" look identical to a user
  // otherwise, and offline is exactly when a traveler needs to be told which.
  if (!res.ok) throw new Error(`Nominatim search ${res.status}`);
  const rows = (await res.json()) as NominatimRow[];
  return rows.map((row) => enrichSearchHit(row, near));
}

/** A search hit, dressed to match the nearby rows it sits beside. */
function enrichSearchHit(
  row: NominatimRow,
  near?: [number, number],
): PlaceResult {
  const base = toResult(row);
  const tags = rowToTags(row);
  // Administrative hits (a city, a street) have no useful category — leave
  // those as the plain address-style result they already were.
  if (!row.category || !row.type) return base;

  const { name, localName } = displayNames(tags);
  const kind = readableKind(tags);
  const open =
    tags.opening_hours && clockMatchesPlace(base.lng)
      ? isOpenNow(tags.opening_hours)
      : null;

  const meta: string[] = [kind];
  let distM: number | undefined;
  let bearing: string | undefined;
  if (near) {
    const [lng, lat] = near;
    distM = Math.hypot(
      (base.lat - lat) * 111_320,
      (base.lng - lng) * 111_320 * Math.cos((lat * Math.PI) / 180),
    );
    bearing = bearingLabel(lat, lng, base.lat, base.lng);
    meta.push(`${distanceLabel(distM)} ${bearing}`);
  }

  return {
    ...base,
    name: name || base.name,
    localName,
    kind,
    emoji: categoryEmoji(tags),
    distM,
    bearing,
    detail: meta.join(" · "),
    level: levelLabel(tags.level),
    hours: tags.opening_hours,
    phone: tags.phone ?? tags["contact:phone"],
    website: tags.website ?? tags["contact:website"],
    address: addressLabel(tags),
    wheelchair: tags.wheelchair,
    ...(open === null ? {} : { openNow: open }),
  };
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
  // Street furniture and station fittings. Shinjuku alone maps 21 luggage
  // lockers, 15 vending machines and 5 ticket validators inside 250m —
  // they'd bury every restaurant in the list.
  "luggage_locker", "locker", "parking_space", "ticket_validator",
  "photo_booth", "money_lender", "bench", "waste_basket", "drinking_water",
  "shelter", "telephone", "clock", "post_box", "bicycle_repair_station",
]);

/**
 * Real places a traveler might want, but never *instead of* dinner. Kept in
 * the list — sometimes you do want a konbini — just never above things you'd
 * cross a city for.
 */
const EVERYDAY_KINDS = new Set([
  "convenience", "supermarket", "kiosk", "greengrocer", "butcher",
  "clothes", "shoes", "cosmetics", "electronics", "general", "variety_store",
  "newsagent", "stationery", "tobacco", "florist", "chemist", "outdoor",
  "information", "bicycle_rental", "fitness_centre", "sports_centre",
  "fuel", "travel_agency", "ticket",
]);

/**
 * Actual sights. Kept narrow on purpose: `artwork` is mostly station exits
 * and wall plaques, and promoting anything with a wikidata tag turned the
 * Shinjuku list into a bus terminal followed by six shopping malls.
 */
const NOTABLE_KINDS = new Set([
  "attraction", "museum", "gallery", "viewpoint", "monument",
  "memorial", "castle", "ruins", "archaeological_site", "temple", "shrine",
  "place_of_worship", "theatre", "arts_centre", "zoo", "aquarium",
  "theme_park", "garden", "park", "marketplace",
]);

/**
 * Sorting by distance alone puts "ID photo booth · 7m" above every
 * restaurant in Shinjuku. Rank by a distance the traveler would *accept*
 * instead: everyday errands get pushed past the whole radius, and places
 * worth a detour get credit for one.
 */
const EVERYDAY_PENALTY_M = 500;
// A nudge, not a teleport. At 150 a memorial 214m away outranked every one
// of Shinjuku's 58 restaurants; a sight has to be genuinely near to win.
const NOTABLE_BONUS_M = 60;

function tagValues(t: Record<string, string>): string[] {
  return [t.amenity, t.shop, t.tourism, t.historic, t.leisure].filter(
    (v): v is string => v != null,
  );
}

function isEveryday(t: Record<string, string>): boolean {
  return tagValues(t).some((v) => EVERYDAY_KINDS.has(v));
}

function isNotable(t: Record<string, string>): boolean {
  return tagValues(t).some((v) => NOTABLE_KINDS.has(v));
}

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
/** Slots held at the bottom of the list for everyday errands. */
const EVERYDAY_SLOTS = 3;

/**
 * What to call a place. 60% of Shinjuku POIs carry `name:en`, and a traveler
 * who cannot read 松屋 needs "Matsuya" — but the local name is what is
 * painted above the door, so we keep both and let the UI show both.
 */
function displayNames(t: Record<string, string>): {
  name: string;
  localName?: string;
} {
  const local = t.name;
  const english = t["name:en"];
  if (english && english !== local) return { name: english, localName: local };
  return { name: local };
}

function sentenceCase(value: string): string {
  const clean = value.replace(/_/g, " ").trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/** "Ramen" beats "Restaurant" when you're deciding where to eat. */
function readableKind(t: Record<string, string>): string {
  // `cuisine` is multi-valued ("noodle;ramen") — the first is the headline.
  const cuisine = t.cuisine?.split(";")[0];
  if (cuisine) return sentenceCase(cuisine);
  const kind =
    t.amenity ?? t.shop ?? t.tourism ?? t.historic ?? t.leisure ?? "";
  return kind ? sentenceCase(kind) : "Place";
}

/**
 * The one distance format. Nearby rows are always inside 250m, but search
 * hits can be on another continent — Nominatim's viewbox is a bias, not a
 * filter — so anything rendering a distance must handle both, or you get
 * "12303381m E".
 */
export function distanceLabel(m: number): string {
  if (m < 1000) return `${Math.round(m)}m`;
  return m < 10_000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m / 1000)}km`;
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/** Which way to walk. "120m NE" is directions; "120m" is trivia. */
export function bearingLabel(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): string {
  const north = toLat - fromLat;
  const east = (toLng - fromLng) * Math.cos((fromLat * Math.PI) / 180);
  const deg = (Math.atan2(east, north) * 180) / Math.PI;
  return COMPASS[Math.round(((deg + 360) % 360) / 45) % 8];
}

/**
 * Which floor. 44% of Shinjuku POIs sit inside a building on a specific
 * level, where "3F" is the difference between finding it and giving up.
 */
/** "12 Market Street" from OSM's split address tags. */
function addressLabel(t: Record<string, string>): string | undefined {
  const street = t["addr:street"];
  if (!street) return undefined;
  const number = t["addr:housenumber"];
  return number ? `${number} ${street}` : street;
}

function levelLabel(raw?: string): string | undefined {
  if (!raw) return undefined;
  // Multi-level ("1;2") tells us nothing precise enough to be worth showing.
  const value = Number(raw);
  if (!Number.isFinite(value)) return undefined;
  if (value === 0) return "G";
  return value > 0 ? `${value}F` : `B${Math.abs(value)}`;
}

/**
 * Named POIs within ~250m of a point (Overpass API — keyless, fine for
 * prototype volumes). The checkpoint flow: "what's around me right now?"
 *
 * Throws if the lookup fails, so the UI can offer a retry instead of
 * pretending the neighbourhood is empty.
 */
export interface NearbyResult {
  places: PlaceResult[];
  /** Set only when the live lookup failed and we fell back to cache. */
  cachedAt?: number;
}

/** How far from a cached lookup we'll still reuse it. */
const CACHE_REUSE_M = 300;

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

  const scored: (PlaceResult & { distM: number; score: number })[] = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    const pLat = el.lat ?? el.center?.lat;
    const pLng = el.lon ?? el.center?.lon;
    if (!tags.name || pLat == null || pLng == null || isExcluded(tags)) continue;

    const { name, localName } = displayNames(tags);
    const kind = readableKind(tags);
    const distM = Math.hypot(
      (pLat - lat) * 111_320,
      (pLng - lng) * 111_320 * Math.cos((lat * Math.PI) / 180),
    );
    const bearing = bearingLabel(lat, lng, pLat, pLng);
    // Hours are in the shop's local time. If the phone plainly isn't on it,
    // show the spec and let the traveler judge rather than assert a verdict.
    const open =
      tags.opening_hours && clockMatchesPlace(pLng)
        ? isOpenNow(tags.opening_hours)
        : null;
    const everyday = isEveryday(tags);
    const score =
      distM +
      (everyday ? EVERYDAY_PENALTY_M : 0) -
      (isNotable(tags) ? NOTABLE_BONUS_M : 0);

    scored.push({
      score,
      everyday,
      name,
      localName,
      kind,
      emoji: categoryEmoji(tags),
      bearing,
      level: levelLabel(tags.level),
      hours: tags.opening_hours,
      // `contact:` prefixed variants are equally common in OSM.
      phone: tags.phone ?? tags["contact:phone"],
      website: tags.website ?? tags["contact:website"],
      address: addressLabel(tags),
      wheelchair: tags.wheelchair,
      // Kept for consumers that render a plain subtitle (search results).
      // Same fields and order as the list row builds — the floor matters most
      // on the detail view, where you're about to go and find the place.
      detail: [kind, `${distanceLabel(distM)} ${bearing}`, levelLabel(tags.level)]
        .filter(Boolean)
        .join(" · "),
      lat: pLat,
      lng: pLng,
      distM,
      ...(open === null ? {} : { openNow: open }),
    });
  }

  // Sort before deduping so the nearest branch of a chain wins, and key on
  // position as well as name so two real branches both survive. ~4dp is
  // ~11m, enough to collapse a POI mapped as both a node and a building.
  scored.sort((a, b) => a.score - b.score);
  const seen = new Set<string>();
  const ranked: PlaceResult[] = [];
  for (const place of scored) {
    const key = `${place.name}@${place.lat.toFixed(4)},${place.lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    ranked.push(place);
  }

  // Reserve the tail for errands. Shinjuku has far more than 20 destinations
  // inside 250m, so without a reservation the penalty buries every
  // convenience store below the cut and "where's the nearest konbini?"
  // becomes unanswerable.
  const destinations = ranked.filter((p) => !p.everyday);
  const errands = ranked.filter((p) => p.everyday);
  const reserved = Math.min(EVERYDAY_SLOTS, errands.length);
  return [
    ...destinations.slice(0, NEARBY_LIMIT - reserved),
    ...errands.slice(0, reserved),
  ];
}

/**
 * What we last saw near this point, read straight from SQLite — no await.
 *
 * Callers render this *first* and let the live lookup overwrite it. Awaiting
 * the network before showing anything means a spinner for as long as it takes
 * every Overpass mirror to time out, which is ~90s when they're struggling.
 * Someone standing on a street corner will not wait that out for data we
 * already have on disk.
 */
export function cachedNearby(lat: number, lng: number): NearbyResult | null {
  const hit = findCachedNearby(lat, lng, CACHE_REUSE_M);
  if (!hit) return null;
  const places = JSON.parse(hit.payload) as PlaceResult[];
  return { places: places.map(refreshOpenNow), cachedAt: hit.fetchedAt };
}

/** The live lookup, recording its result for the next time we're offline. */
export async function fetchNearby(
  lat: number,
  lng: number,
): Promise<PlaceResult[]> {
  const places = await nearbyPlaces(lat, lng);
  cacheNearby(lat, lng, JSON.stringify(places));
  return places;
}

/**
 * Open/closed is the one cached field that rots. Everything else about a
 * shop is the same next week, but "OPEN" computed on Tuesday is a lie on
 * Sunday — so it's recomputed from the stored spec on every read.
 */
function refreshOpenNow(place: PlaceResult): PlaceResult {
  const { openNow: _stale, ...rest } = place;
  if (!place.hours || !clockMatchesPlace(place.lng)) return rest;
  const open = isOpenNow(place.hours);
  return open === null ? rest : { ...rest, openNow: open };
}

/**
 * Where "you are exploring X" gets X, most preferred first.
 *
 * There is no single field that holds it, so we walk a chain. `quarter` leads
 * because `suburb` is the wrong size or plain wrong too often: New York's is
 * "Manhattan" (a whole borough), and OSM puts Nob Hill inside a South of
 * Market polygon a mile away. Where `quarter` is absent — the Mission, Paris,
 * Kreuzberg — `suburb` is right behind it. `town`/`village` sit past the end
 * for rural ground, where every city-scale field is empty.
 */
const AREA_FIELDS = [
  "quarter",
  "suburb",
  "city_district",
  "borough",
  "neighbourhood",
  "city",
] as const;

/** The city around the area. `town`/`village` cover rural ground. */
const CITY_FIELDS = ["city", "town", "village"] as const;

export interface AreaLabel {
  /** The neighbourhood-sized area you're standing in. */
  area: string;
  /** The city around it, or null when `area` already is the city. */
  city: string | null;
}

/**
 * Where you are, as "Nob Hill" + "San Francisco". Null if nothing is mapped
 * there or we're offline.
 */
export async function areaLabel(
  lat: number,
  lng: number,
): Promise<AreaLabel | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&zoom=17&addressdetails=1`,
    { headers: HEADERS },
  );
  if (!res.ok) return null;
  const row = (await res.json()) as {
    address?: Record<string, string>;
    error?: string;
  };
  if (row.error || !row.address) return null;

  const pick = (fields: readonly string[]) =>
    fields.map((f) => row.address?.[f]).find(Boolean) ?? null;

  const city = pick(CITY_FIELDS);
  // Falling back to the city keeps rural ground labelled, where every
  // sub-city field is empty.
  const area = pick(AREA_FIELDS) ?? city;
  if (!area) return null;
  // "Shinjuku, Shinjuku" helps nobody — drop the city when it repeats.
  return { area, city: city === area ? null : city };
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
