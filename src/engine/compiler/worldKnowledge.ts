import { worldTemplates, type ViviWorldId } from '../../world/templates/index.ts';
import type { CharacterFacing, CharacterPose } from '../../assets/characters/characters.ts';
import type { DslObject, DslPlace, DslRole, DslLighting, DslVerb } from './vocabulary.ts';

/**
 * What the compiler knows about each world that a model never needs to.
 *
 * Every entry is a semantic mapping onto the world template's slots. None of
 * this is sent to a model; it is the reason the model can say "bathroom" and
 * "phone" instead of coordinates.
 */

export type AmbientBedId =
  | 'room_tone'
  | 'ventilation'
  | 'office_hum'
  | 'crowd_murmur'
  | 'station_air'
  | 'city_night'
  | 'rain_ambient'
  | 'evening_air'
  | 'shower_water'
  | 'music_muffled'
  | 'train_idle'
  | 'bus_engine';

export interface BackgroundSeat {
  pos: [number, number];
  pose: Extract<CharacterPose, 'sit' | 'wait' | 'idle'>;
  facing: CharacterFacing;
}

export interface WorldKnowledge {
  /** Where the player begins. Always a walkable point. */
  spawn: [number, number];
  /** Place words → template slot ids. */
  places: Partial<Record<DslPlace, string>>;
  /**
   * Key objects → the slot that hosts them in this world. `carried` means the
   * object is in the player's hand (their own phone in a corridor or on a
   * platform) and can be used anywhere.
   */
  hosts: Partial<Record<DslObject, string>>;
  /** Roles that naturally occupy a slot here (a boss at the head of the table). */
  roleSlots: Partial<Record<DslRole, string>>;
  /** Positions low-cost background figures may occupy, in order of preference. */
  seats: BackgroundSeat[];
  /** Where background figures look by default. */
  seatAttention?: string;
  /** Slot used for "leave". */
  exit: string;
  /** Slot used for "wait"/"stay" when no target is named. */
  rest: string;
  lighting: DslLighting;
  bed: AmbientBedId;
  /** A slot that represents the room's own threshold for an exit/enter with no place. */
  door: string;
  /** Whether a public crowd makes sense here (background cast is dropped otherwise). */
  public: boolean;
}

