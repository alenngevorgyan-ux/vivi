import { WORLD_KNOWLEDGE } from './worldKnowledge.ts';
import { ROLES, WORLDS, type DslPresence, type DslRole, type DslWorld } from './vocabulary.ts';
import type { ViviExperienceDSL } from './dsl.ts';
import type { StoryHints } from './preprocess.ts';

/**
 * Deterministic cast grounding.
 *
 * A model may infer relationship, tension and staging — that is the work we
 * want from it. It may not add a person the story never had: a host, a
 * stranger, a colleague who changes what the scene is about. This module
 * compares the cast a model proposed against the evidence the preprocessor
 * found in the author's own words, and says how well each role is supported.
 *
 * It is deliberately permissive about crowds. A wedding has guests, an office
 * meeting has colleagues, a platform has commuters; populating those costs
 * nothing and invents nobody. What it refuses is a named relation, or a
 * person standing in the room, that the story gives no sign of.
 */

export type CastSupport = 'EXPLICIT' | 'STRONGLY_IMPLIED' | 'BACKGROUND_ALLOWED' | 'UNSUPPORTED';

export interface GroundedRole {
  role: DslRole;
  presence: DslPresence;
  support: CastSupport;
  /** Short, user-free reason; used in compiler notes and repair messages. */
  reason: string;
}

/**
 * Roles that describe a person by their place in the scene rather than by
 * their relationship to the author. A story may imply one without naming it —
 * but only where that figure belongs: a building has neighbours, a platform
 * has commuters, and an office has neither.
 */
const UNNAMED_ROLE_WORLDS: Partial<Record<DslRole, DslWorld[] | 'anywhere'>> = {
  stranger: 'anywhere',
  neighbor: ['hall', 'apt', 'bedroom', 'home', 'rental'],
  commuter: ['station', 'street', 'park'],
  guest: ['bar', 'home', 'rental', 'office'],
  host: ['bar', 'rental', 'home', 'office'],
};

function belongsHere(role: DslRole, world: DslWorld): boolean {
  const where = UNNAMED_ROLE_WORLDS[role];
  return where === 'anywhere' || (!!where && where.includes(world));
}

/** Roles the same vocabulary spells two ways; one supports the other. */
const SYNONYMS: Partial<Record<DslRole, DslRole[]>> = {
  coworker: ['colleague'],
  colleague: ['coworker'],
  relative: ['parent', 'sibling'],
  guest: ['host'],
  host: ['guest'],
};

/**
 * A person other than the author is referred to without a relationship word.
 * Evidence that someone exists — not that they are standing in the room.
 */
const OTHER_PERSON =
  /\b(someone|somebody|some ?one else'?s?|a man|a woman|a guy|a girl|the person|another person|whoever|unknown number|strangers?)\b|кто-то|кого-то|кому-то|кем-то|какой-то|какая-то|чуж(ой|ая|ие|ого|ую)|незнаком|мужчин|женщин|человек|ինչ-որ մեկ|ինչ-որ մարդ|անծանոթ|ուրիշ/i;

/**
 * Someone acts inside the scene: they speak to, hand to, follow or look at the
 * author. This is what makes a person on stage rather than merely mentioned.
 */
const PERSON_PRESENT =
  /\b(asked|told|said|says|handed|gave|showed|offered|knocked|followed|stared|whispered|shouted|walked (toward|up|in)|came (in|up|over)|sat down|standing|turned to)\b[^.!?]{0,40}\bme\b|\bme\b[^.!?]{0,40}\b(asked|told|said|handed|gave|offered)\b|\b(someone|somebody|a man|a woman|the person|the (seller|cashier|waiter|driver|clerk|guard|conductor))\b|сказал|спросил|попросил|протянул|дал мне|мне (дал|сказал|протянул)|подош[её]л|вош[её]л|стоял|обернул|посмотрел на меня|ասաց|հարցրեց|խնդրեց|տվեց|ինձ|մոտեցավ|նայեց/i;

function supportFor(
  role: DslRole,
  presence: DslPresence,
  hints: StoryHints,
  dsl: ViviExperienceDSL
): GroundedRole {
  const explicit = hints.roles.includes(role);
  const bySynonym = (SYNONYMS[role] ?? []).some(r => hints.roles.includes(r));
  const publicWorld = WORLD_KNOWLEDGE[WORLDS[dsl.w]]?.public ?? false;

  if (presence === 'bg') {
    const ok = publicWorld || hints.publicScene;
    return {
      role,
      presence,
      support: ok ? 'BACKGROUND_ALLOWED' : 'UNSUPPORTED',
      reason: ok ? 'background crowd in a public place' : 'background crowd in a private place',
    };
  }

  if (explicit) return { role, presence, support: 'EXPLICIT', reason: 'named in the story' };
  if (bySynonym) return { role, presence, support: 'EXPLICIT', reason: 'the story names the same person another way' };

  // A world that keeps a standing place for a role contains that role by
  // design: an office meeting has someone running it, a station has commuters.
  if (WORLD_KNOWLEDGE[WORLDS[dsl.w]]?.roleSlots[role] && (publicWorld || hints.publicScene)) {
    return { role, presence, support: 'STRONGLY_IMPLIED', reason: 'the place itself holds this role' };
  }

  if (belongsHere(role, dsl.w)) {
    const present = PERSON_PRESENT.test(hints.text) || hints.publicScene;
    const exists = present || OTHER_PERSON.test(hints.text);
    // Standing in the room is the expensive claim: it needs someone acting in
    // the scene. Being reachable through a phone or an intercom costs the scene
    // nothing, so it is enough that the story names nobody else who it could be.
    if (presence === 'on' && present) {
      return { role, presence, support: 'STRONGLY_IMPLIED', reason: 'the story has someone acting in the scene' };
    }
    if (presence === 'off' && (exists || hints.roles.length === 0)) {
      return { role, presence, support: 'STRONGLY_IMPLIED', reason: 'the story has no one else this voice could be' };
    }
  }

  return { role, presence, support: 'UNSUPPORTED', reason: 'the story gives no sign of this person' };
}

export function groundCast(dsl: ViviExperienceDSL, hints: StoryHints): GroundedRole[] {
  return dsl.c.map(([role, presence]) => supportFor(role, presence, hints, dsl));
}

/**
 * Roles a commitment or an event actually uses. Dropping one of these would
 * leave a dangling reference, so every argument is scanned — a role is the
 * first argument of `enter` but the second of `call`.
 */
export function referencedRoles(dsl: ViviExperienceDSL): Set<DslRole> {
  const used = new Set<DslRole>();
  const note = (value: unknown) => {
    if (typeof value === 'string' && (ROLES as readonly string[]).includes(value)) used.add(value as DslRole);
  };
  for (const event of dsl.e) for (const arg of event.slice(1)) note(arg);
  for (const [, target] of dsl.a) note(target);
  return used;
}
