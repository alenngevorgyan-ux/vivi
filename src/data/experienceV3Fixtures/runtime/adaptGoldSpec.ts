/**
 * Gold planning envelope (`vivi-format-proof-1`) → executable `SemanticPlanV3`.
 *
 * The gold `*.semantic.json` files are planning projections, not runtime
 * contracts (see ../spec/README.md). This adapter is the one place where their
 * vocabulary is mapped onto Foundation's closed contract. It is generic: it
 * knows no story. Every interpretation a particular story needs (who speaks a
 * quote, which scene a reversible door leads to, how a planning variable is
 * carried) is supplied as explicit, reviewable `GoldAdaptation` data, and
 * anything the adapter cannot map without such data is an error, never a guess.
 *
 * Input is only read. The gold spec is never mutated.
 *
 * Private material: this module and its inputs carry pre-boundary content
 * only. It must never import a `*.private.json` file; the reveal and the
 * source ledger are adapted elsewhere.
 */

import type {
  EntityRef,
  FactKind,
  Gate,
  IntentVerb,
  ObservationPlan,
  OpportunityPlan,
  PortalPlan,
  PreparationAction,
  PreparationPlan,
  ScenePlan,
  SemanticBeat,
  SemanticEvent,
  SemanticPlanV3,
} from '../../../engine/v3/contracts/semantic.ts';

/* ------------------------------------------------- planning envelope --- */

export type GoldGate =
  | { kind: 'state_is'; key: string; value: string }
  | { kind: 'fact_received'; id: string }
  | { kind: 'beat_delivered'; id: string }
  | { kind: 'all'; gates: GoldGate[] };

type GoldRef = { kind: 'self' } | { kind: 'actor' | 'object'; id: string };

/** The fields of the planning envelope this adapter reads. Planning-only prose fields are ignored. */
export interface GoldEnvelope {
  specEnvelopeVersion: string;
  experienceId: string;
  revision: string;
  semanticSchemaVersion: number;
  locale: string;
  stagingDisclosure: string;
  formatProposal: string;
  evidenceFacts: Array<{ id: string; claim: string; type: string; required: boolean }>;
  tension: { description: string; perspectiveActor: string; poles: Array<{ motive: string; stakeFacts: string[] }>; unknowns: string[] };
  actors: Array<{ id: string; role: string; initialLocation: string; supportFacts: string[] }>;
  objects: Array<{ id: string; assetClass: string; owner: { kind: string; id: string }; supportFacts: string[] }>;
  locations: Array<{ id: string; kitFamily: string; supportFacts: string[] }>;
  scenes: Array<{
    id: string;
    location: string;
    kind: string;
    viewpoint: string;
    purpose: string;
    requiredFacts: string[];
    optionalFacts: string[];
    observationIds: string[];
    preparationIds: string[];
    opportunityIds: string[];
    beats: string[];
    composition: string;
  }>;
  spine: string[];
  portals: Array<{ id: string; fromLocation: string; toLocation: string; returnPortal?: string; supportFacts: string[]; authority: string; available: GoldGate }>;
  sceneTransitions: Array<{ id: string; kind: string; fromScene: string; toScene: string; supportFacts: string[]; label: string }>;
  observations: Array<{ id: string; target: GoldRef; label: string; facts: string[]; required: boolean; scenes: string[]; presentation: string; available: GoldGate }>;
  preparations: Array<{ id: string; label: string; target: GoldRef; supportFacts: string[]; action: { kind: string; markRole?: string; object?: string }; scenes: string[]; available: GoldGate }>;
  opportunities: Array<{
    id: string;
    verb: string;
    label: string;
    target: GoldRef;
    motive: string;
    fearedCostFacts: string[];
    feasibilityFacts: string[];
    minimumKnowledge: string[];
    decision: string;
    available: GoldGate;
  }>;
  primaryDecision: { id: string; scene: string; minimumKnowledge: string[]; options: string[]; version: string };
  truthBoundary: { scene: string; after: string };
  softTimeEvents: Array<{ id: string; classification: string; after: string[]; facts: string[]; effects: Array<{ kind: string; [k: string]: unknown }> }>;
  presentation: { style: string; time: string };
}

/* ---------------------------------------------------- adaptation data --- */

