# VIVI V3 execution board

2026-10-03 · authority: [V3 master plan](VIVI_EXPERIENCE_V3_MASTER_PLAN.md), planning commit `d035b4a4e8831a8dc687576d1f678e26d1ff72f9`.

This is a coordination board, not authorization to deploy, use paid models, modify main or change V1/V2 production behavior. Format Proof C was completed on `prep/vivi-v3-format-proof` at `028e400fb78d888036a5e184a8060200e63a5a0b`; this reconciliation owns docs/spec baseline on `planning/vivi-v3-integration-readiness`. The [integration baseline](VIVI_V3_INTEGRATION_BASELINE.md) is the current operational index; EN/RU is required, HY future only. The implementation agent owns A; Claude Design owns B. D–H owners below are role assignments to establish, not claims that agents are running or have completed work. Every workstream uses its own branch/worktree and named file owner. Multiple agents must not switch a shared worktree branch or edit the same module concurrently.

## Current gate state

| Stream | Owner | State at this handoff | Next dependency / evidence |
|---|---|---|---|
| A — Foundation | Implementation agent | **IN PROGRESS / UNVERIFIED**; user reports implementation; no pushed origin Foundation head at read-only check | Freeze authoritative contracts and demonstrate one input→accept→boundary path |
| B — Visual language | Claude Design | **IN PROGRESS** by user report; visible visual doc/boards are proposals; direction **PROVISIONAL** | Gold-1 source/staging briefs plus first geometry handshake with A |
| C — Format proof | Format Proof Codex/editorial | **COMPLETE AS A SPEC PACK** and imported; prototype/human/product Phase 0 still pending | Editorial review + B contact sheets + D clickable/working slice |
| D — First sequence | Integration engineer, coordinate with A | Ready to plan; implementation pending | A core, C gold-1, B approved office frames |
| E — QA / red team | Independent QA/research owner | Protocol and self-review available; independent evidence pending | A/D candidate and B fidelity; real devices/participants |
| F — Author flow | Authoring engineer + editorial reviewer | Deferred until first coherent slice | Stable A contracts and C/E evidence review model |
| G — General generation | Semantic-generation engineer | **HARD BLOCKED** | All three format slices through two reviewed iterations; A–F gates/author corrections |
| H — Social | Service/product owner | Later; independently scoped | Proven format, identity/privacy/moderation specification and explicit release authorization |

C is ready as source material, not a declaration that Phase 0 fully passed. The master plan also requires approved storyboard/contact sheet and clickable interaction/reveal prototype. Human proof remains evidence to collect, not a planning score.

## Reconciled status and visible evidence

Planning/Design documentation is visible at `02f4c6c1691269c4dab4b4bf3be7d6a5663915a6` with earlier boards/bible commit `cb45606`. Format Proof is visibly pushed at `028e400fb78d888036a5e184a8060200e63a5a0b` and imported as complete commits. A read-only `git ls-remote origin refs/heads/implementation/vivi-v3-foundation` returned no head at this review; a local separate Foundation worktree exists at the planning baseline, which does not prove implementation completion. Do not inspect or merge its uncommitted work, claim its tests pass, or block Design sketching on a nonexistent pushed contract.

User decisions resolve language to **EN/RU required; HY deferred**. Current V3 requires no Armenian fixture, typography, screenshot, QA, human or generator evaluation; existing V1/V2 support remains untouched. Remembered Room is **provisional pending explicit product-owner visual approval**, owned by Design. A can expose generic attention/layer/phase/entity hooks without fixing that art. Visual V2-first replacement is rejected: all new implementation/prototypes stay isolated V3. The gold-1 source and nine JSON files are preserved; their `paper_diorama` planning label is not approval or an executable enum.

Foundation and Design can continue independently against the [semantic/presentation handshake and assembly plan](VIVI_V3_INTEGRATION_BASELINE.md); full contract agreement and source-safe geometry are required before Integration binds them. Next Codex review is triggered by a **pushed complete Foundation contract/minimal-path revision plus Design’s versioned geometry/phase mapping**, or sooner by a source/boundary conflict. Human/product evidence remains separately pending.

