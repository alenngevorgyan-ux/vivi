/**
 * The renderer's one projection: normalized runtime geometry → CSS pixels of a stage box, and back.
 *
 * A compiled camera projects into its recipe's reference viewport (e.g. 1920×1080). The stage fits that viewport
 * into its box, either `contain` (letterboxed, landscape) or `band` (full width, a vertical band of the frame
 * chosen around a focus, portrait). Every layer — plates, islands, surfaces, figures, occluder cut-outs, anchored
 * controls and pointer hit tests — goes through the same `Fit`, so nothing can drift from anything else.
 *
 * Pure maths, no DOM. Positions come from the snapshot (hero, actors) and the compiled scene/resource; this module
 * only presents them. Hit testing reverses the CSS fit, then the camera (`unprojectFloor`), and reads legality from
 * the compiled collision footprints (already inflated by the hero radius at build time: never inflated again).
 */

import { projectPoint, standable, unprojectFloor, type CameraGeometry, type FloorPoint, type LocationGeometry, type Point3 } from '../../../engine/v3/contracts/geometry.ts';

export interface Fit {
  cam: CameraGeometry;
  /** CSS px per reference px. */
  scale: number;
  /** Where reference (0, 0) lands in the stage box, CSS px. */
  offX: number;
  offY: number;
  box: { w: number; h: number };
}

export type FitMode = { kind: 'contain' } | { kind: 'band'; focusY?: number };

export function fitCamera(cam: CameraGeometry, box: { w: number; h: number }, mode: FitMode): Fit {
  const { width: vw, height: vh } = cam.viewport;
  if (mode.kind === 'contain' || box.w <= 0 || box.h <= 0) {
    const scale = Math.max(1e-6, Math.min(box.w / vw, box.h / vh) || 0);
    return { cam, scale, offX: (box.w - vw * scale) / 2, offY: (box.h - vh * scale) / 2, box };
  }
  // Band: full width; show the vertical band of the frame centred on the focus, never past the frame's edges.
  const scale = box.w / vw;
  const visible = box.h / scale;
  if (visible >= vh) return { cam, scale, offX: 0, offY: (box.h - vh * scale) / 2, box };
  const focus = mode.focusY ?? cam.projection.hy;
  const top = Math.min(vh - visible, Math.max(0, focus - visible / 2));
  return { cam, scale, offX: 0, offY: -top * scale, box };
}

/** Reference px → stage CSS px. */
export const refToStage = (f: Fit, sx: number, sy: number) => ({ x: f.offX + sx * f.scale, y: f.offY + sy * f.scale });
/** Stage CSS px → reference px. */
export const stageToRef = (f: Fit, x: number, y: number) => ({ sx: (x - f.offX) / f.scale, sy: (y - f.offY) / f.scale });

/** A normalized point on the stage, or undefined at/behind the camera plane. */
export function toStage(f: Fit, x: number, y: number, h = 0): { x: number; y: number } | undefined {
  const p = projectPoint(f.cam, x, y, h);
  return p ? refToStage(f, p.sx, p.sy) : undefined;
}

/** Pointer (stage CSS px) → floor point, by reversing the fit and then the camera. */
export function stageToFloor(f: Fit, x: number, y: number): FloorPoint | undefined {
  const r = stageToRef(f, x, y);
  return unprojectFloor(f.cam, r.sx, r.sy);
}

/**
 * The screen box of an upright body standing at (x, y): feet centre, pixel height and width, depth.
 * `heightU` in the location's normalized height units, `widthU` in floor x units.
 */
export function bodyBox(f: Fit, x: number, y: number, heightU: number, widthU: number): { cx: number; feet: number; height: number; width: number; depth: number } | undefined {
  const feet = toStage(f, x, y, 0);
  const head = toStage(f, x, y, heightU);
  const side = toStage(f, x + widthU, y, 0);
  if (!feet || !head || !side) return undefined;
  return { cx: feet.x, feet: feet.y, height: feet.y - head.y, width: Math.abs(side.x - feet.x), depth: y - f.cam.projection.camY };
}

