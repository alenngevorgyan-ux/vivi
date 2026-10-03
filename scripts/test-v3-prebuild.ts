import assert from 'node:assert/strict';
import type { PlaybackManifestV3 } from '../src/engine/v3/contracts/manifest.ts';
import type { RuntimeSnapshot } from '../src/engine/v3/contracts/state.ts';
import { GEOMETRY_SCHEMA_VERSION, pointInPolygon, projectPoint, standable, unprojectFloor, validateGeometryForManifest, validateRuntimeGeometry, type RuntimeGeometryV3 } from '../src/engine/v3/contracts/geometry.ts';
import { adaptDesignGeometry, GeometryAdapterError, type DesignGeometrySource } from '../src/engine/v3/geometry/designAdapter.ts';
import { MIN_CANARY_LENGTH, PrivateCanaryError, findPrivateLeaks, normalizeCanary, validateManifest, validatePrivateCanaries } from '../src/engine/v3/contracts/validate.ts';
import { createExperience, restoreSnapshot, step, type ExperienceEvent, type StepResult } from '../src/engine/v3/ExperienceController.ts';
import { FOUNDATION_REVEAL_CANARIES, foundationManifest } from '../src/engine/v3/testing/foundationFixture.ts';
import { CORRECTION_REVEAL_CANARIES } from '../src/data/experienceV3Fixtures/runtime/theCorrection.reveal.ts';

/**
 * Pre-build blocker regressions for the pure layers:
 *   B02  authoritative geometry (adapter, validators, manifest agreement) and location-specific hero marks
 *   B05  restore hardening (ordered validation, adversarial witnesses, no throws)
 *   B07  private canary configuration
 * The asynchronous host contracts (B03, B04, B06) are in test-v3-host.ts.
 */

console.log('Testing V3 pre-build blockers (pure)...\n');
let n = 0;
const ok = (label: string) => console.log(`✓ ${++n}. ${label}`);
const clone = <T,>(x: T): T => structuredClone(x);
let act = 0;
const aid = () => `p${++act}`;

/* ===================================================================== */
/* B02 — Design source → runtime geometry                                  */
/* ===================================================================== */

const FACINGS = [
  { yaw: 0, facing: 'toward_viewer' },
  { yaw: 90, facing: 'right' },
  { yaw: 180, facing: 'away' },
  { yaw: 270, facing: 'left' },
];

const room = (location: string): DesignGeometrySource['locations'][number] => ({
  location,
  kitRevision: 'dev-kit-1',
  bounds: { xMin: 0, xMax: 20, zMin: 2, zMax: 12 }, // deliberately not square: width 20, depth 10
  heightScale: 3,
  marks: { entry: { at: [2, 3], yaw: 0 }, near_other: { at: [7, 4], yaw: 90 } },
  walkable: [{ outer: [[0.5, 2.5], [9.5, 2.5], [9.5, 11.5], [0.5, 11.5]], holes: [[[4, 6], [6, 6], [6, 8], [4, 8]]] }],
  obstacles: [{ id: 'desk', polygon: [[4, 6], [6, 6], [6, 8], [4, 8]] }],
  occluders: [{ id: 'desk_top', polygon: [[4, 6], [6, 6], [6, 8], [4, 8]], height: 0.75, priority: 1 }],
  portals: [{ portal: 'p_b_peek_a', a: [9.5, 5], b: [9.5, 7], yaw: 90 }, { portal: 'p_a_back_b', a: [0.5, 5], b: [0.5, 7], yaw: 270 }],
  anchors: [
    { entity: 'hero', root: [2, 3], height: 1.7, yaw: 0 },
    { entity: 'lamp', root: [5, 7], height: 0.6 },
    { entity: 'note', root: [5.5, 7], height: 0.8, surface: [[5, 0.8, 7], [6, 0.8, 7], [6, 0.7, 7], [5, 0.7, 7]] },
  ],
  attachments: [{ id: 'hero_hand', entity: 'hero', offset: [0.3, 1, 0.1] }],
});
const camera = (location: string, id: string): DesignGeometrySource['cameras'][number] => ({
  id,
  location,
  orientation: 'landscape',
  viewport: { width: 1920, height: 1080 },
  cx: 960,
  hy: 380,
  f: 900,
  cam: [5, 1.6, -4],
  safe: { x: 96, y: 54, width: 1728, height: 972 },
});
const SOURCE: DesignGeometrySource = {
  designSchemaVersion: 1,
  sourceRevision: 'dev-source-1',
  facings: FACINGS,
  locations: [room('room_a'), room('room_b')],
  cameras: [camera('room_a', 'cam_a'), camera('room_b', 'cam_b')],
};
const OPTS = { geometryRevision: 'geo-1', adapterVersion: '1.0.0', sourceHash: 'a'.repeat(64), precision: 6 };

{
  const { geometry: g, marks } = adaptDesignGeometry(SOURCE, OPTS);
  // ONE affine mapping for every point: x' = 100(x-xMin)/w, y' = 100(z-zMin)/d, h' = y/heightScale.
  assert.deepEqual(marks.room_a.entry, { x: 10, y: 10, facing: 'toward_viewer' });
  assert.deepEqual(marks.room_a.near_other, { x: 35, y: 20, facing: 'right' });
  const a = g.locations[0];
  assert.deepEqual(a.walkable[0].outer, [[2.5, 5], [47.5, 5], [47.5, 95], [2.5, 95]]);
  assert.deepEqual(a.walkable[0].holes, [[[20, 40], [30, 40], [30, 60], [20, 60]]]);
  assert.deepEqual(a.occluders[0], { id: 'desk_top', polygon: [[20, 40], [30, 40], [30, 60], [20, 60]], height: 0.25, priority: 1 });
  assert.deepEqual(a.portals[0], { portal: 'p_b_peek_a', a: [47.5, 30], b: [47.5, 50], facing: 'right' });
  assert.deepEqual(a.anchors[0], { entity: 'hero', root: [10, 10], height: 0.566667, facing: 'toward_viewer' });
  assert.deepEqual(a.anchors[2].surface?.[0], [25, 50, 0.266667]);
  assert.deepEqual(a.attachments[0].offset, [1.5, 1, 0.333333], 'attachment offsets are deltas: scaled, not translated');
  assert.equal(g.geometrySchemaVersion, GEOMETRY_SCHEMA_VERSION);
  assert.deepEqual(g.provenance, { sourceRevision: 'dev-source-1', adapterVersion: '1.0.0', sourceHash: 'a'.repeat(64) });
  // Valid on its own, and deterministic.
  assert.equal(validateRuntimeGeometry(g).ok, true, JSON.stringify(validateRuntimeGeometry(g).issues));
  assert.equal(JSON.stringify(adaptDesignGeometry(SOURCE, OPTS)), JSON.stringify(adaptDesignGeometry(clone(SOURCE), OPTS)), 'same source, same bytes');
  // Input order of locations changes nothing semantic but is preserved (no hidden sorting that could mask a mismatch).
  assert.deepEqual(g.locations.map(l => l.location), ['room_a', 'room_b']);
  // The source object is never mutated.
  const frozen = JSON.stringify(SOURCE);
  adaptDesignGeometry(SOURCE, OPTS);
  assert.equal(JSON.stringify(SOURCE), frozen);
}
ok('Adapter: one affine mapping for floor, height, marks, doors, anchors and attachments; deterministic; never mutates its input; output validates');

