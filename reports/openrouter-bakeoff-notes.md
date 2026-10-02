## Analysis (written after the run; the policy and rubric were fixed before it)

### Recommendation

| | model | why |
|---|---|---|
| **Production model** | `openai/gpt-5.4-nano` | Best score (55.2%) by a clear 12 pp margin, best in every language (EN 53.9 / RU 58.3 / HY 56.3), best on the blind set (59.1%), 92% model-authored, only 7.8% fallback, p95 latency ≈ 10.6 s, zero answered runs over the 20 s production timeout. ZDR hosts (Azure), so it routes under this account's privacy policy. |
| Runner-up | `qwen/qwen3-235b-a22b-2507` | 43.1% — 12 pp behind. Cheaper per token, but slow on OpenRouter hosts (avg 28 s, p95 60 s; 61% of answered runs exceed 20 s), weakest on the blind set (22.7%). |
| Cheap paid fallback | **none recommended** | No candidate reaches 90% of the winner's score. Vivi's deterministic fallback already covers outages for free; a paid router fallback would only add latency. If availability insurance is wanted anyway: `OPENROUTER_FALLBACK_MODEL=qwen/qwen3-235b-a22b-2507`. |
| Prior hypothesis `qwen/qwen3.8-flash` | **untested** | Every request was refused: `404 … ZDR violation (account settings)`. Its only host (Alibaba) is not a zero-data-retention endpoint and this account enforces ZDR. It could not be confirmed or disproved. |

**Why the winner won.** The policy picks the cheapest model within 2 pp of the best; no model came within 2 pp of `gpt-5.4-nano`, so the most expensive candidate wins on quality — it is roughly 2–3× the per-story cost of the Qwen models but the only one that is both reliable (92% model-authored) and fast. `gpt-5-nano` is cheap and fast but fails the rubric almost everywhere (labels like "email", observations like "boss", invented characters, 81% repair rate): it is not usable for Vivi.

### Economics (OpenRouter-reported)

- Winner: **≈ $0.0007 per story attempted** (≈ $0.00066 per model-authored story; a repair adds ≈ $0.00057 when one happens) → **≈ $0.70 per 1,000 stories, ≈ 1,400 stories per $1, ≈ $70 per 100,000 stories.**
- The earlier deterministic estimate (~777 input / ~185 output tokens) was **wrong for live models**:
  - input is **~2,770 tokens** on OpenAI models because OpenAI bills the strict JSON schema as prompt tokens (~1,900 of them; factoring the schema with `$defs` already cut ~480). Qwen hosts do not bill the schema: ~950–1,020 input tokens.
  - output is **~450 tokens** (not ~185): the object wire form costs keys, and real models write full observation/outcome copy.
  - reasoning tokens: **0** for every model (reasoning disabled where possible, `minimal` where mandatory — gpt-5-nano still reported 0).
- Prompt caching helps OpenAI models after the first call (cached input tokens appear in the raw data), which is already reflected in the reported cost.

### What strict structured output bought

- **Invalid enums: 0% of runs for every model.** The schema-constrained decoder cannot emit a symbol outside `vocabulary.ts`; what remains for the validator and the single repair is cross-field logic (a role used in an event but missing from the cast, the commitment count, a place that does not exist in the chosen world).

### What limits quality — for every model

1. **"Menu" scenes are the #1 failure.** Across all models most playability failures are *every commitment targets the same kind of thing* (e.g. four objects, or several `null` targets). The prompt asks for "a thing, a person or a place" but nothing enforces a mix. Next step: add the rule to the validator so it triggers the existing single repair, or state it more sharply in the prompt — then re-run `npm run eval:models` to measure. Not done here: it would change the measured pipeline and the remaining test budget (≈ $0.10) is too small for a fair re-run.
2. **Invented on-stage characters** (gpt-5.4-nano 83% clean, Qwen-32B 81%): models add a `host`, `stranger` or `colleague` the story never mentions.
3. Occasional compiler-side layout collisions from model DSL (two actions resolving to one standing spot, an entering actor routed through furniture) — a handful of runs; these are compiler robustness issues to fix generally, not per story.

### Sensitivity and fairness notes

- *Score w/o copy check*: the commitment-copy proxy changes nothing for the winner (55.2 → 55.2) and lifts Qwen-235B to 51.7%, still below. The ranking does not depend on it. The deterministic baseline scores 0% on the strict score only because it emits no observation text by design; structurally it scores 74.1% (100% playable) — it is a safe floor, not a faithful retelling.
- *Timeout*: measured with a 60 s timeout so slow models were not penalised for latency in the quality columns. An earlier run with the production 20 s timeout (`reports/data/openrouter-bakeoff-run1-timeout20s.json`, same corpus and prompt) produced the same winner (gpt-5.4-nano 53.4% vs 34.5% / 27.6% for the Qwen models), with ~30% of Qwen runs lost to timeouts.
- *Language*: per-language n is 76 EN / 24 RU / 16 HY runs per model; RU and HY figures carry wide error bars.
- *Blind set*: 22 fresh stories (8 EN / 7 RU / 7 HY) written for this bakeoff; no compiler rule references them.
- *Gemini 3.5 Flash Lite* (optional quality reference) was not run: under the account's ZDR policy only Vertex endpoints remain, and they reject the strict Vivi schema with `400 INVALID_ARGUMENT` (bisection ruled out the event `anyOf` and `$ref`). Changing the shared schema for one reference model would have made the comparison unequal.

### Caveats

- Two runs per story per model: enough to see instability (first-pass validity and repair rates differ between runs) but not tight confidence intervals.
- The rubric's automatic checks are proxies. The review table above is the place to judge central tension and whether the choices matter.
- Prices are OpenRouter catalogue prices on the run date and the costs OpenRouter reported per request; routing among hosts (Azure for OpenAI; DeepInfra, Parasail, Novita, … for Qwen) changes per-request cost slightly.
- Total live testing spend for this task, by the key's own usage counter: **$0.398** of the $0.50 budget (pilots + two full matrix runs + three E2E generations).
