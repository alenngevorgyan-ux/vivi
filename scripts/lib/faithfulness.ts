/**
 * Story-faithfulness rubric for live model output.
 *
 * Schema validity is not enough: a valid program about the wrong story is a
 * failure. These checks are the objectively measurable part of the rubric —
 * the explicit expectations written next to each story, plus two objective
 * proxies (object focus, real commitment copy). Everything subtler (is the
 * central tension right? do the choices matter?) goes to the review table in
 * the report, not into a number.
 */
import type { ViviExperienceDSL } from '../../src/engine/compiler/dsl.ts';
import { LIMITS, OBJECTS, PLACES, ROLES, VERBS } from '../../src/engine/compiler/vocabulary.ts';
import type { BlindExpect } from '../../src/data/blindCorpus.ts';

export type Lang = 'en' | 'ru' | 'hy';

export interface FaithfulnessExpect extends BlindExpect {
  /** Flat list from the original corpus: every one must be present. */
  objects?: string[];
}

export interface FaithfulnessResult {
  world: boolean | null;
  objects: boolean | null;
  people: boolean | null;
  noInventedCharacter: boolean | null;
  centralEvent: boolean | null;
  language: boolean;
  /** At most LIMITS.objects key objects: the important object is not drowned in props. */
  focusedObjects: boolean;
  /**
   * Every commitment carries real copy: a label that is not a bare vocabulary
   * symbol, and an observation and an outcome of at least three words each;
   * no two labels alike.
   */
  meaningfulCommitments: boolean;
  /** Share of letters in the expected script across all player-facing copy. */
  languageShare: number;
  inventedRoles: string[];
}

const SCRIPT: Record<Lang, RegExp> = {
  en: /[A-Za-z]/,
  ru: /[Ѐ-ӿ]/,
  hy: /[Ա-֏]/,
};

/** Every player-facing string the model wrote. */
export function playerCopy(dsl: ViviExperienceDSL): string[] {
  const out: string[] = [];
  if (dsl.x) out.push(...Object.values(dsl.x).filter((v): v is string => typeof v === 'string'));
  for (const a of dsl.a) out.push(...a.slice(2).filter((v): v is string => typeof v === 'string'));
  for (const e of dsl.e) if (e[0] === 'say' || e[0] === 'msg') out.push(String(e[2] ?? ''));
  return out.filter(Boolean);
}

export function scriptShare(texts: string[], lang: Lang): number {
  let match = 0;
  let letters = 0;
  for (const ch of texts.join(' ')) {
    if (!/\p{L}/u.test(ch)) continue;
    letters++;
    if (SCRIPT[lang].test(ch)) match++;
  }
  return letters ? match / letters : 0;
}

const SYMBOLS = new Set<string>([...OBJECTS, ...PLACES, ...ROLES, ...VERBS]);
const words = (t: unknown) => (typeof t === 'string' ? t.trim().split(/\s+/).filter(Boolean).length : 0);
const isSymbol = (t: unknown) => typeof t === 'string' && SYMBOLS.has(t.trim().toLowerCase());

export function meaningfulCommitments(dsl: ViviExperienceDSL): boolean {
  const labels = dsl.a.map(a => String(a[2] ?? '').trim().toLowerCase());
  if (new Set(labels).size !== labels.length) return false;
  return dsl.a.every(a => words(a[2]) >= 1 && !isSymbol(a[2]) && words(a[3]) >= 3 && !isSymbol(a[3]) && words(a[4]) >= 3 && !isSymbol(a[4]));
}

export function scoreFaithfulness(dsl: ViviExperienceDSL, lang: Lang, expect: FaithfulnessExpect = {}): FaithfulnessResult {
  const cast = new Set(dsl.c.map(c => c[0] as string));
  const staged = dsl.c.filter(c => c[1] !== 'bg').map(c => c[0] as string);
  const objects = new Set(dsl.o as string[]);
  const kinds = new Set(dsl.e.map(e => e[0] as string));

  const objectGroups = [...(expect.objectGroups ?? []), ...(expect.objects ?? []).map(o => [o])];
  const inventedRoles = expect.allowRoles ? staged.filter(r => !expect.allowRoles!.includes(r)) : [];
  const share = scriptShare(playerCopy(dsl), lang);

  return {
    world: expect.worlds ? expect.worlds.includes(dsl.w) : null,
    objects: objectGroups.length ? objectGroups.every(g => g.some(o => objects.has(o))) : null,
    people: expect.peopleGroups ? expect.peopleGroups.every(g => g.some(r => cast.has(r))) : null,
    noInventedCharacter: expect.allowRoles ? inventedRoles.length === 0 : null,
    centralEvent: expect.centralEvents ? expect.centralEvents.some(k => kinds.has(k)) : null,
    language: share >= 0.7,
    focusedObjects: dsl.o.length <= LIMITS.objects,
    meaningfulCommitments: meaningfulCommitments(dsl),
    languageShare: share,
    inventedRoles,
  };
}
