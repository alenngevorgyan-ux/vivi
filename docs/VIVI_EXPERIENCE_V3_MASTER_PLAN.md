# Vivi Experience V3 master plan

Planning specification · 2026-10-03 · No V3 implementation authorized by this document.

Current scope reconciliation: [Integration baseline](VIVI_V3_INTEGRATION_BASELINE.md) is the operational authority index. V3 currently requires **EN/RU only**; HY is future localization, with existing V1/V2 support untouched. **The Remembered Room is the provisional V3 visual direction, pending explicit product-owner visual approval**; section L’s earlier material decision is historical. Executable contracts belong exclusively to Foundation. Final gold story source/IDs supersede illustrative X/Y/AG examples for integration. See the [first-slice acceptance matrix](v3/V3_FIRST_SLICE_ACCEPTANCE.md).

## Decision

Build **authored situation sequences**: a short arc of illustrated scenes, with bounded movement inside selected scenes, reversible preparation, a single primary consequential act, and a deliberate handoff to the author's account. Presentation can flow; consequential time is evidence-gated. A sequence may contain one scene. More scenes are justified only when they change knowledge, social position, availability, or the meaning of acting.

The unit of Vivi is **a human tension made inhabitable**, not a room or a choice menu. The product promise is: “For a moment, understand why this person hesitated; act from what they knew; then meet the person who actually lived it.” A choice matters through its intelligible personal cost, not through generated branching consequences.

Do not reconnect general generation until three hand-authored stories demonstrate this format with real players. Do not make more procedural rooms before proving the new interaction and reveal.

## Evidence and scope

Verified local HEAD: `3d2113ef993068144eb4d0cfc64b091fd980c971`, on existing branch `planning/vivi-experience-v3`. Local `quality/vivi-experience-v2` points to the same commit. A read-only `git ls-remote origin refs/heads/quality/vivi-experience-v2 refs/heads/planning/vivi-experience-v3` confirmed the GitHub V2 branch at that hash; no remote planning branch was returned. Worktree was clean before this document. Main/master was not modified. No fetch, deployment, provider call, or runtime edit was performed.

Inspection covered:

- Architecture: [Experience V2](VIVI_EXPERIENCE_V2.md), [compiler V1](VIVI_EXPERIENCE_COMPILER_V1.md), [DSL V1](VIVI_EXPERIENCE_DSL_V1.md), [product bible](VIVI_PRODUCT_BIBLE.md), [world template bible](VIVI_WORLD_TEMPLATE_BIBLE.md), [visual V2](VIVI_VISUAL_BIBLE_V2.md), [cinematic V2](VIVI_CINEMATIC_BIBLE_V2.md).
- Quality evidence: [V2 QA](../reports/experience-v2-qa.md), [compiler hardening](../reports/compiler-quality-hardening-v1.md), the fixture definitions, replay provider, and V2 test harness.
- Production flow: `server.ts`, `src/App.tsx`, `src/components/ViviCreate.tsx`, `ViviPlay.tsx`, `src/engine/compiler/{compileViviStory,ExperienceCompiler,dsl,structuredContract}.ts`, and `src/engine/runtime/generationPipeline.ts`.
- Playback: `src/engine/experience/{types,machine,interaction,situation,playback,choiceStore}.ts`; `CanonicalViviEngine.tsx`; `ActionDock.tsx`; `IntentMenu.tsx`; `RevealView.tsx`; `StoryBeatRunner.ts`; `ModifierEngine.ts`; `navigation.ts`; `actors.ts`; cinematic director and world/character art.
- Screenshots viewed directly: `reports/experience-v2/02-explore-context.jpg`, `09-office-explore.jpg`, `11-mobile-explore.jpg`, `08-reveal.jpg`.

Fresh verification: `npm run test:v2` passed all 20 checks. These checks validate reachability, truth boundaries, commitment ordering, compatibility and other invariants. They do not exercise real browser keyboard ownership or establish emotional quality. No new browser playthrough, real-device measurement, screen-reader test, or live generation benchmark was performed during this planning pass. The user's play feedback is product evidence; static source findings below are independently inspectable.

Older bibles describe historical intentions. Where they conflict, this plan uses code at the verified HEAD and the explicit limitations in V2 QA. In particular, V1's generated “immediate consequence” is superseded by V2's honest enactment-only boundary.

## A. Why V2 still feels weak

### Controls: the browser and the world have no shared ownership contract

`CanonicalViviEngine.tsx:516` installs `keydown`/`keyup` on `window`. It records arrows/WASD without `preventDefault()`. Thus an eligible arrow can both move the character and scroll the page. It excludes `INPUT`, `TEXTAREA`, `SELECT`, but not contenteditable, composition, buttons, links, or modal ancestry. Its `interactive` value includes exploring, approaching and observing; opening `IntentMenu` does not suspend it. Movement can therefore continue behind a dialog or observation. Held keys have no explicit blur/visibility reset in that handler.

The stage is a pointer-driven div without a keyboard focus/ownership contract. `ViviPlay.tsx` has separate global modality and Escape handlers; `IntentMenu.tsx` has another window-level Escape listener. Its dialog focuses a first item but does not contain Tab, make the background inert, or restore the invoking target. `ActionDock.tsx` moves focus when selected content/phase changes. These pieces cannot consistently distinguish “I am walking” from “I am operating this button” from “I am typing.”

There is **no central Enter command** in V2. Native focused buttons respond to Enter; entering the scene does not focus a reliable contextual action. The modality listener recognizes Enter but only changes a hint. A player reading a keyboard hint can press Enter while focus remains on unrelated chrome. The older cinematic bible's claim that Enter confirms a nearby inspected commitment is not a reliable contract of the current V2 player. The archive `PlayableWorldEngine.tsx` also has separate global handlers; routing must keep archive and canonical owners from coexisting.

### Narrative: semantic validity has become a substitute for lived stakes

`assessFormat` in `situation.ts` checks perspective, moment, whyHard, distinct meaning families, and an author act. It cannot establish that a player understands both attractions and both costs. `MeaningFamily` is useful typing, not a measure of hesitation. A phone privacy story can pass all checks while its interface pre-digests the tension into a question and italic explanation.

The inspected apartment screenshot puts the most important human information in the dock, below a largely static room. The office screenshot makes the claimed authorship visible as anonymous bars on a slide; the human power relationship is primarily text. The mobile screenshot gives much of its height to explanatory UI, while tiny targets remain dots. These are authored technical demonstrations, not proof of compelling presence.

### Discovery: observation changes a panel more often than the situation

V2 separates observation from commitment correctly. But `hotspots` and `ActionDock` remain the dominant discovery mechanism. All meaningful targets become dots; attention, body movement and information are loosely coupled. A camera insert can magnify a generic object while its specific meaning arrives elsewhere as prose. Optional observation often repeats facts already in the situation paragraph. Movement rarely changes the reader's understanding.

### World: scope is small and event causality is over-compressed

`CanonicalScenario.world` is singular. `ExperienceV2` has one moment, one orientation threshold and one terminal commitment. `StoryBeatRunner` stores a linear current index; `ModifierEngine` projects effects from elapsed time. V2 already has time-driven actors, so “time should flow” is not a missing timer feature. It lacks a coherent distinction between presentation rhythm, causal event progression, and decision availability. `ViviPlay` mixes a 100 ms wall-clock update, frozen world time and timeout-driven reveal phases; the renderer interpolates with performance time. These are workable for one scene, brittle for persistence and travel.

### Reveal: the story changes into a form

`RevealView` immediately mounts the player's label, author's act, why, aftermath, note textarea, response CTA and related-story blocks. It is honest but flattens the climax into equally available content. The inspected reveal screenshot is a long editorial page with a large input form. The player is asked to produce before being given room to encounter the author.

### Atmosphere: implementation sophistication is not visual authorship

`SceneArt.tsx` already has layers, practical light pools and noise; `CharacterFigure.tsx` has articulated poses; the director has eleven shot presets. The problem is not absence of these features. Uniform construction, generalized geometry, repeated body design, limited scene-specific composition and large overlay context still read as a toolkit. More SVG filters or more camera events will not establish a visual identity.

**Diagnosis:** V2 is a sounder interpretation and commitment pipeline wrapped around a small, repetitive product unit. Input reliability, narrative density, discovered context, visual specificity and reveal rhythm must be developed together.

## B. V2 components that survive

Keep these contracts unchanged in meaning and keep the existing V2 path intact for old posts:

- Compile once/play many; no model calls in playback; strict enum-based, untrusted model output.
- Author action/why/aftermath never enter semantic generation or repair. Keep canary tests and separate reveal data.
- Observation never records a commitment. Selection is cancellable; a consequential act is explicitly confirmed and idempotently recorded.
- No distance error for a valid intent. Reuse auto-approach recovery: reachable mark → alternative mark → coherent cut → readable text.
- Enact only the player's chosen act; do not manufacture another person's response.
- First choices and replays are distinct; no invented crowd counts, percentages, quotes, or attribution.
- Author preview/corrections, explicit legacy adapters, safe memory/text fallback, audio unlock/mute and reduced-motion paths.
- `navigation.ts` A*, collision primitives, semantic targeting, useful camera/staging presets, telemetry redaction, provider usage reporting and generation abuse guard as building blocks.

“Survive unchanged” does not mean port every implementation unchanged. V3 needs new clock, ownership and asset contracts; V2 files remain available to render immutable old posts.

## C. Assumptions to kill

1. One room equals one story. A location is a staging resource; a scene is a meaningful moment.
2. More locations automatically make a story richer. Remove any transition whose omission loses nothing human.
3. Two meaning families equal a good decision. Require competing intelligible motives with costs.
4. Clicking every dot is exploration. Required facts must be accessible; optional facts must earn their interaction.
5. Time pressure creates stakes. It can create illegibility and invent danger.
6. A continuous simulation is inherently more truthful. Simulated NPC reactions easily become fabricated testimony.
7. Inactivity means “I chose silence.” Browser focus, reading and uncertainty are not consent to a choice.
8. The compiler may improve dramatic texture by adding a stare, stopped sound, deadline or suspicious lighting. Each can assert meaning absent from the source.
9. Every choice needs a generated consequence branch. The player's act can end at an honest boundary.
10. A tiny positional DSL is a permanent advantage. Compact encoding should not hide provenance or causal ambiguity.
11. All scenes need walking, all posts need decisions, all lengths need the same template.
12. Green compiler tests, completion, or dwell time certify product quality.

## Three materially different directions

| Dimension | Directed encounter | Continuous social pocket | Authored situation sequence |
|---|---|---|---|
| Product feel | One charged frame; inspect/act; cinematic precision | Small living room/building; people move; act when ready | Enter several moments; movement where meaningful; an arc toward action |
| Agency | Select attention and one act | Walk, wait, follow, interrupt, return | Attention, local movement, reversible travel/preparation, one primary act |
| Engineering | Low–medium: shot player + intentions | High: simulation, scheduling, concurrent availability, recovery | Medium: graph, persistent state, beat scheduler, transitions |
| Generation | Easiest, one tension/shot | Hardest, causal timelines and possible reactions | Moderate, bounded scene sequence and evidence ledger |
| Art | Few exquisite compositions | Many angles and traversable spaces | Reusable staged tableaux plus inserts/thresholds |
| Truth risk | Lower; weak agency may feel like a quiz | Highest; new events and counterfactual reactions | Manageable if causal events precede the primary boundary |
| Mobile | Excellent | Weakest; movement and timing compete with reading | Good; tap-to-approach, short scenes, no compulsory joystick |
| Social fit | Strong feed unit; may remain thin | Weak if long or hard to finish | Strong if length is visible and payoff remains personal |
| Cost | Lowest runtime/content cost | Highest authoring/QA/runtime cost | Moderate fixed asset cost; bounded marginal compile cost |
| Scalability | Many stories, narrow expressive range | Limited without a costly simulation/content toolchain | Wider range without arbitrary scripts |
| Main failure | Beautiful illustrated poll | Tiny adventure game with invented urgency | Slideshow padded by corridors |

