import { worldTemplates, type ViviWorldId } from '../../world/templates/index.ts';
import type { DslCommitment, ViviExperienceDSL } from './dsl.ts';
import {
  OBJECTS,
  PLACES,
  ROLES,
  WORLDS,
  type DslObject,
  type DslPlace,
  type DslPresence,
  type DslRole,
  type DslVerb,
} from './vocabulary.ts';
import { CARRIED, WORLD_KNOWLEDGE, defaultSlotForVerb, hostSlot, resolvePlace } from './worldKnowledge.ts';

/**
 * What kind of thing a commitment physically acts on.
 *
 * A Vivi scene is a situation, not a menu: the choices in front of the player
 * should reach for different affordances of the room. This module is the one
 * place that decides what each commitment reaches for, so the validator that
 * demands variety and the compiler that stages the choice can never disagree.
 *
 * Classification uses the verb, the target, the cast and the world's own
 * vocabulary — never the model's label text, which is free prose in any
 * language.
 */

export type CommitmentClass =
  | 'OBJECT'
  | 'ACTOR'
  | 'PLACE'
  | 'EXIT'
  | 'WAIT_STATE'
  | 'COMMUNICATION'
  | 'OTHER';

export interface ResolvedCommitment {
  cls: CommitmentClass;
  /**
   * Where the choice stands in the room: a world slot, `actor:<role>` or
   * `carried`. Two commitments sharing a locus are one spot on the floor.
   */
  locus: string;
  /** The on-stage person this commitment acts on, when it acts on one. */
  actorRole?: DslRole;
  /** The key object this commitment acts on, when it acts on one. */
  objectId?: DslObject;
  /** The place word this commitment acts on, when it names one. */
  placeWord?: DslPlace;
  /** The commitment reaches a person who is not in the room, through a device. */
  viaDevice?: boolean;
  /** The target named a role that is not staged, so the verb decided the spot. */
  unstagedRole?: DslRole;
}

const isObject = (v: unknown): v is DslObject => typeof v === 'string' && (OBJECTS as readonly string[]).includes(v);
const isRole = (v: unknown): v is DslRole => typeof v === 'string' && (ROLES as readonly string[]).includes(v);
const isPlace = (v: unknown): v is DslPlace => typeof v === 'string' && (PLACES as readonly string[]).includes(v);

/** Verbs that reach a person who is somewhere else. */
const REACHING_VERBS = new Set<DslVerb>(['call', 'call_help', 'answer']);
/** Verbs that are a decision to stay put rather than a trip across the room. */
const STAYING_VERBS = new Set<DslVerb>(['wait', 'stay', 'hide']);
/** Verbs whose whole meaning is going out of the room. */
const LEAVING_VERBS = new Set<DslVerb>(['leave', 'board', 'return']);
/** Objects through which a person outside the room can be reached. */
const COMMS_OBJECTS = new Set<DslObject>(['phone', 'intercom']);
/**
 * Verbs addressed at a person. With no target named, they resolve onto the one
 * person on stage rather than onto the middle of the room — a choice aimed at
 * someone should walk you to them.
 */
const ADDRESSED_VERBS = new Set<DslVerb>(['ask', 'confront', 'comfort', 'tell', 'refuse', 'accept', 'follow']);

/** The on-stage, remote and background roles of a cast, in DSL order. */
export function castPresence(dsl: ViviExperienceDSL): Map<DslRole, DslPresence> {
  const map = new Map<DslRole, DslPresence>();
  for (const [role, presence] of dsl.c) if (!map.has(role) || presence !== 'bg') map.set(role, presence);
  return map;
}

/**
 * Resolve one commitment to the spot it is staged at and the kind of thing it
 * reaches for. Pure: the same DSL always resolves the same way.
 */
export function resolveCommitment(dsl: ViviExperienceDSL, commitment: DslCommitment): ResolvedCommitment {
  const world: ViviWorldId = WORLDS[dsl.w];
  const know = WORLD_KNOWLEDGE[world];
  const [verb, target] = commitment;
  const presence = castPresence(dsl);
  const staged = [...presence].filter(([, p]) => p === 'on').map(([role]) => role);

  const objectClass = (obj: DslObject): CommitmentClass =>
    COMMS_OBJECTS.has(obj) && REACHING_VERBS.has(verb) ? 'COMMUNICATION' : 'OBJECT';

  /* A person in the room: you walk to them. */
  if (isRole(target) && presence.get(target) === 'on') {
    return { cls: 'ACTOR', locus: `actor:${target}`, actorRole: target };
  }

  /* A person only present through a device: you reach them through it. */
  if (isRole(target) && presence.get(target) === 'off') {
    const device: DslObject = dsl.o.includes('intercom') ? 'intercom' : 'phone';
    return { cls: 'COMMUNICATION', locus: hostSlot(world, device), objectId: device, actorRole: target, viaDevice: true };
  }

  if (isObject(target)) {
    return { cls: objectClass(target), locus: hostSlot(world, target), objectId: target };
  }

  if (isPlace(target)) {
    const slot = resolvePlace(world, target);
    if (slot) {
      const cls: CommitmentClass = LEAVING_VERBS.has(verb)
        ? 'EXIT'
        : STAYING_VERBS.has(verb)
          ? 'WAIT_STATE'
          : slot === know.exit || slot === know.door
            ? 'EXIT'
            : 'PLACE';
      return { cls, locus: slot, placeWord: target };
    }
  }

  /* No usable target: the verb decides, against the room and the cast. */
  const unstagedRole = isRole(target) ? target : undefined;
  if (!unstagedRole && ADDRESSED_VERBS.has(verb) && staged.length === 1) {
    return { cls: 'ACTOR', locus: `actor:${staged[0]}`, actorRole: staged[0] };
  }
  const slot = defaultSlotForVerb(world, verb, dsl.o);
  const cls: CommitmentClass = LEAVING_VERBS.has(verb)
    ? 'EXIT'
    : STAYING_VERBS.has(verb)
      ? 'WAIT_STATE'
      : REACHING_VERBS.has(verb)
        ? 'COMMUNICATION'
        : slot === know.exit || slot === know.door
          ? 'EXIT'
          : worldTemplates[world].slots.some(s => s.id === slot)
            ? 'PLACE'
            : 'OTHER';
  return { cls, locus: slot, ...(unstagedRole ? { unstagedRole } : {}) };
}

export function resolveCommitments(dsl: ViviExperienceDSL): ResolvedCommitment[] {
  return dsl.a.map(a => resolveCommitment(dsl, a));
}

export interface CommitmentVariety {
  classes: CommitmentClass[];
  loci: string[];
  distinctClasses: number;
  distinctLoci: number;
  /** Everything the player can choose happens in one spot on the floor. */
  oneSpot: boolean;
  /** Every choice reaches for the same kind of thing. */
  oneKind: boolean;
}

/**
 * How much physical variety a set of commitments actually offers.
 *
 * `carried` counts as one spot: a phone in your hand is the same gesture
 * whichever choice you pick.
 */
export function commitmentVariety(dsl: ViviExperienceDSL): CommitmentVariety {
  const resolved = resolveCommitments(dsl);
  const classes = resolved.map(r => r.cls);
  const loci = resolved.map(r => (r.locus === CARRIED ? CARRIED : r.locus));
  const distinctClasses = new Set(classes).size;
  const distinctLoci = new Set(loci).size;
  return {
    classes,
    loci,
    distinctClasses,
    distinctLoci,
    oneSpot: resolved.length > 1 && distinctLoci < 2,
    oneKind: resolved.length > 1 && distinctClasses < 2,
  };
}
