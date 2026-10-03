# V3 first slice — QA reconciliation

Branch `fix/vivi-v3-first-slice-qa`, base `origin/integration/vivi-v3-first-slice` @ `ef3e1f0`.
The independent QA ran against Foundation `ae60563c`. Each finding was reproduced against the current first-slice code, not taken from either report.

Tests live in `scripts/test-v3-foundation.ts` (unit, `npm run test:v3-unit`) and `scripts/test-v3-browser.ts` (real Chrome, `npm run test:v3-browser`).

## Classification

| # | Finding | Class | Evidence |
|---|---|---|---|
| BUG-01 | `activationIdFor` returns `k0` for every `detail === 0` click with no key press (VoiceOver, switches, programmatic click, virtual keyboards); Enter with `key==="Enter"`, `code===""` not counted as a press | **FIXED IN THIS PASS** | Unit: "Activation identity: separate synthetic/AT clicks get unique ids…". Browser: "Assistive-technology (synthetic, detail 0) activations: act then confirm both succeed…" and "Virtual keyboard Enter (key "Enter", empty code)…" |
| BUG-02 | Malformed restored snapshots (preparations, variables, time, entities, owners, unknown facts/scenes) throw or are accepted | **FIXED BEFORE THIS PASS** | Unit: "QA: malformed restores are refused without throwing…" — 24 malformed variants plus junk roots; all return `undefined`, none throw. `restoreSnapshot` untouched for this. |
| BUG-03 | Memory format (`primaryDecision === null`, `truthBoundary.after === 'memory_end'`): a `revealed`/`ended` snapshot regresses to `boundary` | **FIXED IN THIS PASS** (reproduced: the old code returned `boundary`) | Same unit test: revealed→revealed, ended→ended, boundary→boundary, `reveal_loading`→boundary, and a decision-format story still resumes at `boundary` |
| BUG-04 | `persistDecision` rejection is swallowed | **STILL OPEN — INTEGRATION DECISION** | Reproduced and pinned (not fixed). See below. |
| Stale consumed activation IDs after reload | | **FIXED BEFORE THIS PASS** | `restoreSnapshot` resets `consumedActivations: []`; existing resume tests cover it. Not rewritten. |
| Overlapping seat/near reposition preparation | | **FIXED BEFORE THIS PASS** | Covered by existing Correction suite (`test:v3-correction`); not rewritten. |
| Leak matching with quotes/newlines | | **FIXED BEFORE THIS PASS** | Unit: "Leak check: quote, backslash and newline canaries match as serialized…" |
| Canaries under 4 characters are silently ignored | | **STILL OPEN — INTEGRATION DECISION** | See below. |
| Corrupted/malformed snapshot validation (general) | | **FIXED BEFORE THIS PASS** | Same as BUG-02. |

Items I could not find in the QA brief beyond those named in the task were not invented; none were classed NOT REPRODUCIBLE. The "overlapping reposition preparation" and "stale activation" findings were verified only via existing tests and code reading, and I did not add new tests for them.

## BUG-01 — fix

`src/engine/input/InputManager.ts`:
- A `detail === 0` click reuses the press id only while an Enter/Space press owns it (`pressOpen`). With no owning press it gets a unique `s<n>` id.
- Enter is recognised by `key === "Enter"` **or** `code`. Space likewise (`key === " "`). `pressSeq` now increments on these.
- Enter closes the press on keyup. Space clicks right after keyup in the same task, so its press closes in a `setTimeout(0)`.
- `activationIdFor` no longer uses `instanceof MouseEvent`, so it can run outside a DOM.

Preserved: held/repeated Enter (one id, repeats don't increment), pointer double click (`detail > 1` reuses the first id), and physical-layout WASD (`routing.ts` untouched; a key `"w"` with empty code still does not move — asserted in the browser test).

Consequence to know about: a `click()` fired programmatically while a physical key is held would adopt that press's id. That is the intended "keyboard-generated click" reading and cannot be told apart from a real one.

### Mutation proof (fix neutered, new test fails, fix restored)

| Mutation | Result |
|---|---|
| `activationIdFor` back to `` `k${pressSeq}` `` | Unit test fails: `three separate synthetic activations need three ids (k0,k0,k0)`. Browser AT test fails. |
| `isActivationKey` ignores `key` (code only) | Browser virtual-Enter test fails: `s1 !== k1` — the empty-code Enter is not a press. |
| Remove the `revealed`/`ended` line in `restoreSnapshot` | Unit test fails: `a revealed memory restores to revealed, not the boundary`. |

## BUG-04 — persistDecision rejection (not fixed)

`useExperience.ts`: `Promise.resolve(o.persistDecision?.(…)).then(() => d({type:'DECISION_RECORDED'}), () => undefined)`.
Reproduced in Chrome via a dev-only `&persist=reject` switch on `V3Harness` (test-only; the production hook is unchanged). With a rejecting host:
- the decision stays `accepted` and is never `recorded`;
- the write is attempted once and never retried;
- no event, diagnostic or error state is dispatched.

The reducer has a `diagnostic` effect, but the hook ignores it and there is no `PERSIST_FAILED` event. Any fix needs a new failure/retry contract (error state, retry policy, what the player sees, idempotency on retry). That is the "new persistence/error-state contract" the brief said not to invent. The browser test "KNOWN GAP BUG-04" pins today's behaviour so it cannot change silently; it should be inverted when the contract is designed.

**For Integration Review:** decide the failure event, retry behaviour, and what blocks the reveal if the choice was not saved.

## Leak check

`findPrivateLeaks` correctly matches canaries containing quotes, backslashes and newlines (compared in serialized form). A canary of fewer than 4 characters is skipped entirely, so it can never be reported. A naive substring check would produce false positives on ordinary words, and no small, safe fix exists, so I left it. A unit test documents both sides (3 characters ignored, 4 checked).

**For Integration Review:** either enforce a minimum canary length at fixture authoring time (so a short canary is an error, not a silent skip) or choose word-boundary matching.

## Visual integration issues — not addressed

Per the brief nothing was designed for preloading, geometry, camera, timers, reveal timing or coordinate conversion.

Observation for the Astra/Codex review: **`useExperience` still commits `TRANSITION_READY` immediately.** For `preload_scene` it runs `Promise.resolve().then(() => d({type:'TRANSITION_READY', txId}))`, with a comment that a host with real assets awaits there. There is no asynchronous host preload hook in the options. The reducer's txId guard exists, but the React host cannot yet delay readiness. (`HeadlessHost` does support held preloads, so the late/stale path is only tested headlessly.) `enact` likewise auto-runs `ENACTED → HOLD_DONE → BOUNDARY_DONE` in one microtask — also an integration question.

## Files changed

- `src/engine/input/InputManager.ts` — BUG-01
- `src/engine/v3/ExperienceController.ts` — BUG-03 (one added branch in `restoreSnapshot`)
- `src/components/experience/v3/V3Harness.tsx` — dev-only `persist=reject` switch for the BUG-04 reproduction
- `scripts/test-v3-foundation.ts`, `scripts/test-v3-browser.ts` — regression tests

## Verification

All exit 0 on the final tree: `npm run lint`; `npm test` (39/39 experiences); `npm run build`; `npm run test:v3-foundation` (34 unit checks + 19 browser checks); `npm run test:v3-correction` (15 checks). No paid models were called.

## Verdict

READY FOR FINAL INTEGRATION REVIEW — with BUG-04, the short-canary behaviour and the immediate `TRANSITION_READY` flagged above as open integration decisions.
