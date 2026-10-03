/**
 * THE CORRECTION — deterministic Design r4 → runtime compile (Phase B).
 *
 *   docs/visual-v3/correction-slice/{geometry/source.json, geometry/collision_audit.json, assets.json}
 *     ─ pinned SHA-256 ─▶ structural reading (Design's published schema, every key mapped or listed)
 *     ─ radius-aware obstacle inflation (ONCE, here) ─▶ adaptDesignGeometry (the one affine mapping)
 *     ─▶ RuntimeGeometryV3 resource + compiled scene marks/routes (GeometryExport) + presentation staging
 *
 * Pure: bytes in, data out. No clock, no randomness, no network. The CLI (scripts/build-v3-correction-geometry.ts)
 * writes the result to src/data/experienceV3Fixtures/runtime/theCorrection.geometry.ts and `--check` proves the
 * committed module equals a fresh build.
 *
 * Every mapping choice the Design source does not publish is a named table below, never an inference:
 *   - runtime ids for locations, actors, portals, cameras, marks and routes (Design names kept in `designNames`);
 *   - Gold `near_director` ("Stand nearer the director", prep_near) is Design's STANDING PREPARATION anchor
 *     `stand_near_entry` (beats 04b/05b/06a/06c); Design's `near_director` anchor is the private-request approach
 *     (beat 06b) and compiles as `ask_director`;
 *   - Design P1 is the one door between corridor and meeting room: all four runtime portals that cross it
 *     (start_break, p_hall, p_room, resume_meeting) anchor on it. Design P0 (open plan ↔ corridor) is NOT a runtime
 *     portal: Gold makes desk → meeting a spine cut and P0 creates no travel;
 *   - obstacles: Design publishes bare footprints plus hero (0.20 m) and actor (0.25 m) radii. The runtime contract
 *     wants collision footprints already inflated by the hero radius, so they are inflated exactly once here
 *     (circumscribed arcs, so never smaller than the true offset) and intersected with the declared floor bounds
 *     (outside the bounds nothing is standable anyway). Actor footprints become obstacles of radius 0.25 + 0.20.
 *     Nothing downstream inflates again: `standable()` reads these polygons as they are.
 * The collision audit is reproduced on the BARE source with Design's rule and must agree with the committed audit.
 */

import { createHash } from 'node:crypto';
import { adaptDesignGeometry, type DesignCameraSource, type DesignGeometrySource, type DesignLocationSource, type SourceFloor, type SourcePoint } from '../../src/engine/v3/geometry/designAdapter.ts';
import type { RuntimeGeometryV3 } from '../../src/engine/v3/contracts/geometry.ts';
import type { GeometryExport, SceneGeometry } from '../../src/data/experienceV3Fixtures/runtime/compileFixturePlan.ts';
import type { AttentionTarget, FigureSpec, StagingAsset, StagingV3 } from '../../src/components/experience/v3/staging.ts';

export const ADAPTER_VERSION = '1.0.0';
export const BUILD_VERSION = '1.0.0';

/** The exact approved inputs (reports/v3-b02-final-closure.md). A different byte is a different, deliberate input. */
export const PINNED = {
  designCommit: '21403724418f36b8675ae03060dd7d9aadb7b724',
  source: { path: 'docs/visual-v3/correction-slice/geometry/source.json', sha256: 'a541aac8af489bdea7ca6fed2711d89032ff90e2975706cf74926ca8a39a0c81', revision: 'correction-geo-r4' },
  audit: { path: 'docs/visual-v3/correction-slice/geometry/collision_audit.json', sha256: 'b85b81064fa3b27ed6a603986309d1afe4a941552fabe961dbd7718ebb0abb11' },
  assets: { path: 'docs/visual-v3/correction-slice/assets.json', sha256: '6b2ebe1561da9b0a6207b34301b2c5c6f9bb8a9b3f525cfaacf039303fd5ab1d', revision: 'correction-assets-r4' },
} as const;

export class CorrectionBuildError extends Error {}
const fail = (m: string): never => {
  throw new CorrectionBuildError(m);
};

/* ------------------------------------------------------------ mapping --- */

const LOCATIONS: Record<string, string> = { 'correction.open_plan': 'desk', 'correction.corridor': 'hallway', 'correction.meeting_room': 'meeting' };
const ACTORS: Record<string, string> = { hero: 'a_me', mira: 'a_mira', director: 'a_director' };
/** Design hero anchor → compiled mark role, per Design location. Every published anchor must be listed. */
const MARKS: Record<string, Record<string, string>> = {
  'correction.open_plan': { at_desk: 'at_desk', to_corridor: 'to_corridor' },
  'correction.corridor': { from_meeting: 'from_meeting', reading: 'reading', return_threshold: 'return_threshold' },
  'correction.meeting_room': { entry: 'entry', own_seat: 'own_seat', stand_near_entry: 'near_director', near_director: 'ask_director' },
};
/** Design route → compiled route (named by compiled endpoint roles). */
const ROUTES: Record<string, Record<string, string>> = {
  'correction.open_plan': { desk_to_P0: 'at_desk_to_p0' },
  'correction.corridor': { exit_to_reading: 'threshold_to_reading', reading_to_return: 'reading_to_threshold' },
  'correction.meeting_room': { entry_to_seat: 'entry_to_own_seat', entry_to_stand: 'entry_to_near_director', seat_to_near_director: 'own_seat_to_ask_director', stand_to_near_director: 'near_director_to_ask_director' },
};
/** Design door → the runtime portals that physically cross it (both sides carry the anchor). */
const DOORS: Record<string, string[]> = { P0: [], P1: ['start_break', 'p_hall', 'p_room', 'resume_meeting'] };
const SURFACES: Record<string, Record<string, string>> = { 'correction.open_plan': { monitor: 'o_deck' }, 'correction.meeting_room': { screen: 'o_slide' } };
/** Keys of a Design location the build reads. Anything else is a new decision, not a silent drop. */
const LOCATION_KEYS = ['id', 'bounds', 'walls', 'walkable', 'obstacles', 'occluders', 'portals', 'display_surfaces', 'see_through', 'actors', 'hero_anchors', 'routes', 'objects', 'attachments', 'cameras', 'camera_safe'];
/** Published, deliberately not compiled into runtime geometry, with the reason. Asserted by the test. */
export const NOT_COMPILED: Record<string, string> = {
  walls: 'baked into the plates; walkable floor already excludes them',
  objects: 'mug, sheet, laptops, cups, papers: baked into the plates with fixed anchors; no runtime entity, never moved',
  'portals.P0': 'Gold: desk → meeting is a spine cut; P0 creates no travel and no runtime portal',
  'occluders.door_jambs': 'zero-length wall-plane segments: no floor footprint to occlude with',
  attachments: 'Design publishes slot names only (no offsets): held objects are drawn at the pose rig slot (staging.heldAt)',
  'hero_anchors.thresholds': 'to_corridor, from_meeting, return_threshold are portal-crossing positions: compiled marks of their location, carried by no scene (not in-frame content); crossings use the routes that start/end there',
};

