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
  type DslEventKind,
} from './vocabulary.ts';
import { hintLine, type StoryHints } from './preprocess.ts';

/**
 * Structured-output form of the Vivi DSL.
 *
 * Strict JSON-schema decoding (OpenAI-style `strict: true`) cannot express
 * positional tuples, so a model under a schema writes the same program as
 * small objects — the "wire" form — and `wireToDsl` turns it back into the
 * positional DSL losslessly before the ordinary validator sees it. Nothing is
 * repaired or guessed during conversion: the validator stays the only judge.
 *
 * Every enum below is read from vocabulary.ts. There is no second list.
 */

/** Wire property name for each event argument type. */
const ARG_KEY: Record<string, string> = {
  role: 'r',
  obj: 'o',
  place: 'p',
  sound: 's',
  vehicle: 'v',
  text: 'tx',
  int: 'n',
  mode: 'm',
};

type JsonSchema = Record<string, unknown>;

const str = (values: readonly string[]): JsonSchema => ({ type: 'string', enum: [...values] });
const nullable = (schema: JsonSchema): JsonSchema => ({ anyOf: [schema, { type: 'null' }] });
const obj = (properties: Record<string, JsonSchema>): JsonSchema => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

/** Repeated enums are defined once and referenced, which keeps the schema (and its token cost) small. */
const ref = (name: string): JsonSchema => ({ $ref: `#/$defs/${name}` });

function argSchema(kind: DslEventKind, type: string): JsonSchema {
  switch (type) {
    case 'role':
      return kind === 'stare' ? str([...ROLES, 'crowd']) : ref('role');
    case 'obj':
      return ref('obj');
    case 'place':
      return ref('place');
    case 'sound':
      return str(SOUNDS);
    case 'vehicle':
      return str(VEHICLES);
    case 'int':
      return { type: 'integer' };
    case 'mode':
      return str(kind === 'light' ? LIGHT_MODES : kind === 'elevator' ? ELEVATOR_MODES : []);
    default:
      return { type: 'string' };
  }
}

function eventSchema(kind: DslEventKind): JsonSchema {
  const properties: Record<string, JsonSchema> = { k: str([kind]) };
  for (const spec of EVENT_SIGNATURES[kind] as readonly string[]) {
    const type = spec.replace('?', '');
    const schema = argSchema(kind, type);
    properties[ARG_KEY[type]] = spec.endsWith('?') ? nullable(schema) : schema;
  }
  return obj(properties);
}

const TARGETS = [...new Set<string>([...OBJECTS, ...ROLES, ...PLACES])];

/** The strict JSON Schema for one Vivi DSL program, built from the vocabulary. */
export function buildDslJsonSchema(): JsonSchema {
  const schema = obj({
    w: str(Object.keys(WORLDS)),
    g: str(GRAMMARS),
    t: str(TONES),
    c: { type: 'array', items: obj({ r: ref('role'), p: str(PRESENCE), n: nullable({ type: 'integer' }) }) },
    o: { type: 'array', items: ref('obj') },
    e: { type: 'array', items: { anyOf: (Object.keys(EVENT_SIGNATURES) as DslEventKind[]).map(eventSchema) } },
    a: {
      type: 'array',
      items: obj({ v: str(VERBS), t: nullable(str(TARGETS)), l: { type: 'string' }, ob: { type: 'string' }, out: { type: 'string' } }),
    },
    cg: str(CAMERA_GRAMMARS),
    st: str(STAGINGS),
    x: obj({ ti: { type: 'string' }, op: { type: 'string' }, q: { type: 'string' } }),
  });
  return { ...schema, $defs: { role: str(ROLES), obj: str(OBJECTS), place: str(PLACES) } };
}

export const DSL_SCHEMA_NAME = 'vivi_dsl';

const eventLine = (Object.keys(EVENT_SIGNATURES) as DslEventKind[])
  .map(kind => {
    const args = (EVENT_SIGNATURES[kind] as readonly string[]).map(spec => {
      const type = spec.replace('?', '');
      return `${ARG_KEY[type]}:${type}${spec.endsWith('?') ? '?' : ''}`;
    });
    return `${kind}{${args.join(',')}}`;
  })
  .join(' ');

/**
 * System prompt for schema-constrained providers. Same task and truth rules as
 * MODEL_SYSTEM_PROMPT, with the shape written in wire form. The vocabulary is
 * still listed because some hosts enforce the schema by constrained decoding
 * without ever showing it to the model.
 */
