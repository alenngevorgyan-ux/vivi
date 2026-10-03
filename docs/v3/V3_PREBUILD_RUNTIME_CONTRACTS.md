# V3 pre-build runtime contracts

Status: implemented on `implementation/vivi-v3-prebuild-contracts`, on top of the Foundation and The Correction slice. Closes the Foundation-owned blockers of `reports/v3-final-integration-review.md` (B02 runtime half, B03, B04, B05, B06, B07). B01 and B08 are Design/Editorial and are **not** closed here. The visual player is **not** implemented.

Evidence: `reports/v3-prebuild-runtime-blockers.md`. Tests: `scripts/test-v3-prebuild.ts`, `scripts/test-v3-host.ts`, plus the updated Foundation, Correction and browser suites.

## 1. Shape

```
Design source geometry ──(build-time adapter)──▶ runtime geometry resource + named marks
                                                        │ validateGeometryForManifest
PlaybackManifestV3 ──▶ pure reducer (step) ◀── ExperienceHost ◀── host contracts (injected)
                              │ effects                │ guarded events only
                              └────────────────────────┘
private record ◀── loadReveal (after the boundary) ── validateRevealRecord ── host-private
```

- The reducer stays pure, synchronous and story-agnostic. It performs nothing.
- `ExperienceHost` (`src/components/experience/v3/ExperienceHost.ts`) is plain TypeScript with no React and no DOM. It performs the reducer's effects through injected functions and reports results back only as ordinary controller events. It owns no story state: the snapshot is the reducer's. It has no timers.
- `useExperience` is a thin React binding (`useSyncExternalStore`). Mounting attaches the host; unmounting or a revision change detaches it.
- Nothing completes preparation, persistence, presentation or the reveal by itself in a visual host.

## 2. Host contracts (`hostContracts.ts`)

| Contract | Visual | Headless |
|---|---|---|
| `preloadScene(req) → Promise<PreparedScene>` | required | optional; absent = ready at once |
| `repository.record(op) → ack` | required | optional; absent = `unconfigured`, never recorded |
| `journal.write/read` | required | optional |
| `loadReveal(req) → Promise<unknown>` + `reveal` binding | required | optional; absent = reveal **fails closed** |
| presentation receipts | renderer calls them | the host runs them itself |
| durable acceptance before the reveal | always | only with `requireDurableAcceptance` |

`mode` is explicit. A visual host missing a contract lists it in `status.config.missing` and fails visibly; it can never be a quiet success. A synchronous throw and a rejected promise are handled identically.

### 2.1 Preparation (B03)

- `prepareEntry` (`txId: 'entry'`) runs on attach for the first or restored scene. A prepared scene must name the requested `sceneId`; an approved `still`/`readable` fallback counts as prepared.
- `prepareTransition` runs for every `preload_scene` effect. Completion is applied only if, at completion, the host is still attached, the mount generation and attempt are unchanged, the phase is `transitioning`, **and the current transaction id is the one requested**. Transaction ids recur across attempts and mounts; this guard is what makes that safe.
- Failure dispatches `TRANSITION_FAILED` (back to the source scene) and sets `status.transition = {state:'failed', error}` with `unconfigured | load_failed | invalid_prepared`.
- `detach()` bumps the generation and aborts every in-flight `AbortSignal`. `attach()` resets in-flight statuses and resumes interrupted work (a portal preparation, headless presentation, the private record load, a pending decision write).

### 2.2 Presentation receipts (B03)

The renderer reports three separate phases, each with the token for *this* mount, attempt, decision, option and phase (`host.receiptToken()`):

`enacted(token)` → `held(token)` → `boundaryPresented(token)`

Refused with a reason: `stale` (any identity mismatch), `wrong_phase` (replayed or out of order), `hidden` (a hidden page renders nothing), `detached`, `rejected`. `skip()` is deterministic: from the act or the hold it reaches the same boundary; during the boundary it counts the bridge as presented. Skip never changes the accepted choice.

