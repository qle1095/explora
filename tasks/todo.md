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
