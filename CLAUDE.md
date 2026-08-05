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
  v11 (new API: Map/GeoJSONSource/Layer) + h3-js (res 10 cells) + expo-sqlite.
  Fog visuals are circle sweeps (polygon-clipping union of 130m vision
  circles along trails/visits) — H3 cells remain the stats/sync record only.
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


## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately - don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update 'tasks/lessons.md' with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes - don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests -> then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management
1. **Plan First**: Write plan to 'tasks/todo.md' with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review to 'tasks/todo.md'
6. **Capture Lessons**: Update 'tasks/lessons.md' after corrections

## Core Principles
- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
 