# Isolated V3 gold specifications

Planning only. Current operational authority: [Integration baseline](../../../../docs/VIVI_V3_INTEGRATION_BASELINE.md). Current V3 languages are EN/RU only; HY is deferred future localization. Original gold-1 source and all nine JSON files are preserved byte-for-byte from `028e400fb78d888036a5e184a8060200e63a5a0b`. Russian approved content is still required before claiming parity; it is not supplied by the English-only JSON.

 Nothing here is imported, compiled or registered by V1/V2 or a production route. JSON avoids competing TypeScript/runtime contracts while another agent owns Foundation. The directory follows the V3 plan’s fixture ownership; `spec/` prevents accidental assumption that these are playable records.

Each experience has three physically separate files:

| File suffix | Audience / contents | Permitted future use |
|---|---|---|
| `.source.private.json` | Editorial/research: complete final pre-boundary source, exact span offsets/hash, fact provenance/approval, staging approval, separate reveal source | Trusted intake/evidence validator. Never wholesale public playback input. |
| `.semantic.json` | Pre-boundary planning projection: facts, tension, actors/objects/locations, scenes/spine, portals/cuts, observations/preparations/opportunities, one decision, boundary, time/state requirements | Hand-authored semantic proposal target; validate then deterministically compile with approved kits. Contains no authorOption/act/why/aftermath. |
| `.reveal.private.json` | Trusted fictional account and complete choreography | Separately released reveal record after acceptance, or explicit read-without-playing mode. No static production bundle import. |

These are **planning envelopes**, not executable `SemanticPlanV3`/`PlaybackManifestV3` and not a competing schema. The semantic file includes review notes and interaction acceptance copy alongside plan concepts to keep engineering behavior explicit. `scenes[].beats` refer to `softTimeEvents`; Foundation will normalize to semantic beat records and a compiled schedule. Source spans live privately; semantic fact IDs map back to the private approved ledger during compilation. The current source is English/NFC, half-open Unicode code-point offsets, paragraphs joined with two LF characters. Original source is also preserved.

## Foundation adaptation map

| Planning field | Master-plan destination / constraint |
|---|---|
| evidenceFacts `type=belief/quote/observed/timing` | EvidenceFact kinds `hero_belief/quoted_speech/observed/timing` |
| evidenceFacts `type=relationship/context` | Use `observed` with analytical tag retained privately; describes author-reported relation/context, not independently verified evidence. Split a compound claim if the approved runtime schema requires it. |
| private sourceSpanIds + approval | ClaimProposal and private EvidenceFact.source; `author_confirmed` is editorial confirmation of fiction, never real contributor consent |
| portals fromLocation/toLocation | PortalPlan.from/to; returnPortal is inverse; availability gates use break/request receipts |
| sceneTransitions | Spine cuts/reader continuation, not fake walkable doors |
| softTimeEvents + scene beat IDs | SemanticBeat/SemanticEvent and deterministic ScheduledEvent. `causal` events include source-backed hero transfers and break closure; ambient has no semantic effect. Never infer milliseconds. |
| opportunities physical/confirmation/stopFrame | Closed approved enactment recipe + UI copy + boundary receipt; prose is not executable script |
| presentation stagingApprovalId | Trusted staging review, not a fact or final asset ID |
| worldPersistence | RuntimeSnapshot/EntityState invariants; variable names are proposed finite fixture vocabulary, not unrestricted runtime state |
| controls | Separate experimental stimulus definition; not loaded into production playback |

`o_deck` and `o_slide` are desk/meeting display surfaces showing the same forecast content; no logical document is transferred between them. The Correction summary is always hero-owned. Spare Key’s phone is hero-owned, sister’s belongings stay location-owned inside, sister stays in the hall. A renderer may project the adjacent hall actor through an open doorway without changing or duplicating ownership. Final Spare Key approach is to an **inside** threshold mark, so primary scene/hero location remain `k_return`/living; no hidden fourth scene or cross-boundary door act is required. Break revisits are projections of already visited locations in current phase, never replays of previous factual beats.

All reference IDs are experience-scoped. There is no coordinate geometry, asset checksum, compiler revision, public revealRef service, model provider, production route or server protection claim. Gold files are visible in this repository: physical separation is an authoring/architecture discipline, not secrecy from a repo reader. Any production adapter must enforce real public/private release boundaries and spoiler checks.

## Offline audit

Run `python3 src/data/experienceV3Fixtures/spec/validate.py` from the repository root. The audit checks exact excerpts/offsets/hashes, source/fact/entity/scene/event references, required knowledge, gate references, causal ordering, reversible portal counterparts, option limits and obvious reveal leakage. It is a planning-artifact audit only: it cannot prove entailment, visual honesty, control behavior or human care. No paid or network calls. No package/dependency changes.

The pack’s [human README](../../../../docs/v3/format-proof/README.md), [research protocol](../../../../docs/v3/format-proof/HUMAN_TEST_PROTOCOL.md) and [red-team report](../../../../reports/v3-format-proof-red-team.md) supply the evaluation that JSON validity cannot.

## Provisional visual-label interpretation

The unchanged semantic JSON `presentation.style = paper_diorama` is the original gold-1 **planning-family label**, not a final art approval, Foundation enum or demand for a different renderer. Its illustrated layers/editorial framing can carry Design’s provisional Remembered Room attention islands, graphite periphery and author-page reveal. Foundation chooses the executable vocabulary in one complete contract revision; a future adapter maps this inert label without source edits or story-ID branches. Gold stop frames, ownership and fact receipts govern either presentation. Visual motion cannot mark evidence read, create NPC behavior or alter the boundary. No JSON conversion/schema implementation is done in this branch.
