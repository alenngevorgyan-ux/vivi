import type { ViviExperienceDSL } from '../compiler/dsl.ts';
import type { Lang } from '../compiler/i18n.ts';
import { OBJECTS, PLACES, ROLES, WORLDS, type DslObject, type DslPlace } from '../compiler/vocabulary.ts';
import { CARRIED, resolvePlace, sceneHostSlot } from '../compiler/worldKnowledge.ts';
import type { RuntimeActor } from '../runtime/actors.ts';
import type { RuntimeAction, RuntimeKeyObject } from '../runtime/RuntimeCompiler.ts';
import { findFactRef, hasFirstPerson, splitSentences } from './boundary.ts';
import { lookLabel } from './copy.ts';
import { distinctMeanings, enactmentOf, meaningOf } from './meaning.ts';
import {
  EXPERIENCE_VERSION,
  type CommitmentSpec,
  type ExperienceFormat,
  type ExperienceV2,
  type MissingInfo,
  type ObservationSpec,
  type SituationFact,
} from './types.ts';

/**
 * Build the situation layer of a compiled scene.
 *
 * The model proposed a decision moment, a few facts, some things to look at
 * and the deeds on offer. Everything it said is checked against the author's
 * own text before the decision: a fact that cannot be found there is marked
 * `unsourced` for the author to confirm, and a message the scene "shows" when
 * opened is only ever text the story itself quotes.
 */

const has = <T extends readonly string[]>(list: T, v: unknown): v is T[number] =>
  typeof v === 'string' && (list as readonly string[]).includes(v);

export interface SituationInput {
  dsl: ViviExperienceDSL;
  actions: RuntimeAction[];
  actors: RuntimeActor[];
  keyObjects: RuntimeKeyObject[];
  /** The author's text before the decision — the only source facts are checked against. */
  sourceBefore: string;
  lang: Lang;
  /** The author told us what they did (the content never enters this function). */
  hasAuthorAct: boolean;
  /** When the decision moment lands in scene time. */
  cueAtMs: number;
  boundary?: ExperienceV2['boundary'];
  publicScene?: boolean;
}

export function buildSituation(input: SituationInput): ExperienceV2 {
  const { dsl, lang } = input;
  const world = WORLDS[dsl.w];
  const sentences = splitSentences(input.sourceBefore);
  const ref = (claim: string | undefined) => (claim ? findFactRef(claim, sentences) : undefined);
  const actorFor = (role: string) => input.actors.find(a => a.role === role && a.cls !== 'background');

  /* facts */
  const facts: SituationFact[] = (dsl.m?.k ?? []).map((text, i) => {
    const r = ref(text);
    return { id: `fact_${i}`, text, ...(r ? { ref: r } : {}), origin: r ? 'author_text' : 'unsourced' };
  });

  /* a message the story quotes is a confirmed thing the player can see */
  const quoted = (text: string) => !!findFactRef(text, sentences, 0.6);
  const messageOn = new Map<string, string>();
  for (const ev of dsl.e) {
    if (ev[0] === 'msg' && typeof ev[1] === 'string' && typeof ev[2] === 'string' && quoted(ev[2])) messageOn.set(ev[1], ev[2]);
  }

  /* observations */
  const observations: ObservationSpec[] = [];
  (dsl.ob ?? []).forEach(([target, seen, label], i) => {
    const r = ref(seen);
    const base = { id: `look_${i}`, reveals: seen, sourced: !!r, ...(r ? { ref: r } : {}) };
    const named = (fallback: string) => label || fallback;
    if (has(OBJECTS, target)) {
      const obj = input.keyObjects.find(k => k.id === target);
      const slot = obj?.slot ?? sceneHostSlot(dsl, target as DslObject);
      observations.push({ ...base, label: named(lookLabel(lang, { object: target })), targetSlot: slot, objectId: target, ...(slot === CARRIED ? { carried: true } : {}) });
    } else if (has(ROLES, target)) {
      const actor = actorFor(target);
      if (!actor) return; // nobody to look at: never conjure them
      observations.push({ ...base, label: named(lookLabel(lang, { role: target })), targetSlot: `actor:${actor.id}`, actorId: actor.id });
    } else if (has(PLACES, target)) {
      const slot = resolvePlace(world, target as DslPlace);
      if (!slot) return;
      observations.push({ ...base, label: named(lookLabel(lang, { place: target })), targetSlot: slot });
    }
  });

  /* commitments */
  const commitments: CommitmentSpec[] = input.actions.map(action => {
    const verb = action.verb ?? 'wait';
    const person = !!action.actorId || action.targetSlot.startsWith('actor:');
    const target = { objectId: action.objectId, person, publicScene: input.publicScene };
    const shows = action.objectId && (verb === 'read' || verb === 'open' || verb === 'look') ? messageOn.get(action.objectId) : undefined;
    return {
      id: action.id,
      label: action.commitLabel,
      verb,
      meaning: meaningOf(verb, target),
      enactment: enactmentOf(verb, target),
      targetSlot: action.targetSlot,
      ...(action.actorId ? { actorId: action.actorId } : {}),
      ...(action.objectId ? { objectId: action.objectId } : {}),
      ...(action.slotInfo.carried ? { carried: true } : {}),
      ...(shows ? { shows } : {}),
    };
  });

  const moment = dsl.m?.d ? { text: dsl.m.d, ...(ref(dsl.m.d) ? { ref: ref(dsl.m.d) } : {}) } : undefined;
  const whyHard = dsl.m?.h ? { text: dsl.m.h, ...(ref(dsl.m.h) ? { ref: ref(dsl.m.h) } : {}) } : undefined;

  const gate = assessFormat({
    perspective: hasFirstPerson(input.sourceBefore),
    moment: dsl.m?.f === 'memory' ? undefined : moment?.text,
    whyHard: whyHard?.text,
    meanings: commitments.map(c => c.meaning),
    hasAuthorAct: input.hasAuthorAct,
  });

  return {
    version: EXPERIENCE_VERSION,
    format: gate.format,
    missing: gate.missing,
    ...(gate.clarify ? { clarify: gate.clarify } : {}),
    ...(moment ? { moment } : {}),
    ...(whyHard ? { whyHard } : {}),
    facts,
    observations,
    commitments,
    orientationMs: Math.round(Math.max(1500, input.cueAtMs)),
    boundary: input.boundary ?? { mode: 'none', removedChars: 0 },
    origin: 'compiled',
  };
}

