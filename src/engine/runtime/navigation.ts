import type { ViviWorldId } from '../../world/templates/index.ts';
import { WORLD_COLLISIONS, isPointColliding, type CollisionBox } from './collision.ts';

/**
 * NPC navigation for Vivi's small, fixed worlds.
 *
 * A coarse occupancy grid is built from the same collision boxes the player
 * collides with, searched with A*, then string-pulled by line of sight so a
 * person walks in two or three straight legs instead of a staircase. Worlds
 * may also author semantic paths for routes that should read a particular way
 * on camera; those win when their endpoints match.
 *
 * Everything here is pure and deterministic: the same world, obstacles and
 * endpoints always give the same path, which is what lets actors be a pure
 * function of scene time.
 */

export type Point = [number, number];

/** Grid resolution in world percent. Worlds are ~90×45 walkable, so ~1800 cells. */
const CELL = 1.5;
/** Clearance kept around a walking figure; matches the player's collision radius. */
export const ACTOR_RADIUS = 2.4;

interface NavGrid {
  key: string;
  originX: number;
  originY: number;
  cols: number;
  rows: number;
  blocked: Uint8Array;
  obstacles: CollisionBox[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  radius: number;
}

const gridCache = new Map<string, NavGrid>();
const pathCache = new Map<string, Point[]>();

function obstacleKey(obstacles: CollisionBox[]): string {
  return obstacles.map(o => `${o.x1},${o.y1},${o.x2},${o.y2}`).join('|');
}

export function navObstacles(world: ViviWorldId, extra: CollisionBox[] = []): CollisionBox[] {
  const config = WORLD_COLLISIONS[world] || WORLD_COLLISIONS.apartment_night;
  return [...config.obstacles, ...extra];
}

function getGrid(world: ViviWorldId, extra: CollisionBox[] = [], radius = ACTOR_RADIUS): NavGrid {
  const key = `${world}#${radius}#${obstacleKey(extra)}`;
  const cached = gridCache.get(key);
  if (cached) return cached;

  const config = WORLD_COLLISIONS[world] || WORLD_COLLISIONS.apartment_night;
  const bounds = config.bounds;
  const obstacles = navObstacles(world, extra);
  const originX = bounds.minX + radius;
  const originY = bounds.minY + radius;
  const cols = Math.max(1, Math.floor((bounds.maxX - radius - originX) / CELL) + 1);
  const rows = Math.max(1, Math.floor((bounds.maxY - radius - originY) / CELL) + 1);
  const blocked = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = originX + c * CELL;
      const y = originY + r * CELL;
      blocked[r * cols + c] = isPointColliding(x, y, radius, obstacles) ? 1 : 0;
    }
  }
  const grid: NavGrid = { key, originX, originY, cols, rows, blocked, obstacles, bounds, radius };
  gridCache.set(key, grid);
  return grid;
}

function cellOf(grid: NavGrid, p: Point): [number, number] {
  const c = Math.round((p[0] - grid.originX) / CELL);
  const r = Math.round((p[1] - grid.originY) / CELL);
  return [Math.min(grid.cols - 1, Math.max(0, c)), Math.min(grid.rows - 1, Math.max(0, r))];
}

function centerOf(grid: NavGrid, c: number, r: number): Point {
  return [grid.originX + c * CELL, grid.originY + r * CELL];
}

/** True when a figure of the nav radius can stand here. */
export function isWalkable(world: ViviWorldId, p: Point, extra: CollisionBox[] = [], radius = ACTOR_RADIUS): boolean {
  const grid = getGrid(world, extra, radius);
  const { bounds } = grid;
  if (p[0] < bounds.minX + radius - 1e-6 || p[0] > bounds.maxX - radius + 1e-6) return false;
  if (p[1] < bounds.minY + radius - 1e-6 || p[1] > bounds.maxY - radius + 1e-6) return false;
  return !isPointColliding(p[0], p[1], radius, grid.obstacles);
}

