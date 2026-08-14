# Make map pins tappable

Single taps on the map do nothing since `73116c0` removed `handlePress` (a dev
cheat that cleared fog on tap) along with the `onPress` wiring. Nothing
replaced it, so neither base-map POI pins nor the user's own saved places
respond to a tap.

## Plan

- [x] Confirm MapLibre RN v11 API: `Map.queryRenderedFeatures(bounds, {layers})`
      via `MapRef`; `PixelPointBounds` is `[[l,t],[r,b]]` (the JSDoc's flat
      4-tuple example is wrong).
- [x] Add `id` to `notesShape` feature properties so a tapped pin maps back to
      its `PlaceNote`.
- [x] `NoteCard.tsx` — read-only sheet for a saved place: verdict, name, note
      body, saved date, delete.
- [x] Single `handleMapPress` on `MapView` that queries a 44px box: own note
      pins win, base-map `explora-poi` pins are the fallback.
- [x] POI tap reuses the existing `NoteSheet` prefilled path (same as
      long-press), so a restaurant is one tap from saved.
- [x] Typecheck + verify both taps on the simulator.

## Notes

Both hit-tests run off one `MapView.onPress` rather than a `GeoJSONSource`
`onPress` plus `stopPropagation()`. One handler means priority between the two
pin kinds is explicit and there is no native/synthetic propagation ambiguity.

`queryRenderedFeatures` at a bare pixel point would demand a hit within the
6px circle radius, so both queries use a ±22px box — matching the 44px hitbox
the source-level `onPress` would have given us.

## Review

Done and verified on the simulator (both a star POI and a saved pin).

- `src/ui/NoteCard.tsx` (new) — the saved-place card.
- `App.tsx` — `mapRef`, `handleMapPress`, `openNote` state, `id` in
  `notesShape` properties, `NoteCard` render.

POI data comes from OpenFreeMap vector tiles, which carry only `name` and
`class` — no address or hours. `poiDetail()` maps `class` to a readable label
("Art gallery", "Cafe"); richer data needs Nominatim or the Foursquare table
the code comments anticipate.

Deliberately out of scope: editing an existing note. `NoteSheet` only creates,
and adding an edit mode is a larger change than "pull up its information".

---

# Show a "locating" state before the first GPS fix

`denied` only covered permission refusal. With permission granted and no fix
yet, `position` is null, `puckShape` is null, and the puck layer is not
rendered at all — while the HUD shows the same "the fog is waiting…" copy as
normal operation. Waiting on GPS and a broken app looked identical.

## Plan

- [x] Track `lastKnown` from the `getLastKnownPositionAsync` call
      `centerOnUser` already makes.
- [x] Puck stands at `position ?? lastKnown`, dimmed (`icon-opacity` 0.45)
      while the fix is stale.
- [x] Third HUD state for `!denied && !position`.
- [x] Verify both states on the simulator.

## Review

The simulator returns a cached fix almost instantly, so the pre-fix window
cannot be caught by screenshot timing. Verified by temporarily forcing the
no-fix branch, screenshotting, then reverting — both the ghosted puck and the
"finding you…" copy render, and normal operation is unchanged after revert.

Not done: no timeout. If GPS never locks, the HUD says "finding you…" forever
rather than escalating to something actionable.

---

# "You are exploring X" banner

Replaces the km²/patches line, which was a number with no human intuition
behind it. The counts still live in the journal (`StatsModal`), one tap away.

## Plan

- [x] `areaName()` in `places.ts` — reverse geocode, walk the field chain.
- [x] `metersBetween()` extracted in `fog.ts` (was inline in `thinPoints`).
- [x] Re-geocode only after moving `AREA_REFRESH_M` (400m), never per fix —
      Nominatim allows 1 req/s and no bulk use.
- [x] Persist the name in `kv` so the banner is populated at launch and stays
      populated offline.
- [x] Verify on the simulator.

## Review

