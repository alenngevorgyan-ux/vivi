# VIVI V3 — Independent Foundation Red Team Report

**Date:** 2026-10-03  
**Auditor:** Independent QA / Adversarial Reviewer  
**Repository:** `alenngevorgyan-ux/vivi`  
**Worktree:** `/Users/macair/Documents/antigravity/vivi-v3-qa`  
**Branch:** `qa/vivi-v3-foundation-redteam`  
**Base Head:** `ae60563c64ac245f94e7e1abc9a8a7089e844055` (`feat(v3): allow same-location cuts on spine portals; topology test; foundation doc`)  
**Scope:** Independent adversarial verification of the Phase 1 Foundation substrate (`src/engine/v3/`, `src/engine/input/`, `src/components/experience/v3/`, `src/App.tsx`).

---

## 1. Confirmed Guarantees

Every claim below was audited against both the implementation code and verified through automated test suites (31 pure unit tests and 16 real-browser Playwright tests in Chrome 150.0.7871.125):

1. **Locomotion Ownership & Native Scroll Suppression:**
   - When the `WorldSurface` is focused, Arrow keys and WASD (identified by physical `code`, working across RU/HY layouts) consume the key via synchronous `preventDefault()` in the capture phase.
   - Long held repeats of `ArrowDown` never scroll the viewport (`scrollY === 0` throughout).
   - When focus is on native controls (`button`, `a[href]`, `input`, `textarea`, `[contenteditable]`, or the page body), arrow keys retain 100% native scrolling and navigation behavior.

2. **Text Entry & Editor Isolation:**
   - Any typing inside `<input>`, `<textarea>`, `<select>`, `<div contenteditable>`, or elements with ARIA editable roles (`textbox`, `combobox`, `searchbox`) is strictly bypassed by `InputManager` (`classify()` returns `'editable'`).
   - WASD and arrow keys type text and move carets natively. IME composition (`isComposing || keyCode === 229`) and dead keys are unconditionally preserved for the OS/editor.
   - Holding movement in the world and then focusing an input immediately clears held movement (`reason: 'focus_left'`).

3. **Modal Isolation, Tab Trapping & Background Inerting:**
   - Opening a modal (`ActionSheet`, `SettingsModal`) immediately stops held movement in the exact same tick (`reason: 'scope_opened'`).
   - `FocusCoordinator.pushInert()` sets `inert` on all sibling nodes along the ancestor path up to `document.body`, making page chrome, links, buttons, and the world stage unclickable and invisible to assistive technology.
   - The dialog contains `Tab` and `Shift+Tab` within its focusables. Closing the modal synchronously lifts `inert` and restores focus to the invoker without scrolling (`preventScroll: true`).

4. **Ownership Loss & Held Key Cleanup:**
   - Movement velocity is never stored as hidden state. Held keys are immediately cancelled with `move [0, 0]` upon:
     - Window `blur` (`reason: 'blur'`)
     - Tab hidden / `visibilitychange` (`reason: 'hidden'`)
     - `pagehide`
     - Pointer cancellation / lost capture (`reason: 'pointer_cancel'`)
     - Focus leaving the surface (`reason: 'focus_left'`)
     - Scope opening (`reason: 'scope_opened'`)
     - Interaction becoming ineligible or paused (`reason: 'ineligible'`)
     - World surface unmounting / route change (`reason: 'surface_removed'` or `'disposed'`).
   - `keyup` is captured on `window` regardless of where focus has moved, preventing keys from staying stuck.

5. **Enter Semantics:**
   - `Enter` inside the world surface dispatches `ACTIVATE_CONTEXT`. It **only opens** (contextual observation if exactly one exists, target action sheet if multiple exist, or general actions sheet if no target is selected). It **never commits an act**.
   - `Enter` on focused native buttons activates only those buttons natively; `InputManager` does not intercept them.

6. **Separate Activation & Confirmation Identity:**
   - Selecting an act (`REQUEST_INTENT`) and confirming it (`CONFIRM`) require distinct physical activations.
   - When `CONFIRM` opens, focus lands on the action heading (`confirm-heading`), not on the confirm button, protecting against stray key repeat.
   - A single held `Enter` cannot open the sheet and confirm an act in one continuous gesture.

