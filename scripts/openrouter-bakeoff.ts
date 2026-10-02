/**
 * Live OpenRouter model bakeoff for the Vivi semantic compiler.
 *
 *   npm run eval:models                     full matrix from config/openrouter-models.json, 2 runs, writes the report
 *   npm run eval:openrouter                 the configured OPENROUTER_MODEL over corpus + blind set, quality summary
 *   npm run bench:openrouter                the configured OPENROUTER_MODEL over the corpus, tokens / cost / latency
 *
 * Flags: --models a,b  --configured  --with-reference  --set corpus|blind|holdout|all  --runs N
 *        --budget USD  --concurrency N  --limit N  --ids a,b  --out file.json  --report file.md
 *
 * Every story goes through the real pipeline (compileViviStory → validator →
 * one repair at most → deterministic fallback → ExperienceCompiler) with the
 * same prompt and schema for every model. Usage and cost are OpenRouter's own
 * numbers. A hard budget is enforced against the key's authoritative usage.
 * The API key is read from the environment and never printed.
 */
import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { EVAL_CORPUS } from '../src/data/evalCorpus.ts';
import { BLIND_CORPUS } from '../src/data/blindCorpus.ts';
import { HOLDOUT_CORPUS } from '../src/data/holdoutCorpus.ts';
import { compileViviStory } from '../src/engine/compiler/compileViviStory.ts';
import { preprocessStory } from '../src/engine/compiler/preprocess.ts';
import { serializeDSL } from '../src/engine/compiler/dsl.ts';
import { createOpenRouterProvider, fetchModelCapabilities, type ReasoningMode } from '../src/server/openRouterProvider.ts';
import { checkScenario } from './lib/scenarioChecks.ts';
import { unsupportedRoles } from '../src/engine/compiler/semanticReview.ts';
import { scoreFaithfulness, type FaithfulnessExpect, type Lang } from './lib/faithfulness.ts';
import { readKeyUsage } from './lib/openrouterAccount.ts';
import { summarise, renderConsole, renderMarkdown, type BakeoffRecord, type BakeoffData } from './lib/bakeoffSummary.ts';

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const opt = (name: string, fallback?: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};

interface MatrixEntry { model: string; reasoning?: ReasoningMode; note?: string }
const matrix = JSON.parse(readFileSync('config/openrouter-models.json', 'utf8')) as {
  candidates: MatrixEntry[];
  reference?: MatrixEntry[];
  budgetUsd?: number;
  timeoutMs?: number;
};

const apiKey = process.env.OPENROUTER_API_KEY?.trim();
if (!apiKey) {
  console.error('OPENROUTER_API_KEY is not set (server-side .env). Nothing was sent.');
  process.exit(2);
}

let entries: MatrixEntry[];
if (opt('models')) entries = opt('models')!.split(',').map(model => ({ model: model.trim() }));
else if (flag('configured')) entries = [{ model: process.env.OPENROUTER_MODEL?.trim() || 'qwen/qwen3.8-flash' }];
else entries = [...matrix.candidates, ...(flag('with-reference') ? matrix.reference ?? [] : [])];
const referenceModels = new Set((matrix.reference ?? []).map(r => r.model));

const set = opt('set', 'all') as 'corpus' | 'blind' | 'holdout' | 'all';
const runs = Number(opt('runs', '1'));
const budget = Number(opt('budget', String(matrix.budgetUsd ?? 0.5)));
const concurrency = Number(opt('concurrency', '6'));
const limit = opt('limit') ? Number(opt('limit')) : Infinity;
/** Re-measure named stories only — used to check a fix against the runs that failed. */
const onlyIds = opt('ids') ? new Set(opt('ids')!.split(',').map(x => x.trim())) : null;
const outPath = opt('out', 'reports/data/openrouter-bakeoff.json')!;
const reportPath = opt('report');
// Measurement timeout: long enough to see each model's real latency distribution.
// Production uses OPENROUTER_TIMEOUT_MS (default 20 s); the report shows what share exceeds it.
const timeoutMs = Number(opt('timeout-ms', String(matrix.timeoutMs ?? 60000)));

/* ------------------------------------------------------------- stories */

