# V3 first real slice — acceptance matrix

Candidate: **The Correction**, gold-1 four scene views/three locations, with compressed/text controls. Scope: EN/RU; HY is deferred future localization with no current test requirement. Authority: [integration baseline](../VIVI_V3_INTEGRATION_BASELINE.md), [gold source](format-proof/THE_CORRECTION.md), [human protocol](format-proof/HUMAN_TEST_PROTOCOL.md). Remembered Room is provisional pending explicit product-owner visual approval.

**All runtime/browser/device/product results in this matrix are PENDING.** This task runs planning-artifact checks only. No implementation branch or board screenshot proves acceptance. Format Proof is complete as a spec pack, not a passed product Phase 0. Technical and product findings must never be combined into one score.

## Recording evidence

Before each run pin assembly, Foundation contract, source/semantic, decision, asset/geometry/recipe and locale revisions. Record actual browser/device/input mode, viewport, zoom, network/performance profile, mute/reduced-motion/readable/high-contrast settings and tester role. Each row receives PASS / FAIL / PENDING / NOT APPLICABLE with evidence link and fixing owner; N/A needs a reason and cannot exclude a required modality/act. Record unassisted versus coached runs and real device versus emulation. Do not infer previous test success at a different revision.

A artifact validator pass proves only planning structure. A pure reducer test proves only its exercised invariants. A browser run exercises DOM behavior. A real-device/AT run establishes only that named environment. Human study evidence concerns understanding/care, with limited formative samples. Do not promote one evidence class to another.

## Technical pass — blockers are independent

A=Foundation, B=Design, D=Integration, E=independent QA. C resolves source questions. E executes/reports tests; listed fixing owner cannot self-certify independent acceptance.

