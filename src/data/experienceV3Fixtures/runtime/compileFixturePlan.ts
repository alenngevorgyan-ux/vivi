/**
 * Deterministic compile: validated `SemanticPlanV3` + versioned geometry → `PlaybackManifestV3`.
 *
 * Foundation ships no compiler yet ("the compiler/semantic pipeline … not
 * implemented", docs/VIVI_V3_FOUNDATION.md). This is the integration stand-in
 * for the ordinary deterministic step: a pure, generic projection with no
 * story knowledge and no model. It adds only what the plan cannot carry —
 * compiler-owned geometry/recipe ids and fact text for the readable path —
 * and is meant to be replaced by A's compiler without touching fixtures.
 *
 * Geometry is an input, never invented here. Today that input is the clearly
 * named development placeholder (see placeholderGeometry.ts); Design's
 * versioned kit export replaces it through the same `SceneGeometry` shape.
 */

import type { CompiledScene, EntityState, PlaybackManifestV3, SpatialMark } from '../../../engine/v3/contracts/manifest.ts';
import type { Id, Locale, SemanticPlanV3 } from '../../../engine/v3/contracts/semantic.ts';

export interface SceneGeometry {
  kitRevision: Id;
  compositionRevision: Id;
  cameraRecipe: Id;
  lightRecipe: Id;
  audioRecipe: Id;
  entryMark?: SpatialMark;
  /** Named marks (0..100 floor space). Every reposition `markRole` in the scene must have one. */
  marks?: Record<Id, SpatialMark>;
  /** Approved routes between marks (0..100 points); carried into the manifest unchanged. */
  routes?: Record<Id, Array<[number, number]>>;
}

export interface GeometryExport {
  /** Version of this geometry set, e.g. a Design kit export revision. */
  id: Id;
  assetRevisions: Record<Id, Id>;
  assetHashes: Record<Id, string>;
  scenes: Record<Id, SceneGeometry>;
  /** Initial staging marks of non-hero actors (staging allocation, never evidence of earlier whereabouts). */
  actorMarks: Record<Id, SpatialMark>;
}

export interface CompileInput {
  experienceId: Id;
  revision: Id;
  decisionVersion: Id;
  locale: Locale;
  compilerVersion: string;
  stagingDisclosure: string;
  geometry: GeometryExport;
}

export function compileFixturePlan(plan: SemanticPlanV3, input: CompileInput): PlaybackManifestV3 {
  const g = input.geometry;
  const claimText = new Map(plan.claims.map(c => [c.id, c.claim] as const));
  const visited = new Set(plan.scenes.map(s => s.location));
  const hero = plan.tension?.perspectiveActor ?? plan.actors[0]?.id;
  if (!hero) throw new Error('a playable plan needs a perspective actor');

  const compiledScenes: CompiledScene[] = plan.scenes.map(s => {
    const geo = g.scenes[s.id];
    if (!geo) throw new Error(`geometry ${g.id} has no scene ${s.id}`);
    return {
      id: s.id,
      location: s.location,
      kitRevision: geo.kitRevision,
      compositionRevision: geo.compositionRevision,
      cameraRecipe: geo.cameraRecipe,
      lightRecipe: geo.lightRecipe,
      audioRecipe: geo.audioRecipe,
      // The readable path: every required fact is plain text, independent of any renderer.
      accessibleText: s.requiredFacts.map(fact => ({ fact, text: claimText.get(fact)! })),
      ...(geo.entryMark ? { entryMark: structuredClone(geo.entryMark) } : {}),
      ...(geo.marks ? { marks: structuredClone(geo.marks) } : {}),
      ...(geo.routes ? { routes: structuredClone(geo.routes) } : {}),
    };
  });

  const initialEntities: EntityState[] = [
    ...plan.actors.map(a => ({
      id: a.id,
      kind: 'actor' as const,
      owner: { kind: 'location' as const, id: a.initialLocation },
      ...(g.actorMarks[a.id] ? { mark: structuredClone(g.actorMarks[a.id]) } : {}),
      state: {},
    })),
    ...plan.objects.map(o => ({
      id: o.id,
      kind: 'object' as const,
      // An object whose place no scene of this manifest shows is offstage (a recollected display, say), not invented somewhere visible.
      owner: o.owner.kind === 'location' && !visited.has(o.owner.id) ? { kind: 'offstage' as const, id: 'offstage' } : { ...o.owner },
      state: {},
    })),
  ];

  return {
    runtimeManifestVersion: 3,
    semanticSchemaVersion: 3,
    compilerVersion: input.compilerVersion,
    assetRevisions: { ...g.assetRevisions },
    assetHashes: { ...g.assetHashes },
    experienceId: input.experienceId,
    revision: input.revision,
    decisionVersion: input.decisionVersion,
    locale: input.locale,
    format: plan.formatProposal,
    perspectiveActor: hero,
    spine: [...plan.spine],
    tension: structuredClone(plan.tension),
    scenePlans: structuredClone(plan.scenes),
    compiledScenes,
    portals: structuredClone(plan.portals),
    initialEntities,
    observations: structuredClone(plan.observations),
    preparations: structuredClone(plan.preparations),
    opportunities: structuredClone(plan.opportunities),
    facts: plan.claims.map(c => ({ id: c.id, text: c.claim, kind: c.kind })),
    primaryDecision: structuredClone(plan.primaryDecision),
    truthBoundary: structuredClone(plan.truthBoundary),
    stagingDisclosure: input.stagingDisclosure,
  };
}
