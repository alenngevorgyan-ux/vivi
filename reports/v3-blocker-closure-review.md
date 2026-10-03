# VIVI V3 — blocker closure review

2026-10-03 · `review/vivi-v3-blocker-closure` · review only

**NOT READY FOR VISUAL PLAYER BUILD**

Seven blockers close. **B02 remains OPEN:** the published geometry and the implemented validation contract disagree about cameras, collision and recipe coverage. This finding concerns the source/contract seam, not the absence of checked-in final player adapter output.

| Stream | Reviewed revision |
|---|---|
| Runtime | `implementation/vivi-v3-prebuild-contracts` · `5470655331f97217863e97235848d2d70badf55a` |
| Design r3 | `design/vivi-v3-correction-slice` · `5e05495707c82cc43a73b15a7a6440bd04db756b` |
| Previous review / approved build sequence | `review/vivi-v3-final-integration` · `ae7d973` |

Read the four requested review/plan/contract documents and Gold `docs/v3/format-proof/THE_CORRECTION.md`. Inspected r3 README, geometry, inventory, C01–C18 boards and source artboards, all 19 runtime assets, all 40 reference frames and both reference layers, and the generator's active r3 call paths and shared dependencies. Independently checked all 61 inventoried file hashes. Runtime verification used an exact SHA archive in `/tmp`; neither implementation branch was modified or merged. Paths below refer to their pinned stream, not to integrated files on this review branch.

## Closure register

| Blocker | Status | Evidence |
|---|---|---|
| B01 — Design / Gold source safety | **CLOSED** | Corrected active r3 imagery, staging and host-only copy bindings; details below. |
| B02 — Geometry | **OPEN** | Real r3 inputs reproduce five adapter camera rejections and two blocked hero anchors; recipe coverage also contradicts the validator. |
| B03 — Async host / presentation | **CLOSED** | Actual host implementation plus deferred-promise and browser checks. |
| B04 — Durable acceptance | **CLOSED** | Journal/repository contracts, immutable acceptance, identical retry, exact acknowledgement, recovery and reveal gate verified. |
| B05 — Restore | **CLOSED** | Shape-first validation, adversarial witnesses/fuzz and locked accepted recovery verified. |
| B06 — Private record | **CLOSED** | Runtime validation, fail-closed loading, explicit shared-record mapping and private retention verified. |
| B07 — Canary validity | **CLOSED** | Author-time minimum-length validation and invalid-configuration scan failure verified. |
| B08 — Editorial captions | **CLOSED** | All three exact candidate intention strings approved against Gold; one canonical binding identified below. |

## B01 — CLOSED

`generator/frames2.py` renders only HERO, MIRA and DIRECTOR. `geometry/source.json` registers those three identities; hallway projections reuse Mira/director through the declared meeting→corridor transform. C01–C07, C12–C17 and every reference/runtime image show no extra attendees or colleague proxies. The active `render3.py` path uses the text-free `frames2` scenes, not the old `frames.py` meeting/reveal functions. The retained shared module still contains legacy colleague/account definitions; they are not rendered by r3 and are not runtime assets. This closure approves the r3 generation path and inventory.

The private intention points to the director (`boards_r3.py:ANCH.private`); C06/C07/C14 and D06b/M06b depict the hero initiating that request now, for later clarification. Mira/director use the same roots and poses before/after acceptance. There is no Ask Mira option, NPC departure, acknowledgement or promised outcome. Public correction starts speaking; pass preserves seated/standing preparation without assent. All acts stop before response. The summary remains the hero's hand/lap attachment, including the private-request left-hand pose.

Runtime plates/props and reference frames contain neutral unnumbered texture, without Q4, draft/version evidence, invented name/byline, spoken dialogue or author account. Board wording is documentation/live-copy overlay, not a runtime raster text source. C09 and `assets.json.private_reveal` provide the same three host text slots for every choice, with `path:null` and `preload:false`. The exact R01–R03 account remains in runtime's separate `theCorrection.reveal.ts`; both variants resolve it unchanged. No private text is baked into pre-boundary art.