Reads "You are exploring {area}, {city}", collapsing to one name when the
area chain resolves to the city itself (Shinjuku).

Chain: quarter → suburb → city_district → borough → neighbourhood → city,
with town/village behind it for rural ground. `quarter` leads because
`suburb` was demonstrably wrong: at Frank Norris St (Nob Hill/Polk Gulch) it
returns "South of Market", a mile away — identical at z14/16/17/18, so it is
the OSM polygon, not the query. Verified on device in both SF (Nob Hill, San
Francisco) and Tokyo (Shinjuku, deduped).

English is forced via the `Accept-Language` HTTP header on `HEADERS`, which
covers all four Nominatim calls at once rather than a query param on each.
A place's own proper name is unaffected — the station stays JR新宿駅.

Still local-language: the **base map labels**, which come from OpenFreeMap
vector tiles, not Nominatim. Tokyo's streets render in Japanese. Fixing that
means a `name:en` fallback in `mapstyle.json`'s `text-field`.

---

# Production pass 1 — the traveler's nearby list

## What the APIs actually return (measured, not guessed)

Sampled Overpass at Shinjuku (360 POIs) and Nob Hill (163):

| tag | Shinjuku | Nob Hill | was it used? |
|---|---|---|---|
| `name:en` | **60%** | – | no |
| `level` | 44% | 2% | no |
| `website` / `phone` | 30% | 34% | no |
| `opening_hours` | 23% | 33% | no |
| `cuisine` | 19% | 16% | no |
| `wheelchair` | 25% | 19% | no |

We were fetching all of it and rendering `name`, category and distance.
An English speaker in Shinjuku was shown 松屋, not "Matsuya".

Of 138 `opening_hours` values across both cities, 129 match a plain
day-spec + `HH:MM-HH:MM` grammar — enough for a subset parser to be worth it.

## Done

- [x] `src/openingHours.ts` — subset parser, returns null for anything
      outside the grammar. 17 cases pass incl. overnight spill (`Fr 20:00-02:00`
      still open at 01:00 Sat) and `PH` → null.
- [x] `name:en` as the display name, local name kept as a second line.
- [x] `cuisine` ahead of amenity: "Ramen", not "Restaurant".
- [x] 8-point bearing — "120m NE" is a direction, "120m" is trivia.
- [x] `level` → "3F" / "B1", which in a Shinjuku tower is the difference
      between finding a place and giving up.
- [x] Design tokens promoted to real ones in `theme.ts`: `space` (4pt
      rhythm), `type` (roles, not sizes), `status` (semantic open/closed).
- [x] Row rebuilt: fixed-width icon column so names align, three-tier
      hierarchy (name / local name / meta), open-closed as a chip.
- [x] Verified on device in Shinjuku.

## Known limitation

`isOpenNow` evaluates against the **device clock**. A traveler's phone
normally switches to local time on arrival, so this is right in practice —
but a phone held on home time will report the wrong verdict. Proper fix is
the POI's timezone from its coordinates.

---

# Production pass 2 — relevance, not proximity

Shinjuku maps 21 luggage lockers, 15 vending machines, 9 parking spaces and
5 ticket validators inside 250m. Sorted by distance, they buried all 58
restaurants.

- [x] Excluded street furniture and station fittings outright.
- [x] Three tiers scored as an *acceptable walking distance*, not raw metres:
      `score = distM + (everyday ? 500 : 0) - (notable ? 60 : 0)`.
- [x] Reserved 3 tail slots for errands + an `EVERYDAY` divider in the list.

## Two calibration mistakes worth remembering

**Promoting anything with a `wikidata`/`wikipedia` tag** turned the list into
a bus terminal followed by six shopping malls. Dropped it — OSM notability
tracks "has an article", not "worth visiting".

**A −150m notable bonus was a teleport, not a nudge**: a memorial 214m away
outranked every restaurant in Shinjuku. At −60m a sight has to be genuinely
near to win. Both were caught by scoring live Overpass data offline
(`scratchpad/rank.py`, which parses the category sets straight out of
`places.ts`) before touching the UI — far faster than rebuilding the app to
look at a list.