7. **Truth Boundary Lock:**
   - Following `CONFIRM`, the reducer sets `boundaryLocked: true`. All subsequent attempts to change causal state (`SELECT_TARGET`, `ACTIVATE_CONTEXT`, `OPEN_OBSERVATION`, `APPLY_PREPARATION`, `REQUEST_PORTAL`, `ADVANCE`, `REQUEST_INTENT`, `CONFIRM`) are rejected with `locked` or `decision_closed`.
   - Only presentation effects, clock ticking, modal pause/settings, and reveal progress (`ENACTED`, `HOLD_DONE`, `SKIP`, `BOUNDARY_DONE`, `REVEAL_LOADED`, `REVEAL_FAILED`, `RETRY_REVEAL`, `END`) are permitted.
   - `SKIP` fast-forwards presentation of an already accepted act directly to the boundary; it cannot create, substitute, or alter a decision.

8. **Reveal Failure Resilience:**
   - When `loadReveal` rejects (`REVEAL_FAILED`), the accepted act remains locked and preserved in `snapshot.decision`.
   - Retrying via `RETRY_REVEAL` re-initiates the fetch without reopening options or demanding a second choice.

9. **Multi-scene Graph & Portal Invariants:**
   - Portal traversal (e.g. A → B → A → B → C) preserves received facts, delivered beats, seen observations, consumed events, entity state, and active preparations.
   - Only the perspective actor transfers between locations; carried objects follow their actor owner dynamically via `entityLocation()`.
   - Excursions are strictly reversible and require exact symmetric reverse portals (`returnPortal`). Excursions cannot jump ahead of `arcIndex`.

10. **Closed Schema & Privacy Separation:**
    - `validateManifest`, `validateSemanticPlan`, and `validateStoredPostV3` enforce closed object schemas, enums, format caps, and text hygiene (rejecting URLs, markup, expressions, styles, and control characters).
    - Diagnostic rejection issues carry paths and codes only, never leaking story text.
    - Public manifests and stored posts contain no author act, why, aftermath, or reveal records (`findPrivateLeaks` confirms 0 canaries in public structures).

11. **Legacy Compatibility:**
    - `loadPlayable()` inspects version markers: `postSchemaVersion: 3` routes to V3, `schemaVersion: 2` (V1/V2 posts) and legacy `GameSpec`s are returned by reference unmutated.
    - Feed rendering, V2 editorial playback (`?play=v2-apartment-ru`), and legacy story entry are preserved without regression.

---

## 2. Real Bugs

### Bug 1: Screen Reader & Assistive Technology Activation Lockout (`duplicate_activation`)
* **Owning Module:** `src/engine/input/InputManager.ts` (lines 152–158 and line 219)
* **Severity:** **High / Blocker for Assistive Technology & Virtual Keyboards**
* **Exact Reproduction:**
  1. Open the foundation harness or player with multiple clickable buttons (e.g. `readable-observe-o_a1`, followed by `readable-travel-p_a_to_b` or `readable-advance`).
  2. Activate button 1 using a screen reader (e.g. VoiceOver VO+Space), assistive switch, or programmatic `.click()`.
  3. The browser dispatches a `MouseEvent('click')` with `detail === 0` without a preceding window `keydown` event.
  4. `manager.activationIdFor(e.nativeEvent)` executes:
     ```ts
     const detail = e instanceof MouseEvent ? e.detail : 1;
     if (detail === 0) return `k${this.pressSeq}`;
     ```
     Since `this.pressSeq` was initialized to 0 and no physical keydown fired, it returns `'k0'`.
  5. The first action succeeds with `activationId: 'k0'`. The controller records `'k0'` in `s.consumedActivations`.
  6. The user moves to button 2 and activates it (again via screen reader / click with `detail === 0`).
  7. `manager.activationIdFor(e.nativeEvent)` returns `'k0'` again.
  8. `ExperienceController.step` rejects the second action:
     ```ts
     if (act !== undefined && s.consumedActivations.includes(act)) return rej('duplicate_activation');
     ```
  9. **Result:** The user is permanently locked out from advancing dialog, selecting acts, or confirming.
