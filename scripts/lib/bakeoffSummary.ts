/**
 * Metrics, winner policy and report rendering for the live model bakeoff.
 *
 * WINNER POLICY (fixed before results were seen; do not tune it to a result):
 *   1. score = share of story runs that produced a model-authored, fully
 *      playable AND faithful experience (fallbacks count as failures);
 *   2. best = highest score among production candidates;
 *   3. among candidates within WINNER_MARGIN_PP of best, pick the cheapest
 *      by measured average cost per story.
 */
import { existsSync, readFileSync } from 'node:fs';
import type { ModelUsage } from '../../src/engine/compiler/provider.ts';
import type { FaithfulnessResult, Lang } from './faithfulness.ts';

export const WINNER_MARGIN_PP = 2;

export interface BakeoffRecord {
  model: string;
  reference: boolean;
  id: string;
  set: 'corpus' | 'blind';
  lang: Lang;
  category: string;
  run: number;
  source: 'model' | 'deterministic';
  upstream?: string;
  servedModel?: string;
  firstPassValid: boolean;
  firstPassErrors?: string[];
  /** The first reply was a legal program AND a situation (no semantic objection). */
  firstPassClean?: boolean;
  /** Semantic objections that survived the repair turn; the scene is still played. */
  semanticErrors?: string[];
  /** Roles the grounding layer refused, measured on the scene that was played. */
  unsupportedRoles?: string[];
  repaired: boolean;
  fallbackReason?: string;
  usage?: ModelUsage;
  repairUsage?: ModelUsage;
  firstLatencyMs?: number;
  wallMs: number;
  dslBytes: number;
  dsl?: string;
  playableFailures: string[];
  truthSafe: boolean;
  faith?: FaithfulnessResult;
}

export interface BakeoffData {
  date: string;
  set: string;
  runs: number;
  budgetUsd: number;
  /** Per-request timeout used while measuring. */
  timeoutMs?: number;
  stopped?: string;
  models: string[];
  stories: number;
  storyLangs: Record<Lang, number>;
  keyUsageStart: number;
  keyUsageEnd?: number;
  reportedSpend: number;
  requestsSent: number;
  outcomeLeaks: number;
  pricing: Record<string, { endpoints: Array<{ provider: string; promptPerM: number; completionPerM: number; structuredOutputs: boolean }>; selected?: { promptPerM: number; completionPerM: number } }>;
  records: BakeoffRecord[];
  baseline: BakeoffRecord[];
}

export interface ModelSummary {
  model: string;
  reference: boolean;
  runs: number;
  apiCalls: number;
  success: number;
  firstPass: number;
  /** Share of runs whose first reply needed no repair of any kind. */
  firstPassClean: number;
  /** Share of runs still carrying a semantic objection after the one repair turn. */
  semanticResidual: number;
  /** Share of runs whose played scene stages a person the story never gave. */
  unsupportedActors: number;
  repairRate: number;
  repairSuccess: number;
  fallback: number;
  providerErrors: number;
  playable: number;
  world: number | null;
  objects: number | null;
  people: number | null;
  noInvented: number | null;
  centralEvent: number | null;
  language: number | null;
  focusedObjects: number | null;
  meaningfulCommitments: number | null;
  validCommitments: number | null;
  truthSafe: number;
  invalidEnumRuns: number;
  invalidEnumPerRun: number;
  avgIn: number;
  avgOut: number;
  avgReasoning: number;
  avgCost: number;
  /** Cost per story the model actually authored (what a successful generation costs). */
  avgCostAuthored: number;
  avgRepairCost: number;
  avgLatency: number;
  p95Latency: number;
  avgDslBytes: number;
  score: number;
  /** Score without the commitment-copy check (sensitivity, not used for the winner). */
  scoreStructural: number;
  /** Score over runs where the provider answered at all (excludes provider errors and timeouts). */
  scoreWhenAnswered: number;
  /** Share of answered runs slower than the production timeout. */
  overProductionTimeout: number;
  byLang: Record<Lang, { runs: number; success: number; score: number }>;
  bySet: Record<'corpus' | 'blind', { runs: number; score: number }>;
  upstreams: Record<string, number>;
  fallbackReasons: Record<string, number>;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const rate = (xs: boolean[]) => (xs.length ? xs.filter(Boolean).length / xs.length : 0);
const rateOrNull = (xs: Array<boolean | null | undefined>) => {
  const known = xs.filter((x): x is boolean => typeof x === 'boolean');
  return known.length ? rate(known) : null;
};
const p95 = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)];
};
const COMMITMENT_FAILURE = /commitment|menu|action /;
const ENUM_ERROR = /is not one of|is not a known|not a key object|must be on\|off\|bg/;

