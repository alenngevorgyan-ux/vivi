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
 * yaw, a behind-camera point or a degenerate camera is an error. It contains no
 * story values; Design owns the numbers and the build script that calls this.
 *
 * Outputs are the runtime geometry resource and, separately, each location's
 * named marks. The marks go into the manifest's compiled scenes (the one
 * runtime mark authority) through the deterministic compile step; they are not
 * duplicated in the resource.
 */

import type { SpatialMark } from '../contracts/manifest.ts';
import { GEOMETRY_SCHEMA_VERSION, type CameraGeometry, type FloorPoint, type LocationGeometry, type Point3, type RuntimeGeometryV3 } from '../contracts/geometry.ts';

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
  marks: Record<string, { at: SourceFloor; yaw: number }>;
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
    return {
      location: l.location,
      kitRevision: l.kitRevision,
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
    // The camera stands in front of the floor it frames: every floor depth must be in front of it.
    if (!(k.cam[2] < zMin)) fail(`camera ${k.id}: the floor is not entirely in front of the camera`);
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
  };
}
