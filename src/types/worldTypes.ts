// World types for the 2D Playable Memory Engine

export type CharacterPreset =
  | 'boy_01'
  | 'girl_01'
  | 'man_01'
  | 'woman_01'
  | 'shadow_01';

export type CharacterDirection = 'up' | 'down' | 'left' | 'right';

export interface WorldPosition {
  x: number;
  y: number;
}

export interface CharacterAppearance {
  preset: CharacterPreset;
  hairColor?: string;
  clothingColor?: string;
  skinTone?: string;
}

export interface WorldNPC {
  id: string;
  name: string;
  appearance: CharacterAppearance;
  x: number;
  y: number;
  direction?: CharacterDirection;
  interactionRadius?: number;
  // What happens when interacting
  dialogue?: Array<{ speaker: string; text: string }>;
  thoughtOnApproach?: string;
  // Can trigger choices or progress story
  leadsToChoice?: boolean;
}

export type WorldObjectType =
  | 'bench'
  | 'tree'
  | 'streetlight'
  | 'bicycle'
  | 'desk'
  | 'laptop'
  | 'coffee_cup'
  | 'whiteboard'
  | 'window'
  | 'door'
  | 'bus_stop'
  | 'photo'
  | 'letter'
  | 'bed'
  | 'fence'
  | 'chair'
  | 'cat';

export interface WorldObject {
  id: string;
  type: WorldObjectType;
  name: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  interactive?: boolean;
  interactionPrompt?: string; // e.g. "Посмотреть", "Вспомнить", "Прочитать"
  memoryText?: string; // Text revealed when inspected
  customIcon?: string;
}

export interface WorldTriggerZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  onEnterThought?: string;
  targetNodeId?: string; // Optional scene transition when walking here
}

export type WorldTemplate =
  | 'village_sunset'
  | 'office_night'
  | 'city_evening'
  | 'bedroom_night'
  | 'park_autumn';

export interface WorldSceneConfig {
  id: string;
  template: WorldTemplate;
  title: string;
  timeOfDay?: 'sunset' | 'night' | 'dusk' | 'day';
  ambient?: 'autumn_wind' | 'night_hum' | 'city_evening' | 'rain';
  width: number; // e.g. 1000
  height: number; // e.g. 600
  playerSpawn: WorldPosition;
  playerAppearance?: CharacterAppearance;
  npcs: WorldNPC[];
  objects: WorldObject[];
  zones?: WorldTriggerZone[];
  // Story outcome reveal for ending
  whatReallyHappened?: string;
}
