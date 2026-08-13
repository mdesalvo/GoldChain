# CLAUDE.md

This file orients Claude (or any future contributor) working on this
repository. Read it before making changes.

## What this project is

**GoldChain** is a satirical tycoon/idle game. A society of
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
Backdrop        concept art            painted still, state badges pinned on it
Simulation      Miniplex (ECS)         fixed-tick (15Hz) pipeline + monkey FSM
Events Engine   XState (v5)            strikes, breakdowns, mafia raids, laws
```

The screen is the concept art, full window, with every panel laid over
it in the place the concept put it. Nothing animates: what changes is
data being written into a panel, plus one state change (the set drains of
colour when the tribute fails) — see the note on the news ticker below
for the one deliberate exception.

There used to be a fourth layer here: a React Three Fiber 3D view of
the same simulation (instanced capsule meshes, colour-coded by role),
reachable behind a toggle. It was cut (commit `1bf42e6`) because the
toggle exposed placeholder capsule rendering rather than replacing
anything — `src/render/` no longer exists. If a real 3D view is ever
built, it is a fresh effort, not a resumption of that one.

### Why these choices

- **Miniplex (ECS)**, not a class hierarchy per role: hundreds of
  monkey agents need to be queried and updated in bulk every tick
  (`world.with("role").where(...)`). ECS keeps that cheap and keeps
  role-specific logic composable instead of a deep inheritance tree.
- **Fixed-tick simulation loop**, decoupled from render framerate:
  see `src/simulation/useGameLoop.js`. This uses the standard
  accumulator pattern so the economy simulation is deterministic
  regardless of device performance or tab throttling. **Never** put
  simulation logic (pipeline throughput, state transitions, coin
  delivery) inside a `requestAnimationFrame` callback — that ties
  economy balance to framerate, which is a bug, not a feature. (A
  small rAF loop is fine for something purely cosmetic with no
  gameplay weight — see `NewsTicker.jsx` — as long as it never reads
  or writes simulation state.)
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
| `src/state/useGameStore.js` | Global game state: coins delivered, current/target rate, deity mood, worker wellbeing, corruption, political stability, notifications and the persistent news log |
| `src/simulation/world.js` | ECS world, role definitions, entity spawning, reusable queries, `STAGE_LABEL` (the canonical human-facing name for each pipeline role) |
| `src/simulation/pipeline.js` | Bucket-chain economy model: per-stage throughput, buffers, corruption drain |
| `src/simulation/tick.js` | One simulation tick, free of React so `scripts/simulate.mjs` can run it headless; also builds the per-stage `roleHints` (which system is why a stage needs attention) |
| `src/simulation/useGameLoop.js` | Fixed-tick driver (15Hz) that steps the simulation and feeds results into the store |
| `src/simulation/playerActions.js` | Everything the player can do, priced against the reserve |
| `src/events/eventsEngine.js` | Owns one XState actor per disruption type; the only thing that turns machine state into pipeline modifiers, notifications and one-shot health deltas |
| `src/ui/theme.css` | Design tokens and every UI style. No inline styles |
| `src/App.jsx` | Composes every panel onto the fixed 1376x768 design space, in the concept-pixel position the concept's own UI occupied |
| `src/ui/Set.jsx` | The concept backdrop, drawn untouched, plus the state badges pinned on it |
| `src/ui/BrandPanel.jsx` | Title plate and the current-flow / flow-target readout |
| `src/ui/SystemRail.jsx` | Left rail: one card per societal system, with its actions |
| `src/ui/StageStrip.jsx` | The five pipeline stage cards plus the reserve card |
| `src/ui/AlertBox.jsx` | Flow alert and the Deity's mood/wrath readout |
| `src/ui/NewsTicker.jsx` | Bottom news crawl over the last few headlines |
| `src/ui/parts.jsx` | Shared small components: `Meter`, `ActionButton`, `Popup`, `Icon` |

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
- **`src/ui/` reads the store and the ECS; it never writes simulation
  state.** All state changes go through `useGameStore` actions or the
  ECS/`playerActions.js`, never a direct mutation from a component.
- **UI styling goes in `src/ui/theme.css`, via tokens.** Inline styles
  are what made the first HUD look like a debug overlay: no shared type
  scale, no consistent spacing, no hierarchy.
- **Player-facing role names go through `STAGE_LABEL`** (`world.js`),
  never the raw `ROLES.*` slug. Four of the five read fine as raw
  words in a sentence ("a miner", "the smelter line"); the payer
  doesn't — nothing else in the game ever calls that stage anything
  but "Delivery", so a raw `"payer"` leaking into a notification reads
  as a role that got cut, not the one it actually is.

## What's implemented vs. planned

Implemented:
- Project structure (ui / simulation / events / state layers — no
  separate render layer; see the Architecture note above)
- ECS world with all pipeline + societal roles
- Fixed-tick simulation loop; tick body lives in
  `src/simulation/tick.js`, free of React, so it can run headless
- Bucket-chain economy with finite per-stage buffers (backpressure)
  and a **reserve** the Deity is paid out of at exactly the demanded
  rate — surplus banks up, a stoppage is survivable while it lasts.
  Backpressure genuinely cascades: block any one stage long enough and
  every buffer behind it fills in turn, stage by stage, until nothing
  in the whole chain is moving — Delivery is the one stage where this
  matters most, since it's the only stage with nothing after it but
  the reserve itself.
- **Events engine** — one XState machine per disruption type
  (strike, breakdown, mafia raid, legislation), stepped by explicit
  `TICK` events
- Medical system (accidents remove monkeys from the workforce,
  shared treatment capacity puts them back)
- Societal drift: each health score seeks an equilibrium set by
  headcount in the non-productive roles
- Deity mood, wrath, and a quota ratchet
- HUD: tribute, reserve, systemic meters, per-stage chain readout,
  live systems panel, notification popups per system card, plus a
  persistent bottom news ticker (`NewsTicker.jsx`) that never expires
  the way the per-card popups do
- Per-stage cause hints: a small colour dot on a stage card naming
  *which* system is behind its current state (union, breakdown, mafia,
  medical) — separate from the jam/blocked border, which only says
  *that* something is wrong
- Contextual tooltips on every role, institution, and HUD readout
  (stage cards, `SystemRail` cards, Deity mood, current/target flow)
  explaining the mechanic in one hover, in place of leaving the player
  to infer it from a bare number
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
- A live 3D/animated view of the simulation. One existed (React Three
  Fiber, instanced capsule meshes) and was removed — see the
  Architecture note above — so this would be new work, not a
  continuation, and should not assume anything about the old
  `src/render/` layout.
- Pathfinding/movement between pipeline stages
- Deity reaction system (visual/audio feedback tied to mood)
- Save/load, difficulty tuning, win/loss conditions

## Art

`public/art/` and `src/ui/artRegions.js` are now **hand-maintained**.
They used to be generated by `scripts/extract-art.py` (crop boxes and
hotspot anchors picked by eye against `art-source/GoldChain.jpg`), but
that script has been removed — there is currently no tooling that
regenerates these from the source art. If a crop or a hotspot anchor
needs to change, edit the files under `public/art/` and the anchors in
`src/ui/artRegions.js` directly, in concept pixels, keeping the two in
sync by hand (a crop change not mirrored in `artRegions.js` puts a
badge somewhere other than where it belongs). `DESIGN` in that file
must keep matching the actual backdrop image's pixel dimensions.

`art-source/` (the concept still, and a 5.9s animated version of the
same frame) is reference material only now — nothing reads it at build
or dev time. It's kept out of `public/`, which is copied verbatim into
the build and served, deliberately: neither file should ship.

The backdrop actually loaded at runtime is `public/art/backdrop2.jpg`
(see `Set.jsx`, `theme.css`).

### The set is the window

Three earlier layouts tried to make our panels fit around the concept's
own painted-in UI — cropping the backdrop into a pane, or painting over
the regions the concept's own UI occupied — and every one of them showed:
a cropped plate in a pane lost both the side rails' width and every
region the concept's UI had been sitting on, flat-colour fills left dead
bands wherever a responsive panel didn't land exactly on the concept's
fixed-layout footprint, and mirroring the neighbouring art duplicated the
picket signs and the salary placard, reversed lettering and all.

The fix was to stop treating it as an image problem. The screen is now a
fixed 1376x768 design space (`.design` in `theme.css`), scaled as one
piece to whatever window it's given — never cropped, never retouched.
`useDesignScale()` (`src/ui/Screen.jsx`) computes that scale factor as
`min(window / design)` so the whole picture is always visible, and
`App.jsx` applies it as the `--design-scale` CSS variable. Every panel
is positioned with plain concept-pixel coordinates (the `.at--*` classes
in `theme.css`) in the exact spot the concept's own UI occupied, so ours
lands on theirs at every window size and the artwork needs no retouching
at all — leftover space around the fixed box is filled by a blurred
bleed of the same artwork (`.bleed`), not by cropping.

`Set.jsx` renders the backdrop image plus the state badges pinned on it,
at plain concept-pixel coordinates too — no percentage conversion needed
at render time, because everything downstream of `artRegions.js` (itself
generated, in concept pixels) is already inside the same fixed coordinate
space that `--design-scale` scales as one piece.

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
If motion on the painted set is ever revisited, the measurements above
are the bar it has to clear.

One genuine exception since: the news ticker (`NewsTicker.jsx`) does
scroll continuously, along the bottom edge — the one region of the fixed
design space the concept's own art left empty, below the stage strip and
reserve card. It's driven by a small `requestAnimationFrame` loop with a
clamped per-frame delta (the same technique `useGameLoop` uses for the
sim clock), not a CSS `animation`: a wall-clock CSS animation has no way
to avoid snapping forward after the tab spends time occluded, and a
percentage-based or guessed-fixed keyframe target retargets — and
visibly stutters — every time the headline text underneath it changes
width. The loop only ever writes a `transform` to one element; nothing
it does reads or writes simulation state.

## Working on this repo

- Run `npm install && npm run dev` to start the dev server.
- `?skip=180` fast-forwards 180 simulated seconds before the first
  paint (dev builds only). A fresh game shows every meter at its
  starting value, which is the one state that tells you nothing about
  whether the UI works.
- Run `npm run build` before committing any change that touches
  `src/simulation/` or `src/events/` — it's the fastest way to catch
  broken imports across module boundaries.
- When adding a new monkey role: add it to `ROLES`, decide whether it
  belongs in `PIPELINE_ORDER` (direct production chain) or is purely
  systemic (unions/police/politics/medical), and add its count to
  `seedInitialPopulation()` in `world.js`. If it's a pipeline role,
  also add it to `STAGE_LABEL` (`world.js`) — every place a role name
  reaches the player goes through that map, not the raw `ROLES.*`
  slug.
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
