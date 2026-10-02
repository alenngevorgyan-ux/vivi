import { detectLanguage, type Lang } from './i18n.ts';
import type { DslGrammar, DslObject, DslRole, DslWorld, DslSound } from './vocabulary.ts';

/**
 * Cheap, deterministic preprocessing before any model is called.
 *
 * These are hints, not understanding: obvious location words, who is
 * mentioned, which objects appear, a clock time, a quoted line. A model gets
 * them as a few tokens of context so it spends no reasoning on extraction;
 * the deterministic fallback builds a whole experience from them. Keyword
 * tables cover English, Russian and Armenian stems; anything else simply
 * yields weaker hints, never wrong structure.
 */
export interface StoryHints {
  lang: Lang;
  /** Whitespace-normalised story. */
  text: string;
  chars: number;
  world?: DslWorld;
  worldScores: Partial<Record<DslWorld, number>>;
  grammar?: DslGrammar;
  grammarScores: Partial<Record<DslGrammar, number>>;
  roles: DslRole[];
  /** Roles only present through a device (a call, a message). */
  remoteRoles: DslRole[];
  objects: DslObject[];
  sounds: DslSound[];
  /** A clock time named in the story, e.g. "03:17". */
  clock?: string;
  /** A short quoted line, e.g. a message text. */
  quote?: string;
  /** Minutes of pressure named in the story ("five minutes before"). */
  minutes?: number;
  /** The author supplied an outcome (never its content — only that it exists). */
  hasOutcome: boolean;
  /** A crowd is implied (meeting, party, wedding, platform). */
  publicScene: boolean;
}

type Table<K extends string> = Array<[K, RegExp]>;

const WORLD_WORDS: Table<DslWorld> = [
  ['office', /\b(office|meeting|boss|manager|coworker|co-worker|colleague|slides?|presentation|director|my team|at work|work)\b|офис|совещан|планерк|начальни|руковод|коллег|презентац|директор|слайд|на работе|աշխատանք|գրասենյակ|ղեկավար|գործընկեր|հանդիպում/i],
  ['station', /\b(train|station|platform|metro|subway|railway)\b|поезд|вокзал|станци|платформ|электричк|метро|գնացք|կայարան/i],
  ['hall', /\b(elevator|lift|intercom|hallway|corridor|doorbell|landing|stairwell|door handle)\b|лифт|домофон|подъезд|коридор|лестничн|площадк|глазок|վերելակ|դոմոֆոն|միջանցք/i],
  ['apt', /\b(apartment|flat|shower|sofa|couch|kitchen|living room|our place)\b|квартир|душ|диван|кухн|гостин|բնակարան|լոգարան|բազմոց/i],
  ['bedroom', /\b(bed|bedroom|woke up|pillow)\b|кроват|спальн|проснул|ննջասենյակ|մահճակալ/i],
  ['rental', /\b(rented|rental|airbnb|hotel|check-?in|hostel|guesthouse)\b|снял[аи]? квартир|аренд|отел|гостиниц|хостел|վարձով|հյուրանոց/i],
  ['bar', /\b(party|bar|wedding|club|restaurant|birthday|reception|ceremony|celebration)\b|вечеринк|бар(?![а-яё])|свадьб|клуб|ресторан|день рождени|торжеств|խնջույք|հարսանիք|ռեստորան/i],
  ['home', /\b(family|parents|mother|father|mom|dad|grandmother|grandfather|attic|my childhood home)\b|семь|мама|мать|папа|отец|бабушк|дедушк|родител|чердак|ընտանիք|մայր|հայր|տատիկ/i],
  ['street', /\b(street|rain|outside|car|sidewalk|crosswalk|parking)\b|улиц|дожд|машин|тротуар|парковк|փողոց|անձրև|մեքենա/i],
  ['park', /\b(park|walk|bus stop|bench|neighbou?rhood)\b|парк|прогулк|остановк|скамейк|այգի|զբոսանք|կանգառ/i],
];