/** The closest point to `p` where a figure can stand. */
export function nearestWalkable(world: ViviWorldId, p: Point, extra: CollisionBox[] = [], radius = ACTOR_RADIUS): Point {
  if (isWalkable(world, p, extra, radius)) return p;
  const grid = getGrid(world, extra, radius);
  let best: Point | null = null;
  let bestD = Infinity;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (grid.blocked[r * grid.cols + c]) continue;
      const q = centerOf(grid, c, r);
      const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = q;
      }
    }
  }
  return best ?? p;
}

/** Whether a straight walk from a to b stays clear of every obstacle. */
export function hasLineOfSight(world: ViviWorldId, a: Point, b: Point, extra: CollisionBox[] = [], radius = ACTOR_RADIUS): boolean {
  const grid = getGrid(world, extra, radius);
  const dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const steps = Math.max(1, Math.ceil(dist / 0.5));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = a[0] + (b[0] - a[0]) * t;
    const y = a[1] + (b[1] - a[1]) * t;
    if (isPointColliding(x, y, radius, grid.obstacles)) return false;
  }
  return true;
}

const NEIGHBOURS: Array<[number, number, number]> = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

function astar(grid: NavGrid, start: [number, number], goal: [number, number]): Array<[number, number]> | null {
  const { cols, rows, blocked } = grid;
  const idx = (c: number, r: number) => r * cols + c;
  const startI = idx(start[0], start[1]);
  const goalI = idx(goal[0], goal[1]);
  const g = new Float64Array(cols * rows).fill(Infinity);
  const came = new Int32Array(cols * rows).fill(-1);
  const closed = new Uint8Array(cols * rows);
  const h = (i: number) => {
    const dc = Math.abs((i % cols) - goal[0]);
    const dr = Math.abs(Math.floor(i / cols) - goal[1]);
    return Math.max(dc, dr) + (Math.SQRT2 - 1) * Math.min(dc, dr);
  };
  // Tiny binary heap keyed on f.
  const heap: Array<[number, number]> = [];
  const push = (f: number, i: number) => {
    heap.push([f, i]);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= heap[k][0]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = (): [number, number] | undefined => {
    if (heap.length === 0) return undefined;
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };

  g[startI] = 0;
  push(h(startI), startI);
  while (heap.length) {
    const [, cur] = pop()!;
    if (closed[cur]) continue;
    if (cur === goalI) break;
    closed[cur] = 1;
    const c = cur % cols;
    const r = Math.floor(cur / cols);
    for (const [dc, dr, cost] of NEIGHBOURS) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const ni = idx(nc, nr);
      if (blocked[ni] || closed[ni]) continue;
      // No corner cutting: a diagonal needs both orthogonal neighbours free.
      if (dc !== 0 && dr !== 0 && (blocked[idx(c + dc, r)] || blocked[idx(c, r + dr)])) continue;
      const ng = g[cur] + cost;
      if (ng < g[ni]) {
        g[ni] = ng;
        came[ni] = cur;
        push(ng + h(ni), ni);
      }
    }
  }
  if (!Number.isFinite(g[goalI])) return null;
  const out: Array<[number, number]> = [];
  for (let i = goalI; i !== -1; i = came[i]) out.push([i % cols, Math.floor(i / cols)]);
  return out.reverse();
}

/** Remove every waypoint that can be skipped by walking straight past it. */
function stringPull(world: ViviWorldId, points: Point[], extra: CollisionBox[], radius: number): Point[] {
  if (points.length <= 2) return points;
  const out: Point[] = [points[0]];
  let anchor = 0;
  while (anchor < points.length - 1) {
    let next = points.length - 1;
    while (next > anchor + 1 && !hasLineOfSight(world, points[anchor], points[next], extra, radius)) next--;
    out.push(points[next]);
    anchor = next;
  }
  return out;
}

/**
 * Authored routes that should read a particular way on camera, keyed by the
 * semantic slots they connect. Coordinates are waypoints between the ends.
 */
