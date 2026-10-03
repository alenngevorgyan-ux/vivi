/**
 * DEVELOPMENT PLACEHOLDER GEOMETRY — not art, not Design's kit.
 *
 * Neutral, obviously named numbers that let the headless runtime prove
 * scenes load, doors resolve, ownership moves and every reposition mark
 * exists. Nothing here encodes a composition, a camera choice, a material or
 * a pose. Every id starts with `dev_placeholder` / `dev-placeholder` so a
 * stray reference in a candidate build is easy to find.
 *
 * Replacement point: Design's versioned office kit export supplies a
 * `GeometryExport` with the same scene keys and mark roles; swap it in
 * `theCorrection.ts` (`CORRECTION_GEOMETRY`). The semantic plan, the manifest
 * revision and the decision version do not change when geometry changes.
 */

import type { SpatialMark } from '../../../engine/v3/contracts/manifest.ts';
import type { GeometryExport, SceneGeometry } from './compileFixturePlan.ts';

export const PLACEHOLDER_GEOMETRY_ID = 'dev-placeholder-1';

const mark = (x: number, y: number, facing = 'dev_placeholder_facing'): SpatialMark => ({ x, y, facing });

const scene = (marks: Record<string, SpatialMark>, entry: string): SceneGeometry => ({
  kitRevision: PLACEHOLDER_GEOMETRY_ID,
  compositionRevision: PLACEHOLDER_GEOMETRY_ID,
  cameraRecipe: 'dev_placeholder_camera',
  lightRecipe: 'dev_placeholder_light',
  audioRecipe: 'dev_placeholder_audio',
  entryMark: marks[entry],
  marks,
});

/** One evenly spaced row of marks per room. Positions mean nothing beyond "distinct and in range". */
const DESK = { desk: mark(30, 60), deck_display: mark(50, 40) };
const MEETING = { own_seat: mark(30, 60), near_director: mark(60, 55), slide_display: mark(50, 20), threshold: mark(90, 50) };
const HALLWAY = { hall_threshold: mark(20, 50), door_jamb: mark(10, 50) };

/**
 * The rich topology's geometry. Scene keys are the runtime scene ids; mark roles
 * follow the gold `heroPosition` vocabulary (desk / own_seat / hall_threshold /
 * near_director) plus the display surfaces and the open door.
 */
export function placeholderGeometry(scenes: Record<string, 'desk' | 'meeting' | 'hallway'>): GeometryExport {
  const byRoom = {
    desk: () => scene(DESK, 'desk'),
    meeting: () => scene(MEETING, 'own_seat'),
    hallway: () => scene(HALLWAY, 'hall_threshold'),
  };
  return {
    id: PLACEHOLDER_GEOMETRY_ID,
    assetRevisions: { dev_placeholder_office_kit: PLACEHOLDER_GEOMETRY_ID },
    // No asset exists yet, so no hash is claimed.
    assetHashes: {},
    scenes: Object.fromEntries(Object.entries(scenes).map(([id, room]) => [id, byRoom[room]()])),
    // Staging allocation for the later meeting view only (gold staging approval); not offscreen history.
    actorMarks: { a_mira: mark(45, 25), a_director: mark(70, 45) },
  };
}