export const WORLD_KNOWLEDGE: Record<ViviWorldId, WorldKnowledge> = {
  apartment_night: {
    spawn: [38, 82],
    places: {
      bathroom: 'bathroom_door', front_door: 'front_door', exit: 'front_door', bedroom: 'bedroom',
      kitchen: 'kitchen', window: 'window', sofa: 'sofa', table: 'phone_table', center: 'decision_center',
      corner: 'bedroom',
    },
    hosts: {
      phone: 'phone_table', door: 'front_door', document: 'phone_table', letter: 'phone_table',
      laptop: 'phone_table', envelope: 'front_door', keys: 'kitchen', window: 'window', bag: 'bedroom',
      ticket: 'phone_table', clock: 'kitchen', screen: 'phone_table', photo: 'sofa',
    },
    roleSlots: {},
    seats: [],
    exit: 'front_door',
    rest: 'sofa',
    lighting: 'domestic_warm_night',
    bed: 'room_tone',
    door: 'front_door',
    public: false,
  },
  hallway_night: {
    spawn: [66, 86],
    places: {
      front_door: 'front_door', elevator: 'elevator', stairs: 'stairs', exit: 'stairs',
      center: 'decision_center', corner: 'long_sight_line',
    },
    hosts: {
      intercom: 'intercom', elevator: 'elevator', door: 'front_door', envelope: 'long_sight_line',
      letter: 'front_door', document: 'front_door', photo: 'front_door', keys: 'front_door',
      phone: 'carried', bag: 'stairs', clock: 'intercom', screen: 'intercom',
    },
    roleSlots: { neighbor: 'stairs' },
    seats: [],
    exit: 'front_door',
    rest: 'decision_center',
    lighting: 'cold_hallway',
    bed: 'ventilation',
    door: 'elevator',
    public: false,
  },
  bar_or_party: {
    spawn: [24, 66],
    places: {
      bar: 'bar', table: 'tables', corner: 'quiet_corner', exit: 'exit', front_door: 'exit',
      bathroom: 'bathroom_corridor', center: 'crowd_clusters',
    },
    hosts: {
      phone: 'phone_area', door: 'exit', photo: 'tables', letter: 'tables', envelope: 'tables',
      document: 'tables', bag: 'quiet_corner', keys: 'tables', screen: 'bar', clock: 'bar', ticket: 'tables',
    },
    roleSlots: {},
    seats: [
      { pos: [60, 60], pose: 'wait', facing: 'left' },
      { pos: [67, 58], pose: 'wait', facing: 'left' },
      { pos: [80, 62], pose: 'wait', facing: 'left' },
      { pos: [44, 58], pose: 'wait', facing: 'right' },
    ],
    exit: 'exit',
    rest: 'quiet_corner',
    lighting: 'party_low',
    bed: 'crowd_murmur',
    door: 'exit',
    public: true,
  },
  office_night: {
    spawn: [13, 60],
    places: {
      screen: 'presentation_screen', desk: 'player_laptop', table: 'player_laptop', exit: 'exit',
      front_door: 'exit', center: 'decision_center',
    },
    hosts: {
      laptop: 'player_laptop', screen: 'presentation_screen', clock: 'meeting_clock', phone: 'player_laptop',
      document: 'player_laptop', envelope: 'player_laptop', photo: 'presentation_screen', door: 'exit',
      letter: 'player_laptop', bag: 'meeting_row', board: 'presentation_screen',
    },
    roleSlots: { boss: 'director', coworker: 'coworker' },
    seats: [
      { pos: [27, 61], pose: 'sit', facing: 'back' },
      { pos: [41, 60], pose: 'sit', facing: 'back' },
      { pos: [56, 61], pose: 'sit', facing: 'back' },
      { pos: [83, 61], pose: 'sit', facing: 'left' },
    ],
    seatAttention: 'presentation_screen',
    exit: 'exit',
    rest: 'meeting_row',
    lighting: 'sterile_office',
    bed: 'office_hum',
    door: 'exit',
    public: true,
  },
  train_station: {
    spawn: [40, 78],
    places: {
      platform: 'platform_edge', bench: 'bench', exit: 'exit', front_door: 'exit', screen: 'station_board',
      center: 'decision_center',
    },
    hosts: {
      board: 'station_board', train: 'train', ticket: 'bench', phone: 'carried', clock: 'station_board',
      bag: 'bench', door: 'train', envelope: 'bench', letter: 'bench', photo: 'bench', screen: 'station_board',
    },
    roleSlots: {},
    seats: [
      { pos: [62, 70], pose: 'wait', facing: 'right' },
      { pos: [74, 80], pose: 'wait', facing: 'right' },
      { pos: [14, 76], pose: 'wait', facing: 'back' },
    ],
    seatAttention: 'train',
    exit: 'exit',
    rest: 'bench',
    lighting: 'station_midnight',
    bed: 'station_air',
    door: 'train',
    public: true,
  },
  city_rain: {
    spawn: [40, 80],
    places: {
      street: 'street', car: 'car', window: 'window', corner: 'shelter', exit: 'crossing',
      front_door: 'window', center: 'decision_center',
    },
    hosts: {
      phone: 'carried', envelope: 'street', door: 'car', window: 'window', bag: 'street', keys: 'street',
      photo: 'window', document: 'shelter', letter: 'shelter',
    },
    roleSlots: { stranger: 'car' },
    seats: [{ pos: [70, 78], pose: 'wait', facing: 'left' }],
    exit: 'crossing',
    rest: 'shelter',
    lighting: 'rain_city',
    bed: 'rain_ambient',
    door: 'crossing',
    public: true,
  },
  family_home: {
    spawn: [18, 66],
    places: {
      table: 'documents', stairs: 'stair_door', front_door: 'stair_door', exit: 'stair_door', window: 'window',
      center: 'decision_center', corner: 'photo_wall',
    },
    hosts: {
      document: 'documents', photo: 'photo_wall', letter: 'documents', door: 'stair_door', phone: 'documents',
      window: 'window', envelope: 'documents', keys: 'documents', clock: 'photo_wall', laptop: 'documents',
    },
    roleSlots: {},
    seats: [{ pos: [76, 66], pose: 'wait', facing: 'left' }],
    exit: 'stair_door',
    rest: 'window',
    lighting: 'family_evening',
    bed: 'room_tone',
    door: 'stair_door',
    public: false,
  },
  hotel_or_rental: {
    spawn: [22, 64],
    places: {
      front_door: 'front_door', exit: 'front_door', kitchen: 'kitchen', table: 'photo', balcony: 'balcony',
      bedroom: 'bedroom', window: 'balcony', center: 'decision_center',
    },
    hosts: {
      photo: 'photo', door: 'front_door', keys: 'front_door', phone: 'carried', envelope: 'photo',
      document: 'photo', letter: 'photo', window: 'balcony', bag: 'bedroom', laptop: 'kitchen',
    },
    roleSlots: {},
    seats: [],
    exit: 'front_door',
    rest: 'kitchen',
    lighting: 'hotel_unease',
    bed: 'room_tone',
    door: 'front_door',
    public: false,
  },
  neighborhood_sunset: {
    spawn: [40, 80],
    places: {
      bench: 'bench', exit: 'bus_stop', street: 'path', center: 'decision_center', corner: 'tree',
    },
    hosts: {
      phone: 'carried', bag: 'bench', clock: 'clock', board: 'clock', ticket: 'bench', letter: 'bench',
      photo: 'bench', envelope: 'bench', door: 'bus_stop',
    },
    roleSlots: {},
    seats: [{ pos: [68, 70], pose: 'wait', facing: 'left' }],
    exit: 'bus_stop',
    rest: 'bench',
    lighting: 'golden_hour',
    bed: 'evening_air',
    door: 'bus_stop',
    public: true,
  },
  bedroom_night: {
    spawn: [70, 84],
    places: {
      front_door: 'door', exit: 'door', window: 'window', table: 'nightstand', bedroom: 'bed', sofa: 'bed',
      center: 'decision_center',
    },
    hosts: {
      phone: 'phone_screen', door: 'door', window: 'window', photo: 'nightstand', letter: 'nightstand',
      laptop: 'nightstand', keys: 'nightstand', document: 'nightstand', envelope: 'nightstand', bag: 'bed',
      clock: 'nightstand',
    },
    roleSlots: {},
    seats: [],
    exit: 'door',
    rest: 'bed',
    lighting: 'domestic_warm_night',
    bed: 'room_tone',
    door: 'door',
    public: false,
  },
};

