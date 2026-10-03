# THE INTRODUCTION

Gold standard · revision gold-1 · English source · **FICTIONAL EDITORIAL TEST STORY — not a real submission.**

Format: **micro**, 15–30 seconds nominal active presentation, excluding reading, optional visits and reveal. No timer, speed score or forced progression. Architecture: [V3 master plan](../../VIVI_EXPERIENCE_V3_MASTER_PLAN.md). Shared input/reveal/accessibility requirements: [pack README](README.md). All IDs below are stable within gold-1.

Entry hook: After two years together, I am introduced as his friend. His mother is paying our rent.

## A. Complete author source and private account

The following is the final original editorial source, not an attributed real person’s testimony. Span labels are metadata and are not displayed as story prose. All factual amendments supersede the master-plan example only for this fixture.

**S01** — At my first dinner with my partner’s family, his mother introduced me to a neighbor as “his friend.”

**S02** — We had been together for two years. We were both adults.

**S03** — My partner heard the introduction and kept setting the table.

**S04** — His mother was paying our rent while I looked for work.

**S05** — The neighbor smiled at me and waited.

**S06** — I was standing by the table, close enough to speak to the neighbor and for my partner and his mother to hear. I could say I was his partner, or let this introduction pass.

**S07** — I wanted to be recognized as his partner. I was also afraid of putting the rent help at risk; I did not know whether she would stop helping or why she had used “friend.”

**Pre-boundary ends here. No material below this line is passed to semantic generation or player scene state.**

### Actual act — R01

I said, “I’m his partner.”

### Why — R02

I wanted him to hear me say it. I didn’t want another evening spent pretending.

### Aftermath — R03

His mother changed the subject. On the way home he told me he had been afraid of losing her help.

### Deliberately withheld

No later rent outcome or reconciliation is disclosed. The mother’s reason for “friend,” the neighbor’s interpretation and the partner’s private thoughts at the table remain unknown.

Withheld is not a missing field to repair. No image, alt text, option rationale or anonymous narrator supplies it. The private account is released as an editorial first-person encounter, with its fictional label visible throughout.

## B. Source ledger

Source revision `introduction-source-1`. Exact excerpts and half-open NFC code-point offsets are in the private source JSON; source SHA-256 `deda18d042d75928eab0f36ff73eead2d13d6351cd5582a47a489e1e9ef75580`. `verbatim` means quoted source wording; `author_confirmed` here means editorially confirmed paraphrase of fictional source, not confirmation from a real contributor. Human entailment review is still required. Relationship/context are analytical ledger tags; see the fixture mapping note before adapting to Foundation’s closed kind enum.

| Fact | Spans | Claim | Status | Disclosure | Type | Required? |
|---|---|---|---|---|---|---|
| F01 | S01 | At my first family dinner, his mother introduced me to a neighbor as “his friend.” | editor-confirmed paraphrase | before_boundary | quote | yes |
| F02 | S02 | We had been together for two years and were adults. | editor-confirmed paraphrase | before_boundary | relationship | yes |
| F03 | S03 | My partner heard the introduction and kept setting the table. | editor-confirmed paraphrase | before_boundary | observed | yes |
| F04 | S04 | His mother paid our rent while I looked for work. | editor-confirmed paraphrase | before_boundary | context | yes |
| F05 | S05 | The neighbor smiled at me and waited. | editor-confirmed paraphrase | before_boundary | observed | yes |
| F06 | S06 | I stood by the table, could speak within their hearing, and could correct the introduction or let it pass. | editor-confirmed paraphrase | before_boundary | context | yes |
| F07 | S07 | I wanted recognition and feared risking rent help; withdrawal and the mother’s reason were unknown. | editor-confirmed paraphrase | before_boundary | belief | yes |
| RF01 | R01 | I said, “I’m his partner.” | exact | reveal_only | observed | yes |
| RF02 | R02 | I wanted him to hear me say it. I didn’t want another evening spent pretending. | exact | reveal_only | belief | yes |
| RF03 | R03 | His mother changed the subject. On the way home he told me he had been afraid of losing her help. | exact | reveal_only | observed | yes |

**UNKNOWN, and never silently resolved:**

- Why the mother used “friend.”
- What my partner was thinking then.
- Whether correcting would change rent assistance.
- What the neighbor understood.
- Whether the family already recognized the relationship elsewhere.

Every meaningful actor, object and event references this ledger. Kit furniture/material is separately approved staging, never evidence. “I didn’t hear” is restricted viewpoint; fears are not predictions. R01–R03/ RF01–RF03 belong exclusively to the private reveal source.

## C. Human tension

