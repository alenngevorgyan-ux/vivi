import {
  DSL_VERSION,
  WORLDS,
  GRAMMARS,
  TONES,
  ROLES,
  PRESENCE,
  OBJECTS,
  PLACES,
  SOUNDS,
  VEHICLES,
  EVENT_SIGNATURES,
  LIGHT_MODES,
  ELEVATOR_MODES,
  VERBS,
  CAMERA_GRAMMARS,
  STAGINGS,
  LIGHTING_PROFILES,
  TRUTH_STATUSES,
  LIMITS,
  type DslWorld,
  type DslGrammar,
  type DslTone,
  type DslRole,
  type DslPresence,
  type DslObject,
  type DslEventKind,
  type DslVerb,
  type DslCameraGrammar,
  type DslStaging,
  type DslLighting,
  type DslTruth,
} from './vocabulary.ts';
import { resolvePlace } from './worldKnowledge.ts';

/**
 * VIVI EXPERIENCE DSL v1
 *
 * A compact, positional, enum-only description of a playable situation. It is
 * deliberately small enough for a small model to emit and strict enough that
 * nothing it says can reach the runtime unchecked.
 *
 *   v   version (1)
 *   w   world            g   grammar          t   tone
 *   c   cast             [role, presence, count?]
 *   o   key objects      [object, ...]
 *   e   events, in story order   [kind, ...args]
 *   a   commitments      [verb, target|null, label, observation?, outcome?]
 *   cg  camera grammar   st  staging          lp  lighting profile
 *   x   text             { ti title, op opening line, cu cue line, pr pressure line, q crowd question }
 *   m   moment (optional) { d decision moment, h why it is hard, k known facts[], f play|memory }
 *   ob  observations (optional) [target, what is seen] — looking without consequence
 *
 * `tr` (truth status) and `lang` are stamped by the pipeline from the author's
 * own input, never taken from a model.
 */

export type DslCastMember = [DslRole, DslPresence] | [DslRole, DslPresence, number];
export type DslEvent = [DslEventKind, ...Array<string | number>];
export type DslCommitment = [DslVerb, string | null, string, string?, string?];

export interface DslText {
  ti?: string;
  op?: string;
  cu?: string;
  pr?: string;
  q?: string;
}

/** The situation layer: what is being decided. Absent in scenes written before it existed. */
export interface DslMoment {
  d?: string;
  h?: string;
  k?: string[];
  f?: 'play' | 'memory';
}
/** [target, what is seen, short label?] */
export type DslObservation = [string, string] | [string, string, string];

export interface ViviExperienceDSL {
  v: typeof DSL_VERSION;
  w: DslWorld;
  g: DslGrammar;
  t?: DslTone;
  c: DslCastMember[];
  o: DslObject[];
  e: DslEvent[];
  a: DslCommitment[];
  cg?: DslCameraGrammar;
  st?: DslStaging;
  lp?: DslLighting;
  x?: DslText;
  m?: DslMoment;
  ob?: DslObservation[];
  tr?: DslTruth;
  lang?: string;
}

const TOP_LEVEL_KEYS = new Set(['v', 'w', 'g', 't', 'c', 'o', 'e', 'a', 'cg', 'st', 'lp', 'x', 'm', 'ob', 'tr', 'lang']);
const MOMENT_KEYS = new Set(['d', 'h', 'k', 'f']);
const TEXT_KEYS = new Set(['ti', 'op', 'cu', 'pr', 'q']);
/** Keys that only ever appear when something is trying to place things by hand. */
const COORDINATE_KEYS = /^(x|y|z|pos|position|coords?|coordinates|left|top|zoom|scale|offset|width|height|ms|atMs|duration)$/i;

const has = <T extends readonly string[]>(list: T, value: unknown): value is T[number] =>
  typeof value === 'string' && (list as readonly string[]).includes(value);

export type DslValidation =
  | { ok: true; dsl: ViviExperienceDSL; warnings: string[] }
  | { ok: false; errors: string[] };

export interface ValidateOptions {
  /**
   * `model` output may not carry provenance; `stored` DSL (golden fixtures,
   * compiled posts) must.
   */
  mode?: 'model' | 'stored';
}

