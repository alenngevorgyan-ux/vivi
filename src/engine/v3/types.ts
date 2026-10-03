import type { DecisionId, Id, OpportunityId, SceneId } from './contracts/semantic.ts';
import type { RuntimeSnapshot } from './contracts/state.ts';

export type RejectionCode =
  | 'invalid_event'
  | 'wrong_phase'
  | 'busy'
  | 'locked'
  | 'unknown_id'
  | 'unavailable'
  | 'wrong_scene'
  | 'closed'
  | 'ahead_of_arc'
  | 'not_next'
  | 'knowledge_missing'
  | 'duplicate_activation'
  | 'stale_transaction'
  | 'stale_confirmation'
  | 'duplicate_decision'
  | 'decision_closed'
  | 'skip_before_commit'
  | 'nothing_to_advance'
  | 'nothing_to_cancel'
  | 'already_applied'
  | 'not_applied';

/** Effects are requests to the host. The reducer performs none of them. */
export type ControllerEffect =
  | { type: 'save_snapshot' }
  | { type: 'preload_scene'; txId: Id; scene: SceneId }
  | { type: 'focus_handoff'; scene: SceneId }
  | { type: 'persist_decision'; decision: DecisionId; option: OpportunityId }
  | { type: 'enact'; option: OpportunityId }
  | { type: 'load_reveal'; experienceId: Id; revision: Id }
  /** Codes only. Diagnostics never carry story text. */
  | { type: 'diagnostic'; code: RejectionCode; event: string };

export interface StepResult {
  state: RuntimeSnapshot;
  effects: ControllerEffect[];
  /** Present when the event changed nothing. The returned state is the same object. */
  rejected?: { code: RejectionCode };
}
