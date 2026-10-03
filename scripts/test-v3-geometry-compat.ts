import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { CompiledScene, EntityState, PlaybackManifestV3 } from '../src/engine/v3/contracts/manifest.ts';
import { projectPoint, standable, validateGeometryForManifest, validateRuntimeGeometry, type RuntimeGeometryV3 } from '../src/engine/v3/contracts/geometry.ts';
import { adaptDesignGeometry } from '../src/engine/v3/geometry/designAdapter.ts';
import { readDesignGeometryR3 } from './lib/designGeometryR3.ts';

/**
 * B02 compatibility with Design's PUBLISHED geometry (`correction-geo-r3`), not a synthetic square.
 *
 * The fixture is a byte copy of design/vivi-v3-correction-slice:docs/visual-v3/correction-slice/geometry/source.json
 * (5e05495). The real file is read in Design's own schema (scripts/lib/designGeometryR3.ts), adapted by the real
 * adapter, compiled into scenes that select the recipes Design assigns to its beats, and validated by the real
 * validators. Nothing in this file moves, clamps or waives a Design value.
 *
 * KNOWN SOURCES are keyed by the SHA-256 of the exact source bytes: each pinned hash names the one Design revision
 * those bytes must declare, and the source defects (if any) they are known to carry. A pinned hash with a different
 * declared revision is a provenance failure. A source whose hash is not pinned must validate with ZERO issues. The
 * expected provenance always derives from the supplied source (its declared revision and its byte hash), never from
 * a hard-coded revision, so a corrected revision runs through this same test untouched.
 *
 * `npm run test:v3-geometry-compat` runs it twice: on the committed r3 fixture (historical regression evidence) and
 * on the imported Design r4 source (docs/visual-v3/correction-slice/geometry/source.json), the build input.
 *
 * Run against another file:  VIVI_DESIGN_GEOMETRY_SOURCE=/path/to/source.json node --import tsx scripts/test-v3-geometry-compat.ts
 */

console.log(`Testing V3 B02 against the real Design geometry (${process.env.VIVI_DESIGN_GEOMETRY_SOURCE ?? 'committed r3 fixture'})...\n`);
let n = 0;
const ok = (label: string) => console.log(`✓ ${++n}. ${label}`);

const FIXTURE = new URL('../src/data/experienceV3Fixtures/design/correction-geo-r3.source.json', import.meta.url);
const path = process.env.VIVI_DESIGN_GEOMETRY_SOURCE;
const bytes = readFileSync(path ?? FIXTURE);
const sourceHash = createHash('sha256').update(bytes).digest('hex');
const raw = JSON.parse(bytes.toString('utf8'));

/** r3: the one published source defect is a STANDING hero anchor whose root lies inside the hero desk obstacle. */
const R3_SHA = '992340663d8cc7f384d8ccacd6dbe5d3ea687e8e803d6dc55cf3aa166f558273';
/** r4: Design's B02 micro-patch (design/vivi-v3-correction-slice @ 2140372), closed in reports/v3-b02-final-closure.md. No known defect. */
const R4_SHA = 'a541aac8af489bdea7ca6fed2711d89032ff90e2975706cf74926ca8a39a0c81';
const KNOWN_SOURCES: Record<string, { revision: string; defects: Array<{ path: RegExp; why: string }> }> = {
  [R4_SHA]: { revision: 'correction-geo-r4', defects: [] },
  [R3_SHA]: { revision: 'correction-geo-r3', defects: [
    { path: /^compiledScenes\.desk_desktop\.entryMark$/, why: 'open_plan.hero_anchors.at_desk root [5.55, 2.25] is inside obstacle hero_desk (x 4.05–5.75, z 1.95–2.65); posture stand' },
    { path: /^compiledScenes\.desk_desktop\.marks\.at_desk$/, why: 'same root' },
    { path: /^compiledScenes\.desk_desktop\.routes\.desk_to_p0\[0\]$/, why: 'route desk_to_P0 starts at the same root' },
    { path: /^compiledScenes\.desk_portrait\.entryMark$/, why: 'same root' },
    { path: /^compiledScenes\.desk_portrait\.marks\.at_desk$/, why: 'same root' },
    { path: /^compiledScenes\.desk_portrait\.routes\.desk_to_p0\[0\]$/, why: 'route desk_to_P0 starts at the same root' },
  ] },
};
const known = KNOWN_SOURCES[sourceHash];
// Strict provenance: pinned bytes must declare their pinned revision. An unpinned source carries no exceptions.
if (known) assert.equal(raw.revision, known.revision, `source ${sourceHash.slice(0, 12)} is pinned as ${known.revision} but declares ${raw.revision}`);
assert.match(String(raw.revision), /^[a-z0-9][a-z0-9._-]{0,63}$/, 'the source declares an explicit revision');
const expected = known?.defects ?? [];

