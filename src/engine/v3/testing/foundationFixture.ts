/**
 * A neutral, hand-written manifest used to exercise the V3 substrate: three
 * scenes in two locations, one persistent carried object, an actor who moves
 * between locations, a reversible excursion and one primary decision.
 *
 * It is deliberately NOT a story. It carries no editorial content, no story
 * id special case and no visual identity; the story fixtures (format proof,
 * "The correction") plug into the same contracts and replace this. Do not put
 * real stories here.
 */

import type { PlaybackManifestV3, RevealRecordV3, StoredPostV3 } from '../contracts/manifest.ts';
import type { SemanticPlanV3 } from '../contracts/semantic.ts';

const f = (id: string, text: string, kind: 'observed' | 'hero_belief' | 'quoted_speech' | 'timing' = 'observed') => ({ id, text, kind });

const base = (): PlaybackManifestV3 => ({
  runtimeManifestVersion: 3,
  semanticSchemaVersion: 3,
  compilerVersion: '0.0.0-fixture',
  assetRevisions: { kit_neutral: 'r1' },
  assetHashes: { kit_neutral: '0123456789abcdef0123456789abcdef' },
  experienceId: 'foundation_fixture',
  revision: 'r1',
  decisionVersion: 'dv1',
  locale: 'en',
  format: 'sequence',
  perspectiveActor: 'hero',
  spine: ['scene_a', 'scene_b', 'scene_c'],
  tension: {
    description: 'A neutral fixture tension between two attractions.',
    perspectiveActor: 'hero',
    poles: [
      { motive: 'Fixture motive one.', stakeFacts: ['f1'] },
      { motive: 'Fixture motive two.', stakeFacts: ['f2'] },
    ],
    unknowns: ['Fixture unknown.'],
  },
  scenePlans: [
    {
      id: 'scene_a', location: 'room_a', kind: 'inhabited', viewpoint: 'hero', purpose: 'orient',
      requiredFacts: ['f0', 'f1'],
      beats: [{ id: 'b_a1', after: [], events: [{ kind: 'deliver', facts: ['f0'] }], emphasis: 'relation', delivery: 'reader' }],
      observationIds: ['o_a1'], opportunityIds: [], composition: 'comp_neutral',
    },
    {
      id: 'scene_b', location: 'room_b', kind: 'inhabited', viewpoint: 'hero', purpose: 'discover',
      requiredFacts: ['f2'],
      beats: [
        { id: 'b_b1', after: [], events: [{ kind: 'deliver', facts: ['f2'] }], emphasis: 'evidence', delivery: 'reader' },
        { id: 'b_b2', after: ['b_b1'], events: [{ kind: 'transfer', entity: 'other', to: 'room_a', facts: ['f5'] }, { kind: 'hold' }], emphasis: 'threshold', delivery: 'reader' },
      ],
      observationIds: ['o_b1'], opportunityIds: [], composition: 'comp_neutral',
    },
    {
      id: 'scene_c', location: 'room_a', kind: 'inhabited', viewpoint: 'hero', purpose: 'decide',
      requiredFacts: ['f3'],
      beats: [
        { id: 'b_c1', after: [], events: [{ kind: 'quote', actor: 'other', fact: 'f3' }], emphasis: 'relation', delivery: 'reader' },
        { id: 'b_c2', after: ['b_c1'], events: [{ kind: 'hold' }], emphasis: 'held', delivery: 'soft_flow' },
      ],
      observationIds: [], opportunityIds: ['act_speak', 'act_wait', 'act_ask'], composition: 'comp_neutral',
    },
  ],
  compiledScenes: ['scene_a', 'scene_b', 'scene_c'].map(id => ({
    id,
    location: id === 'scene_b' ? 'room_b' : 'room_a',
    kitRevision: 'r1', compositionRevision: 'r1',
    cameraRecipe: 'cam_neutral', lightRecipe: 'light_neutral', audioRecipe: 'audio_neutral',
    accessibleText:
      id === 'scene_a' ? [{ fact: 'f0', text: 'Fixture context.' }, { fact: 'f1', text: 'The lamp is on.' }]
      : id === 'scene_b' ? [{ fact: 'f2', text: 'The second room is quiet.' }]
      : [{ fact: 'f3', text: 'The other says: fixture line.' }],
  })),
  portals: [
    { id: 'p_a_to_b', label: 'Go to the second room', kind: 'spine', from: 'room_a', to: 'room_b', fromScene: 'scene_a', toScene: 'scene_b', available: { kind: 'fact_received', id: 'f1' }, supportFacts: [], authority: 'source' },
    { id: 'p_b_to_c', label: 'Return and resume', kind: 'spine', from: 'room_b', to: 'room_a', fromScene: 'scene_b', toScene: 'scene_c', available: { kind: 'all', gates: [{ kind: 'fact_received', id: 'f2' }, { kind: 'beat_delivered', id: 'b_b2' }] }, supportFacts: [], authority: 'source' },
    { id: 'p_b_peek_a', label: 'Step back to the first room', kind: 'excursion', from: 'room_b', to: 'room_a', fromScene: 'scene_b', toScene: 'scene_a', returnPortal: 'p_a_back_b', available: { kind: 'always' }, supportFacts: [], authority: 'author_approved_staging' },
    { id: 'p_a_back_b', label: 'Go back to the second room', kind: 'excursion', from: 'room_a', to: 'room_b', fromScene: 'scene_a', toScene: 'scene_b', returnPortal: 'p_b_peek_a', available: { kind: 'always' }, supportFacts: [], authority: 'author_approved_staging' },
  ],
  initialEntities: [
    { id: 'hero', kind: 'actor', owner: { kind: 'location', id: 'room_a' }, state: {} },
    { id: 'other', kind: 'actor', owner: { kind: 'location', id: 'room_b' }, state: {} },
    { id: 'lamp', kind: 'object', owner: { kind: 'location', id: 'room_a' }, state: {} },
    { id: 'note', kind: 'object', owner: { kind: 'location', id: 'room_a' }, state: {} },
  ],
  observations: [
    { id: 'o_a1', target: { kind: 'object', id: 'lamp' }, label: 'Look at the lamp', facts: ['f1'], available: { kind: 'always' }, presentation: 'insert' },
    { id: 'o_b1', target: { kind: 'actor', id: 'other' }, label: 'Look at the other person', facts: ['f4'], available: { kind: 'always' }, presentation: 'two_shot' },
  ],
  preparations: [
    { id: 'prep_stand', target: { kind: 'self' }, label: 'Stand nearer', available: { kind: 'always' }, supportFacts: [], action: { kind: 'reposition', markRole: 'near_other' } },
    { id: 'prep_hold_note', target: { kind: 'object', id: 'note' }, label: 'Pick up your note', available: { kind: 'always' }, supportFacts: [], action: { kind: 'hold_own_object', object: 'note' } },
    { id: 'prep_put_back_note', target: { kind: 'object', id: 'note' }, label: 'Put your note back', available: { kind: 'always' }, supportFacts: [], action: { kind: 'put_back_own_object', object: 'note' } },
  ],
  opportunities: [
    { id: 'act_speak', decision: 'd_main', target: { kind: 'self' }, verb: 'speak', label: 'Say something', motive: 'Fixture motive for speaking.', fearedCostFacts: ['f2'], feasibilityFacts: ['f3'], available: { kind: 'always' } },
    { id: 'act_wait', decision: 'd_main', target: { kind: 'self' }, verb: 'remain_silent', label: 'Stay quiet', motive: 'Fixture motive for staying quiet.', fearedCostFacts: ['f1'], feasibilityFacts: ['f3'], available: { kind: 'always' } },
    { id: 'act_ask', decision: 'd_main', target: { kind: 'actor', id: 'other' }, verb: 'ask', label: 'Ask the other person', motive: 'Fixture motive for asking.', fearedCostFacts: ['f1'], feasibilityFacts: ['f3'], available: { kind: 'always' } },
  ],
  facts: [
    f('f0', 'Fixture context fact.'),
    f('f1', 'The lamp is on.'),
    f('f2', 'The second room is quiet.'),
    f('f3', 'The other says: fixture line.', 'quoted_speech'),
    f('f4', 'The other person is standing by the window.'),
    f('f5', 'The other person went to the first room.'),
  ],
  primaryDecision: { id: 'd_main', scene: 'scene_c', minimumKnowledge: ['f1', 'f2', 'f3'], options: ['act_speak', 'act_wait', 'act_ask'] },
  truthBoundary: { scene: 'scene_c', after: 'primary_act' },
  stagingDisclosure: 'Neutral test fixture. Not a story.',
});