Recommend the third with **directed encounters as its one-scene form** and selected soft-time behaviors borrowed from the second. Do not average all three into maximum scope. No sandbox AI, no physics adventure, no simulated conversations. Launch support: 1–4 scenes, at most 3 locations and one primary decision. Contract hard cap: 8 scenes for later curated sequences, not an automatic target. A four-minute story must earn its length in evaluation.

## D. Exact input/control architecture

### Ownership and semantic commands

Create `src/engine/input/InputManager.ts`, one manager per active player shell. It normalizes devices and held-state; it does not choose story actions. Create `src/engine/v3/InteractionController.ts`, which resolves semantic commands against a current immutable opportunity snapshot. `src/components/experience/v3/FocusCoordinator.tsx` owns DOM focus. Renderers and docks never install independent window key handlers.

Context stack, highest first: `text_entry` → `modal` → `intent_sheet` → `observation` → `transition/enactment` → `world` → `page`. Only the top eligible scope handles a command. Audio unlock may observe a trusted gesture but cannot consume it. Page routing disposes the old owner before mounting the next, including archive mode.

The world captures movement only when its dedicated focusable surface has focus and playback is in an interactive phase. Clicking/tapping an empty stage intentionally focuses that surface with `preventScroll`; Tab or an explicit “Enter scene controls” button reaches it. Merely scrolling a feed card into view does not capture keys. Do not put `role=application` on the entire experience: provide a named region, normal buttons and a screen-reader-friendly action list. Optional application-style movement would require separate assistive-technology validation.

On leaving the surface, focus moving to a DOM control, window blur, hidden document, modal open, route change, pointer cancellation or lost pointer capture: clear held keys and movement vector immediately. Do not preserve velocity as a hidden input. An unfocused visible scene may continue ambient staging; consequential progression pauses when the app loses focus/visibility.

| Context | Arrows / WASD | Enter | Space | Tab / Shift+Tab | Escape |
|---|---|---|---|---|---|
| Focused world | Move, if local movement supported | Open current contextual target; if none, open available-actions sheet | Native/page behavior unless explicitly bound in a movement-only surface | Native exit to next/previous real control; never trapped | Cancel approach/selection, else release to scene-controls entry button |
| Focused target/button/link | Native behavior; no locomotion | Native activation only | Native button activation | Native sequence | Close selection if applicable |
| Intent sheet | Arrow navigation only if implemented as a proper composite widget; otherwise normal buttons | Activate focused intent; selects, never commits automatically | Native button activation | Within modal scope | Close and restore invoker |
| Pending act | No movement while confirmation owns focus | Native activation of focused confirm/cancel | Native button activation | Between confirm, cancel and other reachable controls | Cancel and restore target |
| Observation | No movement through reading UI | Activate focused close/continue | Native | Normal observation controls | Close, restore invoker |
| Text/IME | Browser/editor owns all | Editor/form policy | Browser/editor | Native | Editor/dialog policy |
| Transition/enactment | No locomotion | Only focused skip/continue control | Native | Reach skip, pause, exit | No undo after act; open pause if supported |
| Reveal/page | Browser owns input | Native | Native | Native | Dialog policy only |

Prevent scrolling **only** for owned movement keys on the focused world surface, and handled custom widget navigation. Prevent default synchronously once eligibility is known. Do not intercept browser modifiers, shortcuts, text composition, contenteditable, input/select/textarea, links or buttons; check `event.composedPath()` and `isComposing`. A disabled movement phase still consumes movement keys while the world surface owns them, emits a gentle state hint once, and offers focusable skip/pause; it must not suddenly start scrolling. Outside that scope browser behavior remains native.

Arrows and physical WASD both exist. Movement maps physical `code` values so EN/RU layouts work; arrows are the universally labeled default. Expose remapping and a layout-appropriate help label. For text commands use logical `key`, not physical location. [MDN documents the physical-key distinction](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code).

Enter never means “commit whatever happens to be nearest.” World Enter opens a contextual action, including the action list if no target is selected. Native Enter selects an act, then a separate release and subsequent activation confirms. Reject repeats and duplicate synthesized activations; confirmation cannot open and commit from one held key. A direct single-observation target may open its observation; an act always names its physical effect before confirmation.

World contextual selection order: explicitly selected target → stable reachable target in the attention zone → no target/action sheet. Use a deterministic distance/facing/visibility score with hysteresis; never switch while confirmation is pending. The action sheet includes all semantically available intents, including offscreen targets, and auto-approaches them. A proximity cue must not imply unavailable actions.

