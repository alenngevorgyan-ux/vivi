export const shotTypes = [
  'ESTABLISHING_WIDE', 'PLAYER_REVEAL', 'FOLLOW', 'TWO_SHOT', 'OVER_SHOULDER',
  'OBJECT_INSERT', 'PHONE_INSERT', 'MEMORY_ECHO', 'SLOW_PUSH_IN', 'STATIC_TENSION',
  'WIDE_SILENCE', 'NPC_EXIT', 'FINAL_COMMIT', 'REALITY_REVEAL',
] as const;
export type ShotType = typeof shotTypes[number];
export interface ShotCue {
  type: ShotType;
  camera: keyof typeof cameraPresets;
  target?: string;
  durationMs: number;
  control: 'locked' | 'free';
  sound?: string;
}
export const cameraPresets = {
  wide_world: { scale: 1, anchor: [0.5, 0.54], motion: 'hold' },
  soft_follow: { scale: 1.16, anchor: [0.42, 0.6], motion: 'ease' },
  close_follow: { scale: 1.45, anchor: [0.42, 0.58], motion: 'ease' },
  two_person: { scale: 1.2, anchor: [0.5, 0.57], motion: 'hold' },
  object_focus: { scale: 1.8, anchor: [0.57, 0.53], motion: 'cut' },
  slow_push: { scale: 1.38, anchor: [0.5, 0.52], motion: 'push' },
  locked_tension: { scale: 1.12, anchor: [0.5, 0.56], motion: 'hold' },
  memory_float: { scale: 1.08, anchor: [0.5, 0.54], motion: 'drift' },
  reveal_hold: { scale: 1.25, anchor: [0.5, 0.54], motion: 'hold' },
} as const;
