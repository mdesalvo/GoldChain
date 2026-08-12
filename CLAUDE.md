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
Miners -> Transporters -> Smelters -> Minters -> Payer -> [The Deity]
```

Five stages, matching the concept art's own five (MINES, TRANSPORT,
SMELTERS, MINTS, DELIVERY) rather than a finer-grained chain: earlier
versions split transport into hauler/driver and minting into
goldsmith/banker/teller, which put eight roles on screen where the
concept draws five and made no visible difference to the player.

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
UI Layer        React + CSS            panels over a full-window painted set
Render Layer    concept art            painted backdrop, state pinned on it
                React Three Fiber      live 3D view, behind a toggle
Simulation      Miniplex (ECS)         fixed-tick (15Hz) pipeline + monkey FSM
Events Engine   XState (v5)            strikes, breakdowns, mafia raids, laws
```

The screen is the concept art, full window, with every panel laid over
it in the place the concept put it. Nothing animates: what changes is
data being written into a panel, plus one state change (the set drains of
colour when the tribute fails).

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
| `src/simulation/playerActions.js` | Everything the player can do, priced against the reserve |
| `src/ui/theme.css` | Design tokens and every UI style. No inline styles |
| `src/ui/Viewport.jsx` | Centre pane: painted backdrop, hotspots, stage cards, 3D toggle |
| `src/ui/SystemRail.jsx` | Left rail: one card per societal system, with its actions |
| `src/ui/AlertRail.jsx` | Right rail: flow alert, deity mood/wrath, reserve, event feed |
| `src/render/Scene.jsx` | R3F canvas, lighting, camera, ground plane |
| `src/render/components/MonkeyPopulation.jsx` | Instanced-mesh rendering of all monkey entities, color-coded by role |

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
- **DOM UI lives in `src/ui/`, R3F lives in `src/render/`.** The two
  never import from each other. Both read the store and the ECS; neither
  writes simulation state.
- **UI styling goes in `src/ui/theme.css`, via tokens.** Inline styles
  are what made the first HUD look like a debug overlay: no shared type
  scale, no consistent spacing, no hierarchy.
- **Rendering is disposable, simulation is not.** The current
  capsule-mesh monkeys are explicitly placeholder art. Do not couple
  simulation logic to render implementation details (e.g. don't put
  gameplay state on Three.js objects) so the render layer can be
  fully replaced without touching `src/simulation/`.

## What's implemented vs. planned

Implemented:
- Project structure (render / simulation / state layers)
- ECS world with all pipeline + societal roles
- Fixed-tick simulation loop; tick body lives in
  `src/simulation/tick.js`, free of React, so it can run headless
- Bucket-chain economy with finite per-stage buffers (backpressure)
  and a **reserve** the Deity is paid out of at exactly the demanded
  rate — surplus banks up, a stoppage is survivable while it lasts
- **Events engine** — one XState machine per disruption type
  (strike, breakdown, mafia raid, legislation), stepped by explicit
  `TICK` events
- Medical system (accidents remove monkeys from the workforce,
  shared treatment capacity puts them back)
- Societal drift: each health score seeks an equilibrium set by
  headcount in the non-productive roles
- Deity mood, wrath, and a quota ratchet
- Instanced 3D rendering, colour/pose reflecting monkey state
- HUD: tribute, reserve, systemic meters, per-stage chain readout,
  live systems panel, notification feed
- Headless balance harness: `npm run sim -- <minutes> [seed]`

- Player actions (`src/simulation/playerActions.js`): negotiate, lobby
  for/against a bill, crack down, investigate, retrain workers between
  chain and societal roles, emergency pay. Every action is paid for out
  of the reserve — the same reserve the Deity is paid from — so funding
  the society is always coin that does not reach the Deity.
- Strategy harness: `npm run sim -- <min> <seed> watch|invest|exploit`

**Known balance gap (measured, not guessed):** over 40 minutes, doing
nothing (`watch`) currently beats both investing and exploiting, and
ends with the Deity delighted. The design tension is in the code but
not yet in the numbers — the default population is comfortable enough
that disruptions never really threaten. Deciding whether the player
should *start* under-resourced (so the systemic layer bites from
minute one) or start comfortable and be squeezed by the quota ratchet
is an open design call, not a tuning detail.

Planned, not yet built:
- **Concurrent laws**: the legislation machine holds one law at a
  time; the mockup shows a stack of active laws with numeric
  parameters (tax %, minimum wage), which means one actor per law.