export interface GoldAdaptation {
  /** Runtime scenes in spine order. Each merges one or more gold scenes (a compressed control merges several). */
  scenes: Array<{ id: string; gold: string[]; location?: string; kind?: ScenePlan['kind']; viewpoint?: ScenePlan['viewpoint']; purpose?: ScenePlan['purpose']; composition?: string }>;
  /**
   * Gold reversible doors kept in this variant. Foundation portals name their destination SCENE
   * (a location can host several scenes), which the gold envelope leaves to prose, so it is stated here.
   */
  excursions: Record<string, { fromScene: string; toScene: string; label: string }>;
  /** Gold doors deliberately absent from this variant, with the reason. Every gold door is either kept or listed. */
  removedPortals: Record<string, string>;
  /**
   * Gold planning variables and the doors whose `portal_state` receipts carry them. Foundation has no free
   * variable writes; a variable whose doors are all absent from a variant becomes a narrated delivery.
   */
  stateVariables: Record<string, { portals: string[] }>;
  /** Gold fact id → the actor whose live words it is. Unlisted facts are delivered as narration, never as speech. */
  quotes: Record<string, string>;
  /** `<collection>.<id>` → replacement gate, with the reason, where the planning gate has no faithful mapping. */
  gateOverrides: Record<string, { gate: GoldGate; reason: string }>;
  /** Actor start locations that differ in this variant (the first scene's location must hold the hero). */
  actorLocations?: Record<string, string>;
  /** Pre-boundary source span ids per gold fact. Verified against the private ledger by the tests, never read from it here. */
  factSpans: Record<string, string[]>;
  /** Required by SemanticPlanV3 but absent from the gold envelope; not carried into the manifest. */
  presentationMood: 'intimate' | 'public' | 'uncertain';
}

/** What the adapter did, as data: the id map and every interpretation it applied. */
export interface AdaptationTrace {
  facts: Record<string, string>; // runtime fact id → gold fact id
  scenes: Record<string, string[]>; // runtime scene id → gold scene ids
  droppedGates: string[]; // paths whose `decisionPhase` gate was dropped (readiness is derived by Foundation)
  structuralGates: string[]; // paths whose `scene` gate became `always` (scene scoping is structural)
  mergedTransitions: string[]; // gold transitions inside one runtime scene (compressed variants)
  narratedVariables: string[]; // `event:variable` set_state effects carried as narration (no door in this variant)
  overrides: string[]; // gate override paths applied
}

export class AdaptationError extends Error {}

/* ------------------------------------------------------------ helpers --- */

const FACT_KIND: Record<string, FactKind> = {
  observed: 'observed',
  // Analytical ledger tags; README: "Use `observed` … describes author-reported relation/context."
  relationship: 'observed',
  context: 'observed',
  belief: 'hero_belief',
  quote: 'quoted_speech',
  timing: 'timing',
};

/** Foundation ids are lowercase; gold fact ids are `F01`. */
export const runtimeFactId = (goldId: string) => goldId.toLowerCase();
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

function fail(msg: string): never {
  throw new AdaptationError(msg);
}

/* ------------------------------------------------------------ adapter --- */