export const foundationManifest = (): PlaybackManifestV3 => structuredClone(base());

export const foundationPost = (): StoredPostV3 => ({ postSchemaVersion: 3, id: 'post_foundation', playback: foundationManifest(), revealRef: 'reveal_foundation' });

/** Private author record. Lives apart from the manifest; the canaries prove it never leaks into it. */
export const FOUNDATION_REVEAL_CANARIES = ['CANARY-ACT-9f3k', 'CANARY-WHY-4q7m', 'CANARY-AFTER-2x8v'] as const;
export const foundationReveal = (): RevealRecordV3 => ({
  experienceId: 'foundation_fixture',
  revision: 'r1',
  status: 'fictional_editorial',
  act: FOUNDATION_REVEAL_CANARIES[0],
  why: FOUNDATION_REVEAL_CANARIES[1],
  aftermath: FOUNDATION_REVEAL_CANARIES[2],
  authorHandle: 'fixture_author',
});

/** The semantic proposal that compiles to the manifest above (claims instead of facts, no coordinates). */
export function foundationSemanticPlan(): SemanticPlanV3 {
  const m = foundationManifest();
  return {
    semanticSchemaVersion: 3,
    claims: m.facts.map((x, i) => ({ id: x.id, claim: x.text, sourceSpanIds: [`span_${i + 1}`], kind: x.kind })),
    formatProposal: 'sequence',
    tension: m.tension,
    actors: [
      { id: 'hero', role: 'hero', initialLocation: 'room_a', supportFacts: ['f0'] },
      { id: 'other', role: 'other', initialLocation: 'room_b', supportFacts: ['f4'] },
    ],
    objects: [
      { id: 'lamp', assetClass: 'lamp', owner: { kind: 'location', id: 'room_a' }, supportFacts: ['f1'] },
      { id: 'note', assetClass: 'document', owner: { kind: 'location', id: 'room_a' }, supportFacts: [] },
    ],
    locations: [
      { id: 'room_a', kitFamily: 'kit_neutral', supportFacts: [] },
      { id: 'room_b', kitFamily: 'kit_neutral', supportFacts: [] },
    ],
    scenes: m.scenePlans,
    spine: m.spine,
    portals: m.portals,
    observations: m.observations,
    preparations: m.preparations,
    opportunities: m.opportunities,
    primaryDecision: m.primaryDecision,
    truthBoundary: m.truthBoundary,
    presentation: { style: 'style_neutral', mood: 'intimate', time: 'soft' },
  };
}
