import { shotAt, type ResolvedShot, type ViviCameraShot } from './cameraLanguage.ts';

/**
 * The event-driven cinematic director.
 *
 * Generated experiences carry no shot list. They carry a camera grammar and a
 * short list of semantic camera events compiled from the story ("the partner
 * leaves", "an object lights up", "the room goes silent"). Every frame the
 * director picks a shot from the current game state, so the camera follows
 * what is happening rather than a timeline written in advance — and the
 * player keeps control outside a brief opening.
 */

export type CameraGrammarId = 'intimate' | 'suspense' | 'scrutiny' | 'departure' | 'moral' | 'discovery';

export type CameraEventKind =
  | 'npc_exit'
  | 'npc_enter'
  | 'object_active'
  | 'speech'
  | 'silence'
  | 'pressure'
  | 'arrival'
  | 'stare'
  | 'approach'
  | 'memory';

export interface CameraEvent {
  atMs: number;
  kind: CameraEventKind;
  /** World slot the event happens at, for slot-framed shots. */
  slot?: string;
  /** Actor the event is about, for actor-framed shots. */
  actor?: string;
}

export interface ShotChoice {
  shot: ViviCameraShot;
  ms: number;
  /** Frame the event's slot (true) rather than the player or an actor. */
  onSlot?: boolean;
}

export interface CameraGrammarDef {
  /** The only part of a scene allowed to hold control, and only briefly. */
  opening: Array<ShotChoice & { locked?: boolean }>;
  reactions: Partial<Record<CameraEventKind, ShotChoice>>;
  /** Free exploration. */
  explore: ViviCameraShot;
  /** Held once pressure begins and no event is being framed. */
  pressure: ViviCameraShot;
  /** Played once, the first moment a commitment becomes possible. */
  commitAvailable?: ShotChoice;
}

