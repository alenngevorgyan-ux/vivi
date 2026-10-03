import type { ViviWorldId } from '../../world/templates/index.ts';
import type { CollisionBox } from '../runtime/collision.ts';
import { findPath, isWalkable, pathLength, type Point } from '../runtime/navigation.ts';

/**
 * THE INTERACTION RESOLVER
 *
 * The player chooses an intent; the engine decides how the body gets there.
 * Distance is staging, never a reason to refuse: "too far" does not exist in
 * this vocabulary. What can refuse is meaning — a person who is not in the
 * room is not conjured for a conversation (that is decided before this runs,
 * by `availability`).
 *
 * Order of preference, each one recorded as a diagnostic, never shown as an
 * error to the player:
 *
 *   in_place   the act happens where the hero stands (a phone in hand, already there)
 *   walk       a reachable standing spot near the target, the authored one first
 *   cut        no walkable route, but a standable spot exists: a short, deliberate edit
 *   text       nowhere to stand at all: the act is performed as text
 */

export type ResolutionMode = 'in_place' | 'walk' | 'cut' | 'text';

export interface Resolution {
  mode: ResolutionMode;
  /** Where the hero ends up (absent for `text`). */
  stand?: Point;
  /** Route for `walk`, starting at the hero. */
  path?: Point[];
  /** Point the hero should face once there. */
  face: Point;
  diagnostics: string[];
}

export interface ResolveRequest {
  world: ViviWorldId;
  from: Point;
  /** What the act is about: an object, a person, a doorway. */
  anchor: Point;
  /** Authored standing spot, if the compiler allocated one. */
  stand?: Point;
  /** Performed without moving: a device in hand, or waiting where one stands. */
  inPlace?: boolean;
  /** Furniture-like obstacles beyond the world's own (seated people, props). */
  obstacles?: CollisionBox[];
  /** Already this close to a spot counts as being there. */
  arriveRadius?: number;
}

const REACH = 2;

function candidates(anchor: Point): Point[] {
  const out: Point[] = [];
  // Close enough to be *at* the thing: further out, a spot is somewhere else in the room.
  for (const radius of [5, 7.5, 10, 12]) {
    for (let step = 0; step < 12; step++) {
      const a = (step / 12) * Math.PI * 2;
      out.push([anchor[0] + Math.cos(a) * radius, anchor[1] + Math.sin(a) * radius * 0.6]);
    }
  }
  return out;
}

export function resolveApproach(req: ResolveRequest): Resolution {
  const diagnostics: string[] = [];
  const extra = req.obstacles ?? [];
  const arrive = req.arriveRadius ?? 3;

  if (req.inPlace) return { mode: 'in_place', stand: req.from, face: req.anchor, diagnostics: ['performed in place'] };

  if (req.stand && Math.hypot(req.stand[0] - req.from[0], req.stand[1] - req.from[1]) <= arrive) {
    return { mode: 'in_place', stand: req.from, face: req.anchor, diagnostics: ['already at the spot'] };
  }

  // The authored spot first, then the nearest reachable alternatives to the hero.
  const authored = req.stand;
  const rest = candidates(req.anchor);
  const ordered: Point[] = [
    ...(authored ? [authored] : []),
    ...rest
      .filter(p => isWalkable(req.world, p, extra))
      .sort((a, b) => Math.hypot(a[0] - req.from[0], a[1] - req.from[1]) - Math.hypot(b[0] - req.from[0], b[1] - req.from[1])),
  ];

  let firstStandable: Point | undefined;
  for (const [i, spot] of ordered.entries()) {
    if (!isWalkable(req.world, spot, extra)) {
      if (i === 0 && authored) diagnostics.push('authored spot is blocked; trying nearby spots');
      continue;
    }
    firstStandable ??= spot;
    const path = findPath(req.world, req.from, spot, { extra });
    const end = path[path.length - 1];
    if (Math.hypot(end[0] - spot[0], end[1] - spot[1]) <= REACH) {
      if (i > 0 && authored) diagnostics.push('authored spot unreachable; used a nearby reachable spot');
      if (Math.hypot(spot[0] - req.from[0], spot[1] - req.from[1]) <= arrive) {
        return { mode: 'in_place', stand: req.from, face: req.anchor, diagnostics: [...diagnostics, 'already close enough'] };
      }
      diagnostics.push(`walk ${pathLength(path).toFixed(1)} units`);
      return { mode: 'walk', stand: spot, path, face: req.anchor, diagnostics };
    }
    if (i === 0 && authored) diagnostics.push('authored spot unreachable; trying nearby spots');
  }

  if (firstStandable) {
    diagnostics.push('no walkable route; staged as a cut');
    return { mode: 'cut', stand: firstStandable, face: req.anchor, diagnostics };
  }
  diagnostics.push('no standable spot near the target; performed as text');
  return { mode: 'text', face: req.anchor, diagnostics };
}

/* --------------------------------------------------------- availability --- */

export interface AvailabilityContext {
  /** Presence 0–1 of each actor right now. */
  actorPresence: Record<string, number>;
  /** Actors who left through a door that is still there to talk through. */
  reachableThroughDoor: Set<string>;
}

/**
 * Whether an intent is semantically possible now. Distance never enters into
 * it; only what the story establishes does.
 */
export function availability(
  target: { actorId?: string },
  ctx: AvailabilityContext
): { ok: true; throughDoor?: boolean } | { ok: false; reason: 'person_absent' } {
  if (!target.actorId) return { ok: true };
  const presence = ctx.actorPresence[target.actorId] ?? 0;
  if (presence >= 0.5) return { ok: true };
  if (ctx.reachableThroughDoor.has(target.actorId)) return { ok: true, throughDoor: true };
  return { ok: false, reason: 'person_absent' };
}
