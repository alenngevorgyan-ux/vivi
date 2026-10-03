/**
 * Normalized runtime geometry: the contract seam between Design and the runtime.
 *
 *   Design source geometry (metres, one location-local frame per location)
 *     ─ deterministic build-time adapter (geometry/designAdapter.ts) →
 *   normalized runtime geometry (this file) + named marks for the manifest
 *
 * ONE coordinate authority at runtime. Named marks (entry marks, reposition
 * roles) live only in the manifest's compiled scenes, as they always have; this
 * resource never repeats them. It carries what the manifest cannot: walkable
 * floor, collision obstacles, occluders, door anchors, staging anchors,
 * attachment points, compiled camera projections and camera-safe regions.
 * `validateGeometryForManifest` proves the two agree.
 *
 * Floor space is 0..100 in both axes: x increases to the right, y increases in
 * depth (away from the camera), origin at the location's declared near-left
 * floor bound. Heights are in normalized height units (source metres divided
 * by the location's declared height scale). Nothing here is clamped: a value
 * out of range is a validation error, never silently moved.
 *
 * Cameras may stand inside a location's bounds (an interior camera). Nothing
 * requires the whole floor to be in front of a camera: projection is strict
 * per point (`projectPoint` has no result at or behind the camera plane) and a
 * scene is validated only against the camera recipe it actually selects.
 *
 * Collision is never waived by a mark's name. The one exception is explicit
 * Design source semantics: a mark whose posture is `seat` declares the obstacle
 * that supports it (`LocationGeometry.seats`), and only that mark, on only that
 * obstacle, may overlap it.
 *
 * Geometry never gates a causal act by distance: it is presentation, movement
 * and hit testing only.
 */

import type { PlaybackManifestV3, SpatialMark } from './manifest.ts';
import { ID_RE, type IssueCode, type ValidationIssue, type ValidationResult } from './validate.ts';

export const GEOMETRY_SCHEMA_VERSION = 1 as const;

/** Normalized floor point: [x right, y depth], each 0..100. */
export type FloorPoint = [number, number];
/** Normalized point with height: [x, y depth, h]. */
export type Point3 = [number, number, number];

export interface FloorPolygon {
  outer: FloorPoint[];
  holes?: FloorPoint[][];
}

export interface Obstacle {
  id: string;
  /** Collision footprint, already inflated by the approved hero radius. */
  polygon: FloorPoint[];
}

export interface Occluder {
  id: string;
  /** Floor footprint of the occluding body (furniture, wall, mullion, paper base). */
  polygon: FloorPoint[];
  /** Top height in normalized height units. */
  height: number;
  /** Larger draws nearer when depth sorting ties. */
  priority: number;
}

export interface PortalAnchor {
  portal: string;
  /** The door segment in this location's own frame. */
  a: FloorPoint;
  b: FloorPoint;
  /** Approved facing id through the door, from this side. */
  facing: string;
}

/** Static staging root of an actor or object: feet / footprint centre on the floor. */
export interface StagingAnchor {
  entity: string;
  root: FloorPoint;
  height: number;
  facing?: string;
  /** A display surface's four corners (for projected DOM text), clockwise from top-left. */
  surface?: [Point3, Point3, Point3, Point3];
}

/** A named rig point relative to an entity's root (e.g. the hero's summary hand). Held objects attach here. */
export interface Attachment {
  id: string;
  entity: string;
  offset: Point3;
}

/**
 * Design's explicit statement that a named hero mark is a seated position supported by one obstacle.
 * It is a relationship, not a coordinate: the mark itself lives only in the manifest's compiled scenes.
 */
export interface SeatDeclaration {
  /** The mark role (a key of a compiled scene's `marks`). */
  role: string;
  /** The obstacle (in this location) the seated hero rests on. */
  obstacle: string;
}