const reading = readDesignGeometryR3(raw);
const OPTS = { geometryRevision: `${raw.revision}-adapted`, adapterVersion: '1.0.0', sourceHash };
const { geometry, marks, routes } = adaptDesignGeometry(reading.source, OPTS);
const L = { desk: 'correction_open_plan', hall: 'correction_corridor', room: 'correction_meeting_room' };
const cam = (loc: string, recipe: string) => reading.cameraIds[`${loc}/${recipe}`] ?? assert.fail(`no camera ${loc}/${recipe}`);

/**
 * The scenes Design's beats call for, as the compile step would carry them. Each selects ONE recipe, and carries
 * only the marks that recipe is meant to show (a framing that does not show the hero carries no hero mark).
 *   desktop  → the location's `desktop` recipe;  portrait → Design's beat recipe for that framing.
 */
const sceneSpec: Array<{ id: string; location: string; recipe: string; entry?: string; marks: string[]; basis: string }> = [
  { id: 'desk_desktop', location: L.desk, recipe: 'desktop', entry: 'at_desk', marks: ['at_desk', 'to_corridor'], basis: 'beat 01_desk, desktop' },
  { id: 'desk_portrait', location: L.desk, recipe: 'portrait', entry: 'at_desk', marks: ['at_desk'], basis: 'beat 01_desk, portrait (to_corridor is a door mark, off the portrait frame)' },
  { id: 'hall_desktop', location: L.hall, recipe: 'desktop', marks: ['reading'], basis: 'beat 03_hallway, desktop' },
  { id: 'hall_portrait', location: L.hall, recipe: 'portrait', marks: ['reading'], basis: 'beat 03_hallway, portrait' },
  { id: 'room_desktop', location: L.room, recipe: 'desktop', entry: 'entry', marks: ['entry', 'own_seat', 'stand_near_entry', 'near_director'], basis: 'beats 02, 04–06, desktop' },
  { id: 'room_portrait', location: L.room, recipe: 'portrait', entry: 'entry', marks: ['entry', 'own_seat', 'stand_near_entry'], basis: 'camera.use: all meeting beats except near_director' },
  { id: 'room_portrait_room', location: L.room, recipe: 'portrait_room', marks: [], basis: 'beat 02_meeting_room_portrait: display, Mira and director; the hero is not in this framing' },
  { id: 'room_portrait_east', location: L.room, recipe: 'portrait_east', marks: ['near_director'], basis: 'beat 06b_private (camera_portrait): near_director' },
];

