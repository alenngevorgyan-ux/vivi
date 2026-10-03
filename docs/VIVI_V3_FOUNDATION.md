# Vivi V3 — Phase 1 foundation

Branch `implementation/vivi-v3-foundation`, from `origin/planning/vivi-experience-v3` (`02f4c6c`).
Source of truth for product and architecture: [`VIVI_EXPERIENCE_V3_MASTER_PLAN.md`](VIVI_EXPERIENCE_V3_MASTER_PLAN.md).
This document records what was built, the exact rules, where the plan was adjusted, and where other work plugs in.

Scope: the smallest correct runtime substrate for a hand-authored 1–4 scene sequence. No art, no characters, no story content, no generator, no timers, no deployment. V1/V2 are untouched.

## Run it

```bash
npm run lint
npm test                      # includes the 31 pure V3 checks
npm run build
npm run test:v3-unit          # pure layers only
npm run test:v3-browser       # real Chrome, real keyboard/mouse/touch (needs Google Chrome, or V3_BROWSER_PATH)
npm run test:v3-foundation    # both
npm run dev                   # then open /?v3=foundation (dev builds only)
```

The one new dev dependency is `playwright-core`: no test runner and no browser download; it drives the system Chrome. The master plan suggested `tests/browser/experience-v3.spec.ts`; a `.spec` file implies `@playwright/test`, so the browser tests are a plain script (`scripts/test-v3-browser.ts`) in the repo's existing `scripts/test-*.ts` style.

## Map

| Path | What |
|---|---|
| `src/engine/v3/contracts/semantic.ts` | Model/author-facing proposal types, closed vocabularies, caps |
| `src/engine/v3/contracts/manifest.ts` | Public playback manifest, stored post, private `RevealRecordV3` (separate), versions |
| `src/engine/v3/contracts/state.ts` | `RuntimeSnapshot` (one serializable authority), phases, clock state |
| `src/engine/v3/contracts/validate.ts` | Runtime validation: closed keys, enums, caps, cross-refs, graph, forbidden content; `findPrivateLeaks` |
| `src/engine/v3/compat/loadPlayable.ts` | Discriminated loader |
| `src/engine/v3/ExperienceController.ts` | Pure reducer `step(manifest, snapshot, event)`; `deriveScopes`, `restoreSnapshot` |
| `src/engine/v3/TransitionController.ts` | Portal transactions |
| `src/engine/v3/ClockService.ts` | Pause owners and time domains (state only, no timers) |
| `src/engine/v3/queries.ts` | Shared availability (gates, portals, opportunities) |
| `src/engine/v3/readable.ts` | Readable projection + the events that perform each item |
| `src/engine/v3/testing/foundationFixture.ts` | Neutral fixture (not a story) |
| `src/engine/input/routing.ts` | Pure ownership table |
| `src/engine/input/InputManager.ts` | DOM adapter: the single input owner |
| `src/components/experience/v3/FocusCoordinator.tsx` | DOM focus ownership, dialogs, inert, restore |
| `src/components/experience/v3/useExperience.ts` | Binds the reducer to React; syncs InputManager scopes synchronously |
| `src/components/experience/v3/V3FoundationPlayer.tsx` | Placeholder shell (no art) |
| `src/components/experience/v3/V3Harness.tsx` | Dev-only harness at `?v3=foundation` |
| `scripts/test-v3-foundation.ts`, `scripts/test-v3-browser.ts` | 31 pure + 16 browser checks |

`App.tsx` changed in two small ways: `handleEnterPost` now asks `loadPlayable` and refuses V3/invalid/unknown items instead of handing them to the legacy player (V1/V2 take exactly the old branch), and the dev-only harness route. Nothing else in V1/V2 changed.

## InputManager: exact ownership rules

One manager per active player; one capture-phase `keydown`/`keyup` listener decides, then calls `preventDefault()` **synchronously and only for keys it owns**.

Context priority, highest first: `text_entry > modal > intent_sheet > observation > transition > world > page`. Only the highest eligible context handles a command. `text_entry` is derived from the event target (input/textarea/select/contenteditable/textbox roles; IME composition and dead keys always belong to the editor). `modal`, `intent_sheet`, `observation`, `transition` come from the controller snapshot (`deriveScopes`) and are pushed to the manager synchronously on every state change. `world` means the dedicated surface has focus.

