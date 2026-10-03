import type { EnactmentKind, MeaningFamily } from './types.ts';

/**
 * Meaning and enactment of a deed, from its verb and what it acts on.
 *
 * The spatial classifier (`commitmentClasses.ts`) answers *where* a choice
 * happens. This answers *what it costs*: a private look, a question, a public
 * claim, a retreat. Variety is judged here, so "open the door" and "lock the
 * door" count as two choices while "read the phone" and "read the letter"
 * count as one.
 */

/** Things whose contents are someone's private business when opened. */
const PRIVATE_CONTENT = new Set(['phone', 'letter', 'envelope', 'document', 'laptop', 'bag', 'photo']);

export interface DeedTarget {
  objectId?: string;
  /** The deed acts on a person (in the room or through a door). */
  person?: boolean;
  /** A crowd or public room is listening. */
  publicScene?: boolean;
}

export function meaningOf(verb: string, target: DeedTarget = {}): MeaningFamily {
  switch (verb) {
    case 'read':
    case 'look':
      return 'look_private';
    case 'open':
      return target.objectId && PRIVATE_CONTENT.has(target.objectId) ? 'look_private' : 'open_up';
    case 'ask':
    case 'confront':
    case 'tell':
    case 'comfort':
    case 'answer':
      return 'address';
    case 'speak_up':
      return 'speak_public';
    case 'return':
      // Returning a thing to its owner is not the same deed as turning back.
      return target.objectId ? 'give_back' : 'withdraw';
    case 'leave':
    case 'hide':
      return 'withdraw';
    case 'wait':
    case 'stay':
      return 'hold';
    case 'call':
    case 'call_help':
      return 'seek_help';
    case 'lock':
      return 'secure';
    case 'keep':
      return 'keep';
    case 'show':
      return 'show';
    case 'refuse':
      return 'refuse';
    case 'accept':
      return 'accept';
    case 'follow':
    case 'board':
      return 'go_toward';
    default:
      return 'hold';
  }
}

export function enactmentOf(verb: string, target: DeedTarget = {}): EnactmentKind {
  switch (verb) {
    case 'read':
    case 'look':
      return 'inspect_object';
    case 'open':
      return target.objectId && PRIVATE_CONTENT.has(target.objectId) ? 'inspect_object' : 'handle_object';
    case 'ask':
    case 'confront':
    case 'tell':
    case 'comfort':
    case 'answer':
    case 'refuse':
    case 'accept':
      return target.person ? 'address_person' : target.objectId ? 'handle_object' : 'speak_up';
    case 'speak_up':
      return 'speak_up';
    case 'call':
    case 'call_help':
      return 'use_device';
    case 'leave':
    case 'hide':
      return 'leave';
    case 'wait':
    case 'stay':
      return 'hold';
    case 'lock':
      return 'secure';
    case 'keep':
    case 'show':
      return 'handle_object';
    case 'return':
      return target.objectId ? 'handle_object' : 'move_to';
    case 'follow':
    case 'board':
      return 'move_to';
    default:
      return 'hold';
  }
}

/** How many genuinely different choices a set of deeds offers. */
export function distinctMeanings(families: MeaningFamily[]): number {
  return new Set(families).size;
}
