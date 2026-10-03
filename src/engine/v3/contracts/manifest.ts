/**
 * V3 public playback manifest: the immutable, trusted compiler output a
 * player receives. Coordinates live here (compiler-owned), never in the
 * semantic proposal.
 *
 * It contains NO actual act, author option mapping, why, aftermath or reveal
 * source spans. Those live in a separate `RevealRecordV3`, fetched by
 * reference only after the truth boundary.
 */

import type {
  BeatId,
  DecisionId,
  EntityId,
  FactId,
  FactKind,
  Format,
  Id,
  Locale,
  LocationId,
  ObservationPlan,
  OpportunityId,
  OpportunityPlan,
  PortalPlan,
  PreparationPlan,
  PrimaryDecision,
  SceneId,
  ScenePlan,
  Tension,
  TruthBoundary,
} from './semantic.ts';

export const POST_SCHEMA_VERSION = 3 as const;
export const RUNTIME_MANIFEST_VERSION = 3 as const;
export const SNAPSHOT_VERSION = 1 as const;

export interface SpatialMark {
  /** 0..100 in the kit's floor space. */
  x: number;
  y: number;
  facing: Id;
}

export interface CompiledScene {
  id: SceneId;
  location: LocationId;
  kitRevision: Id;
  compositionRevision: Id;
  cameraRecipe: Id;
  lightRecipe: Id;
  audioRecipe: Id;
  /** Every required fact must be readable without the renderer. */
  accessibleText: Array<{ fact: FactId; text: string }>;
  entryMark?: SpatialMark;
  marks?: Record<Id, SpatialMark>;
  routes?: Record<Id, Array<[number, number]>>;
}

export interface EntityState {
  id: EntityId;
  kind: 'actor' | 'object';
  owner: { kind: 'location' | 'actor' | 'offstage'; id: Id };
  mark?: SpatialMark;
  /** Keys and values are enumerated by the manifest, never free text. */
  state: Record<Id, string>;
}

export interface ManifestFact {
  id: FactId;
  text: string;
  kind: FactKind;
}

export interface PlaybackManifestV3 {
  runtimeManifestVersion: 3;
  semanticSchemaVersion: 3;
  /** Compiler that produced this manifest (semver). */
  compilerVersion: string;
  /** Pinned kit/recipe revisions: published evidence is never silently reframed by asset upgrades. */
  assetRevisions: Record<Id, Id>;
  assetHashes: Record<Id, string>;
  experienceId: Id;
  revision: Id;
  /** Immutable choice identity: a visual bug fix must not erase first-choice continuity. */
  decisionVersion: Id;
  locale: Locale;
  format: Format;
  perspectiveActor: EntityId;
  spine: SceneId[];
  tension: Tension | null;
  scenePlans: ScenePlan[];
  compiledScenes: CompiledScene[];
  portals: PortalPlan[];
  initialEntities: EntityState[];
  observations: ObservationPlan[];
  preparations: PreparationPlan[];
  opportunities: OpportunityPlan[];
  facts: ManifestFact[];
  primaryDecision: PrimaryDecision | null;
  truthBoundary: TruthBoundary;
  stagingDisclosure: string;
}

/** Private author record. Never part of the manifest and never sent before the boundary. */
export interface RevealRecordV3 {
  experienceId: Id;
  revision: Id;
  status: 'author_account' | 'fictional_editorial' | 'withheld' | 'documented';
  act?: string;
  why?: string;
  aftermath?: string;
  authorOption?: OpportunityId;
  authorHandle: string;
  sourceRefs?: string[];
}

export interface StoredPostV3 {
  postSchemaVersion: 3;
  id: Id;
  playback: PlaybackManifestV3;
  /** Reference to the separate reveal record; the record itself is not here. */
  revealRef: Id;
  parentRevision?: Id;
  responseToPostId?: Id;
}

export type { BeatId, DecisionId };