**What I protect:** Public recognition of an established relationship, and the housing help we depend on.

One ordinary introduction asks me to decide whether to name a relationship in front of someone who materially supports us.

**Pole A:** Be introduced as the partner I am, within my partner’s hearing. Support: F01, F02, F03, F07.

**Pole B:** Avoid risking rent help in an unfamiliar family setting. Support: F01, F04, F07.

**Say I am his partner:** Make the relationship visible in my partner’s hearing. Feared cost is grounded in F04, F07; it is a possibility or value loss, not a generated consequence.

**Let this introduction pass:** Avoid a public correction while depending on rent assistance. Feared cost is grounded in F01, F02, F07; it is a possibility or value loss, not a generated consequence.

**Power / relationship:** The mother controls current financial assistance; the source gives no explicit threat. The partner is present and heard it, but his motive becomes available only in reveal.

**Moral asymmetry:** Misnaming the relationship is not made equally legitimate by financial support. Letting it pass is understandable under dependence, without endorsing erasure. Correcting is not promised to be safe or celebrated.

**Why this protagonist, now:** The introduction concerns me, and the neighbor is waiting for me. I can speak for my own relationship; I cannot make my partner speak.

The player lacks the facts listed as UNKNOWN above. The emotional target is being able to explain someone else’s attraction and cost, including an act the player would refuse. There is no requirement for equal votes, delayed choice, a “correct” act or a moral score.

## D. Human arc and scene deletion test

### i_table — decide

**Entering:** I am at my first dinner with this family, in an established two-year relationship, materially dependent on rent help.

**Changes:** The mother introduces me as “his friend.” My partner keeps setting the table within hearing; the neighbor waits for my response.

**I now understand:** Recognition and dependence are present at once. I do not know whether the wording is intentional or what correction would cost.

**Why continue:** Only my accepted response can lead to the author encounter; there is no next room or informational quest.

**If removed:** The single frame is the whole opportunity. Removing it leaves text, which is a valid competing format.

No corridor is retained for traversal complexity. The multi-scene structures are hypotheses pending the compressed control comparison. A scene with no observed contribution must be removed even if the renderer already supports it.

## E. Scene specifications

### i_table / dining

- Purpose: `decide`; inhabited hero viewpoint. Entry: I am at my first dinner with this family, in an established two-year relationship, materially dependent on rent help.
- Present actors: a_me, a_partner, a_mother, a_neighbor. Persistent objects: o_table.
- Required scene facts: F01, F02, F03, F04, F05, F06, F07. Optional: none. Earlier received facts remain available; these are delivery responsibilities, not a reset of minimum knowledge.
- Observations: none; context delivery is sufficient. Reversible preparations: ordinary bounded attention/approach only; no object mutation.
- Event IDs in order: ev_dinner_context, ev_introduction. Every delivery holds for reading; all listed causal events are source-backed.
- Exits / portals: none. Spine continuations: primary act → reveal only.
- Player freedoms: readable context, reread consumed facts, pause/mute/exit, open available-actions list, cancel any unaccepted act; attention without locomotion.
- Cannot happen: NPC reaction to preparation, unsourced speech or private reading, automatic commitment by idle time, unsupported door travel, new messages, changed object ownership, second consequential decision. Historical prior scenes are not time-travel destinations.
- Exit state: One of two acts accepted; neighbor smile remains the sourced entry expression without changing.

### Continuation semantics

There are no observations, portals or movement prerequisites. Optional re-read context is not a knowledge collection task. The table is an evidence-bearing setting, not an inventory surface. The already-sourced smile is not a reaction to either act.

Required observations have a reader-paced delivery checkpoint at their meaningful frame. A player may open the target, use Context, or choose the explicit readable continuation; all issue the same fact receipt. Walking or clicking the object is never a prerequisite. “Continue” does not confirm an act. In readable mode scenes follow the same spine and causal ordering with the same choices. A seen quote becomes transcript text, not a second live utterance.

## F. World state / persistence

**Initial ownership:** Four actors and table in dining; hero fixed at table edge. No carried prop, portal or offstage actor.

**Scene transfers:** None. Partner’s task pose may settle once as ambient presentation; it does not advance dinner or deliver a second statement.

**Return invariants:** Pause/resume or closing context restores the same relation frame, received facts and introduction receipt. The introduction is not repeated as live speech; transcript is rereadable.

**After acceptance:** The existing neighbor smile remains in the final frame; no additional smile or nod is triggered by acceptance.

**Decision readiness:** Derive decisionPhase=ready only when the final decision phase is entered, all primaryDecision.minimumKnowledge facts have receipts, and no act is accepted. Cancel preserves readiness; acceptance closes all opportunities atomically. A final-phase location revisit does not rewind the arc.