{
  // The compiled camera reproduces Design's own perspective, and the floor inverse round-trips.
  const { geometry: g } = adaptDesignGeometry(SOURCE, OPTS);
  const cam = g.cameras[0];
  const src = SOURCE.cameras[0];
  const loc = SOURCE.locations[0];
  const designProject = (x: number, y: number, z: number) => ({ sx: src.cx + (src.f * (x - src.cam[0])) / (z - src.cam[2]), sy: src.hy + (src.f * (src.cam[1] - y)) / (z - src.cam[2]) });
  const norm = (x: number, z: number): [number, number] => [(100 * (x - loc.bounds.xMin)) / (loc.bounds.xMax - loc.bounds.xMin), (100 * (z - loc.bounds.zMin)) / (loc.bounds.zMax - loc.bounds.zMin)];
  for (const [x, y, z] of [[2, 0, 3], [7, 0, 4], [5, 1.7, 7], [9.5, 0.75, 11.5], [0.5, 2.5, 2.5]] as const) {
    const want = designProject(x, y, z);
    const [nx, nz] = norm(x, z);
    const got = projectPoint(cam, nx, nz, y / loc.heightScale)!;
    assert.ok(Math.abs(got.sx - want.sx) < 1e-3 && Math.abs(got.sy - want.sy) < 1e-3, `projection of ${[x, y, z]}: ${JSON.stringify(got)} vs ${JSON.stringify(want)}`);
  }
  // Round trip: floor point → screen → floor point.
  for (const [x, z] of [[2, 3], [7, 4], [5, 7], [9, 11], [1, 2.5]] as const) {
    const [nx, nz] = norm(x, z);
    const s = projectPoint(cam, nx, nz, 0)!;
    const back = unprojectFloor(cam, s.sx, s.sy)!;
    assert.ok(Math.abs(back[0] - nx) < 1e-3 && Math.abs(back[1] - nz) < 1e-3, `round trip ${[x, z]} → ${back}`);
  }
  // Degenerate and out-of-front inputs have no projection and no inverse; they never produce NaN.
  assert.equal(projectPoint(cam, 50, cam.projection.camY, 0), undefined, 'a point on the camera plane');
  assert.equal(projectPoint(cam, 50, cam.projection.camY - 5, 0), undefined, 'a point behind the camera');
  assert.equal(unprojectFloor(cam, 960, cam.projection.hy), undefined, 'the horizon line has no floor point');
  assert.equal(unprojectFloor(cam, 960, cam.projection.hy - 50), undefined, 'above the horizon has no floor point');
  // Floor containment: holes and obstacles are not standable; edges count as inside.
  const l = g.locations[0];
  assert.equal(standable(l, [10, 10]), true);
  assert.equal(standable(l, [25, 50]), false, 'inside the desk obstacle and its walkable hole');
  assert.equal(standable(l, [1, 2]), false, 'outside the walkable polygon');
  assert.equal(pointInPolygon([2.5, 50], [[2.5, 5], [47.5, 5], [47.5, 95], [2.5, 95]]), true, 'on an edge');
  // Portrait is a separate recipe over the same marks.
  const portrait = adaptDesignGeometry({ ...SOURCE, cameras: [...SOURCE.cameras, { ...camera('room_a', 'cam_a_portrait'), orientation: 'portrait', viewport: { width: 1080, height: 1920 }, cx: 540, hy: 700, f: 1100, safe: { x: 54, y: 96, width: 972, height: 1728 } }] }, OPTS);
  assert.equal(portrait.geometry.cameras.length, 3);
  assert.equal(portrait.geometry.cameras[2].orientation, 'portrait');
  assert.deepEqual(portrait.marks, adaptDesignGeometry(SOURCE, OPTS).marks, 'marks do not depend on the camera');
}
ok('Compiled cameras reproduce the Design perspective, floor unprojection round-trips, and degenerate/behind-camera points have no projection');

{
  const reject = (label: string, mutate: (s: DesignGeometrySource) => void, match: RegExp) => {
    const s = clone(SOURCE);
    mutate(s);
    assert.throws(() => adaptDesignGeometry(s, OPTS), (e: unknown) => e instanceof GeometryAdapterError && match.test(e.message), `${label}: expected ${match}`);
  };
  reject('a mark outside the declared bounds', s => (s.locations[0].marks.entry.at = [-0.1, 3]), /mark entry lies outside/);
  reject('a mark beyond the far bound', s => (s.locations[0].marks.entry.at = [2, 12.5]), /mark entry lies outside/);
  reject('a walkable point outside', s => (s.locations[0].walkable[0].outer[0] = [20.5, 3]), /walkable\[0\]\[0\] lies outside/);
  reject('an obstacle outside', s => (s.locations[0].obstacles[0].polygon[1] = [4, 99]), /obstacle desk\[1\] lies outside/);
  reject('a door outside', s => (s.locations[1].portals[0].a = [25, 5]), /door p_b_peek_a lies outside/);
  reject('an anchor outside', s => (s.locations[0].anchors[1].root = [5, 12.0001]), /anchor lamp lies outside/);
  reject('a surface corner outside', s => (s.locations[0].anchors[2].surface![2] = [21, 0.7, 7]), /surface note\[2\] lies outside/);
  reject('a non-finite coordinate', s => (s.locations[0].marks.entry.at = [Number.NaN, 3]), /outside/);
  reject('an unapproved yaw on a mark', s => (s.locations[0].marks.entry.yaw = 45), /yaw 45 is not an approved facing/);
  reject('an unapproved yaw on a door', s => (s.locations[0].portals[0].yaw = 33), /yaw 33 is not an approved facing/);
  reject('an unapproved yaw on an anchor', s => (s.locations[0].anchors[0].yaw = 1), /yaw 1 is not an approved facing/);
  reject('degenerate bounds', s => (s.locations[0].bounds.xMax = 0), /degenerate bounds/);
  reject('degenerate height scale', s => (s.locations[0].heightScale = 0), /degenerate/);
  reject('a negative height', s => (s.locations[0].anchors[0].height = -1), /invalid height/);
  reject('a camera over an unknown location', s => (s.cameras[0].location = 'room_z'), /unknown location/);
  reject('a zero focal length', s => (s.cameras[0].f = 0), /degenerate focal length/);
  reject('a non-finite camera position', s => (s.cameras[0].cam = [5, Number.NaN, -4]), /non-finite camera coefficients/);
  reject('an infinite principal point', s => (s.cameras[0].cx = Number.POSITIVE_INFINITY), /non-finite camera coefficients/);
  reject('a non-finite safe region', s => (s.cameras[0].safe.width = Number.NaN), /non-finite camera coefficients/);
  reject('a malformed camera position', s => ((s.cameras[0] as { cam: unknown }).cam = [5, 1.6]), /non-finite camera coefficients/);
  reject('a seated mark naming no obstacle', s => (s.locations[0].marks.entry = { at: [5, 7], yaw: 0, posture: 'seat', seat: 'nope' }), /seated mark entry names no obstacle/);
  reject('a seated mark with no seat', s => (s.locations[0].marks.entry = { at: [5, 7], yaw: 0, posture: 'seat' }), /seated mark entry names no obstacle/);
  reject('a seated mark that is not on its seat', s => (s.locations[0].marks.entry = { at: [2, 3], yaw: 0, posture: 'seat', seat: 'desk' }), /seated mark entry is not on its declared seat desk/);
  reject('a seat named by a standing mark', s => (s.locations[0].marks.entry = { at: [5, 7], yaw: 0, posture: 'stand', seat: 'desk' }), /names a seat but is not seated/);
  reject('a seat named with no posture', s => (s.locations[0].marks.entry = { at: [5, 7], yaw: 0, seat: 'desk' }), /names a seat but is not seated/);
  // Posture comes from Design, never from a mark's name: a standing mark called own_seat is standing.
  const named = clone(SOURCE);
  named.locations[0].marks.own_seat = { at: [7, 4], yaw: 90, posture: 'stand' };
  named.locations[0].marks.seat_plain = { at: [8, 4], yaw: 90 };
  const namedOut = adaptDesignGeometry(named, OPTS);
  assert.equal(namedOut.geometry.locations[0].seats, undefined, 'a mark named like a seat is not seated unless Design says posture: seat');
  reject('an unknown posture', s => (s.locations[0].marks.entry = { at: [5, 7], yaw: 0, posture: 'lie' as 'seat', seat: 'desk' }), /unknown posture/);
  reject('an unsupported Design schema', s => ((s as { designSchemaVersion: number }).designSchemaVersion = 2), /unsupported Design geometry schema/);
  // Nothing is ever clamped: a point exactly ON a bound is accepted, one epsilon past it is not.
  const edge = clone(SOURCE);
  edge.locations[0].marks.entry.at = [20, 12];
  assert.deepEqual(adaptDesignGeometry(edge, OPTS).marks.room_a.entry, { x: 100, y: 100, facing: 'toward_viewer' });
}
ok('Adapter errors, never clamps: out-of-bounds points, unapproved yaws, degenerate bounds/cameras, unknown locations and bad heights all throw');

