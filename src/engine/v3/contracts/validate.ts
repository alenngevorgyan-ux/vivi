/**
 * Runtime validation for the V3 contracts. TypeScript types validate nothing
 * about untrusted JSON, so every boundary (semantic proposal, public manifest,
 * stored post) is checked here: closed key sets, enums, hard caps,
 * cross-references, graph shape and forbidden content.
 *
 * Issues carry a path and a code, never the offending text: diagnostics must
 * not copy story text into logs.
 */

import {
  BEAT_DELIVERIES,
  BEAT_EMPHASES,
  CAPS,
  FACT_KINDS,
  FORMATS,
  FORMAT_SCENE_MAX,
  INTENT_VERBS,
  LAUNCH_CAPS,
  LOCALES,
  OBSERVATION_PRESENTATIONS,
  PORTAL_AUTHORITIES,
  PRESENTATION_MOODS,
  PRESENTATION_TIMES,
  SCENE_KINDS,
  SCENE_PURPOSES,
  SCENE_VIEWPOINTS,
  SEMANTIC_SCHEMA_VERSION,
  type Format,
  type SemanticPlanV3,
} from './semantic.ts';
import { POST_SCHEMA_VERSION, RUNTIME_MANIFEST_VERSION, type PlaybackManifestV3, type StoredPostV3 } from './manifest.ts';

export type IssueCode =
  | 'type'
  | 'unknown_key'
  | 'missing_key'
  | 'enum'
  | 'id_format'
  | 'text_format'
  | 'forbidden_content'
  | 'cap'
  | 'duplicate_id'
  | 'unknown_ref'
  | 'graph'
  | 'cycle'
  | 'unreachable'
  | 'unsupported'
  | 'version'
  | 'reveal_leak';

export interface ValidationIssue {
  path: string;
  code: IssueCode;
  message: string;
}

export type ValidationResult<T> = { ok: true; value: T; issues: [] } | { ok: false; issues: ValidationIssue[] };

export interface ValidationOptions {
  /** `launch` additionally enforces the first slices' caps (4 scenes, 3 locations). */
  profile?: 'contract' | 'launch';
  /** Approved vocabularies. When given, ids outside them are rejected; syntax is always checked. */
  vocab?: { assetClasses?: ReadonlySet<string>; kitFamilies?: ReadonlySet<string>; compositions?: ReadonlySet<string>; roles?: ReadonlySet<string> };
}

const MAX_ISSUES = 60;
export const ID_RE = /^[a-z][a-z0-9_-]{0,63}$/;
const REVISION_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[a-z0-9.]+)?$/;
const HASH_RE = /^[a-f0-9]{16,128}$/;

/** Free text is rendered as text only; these patterns are never legitimate story content. */
const FORBIDDEN_TEXT: RegExp[] = [
  /[a-z][a-z0-9+.-]*:\/\//i, // any URL
  /\bwww\./i,
  /\b(?:javascript|data|vbscript|file|blob):/i,
  /<\s*\/?\s*[a-z!?]/i, // HTML
  /\$\{/, // template expression
  /=>/,
  /\b(?:eval|function)\s*\(/i,
  /\{[^}]*:[^}]*\}/, // a CSS-like block
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/,
];

const isRec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

class Ctx {
  issues: ValidationIssue[] = [];
  add(path: string, code: IssueCode, message: string) {
    if (this.issues.length < MAX_ISSUES) this.issues.push({ path, code, message });
  }
  get ok() {
    return this.issues.length === 0;
  }
}

/* ------------------------------------------------------------ primitives -- */

function keys(c: Ctx, v: unknown, path: string, required: string[], optional: string[] = []): v is Record<string, unknown> {
  if (!isRec(v)) {
    c.add(path, 'type', 'expected an object');
    return false;
  }
  const allowed = new Set([...required, ...optional]);
  for (const k of Object.keys(v)) if (!allowed.has(k)) c.add(`${path}.${k}`, 'unknown_key', 'key is not part of the contract');
  for (const k of required) if (!(k in v)) c.add(`${path}.${k}`, 'missing_key', 'required key is missing');
  return true;
}

function idv(c: Ctx, v: unknown, path: string): string | undefined {
  if (typeof v !== 'string' || !ID_RE.test(v)) {
    c.add(path, 'id_format', 'expected a lowercase identifier');
    return undefined;
  }
  return v;
}

function text(c: Ctx, v: unknown, path: string, max: number): string | undefined {
  if (typeof v !== 'string') {
    c.add(path, 'type', 'expected text');
    return undefined;
  }
  const t = v.trim();
  if (t.length === 0) {
    c.add(path, 'text_format', 'text is empty');
    return undefined;
  }
  if (v.length > max) {
    c.add(path, 'cap', `text exceeds ${max} characters`);
    return undefined;
  }
  if (FORBIDDEN_TEXT.some(re => re.test(v))) {
    c.add(path, 'forbidden_content', 'text contains a URL, markup, style or expression');
    return undefined;
  }
  return v;
}

function oneOf<T extends string>(c: Ctx, v: unknown, path: string, allowed: readonly T[]): T | undefined {
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
    c.add(path, 'enum', 'value is not in the closed vocabulary');
    return undefined;
  }
  return v as T;
}

function list(c: Ctx, v: unknown, path: string, max: number, min = 0): unknown[] {
  if (!Array.isArray(v)) {
    c.add(path, 'type', 'expected a list');
    return [];
  }
  if (v.length > max) c.add(path, 'cap', `more than ${max} entries`);
  if (v.length < min) c.add(path, 'cap', `fewer than ${min} entries`);
  return v.length > max ? v.slice(0, max) : v;
}

function idList(c: Ctx, v: unknown, path: string, max: number, min = 0): string[] {
  const out: string[] = [];
  list(c, v, path, max, min).forEach((x, i) => {
    const s = idv(c, x, `${path}[${i}]`);
    if (s) out.push(s);
  });
  return out;
}

function mark(c: Ctx, v: unknown, path: string) {
  if (!keys(c, v, path, ['x', 'y', 'facing'])) return;
  for (const k of ['x', 'y'] as const) {
    const n = v[k];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 100) c.add(`${path}.${k}`, 'type', 'expected a number between 0 and 100');
  }
  idv(c, v.facing, `${path}.facing`);
}

/* ------------------------------------------------------------------ refs -- */

interface Refs {
  facts: Set<string>;
  entities: Map<string, 'actor' | 'object'>;
  locations: Set<string>;
  scenes: Set<string>;
  beats: Set<string>;
  portals: Set<string>;
  observations: Set<string>;
  preparations: Set<string>;
  opportunities: Set<string>;
}

