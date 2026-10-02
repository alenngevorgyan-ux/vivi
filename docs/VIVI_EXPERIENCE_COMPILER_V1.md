# Vivi Experience Compiler — v1

A model writes a few hundred tokens of [DSL](VIVI_EXPERIENCE_DSL_V1.md). The
compiler turns that into a staged, lit, scored, playable scene, deterministically.

## One pipeline

```text
story ─ preprocess ─┬─ semantic provider (Gemini today) ─┐
                    └─ deterministic fallback ───────────┴─ DSL ─ validate (≤1 repair)
  ─ ExperienceCompiler ─ ExperiencePlan ─ CanonicalScenario ─ StoredPlayablePost ─ ViviPlay
```

[`compileViviStory()`](../src/engine/compiler/compileViviStory.ts) is the whole
pipeline: pure, React-free, the boundary a future MCP tool would expose.
`server.ts` calls it; the curated golden stories call the same compiler through
`compileHeroStoryToRuntime`. Before this pass there were three unrelated paths
(Gemini writing a verbose ExperiencePlan, a separate deterministic plan
builder, hand-authored hero adapters). Legacy posts and GameSpecs still load
through compatibility adapters.

## What the model decides — and what it does not

| Model decides | Compiler derives |
|---|---|
| world, grammar, tone | player spawn, every person's position, routes around furniture |
| who is there and how (in room / remote / background) | characters, seats, who stands at a role's natural place |
| key objects | where each object sits, whether it is a prop or the player's own phone |
| events, in order | all timing: setup, cue, development, pressure, follow-ups |
| 2–4 commitments: verb + target + short copy | standing spots, radii, de-duplication, labels for walking up |
| optional camera grammar / staging / lighting | every shot, door, sound bed, light grade, insert, silence |
| — | truth provenance (from the author only) |

## Preprocessing

[`preprocess.ts`](../src/engine/compiler/preprocess.ts) extracts cheap hints
with EN/RU/HY keyword stems: language, likely world and grammar, who is
mentioned (and who only by phone), objects, a clock time, a quoted line,
minutes of pressure. A model receives them as one line (`HINTS: lang=en
world~station grammar~departure people=ex(remote) objects=phone,train`); the
fallback builds a whole program from them.

## Timeline

Each grammar ([`grammars.ts`](../src/engine/compiler/grammars.ts)) supplies
setup / cue / pressure times, spacing, development delay, phone lock, sound
restraint, interaction reach, pressure dim and reveal hold. Events are
classified as setup (`exit`, `enter`, `sound`), cue (`msg`, `call`, `notice`,
`say`, `echo`) or pressure (`stop`, `handle`, `open`, `approach`, `stare`,
`countdown`, `arrive`, `light`…); the first cue-class event lands at the cue,
the first pressure-class event at pressure, the rest are spaced around them.
Two refinements make it feel authored: a sound that follows someone leaving
through a door starts once they are behind it, and a handle moves one second
after the water stops, a door five seconds after that.

## One event, many effects

| DSL | Compiles to |
|---|---|
| `exit partner bathroom` | walk cue along a nav route, door opens on arrival and closes behind, `npc_exit` camera event, an `exitedThrough` record |
| `sound shower` | ambient bed change |
| `msg phone "…"` | screen text, buzz, phone lock countdown (grammar), key object active, `object_active` camera event |
| `stop shower` | bed fades to room tone, `silence` camera event, and — if the grammar says people return — handle, door, re-entry into the lit doorway, `npc_enter` |
| `say boss "…"` | timed subtitle, talk cue, every background figure turns to the speaker, `speech` camera event |
| `elevator empty` | floor count 6→9, ding, doors part onto an empty lit car, `silence` |
| `arrive train` | the train slides in, doors lit, train bed, `arrival` camera event |
| `stare crowd` | every background figure turns to the player, `stare` camera event |
| `echo photo` | glint, `memory` camera event, and MEMORY_ECHO when the player reaches it |

Modifiers carry structured `data`; the ModifierEngine never infers meaning
from display text for compiled scenes (authored legacy modifiers keep the old
text interpretation).

## People: the actor runtime

[`actors.ts`](../src/engine/runtime/actors.ts). Any number of actors, each
`primary`, `secondary` or `background`, driven by semantic cues (`walk_to`,
`exit`, `enter`, `turn_to`, `look_at`, `sit`, `stand`, `talk`, `wait`,
`hesitate`). Position, pose and facing are a **pure function of scene time**:
eased starts and stops, a walk cycle advanced by distance. Background figures
sit or watch and turn to whoever is speaking, to a stare, or to a player who
comes within 13 units. People are solid for the player.

Legacy single-`npc` scenes are adapted into the same runtime once
([`scenarioActors.ts`](../src/engine/runtime/scenarioActors.ts)); there is one
actor system for heroes, generated posts and old posts. The Presentation's
presenter, director and three colleagues are actors — no longer art.