/** Runtime scenes per variant: location, compiled recipe (landscape), entry role, carried roles, carried routes. */
const SCENES: Record<'rich' | 'compressed', Record<string, { location: string; camera: string; entry: string; marks: string[]; routes: string[] }>> = {
  rich: {
    c_desk: { location: 'desk', camera: 'desktop', entry: 'at_desk', marks: ['at_desk'], routes: [] },
    c_meeting_before: { location: 'meeting', camera: 'desktop', entry: 'entry', marks: ['entry'], routes: [] },
    c_hallway: { location: 'hallway', camera: 'desktop', entry: 'reading', marks: ['reading'], routes: ['threshold_to_reading', 'reading_to_threshold'] },
    c_meeting_question: {
      location: 'meeting', camera: 'desktop', entry: 'entry',
      marks: ['entry', 'own_seat', 'near_director', 'ask_director'],
      routes: ['entry_to_own_seat', 'entry_to_near_director', 'own_seat_to_ask_director', 'near_director_to_ask_director'],
    },
  },
  compressed: {
    c_compressed_before: { location: 'meeting', camera: 'desktop', entry: 'entry', marks: ['entry'], routes: [] },
    c_compressed_meeting: {
      location: 'meeting', camera: 'desktop', entry: 'entry',
      marks: ['entry', 'own_seat', 'near_director', 'ask_director'],
      routes: ['entry_to_own_seat', 'entry_to_near_director', 'own_seat_to_ask_director', 'near_director_to_ask_director'],
    },
  },
};
/** What each variant's resource carries: its locations, and the runtime portals that exist in its manifest. */
const VARIANT_SCOPE: Record<'rich' | 'compressed', { locations: string[]; portals: string[] }> = {
  rich: { locations: ['desk', 'hallway', 'meeting'], portals: ['start_break', 'p_hall', 'p_room', 'resume_meeting'] },
  // Gold §M: one meeting location, no walkable hallway, no door travel.
  compressed: { locations: ['meeting'], portals: [] },
};
/** Design beats → runtime scenes (attention), and Design's act beats → options. */
const BEAT_SCENES: Record<string, string[]> = {
  '01_desk': ['c_desk'],
  '02_meeting': ['c_meeting_before', 'c_compressed_before'],
  '03_hallway': ['c_hallway'],
  '05a_decision_seated': ['c_meeting_question', 'c_compressed_meeting'],
  '05b_decision_standing': ['c_meeting_question', 'c_compressed_meeting'],
};
const ACT_BEATS: Record<string, { option: string; pose: 'speak' | 'ask' | 'still' }> = {
  '06a_speak': { option: 'correct_public', pose: 'speak' },
  '06b_private': { option: 'request_private', pose: 'ask' },
  '06c_pass': { option: 'pass_question', pose: 'still' },
};
/** Design's second portrait framing (beat 02_meeting_room_portrait: display, Mira, director) is shown while the board line is the latest beat. */
const SECOND_FRAMING_BEAT = 'ev_board';
/** Pose rig stature (presentation): the D01 reference hero measures ≈1.73 m at its projected depth. */
const FIGURES: Record<string, Omit<FigureSpec, 'posture'>> = {
  a_me: { heightM: 1.73, build: 'hero', palette: { coat: '#C38A34', inner: '#B9A991', trousers: '#2A2B36', skin: '#C99A78', hair: '#2B211B', shoe: '#1C1A19' } },
  a_mira: { heightM: 1.66, build: 'slight', palette: { coat: '#53606F', inner: '#B9B3A6', trousers: '#2A2B36', skin: '#B98A6A', hair: '#4A3426', shoe: '#1C1A19' } },
  a_director: { heightM: 1.76, build: 'broad', palette: { coat: '#34373F', inner: '#8E8A84', trousers: '#2F3036', skin: '#9C7358', hair: '#8D8A86', shoe: '#1C1A19' } },
};

/* ------------------------------------------------------------ readers --- */

type Rec = Record<string, unknown>;
const rec = (v: unknown, w: string): Rec => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Rec) : fail(`${w}: expected an object`));
const arr = (v: unknown, w: string): unknown[] => (Array.isArray(v) ? v : fail(`${w}: expected a list`));
const num = (v: unknown, w: string): number => (typeof v === 'number' && Number.isFinite(v) ? v : fail(`${w}: expected a finite number`));
const str = (v: unknown, w: string): string => (typeof v === 'string' && v ? v : fail(`${w}: expected a string`));
const pair = (v: unknown, w: string): SourceFloor => {
  const a = arr(v, w);
  return a.length === 2 ? [num(a[0], w), num(a[1], w)] : fail(`${w}: expected [x, z]`);
};
const triple = (v: unknown, w: string): SourcePoint => {
  const a = arr(v, w);
  return a.length === 3 ? [num(a[0], w), num(a[1], w), num(a[2], w)] : fail(`${w}: expected [x, y, z]`);
};
const polyOf = (v: unknown, w: string): SourceFloor[] => arr(v, w).map((p, i) => pair(p, `${w}[${i}]`));
const facingOf = (yaw: number) => `yaw_${yaw < 0 ? 'm' : 'p'}${String(Math.abs(yaw)).replace('.', '_')}`;
export const sha256 = (b: Uint8Array | string) => createHash('sha256').update(b).digest('hex');
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