* **Secondary Mobile Vector:**
  On Android software keyboards / virtual remotes where `e.code === ''` or `undefined` (even while `e.key === 'Enter'`), line 219:
  ```ts
  if ((e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') && !e.repeat) this.pressSeq++;
  ```
  fails to increment `this.pressSeq` because it strictly checks `e.code`. Every Enter press generates `'k0'`, locking out virtual keyboard users on the second press.
* **Suggested Smallest Fix:**
  In `src/engine/input/InputManager.ts`:
  1. In `onKeyDown` (line 219): Check `e.key` in addition to `e.code`:
     ```ts
     if ((e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.key === ' ' || e.code === 'Space') && !e.repeat) this.pressSeq++;
     ```
  2. In `activationIdFor` (lines 152–158): Generate a unique activation ID when `detail === 0` if not part of a held keydown repeat:
     ```ts
     activationIdFor(e: Event): string {
       const detail = e instanceof MouseEvent ? e.detail : 1;
       if (detail === 0) {
         return `k${this.pressSeq ? this.pressSeq : ++this.pointerSeq}`;
       }
       if (detail > 1 && this.lastPointerActivation) return this.lastPointerActivation;
       this.lastPointerActivation = `p${++this.pointerSeq}`;
       return this.lastPointerActivation;
     }
     ```

---

### Bug 2: Unhandled Reducer Crash on Restoring Snapshots with Corrupted Auxiliary Fields
* **Owning Module:** `src/engine/v3/ExperienceController.ts` (`restoreSnapshot`, lines 474–500)
* **Severity:** **Medium**
* **Exact Reproduction:**
  1. Restore a snapshot where `raw.preparations = "invalid"` or `raw.variables = null`.
  2. `restoreSnapshot` verifies arrays of strings (`visitedScenes`, `deliveredBeats`, etc.) and `entities`, but omits `preparations`, `variables`, and `time`. It returns the snapshot as valid.
  3. Dispatch `{ type: 'REVERT_PREPARATION', id: 'foo' }`.
  4. Reducer executes `s.preparations.find(...)` and crashes with:
     ```
     TypeError: s.preparations.find is not a function
     ```
  5. Similarly, if `variables: null`, evaluating any `state_is` gate crashes with `Cannot read properties of null`.
* **Suggested Smallest Fix:**
  In `restoreSnapshot` (around line 482 of `ExperienceController.ts`), add explicit validation:
  ```ts
  if (!Array.isArray(s.preparations) || typeof s.variables !== 'object' || s.variables === null || typeof s.time !== 'object' || s.time === null) return undefined;
  ```

---

### Bug 3: Resuming Revealed Memory Story Reverts Phase to `boundary`
* **Owning Module:** `src/engine/v3/ExperienceController.ts` (`restoreSnapshot`, lines 497–499)
* **Severity:** **Medium**
* **Exact Reproduction:**
  1. Load a memory format story (`m.primaryDecision = null`, `truthBoundary.after = 'memory_end'`).
  2. Play to `boundary`, dispatch `BOUNDARY_DONE`, and then `REVEAL_LOADED`. State is `phase: 'revealed', reveal: 'ready'`.
  3. Call `restoreSnapshot(m, s)` (simulating page reload or session restore).
  4. Line 497 checks:
     ```ts
     if (s.decision) return { ...clean, phase: s.phase === 'revealed' || s.phase === 'ended' ? s.phase : 'boundary', boundaryLocked: true, reveal: s.phase === 'revealed' || s.phase === 'ended' ? 'ready' : 'idle' };
     if (s.boundaryLocked) return { ...clean, phase: 'boundary' };
     ```
  5. Since memory stories have no `decision`, `if (s.decision)` is false. Line 498 executes: `return { ...clean, phase: 'boundary' }`.
  6. **Result:** The user is thrown back into `boundary` phase, with `reveal: 'ready'`. Advancing then requires dispatching `BOUNDARY_DONE` again, refetching the reveal.
* **Suggested Smallest Fix:**
  In `restoreSnapshot`:
  ```ts
  if (s.boundaryLocked) {
    const isFinished = s.phase === 'revealed' || s.phase === 'ended';
    return {
      ...clean,
      phase: isFinished ? s.phase : 'boundary',
      boundaryLocked: true,
      reveal: isFinished ? 'ready' : 'idle',
    };
  }
  ```