function collect(c: Ctx, raw: unknown, path: string, set: Set<string>, what: string, idKey = 'id'): void {
  if (!Array.isArray(raw)) return;
  raw.forEach((item, i) => {
    const id = isRec(item) ? item[idKey] : undefined;
    if (typeof id !== 'string' || !ID_RE.test(id)) return; // reported when the item itself is validated
    if (set.has(id)) c.add(`${path}[${i}].${idKey}`, 'duplicate_id', `duplicate ${what} id`);
    set.add(id);
  });
}

const newRefs = (): Refs => ({
  facts: new Set(),
  entities: new Map(),
  locations: new Set(),
  scenes: new Set(),
  beats: new Set(),
  portals: new Set(),
  observations: new Set(),
  preparations: new Set(),
  opportunities: new Set(),
});

function collectEntities(c: Ctx, refs: Refs, rawActors: unknown, aPath: string, rawObjects: unknown, oPath: string, ownerOf?: (item: unknown) => void) {
  const add = (raw: unknown, path: string, kind: 'actor' | 'object') => {
    if (!Array.isArray(raw)) return;
    raw.forEach((item, i) => {
      const id = isRec(item) ? item.id : undefined;
      if (typeof id !== 'string' || !ID_RE.test(id)) return;
      if (refs.entities.has(id)) c.add(`${path}[${i}].id`, 'duplicate_id', 'entity id is already used');
      refs.entities.set(id, kind);
      ownerOf?.(item);
    });
  };
  add(rawActors, aPath, 'actor');
  add(rawObjects, oPath, 'object');
}

function collectBeats(c: Ctx, refs: Refs, rawScenes: unknown, path: string) {
  if (!Array.isArray(rawScenes)) return;
  rawScenes.forEach((s, i) => {
    if (isRec(s) && Array.isArray(s.beats)) collect(c, s.beats, `${path}[${i}].beats`, refs.beats, 'beat');
  });
}

const need = (c: Ctx, set: Set<string>, id: string | undefined, path: string, what: string) => {
  if (id !== undefined && !set.has(id)) c.add(path, 'unknown_ref', `unknown ${what}`);
};

function factRefs(c: Ctx, refs: Refs, v: unknown, path: string, max: number, min = 0): string[] {
  const ids = idList(c, v, path, max, min);
  ids.forEach((id, i) => need(c, refs.facts, id, `${path}[${i}]`, 'fact'));
  return ids;
}

/* ----------------------------------------------------------------- gates -- */

function gate(c: Ctx, refs: Refs, v: unknown, path: string, depth = 1): void {
  if (!isRec(v) || typeof v.kind !== 'string') {
    c.add(path, 'type', 'expected a gate');
    return;
  }
  if (depth > CAPS.gateDepth) {
    c.add(path, 'cap', `gates nest at most ${CAPS.gateDepth} deep`);
    return;
  }
  switch (v.kind) {
    case 'always':
      keys(c, v, path, ['kind']);
      return;
    case 'beat_delivered':
      if (keys(c, v, path, ['kind', 'id'])) need(c, refs.beats, idv(c, v.id, `${path}.id`), `${path}.id`, 'beat');
      return;
    case 'fact_received':
      if (keys(c, v, path, ['kind', 'id'])) need(c, refs.facts, idv(c, v.id, `${path}.id`), `${path}.id`, 'fact');
      return;
    case 'entity_at':
      if (keys(c, v, path, ['kind', 'id', 'location'])) {
        const id = idv(c, v.id, `${path}.id`);
        if (id !== undefined && !refs.entities.has(id)) c.add(`${path}.id`, 'unknown_ref', 'unknown entity');
        need(c, refs.locations, idv(c, v.location, `${path}.location`), `${path}.location`, 'location');
      }
      return;
    case 'state_is':
      if (keys(c, v, path, ['kind', 'key', 'value'])) {
        idv(c, v.key, `${path}.key`);
        text(c, v.value, `${path}.value`, 64);
      }
      return;
    case 'all':
      if (keys(c, v, path, ['kind', 'gates'])) {
        const gates = list(c, v.gates, `${path}.gates`, 4, 1);
        gates.forEach((g, i) => gate(c, refs, g, `${path}.gates[${i}]`, depth + 1));
      }
      return;
    default:
      c.add(path, 'enum', 'unknown gate kind');
  }
}

function entityRef(c: Ctx, refs: Refs, v: unknown, path: string): void {
  if (!isRec(v) || typeof v.kind !== 'string') {
    c.add(path, 'type', 'expected an entity reference');
    return;
  }
  switch (v.kind) {
    case 'self':
      keys(c, v, path, ['kind']);
      return;
    case 'actor':
    case 'object':
      if (keys(c, v, path, ['kind', 'id'])) {
        const id = idv(c, v.id, `${path}.id`);
        if (id !== undefined && refs.entities.get(id) !== v.kind) c.add(`${path}.id`, 'unknown_ref', `unknown ${v.kind}`);
      }
      return;
    case 'portal':
      if (keys(c, v, path, ['kind', 'id'])) need(c, refs.portals, idv(c, v.id, `${path}.id`), `${path}.id`, 'portal');
      return;
    default:
      c.add(path, 'enum', 'unknown entity reference kind');
  }
}

/* ----------------------------------------------------------------- graph -- */

interface GraphInput {
  format: unknown;
  tension: unknown;
  scenes: unknown;
  scenesPath: string;
  spine: unknown;
  portals: unknown;
  observations: unknown;
  preparations: unknown;
  opportunities: unknown;
  primaryDecision: unknown;
  truthBoundary: unknown;
}

function validateTension(c: Ctx, refs: Refs, v: unknown, path: string) {
  if (!keys(c, v, path, ['description', 'perspectiveActor', 'poles', 'unknowns'])) return;
  text(c, v.description, `${path}.description`, CAPS.descriptionLength);
  const actor = idv(c, v.perspectiveActor, `${path}.perspectiveActor`);
  if (actor !== undefined && refs.entities.get(actor) !== 'actor') c.add(`${path}.perspectiveActor`, 'unknown_ref', 'unknown actor');
  const poles = list(c, v.poles, `${path}.poles`, 2, 2);
  poles.forEach((p, i) => {
    if (!keys(c, p, `${path}.poles[${i}]`, ['motive', 'stakeFacts'])) return;
    text(c, p.motive, `${path}.poles[${i}].motive`, CAPS.motiveLength);
    factRefs(c, refs, p.stakeFacts, `${path}.poles[${i}].stakeFacts`, 6, 1);
  });
  list(c, v.unknowns, `${path}.unknowns`, CAPS.unknowns).forEach((u, i) => text(c, u, `${path}.unknowns[${i}]`, CAPS.descriptionLength));
}