Persist attempt ID, gold-1 manifest/decision revisions, scene/arc cursor, each visited scene, hero marks by location, received fact IDs, seen observation IDs, delivered beat/event IDs, portal phase, entity ownership, pause-reason set, pending selection and accepted decision. These are semantic receipts, not a continuously recorded path. Pending confirmation is reopened as unaccepted after resume with eligibility rechecked; accepted choice is immutable and resumes enactment/boundary without another confirmation. Save at completed transitions and acceptance.

A load failure before atomic swap leaves source state intact. After swap use the destination still/readable projection. Preloading never changes facts. Do not duplicate the carried object into location inventory. Replays use a new attempt; first-choice storage is keyed to decision version and cannot be overwritten by replay.

## G. Soft time, event by event

No real or hidden timer. All event order is logical, not a factual number of seconds. Reader advance is an interface control over a reconstructed account; it does not assert that the protagonist controlled the historical break. A still player may watch a neutral settled frame indefinitely. No missed or “silent” decision is inferred.

| Event | Class | After | Evidence | State/evidence effect |
|---|---|---|---|---|
| ev_dinner_context | evidence_delivery | entry | F02, F04, F06, F07 | Deliver named facts once |
| ev_introduction | evidence_delivery | ev_dinner_context | F01, F03, F05 | Deliver named facts once |
| ev_table_settle | ambient | entry | approved neutral staging only | presentation only |

For **each evidence_delivery event**: standing still does not expire it; present required caption/insert after dependencies, then hold. Required text, observation, intent sheet, confirmation, settings, blur and hidden tab pause progression. Leaving suspends pending delivery; returning retains consumed receipts and permits pending reading without replaying speech. For **each causal event**: execute once only on explicit eligible continuation/portal transaction after required receipts; reading blocks it; leaving/returning preserves its effect and never fires it again. Reversible portal transfers likewise have unique transaction receipts, not new story facts. For **each ambient event**: continue neutral breath/bed if not distracting; pause on app loss or user pause; stop old location bed and resume bed on return, without catch-up sounds. Reduced motion uses stills. Ambient cannot modify knowledge, relationships, actor location or option availability.

The selected primary act freezes all causal/evidence progression. Hero enactment and held trace are presentation receipts, followed by release of the separate record. Camera hold and audio fade do not claim literal silence in the historical room. No ringing device, countdown, approaching person or recurring quotation is an ambient default.

## H. Observations and readable parity

**None.** The essential spatial observation is simultaneous relation in the tableau, delivered with F01–F07 in readable context. A fabricated plate inspection would repeat prose and add busywork. Partner table-setting is visible staging of F03, not an unlock.

## I. Exactly allowed reversible preparation

No preparation recipe. Attention and reopening context are reversible. The hero does not need to walk, hold a plate, touch another actor or rehearse speech to unlock the micro.

All normal approach/travel before confirmation is cancellable. It cannot make another person notice, agree, move, reply or alter feelings. It cannot create evidence. Own carried objects stay owned without a pickup quest. No reading contents of another person’s bag, coat, document or device. No calling offstage people or promising an outcome as preparation. Cancel returns focus to the invoking action or world-entry control and retains already learned facts.

## J. Primary opportunities / acts

One decision `d_the_introduction_1` at `i_table`, decision revision gold-1. Required minimum knowledge: F01, F02, F03, F04, F05, F06, F07. All options share this minimum. Optional details never gate action. Foundation must check receipts, not clicks or distance. The action list always exposes the same available intents as targets; no option is ranked, colored as correct or hidden behind locomotion.

### name_partner — Say I am his partner

**Exact intent / target:** `speak` toward `{"kind": "actor", "id": "a_neighbor"}`. Make the relationship visible in my partner’s hearing.

**Feared cost:** F04, F07. **Feasible because:** F05, F06. Feasibility means the hero can initiate the act, not that it succeeds.

**Physical enactment:** Hero turns toward the neighbor and begins a small speaking gesture; caption: “You say you are his partner.” No synthetic dialogue.

**Confirmation (verbatim English UI candidate):** “Say to the neighbor that I am his partner, within their hearing? Your version ends as you say it.” Buttons: “Do this” / “Keep considering”. The first activation selects, a distinct activation accepts. Escape/cancel and movement cancellation before accept never record an act.

**Final pose:** Hero facing neighbor, hand relaxed near body; partner still setting table in the held reconstruction.

**Mandatory stop frame:** Hero speaking intention delivered before any change in mother, partner or neighbor.

