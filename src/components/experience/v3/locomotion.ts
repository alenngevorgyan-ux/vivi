/**
 * Free local locomotion: where the hero's body is while the player walks. PRESENTATION ONLY.
 *
 * The master plan (§G) makes "where to stand within a visible local walkable region" free. The reducer has no
 * MOVE event and needs none: a free position is never story state, never saved and never a precondition. What
 * the snapshot says (a compiled mark from a preparation, an entry mark, an act's approach) still wins: when the
 * snapshot's mark changes the body walks there. Story commands are only ever sent by the shell, from an explicit
 * interaction.
 *
 * Pure maths over the runtime geometry: screen-relative steering, metric speed, collision against the compiled
 * (already hero-inflated) footprints with wall sliding, and nearest-interaction selection with hysteresis.
 */

import { projectPoint, standable, type CameraGeometry, type FloorPoint, type LocationGeometry } from '../../../engine/v3/contracts/geometry.ts';
import { stageToFloor, toStage, type Fit } from './NormalizedProjection.ts';

export interface FloorDims {
  widthM: number;
  depthM: number;
}

/** An extra presentation limit on where a FREE body may stand (e.g. only the floor this framing shows). */
export type FloorLimit = (p: FloorPoint) => boolean;

/**
 * The floor the current framing actually shows, with headroom for the margin text: feet above the bottom band,
 * head below the top, inside the side margins. Every compiled mark of the scene stays allowed, so wherever the
 * story puts the body remains a place it can stand and walk away from.
 */
export function framedFloor(cam: CameraGeometry, heroHeightU: number, keep: ReadonlyArray<readonly [number, number]>): FloorLimit {
  const { width: vw, height: vh } = cam.viewport;
  let maxSy = vh * (cam.orientation === 'portrait' ? 0.93 : 0.87);
  for (const k of keep) {
    const f = projectPoint(cam, k[0], k[1], 0);
    if (f) maxSy = Math.max(maxSy, f.sy + 2);
  }
  return p => {
    const f = projectPoint(cam, p[0], p[1], 0);
    const h = projectPoint(cam, p[0], p[1], heroHeightU);
    return !!f && !!h && f.sy <= maxSy && f.sx >= vw * 0.04 && f.sx <= vw * 0.96 && h.sy >= vh * 0.02;
  };
}

/** Metres between two floor points of one location. */
export const metresBetween = (d: FloorDims, a: readonly [number, number], b: readonly [number, number]) => Math.hypot(((a[0] - b[0]) * d.widthM) / 100, ((a[1] - b[1]) * d.depthM) / 100);

/**
 * A screen direction (x right, y down) as a unit direction on the floor, in metres, at the hero's feet.
 * Screen-relative control: "up" walks into the picture whatever the camera's orientation.
 */
export function screenToFloorDir(fit: Fit, at: FloorPoint, v: readonly [number, number], d: FloorDims): [number, number] | undefined {
  const here = toStage(fit, at[0], at[1], 0);
  if (!here) return undefined;
  const n = Math.hypot(v[0], v[1]);
  if (n < 1e-9) return undefined;
  const k = 18 / n;
  const there = stageToFloor(fit, here.x + v[0] * k, here.y + v[1] * k);
  if (!there) return undefined;
  const mx = ((there[0] - at[0]) * d.widthM) / 100;
  const my = ((there[1] - at[1]) * d.depthM) / 100;
  const m = Math.hypot(mx, my);
  return m > 1e-9 ? [mx / m, my / m] : undefined;
}

/**
 * Move by a metric delta, sliding along whatever blocks. A body that starts off the standable floor (seated on a
 * declared seat, or on a mark inside a footprint) may move freely within `escapeM` of where it started, so it can
 * always get up and walk out — never deeper into the room's furniture.
 */
export function slide(loc: LocationGeometry, d: FloorDims, from: FloorPoint, dm: readonly [number, number], escape?: { origin: FloorPoint; escapeM: number }, limit?: FloorLimit): FloorPoint {
  const ux = (dm[0] * 100) / d.widthM;
  const uy = (dm[1] * 100) / d.depthM;
  const inLimit = (p: FloorPoint) => !limit || limit(p) || !limit(from);
  const ok = (p: FloorPoint) => inLimit(p) && (standable(loc, p) || (!!escape && !standable(loc, from) && metresBetween(d, p, escape.origin) <= escape.escapeM));
  const full: FloorPoint = [from[0] + ux, from[1] + uy];
  if (ok(full)) return full;
  // Wall sliding: keep whichever axis still moves (the larger first, so grazing a wall does not stall).
  const xs: FloorPoint = [from[0] + ux, from[1]];
  const ys: FloorPoint = [from[0], from[1] + uy];
  const order = Math.abs(dm[0]) >= Math.abs(dm[1]) ? [xs, ys] : [ys, xs];
  for (const p of order) if ((p[0] !== from[0] || p[1] !== from[1]) && ok(p)) return p;
  return from;
}

