# VIVI V3 — B02 geometry reconciliation (runtime half)

2026-10-03 · `fix/vivi-v3-b02-geometry-contract` · B02 only. No visual player, no V3 redesign, B01/B03–B08 untouched, no main, no deploy.

| Input | Revision |
|---|---|
| Runtime base | `implementation/vivi-v3-prebuild-contracts` · `5470655331f97217863e97235848d2d70badf55a` |
| Closure review | `review/vivi-v3-blocker-closure` · `a8a4a7a` · `reports/v3-blocker-closure-review.md` |
| Design r3 | `design/vivi-v3-correction-slice` · `5e05495707c82cc43a73b15a7a6440bd04db756b` |
| r3 `geometry/source.json` SHA-256 | `992340663d8cc7f384d8ccacd6dbe5d3ea687e8e803d6dc55cf3aa166f558273` |

## Verdict

The runtime half of B02 is compatible with Design r3's semantics: interior cameras, per-beat camera recipes and the seated `own_seat`. Run against the actual r3 file, the only failure is Design's standing `at_desk` anchor (and the route that starts at it). The runtime does not waive it. The same test must pass with zero exceptions when Design publishes a corrected source. B02 as a whole stays open until that source arrives.

## What changed

### 1. Interior cameras

- Removed the adapter invariant `cam.z < zMin` ("the whole floor is in front of every camera"). Five r3 recipes reproduced the rejection: corridor desktop (z 3.2) and portrait (3.9); meeting portrait (0.4), portrait_room (1.6) and portrait_east (1.4). All five now adapt.
- Kept strict projection: no clamping; `projectPoint` has no result at or behind the camera plane; camera coefficients (`cam`, `cx`, `hy`, viewport, safe region) must be finite and the focal length non-zero, or the adapter throws.

### 2. Camera recipe coverage

- `validateGeometryForManifest` now checks each compiled scene against **the recipe it selects**. The recipe must exist and belong to the scene's location. Every mark the scene carries (entry and named) must project through that camera, with a distinct "at or behind the plane" failure, and lie in its safe region.
- Nothing is discarded: unselected cameras stay in the resource and are validated structurally.
- Anchors (staging roots such as Mira and the director) must be visible in at least one camera that a scene of their location selects. The previous rule ("inside every camera of the location") contradicted r3: Mira and the director are outside the default portrait by design.

### 3. Seated mark collision

- **Design semantic:** `hero_anchors.<role> = { posture: "seat", seat: "<obstacle>" }`. The adapter input gains `marks.<role>.{posture?, seat?}`; the adapter emits `LocationGeometry.seats = [{ role, obstacle }]` (absent when empty, so sources without seats serialize exactly as before).
- **Validator:** a scene mark whose role has a declaration must lie on that obstacle (`seatedStandable`: walkable floor, inside the declared obstacle, clear of every other obstacle). Every other mark stays under `standable()`, which is unchanged. The entry mark is never seated.
- **Routes** stay collision-safe in their interior. A route's first or last point may lie in a seat obstacle only if it is exactly a valid seated mark's point in the same location. r3's `seat_to_near_director` starts at `own_seat` and `entry_to_seat` ends there. Both pass; neither could with a strict reading.
- No string name appears in the runtime. The relationship comes only from Design's `posture`/`seat`. The adapter refuses an unknown posture, a seat on a standing mark, a seated mark that names no obstacle of its location, and a seated mark outside its seat polygon.
- **Adapter route normalization:** `AdaptedGeometry.routes` normalizes named routes with the same affine mapping and bounds checks, so the compile step has one coordinate authority for routes as well as marks.
- The seat declaration is structurally validated (closed keys, identifiers, unique roles, obstacle exists in the location).

### 4. Real-source compatibility test

- `src/data/experienceV3Fixtures/design/correction-geo-r3.source.json` — byte copy of Design's published file (hash pinned in the test).
- `scripts/lib/designGeometryR3.ts` — test-support structural reader for Design's published schema. It lists every key it does not map; the test asserts that list.
- `scripts/test-v3-geometry-compat.ts` (`npm run test:v3-geometry-compat`, part of `test:v3-unit`). It reads the real file, adapts it with the real adapter, compiles eight scenes that select the recipes r3's beats assign, and validates them with the real validators. Known source defects are keyed by the source's SHA-256. A hash not in the table must produce **zero issues**.
- Corrected source: `VIVI_DESIGN_GEOMETRY_SOURCE=/path/to/source.json npm run test:v3-geometry-compat`, or replace the fixture. The test needs no edit.