function validateEvent(c: Ctx, refs: Refs, e: unknown, path: string) {
  if (!isRec(e) || typeof e.kind !== 'string') {
    c.add(path, 'type', 'expected an event');
    return;
  }
  const entity = (v: unknown, p: string, kind?: 'actor' | 'object') => {
    const id = idv(c, v, p);
    if (id !== undefined && (!refs.entities.has(id) || (kind && refs.entities.get(id) !== kind))) c.add(p, 'unknown_ref', kind ? `unknown ${kind}` : 'unknown entity');
  };
  switch (e.kind) {
    case 'deliver':
      if (keys(c, e, path, ['kind', 'facts'])) factRefs(c, refs, e.facts, `${path}.facts`, 6, 1);
      return;
    case 'quote':
      if (keys(c, e, path, ['kind', 'actor', 'fact'])) {
        entity(e.actor, `${path}.actor`, 'actor');
        need(c, refs.facts, idv(c, e.fact, `${path}.fact`), `${path}.fact`, 'fact');
      }
      return;
    case 'transfer':
      if (keys(c, e, path, ['kind', 'entity', 'to', 'facts'])) {
        entity(e.entity, `${path}.entity`);
        need(c, refs.locations, idv(c, e.to, `${path}.to`), `${path}.to`, 'location');
        factRefs(c, refs, e.facts, `${path}.facts`, 4, 1);
      }
      return;
    case 'device_cue':
      if (keys(c, e, path, ['kind', 'object', 'fact'])) {
        entity(e.object, `${path}.object`, 'object');
        need(c, refs.facts, idv(c, e.fact, `${path}.fact`), `${path}.fact`, 'fact');
      }
      return;
    case 'portal_state':
      if (keys(c, e, path, ['kind', 'portal', 'state', 'fact'])) {
        need(c, refs.portals, idv(c, e.portal, `${path}.portal`), `${path}.portal`, 'portal');
        oneOf(c, e.state, `${path}.state`, ['open', 'closed'] as const);
        need(c, refs.facts, idv(c, e.fact, `${path}.fact`), `${path}.fact`, 'fact');
      }
      return;
    case 'hold':
      keys(c, e, path, ['kind']);
      return;
    default:
      c.add(path, 'enum', 'unknown event kind');
  }
}

