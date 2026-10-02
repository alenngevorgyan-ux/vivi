export type ModifierKind = 'timer' | 'message' | 'call' | 'door' | 'npcPressure' | 'weather' | 'lighting' | 'sound' | 'crowd' | 'arrival' | 'exit' | 'typing' | 'elevator' | 'clock';

/**
 * Structured physical effects. Compiled experiences set these explicitly so
 * the ModifierEngine never has to infer meaning from display text; authored
 * legacy modifiers omit them and keep the original text interpretation.
 */
export interface ModifierData {
  /** Change the ambient bed. `null` returns to the world's own room tone. */
  bed?: string | null;
  /** The phone buzzes for this modifier's duration. */
  vibrate?: boolean;
  /** Text shown on the lit screen. */
  screenText?: string;
  typing?: boolean;
  /** A lit phone locks after this many seconds. */
  lockSec?: number;
  door?: 'handle_moving' | 'open' | 'closed';
  /** Elevator floor count, e.g. [6, 9], one floor every two seconds. */
  floors?: [number, number];
  /** The elevator doors open with nobody inside. */
  emptyCar?: boolean;
  /** Diegetic clock or board readout. */
  clock?: string;
  /** A countdown in seconds. */
  countdownSec?: number;
  /** Vehicle doors open (train, bus). */
  doorsOpen?: boolean;
  /** A short line spoken aloud, shown as a subtitle for the modifier's duration. */
  speech?: string;
  light?: 'flicker' | 'dim' | 'out';
  /** A building intercom rings. */
  intercom?: boolean;
  /** People in the room turn to the player. */
  stare?: boolean;
  /** A key object catches the eye. */
  glint?: string;
  /** A one-shot diegetic sound: a knock, footsteps. */
  oneShot?: 'knock' | 'footsteps';
}

export interface ExperienceModifier {
  id: string;
  kind: ModifierKind;
  atMs: number;
  anchor: string;
  payload: string;
  intensity?: 1 | 2 | 3;
  durationMs?: number;
  visibleToPlayer: boolean;
  data?: ModifierData;
}
export interface BehavioralContext {
  studyId?: string;
  scenarioId: string;
  variantId: string;
  variables: Partial<Record<'timePressure' | 'socialPressure' | 'ambiguity' | 'closeness' | 'authority' | 'publicVisibility' | 'financialStakes' | 'risk' | 'uncertainty', string | number | boolean>>;
  consentVersion?: string;
  researchOptIn: boolean;
}
export type BehaviorEventName = 'cue_seen' | 'object_inspected' | 'npc_approached' | 'interaction_started' | 'interaction_abandoned' | 'message_opened' | 'decision_committed' | 'choice_changed_before_commit' | 'story_completed';
export interface BehaviorEvent {
  name: BehaviorEventName;
  scenarioId: string;
  variantId: string;
  elapsedMs: number;
  objectId?: string;
  choiceId?: string;
  decisionLatencyMs?: number;
  pathSequence?: string[];
  researchSessionId?: string;
}