**The reserved slots exist because of a third mistake**: with 20 slots and a
+500 penalty, dense areas fill every slot with destinations and a convenience
store can never appear. "Where's the nearest konbini" is a real traveler
question; the penalty should reorder the list, not censor it.

---

# Production pass 3 — a map a traveler can read

The place list was English but the map under it was not, which is the wrong
way round: the map *is* the app.

Liberty ships this on all 15 labelled layers:

    ["case", ["has", "name:nonlatin"],
      ["concat", ["get", "name:latin"], "\n", ["get", "name:nonlatin"]],
      ["coalesce", ["get", "name_en"], ["get", "name"]]]

In Japan the first branch always wins, so it renders each label twice — and
where `name:latin` is empty it renders a blank line plus the Japanese. The
`name_en` fallback sits in the branch that never fires there.

- [x] Confirmed against the planet TileJSON that `name:en`, `name:latin` and
      `name:nonlatin` all exist on place/poi/transportation_name.
- [x] `LABEL_EN = coalesce(name:en, name:latin, name)` applied to every
      labelled layer.
- [x] Changed **`scripts/make_mapstyle.py`, not the JSON** — the JSON is
      generated and a regeneration would have silently reverted it.
- [x] Diffed regenerated vs previous: 85 layers before and after, none
      added or removed, sources identical, exactly 15 layers changed and only
      `layout.text-field`. No upstream drift came along for the ride.
- [x] Verified in Tokyo: マクドナルド → McDonald's, 松屋 → Matsuya,
      かつくら → Katsukura Takashimaya.

Labels with no `name:en` *or* `name:latin` in OSM still render locally
(`東西自由通路`, JR platform numbers). Correct — the data isn't there.

---

# Production pass 4 — the place card

We fetch `phone` (28%/38%), `website` (30%/34%), `opening_hours` (23%/33%),
`wheelchair` (25%/19%) and `addr:*` (11% Tokyo / 88% SF) and rendered none of
it. Standing outside somewhere at 22:00, a tappable number and a site are the
difference between going in and walking away.

- [x] `places.ts` carries `hours`, `phone`, `website`, `address`,
      `wheelchair`. Reads `contact:`-prefixed variants too, which are equally
      common in OSM.
- [x] `PlaceFacts` block on the selected-place view: open/closed chip beside
      the raw hours spec (the spec answers "will it still be open later",
      which a badge cannot), address, step-free access, and Call / Website
      actions via `Linking`.
- [x] Local-script name now also shown on the detail view, not just the row.
- [x] Every field renders only when present, and the whole block disappears
      when nothing is known — no scaffold of empty labels.
- [x] Typecheck clean.
- [x] **Verified on device** (RF1/KOBE CROQUET, Shinjuku): English name,
      local name beneath, OPEN chip beside the `08:00-22:00` spec, Call and
      Website pills. Address and step-free rows correctly absent — RF1 has
      neither tag, and Tokyo only maps addresses on 11% of POIs.
- [x] Follow-up caught by that screenshot: the list row read
      "132m N · B1" but the detail dropped the floor, which is backwards —
      the floor matters most when you're about to go find the place.
      `detail` now composes from the same fields in the same order as the row.

---

# Production pass 5 — the check-in flow survives being offline

VISION: "travelers are offline exactly when the app matters most". Until now
a failed Overpass lookup meant an error row and nothing else — no places at
all. Overpass was genuinely down while this was built, which made the point.

- [x] `nearby_cache` table in SQLite, capped at 200 lookups (a whole trip).
- [x] `nearbyPlacesCached()` writes on success; on failure serves the most
      recent cached lookup within 300m.
- [x] With no cache *and* no network it still throws, so the UI keeps saying
      "couldn't load" rather than implying the neighbourhood is empty.
