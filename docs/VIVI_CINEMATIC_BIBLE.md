# VIVI — cinematic bible v1

## Shot grammar

The coded enum in [`shotTypes.ts`](../src/engine/cinematic/shotTypes.ts) is the stable vocabulary for ExperiencePlan.

[`ExperiencePlan.ts`](../src/engine/cinematic/ExperiencePlan.ts) defines the intended compiler-to-player contract: world, duration target, cast, objects, shots, modifiers, commitments, reveal and response prompt. The twelve authored hero scripts are a lighter current implementation of this structure.

| Shot | Purpose | Typical control |
|---|---|---|
| ESTABLISHING_WIDE | Show geography, exits and social distance | locked briefly |
| PLAYER_REVEAL | Identify the player silhouette and agency | locked → free |
| FOLLOW | Let the player explore and set pace | free |
| TWO_SHOT | Show relationship spacing | locked or free |
| OVER_SHOULDER | Show what one person can see | locked |
| OBJECT_INSERT | Make an object legible without explaining it | locked |
| PHONE_INSERT | Give message evidence a physical screen | locked |
| MEMORY_ECHO | Show a fleeting earlier layer | locked |
| SLOW_PUSH_IN | Pressure a line, person or object | locked |
| STATIC_TENSION | Make waiting visible | free or locked |
| WIDE_SILENCE | Let distance tell the story | free |
| NPC_EXIT | Change spatial relationship as someone leaves | locked |
| FINAL_COMMIT | Frame the chosen action | locked |
| REALITY_REVEAL | Hold the room after author truth appears | locked |

Camera presets are `wide_world`, `soft_follow`, `close_follow`, `two_person`, `object_focus`, `slow_push`, `locked_tension`, `memory_float`, `reveal_hold`. `ShotCue` records type, preset, target, duration, control and sound. Cut for new information; push for emotional pressure; hold after a question. Never keep the camera glued to the player when an object or NPC is the story.

## Composition and safe areas

Player default: lower third at 35–45% frame width, leaving the other side for a person or object. Place active NPC at a readable distance; use staging presets from the character bible. Hero object is near an intersection of thirds, never under the player’s feet. Keep text and controls inside a 10% side inset, 12% top inset and 18% bottom inset. On mobile, preserve the full interaction region and put narrative panel below the world. Foreground occlusion should add depth without hiding an actionable target. A reveal holds enough of the original geography that the changed relationship is visible.

## Four hero storyboards

Each linked SVG is an eight-frame visual contact sheet. Every frame includes shot type, camera position, characters, pose, world state, lighting, modifier, control, text, sound and transition. The generator is [`scripts/generate-storyboards.mjs`](../scripts/generate-storyboards.mjs).

- [The Message](../src/assets/storyboards/the-message.svg): door closes → shower → phone insert → playable hesitation → commitment → author account.
- [03:17](../src/assets/storyboards/0317.svg): clock → intercom → empty camera → elevator ascent → handle → decision.
- [The Presentation](../src/assets/storyboards/the-presentation.svg): slide recognition → evidence → praise → silence → ten-second window → act.
- [Last Walk](../src/assets/storyboards/last-walk.svg): walk → memory echo → bag → approaching bus → spoken or silent goodbye.

## Direction notes

The Message is a demonstration of `SITUATION > BUTTON`: no modal after the message. Let shower audio continue, preserve the phone as an object, and give the player the sofa, door and exit as real alternatives. 03:17 has no monster shot; the empty hall is the image. The Presentation should make speaking publicly feel expensive through the table and director’s gaze. Last Walk earns its warmth through a time limit and the possibility of never saying the thing.

## Current implementation boundary

The new runtime supports the story beats, timed cues, walk/inspect and commitment. The `ShotCue` sequence is authored and storyboarded but the runtime does not yet animate all camera presets or lock control per cue; that needs engine integration. See the modifier bible for sequencing behavior.