export const CAMERA_GRAMMARS: Record<CameraGrammarId, CameraGrammarDef> = {
  /** Two people and a room getting smaller. Close, patient, never cutting away from a face for long. */
  intimate: {
    opening: [
      { shot: 'ESTABLISHING_WIDE', ms: 2200, locked: true },
      { shot: 'TWO_SHOT', ms: 1800, locked: true },
    ],
    reactions: {
      npc_exit: { shot: 'NPC_EXIT', ms: 2000 },
      npc_enter: { shot: 'TWO_SHOT', ms: 2600 },
      object_active: { shot: 'SLOW_PUSH_IN', ms: 1900, onSlot: true },
      speech: { shot: 'TWO_SHOT', ms: 2400 },
      silence: { shot: 'STATIC_TENSION', ms: 2800 },
      pressure: { shot: 'SLOW_PUSH_IN', ms: 2200, onSlot: true },
      approach: { shot: 'TWO_SHOT', ms: 2200 },
      memory: { shot: 'WIDE_SILENCE', ms: 2600 },
    },
    explore: 'SOFT_FOLLOW',
    pressure: 'STATIC_TENSION',
  },
  /** Alone with something that should not be happening. Wide, still, and the push-in is the scare. */
  suspense: {
    opening: [
      { shot: 'ESTABLISHING_WIDE', ms: 2400, locked: true },
      { shot: 'STATIC_TENSION', ms: 1600, locked: true },
    ],
    reactions: {
      object_active: { shot: 'SLOW_PUSH_IN', ms: 2200, onSlot: true },
      arrival: { shot: 'SLOW_PUSH_IN', ms: 2400, onSlot: true },
      silence: { shot: 'WIDE_SILENCE', ms: 2800 },
      pressure: { shot: 'SLOW_PUSH_IN', ms: 2600, onSlot: true },
      npc_enter: { shot: 'STATIC_TENSION', ms: 2400 },
      approach: { shot: 'STATIC_TENSION', ms: 2200 },
      memory: { shot: 'WIDE_SILENCE', ms: 2600 },
    },
    explore: 'SOFT_FOLLOW',
    pressure: 'STATIC_TENSION',
    commitAvailable: { shot: 'WIDE_SILENCE', ms: 1600 },
  },
  /** A room watching someone. The lens finds who is speaking, then shows the room looking. */
  scrutiny: {
    opening: [
      { shot: 'ESTABLISHING_WIDE', ms: 2200, locked: true },
      { shot: 'OVER_SHOULDER', ms: 1600, locked: true },
    ],
    reactions: {
      speech: { shot: 'TWO_SHOT', ms: 2400 },
      object_active: { shot: 'SLOW_PUSH_IN', ms: 1800, onSlot: true },
      stare: { shot: 'WIDE_SILENCE', ms: 2400 },
      pressure: { shot: 'STATIC_TENSION', ms: 2400 },
      silence: { shot: 'WIDE_SILENCE', ms: 2400 },
      approach: { shot: 'TWO_SHOT', ms: 2200 },
      npc_exit: { shot: 'NPC_EXIT', ms: 1800 },
      npc_enter: { shot: 'TWO_SHOT', ms: 2000 },
    },
    explore: 'SOFT_FOLLOW',
    pressure: 'STATIC_TENSION',
    commitAvailable: { shot: 'WIDE_SILENCE', ms: 1800 },
  },
  /** Someone or something is about to go. Space is the subject. */
  departure: {
    opening: [
      { shot: 'ESTABLISHING_WIDE', ms: 2200, locked: true },
      { shot: 'TWO_SHOT', ms: 1700, locked: true },
    ],
    reactions: {
      arrival: { shot: 'WIDE_SILENCE', ms: 2600 },
      npc_exit: { shot: 'NPC_EXIT', ms: 2200 },
      object_active: { shot: 'SLOW_PUSH_IN', ms: 1800, onSlot: true },
      speech: { shot: 'TWO_SHOT', ms: 2200 },
      silence: { shot: 'WIDE_SILENCE', ms: 2400 },
      pressure: { shot: 'WIDE_SILENCE', ms: 2400 },
      memory: { shot: 'WIDE_SILENCE', ms: 2600 },
    },
    explore: 'SOFT_FOLLOW',
    pressure: 'TWO_SHOT',
  },
  /** An object and a choice about it. The object keeps pulling the frame back. */
  moral: {
    opening: [
      { shot: 'ESTABLISHING_WIDE', ms: 2000, locked: true },
      { shot: 'SLOW_PUSH_IN', ms: 2000, onSlot: true, locked: true },
    ],
    reactions: {
      object_active: { shot: 'SLOW_PUSH_IN', ms: 2000, onSlot: true },
      speech: { shot: 'TWO_SHOT', ms: 2200 },
      arrival: { shot: 'STATIC_TENSION', ms: 2200 },
      approach: { shot: 'TWO_SHOT', ms: 2200 },
      pressure: { shot: 'STATIC_TENSION', ms: 2400 },
      silence: { shot: 'WIDE_SILENCE', ms: 2200 },
    },
    explore: 'SOFT_FOLLOW',
    pressure: 'STATIC_TENSION',
    commitAvailable: { shot: 'WIDE_SILENCE', ms: 1600 },
  },
  /** Finding something that changes what you knew. Insert-led, then the empty room. */
  discovery: {
    opening: [
      { shot: 'ESTABLISHING_WIDE', ms: 1900, locked: true },
      { shot: 'SLOW_PUSH_IN', ms: 2100, onSlot: true, locked: true },
    ],
    reactions: {
      object_active: { shot: 'SLOW_PUSH_IN', ms: 2000, onSlot: true },
      silence: { shot: 'WIDE_SILENCE', ms: 2600 },
      pressure: { shot: 'SLOW_PUSH_IN', ms: 2200, onSlot: true },
      speech: { shot: 'TWO_SHOT', ms: 2200 },
      npc_enter: { shot: 'TWO_SHOT', ms: 2400 },
      approach: { shot: 'TWO_SHOT', ms: 2200 },
      memory: { shot: 'WIDE_SILENCE', ms: 2600 },
    },
    explore: 'SOFT_FOLLOW',
    pressure: 'STATIC_TENSION',
  },
};

