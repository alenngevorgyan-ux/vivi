# VIVI — Experience Modifier system v1

`ExperienceModifier` in [`types.ts`](../src/engine/modifiers/types.ts) records `id`, `kind`, `atMs`, semantic `anchor`, `payload`, optional intensity/duration and player visibility. The registry in [`presets.ts`](../src/engine/modifiers/presets.ts) lists valid attachment targets. An ExperiencePlan should supply a monotonic timeline, not hard-wire behavior in each world component.

## Modifier families

| Type | Real-world attachment | Directing effect |
|---|---|---|
| Timer | phone lock, station board, wall clock, meeting display | Makes remaining time legible within scene |
| Message / Typing / Call | phone, laptop, intercom | Interrupts attention; gives partial evidence |
| Door | bathroom, front door, elevator | Changes safety or availability of a person |
| NPCPressure | posture, gaze, impatience | Compresses social space without a HUD meter |
| Weather | window, street | Raises sound and occlusion |
| Lighting | lamp, emergency light, phone | Changes what can be seen |
| Sound | room source, hall, train | Can stop abruptly to create silence |
| Crowd | entrance, party, platform | Makes a private choice public |
| Arrival / Exit | elevator, train, person, rideshare | Removes or adds an option |

Additional cues include phone vibration, battery dying, location updates, rain intensifying, lights going off, someone walking away, unknown sounds and heartbeat/audio pressure. Use these as variants of the families rather than multiplying engine primitives.

## The Message timeline

| Time | Attachment | Event |
|---:|---|---|
| 0s | bathroom door | partner exits the living room |
| 4s | bathroom door / audio | shower starts |
| 7s | phone | first vibration |
| 8s | phone screen | “I still smell like you.” |
| 18s | phone screen | typing indicator / second interruption |
| 30s | bathroom | water stops |
| 36s | bathroom door | begins to open |

The current demo script compresses the message onto the first vibration for pacing; the authored preset retains the 8-second reveal for a fuller production sequence. Player control returns after the cue. Avoid an immediate choice menu.

## Runtime contract

The timeline uses elapsed active-scene time; pause when tab is hidden or an accessibility transcript is open. Fire each event once. Display a caption whenever a sound carries crucial information. Animate only the source object and its local spill. A diegetic timer should map to the world (board, phone, clock, elevator), with an optional accessible transcript outside the art. Timing must be testable without relying on wall-clock races. Reduced-motion mode keeps a static state change and caption.

## Interaction + instrumentation

The new demo runtime supports timed modifiers and spatial actions, but currently uses a small caption for cue legibility and does not yet draw every modifier at its semantic anchor. For production, `anchor` should resolve to the template slot; the camera should cut/push to that object only when the shot plan calls for it. `BehavioralContext` and `BehaviorEvent` schemas are groundwork; no telemetry is emitted by the demo. Consent rules are in the research concept.