/** Production request timeout the latency columns are compared against. */
export const PRODUCTION_TIMEOUT_MS = 20000;

/**
 * Baseline records (model === 'deterministic') are scored on their own output;
 * for models a fallback is a failure. `structural` skips the commitment-copy
 * check, to show how much of a score depends on it.
 */
export function isFaithful(r: BakeoffRecord, { structural = false } = {}): boolean {
  const authored = r.model === 'deterministic' ? true : r.source === 'model';
  if (!authored || r.playableFailures.length || !r.truthSafe || !r.faith) return false;
  const f = r.faith;
  return [f.world, f.objects, f.people, f.noInventedCharacter, f.centralEvent, f.language, f.focusedObjects, structural ? true : f.meaningfulCommitments].every(
    v => v !== false
  );
}

function summariseModel(model: string, rs: BakeoffRecord[]): ModelSummary {
  const modelRuns = rs.filter(r => r.source === 'model' || r.model === 'deterministic');
  const repaired = rs.filter(r => r.repaired);
  const langs: Lang[] = ['en', 'ru', 'hy'];
  const count = (xs: string[]) => xs.reduce<Record<string, number>>((m, k) => ((m[k] = (m[k] ?? 0) + 1), m), {});
  return {
    model,
    reference: rs[0]?.reference ?? false,
    runs: rs.length,
    apiCalls: rs.filter(r => r.usage || r.fallbackReason?.startsWith('provider')).length + repaired.length,
    success: rate(rs.map(r => r.source === 'model')),
    firstPass: rate(rs.map(r => r.firstPassValid)),
    firstPassClean: rate(rs.map(r => r.firstPassClean ?? r.firstPassValid)),
    semanticResidual: rate(rs.map(r => !!r.semanticErrors?.length)),
    unsupportedActors: rate(modelRuns.map(r => !!r.unsupportedRoles?.length)),
    repairRate: rate(rs.map(r => r.repaired)),
    repairSuccess: repaired.length ? rate(repaired.map(r => r.source === 'model')) : 0,
    fallback: rate(rs.map(r => r.source !== 'model')),
    providerErrors: rate(rs.map(r => !!r.fallbackReason?.startsWith('provider'))),
    playable: rate(modelRuns.map(r => r.playableFailures.length === 0)),
    world: rateOrNull(modelRuns.map(r => r.faith?.world)),
    objects: rateOrNull(modelRuns.map(r => r.faith?.objects)),
    people: rateOrNull(modelRuns.map(r => r.faith?.people)),
    noInvented: rateOrNull(modelRuns.map(r => r.faith?.noInventedCharacter)),
    centralEvent: rateOrNull(modelRuns.map(r => r.faith?.centralEvent)),
    language: rateOrNull(modelRuns.map(r => r.faith?.language)),
    focusedObjects: rateOrNull(modelRuns.map(r => r.faith?.focusedObjects)),
    meaningfulCommitments: rateOrNull(modelRuns.map(r => r.faith?.meaningfulCommitments)),
    validCommitments: modelRuns.length ? rate(modelRuns.map(r => !r.playableFailures.some(f => COMMITMENT_FAILURE.test(f)))) : null,
    truthSafe: rate(rs.map(r => r.truthSafe)),
    invalidEnumRuns: rate(rs.map(r => (r.firstPassErrors ?? []).some(e => ENUM_ERROR.test(e)))),
    invalidEnumPerRun: mean(rs.map(r => (r.firstPassErrors ?? []).filter(e => ENUM_ERROR.test(e)).length)),
    avgIn: mean(rs.filter(r => r.usage).map(r => r.usage!.inputTokens ?? 0)),
    avgOut: mean(rs.filter(r => r.usage).map(r => r.usage!.outputTokens ?? 0)),
    avgReasoning: mean(rs.filter(r => r.usage).map(r => r.usage!.reasoningTokens ?? 0)),
    avgCost: mean(rs.map(r => r.usage?.costUsd ?? 0)),
    avgCostAuthored: mean(rs.filter(r => r.source === 'model').map(r => r.usage?.costUsd ?? 0)),
    avgRepairCost: mean(repaired.map(r => r.repairUsage?.costUsd ?? 0)),
    avgLatency: mean(rs.filter(r => r.usage).map(r => r.usage!.latencyMs ?? r.wallMs)),
    p95Latency: p95(rs.filter(r => r.usage).map(r => r.usage!.latencyMs ?? r.wallMs)),
    avgDslBytes: mean(modelRuns.map(r => r.dslBytes)),
    score: rate(rs.map(r => isFaithful(r))),
    scoreStructural: rate(rs.map(r => isFaithful(r, { structural: true }))),
    scoreWhenAnswered: rate(rs.filter(r => !r.fallbackReason?.startsWith('provider')).map(r => isFaithful(r))),
    overProductionTimeout: rate(rs.filter(r => r.usage?.latencyMs !== undefined).map(r => r.usage!.latencyMs! > PRODUCTION_TIMEOUT_MS)),
    byLang: Object.fromEntries(
      langs.map(l => {
        const sub = rs.filter(r => r.lang === l);
        return [l, { runs: sub.length, success: rate(sub.map(r => r.source === 'model')), score: rate(sub.map(r => isFaithful(r))) }];
      })
    ) as ModelSummary['byLang'],
    bySet: {
      corpus: { runs: rs.filter(r => r.set === 'corpus').length, score: rate(rs.filter(r => r.set === 'corpus').map(r => isFaithful(r))) },
      blind: { runs: rs.filter(r => r.set === 'blind').length, score: rate(rs.filter(r => r.set === 'blind').map(r => isFaithful(r))) },
    },
    upstreams: count(rs.map(r => r.upstream).filter((u): u is string => !!u)),
    fallbackReasons: count(rs.map(r => r.fallbackReason).filter((u): u is string => !!u)),
  };
}