## Ownership rules and handshakes

The first integration meeting freezes: public semantic/manifest versus private source/reveal boundaries; gold-1 ID map; finite roles/assets/state keys; adjacent actor projection; source quote/receipt handling; explicit decision phase; breakpoint between observation and acceptance; and kit anchor/portal geometry. C’s JSON is an isolated planning envelope. **A alone** defines executable runtime schemas and normalization interfaces; D owns the later gold-fixture adapter against A’s complete versioned contract. Do not copy planning prose into unrestricted runtime expressions or create a second types.ts in the fixture directory.

A publishes one contract/loader revision and a minimal reviewed fixture adaptation shape. B publishes one geometry manifest per kit (floor, collision, anchors, portal sightlines, occlusion and mobile safe frame); A derives navigation/camera bounds from that source. C publishes any source/fact revision via review; B cannot invent affect or factual props to solve a composition. E can block a candidate; it does not quietly rewrite source or runtime while testing. F owns preview corrections, not semantic generation. D adapts fixtures and integrates these outputs without special branches keyed by story ID.

Escalate a file collision by naming the file and intended change in the board/PR. The owner either applies it or explicitly hands ownership over in a commit. No cherry-pick of half a schema revision. Keep generated runtime fixtures separate from `spec/`; no circular imports into private source/reveal. Proposed changes to `src/App.tsx`, `ViviPlay.tsx`, `server.ts`, package scripts or shared copy must be assigned to the integration owner and reviewed for V1/V2 routing before modification. These files are not a free-for-all.

## A — FOUNDATION

**Owner:** implementation agent. **Inputs:** master plan D–K/T–W/AA, gold semantic examples, C’s return/boundary traces, legacy adapters as read-only compatibility reference. B can supply temporary geometry under an explicit version; placeholder art is acceptable for technical gates, not product/art pass.

**Exact outputs:** one authoritative closed semantic/manifest/state schema and runtime JSON validator; discriminated V3 loader retaining V1/V2 path; centrally scoped InputManager and FocusCoordinator; pure ExperienceController reducer/effects; InteractionController and fact/opportunity snapshots; owned entity store with scene/portal transaction and receipts; basic soft-time pause/scheduler and readable actions; idempotent acceptance/replay identity; separate reveal access abstraction. Narrow one complete path before expanding all contract options. No model dependency.

**Likely owned files:** `src/engine/input/InputManager.ts`; `src/engine/v3/contracts/`; `src/engine/v3/compat/loadPlayable.ts`; `src/engine/v3/{ExperienceController,InteractionController,WorldStateStore,SceneDirector,ClockService,BeatScheduler,TransitionController,NavigationService,DecisionRepository}.ts`; `src/components/experience/v3/FocusCoordinator.tsx`; initial controller-owned shell interfaces. A also owns runtime validation/compiler foundations under `src/engine/v3/compiler/`. File additions are proposed locations from the master plan, not files created by C.

**Dependencies:** C gives source semantics, but A can begin ownership/schema/one-scene work now. Exact geometry consumes B’s manifest; final first-sequence integration consumes D’s adapter. A/D must explicitly hand off shell implementation after the minimal path; A retains causal state and focus authority.

**Acceptance:** actual browser matrix: owned arrows do not scroll, unowned browser keys remain native, Enter visibly opens/selects then separately accepts, held/repeated keys reset on blur and cannot double-accept, typing/IME/contenteditable cannot move bodies, Tab exits world and modal focus restores. Pure tests verify source/reveal separation, stable IDs, event once, loaded state/pause sets, exact entity ownership and acceptance. Keyboard/touch/readable have same facts/acts. Existing V1/V2 tests and immutable stored fixtures remain intact. No claim of emotional success from these checks.

**Integration order:** merge contract/input/minimal path into a dedicated V3 integration branch first, then scene/time/persistence, then D adaptations. No merge to main is authorized by this board.