- [x] Quiet inset banner, not the coral error row — this is a working state
      with real results under it. "Offline — showing what was here 2 days
      ago. Tap to retry."

## Open/closed is the one cached field that rots

Everything else about a shop is the same next week. "OPEN" computed on
Tuesday is a lie on Sunday — so `refreshOpenNow` drops the stored verdict and
recomputes from the stored `opening_hours` spec on every read.

Verified by seeding deliberately *wrong* cached verdicts and watching both
flip, in opposite directions, at 11:11 device time:

| place | cached `openNow` | hours | rendered |
|---|---|---|---|
| SOBAICHI | `false` | 07:00-22:00 | **OPEN** |
| THE BENCH | `true` | 23:00-23:30 | **CLOSED** |

A single-direction test would have passed even if the field were simply
being dropped. Seeded rows were deleted afterwards; notes and cells untouched.

---

# Production pass 6 — cache first, network second

Pass 5 awaited the network *before* showing anything, so with Overpass
struggling the sheet sat on a spinner for ~90s (three mirrors x 30s) before
falling back to data already on disk. Nobody standing on a street corner
waits that out.

- [x] Split into `cachedNearby()` (synchronous SQLite read, no await) and
      `fetchNearby()` (live + writes the cache).
- [x] The sheet renders the cached list immediately, then lets the live
      result overwrite it — stale-while-revalidate.
- [x] Failure is only an *error* when there was nothing to show; otherwise it
      just stops the refresh and leaves the list up.
- [x] Spinner suppressed whenever content is on screen. A spinner above a
      full list reads as broken.

## The banner has to distinguish two different truths

The same cached list means different things depending on whether a request is
still in flight. Saying "Offline" while we're still trying is a guess.

| t | banner |
|---|---|
| ~4s | "Showing what was here 3 hours ago · checking for updates…" |
| ~105s | "Offline — showing what was here 3 hours ago. Tap to retry." |

Both verified on device against the live Overpass outage; the list never
blanked between them. Seeded rows deleted; notes and cells untouched.

---

# Production pass 7 — the collection knows where you are

"My places" was a flat list in insertion order. VISION's promise is that a
friend's Tokyo guide becomes your Tokyo quest map — worthless if you can't
see which of it is reachable from where you're standing.

- [x] Nearest first, with distance + bearing on each row.
- [x] Metres under 1km, km above (one decimal until 10km).
- [x] No fix → newest-first and no distances, rather than an arbitrary order
      dressed up as a ranking.
- [x] Row meta reuses the check-in list's `type.meta` role, so the two
      screens read as one system.

Verified in SF against hand-computed distances: California Street 153m NW,
Smaart Gallery 211m SE, Poop 1.7km S, SF LGBT Center 2.0km S, First Baptist
Church 35km NE — order and every value correct, both unit thresholds hit.

Also incidentally confirmed the area banner re-resolves across a Tokyo → SF
jump ("Nob Hill, San Francisco"), so the 400m re-geocode threshold behaves at
continental scale.

---

# Production pass 8 — open/closed stops lying across timezones

`opening_hours` is in the shop's local time; we evaluate it with the phone's
clock. Correct once a traveler's phone picks up local time, wrong all day if
it hasn't — airplane mode, a manual timezone, an eSIM that never resynced.
Every OPEN/CLOSED badge in passes 1-7 was computed on the Mac's Eastern
clock while the app sat in Tokyo, i.e. wrong by ~13 hours.

A real tz database is ~1MB of dependency. The parser's existing rule is
"never guess", so instead we detect the mismatch and **withhold the verdict**,
still showing the raw hours so the traveler can judge.

`clockMatchesPlace(lng)` compares the device UTC offset against the
longitude's solar offset, allowing 4h for political deviation.

- [x] 11 unit cases pass, including the ones that could false-positive:
      western China (+3h from solar), Madrid (+2h), Nome (-3h), India's
      half-hour offset, and Samoa at +13 with longitude -170 across the
      date line.