export interface Summary {
  models: ModelSummary[];
  baseline: ModelSummary;
  best?: ModelSummary;
  winner?: ModelSummary;
  runnerUp?: ModelSummary;
  cheapFallback?: ModelSummary;
  withinMargin: ModelSummary[];
}

export function summarise(data: BakeoffData): Summary {
  const byModel = new Map<string, BakeoffRecord[]>();
  for (const r of data.records) byModel.set(r.model, [...(byModel.get(r.model) ?? []), r]);
  const models = data.models.filter(m => byModel.has(m)).map(m => summariseModel(m, byModel.get(m)!));
  const baseline = summariseModel('deterministic (no model)', data.baseline);

  // Only models that actually answered can win: a model whose every request failed has no measured cost.
  const candidates = models.filter(m => !m.reference && m.success > 0);
  const best = [...candidates].sort((a, b) => b.score - a.score)[0];
  const withinMargin = best ? candidates.filter(m => (best.score - m.score) * 100 <= WINNER_MARGIN_PP + 1e-9) : [];
  const winner = [...withinMargin].sort((a, b) => a.avgCost - b.avgCost)[0];
  const runnerUp = candidates
    .filter(m => m !== winner)
    .sort((a, b) => b.score - a.score || a.avgCost - b.avgCost)[0];
  // Cheap fallback: the cheapest other candidate that still clears 90% of the winner's score.
  const cheapFallback = candidates
    .filter(m => m !== winner && winner && m.score >= winner.score * 0.9)
    .sort((a, b) => a.avgCost - b.avgCost)[0];
  return { models, baseline, best, winner, runnerUp, cheapFallback, withinMargin };
}

/* ------------------------------------------------------------- render */

const pct = (x: number | null | undefined) => (x === null || x === undefined ? '—' : `${(x * 100).toFixed(1)}%`);
const usd = (x: number, d = 6) => `$${x.toFixed(d)}`;
const int = (x: number) => Math.round(x).toLocaleString('en-US');