/** Control is only taken away for the opening beat; after that the player drives. */
export const OPENING_LOCK_MS = 4200;
/** How long an inspection holds the lens on the object before releasing. */
export const INSERT_HOLD_MS = 2300;

export interface DirectorInput {
  elapsedMs: number;
  revealed: boolean;
  committed: boolean;
  pressureTriggered: boolean;
  insert?: { slot: string; atMs: number } | null;
  /** First moment the player could commit, if it has happened. */
  commitAvailableAt?: number | null;
  /** Generated scenes: a grammar and its compiled events. */
  grammar?: CameraGrammarId;
  events?: CameraEvent[];
  /** Slot an opening `onSlot` shot frames (the scene's main key object). */
  focusSlot?: string;
  /** Authored scenes: a fixed opening timeline. */
  authored?: ResolvedShot[];
}

export interface DirectedShot {
  shot: ViviCameraShot;
  slot?: string;
  actor?: string;
  locked: boolean;
  /** Why the director chose this shot — surfaced in the Director Lab. */
  reason: string;
}

/**
 * Pick the shot for this moment. Precedence:
 * reveal → commitment → an inspection insert → the opening → the most recent
 * camera event still within its window → commit-available → pressure → explore.
 */
export function directShot(input: DirectorInput): DirectedShot {
  const t = input.elapsedMs;
  if (input.revealed) return { shot: 'REALITY_HOLD', locked: true, reason: 'reveal' };
  if (input.committed) return { shot: 'FINAL_COMMIT', locked: true, reason: 'commit' };

  // An inspection earns the only hard cut in the language.
  if (input.insert && t - input.insert.atMs < INSERT_HOLD_MS && t >= input.insert.atMs) {
    return { shot: 'OBJECT_INSERT', slot: input.insert.slot, locked: false, reason: 'inspect' };
  }

  const grammar = input.grammar ? CAMERA_GRAMMARS[input.grammar] : undefined;

  if (!grammar) {
    // Authored scenes: replay the hand-written opening, then fall back.
    const authored = shotAt(input.authored ?? [], t);
    if (authored && t < OPENING_LOCK_MS) {
      return { shot: authored.shot, slot: authored.slot, locked: authored.control === 'locked', reason: 'authored opening' };
    }
    if (authored) return { shot: authored.shot, slot: authored.slot, locked: false, reason: 'authored' };
    if (input.pressureTriggered) return { shot: 'STATIC_TENSION', locked: false, reason: 'pressure' };
    return { shot: 'SOFT_FOLLOW', locked: false, reason: 'explore' };
  }

  let cursor = 0;
  for (const step of grammar.opening) {
    if (t >= cursor && t < cursor + step.ms) {
      return {
        shot: step.shot,
        slot: step.onSlot ? input.focusSlot : undefined,
        locked: !!step.locked && t < OPENING_LOCK_MS,
        reason: 'opening',
      };
    }
    cursor += step.ms;
  }

  // The most recent event whose window still covers this moment.
  const events = input.events ?? [];
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.atMs > t) continue;
    const reaction = grammar.reactions[event.kind];
    if (!reaction) continue;
    if (t < event.atMs + reaction.ms) {
      return {
        shot: reaction.shot,
        slot: reaction.onSlot ? event.slot : undefined,
        actor: event.actor,
        locked: false,
        reason: `event:${event.kind}`,
      };
    }
    // Only the latest framed event can own the lens; older ones have passed.
    break;
  }

  if (grammar.commitAvailable && input.commitAvailableAt != null) {
    const since = t - input.commitAvailableAt;
    if (since >= 0 && since < grammar.commitAvailable.ms) {
      return { shot: grammar.commitAvailable.shot, locked: false, reason: 'commit available' };
    }
  }

  if (input.pressureTriggered) return { shot: grammar.pressure, locked: false, reason: 'pressure' };
  return { shot: grammar.explore, locked: false, reason: 'explore' };
}