/** Scan for anything that looks like a hand-placed coordinate or timing. */
function findRawCoordinates(value: unknown, path: string, out: string[]) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => findRawCoordinates(v, `${path}[${i}]`, out));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      // `x` is legitimately the text block at the top level only.
      if (COORDINATE_KEYS.test(k) && !(path === '' && k === 'x')) {
        out.push(`Raw placement key "${path ? path + '.' : ''}${k}" is not allowed. Use semantic slots, places and grammars.`);
      }
      findRawCoordinates(v, path ? `${path}.${k}` : k, out);
    }
  }
}

function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const t = value.replace(/\s+/g, ' ').trim();
  if (!t) return undefined;
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/**
 * Validate and normalise a DSL document. Treats input as untrusted.
 *
 * Normalisation is conservative: it trims text, removes duplicate objects and
 * adds objects referenced by events or commitments. It never invents events,
 * commitments, cast or truth.
 */
export function validateDSL(input: unknown, options: ValidateOptions = {}): DslValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const mode = options.mode ?? 'model';

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['DSL must be a JSON object.'] };
  }
  const raw = input as Record<string, unknown>;

  for (const key of Object.keys(raw)) {
    if (!TOP_LEVEL_KEYS.has(key)) errors.push(`Unknown field "${key}".`);
  }
  findRawCoordinates(raw, '', errors);

  if (raw.v !== DSL_VERSION) errors.push(`"v" must be ${DSL_VERSION}.`);
  if (!has(Object.keys(WORLDS) as unknown as readonly string[], raw.w)) {
    errors.push(`"w" must be one of ${Object.keys(WORLDS).join('|')}.`);
  }
  if (!has(GRAMMARS, raw.g)) errors.push(`"g" must be one of ${GRAMMARS.join('|')}.`);
  if (raw.t !== undefined && !has(TONES, raw.t)) errors.push(`"t" must be one of ${TONES.join('|')}.`);
  if (raw.cg !== undefined && !has(CAMERA_GRAMMARS, raw.cg)) errors.push(`"cg" must be one of ${CAMERA_GRAMMARS.join('|')}.`);
  if (raw.st !== undefined && !has(STAGINGS, raw.st)) errors.push(`"st" must be one of ${STAGINGS.join('|')}.`);
  if (raw.lp !== undefined && !has(LIGHTING_PROFILES, raw.lp)) errors.push(`"lp" must be one of ${LIGHTING_PROFILES.join('|')}.`);
  if (raw.tr !== undefined && !has(TRUTH_STATUSES, raw.tr)) errors.push(`"tr" must be one of ${TRUTH_STATUSES.join('|')}.`);
  if (mode === 'stored' && raw.tr === undefined) errors.push('Stored DSL must carry a truth status ("tr").');
  if (raw.lang !== undefined && (typeof raw.lang !== 'string' || !/^[a-z]{2}$/.test(raw.lang))) {
    errors.push('"lang" must be a two-letter language code.');
  }

  const world = raw.w as DslWorld;
  const worldKnown = has(Object.keys(WORLDS) as unknown as readonly string[], raw.w);

  /* cast */
  const cast: DslCastMember[] = [];
  const roles = new Set<string>();
  if (!Array.isArray(raw.c)) {
    errors.push('"c" (cast) must be an array; use [] when the player is alone.');
  } else {
    if (raw.c.length > LIMITS.cast) errors.push(`"c" may list at most ${LIMITS.cast} cast entries.`);
    raw.c.forEach((member, i) => {
      if (!Array.isArray(member) || member.length < 2 || member.length > 3) {
        errors.push(`c[${i}] must be [role, presence] or [role, "bg", count].`);
        return;
      }
      const [role, presence, count] = member;
      if (!has(ROLES, role)) errors.push(`c[${i}] role "${String(role)}" is not one of ${ROLES.join('|')}.`);
      if (!has(PRESENCE, presence)) errors.push(`c[${i}] presence "${String(presence)}" must be on|off|bg.`);
      if (count !== undefined) {
        if (presence !== 'bg') errors.push(`c[${i}] only background ("bg") cast may carry a count.`);
        if (!Number.isInteger(count) || (count as number) < 1 || (count as number) > 4) errors.push(`c[${i}] count must be 1–4.`);
      }
      if (has(ROLES, role) && has(PRESENCE, presence)) {
        if (roles.has(role) && presence !== 'bg') errors.push(`c[${i}] role "${role}" is listed twice.`);
        roles.add(role);
        cast.push(count !== undefined ? [role, presence, count as number] : [role, presence]);
      }
    });
  }

  /*
   * Undeclared roles.
   *
   * A role used in an event or a commitment but missing from `c` is an
   * omission, not an invention — the same way an object named by an event is
   * added to `o` rather than rejected. The cast is closed here so the rest of
   * validation has one list, and `castGrounding` still decides whether the
   * story supports that person at all. Presence follows the use: someone who
   * speaks, enters, leaves, approaches or stares is in the room; anyone else
   * is only reachable through a device.
   */
  if (Array.isArray(raw.e) || Array.isArray(raw.a)) {
    const IN_ROOM = new Set(['enter', 'exit', 'approach', 'say', 'stare']);
    const discovered = new Map<DslRole, DslPresence>();
    const note = (role: unknown, inRoom: boolean) => {
      if (!has(ROLES, role) || roles.has(role)) return;
      if (inRoom || !discovered.has(role)) discovered.set(role, inRoom ? 'on' : 'off');
    };
    if (Array.isArray(raw.e)) {
      for (const event of raw.e) {
        if (!Array.isArray(event) || typeof event[0] !== 'string') continue;
        const signature = EVENT_SIGNATURES[event[0] as DslEventKind] as readonly string[] | undefined;
        if (!signature) continue;
        const inRoom = IN_ROOM.has(event[0]);
        signature.forEach((spec, j) => {
          if (spec.replace('?', '') === 'role') note(event[j + 1], inRoom);
        });
      }
    }
    if (Array.isArray(raw.a)) {
      for (const commitment of raw.a) if (Array.isArray(commitment)) note(commitment[1], false);
    }
    for (const [role, presence] of discovered) {
      if (cast.length >= LIMITS.cast) break;
      roles.add(role);
      cast.push([role, presence]);
      warnings.push(`Role "${role}" was used without being listed in the cast; added as "${presence}".`);
    }
  }

  /* objects */
  const objects = new Set<DslObject>();
  if (!Array.isArray(raw.o)) {
    errors.push('"o" (key objects) must be an array.');
  } else {
    raw.o.forEach((obj, i) => {
      if (!has(OBJECTS, obj)) errors.push(`o[${i}] "${String(obj)}" is not one of ${OBJECTS.join('|')}.`);
      else objects.add(obj);
    });
  }

  const checkPlace = (value: unknown, where: string, optional: boolean) => {
    if (value === undefined || value === null) {
      if (!optional) errors.push(`${where} needs a place.`);
      return;
    }
    if (!has(PLACES, value)) {
      errors.push(`${where} place "${String(value)}" is not one of ${PLACES.join('|')}.`);
      return;
    }
    if (worldKnown && !resolvePlace(WORLDS[world], value)) {
      errors.push(`${where} place "${value}" does not exist in world "${world}".`);
    }
  };

  /* events */
  const events: DslEvent[] = [];
  if (!Array.isArray(raw.e)) {
    errors.push('"e" (events) must be an array.');
  } else {
    if (raw.e.length === 0) errors.push('"e" needs at least one event: something must change.');
    if (raw.e.length > LIMITS.events) errors.push(`"e" may list at most ${LIMITS.events} events.`);
    raw.e.forEach((event, i) => {
      const where = `e[${i}]`;
      if (!Array.isArray(event) || event.length === 0) {
        errors.push(`${where} must be [kind, ...args].`);
        return;
      }
      const [kind, ...args] = event;
      if (typeof kind !== 'string' || !(kind in EVENT_SIGNATURES)) {
        errors.push(`${where} kind "${String(kind)}" is not one of ${Object.keys(EVENT_SIGNATURES).join('|')}.`);
        return;
      }
      const signature = EVENT_SIGNATURES[kind as DslEventKind] as readonly string[];
      const required = signature.filter(s => !s.endsWith('?')).length;
      if (args.length < required || args.length > signature.length) {
        errors.push(`${where} "${kind}" takes [${signature.join(', ')}].`);
        return;
      }
      const cleanArgs: Array<string | number> = [];
      signature.forEach((spec, j) => {
        const type = spec.replace('?', '');
        const optional = spec.endsWith('?');
        const value = args[j];
        if (value === undefined || value === null) {
          if (!optional) errors.push(`${where} "${kind}" is missing ${type}.`);
          return;
        }
        switch (type) {
          case 'role':
            if (kind === 'stare' && value === 'crowd') {
              cleanArgs.push('crowd');
            } else if (!has(ROLES, value)) {
              errors.push(`${where} role "${String(value)}" is not a known role.`);
            } else if (!roles.has(value)) {
              errors.push(`${where} role "${value}" is not in the cast.`);
            } else cleanArgs.push(value);
            break;
          case 'obj':
            if (!has(OBJECTS, value)) errors.push(`${where} object "${String(value)}" is not one of ${OBJECTS.join('|')}.`);
            else {
              objects.add(value);
              cleanArgs.push(value);
            }
            break;
          case 'place':
            checkPlace(value, where, optional);
            if (has(PLACES, value)) cleanArgs.push(value);
            break;
          case 'sound':
            if (!has(SOUNDS, value)) errors.push(`${where} sound "${String(value)}" is not one of ${SOUNDS.join('|')}.`);
            else cleanArgs.push(value);
            break;
          case 'vehicle':
            if (!has(VEHICLES, value)) errors.push(`${where} vehicle "${String(value)}" is not one of ${VEHICLES.join('|')}.`);
            else cleanArgs.push(value);
            break;
          case 'text': {
            const text = cleanText(value, LIMITS.text.line);
            if (!text) errors.push(`${where} "${kind}" needs non-empty text.`);
            else cleanArgs.push(text);
            break;
          }
          case 'int':
            if (!Number.isInteger(value) || (value as number) < 3 || (value as number) > 120) {
              errors.push(`${where} "${kind}" count must be a whole number of seconds, 3–120.`);
            } else cleanArgs.push(value as number);
            break;
          case 'mode': {
            const modes: readonly string[] = kind === 'light' ? LIGHT_MODES : kind === 'elevator' ? ELEVATOR_MODES : [];
            if (!has(modes, value)) errors.push(`${where} "${kind}" mode must be one of ${modes.join('|')}.`);
            else cleanArgs.push(value);
            break;
          }
        }
      });
      events.push([kind as DslEventKind, ...cleanArgs]);
    });
  }

  /* commitments */
  const commitments: DslCommitment[] = [];
  if (!Array.isArray(raw.a)) {
    errors.push('"a" (commitments) must be an array.');
  } else {
    const { min, max } = LIMITS.commitments;
    if (raw.a.length < min || raw.a.length > max) {
      errors.push(`"a" must hold ${min}–${max} commitments (found ${raw.a.length}).`);
    }
    const seen = new Set<string>();
    raw.a.forEach((commitment, i) => {
      const where = `a[${i}]`;
      if (!Array.isArray(commitment) || commitment.length < 3 || commitment.length > 5) {
        errors.push(`${where} must be [verb, target|null, label, observation?, outcome?].`);
        return;
      }
      const [verb, target, label, observation, outcome] = commitment;
      if (!has(VERBS, verb)) errors.push(`${where} verb "${String(verb)}" is not one of ${VERBS.join('|')}.`);
      if (target !== null && target !== undefined) {
        const isObject = has(OBJECTS, target);
        const isRole = has(ROLES, target) && roles.has(target);
        const isPlace = has(PLACES, target);
        if (!isObject && !isRole && !isPlace) {
          errors.push(`${where} target "${String(target)}" must be a key object, a cast role or a place.`);
        }
        if (isPlace && !isObject && !isRole) checkPlace(target, where, false);
        if (isObject) objects.add(target);
      }
      const cleanLabel = cleanText(label, LIMITS.text.label);
      if (!cleanLabel) errors.push(`${where} needs a short label.`);
      const key = `${String(verb)}:${String(target ?? '')}`;
      if (seen.has(key)) errors.push(`${where} repeats commitment ${key}.`);
      seen.add(key);
      if (has(VERBS, verb) && cleanLabel) {
        const entry: DslCommitment = [verb, (target as string | null | undefined) ?? null, cleanLabel];
        const obs = cleanText(observation, LIMITS.text.note);
        const out = cleanText(outcome, LIMITS.text.note);
        if (obs || out) entry.push(obs ?? '');
        if (out) entry.push(out);
        commitments.push(entry);
      }
    });
  }

  /* text */
  let text: DslText | undefined;
  if (raw.x !== undefined) {
    if (!raw.x || typeof raw.x !== 'object' || Array.isArray(raw.x)) {
      errors.push('"x" must be an object of short strings.');
    } else {
      text = {};
      for (const [k, v] of Object.entries(raw.x as Record<string, unknown>)) {
        if (!TEXT_KEYS.has(k)) {
          errors.push(`Unknown text field "x.${k}".`);
          continue;
        }
        const max = k === 'ti' ? LIMITS.text.title : LIMITS.text.line;
        const t = cleanText(v, max);
        if (t) (text as Record<string, string>)[k] = t;
      }
    }
  }

  /* moment */
  let moment: DslMoment | undefined;
  if (raw.m !== undefined && raw.m !== null) {
    if (typeof raw.m !== 'object' || Array.isArray(raw.m)) {
      errors.push('"m" must be an object {d, h, k, f}.');
    } else {
      const m = raw.m as Record<string, unknown>;
      moment = {};
      for (const key of Object.keys(m)) if (!MOMENT_KEYS.has(key)) errors.push(`Unknown moment field "m.${key}".`);
      const d = cleanText(m.d, LIMITS.text.line);
      const h = cleanText(m.h, LIMITS.text.note);
      if (d) moment.d = d;
      if (h) moment.h = h;
      if (m.k !== undefined && m.k !== null) {
        if (!Array.isArray(m.k)) errors.push('"m.k" must be an array of short facts.');
        else {
          const facts = m.k.map(f => cleanText(f, LIMITS.text.line)).filter((f): f is string => !!f);
          if (facts.length > LIMITS.facts) warnings.push(`Only the first ${LIMITS.facts} facts are kept.`);
          if (facts.length) moment.k = facts.slice(0, LIMITS.facts);
        }
      }
      if (m.f !== undefined && m.f !== null && m.f !== '') {
        if (m.f !== 'play' && m.f !== 'memory') errors.push('"m.f" must be play|memory.');
        else moment.f = m.f;
      }
    }
  }

  /* observations */
  const observations: DslObservation[] = [];
  if (raw.ob !== undefined && raw.ob !== null) {
    if (!Array.isArray(raw.ob)) errors.push('"ob" must be an array of [target, what is seen].');
    else {
      raw.ob.forEach((entry, i) => {
        const where = `ob[${i}]`;
        if (!Array.isArray(entry) || entry.length < 2 || entry.length > 3) {
          errors.push(`${where} must be [target, what is seen, label?].`);
          return;
        }
        const [target, seen, label] = entry;
        const isObject = has(OBJECTS, target);
        const isRole = has(ROLES, target) && roles.has(target);
        const isPlace = has(PLACES, target) && (!worldKnown || !!resolvePlace(WORLDS[world], target));
        if (!isObject && !isRole && !isPlace) {
          // A look at something the room does not have is dropped, not fatal: it is optional context.
          warnings.push(`${where} target "${String(target)}" is not in this scene; dropped.`);
          return;
        }
        const t = cleanText(seen, LIMITS.text.note);
        if (!t) {
          warnings.push(`${where} has no text; dropped.`);
          return;
        }
        if (isObject) objects.add(target as DslObject);
        const l = cleanText(label, LIMITS.text.label);
        if (observations.length < LIMITS.observations) observations.push(l ? [target as string, t, l] : [target as string, t]);
      });
    }
  }

  if (objects.size > LIMITS.objects + 2) warnings.push(`Many key objects (${objects.size}); scenes read best with one or two.`);

  if (errors.length) return { ok: false, errors };

  const dsl: ViviExperienceDSL = {
    v: DSL_VERSION,
    w: world,
    g: raw.g as DslGrammar,
    ...(raw.t ? { t: raw.t as DslTone } : {}),
    c: cast,
    o: [...objects],
    e: events,
    a: commitments,
    ...(raw.cg ? { cg: raw.cg as DslCameraGrammar } : {}),
    ...(raw.st ? { st: raw.st as DslStaging } : {}),
    ...(raw.lp ? { lp: raw.lp as DslLighting } : {}),
    ...(text && Object.keys(text).length ? { x: text } : {}),
    ...(moment && Object.keys(moment).length ? { m: moment } : {}),
    ...(observations.length ? { ob: observations } : {}),
    ...(raw.tr ? { tr: raw.tr as DslTruth } : {}),
    ...(raw.lang ? { lang: raw.lang as string } : {}),
  };
  return { ok: true, dsl, warnings };
}

/**
 * Remove anything a model is not allowed to decide before validation. A
 * model can never set provenance, so `tr` is dropped here and stamped later
 * from the author's own input.
 */
export function stripModelOnlyFields(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const { tr: _tr, ...rest } = input as Record<string, unknown>;
  return rest;
}

/** Compact, stable serialisation — this is the form that is counted, cached and stored. */
export function serializeDSL(dsl: ViviExperienceDSL): string {
  return JSON.stringify(dsl);
}
