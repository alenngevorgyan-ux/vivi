import type { DslObject, DslPlace, DslRole, DslVerb } from './vocabulary.ts';

/**
 * The few user-facing strings the compiler derives instead of asking a model
 * for: how to describe walking up to something, and neutral fallbacks when a
 * model leaves an observation or consequence out. Story-specific language
 * always comes from the author or the model; these only fill gaps.
 */

export type Lang = 'en' | 'ru' | 'hy';

export function detectLanguage(text: string): Lang {
  const cyr = (text.match(/[Ѐ-ӿ]/g) || []).length;
  const arm = (text.match(/[԰-֏]/g) || []).length;
  const lat = (text.match(/[A-Za-z]/g) || []).length;
  if (arm > cyr && arm > lat * 0.5) return 'hy';
  if (cyr > lat * 0.5) return 'ru';
  return 'en';
}

const OBJECT_APPROACH: Record<Lang, Partial<Record<DslObject, string>>> = {
  en: {
    phone: 'Approach the phone', door: 'Go to the door', photo: 'Look at the photo', document: 'Look at the document',
    laptop: 'Go to your laptop', envelope: 'Look at the envelope', ticket: 'Check the ticket', clock: 'Look at the clock',
    screen: 'Step toward the screen', letter: 'Read the letter', keys: 'Pick up the keys', intercom: 'Go to the intercom',
    elevator: 'Walk toward the elevator', board: 'Check the departure board', train: 'Walk to the train doors',
    bag: 'Go to the bag', window: 'Go to the window',
  },
  ru: {
    phone: 'Подойти к телефону', door: 'Подойти к двери', photo: 'Рассмотреть фото', document: 'Рассмотреть документ',
    laptop: 'Подойти к ноутбуку', envelope: 'Рассмотреть конверт', ticket: 'Проверить билет', clock: 'Посмотреть на часы',
    screen: 'Подойти к экрану', letter: 'Прочитать письмо', keys: 'Взять ключи', intercom: 'Подойти к домофону',
    elevator: 'Пойти к лифту', board: 'Посмотреть на табло', train: 'Подойти к дверям поезда',
    bag: 'Подойти к сумке', window: 'Подойти к окну',
  },
  hy: {
    phone: 'Մոտենալ հեռախոսին', door: 'Մոտենալ դռանը', photo: 'Նայել լուսանկարին', document: 'Նայել փաստաթղթին',
    laptop: 'Մոտենալ նոութբուքին', envelope: 'Նայել ծրարին', letter: 'Կարդալ նամակը', intercom: 'Մոտենալ դոմոֆոնին',
    elevator: 'Գնալ դեպի վերելակ', board: 'Նայել ցուցատախտակին', train: 'Մոտենալ գնացքի դռներին', window: 'Մոտենալ պատուհանին',
  },
};

const CARRIED_APPROACH: Record<Lang, Partial<Record<DslObject, string>>> = {
  en: { phone: 'Check your phone', ticket: 'Check your ticket', keys: 'Feel for your keys' },
  ru: { phone: 'Посмотреть в телефон', ticket: 'Проверить билет', keys: 'Нащупать ключи' },
  hy: { phone: 'Նայել հեռախոսին' },
};

/** Label for something already in the player's hand. */
export function carriedLabel(lang: Lang, object: DslObject): string {
  return CARRIED_APPROACH[lang]?.[object] ?? CARRIED_APPROACH.en[object] ?? approachLabel(lang, { object, verb: 'look' });
}

