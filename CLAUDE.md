@AGENTS.md
@VISION.md

# Explora — working notes

- **Product vision**: see VISION.md above — it is the source of truth for
  what gets built and what gets cut. Full product spec (architecture, data
  model, roadmap): https://claude.ai/code/artifact/a3627558-f209-4a0a-86dd-72c5e91e015d
- **State**: M0 fog prototype, M1 solo tracker (GPS trails, SQLite
  persistence, place notes), and M2 core (background "Auto" tracking,
  share-map-PNG) are done and verified on the iOS simulator. Auth/Supabase
  sync deliberately deferred — core features first.
- **Stack**: Expo dev-client (not Expo Go) + @maplibre/maplibre-react-native
  v11 (new API: Map/GeoJSONSource/Layer) + h3-js (res 9 cells) + expo-sqlite
  + expo-location/expo-task-manager. Tiles: OpenFreeMap `liberty` style.
- **Gotchas**:
  - CocoaPods needs `LANG=en_US.UTF-8` or it crashes with an encoding error.
  - h3-js needs the utf-16le TextDecoder shim in `src/polyfills.ts`, which
    must stay the FIRST import in `index.ts` (Hermes lacks utf-16le; the npm
    `text-encoding` polyfill silently re-exports the native decoder — don't).
  - Benign MapLibre "Invalid geometry in line layer" warning comes from the
    world-spanning fog polygon; ignore it.
  - Simulator testing: `xcrun simctl privacy booted grant location-always
    com.qle1095.explora`, then `xcrun simctl location booted start --speed=25
    lat,lng lat,lng ...` to simulate walks.
