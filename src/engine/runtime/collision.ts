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

// Geometric collision obstacles for each world (in percentage 0-100 coordinates)
export const WORLD_COLLISIONS: Record<ViviWorldId, { bounds: WalkableBounds; obstacles: CollisionBox[] }> = {
  apartment_night: {
    bounds: { minX: 8, maxX: 92, minY: 48, maxY: 90 },
    obstacles: [
      { id: 'sofa', name: 'Sofa', x1: 10, y1: 66, x2: 34, y2: 82, blocksMovement: true },
      { id: 'phone_table', name: 'Coffee table with phone', x1: 46, y1: 66, x2: 60, y2: 76, blocksMovement: true },
      { id: 'kitchen_counter', name: 'Kitchen counter', x1: 72, y1: 44, x2: 94, y2: 56, blocksMovement: true },
      { id: 'wall_tv', name: 'Media console', x1: 20, y1: 44, x2: 44, y2: 52, blocksMovement: true },
    ],
  },
  hallway_night: {
    bounds: { minX: 10, maxX: 90, minY: 47, maxY: 88 },
    obstacles: [
      { id: 'front_door_frame', name: 'Apartment entry nook', x1: 10, y1: 47, x2: 22, y2: 62, blocksMovement: true },
      { id: 'stair_railing', name: 'Stairwell rail', x1: 86, y1: 66, x2: 92, y2: 86, blocksMovement: true },
      { id: 'wall_recess', name: 'Utility cabinet', x1: 48, y1: 47, x2: 58, y2: 55, blocksMovement: true },
    ],
  },
  bar_or_party: {
    bounds: { minX: 6, maxX: 94, minY: 48, maxY: 90 },
    obstacles: [
      { id: 'bar_counter', name: 'Bar counter', x1: 58, y1: 44, x2: 92, y2: 54, blocksMovement: true },
      { id: 'table_cluster_1', name: 'High-top tables', x1: 34, y1: 62, x2: 46, y2: 72, blocksMovement: true },
      { id: 'table_cluster_2', name: 'Corner booth', x1: 12, y1: 72, x2: 24, y2: 84, blocksMovement: true },
    ],
  },
  office_night: {
    bounds: { minX: 8, maxX: 92, minY: 48, maxY: 90 },
    obstacles: [
      { id: 'conference_table', name: 'Conference table', x1: 38, y1: 56, x2: 76, y2: 74, blocksMovement: true },
      { id: 'director_desk', name: 'Director chair area', x1: 66, y1: 48, x2: 78, y2: 56, blocksMovement: true },
      { id: 'presentation_display', name: 'Main display wall', x1: 14, y1: 44, x2: 34, y2: 52, blocksMovement: true },
    ],
  },
  train_station: {
    bounds: { minX: 6, maxX: 94, minY: 50, maxY: 90 },
    obstacles: [
      { id: 'station_bench', name: 'Wooden bench', x1: 16, y1: 62, x2: 28, y2: 72, blocksMovement: true },
      { id: 'support_pillar', name: 'Platform pillar', x1: 42, y1: 48, x2: 48, y2: 60, blocksMovement: true },
      { id: 'platform_edge_gate', name: 'Track edge safety zone', x1: 82, y1: 48, x2: 94, y2: 58, blocksMovement: true },
    ],
  },
  city_rain: {
    bounds: { minX: 6, maxX: 94, minY: 50, maxY: 90 },
    obstacles: [
      { id: 'bus_shelter', name: 'Glass rain shelter', x1: 12, y1: 52, x2: 24, y2: 66, blocksMovement: true },
      { id: 'parked_car', name: 'Parked car', x1: 72, y1: 48, x2: 88, y2: 60, blocksMovement: true },
      { id: 'streetlight_post', name: 'Streetlight', x1: 48, y1: 48, x2: 52, y2: 58, blocksMovement: true },
    ],
  },
  family_home: {
    bounds: { minX: 6, maxX: 94, minY: 48, maxY: 90 },
    obstacles: [
      { id: 'dining_table', name: 'Dining table with archive', x1: 36, y1: 62, x2: 54, y2: 76, blocksMovement: true },
      { id: 'credenza', name: 'Family cabinet', x1: 14, y1: 48, x2: 28, y2: 58, blocksMovement: true },
      { id: 'stair_entry', name: 'Stairwell door', x1: 84, y1: 48, x2: 92, y2: 60, blocksMovement: true },
    ],
  },
  hotel_or_rental: {
    bounds: { minX: 8, maxX: 92, minY: 48, maxY: 90 },
    obstacles: [
      { id: 'kitchen_island', name: 'Kitchen table with photo', x1: 56, y1: 62, x2: 72, y2: 74, blocksMovement: true },
      { id: 'luggage_pile', name: 'Suitcase on floor', x1: 22, y1: 72, x2: 32, y2: 82, blocksMovement: true },
      { id: 'balcony_threshold', name: 'Balcony door threshold', x1: 78, y1: 46, x2: 90, y2: 54, blocksMovement: true },
    ],
  },
  neighborhood_sunset: {
    bounds: { minX: 6, maxX: 94, minY: 48, maxY: 90 },
    obstacles: [
      { id: 'park_bench', name: 'Old street bench', x1: 18, y1: 62, x2: 30, y2: 72, blocksMovement: true },
      { id: 'large_oak', name: 'Oak tree trunk', x1: 8, y1: 48, x2: 18, y2: 60, blocksMovement: true },
      { id: 'bus_sign', name: 'Bus stop post', x1: 78, y1: 50, x2: 86, y2: 62, blocksMovement: true },
    ],
  },
  bedroom_night: {
    bounds: { minX: 8, maxX: 92, minY: 48, maxY: 90 },
    obstacles: [
      { id: 'bed', name: 'Double bed', x1: 16, y1: 58, x2: 38, y2: 82, blocksMovement: true },
      { id: 'nightstand', name: 'Nightstand with phone', x1: 58, y1: 60, x2: 70, y2: 72, blocksMovement: true },
      { id: 'wardrobe', name: 'Wardrobe', x1: 80, y1: 46, x2: 92, y2: 60, blocksMovement: true },
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
