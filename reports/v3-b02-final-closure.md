# VIVI V3 — final B02 closure review

Date: 2026-10-03

**B02 status: CLOSED**

**Final verdict: READY FOR VISUAL PLAYER BUILD**

## Scope and pinned inputs

This closes B02 only. B01 and B03–B08 remain CLOSED under `review/vivi-v3-blocker-closure` @ `a8a4a7af8777caa29c5d41370c62f14357da045c`, `reports/v3-blocker-closure-review.md`; they were not reopened. No player implementation, architecture redesign, master plan, deploy or main-branch change was performed.

| Input | Reviewed commit |
|---|---|
| Runtime: `fix/vivi-v3-b02-geometry-contract` | `374ac764f04185a1ffc4a0e477b74856dcc27e56` |
| Design r4: `design/vivi-v3-correction-slice` | `21403724418f36b8675ae03060dd7d9aadb7b724` |

Read the runtime commit's `reports/v3-b02-geometry-reconciliation.md` and `docs/v3/V3_PREBUILD_RUNTIME_CONTRACTS.md`, then inspected implementation and tests. The runtime report describes r3; its `at_desk` defect is superseded by the actual r4 source.

Files were extracted with `git archive` into `/private/tmp/vivi-b02-final/{runtime,design}`. Runtime dependencies were reused from the installed runtime worktree. The adapter, geometry contract, controller, source reader and original compatibility test were checked byte-for-byte against the pinned runtime commit. Production code and Design data were not edited.

## Runtime findings

| Requirement | Evidence and result |
|---|---|
| Interior cameras | `geometry/designAdapter.ts` has no whole-floor-in-front invariant. All eight actual r4 recipes adapt, including five interior recipes: corridor desktop/portrait and meeting portrait/portrait_room/portrait_east. |
| Strict projection, no clamping | `contracts/geometry.ts:projectPoint` returns undefined at or behind the active plane. Actual-source tests check all five interior cameras and independently compare their perspective with Design's pinhole formula. Adapter bounds failures throw rather than move points. |
| Valid camera coefficients | Adapter rejects non-finite camera position, principal point, viewport/safe coefficients and zero/non-finite focal length. Resource validator enforces finite non-degenerate projections, positive viewport and safe region within viewport. Relevant positive and negative tests pass. |
| Scene-specific coverage | `validateGeometryForManifest` selects `cs.cameraRecipe`, requires its existence and matching location, and checks carried marks against that recipe. Eight actual-source scenes pass. Unselected cameras retain structural checks. Actor anchors require visibility in at least one selected location framing. Wrong/missing recipes and marks carried into incompatible framings fail. |
| Explicit seated semantics | Reader preserves Design posture/seat. Adapter emits only `own_seat → chair_own_seat`. Standing or missing posture cannot declare a seat; unknown posture/seat and an off-seat seated root fail. No name-based exception exists. |
| Seat collision scope | `seatedStandable` requires walkable floor, membership in the declared seat and clearance from every other obstacle. `standable` still refuses the chair footprint. Removing the declaration, naming another obstacle, using the same point under an undeclared role, or using it as an entry mark fails. Other-obstacle and off-floor cases are covered by pre-build tests. |
| Strict routes | Every route vertex is checked. Interior vertices cannot use a seat; endpoints can use only the exact collision-valid explicitly seated mark of the same location (comparison tolerance 1e-6 normalized units). Interior seat contact, an offset seat endpoint, another obstacle endpoint and absent valid seated marks fail. |
| One coordinate authority | Adapter applies the same affine mapping and rounding to marks and routes, which are carried in compiled scenes. Review supplement checked all nine source marks and all 25 vertices of seven routes against that mapping. |
| Strict provenance/revisions/hashes | Actual source bytes are SHA-256 pinned below; emitted provenance equals r4 revision, adapter version and that hash. Kit revision mismatches and malformed hashes/revisions remain rejected. Resource validation checks hash format; the build/test computes the byte hash, rather than pretending the resource validator can rehash an unavailable source. |
| Per-location hero marks | Controller preserves `heroMarks` for departed locations and restores placement/reposition preparations on return; current placement remains on the hero. Pre-build checks 9–11 pass, including repeated round trips, same-location cuts and restore validation. |

