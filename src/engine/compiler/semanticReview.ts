import type { ViviExperienceDSL } from './dsl.ts';
import type { StoryHints } from './preprocess.ts';
import { LIMITS, WORLDS, type DslObject, type DslRole } from './vocabulary.ts';
import { WORLD_KNOWLEDGE } from './worldKnowledge.ts';
import { commitmentVariety, resolveCommitment, resolveCommitments } from './commitmentClasses.ts';
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

export interface ReviewOptions {
  /**
   * Experience V2: a model's program must name the decision moment, or say
   * plainly that nothing had to be decided (m.f = memory). Not applied to the
   * deterministic fallback, which cannot read a story.
   */
  requireMoment?: boolean;
  /**
   * Last resort, after the model's one repair turn has had its chance: take
   * the invented person out of the scene rather than play a story that now
   * has a character in it the author never had. Only ever applied when what
   * is left is still a scene — at least one event and two choices.
   */
  enforce?: boolean;
}

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

/**
 * What else this scene already offers, named concretely.
 *
 * A repair turn that is only told what is wrong tends to shuffle the same
 * choices; one told what is available moves one of them. Everything listed is
 * already in the program, so taking the advice invents nothing.
 */
function alternatives(dsl: ViviExperienceDSL): string {
  const resolved = resolveCommitments(dsl);
  const usedLoci = new Set(resolved.map(r => r.locus));
  const options: string[] = [];
  for (const [role, presence] of dsl.c) {
    if (presence === 'on' && !resolved.some(r => r.actorRole === role && r.cls === 'ACTOR')) options.push(`the ${role} in the room`);
  }
  for (const obj of dsl.o) {
    const target = resolveCommitment(dsl, ['look', obj, 'x']);
    if (!usedLoci.has(target.locus)) options.push(`the ${obj}`);
  }
  if (!resolved.some(r => r.cls === 'EXIT')) options.push('leaving');
  if (!resolved.some(r => r.cls === 'WAIT_STATE')) options.push('staying where you are');
  return options.slice(0, 4).join(', ') || 'leaving, or staying where you are';
}

/** Objects an event or a commitment actually uses; the rest are scenery. */
function referencedObjects(dsl: ViviExperienceDSL): Set<DslObject> {
  const used = new Set<DslObject>();
  for (const event of dsl.e) {
    for (const arg of event.slice(1)) if (typeof arg === 'string') used.add(arg as DslObject);
  }
  for (const resolved of resolveCommitments(dsl)) if (resolved.objectId) used.add(resolved.objectId);
  return used;
}

/**
 * Take a person out of a scene, along with everything that needed them.
 * Returns null when the scene would stop being a scene.
 */
function withoutRole(dsl: ViviExperienceDSL, role: DslRole): ViviExperienceDSL | null {
  const mentions = (value: unknown) => value === role;
  const events = dsl.e.filter(event => !event.slice(1).some(mentions));
  const commitments = dsl.a.filter(commitment => !mentions(commitment[1]));
  if (!events.length || commitments.length < LIMITS.commitments.min) return null;
  return { ...dsl, c: dsl.c.filter(([r]) => r !== role), e: events, a: commitments };
}

export function reviewDsl(dsl: ViviExperienceDSL, hints: StoryHints, options: ReviewOptions = {}): SemanticReview {
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

  let blocking = unsupported.filter(g => used.has(g.role) && g.presence !== 'bg');
  if (blocking.length && options.enforce) {
    const refused: DslRole[] = [];
    for (const g of blocking) {
      const without = withoutRole(current, g.role);
      if (!without) continue;
      current = without;
      refused.push(g.role);
    }
    if (refused.length) notes.push(`cast: removed ${refused.join(', ')} and what needed them — ${blocking[0].reason}`);
    blocking = blocking.filter(g => !refused.includes(g.role));
  }
  if (blocking.length) {
    const names = blocking.map(g => g.role).join(', ');
    errors.push(
      `The story never mentions ${names}. Use only people the story gives, and drop every event and choice that needs ${names}.`
    );
  }

  /* ------------------------------------------- background that acts --- */

  // Background cast is scenery, and a room with no crowd in it drops them. A
  // model that then points an event or a choice at one of those figures meant
  // a person, not scenery — so in a private room they are staged properly
  // rather than silently deleted, leaving a choice aimed at nobody.
  if (!WORLD_KNOWLEDGE[WORLDS[current.w]].public) {
    const acting = current.c.filter(([role, presence]) => presence === 'bg' && used.has(role)).map(([role]) => role);
    if (acting.length) {
      current = {
        ...current,
        c: current.c.map(m => (acting.includes(m[0]) ? [m[0], 'on'] : m)) as typeof current.c,
      };
      notes.push(`cast: ${acting.join(', ')} acts in the scene, so stands in it rather than being dropped as a crowd`);
    }
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
  if (variety.oneKind || variety.oneSpot) {
    const complaint = variety.oneKind
      ? `All ${current.a.length} choices reach for the same kind of thing (${CLASS_WORD[variety.classes[0]] ?? 'thing'}).`
      : `All ${current.a.length} choices happen in one spot.`;
    errors.push(`${complaint} Point at least one somewhere else: ${alternatives(current)}. Invent nothing new.`);
  }

  /* --------------------------------------------- decision moment (V2) --- */

  if (options.requireMoment && !current.m?.d && current.m?.f !== 'memory') {
    errors.push('m is missing: give m.d, the moment the narrator must decide, with m.h why it is hard — from the story only. If nothing had to be decided, set m.f to memory.');
  }

  return { dsl: current, errors, notes };
}

/** Roles the review would refuse, for tests and diagnostics. */
export function unsupportedRoles(dsl: ViviExperienceDSL, hints: StoryHints): DslRole[] {
  return groundCast(dsl, hints)
    .filter(g => g.support === 'UNSUPPORTED' && g.presence !== 'bg')
    .map(g => g.role);
}