**Other agents must NOT edit simultaneously:** contracts, loader, reducers/state services/input/focus, compiler validator, or add independent window key handlers. B can author assets and component composition prototypes without causal mutations; D cannot fork a controller because an adapter is inconvenient.

## B — VISUAL LANGUAGE

**Owner:** Claude Design. **Inputs:** V3 L–S/AC, C source ledgers/visual briefs/staging approvals, A’s interface and B/A geometry agreement; V2 visual/cinematic code only as legacy reference.

**Exact outputs:** mobile/desktop contact sheets for every gold scene; office desk/meeting/hallway and domestic living/threshold/dining kit layers; hero display/summary/phone/bag-coat components; anonymous adult silhouette/pose sheets; equal-dignity act poses and reduced-motion stills; camera/transition/reveal recipes; practical light/audio/mute equivalents; source/license/export metadata; kit anchors/occlusion/navigation polygons and decoded-byte measurements; EN/RU type specimens after font/license review. Do not generate bespoke art in playback. Asset tools/vendor budget require their own established authorization; this task authorizes no paid model use. Asset recipe/clip counts are provisional inventories; build only what gold-slice integration needs, without adding board-reference stories.

**Likely owned files:** `src/assets/v3/`; `art/source/`; composition specs/contact sheets under a new `art/v3/` or Design-owned reports directory; `src/engine/v3/presentation/` only once A supplies interfaces and explicitly hands presentation implementation to B; view-only `SceneViewport`/`AuthorReveal` styling by agreed handoff. Source/private fixtures remain C-owned.

**Dependencies:** can start sketches/contact sheets directly from gold-1 now. Integration waits for A’s geometry/recipe vocabulary, then D renderer binding. EN/RU final copy waits on fluent editorial review, not mechanical font substitution.

**Acceptance:** readable 390px hero relation/prop and desktop frame; blind screenshot audit does not imply unsourced guilt, danger, wealth, identity, hostility or deadline; no visually rewarded option. Bodies contact floors/props, no duplicate adjacent actor, approved crop/zoom/high contrast/200% text; reduced motion preserves meaning. Master-plan asset/decode targets measured on named profiles. Reveal preserves hero motif, exposes author act before reflection, and uses no invented response shot. Contact sheet approved by editorial/source reviewer before expensive asset expansion.

**Integration order:** visual contract/geometry manifest can land alongside A; office asset kit lands before D product round; domestic assets then complete remaining stories. Visual-only prototypes stay isolated until bound to A services.

**Other agents must NOT edit simultaneously:** kit geometry, assets/hashes/export recipe, figure rig, presentation recipe implementations or view styling once assigned. B must not alter `CanonicalViviEngine`, old `SceneArt`, V2 character behavior, source text/facts, or opportunity feasibility to fit a beautiful shot.

## C — FORMAT PROOF

**Owner:** Format Proof Codex/editorial; current task reconciles specifications only. **Inputs:** complete master plan, product/experience/visual/cinematic/world bibles and V2 QA; source is new clearly labeled editorial fiction. No real author confirmation or participant evidence is claimed.

**Exact outputs:** A–N complete source packs for three formats, exact private ledgers, tension/arc/scene/persistence/time/observation/preparation/act/boundary/reveal specifications, visual briefs/build traces, shorter/text controls, isolated JSON planning specs and offline audit, research protocol, execution board and destructive review.

**Owned files:** `docs/v3/format-proof/`; `src/data/experienceV3Fixtures/spec/`; `reports/v3-format-proof-red-team.md`; this board. `docs/VIVI_EXPERIENCE_V3_MASTER_PLAN.md` remains architecture authority and was left unchanged in the original Format Proof pass. This readiness reconciliation makes only the explicitly authorized language/visual-status/precedence and genuine cross-document consistency corrections; no runtime design is duplicated.