const GRAMMAR_WORDS: Table<DslGrammar> = [
  ['betrayal', /\b(cheat|cheating|affair|lover|smell like you|someone (i|we) didn'?t know|another (woman|man))\b|измен|любовни|чуж(ой|ая|ое) (номер|сообщен)|դավաճան/i],
  ['intrusion', /\b(3 ?am|3:\d\d|nobody|no one|no-one|someone was|strange noise|footsteps|handle moved|empty)\b|никого|ноч(ью|и)|кто-то|шаги|ручка|пуст|ոչ ոք|գիշեր/i],
  ['credit', /\b(credit|my work|my slides|as (his|her|their) own|took credit|responsibility|blame|mistake (i|we) hadn'?t made)\b|выдал[аи]? за сво|мою работу|ответственност|взять вину|чужую ошибку|не мою ошибку|պատասխանատվ|մեղք/i],
  ['scrutiny', /\b(everyone (looked|was looking|stared)|in front of everyone|embarrass|laughed at|publicly|all eyes)\b|при всех|все смотрели|стыдно|засмеял|բոլորի առաջ/i],
  ['find', /\b(found|find|wallet|lost and found|left behind|cash|money|transfer(red)?|by mistake)\b|наш[её]л|нашла|находк|кошел[её]к|деньг|конверт|сумм|перевел|по ошибке|գտա|փող|դրամ/i],
  ['temptation', /\b(offered (me )?(money|cash)|bribe|pay me|paid me|for cash|no questions)\b|предложил[аи]? деньг|заплат|взятк|կաշառք|վճարել/i],
  ['secret', /\b(secret|confess(ed)?|nobody else knew|no one else knew|told me something|promise not to tell)\b|секрет|тайн|признал|никто не знал|գաղտնիք|խոստովան/i],
  ['departure', /\b(leaving|leave town|moving away|last train|goodbye|before i left|flight|airport|departure)\b|уезжа|прощ|последн(ий|юю) (поезд|электричк)|перед отъездом|հեռանում|հրաժեշտ/i],
  ['family', /\b(adopted|my real (father|mother)|will|inheritance|birth certificate|family secret)\b|усынов|удочер|завещан|наследств|свидетельств|ընտանեկան|որդեգր/i],
  ['message', /\b(message|text(ed)?|notification|dm|screenshot|chat|whatsapp|telegram)\b|сообщени|написал|переписк|скриншот|уведомлен|чат|հաղորդագր|նամակ/i],
  ['stranger', /\b(stranger|followed|following me|a man in|a woman in|someone i didn'?t know|unknown man)\b|незнаком|следил|преслед|անծանոթ|հետևում/i],
  ['transition', /\b(quit|new job|pregnan|diagnos|proposed|proposal|moving in|graduat|divorce)\b|уволи|беремен|диагноз|предложени[ея] руки|развод|поступ|հղի|ախտորոշ|ամուսնալուծ/i],
];

const ROLE_WORDS: Table<DslRole> = [
  ['partner', /\b(partner|boyfriend|girlfriend|husband|wife|fianc[eé]e?|spouse)\b|партн[её]р|парн|девушк|муж(?![а-яё])|мужа|жена|жены|жених|невест|զուգընկեր|ամուսին|կին|ընկերուհ/i],
  ['ex', /\b(ex|ex-?(boyfriend|girlfriend|husband|wife))\b|бывш|նախկին/i],
  ['friend', /\b(friend|best friend|buddy|bff)\b|друг|подруг|приятел|ընկեր/i],
  ['sibling', /\b(sister|brother|sibling)\b|сестр|брат|քույր|եղբայր/i],
  ['parent', /\b(mother|father|mom|mum|dad|parents?)\b|мама|мать|мам[уы]|папа|отец|отца|родител|մայր|հայր|ծնող/i],
  ['relative', /\b(aunt|uncle|cousin|grand(mother|father|ma|pa))\b|т[её]т|дяд|кузен|бабушк|дедушк|մորաքույր|հորեղբայր|տատիկ|պապիկ/i],
  ['coworker', /\b(co-?worker|colleague|teammate)\b|коллег|сотрудни|գործընկեր/i],
  ['boss', /\b(boss|manager|director|supervisor|ceo|lead)\b|начальни|руковод|директор|менеджер|шеф|ղեկավար|տնօրեն|մենեջեր/i],
  ['stranger', /\b(stranger|a man|a woman|someone i didn'?t know|unknown)\b|незнаком|какой-то|անծանոթ/i],
  ['neighbor', /\b(neighbou?r)\b|сосед|հարևան/i],
  ['host', /\b(host|landlord|owner)\b|хозяин|хозяйк|арендодател|տանտեր/i],
];

const OBJECT_WORDS: Table<DslObject> = [
  ['phone', /\b(phone|message|text(ed)?|call(ed|ing)?|notification|screen lit|rang)\b|телефон|сообщен|позвонил|звонок|звонил|написал|смс|հեռախոս|զանգ|հաղորդագր/i],
  ['envelope', /\b(envelope)\b|конверт|ծրար/i],
  ['photo', /\b(photo|photograph|picture|polaroid)\b|фото|снимок|լուսանկար|նկար/i],
  ['document', /\b(document|contract|certificate|papers|report|will)\b|документ|договор|свидетельств|бумаг|отч[её]т|փաստաթուղթ|պայմանագիր/i],
  ['letter', /\b(letter|note)\b|письм|записк|նամակ/i],
  ['laptop', /\b(laptop|computer|files|drafts?|slides?|deck)\b|ноутбук|компьютер|файл|черновик|слайд|նոութբուք|համակարգիչ/i],
  ['screen', /\b(slides?|presentation|projector|screen)\b|слайд|презентац|экран|էկրան/i],
  ['ticket', /\b(ticket)\b|билет|տոմս/i],
  ['keys', /\b(keys?)\b|ключ|բանալի/i],
  ['elevator', /\b(elevator|lift)\b|лифт|վերելակ/i],
  ['intercom', /\b(intercom|doorbell|buzzer)\b|домофон|звонок в дверь|դոմոֆոն/i],
  ['train', /\b(train)\b|поезд|электричк|գնացք/i],
  ['door', /\b(door|handle)\b|двер|ручк|դուռ/i],
  ['bag', /\b(bag|suitcase|backpack)\b|сумк|чемодан|рюкзак|պայուսակ|ճամպրուկ/i],
];

const SOUND_WORDS: Table<DslSound> = [
  ['shower', /\b(shower)\b|душ|լոգանք/i],
  ['rain', /\b(rain(ing)?)\b|дожд|անձրև/i],
  ['music', /\b(music|song|band|dj)\b|музык|песн|երաժշտ/i],
  ['footsteps', /\b(footsteps|steps)\b|шаги|шагов|քայլեր/i],
  ['knock', /\b(knock(ed|ing)?)\b|стук|постуч|թակ/i],
  ['crowd', /\b(crowd|guests)\b|толп|гост[иея]|ամբոխ|հյուրեր/i],
];

const REMOTE = /\b(called|calling|call|texted|messaged|wrote|on the phone|rang)\b|позвонил|звонил|написал|по телефону|զանգ|գրեց/i;

function score<K extends string>(table: Table<K>, text: string): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {};
  for (const [key, re] of table) {
    const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    const n = (text.match(global) || []).length;
    if (n) out[key] = (out[key] ?? 0) + n;
  }
  return out;
}

function best<K extends string>(scores: Partial<Record<K, number>>): K | undefined {
  let top: K | undefined;
  let topN = 0;
  for (const [k, n] of Object.entries(scores) as Array<[K, number]>) {
    if (n > topN) {
      top = k;
      topN = n;
    }
  }
  return top;
}

const CATEGORY_WORLD: Record<string, DslWorld> = {
  work: 'office', creepy: 'hall', family: 'home', money: 'street', relationships: 'apt', romance: 'station',
  'social disaster': 'bar', memory: 'park',
};

const CATEGORY_GRAMMAR: Record<string, DslGrammar> = {
  work: 'credit', creepy: 'intrusion', family: 'family', money: 'temptation', relationships: 'betrayal',
  romance: 'departure', 'social disaster': 'scrutiny', 'moral dilemma': 'find', 'life turning point': 'transition',
  memory: 'departure', 'strange moments': 'intrusion',
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20, thirty: 30,
  одну: 1, две: 2, три: 3, пять: 5, десять: 10, пятнадцать: 15, двадцать: 20, тридцать: 30,
};

export function preprocessStory(story: string, options: { category?: string; actualOutcome?: string } = {}): StoryHints {
  const text = story.replace(/\s+/g, ' ').trim();
  const lang = detectLanguage(text);
  const lower = text.toLowerCase();

  const worldScores = score(WORLD_WORDS, lower);
  const grammarScores = score(GRAMMAR_WORDS, lower);
  const category = options.category?.toLowerCase();
  if (category && CATEGORY_WORLD[category]) worldScores[CATEGORY_WORLD[category]] = (worldScores[CATEGORY_WORLD[category]] ?? 0) + 0.5;
  if (category && CATEGORY_GRAMMAR[category]) grammarScores[CATEGORY_GRAMMAR[category]] = (grammarScores[CATEGORY_GRAMMAR[category]] ?? 0) + 0.5;

  const roleScores = score(ROLE_WORDS, lower);
  // "My ex" is also matched by the bare word "ex" inside other words; trust explicit hits only.
  const roles = (Object.keys(roleScores) as DslRole[]).filter(r => r !== 'stranger' || !roleScores.partner);
  const remoteRoles = roles.filter(role => {
    const re = ROLE_WORDS.find(([k]) => k === role)?.[1];
    if (!re) return false;
    // A role mentioned in the same sentence as a call or a message is only there through a device.
    return text.split(/(?<=[.!?…])\s/).some(sentence => re.test(sentence.toLowerCase()) && REMOTE.test(sentence.toLowerCase()));
  });

  const objects = Object.keys(score(OBJECT_WORDS, lower)) as DslObject[];
  const sounds = Object.keys(score(SOUND_WORDS, lower)) as DslSound[];

  const clockMatch = /\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/.exec(text) ?? /\b([1-9]|1[0-2])\s?(am|a\.m\.)\b|\b([1-9]|1[0-2])\s?час(?:а|ов)? ночи/i.exec(text);
  let clock: string | undefined;
  if (clockMatch) {
    if (clockMatch[2] && /^\d{2}$/.test(clockMatch[2])) clock = `${clockMatch[1].padStart(2, '0')}:${clockMatch[2]}`;
    else {
      const h = clockMatch[1] ?? clockMatch[3];
      if (h) clock = `${String(Number(h) % 12).padStart(2, '0')}:00`;
    }
  }

  const quoteMatch = /[“"«]([^”"»]{2,120})[”"»]/.exec(text) ?? /(?:said|says|read|wrote|сказал[аи]?|написано|гласил[оа]?)[:,]?\s+[‘']?([^.!?]{3,80})/i.exec(text);
  const quote = quoteMatch ? quoteMatch[1].trim() : undefined;

  const minutesMatch = /(\d+|[a-zа-я]+)\s+(minutes?|mins?|минут[ыу]?)/i.exec(lower);
  let minutes: number | undefined;
  if (minutesMatch) {
    const n = Number(minutesMatch[1]);
    minutes = Number.isFinite(n) ? n : NUMBER_WORDS[minutesMatch[1]];
  }

  return {
    lang,
    text,
    chars: text.length,
    world: best(worldScores),
    worldScores,
    grammar: best(grammarScores),
    grammarScores,
    roles,
    remoteRoles,
    objects,
    sounds,
    clock,
    quote,
    minutes,
    hasOutcome: !!options.actualOutcome && options.actualOutcome.trim().length > 5,
    publicScene: /\b(meeting|party|wedding|platform|everyone|crowd|guests|team|reception)\b|совещан|вечеринк|свадьб|платформ|все(?![а-яё])|толп|гост|команд|հարսանիք|բոլոր/i.test(lower),
  };
}

/** The hint line a model receives: a few tokens, never the world definitions. */
export function hintLine(h: StoryHints): string {
  const parts = [
    `lang=${h.lang}`,
    h.world ? `world~${h.world}` : '',
    h.grammar ? `grammar~${h.grammar}` : '',
    h.roles.length ? `people=${h.roles.map(r => (h.remoteRoles.includes(r) ? `${r}(remote)` : r)).join(',')}` : 'people=none',
    h.objects.length ? `objects=${h.objects.join(',')}` : '',
    h.clock ? `clock=${h.clock}` : '',
    h.publicScene ? 'public' : '',
  ];
  return parts.filter(Boolean).join(' ');
}
