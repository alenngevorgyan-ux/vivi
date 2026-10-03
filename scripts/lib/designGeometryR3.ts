import type { DesignCameraSource, DesignGeometrySource, DesignLocationSource, SourceFloor } from '../../src/engine/v3/geometry/designAdapter.ts';

/**
 * Test-support reader for Design's PUBLISHED geometry schema (`correction-geo-r3`, `geometry/source.json`).
 *
 * Design publishes a different shape from the adapter's input (dictionaries keyed by name, per-location camera
 * recipes, corner-pair safe regions, `hero_anchors`, `actors`). This module is the structural mapping the B02
 * compatibility test needs, and nothing more: it is NOT the production build script (Design owns that, with the
 * Phase B renaming and id mapping). It maps only what the B02 contract validates, and lists everything it does not
 * map in `unmapped`, so a gap is visible and asserted, never silently dropped.
 *
 * Choices the source does not publish are fixed here and named, not hidden:
 *   - location/portal/camera ids are lowercased identifiers (`correction.open_plan` → `correction_open_plan`,
 *     `P0` → `p0`, route `desk_to_P0` → `desk_to_p0`, recipe `portrait_east` → `correction_meeting_room__portrait_east`);
 *   - `heightScale` is the location's declared `ceiling`;
 *   - `kitRevision` is the source revision (no separate kit revision is published);
 *   - the approved-facing table is every distinct yaw the source uses (no approved table is published);
 *   - a portal's yaw is the direction from `threshold_inside` to `threshold_outside`;
 *   - actors are anchored at their floor root with height 0 (no actor height is published);
 *   - `title_safe` is a corner pair `[x0, y0, x1, y1]` (margins are symmetric in the frame).
 * Posture is read literally: `hero_anchors[*].posture` is `stand` or `seat`, and a seat names its obstacle.
 */

export class DesignSchemaError extends Error {}
const fail = (m: string): never => {
  throw new DesignSchemaError(m);
};

type Rec = Record<string, unknown>;
const rec = (v: unknown, what: string): Rec => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Rec) : fail(`${what}: expected an object`));
const arr = (v: unknown, what: string): unknown[] => (Array.isArray(v) ? v : fail(`${what}: expected a list`));
const num = (v: unknown, what: string): number => (typeof v === 'number' && Number.isFinite(v) ? v : fail(`${what}: expected a finite number`));
const str = (v: unknown, what: string): string => (typeof v === 'string' && v ? v : fail(`${what}: expected a string`));
const pair = (v: unknown, what: string): SourceFloor => {
  const a = arr(v, what);
  return a.length === 2 ? [num(a[0], `${what}[0]`), num(a[1], `${what}[1]`)] : fail(`${what}: expected [x, z]`);
};
const poly = (v: unknown, what: string): SourceFloor[] => arr(v, what).map((p, i) => pair(p, `${what}[${i}]`));

export const slug = (id: string) => id.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
const yawFacing = (yaw: number) => `yaw_${yaw < 0 ? 'm' : 'p'}${String(Math.abs(yaw)).replace('.', '_')}`;

export interface DesignBeat {
  beat: string;
  location: string;
  heroAnchors: string[];
  camera?: string;
  cameraPortrait?: string;
  attention: unknown[];
}

export interface R3Reading {
  source: DesignGeometrySource;
  /** raw location id → runtime location id. */
  locationIds: Record<string, string>;
  /** `<runtime location>/<recipe>` → runtime camera id. */
  cameraIds: Record<string, string>;
  beats: DesignBeat[];
  /** Everything in the published file that this reader does not map, as `<location>.<key>` paths. Asserted by the test. */
  unmapped: string[];
}