{
  const { geometry: g } = adaptDesignGeometry(SOURCE, OPTS);
  const invalid = (label: string, mutate: (x: any) => void, path: RegExp) => {
    const x: any = clone(g);
    mutate(x);
    const r = validateRuntimeGeometry(x);
    assert.equal(r.ok, false, `${label}: must be rejected`);
    assert.ok(r.issues.some(i => path.test(i.path)), `${label}: expected an issue at ${path}, got ${r.issues.map(i => i.path).join(', ')}`);
  };
  invalid('wrong schema version', x => (x.geometrySchemaVersion = 2), /geometrySchemaVersion/);
  invalid('missing revision', x => delete x.geometryRevision, /geometryRevision/);
  invalid('unknown top-level key', x => (x.extra = 1), /extra/);
  invalid('hash not sha-256', x => (x.provenance.sourceHash = 'abc'), /sourceHash/);
  invalid('adapter version not semver', x => (x.provenance.adapterVersion = 'latest'), /adapterVersion/);
  invalid('floor point out of range', x => (x.locations[0].walkable[0].outer[0] = [101, 5]), /walkable\[0\]\.outer\[0\]/);
  invalid('degenerate polygon', x => (x.locations[0].obstacles[0].polygon = [[1, 1], [2, 2], [3, 3]]), /obstacles\[0\]\.polygon/);
  invalid('too few points', x => (x.locations[0].obstacles[0].polygon = [[1, 1], [2, 2]]), /obstacles\[0\]\.polygon/);
  invalid('no walkable floor', x => (x.locations[0].walkable = []), /walkable/);
  invalid('duplicate location', x => (x.locations[1].location = 'room_a'), /locations\[1\]\.location/);
  invalid('duplicate obstacle id', x => x.locations[0].obstacles.push(clone(x.locations[0].obstacles[0])), /obstacles\[1\]\.id/);
  invalid('occluder height zero', x => (x.locations[0].occluders[0].height = 0), /occluders\[0\]\.height/);
  invalid('occluder priority not integer', x => (x.locations[0].occluders[0].priority = 1.5), /priority/);
  invalid('door with identical ends', x => (x.locations[0].portals[0].b = x.locations[0].portals[0].a), /portals\[0\]/);
  invalid('anchor negative height', x => (x.locations[0].anchors[0].height = -1), /anchors\[0\]\.height/);
  invalid('surface not four corners', x => (x.locations[0].anchors[2].surface = [[1, 1, 1]]), /surface/);
  invalid('attachment offset not finite', x => (x.locations[0].attachments[0].offset = [0, Number.POSITIVE_INFINITY, 0]), /offset/);
  invalid('camera over a location with no geometry', x => (x.cameras[0].location = 'room_z'), /cameras\[0\]\.location/);
  invalid('duplicate camera id', x => (x.cameras[1].id = 'cam_a'), /cameras\[1\]\.id/);
  invalid('degenerate projection', x => (x.cameras[0].projection.fx = 0), /projection/);
  invalid('NaN projection', x => (x.cameras[0].projection.hy = Number.NaN), /projection/);
  invalid('safe region outside the viewport', x => (x.cameras[0].safe.width = 5000), /safe/);
  invalid('bad orientation', x => (x.cameras[0].orientation = 'square'), /orientation/);
  for (const junk of [undefined, null, 0, '', [], () => 1, { geometrySchemaVersion: 1 }]) assert.doesNotThrow(() => validateRuntimeGeometry(junk), 'junk never throws');
  assert.equal(validateRuntimeGeometry([]).ok, false);
  // Issues name paths and codes, never echo supplied text.
  const leaky: any = clone(g);
  leaky.locations[0].location = 'SECRET TEXT <b>';
  assert.equal(JSON.stringify(validateRuntimeGeometry(leaky).issues).includes('SECRET'), false);
}
ok('Runtime geometry validation: closed keys, versions, hashes, ranges, polygons, uniqueness, projections and safe regions; junk never throws and never echoes input');

/** The foundation manifest with approved marks injected from the adapter, as the compile step does. */
function markedManifest(): { m: PlaybackManifestV3; geo: RuntimeGeometryV3 } {
  const { geometry, marks } = adaptDesignGeometry(SOURCE, OPTS);
  const m = foundationManifest();
  const cam: Record<string, string> = { room_a: 'cam_a', room_b: 'cam_b' };
  for (const cs of m.compiledScenes) {
    cs.kitRevision = 'dev-kit-1';
    cs.cameraRecipe = cam[cs.location];
    cs.entryMark = clone(marks[cs.location].entry);
    cs.marks = clone(marks[cs.location]);
  }
  return { m, geo: geometry };
}

{
  const { m, geo } = markedManifest();
  assert.deepEqual(validateManifest(m).issues, [], 'the marked manifest is a valid manifest');
  const good = validateGeometryForManifest(geo, m);
  assert.equal(good.ok, true, JSON.stringify(good.issues));
  const bad = (label: string, mutate: (g: any, m: any) => void, path: RegExp) => {
    const g: any = clone(geo);
    const mm: any = clone(m);
    mutate(g, mm);
    const r = validateGeometryForManifest(g, mm);
    assert.equal(r.ok, false, `${label}: must be rejected`);
    assert.ok(r.issues.some(i => path.test(i.path)), `${label}: expected ${path}, got ${r.issues.map(i => i.path).join(', ')}`);
  };
  bad('a mark inside an obstacle', (_g, mm) => (mm.compiledScenes[0].marks.near_other = { x: 25, y: 50, facing: 'right' }), /compiledScenes\.scene_a\.marks\.near_other/);
  bad('a mark off the walkable floor', (_g, mm) => (mm.compiledScenes[0].entryMark = { x: 1, y: 1, facing: 'right' }), /entryMark/);
  bad('a mark outside every camera safe region', (g, _m) => (g.cameras[0].safe = { x: 1500, y: 54, width: 300, height: 972 }), /marks/);
  bad('a kit revision mismatch', (_g, mm) => (mm.compiledScenes[1].kitRevision = 'dev-kit-2'), /kitRevision/);
  bad('a scene whose camera recipe has no camera', (_g, mm) => (mm.compiledScenes[0].cameraRecipe = 'cam_missing'), /cameraRecipe/);
  bad('a scene whose camera is over another location', (_g, mm) => (mm.compiledScenes[0].cameraRecipe = 'cam_b'), /cameraRecipe/);
  bad('a scene with no geometry for its location', (g, _m) => (g.locations = g.locations.filter((l: any) => l.location !== 'room_b')), /compiledScenes\.scene_b/);
  bad('an excursion with no door anchor on one side', (g, _m) => (g.locations[0].portals = g.locations[0].portals.filter((p: any) => p.portal !== 'p_a_back_b')), /portals\.p_a_back_b/);
  bad('an anchor for an entity the manifest lacks', (g, _m) => g.locations[0].anchors.push({ entity: 'ghost', root: [10, 10], height: 1 }), /anchors\.ghost/);
  bad('an attachment on an unknown entity', (g, _m) => (g.locations[0].attachments[0].entity = 'ghost'), /attachments\.hero_hand/);
  bad('a door for a portal the manifest does not have', (g, _m) => g.locations[0].portals.push({ portal: 'p_nowhere', a: [10, 10], b: [10, 20], facing: 'right' }), /portals\.p_nowhere/);
  bad('a route point off the floor', (_g, mm) => (mm.compiledScenes[0].routes = { path: [[10, 10], [25, 50]] }), /routes\.path\[1\]/);
  assert.equal(validateGeometryForManifest(geo, { ...m, compiledScenes: m.compiledScenes.map(c => ({ ...c, routes: { ok: [[10, 10], [35, 20]] } })) } as PlaybackManifestV3).ok, true, 'a route over walkable floor is accepted');
}
ok('Geometry and manifest agree: every mark is standable and in every camera safe region; kits, cameras, doors, anchors and routes must exist and match');

/* ===================================================================== */
/* B02 — interior cameras, per-scene recipes, explicit seated marks        */
/* ===================================================================== */

/** The foundation manifest compiled against an arbitrary Design source: each scene gets its location's marks and a chosen recipe. */
function markedManifestFor(src: DesignGeometrySource, recipes: Record<string, string>): { m: PlaybackManifestV3; geo: RuntimeGeometryV3 } {
  const { geometry, marks } = adaptDesignGeometry(src, OPTS);
  const m = foundationManifest();
  for (const cs of m.compiledScenes) {
    cs.kitRevision = 'dev-kit-1';
    cs.cameraRecipe = recipes[cs.location];
    cs.entryMark = clone(marks[cs.location].entry);
    cs.marks = clone(marks[cs.location]);
  }
  return { m, geo: geometry };
}
/** Every scene of room_a (scene_a and scene_c): a location's scenes share its marks and, here, its recipe. */
const roomA = (m: PlaybackManifestV3) => m.compiledScenes.filter(c => c.location === 'room_a');
const issuePaths = (r: { issues: Array<{ path: string }> }) => r.issues.map(i => i.path).join(', ');