**Dependencies:** no runtime dependency for this deliverable. Full Phase 0 exit waits for B contact sheet/prototype, D usable interaction/reveal and E/product/editorial review. C answers source questions by explicit revision, never an informal runtime invention.

**Acceptance:** every claim/event/entity maps to final source or distinct approved non-informational staging; all unknowns remain unknown; three decision units distinct and comprehensible; no private material in semantics; every scene has removal rationale and control; every act has feasible initiation, confirmation and stop frame; offline audit passes; human evidence does not yet exist. Product/editorial reviewers must later approve motives and storyboard before declaring proof.

**Integration order:** the complete Format Proof pack is imported into this readiness baseline; merge the readiness baseline into eventual `integration/vivi-v3-first-slice`, then complete A revisions and Design outputs by the baseline’s branch sequence. Do not wire C files into production while merging the docs.

**Other agents must NOT edit simultaneously:** source packs, private ledgers/reveal, gold semantic specs/validator, test stimulus text or red-team report. Request amendments with fact/scene IDs and reason. C must not add runtime contracts, implementation tests/dependencies, live routes or alter B assets.

## D — FIRST SEQUENCE

**Owner:** integration engineer, with explicit A handoff for player shell. **Inputs:** A schema/controller/input/time/state/loader, C Correction gold-1 and control, B office geometry/approved layers and reveal recipes.

**Exact outputs:** pure adapter from hand-authored approved source semantics through the ordinary V3 deterministic compiler; separate reveal registry/release; complete Correction entry→desk→meeting→break excursion→return→act→author why/aftermath; compressed control accessible to researchers; local/dev-only candidate route, correct immutable revisions and missing-asset/readable fallback. Then integrate Introduction and Spare Key with the same compiler/controller, no story-ID renderer branches. The first slice owns no provider call.

**Likely owned files:** `src/data/experienceV3Fixtures/adapted/` (or separately named runtime-fixture directory after A approves); `src/components/experience/v3/{ExperiencePlayer,ActionSheet,ReadableView}.tsx` after shell handoff; fixture binding in V3 dev loader/route; integration-owned `scripts/test-experience-v3.ts` extensions and scenario-level browser tests. Shared `App`/`ViviPlay` routing is D-only with A compatibility review. Presentation modules remain B-owned; causal services remain A-owned.

**Dependencies:** A minimal full path first, then office state/geometry. Can plan fixture mapping from C immediately. Needs B finished look before judging presence; placeholder success passes technical gates only.

**Acceptance:** Correction four views/three locations with persistent owned summary, no repeat quotes on reversible break visits, closed prior-break travel after resume, same knowledge/acts via all input modes. Feasible request is not guaranteed future event. Exact enactment/boundary/reveal; local first-choice/replay semantics; actual phone path to why. Rich and compressed variants preserve fact/act/account equivalence. Remaining two integrate without new invention or one-off controller branch. E independently tests; actual human pass separate.

**Integration order:** after A contract/path and C specs; overlay B office layers, then E round one; domestic/micro integration and E round two before F/general semantics expansion.

**Other agents must NOT edit simultaneously:** shared route, adapter/fixture binding, assigned shell/UI components. D must not edit C’s `spec/`, invent missing source/feasibility, mutate A reducer or B kit geometry to make its story pass. File-owner patches land before adapter rebases.

## E — QA / RED TEAM

**Owner:** independent browser/device/adversarial tester and research lead. C’s destructive self-review does not substitute for independent review. **Inputs:** gold-1, source/reveal boundaries, C protocol, A browser matrix, B blind contact sheets and D pinned candidate/control variants.

**Exact outputs:** actual keyboard/pointer/touch/IME/native scroll/focus tests; blur/resume/repeated activation/skip/stalled load/reveal failure runs; entity/quote/knowledge/boundary adversarial traces; V1/V2 compatibility report; real iOS Safari/Android/desktop and assistive technology evidence; muted/reduced-motion/zoom/language review; measured performance/decode peaks; two human round reports with first-exposure/control cell counts, comprehension/care/invention evidence and cut decisions. Keep technical and product gates in separate columns.