### let_pass — Let this introduction pass

**Exact intent / target:** `remain_silent` toward `{"kind": "self"}`. Avoid a public correction while depending on rent assistance.

**Feared cost:** F01, F02, F07. **Feasible because:** F05, F06. Feasibility means the hero can initiate the act, not that it succeeds.

**Physical enactment:** Hero stays by table in a neutral pose; caption: “You let this introduction pass without correcting it.” No nod or friendly agreement invented.

**Confirmation (verbatim English UI candidate):** “Let this introduction pass without correcting it? Silence will be recorded only because you confirm.” Buttons: “Do this” / “Keep considering”. The first activation selects, a distinct activation accepts. Escape/cancel and movement cancellation before accept never record an act.

**Final pose:** Hero at original mark, unspeaking; neighbor retains existing smile.

**Mandatory stop frame:** Explicit pass caption delivered. No dinner continuation or inferred agreement.

Auto-approach is semantic recovery, never a distance error: supported mark → alternate mark → coherent cut → readable enactment. NPC state is frozen on acceptance; only hero action is enacted. Visual skip delivers the same intention caption and enactment receipt. Acceptance writes once against decision revision before reveal; failure retains the in-memory accepted act with retryable persistence state, never requests a replacement choice.

## K. Truth boundary

**PLAYER COUNTERFACTUAL WORLD STOPS at the option-specific stop frame above.** Caption communicates the entire intention while gesture starts it; completing an NPC conversation is forbidden. The trace may hold visually, but it cannot advance causal time.

After the boundary: no reply, turn, new smile, gaze, decision by another person, object transfer to another actor, door closure, public approval, changed relationship, evidence delivery, hypothetical consequence or second act. The author’s subsequent account is visibly first-person editorial material on paper, never an apparent continuation caused by the player’s choice. A player act unlike the author’s still receives the same author record.

## L. Entire reveal choreography

1. Accept once; enact the selected hero-owned gesture and intention caption. Preserve the selected final pose listed for that option. Freeze all other actors and causal/evidence events.
2. Hold the table edge between me and my partner. Carry that quiet horizontal edge into paper around the first-person line; do not show the mother changing the subject in the counterfactual frame. Hold approximately 0.6–1.2 presentation seconds, skippable; this is pacing, not source timing.
3. Stop following; keep selected final relation/prop frame. Cut to paper if reduced motion; no orbit or NPC reaction insert. Neutral bed fades under editorial transition, not as a factual silence. No applause, gasp, music sting, synthetic author voice or replayed quote.
4. Carry motif into warm paper margin. Persistent fictional label; bridge: “That is where your version stops. Here is what I did.” Mute/reduced-motion/readable modes preserve the same bridge and order.
5. Automatically reveal the first author line: **“I said, “I’m his partner.””** Then the full R01 act text, with the fictional author label. Do not place comparison badges or a textarea above it.
6. Reader Continue/scroll reveals R02 why in the author’s own words. Leave space after it; no typewriter or timed text disappearance.
7. Reader Continue/scroll reveals the full R03 aftermath. It remains separately attributable, does not back-project onto the held player frame, and does not establish missing causal explanations. Show the withheld note below the account as an honest limit, not a suspense tease.
8. Only after aftermath is presented, or reader explicitly chooses Skip the rest of the account. Skipping is logged as skipped, not read. Primary: Open another fictional story. Secondary: I have a related story (private unsent draft only). No public counts or fake replies.

Account release failure: Keep accepted act; Retry author account / exit. No re-commit, substitute outcome or wrong-option inference. Focus moves to the author heading after boundary; announcements use the full act once, not frame-by-frame aria updates. All private text becomes a sequential document in readable mode; user can reread without animation locks.

## M. Deliberately shorter control

**introduction-no-extra-scene**, nominal 15–30 seconds. Already the minimum one-scene form. No shorter spatial version is required. Text-only is the principal control.

**Preserved:** All facts and two acts.

**Removed:** No mandatory walking, object inspection or second camera destination.

**Hypothesis:** The simultaneous table-setting and uncorrected introduction may establish the partner’s presence more immediately than prose. If it adds no presence, use text.

Test the shorter first exposure in a different participant group or counterbalanced story assignment; do not let prior reveal knowledge masquerade as first understanding. Both use identical readable font size, audio policy, option phrasing and account. Rich duration is not a success measure. An improvement must appear in understanding, remembered relation, care for the account, or unsolicited explanation of what a scene contributed. Faster/lower-friction short control wins when those are otherwise equal.

## N. Text-only control — fully edited