- [x] Gated in both the live path and `refreshOpenNow` (cache path).
- [x] Device-verified: two seeded SF places, both cached `openNow: true`,
      both with valid hours, render **no chip** — device Eastern vs SF solar
      is 4.16h. Rows keep name, kind, distance, bearing.

**Consequence for simulator testing:** with the Mac on Eastern time, badges
will not appear for SF or Tokyo. That is the feature working. To see chips,
test where the device timezone matches the map, or change the Mac's timezone.

---

# Production pass 9 — search results stop being second-class

Nearby rows were rich; search hits in the same list were a name and an
address fragment. Nominatim carries the same data, we just weren't asking:
`extratags=1` gives opening_hours/phone/website/cuisine, `namedetails=1`
gives name:en.

- [x] `rowToTags()` flattens a Nominatim hit into the OSM tag shape the
      enrichment helpers already speak, so search reuses all of it rather
      than growing a parallel implementation.
- [x] Administrative hits (a city, a street) have no category and stay as
      plain address-style results.
- [x] Distance + bearing from the search viewbox centre.

## A formatter duplicated at the render site silently won

Verification immediately showed **"51698m SE"** and **"12303381m E"**. The km
formatting in `enrichSearchHit` was correct and never ran: the list row
rebuilt its own meta with a hardcoded `${Math.round(distM)}m`. That was
harmless while every row came from a 250m radius — search hits can be on
another continent.

`distanceLabel()` now lives in `places.ts` and is the only implementation;
`NoteSheet`, `PlacesModal` and the `detail` string all call it. Re-verified:
52km SE and 12303km E.

---

# Production pass 10 — search failure stops lying

Two bugs, both only reachable when a traveler is offline or roaming — which
is when they matter.

- [x] `searchPlaces` returned `[]` on a bad response: "the search broke" and
      "nothing matched" looked identical. This is the exact pattern `acc9fb7`
      fixed for Overpass, and `overpass()`'s own docstring warns against it.
      It now throws, like its sibling.
- [x] The search effect had `try`/`finally` with **no `catch`**, so a fetch
      rejection escaped the `setTimeout` as an unhandled promise rejection.
      Now caught, with its own retry row.
- [x] Verified both ways against an unreachable host: "Couldn't search — you
      may be offline. Tap to retry.", no red box, and "Add … at my location"
      still available as the escape hatch. Reverted and re-verified normal.

---

# Where this stopped, and why

Ten passes in, every OSM field with meaningful coverage is now used. What's
left is genuinely marginal and would be manufacturing work:

- `brand` (32% Shinjuku) — redundant with the name already shown.
- `takeaway` / `outdoor_seating` (4-9%) — too sparse to shape a row.
- `wikipedia` (3%) — a link at a monument would be nice, but 3%.
- `description` (1-3%) — negligible.

Bigger items that are real but need a product decision rather than a data
pass: caching search results, a per-city grouping for the collection (notes
don't store a region yet), and the timezone question solved properly with a
tz database rather than the longitude heuristic.

## Next

The list is sorted purely by distance, so at Shinjuku station the top of a
traveler's list is "ID photo booth · 7m", "Luggage locker · 88m B1",
"Information", "Artwork". Distance-first is the wrong objective — VISION's
question is *worth going*, so category value has to weigh against distance.

---

# Bug found while testing: cell tracking wedges after a flight

Not from this session's work — pre-existing in `useTracking.ts`.

`gridPathCells` throws when two H3 cells are too far apart to path between.
The throw landed before `lastCell.current = cell`, so after an SF → Tokyo
jump `lastCell` stayed pinned to the San Francisco cell and *every*
subsequent fix threw again. Cell recording stopped for the rest of the
session — the exact traveler case VISION is built around. Fog still cleared
(that runs off visit points), so the failure was silent.

- [x] Catch the throw, fall back to recording just the current cell, and let
      `lastCell` advance regardless.
- [x] Verified: same teleport, no error, 10 new cells recorded in Tokyo.
