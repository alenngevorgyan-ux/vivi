# The Correction: visual player build plan

2026-10-03 · pinned base `bece4957f1898734ffd58a696ea86070da9988d6` · review branch `review/vivi-v3-final-integration`

**Current gate: NOT READY FOR VISUAL PLAYER BUILD.** This is a specification for subsequent implementation, not an implementation or authorization to merge/deploy. [The final review](../../reports/v3-final-integration-review.md) records the complete pinned streams, source conflicts, geometry convention, host contracts, mobile evidence and independent Foundation patch decisions. Its B01–B08 must close before mounting the shell. Work on upstream contracts and corrected Design exports precedes player implementation.

Gold source and Foundation causal state remain authoritative. There is one normalized runtime coordinate system, one actor/object registry, one opportunity/confirmation system and one phase machine. Design is a source-safe presentation projection. No V1/V2 replacement, main merge, paid generation, production service, social UI or deployment belongs to this plan. Human approval of Remembered Room and the four product questions remain pending; automated acceptance does not answer them.

Owners follow the execution board: **A** Foundation engineer (contracts/reducer/recovery); **B** Design/illustration owner (source geometry/assets/layout); **C** editorial/Format Proof reviewer (truth/copy/translations); **D** Integration engineer (adapter/host/player); **E** independent QA (verification). These are stream responsibilities, not invented named assignees. Existing file names below are actual repository paths; files marked **new** are proposed deliverables, not files created by this review. Design export files belong to a corrected successor of `design/vivi-v3-correction-slice`, not a wholesale cherry-pick of `aed9eeb`.

## A. Integration-contract patches

**Owner:** A; C reviews source/profile requirements; D implements host resource/repository adapters; E independently verifies.

**Files:** `src/components/experience/v3/useExperience.ts`, `visualHooks.ts`; `src/engine/v3/ExperienceController.ts`, `TransitionController.ts`, `contracts/state.ts`, `contracts/manifest.ts`, `contracts/validate.ts`; `src/data/experienceV3Fixtures/runtime/compileFixturePlan.ts`, `theCorrection.presentation.ts`; `scripts/lib/v3HeadlessHost.ts`, `scripts/test-v3-foundation.ts`, `scripts/test-v3-correction.ts`, `scripts/test-v3-browser.ts`; **new** `src/components/experience/v3/hostContracts.ts`, `src/engine/v3/contracts/reveal.ts`, `src/components/experience/v3/DecisionRepository.ts`.

**Dependencies:** pinned Foundation/headless/QA baseline; review decisions §§1–6/10; C approves the two pending public intention captions. In parallel B/C republish source-safe Design (B01); player work does not start while that remains unresolved.

**Implementation order:** harden restore validation first; add typed host lifecycle/identity; implement deferred scene preparation; opt in explicitly to renderer-less headless choreography; expose guarded presentation receipts; add durable acceptance journal/repository ack/recovery; validate and retain boundary-only private results; enforce author-time canary validity; establish versioned normalized geometry resource and per-location hero marks. Keep networking, persistence, decoded assets, masks and animation sampling out of the reducer. Pure events/effects carry identity/ack facts; one snapshot owns accepted choice and positions. Publish the complete revised contract together with tests, not partial incompatible types.

**Acceptance:**

- Null entity and malformed undo/decision/clock witnesses in review §10 are rejected without throws. Closed unions, owners, marks, references, identity and phase/lock invariants validate before normalization. Keep completed-memory recovery and page-local activation reset.
- Deferred preload leaves source visible/unchanged until preparation resolves; failure/retry and wrong tx/mount/attempt/revision completions are rejected. Missing callbacks and sync throws fail explicitly. Initial scene preparation uses the same contract.
- Visual mode cannot auto-collapse ENACTED/HOLD_DONE/BOUNDARY_DONE. Each phase waits for its receipt; headless tests select an explicit headless adapter.
- Confirmed option remains immutable through persistence failure. Atomic journal survives reload, retries use the identical idempotency key, and only a matching repository ack yields `recorded`. Local save failure blocks private loading with visible retry; optional remote failure may proceed only after durable local acceptance. Absent repository never creates fake success.
- `loadReveal` must produce a valid trusted record. Rich/compressed share the approved private record through explicit mapping; invalid/absent/stale result renders no account. Private text never enters manifest/snapshot/public hooks/preload/trace.
- Canary author validation rejects normalized lengths 0–3; serialized matching keeps escaped-string detection and index-only diagnostics.
- Portal commit saves/restores one normalized hero mark per location. First entry uses entry mark; return uses saved mark; preparations and undo update that same authority.
- Existing non-paid suite and regression checks pass; BUG-04 test changes from documenting swallowed failure to asserting visible failure/recovery.