{
  // An interior camera: it stands INSIDE the declared floor bounds, with part of the floor behind it.
  const interior = clone(SOURCE);
  interior.cameras[0] = { ...camera('room_a', 'cam_a'), cam: [5, 1.6, 5] }; // floor z 2..12: z 2..5 is behind it
  interior.locations[0].anchors[0].root = [5, 9]; // staging in front of the interior camera
  const { geometry: g, marks } = adaptDesignGeometry(interior, OPTS);
  assert.equal(validateRuntimeGeometry(g).ok, true, 'an interior camera is a valid camera');
  const cam = g.cameras[0];
  assert.deepEqual([cam.projection.camX, cam.projection.camY], [25, 30], 'the camera is where Design put it, inside the floor');
  // Strict projection is unchanged: no clamping, nothing at or behind the plane.
  const front = projectPoint(cam, 25, 60, 0)!;
  assert.ok(front && Number.isFinite(front.sx) && Number.isFinite(front.sy), 'in front of the camera → a projection');
  assert.equal(projectPoint(cam, 25, 30, 0), undefined, 'exactly on the camera plane');
  assert.equal(projectPoint(cam, 25, 10, 0), undefined, 'behind the camera plane');
  assert.equal(unprojectFloor(cam, 960, 1000) === undefined ? 'none' : 'some', 'some', 'pointer input below the horizon still lands on the floor in front');
  // The same Design formula as every other camera.
  const want = { sx: 960 + (900 * (7 - 5)) / (9 - 5), sy: 380 + (900 * (1.6 - 1.2)) / (9 - 5) };
  const [nx, nz] = [(100 * 7) / 20, (100 * (9 - 2)) / 10];
  const got = projectPoint(cam, nx, nz, 1.2 / 3)!;
  assert.ok(Math.abs(got.sx - want.sx) < 1e-3 && Math.abs(got.sy - want.sy) < 1e-3, 'interior camera reproduces the Design perspective');

  // A scene whose required content is in front of the interior camera is valid.
  const front_ = markedManifestFor(interior, { room_a: 'cam_a', room_b: 'cam_b' });
  for (const cs of roomA(front_.m)) {
    cs.entryMark = { x: 25, y: 70, facing: 'right' };
    cs.marks = { entry: { x: 25, y: 70, facing: 'right' } };
  }
  assert.equal(validateGeometryForManifest(front_.geo, front_.m).ok, true, issuePaths(validateGeometryForManifest(front_.geo, front_.m)));
  // Required content at or behind the active camera plane fails, with its own reason, never clamped into view.
  for (const [label, y] of [['on the plane', 30], ['behind the plane', 15]] as const) {
    const bad_ = markedManifestFor(interior, { room_a: 'cam_a', room_b: 'cam_b' });
    for (const cs of roomA(bad_.m)) {
      cs.marks = { entry: { x: 25, y, facing: 'right' } };
      cs.entryMark = { x: 25, y, facing: 'right' };
    }
    const r = validateGeometryForManifest(bad_.geo, bad_.m);
    assert.equal(r.ok, false, `a mark ${label} must be rejected`);
    assert.ok(r.issues.some(i => /compiledScenes\.scene_a\.(entryMark|marks\.entry)/.test(i.path) && /at or behind the plane of camera cam_a/.test(i.message)), `${label}: ${JSON.stringify(r.issues)}`);
  }
  assert.ok(marks.room_a.entry, 'marks are independent of the camera');
}
ok('Interior cameras: no global in-front invariant; projection stays strict (nothing on or behind the plane, no clamping); scene content behind the active camera fails');

{
  // Per-scene recipes: a scene is validated against the recipe it selects, not every camera of its location.
  const two = clone(SOURCE);
  two.cameras.push({ ...camera('room_a', 'cam_a_tight'), safe: { x: 1500, y: 54, width: 300, height: 972 } }); // a framing that does not show the room_a marks
  const both = markedManifestFor(two, { room_a: 'cam_a', room_b: 'cam_b' });
  assert.equal(both.geo.cameras.length, 3, 'no camera is discarded');
  assert.equal(validateGeometryForManifest(both.geo, both.m).ok, true, 'scene_a selects cam_a: marks the tight framing excludes are not required in it');
  assert.equal(validateRuntimeGeometry(both.geo).ok, true);
  const tight = markedManifestFor(two, { room_a: 'cam_a_tight', room_b: 'cam_b' });
  const r = validateGeometryForManifest(tight.geo, tight.m);
  assert.equal(r.ok, false, 'a scene that selects the tight framing must carry only what that framing shows');
  assert.ok(r.issues.some(i => /compiledScenes\.scene_a\.(entryMark|marks\.)/.test(i.path) && /safe region of camera cam_a_tight/.test(i.message)), issuePaths(r));
  assert.ok(!r.issues.some(i => /scene_b/.test(i.path)), 'scene_b is unaffected by another location\'s recipe');
  // Mixed: a scene using the tight framing carries only content it shows (its sibling scene keeps the full framing, which shows the anchors).
  for (const cs of roomA(tight.m)) {
    delete cs.entryMark;
    cs.marks = {};
  }
  tight.m.compiledScenes[2].cameraRecipe = 'cam_a';
  assert.equal(validateGeometryForManifest(tight.geo, tight.m).ok, true, 'carrying no mark the framing excludes is valid');
  // The structural checks on a recipe still hold: a missing recipe, another location\'s recipe.
  const wrong = markedManifestFor(two, { room_a: 'cam_b', room_b: 'cam_b' });
  assert.ok(validateGeometryForManifest(wrong.geo, wrong.m).issues.some(i => /cameraRecipe/.test(i.path)), 'a recipe from another location is rejected');
  // Anchors: visible in at least one camera some scene of the location selects.
  const anchorTight = markedManifestFor(two, { room_a: 'cam_a_tight', room_b: 'cam_b' });
  for (const cs of roomA(anchorTight.m)) {
    cs.marks = {};
    delete cs.entryMark;
  }
  const ar = validateGeometryForManifest(anchorTight.geo, anchorTight.m);
  assert.ok(ar.issues.some(i => /anchors\.hero/.test(i.path) && /every camera a scene of this location selects/.test(i.message)), issuePaths(ar));
  assert.ok(!ar.issues.some(i => /marks/.test(i.path)));
}
ok('Per-scene recipes: marks are checked against the camera the scene selects only; unselected cameras are kept; anchors need one selected camera that shows them');