`director.question` is explicitly HOST/Gold/verbatim in README, C06/C18 and the copy registry. Runtime Gold F11 retains **“Anything to add before we use this?”** No Design paraphrase replaces it. The build must bind that existing source string.

## B02 — OPEN

The missing-source work is substantially complete: r3 declares metre axes/origins, bounds, walkable polygons, obstacles, occluders, paired portal endpoints/transforms, actor/object/hero anchors, display corners, desktop/portrait recipes and safe regions. Runtime supplies deterministic normalization, geometry validators and per-location saved hero marks (`TransitionController.ts:moveHero`). Geometry tests pass on their synthetic source. SHA-256 of the actual r3 `geometry/source.json`: `992340663d8cc7f384d8ccacd6dbe5d3ea687e8e803d6dc55cf3aa166f558273`.

However, the actual source cannot satisfy the current contract unchanged:

| Independent witness from r3 | Implemented rule / reproduced result |
|---|---|
| Corridor desktop camera z=3.2 and portrait z=3.9; floor zMin=0. Meeting portrait z=0.4, portrait_room z=1.6, portrait_east z=1.4; floor zMin=0. | `geometry/designAdapter.ts:adaptDesignGeometry` requires `cam[2] < zMin`. Each of these five recipes throws **“the floor is not entirely in front of the camera”**. |
| Open-plan `at_desk=[5.55,2.25]` lies inside `hero_desk` x=4.05…5.75, z=1.95…2.65. Meeting `own_seat=[0.65,3.1]` lies inside `chair_own_seat` x=0.41…0.89, z=2.86…3.34. | Actual runtime `standable()` returns **false** for both after the specified affine normalization. `validateGeometryForManifest` requires every compiled mark to be clear of obstacles, with no seated-mark exception. |
| Meeting `own_seat` projected through `portrait_room` has screen x≈−2238.33; `near_director` through default portrait has x=1544. Portrait title-safe x=40…740. | `contracts/geometry.ts:validateGeometryForManifest` checks every mark/anchor against **every camera in its location**. R3 instead assigns separate portrait recipes to different beats/anchors. Keeping those recipes faithfully fails this rule. |

These witnesses were executed against the pinned adapter/`standable()` using actual r3 JSON values. Camera probes supplied only the unchanged location bounds and camera coefficients, with empty unrelated geometry lists to isolate the rejection. Collision probes transformed the published walkable/obstacle polygons and hero roots by the contract's affine mapping. Projection witnesses use the exported pinhole formula. No source values were moved, clamped or silently discarded.

**Required closure:** Design and runtime owners reconcile supported interior-camera/recipe coverage and legal hero placement under the existing geometry handoff, then verify these real-input witnesses. This is a narrow contract/source correction; it requires no new architecture document. Renaming keys, mapping entity/portal IDs, compiling the final resource and checking in the player adapter remain ordinary **Phase B** work. Their absence alone does not block closure. The reproduced validation contradictions do.

## B03–B07 — CLOSED

**B03:** `ExperienceHost.ts:prepareEntry/prepareTransition` await injected preparation, catch synchronous throws/rejections and reject wrong-scene results. Transition completion checks live mount, attempt, phase and current transaction; detach aborts work. `useExperience.ts` detaches/recreates the host on manifest identity/revision changes. `enacted`, `held` and `boundaryPresented` validate separate phase tokens; only explicit headless mode auto-advances. Host checks 1–6 exercise failure/retry, superseded transactions, recurring IDs, unmount/remount/revision and stale/replayed/hidden receipts. Actual image/font preparation belongs to the visual build's preloader contract.

**B04:** `hostContracts.ts` defines durable journal and idempotent repository obligations. `ExperienceHost.ts:persist/retryPersistence/recover/updateGate/ackMatches` preserve the accepted choice, write snapshot+operation, retry the identical key, validate recovered identity and require exact key/decision/option acknowledgements. The reducer independently rejects mismatched/duplicate acknowledgements. Boundary presentation plus durability (journal written or exact durable repository acknowledgement) gates loading; both writes failing keeps it shut. Host checks 7–13 and browser checks 13–14 pass, including visible save failure and retry without reopening. A real repository must enforce the documented conflicting-first-answer rule; the dev sessionStorage journal is a harness implementation, not a production service.

