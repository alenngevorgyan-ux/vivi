import type { ViviWorldId } from '../../world/templates/index.ts';
import type { ViviCharacterId, CharacterFacing, CharacterPose } from '../../assets/characters/characters.ts';
import type { CollisionBox } from './collision.ts';
import { findPath, pathLength, pointAlongPath, type Point } from './navigation.ts';

/**
 * The actor runtime.
 *
 * A scene may hold any number of people. Each is described once (who they
 * are, where they start, how they behave) and then driven by a short list of
 * semantic cues — walk to a place, leave, come back, turn, talk, sit. An
 * actor's position, pose and facing are a pure function of scene time and the
 * player's position, which makes every frame reproducible: the Director Lab can
 * jump straight to 0:27 without playing the 26 seconds before it.
 */

export type ActorClass = 'primary' | 'secondary' | 'background';

/**
 * Background behaviour is deterministic and costs no model tokens:
 * `sit`/`watch` hold a place and look at whatever the room is looking at,
 * glancing at the player when they come close; `present` stands and addresses
 * the room; `idle` simply lives.
 */
export type ActorBehavior = 'present' | 'sit' | 'watch' | 'idle';

export interface RuntimeActor {
  id: string;
  role: string;
  character: ViviCharacterId;
  cls: ActorClass;
  spawn: Point;
  facing: CharacterFacing;
  pose: CharacterPose;
  behavior: ActorBehavior;
  /** Slot or 'player' the actor looks toward when nothing else draws them. */
  attention?: string;
  /** Not on stage until this moment (someone who arrives later). */
  hiddenUntilMs?: number;
}

export type ActorAction =
  | 'walk_to'
  | 'exit'
  | 'enter'
  | 'turn_to'
  | 'look_at'
  | 'sit'
  | 'stand'
  | 'talk'
  | 'wait'
  | 'hesitate';

export interface ActorCue {
  atMs: number;
  actor: string;
  act: ActorAction;
  /** Destination (walk_to/exit) or doorway the actor appears in (enter). */
  to?: Point;
  /** Where an `enter` walks to after appearing. */
  then?: Point;
  /** Authored semantic route waypoints. */
  via?: Point[];
  /** 'player', an actor id, or a world point the actor turns toward. */
  target?: string | Point;
  durationMs?: number;
}

export interface ActorFrame {
  id: string;
  pos: Point;
  facing: CharacterFacing;
  pose: CharacterPose;
  /** 0 when gone, 1 when fully present; fades over exits and entrances. */
  presence: number;
  /** Walk-cycle phase (0–1), advanced by distance so feet never slide. */
  walkPhase?: number;
  talking: boolean;
}

/** World units per second. Slower than the player: these are people with somewhere to be, not players. */
export const ACTOR_WALK_SPEED = 12.5;
/** World units per full two-step walk cycle. */
export const ACTOR_STRIDE = 10.5;
const ACCEL_S = 0.35;
const FADE_MS = 450;
/** A background figure glances up when the player comes this close. */
const GLANCE_RADIUS = 13;
const TALK_MS = 2600;

/**
 * A trapezoidal velocity profile: ease up to walking speed over `a` seconds,
 * walk, ease down over `a`. Ramps cover `speed·a/2` each, so the whole trip
 * takes `a + length/speed`. Short trips shrink `a` so they still finish.
 */
function rampSeconds(length: number, speed: number): number {
  return Math.min(ACCEL_S, length / speed);
}

export function travelSeconds(length: number, speed = ACTOR_WALK_SPEED): number {
  if (length <= 0) return 0;
  return rampSeconds(length, speed) + length / speed;
}

/** Distance covered after `s` seconds with a gentle start and stop. */
function easedDistance(s: number, length: number, speed: number): number {
  if (length <= 0 || s <= 0) return 0;
  const a = rampSeconds(length, speed);
  const total = a + length / speed;
  if (s >= total) return length;
  if (s < a) return (speed * s * s) / (2 * a);
  if (s < total - a) return (speed * a) / 2 + speed * (s - a);
  const r = total - s;
  return length - (speed * r * r) / (2 * a);
}

