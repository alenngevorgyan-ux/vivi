# V3 pre-build runtime blockers: implementation report

Branch `implementation/vivi-v3-prebuild-contracts`. Contracts: `docs/v3/V3_PREBUILD_RUNTIME_CONTRACTS.md`. Source of the blocker list: `reports/v3-final-integration-review.md` (finding register).

## Scope

| ID | Blocker | Status |
|---|---|---|
| B02 | Authoritative geometry, location-specific hero marks | **Runtime half closed.** Contract, deterministic Design→runtime adapter, validators, manifest agreement, per-location hero marks. Design still has to publish a source-checked export; the Correction runs on dev-named placeholder geometry. **Superseded in part:** the closure review (`a8a4a7a`) reproduced three incompatibilities with Design r3 (interior cameras, recipe coverage, seated marks); see `reports/v3-b02-geometry-reconciliation.md`. |
| B03 | `useExperience` resolved preload at once and collapsed three presentation phases | **Closed.** Async `ExperienceHost`, explicit headless mode, three receipts, stale/unmount/revision guards. |
| B04 | Persistence failure swallowed; missing callback = fake success; unacknowledged save | **Closed.** Journal + idempotent repository, exact-ack, visible failure, retry with the identical key, reload recovery. |
| B05 | Restore hardening incomplete | **Closed.** Ordered shape-first validation, snapshot v2, adversarial witnesses, fuzz. |
| B06 | Private loader result discarded, absent loader succeeded, no validation | **Closed.** Runtime record validation, explicit variant→record mapping, fail-closed loading, host-private validated copy. |
| B07 | Short canaries silently gave no protection | **Closed.** Author-time minimum length, scan throws on invalid configuration. |
| B01 | Design/editorial source conflicts, private request and author account | **Not in scope.** Design + Editorial. |
| B08 | Two `pending_editorial` act captions | **Not in scope.** Editorial. |

No visual player was implemented. The Foundation player shell only gained the host wiring and visible failure/retry states.

## What changed

New: `src/components/experience/v3/{ExperienceHost,hostContracts}.ts`, `src/engine/v3/contracts/{geometry,reveal}.ts`, `src/engine/v3/geometry/designAdapter.ts`, `src/devtools/v3HarnessJournal.ts` (dev-only storage, deliberately outside the runtime), `scripts/test-v3-{prebuild,host}.ts`, `scripts/lib/hostWalk.ts`.

Changed: reducer and restore (`ExperienceController.ts`: exact `DECISION_RECORDED {decision, option}`, hero placement, snapshot v2 and ordered restore), `TransitionController.ts` (per-location hero placement), contracts (`manifest.ts`, `state.ts`, `validate.ts`: reveal schema/`withheld`, `heroMarks`, `mark` undo, canary rules), `types.ts` (`ack_mismatch`), `useExperience.ts` (now `ExperienceHost` over `useSyncExternalStore`), `V3FoundationPlayer.tsx` / `V3Harness.tsx` (host config; visible entry/transition/persistence/reveal failures with retry; harness fault injection `persist=reject|flaky`), the Correction fixtures (`recordRevision`, `correctionRevealBinding()`, snapshot contract 2, reveal schema) and the headless trace host (`scripts/lib/v3HeadlessHost.ts`).

Existing tests were rewired, not loosened. Each edit follows a deliberate contract change:

- A restored story now re-enters at `loading` (so a visual host prepares the scene) instead of `playing`.
- `DECISION_RECORDED` needs the decision and option, and a second ack is `already_applied`.
- Canaries shorter than 4 characters now **throw** instead of being skipped.
- Snapshot version 1 is refused (the stored snapshot is now version 2).
- Preparation record order is no longer asserted: a position is stashed with its location and restored on return, so the set is the contract.
- The browser test that pinned the old swallowed-failure behaviour ("KNOWN GAP BUG-04") now asserts the new behaviour (a visible failure, retry, recorded only on an ack).

## Gates

All run on the final tree, exit code 0:

| Command | Result |
|---|---|
| `npm run lint` | 0 (`tsc --noEmit`) |
| `npm test` | 0. Includes Foundation 34, **pre-build 12**, **host 18**, Correction 15, V2 20, provider 15, compiler and canonical runtime. |
| `npm run build` | 0 (Vite; the existing chunk-size warning is unchanged) |
| `npm run test:v3-foundation` | 0. Unit (34 + 12 + 18) and **browser 20** (Chromium 150, incl. two new B04 checks). |
| `npm run test:v3-correction` | 0. 15 checks. |

## Regression tests per blocker