**Likely owned files:** `tests/browser/experience-v3.spec.ts`; independent test data under `tests/fixtures/v3/`; reports under `reports/v3-qa/` and `reports/v3-human/`; focused invariant tests by agreement with A/D. No runtime/source modifications in the QA pass; defects go to owning stream with reproducible IDs.

**Dependencies:** can adversarially inspect C immediately; browser runs need A/D; presence tests need B quality. Translations/AT tooling need named environment and competent reviewers. No live semantic evaluation while G is blocked.

**Acceptance:** no critical control/truth/privacy defect; all options accessible without distance/reading penalties; return/resume one-shot state; actual device and AT coverage accurately stated; protocol’s provisional per-slice evidence gates met with honest denominators, two reviewed iterations, and shorter/text comparison justifies retained spatial structure. Missing evidence is pending, never assumed pass.

**Integration order:** test harness after A; blocking smoke before each D/B candidate; reports/cut decisions after each round. Owners patch and QA reruns only affected failures plus required compatibility checks. Do not expand testing endlessly once documented acceptance passes.

**Other agents must NOT edit simultaneously:** test scenarios/reports during a run, stimulus revisions during a human round. A/B/D/F do not write QA’s acceptance result or reinterpret a failure as participant error. No production telemetry of sensitive source/reflection text.

## F — AUTHOR FLOW

**Owner:** authoring engineer with editorial reviewer. **Inputs:** A validated source/semantic/reveal boundaries, C approval/staging/unknown model, E mistaken-inference/correction findings, pinned B assets.

**Exact outputs:** tell→boundary→act→preview author path; separate private act/why/aftermath fields; scene strip/evidence/unknown/staging/tension/stop preview; correct/remove/simplify controls; at most one clarification at a time with memory/text alternative; immutable revisions and decision equivalence rules; private-source handling and deletion plan; author can correct a wrong detail without code. Initial operation uses hand-authored semantics; it does not reconnect a provider.

**Likely owned files:** `src/components/experience/v3/author/`; V3 draft intake module under `src/engine/v3/author/`; future `src/server/v3/drafts.ts` only when persisted author work is explicitly scoped; integration of legacy `ViviCreate.tsx` owned by the designated integration owner, not simultaneous F/D edits. Schema changes still belong to A; sample source to C.

**Dependencies:** stable A schemas and a complete D slice, C reference preview contents, E first-round corrections. Can prototype preview layout from C sooner. Public storage is not required to prove author correction locally.

**Acceptance:** independent author/editor can identify what is exact, belief, staging, unknown and reveal-only; remove wrong detail/scene without breaking knowledge/graph; preview and approved playback agree; no author act/why/after enters semantic requests or repair; withheld explanation stays absent; revision pins asset/decision provenance. Zero forced extra drama to qualify as playable. Source caps/deletion/spoiler surfaces reviewed separately for public release.

**Integration order:** after first-sequence stability, before G unlock; authoring corrections retest implicated C/D/B/E artifacts. No production create flow replacement by default.

**Other agents must NOT edit simultaneously:** author preview/draft intake; no runtime/schema changes without A ownership; no provider connection or social-service shortcuts. F does not treat fiction approval records as consent from real people.

## G — GENERAL GENERATION — BLOCKED

**Owner:** semantic-generation engineer after gate authorization. **Inputs:** reviewed A contracts/deterministic compiler, C proven targets/controls, E two-iteration evidence for all three slices, F successful independent corrections and complete phases 0–4 evidence.

**Exact later outputs:** strict named semantic schema/prompt, bounded server adapter using only pre-boundary source, claim proposal validation/author approval, at most one repair, replay/holdout evidence/tension/graph/format audit, safe downgrade to memory/text, scoped caching/revision pins, measured cost per author-approved good post. No generated NPC response, runtime model access or art-per-story call. Paid/live benchmarks need separately established budget; current task forbids them.

