# Lessons

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

**Corollary:** opacity only composes correctly if nothing solid sits
underneath. `clouds.png` is PNG colortype 2 (RGB, no alpha), so `fill-opacity`
is the sole source of translucency — there is no second knob, and adding an
opaque backing layer silently cancels it. `MIST_OPACITY` in `FogOverlay.tsx`
is now the single documented place to tune this.