export function readDesignGeometryR3(raw: unknown): R3Reading {
  const root = rec(raw, 'source');
  const revision = str(root.revision, 'revision');
  const locs = rec(root.locations, 'locations');
  const unmapped: string[] = [];
  const yaws = new Set<number>();
  const locationIds: Record<string, string> = {};
  const cameraIds: Record<string, string> = {};
  const cameras: DesignCameraSource[] = [];

  const locations: DesignLocationSource[] = Object.entries(locs).map(([rawId, v]) => {
    const l = rec(v, rawId);
    const location = (locationIds[rawId] = slug(str(l.id, `${rawId}.id`)));
    const b = rec(l.bounds, `${rawId}.bounds`);
    const bounds = { xMin: num(b.xMin, 'xMin'), xMax: num(b.xMax, 'xMax'), zMin: num(b.zMin, 'zMin'), zMax: num(b.zMax, 'zMax') };
    const yaw = (value: unknown, what: string) => {
      const y = num(value, what);
      yaws.add(y);
      return y;
    };

    const marks: DesignLocationSource['marks'] = {};
    for (const [role, a] of Object.entries(rec(l.hero_anchors, `${rawId}.hero_anchors`))) {
      const h = rec(a, `${rawId}.hero_anchors.${role}`);
      const posture = h.posture;
      if (posture !== 'stand' && posture !== 'seat') fail(`${rawId}.hero_anchors.${role}: unknown posture`);
      marks[role] = { at: pair(h.root, `${rawId}.hero_anchors.${role}.root`), yaw: yaw(h.yaw, `${rawId}.hero_anchors.${role}.yaw`), posture: posture as 'stand' | 'seat', ...(h.seat !== undefined ? { seat: str(h.seat, `${rawId}.hero_anchors.${role}.seat`) } : {}) };
    }

    const portals = Object.entries(rec(l.portals, `${rawId}.portals`)).map(([pid, p]) => {
      const q = rec(p, `${rawId}.portals.${pid}`);
      const [a, c] = arr(q.segment, `${rawId}.portals.${pid}.segment`);
      const inside = pair(q.threshold_inside, `${rawId}.portals.${pid}.threshold_inside`);
      const outside = pair(q.threshold_outside, `${rawId}.portals.${pid}.threshold_outside`);
      // yaw 0 faces south (-z), 90 east (+x), 180 north (+z), -90 west (-x).
      const deg = (Math.atan2(outside[0] - inside[0], -(outside[1] - inside[1])) * 180) / Math.PI;
      return { portal: slug(pid), a: pair(a, 'segment[0]'), b: pair(c, 'segment[1]'), yaw: yaw(Math.round(deg * 1e6) / 1e6, `${rawId}.portals.${pid}.yaw`) };
    });

    const anchors = Object.entries(rec(l.actors, `${rawId}.actors`)).map(([entity, a]) => {
      const q = rec(a, `${rawId}.actors.${entity}`);
      return { entity: slug(entity), root: pair(q.root, `${rawId}.actors.${entity}.root`), height: 0, yaw: yaw(q.yaw, `${rawId}.actors.${entity}.yaw`) };
    });

    const frameSafe = rec(l.camera_safe, `${rawId}.camera_safe`);
    for (const [recipe, c] of Object.entries(rec(l.cameras, `${rawId}.cameras`))) {
      const k = rec(c, `${rawId}.cameras.${recipe}`);
      const frame = arr(k.frame, 'frame').map((n, i) => num(n, `frame[${i}]`));
      const principal = arr(k.principal, 'principal').map((n, i) => num(n, `principal[${i}]`));
      const position = arr(k.position, 'position').map((n, i) => num(n, `position[${i}]`));
      if (frame.length !== 2 || principal.length !== 2 || position.length !== 3) fail(`${rawId}.cameras.${recipe}: malformed frame/principal/position`);
      const orientation = frame[0] < frame[1] ? 'portrait' : 'landscape';
      const safeKey = orientation === 'portrait' ? 'portrait' : 'desktop'; // camera_safe is keyed desktop | portrait
      const ts = arr(rec(frameSafe[safeKey], `${rawId}.camera_safe.${safeKey}`).title_safe, 'title_safe').map((n, i) => num(n, `title_safe[${i}]`));
      if (ts.length !== 4) fail(`${rawId}.camera_safe.${safeKey}.title_safe: expected 4 numbers`);
      const id = (cameraIds[`${location}/${recipe}`] = `${location}__${slug(recipe)}`);
      cameras.push({
        id,
        location,
        orientation,
        viewport: { width: frame[0], height: frame[1] },
        cx: principal[0],
        hy: principal[1],
        f: num(k.focal_px, `${rawId}.cameras.${recipe}.focal_px`),
        cam: [position[0], position[1], position[2]],
        safe: { x: ts[0], y: ts[1], width: ts[2] - ts[0], height: ts[3] - ts[1] },
      });
    }

    for (const key of ['occluders', 'display_surfaces', 'objects', 'attachments', 'walls', 'see_through']) if (key in l) unmapped.push(`${location}.${key}`);
    return {
      location,
      kitRevision: revision,
      bounds,
      heightScale: num(b.ceiling, `${rawId}.bounds.ceiling`),
      marks,
      routes: Object.fromEntries(Object.entries(rec(l.routes, `${rawId}.routes`)).map(([name, pts]) => [slug(name), poly(pts, `${rawId}.routes.${name}`)])),
      walkable: arr(l.walkable, `${rawId}.walkable`).map((w, i) => ({ outer: poly(w, `${rawId}.walkable[${i}]`) })),
      obstacles: Object.entries(rec(l.obstacles, `${rawId}.obstacles`)).map(([id, o]) => ({ id, polygon: poly(rec(o, `${rawId}.obstacles.${id}`).poly, `${rawId}.obstacles.${id}.poly`) })),
      occluders: [],
      portals,
      anchors,
      attachments: [],
    };
  });

  const beats: DesignBeat[] = arr(root.beats, 'beats').map((x, i) => {
    const b = rec(x, `beats[${i}]`);
    const anchor = typeof b.hero_anchor === 'string' ? b.hero_anchor : '';
    return {
      beat: str(b.beat, `beats[${i}].beat`),
      location: slug(str(b.location, `beats[${i}].location`)),
      heroAnchors: anchor ? anchor.split('|').map(a => a.trim()) : [],
      ...(typeof b.camera === 'string' ? { camera: b.camera } : {}),
      ...(typeof b.camera_portrait === 'string' ? { cameraPortrait: b.camera_portrait } : {}),
      attention: Array.isArray(b.attention) ? b.attention : [],
    };
  });

  return {
    source: {
      designSchemaVersion: 1,
      sourceRevision: revision,
      facings: [...yaws].sort((a, b) => a - b).map(yaw => ({ yaw, facing: yawFacing(yaw) })),
      locations,
      cameras,
    },
    locationIds,
    cameraIds,
    beats,
    unmapped: unmapped.sort(),
  };
}