## Actual Design r4 findings

| File | SHA-256 |
|---|---|
| `geometry/source.json` | `a541aac8af489bdea7ca6fed2711d89032ff90e2975706cf74926ca8a39a0c81` |
| `geometry/collision_audit.json` | `b85b81064fa3b27ed6a603986309d1afe4a941552fabe961dbd7718ebb0abb11` |
| `assets.json` | `6b2ebe1561da9b0a6207b34301b2c5c6f9bb8a9b3f525cfaacf039303fd5ab1d` |

- Source revision is `correction-geo-r4`; assets revision is `correction-assets-r4`, linked to `correction-geo-r4`. All 61 published runtime/reference asset files match their declared SHA-256 and r4 asset revision.
- `at_desk` moves from r3 `[5.55, 2.25]` to `[5.97, 2.30]`, posture `stand`, yaw −80, head yaw −14. It is on walkable free floor, 0.22 m from `hero_desk`, exceeding the declared 0.20 m hero radius. `desk_to_P0[0]` equals that corrected root exactly. Both selected desk recipes pass camera-safe coverage.
- `own_seat` remains `[0.65, 3.1]`, explicitly `posture: seat`, `seat: chair_own_seat`. It is inside that seat and clear of all other obstacles. Standing at those coordinates still fails.
- Re-running `generator/collision.py:audit` with the actual JSON locations reproduces the entire committed audit exactly, including `all_ok: true`: eight standing anchors, one seated anchor, seven routes. Standing and sampled route minimum reported clearance is 0.22 m. Private-request routes now use the south aisle at z 2.10 instead of grazing `chair_south_end`.
- Audit rules are explicit: hero radius 0.20 m, actor radius 0.25 m, approximately 0.05 m segment samples, and only the declared seat is exempt during the 0.55 m docking approach of a route ending/starting at that seat. Runtime route vertices retain the stricter endpoint-only seat rule. Continuous seat docking is an authored movement/animation responsibility, not permission for arbitrary interior route vertices to enter furniture. Sampling is not a mathematical continuous-path proof.
- Generator `geometry.to_json()` matches every corresponding exported source field. Beat declarations from `package3.py` match source beats. `frames2.py` now derives desk body/head yaw from the corrected geometry; packaging records the corrected root and audit.
- Cameras were not relocated to satisfy the removed whole-floor validator. All five interior camera recipes are byte-for-byte unchanged from r3. The only changed camera field is open-plan portrait x 5.10 → 5.30, documented as composition preservation for the corrected desk root; its depth, eye height, focal length and principal point remain unchanged. Desktop and all other recipes are unchanged.
- Diff checks preserve cast, actor roots, objects, portals/pairs and every non-desk beat. Desk beat changes add the corrected attention target and exit-route declaration. Generator framing additions supply the existing meeting portrait recipes; they do not change the story. No source/story regression was found in the B02 changes; other closed blockers were not re-reviewed.

## Real r4 + pinned runtime integration

The unmodified command using `VIVI_DESIGN_GEOMETRY_SOURCE` **does fail**, at `scripts/test-v3-geometry-compat.ts:125`: its expected provenance literal is hard-coded to `correction-geo-r3`, while the real adapter correctly emits `correction-geo-r4`. This is a test-harness revision assertion defect, not a geometry failure. The report's claim that the environment override works unchanged on a corrected revision is inaccurate at this line.

An equivalent scratch compatibility harness fixes the expected revision, names its output r4-adapted, pins the actual r4 hash, asserts that hash has no known-defect entry, and forces `expected = []`. It retains all seven checks and negative cases from the committed test. Neither runtime code nor source values change. Result:

```text
All 7 V3 B02 real-geometry compatibility checks passed (with zero exceptions) · source a541aac8af48
Closure supplement PASS: 9 source marks, 7 routes, 25 route vertices; same affine authority; r3 desk position still refused under r4.
```

Thus all interior cameras adapt; corrected `at_desk` passes; `own_seat` passes only through explicit seated semantics; scene-specific coverage passes; standing marks and routes stay strict. The baseline scene validation has **zero issues**, with no r3 whitelist used for r4. Reintroducing the old standing desk root under r4 is still rejected.