function validateGraph(c: Ctx, refs: Refs, g: GraphInput, opts: ValidationOptions, requireText = false) {
  const format = oneOf(c, g.format, 'format', FORMATS) as Format | undefined;
  const playable = format === 'micro' || format === 'situation' || format === 'sequence';

  /* tension / decision / boundary agree with the format */
  if (g.tension === null) {
    if (playable) c.add('tension', 'graph', 'a playable format needs a tension');
  } else {
    if (format === 'memory' || format === 'text') c.add('tension', 'graph', 'memory and text formats carry no tension');
    validateTension(c, refs, g.tension, 'tension');
  }

  /* scenes */
  const scenes = list(c, g.scenes, g.scenesPath, CAPS.scenes);
  const sceneLocation = new Map<string, string>();
  const sceneObs = new Map<string, string[]>();
  const sceneOpps = new Map<string, string[]>();
  let events = 0;
  const profileMax = opts.profile === 'launch' ? LAUNCH_CAPS.scenes : CAPS.scenes;
  if (scenes.length > profileMax) c.add(g.scenesPath, 'cap', `more than ${profileMax} scenes for this profile`);
  if (format && scenes.length > FORMAT_SCENE_MAX[format]) c.add(g.scenesPath, 'cap', `more than ${FORMAT_SCENE_MAX[format]} scenes for this format`);
  if (!requireText && scenes.length === 0 && format !== 'text') c.add(g.scenesPath, 'cap', 'at least one scene is required');

  const beatAfter = new Map<string, string[]>();
  scenes.forEach((s, i) => {
    const p = `${g.scenesPath}[${i}]`;
    if (!keys(c, s, p, ['id', 'location', 'kind', 'viewpoint', 'purpose', 'requiredFacts', 'beats', 'observationIds', 'opportunityIds', 'composition'])) return;
    const id = idv(c, s.id, `${p}.id`);
    const loc = idv(c, s.location, `${p}.location`);
    need(c, refs.locations, loc, `${p}.location`, 'location');
    if (id && loc) sceneLocation.set(id, loc);
    oneOf(c, s.kind, `${p}.kind`, SCENE_KINDS);
    oneOf(c, s.viewpoint, `${p}.viewpoint`, SCENE_VIEWPOINTS);
    oneOf(c, s.purpose, `${p}.purpose`, SCENE_PURPOSES);
    factRefs(c, refs, s.requiredFacts, `${p}.requiredFacts`, CAPS.facts);
    const comp = idv(c, s.composition, `${p}.composition`);
    if (comp && opts.vocab?.compositions && !opts.vocab.compositions.has(comp)) c.add(`${p}.composition`, 'enum', 'composition is not an approved recipe');
    const obs = idList(c, s.observationIds, `${p}.observationIds`, CAPS.observations);
    obs.forEach((o, j) => need(c, refs.observations, o, `${p}.observationIds[${j}]`, 'observation'));
    const opps = idList(c, s.opportunityIds, `${p}.opportunityIds`, CAPS.opportunities);
    opps.forEach((o, j) => need(c, refs.opportunities, o, `${p}.opportunityIds[${j}]`, 'opportunity'));
    if (id) {
      sceneObs.set(id, obs);
      sceneOpps.set(id, opps);
    }
    list(c, s.beats, `${p}.beats`, CAPS.beatsPerScene).forEach((b, j) => {
      const bp = `${p}.beats[${j}]`;
      if (!keys(c, b, bp, ['id', 'after', 'events', 'emphasis', 'delivery'])) return;
      const bid = idv(c, b.id, `${bp}.id`);
      const after = idList(c, b.after, `${bp}.after`, CAPS.beatsPerScene);
      after.forEach((a, k) => {
        need(c, refs.beats, a, `${bp}.after[${k}]`, 'beat');
        if (a === bid) c.add(`${bp}.after[${k}]`, 'cycle', 'a beat cannot follow itself');
      });
      if (bid) beatAfter.set(bid, after);
      oneOf(c, b.emphasis, `${bp}.emphasis`, BEAT_EMPHASES);
      oneOf(c, b.delivery, `${bp}.delivery`, BEAT_DELIVERIES);
      const evs = list(c, b.events, `${bp}.events`, CAPS.events);
      events += evs.length;
      evs.forEach((e, k) => validateEvent(c, refs, e, `${bp}.events[${k}]`));
    });
  });
  if (events > CAPS.events) c.add(g.scenesPath, 'cap', `more than ${CAPS.events} semantic events in total`);
  detectBeatCycles(c, beatAfter, g.scenesPath);

  /* spine */
  const spine = idList(c, g.spine, 'spine', CAPS.scenes);
  const spineIndex = new Map<string, number>();
  spine.forEach((id, i) => {
    if (spineIndex.has(id)) c.add(`spine[${i}]`, 'duplicate_id', 'scene appears twice on the spine');
    spineIndex.set(id, i);
    need(c, refs.scenes, id, `spine[${i}]`, 'scene');
  });
  if (format !== 'text' && spine.length === 0) c.add('spine', 'cap', 'the spine needs at least one scene');

  /* observations */
  const observations = list(c, g.observations, 'observations', CAPS.observations);
  const observedByScene = new Set<string>();
  sceneObs.forEach(o => o.forEach(x => observedByScene.add(x)));
  observations.forEach((o, i) => {
    const p = `observations[${i}]`;
    if (!keys(c, o, p, ['id', 'target', 'label', 'facts', 'available', 'presentation'])) return;
    const id = idv(c, o.id, `${p}.id`);
    entityRef(c, refs, o.target, `${p}.target`);
    text(c, o.label, `${p}.label`, CAPS.labelLength);
    factRefs(c, refs, o.facts, `${p}.facts`, 6, 1);
    gate(c, refs, o.available, `${p}.available`);
    oneOf(c, o.presentation, `${p}.presentation`, OBSERVATION_PRESENTATIONS);
    if (id && !observedByScene.has(id)) c.add(`${p}.id`, 'unreachable', 'observation is not offered by any scene');
  });

  /* preparations */
  list(c, g.preparations, 'preparations', CAPS.preparations).forEach((pr, i) => {
    const p = `preparations[${i}]`;
    if (!keys(c, pr, p, ['id', 'target', 'label', 'available', 'supportFacts', 'action'])) return;
    idv(c, pr.id, `${p}.id`);
    entityRef(c, refs, pr.target, `${p}.target`);
    text(c, pr.label, `${p}.label`, CAPS.labelLength);
    gate(c, refs, pr.available, `${p}.available`);
    factRefs(c, refs, pr.supportFacts, `${p}.supportFacts`, 4);
    const a = pr.action;
    if (!isRec(a) || typeof a.kind !== 'string') return void c.add(`${p}.action`, 'type', 'expected an action recipe');
    if (a.kind === 'reposition') {
      if (keys(c, a, `${p}.action`, ['kind', 'markRole'])) idv(c, a.markRole, `${p}.action.markRole`);
    } else if (a.kind === 'hold_own_object' || a.kind === 'put_back_own_object') {
      if (keys(c, a, `${p}.action`, ['kind', 'object'])) {
        const o = idv(c, a.object, `${p}.action.object`);
        if (o !== undefined && refs.entities.get(o) !== 'object') c.add(`${p}.action.object`, 'unknown_ref', 'unknown object');
      }
    } else c.add(`${p}.action.kind`, 'enum', 'unsupported preparation recipe');
  });

  /* opportunities */
  const decision = g.primaryDecision;
  const decisionId = isRec(decision) && typeof decision.id === 'string' ? decision.id : undefined;
  const opportunities = list(c, g.opportunities, 'opportunities', CAPS.opportunities);
  opportunities.forEach((o, i) => {
    const p = `opportunities[${i}]`;
    if (isRec(o) && 'window' in o) {
      c.add(`${p}.window`, 'unsupported', 'timed opportunity windows are not supported in this runtime');
      return;
    }
    if (!keys(c, o, p, ['id', 'decision', 'target', 'verb', 'label', 'motive', 'fearedCostFacts', 'feasibilityFacts', 'available'])) return;
    idv(c, o.id, `${p}.id`);
    const d = idv(c, o.decision, `${p}.decision`);
    if (d !== undefined && d !== decisionId) c.add(`${p}.decision`, 'unknown_ref', 'opportunity belongs to no primary decision');
    entityRef(c, refs, o.target, `${p}.target`);
    oneOf(c, o.verb, `${p}.verb`, INTENT_VERBS);
    text(c, o.label, `${p}.label`, CAPS.labelLength);
    text(c, o.motive, `${p}.motive`, CAPS.motiveLength);
    factRefs(c, refs, o.fearedCostFacts, `${p}.fearedCostFacts`, 4);
    factRefs(c, refs, o.feasibilityFacts, `${p}.feasibilityFacts`, 4, 1);
    gate(c, refs, o.available, `${p}.available`);
  });

  /* primary decision */
  if (decision === null) {
    if (playable) c.add('primaryDecision', 'graph', 'a playable format needs a primary decision');
    if (opportunities.length > 0) c.add('opportunities', 'graph', 'opportunities exist without a primary decision');
  } else if (keys(c, decision, 'primaryDecision', ['id', 'scene', 'minimumKnowledge', 'options'])) {
    if (format === 'memory' || format === 'text') c.add('primaryDecision', 'graph', 'memory and text formats carry no decision');
    idv(c, decision.id, 'primaryDecision.id');
    const scene = idv(c, decision.scene, 'primaryDecision.scene');
    need(c, refs.scenes, scene, 'primaryDecision.scene', 'scene');
    if (scene !== undefined && spine.length > 0 && !spineIndex.has(scene)) c.add('primaryDecision.scene', 'graph', 'the decision scene must be on the spine');
    factRefs(c, refs, decision.minimumKnowledge, 'primaryDecision.minimumKnowledge', CAPS.facts);
    const options = idList(c, decision.options, 'primaryDecision.options', CAPS.options, 2);
    options.forEach((o, i) => {
      need(c, refs.opportunities, o, `primaryDecision.options[${i}]`, 'opportunity');
      if (scene && !(sceneOpps.get(scene) ?? []).includes(o)) c.add(`primaryDecision.options[${i}]`, 'graph', 'option is not offered in the decision scene');
    });
    if (new Set(options).size !== options.length) c.add('primaryDecision.options', 'duplicate_id', 'an option is listed twice');
    for (const o of opportunities) {
      if (isRec(o) && typeof o.id === 'string' && !options.includes(o.id)) c.add('opportunities', 'graph', 'an opportunity is not an option of the primary decision');
    }
  }

  /* truth boundary */
  if (keys(c, g.truthBoundary, 'truthBoundary', ['scene', 'after'])) {
    const tb = g.truthBoundary as Record<string, unknown>;
    const scene = idv(c, tb.scene, 'truthBoundary.scene');
    if (format !== 'text') need(c, refs.scenes, scene, 'truthBoundary.scene', 'scene');
    const after = oneOf(c, tb.after, 'truthBoundary.after', ['primary_act', 'memory_end'] as const);
    if (after === 'primary_act') {
      if (!isRec(decision)) c.add('truthBoundary.after', 'graph', 'a primary_act boundary needs a primary decision');
      else if (decision.scene !== scene) c.add('truthBoundary.scene', 'graph', 'the boundary scene must be the decision scene');
    }
    if (after === 'memory_end' && decision !== null) c.add('truthBoundary.after', 'graph', 'a memory_end boundary cannot have a decision');
    if (after === 'memory_end' && playable) c.add('truthBoundary.after', 'graph', 'a playable format ends at its primary act');
  }

  /* portals */
  const portals = list(c, g.portals, 'portals', CAPS.portals);
  const portalById = new Map<string, Record<string, unknown>>();
  portals.forEach(p => {
    if (isRec(p) && typeof p.id === 'string') portalById.set(p.id, p);
  });
  const reached = new Set<string>(spine.length ? [spine[0]] : []);
  portals.forEach((po, i) => {
    const p = `portals[${i}]`;
    if (!keys(c, po, p, ['id', 'label', 'kind', 'from', 'to', 'fromScene', 'toScene', 'available', 'supportFacts', 'authority'], ['returnPortal'])) return;
    const id = idv(c, po.id, `${p}.id`);
    text(c, po.label, `${p}.label`, CAPS.labelLength);
    const kind = oneOf(c, po.kind, `${p}.kind`, ['spine', 'excursion'] as const);
    const from = idv(c, po.from, `${p}.from`);
    const to = idv(c, po.to, `${p}.to`);
    const fromScene = idv(c, po.fromScene, `${p}.fromScene`);
    const toScene = idv(c, po.toScene, `${p}.toScene`);
    need(c, refs.locations, from, `${p}.from`, 'location');
    need(c, refs.locations, to, `${p}.to`, 'location');
    need(c, refs.scenes, fromScene, `${p}.fromScene`, 'scene');
    need(c, refs.scenes, toScene, `${p}.toScene`, 'scene');
    // A walkable door (excursion) joins two different locations. A spine portal may also be a CUT to another
    // scene of the same location ("a second view of the same room"), never a door to nowhere.
    if (from && to && from === to) {
      if (kind !== 'spine') c.add(`${p}.to`, 'graph', 'an excursion connects two different locations');
      else if (fromScene && toScene && fromScene === toScene) c.add(`${p}.toScene`, 'graph', 'a cut must lead to a different scene');
    }
    if (fromScene && from && sceneLocation.get(fromScene) !== from) c.add(`${p}.fromScene`, 'graph', 'fromScene is not in the portal\'s source location');
    if (toScene && to && sceneLocation.get(toScene) !== to) c.add(`${p}.toScene`, 'graph', 'toScene is not in the portal\'s destination location');
    gate(c, refs, po.available, `${p}.available`);
    factRefs(c, refs, po.supportFacts, `${p}.supportFacts`, 4);
    oneOf(c, po.authority, `${p}.authority`, PORTAL_AUTHORITIES);
    if (kind === 'spine') {
      if ('returnPortal' in po) c.add(`${p}.returnPortal`, 'graph', 'the arc never rewinds: a spine portal has no return');
      if (toScene && !spineIndex.has(toScene)) c.add(`${p}.toScene`, 'graph', 'a spine portal must lead to a spine scene');
      else if (toScene && spineIndex.get(toScene) === 0) c.add(`${p}.toScene`, 'graph', 'a spine portal cannot lead to the first scene');
      if (toScene) reached.add(toScene);
    } else if (kind === 'excursion') {
      const ret = 'returnPortal' in po ? idv(c, po.returnPortal, `${p}.returnPortal`) : undefined;
      if (ret === undefined) c.add(`${p}.returnPortal`, 'missing_key', 'a reversible excursion needs a return edge');
      else {
        need(c, refs.portals, ret, `${p}.returnPortal`, 'portal');
        const back = portalById.get(ret);
        if (back && id) {
          const symmetric =
            back.kind === 'excursion' && back.from === to && back.to === from && back.fromScene === toScene && back.toScene === fromScene && back.returnPortal === id;
          if (!symmetric) c.add(`${p}.returnPortal`, 'graph', 'the return portal must be the exact reverse edge and point back');
        }
      }
      if (toScene) reached.add(toScene);
    }
  });
  /* every scene must be reachable through the portals */
  scenes.forEach((s, i) => {
    if (isRec(s) && typeof s.id === 'string' && !reached.has(s.id) && spine[0] !== s.id) c.add(`${g.scenesPath}[${i}].id`, 'unreachable', 'no portal leads to this scene');
  });
  /* every spine scene after the first needs a spine portal */
  spine.slice(1).forEach((sid, i) => {
    const has = portals.some(p => isRec(p) && p.kind === 'spine' && p.toScene === sid);
    if (!has) c.add(`spine[${i + 1}]`, 'unreachable', 'no spine portal leads to this scene');
  });
}

