import type { FactRef } from './types.ts';

/**
 * The decision boundary.
 *
 * Authors often tell the whole story in one breath — the moment *and* what
 * they did. Only the part before the decision may reach scene generation;
 * the rest is the reveal. A separate "what really happened" field is not
 * enough on its own, so the text is split here, the split is shown to the
 * author to confirm or move, and the server applies the same split when a
 * client never asked.
 *
 * This is a heuristic proposal, not an understanding of the story: it looks
 * for sentences that report what happened next ("in the end", "в итоге",
 * "հետո"). It errs toward cutting — a sentence wrongly held back can be moved
 * back by the author; a leaked ending cannot be unseen.
 */

/** Sentence-level markers that something after the decision is being reported. */
const AFTER_MARKERS: RegExp[] = [
  // English
  /\b(in the end|eventually|i ended up|i decided to|i chose to|i went with|so i (did|said|told|asked|opened|left|stayed|waited|called)|the next (day|morning|week)|later (that|on)|a (day|week|month|year) later|it turned out|afterwards|after that|what i did was|i never (did|told|asked|opened|said))\b/i,
  // Russian
  /(^|[^а-яё])(в итоге|в конце концов|в результате|я решил|я решила|я выбрал|я выбрала|на следующий день|на другой день|через (день|неделю|месяц|год|пару)|позже|потом я|после этого|оказалось|так и не|в тот вечер я|в итоге я)([^а-яё]|$)/i,
  // Armenian
  /(վերջում|հետո ես|հաջորդ օրը|որոշեցի|պարզվեց|արդյունքում|ի վերջո)/,
];

export interface SentenceSpan {
  index: number;
  text: string;
}

/** Split prose into sentences, keeping line breaks as boundaries too. */
export function splitSentences(text: string): SentenceSpan[] {
  const normalised = text.replace(/\r/g, '').trim();
  if (!normalised) return [];
  const parts: string[] = [];
  for (const line of normalised.split(/\n+/)) {
    // A sentence ends at . ! ? … or the Armenian full stop ։ (optionally followed by a closing quote).
    const pieces = line.match(/[^.!?…։]+(?:[.!?…։]+["»”’)]*|$)/g) ?? [line];
    for (const piece of pieces) {
      const t = piece.trim();
      if (t) parts.push(t);
    }
  }
  return parts.map((t, index) => ({ index, text: t }));
}

export interface BoundaryProposal {
  /** Text that may reach scene generation. */
  before: string;
  /** Text held back until the reveal. Empty when nothing was found. */
  after: string;
  sentences: SentenceSpan[];
  /** First sentence index of `after`, or `sentences.length` when nothing is cut. */
  cutAt: number;
  /** Which marker caused the cut, for the author preview. */
  marker?: string;
}

export function proposeBoundary(story: string): BoundaryProposal {
  const sentences = splitSentences(story);
  let cutAt = sentences.length;
  let marker: string | undefined;
  // The first sentence always stays: a story cannot begin after its own decision.
  for (let i = 1; i < sentences.length; i++) {
    const hit = AFTER_MARKERS.map(re => sentences[i].text.match(re)).find(Boolean);
    if (hit) {
      cutAt = i;
      marker = hit[0].trim();
      break;
    }
  }
  return {
    before: sentences.slice(0, cutAt).map(s => s.text).join(' '),
    after: sentences.slice(cutAt).map(s => s.text).join(' '),
    sentences,
    cutAt,
    ...(marker ? { marker } : {}),
  };
}

/** Rebuild a proposal from an author-chosen cut. */
export function boundaryAt(story: string, cutAt: number): BoundaryProposal {
  const sentences = splitSentences(story);
  const cut = Math.max(1, Math.min(sentences.length, Math.round(cutAt)));
  return {
    before: sentences.slice(0, cut).map(s => s.text).join(' '),
    after: sentences.slice(cut).map(s => s.text).join(' '),
    sentences,
    cutAt: cut,
  };
}

/* ------------------------------------------------------------ fact refs --- */

const stem = (w: string) => w.slice(0, 5);

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(w => w.length > 2).map(stem);
}

/**
 * Find the sentence of the author's text a short claim comes from.
 *
 * Word-stem overlap, nothing cleverer: a claim is sourced when most of its
 * content words appear in one sentence. A claim that is not found is not
 * thereby false — it is shown to the author to keep or remove.
 */
export function findFactRef(claim: string, source: string | SentenceSpan[], threshold = 0.5): FactRef | undefined {
  const sentences = typeof source === 'string' ? splitSentences(source) : source;
  const want = [...new Set(tokens(claim))];
  if (!want.length) return undefined;
  let best: { s: SentenceSpan; score: number } | undefined;
  for (const s of sentences) {
    const have = new Set(tokens(s.text));
    const score = want.filter(w => have.has(w)).length / want.length;
    if (!best || score > best.score) best = { s, score };
  }
  return best && best.score >= threshold ? { sentence: best.s.index, quote: best.s.text } : undefined;
}

/* ---------------------------------------------------------- perspective --- */

const FIRST_PERSON: RegExp[] = [
  /\b(i|i'm|i'd|i've|me|my|mine|we|us|our)\b/i,
  /(^|[^а-яё])(я|меня|мне|мной|мой|моя|моё|мое|мои|моего|моей|моём|моем|моему|мою|моих|моим|мы|нас|нам|наш|наша|наши|нашем)([^а-яё]|$)/i,
  /(^|[^Ա-և])(ես|ինձ|իմ|մենք|մեզ|մեր|ինձնից)([^Ա-և]|$)/iu,
];

/** The story is told from inside it: someone says "I". */
export function hasFirstPerson(...texts: Array<string | undefined>): boolean {
  return texts.some(t => !!t && FIRST_PERSON.some(re => re.test(t)));
}