export function facingToward(from: Point, to: Point, fallback: CharacterFacing = 'front'): CharacterFacing {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return fallback;
  if (Math.abs(dx) > Math.abs(dy) * 0.75) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'front' : 'back';
}

export interface ActorContext {
  world: ViviWorldId;
  playerPos: Point;
  /** Static obstacles beyond the world's own furniture (seated people). */
  obstacles?: CollisionBox[];
  /** Slot coordinates for attention targets. */
  slotPoint?: (slot: string) => Point | undefined;
  /** The room is staring at the player (public pressure). */
  stare?: boolean;
}

interface Movement {
  cue: ActorCue;
  path: Point[];
  length: number;
  durationMs: number;
}

const movementCache = new Map<string, Movement[]>();

function buildMovements(actor: RuntimeActor, cues: ActorCue[], ctx: ActorContext): Movement[] {
  const key = `${ctx.world}|${actor.id}|${actor.spawn}|${JSON.stringify(cues)}|${(ctx.obstacles ?? []).map(o => o.id).join(',')}`;
  const cached = movementCache.get(key);
  if (cached) return cached;

  const extra = (ctx.obstacles ?? []).filter(o => o.id !== `actor:${actor.id}`);
  const movements: Movement[] = [];
  let pos: Point = actor.spawn;
  let lastEnd = -Infinity;
  for (const cue of cues) {
    if (cue.act !== 'walk_to' && cue.act !== 'exit' && cue.act !== 'enter') continue;
    let start: Point = pos;
    if (cue.act === 'enter') start = cue.to ?? pos;
    // If an earlier walk is interrupted, this one starts from wherever it had reached.
    if (cue.act !== 'enter' && movements.length && cue.atMs < lastEnd) {
      const prev = movements[movements.length - 1];
      const d = easedDistance((cue.atMs - prev.cue.atMs) / 1000, prev.length, ACTOR_WALK_SPEED);
      start = pointAlongPath(prev.path, d).pos;
    }
    const dest = cue.act === 'enter' ? cue.then ?? start : cue.to ?? start;
    const path = findPath(ctx.world, start, dest, { extra, via: cue.via });
    const length = pathLength(path);
    const durationMs = travelSeconds(length) * 1000;
    movements.push({ cue, path, length, durationMs });
    pos = path[path.length - 1];
    lastEnd = cue.atMs + durationMs;
  }
  movementCache.set(key, movements);
  return movements;
}

/**
 * Where an actor is and what they are doing at scene time `t`.
 * `others` are the other actors' positions, for turning toward a speaker.
 */
