/**
 * Replay a stored live run through the current compiler — offline and free.
 *
 *   node --import tsx scripts/replay-bakeoff.ts reports/data/openrouter-bakeoff.json [--model openai/gpt-5.4-nano]
 *
 * Every record of a live bakeoff keeps the exact DSL the model produced. Those
 * programs are a fixed corpus of real model output, so recompiling them with
 * today's compiler isolates what the deterministic half changed: staging,
 * standing spots, routes, timing and camera. It also reports how many of those
 * same programs the semantic review would now send back for one repair turn,
 * which is the share a live run has to improve on.
 *
 * No network, no key, no spend.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { EVAL_CORPUS } from '../src/data/evalCorpus.ts';
import { BLIND_CORPUS } from '../src/data/blindCorpus.ts';
import { HOLDOUT_CORPUS } from '../src/data/holdoutCorpus.ts';
import { validateDSL, type ViviExperienceDSL } from '../src/engine/compiler/dsl.ts';
import { compileExperience } from '../src/engine/compiler/ExperienceCompiler.ts';
import { preprocessStory } from '../src/engine/compiler/preprocess.ts';
import { reviewDsl } from '../src/engine/compiler/semanticReview.ts';
import { commitmentVariety } from '../src/engine/compiler/commitmentClasses.ts';
import { groundCast } from '../src/engine/compiler/castGrounding.ts';
import { checkScenario, legacyCommitmentKinds } from './lib/scenarioChecks.ts';
import { scoreFaithfulness, type FaithfulnessExpect, type Lang } from './lib/faithfulness.ts';
import type { BakeoffData, BakeoffRecord } from './lib/bakeoffSummary.ts';

const argv = process.argv.slice(2);
const dataPath = argv.find(a => !a.startsWith('--')) ?? 'reports/data/openrouter-bakeoff.json';
const opt = (name: string, fallback?: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const onlyModel = opt('model');
const outPath = opt('out');

const data = JSON.parse(readFileSync(dataPath, 'utf8')) as BakeoffData;

interface Story { story: string; outcome?: string; lang: Lang; expect: FaithfulnessExpect }
const stories = new Map<string, Story>();
for (const e of EVAL_CORPUS) {
  stories.set(e.id, {
    story: e.story,
    outcome: e.outcome,
    lang: preprocessStory(e.story).lang as Lang,
    expect: e.expect ?? {},
  });
}
for (const b of [...BLIND_CORPUS, ...HOLDOUT_CORPUS]) {
  stories.set(b.id, { story: b.story, outcome: b.outcome, lang: b.lang, expect: b.expect });
}

/** The same faithfulness gate the bakeoff uses, so numbers stay comparable. */
function faithful(failures: string[], faith: ReturnType<typeof scoreFaithfulness>, truthSafe: boolean): boolean {
  if (failures.length || !truthSafe) return false;
  return [
    faith.world, faith.objects, faith.people, faith.noInventedCharacter, faith.centralEvent,
    faith.language, faith.focusedObjects, faith.meaningfulCommitments,
  ].every(v => v !== false);
}

interface Replayed {
  id: string;
  model: string;
  run: number;
  lang: Lang;
  before: { failures: string[]; faithful: boolean };
  after: { failures: string[]; faithful: boolean };
  /** Today's compiler scored the way the live run was scored, for a like-for-like number. */
  afterLegacy: { failures: string[]; faithful: boolean };
  /** The review would have asked the model to fix this before compiling. */
  reviewErrors: string[];
  reviewNotes: string[];
  oneKind: boolean;
  oneSpot: boolean;
  unsupportedOnStage: string[];
}

const replayed: Replayed[] = [];
const skipped: string[] = [];