export const SEMANTIC_PATHS: Partial<Record<ViviWorldId, Array<{ from: string; to: string; via: Point[] }>>> = {
  apartment_night: [
    // The partner crosses behind the coffee table rather than through the rug's centre.
    { from: 'living_room', to: 'bathroom_door', via: [[62, 62], [70, 56]] },
  ],
  office_night: [
    // Behind the seated row, along the wall, never across the table.
    { from: 'meeting_row', to: 'presentation_screen', via: [[50, 56]] },
  ],
};

export function semanticPath(world: ViviWorldId, from: string, to: string): Point[] | null {
  const route = SEMANTIC_PATHS[world]?.find(p => p.from === from && p.to === to);
  return route ? route.via : null;
}

export interface FindPathOptions {
  extra?: CollisionBox[];
  radius?: number;
  /** Waypoints of an authored semantic route to prefer when it stays walkable. */
  via?: Point[];
}

/**
 * A walkable route from `from` to `to`. The destination is moved to the
 * nearest standable point if it sits inside furniture. Never returns a path
 * that crosses an obstacle; if no route exists the figure stays put.
 */
export function findPath(world: ViviWorldId, from: Point, to: Point, options: FindPathOptions = {}): Point[] {
  const extra = options.extra ?? [];
  const radius = options.radius ?? ACTOR_RADIUS;
  const start = nearestWalkable(world, from, extra, radius);
  const goal = nearestWalkable(world, to, extra, radius);
  const cacheKey = `${world}#${radius}#${obstacleKey(extra)}#${start.map(n => n.toFixed(2))}>${goal.map(n => n.toFixed(2))}#${
    options.via ? options.via.join(';') : ''
  }`;
  const cached = pathCache.get(cacheKey);
  if (cached) return cached;

  let result: Point[] | null = null;

  if (options.via && options.via.length > 0) {
    const legs = [start, ...options.via, goal];
    const ok = legs.every((p, i) => i === 0 || hasLineOfSight(world, legs[i - 1], p, extra, radius));
    if (ok) result = legs;
  }

  if (!result && hasLineOfSight(world, start, goal, extra, radius)) {
    result = [start, goal];
  }

  if (!result) {
    const grid = getGrid(world, extra, radius);
    const cells = astar(grid, cellOf(grid, start), cellOf(grid, goal));
    if (cells) {
      const raw: Point[] = [start, ...cells.slice(1, -1).map(([c, r]) => centerOf(grid, c, r)), goal];
      result = stringPull(world, raw, extra, radius);
    } else {
      result = [start];
    }
  }

  if (from[0] !== start[0] || from[1] !== start[1]) result = [from, ...result];
  pathCache.set(cacheKey, result);
  return result;
}

export function pathLength(path: Point[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  return total;
}

/** Position and heading `distance` units along a path. */
export function pointAlongPath(path: Point[], distance: number): { pos: Point; dir: Point; done: boolean } {
  if (path.length === 0) return { pos: [50, 70], dir: [0, 1], done: true };
  if (path.length === 1) return { pos: path[0], dir: [0, 1], done: true };
  let remaining = Math.max(0, distance);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (seg < 1e-9) continue;
    const dir: Point = [(b[0] - a[0]) / seg, (b[1] - a[1]) / seg];
    if (remaining <= seg) {
      return { pos: [a[0] + dir[0] * remaining, a[1] + dir[1] * remaining], dir, done: false };
    }
    remaining -= seg;
  }
  const a = path[path.length - 2];
  const b = path[path.length - 1];
  const seg = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return { pos: b, dir: [(b[0] - a[0]) / seg, (b[1] - a[1]) / seg], done: true };
}

/** Whether any leg of a path passes through an obstacle. Used by tests and the eval harness. */
export function pathCollides(world: ViviWorldId, path: Point[], extra: CollisionBox[] = [], radius = ACTOR_RADIUS): boolean {
  const obstacles = navObstacles(world, extra);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(1, Math.ceil(dist / 0.4));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      // The very first point may be a spawn the figure is stepping out of.
      if (i === 1 && s === 0) continue;
      if (isPointColliding(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, radius - 0.05, obstacles)) return true;
    }
  }
  return false;
}