/** Axis-aligned stage rectangle of a display surface (planes facing an unrotated camera project to rectangles). */
export function surfaceRect(f: Fit, corners: readonly Point3[]): { left: number; top: number; width: number; height: number } | undefined {
  const pts = corners.map(c => toStage(f, c[0], c[1], c[2]));
  if (pts.some(p => !p)) return undefined;
  const xs = pts.map(p => p!.x);
  const ys = pts.map(p => p!.y);
  return { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

/** Convex hull (monotone chain) of stage points. */
export function hull(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: typeof p = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: typeof p = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Screen silhouette of an occluder (its footprint extruded to its height), or undefined if any part is behind the camera. */
export function occluderSilhouette(f: Fit, polygon: readonly FloorPoint[], height: number): Array<{ x: number; y: number }> | undefined {
  const pts: Array<{ x: number; y: number }> = [];
  for (const [x, y] of polygon)
    for (const h of [0, height]) {
      const s = toStage(f, x, y, h);
      if (!s) return undefined;
      pts.push(s);
    }
  return hull(pts);
}

/** Nearest depth of an occluder's footprint (smaller = nearer the camera). */
export const nearDepth = (polygon: readonly FloorPoint[]) => Math.min(...polygon.map(p => p[1]));

/** Is a floor point somewhere the hero may stand (walkable, clear of the inflated footprints)? */
export const legalFloor = (g: LocationGeometry, p: FloorPoint) => standable(g, p);

/** Point along a polyline at fraction t (by length). */
export function along(path: ReadonlyArray<readonly [number, number]>, t: number, scaleX = 1, scaleY = 1): { x: number; y: number; heading: number } {
  if (path.length === 1) return { x: path[0][0], y: path[0][1], heading: 0 };
  const seg = path.slice(1).map((q, i) => Math.hypot((q[0] - path[i][0]) * scaleX, (q[1] - path[i][1]) * scaleY));
  const total = seg.reduce((a, b) => a + b, 0) || 1;
  let d = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < seg.length; i++) {
    const [a, b] = [path[i], path[i + 1]];
    if (d <= seg[i] || i === seg.length - 1) {
      const u = seg[i] ? Math.min(1, d / seg[i]) : 1;
      return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, heading: Math.sign(b[0] - a[0]) };
    }
    d -= seg[i];
  }
  const last = path[path.length - 1];
  return { x: last[0], y: last[1], heading: 0 };
}

/** Length of a normalized polyline in metres. */
export const pathMetres = (path: ReadonlyArray<readonly [number, number]>, widthM: number, depthM: number) =>
  path.slice(1).reduce((s, q, i) => s + Math.hypot(((q[0] - path[i][0]) * widthM) / 100, ((q[1] - path[i][1]) * depthM) / 100), 0);

/** Approved facing id → yaw degrees (`yaw_m120_5` → −120.5). Undefined for an unknown id. */
export function yawOf(facing: string | undefined): number | undefined {
  const m = facing ? /^yaw_([mp])(\d+)(?:_(\d+))?$/.exec(facing) : null;
  if (!m) return undefined;
  const v = Number(`${m[2]}${m[3] ? `.${m[3]}` : ''}`);
  return m[1] === 'm' ? -v : v;
}

/** Projected stage ellipse of an attention island. */
export function islandEllipse(f: Fit, at: readonly [number, number, number], r: readonly [number, number]): { cx: number; cy: number; rx: number; ry: number } | undefined {
  const c = toStage(f, at[0], at[1], at[2]);
  const ex = toStage(f, at[0] + r[0], at[1], at[2]);
  const ey = toStage(f, at[0], at[1], at[2] + r[1]);
  if (!c || !ex || !ey) return undefined;
  return { cx: c.x, cy: c.y, rx: Math.abs(ex.x - c.x), ry: Math.abs(ey.y - c.y) };
}
