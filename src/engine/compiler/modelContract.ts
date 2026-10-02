import {
  WORLDS,
  GRAMMARS,
  TONES,
  ROLES,
  OBJECTS,
  PLACES,
  SOUNDS,
  VEHICLES,
  VERBS,
  CAMERA_GRAMMARS,
  STAGINGS,
} from './vocabulary.ts';
import { hintLine, type StoryHints } from './preprocess.ts';

/**
 * The entire model-facing contract.
 *
 * It is deliberately small: the task, the vocabulary, the truth rules and the
 * shape. World layouts, camera values, lighting, sound and collision live in
 * the compiler and are never sent. Every symbol below comes from
 * vocabulary.ts, so the prompt cannot drift from what the validator accepts.
 */
export const MODEL_SYSTEM_PROMPT = [
  'Turn a short personal story into a Vivi DSL program: a tiny scene someone can walk into and make one choice in.',
  'Reply with ONE JSON object only.',
  '',
  'Shape (arrays are positional):',
  '{"v":1,"w":W,"g":G,"t":T,"c":[[ROLE,P,count?]],"o":[OBJ],"e":[[EVENT,...args]],"a":[[VERB,TARGET,"label","observation","outcome"]],"cg":CG,"st":ST,"x":{"ti":"title","op":"opening line","q":"question to the reader"}}',
  `W ${Object.keys(WORLDS).join('|')}`,
  `G ${GRAMMARS.join('|')}`,
  `T ${TONES.join('|')}`,
  `ROLE ${ROLES.join('|')}`,
  'P on=in the room | off=only through a phone or intercom | bg=background people (count 1-4)',
  `OBJ ${OBJECTS.join('|')}`,
  `PLACE ${PLACES.join('|')}`,
  `SOUND ${SOUNDS.join('|')}`,
  `VEHICLE ${VEHICLES.join('|')}`,
  'EVENT exit ROLE PLACE? | enter ROLE PLACE? | approach ROLE | say ROLE "line" | msg OBJ "text" | call OBJ ROLE? | typing OBJ | sound SOUND | stop SOUND | handle PLACE | open PLACE | elevator "empty"? | clock "HH:MM" | countdown OBJ seconds? | arrive VEHICLE | depart VEHICLE | light flicker|dim|out | notice OBJ | stare ROLE|"crowd" | echo OBJ',
  `VERB ${VERBS.join('|')}`,
  'TARGET an OBJ, a ROLE from c, a PLACE, or null',
  `CG ${CAMERA_GRAMMARS.join('|')} (optional)`,
  `ST ${STAGINGS.join('|')} (optional)`,
  '',
  'Rules:',
  '- Events in story order: what is set up, the moment something changes, then what closes the window. At most 9.',
  '- HINTS are read from the author\'s own words: take world~ and people= unless the story plainly says otherwise.',
  '- 2-4 commitments, never paraphrases of one act: at least two must reach for different things — an object, a person in the room, a way out, or staying put.',
  '- Write label, observation, outcome, title and lines in the story\'s language. Label ≤6 words; observation and outcome a phrase of 3-20 words, never a fragment.',
  '- The outcome is only the next moment after the player acts. Never say what really happened afterwards.',
  '- No coordinates, sizes, timings, colours or camera directions. Omit anything you are unsure of.',
].join('\n');

export function modelUserPrompt(story: string, hints: StoryHints): string {
  return `STORY: ${hints.text || story}\nHINTS: ${hintLine(hints)}`;
}

export function modelRepairPrompt(invalidJson: string, errors: string[]): string {
  return `This DSL failed validation. Return the corrected JSON object only.\nERRORS:\n${errors
    .slice(0, 12)
    .map(e => `- ${e}`)
    .join('\n')}\nDSL:\n${invalidJson}`;
}

/** Pull the first JSON object out of a model reply, tolerating code fences. */
export function parseModelJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Model reply contained no JSON object.');
  return JSON.parse(cleaned.slice(start, end + 1));
}
