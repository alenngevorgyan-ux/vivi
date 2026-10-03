/**
 * EXPERIENCE V2 — the situation layer.
 *
 * The DSL says what is in the room and what can happen in it. This layer says
 * what the player is *deciding*: the moment, what the hero knows, why it is
 * hard, what can be looked at without consequence (observations) and what is
 * a deed (commitments). It is versioned on its own so a scene compiled before
 * it existed is never silently reinterpreted: such scenes go through an
 * explicit, tested adapter (`origin: 'legacy_adapter'`).
 *
 * Nothing here is a coordinate, a timing or a camera move. Those stay with the
 * compiler and the runtime.
 */

export const EXPERIENCE_VERSION = 2 as const;

export type ExperienceFormat = 'playable' | 'illustrated_memory' | 'text_story';

/** Concrete information a playable situation needs, named rather than scored. */
export type MissingInfo =
  | 'perspective' // the story is not told from inside it
  | 'decision_moment' // nothing in it had to be decided
  | 'alternatives' // fewer than two deeds that differ in meaning
  | 'stakes' // nothing says why it was hard
  | 'author_act'; // the author has not said what they did

/** Where in the author's own words a fact comes from. */
export interface FactRef {
  /** Index of the sentence in the text before the decision. */
  sentence: number;
  /** That sentence, verbatim. */
  quote: string;
}

export interface SituationFact {
  id: string;
  text: string;
  ref?: FactRef;
  /**
   * `author_text` — found in the author's words; `unsourced` — proposed by the
   * model and not found there, shown to the author for confirmation;
   * `author_confirmed` — the author kept it in preview.
   */
  origin: 'author_text' | 'unsourced' | 'author_confirmed';
}

/** How a deed is physically performed. Chosen by the engine from the verb, never by a model. */
export type EnactmentKind =
  | 'inspect_object' // read, open or look at a thing
  | 'address_person' // ask, tell, confront — the hero speaks; nobody answers
  | 'speak_up' // say it in the room
  | 'use_device' // call someone, call for help
  | 'leave' // walk out
  | 'hold' // wait, stay
  | 'secure' // lock
  | 'handle_object' // keep, hide, show, put back
  | 'move_to'; // follow, board, return

/**
 * What a deed *means*. Two commitments are different choices when their
 * meaning differs — opening a door and locking it are two choices at one door;
 * three ways to touch three objects can be one choice.
 */
export type MeaningFamily =
  | 'look_private'
  | 'address'
  | 'speak_public'
  | 'withdraw'
  | 'hold'
  | 'seek_help'
  | 'secure'
  | 'open_up'
  | 'keep'
  | 'show'
  | 'refuse'
  | 'accept'
  | 'give_back'
  | 'go_toward';

/** Where an intent lives in the room. Mirrors RuntimeAction's targeting, without coordinates. */
export interface IntentTarget {
  /** World slot, `actor:<id>` or `carried`. */
  targetSlot: string;
  actorId?: string;
  objectId?: string;
  carried?: boolean;
}

export interface ObservationSpec extends IntentTarget {
  id: string;
  /** What the player does: "Look at the screen". */
  label: string;
  /** What is seen or known. Only confirmed content. */
  reveals: string;
  ref?: FactRef;
  sourced: boolean;
}

export interface CommitmentSpec extends IntentTarget {
  /** Same id as the RuntimeAction it stages. */
  id: string;
  /** The deed, in the story's language: "Open the conversation". */
  label: string;
  verb: string;
  meaning: MeaningFamily;
  enactment: EnactmentKind;
  /**
   * Confirmed content the deed shows when it is a reading — e.g. the message
   * text the story quotes. Absent when the story does not say.
   */
  shows?: string;
}

export interface ExperienceV2 {
  version: typeof EXPERIENCE_VERSION;
  format: ExperienceFormat;
  missing: MissingInfo[];
  /** The one question that would help most, when one would. */
  clarify?: MissingInfo;
  moment?: { text: string; ref?: FactRef };
  whyHard?: { text: string; ref?: FactRef };
  facts: SituationFact[];
  observations: ObservationSpec[];
  commitments: CommitmentSpec[];
  /** Scene time after which every deed is offered: the end of the mandatory orientation. */
  orientationMs: number;
  /** How the text before the decision was obtained. */
  boundary: { mode: 'author_confirmed' | 'auto_split' | 'none'; removedChars: number };
  origin: 'compiled' | 'legacy_adapter';
  /** Items the author removed in preview; kept so a recompile can honour them. */
  removed?: string[];
}