Present the following as plain, generously spaced editorial prose with the same fictional label and no world art, walking or observation buttons. It is intentionally well-written, not a degraded baseline. A reader-paced “Read the author’s account” opens the exact R01 → R02 → R03 above. In the non-interactive test, a researcher may record the reader’s preferred first act on a separate survey before release; do not embed a fake action simulation or count it as a playable first choice.

At my first dinner with my partner’s family, his mother introduced me to a neighbor as “his friend.” We were both adults and had been together for two years. My partner heard it and kept setting the table.

His mother was paying our rent while I looked for work. I wanted to be recognized as his partner, but I was afraid of putting that help at risk. I did not know why she had used “friend,” or whether correcting her would change the help.

The neighbor smiled at me and waited. I stood by the table, close enough to say I was his partner and for them both to hear. I could correct the introduction, or let it pass.

**Separate account:**

I said, “I’m his partner.”

I wanted him to hear me say it. I didn’t want another evening spent pretending.

His mother changed the subject. On the way home he told me he had been afraid of losing her help.

**Account limits:** No later rent outcome or reconciliation is disclosed. The mother’s reason for “friend,” the neighbor’s interpretation and the partner’s private thoughts at the table remain unknown.

## O. Visual design brief and approval surface

Provisional Remembered Room presentation (pending explicit product-owner visual approval), using the shared illustrated/editorial foundation; restrained adult figures, baked surface texture, contact shadows, useful negative space. This pack specifies visual relationships and semantic anchors, not final geometry, assets or a runtime recipe enum. Design owns the authoritative kit geometry; Foundation derives paths from it.

**Composition:** One held relation frame: hero at near table edge; partner’s table-setting hand readable in midground; mother adjacent to neighbor, whose existing smile is minimal. Mobile composition keeps all four silhouettes and the table-setting relationship, with captions below. No required pan or walking. First cue shifts attention by text/facing composition rather than a dramatic push.

**Hero detail:** Partner’s hand continuing at the table while I am introduced

**Approved neutral staging** (`editorial-staging-introduction-1`):

- Anonymous adult silhouettes for all four people. No gender presentation inferred for the narrator.
- Table setting represented by a single place-setting motion then a held task pose; plates are neutral set dressing, not persistent interactable objects.
- Ordinary domestic light, warm paper and muted fabric; mother and hero receive equal exposure.
- All actors are within ordinary hearing range; no invented doorway or inaccessible corner.

**Forbidden inference-bearing decoration:** Hostile mother, shamed partner posture, marriage or sexuality labels, explicit financial ultimatum, ticking dinner cue, accepting nod on silence.

Design handoff: landscape and 390px contact sheet for every scene, accessible still and high-contrast focus state, hero-prop insert, selected-act silhouette poses, reduced-motion boundary/author frame, and layer/anchor/decode budget plan. Evidence text must remain DOM text. All offered options/acts across stories need equal visual dignity. No source likeness, invented facial affect, medical diagnosis, wealth stereotype or asset ID that leaks reveal. Attention islands, graphite periphery and paint-to-author-page may express this composition without adding facts; they are Design-owned, provisional and never alter receipts or stop frames. Review blind screenshots for unintended factual inferences before integration.

## P. Per-story human test and acceptance

Can players understand both recognition and material dependence within one frame, without assuming the mother’s motive or the partner’s known fear? Does table-setting add presence beyond the equally good prose?

Use the full [human test protocol](HUMAN_TEST_PROTOCOL.md), including the identical before/after questions, control assignment and critical blockers. Record voluntary inspection, return and cancelled selections as behaviors, not emotional scores. Source-inference audit must detect the forbidden details above. Zero repeated misunderstandings about fictional status, post-act NPC response, author-option correctness, or known versus unknown danger/retaliation.

## Q. Build-ready acceptance trace

1. Enter with fictional label and available pause/mute/exit/context controls. Deliver the scene facts in the ID order above, including all required observations through visual or readable route.
2. Use a keyboard/touch/readable run with every optional observation skipped. All options remain available after the same minimum knowledge. No mandatory walking.
3. For every reversible travel, verify the exact return invariants in F, reopen Context, and confirm no live quote repeats. Cancel one preparation and one pending act; choice store remains empty.
4. Confirm each option on a separate new attempt. Assert one decision receipt, the exact final pose/caption, stop frame, no NPC response, then R01/R02/R03 in order. Repeated activation, blur, skip and resume cannot create a second act.
5. Compare screenshot-only inferred facts against source, and compare rich versus compressed/text understanding with new participants. Report product quality separately from technical pass. This document is a specification, not evidence that any prototype has passed.
