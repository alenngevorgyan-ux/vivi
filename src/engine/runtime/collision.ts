import type { ViviWorldId } from '../../world/templates';

export interface CollisionBox {
  id: string;
  name: string;
  x1: number; // min X %
  y1: number; // min Y %
  x2: number; // max X %
  y2: number; // max Y %
  blocksMovement: boolean;
}

export interface WalkableBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Geometric collision obstacles for each world (in percentage 0-100 coordinates).
 *
 * Every box traces furniture that is actually drawn in SceneArt — an invisible
 * obstacle reads as a broken floor, and a drawn table without one lets people
 * walk across it. Player movement and NPC navigation share this data.
 */
export const WORLD_COLLISIONS: Record<ViviWorldId, { bounds: WalkableBounds; obstacles: CollisionBox[] }> = {
  apartment_night: {
    bounds: { minX: 8, maxX: 92, minY: 48, maxY: 90 },
    obstacles: [
      { id: 'sofa', name: 'Sofa', x1: 10, y1: 66, x2: 35, y2: 82, blocksMovement: true },
      { id: 'phone_table', name: 'Coffee table with phone', x1: 44, y1: 67, x2: 69, y2: 76, blocksMovement: true },
      { id: 'kitchen_counter', name: 'Kitchen counter', x1: 83, y1: 47, x2: 100, y2: 60, blocksMovement: true },
    ],
  },
  hallway_night: {
    // The corridor floor is a trapezoid converging on the elevator; the stepped
    // boxes below are its two side walls.
    bounds: { minX: 6, maxX: 94, minY: 66, maxY: 90 },
    obstacles: [
      { id: 'left_wall_1', name: 'Left wall', x1: 0, y1: 60, x2: 29, y2: 70, blocksMovement: true },
      { id: 'left_wall_2', name: 'Left wall', x1: 0, y1: 70, x2: 22, y2: 75, blocksMovement: true },
      { id: 'left_wall_3', name: 'Left wall', x1: 0, y1: 75, x2: 16, y2: 80, blocksMovement: true },
      { id: 'left_wall_4', name: 'Left wall', x1: 0, y1: 80, x2: 10, y2: 85, blocksMovement: true },
      { id: 'right_wall_1', name: 'Right wall', x1: 71, y1: 60, x2: 100, y2: 70, blocksMovement: true },
      { id: 'right_wall_2', name: 'Right wall', x1: 78, y1: 70, x2: 100, y2: 75, blocksMovement: true },
      { id: 'right_wall_3', name: 'Right wall', x1: 84, y1: 75, x2: 100, y2: 80, blocksMovement: true },
      { id: 'right_wall_4', name: 'Right wall', x1: 90, y1: 80, x2: 100, y2: 85, blocksMovement: true },
    ],
  },
  bar_or_party: {
    bounds: { minX: 6, maxX: 94, minY: 48, maxY: 90 },
    obstacles: [
      { id: 'bar_counter', name: 'Bar counter', x1: 35, y1: 68, x2: 92, y2: 76, blocksMovement: true },
      { id: 'round_table', name: 'Round table', x1: 13, y1: 75, x2: 39, y2: 84, blocksMovement: true },
    ],
  },
  office_night: {
    bounds: { minX: 6, maxX: 94, minY: 48, maxY: 92 },
    obstacles: [
      { id: 'conference_table', name: 'Conference table', x1: 18, y1: 66, x2: 86, y2: 84, blocksMovement: true },
    ],
  },
  train_station: {
    bounds: { minX: 6, maxX: 94, minY: 58, maxY: 90 },
    obstacles: [
      { id: 'station_bench', name: 'Wooden bench', x1: 17, y1: 66, x2: 34, y2: 72, blocksMovement: true },
    ],
  },
  city_rain: {
    bounds: { minX: 6, maxX: 94, minY: 60, maxY: 90 },
    obstacles: [],
  },
  family_home: {
    bounds: { minX: 6, maxX: 94, minY: 48, maxY: 90 },
    obstacles: [
      { id: 'dining_table', name: 'Dining table with archive', x1: 28, y1: 70, x2: 69, y2: 83, blocksMovement: true },
    ],
  },
  hotel_or_rental: {
    bounds: { minX: 8, maxX: 92, minY: 48, maxY: 90 },
    obstacles: [
      { id: 'kitchen_island', name: 'Kitchen table with photo', x1: 41, y1: 71, x2: 65, y2: 79, blocksMovement: true },
      { id: 'luggage_pile', name: 'Suitcase on floor', x1: 14, y1: 82, x2: 30, y2: 92, blocksMovement: true },
    ],
  },
  neighborhood_sunset: {
    bounds: { minX: 6, maxX: 94, minY: 60, maxY: 90 },
    obstacles: [
      { id: 'park_bench', name: 'Old street bench', x1: 17, y1: 70, x2: 34, y2: 80, blocksMovement: true },
      { id: 'bus_shelter', name: 'Bus shelter', x1: 82, y1: 58, x2: 93, y2: 74, blocksMovement: true },
    ],
  },
  bedroom_night: {
    bounds: { minX: 8, maxX: 92, minY: 48, maxY: 90 },
    obstacles: [
      { id: 'bed', name: 'Double bed', x1: 9, y1: 68, x2: 42, y2: 86, blocksMovement: true },
      { id: 'nightstand', name: 'Table with phone', x1: 43, y1: 70, x2: 64, y2: 78, blocksMovement: true },
    ],
  },
};