/* ------------------------------------------------------------ format gate --- */

export interface FormatInput {
  perspective: boolean;
  moment?: string;
  whyHard?: string;
  meanings: string[];
  hasAuthorAct: boolean;
}

export interface FormatDecision {
  format: ExperienceFormat;
  missing: MissingInfo[];
  clarify?: MissingInfo;
}

/**
 * Not every story should become a game.
 *
 * A playable situation needs a concrete moment, a perspective from inside
 * it, at least two deeds that differ in meaning, a reason it was hard, and the
 * author's own act for the reveal. The gate names what is missing instead of
 * scoring "confidence", and proposes the one question that would help most.
 * It never fills a gap itself.
 */
export function assessFormat(input: FormatInput): FormatDecision {
  const missing: MissingInfo[] = [];
  if (!input.perspective) missing.push('perspective');
  if (!input.moment?.trim()) missing.push('decision_moment');
  if (distinctMeanings(input.meanings as never) < 2) missing.push('alternatives');
  if (!input.whyHard?.trim()) missing.push('stakes');
  if (!input.hasAuthorAct) missing.push('author_act');

  if (!missing.length) return { format: 'playable', missing };
  if (missing.includes('perspective')) return { format: 'text_story', missing };
  // Ask the question whose answer comes from the author's memory, not from us.
  const order: MissingInfo[] = ['decision_moment', 'stakes', 'alternatives', 'author_act'];
  const clarify = order.find(m => missing.includes(m));
  return { format: 'illustrated_memory', missing, ...(clarify ? { clarify } : {}) };
}

/** Re-run the gate after the author removed items or answered a question in preview. */
export function regate(experience: ExperienceV2, change: { hasAuthorAct: boolean; perspective?: boolean }): ExperienceV2 {
  const removed = new Set(experience.removed ?? []);
  const commitments = experience.commitments.filter(c => !removed.has(c.id));
  const gate = assessFormat({
    perspective: change.perspective ?? !experience.missing.includes('perspective'),
    moment: experience.moment?.text,
    whyHard: experience.whyHard?.text,
    meanings: commitments.map(c => c.meaning),
    hasAuthorAct: change.hasAuthorAct,
  });
  const { clarify: _drop, ...rest } = experience;
  return { ...rest, format: gate.format, missing: gate.missing, ...(gate.clarify ? { clarify: gate.clarify } : {}) };
}
