# Lessons

## A formatter duplicated at the render site silently beats the shared one

**2026-08-12 — search results showed "12303381m E".**

`enrichSearchHit` formatted distances correctly (km above 1000m) and the
correct code never ran: the FlatList row rebuilt its own meta string with a
hardcoded `${Math.round(distM)}m`, overriding the `detail` field entirely.
Invisible for eight passes because every row until then came from a 250m
radius, where metres are always right.

**Rule:** when adding a field that a render site *also* computes, grep for
other places that format the same value before assuming yours is the one in
effect. Widening an input's range (250m → planet-scale) turns a
harmless duplicate into a visible bug, and the duplicate is the one that wins.

## When the simulator MCP wedges, screenshot with simctl instead

**2026-08-12 — verification blocked by tooling, not by the code.**

The iOS Simulator MCP server started returning "internal error" for every
screenshot while the device itself was perfectly healthy. Work stalled with a
change written but unverified.

`xcrun simctl io booted screenshot --type=png <path>` writes a PNG that Read
displays inline — a complete bypass of the wedged server for the *observing*
half of verification. Only input injection (tap/swipe) actually needs the MCP
server, and that recovered before screenshots did.

**Rule:** don't report a UI change as done because the screenshot tool broke,
and don't sit waiting for it either. Try the simctl path, and if observation
is genuinely impossible, say the change is unverified *in the summary and in
`todo.md`* with the exact repro steps for next time.

## Tune the thing that's actually opaque, not the thing named "fog"

**2026-08-11 — fog was still covering the map after two commits aimed at it.**

`8ac024a` ("cloud layer at 0.84 opacity") and `a383271` ("brighter cloud tile")
both tried to make the mist translucent by adjusting the cloud layer. Neither
changed anything visible, because the cloud layer was never what blocked the
map. `FogOverlay` stacked *two* layers, and the lower one — `fog-rim`, named
like a thin edge accent — was built by `buildFogShape`, the same
world-covering polygon as the fog. It painted solid `#e9f2ee` at 0.9 over the
entire fogged world. Combined transmittance was `(1-0.9) x (1-0.82)` ≈ 1.8%.

**Rule:** when a visual tweak produces no visible change, stop tuning that
value. Enumerate every layer compositing onto those pixels and compute the
combined result before touching anything. A layer's *name* is not evidence of
its *geometry* — check what actually builds it.

## Don't cancel async work from a cleanup that fires on every render

**2026-08-11 — the area banner never updated.**

The lookup effect depended on `position`, which changes on every GPS fix, and
returned a cleanup setting `cancelled = true`. So the fetch started on fix 1
was cancelled by fix 2 a second later — while the throttle anchor had already
been set, suppressing every retry. The banner showed a stale persisted value
forever, and it looked like the geocoding chain was wrong rather than never
running.

**Rule:** before writing a cleanup that aborts in-flight work, check how often
the dependency actually changes. If it changes faster than the work completes,
the work never completes. Use a monotonic request counter and ignore stale
replies (`if (req !== latest.current) return`) instead of cancelling — only a
*newer* request should invalidate an older one.

**Corollary:** a throttle whose anchor is committed *before* the work succeeds
turns one dropped result into permanent silence. Same shape as the
`lastCell.current` wedge in `useTracking.ts`: state that gates future attempts
must not advance on a path that failed — or must advance on *every* path,
including the failing one. Pick one deliberately.

## Tune the thing that's actually opaque (cont.)

**Corollary:** opacity only composes correctly if nothing solid sits
underneath. `clouds.png` is PNG colortype 2 (RGB, no alpha), so `fill-opacity`
is the sole source of translucency — there is no second knob, and adding an
opaque backing layer silently cancels it. `MIST_OPACITY` in `FogOverlay.tsx`
is now the single documented place to tune this.