{
  // Seated marks: an explicit posture + seat from Design source, never a name or a coordinate.
  const withChair = (mutate?: (s: DesignGeometrySource) => void): DesignGeometrySource => {
    const s = clone(SOURCE);
    s.locations[0].obstacles.push({ id: 'chair', polygon: [[2.8, 6.5], [3.8, 6.5], [3.8, 7.5], [2.8, 7.5]] });
    s.locations[0].marks.sit = { at: [3.3, 7], yaw: 90, posture: 'seat', seat: 'chair' };
    mutate?.(s);
    return s;
  };
  const rec = { room_a: 'cam_a', room_b: 'cam_b' };
  const src = withChair();
  const { geometry: g } = adaptDesignGeometry(src, OPTS);
  assert.deepEqual(g.locations[0].seats, [{ role: 'sit', obstacle: 'chair' }], 'the seat relationship is carried');
  assert.equal(g.locations[1].seats, undefined, 'a location with no seated mark has no seat list');
  assert.equal(validateRuntimeGeometry(g).ok, true, issuePaths(validateRuntimeGeometry(g)));
  assert.equal(JSON.stringify(adaptDesignGeometry(src, OPTS)), JSON.stringify(adaptDesignGeometry(clone(src), OPTS)), 'deterministic');
  assert.equal(adaptDesignGeometry(SOURCE, OPTS).geometry.locations[0].seats, undefined, 'sources without seats serialize exactly as before');

  const good = markedManifestFor(src, rec);
  const seatedOnly = (m: PlaybackManifestV3) => {
    const mm: PlaybackManifestV3 = clone(m);
    mm.compiledScenes[0].marks = { ...mm.compiledScenes[0].marks, sit: { x: 16.5, y: 50, facing: 'right' } };
    return mm;
  };
  const ok0 = validateGeometryForManifest(good.geo, seatedOnly(good.m));
  assert.equal(ok0.ok, true, `a seated mark rests on its declared seat: ${issuePaths(ok0)}`);
  // standable() itself never waives anything: the seat footprint is still an obstacle for everyone else.
  assert.equal(standable(good.geo.locations[0], [16.5, 50]), false);

  const bad = (label: string, mutate: (g: any, m: any) => void, path: RegExp, message?: RegExp) => {
    const g: any = clone(good.geo);
    const m: any = seatedOnly(good.m);
    mutate(g, m);
    const r = validateGeometryForManifest(g, m);
    assert.equal(r.ok, false, `${label}: must be rejected`);
    assert.ok(r.issues.some(i => path.test(i.path) && (!message || message.test(i.message))), `${label}: expected ${path}, got ${JSON.stringify(r.issues)}`);
  };
  // The waiver is narrow: it needs the declaration, the right obstacle and the right mark.
  bad('the same point under an undeclared role', (g, _m) => (g.locations[0].seats = undefined), /marks\.sit/, /not on walkable floor/);
  bad('a standing mark placed on the seat footprint', (_g, m) => (m.compiledScenes[0].marks.stand = { x: 16.5, y: 50, facing: 'right' }), /marks\.stand/, /not on walkable floor/);
  bad('the entry mark placed on the seat', (_g, m) => (m.compiledScenes[0].entryMark = { x: 16.5, y: 50, facing: 'right' }), /entryMark/, /not on walkable floor/);
  bad('a seated role placed off its seat, on open floor', (_g, m) => (m.compiledScenes[0].marks.sit = { x: 10, y: 10, facing: 'right' }), /marks\.sit/, /not on its declared seat chair/);
  bad('a seated role placed inside a different obstacle', (_g, m) => (m.compiledScenes[0].marks.sit = { x: 25, y: 50, facing: 'right' }), /marks\.sit/, /not on its declared seat chair/);
  bad('a seated role off the walkable floor', (_g, m) => (m.compiledScenes[0].marks.sit = { x: 1, y: 1, facing: 'right' }), /marks\.sit/, /not on its declared seat chair/);
  bad('a seat overlapping a different obstacle', (g, _m) => g.locations[0].obstacles.push({ id: 'rug', polygon: [[10, 40], [20, 40], [20, 60], [10, 60]] }), /marks\.sit/, /not on its declared seat chair/);
  bad('a seated role whose seat names a different obstacle', (g, _m) => (g.locations[0].seats = [{ role: 'sit', obstacle: 'desk' }]), /marks\.sit/, /not on its declared seat desk/);
  // Geometry may declare a seat the manifest variant never carries (a compressed topology): that is not an error.
  assert.equal(validateGeometryForManifest({ ...good.geo, locations: good.geo.locations.map(l => (l.location === 'room_a' ? { ...l, seats: [{ role: 'sit', obstacle: 'chair' }, { role: 'unused', obstacle: 'chair' }] } : l)) }, seatedOnly(good.m)).ok, true, 'an unused seat declaration is harmless');
  // A seat that extends past the walkable floor: the part outside it is not standable even for the seated mark.
  const benched = clone(src);
  benched.locations[0].obstacles.push({ id: 'bench', polygon: [[0, 4], [1, 4], [1, 5], [0, 5]] }); // x 0..1 m: walkable starts at x 0.5
  benched.locations[0].marks.perch = { at: [0.3, 4.5], yaw: 90, posture: 'seat', seat: 'bench' };
  benched.locations[0].marks.sit_ok = { at: [0.8, 4.5], yaw: 90, posture: 'seat', seat: 'bench' };
  const bg = markedManifestFor(benched, rec);
  const onBench = (key: string) => {
    const m: PlaybackManifestV3 = clone(bg.m);
    for (const cs of roomA(m)) cs.marks = { [key]: bg.m.compiledScenes[0].marks![key] };
    return validateGeometryForManifest(bg.geo, m);
  };
  assert.equal(onBench('sit_ok').ok, true, `the seated mark on the walkable part of its seat: ${issuePaths(onBench('sit_ok'))}`);
  const offFloor = onBench('perch');
  assert.ok(offFloor.issues.some(i => /marks\.perch/.test(i.path) && /not on its declared seat bench/.test(i.message)), `a seated mark off the walkable floor is refused: ${issuePaths(offFloor)}`);
  // Routes stay collision-safe; only a start or end that IS a declared seated point may rest on the seat.
  const route = (pts: Array<[number, number]>) => (_g: any, m: any) => (m.compiledScenes[0].routes = { r: pts });
  const okRoute = (pts: Array<[number, number]>) => {
    const m = seatedOnly(good.m);
    m.compiledScenes[0].routes = { r: pts };
    return validateGeometryForManifest(good.geo, m);
  };
  assert.equal(okRoute([[16.5, 50], [10, 20], [30, 20]]).ok, true, 'a route may start on the seated point');
  assert.equal(okRoute([[30, 20], [10, 20], [16.5, 50]]).ok, true, 'a route may end on the seated point');
  assert.equal(okRoute([[16.5, 50]]).ok, true, 'a single-point route on the seated point');
  bad('a route that crosses the seat in its interior', route([[10, 20], [16.5, 50], [30, 20]]), /routes\.r\[1\]/);
  bad('a route that starts inside the seat away from the seated point', route([[17, 52], [10, 20]]), /routes\.r\[0\]/);
  bad('a route that starts at a seated role that is not on its seat', (_g, m) => ((m.compiledScenes[0].marks.sit = { x: 25, y: 50, facing: 'right' }), (m.compiledScenes[0].routes = { r: [[25, 50], [10, 20]] })), /routes\.r\[0\]/);
  bad('a route that starts inside an ordinary obstacle', route([[25, 50], [10, 20]]), /routes\.r\[0\]/);
  bad('a route that ends inside an ordinary obstacle', route([[10, 20], [25, 50]]), /routes\.r\[1\]/);
  const noSeatedMark = (m: PlaybackManifestV3) => {
    for (const cs of roomA(m)) cs.marks = Object.fromEntries(Object.entries(cs.marks ?? {}).filter(([k]) => k !== 'sit'));
    roomA(m)[0].routes = { r: [[16.5, 50], [10, 20]] };
    return m;
  };
  const orphan = validateGeometryForManifest(good.geo, noSeatedMark(clone(good.m)));
  assert.ok(orphan.issues.some(i => /routes\.r\[0\]/.test(i.path)), `a route start on a seat no scene of the location carries as a seated mark is a collision: ${issuePaths(orphan)}`);
  // Another scene of the same location may carry the seated mark that anchors the route.
  const sibling = noSeatedMark(clone(good.m));
  roomA(sibling)[1].marks = { ...roomA(sibling)[1].marks, sit: { x: 16.5, y: 50, facing: 'right' } };
  assert.equal(validateGeometryForManifest(good.geo, sibling).ok, true, issuePaths(validateGeometryForManifest(good.geo, sibling)));
  // Structural: the seat list is part of the closed geometry contract.
  const struct = (label: string, mutate: (x: any) => void, path: RegExp) => {
    const x: any = clone(good.geo);
    mutate(x);
    const r = validateRuntimeGeometry(x);
    assert.equal(r.ok, false, `${label}: must be rejected`);
    assert.ok(r.issues.some(i => path.test(i.path)), `${label}: ${issuePaths(r)}`);
  };
  struct('a seat on an obstacle the location lacks', x => (x.locations[0].seats[0].obstacle = 'nowhere'), /seats\[0\]\.obstacle/);
  struct('a role seated twice', x => x.locations[0].seats.push({ role: 'sit', obstacle: 'chair' }), /seats\[1\]\.role/);
  struct('an unknown seat key', x => (x.locations[0].seats[0].posture = 'seat'), /seats\[0\]\.posture/);
  struct('a seat list that is not a list', x => (x.locations[0].seats = {}), /seats/);
  struct('a non-identifier role', x => (x.locations[0].seats[0].role = 'Own Seat'), /seats\[0\]\.role/);
}
ok('Seated marks: only a declared seated mark may rest on its declared seat; ordinary marks, entry marks and route interiors stay collision-safe; other obstacles are never waived');

/* ===================================================================== */
/* B02 — location-specific hero marks                                      */
/* ===================================================================== */

const startRun = (m: PlaybackManifestV3) => {
  const r = { m, s: createExperience(m, { attemptId: 'a1' }) };
  for (const t of ['LOADED', 'ENTERED'] as const) r.s = step(m, r.s, { type: t }).state;
  return r;
};
type R = ReturnType<typeof startRun>;
const send = (r: R, e: ExperienceEvent): StepResult => {
  const res = step(r.m, r.s, e);
  r.s = res.state;
  return res;
};
const must = (res: StepResult, what: string) => assert.equal(res.rejected, undefined, `${what}: rejected as ${res.rejected?.code}`);
const travel = (r: R, portal: string) => {
  const req = send(r, { type: 'REQUEST_PORTAL', id: portal, activationId: aid() });
  must(req, `request ${portal}`);
  const tx = req.effects.find(e => e.type === 'preload_scene');
  assert.ok(tx && tx.type === 'preload_scene');
  must(send(r, { type: 'TRANSITION_READY', txId: tx.txId }), 'commit');
  must(send(r, { type: 'ENTERED' }), 'entered');
};
const hero = (r: R) => r.s.entities.find(e => e.id === 'hero')!;
const heroAt = (r: R) => ({ at: hero(r).mark ? [hero(r).mark!.x, hero(r).mark!.y] : undefined, role: hero(r).state.mark_role, loc: hero(r).owner });