## Navigation

[`navigation.ts`](../src/engine/runtime/navigation.ts): a 1.5-unit occupancy
grid from the world's collision boxes (inflated by the figure radius), A*
without corner cutting, line-of-sight string pulling into two or three straight
legs, and authored semantic paths that win when their legs stay clear.
Collision boxes were redrawn to trace the furniture actually painted in each
world. The eval harness checks every compiled route for collisions and
reachability.

## Staging

Role slots first (a boss at the head of the table, a presenter at the screen),
then: someone about to leave stands partway along the line they will walk;
others are placed by the staging preset relative to the player; background
figures take the world's seats. Every mark is snapped to walkable floor, kept
off the story's objects and off other people.

## Camera

[`director.ts`](../src/engine/cinematic/director.ts) picks a shot every frame
from game state, by precedence: reveal → commit → an inspection insert → the
grammar's opening (the only time control is held, < 4.2 s) → the latest camera
event still in its window → commit-available → pressure → explore. Six camera
grammars map event kinds to the existing eleven presets. Authored legacy scenes
keep their shot lists through the same function.

## Light and sound

Lighting profiles grade the frame outside the camera: tint, base darkness,
vignette, extra darkness under pressure, flicker, and a warm shift during a
memory echo. Each world has a base bed (room tone, ventilation, office hum,
crowd, station air, rain, evening air); events swap beds and fire one-shots.
Grammar `soundRestraint` lowers beds. Audio is created only after the first
real gesture; mute never starts sound.

## Commitments

Target an object → its host slot (or the player's own hand: a carried phone is
usable anywhere, but any spot in the room wins); a person → the action follows
that person, and while they are behind a door it reads as that door; a place →
that place; nothing → a verb default (wait → somewhere to sit, leave → the way
out, return → the stairs). Two commitments never share a spot; the later one is
moved and relabelled. Walking-up labels are derived in the story's language;
commit labels, observations and outcomes come from the DSL.

## Key objects and MEMORY_ECHO

Loose objects (phone, envelope, photo, document, letter, ticket, keys, bag,
laptop) are drawn as small props that glow when active; architecture (screens,
boards, doors, intercoms, elevators) is already in the art. An `echo` object
plays MEMORY_ECHO when reached: the grade warms and drops, the player and the
remembered person stand at the object as translucent figures for 3.6 s, the
observation holds, and they dissolve.

## Provider contract

[`modelContract.ts`](../src/engine/compiler/modelContract.ts): ~730-token system
prompt generated from the vocabulary (task, shape, enums, truth rules — no world
data). User turn: the story and the hint line; the author's real outcome is
never sent. [`provider.ts`](../src/engine/compiler/provider.ts):
`ExperienceSemanticProvider` with `compileStory` and optional `repair`. Gemini
lives in [`src/server/geminiProvider.ts`](../src/server/geminiProvider.ts).

Retry policy: one repair turn with only the invalid DSL and its errors; then the
deterministic fallback. Provider errors fall back too; the post records a short
reason. Semantic results are cached by normalised story + provider; the compiler
re-runs on every request, so cached programs pick up compiler improvements.

## The deterministic fallback

[`deterministicProvider.ts`](../src/engine/compiler/deterministicProvider.ts)
chooses grammar and world from the hints, then a grammar recipe writes events
and commitments with localized labels (EN/RU, partial HY). It is generic by
design — it cannot read a story — but it always stages the right kind of room
with the right objects and physically sensible choices, through the same
compiler.

## Tools

- **Director Lab** (`?lab`, dev only): story → hints → DSL (bytes, estimated
  tokens, source) → compiler decisions → plan → scenario; deterministic frozen
  snapshots at any moment with collision, routes, director reasoning, actors,
  light, sound and beat state; "Play live".
- `npm run eval` — 36 corpus stories + 3 golden fixtures through the pipeline,
  checked for world, objects, slots, 2–4 commitments, truth safety, coordinate
  freedom, actor and event references, collision-free reachable routes, camera
  resolution, mobile-safe spots, structured modifiers, beats.
- `npm run bench` — DSL size, estimated vs (with `--live`) actual tokens,
  compiled size, compile time.
- `npm test` — design contracts, runtime hardening, 21 compiler test groups, eval.

## Known limits

- The deterministic fallback is generic: titles, labels and lines come from
  templates; some stories land in the nearest world rather than the right one
  (an exam in an apartment). A model is what makes generated scenes specific.
- No live model usage has been measured here (the key in this environment is
  not a valid Gemini API key); all token figures are estimates.
- Only the apartment, hallway and office have deep art; the station gained a
  train and a live board, other worlds are structural.
- Actors do not avoid the player while walking (paths are planned against
  furniture and seated people only); the player cannot walk through them.