| ID | Required observable behavior / test | Evidence needed | Fixing owner | Current result |
|---|---|---|---|---|
| T01 | Owned world ArrowDown/arrows move when eligible without changing scrollY; outside ownership page scrolling remains native | Actual browser key/scroll traces, focused/unfocused/button/text cases | A | PENDING |
| T02 | World Enter opens stable target or available-actions list; select opens confirmation; separate release/new activation accepts once | Key traces including held repeat, synthesized duplicate and stale option | A/D | PENDING |
| T03 | Tab leaves world; modal background inert, reachable cancel/confirm/close, focus restores invoker or fallback; reveal heading focused once | Keyboard-only DOM/focus trace | A/D | PENDING |
| T04 | Text entry/contenteditable/EN/RU typing/IME/native shortcuts never move body or submit an unrelated act | Browser editor/composition/shortcut cases | A | PENDING |
| T05 | Blur/hidden tab/modal/pointer cancel resets held movement and pause reasons; closing one scope cannot unpause another | Browser interruption and pure pause-set tests | A | PENDING |
| T06 | Pointer scroll does not become floor movement; touch targets reachable; action-list/touch/keyboard/readable offer identical three acts | Actual phone + keyboard traces, 44px hit-area/overlap check | A/B/D | PENDING |
| T07 | V3 route/loader isolated; existing V1/V2 posts, choice keys and Armenian support unchanged | Byte-preserved legacy fixture comparison, required legacy checks, route/browser smoke | A/D | PENDING |
| T08 | Runtime uses one authoritative complete Foundation contract; gold adaptation uses ordinary compile/controller, no story-ID renderer branch | Contract/adapter diff and static registry audit | A/D | PENDING |
| T09 | Desk→meeting transfers only hero; summary stays actor-owned; desk/meeting displays remain separate surfaces | Entity snapshot trace before/after transition | A/D | PENDING |
| T10 | During break, p_hall/p_room reverse; hero marks/summary ownership/Mira/director/facts persist; no duplicate actors/objects | Repeated excursion and pause/resume snapshots | A/D; B geometry if projection wrong | PENDING |
| T11 | Board quote/recognition/break/question event receipts occur once; transcript reread is not repeated speech | Scheduler/DOM caption/audio receipt trace through return/resume | A/D/B | PENDING |
| T12 | Resume closes break once, enters c_meeting_question, delivers invitation once; prior break cannot rewind; seat/near position changes only hero | Pure graph/phase checks plus browser return path | A/D | PENDING |
| T13 | All required minimum facts including F04 promise received before acceptance; optional F10 summary never gates; no required walk/click checklist | Skip-all-optional and readable-only attempts, fact receipt trace | A/D | PENDING |
| T14 | Required observation can deliver through target/context/readable checkpoint; no private content/extra figures revealed | Visual/readable equivalence trace against C ledger | A/D/B; C disputed claim | PENDING |
| T15 | Soft time unlimited; reading/action sheet/settings/blur/stall never consume choices; idle never accepts silence | Long hold/interruption tests and schedule audit, no timer/window | A/D | PENDING |
| T16 | Cancel approach/selection/preparation writes no choice and retains knowledge; both positions expose same acts; unreachable visual route recovers to cut/text | Cancel/geometry-failure/retry trace | A/D/B | PENDING |
| T17 | Confirm rechecks scene/phase/minimum/option/version, accepts once and closes alternatives; replay preserves first attempt identity | Reducer/repository duplicate/stale/replay cases | A | PENDING |
| T18 | correct_public performs only hero speaking intention at gold stop; no Mira/director look, answer, award or approval | Frame/caption/event trace; source comparison | A/D/B | PENDING |
| T19 | request_private is request now to director for later clarification, ends before acknowledgement/meeting; no second decision | Per-option confirmation/enactment/boundary trace | A/D/B | PENDING |
| T20 | pass_question is confirmed silence for this question; no timer, nod, board approval or live meeting continuation | Explicit silence/idle distinction and final-frame trace | A/D/B | PENDING |
| T21 | Acceptance freezes NPC/causal/evidence progression; hero act stops at exact frame before hold/paint/reveal; skip reaches same receipt | Per-option reduced-motion/skip/throttled-frame trace | A/B/D | PENDING |
| T22 | Public semantic/compiled input, DOM-before-boundary, alt text, URL/thumbnail/asset names and traces contain no author act/why/after/mapping | Payload/canary/spoiler inspection; repo-local secrecy limits stated | A/D/B | PENDING |
| T23 | Reveal is a separate trusted record, same account for every option; automatic act then reader why/aftermath; no input form first | Boundary→account DOM/focus trace, C exact private text match | A/D/B | PENDING |
| T24 | Reveal/resource failure retains accepted act; retries never demand re-commit or substitute outcome; scene swap is atomic | Fault injection before/after swap and reveal load; snapshot/outbox state | A/D | PENDING |
| T25 | Mute from entry suppresses sources; cues have captions; no catch-up/repeated sounds; reduced motion preserves all facts/acts/account | Actual audio/listening plus muted/still run; no source-created factual sounds | A/B/D | PENDING |
| T26 | Readable mode/AT can complete same knowledge and three acts, with actual DOM text, native controls, no animation locks | Screen-reader/keyboard and readable run on named setup | A/B/D | PENDING |
| T27 | EN/RU reviewed copy preserves uncertainty, power and option meaning; Cyrillic/wrapping/200% zoom/390px works; no live translation | Fluent reviewer signoff, pinned Russian variant and device specimens | C/F/B/D | PENDING |
| T28 | One kit geometry drives plate anchors/collision/camera/occlusion; no mandatory coordinate constant/mask/color in Foundation | A/B interface/geometry audit, prop/floor/contact/crop snapshots | A/B/D | PENDING |
| T29 | Assets/input/transition meet measured master-plan performance budgets on named low-end profile | Frame/input/decode/transfer/peak measurements, fallback evidence | A/B/D | PENDING |
| T30 | Honest continuation after account/explicit skip; no fake counts/replies/real-user attribution; incomplete/read-only attempts not counted as playable choices | UI/state/storage review across modes | A/D/B | PENDING |

Technical advancement requires all required rows resolved with evidence, no critical truth/access/input defect, and owner review of N/A claims. A placeholder candidate may pass controller checks but is not sufficient for visual/product acceptance. Failure of one primary act cannot be averaged away by success of the others.

## Product pass — separate formative evidence

Run [the full protocol](format-proof/HUMAN_TEST_PROTOCOL.md), including neutral before/after questions, first-exposure counterbalancing and honest cell counts. EN and RU need appropriate fluent coverage; English-only results do not establish Russian parity. The first Correction study does not certify the other stories or reopen generation.