**Stop condition:** any invalid restore is accepted/throws, fake persistence ack, private leak, stale receipt mutation, duplicated world state, absent required contract or regression. No C–M shell work until A and source-safe B01 inputs are published and reviewed.

## B. Design geometry adapter

**Owner:** B publishes source; D writes deterministic adapter; A owns output contracts; C checks source-safe staging; E verifies geometry.

**Files:** corrected Design `docs/visual-v3/correction-slice/README.md`, `source/C13_Staging.dc.html`, `source/C15_Attention.dc.html`, `source/C16_Handshake.dc.html`, `source/C17_Frozen.dc.html`, affected other source boards, `generator/frames.py`, `render_all.py`, `render_layers.py`, frame/layer inventory; **new** Design `geometry/source.json`, `assets.json`; **new** `scripts/build-v3-correction-geometry.ts`, `src/data/experienceV3Fixtures/runtime/theCorrection.geometry.ts`, `src/engine/v3/contracts/geometry.ts`; existing `compileFixturePlan.ts`, `theCorrection.ts`, `placeholderGeometry.ts`, `scripts/test-v3-correction.ts`.

**Dependencies:** A's geometry/recovery contract; B01 corrected three-actor cast, truthful surfaces, frozen private-request target and account; C-approved captions. Reconcile Desk bounds, near-director mark, P1 endpoint transform and safe-region convention before compilation. Design metres are build inputs, never independent runtime entity state.

**Acceptance:** source export fixes one location-local origin/axes/metre scale. Adapter deterministically emits normalized 0–100 marks/routes/polygons/occluders/attachment and camera coefficients per review §1, real revisions/hashes and all `correctionSceneSlots()` marks. Assets/geometry are pinned separately from decision semantics; same source facts/options/decision versions remain intact. Actor IDs/owners are reused for open-door projections. Desk→meeting remains a cut, P0 does not create travel, P1 does not authorize final NPC exits. Round-trip math, door endpoint correspondence, obstacle clearance, safe anchors, same-body returns and immutable NPC positions pass. Desktop/portrait project the same normalized roots with independent recipes. Route fields survive `compileFixturePlan`; invalid/behind-camera/unreachable required anchors fail validation, not silent clamp. Build order/font/runtime dependencies and asset hash provenance are reproducible offline.

**Stop condition:** two mutable coordinate registries, inferred/unapproved bounds/door transform, incomplete required marks, fabricated graph/cast, scene-specific stale hero mark, public private asset, fake hashes or missing source-approved corrected export. Re-review B01/B02 closure before C.

## C. ExperiencePlayerV3 shell

**Owner:** D; A reviews binding; E checks input/compatibility.

**Files:** **new** `src/components/experience/v3/ExperiencePlayerV3.tsx`, `experiencePlayerV3.css`; existing `useExperience.ts`, `FocusCoordinator.tsx`, `V3Harness.tsx`, `src/engine/input/InputManager.ts`, `src/engine/v3/compat/loadPlayable.ts`, `src/engine/v3/readable.ts`; `src/App.tsx` only for an isolated development entry if necessary. Keep `V3FoundationPlayer.tsx` as headless reference/harness, not duplicate authority.

**Dependencies:** reviewed A+B; explicit artifact pins and approved source-safe recipes. Development mount only; product/art approval status visibly documented rather than assumed.

**Acceptance:** shell composes one InputManager, hook and readable projection; prepared initial entry, distinct native action/confirm activation, standard Tab exit, IME/editor exclusion, focus scope/modal/hidden/user-pause behavior preserved. Public Context and reader controls deliver the same receipts. Persistent fictional editorial test-story label at entry/readable/account. Host operational states (loading/save error/retry) project contracts, never become a second story machine. V1/V2 routes/stored posts remain compatible. Unmount invalidates all async callbacks and disposes resources.

**Stop condition:** second controller/phase state, unsolicited legacy replacement, lost focus/input ownership, same activation commits, or pre-boundary private import/result. Do not add a production route or deploy.

## D. Scene viewport

**Owner:** D with B assets; A reviews movement/geometry boundary; E checks projection.

**Files:** **new** `SceneViewportV3.tsx`, `NormalizedProjection.ts`, `SceneLayersV3.tsx` under `src/components/experience/v3/`; existing `visualHooks.ts`, normalized geometry resource/adapter, `src/engine/v3/queries.ts`; versioned corrected public layer assets under a scoped V3 asset directory specified by B's inventory.

