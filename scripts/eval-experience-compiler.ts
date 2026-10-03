/**
 * Experience Compiler evaluation harness.
 *
 *   node --import tsx scripts/eval-experience-compiler.ts [--json]
 *
 * Runs every corpus story through the full pipeline (deterministic semantics:
 * no model is called) plus the golden hero fixtures, and checks the compiled
 * result against what a playable Vivi post must satisfy. Exits non-zero on any
 * failed check.
 */
import { EVAL_CORPUS } from '../src/data/evalCorpus.ts';
import { heroStories } from '../src/data/heroStories/index.ts';
import { compileViviStory } from '../src/engine/compiler/compileViviStory.ts';
import { compileHeroStoryToRuntime } from '../src/engine/runtime/RuntimeCompiler.ts';
import { serializeDSL } from '../src/engine/compiler/dsl.ts';
import { checkScenario } from './lib/scenarioChecks.ts';
import { estimateTokens } from './lib/tokens.ts';

interface Row {
  id: string;
  world: string;
  grammar: string;
  source: string;
  commitments: number;
  actors: number;
  events: number;
  dslBytes: number;
  estTokens: number;
  failures: string[];
}


const rows: Row[] = [];

for (const item of EVAL_CORPUS) {
  const result = await compileViviStory({ story: item.story, actualOutcome: item.outcome });
  const failures = checkScenario(item.id, result.compiled.dsl, result.post.scenario, {
    outcome: item.outcome ?? '',
    story: item.story,
    expectWorlds: item.expect?.worlds,
    expectObjects: item.expect?.objects,
  });

  // Truth must behave the same whichever way the author answers question two.
  const flipped = item.outcome ? undefined : 'I waited, and in the end I told the truth.';
  const second = await compileViviStory({ story: item.story, actualOutcome: flipped });
  failures.push(
    ...checkScenario(item.id, second.compiled.dsl, second.post.scenario, { outcome: flipped ?? '', story: item.story }).filter(
      f => f.includes('truth') || f.includes('outcome')
    )
  );

  rows.push({
    id: item.id,
    world: result.compiled.dsl.w,
    grammar: result.compiled.dsl.g,
    source: result.report.source,
    commitments: result.post.scenario.actions.length,
    actors: result.post.scenario.actors?.length ?? 0,
    events: result.compiled.dsl.e.length,
    dslBytes: result.report.dslBytes,
    estTokens: estimateTokens(serializeDSL(result.compiled.dsl)),
    failures,
  });
}

for (const story of heroStories.filter(s => s.dsl)) {
  const scenario = compileHeroStoryToRuntime(story);
  const dsl = { ...story.dsl!.dsl, tr: 'fictional_demo' as const };
  const fails = checkScenario(story.id, dsl, scenario, { truthMustBe: 'fictional_demo' });
  rows.push({
    id: `golden:${story.id}`,
    world: dsl.w,
    grammar: dsl.g,
    source: 'hero_fixture',
    commitments: scenario.actions.length,
    actors: scenario.actors?.length ?? 0,
    events: dsl.e.length,
    dslBytes: new TextEncoder().encode(serializeDSL(story.dsl!.dsl)).length,
    estTokens: estimateTokens(serializeDSL(story.dsl!.dsl)),
    failures: fails,
  });
}

const failed = rows.filter(r => r.failures.length);
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  console.log('id'.padEnd(26), 'world'.padEnd(8), 'grammar'.padEnd(11), 'src'.padEnd(13), 'a', 'cast', 'ev', 'bytes', '~tok', 'result');
  for (const r of rows) {
    console.log(
      r.id.padEnd(26),
      r.world.padEnd(8),
      r.grammar.padEnd(11),
      r.source.padEnd(13),
      String(r.commitments),
      String(r.actors).padStart(4),
      String(r.events).padStart(2),
      String(r.dslBytes).padStart(5),
      String(r.estTokens).padStart(4),
      r.failures.length ? `FAIL ${r.failures.join(' | ')}` : 'ok'
    );
  }
  console.log(`\n${rows.length - failed.length}/${rows.length} experiences pass every check.`);
}
if (failed.length) process.exit(1);