{
  const { m } = markedManifest();
  const r = startRun(m);
  // The hero starts on its first scene's entry mark, not at an unplaced default.
  assert.deepEqual(hero(r).mark, { x: 10, y: 10, facing: 'toward_viewer' });
  assert.deepEqual(r.s.heroMarks, {}, 'the current location has no stashed copy');
  must(send(r, { type: 'OPEN_OBSERVATION', id: 'o_a1', activationId: aid() }), 'observe');
  send(r, { type: 'CLOSE_OBSERVATION' });
  // Reposition: the hero takes the scene's compiled mark, exactly.
  must(send(r, { type: 'APPLY_PREPARATION', id: 'prep_stand', activationId: aid() }), 'stand nearer');
  assert.deepEqual(hero(r).mark, { x: 35, y: 20, facing: 'right' });
  assert.equal(hero(r).state.mark_role, 'near_other');
  // Leaving: the placement is saved for room_a; room_b's first visit uses ITS entry mark.
  travel(r, 'p_a_to_b');
  assert.deepEqual(hero(r).mark, { x: 10, y: 10, facing: 'toward_viewer' }, 'first visit: the destination entry mark');
  assert.equal(hero(r).state.mark_role, undefined, "room_a's role does not follow the hero");
  assert.deepEqual(r.s.heroMarks.room_a?.mark, { x: 35, y: 20, facing: 'right' });
  assert.equal(r.s.heroMarks.room_a?.role, 'near_other');
  assert.deepEqual(r.s.heroMarks.room_a?.preparations?.map(p => p.id), ['prep_stand']);
  assert.equal(r.s.preparations.some(p => p.id === 'prep_stand'), false, 'a position belongs to the place it was taken in');
  assert.equal(r.s.heroMarks.room_b, undefined, 'the current location has no stashed copy');
  // An excursion back: the SAME body position and the reversible reposition come back.
  must(send(r, { type: 'ADVANCE' }), 'b_b1');
  travel(r, 'p_b_peek_a');
  assert.deepEqual(hero(r).mark, { x: 35, y: 20, facing: 'right' }, 'return: the hero stands where they stood');
  assert.equal(hero(r).state.mark_role, 'near_other');
  assert.equal(r.s.preparations.some(p => p.id === 'prep_stand'), true);
  assert.deepEqual(r.s.heroMarks.room_a, undefined, 'the placement is consumed on return, never duplicated');
  assert.deepEqual((r.s as RuntimeSnapshot).heroMarks.room_b?.mark, { x: 10, y: 10, facing: 'toward_viewer' });
  // And it is still undoable on return: the baseline is the entry mark it superseded.
  must(send(r, { type: 'REVERT_PREPARATION', id: 'prep_stand', activationId: aid() }), 'undo on return');
  assert.deepEqual(hero(r).mark, { x: 10, y: 10, facing: 'toward_viewer' });
  assert.equal(hero(r).state.mark_role, undefined);
  assert.equal(r.s.preparations.length, 0);
  // Round trips never drift or accumulate.
  for (let i = 0; i < 5; i++) {
    travel(r, 'p_a_back_b');
    travel(r, 'p_b_peek_a');
  }
  assert.deepEqual(hero(r).mark, { x: 10, y: 10, facing: 'toward_viewer' });
  assert.deepEqual(Object.keys(r.s.heroMarks), ['room_b']);
  assert.equal(r.s.entities.filter(e => e.id === 'hero').length, 1);
}
ok('Hero marks are per location: entry mark on first visit, exact placement and its reversible reposition restored on return, no drift over round trips');

{
  // A cut between two scenes of one location keeps the same body where it is; other entities never receive hero marks.
  const { m } = markedManifest();
  const r = startRun(m);
  send(r, { type: 'OPEN_OBSERVATION', id: 'o_a1', activationId: aid() });
  send(r, { type: 'CLOSE_OBSERVATION' });
  travel(r, 'p_a_to_b');
  send(r, { type: 'ADVANCE' });
  send(r, { type: 'ADVANCE' });
  travel(r, 'p_b_to_c'); // room_b → room_a (spine), scene_c
  assert.deepEqual(hero(r).mark, { x: 10, y: 10, facing: 'toward_viewer' }, "scene_c is room_a: the hero's own saved placement (its entry on the first leave)");
  assert.equal(r.s.entities.find(e => e.id === 'other')!.mark, undefined, 'the other actor was never given a hero mark');
  assert.equal(r.s.entities.find(e => e.id === 'lamp')!.mark, undefined);
  // A semantic-only manifest (no compiled marks) keeps working: roles without geometry, no invented coordinates.
  const plain = startRun(foundationManifest());
  assert.equal(plain.s.entities.find(e => e.id === 'hero')!.mark, undefined);
  must(send(plain, { type: 'APPLY_PREPARATION', id: 'prep_stand', activationId: aid() }), 'stand (no geometry)');
  assert.equal(hero(plain).mark, undefined);
  assert.equal(hero(plain).state.mark_role, 'near_other');
  // A scene WITH marks that lacks the role refuses the reposition instead of leaving the body unplaced.
  const noRole = markedManifest().m;
  delete noRole.compiledScenes[0].marks!.near_other;
  const nr = startRun(noRole);
  send(nr, { type: 'OPEN_OBSERVATION', id: 'o_a1', activationId: aid() });
  send(nr, { type: 'CLOSE_OBSERVATION' });
  assert.ok(send(nr, { type: 'APPLY_PREPARATION', id: 'prep_stand', activationId: aid() }).rejected, 'a reposition with no compiled mark is refused');
}
{
  // A destination with no entry mark and no saved placement must not inherit the previous location's coordinates.
  const { m } = markedManifest();
  delete m.compiledScenes[1].entryMark;
  delete m.compiledScenes[1].marks;
  const r = startRun(m);
  send(r, { type: 'OPEN_OBSERVATION', id: 'o_a1', activationId: aid() });
  send(r, { type: 'CLOSE_OBSERVATION' });
  must(send(r, { type: 'APPLY_PREPARATION', id: 'prep_stand', activationId: aid() }), 'stand');
  travel(r, 'p_a_to_b');
  assert.equal(hero(r).mark, undefined, "room_a's coordinates are not room_b's");
  assert.equal(hero(r).state.mark_role, undefined);
  assert.deepEqual(r.s.heroMarks.room_a?.mark, { x: 35, y: 20, facing: 'right' }, 'but room_a still remembers it');
}
ok('Same-location cuts keep the body; only the hero is placed; semantic-only manifests stay valid; a missing compiled mark refuses the reposition');

{
  // Snapshots carry heroMarks, and a round trip through JSON restores them exactly.
  const { m } = markedManifest();
  const r = startRun(m);
  send(r, { type: 'OPEN_OBSERVATION', id: 'o_a1', activationId: aid() });
  send(r, { type: 'CLOSE_OBSERVATION' });
  must(send(r, { type: 'APPLY_PREPARATION', id: 'prep_stand', activationId: aid() }), 'stand');
  travel(r, 'p_a_to_b');
  const stored = JSON.parse(JSON.stringify(r.s));
  const back = restoreSnapshot(m, stored)!;
  assert.ok(back);
  assert.deepEqual(back.heroMarks, r.s.heroMarks, 'placements survive resume');
  assert.deepEqual(back.entities.find(e => e.id === 'hero')!.mark, hero(r).mark);
  // Resume then excursion back: the placement is restored exactly.
  const r2 = { m, s: { ...back, phase: 'playing' as const } } as R;
  send(r2, { type: 'ADVANCE' });
  travel(r2, 'p_b_peek_a');
  assert.deepEqual(hero(r2).mark, { x: 35, y: 20, facing: 'right' });
  // heroMarks tamper witnesses: each is refused without throwing.
  const mut = (f: (x: any) => void) => { const x = clone(stored); f(x); return x; };
  const tampered: Array<[string, unknown]> = [
    ['placement for the CURRENT location', mut(x => (x.heroMarks.room_b = { mark: { x: 1, y: 1, facing: 'right' } }))],
    ['placement for an unknown location', mut(x => (x.heroMarks.nowhere = { mark: { x: 1, y: 1, facing: 'right' } }))],
    ['placement not an object', mut(x => (x.heroMarks.room_a = 5))],
    ['placement with an extra key', mut(x => (x.heroMarks.room_a.evil = 1))],
    ['mark x out of range', mut(x => (x.heroMarks.room_a.mark.x = 101))],
    ['mark x NaN-like', mut(x => (x.heroMarks.room_a.mark.x = 'left'))],
    ['mark with extra key', mut(x => (x.heroMarks.room_a.mark.z = 1))],
    ['mark without facing', mut(x => delete x.heroMarks.room_a.mark.facing)],
    ['role empty', mut(x => (x.heroMarks.room_a.role = ''))],
    ['stashed preparations unknown id', mut(x => (x.heroMarks.room_a.preparations = [{ id: 'ghost', undo: [] }]))],
    ['stashed preparations duplicated', mut(x => (x.heroMarks.room_a.preparations = [x.heroMarks.room_a.preparations[0], x.heroMarks.room_a.preparations[0]]))],
    ['heroMarks an array', mut(x => (x.heroMarks = []))],
    ['heroMarks null', mut(x => (x.heroMarks = null))],
    ['heroMarks missing', mut(x => delete x.heroMarks)],
    ['hero mark out of range', mut(x => (x.entities.find((e: any) => e.id === 'hero').mark.y = -1))],
    ['hero mark facing empty', mut(x => (x.entities.find((e: any) => e.id === 'hero').mark.facing = ''))],
    ['undo mark entry malformed', mut(x => (x.heroMarks.room_a.preparations[0].undo[1] = { kind: 'mark', entity: 'hero', mark: { x: 'a' } }))],
    ['undo entry unknown kind', mut(x => (x.heroMarks.room_a.preparations[0].undo[0] = { kind: 'teleport', entity: 'hero' }))],
  ];
  for (const [label, bad] of tampered) {
    let out: unknown = 'threw';
    assert.doesNotThrow(() => (out = restoreSnapshot(m, bad)), `${label} must not throw`);
    assert.equal(out, undefined, `${label} must be refused`);
  }
}
ok('Snapshots persist heroMarks and restore them exactly; every malformed placement, mark and undo entry is refused without throwing');