const PLACE_APPROACH: Record<Lang, Partial<Record<DslPlace, string>>> = {
  en: {
    bathroom: 'Go to the bathroom door', front_door: 'Go to the front door', bedroom: 'Go toward the bedroom',
    kitchen: 'Go to the kitchen', window: 'Go to the window', sofa: 'Sit on the sofa', table: 'Go to the table',
    stairs: 'Walk to the stairs', elevator: 'Walk toward the elevator', exit: 'Walk to the exit', screen: 'Step toward the screen',
    platform: 'Stand at the platform edge', bench: 'Sit on the bench', bar: 'Go to the bar', corner: 'Step into the corner',
    street: 'Step into the street', car: 'Walk to the car', balcony: 'Go to the balcony', desk: 'Go to your desk',
    center: 'Step into the middle of the room',
  },
  ru: {
    bathroom: 'Подойти к двери ванной', front_door: 'Подойти к входной двери', bedroom: 'Пойти в спальню',
    kitchen: 'Пойти на кухню', window: 'Подойти к окну', sofa: 'Сесть на диван', table: 'Подойти к столу',
    stairs: 'Пойти к лестнице', elevator: 'Пойти к лифту', exit: 'Пойти к выходу', screen: 'Подойти к экрану',
    platform: 'Встать у края платформы', bench: 'Сесть на скамейку', bar: 'Подойти к бару', corner: 'Отойти в угол',
    street: 'Выйти на улицу', car: 'Подойти к машине', balcony: 'Выйти на балкон', desk: 'Подойти к столу',
    center: 'Выйти на середину',
  },
  hy: {
    bathroom: 'Մոտենալ լոգարանի դռանը', front_door: 'Մոտենալ մուտքի դռանը', window: 'Մոտենալ պատուհանին',
    exit: 'Գնալ դեպի ելքը', bench: 'Նստել նստարանին', center: 'Դուրս գալ սենյակի մեջտեղ',
  },
};

const ROLE_NAME: Record<Lang, Record<DslRole, string>> = {
  en: {
    partner: 'your partner', ex: 'your ex', friend: 'your friend', sibling: 'your sister', parent: 'your parent',
    relative: 'your relative', child: 'the child', coworker: 'your coworker', boss: 'your manager', colleague: 'a colleague',
    stranger: 'the stranger', neighbor: 'the neighbor', host: 'the host', guest: 'a guest', commuter: 'a passenger',
  },
  ru: {
    partner: 'партнёру', ex: 'бывшему', friend: 'другу', sibling: 'сестре', parent: 'родителю', relative: 'родственнику',
    child: 'ребёнку', coworker: 'коллеге', boss: 'руководителю', colleague: 'коллеге', stranger: 'незнакомцу',
    neighbor: 'соседу', host: 'хозяину', guest: 'гостю', commuter: 'пассажиру',
  },
  hy: {
    partner: 'զուգընկերոջը', ex: 'նախկինին', friend: 'ընկերոջը', sibling: 'քրոջը', parent: 'ծնողին', relative: 'բարեկամին',
    child: 'երեխային', coworker: 'գործընկերոջը', boss: 'ղեկավարին', colleague: 'գործընկերոջը', stranger: 'անծանոթին',
    neighbor: 'հարևանին', host: 'տանտիրոջը', guest: 'հյուրին', commuter: 'ուղևորին',
  },
};

const ROLE_APPROACH: Record<Lang, string> = {
  en: 'Go to {role}',
  ru: 'Подойти к {role}',
  hy: 'Մոտենալ {role}',
};

const VERB_APPROACH: Record<Lang, Partial<Record<DslVerb, string>>> = {
  en: { wait: 'Stay where you are', stay: 'Stay where you are', leave: 'Walk to the door', hide: 'Step out of sight', call_help: 'Take out your phone' },
  ru: { wait: 'Остаться на месте', stay: 'Остаться на месте', leave: 'Пойти к двери', hide: 'Уйти из виду', call_help: 'Достать телефон' },
  hy: { wait: 'Մնալ տեղում', stay: 'Մնալ տեղում', leave: 'Գնալ դեպի դուռը' },
};

