/**
 * V3 semantic contract: what a (future) model, or an author, may PROPOSE.
 *
 * Everything here is an identifier, an enum, a reference or short text. There
 * are deliberately no coordinates, URLs, file names, CSS, scripts or
 * expressions: the engine decides where things stand and which assets are
 * used. TypeScript types do not validate untrusted JSON; `validate.ts` does.
 *
 * Private author data (the actual act, why, aftermath, source spans) never
 * appears in this file's types except `SourceSpan` ids as opaque references.
 */

export type Id = string;
export type Locale = 'en' | 'ru' | 'hy';
export type Format = 'micro' | 'situation' | 'sequence' | 'memory' | 'text';
export type FactId = Id;
export type SceneId = Id;
export type LocationId = Id;
export type EntityId = Id;
export type OpportunityId = Id;
export type DecisionId = Id;
export type BeatId = Id;
export type PortalId = Id;
export type ObservationId = Id;
export type PreparationId = Id;

export const SEMANTIC_SCHEMA_VERSION = 3 as const;

export const FORMATS: readonly Format[] = ['micro', 'situation', 'sequence', 'memory', 'text'];
export const LOCALES: readonly Locale[] = ['en', 'ru', 'hy'];
export const FACT_KINDS = ['observed', 'hero_belief', 'quoted_speech', 'timing'] as const;
export type FactKind = (typeof FACT_KINDS)[number];

export const INTENT_VERBS = ['speak', 'ask', 'read_private', 'leave', 'remain_silent', 'call', 'give', 'keep', 'show', 'follow'] as const;
export type IntentVerb = (typeof INTENT_VERBS)[number];

/** A model-proposed claim about the pre-boundary source. Approval happens outside this contract. */
export interface ClaimProposal {
  id: FactId;
  claim: string;
  /** Ids from the supplied pre-boundary source ledger only; opaque here. */
  sourceSpanIds: Id[];
  kind: FactKind;
}

export interface Tension {
  description: string;
  perspectiveActor: EntityId;
  poles: [
    { motive: string; stakeFacts: FactId[] },
    { motive: string; stakeFacts: FactId[] },
  ];
  /** Reviewable; never a place to invent an allegation. */
  unknowns: string[];
}

export type EntityRef =
  | { kind: 'actor'; id: EntityId }
  | { kind: 'object'; id: EntityId }
  | { kind: 'portal'; id: PortalId }
  | { kind: 'self' };

/** Closed gate language. No expressions; `all` nests at most once (depth <= 2). */
export type Gate =
  | { kind: 'always' }
  | { kind: 'beat_delivered'; id: BeatId }
  | { kind: 'fact_received'; id: FactId }
  | { kind: 'entity_at'; id: EntityId; location: LocationId }
  | { kind: 'state_is'; key: Id; value: string }
  | { kind: 'all'; gates: Gate[] };

export type SemanticEvent =
  | { kind: 'deliver'; facts: FactId[] }
  | { kind: 'quote'; actor: EntityId; fact: FactId }
  | { kind: 'transfer'; entity: EntityId; to: LocationId; facts: FactId[] }
  | { kind: 'device_cue'; object: EntityId; fact: FactId }
  | { kind: 'portal_state'; portal: PortalId; state: 'open' | 'closed'; fact: FactId }
  /** Presentation only; never a claim of literal silence. */
  | { kind: 'hold' };

export const BEAT_EMPHASES = ['relation', 'evidence', 'threshold', 'held'] as const;
export const BEAT_DELIVERIES = ['reader', 'soft_flow'] as const;
export interface SemanticBeat {
  id: BeatId;
  after: BeatId[];
  events: SemanticEvent[];
  emphasis: (typeof BEAT_EMPHASES)[number];
  delivery: (typeof BEAT_DELIVERIES)[number];
}

export const SCENE_KINDS = ['inhabited', 'insert', 'transition', 'memory'] as const;
export const SCENE_VIEWPOINTS = ['hero', 'object', 'remembered'] as const;
export const SCENE_PURPOSES = ['orient', 'discover', 'reframe', 'prepare', 'decide'] as const;
export interface ScenePlan {
  id: SceneId;
  location: LocationId;
  kind: (typeof SCENE_KINDS)[number];
  viewpoint: (typeof SCENE_VIEWPOINTS)[number];
  purpose: (typeof SCENE_PURPOSES)[number];
  requiredFacts: FactId[];
  beats: SemanticBeat[];
  observationIds: ObservationId[];
  opportunityIds: OpportunityId[];
  /** Approved recipe family id; the engine owns coordinates. */
  composition: Id;
}