function compile(specs = sceneSpec, g: RuntimeGeometryV3 = geometry): { m: PlaybackManifestV3; geo: RuntimeGeometryV3 } {
  const compiledScenes: CompiledScene[] = specs.map(s => ({
    id: s.id,
    location: s.location,
    kitRevision: reading.source.sourceRevision,
    compositionRevision: 'dev-composition',
    cameraRecipe: cam(s.location, s.recipe),
    lightRecipe: 'dev-light',
    audioRecipe: 'dev-audio',
    accessibleText: [],
    ...(s.entry ? { entryMark: structuredClone(marks[s.location][s.entry]) } : {}),
    marks: Object.fromEntries(s.marks.map(r => [r, structuredClone(marks[s.location][r] ?? assert.fail(`no mark ${r} in ${s.location}`))])),
    routes: structuredClone(routes[s.location]),
  }));
  const entity = (id: string, kind: 'actor'): EntityState => ({ id, kind, owner: { kind: 'location', id: L.room }, state: {} });
  const m = {
    compiledScenes,
    initialEntities: ['hero', 'mira', 'director'].map(id => entity(id, 'actor')),
    portals: [
      { id: 'p0', kind: 'excursion', from: L.desk, to: L.hall },
      { id: 'p1', kind: 'excursion', from: L.hall, to: L.room },
    ],
  } as unknown as PlaybackManifestV3;
  return { m, geo: structuredClone(g) };
}
const paths = (r: { issues: Array<{ path: string; message: string }> }) => r.issues.map(i => `${i.path}: ${i.message}`).join('\n  ');

/* --------------------------------------------------------------------- */

{
  // The fixture is the file the closure review named, byte for byte; a replacement is a different, deliberate input.
  if (!path) assert.equal(sourceHash, R3_SHA, 'the committed fixture is the r3 source reviewed at a8a4a7a (SHA-256 992340…8273)');
  assert.equal(raw.revision, reading.source.sourceRevision);
  assert.deepEqual(Object.keys(raw.locations), ['correction.open_plan', 'correction.corridor', 'correction.meeting_room']);
  assert.equal(reading.source.cameras.length, 8, 'open_plan 2 + corridor 2 + meeting_room 4 recipes');
  assert.deepEqual(reading.source.cameras.map(c => c.id), [
    'correction_open_plan__desktop', 'correction_open_plan__portrait',
    'correction_corridor__desktop', 'correction_corridor__portrait',
    'correction_meeting_room__desktop', 'correction_meeting_room__portrait', 'correction_meeting_room__portrait_room', 'correction_meeting_room__portrait_east',
  ]);
  // Everything this reader leaves out is listed and asserted: a new unmapped key in a future Design revision is a decision, not a silent drop.
  assert.deepEqual(reading.unmapped, [
    'correction_corridor.attachments', 'correction_corridor.occluders', 'correction_corridor.objects', 'correction_corridor.see_through', 'correction_corridor.walls',
    'correction_meeting_room.attachments', 'correction_meeting_room.display_surfaces', 'correction_meeting_room.objects', 'correction_meeting_room.occluders', 'correction_meeting_room.walls',
    'correction_open_plan.attachments', 'correction_open_plan.display_surfaces', 'correction_open_plan.objects', 'correction_open_plan.occluders', 'correction_open_plan.walls',
  ].sort());
}
ok(`Source: ${path ? `supplied ${raw.revision}` : 'the committed Design r3 fixture'} (${known ? 'hash pinned to its declared revision' : 'unpinned hash, zero exceptions allowed'}); all 8 camera recipes are read; every unmapped key is listed`);

{
  // The adapter takes the actual r3 values, deterministically, and the resource is structurally valid.
  const again = adaptDesignGeometry(readDesignGeometryR3(JSON.parse(bytes.toString('utf8'))).source, OPTS);
  assert.equal(JSON.stringify(again), JSON.stringify({ geometry, marks, routes }), 'same bytes, same output');
  const v = validateRuntimeGeometry(geometry);
  assert.equal(v.ok, true, paths(v));
  // Expected provenance derives from the supplied source: its declared revision and its byte hash.
  assert.deepEqual(geometry.provenance, { sourceRevision: raw.revision, adapterVersion: '1.0.0', sourceHash });
  assert.equal(geometry.geometryRevision, `${raw.revision}-adapted`);
  assert.equal(geometry.cameras.length, 8, 'no camera is discarded');
  // No clamping: every normalized point is the affine image of the source point, in range, and nothing moved.
  const room = reading.source.locations.find(l => l.location === L.room)!;
  const own = room.marks.own_seat;
  assert.deepEqual(marks[L.room].own_seat, { x: Number(((100 * own.at[0]) / 6.8).toFixed(3)), y: Number(((100 * own.at[1]) / 7.4).toFixed(3)), facing: 'yaw_p90' });
}
ok(`The real ${raw.revision} source adapts without exception, deterministically, with provenance derived from the supplied source, and the resource validates`);