/** The standable point nearest to `p` (searching outward in rings), for approaching furniture, doors and people. */
export function nearestStandable(loc: LocationGeometry, d: FloorDims, p: FloorPoint, maxM = 2.4, toward?: FloorPoint, limit?: FloorLimit): FloorPoint | undefined {
  const fine = (q: FloorPoint) => standable(loc, q) && (!limit || limit(q));
  if (fine(p)) return p;
  let best: { p: FloorPoint; score: number } | undefined;
  for (let r = 0.15; r <= maxM; r += 0.15) {
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const q: FloorPoint = [p[0] + (Math.cos(a) * r * 100) / d.widthM, p[1] + (Math.sin(a) * r * 100) / d.depthM];
      if (!fine(q)) continue;
      // Prefer the side the player is coming from, a little.
      const score = r + (toward ? 0.15 * metresBetween(d, q, toward) : 0);
      if (!best || score < best.score) best = { p: q, score };
    }
    if (best) return best.p;
  }
  return undefined;
}

/** Walk a straight line toward `goal`, stopping where it is blocked. Returns the reachable end. */
export function reachable(loc: LocationGeometry, d: FloorDims, from: FloorPoint, goal: FloorPoint, escape?: { origin: FloorPoint; escapeM: number }, limit?: FloorLimit): FloorPoint {
  const total = metresBetween(d, from, goal);
  if (total < 1e-6) return from;
  const steps = Math.ceil(total / 0.08);
  let at = from;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const q: FloorPoint = [from[0] + (goal[0] - from[0]) * t, from[1] + (goal[1] - from[1]) * t];
    const dm: [number, number] = [((q[0] - at[0]) * d.widthM) / 100, ((q[1] - at[1]) * d.depthM) / 100];
    const next = slide(loc, d, at, dm, escape, limit);
    if (next[0] === at[0] && next[1] === at[1]) break;
    at = next;
  }
  return at;
}

/* ------------------------------------------------------------- body dynamics --- */

export interface BodyState {
  pos: FloorPoint;
  /** Metric velocity on the floor. */
  vel: [number, number];
  /** Walk-cycle phase in strides (fractional part = phase). */
  stride: number;
  facingLeft: boolean;
}

export const WALK = {
  /** Comfortable indoor walking speed, m/s. */
  speed: 1.45,
  /** Seconds to reach full speed and to stop: weight, not a slide. */
  accel: 0.22,
  decel: 0.16,
  /** Metres per full stride cycle (two steps). */
  strideM: 1.25,
};

/**
 * One fixed step of the body toward a desired metric direction (unit, or zero to stop). Velocity eases toward the
 * target (no instant start, no slide-on-ice stop), then collides. Returns the distance actually travelled.
 */
export function stepBody(b: BodyState, want: readonly [number, number] | undefined, dt: number, loc: LocationGeometry, d: FloorDims, escape?: { origin: FloorPoint; escapeM: number }, limit?: FloorLimit, speed = WALK.speed): number {
  const tv: [number, number] = want ? [want[0] * speed, want[1] * speed] : [0, 0];
  const tau = want ? WALK.accel : WALK.decel;
  const k = 1 - Math.exp(-dt / tau);
  b.vel = [b.vel[0] + (tv[0] - b.vel[0]) * k, b.vel[1] + (tv[1] - b.vel[1]) * k];
  if (Math.hypot(b.vel[0], b.vel[1]) < 0.02) b.vel = [0, 0];
  const before = b.pos;
  const after = slide(loc, d, before, [b.vel[0] * dt, b.vel[1] * dt], escape, limit);
  const moved = metresBetween(d, before, after);
  // Blocked on an axis: lose that velocity, so pushing into a wall does not store speed.
  if (moved < Math.hypot(b.vel[0], b.vel[1]) * dt * 0.25) b.vel = [b.vel[0] * 0.5, b.vel[1] * 0.5];
  b.pos = after;
  b.stride += moved / WALK.strideM;
  return moved;
}

/* ------------------------------------------------------------- interaction --- */

export interface Reach {
  id: string;
  /** Where the body walks to use it. */
  at: FloorPoint;
  /** What it is (an object's root); reach is measured from here when given, else from `at`. */
  center?: FloorPoint;
  /** Metres within which it is the current interaction. */
  radiusM: number;
}

/**
 * The interaction the body is at: the nearest within its radius, with hysteresis so the prompt does not flicker
 * between two neighbours; the current one is kept until it is clearly out of reach.
 */
