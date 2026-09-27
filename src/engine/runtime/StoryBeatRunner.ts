export type BeatTrigger =
  | 'time_elapsed'
  | 'player_entered_zone'
  | 'object_inspected'
  | 'npc_reached_slot'
  | 'dialogue_finished'
  | 'modifier_finished'
  | 'player_committed'
  | 'previous_beat_complete';

export type BeatType =
  | 'arrival'
  | 'freeExplore'
  | 'cue'
  | 'interaction'
  | 'conversation'
  | 'movement'
  | 'silence'
  | 'memoryEcho'
  | 'pressure'
  | 'commitment'
  | 'reveal'
  | 'compare'
  | 'response';

export interface StoryBeat {
  id: string;
  type: BeatType;
  trigger: BeatTrigger;
  triggerPayload?: string | number; // e.g. ms or targetSlot
  title: string;
  description: string;
  targetSlot?: string;
  npcDialogue?: string;
  isCue?: boolean;
  isPressure?: boolean;
}

export interface BeatRunnerState {
  currentBeatIndex: number;
  currentBeat: StoryBeat | null;
  completedBeatIds: Set<string>;
  cueTriggered: boolean;
  pressureTriggered: boolean;
  unlockedActionIds: Set<string>;
  canCommit: boolean;
  committedChoiceId: string | null;
  isRevealed: boolean;
  activeObservations: string[];
}

export class StoryBeatRunner {
  private beats: StoryBeat[];
  private state: BeatRunnerState;
  private onStateChange?: (state: BeatRunnerState) => void;

  constructor(beats: StoryBeat[], onStateChange?: (state: BeatRunnerState) => void) {
    this.beats = beats;
    this.state = {
      currentBeatIndex: 0,
      currentBeat: beats[0] || null,
      completedBeatIds: new Set<string>(),
      cueTriggered: false,
      pressureTriggered: false,
      unlockedActionIds: new Set<string>(),
      canCommit: false,
      committedChoiceId: null,
      isRevealed: false,
      activeObservations: [],
    };
    this.onStateChange = onStateChange;
  }

  public getState(): BeatRunnerState {
    return this.state;
  }

  public checkTick(elapsedMs: number): void {
    if (!this.state.currentBeat) return;

    let advanced = false;
    for (let i = this.state.currentBeatIndex; i < this.beats.length; i++) {
      const beat = this.beats[i];
      if (this.state.completedBeatIds.has(beat.id)) continue;

      if (beat.trigger === 'time_elapsed') {
        const threshold = typeof beat.triggerPayload === 'number' ? beat.triggerPayload : 0;
        if (elapsedMs >= threshold) {
          this.advanceToBeat(i);
          advanced = true;
        }
      }
    }

    if (advanced && this.onStateChange) {
      this.onStateChange(this.state);
    }
  }

  public onPlayerEnteredZone(slotId: string): void {
    for (let i = this.state.currentBeatIndex; i < this.beats.length; i++) {
      const beat = this.beats[i];
      if (beat.trigger === 'player_entered_zone' && beat.targetSlot === slotId) {
        this.advanceToBeat(i);
        if (this.onStateChange) this.onStateChange(this.state);
        break;
      }
    }
  }

  public onObjectInspected(slotId: string, actionId?: string, observationText?: string): void {
    if (actionId) {
      this.state.unlockedActionIds.add(actionId);
    }

    if (observationText && !this.state.activeObservations.includes(observationText)) {
      this.state.activeObservations = [observationText, ...this.state.activeObservations];
    }

    // Commitment is strictly allowed once the key cue has happened AND at least one action was physically inspected
    this.state.canCommit = this.state.cueTriggered && this.state.unlockedActionIds.size > 0;

    for (let i = this.state.currentBeatIndex; i < this.beats.length; i++) {
      const beat = this.beats[i];
      if (beat.trigger === 'object_inspected' && (!beat.targetSlot || beat.targetSlot === slotId)) {
        this.advanceToBeat(i);
        break;
      }
    }

    if (this.onStateChange) this.onStateChange(this.state);
  }

  public isActionUnlocked(actionId: string): boolean {
    return this.state.unlockedActionIds.has(actionId);
  }

  public commitDecision(choiceId: string): void {
    // Only allow commit if unlocked
    if (!this.state.canCommit || !this.state.unlockedActionIds.has(choiceId)) {
      throw new Error(`Cannot commit action "${choiceId}" before physically inspecting it.`);
    }

    this.state.committedChoiceId = choiceId;
    this.state.canCommit = false;

    // Find commitment beat
    const commitIdx = this.beats.findIndex(b => b.type === 'commitment');
    if (commitIdx >= 0) {
      this.advanceToBeat(commitIdx);
    }
    if (this.onStateChange) this.onStateChange(this.state);
  }

  public triggerReveal(): void {
    this.state.isRevealed = true;
    const revealIdx = this.beats.findIndex(b => b.type === 'reveal');
    if (revealIdx >= 0) {
      this.advanceToBeat(revealIdx);
    }
    if (this.onStateChange) this.onStateChange(this.state);
  }

  private advanceToBeat(index: number): void {
    const beat = this.beats[index];
    if (!beat) return;

    for (let i = 0; i <= index; i++) {
      this.state.completedBeatIds.add(this.beats[i].id);
      if (this.beats[i].isCue || this.beats[i].type === 'cue') {
        this.state.cueTriggered = true;
      }
      if (this.beats[i].isPressure || this.beats[i].type === 'pressure') {
        this.state.pressureTriggered = true;
      }
    }

    // Re-check canCommit
    this.state.canCommit = this.state.cueTriggered && this.state.unlockedActionIds.size > 0;
    this.state.currentBeatIndex = index;
    this.state.currentBeat = beat;
  }
}