export interface LocationGeometry {
  location: string;
  kitRevision: string;
  /** Seated marks and their supporting obstacles; absent when the location has none. */
  seats?: SeatDeclaration[];
  walkable: FloorPolygon[];
  obstacles: Obstacle[];
  occluders: Occluder[];
  portals: PortalAnchor[];
  anchors: StagingAnchor[];
  attachments: Attachment[];
}

/**
 * A compiled perspective camera over ONE location's normalized floor:
 *   screenX = cx + fx * (x - camX) / (y - camY)
 *   screenY = hy + fy * (eye - h) / (y - camY)
 * in the recipe's reference viewport pixels. Portrait is a separate recipe over the same marks.
 */
export interface CameraGeometry {
  id: string;
  location: string;
  orientation: 'landscape' | 'portrait';
  viewport: { width: number; height: number };
  projection: { cx: number; hy: number; fx: number; fy: number; camX: number; camY: number; eye: number };
  /** Region where essential anchors, captions and controls may sit, in viewport pixels. */
  safe: { x: number; y: number; width: number; height: number };
}

export interface RuntimeGeometryV3 {
  geometrySchemaVersion: 1;
  geometryRevision: string;
  provenance: { sourceRevision: string; adapterVersion: string; sourceHash: string };
  locations: LocationGeometry[];
  cameras: CameraGeometry[];
}

/* -------------------------------------------------------------- maths --- */

const DEPTH_EPSILON = 1e-6;

/** Project a normalized point through a compiled camera. Undefined when it is at or behind the camera plane. */
export function projectPoint(c: CameraGeometry, x: number, y: number, h = 0): { sx: number; sy: number } | undefined {
  const p = c.projection;
  const depth = y - p.camY;
  if (!(depth > DEPTH_EPSILON)) return undefined;
  return { sx: p.cx + (p.fx * (x - p.camX)) / depth, sy: p.hy + (p.fy * (p.eye - h)) / depth };
}

/** Inverse floor projection for pointer input (viewport pixels, after CSS scaling/letterbox are removed). */
export function unprojectFloor(c: CameraGeometry, sx: number, sy: number): FloorPoint | undefined {
  const p = c.projection;
  const below = sy - p.hy;
  if (!(Math.abs(below) > DEPTH_EPSILON) || p.fy * p.eye === 0) return undefined;
  const depth = (p.fy * p.eye) / below; // h = 0
  if (!(depth > DEPTH_EPSILON)) return undefined; // above the horizon, or behind the camera
  return [p.camX + ((sx - p.cx) * depth) / p.fx, p.camY + depth];
}