export function pickReach<T extends Reach>(items: readonly T[], pos: FloorPoint, d: FloorDims, current?: string): T | undefined {
  let best: { it: T; m: number } | undefined;
  for (const it of items) {
    const m = metresBetween(d, pos, it.center ?? it.at);
    const r = it.id === current ? it.radiusM * 1.35 : it.radiusM;
    if (m > r) continue;
    const score = it.id === current ? m * 0.7 : m;
    if (!best || score < best.m) best = { it, m: score };
  }
  return best?.it;
}

/* ------------------------------------------------------------- pathfinding --- */

const CELL_M = 0.2;

/**
 * A walkable path from `from` to `goal` over a ~0.2 m grid of standable cells (8-connected A*), string-pulled to
 * as few straight legs as the floor allows. Click-to-walk and walking to an interaction never push into a table.
 * A start inside a footprint (a seat) may leave it; the goal is the nearest reachable standable cell.
 */
export function findPath(loc: LocationGeometry, d: FloorDims, from: FloorPoint, goal: FloorPoint, limit?: FloorLimit, searchM = 2.6): FloorPoint[] | undefined {
  const nx = Math.max(2, Math.round(d.widthM / CELL_M));
  const ny = Math.max(2, Math.round(d.depthM / CELL_M));
  const cx = (x: number) => Math.min(nx - 1, Math.max(0, Math.floor((x / 100) * nx)));
  const cy = (y: number) => Math.min(ny - 1, Math.max(0, Math.floor((y / 100) * ny)));
  const centre = (i: number, j: number): FloorPoint => [((i + 0.5) / nx) * 100, ((j + 0.5) / ny) * 100];
  const free = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) free[j * nx + i] = standable(loc, centre(i, j)) && (!limit || limit(centre(i, j))) ? 1 : 0;
  const s0 = cy(from[1]) * nx + cx(from[0]);
  let g0 = cy(goal[1]) * nx + cx(goal[0]);
  if (!free[g0]) {
    const q = nearestStandable(loc, d, goal, searchM, from, limit);
    if (!q) return undefined;
    g0 = cy(q[1]) * nx + cx(q[0]);
    goal = q;
  }
  const gs = new Float64Array(nx * ny).fill(Infinity);
  const came = new Int32Array(nx * ny).fill(-1);
  const closed = new Uint8Array(nx * ny);
  const h = (k: number) => Math.hypot(((k % nx) - (g0 % nx)) * (d.widthM / nx), (Math.floor(k / nx) - Math.floor(g0 / nx)) * (d.depthM / ny));
  const open: Array<[number, number]> = [[h(s0), s0]];
  gs[s0] = 0;
  const steps = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let found = false;
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [, k] = open.splice(bi, 1)[0];
    if (closed[k]) continue;
    closed[k] = 1;
    if (k === g0) {
      found = true;
      break;
    }
    const i = k % nx;
    const j = Math.floor(k / nx);
    for (const [di, dj] of steps) {
      const a = i + di;
      const b = j + dj;
      if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
      const n = b * nx + a;
      // The start cell may be inside a footprint; every other cell must be free, and diagonals may not cut corners.
      if (!free[n] || closed[n]) continue;
      if (di && dj && (!free[j * nx + a] || !free[b * nx + i])) continue;
      const g = gs[k] + Math.hypot(di * (d.widthM / nx), dj * (d.depthM / ny));
      if (g < gs[n]) {
        gs[n] = g;
        came[n] = k;
        open.push([g + h(n), n]);
      }
    }
  }
  if (!found) return undefined;
  const cells: FloorPoint[] = [];
  for (let k = g0; k !== -1 && k !== s0; k = came[k]) cells.push(centre(k % nx, Math.floor(k / nx)));
  cells.reverse();
  const raw: FloorPoint[] = [from, ...cells.slice(0, -1), goal];
  // String-pull: skip every waypoint a clear straight leg (no sliding) can already reach.
  const clear = (p: FloorPoint, q: FloorPoint, first: boolean) => {
    const n = Math.max(1, Math.ceil(metresBetween(d, p, q) / 0.06));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const x: FloorPoint = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      // A body starting inside a footprint (a seat) may cross its first 0.9 m to get out.
      if (first && metresBetween(d, x, from) <= 0.9 && !standable(loc, from)) continue;
      if (!standable(loc, x) || (limit && !limit(x))) return false;
    }
    return true;
  };
  const out: FloorPoint[] = [raw[0]];
  let a = 0;
  while (a < raw.length - 1) {
    let b = raw.length - 1;
    while (b > a + 1 && !clear(raw[a], raw[b], a === 0)) b--;
    out.push(raw[b]);
    a = b;
  }
  return out;
}