for (const record of [...data.records, ...data.baseline] as BakeoffRecord[]) {
  if (!record.dsl) continue;
  if (onlyModel && record.model !== onlyModel) continue;
  const story = stories.get(record.id);
  if (!story) {
    skipped.push(record.id);
    continue;
  }
  // Run 0 of the live bakeoff carried an outcome (real or canary); run 1 did not.
  const outcome = record.run % 2 === 0 ? story.outcome ?? `CANARY-${record.id}: in the end I said nothing and walked away.` : undefined;
  const parsed = validateDSL(JSON.parse(record.dsl), { mode: 'stored' });
  if (!parsed.ok) {
    skipped.push(`${record.id} (stored DSL no longer validates: ${parsed.errors[0]})`);
    continue;
  }
  const stored: ViviExperienceDSL = parsed.dsl;
  const hints = preprocessStory(story.story, { actualOutcome: outcome });

  const compileWith = (dsl: ViviExperienceDSL) => {
    const compiled = compileExperience(dsl, {
      story: story.story,
      actualOutcome: outcome,
      source: record.source === 'model' ? 'model' : 'deterministic',
      lang: hints.lang,
    });
    const failures = checkScenario(record.id, compiled.dsl, compiled.post.scenario, { outcome: outcome ?? '' });
    const faith = scoreFaithfulness(compiled.dsl, story.lang, story.expect);
    const truthSafe = !failures.some(f => /truth|outcome/.test(f));
    // The same compiled scene judged by the older, cruder variety measure.
    const legacy = [
      ...failures.filter(f => !/reads as a menu/.test(f)),
      ...(legacyCommitmentKinds(compiled.dsl) < 2 ? ['every commitment targets the same kind of thing — scene reads as a menu'] : []),
    ];
    return {
      failures,
      faithful: faithful(failures, faith, truthSafe),
      legacy: { failures: legacy, faithful: faithful(legacy, faith, truthSafe) },
    };
  };

  // Stored DSL is a post-repair final, so the replay reviews it the way the
  // pipeline reviews a reply the repair turn has already seen.
  const review = reviewDsl(stored, hints, { enforce: true });
  const reported = reviewDsl(stored, hints);
  const variety = commitmentVariety(review.dsl);
  const unsupportedOnStage = groundCast(review.dsl, hints)
    .filter(g => g.support === 'UNSUPPORTED' && g.presence !== 'bg')
    .map(g => g.role);

  const afterAll = compileWith(review.dsl);
  replayed.push({
    id: record.id,
    model: record.model,
    run: record.run,
    lang: record.lang,
    // `before` is the stored program compiled as written; `after` is the same
    // program after deterministic review, which is what today's pipeline keeps
    // when the model's single repair turn does not improve it.
    before: { failures: record.playableFailures, faithful: faithful(record.playableFailures, record.faith!, record.truthSafe) },
    after: { failures: afterAll.failures, faithful: afterAll.faithful },
    afterLegacy: afterAll.legacy,
    reviewErrors: reported.errors,
    reviewNotes: review.notes,
    oneKind: variety.oneKind,
    oneSpot: variety.oneSpot,
    unsupportedOnStage,
  });
}

/* ------------------------------------------------------------- report */

const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : '—');
const byModel = new Map<string, Replayed[]>();
for (const r of replayed) byModel.set(r.model, [...(byModel.get(r.model) ?? []), r]);

console.log(`\nReplay of ${dataPath} (${data.date.slice(0, 10)}) through today's compiler — no model called.\n`);
if (skipped.length) console.log(`skipped ${skipped.length} record(s): ${[...new Set(skipped)].slice(0, 5).join(', ')}\n`);

console.log(
  ['model'.padEnd(26), 'runs', 'faithful before', 'after (same rubric)', 'after (new rubric)', 'review would repair', 'one-kind', 'one-spot', 'unsupported on stage'].join(' | ')
);
for (const [model, rs] of byModel) {
  const n = rs.length;
  console.log(
    [
      model.padEnd(26),
      String(n).padStart(4),
      pct(rs.filter(r => r.before.faithful).length, n).padStart(15),
      pct(rs.filter(r => r.afterLegacy.faithful).length, n).padStart(19),
      pct(rs.filter(r => r.after.faithful).length, n).padStart(18),
      pct(rs.filter(r => r.reviewErrors.length).length, n).padStart(19),
      pct(rs.filter(r => r.oneKind).length, n).padStart(8),
      pct(rs.filter(r => r.oneSpot).length, n).padStart(8),
      pct(rs.filter(r => r.unsupportedOnStage.length).length, n).padStart(20),
    ].join(' | ')
  );
}

const all = replayed;
const tally = (xs: string[]) => {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
};
const generalise = (f: string) => f.replace(/\b[a-z_]+_\d+\b/gi, '#').replace(/\b(actions?|route for|actor|camera event) \S+/gi, '$1 #');

console.log('\nPlayability failures that the compiler alone still produces (after):');
for (const [f, n] of tally(all.flatMap(r => r.after.failures.map(generalise))).slice(0, 12)) {
  console.log(`  ${String(n).padStart(4)}  ${f}`);
}
console.log('\nFixed by the compiler alone (present before, gone after):');
const fixed = all.flatMap(r => r.before.failures.map(generalise).filter(f => !r.after.failures.map(generalise).includes(f)));
for (const [f, n] of tally(fixed).slice(0, 12)) console.log(`  ${String(n).padStart(4)}  ${f}`);

console.log('\nWhat the review would send back for one repair turn:');
for (const [f, n] of tally(all.flatMap(r => r.reviewErrors.map(e => e.slice(0, 80)))).slice(0, 8)) {
  console.log(`  ${String(n).padStart(4)}  ${f}`);
}
console.log('\nWhat the review fixed with no model turn:');
for (const [f, n] of tally(all.flatMap(r => r.reviewNotes.map(e => e.split('—')[0].trim().slice(0, 60)))).slice(0, 8)) {
  console.log(`  ${String(n).padStart(4)}  ${f}`);
}

if (outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify({ source: dataPath, date: new Date().toISOString(), replayed }, null, 1));
  console.log(`\nRaw replay: ${outPath}`);
}