/* ===================================================================== */
/* B05 — restore hardening                                                 */
/* ===================================================================== */

{
  const m = foundationManifest();
  const r = startRun(m);
  send(r, { type: 'OPEN_OBSERVATION', id: 'o_a1', activationId: aid() });
  send(r, { type: 'CLOSE_OBSERVATION' });
  must(send(r, { type: 'APPLY_PREPARATION', id: 'prep_hold_note', activationId: aid() }), 'hold note');
  const saved = JSON.parse(JSON.stringify(r.s));
  const mut = (f: (x: any) => void) => { const x = clone(saved); f(x); return x; };
  assert.ok(restoreSnapshot(m, clone(saved)), 'control');

  const witnesses: Array<[string, unknown]> = [
    // root and identity
    ['null entity record', mut(x => (x.entities[0] = null))],
    ['null entity (every one)', mut(x => (x.entities = x.entities.map(() => null)))],
    ['entities as an object', mut(x => (x.entities = { a: 1 }))],
    ['entity with a numeric id', mut(x => (x.entities[0].id = 5))],
    ['entity id the manifest lacks', mut(x => (x.entities[0].id = 'ghost'))],
    ['entity kind swapped', mut(x => (x.entities[0].kind = x.entities[0].kind === 'actor' ? 'object' : 'actor'))],
    ['entity with an extra key', mut(x => (x.entities[0].admin = true))],
    ['duplicate entity ids', mut(x => (x.entities[1] = clone(x.entities[0])))],
    ['entity owner with an extra key', mut(x => (x.entities[0].owner.extra = 1))],
    ['entity owner id not a string', mut(x => (x.entities[0].owner = { kind: 'location', id: 5 }))],
    ['entity state value not a string', mut(x => (x.entities[0].state = { a: 5 }))],
    ['entity state an array', mut(x => (x.entities[0].state = []))],
    ['actor owning itself', mut(x => (x.entities.find((e: any) => e.id === 'note').owner = { kind: 'actor', id: 'note' }))],
    ['object carried by an object', mut(x => (x.entities.find((e: any) => e.id === 'note').owner = { kind: 'actor', id: 'lamp' }))],
    ['offstage with a place id', mut(x => (x.entities[1].owner = { kind: 'offstage', id: 'room_a' }))],
    ['hero not in the current location', mut(x => (x.entities.find((e: any) => e.id === 'hero').owner = { kind: 'location', id: 'room_b' }))],
    ['hero offstage', mut(x => (x.entities.find((e: any) => e.id === 'hero').owner = { kind: 'offstage', id: 'offstage' }))],
    ['unknown top-level key', mut(x => (x.isAdmin = true))],
    ['__proto__ key', JSON.parse(JSON.stringify(saved).replace('{', '{"__proto__":{"x":1},'))],
    ['experience id of another experience', mut(x => (x.experienceId = 'other'))],
    ['experience id missing', mut(x => delete x.experienceId)],
    ['old snapshot version', mut(x => (x.snapshotVersion = 1))],
    ['future snapshot version', mut(x => (x.snapshotVersion = 3))],
    ['attempt id empty', mut(x => (x.attemptId = ''))],
    ['attempt id enormous', mut(x => (x.attemptId = 'a'.repeat(5000)))],
    ['unknown phase', mut(x => (x.phase = 'cheating'))],
    ['phase not a string', mut(x => (x.phase = 7))],
    ['reveal state unknown', mut(x => (x.reveal = 'maybe'))],
    ['txCounter float', mut(x => (x.txCounter = 1.5))],
    ['arcIndex float', mut(x => (x.arcIndex = 0.5))],
    ['standing ahead of the furthest scene reached', mut(x => { x.scene = 'scene_b'; x.location = 'room_b'; x.arcIndex = 0; x.visitedScenes = ['scene_a', 'scene_b']; x.entities.find((e: any) => e.id === 'hero').owner = { kind: 'location', id: 'room_b' }; })],
    ['current scene not in visited scenes', mut(x => (x.visitedScenes = []))],
    ['duplicate visited scenes', mut(x => (x.visitedScenes = ['scene_a', 'scene_a']))],
    ['duplicate facts', mut(x => (x.receivedFacts = ['f0', 'f0']))],
    ['duplicate observations', mut(x => (x.seenObservations = ['o_a1', 'o_a1']))],
    ['consumed event for a beat without that index', mut(x => (x.consumedEvents = ['b_a1:99']))],
    ['consumed event unknown beat', mut(x => (x.consumedEvents = ['ghost:0']))],
    ['consumed event malformed', mut(x => (x.consumedEvents = ['nocolon']))],
    ['consumed activations not strings', mut(x => (x.consumedActivations = [1]))],
    ['clock extra key', mut(x => (x.time.rate = 9))],
    ['clock negative', mut(x => (x.time.narrativeMs = -1))],
    ['clock Infinity', mut(x => (x.time.presentationMs = Number.POSITIVE_INFINITY))],
    ['clock pause key malformed', mut(x => (x.time.pauses = ['whenever']))],
    ['clock pauses not array', mut(x => (x.time.pauses = 'hidden:x'))],
    ['variables with an object value', mut(x => (x.variables = { a: {} }))],
    ['preparation record with an extra key', mut(x => (x.preparations[0].extra = 1))],
    ['preparation records duplicated', mut(x => (x.preparations = [x.preparations[0], x.preparations[0]]))],
    ['undo for an unknown entity', mut(x => (x.preparations[0].undo[0].entity = 'ghost'))],
    ['undo owner invalid', mut(x => (x.preparations[0].undo[0] = { kind: 'owner', entity: 'note', owner: { kind: 'actor', id: 'note' } }))],
    ['undo state with a number', mut(x => (x.preparations[0].undo[0] = { kind: 'state', entity: 'hero', key: 'a', value: 5 }))],
    ['undo state with an extra key', mut(x => (x.preparations[0].undo[0] = { kind: 'state', entity: 'hero', key: 'a', value: 'x', extra: 1 }))],
    // decision/phase/lock agreement
    ['a decision in a pre-commit phase', mut(x => (x.decision = { id: 'd_main', option: 'act_speak', status: 'accepted' }))],
    ['a decision with an unknown status', mut(x => { x.decision = { id: 'd_main', option: 'act_speak', status: 'pending' }; x.boundaryLocked = true; x.phase = 'boundary'; })],
    ['a decision with an extra key', mut(x => { x.decision = { id: 'd_main', option: 'act_speak', status: 'accepted', extra: 1 }; x.boundaryLocked = true; x.phase = 'boundary'; })],
    ['a decision for a foreign id', mut(x => { x.decision = { id: 'd_other', option: 'act_speak', status: 'accepted' }; x.boundaryLocked = true; x.phase = 'boundary'; })],
    ['a decision whose option is not an option of the decision', mut(x => { x.decision = { id: 'd_main', option: 'act_ghost', status: 'accepted' }; x.boundaryLocked = true; x.phase = 'boundary'; })],
    ['a locked story with no decision', mut(x => { x.boundaryLocked = true; x.phase = 'boundary'; })],
    ['a past-the-act phase without a decision', mut(x => (x.phase = 'enacting'))],
    ['a revealed phase without a decision', mut(x => { x.phase = 'revealed'; x.reveal = 'ready'; x.boundaryLocked = true; })],
    ['a decision but not locked', mut(x => { x.decision = { id: 'd_main', option: 'act_speak', status: 'accepted' }; x.phase = 'boundary'; })],
    ['reveal ready but not revealed', mut(x => (x.reveal = 'ready'))],
    ['revealed but reveal not ready', mut(x => { x.decision = { id: 'd_main', option: 'act_speak', status: 'accepted' }; x.boundaryLocked = true; x.phase = 'revealed'; x.reveal = 'idle'; })],
    ['reveal loading outside reveal_loading', mut(x => (x.reveal = 'loading'))],
  ];
  for (const [label, bad] of witnesses) {
    let out: unknown = 'threw';
    assert.doesNotThrow(() => (out = restoreSnapshot(m, bad)), `${label} must not throw`);
    assert.equal(out, undefined, `${label} must be refused`);
  }
  // Root junk.
  for (const raw of [undefined, null, 0, NaN, '', 'x', [], [1], () => 1, Symbol('x'), true, new Date(), new Map(), Object.create(null)]) assert.doesNotThrow(() => restoreSnapshot(m, raw), 'junk root must not throw');
  assert.equal(restoreSnapshot(m, []), undefined);
}
ok('Restore witnesses: null/duplicate/extra-key entities, owners, hero placement, ids, clocks, receipts, undo records and decision/phase/lock/reveal contradictions are all refused without throwing');

