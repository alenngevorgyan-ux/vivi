/**
 * Deterministic build-time adapter: Design source geometry → normalized runtime geometry.
 *
 * Design publishes one fixed, versioned, location-local frame per location:
 * origin at the declared near-left floor bound; source x right, y up (height),
 * z depth into the room; metres. This module applies ONE affine mapping to
 * every point (final integration review §1):
 *
 *   runtime.x = 100 * (source.x - xMin) / (xMax - xMin)
 *   runtime.y = 100 * (source.z - zMin) / (zMax - zMin)
 *   runtime.h = source.y / heightScale
 *
 * and compiles each source perspective camera into normalized coefficients.
 * It never clamps: a source point outside its declared bounds, an unapproved
 * yaw, a seated mark that is not on its declared seat, or a degenerate or
 * non-finite camera is an error. A camera may stand inside the location's
 * bounds (an interior camera): nothing here requires the whole floor to be in
 * front of it. Whether a given point is in front of the camera a scene selects is
 * decided per point at projection time (`projectPoint`) and per scene by
 * `validateGeometryForManifest`. It contains no story values; Design owns the
 * numbers and the build script that calls this.
 *
 * Outputs are the runtime geometry resource and, separately, each location's
 * named marks and routes. They go into the manifest's compiled scenes (the one
 * runtime coordinate authority) through the deterministic compile step; they
 * are not duplicated in the resource.
 */

import type { SpatialMark } from '../contracts/manifest.ts';
import { GEOMETRY_SCHEMA_VERSION, pointInPolygon, type CameraGeometry, type FloorPoint, type LocationGeometry, type Point3, type RuntimeGeometryV3, type SeatDeclaration } from '../contracts/geometry.ts';

/** [x, z] on the floor, metres. */
export type SourceFloor = [number, number];
/** [x, y(height), z], metres. */
export type SourcePoint = [number, number, number];

export interface DesignLocationSource {
  location: string;
  kitRevision: string;
  bounds: { xMin: number; xMax: number; zMin: number; zMax: number };
  /** Metres per normalized height unit. */
  heightScale: number;
  /**
   * Named hero marks. `posture: 'seat'` is Design's explicit statement that the mark is a seated position and
   * `seat` names the obstacle (of this location) that supports it; a mark without a posture is standing.
   */
  marks: Record<string, { at: SourceFloor; yaw: number; posture?: 'stand' | 'seat'; seat?: string }>;
  /** Named hero routes (floor polylines). Normalized by the same mapping as every other point; they go into the compiled scenes beside the marks. */
  routes?: Record<string, SourceFloor[]>;
  walkable: Array<{ outer: SourceFloor[]; holes?: SourceFloor[][] }>;
  /** Collision footprints, already inflated by the approved hero radius. */
  obstacles: Array<{ id: string; polygon: SourceFloor[] }>;
  occluders: Array<{ id: string; polygon: SourceFloor[]; height: number; priority: number }>;
  portals: Array<{ portal: string; a: SourceFloor; b: SourceFloor; yaw: number }>;
  anchors: Array<{ entity: string; root: SourceFloor; height: number; yaw?: number; surface?: [SourcePoint, SourcePoint, SourcePoint, SourcePoint] }>;
  attachments: Array<{ id: string; entity: string; offset: SourcePoint }>;
}

export interface DesignCameraSource {
  id: string;
  location: string;
  orientation: 'landscape' | 'portrait';
  viewport: { width: number; height: number };
  /** Source perspective: screenX = cx + f (x - cam.x)/(z - cam.z); screenY = hy + f (cam.y - y)/(z - cam.z). */
  cx: number;
  hy: number;
  f: number;
  cam: SourcePoint;
  safe: { x: number; y: number; width: number; height: number };
}

export interface DesignGeometrySource {
  designSchemaVersion: 1;
  sourceRevision: string;
  /** Approved facings: source yaw 0 faces the camera (-z), 90 faces +x, 180 faces +z. */
  facings: Array<{ yaw: number; facing: string }>;
  locations: DesignLocationSource[];
  cameras: DesignCameraSource[];
}

export interface AdaptedGeometry {
  geometry: RuntimeGeometryV3;
  /** Named marks per location, for the manifest's compiled scenes. */
  marks: Record<string, Record<string, SpatialMark>>;
  /** Named routes per location (normalized floor polylines), for the manifest's compiled scenes. */
  routes: Record<string, Record<string, Array<[number, number]>>>;
}

export class GeometryAdapterError extends Error {}
const fail = (msg: string): never => {
  throw new GeometryAdapterError(msg);
};