const OBJECT_OBSERVATION: Record<Lang, Partial<Record<DslObject, string>>> = {
  en: {
    phone: 'The screen is still lit.', door: 'The handle is still. Nothing behind it moves.', photo: 'You look closer. It is not a mistake.',
    document: 'The name and the date are unmistakable.', laptop: 'Everything you need is one click away.', envelope: 'It is heavier than it looks.',
    ticket: 'There is no later departure.', clock: 'The minutes do not slow down.', screen: 'Everyone in the room is looking at it.',
    letter: 'The handwriting is familiar.', keys: 'They are still warm.', intercom: 'The little screen shows an empty landing.',
    elevator: 'The indicator has stopped on your floor.', board: 'The last departure is the next one.', train: 'The doors will not wait.',
    bag: 'It is packed.', window: 'Outside, nothing has noticed.',
  },
  ru: {
    phone: 'Экран всё ещё светится.', door: 'Ручка неподвижна. За дверью тихо.', photo: 'Вы присматриваетесь. Это не ошибка.',
    document: 'Имя и дата не оставляют сомнений.', laptop: 'Всё нужное — в одном клике.', envelope: 'Он тяжелее, чем кажется.',
    ticket: 'Следующего рейса не будет.', clock: 'Минуты не замедляются.', screen: 'Вся комната смотрит на экран.',
    letter: 'Почерк знакомый.', keys: 'Они ещё тёплые.', intercom: 'На экранчике — пустая площадка.',
    elevator: 'Табло остановилось на вашем этаже.', board: 'Последний рейс — следующий.', train: 'Двери не будут ждать.',
    bag: 'Сумка собрана.', window: 'Снаружи никто ничего не заметил.',
  },
  hy: {
    phone: 'Էկրանը դեռ լուսավոր է։', door: 'Բռնակը անշարժ է։', photo: 'Նայում ես ավելի մոտիկից։ Սա սխալ չէ։',
    envelope: 'Այն ավելի ծանր է, քան թվում է։', elevator: 'Ցուցիչը կանգ է առել քո հարկում։',
  },
};

const GENERIC: Record<Lang, Record<string, string>> = {
  en: {
    observation: 'You stop here. The room waits with you.',
    outcome: 'You chose: {label}. The moment closes behind you.',
    crowd: 'What would you do?',
    response: 'Have you lived through a moment like this?',
    withheld: 'The author has not shared what happened next.',
    untitled: 'An unfinished moment',
    cue: 'Something changes.',
    pressure: 'The moment is closing.',
    calling: 'Incoming call',
  },
  ru: {
    observation: 'Вы останавливаетесь здесь. Комната ждёт вместе с вами.',
    outcome: 'Вы выбрали: {label}. Момент закрывается за вами.',
    crowd: 'Как бы вы поступили?',
    response: 'С вами было похожее?',
    withheld: 'Автор пока не раскрыл, что произошло.',
    untitled: 'Незаконченный момент',
    cue: 'Что-то меняется.',
    pressure: 'Время уходит.',
    calling: 'Входящий вызов',
  },
  hy: {
    observation: 'Կանգ ես առնում այստեղ։ Սենյակը սպասում է քեզ հետ։',
    outcome: 'Դու ընտրեցիր՝ {label}։',
    crowd: 'Ի՞նչ կանեիր դու։',
    response: 'Քեզ հետ նման բան եղե՞լ է։',
    withheld: 'Հեղինակը դեռ չի պատմել, թե ինչ եղավ։',
    untitled: 'Անավարտ պահ',
    cue: 'Ինչ-որ բան փոխվում է։',
    pressure: 'Ժամանակը սպառվում է։',
    calling: 'Մուտքային զանգ',
  },
};

const pick = <T,>(table: Record<Lang, Partial<T>>, lang: Lang): Partial<T> => table[lang] ?? table.en;

export function approachLabel(
  lang: Lang,
  target: { object?: DslObject; place?: DslPlace; role?: DslRole; verb: DslVerb }
): string {
  if (target.object) return pick(OBJECT_APPROACH, lang)[target.object] ?? OBJECT_APPROACH.en[target.object] ?? 'Look closer';
  if (target.role) {
    const name = ROLE_NAME[lang]?.[target.role] ?? ROLE_NAME.en[target.role];
    return (ROLE_APPROACH[lang] ?? ROLE_APPROACH.en).replace('{role}', name);
  }
  if (target.place) return pick(PLACE_APPROACH, lang)[target.place] ?? PLACE_APPROACH.en[target.place] ?? 'Go there';
  return pick(VERB_APPROACH, lang)[target.verb] ?? VERB_APPROACH.en[target.verb] ?? text(lang, 'observation');
}

export function objectObservation(lang: Lang, object: DslObject): string | undefined {
  return pick(OBJECT_OBSERVATION, lang)[object] ?? OBJECT_OBSERVATION.en[object];
}

export function text(lang: Lang, key: keyof (typeof GENERIC)['en'], vars: Record<string, string> = {}): string {
  let s = GENERIC[lang]?.[key] ?? GENERIC.en[key];
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}

export function roleName(lang: Lang, role: DslRole): string {
  return ROLE_NAME[lang]?.[role] ?? ROLE_NAME.en[role];
}