{
  // INTERIOR CAMERAS. Five r3 recipes stand inside their location's bounds; the old adapter rejected each.
  const interior: Array<[string, string, number]> = [
    [L.hall, 'desktop', 3.2], [L.hall, 'portrait', 3.9],
    [L.room, 'portrait', 0.4], [L.room, 'portrait_room', 1.6], [L.room, 'portrait_east', 1.4],
  ];
  for (const [loc, recipe, z] of interior) {
    const k = geometry.cameras.find(c => c.id === cam(loc, recipe))!;
    const l = reading.source.locations.find(x => x.location === loc)!;
    assert.ok(z > l.bounds.zMin && z < l.bounds.zMax, `${loc}/${recipe}: z=${z} is inside the floor bounds (an interior camera)`);
    assert.ok(k.projection.camY > 0 && k.projection.camY < 100, `${loc}/${recipe}: normalized camera depth ${k.projection.camY} is inside the floor`);
    assert.ok(Object.values(k.projection).every(Number.isFinite));
    // Strict projection: the plane and everything behind it has no projection; nothing is clamped to it.
    assert.equal(projectPoint(k, 50, k.projection.camY, 0), undefined, `${loc}/${recipe}: on the plane`);
    assert.equal(projectPoint(k, 50, k.projection.camY - 1, 0), undefined, `${loc}/${recipe}: behind the plane`);
    assert.ok(projectPoint(k, 50, k.projection.camY + 1, 0), `${loc}/${recipe}: in front of the plane`);
    // Design's own pinhole, evaluated on source numbers independently of the adapter, equals the compiled camera.
    const src = reading.source.cameras.find(c => c.id === k.id)!;
    const w = l.bounds.xMax - l.bounds.xMin;
    const d = l.bounds.zMax - l.bounds.zMin;
    for (const [x, y, zz] of [[l.bounds.xMin + 0.4 * w, 0, z + 0.3 * (l.bounds.zMax - z)], [l.bounds.xMin + 0.7 * w, 1.2, z + 0.8 * (l.bounds.zMax - z)]] as const) {
      const want = { sx: src.cx + (src.f * (x - src.cam[0])) / (zz - src.cam[2]), sy: src.hy + (src.f * (src.cam[1] - y)) / (zz - src.cam[2]) };
      const got = projectPoint(k, (100 * (x - l.bounds.xMin)) / w, (100 * (zz - l.bounds.zMin)) / d, y / l.heightScale)!;
      assert.ok(Math.abs(got.sx - want.sx) < 0.05 && Math.abs(got.sy - want.sy) < 0.05, `${loc}/${recipe}: ${JSON.stringify(got)} vs ${JSON.stringify(want)}`);
    }
  }
  // Exterior cameras (outside the floor, as before) are unchanged.
  for (const [loc, recipe] of [[L.desk, 'desktop'], [L.desk, 'portrait'], [L.room, 'desktop']] as const) assert.ok(geometry.cameras.find(c => c.id === cam(loc, recipe))!.projection.camY < 0, `${loc}/${recipe} stands in front of the floor`);

  // Required content at or behind the camera a scene actually uses fails, on real values; the same point is fine for a camera that is behind it.
  const behind = compile();
  const hall = behind.m.compiledScenes.find(s => s.id === 'hall_desktop')!; // camera z=3.2
  hall.marks = { too_near: { x: 40, y: 15, facing: 'yaw_p0' } }; // floor z=2.25: standable, but behind the z=3.2 camera
  assert.ok(standable(behind.geo.locations.find(l => l.location === L.hall)!, [40, 15]), 'the probe point is real floor');
  const r = validateGeometryForManifest(behind.geo, behind.m);
  assert.ok(r.issues.some(i => i.path === 'compiledScenes.hall_desktop.marks.too_near' && /at or behind the plane of camera correction_corridor__desktop/.test(i.message)), paths(r));
  hall.cameraRecipe = cam(L.desk, 'desktop');
  assert.ok(validateGeometryForManifest(behind.geo, behind.m).issues.some(i => i.path === 'compiledScenes.hall_desktop.cameraRecipe' && /another location/.test(i.message)), 'a camera of another location never rescues it');
}
ok('Interior cameras (corridor desktop+portrait, meeting portrait/portrait_room/portrait_east): adapted, finite, exact perspective, strict projection, content behind the active plane fails');

