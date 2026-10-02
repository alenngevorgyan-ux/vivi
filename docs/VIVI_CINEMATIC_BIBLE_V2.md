# VIVI — cinematic bible v2

v1 described a shot grammar the runtime did not execute: the cues were authored,
the camera never moved. This document covers what the engine now actually does.

## The camera language

[`cameraLanguage.ts`](../src/engine/cinematic/cameraLanguage.ts) defines eleven
presets. Each one fixes a subject, a zoom, where the subject sits in frame, how
long the move takes, its easing, whether the player keeps control, and the safe
zone the interface must stay inside.

| Preset | Subject | Zoom | Framing | Duration | Control |
|---|---|---:|---|---:|---|
| ESTABLISHING_WIDE | world | 1.00 | .50 / .52 | 2000 | locked |
| SOFT_FOLLOW | player | 1.14 | .44 / .60 | 1400 | free |
| TWO_SHOT | midpoint | 1.20 | .50 / .56 | 1500 | free |
| OBJECT_INSERT | slot | 1.78 | .50 / .48 | 1250 | locked |
| OVER_SHOULDER | player | 1.50 | .38 / .62 | 1300 | locked |
| STATIC_TENSION | midpoint | 1.10 | .50 / .54 | 1800 | free |
| SLOW_PUSH_IN | slot | 1.16 → 1.44 | .50 / .50 | 2600 | free |
| WIDE_SILENCE | world | 0.98 | .50 / .50 | 2400 | free |
| NPC_EXIT | npc | 1.12 | .58 / .56 | 1700 | free |
| FINAL_COMMIT | player | 1.34 | .46 / .58 | 1500 | locked |
| REALITY_HOLD | world | 1.06 | .50 / .52 | 2200 | locked |

Three easings, and none of them overshoot. `EASE_SOFT` is the default settle,
`EASE_FIRM` is for a cut-adjacent move, `EASE_CREEP` belongs to the push-in alone.
There is no spring anywhere in a scene.

**The frame is clamped to the world.** A shot centred near an edge slides back
until the lens sees only world, so the camera can never reveal the picture's
border.

## How a shot gets chosen

[`director.ts`](../src/engine/cinematic/director.ts) resolves one shot per frame, by precedence:

1. `revealed` → REALITY_HOLD
2. `committed` → FINAL_COMMIT
3. an inspection in the last 2.3 s → OBJECT_INSERT on that object (or on the
   player, for something in their hand)
4. the opening — a compiled scene's camera-grammar opening, or an authored
   scene's shot list
5. the latest **camera event** still inside its window (compiled scenes)
6. the first moment a commitment becomes possible (grammars that want it)
7. pressure reached → the grammar's pressure shot
8. otherwise → SOFT_FOLLOW

Compiled scenes carry no shot list. They carry a camera grammar (`intimate`,
`suspense`, `scrutiny`, `departure`, `moral`, `discovery`) and a handful of
semantic camera events produced by the compiler — `npc_exit`, `npc_enter`,
`object_active`, `speech`, `silence`, `pressure`, `arrival`, `stare`,
`approach`, `memory`. Each grammar maps those onto the presets above, so the
same story event reads as a push-in in one grammar and a held wide in another.
Attention framing never hard-cuts; only an inspection does.

Authored legacy cues still come from `CanonicalScenario.shots` and pass through
the same function. The three golden stories now compile from DSL and use their
grammar instead.

**Control is only taken for the first 4.2 seconds.**

## Staging

[`staging.ts`](../src/engine/cinematic/staging.ts) implements ten presets with a
gap, a depth offset and an orientation. The authored distances in the character
bible are 1000-unit values; staging converts them to the percent space the
runtime positions figures in.

`intimate_close`, `normal_conversation`, `awkward_distance`, `confrontation`,
`across_table`, `doorway_separation`, `walking_side_by_side`, `one_person_leaving`,
`isolated_subject`, `public_pressure`.

A partner who is about to leave is spawned **partway along the line they will
walk**, behind the furniture the scene focuses on, so their exit reads as travel
and never crosses the hero object.

## Casting

Casting is data, not engine logic. Compiled scenes cast from the DSL: no `on`
cast means nobody is in the room, which is how 03:17 keeps its corridor empty.
Older curated stories keep a `companion` flag in
[`curation.ts`](../src/data/heroStories/curation.ts).

The meeting room is full because the scene casts it: the presenting coworker,
the director and three seated colleagues are **actors**, not art. Seated
figures turn to whoever speaks, to the player when the room stares, and glance
up when the player passes close. Feed stills still draw the room populated.

People walk routes planned around the furniture (see
[the compiler doc](VIVI_EXPERIENCE_COMPILER_V1.md#navigation)) and are solid
to the player.

## Beats must not depend on frame delivery

Actors are a pure function of scene time: where someone is at 0:27 does not
depend on how many frames were delivered before it. Doors open from timed
modifiers, not from walk progress. Anything keyed to animation
progress hangs open when frames are throttled — a backgrounded tab, a slow
device. Story state comes from the modifier timeline; only motion comes from rAF.

## Motion tokens

[`motion.ts`](../src/design/motion.ts) names seven: `FAST_UI` (140 ms),
`NORMAL_UI` (240), `CHARACTER_TURN` (260), `WALK` (760, one stride),
`CAMERA_SOFT` (1400), `CAMERA_DRAMATIC` (2600), `REVEAL` (1600).

## Transitions

Entering a situation is a dissolve: the room arrives from darkness at 1.03 scale
and settles over 980 ms. The post-commitment hold fades in over 1600 ms with a
deliberate pause at the start, so the world is seen before the consequence is
read. Both are disabled under `prefers-reduced-motion`.

## Sound

[`viviAmbience.ts`](../src/utils/viviAmbience.ts) replaces arcade audio on the
stage. Every sound is a source in the room: a room-tone bed, shower, rain and
engine beds that crossfade over 1.4 s, and one-shots for a phone buzzing against
wood, a door meeting its frame, an intercom and an elevator. Levels sit around
-36 dBFS. There are no stings and no music, because the tension in these scenes
comes from what stops.

Each cue follows physical modifier state, not the narrative beat it coincides
with, and the navbar mute reaches the master gain. Nothing is created before
the first user gesture, a muted scene never starts sound, and the bed the scene
wants is applied on unlock or unmute. Compiled scenes add world beds
(ventilation, office hum, crowd, station air, evening air, train idle), knock
and footsteps one-shots, and grammar-driven restraint.

## MEMORY_ECHO

`["echo", object]` makes an object glint; reaching it warms and drops the grade
while the player and the remembered person replay three and a half seconds as
translucent figures beside it, then dissolve. The model writes one word.

## Commitment is a place, not a menu

Standing at an object you have already inspected, once the beat runner allows
commitment, turns that object into the choice: the chip reads the commit label
and Enter confirms. The gates are unchanged — an action must be physically
inspected and `canCommit` must be true — but the grid of buttons beside the world
is gone.

## Known boundary

Proximity is measured to an action's authored **standing** position, not the
object's anchor. A door hangs on a wall at y = 37 and the player can only ever
reach the threshold; measuring to the anchor made The Message's bathroom door
unreachable at any position in the room.