---

### Bug 4: Silent Error Swallowing on `persistDecision` Rejection
* **Owning Module:** `src/components/experience/v3/useExperience.ts` (lines 42–46)
* **Severity:** **Low / Telemetry Gap**
* **Exact Reproduction:**
  1. Pass an asynchronous `persistDecision` handler that rejects (e.g. storage quota exceeded or network failure).
  2. `useExperience.ts` executes:
     ```ts
     case 'persist_decision': {
       const { decision, option } = effect;
       Promise.resolve(o.persistDecision?.(decision, option)).then(() => d({ type: 'DECISION_RECORDED' }), () => undefined);
       break;
     }
     ```
  3. **Result:** The rejection is caught and discarded (`() => undefined`). `DECISION_RECORDED` is never sent; `s.decision.status` remains `'accepted'`, and no error or diagnostic event is reported to the host or user.
* **Suggested Smallest Fix:**
  Report the failure via `o.onEvent` or dispatch a diagnostic event if persistence fails.

---

## 3. Weak Assumptions

1. **Short Canary Invisibility in `findPrivateLeaks`:**
   `findPrivateLeaks` enforces `needle.length >= 4`:
   ```ts
   if (needle.length >= 4 && hay.includes(needle)) found.push(i);
   ```
   If an author canary or option text is 3 characters or less (e.g. "Run", "Yes", "Lie", "Key", "Act"), `findPrivateLeaks` will silently ignore it and report no leaks (`[]`). Canaries must either be constrained to $\ge 4$ characters or tested with whole-word matching.

2. **Unvalidated `o.loadReveal` Fallback:**
   In `useExperience.ts` line 56:
   ```ts
   Promise.resolve(o.loadReveal?.(effect.experienceId, effect.revision) ?? Promise.resolve()).then(() => d({ type: 'REVEAL_LOADED' }), () => d({ type: 'REVEAL_FAILED' }));
   ```
   If `loadReveal` is omitted by the host, it defaults to `Promise.resolve()`, immediately transitioning to `REVEAL_LOADED` without loading any data. Furthermore, there is no schema validator for `RevealRecordV3` in `validate.ts`.

3. **Background Tab Mount Initialization:**
   In `useExperience.ts` (lines 86–98), `visibilitychange` and `blur` listeners are registered only for future events:
   ```ts
   const onVisibility = () => dispatch({ type: document.visibilityState === 'hidden' ? 'PAUSE' : 'RESUME', reason: 'hidden' });
   ```
   If the player mounts in an already-hidden background tab, no event fires, leaving `pauses` empty (`[]`) until the user focuses and un-focuses the tab.

4. **Preparation Undo Stack Reversal Out-of-Order:**
   `revertPreparation` applies the undo record of a specific preparation ID without checking if subsequent preparations modified the same entity property. If preparation A sets `mark_role: 'stand'` and preparation B sets `mark_role: 'sit'`, reverting A while B is still active deletes `mark_role` rather than keeping B's value.

5. **Focus Restoration on Aborted Transitions:**
   `abortTransition` returns `effects: []` with `phase: 'playing'`. If the transition was requested from an action sheet that closed during `beginTransition`, focus remains stranded on `document.body` after abort because `phase: 'entering'` is never visited (so `focus.handoffToWorld()` never fires).

6. **Missing Asynchronous Preload Hook in `UseExperienceOptions`:**
   `useExperience.ts` lines 36–41 automatically dispatch `TRANSITION_READY` in a microtask. `UseExperienceOptions` provides no callback for the host to asynchronously await scene assets before transition commit.

---

## 4. Untested Claims

1. **No Runtime Validator for `RevealRecordV3`:**
   `RevealRecordV3` is declared as a TypeScript interface in `manifest.ts`, but no `validateRevealRecordV3` function exists in `validate.ts`. Returned reveal payloads are treated as `unknown`.
2. **`TICK` Timer Inactivity:**
   `TICK` is unit-tested in Node, but no component in the player shell runs `requestAnimationFrame` or `setInterval` to dispatch `TICK`. Opportunity and narrative clocks do not tick during browser playback (documented as intentional in Phase 1).
