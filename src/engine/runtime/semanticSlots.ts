import { worldTemplates, type ViviWorldId, type WorldSlot } from '../../world/templates/index.ts';
import { nearestWalkable } from './navigation.ts';

export interface SemanticSlotResolution {
  id: string;
  label: string;
  anchorX: number; // coordinate of the object/modifier
  anchorY: number;
  standX: number;  // safe walking destination where player stands to interact
  standY: number;
  interactionRadius: number; // radius within which interaction is available
  diegeticType: 'phone' | 'door' | 'clock' | 'elevator' | 'person' | 'table' | 'window' | 'screen' | 'general';
  /** The object is in the player's hand (their own phone): usable anywhere, never a spot in the room. */
  carried?: boolean;
}

type StandOffset = { dx: number; dy: number; radius?: number; type?: SemanticSlotResolution['diegeticType'] };

const WORLD_SLOT_STAND_OFFSETS: Record<string, StandOffset> = {
  // Apartment night
  phone_table: { dx: -6, dy: 6, radius: 10, type: 'phone' },
  bathroom_door: { dx: -4, dy: 16, radius: 12, type: 'door' },
  sofa: { dx: 14, dy: -2, radius: 11, type: 'table' },
  front_door: { dx: -8, dy: 10, radius: 12, type: 'door' },
  window: { dx: 6, dy: 18, radius: 12, type: 'window' },
  kitchen: { dx: -8, dy: 6, radius: 12, type: 'table' },

  // Hallway night
  intercom: { dx: 4, dy: 12, radius: 10, type: 'door' },
  elevator: { dx: -8, dy: 14, radius: 12, type: 'elevator' },
  stairs: { dx: -6, dy: 8, radius: 11, type: 'door' },

  // Office night
  player_laptop: { dx: 4, dy: 8, radius: 10, type: 'screen' },
  director: { dx: -10, dy: 8, radius: 13, type: 'person' },
  presentation_screen: { dx: 0, dy: 24, radius: 14, type: 'screen' },
  meeting_clock: { dx: -8, dy: 26, radius: 14, type: 'clock' },

  // Neighborhood sunset
  bus_stop: { dx: -6, dy: 12, radius: 12, type: 'person' },
  bench: { dx: 6, dy: 4, radius: 10, type: 'table' },
  tree: { dx: 10, dy: 12, radius: 12, type: 'general' },

  // Train station
  station_board: { dx: -4, dy: 24, radius: 14, type: 'clock' },
  platform_edge: { dx: -6, dy: -4, radius: 12, type: 'door' },
  train: { dx: -6, dy: 14, radius: 13, type: 'door' },

  // Other worlds
  phone_screen: { dx: 0, dy: -6, radius: 10, type: 'phone' },
  phone_area: { dx: 4, dy: -6, radius: 10, type: 'phone' },
  photo: { dx: -4, dy: -6, radius: 10, type: 'table' },
  documents: { dx: -4, dy: -6, radius: 10, type: 'table' },
  stair_door: { dx: -6, dy: 12, radius: 12, type: 'door' },
  door: { dx: -6, dy: 12, radius: 12, type: 'door' },
  exit: { dx: 4, dy: 4, radius: 12, type: 'door' },

  // Default fallback
  decision_center: { dx: 0, dy: 0, radius: 12, type: 'general' },
};

/**
 * Per-world overrides where the generic offset would put the standing spot on
 * the wrong side of a piece of furniture. Keyed `world:slot`.
 */
const WORLD_SPECIFIC_OFFSETS: Record<string, StandOffset> = {
  'office_night:player_laptop': { dx: 0, dy: -6, radius: 10, type: 'screen' },
  'office_night:director': { dx: -8, dy: 2, radius: 12, type: 'person' },
  'office_night:presentation_screen': { dx: 0, dy: 24, radius: 13, type: 'screen' },
  'office_night:meeting_clock': { dx: -6, dy: 40, radius: 13, type: 'clock' },
  'hallway_night:front_door': { dx: 8, dy: 8, radius: 12, type: 'door' },
};

/**
 * Resolves a semantic slot name to a concrete standing coordinate and interaction zone.
 * The standing spot is always a place a figure can actually reach.
 */
export function resolveSemanticSlot(worldId: ViviWorldId, slotId: string): SemanticSlotResolution {
  const world = worldTemplates[worldId] || worldTemplates.apartment_night;

  // Direct match or alias
  const aliasMap: Record<string, string> = {
    phone_screen: worldId === 'apartment_night' ? 'phone_table' : worldId === 'bar_or_party' ? 'phone_area' : 'phone_screen',
    room: 'decision_center',
    hallway: worldId === 'apartment_night' ? 'hallway' : 'long_sight_line',
    door: worldId === 'bedroom_night' ? 'door' : 'front_door',
    entrance: 'exit',
    train: worldId === 'train_station' ? 'train' : 'platform_edge',
    bedroom: 'bedroom',
    director: 'director',
    documents: 'documents',
    photo: 'photo',
    friend: worldId === 'neighborhood_sunset' ? 'path' : 'decision_center',
  };

  const targetId = aliasMap[slotId] || slotId;
  const rawSlot: WorldSlot =
    world.slots.find(s => s.id === targetId) ||
    world.slots.find(s => s.id === 'decision_center') ||
    world.slots[0] ||
    { id: slotId, x: 50, y: 65 };

  const offsets =
    WORLD_SPECIFIC_OFFSETS[`${worldId}:${rawSlot.id}`] ||
    WORLD_SLOT_STAND_OFFSETS[rawSlot.id] ||
    { dx: 0, dy: 8, radius: 11, type: 'general' };

  const desiredX = Math.max(10, Math.min(90, rawSlot.x + offsets.dx));
  const desiredY = Math.max(50, Math.min(88, rawSlot.y + offsets.dy));
  const [standX, standY] = nearestWalkable(worldId, [desiredX, desiredY]);

  return {
    id: rawSlot.id,
    label: rawSlot.id.replace(/_/g, ' '),
    anchorX: rawSlot.x,
    anchorY: rawSlot.y,
    standX,
    standY,
    interactionRadius: offsets.radius || 11,
    diegeticType: offsets.type || 'general',
  };
}