/** Even-odd point in polygon; points on an edge count as inside. */
export function pointInPolygon(pt: FloorPoint, poly: readonly FloorPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const cross = (pt[0] - xi) * (yj - yi) - (pt[1] - yi) * (xj - xi);
    if (Math.abs(cross) < 1e-9 && pt[0] >= Math.min(xi, xj) - 1e-9 && pt[0] <= Math.max(xi, xj) + 1e-9 && pt[1] >= Math.min(yi, yj) - 1e-9 && pt[1] <= Math.max(yi, yj) + 1e-9) return true;
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Standable: inside some walkable polygon, outside its holes, outside every collision obstacle. */
export function standable(g: LocationGeometry, pt: FloorPoint): boolean {
  const onFloor = g.walkable.some(w => pointInPolygon(pt, w.outer) && !(w.holes ?? []).some(h => pointInPolygon(pt, h)));
  return onFloor && !g.obstacles.some(o => pointInPolygon(pt, o.polygon));
}

/**
 * A seated mark's footprint: on walkable floor and inside the declared supporting obstacle, and clear of every
 * OTHER obstacle. This is the only way a point may lie inside an obstacle; it never waives a different one.
 */
export function seatedStandable(g: LocationGeometry, pt: FloorPoint, obstacle: string): boolean {
  const seat = g.obstacles.find(o => o.id === obstacle);
  if (!seat || !pointInPolygon(pt, seat.polygon)) return false;
  const onFloor = g.walkable.some(w => pointInPolygon(pt, w.outer) && !(w.holes ?? []).some(h => pointInPolygon(pt, h)));
  return onFloor && !g.obstacles.some(o => o.id !== obstacle && pointInPolygon(pt, o.polygon));
}

const area = (poly: readonly FloorPoint[]) => Math.abs(poly.reduce((a, [x, y], i) => a + x * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * y, 0)) / 2;

/* --------------------------------------------------------- validation --- */

const isRec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const unit = (v: unknown) => fin(v) && v >= 0 && v <= 100;

class Issues {
  list: ValidationIssue[] = [];
  add(path: string, code: IssueCode, message: string) {
    if (this.list.length < 80) this.list.push({ path, code, message });
  }
}

function closed(c: Issues, v: unknown, path: string, required: string[], optional: string[] = []): v is Record<string, unknown> {
  if (!isRec(v)) return void c.add(path, 'type', 'expected an object'), false;
  const allowed = new Set([...required, ...optional]);
  for (const k of Object.keys(v)) if (!allowed.has(k)) c.add(`${path}.${k}`, 'unknown_key', 'key is not part of the geometry contract');
  for (const k of required) if (!(k in v)) c.add(`${path}.${k}`, 'missing_key', 'required key is missing');
  return true;
}
const id = (c: Issues, v: unknown, path: string) => (typeof v === 'string' && ID_RE.test(v) ? v : void c.add(path, 'id_format', 'expected a lowercase identifier'));
const floorPoint = (c: Issues, v: unknown, path: string): v is FloorPoint => {
  const ok = Array.isArray(v) && v.length === 2 && v.every(unit);
  if (!ok) c.add(path, 'type', 'expected a floor point [x, y] within 0..100');
  return ok;
};
const point3 = (c: Issues, v: unknown, path: string, bounded: boolean): v is Point3 => {
  const ok = Array.isArray(v) && v.length === 3 && v.every(fin) && (!bounded || (unit(v[0]) && unit(v[1]) && (v[2] as number) >= 0));
  if (!ok) c.add(path, 'type', bounded ? 'expected [x, y, h] with x/y within 0..100 and h >= 0' : 'expected finite [dx, dy, dh]');
  return ok;
};
const polygon = (c: Issues, v: unknown, path: string): v is FloorPoint[] => {
  if (!Array.isArray(v) || v.length < 3 || v.length > 256) return void c.add(path, 'type', 'expected a polygon of 3..256 points'), false;
  const ok = v.every((p, i) => floorPoint(c, p, `${path}[${i}]`));
  if (ok && area(v as FloorPoint[]) < 1e-6) c.add(path, 'graph', 'a polygon must enclose an area');
  return ok;
};

/** Structural validation of a runtime geometry resource on its own. */
export function validateRuntimeGeometry(raw: unknown): ValidationResult<RuntimeGeometryV3> {
  const c = new Issues();
  if (!closed(c, raw, '$', ['geometrySchemaVersion', 'geometryRevision', 'provenance', 'locations', 'cameras'])) return { ok: false, issues: c.list };
  if (raw.geometrySchemaVersion !== GEOMETRY_SCHEMA_VERSION) c.add('geometrySchemaVersion', 'version', 'unsupported geometry schema version');
  if (typeof raw.geometryRevision !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(raw.geometryRevision)) c.add('geometryRevision', 'version', 'expected an explicit revision');
  if (closed(c, raw.provenance, 'provenance', ['sourceRevision', 'adapterVersion', 'sourceHash'])) {
    const p = raw.provenance;
    if (typeof p.sourceRevision !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(p.sourceRevision)) c.add('provenance.sourceRevision', 'version', 'expected the Design source revision');
    if (typeof p.adapterVersion !== 'string' || !/^\d+\.\d+\.\d+(?:-[a-z0-9.]+)?$/.test(p.adapterVersion)) c.add('provenance.adapterVersion', 'version', 'expected a semver');
    if (typeof p.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(p.sourceHash)) c.add('provenance.sourceHash', 'text_format', 'expected the SHA-256 of the Design source');
  }

  const locs = Array.isArray(raw.locations) ? raw.locations : (c.add('locations', 'type', 'expected a list'), []);
  const seenLoc = new Set<string>();
  locs.forEach((l, i) => {
    const p = `locations[${i}]`;
    if (!closed(c, l, p, ['location', 'kitRevision', 'walkable', 'obstacles', 'occluders', 'portals', 'anchors', 'attachments'], ['seats'])) return;
    const loc = id(c, l.location, `${p}.location`);
    if (loc && seenLoc.has(loc)) c.add(`${p}.location`, 'duplicate_id', 'location geometry listed twice');
    if (loc) seenLoc.add(loc);
    if (typeof l.kitRevision !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(l.kitRevision)) c.add(`${p}.kitRevision`, 'version', 'expected an explicit kit revision');
    if (!Array.isArray(l.walkable) || l.walkable.length === 0) c.add(`${p}.walkable`, 'type', 'a location needs walkable floor');
    else
      l.walkable.forEach((w, j) => {
        if (!closed(c, w, `${p}.walkable[${j}]`, ['outer'], ['holes'])) return;
        polygon(c, w.outer, `${p}.walkable[${j}].outer`);
        if (w.holes !== undefined) (Array.isArray(w.holes) ? w.holes : (c.add(`${p}.walkable[${j}].holes`, 'type', 'expected a list'), [])).forEach((h, k) => polygon(c, h, `${p}.walkable[${j}].holes[${k}]`));
      });
    const obstacleIds = new Set<string>(Array.isArray(l.obstacles) ? l.obstacles.flatMap(o => (isRec(o) && typeof o.id === 'string' ? [o.id] : [])) : []);
    if (l.seats !== undefined) {
      const roles = new Set<string>();
      (Array.isArray(l.seats) ? l.seats : (c.add(`${p}.seats`, 'type', 'expected a list'), [])).forEach((q, j) => {
        if (!closed(c, q, `${p}.seats[${j}]`, ['role', 'obstacle'])) return;
        const role = id(c, q.role, `${p}.seats[${j}].role`);
        if (role && roles.has(role)) c.add(`${p}.seats[${j}].role`, 'duplicate_id', 'a seated role is declared once');
        if (role) roles.add(role);
        const ob = id(c, q.obstacle, `${p}.seats[${j}].obstacle`);
        if (ob && !obstacleIds.has(ob)) c.add(`${p}.seats[${j}].obstacle`, 'unknown_ref', 'a seat rests on an obstacle this location does not have');
      });
    }
    const ids = new Set<string>();
    const unique = (v: string | undefined, path: string) => {
      if (v && ids.has(v)) c.add(path, 'duplicate_id', 'id used twice in this location');
      if (v) ids.add(v);
    };
    (Array.isArray(l.obstacles) ? l.obstacles : (c.add(`${p}.obstacles`, 'type', 'expected a list'), [])).forEach((o, j) => {
      if (!closed(c, o, `${p}.obstacles[${j}]`, ['id', 'polygon'])) return;
      unique(id(c, o.id, `${p}.obstacles[${j}].id`), `${p}.obstacles[${j}].id`);
      polygon(c, o.polygon, `${p}.obstacles[${j}].polygon`);
    });
    (Array.isArray(l.occluders) ? l.occluders : (c.add(`${p}.occluders`, 'type', 'expected a list'), [])).forEach((o, j) => {
      if (!closed(c, o, `${p}.occluders[${j}]`, ['id', 'polygon', 'height', 'priority'])) return;
      unique(id(c, o.id, `${p}.occluders[${j}].id`), `${p}.occluders[${j}].id`);
      polygon(c, o.polygon, `${p}.occluders[${j}].polygon`);
      if (!fin(o.height) || o.height <= 0) c.add(`${p}.occluders[${j}].height`, 'type', 'expected a positive height');
      if (!Number.isInteger(o.priority)) c.add(`${p}.occluders[${j}].priority`, 'type', 'expected an integer priority');
    });
    (Array.isArray(l.portals) ? l.portals : (c.add(`${p}.portals`, 'type', 'expected a list'), [])).forEach((d, j) => {
      if (!closed(c, d, `${p}.portals[${j}]`, ['portal', 'a', 'b', 'facing'])) return;
      id(c, d.portal, `${p}.portals[${j}].portal`);
      if (floorPoint(c, d.a, `${p}.portals[${j}].a`) && floorPoint(c, d.b, `${p}.portals[${j}].b`) && d.a[0] === d.b[0] && d.a[1] === d.b[1]) c.add(`${p}.portals[${j}]`, 'graph', 'a door segment needs two distinct endpoints');
      id(c, d.facing, `${p}.portals[${j}].facing`);
    });
    (Array.isArray(l.anchors) ? l.anchors : (c.add(`${p}.anchors`, 'type', 'expected a list'), [])).forEach((a, j) => {
      if (!closed(c, a, `${p}.anchors[${j}]`, ['entity', 'root', 'height'], ['facing', 'surface'])) return;
      id(c, a.entity, `${p}.anchors[${j}].entity`);
      floorPoint(c, a.root, `${p}.anchors[${j}].root`);
      if (!fin(a.height) || a.height < 0) c.add(`${p}.anchors[${j}].height`, 'type', 'expected a non-negative height');
      if (a.facing !== undefined) id(c, a.facing, `${p}.anchors[${j}].facing`);
      if (a.surface !== undefined) {
        if (!Array.isArray(a.surface) || a.surface.length !== 4) c.add(`${p}.anchors[${j}].surface`, 'type', 'a surface has four corners');
        else a.surface.forEach((q, k) => point3(c, q, `${p}.anchors[${j}].surface[${k}]`, true));
      }
    });
    (Array.isArray(l.attachments) ? l.attachments : (c.add(`${p}.attachments`, 'type', 'expected a list'), [])).forEach((a, j) => {
      if (!closed(c, a, `${p}.attachments[${j}]`, ['id', 'entity', 'offset'])) return;
      unique(id(c, a.id, `${p}.attachments[${j}].id`), `${p}.attachments[${j}].id`);
      id(c, a.entity, `${p}.attachments[${j}].entity`);
      point3(c, a.offset, `${p}.attachments[${j}].offset`, false);
    });
  });

  const cams = Array.isArray(raw.cameras) ? raw.cameras : (c.add('cameras', 'type', 'expected a list'), []);
  const camIds = new Set<string>();
  cams.forEach((k, i) => {
    const p = `cameras[${i}]`;
    if (!closed(c, k, p, ['id', 'location', 'orientation', 'viewport', 'projection', 'safe'])) return;
    const cid = id(c, k.id, `${p}.id`);
    if (cid && camIds.has(cid)) c.add(`${p}.id`, 'duplicate_id', 'camera recipe listed twice');
    if (cid) camIds.add(cid);
    const loc = id(c, k.location, `${p}.location`);
    if (loc && !seenLoc.has(loc)) c.add(`${p}.location`, 'unknown_ref', 'camera over a location with no geometry');
    if (k.orientation !== 'landscape' && k.orientation !== 'portrait') c.add(`${p}.orientation`, 'enum', 'expected landscape or portrait');
    let vw = 0;
    let vh = 0;
    if (closed(c, k.viewport, `${p}.viewport`, ['width', 'height'])) {
      vw = k.viewport.width as number;
      vh = k.viewport.height as number;
      if (!fin(vw) || !fin(vh) || vw <= 0 || vh <= 0) c.add(`${p}.viewport`, 'type', 'expected a positive reference viewport');
    }
    if (closed(c, k.projection, `${p}.projection`, ['cx', 'hy', 'fx', 'fy', 'camX', 'camY', 'eye'])) {
      const q = k.projection;
      if (!Object.values(q).every(fin)) c.add(`${p}.projection`, 'type', 'projection coefficients must be finite');
      else if (q.fx === 0 || q.fy === 0) c.add(`${p}.projection`, 'graph', 'a degenerate projection (zero focal length)');
    }
    if (closed(c, k.safe, `${p}.safe`, ['x', 'y', 'width', 'height'])) {
      const s = k.safe as Record<string, number>;
      if (![s.x, s.y, s.width, s.height].every(fin) || s.width <= 0 || s.height <= 0 || s.x < 0 || s.y < 0 || s.x + s.width > vw || s.y + s.height > vh) c.add(`${p}.safe`, 'graph', 'the safe region must lie inside the reference viewport');
    }
  });
  return c.list.length ? { ok: false, issues: c.list } : { ok: true, value: raw as unknown as RuntimeGeometryV3, issues: [] };
}

/**
 * Cross-check a structurally valid geometry resource against the manifest it serves. This is what keeps one
 * coordinate authority.
 *
 * Each compiled scene is validated against the camera recipe IT selects, never against every camera of its
 * location (portrait, second framings and private-request framings are per-scene choices):
 *   - the recipe exists and belongs to the scene's location;
 *   - every mark the scene carries must project through that camera (not at or behind its plane) and lie in its
 *     safe region. A mark a framing does not show is therefore not carried by the scene that uses that framing;
 *   - every mark is standable, except a named seated mark, which may rest on its declared supporting obstacle;
 *   - every route point is standable, except that a route may begin or end on a seated mark's seat.
 * Cameras no scene selects stay in the resource and are checked structurally only. Anchors are staging roots:
 * each must be visible in at least one camera some scene of its location selects. Every kit/recipe must exist,
 * every reversible door needs its anchors on both sides and every anchor and attachment names a real entity.
 */
export function validateGeometryForManifest(geo: RuntimeGeometryV3, m: PlaybackManifestV3): ValidationResult<RuntimeGeometryV3> {
  const c = new Issues();
  const byLoc = new Map(geo.locations.map(l => [l.location, l] as const));
  const byCam = new Map(geo.cameras.map(k => [k.id, k] as const));
  const entityIds = new Set(m.initialEntities.map(e => e.id));
  const inSafe = (k: CameraGeometry, x: number, y: number, h: number) => {
    const s = projectPoint(k, x, y, h);
    return !!s && s.sx >= k.safe.x && s.sx <= k.safe.x + k.safe.width && s.sy >= k.safe.y && s.sy <= k.safe.y + k.safe.height;
  };
  const SAME = 1e-6;
  const same = (a: readonly number[], b: readonly number[]) => Math.abs(a[0] - b[0]) <= SAME && Math.abs(a[1] - b[1]) <= SAME;

  /** The supporting obstacle of a seated role in a location, if Design declared one. */
  const seatOf = (g: LocationGeometry, role: string) => g.seats?.find(q => q.role === role)?.obstacle;
  // Seated points that actually rest on their seat, by location: the only points a route may start from or end on inside an obstacle.
  const seated = new Map<string, Array<{ at: FloorPoint; obstacle: string }>>();
  for (const cs of m.compiledScenes) {
    const g = byLoc.get(cs.location);
    if (!g) continue;
    for (const [role, mk] of Object.entries(cs.marks ?? {})) {
      const obstacle = seatOf(g, role);
      if (obstacle && seatedStandable(g, [mk.x, mk.y], obstacle)) seated.set(cs.location, [...(seated.get(cs.location) ?? []), { at: [mk.x, mk.y], obstacle }]);
    }
  }

  const selected = new Map<string, Map<string, CameraGeometry>>();
  for (const cs of m.compiledScenes) {
    const p = `compiledScenes.${cs.id}`;
    const g = byLoc.get(cs.location);
    if (!g) {
      c.add(p, 'unknown_ref', 'no geometry for this scene\'s location');
      continue;
    }
    if (g.kitRevision !== cs.kitRevision) c.add(`${p}.kitRevision`, 'version', 'scene and geometry kit revisions differ');
    const cam = byCam.get(cs.cameraRecipe);
    let framing: CameraGeometry | undefined;
    if (!cam) c.add(`${p}.cameraRecipe`, 'unknown_ref', 'no compiled camera for this recipe');
    else if (cam.location !== cs.location) c.add(`${p}.cameraRecipe`, 'graph', 'camera belongs to another location');
    else {
      framing = cam;
      selected.set(cs.location, (selected.get(cs.location) ?? new Map()).set(cam.id, cam));
    }
    const marks: Array<[string, SpatialMark, string | undefined]> = [
      ...(cs.entryMark ? [['entryMark', cs.entryMark, undefined] as [string, SpatialMark, undefined]] : []),
      ...Object.entries(cs.marks ?? {}).map(([name, mk]) => [`marks.${name}`, mk, seatOf(g, name)] as [string, SpatialMark, string | undefined]),
    ];
    for (const [name, mk, seat] of marks) {
      const where = name === 'entryMark' ? `${p}.entryMark` : `${p}.${name}`;
      if (seat) {
        if (!seatedStandable(g, [mk.x, mk.y], seat)) c.add(where, 'unreachable', `seated mark is not on its declared seat ${seat} (on walkable floor, clear of every other obstacle)`);
      } else if (!standable(g, [mk.x, mk.y])) c.add(where, 'unreachable', 'mark is not on walkable floor clear of obstacles');
      if (!framing) continue;
      if (!projectPoint(framing, mk.x, mk.y, 0)) c.add(where, 'graph', `mark is at or behind the plane of camera ${framing.id}`);
      else if (!inSafe(framing, mk.x, mk.y, 0)) c.add(where, 'graph', `mark falls outside the safe region of camera ${framing.id}`);
    }
    for (const [route, pts] of Object.entries(cs.routes ?? {}))
      pts.forEach((q, i) => {
        const pt = q as FloorPoint;
        if (standable(g, pt)) return;
        // A route may begin or end on the seat of a declared seated mark; its interior never leaves walkable floor.
        const onSeat = (i === 0 || i === pts.length - 1) && (seated.get(cs.location) ?? []).some(s => same(s.at, pt));
        if (!onSeat) c.add(`${p}.routes.${route}[${i}]`, 'unreachable', 'route point is not on walkable floor');
      });
  }
  for (const port of m.portals) {
    if (port.kind !== 'excursion') continue; // a spine cut has no door; a reversible door needs both sides
    for (const side of [port.from, port.to]) if (!byLoc.get(side)?.portals.some(a => a.portal === port.id)) c.add(`portals.${port.id}`, 'unreachable', `no door anchor in ${side}`);
  }
  for (const g of geo.locations) {
    const cams = [...(selected.get(g.location)?.values() ?? [])];
    for (const a of g.anchors) {
      if (!entityIds.has(a.entity)) c.add(`locations.${g.location}.anchors.${a.entity}`, 'unknown_ref', 'anchor for an entity the manifest does not have');
      if (cams.length && !cams.some(k => inSafe(k, a.root[0], a.root[1], a.height))) c.add(`locations.${g.location}.anchors.${a.entity}`, 'graph', 'anchor is outside the safe region of every camera a scene of this location selects');
    }
    for (const a of g.attachments) if (!entityIds.has(a.entity)) c.add(`locations.${g.location}.attachments.${a.id}`, 'unknown_ref', 'attachment on an unknown entity');
    for (const d of g.portals) if (!m.portals.some(p => p.id === d.portal && (p.from === g.location || p.to === g.location))) c.add(`locations.${g.location}.portals.${d.portal}`, 'unknown_ref', 'door anchor for a portal that does not touch this location');
  }
  return c.list.length ? { ok: false, issues: c.list } : { ok: true, value: geo, issues: [] };
}