3. **Screen Reader Live Region Announcements:**
   The live region `<div role="status" aria-live="polite">` exists with a trailing zero-width space trick for repeated messages, but was not tested with actual screen reader software (VoiceOver / NVDA).

---

## 5. False Positives / Initially Suspicious Code That Is Actually Correct

1. **Shift+Tab on `confirm-heading`:**
   * *Initial suspicion:* `confirm-heading` has `tabIndex={-1}`, and `ScopeDialog.onKeyDown` only checks `active === first || active === root`. It looked as though `Shift+Tab` would escape the dialog.
   * *Actual behavior:* Verified in browser. Because `pushInert()` marks all page ancestors and siblings `inert`, the browser's native reverse tab search cannot exit the dialog and wraps around to `cancel-button`.
2. **Enter in `WorldSurface` Never Commits:**
   * *Initial suspicion:* Could rapid repeated Enter or held Enter slip through and confirm an act?
   * *Actual behavior:* Enter in `WorldSurface` only dispatches `ACTIVATE_CONTEXT`. `ACTIVATE_CONTEXT` in `ExperienceController` only opens an observation or action sheet. It has no code path to `CONFIRM` or `REQUEST_INTENT`.
3. **Same-Location Spine Cuts:**
   * *Initial suspicion:* Does a cut within the same location (`room_a` $\to$ `room_a`) cause an invalid state in `commitTransition`?
   * *Actual behavior:* Verified in Node and browser. `commitTransition` updates `s.scene`, advances `arcIndex`, and retains entity ownership cleanly.
4. **Carried Objects Dynamic Location:**
   * *Initial suspicion:* Does `commitTransition` need to update carried objects in `entities`?
   * *Actual behavior:* Carried objects have `owner: { kind: 'actor', id: 'hero' }`. `entityLocation()` resolves actor ownership recursively. When the hero moves, all carried objects automatically resolve to the hero's new location without duplicating or mutating records.

---

## 6. Severity Matrix

| ID | Issue | Module | Severity | Blocker for Next Stream? |
|---|---|---|---|---|
| **BUG-01** | Assistive tech & virtual keyboard lockout via duplicate `k0` activation ID | `InputManager.ts` | **High / Blocker for AT** | **Yes** (must fix before AT/research round) |
| **BUG-02** | Reducer crashes on unvalidated snapshot fields in `restoreSnapshot` | `ExperienceController.ts` | **Medium** | No (clean data in gold fixture) |
| **BUG-03** | Restoring revealed memory stories resets phase to `boundary` | `ExperienceController.ts` | **Medium** | No (The Correction is a decision format) |
| **BUG-04** | Silently swallowed `persistDecision` rejections | `useExperience.ts` | **Low** | No |
| **WEAK-01** | Canaries $< 4$ characters ignored in `findPrivateLeaks` | `validate.ts` | **Low** | No |
| **WEAK-02** | `buildReadableModel` reports items `available: true` while observation open | `readable.ts` | **Low** | No |
| **WEAK-03** | Aborted transition leaves focus on `document.body` | `TransitionController.ts` | **Low** | No |
| **WEAK-04** | Out-of-order preparation undo state overwrite | `ExperienceController.ts` | **Low** | No |
| **WEAK-05** | No `preloadScene` callback in `UseExperienceOptions` | `useExperience.ts` | **Low** | Note for Integration stream |

---

## 7. Readiness Verdict for "The Correction" Integration

### Verdict: **READY WITH ONE BLOCKING PATCH (BUG-01)**

The V3 Foundation architecture is exceptionally well-engineered:
- The pure reducer state machine enforces truth-boundary locks, transaction isolation, arc progression, and idempotency with zero leakage.
- Legacy V1/V2 routing and posts are completely unaffected and isolated.
- The neutral fixture, 1-scene formats, and the 4-scene/3-location topology required for "The Correction" pass all contract and graph validation rules.

**Prerequisite before research / device testing:**
Patch **BUG-01** in `InputManager.ts` (ensure `activationIdFor` and `onKeyDown` generate distinct activation IDs for synthetic clicks and virtual keyboards). Without this fix, assistive technology users and mobile virtual keyboard users cannot advance beyond the first interaction.
