import { worldTemplates } from '../../world/templates/index.ts';
import type { CanonicalScenario, RuntimeKeyObject } from './RuntimeCompiler.ts';
import { actorObstacle, type ActorCue, type RuntimeActor } from './actors.ts';
import { nearestWalkable, type Point } from './navigation.ts';
import { resolveSemanticSlot } from './semanticSlots.ts';
import type { CollisionBox } from './collision.ts';

/**
 * One actor system for every scenario.
 *
 * Compiled experiences carry `actors` and `actorCues`. Older scenarios carry a
 * single `npc` whose movement used to be inferred frame by frame from modifier
 * text; this adapter turns that into the same declarative cues once, so legacy
 * posts, hero stories and generated scenes all walk through the same runtime.
 */
export interface ScenarioCast {
  actors: RuntimeActor[];
  cues: ActorCue[];
  /** Seated and stationary background figures the player cannot walk through. */
  staticObstacles: CollisionBox[];
  keyObjects: RuntimeKeyObject[];
}

/** Worlds whose phone is a physical object on a surface, for legacy scenarios. */
const LEGACY_PHONE_SLOT: Partial<Record<string, string>> = {
  apartment_night: 'phone_table',
  bedroom_night: 'phone_screen',
};

const castCache = new WeakMap<CanonicalScenario, ScenarioCast>();

export function scenarioCast(scenario: CanonicalScenario): ScenarioCast {
  const cached = castCache.get(scenario);
  if (cached) return cached;
  const result = scenario.actors ? compiledCast(scenario) : legacyCast(scenario);
  castCache.set(scenario, result);
  return result;
}

function compiledCast(scenario: CanonicalScenario): ScenarioCast {
  const actors = scenario.actors ?? [];
  const staticObstacles = actors
    .filter(a => a.cls === 'background')
    .map(a => actorObstacle(a.id, a.spawn, a.pose === 'sit'));
  return { actors, cues: scenario.actorCues ?? [], staticObstacles, keyObjects: scenario.keyObjects ?? [] };
}

function legacyCast(scenario: CanonicalScenario): ScenarioCast {
  const template = worldTemplates[scenario.world] || worldTemplates.apartment_night;
  const keyObjects: RuntimeKeyObject[] = [];
  const phoneSlot = LEGACY_PHONE_SLOT[scenario.world];
  const phone = phoneSlot ? template.slots.find(s => s.id === phoneSlot) : undefined;
  if (phone) {
    const firstPhone = scenario.modifiers.find(m => ['message', 'typing', 'call'].includes(m.kind) || m.anchor.includes('phone'));
    keyObjects.push({
      id: 'phone',
      kind: 'phone',
      slot: phone.id,
      pos: [phone.x, phone.y],
      ...(firstPhone ? { activeAtMs: firstPhone.atMs } : {}),
      prop: true,
      actionIds: scenario.actions.filter(a => a.targetSlot === phone.id).map(a => a.id),
    });
  }

  if (!scenario.npc) return { actors: [], cues: [], staticObstacles: [], keyObjects };

  const npc = scenario.npc;
  const slot = template.slots.find(s => s.id === npc.slot);
  const spawnSeed: Point = slot
    ? [
        scenario.playerSpawn[0] + (slot.x - scenario.playerSpawn[0]) * 0.55,
        Math.max(56, scenario.playerSpawn[1] + (slot.y + 14 - scenario.playerSpawn[1]) * 0.55),
      ]
    : [scenario.playerSpawn[0] + 9, scenario.playerSpawn[1]];
  const spawn = nearestWalkable(scenario.world, spawnSeed);
  const actor: RuntimeActor = {
    id: npc.id,
    role: 'companion',
    character: npc.character,
    cls: 'primary',
    spawn,
    facing: 'front',
    pose: npc.initialPose === 'leave' ? 'wait' : npc.initialPose,
    behavior: 'present',
    attention: 'player',
  };

  const cues: ActorCue[] = [];
  if (slot) cues.push({ atMs: 0, actor: actor.id, act: 'walk_to', to: nearestWalkable(scenario.world, [slot.x, slot.y]) });

  // Translate the modifier timeline the old runtime interpreted every frame.
  let exitedThrough: string | null = null;
  for (const m of scenario.modifiers) {
    const payload = (m.payload || '').toLowerCase();
    if (m.kind === 'sound' && payload.includes('shower') && !payload.includes('stop')) {
      const door = resolveSemanticSlot(scenario.world, m.anchor || 'bathroom_door');
      cues.push({ atMs: m.atMs, actor: actor.id, act: 'exit', to: [door.standX, door.standY] });
      exitedThrough = m.anchor || 'bathroom_door';
    } else if (m.kind === 'door' && exitedThrough && m.anchor === exitedThrough && payload.includes('open')) {
      const door = resolveSemanticSlot(scenario.world, exitedThrough);
      cues.push({ atMs: m.atMs, actor: actor.id, act: 'enter', to: [door.standX, door.standY], then: [door.standX - 2, door.standY + 4] });
      exitedThrough = null;
    } else if (m.kind === 'npcPressure' || (m.kind as string) === 'npc_dialogue') {
      cues.push({ atMs: m.atMs, actor: actor.id, act: 'talk', durationMs: 3200, target: 'player' });
    }
  }
  cues.sort((a, b) => a.atMs - b.atMs);
  return { actors: [actor], cues, staticObstacles: [], keyObjects };
}