- Real monkey models/animations for the 3D view (currently colored
  capsules, reachable via the viewport's 3D toggle)
- Pathfinding/movement between pipeline stages
- Deity reaction system (visual/audio feedback tied to mood)
- Save/load, difficulty tuning, win/loss conditions

## Art

`public/art/` and `src/ui/artRegions.js` are generated — never edit either
by hand. Run:

```
python3 scripts/extract-art.py
```

Sources live in `art-source/`: the concept still, and a 5.9s animated
version of the same frame kept for reference. They are deliberately *not*
under `public/`, which is copied verbatim into the build and served.

The script is the single source of truth for the crop boxes, all of which
were picked by eye. It also emits `artRegions.js` — the backdrop's aspect
ratio and the hotspot anchors as percentages — because the hotspots are
positioned relative to the backdrop crop, and a crop change that wasn't
mirrored in the percentages would silently put the strike badge somewhere
other than the picket line. Anchors are declared in concept pixels; the
conversion is the script's job, not a human's.

### Painting out the concept's UI

Their panels are opaque, so there is no art under them to recover. Each
footprint is filled by stretching a thin slice of the adjacent art, then
blurring and dimming it. Two other fills were tried and both failed
visibly: flat colour left a dead band wherever our responsive panels
didn't land exactly on their fixed-layout footprints, and mirroring the
neighbouring art duplicated the picket signs and the salary placard,
reversed lettering and all.

Check the backdrop's edges after any change to `CONCEPT_UI`.

### The set is the window

The backdrop is the whole concept image, drawn `cover` behind everything,
with the regions the concept's own UI occupied painted back out. Our
panels go where theirs were. That is the only layout in which the art gets
the whole window rather than whatever the side rails leave over — a
cropped plate in a pane lost both the rails' width and every region their
UI had been sitting on.

Because it is drawn `cover`, a percentage of the image is not a percentage
of the window: `Backdrop.jsx` converts, and re-converts on resize. Badge
anchors come from `artRegions.js`, which is generated.

The R3F scene is still the honest view of the simulation — every capsule
is a real entity — behind the toggle in the clock bar.

### Nothing animates

Three rounds of animation were cut from the clip and all three were
removed after looking at the result:

- **System plates and stage thumbnails.** In a 250×110 card at 22%
  opacity behind text, or a 34px-tall thumbnail, the motion is fast, tiny
  and illegible. It read as flicker. ~840K of payload for a worse result
  than the stills.
- **The full backdrop.** The generative pass garbled every sign in the set
  (MONKEY WORKERS UNION → "MUNKEY WURKERS UNIUN", POLICE → "POLIOE") and
  dropped the Deity's salary placard along with the UI. The still is the
  more readable backdrop even though it doesn't move.
- **The conveyor, as video overlaid on the still.** Registering the clip
  against the still over the belt region gives a scale of 1.000 and a 2px
  offset, so the two are not misaligned: the clip simply *redrew* the
  belt, its coins and its rails in different places (MAD 22.8 after
  optimal registration, against 31 unregistered). No transform reconciles
  two different drawings, and the mismatch shows as a doubled rail.

Emphasis on the stills is CSS instead: framing, gradients, glows, hover,
and state colour. The one thing that changes over time is a *state*
change, not a loop — the set drains of colour when the tribute fails,
driven by `flowMet` in the 5Hz snapshot so it costs no extra re-renders.
If motion is ever revisited, the measurements above are the bar it has to
clear.

## Working on this repo

- Run `npm install && npm run dev` to start the dev server.
- `?skip=180` fast-forwards 180 simulated seconds before the first
  paint (dev builds only). A fresh game shows every meter at its
  starting value, which is the one state that tells you nothing about
  whether the UI works.
- Run `npm run build` before committing any change that touches
  `src/simulation/` or `src/render/` — it's the fastest way to catch
  broken imports across the ECS/render boundary.
- When adding a new monkey role: add it to `ROLES`, decide whether it
  belongs in `PIPELINE_ORDER` (direct production chain) or is purely
  systemic (unions/police/politics/medical), add its color to
  `ROLE_COLORS` in `MonkeyPopulation.jsx`, and add its count to
  `seedInitialPopulation()` in `world.js`.
- When adding a disruption, add a machine under
  `src/events/machines/` exporting four things — the machine, a
  `describe*`, a `*Modifiers` and a `*Transition` — then register it
  in `REGISTRY` in `eventsEngine.js`. Machines must be driven by the
  engine's `TICK` event and never use XState's `after` delays:
  wall-clock timers would tie disruption timing to render
  performance, which the fixed-tick loop exists to prevent.
- Machines must not touch buffers, entities or the store. They change
  their own state; the engine translates state into modifiers. If a
  machine needs to hurt somebody, it says so in its transition result
  and the engine does it.
- Use the seeded RNG in `src/simulation/rng.js`, never `Math.random`,
  so a seed replays identically for balance work.
- Never call `world.with(...).where(...)` inside the tick — it creates
  and registers a new derived bucket every call. Use `byRole()` from
  `world.js` (cached), and remember predicate buckets go stale on
  in-place mutation, which is why state lookups (`withState`) filter
  instead.
- When adding a new disruption/event type, prefer modeling it as a
  state machine that can **block** one or more pipeline roles (via
  the `blockedRoles` modifier already threaded through
  `stepPipeline()`) rather than mutating buffers or throughput
  directly from event code — keeps the economy model the single
  source of truth for how gold actually moves.
