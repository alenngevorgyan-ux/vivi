import { stagingDistances } from '../../assets/characters/characters';

export type StagingPreset =
  | 'intimate_close'
  | 'normal_conversation'
  | 'awkward_distance'
  | 'confrontation'
  | 'across_table'
  | 'doorway_separation'
  | 'walking_side_by_side'
  | 'one_person_leaving'
  | 'isolated_subject'
  | 'public_pressure';

export interface StagingDef {
  /** Horizontal separation in world percent at the 1000×600 stage. */
  gap: number;
  /** Depth offset applied to the second figure; positive reads as further back. */
  depthOffset: number;
  /** Whether the pair face each other, align, or turn away. */
  orientation: 'facing' | 'aligned' | 'averted';
  note: string;
}

/**
 * The authored baselines in `stagingDistances` are expressed in 1000-unit world
 * space; the runtime positions figures in percent, so they divide by ten.
 */
const pct = (units: number) => units / 10;

export const viviStaging: Record<StagingPreset, StagingDef> = {
  intimate_close: {
    gap: pct(stagingDistances.intimate_close),
    depthOffset: 0,
    orientation: 'facing',
    note: 'Shoulders almost touch. Used before tension exists.',
  },
  normal_conversation: {
    gap: pct(stagingDistances.normal_conversation),
    depthOffset: 0,
    orientation: 'facing',
    note: 'Default domestic spacing.',
  },
  awkward_distance: {
    gap: pct(stagingDistances.awkward_distance),
    depthOffset: 1.5,
    orientation: 'averted',
    note: 'Too far for the room. The gap is the line of dialogue.',
  },
  confrontation: {
    gap: pct(stagingDistances.confrontation),
    depthOffset: 0,
    orientation: 'facing',
    note: 'Close enough to be answered, far enough to leave.',
  },
  across_table: {
    gap: pct(stagingDistances.across_table),
    depthOffset: -2,
    orientation: 'facing',
    note: 'An object owns the space between them.',
  },
  doorway_separation: {
    gap: pct(stagingDistances.doorway_separation),
    depthOffset: -6,
    orientation: 'averted',
    note: 'One figure is already in another room.',
  },
  walking_side_by_side: {
    gap: pct(stagingDistances.walking_side_by_side),
    depthOffset: 1,
    orientation: 'aligned',
    note: 'Shared direction. No one is being addressed.',
  },
  one_person_leaving: {
    gap: pct(stagingDistances.one_person_leaving),
    depthOffset: -8,
    orientation: 'averted',
    note: 'Distance increases before the camera is allowed to cut.',
  },
  isolated_subject: {
    gap: 0,
    depthOffset: 0,
    orientation: 'aligned',
    note: 'No second figure. Negative space does the work.',
  },
  public_pressure: {
    gap: pct(stagingDistances.public_group),
    depthOffset: -4,
    orientation: 'facing',
    note: 'A group orients toward authority; the player is off-axis.',
  },
};

export interface StagedPair {
  subject: [number, number];
  counterpart: [number, number];
}

/**
 * Place a counterpart relative to a subject using a staging preset.
 * `side` picks which way the counterpart sits; depth lifts it up the stage.
 */
export function stagePair(
  subject: [number, number],
  preset: StagingPreset,
  side: 'left' | 'right' = 'right'
): StagedPair {
  const def = viviStaging[preset];
  const direction = side === 'right' ? 1 : -1;
  const counterpartX = Math.min(94, Math.max(6, subject[0] + def.gap * direction));
  const counterpartY = Math.min(92, Math.max(40, subject[1] + def.depthOffset));
  return { subject, counterpart: [counterpartX, counterpartY] };
}
