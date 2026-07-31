# Explora — Vision

*The context document. Read this before making product decisions; when a feature
idea conflicts with this document, the document wins or gets deliberately amended.*

## The problem

People who love exploring have no good way to **keep** their exploration.
Where you've been lives in fragmented photo rolls and fading memory; the
places you loved are buried in a notes app; and when a friend asks *"where
do you like to go?"* — the question this app exists to answer — you
reconstruct it badly from memory every time.

## The idea

Explora is a map of the world covered in fog. Physically going somewhere
clears it — automatically, in the background, as you live your life. Over
months the map becomes something no other app gives you: a beautiful,
personal, lifetime record of everywhere you've ever been. On that map you
save places worth remembering, with notes. Exploration itself becomes a
game, and your annotated map becomes the thing you share.

**Explora answers "where have you been?" — never "where are you right now?"**

## Who it's for (layered)

1. **Local explorers — the daily base.** Gamifying your own city: walking
   new streets, filling in neighborhoods, weekend quests to clear a
   district. This is what makes the app worth opening on an ordinary Tuesday.
2. **Travelers — the aspirational story.** A lifetime world map, country and
   city completion, and trusted guides from real people instead of algorithmic
   review sludge. This is the identity users brag about.
3. **Couples & close friends — the social seed.** Exploring together,
   comparing coverage of the same city, sharing each other's saved places.
   Small trusted circles, not audiences. (Also our own first test market: two
   phones, one household.)

## The core loop

```
go somewhere  →  fog clears (automatic)  →  map gets more yours
     ↑                                             ↓
share your places  ←  add notes to places worth keeping
```

## Product pillars

### 1. The fog (ambient tracking)
- Hybrid tracking: battery-cheap background "visit" reveals all day;
  precise GPS trails when you explicitly explore with the app open.
- Zero manual effort — no check-ins. The map fills itself.
- Offline-first: travelers are offline exactly when the app matters most.

### 2. Places & notes (the collection)
- Any spot can be saved with a **private note** ("cash only, order the #7").
  Private means private: only you, forever, by default.
- **Public comments** on canonical places are visible to everyone, like
  YouTube comments — the community layer that makes any place page useful.
- The collection of saved places is a first-class object, not map decoration:
  browsable, city-scoped, exportable.

### 3. Sharing (deliberate, person-to-person)
- Sharing is an explicit act: **Share → scope it (city / country / all) →
  choose what's included (places, notes, fog) → send to a looked-up user.**
- The recipient **imports** it: your places and notes appear as an overlay
  in *their* Explora, ready to visit and clear. A friend's Tokyo guide
  becomes your Tokyo quest map.
- No algorithmic feed. No broadcast-by-default. Your map travels only when
  you hand it to someone.

### 4. The game (progress, not competition — for now)
- **Completion %**: per-city, per-country, world. The map is the score.
- **Streaks & milestones**: exploration streaks, firsts (new country, 100th
  cell, fully-cleared neighborhood).
- **Collection growth**: saved places as a trophy shelf.
- Rankings/leaderboards/head-to-head: deliberately **later** — post-MVP.

### 5. Privacy (non-negotiable, because pillar 1 is radioactive)
- Lifetime location history is the most sensitive data an app can hold.
- Privacy zones around home/work, coarse-resolution sharing, publish delays,
  per-item control, real export/delete. Enforced server-side, not by
  client politeness.

## What Explora is NOT

- Not a live-location app (no Find-My-Friends, ever).
- Not a review platform (comments are traveler-to-traveler tips, not stars).
- Not an algorithmic feed competing for attention.
- Not a check-in app — if the user has to remember to do something, the
  fog has failed.

## MVP boundary

**In:** fog + hybrid tracking, places with private notes, public comments,
completion % + streaks + milestones, person-to-person share/import,
privacy foundations.

**Later:** rankings & head-to-head, web-viewable guides, freeform pins for
unlisted spots, trip albums/photos, achievements marketplace of quests,
monetization (likely one-time pro unlock).

## Success signals

- You and your wife check the app unprompted after a normal day out.
- A tester plans a visit around a friend's imported guide.
- Someone shares their city map image without being asked to.

---

*Architecture, stack, data model, and roadmap live in the product spec
(see CLAUDE.md). Decisions log: cross-platform RN/Expo · H3 cells ·
MapLibre + OpenFreeMap · offline-first SQLite · Supabase later (auth
deferred until core features are done).*
