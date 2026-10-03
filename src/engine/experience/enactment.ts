import type { CharacterPose } from '../../assets/characters/characters.ts';
import type { UiKey } from './copy.ts';
import type { CommitmentSpec, EnactmentKind } from './types.ts';

/**
 * How the hero performs a deed.
 *
 * Every recipe moves only the hero. Nobody else in the room is given a new
 * cue, a line or a reaction: the scene shows what the player chose, not an
 * invented answer to it. When the story does not say what comes next, the
 * scene stops there — and says so.
 */

export interface EnactmentRecipe {
  kind: EnactmentKind;
  /** Whether the hero walks to the target first. */
  approach: boolean;
  /** The gesture, held at the target. */
  gesture: CharacterPose;
  /** A short preparatory gesture before it (reach before reading, a breath before speaking). */
  lead?: CharacterPose;
  /** How long the gesture is held, ms. */
  holdMs: number;
  /** The hero walks out of frame. */
  exits?: boolean;
  /** Camera intent while the gesture is held; the director turns it into a shot. */
  camera: 'insert' | 'two_shot' | 'wide' | 'hero';
  /** Interface note shown under the deed, from `copy.ts`. Never a reaction. */
  note?: UiKey;
}

const RECIPES: Record<EnactmentKind, EnactmentRecipe> = {
  // Leaning over the thing where it lies: the hero does not pick up someone else's phone into their own hand.
  inspect_object: { kind: 'inspect_object', approach: true, lead: 'hesitate', gesture: 'reach', holdMs: 2600, camera: 'insert', note: 'unknownContent' },
  address_person: { kind: 'address_person', approach: true, lead: 'hesitate', gesture: 'talk', holdMs: 2400, camera: 'two_shot', note: 'noReply' },
  speak_up: { kind: 'speak_up', approach: false, lead: 'raise_hand', gesture: 'talk', holdMs: 2600, camera: 'hero', note: 'noReply' },
  use_device: { kind: 'use_device', approach: false, gesture: 'look_at_phone', holdMs: 2400, camera: 'hero', note: 'noReply' },
  leave: { kind: 'leave', approach: true, lead: 'turn', gesture: 'leave', holdMs: 900, exits: true, camera: 'wide', note: 'sceneEnd' },
  hold: { kind: 'hold', approach: false, lead: 'hesitate', gesture: 'wait', holdMs: 3000, camera: 'wide', note: 'sceneEnd' },
  secure: { kind: 'secure', approach: true, lead: 'reach', gesture: 'turn', holdMs: 1800, camera: 'insert', note: 'sceneEnd' },
  handle_object: { kind: 'handle_object', approach: true, lead: 'reach', gesture: 'turn', holdMs: 2000, camera: 'insert', note: 'sceneEnd' },
  move_to: { kind: 'move_to', approach: true, gesture: 'wait', holdMs: 1600, camera: 'wide', note: 'sceneEnd' },
};

export function recipeFor(commitment: Pick<CommitmentSpec, 'enactment' | 'carried'>): EnactmentRecipe {
  const recipe = RECIPES[commitment.enactment] ?? RECIPES.hold;
  // A device already in the hero's hand is used where they stand, and looked at in the hand.
  if (commitment.carried) return { ...recipe, approach: false, ...(recipe.kind === 'inspect_object' ? { lead: undefined, gesture: 'look_at_phone' as const } : {}) };
  return recipe;
}

/** Total time a performance takes once the hero is in place, ms. */
export function performanceMs(recipe: EnactmentRecipe, reducedMotion = false): number {
  const lead = recipe.lead ? 700 : 0;
  return reducedMotion ? Math.min(1400, recipe.holdMs) : lead + recipe.holdMs;
}

/** The short pause between the deed and the scene boundary. */
export const AFTER_DEED_PAUSE_MS = 1100;
/** The boundary itself: the scene fades to paper. */
export const BOUNDARY_MS = 900;

/**
 * Every line of text the player sees while a deed is performed. Built from
 * the deed's own label, content the story itself quotes, and one neutral
 * interface note — nothing else, so it can be audited.
 */
export interface EnactmentScript {
  recipe: EnactmentRecipe;
  /** The deed, as the player chose it. */
  caption: string;
  /** Confirmed content the deed reveals (a quoted message), if any. */
  shows?: string;
  /** Interface note: what the story does not say. */
  note?: string;
}

export function enactmentScript(commitment: CommitmentSpec, translate: (key: UiKey) => string): EnactmentScript {
  const recipe = recipeFor(commitment);
  return {
    recipe,
    caption: commitment.label,
    ...(commitment.shows ? { shows: commitment.shows } : {}),
    ...(recipe.note ? { note: translate(recipe.note) } : {}),
  };
}