interface Item { id: string; set: 'corpus' | 'blind'; lang: Lang; category: string; story: string; outcome?: string; expect: FaithfulnessExpect }
const asLang = (l: string): Lang => (l === 'ru' || l === 'hy' ? l : 'en');
// The holdout is scored on its own, never mixed into a development run.
const items: Item[] = (
  set === 'holdout'
    ? HOLDOUT_CORPUS.map(h => ({ id: h.id, set: 'blind' as const, lang: h.lang, category: h.category, story: h.story, outcome: h.outcome, expect: h.expect }))
    : [
        ...(set !== 'blind'
          ? EVAL_CORPUS.map(e => ({ id: e.id, set: 'corpus' as const, lang: asLang(preprocessStory(e.story).lang), category: e.category, story: e.story, outcome: e.outcome, expect: e.expect ?? {} }))
          : []),
        ...(set !== 'corpus' ? BLIND_CORPUS.map(b => ({ id: b.id, set: 'blind' as const, lang: b.lang, category: b.category, story: b.story, outcome: b.outcome, expect: b.expect })) : []),
      ]
)
  .filter(item => !onlyIds || onlyIds.has(item.id))
  .slice(0, limit);

/* ------------------------------------------------- truth-safety canary */

// Every request body is scanned for the author's outcome text. Nothing is stored.
const outcomeTexts = new Set<string>();
let requestsSent = 0;
let outcomeLeaks = 0;
const guardedFetch: typeof fetch = async (url, init) => {
  if (String(url).includes('/chat/completions')) {
    requestsSent++;
    const body = typeof init?.body === 'string' ? init.body : '';
    for (const text of outcomeTexts) if (body.includes(text)) outcomeLeaks++;
    if (body.includes('CANARY-')) outcomeLeaks++;
  }
  return fetch(url, init);
};

/* ------------------------------------------------------------ pricing */

async function endpointPricing(model: string) {
  try {
    const res = await fetch(`https://openrouter.ai/api/v1/models/${model}/endpoints`, { signal: AbortSignal.timeout(8000) });
    const json = (await res.json()) as { data?: { endpoints?: Array<{ provider_name: string; pricing: { prompt: string; completion: string }; supported_parameters: string[] }> } };
    return (json.data?.endpoints ?? []).map(e => ({
      provider: e.provider_name,
      promptPerM: +(Number(e.pricing.prompt) * 1e6).toFixed(4),
      completionPerM: +(Number(e.pricing.completion) * 1e6).toFixed(4),
      structuredOutputs: e.supported_parameters.includes('structured_outputs'),
    }));
  } catch {
    return [];
  }
}

/* --------------------------------------------------------------- run */

const keyStart = await readKeyUsage(apiKey);
if (!keyStart) {
  console.error('Could not read key usage from OpenRouter; refusing to run without a spend guard.');
  process.exit(2);
}
if (keyStart.usage >= budget) {
  console.error(`Key usage $${keyStart.usage.toFixed(4)} already at or above the $${budget} test budget. Nothing was sent.`);
  process.exit(3);
}
console.log(`Bakeoff: ${entries.map(e => e.model).join(', ')} | ${items.length} stories × ${runs} run(s) | budget $${budget} (key usage so far $${keyStart.usage.toFixed(4)})`);

const providers = new Map(
  entries.map(e => [e.model, createOpenRouterProvider({ apiKey, model: e.model, reasoning: e.reasoning ?? 'off', fetch: guardedFetch, timeoutMs })])
);
const pricing: BakeoffData['pricing'] = {};
for (const e of entries) {
  pricing[e.model] = {
    endpoints: await endpointPricing(e.model),
    selected: await fetchModelCapabilities(e.model).then(c => c.pricing && { promptPerM: c.pricing.prompt * 1e6, completionPerM: c.pricing.completion * 1e6 }).catch(() => undefined),
  };
}

const tasks: Array<{ model: string; item: Item; run: number }> = [];
for (let run = 0; run < runs; run++) for (const item of items) for (const e of entries) tasks.push({ model: e.model, item, run });

const records: BakeoffRecord[] = [];
let spent = 0;
let keyNow = keyStart.usage;
let stopped: string | undefined;
const RESERVE = 0.004; // worst plausible single story incl. repair

