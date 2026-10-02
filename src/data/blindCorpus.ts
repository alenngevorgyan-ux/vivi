import type { EvalStory } from './evalCorpus.ts';

/**
 * BLIND SET — fresh stories written for the live model bakeoff.
 *
 * Neither the compiler rules nor the prompt were tuned against these. They
 * exist to catch a model (or a prompt) that only does well on the corpus it
 * was developed with. Do not special-case these ids anywhere in src/engine.
 *
 * `expect` here is a faithfulness rubric, deliberately loose: any acceptable
 * world, groups of acceptable objects/people (one of each group must appear),
 * which people the story allows on stage, and the kinds of event the central
 * moment could reasonably be written as. Anything subtler than that goes to
 * the human review table, not an automatic score.
 */
export interface BlindExpect {
  worlds?: string[];
  /** Each group: at least one of these key objects must be present. */
  objectGroups?: string[][];
  /** Each group: at least one of these roles must be in the cast. */
  peopleGroups?: string[][];
  /** Roles the story supports on stage (on/off). Anything else is an invented character. Background extras are exempt. */
  allowRoles?: string[];
  /** The central event: at least one event of these kinds. */
  centralEvents?: string[];
}

export interface BlindStory extends Omit<EvalStory, 'expect'> {
  lang: 'en' | 'ru' | 'hy';
  expect: BlindExpect;
}

