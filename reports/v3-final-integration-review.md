# Final first-slice integration review

2026-10-03 · review only · branch `review/vivi-v3-final-integration`

**NOT READY FOR VISUAL PLAYER BUILD**

The Foundation and headless Correction slice establish a usable causal model. The complete Design package is not a faithful visual implementation of that model or the approved source. Its private-request enactment changes the recipient and moves Mira after acceptance; its author account describes a different choice. Geometry is a proposal rather than a versioned machine-readable handoff. The React host also needs explicit loading, presentation, persistence and private-record contracts before a real renderer can use it safely. This review defines those contracts; it does not implement them or certify them as passed.

## Revisions and authority

| Stream | Reviewed revision |
|---|---|
| Current base / QA | `fix/vivi-v3-first-slice-qa` · `bece4957f1898734ffd58a696ea86070da9988d6` |
| Headless integration | `integration/vivi-v3-first-slice` · `ef3e1f00318f59f9f54956312e638f746da28030` |
| Foundation | `implementation/vivi-v3-foundation` · `ae60563c64ac245f94e7e1abc9a8a7089e844055` |
| Integration baseline | `planning/vivi-v3-integration-readiness` · `5d759448da890048be70416a33bbc724e7a1e630` |
| Format Proof / Gold | `prep/vivi-v3-format-proof` · `028e400fb78d888036a5e184a8060200e63a5a0b` |
| Design | `origin/design/vivi-v3-correction-slice` · `aed9eeb481b830bce38a5c666685af4c47479535` |

The integration baseline owns operational requirements; Gold owns source truth; Foundation owns executable contracts; Design owns approved staging and assets within those constraints. Historical statements that Foundation was unverified are superseded by the pinned implementation and QA evidence, not silently rewritten. Design's “frozen” label does not override Gold or establish product-owner approval of Remembered Room.

