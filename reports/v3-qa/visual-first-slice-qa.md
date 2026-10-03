# VIVI V3 — The Correction: visual first slice QA

Date: 2026-10-04 · branch `implementation/vivi-v3-visual-player` · development entry `/?v3=correction`

**Technical status: visual slice implemented (C–M); all automated gates pass. Ready for independent visual QA.**
This is an implementer's QA record, not independent acceptance. It does not certify screen readers, physical devices, translations or human-research outcomes; those remain pending (§6).

## 1. Pinned inputs

| Input | Revision |
|---|---|
| Runtime foundation + B02 fix | `fix/vivi-v3-b02-geometry-contract` @ `374ac764f04185a1ffc4a0e477b74856dcc27e56` (base of this branch) |
| Design r4 | `design/vivi-v3-correction-slice` @ `21403724418f36b8675ae03060dd7d9aadb7b724`, only `docs/visual-v3/correction-slice` (tree-identical import) |
| B02 closure | `review/vivi-v3-b02-closure` @ `4e8b539cacd2f7b8c03191c5ab43a0eba2a9b404` |
| Design source / audit / inventory SHA-256 | `a541aac8…0c81` / `b85b8106…bb11` / `6b2ebe15…5ab1d` (pinned in the build; other bytes are refused) |

B01–B08 were not reopened. No contradiction requiring it was found.

## 2. What was built