function detectBeatCycles(c: Ctx, after: Map<string, string[]>, path: string) {
  const state = new Map<string, 1 | 2>();
  const visit = (id: string): boolean => {
    if (state.get(id) === 2) return false;
    if (state.get(id) === 1) return true;
    state.set(id, 1);
    for (const a of after.get(id) ?? []) if (after.has(a) && visit(a)) return true;
    state.set(id, 2);
    return false;
  };
  for (const id of after.keys()) {
    if (visit(id)) {
      c.add(path, 'cycle', 'beat dependencies form a cycle');
      return;
    }
  }
}

/* ------------------------------------------------------- semantic plan --- */

export function validateSemanticPlan(raw: unknown, opts: ValidationOptions = {}): ValidationResult<SemanticPlanV3> {
  const c = new Ctx();
  const KEYS = ['semanticSchemaVersion', 'claims', 'formatProposal', 'tension', 'actors', 'objects', 'locations', 'scenes', 'spine', 'portals', 'observations', 'preparations', 'opportunities', 'primaryDecision', 'truthBoundary', 'presentation'];
  if (!keys(c, raw, '$', KEYS)) return { ok: false, issues: c.issues };
  if (raw.semanticSchemaVersion !== SEMANTIC_SCHEMA_VERSION) c.add('semanticSchemaVersion', 'version', 'unsupported semantic schema version');

  const refs = newRefs();
  collect(c, raw.claims, 'claims', refs.facts, 'fact');
  collect(c, raw.locations, 'locations', refs.locations, 'location');
  collect(c, raw.scenes, 'scenes', refs.scenes, 'scene');
  collect(c, raw.portals, 'portals', refs.portals, 'portal');
  collect(c, raw.observations, 'observations', refs.observations, 'observation');
  collect(c, raw.preparations, 'preparations', refs.preparations, 'preparation');
  collect(c, raw.opportunities, 'opportunities', refs.opportunities, 'opportunity');
  collectEntities(c, refs, raw.actors, 'actors', raw.objects, 'objects');
  collectBeats(c, refs, raw.scenes, 'scenes');

  list(c, raw.claims, 'claims', CAPS.facts).forEach((cl, i) => {
    const p = `claims[${i}]`;
    if (!keys(c, cl, p, ['id', 'claim', 'sourceSpanIds', 'kind'])) return;
    idv(c, cl.id, `${p}.id`);
    text(c, cl.claim, `${p}.claim`, CAPS.factTextLength);
    idList(c, cl.sourceSpanIds, `${p}.sourceSpanIds`, 6, 1);
    oneOf(c, cl.kind, `${p}.kind`, FACT_KINDS);
  });

  list(c, raw.locations, 'locations', CAPS.locations, 1).forEach((l, i) => {
    const p = `locations[${i}]`;
    if (!keys(c, l, p, ['id', 'kitFamily', 'supportFacts'])) return;
    idv(c, l.id, `${p}.id`);
    const kit = idv(c, l.kitFamily, `${p}.kitFamily`);
    if (kit && opts.vocab?.kitFamilies && !opts.vocab.kitFamilies.has(kit)) c.add(`${p}.kitFamily`, 'enum', 'kit family is not approved');
    factRefs(c, refs, l.supportFacts, `${p}.supportFacts`, 4);
  });
  if (opts.profile === 'launch' && Array.isArray(raw.locations) && raw.locations.length > LAUNCH_CAPS.locations) c.add('locations', 'cap', `more than ${LAUNCH_CAPS.locations} locations for this profile`);

  const actors = list(c, raw.actors, 'actors', CAPS.foregroundActors, 1);
  actors.forEach((a, i) => {
    const p = `actors[${i}]`;
    if (!keys(c, a, p, ['id', 'role', 'initialLocation', 'supportFacts'])) return;
    idv(c, a.id, `${p}.id`);
    const role = idv(c, a.role, `${p}.role`);
    if (role && opts.vocab?.roles && !opts.vocab.roles.has(role)) c.add(`${p}.role`, 'enum', 'role is not approved');
    need(c, refs.locations, idv(c, a.initialLocation, `${p}.initialLocation`), `${p}.initialLocation`, 'location');
    factRefs(c, refs, a.supportFacts, `${p}.supportFacts`, 4);
  });

  list(c, raw.objects, 'objects', CAPS.objects).forEach((o, i) => {
    const p = `objects[${i}]`;
    if (!keys(c, o, p, ['id', 'assetClass', 'owner', 'supportFacts'])) return;
    idv(c, o.id, `${p}.id`);
    const cls = idv(c, o.assetClass, `${p}.assetClass`);
    if (cls && opts.vocab?.assetClasses && !opts.vocab.assetClasses.has(cls)) c.add(`${p}.assetClass`, 'enum', 'asset class is not approved');
    const ow = o.owner;
    if (keys(c, ow, `${p}.owner`, ['kind', 'id'])) {
      const k = oneOf(c, ow.kind, `${p}.owner.kind`, ['location', 'actor'] as const);
      const id = idv(c, ow.id, `${p}.owner.id`);
      if (k === 'location') need(c, refs.locations, id, `${p}.owner.id`, 'location');
      if (k === 'actor' && id !== undefined && refs.entities.get(id) !== 'actor') c.add(`${p}.owner.id`, 'unknown_ref', 'unknown actor');
    }
    factRefs(c, refs, o.supportFacts, `${p}.supportFacts`, 4);
  });

  const pres = raw.presentation;
  if (keys(c, pres, 'presentation', ['style', 'mood', 'time'])) {
    idv(c, pres.style, 'presentation.style');
    oneOf(c, pres.mood, 'presentation.mood', PRESENTATION_MOODS);
    oneOf(c, pres.time, 'presentation.time', PRESENTATION_TIMES);
  }

  validateGraph(
    c,
    refs,
    { format: raw.formatProposal, tension: raw.tension, scenes: raw.scenes, scenesPath: 'scenes', spine: raw.spine, portals: raw.portals, observations: raw.observations, preparations: raw.preparations, opportunities: raw.opportunities, primaryDecision: raw.primaryDecision, truthBoundary: raw.truthBoundary },
    opts,
    raw.formatProposal === 'text'
  );

  return c.ok ? { ok: true, value: raw as unknown as SemanticPlanV3, issues: [] } : { ok: false, issues: c.issues };
}