- **B03** (`test-v3-host.ts`, deferred promises, no timers): no loader = config failure, never prepared; wrong scene / rejection / sync throw fail visibly; retry; failure returns to the source; a late completion after failure, after unmount, from an earlier mount while re-attached, from a superseded transaction (same mount, attempt and phase) and from another attempt or revision never lands; three separate receipts bound to mount/attempt/decision/option/phase; hidden, stale, replayed and detached receipts refused; deterministic skip.
- **B04**: key = attempt + decision version + option; journal and repository get the identical operation; only an exact ack records; wrong/empty/malformed/thrown acks do not; failure visible, choice stays locked, Retry re-sends the identical operation; the reveal waits for the presented boundary **and** durable acceptance; no repository/journal = `unconfigured`, never recorded; reload recovery adopts only an exact journal entry (forged entries incl. recomputed keys are ignored) and re-sends it; a stored "recorded" is a claim. Browser: rejected write is shown and never reopens the choice; Save again records only on the ack.
- **B05** (`test-v3-prebuild.ts`): 63 named witnesses (null/duplicate/extra-key entities, owners, hero placement, ids, clocks, receipts, undo records, decision/phase/lock/reveal contradictions, `__proto__`) plus 14 junk roots, all refused without throwing; accepted choices never reopen; a deterministic fuzz substitutes 16 junk values at every path of a real snapshot (no throw; whatever is accepted survives the reducer).
- **B06**: 15 invalid loader results (identity, version, status, keys, markup, URL, option, empty, oversized, withheld-with-text) fail closed with codes only; no loader / no binding fails closed; retry; late and post-unmount loads dropped; a completed story re-resolves its record; both Correction variants load the one record by explicit binding and the gold-1 profile and revision are enforced; the loader's own object is not aliased; canaries never appear in snapshot, status or identity.
- **B07**: minimum length, blank/empty/non-string/short rejected at author time, scan throws with indexes only, NFC/case normalization both ways, current Correction (11) and Foundation canaries valid.
- **B02**: adapter mapping, determinism, no input mutation, Design-perspective reproduction and floor round trip, 18 adapter error cases, 23 geometry validation cases, 12 manifest-agreement cases, per-location hero marks (first visit, exact return, undo on return, no drift over five round trips, same-location cut, no cross-location leak, missing mark refused), heroMarks persisted and 18 tampered placements refused. The geometry fixture is deliberately **not square** (width 20, depth 10) so an axis mix-up cannot pass.

## Mutation testing

Each fix was broken on purpose in the source, the V3 unit suites run (Foundation, pre-build, host, Correction), and the file restored (verified by SHA-256). **76 of 76 mutants killed**, plus 2 more in the React layer killed by the browser suite (the player never shows a failed save; Save again does nothing).

The first pass left 6 survivors and 2 invalid mutations. Each exposed a weak test, and the tests were fixed rather than the mutants excused:

- H03/H04: I had resolved an already-settled promise, which is a no-op. The old generation/transaction now completes **after** the remount/new request, and the host status is asserted.
- H17: a forged journal entry was rejected only by its key. The forgeries now recompute the key, so the identity checks must catch them.
- H23: the host's record aliased the loader's object. A loader that mutates its object after validation is now tested.
- T06: the first version of this mutation was a no-op; replaced, with a destination-without-marks scenario added.
- H06: a double-guarded path (an equivalent mutant unless both guards go); it now removes both.
- H21, G16: wrong find strings.