### 2.3 Reveal gate

`status.revealGate`: `closed → waiting_for_presentation → waiting_for_durable_acceptance → released`. `BOUNDARY_DONE` is dispatched only when the boundary has been presented **and** (visual, or `requireDurableAcceptance`) acceptance is durable. The private record is not even requested before the gate releases.

## 3. Durable acceptance (B04)

`DecisionOperation` = `{ key, experienceId, manifestRevision, decisionVersion, decisionId, option, attemptId }`, with `key = v3:<experience>:<decisionVersion>:<attempt>:<option>`.

1. On acceptance the snapshot is already immutable. The host writes the operation and the (pre-boundary) snapshot to the **journal**, then sends the identical operation to the **repository**.
2. Only an ack naming the exact `key`, `decisionId` and `option` becomes `DECISION_RECORDED {decision, option}`. The reducer rejects any other ack (`ack_mismatch`) and a second one (`already_applied`). A wrong, empty, malformed or thrown result records nothing and sets `persistence.error`.
3. `persistence.durable` is true when the journal is written or the repository acknowledged. `retryPersistence()` re-sends the **identical** operation and key; it can never become a second choice.
4. Reload: with no explicit snapshot the host reads the journal and adopts an entry only if experience, revision, decision version, attempt, option and key all match and the embedded snapshot restores. Anything else is `recovery: 'ignored_invalid'` and the host starts fresh. An adopted accepted-but-unrecorded choice resumes at the boundary and is re-sent under the same key. The repository must be idempotent on the key and reject a conflicting first answer.
5. A stored `recorded` status is a claim, not an acknowledgement: it restores as `accepted` and is re-confirmed.

The journal is operational metadata, never a second decision authority; recovery re-validates the snapshot with `restoreSnapshot`.

## 4. Snapshot v2 and restore (B05)

`SNAPSHOT_VERSION = 2`. New fields: `experienceId` (bound to the experience) and `heroMarks` (§5). `restoreSnapshot(manifest, raw)` treats stored data as untrusted and validates in a fixed order, checking each record's **shape before reading anything nested**, so no input can throw:

identity and enums → position on the arc (a scene ahead of `arcIndex` is impossible) → receipts (known ids, each once; `beat:index` inside the beat's event count) → variables and clock (closed keys, finite non-negative numbers, keyed pause names) → entities (the manifest's registry exactly, closed keys, one owner each, owners that exist, no actor carried by an actor, hero in the current location) → reversible preparations (known ids, the full undo union including `mark`) → `heroMarks` → decision/phase/lock/reveal agreement.

Normalisation of valid input: in-flight UI state is dropped; an accepted act resumes at the boundary and never reopens; a completed reveal stays completed (the record is **not** in the snapshot and is re-resolved by the host); anything pre-commit re-enters through `loading` so a visual host prepares the restored scene exactly like a first entry.

## 5. Hero placement per location (B02, runtime half)

- Named marks live **only** in the manifest's compiled scenes. The geometry resource never repeats them.
- The hero starts on the first scene's `entryMark` unless the manifest staged it.
- A `reposition` preparation moves the hero onto the scene's compiled mark for that role and records a reversible `mark` undo. A scene that has compiled marks but not that role refuses the preparation; a scene with no geometry keeps the semantic role only.
- `heroMarks[location]` holds `{mark, role, preparations}` for each location the hero has **left**. The current location's placement is the hero entity's own `mark` and `state.mark_role`; there is never a second copy.
- Leaving a location saves its placement and carries its positional (reposition) preparations with it. Arriving restores the saved placement (and its undoable preparations), or on a first visit the destination scene's entry mark. A cut within one location keeps the body where it is. Only the hero is placed.

## 6. Runtime geometry (`contracts/geometry.ts`, `geometry/designAdapter.ts`) (B02)