| Step | Delivered | Where |
|---|---|---|
| Inputs | r4 subtree imported unchanged. `test-v3-geometry-compat` derives expected provenance from the supplied source (declared revision + byte hash; pinned hashes must declare their pinned revision) and runs on both r3 (historical) and r4. | `docs/visual-v3/correction-slice/`, `scripts/test-v3-geometry-compat.ts` |
| B (Phase B) | Deterministic compile: pinned bytes → structural reading (every Design key mapped or named in `NOT_COMPILED`) → Design's collision audit reproduced check by check on bare footprints → obstacles inflated by the hero radius **once** (+ actor footprints) → the existing `adaptDesignGeometry`. Emits the GENERATED module: per-variant `RuntimeGeometryV3`, compiled scene marks/routes (`GeometryExport`), and presentation staging. `--check` proves the committed module is a fresh build. | `scripts/build-v3-correction-geometry.ts`, `scripts/lib/correctionGeometryBuild.ts`, `src/data/experienceV3Fixtures/runtime/theCorrection.geometry.ts` |
| Copy | `correctionActSlots().caption` binds the three B08 labels exactly. `correctionPublicCopy()` exposes the approved display title “Mira’s forecast” and Gold F11 “Anything to add before we use this?”, both extracted verbatim from Gold, plus the Gold §L boundary line. | `theCorrection.presentation.ts` |
| C Shell | `ExperiencePlayerV3`: one InputManager, existing FocusCoordinator, one `ExperienceHost` (visual mode), one readable projection; host status shown as status, never as a story machine. `V3FoundationPlayer` is unchanged (harness reference). | `src/components/experience/v3/ExperiencePlayerV3.tsx`, `experiencePlayerV3.css` |
| D Viewport | `NormalizedProjection` (fit, projection, inverse projection, silhouettes); `SceneLayersV3` (graphite/paint plates, attention islands, live DOM display title, depth-sorted bodies and occluder cut-outs); `SceneViewportV3` (orientation → validated recipe, hero walks only along compiled routes, hit testing against the inflated footprints and declared seats). `AssetPreloader` hash-verifies and decodes every plate before a scene mounts; failure/retry and an approved readable fallback are provided. | `…/v3/SceneViewportV3.tsx`, `NormalizedProjection.ts`, `SceneLayersV3.tsx`, `AssetPreloader.ts`, `Figure.tsx`, `staging.ts` |
| E Desk | Hero only; live title on the display surface; Gold beat text; observation insert; desk→meeting is the single spine cut (no desk↔hallway portal; Design P0 is not compiled as a portal). | `v3-correction/scenes/CorrectionDesk.tsx` |
| F Meeting | `c_meeting_before`/`c_meeting_question` share geometry and the same three bodies. Seat and standing preparations reposition only the hero via compiled marks; decision availability has no distance gate. | `v3-correction/scenes/CorrectionMeeting.tsx` |
| G Hallway | Real excursion transactions; source stays mounted until preparation; arrival/departure crossing walks use the compiled threshold routes; the same Mira/director are projected through the open door by the P1 transform (never proxies); local hero marks restore. | `v3-correction/scenes/CorrectionHallway.tsx`, viewport |
| H Decision | One control group from `readable.actions`, with no stored option list. Anchored on landscape (table centre / director / hero, from Design's act attention) and stacked on portrait/readable. REQUEST_INTENT and CONFIRM are separate activations; confirmation shows Gold copy. | `DecisionProjectionV3.tsx` |
| I Acts | Hero-only poses (speak / ask after walking the approved route to the director / still in the selected preparation). Approved caption. Guarded ENACTED after the stop pose and caption are painted. | `CorrectionEnactment.tsx`, `PresentationReceipts.ts` |
| J Boundary | 0.9 s held trace, Design C08 withdrawal (1.2 s; 400 ms with reduced motion), Gold boundary line, public paper motif fetched only after the boundary; BOUNDARY receipt after paint; reveal gate waits for durable acceptance with visible retry. Skip at any point; no mandatory wait. | `CorrectionBoundary.tsx` |
| K Reveal | Dynamic import of the private module only inside `loadReveal` (after gate release). Validation by the private Gold profile (loader) and the public binding (host). Act automatically, then why and aftermath on Continue; the withheld note is shown and skip is logged as skipped. Invalid/missing/stale records render nothing, with visible retry. | `v3-correction/CorrectionRevealHost.ts`, `PrivateRevealV3.tsx` |
| L Mobile / motion | 390 px portrait band framing, ≥16 px gutters, ≥44 px targets, rem-based reflow at 200 % text, wrapping labels (RU-length probe), reduced motion (system or toggle) presentation-only, readable mode. | CSS + viewport |
| M QA | `scripts/test-v3-correction-browser.ts` (25 real-Chrome checks), this report. | — |

Dev-only pieces (dev repository/journal, asset fetcher, preferences, snapshot resume) live in `src/devtools/`. The story binding lives in `src/components/experience/v3-correction/`, so the generic runtime directory keeps the Foundation's rules: no story names, no storage, no network.

## 3. Narrow implementation choices (documented, no architecture change)

1. **Gold `near_director` ⇄ Design names.** Gold prep_near (“Stand nearer the director”) compiles to Design's standing-preparation anchor `stand_near_entry` (beats 04b/05b/06a/06c). Design's `near_director` anchor (the private-request approach, beat 06b) compiles as `ask_director`. Both are recorded in `designNames`.
2. **Meeting entry mark** is Design `entry` (standing, first step inside P1). The contract forbids a seated entry mark, so the hero stands at the entry in `c_meeting_before` (D02 shows seated staging as a reference only) and sits only through prep_seat.
3. **Threshold anchors** (`to_corridor`, `from_meeting`, `return_threshold`) are compiled marks carried by no scene. Crossings play the compiled routes that start or end there; validation is not weakened.
4. **Obstacles** are inflated once at build time (circumscribed arcs, clipped to the declared floor) and read as-is at runtime. Seats stay explicit (`seats`), and a tap on the chair is legal only as that seat.
5. **Orientation → recipe**: landscape uses the compiled recipe; portrait uses Design `portrait`, with `portrait_room` while `ev_board` is the latest beat, and `portrait_east` for the private request. Every combination is probed through `validateGeometryForManifest` with exactly the marks it shows.
6. **Boundary line** (Gold §L step 4, Design `boundary.line`) is public copy shown at the boundary. It is asserted equal to the private module's bridge string and contains no account text.
7. **Per-variant resources**: the compressed control's resource has one location and no doors.
8. **Bodies** are drawn by a small SVG rig in Design's palette (no runtime actor rasters exist). Light/audio recipes are `baked_plate`/`silent`.
9. Public binding validation omits only the exact author option, which is private. The loader checks it with the full Gold profile.

## 4. Gates (this branch, Darwin 21.6 / Chrome 150.0.7871.125 via playwright-core)

| Gate | Result |
|---|---|
| `npm run lint` | PASS |
| `npm test` | PASS: Vivi contracts, canonical runtime, compiler, OpenRouter provider (mocked, 15), V2 (20), V3 foundation (34), pre-build (15), host (18), Correction headless (15), compiler eval |
| `npm run build` | PASS (dev entry and Correction data compiled out; asserted by browser check 25) |
| `npm run test:v3-foundation` | PASS: unit (34 + 15 + 7 r3 + 7 r4 + 18) + 20 browser |
| `npm run test:v3-correction` | PASS: 15 |
| `npm run test:v3-browser` | PASS: 20 |
| `npm run test:v3-geometry-compat` | PASS: 7 (r3, 6 known defect paths) + 7 (r4, zero exceptions) |
| `npm run test:v3-correction-browser` | PASS: 25 |
| `python3 src/data/experienceV3Fixtures/spec/validate.py` | PASS: 1,157 assertions |
| `node --import tsx scripts/build-v3-correction-geometry.ts --check` | PASS: 3 locations, 8 recipes, 16 audit checks reproduced |

No paid model or provider call, deploy or main-branch change was made.

## 5. Visual browser coverage (`test-v3-correction-browser.ts`)

| # | Requirement | Evidence |
|---|---|---|
| 1 | Rich full path | Exact live title, one desk body, only the cut from the desk, verified blob plates, three meeting bodies, exact F11, three approved labels in derived order, selection ≠ acceptance, Gold confirmation copy, receipts ENACTED→HOLD_DONE→BOUNDARY_DONE→REVEAL_LOADED each with its state on screen, Gold act/why/aftermath/withheld, one durable write, pre-boundary DOM/network leak scan |
| 2–7 | All three acts × seated and standing | Approved caption, pose (speak/ask/still), Mira and the director unchanged in snapshot and on screen, no new body, private approach reaches the director, pass keeps posture, same account |
| 8 | Hallway round trips | ×3: no replay, receipts and entities kept, same bodies and positions, hallway mark restored, summary owned, doors close after resume |
| 9 | Keyboard | Tab/Enter play, Enter opens the world sheet, Escape closes, arrows step to a supported mark, a held Enter cannot confirm, focus to confirm heading and reveal heading |
| 10 | Touch (390 phone) | Tap display → observation; tap on the seat → prep_seat (seat-only legality); a drag commits nothing; tap select + tap confirm; portrait private uses `portrait_east` |
| 11 | Readable mode | No stage; same controls, transcript, receipts, account |
| 12 | Mobile 390 / 200 % / RU-length | No horizontal scroll, all buttons ≥44 px inside 16 px gutters, unclipped options at 100 %, 200 % and with long Cyrillic strings, full reveal at 390 |
| 13 | Reduced motion | Cut instead of walk, no state change from the preference, identical receipt sequence |
| 14 | Skip | Stop pose and caption installed, caption kept at the boundary, account < 4 s |
| 15–16 | Preload failure | Network 503 and a one-byte hash mismatch both fail with the source mounted; retry succeeds; entry failure/retry; readable fallback continues |
| 17–18 | Persistence | Journal+repository failure keeps the gate shut (record never requested) with retry under the identical key; repository-only failure proceeds on durable local acceptance with remote retry |
| 19 | Reload after acceptance | Resumes locked; no choice offered; same key; same account; reload after reveal re-resolves the record |
| 20–22 | Invalid / stale / missing record | No account rendered, visible retry, no second choice |
| 23 | Stale completions | Completion from an unmounted player and a superseded transaction cannot swap; route return resumes from last save |
| 24 | Compressed control | One location, no hallway, same options/confirmation/account |
| 25 | V1/V2 compatibility | `/` has no V3 player; `/?v3=foundation` mounts; production bundle has no dev entry, Correction fixture, slice assets or account text |

## 6. Not established here (pending, non-blocking for independent visual QA)

- **Real AT and devices:** no screen-reader (VoiceOver/TalkBack/NVDA) run; mobile results come from Chrome emulation at 390×844 (DPR 2, touch), not a physical phone.
- **Translation:** RU is a layout probe with long Cyrillic strings only; final RU copy is pending editorial.
- **Human tests:** hallway value, reveal strength, material preference and poll-like feeling are untested.
- **Production services:** the repository/journal are the dev sessionStorage implementations; a production record service and its authorization are out of scope.

## 7. Polish (non-blocking)

- Design's illustrator pass: painted plates and actor/hand art (the runtime rig is a stand-in in Design's palette); a brush-edge island mask set.
- Compressed control's recollection frame reuses the meeting plate; a dedicated recollection composition is Design work.
- Anchored labels on landscape use a simple non-overlap pass. At unusual aspect ratios a label can sit close to a figure.
- Occluder cut-outs use silhouette hulls; chair-back segments are 2 cm slabs from the floor (conservative).
- Hallway see-through actors are projected correctly but fall outside both hallway framings (Design D03 shows only the glass). Readable text carries F08.
- Portrait story panel sits below the stage band, so the decision group needs a scroll at 844 px height.
- No audio path (`silent`); ambient `ev_office_bed` is not rendered.

## 8. How to open it

```sh
git checkout implementation/vivi-v3-visual-player
npm ci
npx vite --host 127.0.0.1 --port 5173      # plain Vite dev server, no model keys needed
# (alternatively `npm run dev`: the Express app on http://localhost:3000, same `?v3=correction` query)
# open http://127.0.0.1:5173/?v3=correction
#   &variant=compressed     the control
#   &pictures=off           readable fallback from the start
#   &preload=fail-once &persist=reject &journal=reject &reveal=invalid-once   fault injection
```

State resumes per tab (sessionStorage). Use a new tab or private window for a fresh attempt.
