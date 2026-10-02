# Vivi — OpenRouter production inference v1

The semantic step of the pipeline (story → compact Vivi DSL) can now run on
any OpenRouter model. Everything after it — validation, one repair at most,
deterministic fallback, the Experience Compiler, playback — is unchanged and
vendor-free.

```
story ─▶ preprocess ─▶ semantic provider ─▶ DSL ─▶ validate ─▶ semantic review (≤1 repair) ─▶ ExperienceCompiler ─▶ PlayablePost
                        │                                   │
                        ├ openrouter  (src/server/openRouterProvider.ts)
                        ├ gemini      (src/server/geminiProvider.ts, legacy)
                        └ none ───────────────── deterministic fallback ┘
```

The end user configures nothing. They write *What happened?* (and optionally
*What really happened?*), press Create, and the server does the rest.

## Recommended model (live bakeoff, 2026-10-02)

**`OPENROUTER_MODEL=openai/gpt-5.4-nano`** — best Vivi score (55.2% faithful
playable vs 43.1% for the runner-up `qwen/qwen3-235b-a22b-2507`), best in EN,
RU and HY, 92% model-authored, p95 ≈ 10.6 s, ≈ $0.0007 per story
(≈ $0.70 per 1,000). Full method and numbers:
[`reports/openrouter-model-bakeoff.md`](../reports/openrouter-model-bakeoff.md).

The model has not changed since, but the engine around it has: the same model
on the same corpus now scores **82.8%** with a 1.7% fallback rate, at
≈ $0.00077 per story. The bottleneck was never the model. See
[`reports/compiler-quality-hardening-v1.md`](../reports/compiler-quality-hardening-v1.md).

The code default and `.env.example` still name `qwen/qwen3.8-flash`, the
pre-bakeoff hypothesis, as requested. It could not be tested: this account's
ZDR policy excludes its only host, so with the current account settings every
`qwen/qwen3.8-flash` request falls back to the deterministic experience.
Switching is a one-line env change.

No paid fallback model is recommended: the deterministic fallback already
covers outages at zero cost.

## Configuration (server-side only)

| variable | default | meaning |
|---|---|---|
| `OPENROUTER_API_KEY` | — | Server secret. Never in a `VITE_*` variable, never in client code. |
| `OPENROUTER_MODEL` | `qwen/qwen3.8-flash` | Model id. One env change switches models. See the bakeoff for the recommendation. |
| `OPENROUTER_FALLBACK_MODEL` | — | Optional. Uses OpenRouter's own `models: [primary, fallback]` routing — still one request, no cascade. |
| `OPENROUTER_APP_NAME` | `Vivi` | Sent as `X-Title`. |
| `OPENROUTER_SITE_URL` | — | Sent as `HTTP-Referer`. |
| `OPENROUTER_REASONING` | `off` | `off` \| `minimal` \| `low` \| `default`. `off` falls back to the lowest effort a model accepts when reasoning is mandatory. |
| `OPENROUTER_TEMPERATURE` | `0.2` | Sent only when every eligible endpoint accepts it. |
| `OPENROUTER_MAX_TOKENS` | `700` | Output cap (DSL replies are ~200–500 tokens). |
| `OPENROUTER_TIMEOUT_MS` | `20000` | Per request. On timeout the deterministic fallback is used. |
| `OPENROUTER_ZDR` | `false` | `true` restricts routing to zero-data-retention endpoints (see Privacy). |
| `OPENROUTER_PROVIDER_SORT` | — | `price` \| `latency` \| `throughput`. Unset = OpenRouter's default balancing. |
| `SEMANTIC_PROVIDER` | `auto` | `auto` (OpenRouter key → Gemini key → deterministic) \| `openrouter` \| `gemini` \| `deterministic`. |
| `GENERATION_RATE_PER_MIN` | `8` | Generations per client per minute. |
| `GENERATION_MAX_CONCURRENT` | `4` | Concurrent generations across all clients. |

At startup the server logs only the provider kind and model id, plus
configuration warnings by variable *name* — never a value.

## What is sent

One chat request per story (plus at most one repair):

- **system**: `STRUCTURED_SYSTEM_PROMPT` (task, vocabulary, truth rules — all
  generated from `vocabulary.ts`);
- **user**: the normalised story and the preprocessing hint line;
- `response_format: { type: "json_schema", json_schema: { strict: true, schema } }`
  where `schema` is built from `vocabulary.ts` by `buildDslJsonSchema()` —
  there is no second enum list anywhere;
- `provider: { require_parameters: true, data_collection: "deny" }` (+ `zdr`
  when enabled), so the router only picks hosts that honour the schema and
  do not train on or retain prompts;
- `max_tokens: 700`, `temperature: 0.2` where supported, reasoning disabled
  where the model allows it; `usage: { include: true }`.