One affine mapping per location, applied to every point, from Design's metre frame (origin at the declared near-left floor bound; source x right, y height, z depth):

```
runtime.x = 100 · (x − xMin) / (xMax − xMin)      runtime.y = 100 · (z − zMin) / (zMax − zMin)
runtime.h = y / heightScale
```

`adaptDesignGeometry` is deterministic and **never clamps**: a point outside its declared bounds, an unapproved yaw, a degenerate bounds/height/focal length, a camera not entirely in front of the floor, or an unknown location throws `GeometryAdapterError`. Output precision is a declared rounding of the serialized value only. Cameras compile to normalized coefficients (`cx, hy, fx, fy, camX, camY, eye`) that reproduce Design's perspective; portrait is a separate recipe over the same marks.

`validateRuntimeGeometry` checks the resource on its own (closed keys, versions, SHA-256 provenance, ranges, polygons, uniqueness, finite non-degenerate projections, safe regions inside the viewport). `validateGeometryForManifest` proves it agrees with the manifest: every mark standable (walkable, outside holes and obstacles) and inside every camera's safe region; kit revisions and camera recipes match and belong to the scene's location; both sides of every reversible door have an anchor; anchors, attachments and routes name real entities and floor. `projectPoint` / `unprojectFloor` give the renderer the maths; geometry never gates a causal act by distance.

**Design owns the numbers and the build script that calls the adapter.** No story values are in this module. The Correction still uses dev-named placeholder geometry (`placeholderGeometry.ts`) until Design publishes a source-checked export.

## 7. Private record (B06)

`validateRevealRecord(raw, {experienceId, recordRevision, options, profile})` checks a loader result at runtime: closed keys, `revealSchemaVersion`, experience identity, the **explicit** record-revision mapping (a control's manifest revision differs from the shared record's), status enum, bounded plain text (no markup, URLs, style or expressions), source references, author-option mapping. A story's launch profile (e.g. gold-1: exact status, all three fields, exact sources and option) is passed in by the binding, never assumed. Issues carry paths and codes only.

The host holds the validated record privately, returns a `structuredClone` through `revealRecord()` only once the story is `revealed`/`ended`, and the record never enters the snapshot, the status, the journal or the hooks. No loader or no binding → `reveal.error = 'unconfigured'` and a failed reveal, never a success. A completed story restored from storage re-resolves and re-validates its record.

## 8. Private canaries (B07)

`MIN_CANARY_LENGTH = 4`, one `normalizeCanary` (NFC, trimmed, lowercased) shared by authoring and scanning. `validatePrivateCanaries` rejects short, blank, non-string and empty lists. `findPrivateLeaks` **throws** `PrivateCanaryError` (indexes only) on an invalid list: invalid configuration is never read as "no leak". All current Correction and Foundation canaries are valid.

## 9. Integration notes for the visual player build

- Construct the host config once per manifest revision: `{ mode: 'visual', preloadScene, repository, journal, loadReveal, reveal }`. The Correction's binding is `correctionRevealBinding()`.
- Drive the renderer from the snapshot; report `enacted`/`held`/`boundaryPresented` with `receiptToken()`; show `status.*` for loading, saving and failure (the Foundation player shell already shows entry, transition, persistence and reveal failures with retry).
- The runtime owns no storage: `src/devtools/v3HarnessJournal.ts` is the dev harness's `sessionStorage` journal and is not part of the runtime.
- `scripts/lib/v3HeadlessHost.ts` is the synchronous reducer-level trace model of this contract (exact ack, validated reveal). The asynchronous contract is tested on the real `ExperienceHost` in `scripts/test-v3-host.ts`.

## 10. Not closed here

B01 (source reconciliation across Design boards/generator/layers and the private request/author account) and B08 (approved complete-intention captions) remain Design/Editorial blockers. P01–P04 and D01–D02 remain player-build patches and polish. No production reveal service, no visual player, no human-test conclusion.