function slotExists(world: ViviWorldId, slot: string | undefined): slot is string {
  return !!slot && !!worldTemplates[world]?.slots.some(s => s.id === slot);
}

/**
 * What kind of place each word names, and which other words would do instead.
 *
 * Not every world draws every place: a family home has no `bedroom` slot even
 * though every family home has a bedroom. A model naming one is right about
 * the story and should never be corrected for it, so each word falls back
 * along its own kind — a room you cannot see is reached through a door, a
 * place to sit becomes the room's own resting place, a way out becomes the
 * way out.
 */
const PLACE_KINDS: Array<{ places: DslPlace[]; prefer: DslPlace[]; anchor: 'door' | 'rest' | 'exit' }> = [
  { places: ['bathroom', 'bedroom', 'kitchen'], prefer: ['bathroom', 'bedroom', 'kitchen'], anchor: 'door' },
  { places: ['sofa', 'bench', 'table', 'desk', 'bar'], prefer: ['sofa', 'bench', 'table', 'desk', 'bar'], anchor: 'rest' },
  { places: ['stairs', 'elevator', 'front_door', 'exit'], prefer: ['front_door', 'exit', 'stairs', 'elevator'], anchor: 'exit' },
  { places: ['street', 'car', 'balcony', 'platform'], prefer: ['street', 'platform', 'balcony', 'car'], anchor: 'exit' },
  { places: ['window'], prefer: ['window', 'balcony'], anchor: 'rest' },
  { places: ['screen'], prefer: ['screen', 'table'], anchor: 'rest' },
  { places: ['corner', 'center'], prefer: ['corner', 'center'], anchor: 'rest' },
];

