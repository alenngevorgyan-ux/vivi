/**
 * Playability checks shared by the deterministic eval and the live model
 * bakeoff: a compiled post either satisfies every one of these or it is not
 * a playable Vivi experience.
 */
import type { CanonicalScenario } from '../../src/engine/runtime/RuntimeCompiler.ts';
import { validateDSL, serializeDSL, type ViviExperienceDSL } from '../../src/engine/compiler/dsl.ts';
import { commitmentVariety } from '../../src/engine/compiler/commitmentClasses.ts';
import { worldTemplates } from '../../src/world/templates/index.ts';
import { WORLD_COLLISIONS } from '../../src/engine/runtime/collision.ts';
import { findPath, pathCollides, isWalkable } from '../../src/engine/runtime/navigation.ts';
import { scenarioCast } from '../../src/engine/runtime/scenarioActors.ts';
import { CAMERA_GRAMMARS, directShot } from '../../src/engine/cinematic/director.ts';
import { viviCameraLanguage } from '../../src/engine/cinematic/cameraLanguage.ts';

export interface ScenarioCheckOptions {
  outcome?: string;
  expectWorlds?: string[];
  expectObjects?: string[];
  truthMustBe?: string;
}

export function checkScenario(
  _id: string,
  dsl: ViviExperienceDSL,
  scenario: CanonicalScenario,
  opts: ScenarioCheckOptions
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
  // Variety is judged on what the compiler actually stages, not on the target
  // word: `call the phone` and `read the phone` are the same noun and two
  // different acts, while `open the door` and `lock the door` are two verbs in
  // one spot. `legacyCommitmentKinds` keeps the older, cruder measure available
  // so a stored run can still be scored the way it was scored when it ran.
  const variety = commitmentVariety(dsl);
  if (variety.oneKind) fail.push('every commitment reaches for the same kind of thing — scene reads as a menu');
  else if (variety.oneSpot) fail.push('every commitment happens in one spot — scene reads as a menu');

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

/**
 * The commitment-variety measure used before the semantic classifier existed:
 * the target word's category alone. Kept so a stored run can be re-scored the
 * way it was scored when it ran, and both numbers reported side by side.
 */
export function legacyCommitmentKinds(dsl: ViviExperienceDSL): number {
  return new Set(
    dsl.a.map(a => (a[1] === null ? 'none' : dsl.o.includes(a[1] as never) ? 'object' : dsl.c.some(c => c[0] === a[1]) ? 'person' : 'place'))
  ).size;
}