Focus is owned by UI transitions, not modality changes or animation frames. Restore to the invoking target on close; if it disappeared, restore to the world-entry control and announce the changed availability. On reveal, focus its heading (`tabIndex=-1`) once. Modal scopes make the background inert, contain Tab, provide a visible close button and restore focus, following [WAI's dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). A non-modal observation does not falsely claim `aria-modal`.

### Pointer/touch parity

Pointer target activation, keyboard selection and action-list activation all dispatch `selectTarget`; chosen intent dispatches `requestIntent`. Floor click/tap dispatches a semantic destination mapped by inverse camera transform. Distinguish a tap from scroll with a movement threshold; never move on initial `pointerdown`. Native vertical page scrolling remains available. Use `touch-action: manipulation` for targets; a future drag movement surface alone can use `touch-action: none`, with explicit activation and pointer capture. No mandatory joystick. Low precision never blocks a valid act; targets are at least 44 CSS px, grow outside zoom and do not overlap.

### Control acceptance

Browser tests must assert unchanged `scrollY` for every owned arrow; normal scrolling outside ownership; no behind-dialog movement; one act per confirmation; normal EN/RU typing and IME; native Tab escape; focus restoration; held-key reset on blur; pointer scroll does not become walking; equivalent pointer/keyboard/touch event traces. These are release blockers, not optional polish.

## E. Multi-scene / multi-location runtime

Separate four concepts:

- **Experience:** a versioned story/choice identity and arc.
- **Location:** a persistent place with actors, objects, doors, kit and navigation configuration.
- **Scene:** a framed presentation of a location at a phase of the arc. A second view of the same room is another scene, not another physical room.
- **Beat:** one ordered unit that changes attention, delivers evidence, or changes supported world state.

The arc is a mostly linear directed spine. A small location graph permits reversible excursions around it. Doors refer to location portals; montage edges refer to scene cuts and do not masquerade as walkable doors. A phone insert inherits its parent location and leaves the body's position unchanged. A memory fragment is tagged remembered content, never an unmarked present-time event.

Do not build a global navigable map. Each loaded location has local navigation. A portal transition resolves the source threshold, stages departure, saves local marks, loads the destination, places persistent entities once, establishes its frame and restores interaction. Backtracking reuses location state and seen facts; it never resets cues or spawns duplicate actors. A reversible exit must have a return edge. “Leave the situation” is a commitment if it changes the human choice; an ordinary move to the hallway is navigation only if the source/author-approved staging supports a reversible visit.

Actors and objects have stable experience-wide IDs. An entity belongs to exactly one location, actor inventory, or offstage state. Local visual instances are projections, not owners. An actor crossing a door gets one transfer event with source/destination; disappearing in one location and appearing in another are not separate facts. No offscreen conversations, relationships or inventory changes are simulated. Offscreen causal events occur only as evidence-backed timeline entries; ambient simulation does not alter knowledge.

State persistence includes arc cursor, completed event IDs, received facts, seen observations, visited scenes, portal availability, entity state, pending/recorded decision and time policy. Save at scene boundaries and accepted acts; resume never repeats a one-shot or silently changes an opportunity. Runtime snapshot belongs to an attempt, not to a published post. Persist IDs/marks, not animation DOM or continuous frame data.

Scene load transaction: `REQUEST → eligibility recheck → save → preload → exit frame → atomic location/scene swap → entry frame → focus handoff → READY`. Failure before swap keeps source state and provides retry/readable continuation; failure after swap uses the destination's accessible still/text projection. A preload cannot change story state. Transition requests are idempotent; outdated async completions are rejected by transaction ID.

## F. Hybrid time architecture

Use three time domains, not a single elapsed number:

1. **Presentation time:** locomotion, ambient motion, light interpolation, room tone, camera. Monotonic active-session time from `performance.now()`. Stops on visibility loss/user pause; reduced motion changes interpolation, not facts.
2. **Narrative progress:** ordered beats and accepted causal events. Advances after prerequisites and delivered required text; cannot skip unread facts because a frame was late.
3. **Opportunity time:** optional evidence-backed window anchored to a named event. Disabled by default. Never inferred from a dramatic grammar.

Soft time is default: an explicitly supported presentation may continue, a person may settle, the elevator motor may hum, a room can breathe. The decisive opportunity remains open until the player acts or explicitly chooses to continue without acting. Do not loop a sentence as if it were spoken repeatedly. Hold the room at a believable plateau instead. “Waiting” as ambient posture is distinct from “Remain silent through the question,” a confirmed commitment.

Each event is classified `ambient`, `evidence_delivery`, or `causal`. Ambient loops are non-informational and cannot imply new arrival, menace, message, closing deadline or affect. Evidence delivery respects reading. Causal events require provenance and ordered prerequisites. The compiler may time a sourced event's presentation; it cannot add an event to repair pacing. If no timing fact exists, a motor/door recipe cannot close an action window.

Reading a required subtitle, observation, action sheet, confirmation, settings or modal pauses narrative/opportunity time. Ambient presentation may continue unless distracting, but no actor crosses a boundary behind the reading UI. Pause reasons are a set/reference count, so closing one modal cannot unpause a hidden tab. App blur also stops opportunity time. Resource stalls, orientation lock and travel to the chosen target never consume decision time.

Real windows require: a quoted/author-confirmed time relation, a supported expiry event, a defined supported missed state, and an untimed equivalent. “The elevator was closing” supports order, not “you have 3 seconds.” Default variant is turn-based: show the closing state, let the player choose before advance. A later curated timed variant can use an author-confirmed duration; offer “Take my time” before entry, which disables the timer and preserves the same content. Do not rely on an essential-timing exception. [WCAG's timing guidance favors allowing users to disable limits](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html).

Expiry closes an opportunity only when the story supports that change. It records `missed`, never assigns a player commitment or aggregates “silence.” It moves to a supported remaining choice, memory continuation, or explicit reveal-without-choice. Simultaneous expiry and selection: serialize by logical scheduler tick; an accepted intent reserves its window through approach/confirmation. Cancellation releases it; cancellation while time remains does not secretly expire it. First slice ships **no real timers**.

Deterministic scheduling: stable event ordering by dependency, logical time and ID; apply effects once; catch up causal state in order after an active-session stall, but hold at the next unread delivery barrier. rAF renders sampled state only. Do not replay every missed sound after resume. Phone lock, NPC return, crowd stare and pressure dim must never come from a generic grammar default in V3.

## G. Bounded freedom

Free: where to stand within a visible local walkable region; which available target to approach; optional source-backed information to inspect; whether to reread; reversible portal travel; cancel preparation; dwell; explicit preparation such as carrying one's own evidence; choose when to open an available act.

Authored: the factual sequence, what the hero knew at each beat, quoted speech, who is present, causal changes, supported options, the primary truth boundary, and the author's account. There is no free text conversation, invented reaction, open inventory crafting or morality score.

Not every affordance may be freely traversed. A closed bathroom in the apartment story is a boundary, not a new room to explore. Following someone is allowed as neutral travel only before it changes their behavior and only within source-approved geography. If following, leaving, reading private text or withholding something crosses the human boundary, it is a commitment, not “just movement.” The compiler rejects ambiguous classifications and asks the author to resolve them.

Launch stories contain one primary commitment. Earlier actions can be reversible preparation with bounded state effects. Multiple consequential decision moments are deferred: after the first counterfactual act, showing the historical next scene as if it followed would invent causality. Later chapters can contain fresh decisions only with an explicit reset to the author's actual timeline, or a documented branch; do not hide this reset as seamless play.

Presence criterion: a player can alter attention or position in a way that changes what they understand, without doing busywork to unlock the choice. All required evidence is also available in accessible reading order.

## H. Narrative compiler V3

Future semantic generation design only: current general generation is HARD BLOCKED by the [baseline](VIVI_V3_INTEGRATION_BASELINE.md). Hand-authored gold adaptation through Foundation’s ordinary deterministic path is the first implementation target; no provider or paid benchmark is authorized here.

Keep one server entrypoint and one bounded semantic call plus at most one repair. Replace the model-facing V1 tuple contract with named, strict V3 semantic records. Compression can be a stored encoding later; do not ask a small model to encode causal structure in obscure positional tuples.

Pipeline:

```text
author source + confirmed before/after boundary
  → deterministic source segmentation and private fact ledger
  → semantic proposal (only pre-boundary material)
  → structural validation
  → evidence, tension, graph and freedom validation
  → at most one repair, using pre-boundary facts only
  → author review / format downgrade if unresolved
  → deterministic composition, staging, timing and asset resolution
  → immutable playback manifest + separate reveal record
  → player; no model connection
```

The smallest sufficient semantic plan has: evidence references, tension, scenes with beats, shared entities, bounded portals, observations/opportunities, one decision, presentation recipe IDs. `StoryAnalysis` and `SituationArc` are views of this plan, not duplicated authoritative JSON. `WorldState`/`ActorState`/`ObjectState` are runtime state, not model output. `Timeline` is compiled from beat dependencies and explicit evidence. `RevealPlan` is produced by trusted author data plus a presentation recipe, never by the semantic model.

The deterministic source ledger initially contains numbered spans, not an invented understanding of the story. The model proposes named claims referencing those span IDs, restricted to the pre-boundary source. The evidence validator resolves offsets/excerpts and leaves non-verbatim entailment for author review. Only approved claims become `EvidenceFact` records; semantic references to unapproved claims cannot reach a published playable manifest. Private reveal-only evidence is created through author intake separately and is never part of the semantic request. Hand-authored fixtures provide the same claim proposal and approval records, avoiding a privileged fixture compiler.

Model can propose named scene boundaries and arrangement of evidence. Engine decides coordinates, routes, time implementation, collisions, entity transfers, camera/light/audio execution. Neither may decide that an unsupported fact is true. Exact source offsets prove provenance exists, not that a paraphrase entails it; paraphrases remain reviewable claims. Unknowns are explicit and cannot be “filled” by defaults.

## I. Story format router

| Format | Target active presentation length, excluding optional reading/reveal | Structure | Route when |
|---|---|---|---|
| Micro moment | 10–30 s | 1 scene, 1 key cue, 1 act | Context and two motive/cost pairs fit without compression damage |
| Situation | 30–120 s | 1–3 scenes, a change in understanding | One human tension needs preparation, discovery or repositioning |
| Sequence | 2–5 min | 3–8 scenes; launch cap 4 | Several source-backed moments change stakes before the main act |
| Illustrated memory | Reader-paced | 1–6 framed memories | Strong account, no viable player decision or no safe counterfactual boundary |
| Text story | Reader-paced | Editorial text | Spatialization adds little, source is unclear, or assets/geography do not fit |

These are expectations, never countdowns. The hand-authored Correction is a bounded 75–110-second `sequence` with four views; its approved format label does not require stretching it to two minutes. Estimate from locale-specific readable text, semantic event count, intended traversal and held shots, then validate with players. A long text need not produce many rooms. A 20-second story is dense if it gives a relationship, a stake and an act; it is thin if it supplies only a prompt.

Routing priority: safety/truth completeness → meaningful decision → evidence density → spatial benefit → supported kits → duration. Author may choose a shorter non-playable format. Do not pressure authors to add drama to qualify. Keep one clarification at a time, with at most two optional clarification cycles per draft before offering memory/text. Lack of author disclosure can be valid: label withheld truth and do not sell an “actual choice” climax that cannot be delivered.

## J. Story-quality gate and intake

Retain `ViviCreate`'s tell → boundary → deed → preview spine. Add a source-grounded tension review and scene strip inside it, rather than exposing a graph editor. Author reviews “What you knew,” “What we leave unknown,” “Why either act might make sense,” proposed movement/timing, and the exact last point before reveal. Outcomes/why/aftermath remain separate inputs.

Intake identifies hook, relationship/power context, values in conflict, stakes, uncertainty, turning information, feasible acts, scene changes, author act and aftermath. Distinguish perceived risk (“I thought I could lose the job”) from an actual future consequence. Do not promise a consequence that was only feared.

Tension record must answer, with evidence:

1. What am I trying to protect or obtain?
2. What makes the competing act attractive?
3. What might each act cost me or someone I care about?
4. What do I not know at this moment?
5. Why is this my decision, here?

Two motives need not be morally symmetrical. Do not make privacy violation appear equally virtuous to satisfy a rubric. “Rational reason someone might feel drawn” is different from endorsement.

Hard gate: source-backed hero perspective; comprehensible competing motives; feasible distinct acts; no future-fact leakage; a specific primary boundary; required evidence deliverable before acting; supported kit or explicit memory/text route. Any unresolved invented cast, event, quote, deadline or consequence blocks playable publication. This intentionally changes V1's policy of playing a structurally valid scene despite semantic errors. Thinness can route to memory; invention cannot be repaired by disclaimers.

Editorial rubric, each 0–3 with separate scores: hook specificity, human stake, intelligible competing motives, useful discovery, state transformation, author payoff, atmosphere fit. No summed score silently certifies quality. Require at least 2 for stake/motives/payoff, with a human reviewer before early public V3 release. A micro may score 0 for exploration and still work; never invent observation chores to raise it. The rubric is a triage instrument, not an automated taste oracle.

Ask the most consequential missing question, e.g. “What made speaking risky for you?” or “Could you leave and return before deciding?” If source already answers it, use that evidence. A factual plan that remains uninteresting is an editorial failure; reject or present as text without making the author write a bigger tragedy.

## K. Reveal and social architecture

Design the ending as an encounter, with these sequentially paced layers:

1. **My act:** body performs exactly the named action. Concrete verb and target; no invented answer. Minimal caption remains available.
2. **A held trace:** camera holds the place/body/hero object for approximately 0.6–1.2 s; skip always works. A held frame is a presentation beat, not a claim that real life fell silent.
3. **Boundary disclosure:** the counterfactual has already stopped at the exact gold act frame; the following bridge cannot extend it. A small author-voice bridge: “That is where your version stops. Here is what I did.” Prefer less copy where the transition is self-evident; disclose illustrative staging persistently.
4. **Author act:** same visual motif becomes an editorial author card or still. Author text is first-person and unchanged; identity/pseudonym and account status visible. No synthetic voice by default. Optional actual author recording with transcript can come later.
5. **Why:** a separate natural continuation, not a questionnaire heading. Missing why stays missing. No model-written motive.
6. **Aftermath:** appears on reader advance or scroll; absent if undisclosed. Never back-project it into the player's scene.
7. **Comparison/continuation:** the player can see real first-choice counts, read opt-in short explanations, respond with a story or follow a genuine follow-up. Offer one primary continuation, not a wall of empty social panels.

First author's act appears automatically after enactment; why/after are reader-paced. Accessible projection presents all in reading order without animation locks. Reduced motion uses a stable frame/cut. Reveal network failure keeps the accepted act and offers retry; it never asks for a second choice to unlock it. Do not place a textarea before the author's account.

V3 local vertical slices use honest local first-choice and private note storage. Public social statistics require a real service: immutable experience/decision version, one first completed decision per participant/version, explicit replay exclusion and a reported denominator. Browser-local identity cannot certify unique people; if anonymous participation is used, label it as recorded first attempts and describe deduplication limits. Group timed/untimed variants separately when availability differs. Prior-reveal knowledge contaminates first instincts: mark replays and explicitly known reveals separately; do not claim perfect blindness.

Suggested future APIs: `POST /api/posts/:id/attempts`, `POST /api/attempts/:id/decision` with idempotency key, `GET /api/attempts/:id/reveal`, `GET /api/posts/:id/comparison`. The service validates manifest version, offered choice, availability policy and ownership; it cannot prove an untrusted client actually read the scene. Server release is spoiler gating, not secrecy once anyone can complete a post.

Public explanation sharing is separate opt-in from a private note; offer no psychological diagnosis or morality ranking. Similar stories are editorial/tag-based recommendations from real posts; response/follow-up relations are explicit post IDs. Share previews exclude author outcome. No fabricated replies to seed empty state; small cohorts can show counts without percentages or public notes. Public social release is a later, currently blocked project with moderation, deletion and consent controls, not required for the four-week format test. Current fictional slices expose no counts or fictional community and offer another fictional story/private unsent draft only.

## L. Vivi visual language: choose a material, not an effect

Three coherent directions:

| Direction | Strength | Problem |
|---|---|---|
| Ink editorial theatre | Flat ink planes, selective color, expressive silhouettes, strong type; cheap modular composition | Can become a diagram; close inserts need material specificity |
| Painted paper diorama | Layered gouache-like surfaces, cut-paper depth, practical light, restrained adult figures | Requires controlled kit seams, texture scale and a good character library |
| Graphic memory panels | Bold silhouettes, sequential framing, selective closeups, strong montage | Risks reading as a comic quiz; motion can clash with panel composition |

**Historical material recommendation:** painted paper diorama with editorial framing. **Current provisional direction:** [The Remembered Room](VIVI_VISUAL_LANGUAGE_V3.md), subject to explicit product-owner visual approval. The shared illustrated/editorial architecture below remains; no exact material, coat rule, mask algorithm or renderer is permanently approved. Its recognizable qualities are tangible surfaces, asymmetrical inhabited compositions, a restrained gesture vocabulary, one specific hero detail, and generous author typography. It supports stills, local movement and montage with the same materials. Memory is represented by framing and author voice, not automatic sepia. Do not imitate a named living artist.

### World art

Fixed shallow three-quarter perspective per kit, not universal “horizon 47%.” Asset manifest owns floor projection, walkable polygon, occlusion and actor scale. Broad architecture first; midground carries the human relation; foreground offers one sparse occluder. No decorative clutter that looks inspectable. Place one high-information hero object and 2–3 supporting material details. Details are drawn from neutral kit variants unless the author supplies specificity; a family portrait, medication label or religious object is never neutral filler.

Composition must tell a sentence: “My work is at the front; I am against the wall,” “The phone is accessible; the person is behind a boundary,” “Someone might be on the other side; I am outside.” Perspective/scale may be expressive, but actors must stand on a coherent floor and reach objects convincingly. Negative space is a holding place for attention, not uniformly empty walls. Kit substitutions cannot erase a consequential feature.

### Characters

Adult silhouettes with varied torso/height/body/clothing families. Heads approximately 1/6–1/7 of height; no oversized toy heads. Minimal faces; emotional readability comes from weight, orientation, hands, timing and distance. Avoid generic “sad eyebrow” state changes. Reuse silhouettes without implying real identity; show anonymous reconstruction unless the author explicitly supplies likeness consent. No default male hero mapping: choose neutral/author-approved representation or abstract figure.

### Camera, light, color, motion, sound

Camera holds more than it moves. Cut for new information; follow only when travel itself matters. Practical light binds subjects to rooms; gradients do not assign guilt. Palette is location/time/weather treatment, not a morality meter. Motion is contact, weight and hesitation, not bounce. Sound gives spatial continuity, with a meaningful mute-equivalent. Detailed subsystem rules follow in N–Q.

### UI and material brand

The earlier recommendation used a warm paper shell, dark ink and charcoal worlds. Remembered Room provisionally unifies world and author page through painted attention islands on paper and graphite periphery. Exact surface/mark choices belong to Design and remain pending approval; readable light and focus are required. No glowing gold dots as the permanent meaning layer; focus uses a small edge/bracket plus a plain verb. Persistent pause/mute/exit and an action-list alternative remain accessible. Author voice uses generous editorial type; controls use clear sans. Texture is baked into assets at known scale; avoid full-screen animated noise and generalized blur. Scene framing and typography should be recognizable at thumbnail size without a logo.

Art acceptance: blind contact sheet can distinguish Vivi from a generic SVG scene; scenes remain readable without all narrative text; one hero prop and body relation are legible at 390 CSS px; screenshots have intentional compositions at both mobile and desktop; no option is visually privileged as “correct.” These need human review, not screenshot pixel thresholds alone.

## M. Asset production and rendering architecture

Replace procedural SVG **as the final art source**, not as a forbidden technology. Retain SVG for masks, debug geometry, accessibility-friendly focus shapes and legacy worlds. New art uses authored layered raster plates, modular illustrated props, and rigged 2D figures/pose atlases. Initial renderer: composited image/DOM layers and an isolated figure layer, with native DOM action controls above. No mandatory WebGL engine migration to prove the format.

`src/assets/v3/`:

```text
kits/office/{desk,meeting,hallway}/manifest.json + layered images
kits/domestic/{living,threshold}/...
props/{phone,keys,document,bag}/...
characters/{body-family}/rig.json + texture/pose atlases
materials/{paper,paint,glass,fabric}/...
lights/{practical-mask}/...
audio/{beds,doors,steps,devices}/...
recipes/{composition,camera,transition,motion}/...
```

Source production files and licenses live outside the client bundle in `art/source/` with export recipes. Runtime assets have immutable IDs, hashes, dimensions, anchors, depth/occlusion metadata, accessibility descriptions, compatible light variants and licensing references. One authoritative spatial manifest drives art anchors, portals, collision and camera safe frames; do not hand-maintain geometry in three registries.

Earlier illustrative asset inventory (quantities provisional, not first-slice acceptance): office desk/meeting/hallway (one building kit), apartment living/door threshold, a simple lift landing; six hero props; four body families with four facings; nine motion recipes; six room/door/device sounds; three transition recipes. Current gold needs are office desk/meeting/hallway and domestic living/threshold/dining; Design owns the reviewed subset and exact recipe/rig counts. Lift inventory is a later reference, not extra gold scope. Many story variants may reuse these. Nonmatching stories route to memory/text; no forced “office” for a scene whose geography carries meaning.

Hero props are separate inspectable plates with localized text rendered as real text. Draw a slide's surface/material once; populate a supported name/title in the runtime. Do not rasterize important EN/RU text into art. Door frames contain swappable open/closed pieces; evidence-bearing slots cannot randomly vary. World variation is bounded: material and furniture variants from reviewed combinations, not arbitrary collage or broad random seed changes.

Asset workflow: composition sketches → mobile contact sheet → geometry/anchor validation → art/gesture review → layer export → byte/decode budget → integration snapshot → player test. Kit manifests version separately from story schemas. Asset upgrades do not silently reframe published evidence: pin kits/recipes per manifest.

Generative images can support **asset production**: sketching direction, material exploration, non-identifying background candidates, followed by human selection, layer cleanup, geometry alignment, rights review and consistency checks. They do not generate a bespoke post image during playback or author compilation. Runtime generation selects and composes approved assets. No image generation was needed for this planning deliverable. Budget/licensing/vendor choice remains a separate production decision.

## N. Camera system

Reuse semantics of `cameraLanguage.ts`, `director.ts` and `staging.ts`; replace per-frame competing shot selection with a scheduled `CameraDirector` in `src/engine/v3/presentation/CameraDirector.ts`.

Inputs: scene recipe, active beat, explicit attention request, movement path, target visibility, accessibility settings. Output: sampled camera transform and safe interaction bounds. Precedence: boundary/enactment → accepted observation insert → scene transition/establishing → authored beat emphasis → user movement follow → held composition. Lock the selected shot for a minimum dwell; world events cannot repeatedly steal it. New evidence queues behind an active readable insert.

Required recipes: establishing relation; held two-shot; over-shoulder evidence; object insert; threshold departure; return match cut; author still. Defaults: establish 0.8–1.5 s, holds 1.5–3 s, movement settle 0.4–0.8 s, maximum one automatic emphasis move per beat. These are tunable presentation values, not source time claims. Never lock reading to a duration. Allow skip of introductory framing without skipping required evidence.

Maintain screen direction across portals, subject position across match cuts, and a visually obvious time/viewpoint change. Clamp to illustrated coverage; frames never reveal missing plate borders. Mobile has approved alternate crops/compositions, not a desktop frame squeezed into a narrow strip. No motion/parallax in reduced-motion; render a readable settled shot. Keyboard target focus can bring a target into view without disorienting the reader; offscreen options remain in the action list.

## O. Character animation and body language

`CharacterFigure.tsx`, `characters.ts`, `animationClock.ts` provide useful pose semantics but are not the final figure art. New `MotionDirector` maps action recipes onto author-approved rig/pose families. Use distance-driven footsteps, stable ground contact and interruptible reversible approach. A commitment performance is uninterruptible semantically, skippable visually.

Vocabulary: idle/breathe; turn; settle weight; walk start/stride/stop; sit/stand; reach/retract; hand-to-device; speak/raise hand; pause before reaching; enter/leave through threshold. No random NPC stare, recoil, embrace or angry gesture. Ambient body motion is neutral; emotionally specific NPC body language requires a source claim or explicit author confirmation because it can imply motive.

Each recipe has contact anchor, lead/hold/release phases, collision envelope, facing coverage, reduced-motion pose and caption. Hand/prop attachment is authored per body family; no floating phone. Leaving visibly crosses a threshold. Raise-hand speaking need not invent exact words; when the author has not supplied the player's hypothetical sentence, enact the intention with a caption and gesture rather than synthetic dialogue. NPC speech requires a quote or explicitly labeled paraphrase approved by the author.

Validation: feet do not slide in stops; hands meet hero props; seated height matches furniture; bodies do not interpenetrate; minimal pose remains readable in a silhouette sheet. Unsupported complex acting degrades to a held illustrated pose and text, not a physically absurd animation.

## P. Lighting

New `LightingDirector` reads kit practicals, supported time-of-day, portal state and explicit cues. Compiler chooses approved masks/exposure recipes. Base readability is mandatory: darkness cannot conceal an available essential act; focused controls keep independent contrast. Door opening can alter light only if the opening event is supported; phone light follows its actual screen state.

One dominant pool, one secondary fill, contact shadows tied to placement. Baked texture carries material; runtime light masks provide local variation. Avoid universal vignette + pressure darkness + tint stacks that flatten faces/props. Do not redden the “wrong” choice or cool an innocent character to imply suspicion. Memory has a framing convention/label and slight surface treatment; no fabricated warm nostalgia for painful memories.

Test color-independent readability, high-contrast mode, muted palette variants and reduced transparency. A reveal can lift into paper through a presentation transition; it must not imply that the fictional room's lights actually changed.

## Q. Sound

Reuse `viviAmbience.ts` unlock/mute behavior; place execution behind `AudioDirector`. Approved recorded/produced loops and one-shots replace an all-synthetic sound identity where needed. Location-specific room tone, soft surface-specific steps, near/far perspective, low-pass filtering across a closed door and short crossfades establish continuity. No ominous sting or emotional music that asserts danger absent from the account.

Separate neutral bed from factual sound event. Shower, incoming message, train, knock and a stopped sound need evidence if relevant to interpretation. Neutral ventilation can be approved staging and listed as such; it cannot communicate a deadline. Every relevant sound has an on-screen equivalent caption/visual state. No fact available only to listeners. Use a restrained mix with comfortable levels measured on phones/headphones; do not treat V2's approximate -36 dBFS statement as a validated loudness target.

Audio follows event IDs; consumed events do not fire again on backtracking/resume. Crossfade by location adjacency; inserts do not restart beds. Backgrounding suspends sources; return resumes bed, not missed one-shots. Mute prevents source creation/unlock side effects where possible. No author voice cloning. Actual optional voice requires consent, transcript, language tag and deletion support.

## R. UI, narration and interaction presentation

Entry gives a compact hook and duration range; one gesture enters the composed world and unlocks optional audio. First scene places required context in a short author-voice line anchored to a relevant frame, then removes it from dominant attention. Do not dump a full dilemma below the world. A permanent “Context / available actions” control provides reading access.

Targets use embodied cues: a lit screen with evidence text, a visible doorway, body orientation toward a speaker, a hand near a document. Focus/hover shows one concise verb. Touch exposes a brief cue after entry and has an always-available action sheet. Do not make discovery dependent on unannounced hover. Focus markers are accessibility affordances; their appearance is restrained, not removed.

Observation couples body/attention with specific information: approach a screen → over-shoulder insert → read its actual title; hear a source-backed phrase → turn/hold two-shot → receive caption. Repeated knowledge is not another observation unlock. Optional context can deepen identification without being necessary for an informed act. No glitter trails, puzzles or collectible facts.

Narration is first-person context or labeled reconstructed staging. Separate author quote, approved paraphrase and interface command. Subtitles have stable placement, speaker attribution, configurable text size, manual continue and a transcript. No per-letter typewriter effect. Keep actual button labels in the DOM; a diegetic-looking slide/phone text can use DOM text over the plate. Confirmation is compact: exact act, confirm, cancel. Pause/mute/exit never disappear entirely.

Reveal preserves the scene's hero motif into author text; spacing and a held still do more than another panel animation. Publish/reflection controls enter only after the account. A readable view offers equivalent scene facts/actions without locomotion; it is part of the same manifest and state machine, not a separate simplified story.

## S. Current localization: EN / RU; HY future only

Keep semantic IDs/verbs independent of prose. Explicit source language beats stem detection; mixed-language quotes carry their own tag. Pin source revisions and use Unicode-aware offsets; define offsets as code-point indices over NFC-normalized source, storing a hash and exact excerpt for verification. Preserve original source separately; normalization cannot silently rewrite the author's displayed words.

UI dictionaries extend `copy.ts`; V3 has typed message keys and parameters. Scene text, quotes and author reveal each have locale variants with source provenance. Translations are opt-in compiled variants, not live model calls; never present a translated quotation as the exact original. Original author text remains accessible. A translation review verifies uncertainty, power dynamics and option meaning, not only grammar.

Current EN/RU work requires reviewed Latin/Cyrillic specimens: Russian quotes and long labels, mixed EN/RU, body text at least 16 CSS px, 200% zoom without clipping, and no font-dependent cue timing. The font pairing and measurements belong to Design and require review on named devices.

HY is deferred future localization. Current V3 requires no Armenian fixtures, typography, screenshots, QA, human evaluation or generator evaluation. Retain locale-independent IDs, DOM text and Unicode-aware provenance for future extension; do not remove or change existing V1/V2 Armenian support. No Armenian font choice or specimen work is required now.

Required text remains reader-paced in EN/RU. Movement uses physical key positions plus arrows/remapping; text/IME stays browser-owned. Recruit fluent EN/RU reviewers before claiming parity. English-authored gold specs do not themselves establish Russian coverage.

## T. Compatibility and migration

Introduce independent versions: `postSchemaVersion: 3`, `semanticSchemaVersion: 3`, `runtimeManifestVersion: 3`, compiler version and pinned asset/recipe revisions. Current `StoredPlayablePost.schemaVersion` is 2 even for Experience V2; do not conflate this with DSL V1 or the experience version.

Add a tagged playback loader in `src/engine/v3/compat/loadPlayable.ts`. V3 goes to `ExperiencePlayerV3`; V1/V2 stored posts continue through `RuntimeCompiler`/`experienceFor`/`CanonicalViviEngine`. Legacy `GameSpec` and curated hero adapters remain explicit. Do not silently expand old posts into new rooms, recompile their source, reinterpret old outcomes, or change old choice keys.

If an author chooses upgrade, create a new immutable revision with explicit review and a lineage link. Old choice records remain associated with their old decision set. Aggregate comparisons across versions only if an editorial mapping proves equivalent information and choice availability; default is separate. Existing `choiceStore.sceneKey` remains for old records; V3 uses an immutable decision-version ID, not the compiler build, so a visual bug fix does not erase first-choice continuity.

Migrate in order: versioned loader → V3 manifest validation → local player → shared input controller safely scoped per player → new kits → author preview → semantic generation → social service. Shared control repair can later improve V2, but this planning pass does not implement it. Rollback selects the old player per version; never writes a degraded V2 record over a V3 post. Missing pinned assets yield accessible still/text presentation with the same decision/evidence, or a retry if essential rendering cannot be represented.

## U. Concrete TypeScript contract

This is an architectural contract sketch, not an executable or competing schema. Foundation owns the sole executable contracts/validators and publishes a complete versioned revision for integration. The capabilities/boundaries below remain requirements; illustrative field/style vocabulary can be normalized by Foundation with owner review. A module may split files, but it must preserve the semantic/compiled/private boundary. Runtime JSON validation, caps and referenced-ID checks are mandatory; TypeScript alone validates nothing untrusted.

```ts
type Id = string;
type Locale = 'en' | 'ru'; // Current V3 scope; HY is future localization, not a launch requirement.
type Format = 'micro' | 'situation' | 'sequence' | 'memory' | 'text';
type FactId = Id;
type SceneId = Id;
type LocationId = Id;
type EntityId = Id;
type OpportunityId = Id;
type DecisionId = Id;
type BeatId = Id;

// Private author/source service record. Never sent wholesale to a viewer.
interface SourceSpan {
  sourceRevision: Id;
  startCodePoint: number;
  endCodePoint: number;
  excerpt: string;
}
interface EvidenceFact {
  id: FactId;
  claim: string;
  source: SourceSpan[];
  approval: 'verbatim' | 'author_confirmed' | 'needs_review';
  disclosure: 'before_boundary' | 'reveal_only';
  kind: 'observed' | 'hero_belief' | 'quoted_speech' | 'timing';
}
interface Tension {
  description: string;
  perspectiveActor: EntityId;
  poles: [
    { motive: string; stakeFacts: FactId[] },
    { motive: string; stakeFacts: FactId[] }
  ];
  unknowns: string[]; // Reviewable; no invented allegation.
}
interface ClaimProposal {
  id: FactId;
  claim: string;
  sourceSpanIds: Id[]; // IDs from the supplied pre-boundary source ledger only
  kind: EvidenceFact['kind'];
}
type EntityRef =
  | { kind: 'actor'; id: EntityId }
  | { kind: 'object'; id: EntityId }
  | { kind: 'portal'; id: Id }
  | { kind: 'self' };
type Gate =
  | { kind: 'beat_delivered'; id: BeatId }
  | { kind: 'fact_received'; id: FactId }
  | { kind: 'entity_at'; id: EntityId; location: LocationId }
  | { kind: 'state_is'; key: Id; value: string }
  | { kind: 'all'; gates: Gate[] }; // depth <= 2; no arbitrary expressions
type SemanticEvent =
  | { kind: 'deliver'; facts: FactId[] }
  | { kind: 'quote'; actor: EntityId; fact: FactId }
  | { kind: 'transfer'; entity: EntityId; to: LocationId; facts: FactId[] }
  | { kind: 'device_cue'; object: EntityId; fact: FactId }
  | { kind: 'portal_state'; portal: Id; state: 'open' | 'closed'; fact: FactId }
  | { kind: 'hold' }; // Presentation only, no claim of literal silence
interface SemanticBeat {
  id: BeatId;
  after: BeatId[];
  events: SemanticEvent[];
  emphasis: 'relation' | 'evidence' | 'threshold' | 'held';
  delivery: 'reader' | 'soft_flow';
}
interface ScenePlan {
  id: SceneId;
  location: LocationId;
  kind: 'inhabited' | 'insert' | 'transition' | 'memory';
  viewpoint: 'hero' | 'object' | 'remembered';
  purpose: 'orient' | 'discover' | 'reframe' | 'prepare' | 'decide';
  requiredFacts: FactId[];
  beats: SemanticBeat[];
  observationIds: Id[];
  opportunityIds: OpportunityId[];
  composition: Id; // Approved recipe family, no coordinates
}
interface PortalPlan {
  id: Id;
  from: LocationId;
  to: LocationId;
  returnPortal?: Id;
  available: Gate;
  supportFacts: FactId[];
  authority: 'source' | 'author_approved_staging';
}
type IntentVerb =
  | 'speak' | 'ask' | 'read_private' | 'leave' | 'remain_silent'
  | 'call' | 'give' | 'keep' | 'show' | 'follow';
interface ObservationPlan {
  id: Id;
  target: EntityRef;
  label: string;
  facts: FactId[];
  available: Gate;
  presentation: 'insert' | 'two_shot' | 'caption';
}
interface PreparationPlan {
  id: Id;
  target: EntityRef;
  label: string;
  available: Gate;
  supportFacts: FactId[];
  action:
    | { kind: 'reposition'; markRole: Id }
    | { kind: 'hold_own_object'; object: EntityId }
    | { kind: 'put_back_own_object'; object: EntityId };
  // Recipes guarantee reversibility and cannot change another actor's state.
}
interface OpportunityPlan {
  id: OpportunityId;
  decision: DecisionId;
  target: EntityRef;
  verb: IntentVerb;
  label: string;
  motive: string;
  fearedCostFacts: FactId[];
  feasibilityFacts: FactId[];
  available: Gate;
  window?: {
    timingFact: FactId;
    anchorBeat: BeatId;
    expiryBeat: BeatId;
    expiryFact: FactId;
    supportedMissedContinuation: SceneId;
  }; // No model-written milliseconds
}
interface SemanticPlanV3 {
  semanticSchemaVersion: 3;
  claims: ClaimProposal[];
  formatProposal: Format;
  tension: Tension | null; // null for memory/text
  actors: Array<{ id: EntityId; role: string; initialLocation: LocationId;
    supportFacts: FactId[] }>;
  objects: Array<{ id: EntityId; assetClass: Id;
    owner: { kind: 'location'; id: LocationId } | { kind: 'actor'; id: EntityId };
    supportFacts: FactId[] }>;
  locations: Array<{ id: LocationId; kitFamily: Id; supportFacts: FactId[] }>;
  scenes: ScenePlan[];
  spine: SceneId[];
  portals: PortalPlan[];
  observations: ObservationPlan[];
  preparations: PreparationPlan[];
  opportunities: OpportunityPlan[];
  primaryDecision: { id: DecisionId; scene: SceneId;
    minimumKnowledge: FactId[]; options: OpportunityId[] } | null;
  truthBoundary: { scene: SceneId; after: 'primary_act' | 'memory_end' };
  // 'paper_diorama' is an illustrative legacy planning-family token, not final art approval.
  // Foundation owns executable presentation vocabularies; Design owns recipes.
  presentation: { style: 'paper_diorama'; mood: 'intimate' | 'public' | 'uncertain';
    time: 'soft' | 'evidence_window' };
}

// Trusted compiler output, separate from semantic proposal.
interface SpatialMark { x: number; y: number; facing: string }
interface CompiledScene {
  id: SceneId;
  location: LocationId;
  kitRevision: Id;
  compositionRevision: Id;
  entryMark: SpatialMark;
  marks: Record<Id, SpatialMark>;
  routes: Record<Id, Array<[number, number]>>;
  cameraRecipe: Id;
  lightRecipe: Id;
  audioRecipe: Id;
  accessibleText: Array<{ fact: FactId; text: string }>;
}
type RuntimeEffect =
  | { kind: 'receive_fact'; id: FactId }
  | { kind: 'entity_transfer'; entity: EntityId; to: LocationId }
  | { kind: 'set_state'; key: Id; value: string };
interface ScheduledEvent {
  id: Id;
  beat: BeatId;
  after: Id[];
  gate: Gate;
  timeDomain: 'presentation' | 'narrative' | 'opportunity';
  atMs?: number; // Only compiler/confirmed timing data may set it
  effect: RuntimeEffect;
  evidence: FactId[];
}
interface PlaybackManifestV3 {
  runtimeManifestVersion: 3;
  experienceId: Id;
  revision: Id;
  decisionVersion: Id;
  locale: Locale;
  format: Format;
  spine: SceneId[];
  tension: Tension | null;
  scenePlans: ScenePlan[];
  compiledScenes: CompiledScene[];
  portals: PortalPlan[];
  initialEntities: EntityState[];
  observations: ObservationPlan[];
  preparations: PreparationPlan[];
  opportunities: OpportunityPlan[];
  facts: Array<{ id: FactId; text: string; kind: EvidenceFact['kind'] }>;
  schedule: ScheduledEvent[];
  primaryDecision: SemanticPlanV3['primaryDecision'];
  truthBoundary: SemanticPlanV3['truthBoundary'];
  assetHashes: Record<Id, string>;
  stagingDisclosure: string;
  // No actual act, author option mapping, why, after, or reveal source spans.
}
interface RevealRecordV3 {
  experienceId: Id;
  revision: Id;
  status: 'author_account' | 'fictional_editorial' | 'withheld' | 'documented';
  act?: string;
  why?: string;
  aftermath?: string;
  authorOption?: OpportunityId; // Optional manual mapping, never forced
  authorHandle: string;
  sourceRefs?: string[];
}
interface StoredPostV3 {
  postSchemaVersion: 3;
  id: Id;
  playback: PlaybackManifestV3;
  revealRef: Id; // Actual separate record in service; local demo uses fixture registry
  parentRevision?: Id;
  responseToPostId?: Id;
}
interface EntityState {
  id: EntityId;
  kind: 'actor' | 'object';
  owner: { kind: 'location' | 'actor' | 'offstage'; id: Id };
  mark?: SpatialMark;
  state: Record<Id, string>; // Keys and values enumerated in compiled manifest
}
interface RuntimeSnapshot {
  attemptId: Id;
  manifestRevision: Id;
  phase: 'entering' | 'playing' | 'transitioning' | 'confirming' |
    'enacting' | 'holding' | 'boundary' | 'reveal_loading' | 'revealed' | 'ended';
  scene: SceneId;
  location: LocationId;
  arcIndex: number;
  visitedScenes: SceneId[];
  locationMarks: Record<LocationId, SpatialMark>;
  deliveredBeats: BeatId[];
  receivedFacts: FactId[];
  seenObservations: Id[];
  consumedEvents: Id[];
  entities: EntityState[];
  variables: Record<Id, string>;
  time: { presentationMs: number; narrativeMs: number; opportunityMs: number;
    policy: 'soft' | 'untimed' | 'timed'; pauseReasons: string[] };
  decision?: { id: DecisionId; option: OpportunityId; status: 'accepted' | 'recorded' };
  reservation?: { option: OpportunityId; openedAtOpportunityMs: number };
}
type InputCommand =
  | { type: 'move'; vector: [number, number] }
  | { type: 'moveTo'; mark: SpatialMark }
  | { type: 'selectTarget'; target: EntityRef }
  | { type: 'openActions' }
  | { type: 'requestIntent'; id: Id }
  | { type: 'requestPortal'; id: Id }
  | { type: 'confirm'; id: OpportunityId; activationId: Id }
  | { type: 'cancel' }
  | { type: 'advance' }
  | { type: 'pause'; reason: string }
  | { type: 'resume'; reason: string };
```

Contract amendments needed before implementation: choose exact enumerations for asset classes/role/state keys with the first kits; generate strict schema from these vocabularies; validate every cross-reference; document public source-backed text separately from private provenance. No unrestricted JS, URL, CSS, coordinates or audio filenames from the model. `hold` cannot deliver silence as a fact. A staging portal needs recorded author approval before publication. Unknown enum means reject/repair, not nearest-world invention.

Preparations are a separate closed recipe family, not arbitrary world mutation. A model cannot mark reading a private device, crossing a forbidden threshold or handling someone else's possessions as preparation. The first rich story needs only `reposition` and an already-carried summary; the object-handling recipes can remain unsupported until a slice needs them. Remote/offstage people are represented in approved facts and accessible context unless a supported device interaction requires an explicit remote-actor extension; do not spawn them in the first location to satisfy a reference.

Default caps: 8 scenes (launch 4), 5 locations (launch 3), 8 foreground actors, 8 background silhouettes, 12 persistent story objects, 32 pre-boundary facts, 48 semantic events, 12 observations, 4 primary options, gate depth 2. Compilation checks cycles in causal dependencies; only explicitly reversible navigation edges may cycle. Text story/source caps require separate server validation; proposed expanded source limit 8,000 characters and total draft payload 24 KB remains below current 32 KB Express limit. Do not raise generation limits merely because a sequence is possible; cap output tokens and complexity independently.

## V. Runtime subsystem map and exact file responsibilities

| Proposed location | Responsibility | Current reuse / replacement |
|---|---|---|
| `src/engine/v3/contracts/{semantic,manifest,state}.ts` | One authoritative type/schema boundary | New; keep V1 DSL and V2 types |
| `src/engine/v3/compiler/{compile,validate,evidence,tension,format}.ts` | Pure plan validation, route and manifest production | Reuse pipeline/provider patterns; replace V3 semantic review policy |
| `src/engine/v3/compiler/{composition,schedule}.ts` | Allocate kit marks/routes; compile supported beats | Extract pure algorithms from `ExperienceCompiler`; no monolith extension |
| `src/engine/input/InputManager.ts` | Device normalization, ownership, held state | Replaces V3 scattered key handlers |
| `src/components/experience/v3/FocusCoordinator.tsx` | DOM scope, inert dialogs, restoration | Replaces V3 dock/menu focus effects |
| `src/engine/v3/ExperienceController.ts` | Pure reducer, effect requests, attempt lifecycle | Preserve V2 `machine.ts` contracts; new multi-scene reducer |
| `src/engine/v3/InteractionController.ts` | Attention, semantic availability, intent reservation | Reuse `availability` meaning, replace presence-only availability |
| `src/engine/v3/WorldStateStore.ts` | Persistent entities/variables/facts; atomic snapshot | New; cannot live inside renderer state |
| `src/engine/v3/SceneDirector.ts` | Spine cursor and optional excursion rules | New; replaces linear beat index for V3 |
| `src/engine/v3/ClockService.ts` | Time domains, pause reasons, deterministic event delivery | Replaces V3 wall-time/timeout mixtures |
| `src/engine/v3/BeatScheduler.ts` | Prerequisites, delivery barriers, event once semantics | Supersedes `StoryBeatRunner`/elapsed modifier authority for V3 |
| `src/engine/v3/TransitionController.ts` | Portal transaction, preload, entity transfer, focus handoff | New |
| `src/engine/v3/NavigationService.ts` | Per-kit geometry, route and collision queries | Adapt `navigation.ts`/`collision.ts` to supplied geometry, not fixed world enum |
| `src/engine/v3/presentation/{CameraDirector,MotionDirector,LightingDirector,AudioDirector}.ts` | Execute approved presentation recipes | Reuse cinematic presets, actor sampling and ambience lifecycle selectively |
| `src/engine/v3/assets/AssetRegistry.ts` | Versioned manifests, checksums, budgeted preload/cache | New; supersedes V3 `SceneArt` switch |
| `src/engine/v3/DecisionRepository.ts` | Idempotent first choice/replay/reveal access | Reuse V2 choice semantics, stable decision versions |
| `src/engine/v3/compat/loadPlayable.ts` | Discriminated loader and immutable legacy path | Wrap current adapters; no hidden rewrite |
| `src/components/experience/v3/{ExperiencePlayer,SceneViewport,ActionSheet,ReadableView,AuthorReveal}.tsx` | Shell and projections, no causal authority | `ViviPlay` routes; legacy player retained |
| `src/data/experienceV3Fixtures/` | Three source/evidence/semantic/reveal fixture bundles | Follow V2 replay discipline |
| `src/server/v3/{drafts,posts,attempts}.ts` | Future persisted author and social boundary | Later; current `server.ts` lacks these services |

The subsystem split is about ownership, not adding fourteen independent React stores. One reducer snapshot is authoritative. Services receive commands/snapshots and return effects; presentation directors sample state. UI cannot mutate world state or choose a causal event. Keep compiler and reducer runnable in node tests.

## W. State machines and event flows

```text
loading → entering → playing
                     ├─ observation → playing
                     ├─ reversible approach → playing
                     ├─ portal transaction → entering → playing
                     └─ request act → confirming
                                         ├─ cancel → playing
                                         └─ accept → enacting → holding → boundary
                                                                   → reveal_loading
                                                                   → revealed → ended
```

Observation and approach are interaction substates of playing, not independent copies of the experience phase. Pause is orthogonal: a set of reasons holds eligible clocks without losing phase. Modal scope is orthogonal to phase and suspends world input.

Act event flow:

1. Device emits normalized activation. Controller looks up current opportunity and required knowledge.
2. Select act; reserve eligibility; present exact action with explicit confirm/cancel. No write yet.
3. Confirm rechecks ID, scene, reserved opportunity and decision version; reducer accepts once and closes competing options atomically.
4. Persist first choice locally or queue an idempotent remote write. Offline persistence failure must not invent success; keep an in-memory accepted choice and a retryable outbox if remote mode is enabled.
5. Resolve body staging, using valid alternate mark/cut/text; enact actor-owned effects only. Finish by receipt/event, not a React render assumption.
6. Hold → boundary → obtain author record → reveal. Skip fast-forwards presentation, never changes the accepted act or creates an NPC reaction.

On confirmation, causal events after the primary boundary are frozen/excluded; neutral ambient rendering may remain. On retry/resume, accepted ID remains fixed. A confirm with mismatched ID or stale activation is a no-op with diagnostic, not a new choice. `SKIP` before commitment cannot expose the reveal in playable mode; “read without playing” is an explicit separate mode marked nonparticipant.

Observation flow: target → availability → route/attention → deliver fact IDs → mark received/seen → readable close → restore focus. Required knowledge can also be delivered through readable view. A missed optional fact does not block commitment. Scene excursion must return to a valid spine node; no automatic rewind of logical time.

## X. Rich multi-scene story, compiled end to end

### Editorial source: “The correction”

**Historical illustrative example:** integration uses the final source, ledger, required/optional facts and IDs in [The Correction gold pack](v3/format-proof/THE_CORRECTION.md). The older feasibility caveat below is resolved there; do not combine this example’s facts with gold-1.

This is a **new fictional editorial test story**, not a real submission and not a retrofit of V2's office fixture. All details below belong to its explicit source. The first slice must carry the fictional label throughout.

Pre-boundary account:

> I was on a six-month contract. My team lead, Mira, wrote the recommendation that would decide whether I stayed. I had spent six weeks building the forecast she was about to present. At my desk, I opened her slide deck: the title said “Mira's forecast.” Yesterday I had asked about credit. She said, “Let me lead this one. I'll mention your work.”
>
> I walked to the meeting room with my own printed summary. The director looked at the title slide and said, “Mira, this could become our board proposal.” Mira began showing the figures. I recognized the change I had made the previous evening. I hadn't heard my name.
>
> Before questions, we had a short break. I stepped into the hallway. Mira stayed in the meeting room; the door was open. I could go back to my seat or stand nearer the director when we resumed. I looked at my summary, with my name at the top. When I returned, the director asked, “Anything to add before we use this?”

Private reveal:

> I said, “I built the forecast, and I can explain the revision.” My voice shook. Mira did not look at me. After the meeting she said I had embarrassed her. I kept the contract, but she stopped inviting me to preparation meetings.

Why:

> I could accept not being the presenter. I couldn't accept watching my work become hers in the board proposal.

Aftermath:

> A month later, the director asked me to present the next update. I still don't know whether speaking helped my contract or nearly cost it.

The player never sees the private material before acting. The source establishes tension without deciding Mira's motive or predicting career damage. Physical preparation changes a position, not her response.

### Evidence ledger

| ID | Public evidence / role | Delivery |
|---|---|---|
| f1 | Contract + Mira's recommendation power; hero belief about stakes | Desk context |
| f2 | Six weeks' work + title credit | Desk slide insert |
| f3 | “I'll mention your work” promise | Desk author recollection; labeled past quote |
| f4 | Director's board-proposal quote | Meeting beat |
| f5 | Recognized revision; no name heard so far | Meeting viewpoint caption; not omniscient proof of intent |
| f6 | Break/hallway/open door/Mira stays | Supported portal beat |
| f7 | Own named printed summary | Hallway insert; persistent object |
| f8 | “Anything to add…” | Return decision beat |
| r1–r4 | Actual speaking, response, why, aftermath | Reveal-only separate record |

Semantic proposal: format `sequence` (target 75–110 s); tension recognition/dignity versus career protection; three locations; four scenes `desk → meeting_before → hallway → meeting_question`. One primary decision; no reaction branches. Unknowns: whether Mira will credit later, how speaking will affect recommendation, director's understanding. “Mira is stealing intentionally” is not a fact.

Entities: hero `a_me`; lead `a_mira`; director `a_director`; summary `o_summary` owned by hero; slide `o_slide` in meeting; desk deck is an insert of that content with scene-specific view, not a duplicated physical slide object. The hero's summary persists across scenes. Kit includes only source-compatible background silhouettes; no invented judging crowd.

### Compiled scenes

| Scene | Kit/frame | Player freedom / information change | Exit rule |
|---|---|---|---|
| s1 Desk | Office desk, over-shoulder then held side view | Read credit, revisit promise and contract context; optional inspect own summary | “Go to meeting” once f1–f3 delivered; no act yet |
| s2 Meeting | Public wide, screen insert | Sit/approach screen via accessible intent; hear f4; recognize f5 | Source break beat after required evidence, reader advance |
| s3 Hallway | Threshold composition, neutral fluorescent practical | Review f7, stand at open threshold or return; meeting actors remain where source says | Reversible hall/meeting portal; “Resume meeting” advances spine |
| s4 Meeting return | Same location state, changed relation frame | Choose seat or nearer director before quote; hear f8; reconsider summary | Primary options, no automatic expiry |

“Resume meeting” closes the break staging and delivers the question once. After this, backtracking to an earlier historical beat is not possible; readable transcript remains. A player can move to the local open threshold without undoing the question. If meaningful leaving from the question is offered, it is an explicit act and must have author-confirmed feasibility; it is not included automatically.

Options: speak about own work (protect credit; feared recommendation cost); ask to clarify authorship privately after (protect relationship; risk allowing attribution now); remain silent through this question (protect contract relationship; risk losing visible ownership). The author must confirm that requesting a private clarification was feasible; if not, ship two supported options. Generated speech text does not pretend to be a historical quote. Reversible movement nearer the director does not make speaking inevitable and is not counted socially.

Compiler derives kit marks, routes around table, summary attachment, matched return frame, light masks and room-tone perspective. Required facts f1/f2/f4/f5/f8 are delivered before options; f3/f7 deepen the tension but remain available in context. No deadline, alarm, staring crowd, applause or angry posture. Beat duration adapts to reading; soft presentation holds between meaningful changes.

### Example semantic fragment and deterministic derivation

```json
{
  "scene": "s4",
  "location": "meeting",
  "purpose": "decide",
  "beat": {"id": "b_question", "after": ["b_resume"],
    "events": [{"kind": "quote", "actor": "a_director", "fact": "f8"}],
    "delivery": "reader", "emphasis": "relation"},
  "opportunity": {"id": "speak", "decision": "d_credit",
    "verb": "speak", "target": {"kind": "self"},
    "label": "Say I built the forecast", "fearedCostFacts": ["f1"],
    "feasibilityFacts": ["f8"],
    "available": {"kind": "beat_delivered", "id": "b_question"}}
}
```

This is an explanatory fragment, not a complete valid manifest. The deterministic compiler binds `speak` to the hero's current supported speaking mark, assigns a raise-hand/speak pose, uses a held two-shot, and reserves the option through confirmation. It derives no exact counterfactual sentence and no director response.

If player speaks: explicit confirmation → hand lifts/body turns → caption “You say the forecast is your work” → held frame → boundary → author's actual words. If player stays silent: confirmed “Remain silent through this question” → seated hold → same boundary → author speaks in the account. No fake scene in which the director credits Mira because the player stayed quiet. First choice recorded against `d_credit` version; position/inspection only diagnostic, not moral scoring.

End-to-end acceptance: 4 scenes/3 locations, one persistent summary, stable meeting actors on return, no duplicate quote, both ways of positioning accessible by keyboard/tap, source-only facts, same primary options in readable view, and a player who can explain why speaking and silence both have costs before reveal. If hallway travel adds no felt hesitation in testing, collapse it to a short threshold insert; multi-location is a hypothesis, not a sacred requirement.

## Y. One dense 20-second micro moment

**Historical illustrative example:** [The Introduction gold pack](v3/format-proof/THE_INTRODUCTION.md) owns the final complete source and separate act/why/aftermath for integration.

New fictional editorial story, “The introduction.”

Before: “At my first dinner with my partner's family, his mother introduced me to a neighbor as ‘his friend.’ We had been together for two years. My partner heard it and kept setting the table. His mother was paying our rent while I looked for work. The neighbor smiled at me and waited.”

Separate author account: “I said, ‘I'm his partner.’ I wanted him to hear me say it. His mother changed the subject. On the way home he told me he had been afraid of losing her help.” Why: “I didn't want another evening spent pretending.” Aftermath may be absent; do not invent reconciliation.

One dining tableau: hero at threshold/table edge, partner setting table (explicit fact), mother nearby, neighbor facing introduction. Hook gives duration; 0–4 s enter/context, 4–9 s source-backed introduction and financial context, 9–15 s attention/choice, 15–20 s chosen act/held boundary. These are nominal pacing targets; text/choice time is unlimited. Options: correct introduction, let it pass. The second option is a confirmed act, not a timeout. No compulsory walking/observation. Tap/Enter/action sheet all reach the same options.

Specific detail is the distance between hero and partner, not a miniature maze. Two years versus dependent rent assistance supplies real tension. Author words reveal a human motive rather than an answer key. This micro fails if players infer a fact not stated, cannot understand financial dependence, or find the mother's lighting coded as villainy. Shortness is acceptable; missing context is not.

## Z. Model output versus deterministic derivation

| Concern | Semantic model may propose | Trusted author/compiler/runtime owns |
|---|---|---|
| Tension | Motives/costs from referenced source | Review evidence, distinguish belief from outcome, gate quality |
| Scenes | Boundaries, purpose, source order | Graph validity, caps, kit compatibility, approved excursions |
| Actors/objects | Role/class and source reference | Identity approval, asset selection, ownership, geometry, locomotion |
| Observations | Target + useful source-backed fact IDs | Availability, reachable approach, delivery and accessible equivalent |
| Commitments | Feasible intents, motives, source evidence | Consequential classification, explicit confirmation, idempotency |
| Time | Sourced ordering/window references | Clock policies, duration from confirmed facts, pause/expiry/reservation |
| Camera | Emphasis family | Shot/crop, safe frame, transition, motion accessibility |
| Light/sound | Supported environmental semantics | Reviewed kits/practicals/audio mix; no dramatic invention |
| Truth | No authority to set actual act/why/after | Separate author record, provenance, release |
| Social | No invented data | Genuine storage, cohort definitions, moderation, consent |

The engine's staging freedoms are bounded too. A procedural “neutral” default cannot add a suspect silhouette, private document, dramatic silence or exact countdown. Source-backed facts and approved non-informational staging are distinct fields in author review.

## AA. Testing strategy

Keep the current V2 tests as compatibility coverage. Add V3 tests that assert externally meaningful invariants rather than mirror function internals:

- Schema/evidence: invalid IDs, malformed spans, contradictory locations, invented quotes/timing, future facts and arbitrary script keys fail closed; one repair cap; author ending canaries absent from requests, repair, public manifest, assets/text and cache diagnostics.
- Reducer/scheduler: event logs replay identically at 60/30/10 FPS; hidden/blur/modal pauses preserve opportunity; required text barriers cannot be skipped by late ticks; each event/act/transfer occurs once; stale confirmations rejected; skip cannot bypass decision; accepted intent reserves a window.
- Navigation/scene graph: art-aligned geometry, routes and alternative marks reachable, actor/entity single ownership, backtracking does not duplicate props/cues, preload failures recover, no stale async swap, accessible fallback preserves options.
- Browser behavior: scroll/focus/control matrix in D; test Enter from initial entry through reveal, held Enter, arrows in modal, Shift+Tab escape, long observation, contenteditable and IME, touch scroll/tap, resize and camera inverse mapping. Use browser automation under Chromium/WebKit, then actual iOS/Android checks.
- Presentation: screenshot/contact-sheet review at 390/768/1440 px and 200% zoom; anchor/foot contact checks; sound-on/off equivalence, autoplay/mute lifecycle, reduced motion, high contrast. Visual baselines catch regressions, not taste.
- Storage/service later: duplicate choice requests, network timeout after server acceptance, resume, corrupted local snapshot, changed decision version, deleted post/author account, authorization and aggregation filtering.

Suggested harness locations: `scripts/test-experience-v3.ts` for pure invariants; `tests/browser/experience-v3.spec.ts` for real DOM events; `scripts/eval-experience-v3.ts` for generation evidence/format audit. Select browser automation tooling at implementation time after checking repository/tooling compatibility; it is not currently present in package scripts. Do not add dependencies in this planning pass.

## AB. Human evaluation: product success is separate

Two rounds of 8–12 target players, with desktop keyboard and phone participants; recruit EN/RU fluency and at least one assistive-technology user across rounds. This is formative research, not a statistically powered market claim. Avoid relying entirely on friends who know the source stories. Counterbalance story order and V2/V3 comparison; separate think-aloud control sessions from uninterrupted atmosphere sessions.

Before reveal, ask after play or at a natural boundary: “What matters to you here?”, “Why might someone take the other act?”, “What don't you know?” Do not prime them with the values rubric. Measure whether they can name both costs, whether they care what the author did, and what physical detail they remember. After reveal: “Did you learn something about the person?”, “Did anything feel invented?”, “Would you send this setup to someone or tell your own?” Record spontaneous comments and behavior, not only ratings.

Provisional advancement gates for each slice: at least 8/10 unassisted participants complete controls; at least 7/10 explain the competing motives in their own words; at least 7/10 want the author's account before seeing it; at least 7/10 identify one scene-specific physical detail; zero recurring truth misunderstandings or inaccessible primary acts. Small samples mean these are iteration thresholds, not estimates of population success. Any critical control/accessibility failure blocks regardless of average score.

Track completion, time in scene, optional discovery, cancellations, reveal continuation and response intent as diagnostics. Long dwell may mean confusion; fast commitment may mean clarity or indifference. Do not optimize hesitation duration or force emotional intensity. A player choosing immediately but understanding both costs can be a success.

General generation reopens only after all three slices pass two reviewed iterations. Compare the rich sequence against an edited one-room version: if multiple rooms do not improve understanding/care, simplify. Compare the micro against text-only: if it adds no presence, use text. Technical quality and emotional quality appear as separate columns in QA reports.

## AC. Performance and mobile implications

Targets to validate, not measured claims: one active location; at most next scene preloaded and previous scene cached within a decoded-memory cap; 30 FPS sustained low-end phone floor, 60 FPS on capable devices; no navigation/input tasks longer than 50 ms during steady play; core input response within 100 ms; cached transition visually ready within 250 ms and cold scene transition within 1 s on the stated test network.

Initial delivery budget: player code increase <=150 KB gzip over measured baseline; first kit scene compressed art <=1.5 MB plus shared character assets <=750 KB; optional first audio <=300 KB; later scene <=750 KB when reusing the kit. First complete experience target <=5 MB of uncached assets. Decode budget <=64 MiB for active/cached scene imagery and figures on the low-end profile, excluding browser overhead. A 2048×1200 RGBA plate costs about 9.4 MiB decoded; layering several full-resolution plates can exceed the budget despite tiny compressed downloads. Use trimmed layers, mobile sizes, bounded cache and explicit bitmap/resource disposal.

Bake texture instead of SVG turbulence/filter stacks; avoid repeated giant blend surfaces. Sample positions imperatively inside the isolated presentation layer; do not force full React tree state updates per actor per frame. Semantic UI updates only when facts/options/phase change. Path plans cache by kit geometry + obstacle revision; moving actors do not create unlimited global path cache keys. Reuse pure sampled actor motion where appropriate; no offscreen simulation render loops.

Use `PerformanceObserver`/frame measurements in the eventual harness, identify actual devices/network settings, and report worst transition/decode peaks, not only average FPS. If composited DOM fails the low-end budget after profiling, replace `SceneViewport` internals with a Canvas2D sprite layer while keeping DOM controls and controller contracts. Do not migrate the whole product to WebGL preemptively.

## AD. Cost implications

Historical evidence only: compiler hardening measured roughly $0.000770/story for its full run and $0.000828/story for holdout, with around 493–537 average output tokens; see [the report](../reports/compiler-quality-hardening-v1.md). These are prior runs, not a V3 forecast or current provider price quote. V2's changed contract had no fresh live benchmark. Do not claim “cheap V3” by multiplying historical success rates.

V3 expected semantic proposal size: micro 500–900 output tokens, situation 1,200–2,500, sequence 2,500–4,000, to measure during reopening. Prompt/schema/input grow too. Formula per compile: input tokens × contracted input rate + output tokens × contracted output rate + actual repair usage. Track provider-reported cost/usage, cache hit, accepted publication, downgrade, latency and correction burden. True unit cost is **cost per author-approved good post**, not per valid JSON.

Planning ceilings, subject to current model rates at implementation: median <$0.005 for micro/situation, <$0.02 for sequence; one repair maximum; 4,000 output-token cap; no provider escalation loop. Cache by tenant/source hash + source revision + contract + provider + author corrections/staging approvals; private sources must not cross-tenant cache accidentally. Compiler output is cached/pinned by semantic, asset and compiler revisions. Playback has zero model cost but incurs asset transfer/storage and eventual social-service cost.

Largest near-term cost is art/interaction design and human QA. Four-week resource assumption: two engineers, one illustrator/motion designer and one product/research lead, with overlapping expertise acceptable. If one engineer is available, ship one kit, two slices and defer general generation rather than pretending the full plan fits. Asset amortization: kit production cost / accepted posts using kit, plus ongoing art QA. No unique art per post. No paid provider benchmark or art production was run for this plan.

## AE. Security, privacy and truth

Separate pre-boundary author data from reveal at the service boundary and in types. Public manifests contain only approved pre-boundary facts, not private source excerpts or the full author source. Spoiler leakage tests inspect titles, alt text, thumbnails, asset IDs, URLs, notes, compiler traces and author option mapping, not just `reality`. Cache/log keys cannot contain raw sensitive stories; current normalized-story cache pattern should be replaced for persisted/shared systems with scoped hashes and bounded retention.

Model input is untrusted narrative, not instruction. Schema rejects scripts, URLs, asset paths and runtime expressions; all text is rendered as text, no raw HTML. Enforce limits on source/body, references, graph size, labels, allocations and async preloads. Server credentials remain server-side; generation guard is currently in-memory/single-process, so public multi-instance deployment needs a shared budget/rate store. These requirements concern future public release, not a new deployment in this pass.

Author review distinguishes exact fact, belief, approved paraphrase and staging. “I feared firing” cannot become “I would be fired.” Kit ambience, age/identity depiction and invented architecture can change interpretation: show staging choices for approval. No synthetic reaction branch presented as the historical event. No “real story” attribution for editorial tests. Documented history needs citations and source rights; an author's account is attributed testimony, not independent verification.

Privacy defaults: pseudonymous figures, no inferred likeness, private explanations, minimal telemetry containing IDs/modes and timing buckets rather than text or raw movement paths. For research, record consent and retention separately. Public quotes/reflections require opt-in, withdrawal and moderation; sensitive source and reveal records can be deleted together with derived manifests. Avoid victim-blaming or crowd moral verdicts. Do not introduce fake users, fake urgency, or invented social proof to improve conversion.

## AF. Phased implementation and acceptance

| Phase | Work, in dependency order | Exit gate |
|---|---|---|
| 0: Format proof | Source/evidence sheets; 3 storyboards; art contact sheet; clickable interaction/reveal prototype | Product + authoring reviewers approve motives, boundary and mobile composition |
| 1: Ownership foundation | V3 contracts/loader; reducer; InputManager/FocusCoordinator; readable actions on existing placeholder plates | Browser input matrix passes; no runtime model dependency; V2 immutable |
| 2: First sequence | Clock/scheduler; persistent world; portals; office 4-scene hand-authored fixture; one act/reveal | Rich example X passes technical gates and first human round |
| 3: Authored look | Office kit, hero props, body recipes, camera/light/audio; micro and domestic slice | All 3 work on phone/keyboard, mute/reduced motion, second human round |
| 4: Author contract | Preview scene strip, evidence approvals, tension review, pinned revisions; memory/text route | Independent author can correct wrong detail without editing code or corrupting boundary |
| 5: General semantics | New strict semantic schema/provider adapter; one repair; holdout eval | Evidence/quality audit + author review; no ungrounded playable publish; actual costs measured |
| 6: Public social | Persisted posts/accounts or declared guest identity; first-choice/reveal APIs; privacy/moderation | Genuine comparison service, deletion/authorization tests, controlled release approval |

Phase 5 starts only after 0–4's format evidence; phase 6 is independently scoped. Within a phase, build one complete user path before adding another subsystem's full option set. Each release keeps a V2 rollback path and pins V3 manifests/assets. Feature flag a local/dev V3 route first; do not overwrite production post generation by default.

## AG. First vertical slice

Build **“The correction”** first: one office kit, three locations/four scene views, persistent summary, optional hallway excursion, explicit speak/private request/silence, soft time, truthful enactment and author encounter. Start on hand-authored semantic input and the ordinary V3 deterministic compile path; no special renderer branches keyed to its story ID. This slice validates the difficult graph/state/input/reveal parts together. Assets can begin as composed approved sketches, but it must acquire the intended visual language before product evaluation.

Minimum acceptance: no arrows scroll while movement owns input; Enter always has a visible defined result; modal typing never moves a body; return retains actors/objects/facts; quote delivered once; reading does not miss choices; all actions available via keyboard/touch/readable mode; author content absent until boundary; no invented reactions; playable from entry to author why on a real phone; participants understand both costs and want the author's account. If the team cannot achieve this, do not expand the generator.

### First three hand-authored stories before general generation

The following sketches are historical format examples. The [gold pack](v3/format-proof/README.md) owns final source/IDs/acts: Correction 4 views/3 locations; Introduction 1/1; Spare Key 3/2 with an in-scene phone insert. No extra phone scene or room is required.

1. **The correction** (X): 75–110 s, 4 scenes/3 locations; dignity versus recommendation risk; persistence, return, quote/attention and public speaking.
2. **The introduction** (Y): nominal 20 s, 1 scene; recognition versus material dependence; proves density and no-walking format, reveal rhythm and readable parity.
3. **The spare key**: nominal 60–90 s, 3 scenes/2 locations with an in-scene phone insert; loyalty versus a personal boundary. Fictional source: “My sister had a key to my apartment while I worked nights. We had agreed she would ask before coming over. At home I found her coat and school bag on the chair. Her message said, ‘I'm in the hallway. Please don't tell Mum I'm here.’ She had told me earlier that she'd argued with Mum, but not why. In the hall she said, ‘Can I stay tonight?’ I had promised my partner that we would have the flat to ourselves before an early medical appointment. I didn't know whether my sister had anywhere else safe to go.” Author decision and aftermath are separate hand-authored fields: author lets her stay, tells partner first, later learns she had missed the last bus; no claim that the mother's argument was abusive. Options require author-approved feasibility: invite her in now; ask what happened before agreeing; say tonight cannot work and offer to help find somewhere. Stop after the chosen intention, before sister's hypothetical answer. The story tests uncertain information, a real threshold, carried phone evidence, two people with different claims on the hero and an unknown that must remain unknown.

The third story's “ask what happened” is a consequential primary act in the launch slice, so it ends at the boundary; it does not generate an answer and then continue into another choice. If reviewers feel this boundary makes the story unsatisfying, revise the source/intake or make it a memory sequence, rather than fabricating the sister's answer. No real timer in any of the three. These are new editorial test accounts, labeled fictional; later validate format with consenting real contributors.

## AH. What not to build yet

No eight-room adventure maps; free NPC AI; generated dialogue during play; inventory economy; multiplayer; physics simulation; procedural 3D; universal asset generator; facial emotion classifier; author voice cloning; generalized branching outcomes; repeated consequential choices without a truth reset; real countdowns in the first slices; personalized moral scores; fabricated community; social backend before the format earns it; node editor as required author UI; automatic migration of existing posts.

Do not spend the four weeks polishing ten world templates, supporting every pose, changing models by intuition or expanding provider budgets. Do not build a global content-ranking algorithm to compensate for weak stories.

## AI. Risks and failure modes

| Risk | Early signal | Mitigation / stop rule |
|---|---|---|
| Sequence becomes padded slideshow | Players cannot explain why hallway mattered | Cut scene or use insert; measure against shorter control |
| Freedom suggests nonexistent branches | Players expect an answer after asking or a new room behind every door | Clear affordance classification, exact boundary, only supported portals |
| Soft time feels frozen | Actors loop unnaturally; pauses look like broken AI | Stable held composition, neutral motion, fewer loops; no invented activity |
| Timed windows punish readers | High missed rate in slow-reading/accessibility sessions | Ship untimed default; later opt-in timing with evidence and equal content |
| Art kit sameness | Players remember identical room more than story | Strong compositions/hero details and limited reviewed variants; expand kits by evidence |
| Dramatic art lies | Players infer guilt/danger from grade/pose | Blind factual-inference review; neutralize effect |
| Evidence ledger feels reliable but isn't | Valid spans cite unrelated sentences | Entailment review + author confirmation; zero claim of automated truth certification |
| Small-model V3 contract is too hard | Repair/downgrade grows, graph errors frequent | Lower scene caps, named records, fewer semantics; do not remove grounding |
| New subsystems become framework overhead | Team builds abstractions without a complete slice | One reducer, one office kit, narrow recipes; defer unused generality |
| Multiple clocks drift | Actor arrives before caption/state, expiry during load | Single scheduler with explicit domains and receipts; render-only rAF |
| Reveal remains a form | Players leave before why or notice CTA first | Strip note/social until after account, hold motif, user-paced aftermath |
| Four-week scope is too large | End of week 2 has no playable sequence | Drop general generation/social/timers; ship format proof, not partial platform |

## AJ. Four weeks: exactly what I would ship

Assumption: two engineers, one illustrator/motion designer, one product/research lead; no public deployment is implied by this plan. The shipped artifact is a reviewable V3 candidate on a feature branch/dev route, three editorial experiences, author preview and measured QA—not a claim of a finished public social network.

**Week 1:** engineer A implements scoped input/focus and the V3 loader/reducer; engineer B implements strict manifest/evidence checks, basic clock and scene transaction using hand-authored input. Artist makes office/mobile compositions and figure silhouette/hero prop sheet; product lead writes/validates all three source ledgers and tests a clickable reveal. By Friday, keyboard entry → observation → confirm → enact → author account works in one placeholder scene; arrows never scroll under owned input, Tab escapes, typing works. Freeze semantics if that path is unreliable.

**Week 2:** finish The correction across desk/meeting/hallway/return with persistent summary, required facts and soft time. Integrate first finished office layers, character poses, matched frames and sound/mute equivalent. Run first 8–12 participant round, source-inference audit and real-phone control checks. Friday gate: the complete sequence is coherent and demonstrably better than its shorter control on understanding/care; otherwise cut scenes and iterate.

**Week 3:** finish The introduction and The spare key with the same compiler/controller; add domestic threshold kit and a minimum motion/sound vocabulary. Add readable mode, EN/RU typography specimens, reduced motion and restored-focus tests. Build author scene/evidence preview with manual corrections and version pinning; keep semantic input hand-authored. Run second human round. Friday gate: three distinct formats, no new invention, reliable phone/keyboard paths, acceptable frames and author encounter.

**Week 4:** resolve observed failures; finalize asset byte/decode budgets, snapshot/resume, fallback and compatibility audit. Report controls, truth, product understanding/care, art and performance separately. If all three pass, wire a small development-only V3 semantic provider adapter and replay/holdout harness within the one-repair budget, leaving general production generation disabled pending live evidence. If they do not pass, spend the week on format revision, not provider plumbing. No paid/live benchmark without a separately established budget.

Deliver: V3 candidate for the three stories, strict compile/replay path, scoped input, 1–4 scenes/3 locations, persistent state, soft time only, paper diorama assets, accessible readable path, paced author reveal, local first-choice/replay/private notes, corrected author preview, versioned loader and a candid QA/human report. Defer public social persistence, real timers, wider kits, multi-decision branching and automatic upgrades.

The final acceptance decision is not “all tests passed.” It is whether people can enter without fighting controls, feel a specific human tension, discover something through the scene, care about the author's account, and trust the boundary between their act and what actually happened.