export function renderConsole(data: BakeoffData, s: Summary): string {
  const lines: string[] = [];
  lines.push(`\n${data.records.length} story runs · ${data.requestsSent} API requests · reported spend ${usd(data.reportedSpend, 4)} · key usage ${usd(data.keyUsageStart, 4)} → ${data.keyUsageEnd !== undefined ? usd(data.keyUsageEnd, 4) : '?'}${data.stopped ? ` · STOPPED: ${data.stopped}` : ''}`);
  lines.push(`outcome leaks into requests: ${data.outcomeLeaks}`);
  lines.push('');
  lines.push(['model'.padEnd(30), 'score', 'model%', '1st%', 'clean%', 'resid', 'badcast', 'repair', 'fallbk', 'in', 'out', 'rsn', 'ms', 'p95', '$/story', 'EN', 'RU', 'HY'].join('  '));
  for (const m of [...s.models, s.baseline]) {
    lines.push(
      [
        m.model.padEnd(30),
        pct(m.score).padStart(5),
        pct(m.success).padStart(6),
        pct(m.firstPass).padStart(5),
        pct(m.firstPassClean).padStart(6),
        pct(m.semanticResidual).padStart(5),
        pct(m.unsupportedActors).padStart(7),
        pct(m.repairRate).padStart(6),
        pct(m.fallback).padStart(6),
        String(Math.round(m.avgIn)).padStart(4),
        String(Math.round(m.avgOut)).padStart(4),
        String(Math.round(m.avgReasoning)).padStart(3),
        String(Math.round(m.avgLatency)).padStart(5),
        String(Math.round(m.p95Latency)).padStart(5),
        usd(m.avgCost, 6),
        pct(m.byLang.en.score),
        pct(m.byLang.ru.score),
        pct(m.byLang.hy.score),
      ].join('  ')
    );
  }
  if (s.winner) lines.push(`\nWinner (cheapest within ${WINNER_MARGIN_PP} pp of best ${s.best!.model} ${pct(s.best!.score)}): ${s.winner.model} ${pct(s.winner.score)} at ${usd(s.winner.avgCost)}/story`);
  return lines.join('\n');
}

function describeDsl(dslText: string | undefined): { world: string; cast: string; objects: string; events: string; commitments: string; title: string } {
  if (!dslText) return { world: '—', cast: '—', objects: '—', events: '—', commitments: '—', title: '—' };
  const d = JSON.parse(dslText);
  const esc = (t: string) => t.replace(/\|/g, '/').replace(/\n/g, ' ');
  return {
    world: `${d.w}/${d.g}`,
    cast: (d.c ?? []).map((c: unknown[]) => `${c[0]}(${c[1]})`).join(' ') || 'alone',
    objects: (d.o ?? []).join(' '),
    events: (d.e ?? []).map((e: unknown[]) => e[0]).join('→'),
    commitments: esc((d.a ?? []).map((a: unknown[]) => `${a[0]}:${a[1] ?? '∅'} «${a[2]}»`).join('; ')),
    title: esc(d.x?.ti ?? ''),
  };
}

