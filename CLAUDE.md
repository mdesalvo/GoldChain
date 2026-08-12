# CLAUDE.md

This file orients Claude (or any future contributor) working on this
repository. Read it before making changes.

## What this project is

**GoldChain** is a satirical 3D tycoon/idle game. A society of
monkeys exists for a single purpose: deliver exactly **1 coin per
second** to a deified, astronomically-paid celebrity (the "Deity").
The player's job is to keep that number steady against strikes,
mechanical breakdowns, mafia sabotage, political upheaval, and the
Deity's inevitable wrath when the flow stops.

The satire is the point: an entire civilization's infrastructure
exists to protect a single uptime metric for someone who contributes
nothing back. Keep that tension in mind when adding features — the
tone is playful/cartoonish on the surface, pointed underneath.

## Production chain (the core loop)

```
Miners -> Haulers -> Smelters -> Goldsmiths -> Drivers
   -> Bankers -> Tellers -> Payer -> [The Deity]
```

Each stage is a monkey role. Gold flows through the chain and exits
as coins delivered to the Deity. See `PIPELINE_ORDER` in
`src/simulation/world.js` — it is the source of truth for stage
ordering; do not hardcode the chain elsewhere.

## Societal layer (systemic, not on the direct chain)

- **Unionizers** — represent worker rights. Ignoring worker
  wellbeing for too long should trigger strikes that block one or
  more pipeline stages.
- **Politicians** — legislate; intended to modify game rules at
  runtime (taxes, safety regulations, quotas).
- **Doctors / Nurses** — treat injuries (mine collapses, furnace
  accidents). An understaffed hospital should bottleneck the
  available workforce.
- **Police vs. Mafiosi** — security layer. Weak policing should let
  corruption siphon gold out of mid-chain buffers.

These systems are intentionally **not** implemented as a simple
"more is better" resource sink. The intended design tension is a
trade-off: investing in worker wellbeing/security slows short-term
throughput but prevents systemic collapse; neglecting it maximizes
short-term coin flow but makes the system fragile. Preserve this
trade-off when extending the systemic layer — don't turn it into a
strict upgrade tree.

## Architecture

```
UI Layer        React + Zustand        HUD, deity mood, notifications
Render Layer    React Three Fiber      3D scene, instanced monkey meshes
Simulation      Miniplex (ECS)         fixed-tick (15Hz) pipeline + monkey FSM
Events Engine   (planned: XState)      strikes, breakdowns, mafia raids, laws
```

### Why these choices

- **React Three Fiber**, not raw Three.js or Babylon: the game has
  as much UI/HUD surface (coin counters, event notifications, deity
  mood, systemic dashboards) as 3D scene, and R3F lets both live in
  the same component tree with shared state.
- **Miniplex (ECS)**, not a class hierarchy per role: hundreds of
  monkey agents need to be queried and updated in bulk every tick
  (`world.with("role").where(...)`). ECS keeps that cheap and keeps
  role-specific logic composable instead of a deep inheritance tree.
- **Fixed-tick simulation loop**, decoupled from render framerate:
  see `src/simulation/useGameLoop.js`. This uses the standard
  accumulator pattern so the economy simulation is deterministic
  regardless of device performance or tab throttling. **Never** put
  simulation logic (pipeline throughput, state transitions, coin
  delivery) inside a `useFrame` render callback — that ties economy
  balance to framerate, which is a bug, not a feature.
- **Zustand**, not Redux: the global state surface (coin rate, deity
  mood, systemic health scores) is small and flat; Zustand avoids
  boilerplate for what is fundamentally a handful of numbers read by
  many components.
- **Plain JavaScript**, not TypeScript: deliberate choice for this
  stage of the project, prioritizing prototyping speed. Revisit this
  if/when the codebase and team grow — it was an explicit trade-off,
  not an oversight.

## Key files

| File | Responsibility |
|---|---|
| `src/state/useGameStore.js` | Global game state: coins delivered, current/target rate, deity mood, worker wellbeing, corruption, political stability |
| `src/simulation/world.js` | ECS world, role definitions, entity spawning, reusable queries |
| `src/simulation/pipeline.js` | Bucket-chain economy model: per-stage throughput, buffers, corruption drain |
| `src/simulation/useGameLoop.js` | Fixed-tick driver (15Hz) that steps the simulation and feeds results into the store |
| `src/render/Scene.jsx` | R3F canvas, lighting, camera, ground plane |
| `src/render/components/MonkeyPopulation.jsx` | Instanced-mesh rendering of all monkey entities, color-coded by role |
| `src/render/components/Hud.jsx` | Overlay showing coins delivered, rate vs. target, streak, deity mood |

## Conventions

- **Roles** are always referenced via the `ROLES` constant in
  `src/simulation/world.js`, never as raw strings, to avoid typos
  silently breaking pipeline queries.
- **Simulation state lives in ECS/Zustand, not in React component
  state.** Components read from `world` (via Miniplex queries) and
  `useGameStore`; they should not hold their own copies of
  simulation data.
- **Numeric balance values** (throughput, wellbeing factors, mood
  deltas) are currently placeholders (see `BASE_THROUGHPUT` in
  `pipeline.js`). They exist to make the loop testable end-to-end,
  not as final game balance — expect them to change significantly
  once the events engine and real playtesting arrive.
- **Rendering is disposable, simulation is not.** The current
  capsule-mesh monkeys are explicitly placeholder art. Do not couple
  simulation logic to render implementation details (e.g. don't put
  gameplay state on Three.js objects) so the render layer can be
  fully replaced without touching `src/simulation/`.

## What's implemented vs. planned

Implemented:
- Project structure (render / simulation / state layers)
- ECS world with all pipeline + societal roles
- Fixed-tick simulation loop with a basic bucket-chain economy model
- Instanced 3D rendering of the monkey population
- Minimal HUD (coins delivered, rate, streak, deity mood)

Planned, not yet built:
- **Events engine** (strikes, breakdowns, mafia raids, legislation) —
  intended to be built with XState, modeling each disruption as an
  explicit state machine (e.g. strike: `brewing -> active ->
  negotiating -> resolved`) rather than ad-hoc flags. This is the
  next major piece of work and the actual "game" layer on top of the
  economic simulation.
- Real monkey models/animations (currently colored capsules)
- Pathfinding/movement between pipeline stages
- Deity reaction system (visual/audio feedback tied to mood)
- Save/load, difficulty tuning, win/loss conditions

## Working on this repo

- Run `npm install && npm run dev` to start the dev server.
- Run `npm run build` before committing any change that touches
  `src/simulation/` or `src/render/` — it's the fastest way to catch
  broken imports across the ECS/render boundary.
- When adding a new monkey role: add it to `ROLES`, decide whether it
  belongs in `PIPELINE_ORDER` (direct production chain) or is purely
  systemic (unions/police/politics/medical), add its color to
  `ROLE_COLORS` in `MonkeyPopulation.jsx`, and add its count to
  `seedInitialPopulation()` in `world.js`.
- When adding a new disruption/event type, prefer modeling it as a
  state machine that can **block** one or more pipeline roles (via
  the `blockedRoles` modifier already threaded through
  `stepPipeline()`) rather than mutating buffers or throughput
  directly from event code — keeps the economy model the single
  source of truth for how gold actually moves.
