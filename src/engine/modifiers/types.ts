export type ModifierKind = 'timer' | 'message' | 'call' | 'door' | 'npcPressure' | 'weather' | 'lighting' | 'sound' | 'crowd' | 'arrival' | 'exit' | 'typing';
export interface ExperienceModifier {
  id: string;
  kind: ModifierKind;
  atMs: number;
  anchor: string;
  payload: string;
  intensity?: 1 | 2 | 3;
  durationMs?: number;
  visibleToPlayer: boolean;
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