/* ---------------------------------------------------------- manifest ----- */

export function validateManifest(raw: unknown, opts: ValidationOptions = {}): ValidationResult<PlaybackManifestV3> {
  const c = new Ctx();
  const KEYS = ['runtimeManifestVersion', 'semanticSchemaVersion', 'compilerVersion', 'assetRevisions', 'assetHashes', 'experienceId', 'revision', 'decisionVersion', 'locale', 'format', 'perspectiveActor', 'spine', 'tension', 'scenePlans', 'compiledScenes', 'portals', 'initialEntities', 'observations', 'preparations', 'opportunities', 'facts', 'primaryDecision', 'truthBoundary', 'stagingDisclosure'];
  if (!keys(c, raw, '$', KEYS)) return { ok: false, issues: c.issues };

  if (raw.runtimeManifestVersion !== RUNTIME_MANIFEST_VERSION) c.add('runtimeManifestVersion', 'version', 'unsupported runtime manifest version');
  if (raw.semanticSchemaVersion !== SEMANTIC_SCHEMA_VERSION) c.add('semanticSchemaVersion', 'version', 'unsupported semantic schema version');
  if (typeof raw.compilerVersion !== 'string' || !SEMVER_RE.test(raw.compilerVersion)) c.add('compilerVersion', 'version', 'compiler version must be an explicit semver');
  idv(c, raw.experienceId, 'experienceId');
  for (const k of ['revision', 'decisionVersion'] as const) if (typeof raw[k] !== 'string' || !REVISION_RE.test(raw[k] as string)) c.add(k, 'id_format', 'expected a revision identifier');
  oneOf(c, raw.locale, 'locale', LOCALES);
  const format = oneOf(c, raw.format, 'format', FORMATS);
  if (format === 'text') c.add('format', 'unsupported', 'the text format has no playback manifest');
  text(c, raw.stagingDisclosure, 'stagingDisclosure', 400);

  /* explicit asset versions */
  const revs = raw.assetRevisions;
  if (!isRec(revs)) c.add('assetRevisions', 'type', 'expected pinned asset revisions');
  else {
    const ks = Object.keys(revs);
    if (ks.length > 64) c.add('assetRevisions', 'cap', 'more than 64 pinned assets');
    for (const k of ks.slice(0, 64)) {
      if (!ID_RE.test(k)) c.add(`assetRevisions.${k}`, 'id_format', 'expected an asset identifier');
      if (typeof revs[k] !== 'string' || !REVISION_RE.test(revs[k] as string)) c.add(`assetRevisions.${k}`, 'version', 'expected an explicit revision');
    }
  }
  const hashes = raw.assetHashes;
  if (!isRec(hashes)) c.add('assetHashes', 'type', 'expected asset hashes');
  else {
    const ks = Object.keys(hashes);
    if (ks.length > 64) c.add('assetHashes', 'cap', 'more than 64 asset hashes');
    for (const k of ks.slice(0, 64)) {
      if (!ID_RE.test(k)) c.add(`assetHashes.${k}`, 'id_format', 'expected an asset identifier');
      if (typeof hashes[k] !== 'string' || !HASH_RE.test(hashes[k] as string)) c.add(`assetHashes.${k}`, 'text_format', 'expected a hex hash');
    }
  }

  const refs = newRefs();
  collect(c, raw.facts, 'facts', refs.facts, 'fact');
  collect(c, raw.scenePlans, 'scenePlans', refs.scenes, 'scene');
  collect(c, raw.portals, 'portals', refs.portals, 'portal');
  collect(c, raw.observations, 'observations', refs.observations, 'observation');
  collect(c, raw.preparations, 'preparations', refs.preparations, 'preparation');
  collect(c, raw.opportunities, 'opportunities', refs.opportunities, 'opportunity');
  collectBeats(c, refs, raw.scenePlans, 'scenePlans');
  /* locations are the locations the scenes use */
  if (Array.isArray(raw.scenePlans)) raw.scenePlans.forEach(s => isRec(s) && typeof s.location === 'string' && ID_RE.test(s.location) && refs.locations.add(s.location));
  if (refs.locations.size > CAPS.locations) c.add('scenePlans', 'cap', `more than ${CAPS.locations} locations`);
  if (opts.profile === 'launch' && refs.locations.size > LAUNCH_CAPS.locations) c.add('scenePlans', 'cap', `more than ${LAUNCH_CAPS.locations} locations for this profile`);

  /* facts */
  list(c, raw.facts, 'facts', CAPS.facts).forEach((f, i) => {
    const p = `facts[${i}]`;
    if (!keys(c, f, p, ['id', 'text', 'kind'])) return;
    idv(c, f.id, `${p}.id`);
    text(c, f.text, `${p}.text`, CAPS.factTextLength);
    oneOf(c, f.kind, `${p}.kind`, FACT_KINDS);
  });

  /* entities */
  const entities = list(c, raw.initialEntities, 'initialEntities', CAPS.foregroundActors + CAPS.objects, 1);
  const seen = new Set<string>();
  let actorCount = 0;
  let objectCount = 0;
  entities.forEach((e, i) => {
    const p = `initialEntities[${i}]`;
    if (!keys(c, e, p, ['id', 'kind', 'owner', 'state'], ['mark'])) return;
    const id = idv(c, e.id, `${p}.id`);
    if (id) {
      if (seen.has(id)) c.add(`${p}.id`, 'duplicate_id', 'entity id is already used');
      seen.add(id);
    }
    const kind = oneOf(c, e.kind, `${p}.kind`, ['actor', 'object'] as const);
    if (kind === 'actor') actorCount++;
    if (kind === 'object') objectCount++;
    if (id && kind) refs.entities.set(id, kind);
    if (e.mark !== undefined) mark(c, e.mark, `${p}.mark`);
    if (isRec(e.state)) {
      const ks = Object.keys(e.state);
      if (ks.length > 16) c.add(`${p}.state`, 'cap', 'more than 16 state keys');
      for (const k of ks.slice(0, 16)) {
        if (!ID_RE.test(k)) c.add(`${p}.state.${k}`, 'id_format', 'expected a state key identifier');
        text(c, e.state[k], `${p}.state.${k}`, 64);
      }
    } else c.add(`${p}.state`, 'type', 'expected a state record');
  });
  if (actorCount > CAPS.foregroundActors) c.add('initialEntities', 'cap', `more than ${CAPS.foregroundActors} actors`);
  if (objectCount > CAPS.objects) c.add('initialEntities', 'cap', `more than ${CAPS.objects} objects`);
  /* owners are checked after every entity is known */
  entities.forEach((e, i) => {
    if (!isRec(e) || !isRec(e.owner)) return;
    const p = `initialEntities[${i}].owner`;
    if (!keys(c, e.owner, p, ['kind', 'id'])) return;
    const k = oneOf(c, e.owner.kind, `${p}.kind`, ['location', 'actor', 'offstage'] as const);
    const id = idv(c, e.owner.id, `${p}.id`);
    if (k === 'location') need(c, refs.locations, id, `${p}.id`, 'location');
    if (k === 'actor') {
      if (e.kind === 'actor') c.add(`${p}.kind`, 'graph', 'an actor cannot be carried by an actor');
      if (id !== undefined && refs.entities.get(id) !== 'actor') c.add(`${p}.id`, 'unknown_ref', 'unknown actor');
      if (id !== undefined && id === e.id) c.add(`${p}.id`, 'cycle', 'an entity cannot own itself');
    }
    if (k === 'offstage' && id !== 'offstage') c.add(`${p}.id`, 'graph', 'offstage ownership uses the id "offstage"');
  });

  /* hero */
  const hero = idv(c, raw.perspectiveActor, 'perspectiveActor');
  if (hero !== undefined && refs.entities.get(hero) !== 'actor') c.add('perspectiveActor', 'unknown_ref', 'unknown actor');
  if (isRec(raw.tension) && raw.tension.perspectiveActor !== raw.perspectiveActor) c.add('tension.perspectiveActor', 'graph', 'tension and manifest disagree about whose perspective this is');

  /* compiled scenes */
  const planById = new Map<string, Record<string, unknown>>();
  if (Array.isArray(raw.scenePlans)) raw.scenePlans.forEach(s => isRec(s) && typeof s.id === 'string' && planById.set(s.id, s));
  const compiled = list(c, raw.compiledScenes, 'compiledScenes', CAPS.scenes);
  const compiledIds = new Set<string>();
  compiled.forEach((s, i) => {
    const p = `compiledScenes[${i}]`;
    if (!keys(c, s, p, ['id', 'location', 'kitRevision', 'compositionRevision', 'cameraRecipe', 'lightRecipe', 'audioRecipe', 'accessibleText'], ['entryMark', 'marks', 'routes'])) return;
    const id = idv(c, s.id, `${p}.id`);
    if (id) {
      if (compiledIds.has(id)) c.add(`${p}.id`, 'duplicate_id', 'scene compiled twice');
      compiledIds.add(id);
      need(c, refs.scenes, id, `${p}.id`, 'scene');
      const plan = planById.get(id);
      if (plan && plan.location !== s.location) c.add(`${p}.location`, 'graph', 'compiled scene location differs from its plan');
    }
    idv(c, s.location, `${p}.location`);
    for (const k of ['kitRevision', 'compositionRevision'] as const) if (typeof s[k] !== 'string' || !REVISION_RE.test(s[k] as string)) c.add(`${p}.${k}`, 'version', 'expected an explicit revision');
    for (const k of ['cameraRecipe', 'lightRecipe', 'audioRecipe'] as const) idv(c, s[k], `${p}.${k}`);
    const readable = new Set<string>();
    list(c, s.accessibleText, `${p}.accessibleText`, CAPS.facts).forEach((a, j) => {
      if (!keys(c, a, `${p}.accessibleText[${j}]`, ['fact', 'text'])) return;
      const f = idv(c, a.fact, `${p}.accessibleText[${j}].fact`);
      need(c, refs.facts, f, `${p}.accessibleText[${j}].fact`, 'fact');
      if (f) readable.add(f);
      text(c, a.text, `${p}.accessibleText[${j}].text`, 600);
    });
    if (s.entryMark !== undefined) mark(c, s.entryMark, `${p}.entryMark`);
    if (s.marks !== undefined) {
      if (!isRec(s.marks)) c.add(`${p}.marks`, 'type', 'expected marks');
      else Object.keys(s.marks).slice(0, 32).forEach(k => (ID_RE.test(k) ? mark(c, (s.marks as Record<string, unknown>)[k], `${p}.marks.${k}`) : c.add(`${p}.marks.${k}`, 'id_format', 'expected a mark role id')));
    }
    if (s.routes !== undefined) {
      if (!isRec(s.routes)) c.add(`${p}.routes`, 'type', 'expected routes');
      else
        Object.keys(s.routes).slice(0, 32).forEach(k => {
          const pts = (s.routes as Record<string, unknown>)[k];
          if (!ID_RE.test(k) || !Array.isArray(pts) || pts.length > 64 || pts.some(q => !Array.isArray(q) || q.length !== 2 || q.some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 100))) c.add(`${p}.routes.${k}`, 'type', 'expected a route of points between 0 and 100');
        });
    }
    /* every required fact must be readable without the renderer */
    const plan = id ? planById.get(id) : undefined;
    if (plan && Array.isArray(plan.requiredFacts)) for (const f of plan.requiredFacts) if (typeof f === 'string' && !readable.has(f)) c.add(`${p}.accessibleText`, 'graph', 'a required fact has no accessible text');
  });
  if (Array.isArray(raw.scenePlans)) raw.scenePlans.forEach((s, i) => isRec(s) && typeof s.id === 'string' && !compiledIds.has(s.id) && c.add(`scenePlans[${i}].id`, 'graph', 'scene plan has no compiled scene'));

  validateGraph(
    c,
    refs,
    { format: raw.format, tension: raw.tension, scenes: raw.scenePlans, scenesPath: 'scenePlans', spine: raw.spine, portals: raw.portals, observations: raw.observations, preparations: raw.preparations, opportunities: raw.opportunities, primaryDecision: raw.primaryDecision, truthBoundary: raw.truthBoundary },
    opts
  );

  /* the hero starts in the first spine scene's location */
  const first = Array.isArray(raw.spine) && typeof raw.spine[0] === 'string' ? planById.get(raw.spine[0]) : undefined;
  const heroEntity = entities.find(e => isRec(e) && e.id === raw.perspectiveActor);
  if (first && isRec(heroEntity) && isRec(heroEntity.owner) && !(heroEntity.owner.kind === 'location' && heroEntity.owner.id === first.location)) c.add('perspectiveActor', 'graph', 'the hero must start in the first scene\'s location');

  return c.ok ? { ok: true, value: raw as unknown as PlaybackManifestV3, issues: [] } : { ok: false, issues: c.issues };
}

