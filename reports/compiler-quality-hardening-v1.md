# Vivi — compiler quality hardening v1

Branch `quality/vivi-compiler-hardening-v1`, from `b5408bf` (2026-10-02).
Production model unchanged: `openai/gpt-5.4-nano`. Total additional OpenRouter
spend for this pass: **$0.0735** of a $0.08 budget (a $0.0088 development
subset, $0.0447 full set, $0.0076 targeted re-check, $0.0124 holdout). Author outcome found in
request bodies across every run: **0**.

The question this pass asked was not "which model is better". The previous live
bakeoff put `gpt-5.4-nano` at 55.2% faithful-playable, and a quarter of all
runs failed for one reason: the scene the model wrote was a legal program and
not a situation — three ways to touch the same object, or a person the story
never had. Those are compiler problems, not intelligence problems.

---

## Headline

| | baseline (b5408bf) | after (full run) | holdout (fresh stories) |
|---|---|---|---|
| faithful + playable | **55.2%** | **82.8%** | **80.0%** |
| fallback to deterministic | 7.8% | **1.7%** | **0.0%** |
| first-pass DSL valid | 75.0% | **94.8%** | **100.0%** |
| repair rate | 25.0% | 25.9% | 26.7% |
| compiler collision failures | 3.4% | **0.0%** | **0.0%** |
| truth errors | 0 | **0** | **0** |
| invalid vocabulary | 0 | **0** | **0** |
| avg input tokens | 2,772 | 2,829 | 2,887 |
| avg output tokens | 447 | 493 | 537 |
| cost per story | $0.000696 | $0.000770 | $0.000828 |
| p95 latency | ~10.6 s | 12.1 s | 13.7 s |

**The 85% target was not reached.** 82.8% measured, with three deterministic
fixes landing after that run that the replay below puts at 86.0% — but a
replayed number is not a measured one, and the budget was gone. The honest
statement is 82.8% measured, ~86% expected, and a clear reason for the gap.