Result on the committed r3 file: exactly six issue paths, all the single `at_desk` root `[5.55, 2.25]` (inside `hero_desk` x 4.05–5.75, z 1.95–2.65, posture `stand`): `desk_desktop` and `desk_portrait` × (`entryMark`, `marks.at_desk`, `routes.desk_to_p0[0]`). The test also asserts that no other mark or route point in the published source is a collision.

## Tests run (all on this branch)

| Gate | Result |
|---|---|
| `npm run lint` | PASS |
| `npm run test:v3-unit` | PASS: 34 Foundation + **15** pre-build (was 12; +3 B02 checks) + **7** real-geometry compatibility + 18 host |
| `npm run test:v3-correction` | PASS: 15 |
| `npm run test:v3-browser` | PASS: 20 |
| `npm run test:v2` | PASS: 20 |
| `python3 src/data/experienceV3Fixtures/spec/validate.py` | PASS: 1,157 offline assertions |
| Compatibility test on an in-memory scratch copy where only the `at_desk` root and its route start moved to a free-floor point (`[5.55, 3.3]`; a probe, not a Design value, not committed) | PASS, "zero exceptions" |

The probe also showed that Design's corrected `at_desk` must be free floor **and** inside the portrait title-safe area. The first probe point, `[6.4, 3.4]`, was free floor but projects to x≈862 and was refused by the safe-region check.

## Mutation results

`scripts/mutate-v3-b02.ts` applies 38 one-line mutants to the adapter and contract and runs the pre-build and real-geometry suites on each. It first checks the unmutated suites pass, then verifies byte-for-byte file restoration.

**38 / 38 killed. 0 survived.** Of these, 20 are killed by both suites, 17 by the synthetic suite only, and `S8` (routes un-normalized) by the real-geometry suite only.

The first run left three survivors, each closed by a change or a test:

| Mutant | Cause | Action |
|---|---|---|
| S7: posture inferred from a mark's name | missing negative test | added a standing mark named like a seat |
| W3: seated footprint need not be on walkable floor | no test with a seat past the walkable edge | added the bench case |
| W9: route end waived by a seated mark that is not on its seat | redundant re-check in the route path hid the gap | removed the redundant check; the guarantee lives in one place; added the test |

Mutant groups: A1–A7 camera validity; S1–S8 adapter seat semantics and route normalization; V1–V8 per-scene recipe coverage and anchors; W1–W10, W12 seated waiver and route endpoints; R1–R4 structural seat validation.

One validation added during the work was removed again: "a declared seat must be carried by some scene of the location". It would reject manifest variants that legitimately omit a seated role, so it went out together with its test and mutant (W11).

## Open items

1. **Design — `at_desk`.** Place the standing anchor on free floor inside the portrait title-safe area. Not patched here. The compatibility test goes green on the new hash.
2. **Design — obstacle inflation.** The adapter documents obstacle polygons as "already inflated by the approved hero radius". r3's obstacles are the bare furniture footprints (for example `hero_desk` equals the desk occluder's polygon). Runtime treats them as published, with no inflation. Design should confirm that is the intended collision footprint.
3. **Threshold marks.** `from_meeting`, `return_threshold` (corridor) and `to_corridor` (portrait) are portal-crossing positions and fall outside the title-safe area of their cameras (for example screen y≈1121 against a 1026 limit on the corridor desktop). No Design beat carries them as scene content, and the test records that carrying one as required in-frame content is refused. If the Phase B compile wants one as a corridor entry mark, that needs an explicit crossing-mark semantic from Design; none is invented here.
4. **Orientation/recipe selection.** A compiled scene still selects one `cameraRecipe`. The test compiles one scene per framing (desktop; portrait; `portrait_room`; `portrait_east`) as a stand-in for the Phase B compile. How the player maps viewport orientation to the scene's recipe is not decided here.
5. **Reader choices (test-support, Phase B owns the real mapping).** Lowercase ids (`correction.open_plan` → `correction_open_plan`, `P0` → `p0`, `desk_to_P0` → `desk_to_p0`); `heightScale` = the location's `ceiling`; `kitRevision` = source revision; approved facings = the distinct yaws used (r3 publishes no approved table); portal yaw from `threshold_inside → threshold_outside`; actor anchors at their floor root with height 0. Unmapped and asserted: `occluders`, `display_surfaces`, `objects`, `attachments`, `walls`, `see_through`. The manifest in the test is a minimal object (`compiledScenes`, `initialEntities`, `portals`), not a full `validateManifest`-valid manifest.

Technical evidence only. Not evidence of atmosphere, engagement, visual quality or reveal impact.