/**
 * Checks if a point with a given radius intersects with any active obstacles.
 */
export function isPointColliding(
  x: number,
  y: number,
  radius: number,
  obstacles: CollisionBox[]
): boolean {
  for (const obs of obstacles) {
    if (!obs.blocksMovement) continue;
    // Circle vs Axis-Aligned Bounding Box (AABB)
    const closestX = Math.max(obs.x1, Math.min(x, obs.x2));
    const closestY = Math.max(obs.y1, Math.min(y, obs.y2));
    const dx = x - closestX;
    const dy = y - closestY;
    if (dx * dx + dy * dy < radius * radius) {
      return true;
    }
  }
  return false;
}

/** Signed distance from a point to the nearest blocking box; negative when inside one. */
export function clearance(x: number, y: number, obstacles: CollisionBox[]): number {
  let best = Infinity;
  for (const obs of obstacles) {
    if (!obs.blocksMovement) continue;
    const dx = Math.max(obs.x1 - x, 0, x - obs.x2);
    const dy = Math.max(obs.y1 - y, 0, y - obs.y2);
    const outside = Math.hypot(dx, dy);
    const inside = outside > 0 ? 0 : Math.min(x - obs.x1, obs.x2 - x, y - obs.y1, obs.y2 - y);
    best = Math.min(best, outside > 0 ? outside : -inside);
  }
  return best;
}

/**
 * Smooth continuous sliding collision resolution.
 * If moving in (dx, dy) causes collision, tries sliding along X only or Y only.
 */
export function resolveMovement(
  currentX: number,
  currentY: number,
  dx: number,
  dy: number,
  worldId: ViviWorldId,
  radius: number = 2.4,
  dynamicObstacles: CollisionBox[] = []
): [number, number] {
  const config = WORLD_COLLISIONS[worldId] || WORLD_COLLISIONS.apartment_night;
  const obstacles = [...config.obstacles, ...dynamicObstacles];
  const { bounds } = config;

  const clampX = (val: number) => Math.max(bounds.minX + radius, Math.min(bounds.maxX - radius, val));
  const clampY = (val: number) => Math.max(bounds.minY + radius, Math.min(bounds.maxY - radius, val));

  const targetX = clampX(currentX + dx);
  const targetY = clampY(currentY + dy);

  // 0. A figure that is already overlapping something (a bad spawn, a person
  // who walked into them) must be able to step out rather than freeze.
  if (isPointColliding(currentX, currentY, radius, obstacles)) {
    return clearance(targetX, targetY, obstacles) >= clearance(currentX, currentY, obstacles)
      ? [targetX, targetY]
      : [currentX, currentY];
  }

  // 1. Try full movement
  if (!isPointColliding(targetX, targetY, radius, obstacles)) {
    return [targetX, targetY];
  }

  // 2. Try sliding along X only
  if (!isPointColliding(targetX, currentY, radius, obstacles)) {
    return [targetX, currentY];
  }

  // 3. Try sliding along Y only
  if (!isPointColliding(currentX, targetY, radius, obstacles)) {
    return [currentX, targetY];
  }

  // 4. Blocked in both directions
  return [currentX, currentY];
}