**Likely later owned files:** `src/engine/v3/generation/`; provider adapter under `src/engine/v3/compiler/` by A handoff; `scripts/eval-experience-v3.ts`; redacted replay corpora and cost reports. A retains schema authority; F owns author correction; C golds remain immutable targets.

**Dependencies / hard unlock:** A technical acceptance + B look/accessibility + C complete source/prototype review + D all three candidate slices + E two reviewed human iterations/control cuts + F author review/quality gate. If any slice fails, fix or downgrade the format before reconnecting. Source/spec richness alone is not unlock evidence.

**Acceptance:** approved entailment, unknown preservation, clear motive/cost pairs, feasible boundary/acts, supported kits and bounded graphs; zero ungrounded playable publication; pre/reveal canary/spoiler checks; honest downgrade; actual live latency/cost data only if separately authorized. Automated validity is not narrative certification.

**Integration order:** only after written gate review, development-only replay adapter first, holdout author-reviewed semantics next; production connection requires separate release decision. No changes now in this stream.

**Other agents must NOT edit simultaneously:** new model contract/provider prompt or expand compiler budget. No one touches existing production generation to accelerate V3, unlocks from one successful story, or uses G to generate dramatic missing source for C.

## H — SOCIAL — LATER

**Owner:** service/product/privacy/moderation team. **Inputs:** proven format/account rhythm, immutable decision versions, real identity/guest participation model, private/public reflection consent and deletion needs.

**Exact later outputs:** genuine persisted posts/attempts and one first-choice per declared participant/version; idempotent decision/reveal API; replay/known-reveal exclusions; denominator/deduplication disclosures; opt-in explanations/responses/follow-ups from real people; authorization/privacy/moderation/delete tests. Author encounter always precedes reflection/comparison. Empty state remains honest.

**Likely later owned files:** `src/server/v3/{posts,attempts,comparison}.ts`; storage/auth/moderation modules; social UI under `src/components/experience/v3/social/`. A owns client decision interface; F private drafts; integration owner shared server routing. Public release is not implied.

**Dependencies:** format value and identity/privacy/moderation decision. Social infrastructure is independent of provider quality and need not ship in the first candidate. C’s local private draft/next-story controls require no fabricated network/community.

**Acceptance:** real counts only, declared uniqueness limits, no moral grading, no automatic public quote publication, delete derived private/reveal data consistently, spoiler-free share previews, user/attempt authorization and retry/idempotency tests, actual consent/retention/moderation ownership. Review sensitive source storage before release.

**Integration order:** separately scoped after format proof; later controlled release only by explicit authorization.

**Other agents must NOT edit simultaneously:** social service/identity/counting semantics, server endpoints and response UI. No fake users, percentages, replies or “related real story” placeholders are permitted during C/D/B prototyping.

## Integration checkpoints and stop rules

1. **Contract checkpoint:** A+B+C agree finite schema/projection/geometry; A lands validated ownership path on dedicated integration branch. C planning files can land independently as documentation/specs.
2. **Office checkpoint:** D adapts Correction through A compiler, B approved office kit, E independent control/state/boundary smoke. Product round one begins only when ordinary interaction works.
3. **Three-format checkpoint:** B/D finish micro/domestic and controls with same pipeline; E evaluates all formats, mobile/AT/languages and cuts extra scenes when unsupported by understanding/care.
4. **Author checkpoint:** F independent author review/corrections and immutable pins; E second reviewed iteration verifies truth/controls/format evidence. Record each gate separately.
5. **Generation checkpoint:** G stays blocked until the above written evidence; use replay/dev first, separate paid-call authorization and public-release approval. H remains a separately scoped later project.

A failed reveal, inaccessible act, repeated fictional/unknown misunderstanding or source leak blocks the affected slice immediately. A non-contributing room gets cut, not more props. A user expecting an answer after asking triggers boundary/source review, not an invented branch. Missing Foundation capability triggers an explicit contract decision or simpler presentation, not a competing fixture runtime. No implementation may satisfy a gate by modifying the source behind researchers’ backs.