export function adaptGoldSpec(env: GoldEnvelope, a: GoldAdaptation): { plan: SemanticPlanV3; trace: AdaptationTrace } {
  if (env.specEnvelopeVersion !== 'vivi-format-proof-1') fail(`unsupported planning envelope ${env.specEnvelopeVersion}`);
  if (env.semanticSchemaVersion !== 3) fail('unsupported semantic schema version');

  const trace: AdaptationTrace = { facts: {}, scenes: {}, droppedGates: [], structuralGates: [], mergedTransitions: [], narratedVariables: [], overrides: [] };
  const f = (id: string) => {
    if (!env.evidenceFacts.some(x => x.id === id)) fail(`unknown gold fact ${id}`);
    return runtimeFactId(id);
  };
  const fs = (ids: string[]) => ids.map(f);

  /* scenes: gold scene → runtime scene */
  const sceneOf = new Map<string, string>();
  for (const s of a.scenes) for (const g of s.gold) {
    if (sceneOf.has(g)) fail(`gold scene ${g} is mapped twice`);
    if (!env.scenes.some(x => x.id === g)) fail(`unknown gold scene ${g}`);
    sceneOf.set(g, s.id);
  }
  for (const s of env.scenes) if (!sceneOf.has(s.id)) fail(`gold scene ${s.id} is not mapped`);
  // Merging may compress the spine, never reorder it.
  const order = env.spine.map(g => a.scenes.findIndex(s => s.id === sceneOf.get(g)));
  if (order.some((x, i) => i > 0 && x < order[i - 1])) fail('the runtime spine reorders the gold spine');
  const mapScene = (g: string) => sceneOf.get(g) ?? fail(`unknown gold scene ${g}`);
  const goldScene = (id: string) => env.scenes.find(s => s.id === id)!;
  const runtimeScene = (id: string) => a.scenes.find(s => s.id === id) ?? fail(`unknown runtime scene ${id}`);
  const locationOf = (runtimeId: string) => {
    const rs = runtimeScene(runtimeId);
    if (rs.location) {
      if (!env.locations.some(l => l.id === rs.location)) fail(`scene ${rs.id}: unknown location ${rs.location}`);
      return rs.location;
    }
    // A merged scene stands in the location of its last (decisive) gold view.
    return goldScene(rs.gold[rs.gold.length - 1]).location;
  };

  /* doors: every gold door is kept as an excursion or explicitly removed */
  for (const p of env.portals) if (!(p.id in a.excursions) && !(p.id in a.removedPortals)) fail(`gold portal ${p.id} is neither kept nor removed`);
  const keptDoors = new Set(Object.keys(a.excursions));
  for (const id of keptDoors) if (!env.portals.some(p => p.id === id)) fail(`unknown gold portal ${id}`);

  /* gates */
  const gate = (g: GoldGate, path: string, structuralScene = false): Gate | null => {
    switch (g.kind) {
      case 'fact_received':
        return { kind: 'fact_received', id: f(g.id) };
      case 'beat_delivered':
        return { kind: 'beat_delivered', id: g.id };
      case 'all': {
        const gates = g.gates.map((x, i) => gate(x, `${path}[${i}]`, structuralScene)).filter((x): x is Gate => x !== null);
        return gates.length === 0 ? { kind: 'always' } : gates.length === 1 ? gates[0] : { kind: 'all', gates };
      }
      case 'state_is': {
        if (g.key === 'decisionPhase' && g.value === 'ready') {
          // Foundation derives readiness itself: decision scene + every minimum-knowledge receipt + nothing accepted.
          trace.droppedGates.push(path);
          return null;
        }
        if (g.key === 'scene' && structuralScene) {
          trace.structuralGates.push(path);
          return { kind: 'always' };
        }
        const v = a.stateVariables[g.key];
        if (v) {
          const door = v.portals.find(p => keptDoors.has(p));
          if (!door) fail(`${path}: variable ${g.key} has no door in this variant`);
          return { kind: 'state_is', key: `portal_${door}`, value: g.value };
        }
        return fail(`${path}: no mapping for planning variable ${g.key}`);
      }
    }
  };
  const gateAt = (collection: string, id: string, g: GoldGate, structuralScene = false): Gate => {
    const path = `${collection}.${id}`;
    const o = a.gateOverrides[path];
    if (o) {
      trace.overrides.push(path);
      return gate(o.gate, path) ?? { kind: 'always' };
    }
    return gate(g, path, structuralScene) ?? { kind: 'always' };
  };

  /* beats: gold soft-time events → semantic beats */
  const eventsFor = (id: string): SemanticEvent[] => {
    const ev = env.softTimeEvents.find(e => e.id === id) ?? fail(`unknown gold event ${id}`);
    if (ev.classification === 'ambient') fail(`${id}: ambient presentation cannot be a scene beat`);
    const out: SemanticEvent[] = [];
    if (ev.classification === 'evidence_delivery') {
      let narrated: string[] = [];
      const flush = () => {
        if (narrated.length) out.push({ kind: 'deliver', facts: narrated });
        narrated = [];
      };
      for (const fact of ev.facts) {
        const speaker = a.quotes[fact];
        if (speaker) {
          flush();
          out.push({ kind: 'quote', actor: speaker, fact: f(fact) });
        } else narrated.push(f(fact));
      }
      flush();
      if (ev.effects.length) fail(`${id}: an evidence delivery carries no state effect`);
    } else if (ev.classification === 'causal') {
      if (!ev.facts.length) fail(`${id}: a causal event must cite its evidence`);
      for (const eff of ev.effects) {
        if (eff.kind === 'entity_transfer') {
          out.push({ kind: 'transfer', entity: String(eff.entity), to: String(eff.to), facts: fs(ev.facts) });
        } else if (eff.kind === 'set_state') {
          const key = String(eff.key);
          const value = String(eff.value);
          const v = a.stateVariables[key] ?? fail(`${id}: no mapping for planning variable ${key}`);
          if (value !== 'open' && value !== 'closed') fail(`${id}: ${key}=${value} is not a door state`);
          const doors = v.portals.filter(p => keptDoors.has(p));
          // The first cited fact is the evidence for the state change itself; later facts are delivered by their own beats.
          if (doors.length) for (const portal of doors) out.push({ kind: 'portal_state', portal, state: value, fact: f(ev.facts[0]) });
          else {
            trace.narratedVariables.push(`${id}:${key}`);
            out.push({ kind: 'deliver', facts: [f(ev.facts[0])] });
          }
        } else fail(`${id}: unsupported effect ${eff.kind}`);
      }
    } else fail(`${id}: unknown classification ${ev.classification}`);
    return out.length ? out : [{ kind: 'hold' }];
  };
  const beatFor = (id: string): SemanticBeat => {
    const ev = env.softTimeEvents.find(e => e.id === id)!;
    const events = eventsFor(id);
    const emphasis: SemanticBeat['emphasis'] = events.some(e => e.kind === 'quote') ? 'relation' : ev.classification === 'causal' ? 'threshold' : 'evidence';
    // Every gold delivery holds for reading: reader-paced, never a timer.
    return { id, after: [...ev.after], events, emphasis, delivery: 'reader' };
  };

  const uniq = <T,>(xs: T[]) => [...new Set(xs)];
  const scenes: ScenePlan[] = a.scenes.map(rs => {
    const golds = rs.gold.map(goldScene);
    const last = golds[golds.length - 1];
    trace.scenes[rs.id] = [...rs.gold];
    return {
      id: rs.id,
      location: locationOf(rs.id),
      kind: rs.kind ?? (last.kind as ScenePlan['kind']),
      viewpoint: rs.viewpoint ?? (last.viewpoint as ScenePlan['viewpoint']),
      purpose: rs.purpose ?? (last.purpose as ScenePlan['purpose']),
      requiredFacts: fs(uniq(golds.flatMap(g => g.requiredFacts))),
      beats: golds.flatMap(g => g.beats).map(beatFor),
      observationIds: uniq(golds.flatMap(g => g.observationIds)),
      opportunityIds: uniq(golds.flatMap(g => g.opportunityIds)),
      composition: rs.composition ?? last.composition,
    };
  });
  const beatsOf = (sceneId: string) => scenes.find(s => s.id === sceneId)!.beats.map(b => b.id);

  /* portals */
  const portals: PortalPlan[] = [];
  for (const t of env.sceneTransitions) {
    const from = mapScene(t.fromScene);
    const to = mapScene(t.toScene);
    if (from === to) {
      trace.mergedTransitions.push(t.id);
      continue;
    }
    // A spine continuation opens when its scene's reader-paced material has been delivered (gold "exit state").
    const beats = beatsOf(from);
    const available: Gate = beats.length === 0 ? { kind: 'always' } : beats.length === 1 ? { kind: 'beat_delivered', id: beats[0] } : { kind: 'all', gates: beats.map(id => ({ kind: 'beat_delivered' as const, id })) };
    portals.push({ id: t.id, label: t.label, kind: 'spine', from: locationOf(from), to: locationOf(to), fromScene: from, toScene: to, available, supportFacts: fs(t.supportFacts), authority: 'source' });
  }
  for (const p of env.portals) {
    const x = a.excursions[p.id];
    if (!x) continue;
    if (locationOf(x.fromScene) !== p.fromLocation || locationOf(x.toScene) !== p.toLocation) fail(`portal ${p.id}: bound scenes are not in the gold door's locations`);
    if (!p.returnPortal || !(p.returnPortal in a.excursions)) fail(`portal ${p.id}: a kept door needs its kept return`);
    portals.push({
      id: p.id,
      label: x.label,
      kind: 'excursion',
      from: p.fromLocation,
      to: p.toLocation,
      fromScene: x.fromScene,
      toScene: x.toScene,
      returnPortal: p.returnPortal,
      available: gateAt('portals', p.id, p.available),
      supportFacts: fs(p.supportFacts),
      authority: p.authority === 'source' ? 'source' : 'author_approved_staging',
    });
  }

  /* observations, preparations, opportunities used by this variant */
  const usedObs = new Set(scenes.flatMap(s => s.observationIds));
  const observations: ObservationPlan[] = env.observations
    .filter(o => usedObs.has(o.id))
    .map(o => ({
      id: o.id,
      target: { ...o.target } as EntityRef,
      label: o.label,
      facts: fs(o.facts),
      // Foundation offers an observation only in scenes listing it, so a `scene` gate is structural.
      available: gateAt('observations', o.id, o.available, true),
      presentation: o.presentation as ObservationPlan['presentation'],
    }));
  const usedPreps = new Set(a.scenes.flatMap(rs => rs.gold.flatMap(g => goldScene(g).preparationIds)));
  const preparations: PreparationPlan[] = env.preparations
    .filter(p => usedPreps.has(p.id))
    .map(p => ({
      id: p.id,
      target: { ...p.target } as EntityRef,
      label: p.label,
      // Foundation preparations are not scene-scoped: a `scene` gate needs an explicit override, never `always`.
      available: gateAt('preparations', p.id, p.available),
      supportFacts: fs(p.supportFacts),
      action: { ...p.action } as PreparationAction,
    }));

  const d = env.primaryDecision;
  const opportunities: OpportunityPlan[] = env.opportunities.map(o => {
    // Foundation has one shared minimum per decision; a per-option minimum that differs would be silently lost.
    if (o.minimumKnowledge.join() !== d.minimumKnowledge.join()) fail(`opportunity ${o.id}: minimum knowledge differs from the decision's`);
    if (o.decision !== d.id) fail(`opportunity ${o.id}: belongs to another decision`);
    return {
      id: o.id,
      decision: o.decision,
      target: { ...o.target } as EntityRef,
      verb: o.verb as IntentVerb,
      label: o.label,
      motive: o.motive,
      fearedCostFacts: fs(o.fearedCostFacts),
      feasibilityFacts: fs(o.feasibilityFacts),
      available: gateAt('opportunities', o.id, o.available),
    };
  });

  for (const fact of env.evidenceFacts) {
    if (!(fact.id in a.factSpans) || a.factSpans[fact.id].length === 0) fail(`fact ${fact.id} has no source span`);
    trace.facts[runtimeFactId(fact.id)] = fact.id;
  }

  const plan: SemanticPlanV3 = {
    semanticSchemaVersion: 3,
    claims: env.evidenceFacts.map(x => ({
      id: f(x.id),
      claim: x.claim,
      sourceSpanIds: a.factSpans[x.id].map(s => s.toLowerCase()),
      kind: FACT_KIND[x.type] ?? fail(`fact ${x.id}: unknown type ${x.type}`),
    })),
    formatProposal: env.formatProposal as SemanticPlanV3['formatProposal'],
    tension: {
      description: env.tension.description,
      perspectiveActor: env.tension.perspectiveActor,
      poles: [
        { motive: env.tension.poles[0].motive, stakeFacts: fs(env.tension.poles[0].stakeFacts) },
        { motive: env.tension.poles[1].motive, stakeFacts: fs(env.tension.poles[1].stakeFacts) },
      ],
      unknowns: [...env.tension.unknowns],
    },
    actors: env.actors.map(x => ({ id: x.id, role: slug(x.role), initialLocation: a.actorLocations?.[x.id] ?? x.initialLocation, supportFacts: fs(x.supportFacts) })),
    objects: env.objects.map(x => ({
      id: x.id,
      assetClass: x.assetClass,
      owner: x.owner.kind === 'actor' ? { kind: 'actor', id: x.owner.id } : { kind: 'location', id: x.owner.id },
      supportFacts: fs(x.supportFacts),
    })),
    locations: env.locations.map(x => ({ id: x.id, kitFamily: x.kitFamily, supportFacts: fs(x.supportFacts) })),
    scenes,
    spine: a.scenes.map(s => s.id),
    portals,
    observations,
    preparations,
    opportunities,
    primaryDecision: { id: d.id, scene: mapScene(d.scene), minimumKnowledge: fs(d.minimumKnowledge), options: [...d.options] },
    truthBoundary: { scene: mapScene(env.truthBoundary.scene), after: env.truthBoundary.after === 'memory_end' ? 'memory_end' : 'primary_act' },
    presentation: { style: env.presentation.style, mood: a.presentationMood, time: 'soft' },
  };
  return { plan, trace };
}