**Dependencies:** C shell, B export, A async preload/local marks.

**Acceptance:** graphite/paint/mask/actors/surface DOM use one compiled normalized projection and depth/height ordering. Entity owners resolve held objects; current/adjacent actors use the same IDs. Public art has no baked unsupported source claims or reveal text. Movement/hit testing reverses CSS scaling and camera transform, uses legal polygons/obstacles and Foundation updates only. Mask/focus progression is decorative; no receipt from looking, timing or proximity. Keyboard/touch/readable remain available without walking. Transaction keeps source mounted until destination prepared/committed, followed by proper entry/focus receipt. Static fallback conveys the same facts/intention without extra evidence.

**Stop condition:** slide covers nearer hand, actor duplicate, closed-door evidence, unvalidated geometry, renderer-owned position, or new attention/evidence gate.

## E. Desk

**Owner:** D + B; C source/copy approval; E receipt parity.

**Files:** **new** `src/components/experience/v3/scenes/CorrectionDesk.tsx`; existing `theCorrection.presentation.ts`, public semantic/runtime fixture and provenance map, `readable.ts`; corrected F01/M01 and deck surface resources.

**Dependencies:** D viewport; exact Gold F01–F07 and required/optional receipt ledger.

**Acceptance:** historical desk frame exposes exact “Mira’s forecast” source title, hero's summary and contextual DOM beats including yesterday's quoted remark, contribution/contract/dependence context. Required title can be received through observation or approved reader equivalent; no two-look matching prerequisite. No extra colleagues, surname, numeric figure, quarter/draft number, invented storage/time-of-day or visible meeting history. Deck and meeting slide remain distinct IDs; summary stays hero-owned. Desk→meeting is one spine cut with carried attachment, no return to historical desk.

**Stop condition:** unsupported content, skipped minimum receipt, observation/walking quota, summary pickup gate, or new desk→hallway portal.

## F. Meeting

**Owner:** D + B; C source/plateau approval; E verifies both marks.

**Files:** **new** `src/components/experience/v3/scenes/CorrectionMeeting.tsx`; existing public fixture/provenance/presentation, geometry resource, `visualHooks.ts`; corrected F02/F04/F05/M02/M05 and slide surface.

**Dependencies:** E desk; stable three-actor composition, own-seat/near-director marks and exact event/receipt order.

**Acceptance:** `c_meeting_before` and `c_meeting_question` share meeting ownership/geometry but distinct arc purpose; exactly hero/Mira/director. F11 quote exact; no cups/laptop state changes on return. Reader-paced beats/event receipts stay one-shot. Title/summary surfaces source-safe; optional summary and reversible seat/near-director preparation remain available at final plateau. Both marks project correctly and preserve act availability without distance gating. Freeze NPC/causal/evidence changes immediately on successful confirmation, even while host save is pending.

**Stop condition:** invented audience/gesture/response, skipped final quote, required observation beyond ledger, stale room mark or camera used as a proximity gate.

## G. Hallway / return

**Owner:** D + B; A verifies transaction/recovery; E adversarial return checks.

**Files:** **new** `src/components/experience/v3/scenes/CorrectionHallway.tsx`; `SceneViewportV3.tsx`, normalized doorway projection; existing `TransitionController.ts`, `queries.ts`, fixture geometry/presentation; corrected F03/F04, **new Design** portrait hall/return specimens.

**Dependencies:** F; A's deferred loader and local-mark restoration; B's approved open P1 transform.

**Acceptance:** break events open the one supported doorway; hall↔room may repeat without replaying board quote or resetting facts/observations/preparations/objects. Only hero transfers; summary follows. Visible room actors are the same meeting-owned actors and frozen staging, not arbitrary hallway head proxies. Destination mount waits for preparation, source remains on failure, late promise cannot swap newer scene. First entry and return placement match normalized location marks. Resume closes break and reaches final meeting/question; no further break travel or NPC exit afterward. Cut/still/readable fallback delivers equivalent minimum facts.

**Stop condition:** new graph edge, duplicate/displaced NPC, state reset or event replay, different local mark on return, or transition success before asset decode.

## H. Decision projection

**Owner:** D + B; A validates causal/input binding; C exact labels; E keyboard/touch/readable parity.

