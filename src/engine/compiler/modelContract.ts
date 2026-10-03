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
  '{"v":1,"w":W,"g":G,"t":T,"c":[[ROLE,P,count?]],"o":[OBJ],"e":[[EVENT,...args]],"a":[[VERB,TARGET,"label"]],"ob":[[TARGET,"what is seen","label"]],"m":{"d":"decision moment","h":"why it is hard","k":["fact"],"f":"play"},"cg":CG,"st":ST,"x":{"ti":"title","op":"opening line","q":"question to the reader"}}',
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
  '- 2-4 deeds that differ in what they mean and cost, never paraphrases of one act — e.g. look in private, ask, leave, wait. At least two reach for different things.',
  '- a are deeds that end the scene; ob (0-3) is looking without consequence. Opening someone\'s private messages is a deed, not a look.',
  '- m.d the moment the narrator must decide; m.h why it is hard; m.k up to 4 facts they know then. All from the story. m.f memory if nothing had to be decided.',
  '- Only what the story says. Never invent a reply, a second message, a sound, a person arriving or anyone\'s reaction.',
  '- Write labels, ob, m, title and lines in the story\'s language. Label ≤6 words.',
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