{
  // RECIPE COVERAGE. Each scene is checked against the recipe it selects.
  const { m, geo } = compile();
  const r = validateGeometryForManifest(geo, m);
  const unexpected = r.issues.filter(i => !expected.some(e => e.path.test(i.path)));
  const missing = expected.filter(e => !r.issues.some(i => e.path.test(i.path)));
  assert.deepEqual(unexpected.map(i => `${i.path}: ${i.message}`), [], `unexpected validation failures on the published source:\n  ${paths(r)}`);
  assert.deepEqual(missing.map(e => String(e.path)), [], `expected source failures that did not occur (Design patched this source? then its hash has no exceptions)`);
  if (expected.length === 0) assert.equal(r.ok, true, paths(r));
  // Every reported failure is the known at_desk defect (and only that), at the right reason.
  for (const i of r.issues) assert.ok(/not on walkable floor/.test(i.message), i.message);
  // Every camera of the resource is selected by exactly the scene that frames it; none was dropped to make this pass.
  assert.deepEqual([...new Set(m.compiledScenes.map(s => s.cameraRecipe))].sort(), geometry.cameras.map(c => c.id).sort());

  // The old rule is gone, on the real recipes: own_seat is not required to fit portrait_east, nor near_director portrait.
  const own = marks[L.room].own_seat;
  const nd = marks[L.room].near_director;
  const east = geometry.cameras.find(c => c.id === cam(L.room, 'portrait_east'))!;
  const port = geometry.cameras.find(c => c.id === cam(L.room, 'portrait'))!;
  const room_ = geometry.cameras.find(c => c.id === cam(L.room, 'portrait_room'))!;
  const inSafe = (k: typeof east, p: { x: number; y: number }) => { const s = projectPoint(k, p.x, p.y, 0); return !!s && s.sx >= k.safe.x && s.sx <= k.safe.x + k.safe.width && s.sy >= k.safe.y && s.sy <= k.safe.y + k.safe.height; };
  assert.equal(inSafe(east, own), false, 'own_seat is outside portrait_east');
  assert.equal(inSafe(room_, own), false, 'own_seat is outside portrait_room (x≈−2238)');
  assert.equal(inSafe(port, nd), false, 'near_director is outside the default portrait (x≈1544)');
  assert.equal(inSafe(east, nd), true);
  assert.equal(inSafe(port, own), true);

  // ...and the validation of what a scene DOES carry stays strict.
  const strict = (label: string, mutate: (m: PlaybackManifestV3) => void, path: RegExp, msg: RegExp) => {
    const c = compile();
    mutate(c.m);
    const v = validateGeometryForManifest(c.geo, c.m);
    assert.ok(v.issues.some(i => path.test(i.path) && msg.test(i.message)), `${label}: ${paths(v)}`);
  };
  const scene = (m: PlaybackManifestV3, id: string) => m.compiledScenes.find(s => s.id === id)!;
  strict('own_seat carried into the portrait_east scene', m => (scene(m, 'room_portrait_east').marks!.own_seat = marks[L.room].own_seat), /^compiledScenes\.room_portrait_east\.marks\.own_seat$/, /safe region of camera correction_meeting_room__portrait_east/);
  strict('own_seat carried into the portrait_room scene', m => (scene(m, 'room_portrait_room').marks = { own_seat: marks[L.room].own_seat }), /^compiledScenes\.room_portrait_room\.marks\.own_seat$/, /safe region of camera correction_meeting_room__portrait_room/);
  strict('near_director carried into the default portrait scene', m => (scene(m, 'room_portrait').marks!.near_director = marks[L.room].near_director), /^compiledScenes\.room_portrait\.marks\.near_director$/, /safe region of camera correction_meeting_room__portrait\b/);
  strict('a scene whose recipe does not exist', m => (scene(m, 'room_portrait').cameraRecipe = 'correction_meeting_room__portrait_west'), /cameraRecipe/, /no compiled camera/);
  strict('a scene whose recipe belongs to another location', m => (scene(m, 'room_portrait').cameraRecipe = cam(L.hall, 'portrait')), /cameraRecipe/, /another location/);
  strict('a standing mark moved outside the selected safe area', m => (scene(m, 'desk_portrait').marks!.to_corridor = marks[L.desk].to_corridor), /^compiledScenes\.desk_portrait\.marks\.to_corridor$/, /safe region of camera correction_open_plan__portrait/);
  strict('a kit revision mismatch', m => (scene(m, 'room_desktop').kitRevision = 'correction-geo-r2'), /kitRevision/, /differ/);
  // The staging anchors stay checked: Mira and the director must be shown by some framing a meeting scene selects.
  const noRoomFraming = compile(sceneSpec.filter(s => s.id !== 'room_desktop' && s.id !== 'room_portrait_room' && s.id !== 'room_portrait_east'));
  const na = validateGeometryForManifest(noRoomFraming.geo, noRoomFraming.m);
  assert.ok(na.issues.some(i => /anchors\.mira/.test(i.path)) && na.issues.some(i => /anchors\.director/.test(i.path)), `only the default portrait is selected → Mira and the director are shown by no selected framing: ${paths(na)}`);
}
ok(`Recipe coverage: each ${raw.revision} scene validates against its own recipe (own_seat ∉ portrait_east, near_director ∉ portrait); ${expected.length ? 'the only failures are the published at_desk defect' : 'zero failures'}`);