export function validateStoredPostV3(raw: unknown, opts: ValidationOptions = {}): ValidationResult<StoredPostV3> {
  const c = new Ctx();
  if (!keys(c, raw, '$', ['postSchemaVersion', 'id', 'playback', 'revealRef'], ['parentRevision', 'responseToPostId'])) return { ok: false, issues: c.issues };
  if (raw.postSchemaVersion !== POST_SCHEMA_VERSION) c.add('postSchemaVersion', 'version', 'unsupported post schema version');
  idv(c, raw.id, 'id');
  idv(c, raw.revealRef, 'revealRef');
  if (raw.parentRevision !== undefined && (typeof raw.parentRevision !== 'string' || !REVISION_RE.test(raw.parentRevision))) c.add('parentRevision', 'id_format', 'expected a revision identifier');
  if (raw.responseToPostId !== undefined) idv(c, raw.responseToPostId, 'responseToPostId');
  const m = validateManifest(raw.playback, opts);
  if (!m.ok) for (const i of m.issues) c.add(`playback${i.path === '$' ? '' : '.' + i.path}`, i.code, i.message);
  return c.ok ? { ok: true, value: raw as unknown as StoredPostV3, issues: [] } : { ok: false, issues: c.issues };
}

/**
 * Leak check for fixtures and pipelines: given strings that must never reach a
 * viewer before the boundary (the author's act, why, aftermath), report which
 * of them appear anywhere in a serialized public structure. Returns the INDEXES
 * of the canaries found, never their text.
 */
export function findPrivateLeaks(publicValue: unknown, canaries: readonly string[]): number[] {
  const hay = JSON.stringify(publicValue).toLowerCase();
  const found: number[] = [];
  canaries.forEach((canary, i) => {
    const needle = canary.trim().toLowerCase();
    if (needle.length >= 4 && hay.includes(needle)) found.push(i);
  });
  return found;
}

export function formatIssues(issues: readonly ValidationIssue[]): string {
  return issues.map(i => `${i.path}: ${i.code}`).join('; ');
}
