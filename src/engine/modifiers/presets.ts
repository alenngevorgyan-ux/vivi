import type { ExperienceModifier, ModifierKind } from './types';

export const modifierAnchors: Record<ModifierKind, string[]> = {
  timer: ['phone_screen', 'station_board', 'wall_clock', 'meeting_display', 'elevator_indicator'],
  message: ['phone_screen', 'laptop'], call: ['phone_screen', 'intercom'],
  door: ['front_door', 'bathroom_door', 'elevator'], npcPressure: ['npc'],
  weather: ['window', 'street'], lighting: ['practical_light', 'hall_light'],
  sound: ['room', 'hallway'], crowd: ['entrance', 'platform'],
  arrival: ['elevator_indicator', 'station_board', 'street'],
  exit: ['door', 'platform'], typing: ['phone_screen', 'laptop'],
};
export const messageTimeline: ExperienceModifier[] = [
  { id: 'shower', kind: 'sound', atMs: 4000, anchor: 'bathroom_door', payload: 'Shower starts', visibleToPlayer: true },
  { id: 'vibrate', kind: 'sound', atMs: 7000, anchor: 'phone_screen', payload: 'Phone vibrates', visibleToPlayer: true },
  { id: 'message', kind: 'message', atMs: 8000, anchor: 'phone_screen', payload: 'I still smell like you.', visibleToPlayer: true },
  { id: 'second', kind: 'typing', atMs: 18000, anchor: 'phone_screen', payload: 'Someone is typing…', visibleToPlayer: true },
  { id: 'water', kind: 'sound', atMs: 30000, anchor: 'bathroom_door', payload: 'Water stops', visibleToPlayer: true },
  { id: 'door', kind: 'door', atMs: 36000, anchor: 'bathroom_door', payload: 'Door begins to open', visibleToPlayer: true },
];
