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

The engine resolves one shot per frame, by precedence:

1. `revealed` → REALITY_HOLD
2. `committed` → FINAL_COMMIT
3. an inspection in the last 2.3 s → OBJECT_INSERT on that object's slot
4. an authored `ShotCue` still on the timeline → that cue
5. pressure beat reached → STATIC_TENSION
6. otherwise → SOFT_FOLLOW

Authored cues come from the stories themselves — `CanonicalScenario.shots`, fed
by `compileHeroStoryToRuntime`. `ShotType` maps onto the language one to one, so
`PHONE_INSERT` becomes an OBJECT_INSERT and `REALITY_REVEAL` a REALITY_HOLD.

**Control is only taken for the first 4.2 seconds.** Authored cues may declare
`locked`, but after the opening beat the engine ignores it and the player drives.
A camera that keeps taking the room away is not restraint, it is a cutscene.

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

Three flagship situations are built on the player being alone — 03:17, The Photo,
The Location — and the compiler stages no second figure in them. A figure in the
corridor destroys the only image 03:17 has. The list lives in
`STORIES_WITH_ON_STAGE_COMPANION` in [`RuntimeCompiler.ts`](../src/engine/runtime/RuntimeCompiler.ts).

The meeting room is the opposite case: a presenting coworker and three seated
colleagues are drawn into the world art, so the room is full and oriented toward
authority before anyone speaks. They are set dressing, not cast — the scenario
still carries exactly one NPC.

## Beats must not depend on frame delivery

The bathroom door opens for a fixed window measured from the moment the partner
starts leaving, not from how far they have walked. Anything keyed to animation
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
with, and the navbar mute reaches the master gain.

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
