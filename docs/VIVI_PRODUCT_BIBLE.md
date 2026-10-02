# VIVI — product bible v1

**Descriptor:** Stories You Can Enter. **Promise:** Vivi turns a real human situation into a tiny interactive world. A post says “enter what happened to me,” and asks the player to act before learning what the author did.

## Product loop

`ENTER → EXPERIENCE → COMMIT → REVEAL → COMPARE → RESPOND`

1. **Enter:** A feed card sells the setup in under ten seconds. Never disclose the outcome, hidden cause, or “correct” move.
2. **Experience:** The player moves in a grounded 2D diorama. People, objects, sound, time, and distance create meaning. Give control back after the key cue; do not present a choice modal at the cue.
3. **Commit:** Require one explicit physical action after exploration. Choosing an object or person may gather context; commitment is a separate irreversible step.
4. **Reveal:** Show the player’s immediate consequence first, then the author’s account. Label illustrative demo stories clearly.
5. **Compare:** Show aggregate player paths only when real participation data exists. Do not fabricate crowd percentages. Keep individual paths private by default.
6. **Respond:** Invite “this happened to me too,” a short reflection, or sharing the setup. Do not share an outcome by default.

## Audience and job

The consumer wants to try a charged human moment, feel its pressure, compare instincts with others, and sometimes contribute their own experience. The creator tells Vivi what happened; they do not build a game. The creator should review the hook, world, consent and truth reveal before publishing. Advanced node editing remains available as an archive/studio path.

## First feed hypothesis

Target mix: relationship/betrayal 20%, creepy/strange 15%, moral dilemmas 15%, social disaster 15%, family 10%, work/startup 10%, nostalgia 10%, surreal/dream 5%. This is an editorial starting point, not a ranking algorithm. The 12 flagship demos demonstrate range rather than mirror the mix exactly.

## UX principles

- A scene starts before a question appears. The situation is the interface.
- The scene grants agency through movement and inspection; the decisive act is explicit.
- A cue has a physical source: phone, train board, elevator, clock, weather, or another person.
- The player may hesitate, retreat, or wait. Inaction is a valid decision with a consequence.
- Tension comes from uncertainty, power and timing, not gore or false danger alerts.
- Adults in relationship scenarios; children appear only in memory contexts.
- Never present fictional demo outcomes as user submissions or measured crowd results.

## Current implementation boundary

`ViviFeed`, `ViviCreate` and `ViviPlay` provide a consumer-facing proof of direction for 12 scenarios. All 12 are playable through spatial selection, timed cues, commitment and reveal. The first four have detailed visual storyboards. The original `PlayableWorldEngine`, text mode, creator and legacy stories remain accessible through archive and advanced studio paths. The new runtime uses scripted timings and illustrative outcomes; generated stories still use the legacy engine. Persisted decisions, published social responses, analytics and production audio require future engineering.

## Release gates

For a real post: verify age/consent for identifiable people, edit the hook for privacy and spoiler control, make outcomes accurate to the contributor’s account, supply accessible captions and reduced motion, and test a complete path on phone and desktop. Research participation is a separate explicit opt-in product path.