/* ----------------------------------------------------- planar helpers --- */

const signedArea = (p: SourceFloor[]) => p.reduce((a, [x, z], i) => a + x * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * z, 0) / 2;

/** Outward offset of a convex polygon by r, arcs circumscribed (never inside the true Minkowski sum). */
export function inflateConvex(poly: SourceFloor[], r: number, perQuarter = 8): SourceFloor[] {
  const p = signedArea(poly) > 0 ? poly : [...poly].reverse(); // counter-clockwise
  const n = p.length;
  const out: SourceFloor[] = [];
  for (let i = 0; i < n; i++) {
    const prev = p[(i + n - 1) % n];
    const cur = p[i];
    const next = p[(i + 1) % n];
    const normal = (a: SourceFloor, b: SourceFloor) => Math.atan2(-(b[0] - a[0]), b[1] - a[1]); // outward for CCW in (x, z)
    let a1 = normal(prev, cur);
    let a2 = normal(cur, next);
    while (a2 < a1) a2 += 2 * Math.PI;
    if (a2 - a1 > Math.PI) fail('inflateConvex: polygon is not convex');
    const steps = Math.max(1, Math.ceil(((a2 - a1) / (Math.PI / 2)) * perQuarter));
    const rr = r / Math.cos((a2 - a1) / (2 * steps));
    for (let k = 0; k <= steps; k++) {
      const a = a1 + ((a2 - a1) * k) / steps;
      out.push([r4(cur[0] + rr * Math.cos(a)), r4(cur[1] + rr * Math.sin(a))]);
    }
  }
  return dedupe(out);
}

/** A circle as a circumscribed regular polygon. */
export function circle(c: SourceFloor, r: number, sides = 16): SourceFloor[] {
  const rr = r / Math.cos(Math.PI / sides);
  return Array.from({ length: sides }, (_, k) => [r4(c[0] + rr * Math.cos((2 * Math.PI * k) / sides)), r4(c[1] + rr * Math.sin((2 * Math.PI * k) / sides))] as SourceFloor);
}

/** Sutherland–Hodgman against the declared floor rectangle. */
export function clipToBounds(poly: SourceFloor[], b: { xMin: number; xMax: number; zMin: number; zMax: number }): SourceFloor[] {
  const edges: Array<[(p: SourceFloor) => boolean, (a: SourceFloor, c: SourceFloor) => SourceFloor]> = [
    [p => p[0] >= b.xMin, (a, c) => [b.xMin, a[1] + ((c[1] - a[1]) * (b.xMin - a[0])) / (c[0] - a[0])]],
    [p => p[0] <= b.xMax, (a, c) => [b.xMax, a[1] + ((c[1] - a[1]) * (b.xMax - a[0])) / (c[0] - a[0])]],
    [p => p[1] >= b.zMin, (a, c) => [a[0] + ((c[0] - a[0]) * (b.zMin - a[1])) / (c[1] - a[1]), b.zMin]],
    [p => p[1] <= b.zMax, (a, c) => [a[0] + ((c[0] - a[0]) * (b.zMax - a[1])) / (c[1] - a[1]), b.zMax]],
  ];
  let out = poly;
  for (const [inside, cut] of edges) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      if (inside(cur)) {
        if (!inside(prev)) out.push(cut(prev, cur));
        out.push(cur);
      } else if (inside(prev)) out.push(cut(prev, cur));
    }
  }
  return dedupe(out.map(([x, z]) => [r4(x), r4(z)] as SourceFloor));
}

function dedupe(p: SourceFloor[]): SourceFloor[] {
  const out = p.filter((q, i) => i === 0 || q[0] !== p[i - 1][0] || q[1] !== p[i - 1][1]);
  while (out.length > 1 && out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1]) out.pop();
  return out;
}

const segDist = (p: SourceFloor, a: SourceFloor, b: SourceFloor) => {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dz));
};
const inside = (p: SourceFloor, poly: SourceFloor[]) => {
  let r = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > p[1] !== zj > p[1] && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) r = !r;
  }
  return r;
};

/* ------------------------------------------------------------- build --- */

export interface BuildInputs {
  source: Uint8Array;
  audit: Uint8Array;
  assets: Uint8Array;
}

export interface CorrectionGeometryBuild {
  provenance: {
    designCommit: string;
    sourceRevision: string;
    sourceSha256: string;
    auditSha256: string;
    assetsRevision: string;
    assetsSha256: string;
    adapterVersion: string;
    buildVersion: string;
  };
  geometry: Record<'rich' | 'compressed', RuntimeGeometryV3>;
  exports: Record<'rich' | 'compressed', GeometryExport>;
  staging: Record<'rich' | 'compressed', StagingV3>;
  /** Reproduced Design collision audit on the bare source (anchors and routes). */
  audit: Array<{ location: string; kind: 'anchor' | 'route'; name: string; clearance: number; ok: boolean }>;
}