**Files:** **new** `src/components/experience/v3/DecisionProjectionV3.tsx`; existing `queries.ts`, `readable.ts`, `visualHooks.ts`, `FocusCoordinator.tsx`, InputManager, `theCorrection.presentation.ts`; corrected C06/C15 and desktop/mobile option/confirmation specimens.

**Dependencies:** F+G; exact common minimum receipts and Foundation opportunity list. Selection at final plateau remains reversible until distinct confirm.

**Acceptance:** same derived available opportunity IDs/full labels, same order and confirmation copy on native anchored/stacked/readable controls. Self/hand points to correct-public, director to private request, neutral hero/seat cue to pass-question; all selectable from either preparation. One logical control group reflows instead of creating duplicate tabbable decisions. `REQUEST_INTENT` shows confirming/underline; successful independent `CONFIRM` alone creates accepted commitment. Cancel/close/held key/double click/stale activation never accidentally commit. No hover, long press, proximity, look order or moral emphasis gates. Mobile controls remain full and scrollable in safe bounds, including RU strings.

**Stop condition:** hard-coded alternative option list, “Ask Mira,” partial intent, accepted styling before confirm, clipped sole control or causal duplicate state.

## I. Three enactments

**Owner:** B recipes/poses, C caption/source approval, D presentation binding, E frame/receipt QA.

**Files:** **new** `src/components/experience/v3/CorrectionEnactment.tsx`, `PresentationReceipts.ts`; existing `theCorrection.presentation.ts`, `useExperience.ts`, normalized rig attachments; corrected C07/C14/C16, F06a/b/c and all portrait act/mark/reduced-motion specimens.

**Dependencies:** H accepted commitment, A callback identity and durability, B/C source-safe recipes and approved two pending captions.

**Acceptance:** correct-public initiates hero speaking to room, no fabricated spoken quotation; private-request asks director now for later credit clarification without NPC approach/exit/ack; pass-question shows explicit non-speaking intention and preserves selected neutral pose. Each works seated/near-director (approved still/cut allowed), summary remains attached, complete caption accessible. Hero-only animation ends at exact stop before response; guarded `ENACTED` fires once after final pose/caption. No option-specific author account. Failure of persistence cannot erase accepted act or restart confirmation.

**Stop condition:** Mira moves, director replies, meeting closes, unsupported gesture/dialogue, forced silent assent/pose, missing caption or enacting receipt emitted before stop render.

## J. Boundary

**Owner:** D + B; A receipt/gate review; C bridge approval; E timing/skip/recovery.

**Files:** **new** `src/components/experience/v3/CorrectionBoundary.tsx`; `PresentationReceipts.ts`, `useExperience.ts`, `CorrectionEnactment.tsx`; corrected C08/F07/M07; boundary-only bridge resources if released as private presentation.

**Dependencies:** I final stop; accepted journal's durable-save signal; A phase contract.

**Acceptance:** enacting→holding only on completed act; held trace targets 0.6–1.2s and supports skip; `HOLD_DONE` reaches boundary, bridge completion sends guarded `BOUNDARY_DONE` only after local durable acceptance. Presentation timers cannot advance narrative/opportunity time. Skip installs correct stop/caption first; reduced motion substitutes stills with same receipts. Hidden/pause stops and settles without catch-up. Reload after acceptance resumes locked boundary, not choice or NPC reenactment. Explicit retry UI preserves acceptance if local save fails; no mandatory four-second withdrawal/typewriter delay.

**Stop condition:** account loads before durable acceptance/boundary release, mandatory extra wait, causal clock tick, lost caption, new NPC reaction or replayed acceptance on restore.

## K. Private reveal

**Owner:** D host/UI, A validator/release, C exact record/disclosure approval, E privacy and recovery.

**Files:** **new** `src/components/experience/v3/PrivateRevealV3.tsx`, `CorrectionRevealHost.ts`; existing `useExperience.ts`, private `theCorrection.reveal.ts`, `contracts/reveal.ts`; corrected C09/F08/M08 source references only; no public preload import of private screenshots/text.

**Dependencies:** J release and A runtime validation/repository recovery; trusted variant→same-record mapping.

**Acceptance:** boundary triggers loader, host validates closed record/identity/status/options/profile before rendering and retaining private result; missing/invalid/stale response yields visible failure/retry. Rich/compressed and all options reveal exact same Gold account and fictional editorial status. Act automatic; why and aftermath reader-paced, withholding preserved, explicit disclosure skip tracked. Focus heading once; subsequent sections respect reading focus. Private content absent from public manifests/snapshots/readable pre-boundary/hooks/logs/build's eagerly loaded public resources. Restored revealed state re-resolves permitted private record before claiming usable account; a `ready` status alone is not content. Never use player option to manufacture author account or moral feedback.