export function adaptDesignGeometry(src: DesignGeometrySource, o: { geometryRevision: string; adapterVersion: string; sourceHash: string; precision?: number }): AdaptedGeometry {
  if (src.designSchemaVersion !== 1) fail('unsupported Design geometry schema');
  const digits = o.precision ?? 3;
  // Round only the serialized output, to a declared precision; never to move a point into range.
  const round = (n: number) => Number(n.toFixed(digits));
  const facing = (yaw: number) => src.facings.find(f => f.yaw === yaw)?.facing ?? fail(`yaw ${yaw} is not an approved facing`);

  const frames = new Map(src.locations.map(l => [l.location, l] as const));
  const marks: AdaptedGeometry['marks'] = {};
  const routes: AdaptedGeometry['routes'] = {};

  const locations: LocationGeometry[] = src.locations.map(l => {
    const { xMin, xMax, zMin, zMax } = l.bounds;
    const w = xMax - xMin;
    const d = zMax - zMin;
    if (!(w > 0) || !(d > 0) || !(l.heightScale > 0)) fail(`${l.location}: degenerate bounds or height scale`);
    const floor = ([x, z]: SourceFloor, what: string): FloorPoint => {
      if (!Number.isFinite(x) || !Number.isFinite(z) || x < xMin || x > xMax || z < zMin || z > zMax) fail(`${l.location}: ${what} lies outside the declared floor bounds`);
      return [round((100 * (x - xMin)) / w), round((100 * (z - zMin)) / d)];
    };
    const height = (y: number, what: string) => (Number.isFinite(y) && y >= 0 ? round(y / l.heightScale) : fail(`${l.location}: ${what} has an invalid height`));
    const point = ([x, y, z]: SourcePoint, what: string): Point3 => [...floor([x, z], what), height(y, what)];
    const poly = (ps: SourceFloor[], what: string) => ps.map((p, i) => floor(p, `${what}[${i}]`));

    marks[l.location] = Object.fromEntries(Object.entries(l.marks).map(([role, mk]) => {
      const [x, y] = floor(mk.at, `mark ${role}`);
      return [role, { x, y, facing: facing(mk.yaw) }];
    }));
    routes[l.location] = Object.fromEntries(Object.entries(l.routes ?? {}).map(([name, pts]) => [name, pts.map((q, i) => floor(q, `route ${name}[${i}]`))]));
    // Seated marks: an explicit posture and supporting obstacle, never inferred from a mark's name or position.
    const seats: SeatDeclaration[] = [];
    for (const [role, mk] of Object.entries(l.marks)) {
      if (mk.posture !== undefined && mk.posture !== 'stand' && mk.posture !== 'seat') fail(`${l.location}: mark ${role} has an unknown posture`);
      if (mk.posture !== 'seat') {
        if (mk.seat !== undefined) fail(`${l.location}: mark ${role} names a seat but is not seated`);
        continue;
      }
      const seat = l.obstacles.find(ob => ob.id === mk.seat) ?? fail(`${l.location}: seated mark ${role} names no obstacle of this location as its seat`);
      if (!pointInPolygon(mk.at, seat.polygon)) fail(`${l.location}: seated mark ${role} is not on its declared seat ${seat.id}`);
      seats.push({ role, obstacle: seat.id });
    }
    return {
      location: l.location,
      kitRevision: l.kitRevision,
      ...(seats.length ? { seats } : {}),
      walkable: l.walkable.map((wk, i) => ({ outer: poly(wk.outer, `walkable[${i}]`), ...(wk.holes ? { holes: wk.holes.map((h, j) => poly(h, `walkable[${i}].holes[${j}]`)) } : {}) })),
      obstacles: l.obstacles.map(ob => ({ id: ob.id, polygon: poly(ob.polygon, `obstacle ${ob.id}`) })),
      occluders: l.occluders.map(oc => ({ id: oc.id, polygon: poly(oc.polygon, `occluder ${oc.id}`), height: height(oc.height, `occluder ${oc.id}`), priority: oc.priority })),
      portals: l.portals.map(p => ({ portal: p.portal, a: floor(p.a, `door ${p.portal}`), b: floor(p.b, `door ${p.portal}`), facing: facing(p.yaw) })),
      anchors: l.anchors.map(a => ({
        entity: a.entity,
        root: floor(a.root, `anchor ${a.entity}`),
        height: height(a.height, `anchor ${a.entity}`),
        ...(a.yaw !== undefined ? { facing: facing(a.yaw) } : {}),
        ...(a.surface ? { surface: a.surface.map((q, i) => point(q, `surface ${a.entity}[${i}]`)) as LocationGeometry['anchors'][number]['surface'] } : {}),
      })),
      // Offsets are deltas: scaled, not translated, and not bounded to the floor.
      attachments: l.attachments.map(a => ({ id: a.id, entity: a.entity, offset: [round((100 * a.offset[0]) / w), round((100 * a.offset[2]) / d), round(a.offset[1] / l.heightScale)] as Point3 })),
    };
  });

  const cameras: CameraGeometry[] = src.cameras.map(k => {
    const l = frames.get(k.location) ?? fail(`camera ${k.id}: unknown location ${k.location}`);
    const { xMin, xMax, zMin, zMax } = l.bounds;
    const w = xMax - xMin;
    const d = zMax - zMin;
    if (!Number.isFinite(k.f) || k.f === 0) fail(`camera ${k.id}: degenerate focal length`);
    // Finite coefficients only. The camera may stand anywhere, including inside the floor bounds: a point at or
    // behind its plane simply has no projection, and scenes are validated against the camera they select.
    const finiteAll = (...ns: number[]) => ns.every(Number.isFinite);
    if (!Array.isArray(k.cam) || k.cam.length !== 3 || !finiteAll(...k.cam) || !finiteAll(k.cx, k.hy, k.viewport.width, k.viewport.height, k.safe.x, k.safe.y, k.safe.width, k.safe.height)) fail(`camera ${k.id}: non-finite camera coefficients`);
    return {
      id: k.id,
      location: k.location,
      orientation: k.orientation,
      viewport: { ...k.viewport },
      projection: {
        cx: k.cx,
        hy: k.hy,
        fx: (k.f * w) / d,
        fy: (k.f * l.heightScale * 100) / d,
        camX: (100 * (k.cam[0] - xMin)) / w,
        camY: (100 * (k.cam[2] - zMin)) / d,
        eye: k.cam[1] / l.heightScale,
      },
      safe: { ...k.safe },
    };
  });

  return {
    geometry: {
      geometrySchemaVersion: GEOMETRY_SCHEMA_VERSION,
      geometryRevision: o.geometryRevision,
      provenance: { sourceRevision: src.sourceRevision, adapterVersion: o.adapterVersion, sourceHash: o.sourceHash },
      locations,
      cameras,
    },
    marks,
    routes,
  };
}