| ID | Blocker | Fix broken (mutation) | Killed by suite |
|---|---|---|---|
| H01 | B03 | entry preparation accepts a result for the wrong scene | host |
| H02 | B03 | a visual host without a loader completes entry preparation | host |
| H03 | B03 | completions ignore the mount generation | host |
| H04 | B03 | transition completion ignores the transaction id | host |
| H05 | B03 | a failed preload never aborts the transition | host |
| H06 | B03 | a visual host presents the act by itself (both guards removed) | host |
| H07 | B03 | receipts ignore the chosen option | host |
| H08 | B03 | a hidden page may complete a phase | host |
| H09 | B04 | the reveal does not wait for durable acceptance | host |
| H10 | B04 | the reveal does not wait for the boundary to be presented | host |
| H11 | B04 | an ack for another key records the decision | host |
| H12 | B04 | any object is an acknowledgement | host |
| H13 | B04 | the idempotency key loses the attempt | host |
| H14 | B04 | a failed repository write records the decision anyway | host |
| H15 | B04 | a missing repository counts as recorded | host |
| H16 | B04 | recovery adopts a journal entry with a forged key | host |
| H17 | B04 | recovery adopts an entry from another decision version | host |
| H18 | B06 | the loader result is not validated | host |
| H19 | B06 | an absent loader succeeds | host |
| H20 | B03 | a remount does not resume an interrupted preparation | host |
| H21 | B04 | the journal is never read on reload | host |
| H22 | B04 | a restored unrecorded choice is never re-sent | host |
| H23 | B06 | the host keeps the loader's own object (aliasing) | host |
| C01 | B04 | the reducer accepts an ack for another decision/option | foundation |
| C02 | B04 | a stored "recorded" is trusted on restore | prebuild |
| C03 | B05 | restore accepts unknown top-level keys | prebuild |
| C04 | B05 | restore reads entities before checking their shape | prebuild |
| C05 | B05 | restore ignores the experience id | prebuild |
| C06 | B05 | a decision in a pre-commit phase restores | prebuild |
| C07 | B05 | heroMarks entries are not checked | prebuild |
| C08 | B05 | duplicate entities restore | prebuild |
| C09 | B05 | reveal/phase disagreement restores | prebuild |
| C10 | B05 | a restored story skips scene preparation | foundation |
| C11 | B05 | standing ahead of the arc restores | prebuild |
| C12 | B05 | any pause key restores | prebuild |
| C13 | B05 | unknown delivered beats restore | foundation |
| C14 | B02 | a reposition with no compiled mark is applied | prebuild |
| C15 | B02 | a reposition changes the role but not the body | prebuild |
| C16 | B02 | the hero starts unplaced | prebuild |
| C17 | B02 | undoing a reposition does not restore the body | prebuild |
| T01 | B02 | leaving a location forgets where the hero stood | foundation |
| T02 | B02 | a first visit has no entry mark | prebuild |
| T03 | B02 | a return does not restore the reversible reposition | foundation |
| T04 | B02 | a position stays active in the wrong place | foundation |
| T05 | B02 | a return ignores the saved placement | foundation |
| T06 | B02 | the previous location's mark leaks into the next | prebuild |
| G01 | B02 | the adapter does not enforce declared bounds | prebuild |
| G02 | B02 | an unapproved yaw is accepted | prebuild |
| G03 | B02 | floor axes use the wrong extent | prebuild |
| G04 | B02 | heights are not normalized | prebuild |
| G05 | B02 | the compiled horizontal focal length is wrong | prebuild |
| G06 | B02 | the compiled camera depth is wrong | prebuild |
| G07 | B02 | a camera with non-finite coefficients is accepted *(was: a camera inside the floor is accepted — that invariant was removed by the B02 reconciliation, see `reports/v3-b02-geometry-reconciliation.md`)* | prebuild |
| G08 | B02 | marks need not be standable | prebuild |
| G09 | B02 | marks need not be in the safe region | prebuild |
| G10 | B02 | kit revisions need not agree | prebuild |
| G11 | B02 | a reversible door needs no anchors | prebuild |
| G12 | B02 | a degenerate polygon is valid | prebuild |
| G13 | B02 | a point behind the camera projects | prebuild |
| G14 | B02 | above the horizon unprojects to a floor point | prebuild |
| G15 | B02 | the source hash is not checked | prebuild |
| G16 | B02 | route points need not be standable | prebuild |
| G17 | B02 | anchors for unknown entities are valid | prebuild |
| R01 | B06 | a record of another experience validates | host |
| R02 | B06 | a record of another revision validates | host |
| R03 | B06 | unknown record keys validate | host |
| R04 | B06 | markup/URL/oversized account text validates | host |
| R05 | B06 | an author option that is not an option validates | host |
| R06 | B06 | the launch profile status is not enforced | host |
| R07 | B06 | an empty account validates | host |
| R08 | B06 | any schema version validates | host |
| K01 | B07 | one-character canaries are valid | foundation |
| K02 | B07 | a leak scan with invalid canaries reports no leak | foundation |
| K03 | B07 | the haystack is not Unicode-normalized | prebuild |
| K04 | B07 | canaries are case-sensitive | foundation |
| K05 | B07 | an empty canary list is valid configuration | foundation |

## What this does and does not prove

- Technical evidence for the runtime contracts only. Not evidence of atmosphere, engagement, hallway value, visual quality, reveal impact or understanding.
- The host contracts are exercised with fakes. A real preloader (decoding images, fonts, layout), a real repository service and a real renderer's receipts do not exist yet; the visual player build must supply them and keep these tests green.
- The geometry adapter and validators are proven on a synthetic Design source. The numbers in a real export, its hash and its approved facings come from Design.
- The Correction still uses placeholder geometry and the checked-in private fixture. Repository separation is a discipline, not secrecy; production reveal authorization is deferred (X01).
- The headless trace host (`scripts/lib/v3HeadlessHost.ts`) is a synchronous model of the contract. The asynchronous contract is tested on the real `ExperienceHost`.

## Remaining before the player build

B01 and B08 (Design/Editorial). Then P01–P04 per `docs/v3/V3_VISUAL_PLAYER_BUILD_PLAN.md`.
