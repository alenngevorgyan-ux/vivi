/**
 * Token / size benchmark for the Experience Compiler.
 *
 *   node --import tsx scripts/benchmark-experience-compiler.ts [--live] [--md]
 *
 * For every corpus story and golden fixture it reports story size, DSL size,
 * an ESTIMATED output token count, compiled scenario size and compile time.
 *
 * Token figures are estimates (see scripts/lib/tokens.ts) unless `--live` is
 * passed with GEMINI_API_KEY set, in which case each story is also sent to the
 * real model and the provider's reported usage is printed in its own columns.
 * The two are never mixed.
 */
import 'dotenv/config';
import { EVAL_CORPUS } from '../src/data/evalCorpus.ts';
import { HERO_DSL } from '../src/data/heroStories/dslFixtures.ts';
import { compileViviStory } from '../src/engine/compiler/compileViviStory.ts';
import { compileExperience } from '../src/engine/compiler/ExperienceCompiler.ts';
import { serializeDSL, validateDSL } from '../src/engine/compiler/dsl.ts';
import { MODEL_SYSTEM_PROMPT, modelUserPrompt } from '../src/engine/compiler/modelContract.ts';
import { preprocessStory } from '../src/engine/compiler/preprocess.ts';
import { estimateTokens } from './lib/tokens.ts';

const live = process.argv.includes('--live');
const markdown = process.argv.includes('--md');
const bytes = (s: string) => Buffer.byteLength(s, 'utf8');

interface Row {
  id: string;
  storyChars: number;
  dslChars: number;
  dslBytes: number;
  estOut: number;
  estIn: number;
  scenarioBytes: number;
  compileMs: number;
  liveOut?: number;
  liveIn?: number;
  liveSource?: string;
}

async function timeCompile(run: () => unknown, reps = 20): Promise<number> {
  run(); // warm caches (paths, grids)
  const t0 = performance.now();
  for (let i = 0; i < reps; i++) run();
  return (performance.now() - t0) / reps;
}

const provider = live && process.env.GEMINI_API_KEY
  ? (await import('../src/server/geminiProvider.ts')).createGeminiProvider(process.env.GEMINI_API_KEY)
  : null;
if (live && !provider) console.warn('--live requested but GEMINI_API_KEY is not set: reporting estimates only.\n');

const rows: Row[] = [];
const systemTokens = estimateTokens(MODEL_SYSTEM_PROMPT);

for (const item of EVAL_CORPUS) {
  const result = await compileViviStory({ story: item.story, actualOutcome: item.outcome });
  const dslText = serializeDSL(result.compiled.dsl);
  const hints = preprocessStory(item.story);
  const ms = await timeCompile(() => compileExperience(result.compiled.dsl, { source: 'deterministic', story: item.story, createdAt: 0 }));
  const row: Row = {
    id: item.id,
    storyChars: item.story.length,
    dslChars: dslText.length,
    dslBytes: bytes(dslText),
    estOut: estimateTokens(dslText),
    estIn: systemTokens + estimateTokens(modelUserPrompt(item.story, hints)),
    scenarioBytes: bytes(JSON.stringify(result.post.scenario)),
    compileMs: ms,
  };
  if (provider) {
    const modelRun = await compileViviStory({ story: item.story }, { provider });
    row.liveOut = modelRun.report.usage?.outputTokens;
    row.liveIn = modelRun.report.usage?.inputTokens;
    row.liveSource = modelRun.report.source + (modelRun.report.repaired ? '+repair' : '');
  }
  rows.push(row);
}

for (const [id, fixture] of Object.entries(HERO_DSL)) {
  const v = validateDSL(fixture.dsl);
  if (!v.ok) throw new Error(`${id} invalid`);
  const dslText = serializeDSL(fixture.dsl);
  const compiled = compileExperience(v.dsl, { source: 'hero_fixture', createdAt: 0 });
  rows.push({
    id: `golden:${id}`,
    storyChars: 0,
    dslChars: dslText.length,
    dslBytes: bytes(dslText),
    estOut: estimateTokens(dslText),
    estIn: 0,
    scenarioBytes: bytes(JSON.stringify(compiled.scenario)),
    compileMs: await timeCompile(() => compileExperience(v.dsl, { source: 'hero_fixture', createdAt: 0 })),
  });
}

const corpusRows = rows.filter(r => !r.id.startsWith('golden:'));
const avg = (f: (r: Row) => number, list = corpusRows) => list.reduce((s, r) => s + f(r), 0) / list.length;
const max = (f: (r: Row) => number, list = corpusRows) => Math.max(...list.map(f));

const header = ['id', 'story chars', 'DSL chars', 'DSL bytes', 'est. out tok', 'est. in tok', 'scenario bytes', 'compile ms', ...(provider ? ['ACTUAL out tok', 'ACTUAL in tok', 'source'] : [])];
const cells = (r: Row) => [
  r.id, r.storyChars || '—', r.dslChars, r.dslBytes, r.estOut, r.estIn || '—', r.scenarioBytes, r.compileMs.toFixed(2),
  ...(provider ? [r.liveOut ?? '—', r.liveIn ?? '—', r.liveSource ?? '—'] : []),
].map(String);

if (markdown) {
  console.log(`| ${header.join(' | ')} |`);
  console.log(`|${header.map(() => '---').join('|')}|`);
  for (const r of rows) console.log(`| ${cells(r).join(' | ')} |`);
} else {
  console.log(header.map((h, i) => (i === 0 ? h.padEnd(24) : h.padStart(14))).join(''));
  for (const r of rows) console.log(cells(r).map((c, i) => (i === 0 ? c.padEnd(24) : c.padStart(14))).join(''));
}

console.log(`
Corpus (${corpusRows.length} stories, deterministic semantics):
  DSL bytes            avg ${avg(r => r.dslBytes).toFixed(0)}   max ${max(r => r.dslBytes)}
  est. output tokens   avg ${avg(r => r.estOut).toFixed(0)}   max ${max(r => r.estOut)}   (ESTIMATE — no model was called)
  est. input tokens    avg ${avg(r => r.estIn).toFixed(0)}   (system prompt ≈ ${systemTokens}, ESTIMATE)
  scenario bytes       avg ${avg(r => r.scenarioBytes).toFixed(0)}   (what the compiler produced from that DSL)
  expansion ratio      ${(avg(r => r.scenarioBytes) / avg(r => r.dslBytes)).toFixed(1)}× bytes out per DSL byte in
  compile time         avg ${avg(r => r.compileMs).toFixed(2)} ms   max ${max(r => r.compileMs).toFixed(2)} ms
Golden fixtures (curated long copy): est. output tokens ${rows.filter(r => r.id.startsWith('golden:')).map(r => `${r.id.slice(7)} ${r.estOut}`).join(', ')}
${provider ? `Live model usage (ACTUAL, provider-reported): avg out ${avg(r => r.liveOut ?? 0).toFixed(0)} tokens` : 'Live model usage: not measured (run with --live and GEMINI_API_KEY).'}`);