export const STRUCTURED_SYSTEM_PROMPT = [
  'Turn a short personal story into a Vivi scene program: a tiny scene someone can walk into and make one choice in.',
  'Reply with the JSON object the schema describes.',
  '',
  'Fields:',
  `w world: ${Object.keys(WORLDS).join('|')}`,
  `g situation: ${GRAMMARS.join('|')}`,
  `t tone: ${TONES.join('|')}`,
  `c cast {r role, p presence, n count}: roles ${ROLES.join('|')}; p on=in the room | off=only through a phone or intercom | bg=background people; n is 1-4 for bg, else null. Use [] if the player is alone.`,
  `o key objects: ${OBJECTS.join('|')}`,
  `e events in story order {k kind, ...args}; optional args (?) may be null: ${eventLine}`,
  `  places: ${PLACES.join('|')}; sounds: ${SOUNDS.join('|')}; vehicles: ${VEHICLES.join('|')}; light m: ${LIGHT_MODES.join('|')}; elevator m: ${ELEVATOR_MODES.join('|')}`,
  `a commitments {v verb, t target, l label, ob observation, out outcome}: verbs ${VERBS.join('|')}; t is a key object, a cast role or a place, or null`,
  `cg camera: ${CAMERA_GRAMMARS.join('|')}`,
  `st staging: ${STAGINGS.join('|')}`,
  'x {ti title, op opening line, q question to the reader}',
  '',
  'Rules:',
  '- Only people the story gives. Every role used in e or a must be in c. Crowds (bg) are fine in public places.',
  '- Events: what is set up, the moment something changes, then what closes the window. 3-9 events.',
  '- 2-4 commitments, never paraphrases of one act: at least two must reach for different things — an object, a person in the room, a way out, or staying put.',
  "- Write l, ob, out, x and spoken lines in the story's language. l ≤6 words; others ≤20 words.",
  '- out is only the next moment after the player acts. Never say what really happened afterwards.',
].join('\n');

export function structuredUserPrompt(story: string, hints: StoryHints): string {
  return `STORY: ${hints.text || story}\nHINTS: ${hintLine(hints)}`;
}

/** Short system line for the single repair turn; the schema carries the shape. */
export const STRUCTURED_REPAIR_SYSTEM =
  'Fix this Vivi scene program. Change only what the errors name, and invent no new story facts. Every role used in e or a must be listed in c. Reply with the corrected JSON object.';

export function structuredRepairPrompt(invalidJson: string, errors: string[]): string {
  return `ERRORS:\n${errors
    .slice(0, 12)
    .map(e => `- ${e}`)
    .join('\n')}\nJSON:\n${invalidJson}`;
}

/* ------------------------------------------------------------ conversion */

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** A parsed reply is in wire form when its cast or commitments are objects. */
export function isWireForm(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const first = (k: string) => (Array.isArray(value[k]) ? (value[k] as unknown[])[0] : undefined);
  return isRecord(first('c')) || isRecord(first('a')) || isRecord(first('e'));
}

/**
 * Wire form → positional DSL. Lossless and non-judgemental: values are moved,
 * never invented or corrected; anything malformed is passed through for the
 * validator to reject with a precise error.
 */
export function wireToDsl(value: unknown): unknown {
  if (!isWireForm(value)) return value;
  const wire = value as Record<string, unknown>;
  const out: Record<string, unknown> = { ...wire, v: wire.v ?? DSL_VERSION };

  if (Array.isArray(wire.c)) {
    out.c = wire.c.map(m => {
      if (!isRecord(m)) return m;
      return m.n === null || m.n === undefined ? [m.r, m.p] : [m.r, m.p, m.n];
    });
  }

  if (Array.isArray(wire.e)) {
    out.e = wire.e.map(ev => {
      if (!isRecord(ev)) return ev;
      const kind = ev.k as DslEventKind;
      const signature = (EVENT_SIGNATURES as Record<string, readonly string[]>)[kind as string];
      if (!signature) return [ev.k];
      const args = signature.map(spec => ev[ARG_KEY[spec.replace('?', '')]]);
      while (args.length && (args[args.length - 1] === null || args[args.length - 1] === undefined)) args.pop();
      return [kind, ...args];
    });
  }

  if (Array.isArray(wire.a)) {
    out.a = wire.a.map(c => {
      if (!isRecord(c)) return c;
      const entry: unknown[] = [c.v, c.t ?? null, c.l];
      if (c.ob !== undefined || c.out !== undefined) entry.push(c.ob ?? '');
      if (c.out !== undefined) entry.push(c.out);
      return entry;
    });
  }

  if (isRecord(wire.x)) {
    const x: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(wire.x)) if (v !== null && v !== '') x[k] = v;
    out.x = x;
  }
  for (const k of ['t', 'cg', 'st'] as const) if (out[k] === null) delete out[k];
  return out;
}