{
  // Accepted decisions: restoring never reopens a choice, and "recorded" is only a claim.
  const m = foundationManifest();
  const r = startRun(m);
  send(r, { type: 'OPEN_OBSERVATION', id: 'o_a1', activationId: aid() });
  send(r, { type: 'CLOSE_OBSERVATION' });
  travel(r, 'p_a_to_b');
  send(r, { type: 'ADVANCE' });
  send(r, { type: 'ADVANCE' });
  travel(r, 'p_b_to_c');
  send(r, { type: 'ADVANCE' });
  send(r, { type: 'REQUEST_INTENT', id: 'act_speak', activationId: aid() });
  must(send(r, { type: 'CONFIRM', id: 'act_speak', activationId: aid() }), 'confirm');
  for (const phase of ['enacting', 'holding', 'boundary'] as const) {
    const s = { ...JSON.parse(JSON.stringify(r.s)), phase };
    const back = restoreSnapshot(m, s)!;
    assert.deepEqual([back.phase, back.decision?.status, back.boundaryLocked, back.reveal], ['boundary', 'accepted', true, 'idle'], `${phase}: resumes at the boundary, unreopened`);
  }
  const claimed = { ...JSON.parse(JSON.stringify(r.s)), decision: { id: 'd_main', option: 'act_speak', status: 'recorded' } };
  assert.equal(restoreSnapshot(m, claimed)!.decision?.status, 'accepted');
  assert.equal(restoreSnapshot(m, { ...claimed, phase: 'confirming' }), undefined, 'a confirming phase with an accepted decision is a contradiction');
  // The restored snapshot is a safe starting point for the reducer: nothing throws on any event.
  const back = restoreSnapshot(m, claimed)!;
  const types = ['LOADED', 'ENTERED', 'TICK', 'ADVANCE', 'REQUEST_INTENT', 'CONFIRM', 'BOUNDARY_DONE', 'REVEAL_LOADED', 'DECISION_RECORDED', 'SKIP', 'END', 'CANCEL'];
  for (const t of types) assert.doesNotThrow(() => step(m, back, { type: t, id: 'act_wait', activationId: aid(), txId: 'tx1', decision: 'd_main', option: 'act_speak', ms: 16 } as unknown as ExperienceEvent));
  const ack = step(m, back, { type: 'DECISION_RECORDED', decision: 'd_main', option: 'act_speak' });
  assert.equal(ack.state.decision?.status, 'recorded', 'an exact acknowledgement records it');
}
ok('Accepted choices never reopen on restore; a stored "recorded" restores as accepted until a real acknowledgement; the reducer survives any event on a restored state');

{
  // Deterministic fuzz: replace every value in a valid snapshot with junk. Restore must never throw, and anything
  // it accepts must be safe to run through the reducer.
  const { m } = markedManifest();
  const r = startRun(m);
  send(r, { type: 'OPEN_OBSERVATION', id: 'o_a1', activationId: aid() });
  send(r, { type: 'CLOSE_OBSERVATION' });
  must(send(r, { type: 'APPLY_PREPARATION', id: 'prep_stand', activationId: aid() }), 'stand');
  must(send(r, { type: 'APPLY_PREPARATION', id: 'prep_hold_note', activationId: aid() }), 'hold');
  travel(r, 'p_a_to_b');
  const base = JSON.parse(JSON.stringify(r.s));
  const junk: unknown[] = [null, undefined, NaN, -1, 1e9, '', 'x', 'x'.repeat(300), [], {}, [null], { a: 1 }, true, false, 0, '__proto__'];
  const paths: Array<Array<string | number>> = [];
  const walk = (v: unknown, p: Array<string | number>) => {
    paths.push(p);
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, [...p, i]));
    else if (v && typeof v === 'object') for (const k of Object.keys(v)) walk((v as Record<string, unknown>)[k], [...p, k]);
  };
  walk(base, []);
  let accepted = 0;
  let refused = 0;
  for (const p of paths.filter(x => x.length > 0)) {
    for (const j of junk) {
      const x = clone(base);
      let cur: any = x;
      for (const k of p.slice(0, -1)) cur = cur[k];
      cur[p[p.length - 1]] = j;
      let out: RuntimeSnapshot | undefined;
      assert.doesNotThrow(() => (out = restoreSnapshot(m, x)), `fuzz ${p.join('.')} = ${String(j)} must not throw`);
      if (!out) { refused++; continue; }
      accepted++;
      for (const t of ['LOADED', 'ENTERED', 'ADVANCE', 'TICK', 'CANCEL']) assert.doesNotThrow(() => step(m, out!, { type: t, ms: 16 } as unknown as ExperienceEvent), `fuzz-accepted state survives ${t}`);
    }
  }
  assert.ok(refused > 500, `the fuzz exercised the refusals (${refused})`);
  assert.ok(accepted > 0, 'and some benign replacements are legitimately accepted');
}
ok('Fuzz: junk substituted at every path of a real snapshot never throws, and whatever is accepted is safe for the reducer');

/* ===================================================================== */
/* B07 — private canaries                                                  */
/* ===================================================================== */

{
  assert.equal(MIN_CANARY_LENGTH, 4);
  assert.equal(validatePrivateCanaries([...FOUNDATION_REVEAL_CANARIES]).ok, true);
  const corr = validatePrivateCanaries([...CORRECTION_REVEAL_CANARIES]);
  assert.equal(corr.ok, true, 'every current Correction canary is long enough');
  assert.ok(CORRECTION_REVEAL_CANARIES.length >= 11);
  for (const [label, bad] of [
    ['short', ['abc']],
    ['blank', ['    ']],
    ['empty string', ['']],
    ['short after trimming', ['  ab  ']],
    ['not a string', [5 as unknown as string]],
    ['mixed', ['a perfectly long canary', 'no']],
  ] as const) {
    const v = validatePrivateCanaries(bad as unknown);
    assert.equal(v.ok, false, label);
    assert.equal(JSON.stringify(v.issues).includes('perfectly'), false, 'issues name an index, never the text');
  }
  assert.equal(validatePrivateCanaries([]).ok, false, 'an empty list is a missing configuration');
  assert.equal(validatePrivateCanaries(undefined).ok, false);
  assert.equal(validatePrivateCanaries('canary').ok, false);
  // The scan refuses invalid configuration rather than reporting "no leak".
  assert.throws(() => findPrivateLeaks({ a: 'anything' }, ['abc']), PrivateCanaryError);
  assert.throws(() => findPrivateLeaks({ a: 'anything' }, []), PrivateCanaryError);
  const err = (() => { try { findPrivateLeaks({}, ['ok canary', 'x', 'yy']); } catch (e) { return e as PrivateCanaryError; } })()!;
  assert.deepEqual(err.invalidIndexes, [1, 2]);
  assert.equal(err.message.includes('ok canary'), false);
  // Exactly the minimum is valid; one fewer is not.
  assert.equal(validatePrivateCanaries(['abcd']).ok, true);
  assert.equal(validatePrivateCanaries(['abc']).ok, false);
  // One normalization for authoring and scanning: case, surrounding space and Unicode form do not hide a leak.
  assert.equal(normalizeCanary('  Café  '), 'café');
  const composed = 'café au lait';
  const decomposed = 'café au lait';
  assert.deepEqual(findPrivateLeaks({ t: decomposed }, [composed]), [0], 'a decomposed haystack still matches a composed canary');
  assert.deepEqual(findPrivateLeaks({ t: composed }, [decomposed]), [0], 'and the reverse');
  assert.deepEqual(findPrivateLeaks({ t: 'CAFÉ AU LAIT' }, [composed]), [0], 'case-insensitive');
  assert.deepEqual(findPrivateLeaks({ t: 'nothing to see' }, [composed]), []);
  assert.deepEqual(findPrivateLeaks(undefined, [composed]), [], 'an undefined public value serializes to nothing');
}
ok('Canaries: minimum length enforced at author time, scanning an invalid list throws (indexes only), one NFC/case normalization for both, current fixtures valid');

console.log(`\nAll ${n} V3 pre-build blocker checks passed.`);