{
  // SEATED MARK. Design says: own_seat { posture: seat, seat: chair_own_seat }.
  const room = geometry.locations.find(l => l.location === L.room)!;
  assert.deepEqual(room.seats, [{ role: 'own_seat', obstacle: 'chair_own_seat' }], 'the seat relationship comes from Design source semantics');
  assert.equal(geometry.locations.find(l => l.location === L.desk)!.seats, undefined);
  assert.equal(geometry.locations.find(l => l.location === L.hall)!.seats, undefined);
  assert.equal(standable(room, [marks[L.room].own_seat.x, marks[L.room].own_seat.y]), false, 'own_seat is inside chair_own_seat; standable() waives nothing');

  const strict = (label: string, mutate: (c: ReturnType<typeof compile>) => void, path: RegExp, msg: RegExp) => {
    const c = compile();
    mutate(c);
    const v = validateGeometryForManifest(c.geo, c.m);
    assert.ok(v.issues.some(i => path.test(i.path) && msg.test(i.message)), `${label}: ${paths(v)}`);
  };
  const roomGeo = (c: ReturnType<typeof compile>) => c.geo.locations.find(l => l.location === L.room)!;
  // Without the declaration the same mark at the same place is a collision: the waiver is the declaration, not the name or the place.
  strict('seat declaration removed', c => delete roomGeo(c).seats, /^compiledScenes\.room_desktop\.marks\.own_seat$/, /not on walkable floor clear of obstacles/);
  strict('seat declared on another obstacle', c => (roomGeo(c).seats = [{ role: 'own_seat', obstacle: 'chair_west_1' }]), /^compiledScenes\.room_desktop\.marks\.own_seat$/, /not on its declared seat chair_west_1/);
  // The same role under another name is an ordinary standing mark.
  strict('the seat point under an undeclared role', c => (c.m.compiledScenes.find(s => s.id === 'room_desktop')!.marks!.perch = marks[L.room].own_seat), /^compiledScenes\.room_desktop\.marks\.perch$/, /not on walkable floor clear of obstacles/);
  // A standing mark may not sit on the chair, nor on any other obstacle (including the other chairs, the table, the credenza).
  for (const ob of ['chair_own_seat', 'chair_west_1', 'chair_director', 'table', 'credenza']) {
    const o = room.obstacles.find(x => x.id === ob)!;
    const cx = o.polygon.reduce((a, p) => a + p[0], 0) / o.polygon.length;
    const cy = o.polygon.reduce((a, p) => a + p[1], 0) / o.polygon.length;
    strict(`a standing mark inside ${ob}`, c => (c.m.compiledScenes.find(s => s.id === 'room_desktop')!.marks!.drift = { x: cx, y: cy, facing: 'yaw_p90' }), /marks\.drift$/, /not on walkable floor clear of obstacles/);
  }
  strict('the entry mark placed on the seat', c => (c.m.compiledScenes.find(s => s.id === 'room_desktop')!.entryMark = marks[L.room].own_seat), /^compiledScenes\.room_desktop\.entryMark$/, /not on walkable floor clear of obstacles/);
  strict('the seated role moved off the chair onto open floor', c => (c.m.compiledScenes.find(s => s.id === 'room_desktop')!.marks!.own_seat = marks[L.room].stand_near_entry), /^compiledScenes\.room_desktop\.marks\.own_seat$/, /not on its declared seat chair_own_seat/);

  // Routes: the two seated routes begin/end on the seat and pass; every interior point stays on open floor.
  const rt = routes[L.room];
  const okRoutes = validateGeometryForManifest(...(() => { const c = compile(); return [c.geo, c.m] as const; })());
  assert.ok(!okRoutes.issues.some(i => /routes\.(seat_to_near_director|entry_to_seat|stand_to_near_director|entry_to_stand)/.test(i.path)), `the published meeting routes are collision-safe: ${paths(okRoutes)}`);
  assert.deepEqual(rt.seat_to_near_director[0], [marks[L.room].own_seat.x, marks[L.room].own_seat.y], 'seat_to_near_director starts on own_seat');
  assert.deepEqual(rt.entry_to_seat[rt.entry_to_seat.length - 1], [marks[L.room].own_seat.x, marks[L.room].own_seat.y], 'entry_to_seat ends on own_seat');
  strict('a route that walks through the chair in its interior', c => (c.m.compiledScenes.find(s => s.id === 'room_desktop')!.routes!.bad = [[marks[L.room].entry.x, marks[L.room].entry.y], [marks[L.room].own_seat.x, marks[L.room].own_seat.y], [marks[L.room].near_director.x, marks[L.room].near_director.y]]), /routes\.bad\[1\]$/, /route point is not on walkable floor/);
  strict('a route that starts in the chair but not at the seated point', c => (c.m.compiledScenes.find(s => s.id === 'room_desktop')!.routes!.bad = [[marks[L.room].own_seat.x + 1, marks[L.room].own_seat.y], [marks[L.room].entry.x, marks[L.room].entry.y]]), /routes\.bad\[0\]$/, /route point is not on walkable floor/);
  strict('a route that ends inside another obstacle', c => (c.m.compiledScenes.find(s => s.id === 'room_desktop')!.routes!.bad = [[marks[L.room].entry.x, marks[L.room].entry.y], [(2.55 + 4.25) / 2 / 6.8 * 100, (3.2 + 6.5) / 2 / 7.4 * 100]]), /routes\.bad\[1\]$/, /route point is not on walkable floor/);
  strict('seated routes with no seated mark in the location', c => c.m.compiledScenes.filter(s => s.location === L.room).forEach(s => delete s.marks!.own_seat), /routes\.(seat_to_near_director|entry_to_seat)/, /route point is not on walkable floor/);
}
ok('Seated hero mark: own_seat rests on chair_own_seat only through Design\'s posture+seat; no other mark, entry, route interior or obstacle is waived; routes may start/end on the seat');