Read completely: integration baseline, execution board, first-slice acceptance, Foundation handoff, Correction runtime handoff, Correction Gold, Format Proof red team, integration-readiness audit and first-slice QA reconciliation. Inspected the entire Design export without merging it: README, all 17 JPG boards including C13/C15/C16/C17, all 16 desktop WebPs, all six mobile WebPs, all four PNG layer plates, 17 source HTML artboards, canvas JSON, 13 Python generator modules and URL mapping (76 tracked files). Source text and generator behavior were checked against the rendered frames. Design paths below are relative to that export, available at the [pinned Design tree](https://github.com/alenngevorgyan-ux/vivi/tree/aed9eeb481b830bce38a5c666685af4c47479535/docs/visual-v3/correction-slice); they are not integrated into this branch.

## Finding register

| ID | Classification | Finding / disposition | Owner and closure evidence |
|---|---|---|---|
| B01 | BLOCKER BEFORE PLAYER BUILD | Source conflicts across boards, generator, desktop/mobile and layers; private request and author account are substantively wrong. | B Design + C editorial: one corrected, republished package, source-checked as specified below. |
| B02 | BLOCKER BEFORE PLAYER BUILD | No authoritative exported geometry with location origins, transform, collision/occlusion, all runtime marks, hashes and viewport bounds. Snapshot also lacks location-specific hero marks. | B Design + A Foundation + D Integration: validated deterministic adapter output and round-trip/return checks. |
| B03 | BLOCKER BEFORE PLAYER BUILD | `useExperience` immediately resolves preload and collapses three presentation phases. | A Foundation: async host contract, explicit headless mode, stale/unmount/revision guards; tests with deferred promises and callbacks. |
| B04 | BLOCKER BEFORE PLAYER BUILD | Persistence failure swallowed; missing callback becomes fake success; save is unacknowledged. | A Foundation: durable acceptance journal, idempotent repository ack, recovery and visible failure contract tested. |
| B05 | BLOCKER BEFORE PLAYER BUILD | Restore hardening remains incomplete; null entities throw and malformed accepted records pass. | A Foundation: ordered runtime validation and adversarial witnesses below pass without throws. |
| B06 | BLOCKER BEFORE PLAYER BUILD | Private loader discards result, allows absent loader to succeed, and has no runtime record validation. | A Foundation + C editorial: validated host-only record, boundary release and version mapping, fail-closed loading tests. |
| B07 | BLOCKER BEFORE PLAYER BUILD | Short private canaries silently provide no protection; fixture validity must enforce minimum length. | A Foundation + C editorial: author-time validation and invalid-canary tests. Current Correction canaries are long enough. |
| B08 | BLOCKER BEFORE PLAYER BUILD | Two act captions remain `pending_editorial`; Design's fabricated quoted dialogue cannot fill them. | C editorial: approved complete-intention captions without invented sentences, bound into public slots. |
| P01 | PATCH DURING PLAYER BUILD | Spatial labels need native controls, distinct confirmation, responsive layout and parity with readable actions. | D Integration + B Design: H/L/M in build plan. |
| P02 | PATCH DURING PLAYER BUILD | Actual portrait framing and layer ordering obscure required actors/stop frame; required mobile states are missing. | B Design + D Integration: corrected portrait recipes/stills before accepting F/I/L. |
| P03 | PATCH DURING PLAYER BUILD | DOM source copy, fact receipt binding, focus, reader-paced reveal, skip and reduced motion need real browser verification. | D Integration + E QA: C–M. |
| P04 | PATCH DURING PLAYER BUILD | Compressed control has runtime parity but no Design compositions. | B Design + D Integration: same assets/source, two approved compositions, separate decision version; before comparative browser/human acceptance. |
| D01 | DESIGN POLISH | Face-plane/paint refinement, graphite weight, paper texture and non-informational settling remain illustrator work. | B Design; changes must preserve identity, source and stop frames. |
| D02 | DESIGN POLISH | Desktop caption x=64 is outside the C11 90% title-safe inset (x=96). | B Design; resolve safe-area convention and wrapping in the approved export. |
| H01 | HUMAN TEST QUESTION | Is hallway worth its cost compared with the compressed control? | Product owner / research; no conclusion from headless parity. |
| H02 | HUMAN TEST QUESTION | Is reveal emotionally strong and understood without moral scoring? | Product owner / research; all three options see the same approved account. |
| H03 | HUMAN TEST QUESTION | Is Remembered Room preferable, and is that direction approved? | Product owner; C17 is not approval evidence. |
| H04 | HUMAN TEST QUESTION | Does the room decision feel too much like a poll? | Product owner / research; accessibility requirements remain in force. |
| X01 | DEFERRED | Production reveal authorization/service, public social, general generation, other gold players, author flow and deployment. | Follow execution-board gates; no work authorized here. |
| X02 | DEFERRED | HY first-slice localization; V1/V2 language support remains intact. | Future scope. EN/RU first-slice review still requires competent translation and actual language/AT evidence. |

Blockers are unresolved in code/assets. Agreeing to a contract in this document does not close them. P02 requires source-safe B01/B02 inputs first; its responsive implementation can happen during the player build. No product preference is inferred from these technical findings.

## Source reconciliation required from Design

1. **Cast and evidence:** only `a_me`, `a_mira`, `a_director`. `generator/frames.py:14–17` defines four colleagues, present in meeting frames and L1/L4; desk also includes an extra colleague silhouette. C17 freezes this expanded cast. Remove them, including adjacent-room proxies. Do not show meeting occupancy as known from the historical desk. C13's claim that the meeting is visible from both other locations does not authorize that disclosure.
2. **Displays and summary:** Gold F03 title is “Mira’s forecast.” The generated display says “Q4 Forecast” / “Mira Hale · Planning”; reveal paper says “Q4 FORECAST · DRAFT 6” / “this dip took two nights.” C09 also supplies unsupported work-history detail. Replace unsupported content with approved DOM source text and nonnumeric visual texture. `o_deck` and `o_slide` are separate surfaces of the same content; `o_summary` always remains hero-owned. The title/byline is visibly baked into L2 despite the layer handoff promising live text. Two matching looks cannot become an additional receipt requirement or an evidence puzzle.
3. **Narration:** `generator/render_all.py:14–23` invents shared-drive/time-of-day and a ten-minute break; rewrites the director's question; adds invented spoken dialogue. Use the exact public fact/beat projection, including yesterday's quote, six-week/contract context and the exact final question “Anything to add before we use this?” All 13 minimum receipts must be deliverable; F10 stays optional. The assets alone do not supply this context.
4. **Private request:** F05/M05 attach the option to Mira and label it “Ask Mira after …”; F06b moves Mira from `(1.85,8.05)` to `(-2.65,5.75)` and has the hero intercept her. C07/C14/C16 describe meeting closure/Mira's exit. Gold's act is asking the **director now** to clarify credit privately afterward. Director/Mira remain frozen on acceptance; no meeting closure, NPC exit, acknowledgement or guaranteed later discussion. Replace the option anchor and enactment, not the Gold.
5. **Other acts and continuity:** correct-public names the complete intention without quoting an invented “slide four” sentence. Pass-question caption is “You let this question pass without speaking.” Preserve chosen seated/standing preparation; do not force sitting, turn the paper face down or caption assent (“I let it stand”). F04/F05's moved cups and closed laptop invent changes on return. Preserve object/NPC state unless explicitly source-supported.
6. **Private account:** `generator/frames.py:445–450,484–526`, F08, M08 and C09 replace R01–R03 with an account of staying silent then asking Mira; substitute a different why and handle. Gold author spoke publicly, her voice shook; why concerns ownership in the board proposal; aftermath includes Mira's reported embarrassment, retained contract, exclusion from prep meetings and the later update invitation with causal ambiguity. Bind the separate exact private record for every choice. No preloaded public reveal screenshot, synthetic attribution or player-choice-conditioned account. Preserve fictional editorial labeling at entry, readable view and reveal.
7. **Timing and control:** C08's four-second boundary and C09's 0.8-second/typewriter account are reference effects, not mandatory waits. C15's ordered self→monitor matching cannot gate observations/decisions. C06's “observation/preparation are over” cannot remove optional summary or reversible preparations at the final plateau. Its bracket+second confirmation belongs to `confirming`, not accepted commitment.
8. **Package authority:** republish README, affected C01–C17 artboards/boards, all affected frames/layers and generators together. Resolve frozen/provisional language; include reproducible generation order/dependencies/fonts, actual asset inventory and hashes. Canvas `/_blob/...` references and `urls.json` are source pointers, not loadable runtime resources. The generated `fr/decision_anchors.json` is not a tracked authoritative geometry export. Preserve Gold revisions; do not cherry-pick this conflicting package wholesale.

## 1. One authoritative geometry strategy

**Decision: Design source geometry → deterministic build-time adapter → normalized runtime geometry.** The strategy is valid; the current export is insufficient to instantiate it. Design's metres are input to a build artifact, never a second runtime entity/navigation registry. Foundation's normalized marks/routes remain authoritative at runtime. Desktop/mobile cameras read the same marks and owners.

### Coordinates and conversion

Design must publish one fixed, versioned **location-local** frame per location, independent of camera: origin at the declared near-left floor bound; source `x` right, `y` up/height, `z` depth into the room, units metres. Runtime floor origin `(0,0)` is that near-left bound; runtime `x` increases right and `y` increases depth. Normalize with:

```
runtime.x = 100 * (source.x - xMin) / (xMax - xMin)
runtime.y = 100 * (source.z - zMin) / (zMax - zMin)
source.y / declaredHeightScale = normalized anchor height
```

The adapter applies this same affine mapping to marks, entry marks, route points, walkable polygons, obstacles, door segments and attachments. Round only serialized output to a declared precision; prohibit runtime clamping that silently changes source marks. Validate finite numbers, bounds, geometry revision, referenced IDs and reachability. Source yaw 0 faces camera (`-z`), 90 faces `+x`, 180 faces `+z`; compile approved finite pose/facing IDs because `SpatialMark.facing` is an ID, not an arbitrary angle.

Candidate measurements found in C13/C16/generator, **not an approved export**:

| Location | Source floor bounds / anchors | Unresolved input |
|---|---|---|
| Desk | C13 x `[-4.5,5.6]`, z `[1,10.5]`; deck/hero anchors in generator | Generated floor x `[-6,6]` differs; B must declare authoritative bounds and required `desk`, `deck_display`. |
| Meeting | x `[-3.4,3.4]`, z `[1.2,8.6]`; seat `(-2.75,4.3)`, standing `(-2.2,4.9)`, Mira `(1.85,8.05)`, director `(1.35,7.1)` | Standing by glass is not the required `near_director` mark. Publish source-approved seat, near-director, threshold, slide surface and routes without making action eligibility depend on distance. |
| Hall | x `[-1.6,1.7]`, z `[1,16]`; hero `(-0.85,4.7)` | Publish `hall_threshold`, `door_jamb`, doorway transform and exact allowed ring/bay. |

Meeting seat would normalize to approximately `(9.559,41.892)` with those meeting bounds. This illustrates the adapter; it is not a replacement mark committed by this review.

### Portals, ownership and anchors

Keep Gold's existing portal/event graph: desk→meeting is a spine **cut**; meeting↔hallway are the two directed break excursion edges; resume closes the break and reaches the final question. C13 P0 is background building geography, not a new walkable desk→hallway route. Only break-open P1 permits adjacent projection; a closed final door cannot expose new information.

P1 meeting segment is `x=-3.4,z=5.0…5.95`; hall segment `x=1.7,z=6.3…7.25`. Publish paired endpoint correspondence, facing and an explicit rigid location transform. A translation `(x+5.1,z+1.3)` aligns these numeric endpoints, but the depicted building is not enough to approve this transform; B must reconcile orientation, walls and view before export. Normalize each side in its own location frame. No duplicate NPC “heads” in hallway: transform the same meeting actors' anchors for doorway projection while retaining meeting ownership.

Actor root anchors are feet on floor; hand/summary anchors are named rig attachments derived from that root/pose. Display/deck surfaces need four corners and height; DOM text uses their projected transform. Held summary follows `a_me`, never gains a new location copy. Fixed objects need footprint, vertical extent and occlusion priority. The actor/object registry supplies IDs; decorative strokes never become actors or facts.

**Foundation gap:** `TransitionController.commitTransition` transfers the hero's owner but preserves the old raw mark. `RuntimeSnapshot` has only one entity mark/mark role. Add validated per-location hero marks to the same authoritative snapshot, save source mark before leaving, use destination entry on first visit and saved local mark on return. Scene-specific role mapping must not reuse an unrelated desk role in the hall. Reversible preparation/undo updates the same normalized marks. A→B→A must restore physical placement as well as knowledge; the current headless checks cannot prove this geometry behavior.

### Walkability, occlusion, camera and mobile

Export walkable polygons with holes: desk legal floor; hall width minus approved clearance; meeting perimeter/gap behind chair minus table `x[-0.85,0.85],z[4.4,7.7]`, chairs, glass and walls. Inflate collision obstacles by approved hero radius. Use one geometry resource for movement, route planning and hit testing; fallback to approved cuts/stills/readable delivery when a pose is unavailable. This does not gate any causal opportunity by proximity.

Occlusion is separate from collision: projected furniture/walls/door mullions and opaque paper bases sort against anchor heights/depth. A screen cannot overlay a nearer speaking hand merely because it is added as the last SVG layer. Attention paint changes finish, not ownership, evidence, visibility through closed doors or collision.

Compile `scene3d.Cam.p` perspective into normalized projection coefficients: `screenX=cx+f*(x-camx)/(z-camz)`, `screenY=hy+f*(eye-height)/(z-camz)`, substituting the adapter's inverse constants at build time. Runtime inputs are normalized positions/height and viewport size, not a mutable metres registry. Pointer input reverses CSS scaling/letterbox and the compiled floor projection; raw click percentages are not floor coordinates. Reject behind-camera/degenerate projections.

C11's desktop 90% title-safe means `[96,54]…[1824,1026]` at 1920×1080. Export camera-safe polygons/rectangles per recipe, intersect with actual DOM overlays, and assert required actor/object/option anchors within them. Current top text x=64 violates that inset. Portrait is a **separate camera recipe over the same location marks**, not a crop that changes gameplay positions. Define safe insets from `env(safe-area-inset-*)`, minimum 16 CSS px content margins, dynamic viewport height and reflowing controls below/over a bounded viewport. No essential caption/option can depend on offscreen art. Publish mobile hall/return, private/silence, both preparations and confirmation views; they are missing now.

`compileFixturePlan.ts`'s `GeometryExport` does not yet carry the whole handoff (including route propagation). A must publish a validated versioned geometry resource keyed by kit revision for polygons/occluders/cameras/attachments, and expand the adapter's typed geometry inputs/output deliberately. Do not insert unrecognized keys into the closed manifest or bolt on a second visual world model. Asset hash/version maps must refer to actual corrected public assets; private reveal material has its own boundary-only resource.

## 2. Smallest asynchronous preload contract

Add mandatory visual-host `preloadScene({sceneId, txId, identity, signal}) → Promise<PreparedScene>`. Identity includes experience, manifest/asset revisions, attempt and a mount generation. Prepared means validated/hash-matched resources fetched, images decoded, required font/layout resources available, and destination viewport can mount; an explicitly approved still/readable fallback counts as prepared. No reveal resource belongs here. A missing loader is a visual-host configuration failure, not successful loading.

Flow: `REQUEST_PORTAL` → existing `preload_scene` effect → host awaits preparation → guarded `TRANSITION_READY(txId)` → reducer atomic swap → destination mount/focus handoff → dispose source. Keep the old scene visible and input frozen during preparation. Failed preparation sends `TRANSITION_FAILED(txId)` and shows retry in the source; no ownership/receipt reset. Host catches both synchronous throws and promise rejections. Abort/dispose resources on unmount, revision change or replacement attempt. Check mount generation, full identity **and** current transaction immediately before dispatch: `tx1` can recur in a new attempt. Reducer still rejects stale/duplicate transaction IDs. Initial scene readiness uses the same preparation contract before normal entry. Networking/decode remains outside the reducer.

## 3. Presentation completion contract

Remove implicit visual-host microtask advancement; retain it only in an explicitly selected headless/test host. The renderer consumes `phase`/commitment/scene hooks and sends receipts through the one dispatch:

| Foundation phase | Presentation obligation | Completion event |
|---|---|---|
| `enacting` | Hero-only approved act reaches exact stop pose; complete intention caption available in DOM; NPC/object causal state frozen | `ENACTED` |
| `holding` | Held stop trace, target 0.6–1.2 seconds, skippable | `HOLD_DONE` |
| `boundary` | Approved withdrawal/paper bridge completes; world cannot resume | `BOUNDARY_DONE` |

Each callback carries a host receipt token bound to mount generation, attempt, decision/version/option and expected phase. Validate before dispatch; cancel superseded callbacks. Repeated callbacks are harmless phase rejections. A reloaded accepted snapshot resumes at boundary, not a replayed act. Presentation time never dispatches narrative advance or opportunity/causal ticks. Hidden/blur/user-pause stops sampling; resume settles without catch-up or new evidence.

Skip after acceptance installs the correct final still and caption before the existing `SKIP` transition to boundary; skip in boundary finishes the bridge and emits `BOUNDARY_DONE`. Reduced motion uses stationary final poses and paper change, emits the same receipts after their render obligations, and keeps text reader-paced. Neither path chooses an option, fabricates a response or creates a mandatory reading timer.

## 4. Durable acceptance and persistence failure

**Decision: reveal waits for durable local acceptance, not for optional remote synchronization.** Acceptance remains immutable on `CONFIRM`; persistence does not unlock choosing again. A host acceptance journal/outbox stores the accepted snapshot plus decision operation atomically before releasing `BOUNDARY_DONE` to private loading. The journal is operational metadata, not duplicate decision authority. If local durable storage fails, preserve the in-memory acceptance and stop at boundary with a retry control. Never claim reload safety or a recorded choice in that state; complete storage failure cannot guarantee survival after browser termination.

Replace `persistDecision(decision,option) → void` with a repository operation/ack contract. Operation includes experience, manifest revision, decision version/ID, option, attempt and stable idempotency key. For the first-choice research record, key scope is installation/participant identity + experience + decision version; attempt distinguishes playback/recovery and cannot overwrite the first answer. Do not place sensitive author content in the operation. Retry the identical operation/key; duplicates return the original ack. Conflicts return the existing record for explicit reconciliation, never silently replace a different accepted choice.

Repository ack must identify that exact key/decision/option before guarded `DECISION_RECORDED`. `recorded` means a configured durable repository acknowledged it; an outbox being queued or a callback being absent is not an ack. A local-only repository may acknowledge its durable local commit; a remote-backed repository may remain unrecorded while its locally durable outbox retries. The host exposes queued/saving/failed/retry presentation status without copying choice state. Catch sync exceptions too. No automatic retry should erase the failure display or spin indefinitely.

Show a nonjudgmental status such as “Your choice remains selected. Saving failed. Retry.” Distinguish failure of local save (account waits; reload recovery unavailable) from remote synchronization (account may proceed after journal save; pending/retry remains visible). Do not show “recorded” until ack. Recovery validates snapshot and journal identity, reinstates the same accepted option, retries its operation, discards old async generations and resumes boundary/reveal safely. An already revealed snapshot must re-resolve/validate its private record under the release rule; persisted `reveal:'ready'` is not the record. `useExperience` needs an explicit validated initial-state/recovery path, not a new choice on mount. Repository receipts, journal durability and reveal release need independent tests.

## 5. Private record validation

**Yes: validate `RevealRecordV3` at runtime before display.** TypeScript and a checked-in fixture do not validate an async host result. Add a closed-shape validator for versions/IDs, allowed status, bounded nonempty text, source-reference array, permitted optional handle and author-option membership. Apply the Correction launch profile: fictional editorial status and exact required act/why/aftermath/source mapping. Generic memory/compound stories must retain their allowed absent option/withheld fields; do not make Correction-specific assumptions generic.

Resolve against trusted `revealRef` and explicit variant mapping: rich and compressed manifest revisions resolve the same Gold private record revision. A naive equality check between manifest and record revisions would reject the compressed control. Store the validated record only in host-private reveal state; then emit guarded `REVEAL_LOADED`. Missing loader, `undefined`, invalid status/identity or malformed data emits `REVEAL_FAILED` and a retry view; no partial text/unsafe HTML. Act appears automatically; why and aftermath use reader controls; explicit skip is recorded as disclosure progress, never fabricated reading.

The public manifest, snapshots, readable model, pre-boundary hooks, trace, preload bundle and public DOM contain no private account or author-option mapping. Lazy local import after boundary is acceptable for this development fixture, but repository separation/lazy loading is not production confidentiality. A real service's authorization is deferred. Do not embed F08/M08 or their text in public preloaded assets.

## 6. Canary validity

Keep serialized substring matching with quote/backslash/newline handling. Enforce at fixture authoring/validation that **every** canary is a string whose trimmed, lowercased normalized value has length at least four; use one shared normalization (NFC plus JS string length) for authoring and scanning. Empty/short entries invalidate the fixture with index-only diagnostics instead of silently passing. Update the scanning API or its validated input boundary so callers cannot mistakenly treat invalid configuration as a clean result.

Prefer distinctive longer phrases plus complete private fields; reject blank entries. Do not broaden scanning to arbitrary one-/two-/three-character words, which produces false positives. Add author-validation tests for lengths 0–3, normalization, quotes/newlines and deliberate public injection. Correction's existing canaries satisfy the minimum, but their absence does not certify the source correctness of Design's different account. Never log private strings in diagnostics.

## 7–8. Design hook mapping and decision projection

`projectVisualHooks(manifest,snapshot,settings)` remains a pure projection. Local masks/animation progress/resources/focus bookkeeping can be host presentation state; no second gameplay or visual phase machine. The following maps every requested Design state and identifies the remaining binding:

| Design state | Foundation authority / renderer binding |
|---|---|
| Scene/location | `scene.id`, `scene.location`, compiled scene recipes and `snapshot.arcIndex`; C01 sequence is not a second scene graph. |
| Actors | `actors[].id/owner/location/inView/visibleThrough/mark/markRole`; only the three Gold actors. |
| Objects | `objects[]`, `heldBy` and owner; summary hand attachment, distinct deck/slide, no carried duplication. |
| Facts | `knowledge.receivedFacts`, `deliveredBeats`, `readerCanAdvance`; exact DOM/readable receipt delivery, never inferred from paint or elapsed time. |
| Attention | `attention.selectedTarget`; geometric hover can decorate without becoming selected/known. C15's look order is not a gate. |
| Observation | `attention.observation` / `OPEN_OBSERVATION`; approved target/facts, readable equivalent, optional summary remains optional. |
| Selected intent | `opportunity.selected` (reservation); underline belongs here, never acceptance. |
| Confirming | `phase==='confirming'`, `opportunity.pendingConfirmation`; separate native confirm/cancel, reservation is not commitment. |
| Accepted commitment | `commitment.option/status` and `boundary.locked`; rust accepted style only after accepted `CONFIRM`. Save failure cannot clear it. |
| Enacting | `phase==='enacting'`, commitment slot; hero-only recipe, completion receipt. |
| Holding | `phase==='holding'`; exact stop still and caption, completion/skip. |
| Boundary | `phase==='boundary'`, boundary flags; same locked world, withdrawal recipe, not a new scene. |
| Reveal loading | `phase==='reveal_loading'`, `reveal.phase` loading/failed; private host loader/retry. |
| Revealed | `phase==='revealed'` / ended, validated host-private record; never account in public hooks. |
| Transition | `transition.state/txId/from/to`, then `entering`; async resource lifecycle, ordinary focus/entry completion. |
| Reduced motion | `settings.reducedMotion`, `presentationEligible`; changes recipes only, not facts, option or stop. |

The causal option list comes from the same Foundation availability query/readable model, not a hand-coded three-item Design menu. Spatial labels are **native buttons projecting those option IDs**: self/hand for public correction, **director** for private request, hero/neutral seat cue for silence. The empty seat can be decorative but cannot force a standing player to sit. Same source labels/order/availability/confirmation in keyboard, pointer, touch and readable views. No proximity, double-looking, holding or hover requirement.

Selection sends `REQUEST_INTENT` through InputManager. Confirmation needs a separate released activation and native confirm button; stale/held/double input cannot commit. Dismiss returns to the same plateau and optional actions. DOM focus order follows logical option order, not screen x/y. Use one logical option control group reflowed between anchored and stacked layouts; do not duplicate tabbable overlapping labels/action menus. Mobile places all three full labels inside a scrollable safe control region if the spatial layout cannot fit. A leader line/paint mask may point offscreen only if the destination remains intelligible through approved composition/readable context; it cannot stand in for a visible option.

## 9. Actual 390 CSS px audit

All six mobile masters were inspected at their native 780×1688 pixels, corresponding to **390×844 CSS px at 2×**, not inferred from desktop. Coordinates below are CSS px after division by two. These are static-frame findings, not an iOS/Android browser pass.

| Frame | Exact issue | Required correction |
|---|---|---|
| M01 desk | Shared slide/deck source is wrong; tiny document lettering is art-scale, not a usable observation/readable surface. No entry fiction label, Context/actions or safe-area UI is shown. | Correct public surface; DOM insert/context and real shell rather than relying on printed art. |
| M02 meeting | Screen begins at x≈225, y≈294 and extends beyond right x=390. Mira/director are out of the portrait camera; foreground extra colleagues remain. Screen overlays their heads. | Source-safe three-actor composition or approved contextual insert, proper depth ordering and readable fact delivery. |
| M05 decision | Private leader line ends offscreen at absent Mira; option says “Ask Mira after,” drops complete intent. Labels baselines about y=125/165/700 spread across room, disconnected from shared logical controls. Top question is shortened; no distinct confirmation/cancel specimen. | Director anchor, full exact labels/question, safe reflowing native controls and confirmation, both hero preparations. |
| M06 speak | Screen x≈225…390, y≈294…389 paints over the hero's extended hand/summary; the stop frame cannot be seen. Invented caption replaces approved intention. | Sort screen behind nearer limb/object; show complete correct stop/caption. |
| M07 boundary | Portrait hero cut has no demonstrated skip/reduced-motion/control layout or retained intention caption. Static paper frame cannot prove completion/receipt timing. | Bound safe controls and final still/caption before bridge; stationary variant and completion tests. |
| M08 reveal | Handle/fictional label is 10 CSS px (20 source px), source text is wrong, why is absent; “What happened after” baseline y≈777 leaves ≈67px raw bottom space but no safe-area inset or demonstrated 44px control. | Correct private DOM act/why/aftermath, conspicuous fictional status, reflow and scroll, safe-area padding and controls. |

M05 primary labels are 18 CSS px; the final quotation is 20px and M08 account 24px. These text sizes alone do not prove touch hit areas or contrast. Generator x=20 mobile top-caption margin is only four pixels beyond a 16px base gutter; account x=26 is acceptable at this fixed size, but both require dynamic inset/reflow. No notched-device, browser toolbar, 200% text-size, keyboard or RU-long-string proof exists. Missing frames: hall/return, private request, silence, seat/near-director alternatives, confirmation, loading/failure/retry, why/aftermath and reduced motion. Do not classify untested safe areas as a demonstrated clipped button; the demonstrated hard clipping is the scene/screen/actor and stop-frame composition.

## 10. Four generic Foundation patches, independently reviewed

Reviewed the actual Foundation→headless integration diff, not only the QA summary.

| Patch | Verdict | Reason / required follow-up |
|---|---|---|
| Reposition preparations supersede previous hero `mark_role`, preserving original undo baseline | **APPROVE** | Near→seat→undo restores original value rather than leaving contradictory active preparations. No story-ID special case. Extend the same semantics to normalized per-location marks in B02; do not let renderer retain a rival posture. |
| Private canary needle uses JSON serialization before comparing serialized public data | **APPROVE** | Correctly matches quotes, backslashes and newlines in the haystack. Minimum-length configuration validation is separately required by B07. |
| Restored `consumedActivations` cleared for the new page/input session | **APPROVE** | New InputManager starts at k1/p1; old IDs otherwise swallow new input. Selection/reservation/transient transaction are cleared and accepted decision remains immutable. Async callback generations must likewise be invalidated. |
| Additional `restoreSnapshot` shape/owner/preparation checks | **AMEND** | Correct direction but not a safe validation boundary yet; ordering dereferences null entities before checking records; several unions/values remain unchecked. Required witnesses below. |

Independent executable probes against the current base (fresh Foundation fixture snapshot for each mutation):

| Mutated field | Actual result | Required result |
|---|---|---|
| `entities[0]=null` | Throws `Cannot read properties of null (reading 'id')` | Return invalid, never throw. |
| Decision with valid ID/option but `status:'invented'` | Restore accepted it | Reject invalid decision enum and phase/lock inconsistency. |
| Known preparation, undo state value `{bad:true}` | Restore accepted it | Reject; undo value must be string/null and fully typed. |
| `time.presentationMs=-1` | Restore accepted it | Reject negative clock values. |

Validate raw records before any nested read. Add closed snapshot/enumeration validation, unique entity IDs, mark/state value types, full undo union/owner/key values, finite nonnegative time, time pause shape, phase/reveal/decision consistency, beat/event/fact references and experience identity binding. Normalize transient fields only after validating persisted ones; reconcile claimed recorded state with repository ack. These checks are meaningful recovery tests, not implementation-mirroring tests. The QA-added completed-memory-reveal normalization remains useful and must be retained; it is a later fix, not one of these four.

## Non-paid verification and limits

| Check | Result |
|---|---|
| `npm ci --ignore-scripts --no-audit --no-fund --prefer-offline` | Installed locked dependencies; lockfile unchanged. |
| `npm run lint` | PASS (TypeScript). |
| `npm test` | PASS entire script: legacy validation/runtime/compiler, mocked OpenRouter provider, V2, 34 Foundation checks, 15 Correction checks, deterministic corpus evaluation (39/39). No live provider/paid benchmark. |
| `npm run test:v3-browser` | PASS all 19 Chrome checks, including BUG-04's **known swallowed persistence failure**. A passing known-gap test does not close B04. Initial sandbox run could not bind localhost; authorized rerun outside that restriction passed. |
| `npm run build` | PASS existing application production build; existing >500kB chunk warning. This did not implement/build a final V3 player. |
| `python3 src/data/experienceV3Fixtures/spec/validate.py` | PASS 1,157 assertions, 3 stories / 32 facts / 8 scenes / 8 acts. |
| `npm run trace:v3-correction` | PASS rich/compressed deterministic developer traces; private text withheld. This is a headless trace, not visual evidence. |
| Independent restore probes above | Four defects reproduced, separate from passing suite. |
| Complete static Design inspection | Completed; source contradictions and portrait issues above. No visual runtime/device/AT pass claimed. |

No player, runtime contract patch, art integration, main merge, deployment, provider connection or product conclusion was performed. Build artifacts/dependencies were local verification outputs only. Relevant automated tests pass within their existing scope; that scope explicitly lacks the real visual host and does not cover all hostile restore inputs.

## Gate to implementation

Follow [the ordered build plan](../docs/v3/V3_VISUAL_PLAYER_BUILD_PLAN.md). Close B01–B08 through their owning streams and publish evidence before mounting the visual shell. Re-review the corrected package and contract tests. Player implementation can then follow A–M; its acceptance still requires mobile, readable, reduced-motion and browser QA. Human/product gates remain pending separately, including final visual-direction approval. This review's verdict remains **NOT READY FOR VISUAL PLAYER BUILD**.