**Stop condition:** Design's rewritten account, source mismatch, wrong version, unvalidated HTML/partial result, early author-option/text leak, fake real author/social statistics or timed disclosure.

## L. Mobile / reduced motion

**Owner:** B portrait/crop/illustration, D responsive/DOM/recipes, C EN/RU copy, E independent accessibility/device checks.

**Files:** `ExperiencePlayerV3.tsx`, `experiencePlayerV3.css`, `SceneViewportV3.tsx`, `DecisionProjectionV3.tsx`, `CorrectionEnactment.tsx`, `CorrectionBoundary.tsx`, `PrivateRevealV3.tsx`; normalized camera recipes; corrected/new Design portrait specimens for every scene, mark, act, confirmation, boundary, loading/retry and reveal section.

**Dependencies:** K; review §9 measured 390px defects; shared normalized positions; C-approved RU translations. Responsive controls should be considered from C onward, finalized here rather than retrofitting a separate mobile story.

**Acceptance:** verify real 390 CSS px viewport, dynamic height/safe-area inset padding, minimum 16px gutter and 44px touch target. Screen depth cannot hide speaking hand/summary; director and source-required room context have approved visible/readable presentation. Full option/caption/reveal text wraps/reflows at 200% text size and long RU strings, without horizontal control clipping. Touch scroll beginning on scene remains scroll, drag never commits, focus order/Tab exit match readable mode. All four rich scenes plus compressed control, both preparations, three acts, confirmation/retry and all reveal fields have evidence. Reduced motion removes travel/camera motion and retains final pose/caption/boundary receipts without causal timing or reading delays. Actual browser/AT/device evidence names environment; static frames do not count as device passes.

**Stop condition:** offscreen sole option/target meaning, hand occlusion, tiny fiction label, absent why/aftermath, fixed image text used as accessible UI, state change from preference, or missing language/device evidence claimed passed.

## M. Browser QA

**Owner:** E owns acceptance/report; A/B/C/D fix their own defects and provide pinned candidates.

**Files:** existing `scripts/test-v3-browser.ts`, `scripts/test-v3-correction.ts`, `scripts/test-v3-foundation.ts`, `scripts/lib/correctionWalk.ts`; **new** `scripts/test-v3-correction-browser.ts`; `docs/v3/V3_FIRST_SLICE_ACCEPTANCE.md` matrix as test authority; **new** `reports/v3-qa/visual-first-slice-qa.md` and scoped redacted test evidence.

**Dependencies:** A–L complete and pinned; source-safe compressed compositions; named browser/device/AT/language environments. Human research approval is a separate gate and cannot be manufactured by this suite.

**Acceptance:** test every applicable T01–T30 acceptance requirement with explicit pass/fail/pending evidence. Rich/compressed × all three options × keyboard/touch/readable paths preserve same receipt list/options/private account. Test source→hall→return loops, both preparations/undo, decode failure, stale tx and mount/revision completions, rapid/held/stale input, skipped and reduced-motion choreography, hidden-tab pauses, persistence rejection/sync throw/reload/conflict, invalid private record/retry, malformed snapshots and pre-boundary leak injections. Verify entity/attachment/frame truth at stop, portal geometry/hit tests, safe areas, text zoom and EN/RU. Use actual Chrome and named mobile/AT environments; synthetic AT clicks do not establish screen-reader support. Confirm no V3 owner on V1/V2 routes. Run `npm run lint`, full `npm test`, `npm run test:v3-browser`, new visual browser checks, existing app build and offline fixture validator; no paid benchmarks/provider calls. Record timing/assets only for the tested candidate, not hypothetical production performance.

**Stop condition:** any critical truth/privacy/commit/persistence/restore/control defect, false pass, compatibility regression or required untested path. Classify noncritical polish separately; required pending real-device/AT/translation evidence stays pending. No deployment/main merge follows automatically from QA or this review. Human tests must independently address hallway cost, reveal strength, material preference and poll-like feeling.

## Completion rule

Order is **A → B → C → D → E → F → G → H → I → J → K → L → M**, with C blocked until upstream contracts and corrected Design source/geometry are reviewed. Each step supplies its owner, files, dependency, acceptance and stop above. Source/copy/layout may be developed upstream while A runs, but no competing schemas/phase machines or partial Design integration are permitted. A later gate review must distinguish technical readiness to build, a completed visual slice, human/product acceptance and permission to release.