| Key | Focused world surface | Anything else |
|---|---|---|
| Arrows / physical WASD (by `code`, so RU/HY layouts work) | **Consumed, never scrolls**, including while repeating. Locomotion `move` only if the world is the top scope and movement is eligible; otherwise one hint (`movement_blocked`) per focus and still no scrolling | Native. Never intercepted on buttons, links, editors, or the page |
| Enter | The single semantic `activate` command (a held key is swallowed: one press, one command) | Native activation, untouched |
| Escape | Closes the highest *closable* scope (`modal` → `intent_sheet` → `observation`); with none, cancels selection; with nothing to cancel releases to the visible "Enter scene controls" button. Not handled during `transition`/enactment (no undo). From a text field it still dismisses a dialog (dialog policy) unless composing. A held Escape does not cascade | Same dialog rule; otherwise native |
| Tab, Space, anything with Ctrl/Meta/Alt/Shift | Native, always. The surface never traps focus | Native |

Held movement is released immediately (a `move [0,0]` intent with a reason) on: window blur, `pagehide`, tab hidden, focus leaving the surface, any scope opening, movement becoming ineligible, pointer cancel / lost capture, surface removal, and `dispose()` (route change). Key-up is honoured wherever focus has gone, so a key cannot stay stuck.

Pointer/touch: a tap on the stage focuses the surface (`preventScroll`) and emits `activate {source:'pointer', point}` (normalised surface coordinates; the inverse-camera hit-test is the later viewport's job). Pointer-down does nothing; movement past a 10 px slop makes it a scroll, not a tap; `touch-action: manipulation` leaves native vertical scrolling intact.

**Activation ids.** Every physical activation has an id: keyboard presses `k<n>` (a click produced by the keyboard reuses its press's id, so a held Enter on a button, which repeats `click`, is one activation), pointer clicks `p<n>` (the second click of a double click reuses the first's id). The controller spends an id on at most one state change.

## Exact Enter behavior

In the focused world, Enter dispatches `ACTIVATE_CONTEXT`. It **opens something and never commits anything**:

1. a selected target with exactly one available observation and nothing else → opens that observation;
2. a selected target with other actions → opens the target's action sheet;
3. no selected target → opens the sheet listing everything available.

Selecting an act (`REQUEST_INTENT`) and confirming it (`CONFIRM`) are separate activations with separate ids; confirmation opens with focus on the exact act's heading (not on a button a stray key could press), then Confirm and Cancel. Enter on a focused native button activates that button only; the manager does not see it. One keypress cannot open and confirm; key repeat cannot double-confirm; the decision is recorded once (duplicates are no-ops).

## State machine

Phases: `loading → entering → playing → transitioning → confirming → enacting → holding → boundary → reveal_loading → revealed → ended`. Observation, sheet, modal and selection are sub-state of `playing`, not phases. `transitioning` is added to the plan's list (its snapshot type already had it).

```
loading ─LOADED→ entering ─ENTERED→ playing ⇄ transitioning ─READY→ entering ─ENTERED→ playing
playing ─REQUEST_INTENT→ confirming ─CANCEL→ playing
                                   └CONFIRM→ enacting ─ENACTED→ holding ─HOLD_DONE→ boundary
                                              └──────────SKIP───────────────────────┘
boundary ─BOUNDARY_DONE→ reveal_loading ─REVEAL_LOADED→ revealed ─END→ ended   (REVEAL_FAILED/RETRY_REVEAL keep the act)
```

The reducer is pure (`step(manifest, snapshot, event) → {state, effects, rejected?}`), runs in Node, performs no side effect, and never throws on malformed events. A rejected event returns the very same state object plus a `diagnostic` effect carrying only a code. Rejection codes include `locked`, `duplicate_activation`, `stale_confirmation`, `stale_transaction`, `duplicate_decision`, `decision_closed`, `knowledge_missing`, `ahead_of_arc`.

Guarantees tested: idempotent decision; stale/duplicate activation rejection; **truth-boundary lock** (after `CONFIRM` only presentation, pause and reveal progress remain; no portal, observation, preparation, beat or selection); `SKIP` fast-forwards presentation of an accepted act and can never create one; reveal failure keeps the accepted act and never asks for a second choice; resume (`restoreSnapshot`) validates against the manifest revision, normalises in-flight state, and never reopens a choice.

## Multi-scene state and portals

The snapshot owns: scene, location, `arcIndex` (furthest spine scene reached; excursions never move it), visited scenes, delivered beats, received facts, seen observations, consumed events, entities (owner = location / actor / offstage; marks; enumerated state), variables, active reversible preparations with exact undo, decision, reservation, transition transaction, clock.

Portal transaction: `REQUEST_PORTAL` (eligibility recheck, freeze selection/sheet/observation, pause `transition`, deterministic id `tx<n>`) → host preloads → `TRANSITION_READY(txId)` atomic swap (scene, location, hero transfer — carried objects follow their owner — visited, arc for spine portals) → phase `entering` with a `focus_handoff` effect → `ENTERED`. Failure before the swap restores the source; late or duplicate completions are rejected by transaction id; a second request while one is pending is `busy`. Only the hero moves; nothing else resets or duplicates on return (tested: A → B → A → B → C).

## Contracts and validation

`validateSemanticPlan`, `validateManifest`, `validateStoredPostV3` are closed-schema validators: unknown keys are errors (so no coordinates, file names, CSS, URLs or scripts can ride along on a semantic scene; the manifest has no `act`/`why`/`aftermath` keys), ids are lowercase identifiers (no dots or slashes), free text is rejected if it contains URLs, markup, CSS-like blocks, template/arrow/eval expressions or control characters, and caps are enforced (8 scenes / 5 locations / 8 actors / 12 objects / 32 facts / 48 events / 12 observations / 4 options / gate depth 2; `profile: 'launch'` adds 4 scenes / 3 locations). Cross-references, duplicate ids, beat cycles, return-portal symmetry, unreachable scenes/observations, decision/option/scene agreement, boundary/decision agreement and "every required fact has accessible text" are checked. Issues carry a path and a code, never the offending text. `findPrivateLeaks(public, canaries)` lets any pipeline or fixture test prove reveal text is absent (returns indexes, not text). Optional approved vocabularies (`vocab`) reject ids outside them; syntax is always checked.

## Loader compatibility

`loadPlayable(item)` → `v3 | legacy_stored_post | legacy_game_spec | invalid_v3 | unsupported`.

- `postSchemaVersion: 3` → validated; returns `{post, manifest, versions:{postSchema, runtimeManifest, semanticSchema, compiler, assetRevisions}}`.
- `schemaVersion: 2` posts (what V1 and V2 both store) and `GameSpec`s are returned **by reference, unmutated**, for the existing path (the same predicate the app always used).
- Any other version marker (`postSchemaVersion` ≠ 3, `schemaVersion` ≠ 2, a bare manifest, a future manifest/semantic version) is `unsupported` (`future_post_schema`, `unknown_post_schema`, `future_manifest_version`, `unrecognised_shape`). Nothing is guessed or upgraded.
- V3 items that fail validation are `invalid_v3`, never played.

`App.tsx` currently logs and ignores `v3`/`invalid_v3`/`unsupported` (no V3 player is mounted yet); that is the integration point.

## Where the master plan was adjusted

1. **Portals name their destination scene** (`fromScene`, `toScene`, `kind: 'spine' | 'excursion'`, `label`). A location can host several scenes, so `from`/`to` locations cannot determine where a portal leads. Spine portals advance the arc (and must lead to exactly the next spine scene); excursions are reversible (explicit symmetric `returnPortal`) and cannot jump ahead of the arc. A spine portal may be a **cut** to another scene of the same location; an excursion must be a real door.
2. **`Gate` gained `always`** (the plan had no way to say "no condition" without an expression).
3. **Input commands split in two.** The plan's `InputCommand` mixes device intents (`move`) and story commands (`requestIntent`). Here `InputIntent` is what devices produce and `ExperienceEvent` is what the controller consumes; the shell is the only mapping between them.
4. **Pauses are keyed `reason:owner`**, not an anonymous reference count: idempotent (a duplicate `blur` cannot strand a pause), and a nested modal, a hidden tab and a reading panel cannot release one another.
5. **Intent sheet and pending act are one semantically modal surface** (Tab contained, everything outside inert). The plan's table said both "within modal scope" and "Tab between confirm, cancel and other reachable controls". Observation is non-modal. A true modal makes **everything outside the dialog inert, including the page chrome**, not only the player.
6. **The world surface always owns the arrow keys' default behavior while focused**, even when locomotion is not possible (the plan's own "must not suddenly start scrolling" rule), but only the top scope may walk.
7. **`BeatScheduler` / `schedule` are not built.** Beats deliver on a reader `ADVANCE` (soft-flow beats too: no timers exist). `ScheduledEvent.atMs` is therefore absent from the manifest.
8. **`presentation.style` is an id**, not the literal `'paper_diorama'`: the later visual-language document chose a different direction, and art direction owns that vocabulary.
9. **Manifest gained `perspectiveActor`** (the hero) and requires the hero to start in the first spine scene's location. Opportunity `window` and `evidence_window` time are rejected explicitly (`unsupported`).
10. Activation identity and the consumed-activation set are additions the plan only implied ("reject repeats and duplicate synthesized activations").