The **repair** request carries only a one-line system instruction, the
objections and the previous JSON — never the story or the full prompt. The
objections are either validator errors or the semantic review's: a scene whose
choices all reach for the same thing, or a person the story never had. They are
written as one short, actionable sentence each, and the variety one names what
else the scene already offers so there is somewhere to move a choice to.

**Never sent:** the author's *What really happened?* (`actualOutcome`). It
does not reach the provider, the repair, or the semantic cache key. Tests and
every live bakeoff run check request bodies for it.

Strict schemas cannot express positional tuples, so a model writes the DSL
as small objects (`{"r":"partner","p":"on","n":null}`) and `wireToDsl()`
converts them back, losslessly, before the normal validator runs.

## Usage accounting

Each generation reports OpenRouter's own numbers: input, output, reasoning
and cached tokens, `usage.cost` in USD, latency, the upstream host, whether
the first pass validated, whether a repair ran (and its cost separately),
cache hits and fallback reasons. Production logs one line per generation with
those numbers and no story text. `?lab` (development builds only) shows the
full report for the last generation, including one made from the Create
screen.

## Failure behaviour

| condition | what the user gets | dev diagnostics |
|---|---|---|
| 401 invalid key | deterministic experience | `provider error: openrouter 401 unauthorized` |
| 402 out of credit / key limit | deterministic experience | `… 402 insufficient_credits` |
| 429 rate limited | deterministic experience | `… 429 rate_limited` |
| 404 / no endpoint (model gone, data policy excludes all hosts) | deterministic experience | `… 404 model_unavailable` |
| timeout (before headers or mid-body) | deterministic experience | `… timeout` |
| invalid DSL after one repair | deterministic experience | `model DSL invalid after repair` + validator errors |

Raw OpenRouter JSON never reaches the client. Error messages are built from a
status and a short code; any upstream detail is passed through
`redactSecrets()` first.

## Abuse protection (prototype grade)

- story ≤ 1,500 characters, outcome ≤ 1,500, request body ≤ 32 kB;
- per client: 8 generations per minute and one in flight at a time;
- globally: 4 concurrent generations, then `503` with `Retry-After`;
- semantic cache bounded at 500 entries.

This is in-memory and single-process. A multi-instance deployment needs a
shared limiter (and real authentication) before it is opened to the public.

## Privacy

- `data_collection: "deny"` is sent on every request.
- **ZDR (zero data retention)** is available as `OPENROUTER_ZDR=true`, but it
  is off by default: not every model has a ZDR endpoint.
  `qwen/qwen3.8-flash`, for example, is served only by Alibaba, which is not a
  ZDR endpoint.
- **This account already enforces ZDR in its OpenRouter privacy settings**
  (openrouter.ai/settings/privacy). Under that policy OpenRouter refuses
  `qwen/qwen3.8-flash` with `404 … ZDR violation (account settings)`. Models
  with ZDR hosts (the OpenAI nano models on Azure, the Qwen3 open-weight
  models on DeepInfra / Nebius / Parasail / …) route normally.

## Key and spend safety

The application does not rely on the account balance being large:

- 402 and 429 degrade to the deterministic experience;
- the generation guard bounds how fast any one client can spend.

The OpenRouter key itself should be set up so that a leak or a bug cannot
cost much:

1. **One key per environment, with a name** ("vivi-dev-<machine>",
   "vivi-prod").
2. **A spend limit on the key** (OpenRouter → Keys → limit). The current dev
   key has a $1 limit — keep production keys similarly bounded and raise
   deliberately.
3. **An expiration date on dev keys.**
4. **A model allowlist / guardrail** where OpenRouter offers it, restricted
   to the configured model and fallback.
5. The key lives only in the server environment: `.env` locally (ignored by
   git: `.env*` with only `.env.example` allowed) and the host's encrypted
   secret store in production. Never in GitHub, a Dockerfile, build args,
   Vite config or client JavaScript.

## Commands

```bash
npm run bench:openrouter   # configured model, corpus, tokens / cost / latency
npm run eval:openrouter    # configured model, corpus + blind set, quality summary
npm run eval:models        # full matrix from config/openrouter-models.json, 2 runs, writes the report
npm run report:models      # re-render the report from saved raw results (no API calls)
```

The matrix lives in `config/openrouter-models.json` — no TypeScript changes
to add or remove a model. Every live run reads the key's authoritative usage
from OpenRouter first and stops before a hard budget (`budgetUsd`, default
$0.50) would be exceeded. The key is never printed.

## Deployment status

Production secret ready; deployment host not configured. The repository has
no deployment target (no Dockerfile, host config, CI workflow or
authenticated deploy CLI), so no infrastructure was created and no secret
was uploaded anywhere. Once a host is chosen, set `OPENROUTER_API_KEY` (and
`OPENROUTER_MODEL`) in that host's encrypted, server-side secret store, and
run with `NODE_ENV=production` so the client receives only the minimal
compiler report.