Runs: baseline 116 (58 stories × 2), this pass 58 (× 1 — the budget bought one
run of each story, so every rate below has a wider confidence interval than the
baseline's). Raw data: `reports/data/hardening-v1-{full,recheck,holdout}.json`.

---

## What was wrong, measured before changing anything

The previous run stored every DSL the model produced, so the failure analysis
cost nothing. Across 116 `gpt-5.4-nano` runs, 52 failures:

| cause | runs | share of all runs |
|---|---|---|
| every commitment targets the same kind of thing | 29 | 25.0% |
| fallback: DSL invalid after repair | 9 | 7.8% |
| more than 4 key objects | 6 | 5.2% |
| person the story never had, on stage | 7 | 6.0% |
| wrong world | 4 | 3.4% |
| two choices sharing a standing spot | 4 | 3.4% |
| pressure beat before the cue | 3 | 2.6% |

Of the 9 fallbacks, **7 were the same defect**: the model used a role in an
event without listing it in the cast, and the validator threw the whole scene
away for it.

---

## What changed

### Deterministic (no model involved)

- **One semantic classifier.** `commitmentClasses.ts` decides what each choice
  reaches for — `OBJECT`, `ACTOR`, `PLACE`, `EXIT`, `WAIT_STATE`,
  `COMMUNICATION` — and the spot it is staged at, from the verb, the target,
  the cast and the world's vocabulary. Never from the label text, which is free
  prose in any language. The rule that demands variety and the compiler that
  stages the scene call the same function.
- **Standing spots are allocated, not resolved.** Each choice gets its own
  walkable, in-frame, reachable patch of floor near the thing it is about.
  Collisions: 3.4% → 0%.
- **A role used but not declared is an omission.** The validator already added
  an object an event named; it now closes the cast the same way, with presence
  read from the use. This alone took first-pass validity from 75% to 94.8% and
  fallbacks from 7.8% to 1.7%.
- **Every place word resolves in every world.** A family home has a bedroom
  even though its template draws no bedroom slot; 20 of 46 place errors in the
  baseline were exactly that. A place falls back along its own kind.
- **Cast grounding**, with deterministic enforcement after the repair turn:
  an invented role nothing refers to is dropped for free; one the scene uses is
  sent back once, and if it survives that it is removed along with the events
  and choices that needed it — but only while one event and two choices remain.
- **Unused key objects are pruned**, which removed the "more than 4 objects"
  failure class.
- **Smaller staging fixes:** two people entering through one door stand apart;
  a figure in a doorway steps in along a clear line or stays put; a scene whose
  last event is its cue still gets a pressure beat after it; a scene no event
  frames still gets one shot; a background figure the model then uses as a
  character is staged rather than deleted with the crowd.
- **Preprocessing:** the Armenian stem `ընկեր` no longer matches inside
  `գործընկեր` (friend inside coworker), Russian `друг` no longer matches inside
  `другой`, and a story that says "rented" outranks one that merely says
  "apartment". World-hint accuracy against the corpus rubric: **46/47**.

### Model-facing (prompt grew by ~40 tokens, 830 total)

- Choices must not be paraphrases of one act: at least two must reach for
  different things.
- Observations and outcomes are a phrase of 3–20 words, never a fragment.
- Hints are the author's own words — take `world~` and `people=` unless the
  story plainly says otherwise.
- The repair line asks for no new story facts, and the variety objection now
  names what else the scene already offers.

### Measurement

- The eval's variety check moved onto the same classifier: "call the phone" and
  "read the phone" are one noun and two acts, while "open the door" and "lock
  the door" are two verbs in one spot. The older, cruder measure is kept as
  `legacyCommitmentKinds` so a stored run can be re-scored the way it was
  scored when it ran — both numbers appear below.
- `scripts/replay-bakeoff.ts` recompiles a stored run's own DSL through the
  current compiler, which measures the deterministic half of any future change
  for free.

---

## Deterministic-only effect, measured offline

The baseline's 107 model-authored programs, recompiled with no model call:

| | legacy rubric | current rubric |
|---|---|---|
| baseline, as it was scored | 59.8% | — |
| same programs, current compiler | **66.4%** | **75.7%** |

So roughly **+6.6 pp came from the compiler alone**, before the model was asked
anything differently. The rest of the gain came from fewer fallbacks and from
the repair turn now having something actionable to fix.

---

## Where the remaining failures are

Ten failures in the 58-story run:

| cause | n |
|---|---|
| person the story never had | 4 |
| observation or outcome shorter than three words | 3 |
| choices still in one spot / one kind | 2 |
| wrong world | 3 |
| fallback (a place that did not exist in the world) | 1 |

*(causes overlap)*

Three deterministic fixes landed after that run — total place resolution, the
world tie-break, and the copy-length line. Re-running **only those ten stories**
cost $0.0076 and **seven of the ten passed**, with no fallbacks and 100%
first-pass validity.

The holdout then measured the system at **80.0%**, with all three failures being
the same thing: grounding correctly identified an invented actor, and the
model's one repair turn did not remove it. That is what motivated deterministic
enforcement, which landed last. Replaying the stored holdout DSLs through the
final compiler:

| | live | replayed through final compiler |
|---|---|---|
| holdout (15 fresh stories) | 80.0% | **86.7%** |
| full set (57 model-authored) | 84.2% | **86.0%** |
| people the story never had | 20.0% | **0.0%** |

The replay is exact for the compile stage — it feeds the final compiler the
same DSL the live run produced — but it cannot model a different repair turn,
and it is not a live measurement. It is reported as what it is.

---

## Cost, latency, truth

| | baseline | full run | holdout |
|---|---|---|---|
| avg input tokens | 2,772 | 2,829 | 2,887 |
| avg output tokens | 447 | 493 | 537 |
| repair frequency | 25.0% | 25.9% | 26.7% |
| avg cost of a repair turn | — | $0.000642 | $0.000679 |
| cost per story | $0.000696 | $0.000770 | $0.000828 |
| per 1,000 stories | $0.70 | **$0.77** | $0.83 |
| median latency (first pass) | — | 5.1 s | 5.3 s |
| p95 latency (first pass) | — | 8.1 s | 6.7 s |
| median latency (repair turn) | — | 4.9 s (n=15) | 7.9 s (n=4) |
| p95 total | ~10.6 s | 12.1 s | 13.7 s |
| runs over the 20 s production timeout | — | 0% | 0% |
| deterministic compilation | — | < 10 ms | < 10 ms |

Quality rose 27.6 pp for **11% more cost** and **no change in repair
frequency** — the new objections replaced structural ones rather than adding to
them. Still one tiny model call per story, plus the same one repair turn that
already existed.

**Truth invariants hold.** `actualOutcome` never reaches OpenRouter: every
request body in every run was scanned for it and for a canary; 0 leaks across
83 story runs and 105 API requests. Author truth is preserved byte-for-byte;
`withheld` stays withheld. Truth-safe: 100% in all three runs.

---

## Verification

- `npm run lint`, `npm test` (26 compiler checks, 15 provider checks, 13 runtime
  checks, 39/39 eval experiences), `npm run build` — all pass.
- New regression coverage: all-object choices cost exactly one repair turn and
  the repaired scene is the one played; a story that honestly offers one place
  is not rejected for being small; an invented person is refused when used and
  dropped for free when not, removed deterministically when the repair turn
  will not, while a public crowd is never questioned; a commuter is not implied
  by an office; standing spots are unique and reachable; two people entering
  through one door stand apart; a generated scene plays through cue → inspect →
  commit → reveal → reload.
- No story-id branches in 41 core engine files; the holdout ids are asserted
  absent from `src/`.
- Security: no server-side hardening file was touched (ZDR, redaction, rate
  limiting, global concurrency, story length limits are byte-identical to
  `b5408bf`). No credential literals in the diff or in any tracked file; `.env`
  is ignored and untracked, and its value was never read.

### Real app, end to end

Dev server on port 3001 against the live OpenRouter provider (port 3000 was held
by an earlier session's server, which was left alone).

- **EN, relationships** — created through the UI, `source=model`, first pass, no
  repair. The apartment rendered (desktop and mobile), cast and key objects
  correct, three choices at three distinct reachable spots, author truth
  preserved exactly, cue 6.5 s < pressure 26 s, 2 camera events, 6 modifiers,
  room-tone bed.
- **RU, work** — through the same server endpoint the UI calls: office, boss on
  stage with two background colleagues, choices ACTOR / ACTOR / EXIT, truth
  preserved exactly, 3 camera events, office-hum bed.
- **HY, creepy** — hallway, empty cast (correct: the story says nobody was
  there), choices OBJECT / EXIT / COMMUNICATION at three spots, truth withheld
  (no outcome given), 8 modifiers, 4 camera events.

**Not verified by hand:** the interactive commit → reveal click path. The
browser pane kept collapsing, and the engine's animation loop is paused while it
is hidden, so the player could not be walked to a choice. That chain is covered
by an automated test that drives a *generated* scene through cue → inspect →
commit → reveal → reload, not by a live click.

---

## Known weaknesses

1. **The repair turn is the bottleneck, not detection.** Grounding found every
   invented actor in the holdout; the model removed none of them. Deterministic
   enforcement now cleans up after it, but a scene that loses a character also
   loses the beat that character carried.
2. **Wrong world, 3 of 58.** The preprocessor is right 46/47 times and the model
   sometimes overrides it. The hint-adherence line was added after the run that
   measured this and has not been measured live.
3. **`off` presence is lenient.** A voice on a phone is allowed when the story
   names nobody else it could be. One holdout-adjacent story (`a missed call
   from my own number`) is scored as an invented actor under a rubric that
   allows no roles at all. I think the rubric is right and the rule is
   deliberately loose; it is a judgement call, flagged rather than tuned away.
4. **Terse copy is penalised.** "He hesitates." is good writing and fails a
   three-word minimum. The contract was changed to ask for a phrase rather than
   the rubric loosened, because loosening the rubric mid-pass would be gaming
   the measurement.
5. **One run per story.** Every rate here has a wider interval than the
   baseline's two runs, and run 1 (no author outcome) was not exercised live —
   the free `npm run eval` covers both truth paths on every corpus story.
6. **The deterministic fallback still scores 0%** on the faithfulness rubric by
   construction: its observations are empty and its labels come from templates.
   It is a safety net, not a product path, and at a 1.7% fallback rate it is now
   almost never seen.

---

## The exact next engineering action

**Make the repair turn structural instead of advisory.** When the objection is
an invented actor, do not hand the model the whole program and ask it to fix
itself — hand it the scene with that person already removed and ask only for
the one thing that is now missing: a replacement beat for the event the removal
took out. That is a smaller question, which is what a nano model is good at,
and it turns the current "remove and lose a beat" into "remove and keep the
scene whole".

Measure it the cheap way first: `scripts/replay-bakeoff.ts` on the three stored
runs tells you what the deterministic half does before a single request is sent.
Then one live run of the 58-story set, which costs about $0.045.