export const PORTAL_AUTHORITIES = ['source', 'author_approved_staging'] as const;
/**
 * A portal is an edge between scenes of two different locations.
 *
 * Amendment to the master plan (see docs/VIVI_V3_FOUNDATION.md): a location can
 * host several scenes ("a second view of the same room is another scene"), so
 * the destination SCENE is explicit. `spine` portals advance the arc once;
 * `excursion` portals are reversible and never move the arc.
 */
export interface PortalPlan {
  id: PortalId;
  label: string;
  kind: 'spine' | 'excursion';
  from: LocationId;
  to: LocationId;
  fromScene: SceneId;
  toScene: SceneId;
  /** Required for excursions, forbidden for spine portals. */
  returnPortal?: PortalId;
  available: Gate;
  supportFacts: FactId[];
  authority: (typeof PORTAL_AUTHORITIES)[number];
}

export const OBSERVATION_PRESENTATIONS = ['insert', 'two_shot', 'caption'] as const;
export interface ObservationPlan {
  id: ObservationId;
  target: EntityRef;
  label: string;
  facts: FactId[];
  available: Gate;
  presentation: (typeof OBSERVATION_PRESENTATIONS)[number];
}

/** Closed, reversible recipe family. It cannot change another actor's state. */
export type PreparationAction =
  | { kind: 'reposition'; markRole: Id }
  | { kind: 'hold_own_object'; object: EntityId }
  | { kind: 'put_back_own_object'; object: EntityId };
export interface PreparationPlan {
  id: PreparationId;
  target: EntityRef;
  label: string;
  available: Gate;
  supportFacts: FactId[];
  action: PreparationAction;
}

export interface OpportunityPlan {
  id: OpportunityId;
  decision: DecisionId;
  target: EntityRef;
  verb: IntentVerb;
  label: string;
  motive: string;
  fearedCostFacts: FactId[];
  feasibilityFacts: FactId[];
  available: Gate;
  // `window` (evidence-backed expiry) exists in the master plan but ships no
  // real timers in this pass: the validator rejects it explicitly.
}

export interface PrimaryDecision {
  id: DecisionId;
  scene: SceneId;
  minimumKnowledge: FactId[];
  options: OpportunityId[];
}

export interface TruthBoundary {
  scene: SceneId;
  after: 'primary_act' | 'memory_end';
}

export const PRESENTATION_MOODS = ['intimate', 'public', 'uncertain'] as const;
export const PRESENTATION_TIMES = ['soft'] as const; // 'evidence_window' is unsupported in Phase 1
export interface PresentationIntent {
  /** A recipe/style id owned by the art direction, not a literal here. */
  style: Id;
  mood: (typeof PRESENTATION_MOODS)[number];
  time: (typeof PRESENTATION_TIMES)[number];
}

export interface SemanticActor {
  id: EntityId;
  role: Id;
  initialLocation: LocationId;
  supportFacts: FactId[];
}
export interface SemanticObject {
  id: EntityId;
  assetClass: Id;
  owner: { kind: 'location'; id: LocationId } | { kind: 'actor'; id: EntityId };
  supportFacts: FactId[];
}
export interface SemanticLocation {
  id: LocationId;
  kitFamily: Id;
  supportFacts: FactId[];
}

export interface SemanticPlanV3 {
  semanticSchemaVersion: 3;
  claims: ClaimProposal[];
  formatProposal: Format;
  /** null for memory/text. */
  tension: Tension | null;
  actors: SemanticActor[];
  objects: SemanticObject[];
  locations: SemanticLocation[];
  scenes: ScenePlan[];
  spine: SceneId[];
  portals: PortalPlan[];
  observations: ObservationPlan[];
  preparations: PreparationPlan[];
  opportunities: OpportunityPlan[];
  primaryDecision: PrimaryDecision | null;
  truthBoundary: TruthBoundary;
  presentation: PresentationIntent;
}

/** Hard caps (master plan §U). `LAUNCH_CAPS` is what the first slices support. */
export const CAPS = {
  scenes: 8,
  locations: 5,
  foregroundActors: 8,
  objects: 12,
  facts: 32,
  events: 48,
  observations: 12,
  options: 4,
  gateDepth: 2,
  portals: 12,
  preparations: 8,
  opportunities: 8,
  beatsPerScene: 12,
  idLength: 64,
  labelLength: 80,
  factTextLength: 400,
  motiveLength: 240,
  descriptionLength: 280,
  unknowns: 5,
} as const;

export const LAUNCH_CAPS = { scenes: 4, locations: 3 } as const;

/** Per-format maximum scene counts. */
export const FORMAT_SCENE_MAX: Record<Format, number> = { micro: 1, situation: 3, sequence: 8, memory: 6, text: 0 };