| ID | Product question / observable evidence | Advancement / revision decision | Evidence owner | Current result |
|---|---|---|---|---|
| P01 | Player explains what is happening without facilitator supplying the dilemma | Understand authorship, presentation and widening board use; unsupported theft intention is a truth failure | E + C/product | PENDING |
| P02 | Player names what they protect and explains another act’s attraction/cost in own words | Credit versus recommendation dependence understood; no requirement for equal votes or slow hesitation | E + C/product | PENDING |
| P03 | Player distinguishes unknown future credit/recommendation/director knowledge from fact | No recurring “she definitely retaliates,” guaranteed private meeting or director rescue | E + C/B | PENDING |
| P04 | Player wants the author’s account before reveal and voluntarily continues when available | Protocol’s curiosity question distinct from automatic account entry; report stated intent versus behavior | E/product | PENDING |
| P05 | Player recalls at least one physical detail and explains its relevance | Named paper/public title/open threshold/position relation, not generic room decor or glowing dot | E/B/C | PENDING |
| P06 | Hallway and chosen return improve understanding/care versus compressed control | Retain only if rich outperforms short on human understanding/care without material confusion cost; cut hallway otherwise | E/product/C/B | PENDING |
| P07 | Spatial complexity earns itself against equally good text | Report rich/short/text first-exposure evidence separately; if no increment, simplify/downgrade, not weaken text | E/product | PENDING |
| P08 | Reveal feels like meeting the narrator rather than receiving a score/result modal | Player learns presenting-versus-naming why; aftermath remains attributed, contract retention not a reward proof; form does not dominate | E/product/B/C | PENDING |
| P09 | Finished art does not repeatedly imply unsupported guilt/danger/motive/urgency | Blind inferred-fact review; one severe spoiler or recurring misconception blocks stimulus regardless of ratings | E/C/B | PENDING |
| P10 | Player can operate without fighting controls or wandering meaninglessly | Record intention/failed control, assistance, purposeless route and voluntary returns distinctly | E/A/D | PENDING |
| P11 | Player may open another story or want a related private draft after account | Distinguish actual next activation/private drafting from interview “yes”; no social proof or required reflection | E/product | PENDING |
| P12 | Required EN/RU participants access the same human tension and account | Fluent meaning review and actual sessions, no equivalence assumed from font availability | E/C/F | PENDING |

Master-plan provisional candidate thresholds: at least 8/10 unassisted control completions; 7/10 explain competing motives/costs; 7/10 want author account before reveal; 7/10 recall a meaningful physical detail. Ten valid candidate first exposures and version/device/language denominators must be real; sparse short/text cells require targeted follow-up rather than fabricated significance. These small formative thresholds are iteration rules, not population estimates or one composite score. Dwell time, movement distance, emotional self-rating and choice distribution cannot replace them.

Rich-versus-control product acceptance requires actual comparative evidence: inconclusive is **PENDING**, not “rich won.” Retain extra scenes only where understanding/care improves. Immediate choosing with accurate motives can succeed; long hesitation does not prove empathy. Critical inaccessible acts, invented responses or repeated truth misunderstanding block regardless of averages.

## Decision record and larger gate

Report **technical PASS/FAIL/PENDING** and **product ADVANCE/REVISE/DOWNGRADE/INSUFFICIENT EVIDENCE** as separate columns. Product/editorial/C, B and independent E review scene/visual/account evidence. Foundation signs interface/control fixes, not emotional certification. Final visual approval remains an explicit product-owner decision; a technical screenshot or provisional board is not approval.

For the first complete sequence record source/contract/asset/decision SHAs, per-row evidence, exact failures/fixing owners, exclusions/assistance, compressed/text comparison, source-inference defects and retained/cut scene reasons. If a source/decision changes, pin a new revision and review contaminated evidence. Do not rewrite a stimulus while a research round is running.

Correction passing is necessary first-slice evidence, not general-generation permission. Introduction and Spare Key still need the same truth/input/accessibility/account checks and their story-specific product/control tests, through two reviewed iterations across all three plus independent author correction/phase 0–4 evidence. Paid benchmark, public social, deployment and existing-post migration remain separately blocked by the baseline.
