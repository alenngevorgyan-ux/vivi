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
import { compileHeroStoryToRuntime, type CanonicalScenario } from '../src/engine/runtime/RuntimeCompiler.ts';
import { validateDSL, serializeDSL, type ViviExperienceDSL } from '../src/engine/compiler/dsl.ts';
import { worldTemplates } from '../src/world/templates/index.ts';
import { WORLD_COLLISIONS } from '../src/engine/runtime/collision.ts';
import { findPath, pathCollides, isWalkable } from '../src/engine/runtime/navigation.ts';
import { scenarioCast } from '../src/engine/runtime/scenarioActors.ts';
import { CAMERA_GRAMMARS, directShot } from '../src/engine/cinematic/director.ts';
import { viviCameraLanguage } from '../src/engine/cinematic/cameraLanguage.ts';
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

function checkScenario(
  id: string,
  dsl: ViviExperienceDSL,
  scenario: CanonicalScenario,
  opts: { outcome?: string; expectWorlds?: string[]; expectObjects?: string[]; truthMustBe?: string }
): string[] {
  const fail: string[] = [];
  const template = worldTemplates[scenario.world];
  const slotIds = new Set(template.slots.map(s => s.id));
  const cast = scenarioCast(scenario);
  const actorIds = new Set(cast.actors.map(a => a.id));
  const bounds = WORLD_COLLISIONS[scenario.world].bounds;

  // DSL: valid, coordinate-free, versioned
  const revalidated = validateDSL(JSON.parse(serializeDSL(dsl)), { mode: 'stored' });
  if (!revalidated.ok) fail.push(`stored DSL invalid: ${revalidated.errors.join('; ')}`);
  if (/"(x|y|left|top|zoom|atMs)"\s*:\s*-?\d/.test(serializeDSL(dsl))) fail.push('DSL carries a raw coordinate or timing');
  if (scenario.provenance?.dslVersion !== 1) fail.push('scenario missing DSL version provenance');
  if (!scenario.provenance?.compilerVersion) fail.push('scenario missing compiler version');

  // world
  if (opts.expectWorlds && !opts.expectWorlds.includes(dsl.w)) fail.push(`world ${dsl.w} not in expected ${opts.expectWorlds.join('/')}`);
  for (const obj of opts.expectObjects ?? []) if (!dsl.o.includes(obj as never)) fail.push(`missing expected object ${obj}`);

  // commitments
  if (scenario.actions.length < 2 || scenario.actions.length > 4) fail.push(`${scenario.actions.length} commitments (need 2–4)`);
  const kinds = new Set(dsl.a.map(a => (a[1] === null ? 'none' : dsl.o.includes(a[1] as never) ? 'object' : dsl.c.some(c => c[0] === a[1]) ? 'person' : 'place')));
  if (kinds.size < 2) fail.push('every commitment targets the same kind of thing — scene reads as a menu');

  // truth
  const truth = scenario.authorTruth;
  if (opts.truthMustBe && truth.status !== opts.truthMustBe) fail.push(`truth ${truth.status}, expected ${opts.truthMustBe}`);
  if (opts.outcome !== undefined) {
    if (opts.outcome.trim().length > 5) {
      if (truth.status !== 'author_supplied' || truth.text !== opts.outcome.trim()) fail.push('author outcome not preserved exactly');
    } else if (truth.status !== 'withheld' || truth.text || scenario.reality) fail.push('truth fabricated where none was supplied');
  }

  // actions: slots, actors, standing spots
  const stands: Array<[number, number, string]> = [];
  for (const act of scenario.actions) {
    if (act.slotInfo.carried) continue;
    if (act.actorId) {
      if (!actorIds.has(act.actorId)) fail.push(`action ${act.id} follows unknown actor ${act.actorId}`);
      continue;
    }
    if (!slotIds.has(act.targetSlot)) fail.push(`action ${act.id} slot ${act.targetSlot} not in ${scenario.world}`);
    const stand: [number, number] = [act.slotInfo.standX, act.slotInfo.standY];
    if (!isWalkable(scenario.world, stand, [], 2.3)) fail.push(`action ${act.id} standing spot is not walkable`);
    if (stand[0] < bounds.minX + 2 || stand[0] > bounds.maxX - 2) fail.push(`action ${act.id} stands at the very edge (mobile crop)`);
    if (act.slotInfo.interactionRadius < 8) fail.push(`action ${act.id} radius too small for touch`);
    for (const other of stands) {
      if (Math.hypot(other[0] - stand[0], other[1] - stand[1]) < 3) fail.push(`actions ${act.id} and ${other[2]} share a standing spot`);
    }
    stands.push([stand[0], stand[1], act.id]);
  }
  for (const act of scenario.actions) if (!scenario.endings[act.id]) fail.push(`action ${act.id} has no consequence text`);

  // spawn & actors
  if (!isWalkable(scenario.world, scenario.playerSpawn, cast.staticObstacles)) fail.push('player spawns inside furniture or people');
  for (const actor of cast.actors) {
    if (actor.cls !== 'background' && !isWalkable(scenario.world, actor.spawn, cast.staticObstacles.filter(o => o.id !== `actor:${actor.id}`))) {
      fail.push(`actor ${actor.id} spawns inside furniture`);
    }
    for (const other of cast.actors) {
      if (other.id < actor.id && Math.hypot(other.spawn[0] - actor.spawn[0], other.spawn[1] - actor.spawn[1]) < 3) {
        fail.push(`actors ${actor.id} and ${other.id} stand on top of each other`);
      }
    }
  }
  for (const cue of cast.cues) {
    if (!actorIds.has(cue.actor)) fail.push(`cue for unknown actor ${cue.actor}`);
    if (cue.act === 'walk_to' || cue.act === 'exit' || (cue.act === 'enter' && cue.then)) {
      const actor = cast.actors.find(a => a.id === cue.actor);
      const from = cue.act === 'enter' ? cue.to! : actor!.spawn;
      const to = cue.act === 'enter' ? cue.then! : cue.to!;
      const extra = cast.staticObstacles.filter(o => o.id !== `actor:${cue.actor}`);
      const path = findPath(scenario.world, from, to, { extra, via: cue.via });
      if (pathCollides(scenario.world, path, extra)) fail.push(`route for ${cue.actor} (${cue.act}) crosses furniture`);
      const end = path[path.length - 1];
      if (Math.hypot(end[0] - to[0], end[1] - to[1]) > 6) fail.push(`route for ${cue.actor} cannot reach its destination`);
    }
  }

  // key objects
  for (const obj of cast.keyObjects) {
    if (obj.slot !== 'carried' && !slotIds.has(obj.slot)) fail.push(`key object ${obj.id} hosted on unknown slot ${obj.slot}`);
  }

  // cinematics
  const cin = scenario.cinematic;
  if (!cin) fail.push('no cinematic block');
  else {
    if (!CAMERA_GRAMMARS[cin.cameraGrammar]) fail.push(`camera grammar ${cin.cameraGrammar} unresolvable`);
    if (!cin.lightingDef) fail.push('no lighting profile');
    if (!cin.bed) fail.push('no audio bed');
    if (cin.cameraEvents.length === 0) fail.push('no camera events: the camera has nothing to react to');
    for (const e of cin.cameraEvents) {
      if (e.slot && e.slot !== 'carried' && !slotIds.has(e.slot)) fail.push(`camera event ${e.kind} on unknown slot ${e.slot}`);
      if (e.actor && !actorIds.has(e.actor)) fail.push(`camera event ${e.kind} on unknown actor ${e.actor}`);
    }
    const seen = new Set<string>();
    for (let t = 0; t < 40000; t += 500) {
      const shot = directShot({
        elapsedMs: t, revealed: false, committed: false, pressureTriggered: t >= cin.pressureAtMs,
        grammar: cin.cameraGrammar, events: cin.cameraEvents, focusSlot: cin.focusSlot,
      });
      if (!viviCameraLanguage[shot.shot]) fail.push(`director produced unknown shot ${shot.shot}`);
      if (shot.locked && t >= 4200) fail.push(`director locks control at ${t} ms`);
      seen.add(shot.shot);
    }
    if (seen.size < 3) fail.push(`camera only uses ${[...seen].join(', ')} — flat`);
    if (!(cin.cueAtMs < cin.pressureAtMs)) fail.push('pressure does not follow the cue');
  }

  // semantic modifiers
  if (scenario.modifiers.length === 0) fail.push('no modifiers: nothing in the room changes');
  for (const m of scenario.modifiers) if (!m.data) fail.push(`modifier ${m.id} has no structured data`);

  // beats
  const cue = scenario.beats.find(b => b.isCue);
  const pressure = scenario.beats.find(b => b.isPressure);
  if (!cue || !pressure) fail.push('missing cue or pressure beat');

  return fail;
}

const rows: Row[] = [];

for (const item of EVAL_CORPUS) {
  const result = await compileViviStory({ story: item.story, actualOutcome: item.outcome });
  const failures = checkScenario(item.id, result.compiled.dsl, result.post.scenario, {
    outcome: item.outcome ?? '',
    expectWorlds: item.expect?.worlds,
    expectObjects: item.expect?.objects,
  });

  // Truth must behave the same whichever way the author answers question two.
  const flipped = item.outcome ? undefined : 'I waited, and in the end I told the truth.';
  const second = await compileViviStory({ story: item.story, actualOutcome: flipped });
  failures.push(
    ...checkScenario(item.id, second.compiled.dsl, second.post.scenario, { outcome: flipped ?? '' }).filter(
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