export const BLIND_CORPUS: BlindStory[] = [
  // ------------------------------------------------------------- English
  {
    id: 'blind-en-rel-laptop', lang: 'en', category: 'relationships',
    story: 'My wife left her laptop open on the sofa. A video call from her ex was ringing on the screen.',
    expect: { worlds: ['apt', 'bedroom', 'home'], objectGroups: [['laptop', 'screen']], allowRoles: ['partner', 'ex'], centralEvents: ['call', 'msg', 'notice'] },
  },
  {
    id: 'blind-en-work-email', lang: 'en', category: 'work',
    story: 'My boss forwarded me an email meant for HR. It said I would be fired on Friday, and he was walking toward my desk.',
    expect: { worlds: ['office'], objectGroups: [['laptop', 'screen', 'document', 'phone']], peopleGroups: [['boss']], allowRoles: ['boss', 'coworker', 'colleague'], centralEvents: ['approach', 'msg', 'notice', 'enter'] },
  },
  {
    id: 'blind-en-creepy-tv', lang: 'en', category: 'creepy',
    story: "Every night at 1:15 AM my neighbor's TV turns on at full volume, but the neighbor moved out a month ago.",
    expect: { worlds: ['hall', 'apt', 'bedroom'], allowRoles: ['neighbor'], centralEvents: ['sound', 'clock'] },
  },
  {
    id: 'blind-en-money-atm', lang: 'en', category: 'money',
    story: 'At the ATM, the person before me walked away and left their card in the machine with the screen still showing their balance.',
    expect: { worlds: ['street', 'station'], allowRoles: ['stranger', 'commuter'] },
  },
  {
    id: 'blind-en-social-speech', lang: 'en', category: 'social',
    story: "I gave a speech at my friend's birthday dinner and realised halfway through that I was reading the wrong page.",
    expect: { worlds: ['bar', 'home'], peopleGroups: [['friend', 'guest', 'host']], allowRoles: ['friend', 'guest', 'host'], centralEvents: ['stare', 'notice', 'say'] },
  },
  {
    id: 'blind-en-moral-cover', lang: 'en', category: 'moral',
    story: 'My coworker asked me to cover for him because he was drunk at work. Our manager just asked me where he was.',
    expect: { worlds: ['office'], peopleGroups: [['boss']], allowRoles: ['coworker', 'colleague', 'boss'], centralEvents: ['say', 'approach', 'enter'] },
  },
  {
    id: 'blind-en-strange-call', lang: 'en', category: 'strange',
    story: 'My phone showed a missed call from my own number at 4 AM.',
    expect: { worlds: ['bedroom', 'apt'], objectGroups: [['phone']], allowRoles: [], centralEvents: ['call', 'clock', 'notice', 'msg'] },
  },
  {
    id: 'blind-en-dep-bus', lang: 'en', category: 'departure',
    story: "At the bus station my brother told me he wasn't coming back home. The bus doors were already open.",
    expect: { worlds: ['station', 'street', 'park'], peopleGroups: [['sibling']], allowRoles: ['sibling', 'commuter', 'stranger'], centralEvents: ['depart', 'arrive', 'say', 'open'] },
  },

  // ------------------------------------------------------------- Russian
  {
    id: 'blind-ru-family-bank', lang: 'ru', category: 'family',
    story: 'На кухне у мамы я увидел письмо из банка: она заложила квартиру и никому не сказала.',
    expect: { worlds: ['home', 'apt'], objectGroups: [['letter', 'document', 'envelope']], allowRoles: ['parent', 'relative', 'sibling'], centralEvents: ['notice', 'msg', 'enter'] },
  },
  {
    id: 'blind-ru-friend-lie', lang: 'ru', category: 'friendship',
    story: 'На вечеринке лучший друг попросил меня соврать его жене, где он был вчера. Она уже шла к нам.',
    expect: { worlds: ['bar'], peopleGroups: [['friend']], allowRoles: ['friend', 'guest', 'stranger', 'partner', 'host'], centralEvents: ['approach', 'enter', 'say'] },
  },
  {
    id: 'blind-ru-creepy-window', lang: 'ru', category: 'creepy',
    story: 'Я вернулась домой и увидела, что окно в спальне открыто, хотя утром я его закрывала. На подоконнике лежали чужие ключи.',
    expect: { worlds: ['bedroom', 'apt'], objectGroups: [['keys']], allowRoles: [], centralEvents: ['notice', 'sound', 'light'] },
  },
  {
    id: 'blind-ru-work-blame', lang: 'ru', category: 'work',
    story: 'Директор на общем совещании спросил, кто сорвал сроки. Все молча посмотрели на меня, хотя виноват был мой начальник.',
    expect: { worlds: ['office'], peopleGroups: [['boss']], allowRoles: ['boss', 'coworker', 'colleague'], centralEvents: ['stare', 'say'] },
  },
  {
    id: 'blind-ru-money-taxi', lang: 'ru', category: 'money',
    story: 'В такси я нашёл забытую сумку, а в ней пачку денег и чужой паспорт.',
    expect: { worlds: ['street'], objectGroups: [['bag', 'document', 'envelope']], allowRoles: ['stranger'] },
  },
  {
    id: 'blind-ru-dep-airport', lang: 'ru', category: 'departure',
    story: 'Мама провожала меня на вокзале и в последний момент сказала, что болеет уже полгода.',
    expect: { worlds: ['station'], peopleGroups: [['parent']], allowRoles: ['parent', 'commuter', 'stranger'], centralEvents: ['say', 'countdown', 'depart', 'clock', 'arrive'] },
  },
  {
    id: 'blind-ru-strange-note', lang: 'ru', category: 'strange',
    story: 'В лифте кто-то оставил записку с моим именем и номером моей квартиры.',
    expect: { worlds: ['hall'], objectGroups: [['letter', 'document', 'envelope']], allowRoles: ['neighbor', 'stranger'], centralEvents: ['notice', 'elevator'] },
  },

  // ------------------------------------------------------------ Armenian
  {
    id: 'blind-hy-rel-car', lang: 'hy', category: 'relationships',
    story: 'Ամուսինս ասաց, որ գործուղման է, բայց ես նրա մեքենան տեսա մեր փողոցում։',
    expect: { worlds: ['street', 'apt', 'park'], allowRoles: ['partner', 'stranger'] },
  },
  {
    id: 'blind-hy-family-phone', lang: 'hy', category: 'family',
    story: 'Հայրիկիս հեռախոսում տեսա հաղորդագրություն անծանոթ կնոջից, որը նրան «սիրելիս» էր անվանում։',
    expect: { worlds: ['home', 'apt'], objectGroups: [['phone']], allowRoles: ['parent', 'stranger'], centralEvents: ['msg', 'notice'] },
  },
  {
    id: 'blind-hy-work-idea', lang: 'hy', category: 'work',
    story: 'Գործընկերս ժողովի ժամանակ իմ գաղափարը ներկայացրեց որպես իրենը, և ղեկավարը նրան գովեց։',
    expect: { worlds: ['office'], peopleGroups: [['coworker', 'colleague']], allowRoles: ['coworker', 'colleague', 'boss'], centralEvents: ['say', 'stare', 'notice'] },
  },
  {
    id: 'blind-hy-social-toast', lang: 'hy', category: 'social',
    story: 'Հարսանիքում ինձ խնդրեցին կենաց ասել, իսկ ես մոռացել էի հարսնացուի անունը։',
    expect: { worlds: ['bar'], allowRoles: ['guest', 'host', 'friend', 'relative', 'sibling'], centralEvents: ['stare', 'say'] },
  },
  {
    id: 'blind-hy-moral-change', lang: 'hy', category: 'moral',
    story: 'Խանութում վաճառողը ինձ ավելի շատ մանր վերադարձրեց, քան պետք էր, և արդեն հաջորդ գնորդին էր սպասարկում։',
    expect: { allowRoles: ['stranger', 'host', 'commuter'] },
  },
  {
    id: 'blind-hy-creepy-knock', lang: 'hy', category: 'creepy',
    story: 'Գիշերը ժամը 3-ին ինչ-որ մեկը թակեց դուռը, բայց միջանցքում ոչ ոք չկար։',
    expect: { worlds: ['hall'], objectGroups: [['door']], allowRoles: ['neighbor', 'stranger'], centralEvents: ['sound', 'handle', 'open'] },
  },
  {
    id: 'blind-hy-dep-train', lang: 'hy', category: 'departure',
    story: 'Եղբայրս կայարանում ասաց, որ այլևս չի վերադառնա Հայաստան, իսկ գնացքն արդեն շարժվում էր։',
    expect: { worlds: ['station'], peopleGroups: [['sibling']], allowRoles: ['sibling', 'commuter'], centralEvents: ['depart', 'say', 'countdown'] },
  },
];
