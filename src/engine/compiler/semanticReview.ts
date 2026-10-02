import type { ViviExperienceDSL } from './dsl.ts';
import type { StoryHints } from './preprocess.ts';
import { LIMITS, type DslObject, type DslRole } from './vocabulary.ts';
import { commitmentVariety, resolveCommitments } from './commitmentClasses.ts';
import { groundCast, referencedRoles } from './castGrounding.ts';

/**
 * The semantic review a validated DSL still has to pass.
 *
 * `validateDSL` answers "is this a legal program?". This answers "is this a
 * situation?" — the two questions a small model gets wrong in different ways.
 * Everything that can be settled deterministically is settled here for free;
 * only a change that would alter what the scene means is sent back to the
 * model, and then only once.
 */

export interface SemanticReview {
  /** The DSL after deterministic repair. Always valid if the input was. */
  dsl: ViviExperienceDSL;
  /** Compact, actionable instructions for the single repair turn. Empty when the scene passes. */
  errors: string[];
  /** What was fixed without asking the model. */
  notes: string[];
}

/** A short, human word for each commitment class, used in repair messages. */
const CLASS_WORD: Record<string, string> = {
  OBJECT: 'object',
  ACTOR: 'person in the room',
  PLACE: 'place',
  EXIT: 'way out',
  WAIT_STATE: 'staying put',
  COMMUNICATION: 'phone or intercom',
  OTHER: 'place',
};

/** Objects an event or a commitment actually uses; the rest are scenery. */
function referencedObjects(dsl: ViviExperienceDSL): Set<DslObject> {
  const used = new Set<DslObject>();
  for (const event of dsl.e) {
    for (const arg of event.slice(1)) if (typeof arg === 'string') used.add(arg as DslObject);
  }
  for (const resolved of resolveCommitments(dsl)) if (resolved.objectId) used.add(resolved.objectId);
  return used;
}

export function reviewDsl(dsl: ViviExperienceDSL, hints: StoryHints): SemanticReview {
  const errors: string[] = [];
  const notes: string[] = [];
  let current = dsl;

  /* ------------------------------------------------- cast grounding --- */

  const grounded = groundCast(current, hints);
  const used = referencedRoles(current);
  const unsupported = grounded.filter(g => g.support === 'UNSUPPORTED');
  const droppable = unsupported.filter(g => !used.has(g.role));

  if (droppable.length) {
    const drop = new Set(droppable.map(g => g.role));
    current = { ...current, c: current.c.filter(([role]) => !drop.has(role)) };
    notes.push(`cast: dropped ${[...drop].join(', ')} — ${droppable[0].reason}`);
  }

  const blocking = unsupported.filter(g => used.has(g.role) && g.presence !== 'bg');
  if (blocking.length) {
    const names = blocking.map(g => g.role).join(', ');
    errors.push(
      `The story never mentions ${names}. Use only people the story gives, and drop every event and choice that needs ${names}.`
    );
  }

  /* -------------------------------------------------- object focus --- */

  if (current.o.length > LIMITS.objects) {
    const keep = referencedObjects(current);
    const pruned = [
      ...current.o.filter(o => keep.has(o)),
      ...current.o.filter(o => !keep.has(o)),
    ].slice(0, Math.max(LIMITS.objects, current.o.filter(o => keep.has(o)).length));
    if (pruned.length < current.o.length) {
      notes.push(`objects: kept ${pruned.join(', ')}, dropped ${current.o.filter(o => !pruned.includes(o)).join(', ')} — nothing in the scene used them`);
      current = { ...current, o: pruned };
    }
  }

  /* ---------------------------------------------- commitment variety --- */

  // A cast change can move what a choice points at, so variety is judged last.
  const variety = commitmentVariety(current);
  if (variety.oneKind) {
    const word = CLASS_WORD[variety.classes[0]] ?? 'thing';
    errors.push(
      `All ${current.a.length} choices reach for the same kind of thing (${word}). Give at least two kinds — object / person in the room / place or way out / staying put — using only what the story already has.`
    );
  } else if (variety.oneSpot) {
    errors.push(
      `All ${current.a.length} choices happen in one spot. Point at least one of them at something else in the room.`
    );
  }

  return { dsl: current, errors, notes };
}

/** Roles the review would refuse, for tests and diagnostics. */
export function unsupportedRoles(dsl: ViviExperienceDSL, hints: StoryHints): DslRole[] {
  return groundCast(dsl, hints)
    .filter(g => g.support === 'UNSUPPORTED' && g.presence !== 'bg')
    .map(g => g.role);
}