{
  // THE SOURCE DEFECT is exactly at_desk, a standing anchor, and runtime does not waive it.
  const desk = geometry.locations.find(l => l.location === L.desk)!;
  const at = marks[L.desk].at_desk;
  const raw_ = raw.locations['correction.open_plan'].hero_anchors.at_desk;
  assert.equal(raw_.posture, 'stand');
  assert.equal(desk.seats, undefined, 'a standing anchor has no seat declaration to hide behind');
  const inDesk = !standable(desk, [at.x, at.y]);
  assert.equal(inDesk, expected.length > 0, expected.length ? 'r3 at_desk is on an obstacle and runtime refuses it' : 'the corrected source places at_desk on free floor');
  if (expected.length) {
    const hd = desk.obstacles.find(o => o.id === 'hero_desk')!;
    assert.ok(at.x >= Math.min(...hd.polygon.map(p => p[0])) && at.x <= Math.max(...hd.polygon.map(p => p[0])) && at.y >= Math.min(...hd.polygon.map(p => p[1])) && at.y <= Math.max(...hd.polygon.map(p => p[1])), 'at_desk lies in hero_desk');
    // Nothing in the source other than at_desk (and the route that starts there) is a collision.
    for (const l of geometry.locations) for (const [role, mk] of Object.entries(marks[l.location])) if (!(l.location === L.desk && role === 'at_desk')) assert.ok(standable(l, [mk.x, mk.y]) || l.seats?.some(s => s.role === role), `${l.location}.${role} is clear`);
    for (const [loc, rs] of Object.entries(routes)) for (const [name, pts] of Object.entries(rs)) pts.forEach((p, i) => assert.ok(standable(geometry.locations.find(l => l.location === loc)!, p) || (loc === L.desk && name === 'desk_to_p0' && i === 0) || (loc === L.room && (name === 'seat_to_near_director' || name === 'entry_to_seat')), `${loc}.${name}[${i}] is clear`));
  }
}
ok(expected.length ? 'Source defect isolated: at_desk (standing, inside hero_desk) and the route that starts there are the ONLY collisions in the published r3 source; runtime does not waive them' : 'Corrected source: at_desk is on free floor and every mark and route is collision-safe, with no exceptions');

{
  // Where the contract ends: threshold marks are portal-crossing positions, not scene content. Recorded, not hidden.
  const c = compile();
  const hall = c.m.compiledScenes.find(s => s.id === 'hall_desktop')!;
  hall.marks = { from_meeting: marks[L.hall].from_meeting };
  const r = validateGeometryForManifest(c.geo, c.m);
  assert.ok(r.issues.some(i => i.path === 'compiledScenes.hall_desktop.marks.from_meeting' && /safe region of camera correction_corridor__desktop/.test(i.message)),
    'KNOWN LIMIT: the corridor door mark from_meeting lies below the desktop frame (screen y≈1121 > 1026); a Phase B compile must not carry it as required in-frame scene content');
}
ok('Recorded limit: portal-threshold hero anchors (from_meeting, return_threshold, to_corridor) are not required in-frame content and are not carried by any Design beat');

console.log(`\nAll ${n} V3 B02 real-geometry compatibility checks passed (${expected.length ? `with ${expected.length} expected issue paths from the known r3 at_desk defect` : 'with zero exceptions'}) · source ${sourceHash.slice(0, 12)}`);