To reproduce the integration gate from an archive of the pinned runtime, with dependencies available and `VIVI_DESIGN_GEOMETRY_SOURCE` pointing to the exact pinned r4 file:

```sh
python3 - <<'PY'
from pathlib import Path
p = Path('scripts/test-v3-geometry-compat.ts')
s = p.read_text()
s = s.replace("sourceRevision: 'correction-geo-r3', adapterVersion: '1.0.0', sourceHash",
              "sourceRevision: raw.revision, adapterVersion: '1.0.0', sourceHash")
s = s.replace("geometryRevision: 'correction-geo-r3-adapted'",
              "geometryRevision: `${raw.revision}-adapted`")
s = s.replace('const expected = KNOWN_SOURCE_DEFECTS[sourceHash] ?? [];',
              "assert.equal(raw.revision, 'correction-geo-r4');\n"
              "assert.equal(sourceHash, 'a541aac8af489bdea7ca6fed2711d89032ff90e2975706cf74926ca8a39a0c81');\n"
              "assert.equal(KNOWN_SOURCE_DEFECTS[sourceHash], undefined);\n"
              "const expected: Array<{ path: RegExp; why: string }> = [];")
p.with_name('review-b02-r4-compat.ts').write_text(s)
PY
node --import tsx scripts/review-b02-r4-compat.ts
```

Some inherited progress labels still say r3 or refer to the former defect; the input hash, provenance assertion and zero-issue assertion determine the result. The test-support reader maps geometry/marks/routes/cameras for this gate; its explicitly listed omissions (occluders, display surfaces, objects, attachments, walls, see-through) remain production-compiler work. The compatibility manifest is a geometry-contract probe, not a completed player manifest.

## Non-paid validation run

| Gate | Result |
|---|---|
| `npm run lint` | PASS |
| `npm run test:v3-unit` on unmodified pinned runtime | PASS: 34 foundation + 15 pre-build + 7 committed-r3 compatibility + 18 host checks |
| `npm run test:v3-correction` | PASS: 15 headless integration checks |
| Equivalent compatibility harness with actual pinned r4 source | PASS: 7 checks, zero expected exceptions, zero baseline geometry issues |
| Exhaustive normalized r4 mark/route supplement | PASS: 9 marks, 7 routes, 25 vertices; old desk root refused |
| Actual-source collision audit and generator/export equality | PASS: all 16 audit rows identical, `all_ok: true` |
| Asset file SHA-256/revision verification | PASS: 61/61 |

The ordinary unit run's r3 expected failures are historical regression evidence only and are not the r4 integration verdict. No paid provider, production build, visual player or deployment was run.

## Remaining runtime-report notes

| Note | Classification for approved Phase B |
|---|---|
| Obstacle inflation | Ordinary build-time/player responsibility. r4 explicitly publishes bare footprints and hero/actor radii, and independently audits approved placements/routes with clearance. The runtime adapter does not inflate them; its “already inflated” comment describes the intended collision input, not the raw Design footprints. The production compiler/movement layer must apply radius-aware clearance and preserve the declared seat/docking relationship; avoid inflating twice. Approved staging passes, so this is not a B02 blocker. |
| Threshold anchors | Ordinary build-time/portal presentation responsibility. All threshold roots are collision-safe. `from_meeting`, `return_threshold` and portrait `to_corridor` are crossing positions, not required in-frame content of the approved beat framings. Carrying an excluded threshold as a required visible scene mark remains rejected. Compile the approved content and handle portal crossing presentation without weakening validation. No approved scene is prevented. |
| Orientation → camera recipe | Ordinary compiler/player responsibility. Select the desktop, portrait, portrait_room or portrait_east recipe for the approved beat and viewport. All eight recipe scenes pass individually; the runtime still validates the chosen recipe rather than promising every mark fits every framing. |
| Hard-coded r3 test provenance expectation | Test-maintenance follow-up: derive the expected source revision from the supplied source. Equivalent real-r4 execution proves the pinned runtime works; this assertion typo does not prevent the approved Phase B implementation. |

No remaining geometry contract failure prevents the approved Phase B implementation.