export function actorFrameAt(
  actor: RuntimeActor,
  allCues: ActorCue[],
  t: number,
  ctx: ActorContext,
  others: Record<string, { pos: Point; talking: boolean }> = {}
): ActorFrame {
  const cues = allCues.filter(c => c.actor === actor.id).sort((a, b) => a.atMs - b.atMs);
  const movements = buildMovements(actor, cues, ctx);

  let pos: Point = actor.spawn;
  let pose: CharacterPose = actor.pose;
  let presence = actor.hiddenUntilMs !== undefined && t < actor.hiddenUntilMs ? 0 : 1;
  let walking = false;
  let walkDist = 0;
  let heading: Point | null = null;
  let lookTarget: string | Point | undefined = actor.attention;
  let talking = false;
  let gestureUntil = -Infinity;
  let gesturePose: CharacterPose | null = null;

  for (const cue of cues) {
    if (cue.atMs > t) break;
    switch (cue.act) {
      case 'walk_to':
      case 'exit':
      case 'enter': {
        const move = movements.find(m => m.cue === cue);
        if (!move) break;
        const next = movements[movements.indexOf(move) + 1];
        const until = next && next.cue.act !== 'enter' ? Math.min(t, next.cue.atMs) : t;
        const s = (until - cue.atMs) / 1000;
        const d = easedDistance(s, move.length, ACTOR_WALK_SPEED);
        const at = pointAlongPath(move.path, d);
        pos = at.pos;
        if (cue.act === 'enter') {
          presence = Math.min(1, (t - cue.atMs) / FADE_MS);
        }
        const arrived = d >= move.length - 1e-6;
        if (!arrived && until === t) {
          walking = true;
          walkDist = d;
          heading = at.dir;
        }
        if (cue.act === 'exit') {
          const arrivedAt = cue.atMs + move.durationMs;
          presence = t <= arrivedAt ? 1 : Math.max(0, 1 - (t - arrivedAt) / FADE_MS);
        }
        if (arrived && cue.act === 'enter') lookTarget = 'player';
        break;
      }
      case 'turn_to':
      case 'look_at':
        lookTarget = cue.target;
        break;
      case 'sit':
        pose = 'sit';
        break;
      case 'stand':
        pose = 'idle';
        break;
      case 'wait':
        pose = 'wait';
        break;
      case 'talk':
        if (t < cue.atMs + (cue.durationMs ?? TALK_MS)) talking = true;
        if (cue.target) lookTarget = cue.target;
        break;
      case 'hesitate':
        gestureUntil = cue.atMs + (cue.durationMs ?? 1800);
        gesturePose = 'hesitate';
        break;
    }
  }

  // Background figures react to the room: the speaker, a stare, a nearby player.
  const background = actor.behavior === 'sit' || actor.behavior === 'watch' || actor.behavior === 'idle';
  if (!walking && background) {
    const speaker = Object.entries(others).find(([id, o]) => id !== actor.id && o.talking);
    const playerDist = Math.hypot(ctx.playerPos[0] - pos[0], ctx.playerPos[1] - pos[1]);
    if (ctx.stare) lookTarget = 'player';
    else if (playerDist < GLANCE_RADIUS) lookTarget = 'player';
    else if (speaker) lookTarget = speaker[0];
  }

  let facing: CharacterFacing = actor.facing;
  if (walking && heading) {
    facing = facingToward([0, 0], heading, actor.facing);
  } else if (lookTarget) {
    let targetPoint: Point | undefined;
    if (Array.isArray(lookTarget)) targetPoint = lookTarget;
    else if (lookTarget === 'player') targetPoint = ctx.playerPos;
    else if (others[lookTarget]) targetPoint = others[lookTarget].pos;
    else targetPoint = ctx.slotPoint?.(lookTarget);
    if (targetPoint) facing = facingToward(pos, targetPoint, actor.facing);
  }

  if (walking) pose = 'walk';
  else if (talking && pose !== 'sit') pose = 'talk';
  else if (gesturePose && t < gestureUntil && pose !== 'sit') pose = gesturePose;

  return {
    id: actor.id,
    pos,
    facing,
    pose,
    presence,
    walkPhase: walking ? (walkDist / ACTOR_STRIDE) % 1 : undefined,
    talking,
  };
}

/** Frames for every actor at time `t`, resolving who is speaking first so listeners can turn to them. */
export function actorFramesAt(actors: RuntimeActor[], cues: ActorCue[], t: number, ctx: ActorContext): ActorFrame[] {
  const firstPass: Record<string, { pos: Point; talking: boolean }> = {};
  for (const actor of actors) {
    const f = actorFrameAt(actor, cues, t, ctx);
    firstPass[actor.id] = { pos: f.pos, talking: f.talking };
  }
  return actors.map(actor => actorFrameAt(actor, cues, t, ctx, firstPass));
}

/** Seated or standing people are obstacles for the player and for each other's routes. */
export function actorObstacle(id: string, pos: Point, seated: boolean): CollisionBox {
  const w = seated ? 2.6 : 1.8;
  const h = seated ? 2.2 : 1.4;
  return { id: `actor:${id}`, name: id, x1: pos[0] - w, y1: pos[1] - h, x2: pos[0] + w, y2: pos[1] + 0.6, blocksMovement: true };
}