export function buildCorrectionGeometry(inp: BuildInputs): CorrectionGeometryBuild {
  const hashes = { source: sha256(inp.source), audit: sha256(inp.audit), assets: sha256(inp.assets) };
  for (const k of ['source', 'audit', 'assets'] as const) if (hashes[k] !== PINNED[k].sha256) fail(`${PINNED[k].path}: SHA-256 ${hashes[k]} is not the pinned ${PINNED[k].sha256}`);
  const raw = rec(JSON.parse(Buffer.from(inp.source).toString('utf8')), 'source');
  const auditRaw = rec(JSON.parse(Buffer.from(inp.audit).toString('utf8')), 'audit');
  const assetsRaw = rec(JSON.parse(Buffer.from(inp.assets).toString('utf8')), 'assets');
  const revision = str(raw.revision, 'revision');
  if (revision !== PINNED.source.revision) fail(`source declares ${revision}, pinned ${PINNED.source.revision}`);
  if (auditRaw.geometry_revision !== revision || auditRaw.all_ok !== true) fail('collision audit is not an all_ok audit of this revision');
  if (assetsRaw.revision !== PINNED.assets.revision || assetsRaw.geometry_revision !== revision) fail('assets inventory does not belong to this geometry revision');

  const coll = rec(raw.collision, 'collision');
  const heroR = num(coll.hero_footprint_radius, 'hero radius');
  const actorR = num(coll.actor_footprint_radius, 'actor radius');
  if (heroR !== auditRaw.hero_footprint_radius || actorR !== auditRaw.actor_footprint_radius) fail('collision radii differ between source and audit');

  const yaws = new Set<number>();
  const yaw = (v: unknown, w: string) => {
    const y = num(v, w);
    yaws.add(y);
    return y;
  };
  const locs = rec(raw.locations, 'locations');
  if (Object.keys(locs).sort().join() !== Object.keys(LOCATIONS).sort().join()) fail('Design locations differ from the mapping table');

  const cameras: DesignCameraSource[] = [];
  const designNames: StagingV3['designNames'] = { locations: {}, cameras: {}, portals: {}, actors: {}, surfaces: {} };
  const zones: Record<string, Record<string, [number, number, number, number]>> = {};
  const auditRows: CorrectionGeometryBuild['audit'] = [];
  const dims: StagingV3['locations'] = {};
  const heroPostures: StagingV3['heroPostures'] = {};
  const anchorRoots: Record<string, Record<string, SourceFloor>> = {};
  const designAttention: Record<string, Array<{ at: SourcePoint; r: [number, number] } | 'hero'>> = {};
  const seeThrough: StagingV3['seeThrough'] = [];

  const locations: DesignLocationSource[] = Object.entries(locs).map(([rawId, v]) => {
    const l = rec(v, rawId);
    for (const k of Object.keys(l)) if (!LOCATION_KEYS.includes(k)) fail(`${rawId}.${k}: unmapped Design key`);
    const location = LOCATIONS[rawId];
    designNames.locations[location] = rawId;
    const b = rec(l.bounds, `${rawId}.bounds`);
    const bounds = { xMin: num(b.xMin, 'xMin'), xMax: num(b.xMax, 'xMax'), zMin: num(b.zMin, 'zMin'), zMax: num(b.zMax, 'zMax') };
    const heightScale = num(b.ceiling, `${rawId}.bounds.ceiling`);
    dims[location] = { widthM: bounds.xMax - bounds.xMin, depthM: bounds.zMax - bounds.zMin, heightScale };

    /* bare footprints, for the reproduced audit; inflated once for the runtime */
    const bareObstacles = Object.entries(rec(l.obstacles, `${rawId}.obstacles`)).map(([id, o]) => ({ id, poly: polyOf(rec(o, id).poly, `${rawId}.obstacles.${id}.poly`) }));
    const actors = Object.entries(rec(l.actors ?? {}, `${rawId}.actors`)).map(([name, a]) => {
      const q = rec(a, `${rawId}.actors.${name}`);
      const entity = ACTORS[name] ?? fail(`${rawId}.actors.${name}: unknown cast member`);
      designNames.actors[entity] = name;
      return { entity, root: pair(q.root, `${rawId}.actors.${name}.root`), yaw: yaw(q.yaw, `${rawId}.actors.${name}.yaw`), posture: str(q.posture, 'posture') as 'stand' | 'seat' };
    });
    /** Signed clearance (negative inside) to every bare obstacle but `exempt`, and to every actor footprint. */
    const clearanceOf = (q: SourceFloor, exempt?: string) =>
      Math.min(99, ...bareObstacles.filter(o => o.id !== exempt).map(o => (inside(q, o.poly) ? -1 : 1) * Math.min(...o.poly.map((a, i) => segDist(q, a, o.poly[(i + 1) % o.poly.length])))), ...actors.map(x => Math.hypot(q[0] - x.root[0], q[1] - x.root[1]) - actorR));
    const obstacles = [
      ...bareObstacles.map(o => ({ id: o.id, polygon: clipToBounds(inflateConvex(o.poly, heroR), bounds) })),
      ...actors.map(a => ({ id: `actor_${a.entity}`, polygon: clipToBounds(circle(a.root, actorR + heroR), bounds) })),
    ];

    /* hero marks, renamed; posture/seat carried literally */
    const anchorsRaw = rec(l.hero_anchors, `${rawId}.hero_anchors`);
    const names = MARKS[rawId];
    if (Object.keys(anchorsRaw).sort().join() !== Object.keys(names).sort().join()) fail(`${rawId}: hero anchors differ from the mapping table`);
    const marks: DesignLocationSource['marks'] = {};
    const markNames: Record<string, string> = (designNames[`marks.${location}`] = {});
    anchorRoots[location] = {};
    for (const [designRole, a] of Object.entries(anchorsRaw)) {
      const h = rec(a, `${rawId}.hero_anchors.${designRole}`);
      const posture = h.posture === 'stand' || h.posture === 'seat' ? h.posture : fail(`${rawId}.hero_anchors.${designRole}: unknown posture`);
      const role = names[designRole];
      const at = pair(h.root, `${rawId}.hero_anchors.${designRole}.root`);
      marks[role] = { at, yaw: yaw(h.yaw, 'yaw'), posture, ...(h.seat !== undefined ? { seat: str(h.seat, 'seat') } : {}) };
      markNames[role] = designRole;
      anchorRoots[location][designRole] = at;
      if (posture === 'seat') (heroPostures[location] ??= {})[role] = 'seat';
      // Reproduce Design's audit on bare footprints: standing anchors ≥ hero radius from every obstacle and actor footprint.
      const exempt = posture === 'seat' ? str(h.seat, 'seat') : undefined;
      const inWalk = (l.walkable as unknown[]).some((w, i) => inside(at, polyOf(w, `${rawId}.walkable[${i}]`)));
      const clear = clearanceOf(at, exempt);
      auditRows.push({ location: rawId, kind: 'anchor', name: designRole, clearance: Math.round(clear * 1000) / 1000, ok: inWalk && (exempt ? clear >= 0 && inside(at, bareObstacles.find(o => o.id === exempt)?.poly ?? []) : clear >= heroR - 1e-9) });
    }

    /* routes, renamed; audit samples every 0.05 m with Design's docking exemption */
    const routesRaw = rec(l.routes, `${rawId}.routes`);
    if (Object.keys(routesRaw).sort().join() !== Object.keys(ROUTES[rawId]).sort().join()) fail(`${rawId}: routes differ from the mapping table`);
    const routes: Record<string, SourceFloor[]> = {};
    const routeNames: Record<string, string> = (designNames[`routes.${location}`] = {});
    for (const [designName, pts] of Object.entries(routesRaw)) {
      const p = polyOf(pts, `${rawId}.routes.${designName}`);
      routes[ROUTES[rawId][designName]] = p;
      routeNames[ROUTES[rawId][designName]] = designName;
      // Design's rule (generator/collision.py), reproduced literally: samples at int(len / 0.05) steps per leg; a sample
      // within 0.55 m (straight-line) of a seated anchor that starts or ends this route is exempt from that seat only.
      const seatPts = Object.values(anchorsRaw).map(a => rec(a, 'a')).filter(a => a.posture === 'seat').map(a => ({ at: pair(a.root, 'root'), seat: str(a.seat, 'seat') }));
      const ends = (q: SourceFloor) => (p[0][0] === q[0] && p[0][1] === q[1]) || (p[p.length - 1][0] === q[0] && p[p.length - 1][1] === q[1]);
      let min = Infinity;
      let ok = true;
      for (let i = 1; i < p.length; i++) {
        const [a, c] = [p[i - 1], p[i]];
        const n = Math.max(1, Math.floor(Math.hypot(c[0] - a[0], c[1] - a[1]) / 0.05));
        for (let k = 0; k <= n; k++) {
          const q: SourceFloor = [a[0] + ((c[0] - a[0]) * k) / n, a[1] + ((c[1] - a[1]) * k) / n];
          const exempt = seatPts.filter(sp => Math.hypot(q[0] - sp.at[0], q[1] - sp.at[1]) <= 0.55 && ends(sp.at)).map(sp => sp.seat).at(-1);
          const d = clearanceOf(q, exempt);
          min = Math.min(min, d);
          if (d < heroR - 1e-9 || !(l.walkable as unknown[]).some((w, j) => inside(q, polyOf(w, `w${j}`)))) ok = false;
        }
      }
      auditRows.push({ location: rawId, kind: 'route', name: designName, clearance: Math.round(min * 1000) / 1000, ok });
    }

    /* doors: Design P1 carries every runtime portal that crosses it */
    const portals = Object.entries(rec(l.portals, `${rawId}.portals`)).flatMap(([pid, p]) => {
      const q = rec(p, `${rawId}.portals.${pid}`);
      const [a, c] = arr(q.segment, 'segment');
      const ins = pair(q.threshold_inside, 'threshold_inside');
      const out = pair(q.threshold_outside, 'threshold_outside');
      const deg = Math.round(((Math.atan2(out[0] - ins[0], -(out[1] - ins[1])) * 180) / Math.PI) * 1e6) / 1e6;
      const ids = DOORS[pid] ?? fail(`${rawId}.portals.${pid}: unmapped door`);
      for (const id of ids) (designNames.portals[id] ??= pid);
      return ids.map(portal => ({ portal, a: pair(a, 'a'), b: pair(c, 'b'), yaw: yaw(deg, 'door yaw') }));
    });

    /* occluders: polygons as published; segments as 2 cm slabs; mullion rows per mullion */
    const occluders: DesignLocationSource['occluders'] = [];
    let priority = 0;
    const slab = (s: SourceFloor[], half: number): SourceFloor[] => {
      const [a, c] = s;
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (len === 0) return [];
      const nx = (-(c[1] - a[1]) / len) * half;
      const nz = ((c[0] - a[0]) / len) * half;
      return clipToBounds([[a[0] + nx, a[1] + nz], [c[0] + nx, c[1] + nz], [c[0] - nx, c[1] - nz], [a[0] - nx, a[1] - nz]], bounds);
    };
    for (const [oid, o] of Object.entries(rec(l.occluders, `${rawId}.occluders`))) {
      const q = rec(o, `${rawId}.occluders.${oid}`);
      const top = num(q.yMax, `${rawId}.occluders.${oid}.yMax`);
      if (q.poly) occluders.push({ id: `occ_${oid}`, polygon: clipToBounds(polyOf(q.poly, 'poly'), bounds), height: top, priority: priority++ });
      else if (q.segment) occluders.push({ id: `occ_${oid}`, polygon: slab(polyOf(q.segment, 'segment'), 0.01), height: top, priority: priority++ });
      else if (q.z && q.x !== undefined) {
        const x = num(q.x, 'x');
        const w = num(q.width, 'width') / 2;
        arr(q.z, 'z').forEach((z, i) => {
          const zz = num(z, 'z');
          const poly = clipToBounds([[x - w, zz - w], [x + w, zz - w], [x + w, zz + w], [x - w, zz + w]], bounds);
          if (poly.length >= 3 && Math.abs(signedArea(poly)) > 1e-9) occluders.push({ id: `occ_${oid}_${i}`, polygon: poly, height: top, priority: priority++ });
        });
      } else if (oid !== 'door_jambs') fail(`${rawId}.occluders.${oid}: unknown occluder shape`);
    }

    /* staging anchors: actor roots and display surfaces */
    const anchors: DesignLocationSource['anchors'] = actors.map(a => ({ entity: a.entity, root: a.root, height: 0, yaw: a.yaw }));
    for (const [sid, s] of Object.entries(rec(l.display_surfaces ?? {}, `${rawId}.display_surfaces`))) {
      const q = rec(s, `${rawId}.display_surfaces.${sid}`);
      const entity = SURFACES[rawId]?.[sid] ?? fail(`${rawId}.display_surfaces.${sid}: unmapped surface`);
      const corners = arr(q.corners, 'corners').map((c, i) => triple(c, `corners[${i}]`)) as [SourcePoint, SourcePoint, SourcePoint, SourcePoint];
      if (corners.length !== 4) fail(`${rawId}.display_surfaces.${sid}: four corners`);
      if (!arr(q.live_text_slots, 'live_text_slots').includes('display.title')) fail(`${rawId}.display_surfaces.${sid}: no display.title slot`);
      designNames.surfaces[entity] = `${rawId}.${sid}`;
      const cx = (corners[0][0] + corners[1][0]) / 2;
      const cy = (corners[0][1] + corners[3][1]) / 2;
      anchors.push({ entity, root: [r4(cx), corners[0][2]], height: r4(cy), surface: corners });
    }

    /* cameras and their safe regions / layout zones */
    const safe = rec(l.camera_safe, `${rawId}.camera_safe`);
    for (const [recipe, c] of Object.entries(rec(l.cameras, `${rawId}.cameras`))) {
      const k = rec(c, `${rawId}.cameras.${recipe}`);
      const frame = arr(k.frame, 'frame').map(n => num(n, 'frame'));
      const principal = arr(k.principal, 'principal').map(n => num(n, 'principal'));
      const position = triple(k.position, 'position');
      const orientation = frame[0] < frame[1] ? 'portrait' : 'landscape';
      const z = rec(safe[orientation === 'portrait' ? 'portrait' : 'desktop'], 'camera_safe');
      const ts = arr(z.title_safe, 'title_safe').map(n => num(n, 'title_safe'));
      const id = `${location}__${recipe}`;
      designNames.cameras[id] = `${rawId}.${recipe}`;
      zones[id] = Object.fromEntries(Object.entries(z).map(([zn, q]) => [zn, arr(q, zn).map(n => num(n, zn)) as [number, number, number, number]]));
      cameras.push({ id, location, orientation, viewport: { width: frame[0], height: frame[1] }, cx: principal[0], hy: principal[1], f: num(k.focal_px, 'focal_px'), cam: position, safe: { x: ts[0], y: ts[1], width: ts[2] - ts[0], height: ts[3] - ts[1] } });
    }

    /* see-through: Design states it as the inverse of a paired door transform */
    if (l.see_through) {
      const st = rec(l.see_through, `${rawId}.see_through`);
      const m = /via transform meeting→corridor: x\+([\d.]+), z\+([\d.]+)/.exec(str(st.glass, 'glass')) ?? fail(`${rawId}.see_through: unreadable transform`);
      for (const n of arr(st.actors_visible, 'actors_visible')) if (!ACTORS[String(n)]) fail('see_through names an unknown actor');
      seeThrough.push({ from: 'meeting', to: location, portals: ['p_room', 'p_hall'], x: [Number(m[1]), 0], y: [Number(m[2]), 0], h: 0 }); // metres; normalized below
    }

    return {
      location,
      kitRevision: revision,
      bounds,
      heightScale,
      marks,
      routes,
      walkable: arr(l.walkable, `${rawId}.walkable`).map((w, i) => ({ outer: polyOf(w, `${rawId}.walkable[${i}]`) })),
      obstacles,
      occluders,
      portals,
      anchors,
      attachments: [],
    };
  });

  /* the committed audit must agree with the reproduction, check by check */
  const committed = arr(auditRaw.checks, 'checks').map(c => rec(c, 'check'));
  if (committed.length !== auditRows.length) fail(`audit has ${committed.length} checks, reproduction ${auditRows.length}`);
  for (const row of auditRows) {
    const c = committed.find(x => x.location === row.location && x.kind === row.kind && x.name === row.name) ?? fail(`audit has no ${row.kind} ${row.name}`);
    if (c.ok !== true || !row.ok) fail(`${row.location} ${row.kind} ${row.name}: collision check failed`);
    if (Math.abs(num(c.clearance, 'clearance') - row.clearance) > 0.0015) fail(`${row.location} ${row.kind} ${row.name}: clearance ${row.clearance} vs audit ${c.clearance}`);
  }

  /* portal pairs: the see-through transform must equal the inverse of Design's paired-door transform */
  const pairs = arr(raw.portal_pairs, 'portal_pairs').map(p => rec(p, 'pair'));
  const p1 = pairs.find(p => JSON.stringify(p.a) === JSON.stringify(['correction.corridor', 'P1'])) ?? fail('no P1 pair');
  const t = /^x - ([\d.]+), z - ([\d.]+)$/.exec(str(p1.transform_a_to_b, 'transform')) ?? fail('unreadable P1 transform');
  for (const v of seeThrough) if (v.x[0] !== Number(t[1]) || v.y[0] !== Number(t[2])) fail('see-through transform is not the inverse of the P1 pair');

  const source: DesignGeometrySource = {
    designSchemaVersion: 1,
    sourceRevision: revision,
    facings: [...yaws].sort((a, b) => a - b).map(y => ({ yaw: y, facing: facingOf(y) })),
    locations,
    cameras,
  };
  const adapted = adaptDesignGeometry(source, { geometryRevision: `${revision}-runtime`, adapterVersion: ADAPTER_VERSION, sourceHash: hashes.source });

  /* see-through in normalized units: to = scale * from + offset */
  const norm = (loc: string) => dims[loc];
  const seeThroughN = seeThrough.map(v => {
    const a = norm(v.from);
    const b = norm(v.to);
    const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
    return { from: v.from, to: v.to, portals: v.portals, x: [r6(a.widthM / b.widthM), r6((100 * v.x[0]) / b.widthM)] as [number, number], y: [r6(a.depthM / b.depthM), r6((100 * v.y[0]) / b.depthM)] as [number, number], h: r6(a.heightScale / b.heightScale) };
  });

  /* attention islands (presentation), from Design beats */
  const toTarget = (loc: string, a: unknown, heroRoots: SourceFloor[], fallbackR: [number, number]): AttentionTarget => {
    const d = dims[loc];
    if (a === '<hero anchor>') return { kind: 'hero', r: [Math.round((100 * fallbackR[0]) / d.widthM * 1000) / 1000, Math.round((fallbackR[1] / d.heightScale) * 1000) / 1000] };
    const [x, y, z, rx, ry] = arr(a, 'attention').map(n => num(n, 'attention'));
    const r: [number, number] = [Math.round(((100 * rx) / d.widthM) * 1000) / 1000, Math.round((ry / d.heightScale) * 1000) / 1000];
    // A target on the beat's hero anchor follows the hero wherever the snapshot places it.
    if (heroRoots.some(h => Math.hypot(h[0] - x, h[1] - z) < 0.15)) return { kind: 'hero', r };
    return { kind: 'point', at: [Math.round((100 * x) / d.widthM * 1000) / 1000, Math.round((100 * z) / d.depthM * 1000) / 1000, Math.round((y / d.heightScale) * 1000) / 1000], r };
  };
  const attention: StagingV3['attention'] = {};
  const enactments: StagingV3['enactments'] = {};
  const beats = arr(raw.beats, 'beats').map(b => rec(b, 'beat'));
  const HERO_R: [number, number] = [0.95, 1.2];
  for (const b of beats) {
    const name = str(b.beat, 'beat');
    const loc = LOCATIONS[str(b.location, 'location')];
    const heroRoots = String(b.hero_anchor ?? '').split('|').map(s => s.trim()).filter(Boolean).map(r => anchorRoots[loc][r] ?? fail(`beat ${name}: unknown anchor ${r}`));
    const targets = arr(b.attention ?? [], 'attention').map(a => toTarget(loc, a, heroRoots, HERO_R));
    for (const scene of BEAT_SCENES[name] ?? []) {
      const prev = attention[scene] ?? [];
      // One hero island per scene (the first Design beat's size); fixed targets once each.
      for (const tg of targets) if (!prev.some(p => (tg.kind === 'hero' ? p.kind === 'hero' : JSON.stringify(p) === JSON.stringify(tg)))) prev.push(tg);
      attention[scene] = prev;
    }
    const act = ACT_BEATS[name];
    if (act) {
      const approach = typeof b.route === 'string' ? MARKS['correction.meeting_room'][str(b.hero_anchor, 'hero_anchor')] : undefined;
      enactments[act.option] = { pose: act.pose, ...(approach ? { approachTo: approach } : {}), attention: targets };
    }
  }
  // Every scene shows its hero in an island, as every Design frame does.
  for (const scenes of Object.values(SCENES)) for (const s of Object.keys(scenes)) if (!(attention[s] ?? []).some(a => a.kind === 'hero')) attention[s] = [{ kind: 'hero', r: [Math.round((100 * HERO_R[0]) / dims[scenes[s].location].widthM * 1000) / 1000, Math.round((HERO_R[1] / dims[scenes[s].location].heightScale) * 1000) / 1000] }, ...(attention[s] ?? [])];

  /* assets: runtime_public only. Private reveal slots have no file and are never compiled. */
  const assets: Record<string, StagingAsset> = {};
  const plates: StagingV3['plates'] = {};
  for (const a of arr(assetsRaw.runtime_public, 'runtime_public').map(x => rec(x, 'asset'))) {
    const id = str(a.id, 'asset id').toLowerCase();
    if (a.visibility !== 'public' || a.revision !== PINNED.assets.revision) fail(`asset ${id}: not a public ${PINNED.assets.revision} asset`);
    const preload = a.preload === 'scene' ? 'scene' : a.preload === 'after-boundary-public' ? 'after_boundary_public' : fail(`asset ${id}: unknown preload class`);
    assets[id] = { url: `@@asset:${str(a.path, 'path')}@@`, sha256: str(a.sha256, 'sha256'), width: num(a.width, 'width'), height: num(a.height, 'height'), revision: str(a.revision, 'revision'), role: str(a.layer_role, 'layer_role'), preload };
    if (/^L[12]_plate_/.test(String(a.layer_role))) {
      const cam = `${LOCATIONS[str(a.location, 'location')]}__${str(a.camera, 'camera')}`;
      const slot = String(a.layer_role).endsWith('graphite') ? 'graphite' : 'paint';
      (plates[cam] ??= { graphite: '', paint: '' })[slot] = id;
    }
  }
  if (arr(assetsRaw.private_reveal, 'private_reveal').some(p => rec(p, 'p').path !== null || rec(p, 'p').preload !== false)) fail('a private reveal slot has a file or is preloaded');

  /* compiled scenes per variant: marks and routes straight from the adapter (one mapping) */
  const exportFor = (variant: 'rich' | 'compressed'): GeometryExport => {
    const scenes: Record<string, SceneGeometry> = {};
    for (const [id, s] of Object.entries(SCENES[variant])) {
      const marks = adapted.marks[s.location];
      const routes = adapted.routes[s.location];
      scenes[id] = {
        kitRevision: revision,
        compositionRevision: PINNED.assets.revision,
        cameraRecipe: `${s.location}__${s.camera}`,
        lightRecipe: 'baked_plate',
        audioRecipe: 'silent',
        entryMark: structuredClone(marks[s.entry] ?? fail(`${id}: no mark ${s.entry}`)),
        marks: Object.fromEntries(s.marks.map(r => [r, structuredClone(marks[r] ?? fail(`${id}: no mark ${r}`))])),
        ...(s.routes.length ? { routes: Object.fromEntries(s.routes.map(r => [r, structuredClone(routes[r] ?? fail(`${id}: no route ${r}`))])) } : {}),
      };
    }
    const meeting = adapted.geometry.locations.find(l => l.location === 'meeting')!;
    const actorMarks = Object.fromEntries(meeting.anchors.filter(a => a.entity.startsWith('a_')).map(a => [a.entity, { x: a.root[0], y: a.root[1], facing: a.facing ?? fail('actor facing') }]));
    return {
      id: `${revision}-runtime`,
      assetRevisions: { correction_geometry: revision, correction_assets: PINNED.assets.revision },
      assetHashes: {
        correction_geometry_source: hashes.source,
        correction_collision_audit: hashes.audit,
        correction_assets_inventory: hashes.assets,
        ...Object.fromEntries(Object.entries(assets).map(([id, a]) => [id, a.sha256])),
      },
      scenes,
      actorMarks,
    };
  };

  const framing = (loc: string, extra: Partial<StagingV3['framings'][string]> = {}) => ({ landscape: `${loc}__desktop`, portrait: `${loc}__portrait`, ...extra });
  const meetingFramings = { portraitByBeat: { [SECOND_FRAMING_BEAT]: 'meeting__portrait_room' } };
  const actFraming = { portraitByOption: { request_private: `meeting__${String(beats.find(b => b.beat === '06b_private')?.camera_portrait ?? fail('06b has no portrait camera'))}` } };
  const allFramings: StagingV3['framings'] = {
    c_desk: framing('desk'),
    c_meeting_before: framing('meeting', meetingFramings),
    c_hallway: framing('hallway'),
    c_meeting_question: framing('meeting', actFraming),
    c_compressed_before: framing('meeting'),
    c_compressed_meeting: framing('meeting', { ...meetingFramings, ...actFraming }),
  };
  const crossings: StagingV3['crossings'] = [
    { portal: 'start_break', location: 'hallway', arrive: 'threshold_to_reading' },
    { portal: 'p_hall', location: 'hallway', arrive: 'threshold_to_reading' },
    { portal: 'p_room', location: 'hallway', depart: 'reading_to_threshold' },
    { portal: 'resume_meeting', location: 'hallway', depart: 'reading_to_threshold' },
  ];

  /** A variant's resource: only its locations and the door anchors of portals its manifest has. Same numbers. */
  const scoped = (variant: 'rich' | 'compressed'): RuntimeGeometryV3 => {
    const sc = VARIANT_SCOPE[variant];
    const g = structuredClone(adapted.geometry);
    g.geometryRevision = `${revision}-${variant}`;
    g.locations = g.locations.filter(l => sc.locations.includes(l.location)).map(l => ({ ...l, portals: l.portals.filter(d => sc.portals.includes(d.portal)) }));
    g.cameras = g.cameras.filter(c => sc.locations.includes(c.location));
    return g;
  };
  const stagingFor = (variant: 'rich' | 'compressed'): StagingV3 => {
    const sc = VARIANT_SCOPE[variant];
    const scenes = Object.keys(SCENES[variant]);
    const cams = new Set(Object.keys(plates).filter(c => sc.locations.includes(c.split('__')[0])));
    const keepAsset = (id: string) => [...cams].some(c => plates[c].graphite === id || plates[c].paint === id) || Object.values({ summary: 'summary_prop', display: 'display_texture', authorPage: 'author_page' }).includes(id);
    return {
      stagingRevision: `${revision}-staging-${variant}`,
      geometryRevision: revision,
      assetsRevision: PINNED.assets.revision,
      locations: Object.fromEntries(Object.entries(dims).filter(([l]) => sc.locations.includes(l))),
      framings: Object.fromEntries(scenes.map(sid => [sid, allFramings[sid]])),
      zones: Object.fromEntries(Object.entries(zones).filter(([c]) => cams.has(c))),
      plates: Object.fromEntries(Object.entries(plates).filter(([c]) => cams.has(c))),
      props: { summary: 'summary_prop', display: 'display_texture', authorPage: 'author_page' },
      assets: Object.fromEntries(Object.entries(assets).filter(([id]) => keepAsset(id))),
      attention: Object.fromEntries(scenes.map(sid => [sid, attention[sid] ?? []])),
      enactments,
      heroPostures: Object.fromEntries(Object.entries(heroPostures).filter(([l]) => sc.locations.includes(l))),
      heldAt: { stand: 'hand_r', seat: 'lap' },
      figures: Object.fromEntries(Object.entries(FIGURES).map(([id, f]) => [id, { ...f, posture: id === 'a_director' ? 'seat' : 'stand' }])) as StagingV3['figures'],
      seeThrough: seeThroughN.filter(v => sc.locations.includes(v.from) && sc.locations.includes(v.to) && v.portals.every(p => sc.portals.includes(p))),
      crossings: crossings.filter(c => sc.portals.includes(c.portal)),
      surfaces: Object.fromEntries(Object.entries({ o_deck: { location: 'desk', slot: 'display.title' as const }, o_slide: { location: 'meeting', slot: 'display.title' as const } }).filter(([, v]) => sc.locations.includes(v.location))),
      designNames,
    };
  };

  return {
    provenance: {
      designCommit: PINNED.designCommit,
      sourceRevision: revision,
      sourceSha256: hashes.source,
      auditSha256: hashes.audit,
      assetsRevision: PINNED.assets.revision,
      assetsSha256: hashes.assets,
      adapterVersion: ADAPTER_VERSION,
      buildVersion: BUILD_VERSION,
    },
    geometry: { rich: scoped('rich'), compressed: scoped('compressed') },
    exports: { rich: exportFor('rich'), compressed: exportFor('compressed') },
    staging: { rich: stagingFor('rich'), compressed: stagingFor('compressed') },
    audit: auditRows,
  };
}

/** Which hero marks each framing must show (validateStaging probes). Desktop shows every carried mark. */
export function correctionFramingShows(sceneId: string, framing: 'default' | { beat: string } | { option: string }, orientation: 'landscape' | 'portrait'): string[] {
  const all = Object.values(SCENES).find(v => v[sceneId])?.[sceneId]?.marks ?? [];
  if (framing === 'default') return orientation === 'landscape' ? all : all.filter(r => r !== 'ask_director'); // portrait shows the approach in its own framing
  if ('beat' in framing) return []; // Design's second framing shows display, Mira and director; not the hero
  return framing.option === 'request_private' ? ['ask_director'] : all;
}