**B05:** `ExperienceController.ts:restoreSnapshot` checks record shapes before nested reads, then identities, enums, references, clocks, registry/owners, full undo unions, saved placements and decision/phase/lock/reveal consistency. Accepted records resume locked at boundary; stored `recorded` becomes `accepted` pending a fresh exact acknowledgement. Completed decision/memory reveals stay completed and re-resolve private data. Pre-build checks 8–11 pass, including the previous null entity, invented decision status, malformed undo and negative-clock witnesses, 63 named invalid cases and path-substitution fuzz. This verifies serialized snapshot input.

**B06:** `contracts/reveal.ts:validateRevealRecord` validates closed fields, version/identity/status, bounded plain text, source references and option membership; `correctionRevealBinding()` applies the Gold launch profile and explicit rich/compressed→one-record revision mapping. `ExperienceHost.ts:loadReveal` fails closed on missing/invalid/rejected/stale results and retains a cloned validated record privately; `revealRecord()` exposes it only in revealed/ended phases. Host checks 14–18 and Correction separation/parity checks pass. Public manifests, snapshots, hooks, journal and traces contain no private account. Production authorization remains deferred as previously classified.

**B07:** `contracts/validate.ts:validatePrivateCanaries/normalizeCanary/findPrivateLeaks` share NFC/trim/lowercase normalization, require length ≥4, reject blank/short/non-string/empty lists at author time and throw index-only errors if a scan receives invalid configuration. Foundation check 33 and pre-build check 12 pass, including escaped strings and normalized injections.

## B08 — CLOSED: exact approved copy

These are complete-intention labels, not quoted speech. All three candidates are approved without adjustment:

| Option ID | Exact final string | Gold support |
|---|---|---|
| `correct_public` | **Say I built the forecast** | §J heading/intent; S02/S12. |
| `request_private` | **Ask the director to clarify my credit privately afterward** | S12 and §J target/confirmation: request initiated now, director addressed, clarification sought afterward, agreement unknown. |
| `pass_question` | **Let this question pass without speaking** | S12 and §J heading/explicit non-speaking intention. |

**Single build binding:** `src/data/experienceV3Fixtures/runtime/theCorrection.presentation.ts` → `correctionActSlots()` → each option's **`caption`** record. Bind these approved strings there once during the existing presentation-copy work; the first two currently carry `pending_editorial`. Reuse that canonical option-to-string mapping for live intention controls/captions and Design's `intent.speak`, `intent.private`, `intent.pass` slots. Do not use the generator's PLACEHOLDER prose as final copy. Gold's existing second-person silence sentence remains source text; the approved first-person intention label above does not invent dialogue. No protagonist utterance is authored by this review.

## Non-paid verification and disposition

| Independently run on pinned runtime | Result |
|---|---|
| `npm run test:v3-unit` | PASS: 34 Foundation + 12 pre-build + 18 host checks. |
| `npm run test:v3-correction` | PASS: 15 checks. |
| `npm run test:v3-browser` | PASS: 20 checks, installed Chrome 150.0.7871.125. Sandbox initially denied localhost; permitted rerun passed. |
| `npm run lint` | PASS. |
| `python3 src/data/experienceV3Fixtures/spec/validate.py` | PASS: 1,157 offline assertions. |
| Design inventory/hash/image inspection | All 19 runtime + 42 reference hashes match; all C01–C18 and inventoried images inspected. |
| Actual r3 geometry probes | FAIL compatibility as recorded under B02; synthetic suite passes do not override these witnesses. |

P01–P04, DESIGN POLISH, HUMAN TEST QUESTION and DEFERRED classifications remain unchanged. In particular, the existing portrait layering/stop-frame patch and real mobile/readable/reduced-motion acceptance remain player-build work. No visual player, new master plan, main change, deployment or paid provider test was performed. Only this review report is committed to the review branch.

**NOT READY FOR VISUAL PLAYER BUILD**
