export type ProductBehaviorEventName =
  | 'scenario_started'
  | 'cue_seen'
  | 'object_inspected'
  | 'npc_approached'
  | 'interaction_started'
  | 'interaction_abandoned'
  | 'message_opened'
  | 'commitment_unlocked'
  | 'decision_committed'
  | 'reveal_seen'
  | 'response_cta_clicked'
  | 'story_completed'
  // Experience V2 — ids and modes only, never story text or the author's outcome.
  | 'experience_started'
  | 'experience_oriented'
  | 'orientation_skipped'
  | 'observation_opened'
  | 'intent_selected'
  | 'auto_approach_started'
  | 'auto_approach_completed'
  | 'auto_approach_recovered'
  | 'commitment_locked'
  | 'enactment_completed'
  | 'enactment_skipped'
  | 'reveal_viewed'
  | 'related_story_opened'
  | 'author_detail_corrected';

export interface ProductBehaviorEvent {
  name: ProductBehaviorEventName;
  scenarioId: string;
  elapsedMs: number;
  objectId?: string;
  choiceId?: string;
  decisionLatencyMs?: number;
  pathSequence?: string[];
  timestamp: number;
}

export interface TelemetrySession {
  sessionId: string;
  scenarioId: string;
  startedAt: number;
  events: ProductBehaviorEvent[];
  researchOptIn: boolean;
  consentVersion?: string;
}

// Session store for client-side telemetry
class TelemetryManager {
  private activeSession: TelemetrySession | null = null;

  public startSession(scenarioId: string, researchOptIn: boolean = false, consentVersion?: string): TelemetrySession {
    this.activeSession = {
      sessionId: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      scenarioId,
      startedAt: Date.now(),
      events: [
        {
          name: 'scenario_started',
          scenarioId,
          elapsedMs: 0,
          timestamp: Date.now(),
        },
      ],
      researchOptIn,
      consentVersion,
    };
    return this.activeSession;
  }

  public recordEvent(
    name: ProductBehaviorEventName,
    elapsedMs: number,
    details?: { objectId?: string; choiceId?: string; decisionLatencyMs?: number; pathSequence?: string[] }
  ): void {
    if (!this.activeSession) return;
    if (this.activeSession.events.length > 500) this.activeSession.events.shift();
    this.activeSession.events.push({
      name,
      scenarioId: this.activeSession.scenarioId,
      elapsedMs,
      objectId: details?.objectId,
      choiceId: details?.choiceId,
      decisionLatencyMs: details?.decisionLatencyMs,
      pathSequence: details?.pathSequence,
      timestamp: Date.now(),
    });
  }

  public getSession(): TelemetrySession | null {
    return this.activeSession;
  }

  /**
   * Exports data strictly for research purposes.
   * Gated: requires explicit researchOptIn === true AND consentVersion.
   */
  public exportResearchPayload(session: TelemetrySession): Record<string, unknown> {
    if (!session.researchOptIn || !session.consentVersion) {
      throw new Error('Research export blocked: Explicit user opt-in and consentVersion are strictly required.');
    }

    return {
      researchSessionId: session.sessionId,
      scenarioId: session.scenarioId,
      consentVersion: session.consentVersion,
      eventLog: session.events.map(e => ({
        event: e.name,
        t_ms: e.elapsedMs,
        object: e.objectId,
        choice: e.choiceId,
        latency: e.decisionLatencyMs,
      })),
      exportedAt: new Date().toISOString(),
    };
  }
}

export const telemetry = new TelemetryManager();

// Local diagnostic interface for QA: `window.__viviTelemetry.getSession()` in development builds.
if (typeof window !== 'undefined' && (import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
  (window as unknown as { __viviTelemetry: TelemetryManager }).__viviTelemetry = telemetry;
}