## Deliberately not implemented

Final art, camera/motion/light/audio directors, `NavigationService`, real locomotion or collision, `moveTo` hit-testing (the pointer path reports a normalised point only), `BeatScheduler` and real timers/windows, `DecisionRepository` and any storage or social service (the host passes `persistDecision`/`loadReveal`/`onSave`), the compiler/semantic pipeline and any provider, the author workflow, `AssetRegistry`, RU/HY typography, and the final player, action sheet, reader view and reveal UI. The shell is a placeholder whose only job is to prove ownership.

## Known limits

- Browser tests run in Chrome only (the plan also asks for WebKit and real iOS/Android devices). Window blur and tab-hidden are simulated by dispatching the real events; Chrome does not let a test blur the OS window. No screen reader, no IME composition in a real IME, no real-device measurement was done.
- `inert` is applied by marking the siblings along the path from the overlay to `<body>`; a host that renders overlays outside that tree must keep the invariant.
- The V3 loader and validator are in the main bundle (a few KB); the harness and the player shell are not (dev-only / unmounted).

## Integration points

**Format Proof agent (golden-story specs → fixtures).** Produce `PlaybackManifestV3` + a separate `RevealRecordV3` per story (put them under `src/data/experienceV3Fixtures/`, as the plan names). Check them with `validateManifest(m, {profile:'launch'})` and `validateStoredPostV3`; check the proposal stage with `validateSemanticPlan`; prove the boundary with `findPrivateLeaks(manifestOrPost, [act, why, aftermath])`. Use explicit `fromScene`/`toScene`, `kind`, `label` on portals, `always` for unconditional gates, ≥ 2 options for the one decision, `accessibleText` for every `requiredFacts` entry. Walk each fixture with `step` in Node (see the topology test in `scripts/test-v3-foundation.ts`, which already models the plan's four-scene shape with neutral ids) and with `buildReadableModel` alone to prove the readable path. To see one in the browser, change the single `foundationPost()` call in `V3Harness.tsx`.

**Claude Design assets.** Everything art-facing is an id in the manifest: `compiledScenes[].kitRevision/compositionRevision/cameraRecipe/lightRecipe/audioRecipe`, `assetRevisions`, `assetHashes`, and optional `entryMark/marks/routes` (0–100 floor space). Pass approved vocabularies through `ValidationOptions.vocab` to make the validator enforce them. The viewport replaces the placeholder children of `WorldSurface` (the focusable group with `touch-action: manipulation`); hotspots must be native `<button>`s whose click handlers dispatch controller events using `manager.activationIdFor(e.nativeEvent)`; no component may add its own window key handler. Focus/visual styling lives in `v3foundation.css` and is placeholder.

**"The correction" implementation agent.** Author the story as a manifest (the plan's X maps onto the contract: spine `desk → meeting → hallway → meeting`, a spine portal per door, an excursion pair for the hallway ⇄ meeting-break view, a spine "resume" portal to the question scene, one `primaryDecision` with the author-confirmed options, `f1…f8` as `facts`, observation/preparation/opportunity gates), and its reveal as a `RevealRecordV3` behind `revealRef`. Mount it by handling `loadPlayable(...).kind === 'v3'` in `App.tsx` with the real `ExperiencePlayerV3`, built from the same pieces: `InputManager` (via `FocusCoordinatorProvider`), `useExperience` (host hooks `persistDecision`, `loadReveal`, `onSave`, `restoreSnapshot` for resume), `buildReadableModel` for the reading path. No special-casing by story id anywhere: a test scans the V3 sources for model imports, network, storage and story names.