async function runTask(task: (typeof tasks)[number]) {
  const { model, item, run } = task;
  const outcome = run % 2 === 0 ? item.outcome ?? `CANARY-${item.id}: in the end I said nothing and walked away.` : undefined;
  if (outcome) outcomeTexts.add(outcome);
  const started = Date.now();
  const result = await compileViviStory({ story: item.story, actualOutcome: outcome }, { provider: providers.get(model)! });
  const wallMs = Date.now() - started;
  const r = result.report;
  const failures = checkScenario(item.id, result.compiled.dsl, result.post.scenario, { outcome: outcome ?? '' });
  spent += r.usage?.costUsd ?? 0;
  const firstLatency = (r.usage?.latencyMs ?? 0) - (r.repairUsage?.latencyMs ?? 0);
  records.push({
    model,
    reference: referenceModels.has(model),
    id: item.id,
    set: item.set,
    lang: item.lang,
    category: item.category,
    run,
    source: r.source,
    upstream: r.upstream,
    servedModel: r.model,
    firstPassValid: r.firstPassValid ?? false,
    firstPassErrors: r.firstPassErrors,
    firstPassClean: r.firstPassClean ?? r.firstPassValid ?? false,
    semanticErrors: r.semanticErrors,
    unsupportedRoles: unsupportedRoles(result.compiled.dsl, result.hints),
    repaired: r.repaired,
    fallbackReason: r.fallbackReason,
    usage: r.usage,
    repairUsage: r.repairUsage,
    firstLatencyMs: r.usage?.latencyMs !== undefined ? firstLatency : undefined,
    wallMs,
    dslBytes: r.dslBytes,
    dsl: r.source === 'model' ? serializeDSL(result.compiled.dsl) : undefined,
    playableFailures: failures,
    truthSafe: !failures.some(f => /truth|outcome/.test(f)),
    faith: r.source === 'model' ? scoreFaithfulness(result.compiled.dsl, item.lang, item.expect) : undefined,
  });
  const done = records.length;
  if (done % 20 === 0) {
    const k = await readKeyUsage(apiKey!);
    if (k) keyNow = k.usage;
    console.log(`  ${done}/${tasks.length} · reported spend this run $${spent.toFixed(4)} · key usage $${keyNow.toFixed(4)}`);
  }
}

const queue = [...tasks];
await Promise.all(
  Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (queue.length) {
      const committed = Math.max(keyNow, keyStart.usage + spent);
      if (committed + RESERVE * concurrency > budget) {
        stopped = `budget guard: committed $${committed.toFixed(4)} of $${budget}`;
        queue.length = 0;
        break;
      }
      const task = queue.shift()!;
      try {
        await runTask(task);
      } catch (err) {
        console.error(`  ${task.model} ${task.item.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  })
);

// Deterministic baseline: the same stories with no model at all (free).
const baseline: BakeoffRecord[] = [];
for (const item of items) {
  const outcome = item.outcome ?? `CANARY-${item.id}: in the end I said nothing and walked away.`;
  const result = await compileViviStory({ story: item.story, actualOutcome: outcome });
  const failures = checkScenario(item.id, result.compiled.dsl, result.post.scenario, { outcome });
  baseline.push({
    model: 'deterministic', reference: true, id: item.id, set: item.set, lang: item.lang, category: item.category, run: 0,
    source: 'deterministic', firstPassValid: false, repaired: false, dslBytes: result.report.dslBytes, playableFailures: failures,
    unsupportedRoles: unsupportedRoles(result.compiled.dsl, result.hints),
    truthSafe: !failures.some(f => /truth|outcome/.test(f)), faith: scoreFaithfulness(result.compiled.dsl, item.lang, item.expect),
    dsl: serializeDSL(result.compiled.dsl), wallMs: 0,
  });
}

const keyEnd = await readKeyUsage(apiKey);
const data: BakeoffData = {
  date: new Date().toISOString(),
  set,
  runs,
  budgetUsd: budget,
  timeoutMs,
  stopped,
  models: entries.map(e => e.model),
  stories: items.length,
  storyLangs: { en: items.filter(i => i.lang === 'en').length, ru: items.filter(i => i.lang === 'ru').length, hy: items.filter(i => i.lang === 'hy').length },
  keyUsageStart: keyStart.usage,
  keyUsageEnd: keyEnd?.usage,
  reportedSpend: spent,
  requestsSent,
  outcomeLeaks,
  pricing,
  records,
  baseline,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(data, null, 1));
const summary = summarise(data);
console.log(renderConsole(data, summary));
if (reportPath) {
  writeFileSync(reportPath, renderMarkdown(data, summary));
  console.log(`\nReport written to ${reportPath}`);
}
console.log(`Raw results: ${outPath}`);
if (outcomeLeaks) {
  console.error(`TRUTH LEAK: the author's outcome appeared in ${outcomeLeaks} request bodies.`);
  process.exit(1);
}