/** The slot a world draws for a place word, or null when it draws none. */
export function placeSlotExact(world: ViviWorldId, place: DslPlace | string): string | null {
  const slot = WORLD_KNOWLEDGE[world]?.places[place as DslPlace];
  return slotExists(world, slot) ? slot : null;
}

/**
 * Resolve a place word against a world. Always lands somewhere a figure can be:
 * the world's own slot for that word when it has one, otherwise the nearest
 * place of the same kind, otherwise the room's door, resting place or way out.
 */
export function resolvePlace(world: ViviWorldId, place: DslPlace | string): string | null {
  const exact = placeSlotExact(world, place);
  if (exact) return exact;
  const kind = PLACE_KINDS.find(k => (k.places as string[]).includes(place));
  if (!kind) return null;
  for (const alternative of kind.prefer) {
    const slot = placeSlotExact(world, alternative);
    if (slot) return slot;
  }
  const known = WORLD_KNOWLEDGE[world];
  const anchor = known[kind.anchor];
  return slotExists(world, anchor) ? anchor : null;
}

/** The slot hosting a key object. Every object resolves somewhere in every world. */
export const CARRIED = 'carried';

export function hostSlot(world: ViviWorldId, object: DslObject): string {
  const known = WORLD_KNOWLEDGE[world];
  const slot = known?.hosts[object];
  if (slot === CARRIED) return CARRIED;
  if (slotExists(world, slot)) return slot;
  // An intercom, elevator, board or train is part of a building; elsewhere the
  // closest analogue is the room's own threshold.
  if (object === 'intercom' || object === 'elevator' || object === 'door' || object === 'train') return known.door;
  return slotExists(world, 'decision_center') ? 'decision_center' : worldTemplates[world].slots[0].id;
}

/**
 * Default place for a verb when a commitment names no target. Returns a slot.
 * `objects` lets "read" and "show" find the thing they would naturally act on.
 */
export function defaultSlotForVerb(world: ViviWorldId, verb: DslVerb, objects: DslObject[]): string {
  const known = WORLD_KNOWLEDGE[world];
  const firstOf = (...candidates: DslObject[]) => {
    const found = candidates.find(c => objects.includes(c));
    return found ? hostSlot(world, found) : null;
  };
  switch (verb) {
    case 'leave':
      return known.exit;
    case 'wait':
    case 'stay':
    case 'keep':
    case 'hide':
      return known.rest;
    case 'read':
    case 'look':
      return firstOf('phone', 'letter', 'document', 'envelope', 'photo', 'screen', 'laptop', 'board') ?? known.rest;
    case 'show':
      return firstOf('laptop', 'document', 'photo', 'phone', 'letter') ?? known.rest;
    case 'call':
    case 'call_help':
      return firstOf('phone', 'intercom') ?? hostSlot(world, 'phone');
    case 'answer':
      return firstOf('intercom', 'phone') ?? hostSlot(world, 'phone');
    case 'board':
      return firstOf('train') ?? known.door;
    case 'open':
    case 'lock':
      return firstOf('door') ?? known.exit;
    case 'return':
      // Returning something means taking it somewhere else: the way out of the room.
      return resolvePlace(world, 'stairs') ?? resolvePlace(world, 'exit') ?? known.exit;
    case 'speak_up':
      return resolvePlace(world, 'screen') ?? resolvePlace(world, 'center') ?? known.rest;
    default:
      return resolvePlace(world, 'center') ?? known.rest;
  }
}