export function renderMarkdown(data: BakeoffData, s: Summary, notesPath = 'reports/openrouter-bakeoff-notes.md'): string {
  const out: string[] = [];
  const all = [...s.models, s.baseline];
  out.push('# Vivi — OpenRouter live model bakeoff');
  out.push('');
  out.push(`Generated by \`npm run eval:models\` on **${data.date.slice(0, 10)}** (${data.date}). Raw per-request results: \`reports/data/openrouter-bakeoff.json\`.`);
  out.push('');
  out.push(`- Stories: **${data.stories}** (${data.storyLangs.en} EN · ${data.storyLangs.ru} RU · ${data.storyLangs.hy} HY), set \`${data.set}\`, **${data.runs}** run(s) per story per model`);
  out.push(`- Story runs: **${data.records.length}** · API requests sent (incl. repairs): **${data.requestsSent}**`);
  out.push(`- Spend, OpenRouter-reported per request: **${usd(data.reportedSpend, 4)}** · key usage before → after: ${usd(data.keyUsageStart, 4)} → ${data.keyUsageEnd !== undefined ? usd(data.keyUsageEnd, 4) : 'n/a'} · hard budget ${usd(data.budgetUsd, 2)}${data.stopped ? ` · **stopped early: ${data.stopped}**` : ''}`);
  out.push(`- Measurement timeout per request: ${data.timeoutMs ? `${data.timeoutMs / 1000} s` : 'production default'} (production default is ${PRODUCTION_TIMEOUT_MS / 1000} s; see the latency table for the share of runs that would exceed it)`);
  out.push(`- Author outcome found in request bodies: **${data.outcomeLeaks}** (every run-0 story carried an outcome canary)`);
  out.push(`- Same system prompt, same strict JSON schema (built from \`vocabulary.ts\`), \`temperature\` 0.2 where every eligible host accepts it, \`max_tokens\` 700, reasoning off where the model allows it (else lowest effort), \`provider.require_parameters: true\`, \`data_collection: deny\`.`);
  out.push('');

  out.push('## Result');
  out.push('');
  if (s.winner && s.best) {
    out.push(`**Policy** (fixed in advance): highest *faithful playable* score wins, unless a cheaper candidate is within **${WINNER_MARGIN_PP} percentage points** — then the cheapest such candidate wins.`);
    out.push('');
    out.push(`- Best score: **${s.best.model}** — ${pct(s.best.score)}`);
    out.push(`- Within ${WINNER_MARGIN_PP} pp: ${s.withinMargin.map(m => `${m.model} (${pct(m.score)}, ${usd(m.avgCost)}/story)`).join(', ')}`);
    out.push(`- **Winner: \`${s.winner.model}\`** — ${pct(s.winner.score)} at ${usd(s.winner.avgCost)}/story → **${usd(s.winner.avgCost * 1000, 3)} per 1,000 stories**, ~${int(1 / Math.max(s.winner.avgCost, 1e-9))} stories per $1, ~${usd(s.winner.avgCost * 100000, 2)} per 100k stories`);
    if (s.runnerUp) out.push(`- Runner-up: \`${s.runnerUp.model}\` — ${pct(s.runnerUp.score)} at ${usd(s.runnerUp.avgCost)}/story`);
    if (s.cheapFallback) out.push(`- Cheapest candidate within 90% of the winner's score: \`${s.cheapFallback.model}\` (${pct(s.cheapFallback.score)}, ${usd(s.cheapFallback.avgCost)}/story)`);
  } else {
    out.push('No candidate produced model output; no winner.');
  }
  out.push('');

  out.push('## Quality');
  out.push('');
  out.push('*Score* = share of ALL story runs that produced a model-authored experience which passes every playability check (`scripts/lib/scenarioChecks.ts`, the same checks as `npm run eval`) and every applicable faithfulness check (`scripts/lib/faithfulness.ts`): world, required objects, required people, no invented on-stage character, a plausible central event, copy in the story language, at most 4 key objects, and real commitment copy (label not a bare symbol; observation and outcome of 3+ words; distinct labels). Fallbacks count as failures. Rates in the faithfulness columns are over model-authored runs only; — means no story in the set carried that expectation.');
  out.push('');
  out.push('| model | score | structural score (no copy check) | score when the provider answered | model-authored | 1st-pass valid | 1st-pass clean | semantic residual | unsupported actors | repair rate | repair success | fallback | provider errors | playable | world | objects | people | no invented character | central event | copy language | ≤4 objects | meaningful commitment copy | valid commitments | truth safe | runs w/ invalid enum |');
  out.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const m of all) {
    out.push(`| ${m.model}${m.reference ? ' *(ref)*' : ''} | **${pct(m.score)}** | ${pct(m.scoreStructural)} | ${pct(m.scoreWhenAnswered)} | ${pct(m.success)} | ${pct(m.firstPass)} | ${pct(m.firstPassClean)} | ${pct(m.semanticResidual)} | ${pct(m.unsupportedActors)} | ${pct(m.repairRate)} | ${m.repairRate ? pct(m.repairSuccess) : '—'} | ${pct(m.fallback)} | ${pct(m.providerErrors)} | ${pct(m.playable)} | ${pct(m.world)} | ${pct(m.objects)} | ${pct(m.people)} | ${pct(m.noInvented)} | ${pct(m.centralEvent)} | ${pct(m.language)} | ${pct(m.focusedObjects)} | ${pct(m.meaningfulCommitments)} | ${pct(m.validCommitments)} | ${pct(m.truthSafe)} | ${pct(m.invalidEnumRuns)} |`);
  }
  out.push('');
  out.push('### By language and set (score)');
  out.push('');
  out.push('| model | EN | RU | HY | corpus | blind |');
  out.push('|---|---|---|---|---|---|');
  for (const m of all) {
    out.push(`| ${m.model} | ${pct(m.byLang.en.score)} (n=${m.byLang.en.runs}) | ${pct(m.byLang.ru.score)} (n=${m.byLang.ru.runs}) | ${pct(m.byLang.hy.score)} (n=${m.byLang.hy.runs}) | ${pct(m.bySet.corpus.score)} | ${pct(m.bySet.blind.score)} |`);
  }
  out.push('');

  out.push('## Tokens, latency, cost (OpenRouter-reported)');
  out.push('');
  out.push('Per story, first pass + repair when one happened. Cost is the `usage.cost` OpenRouter returned for each request — not an estimate.');
  out.push('');
  out.push('| model | avg input tok | avg output tok | avg reasoning tok | avg latency ms | p95 latency ms | answered runs slower than ${PRODUCTION_TIMEOUT_MS / 1000} s | avg DSL bytes | avg $/story (attempted) | avg $/model-authored story | avg $/repair | $ per 1,000 | stories per $1 | $ per 100k | upstreams |');
  out.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const m of s.models) {
    out.push(`| ${m.model} | ${int(m.avgIn)} | ${int(m.avgOut)} | ${int(m.avgReasoning)} | ${int(m.avgLatency)} | ${int(m.p95Latency)} | ${pct(m.overProductionTimeout)} | ${int(m.avgDslBytes)} | ${usd(m.avgCost)} | ${usd(m.avgCostAuthored)} | ${m.repairRate ? usd(m.avgRepairCost) : '—'} | ${usd(m.avgCost * 1000, 3)} | ${m.avgCost ? int(1 / m.avgCost) : '—'} | ${usd(m.avgCost * 100000, 2)} | ${Object.entries(m.upstreams).map(([k, v]) => `${k} ${v}`).join(', ') || '—'} |`);
  }
  out.push('');
  out.push('### Pricing retrieved from the OpenRouter catalogue (USD per 1M tokens)');
  out.push('');
  out.push('| model | endpoint | input | output | strict structured outputs |');
  out.push('|---|---|---|---|---|');
  for (const [model, p] of Object.entries(data.pricing)) {
    for (const e of p.endpoints) out.push(`| ${model} | ${e.provider} | ${e.promptPerM} | ${e.completionPerM} | ${e.structuredOutputs ? 'yes' : 'no'} |`);
    if (!p.endpoints.length) out.push(`| ${model} | (catalogue unavailable) | | | |`);
  }
  out.push('');

  const reasons = s.models.filter(m => Object.keys(m.fallbackReasons).length);
  if (reasons.length) {
    out.push('### Fallback reasons');
    out.push('');
    for (const m of reasons) out.push(`- **${m.model}**: ${Object.entries(m.fallbackReasons).map(([k, v]) => `${k} ×${v}`).join('; ')}`);
    out.push('');
  }

  // Review table: what the top two candidates wrote for each blind story (run 0).
  const reviewModels = [s.winner, s.runnerUp].filter((m): m is ModelSummary => !!m).map(m => m.model);
  const blindIds = [...new Set(data.records.filter(r => r.set === 'blind').map(r => r.id))];
  if (reviewModels.length && blindIds.length) {
    out.push('## Blind set — review table');
    out.push('');
    out.push('Central tension, event order and whether the commitments are meaningful are judgement calls; they are shown here for review rather than scored. Run 0 of each model.');
    out.push('');
    out.push('| story | model | world/grammar | cast | objects | events | commitments | title | auto checks |');
    out.push('|---|---|---|---|---|---|---|---|---|');
    for (const id of blindIds) {
      for (const model of reviewModels) {
        const r = data.records.find(x => x.id === id && x.model === model && x.run === 0);
        if (!r) continue;
        const d = describeDsl(r.dsl);
        const f = r.faith;
        const flags = r.source !== 'model'
          ? `FALLBACK (${r.fallbackReason})`
          : [
              f?.world === false ? 'world✗' : '',
              f?.objects === false ? 'object✗' : '',
              f?.people === false ? 'people✗' : '',
              f?.noInventedCharacter === false ? `invented:${f.inventedRoles.join(',')}` : '',
              f?.centralEvent === false ? 'event✗' : '',
              f?.language === false ? 'lang✗' : '',
              f?.focusedObjects === false ? 'objects>4' : '',
              f?.meaningfulCommitments === false ? 'copy✗' : '',
              r.playableFailures.length ? `play✗ ${r.playableFailures[0]}` : '',
            ].filter(Boolean).join(' ') || '✓';
        out.push(`| ${id} | ${model} | ${d.world} | ${d.cast} | ${d.objects} | ${d.events} | ${d.commitments} | ${d.title} | ${flags} |`);
      }
    }
    out.push('');
  }

  if (existsSync(notesPath)) {
    out.push(readFileSync(notesPath, 'utf8').trim());
    out.push('');
  }
  return out.join('\n');
}
