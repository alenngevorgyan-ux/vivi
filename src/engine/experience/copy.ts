import type { Lang } from '../compiler/i18n.ts';
import type { DslObject, DslPlace, DslRole } from '../compiler/vocabulary.ts';
import type { MissingInfo } from './types.ts';

/**
 * Player-facing copy for Experience V2, in the story's own language.
 *
 * Every string here is interface or a neutral description of the player's own
 * act. None of it says how anyone else felt, answered or reacted.
 */

const LOOK_OBJECT: Record<Lang, Partial<Record<DslObject, string>>> = {
  en: {
    phone: 'Look at the screen', door: 'Listen at the door', photo: 'Look at the photo', document: 'Look at the document',
    laptop: 'Look at the laptop', envelope: 'Look at the envelope', ticket: 'Look at the ticket', clock: 'Look at the clock',
    screen: 'Look at the screen', letter: 'Look at the letter', keys: 'Look at the keys', intercom: 'Look at the intercom screen',
    elevator: 'Look into the elevator', board: 'Look at the board', train: 'Look at the train', bag: 'Look at the bag',
    window: 'Look out of the window',
  },
  ru: {
    phone: 'Посмотреть на экран', door: 'Прислушаться у двери', photo: 'Рассмотреть фото', document: 'Посмотреть на документ',
    laptop: 'Посмотреть на ноутбук', envelope: 'Посмотреть на конверт', ticket: 'Посмотреть на билет', clock: 'Посмотреть на часы',
    screen: 'Посмотреть на экран', letter: 'Посмотреть на письмо', keys: 'Посмотреть на ключи', intercom: 'Посмотреть на экран домофона',
    elevator: 'Заглянуть в лифт', board: 'Посмотреть на табло', train: 'Посмотреть на поезд', bag: 'Посмотреть на сумку',
    window: 'Выглянуть в окно',
  },
  hy: {
    phone: 'Նայել էկրանին', door: 'Ականջ դնել դռանը', photo: 'Նայել լուսանկարին', document: 'Նայել փաստաթղթին',
    laptop: 'Նայել նոութբուքին', envelope: 'Նայել ծրարին', clock: 'Նայել ժամացույցին', screen: 'Նայել էկրանին',
    letter: 'Նայել նամակին', intercom: 'Նայել դոմոֆոնի էկրանին', elevator: 'Նայել վերելակի մեջ', board: 'Նայել ցուցատախտակին',
    window: 'Նայել պատուհանից',
  },
};

const LOOK_ROLE: Record<Lang, Partial<Record<DslRole, string>>> = {
  en: {
    partner: 'Look at your partner', boss: 'Look at your manager', coworker: 'Look at your coworker', colleague: 'Look at your colleagues',
    friend: 'Look at your friend', parent: 'Look at your parent', sibling: 'Look at your sister', stranger: 'Look at the stranger',
    neighbor: 'Look at the neighbor', ex: 'Look at your ex',
  },
  ru: {
    partner: 'Посмотреть на партнёра', boss: 'Посмотреть на руководителя', coworker: 'Посмотреть на коллегу', colleague: 'Посмотреть на коллег',
    friend: 'Посмотреть на друга', parent: 'Посмотреть на родителя', sibling: 'Посмотреть на сестру', stranger: 'Посмотреть на незнакомца',
    neighbor: 'Посмотреть на соседа', ex: 'Посмотреть на бывшего',
  },
  hy: {
    partner: 'Նայել զուգընկերոջը', boss: 'Նայել ղեկավարին', coworker: 'Նայել գործընկերոջը', colleague: 'Նայել գործընկերներին',
    friend: 'Նայել ընկերոջը', stranger: 'Նայել անծանոթին', neighbor: 'Նայել հարևանին',
  },
};

const LOOK_PLACE: Record<Lang, Partial<Record<DslPlace, string>>> = {
  en: { bathroom: 'Listen at the bathroom door', front_door: 'Look at the front door', elevator: 'Look into the elevator', window: 'Look out of the window', screen: 'Look at the screen', stairs: 'Look at the stairs', exit: 'Look at the exit' },
  ru: { bathroom: 'Прислушаться у двери ванной', front_door: 'Посмотреть на входную дверь', elevator: 'Заглянуть в лифт', window: 'Выглянуть в окно', screen: 'Посмотреть на экран', stairs: 'Посмотреть на лестницу', exit: 'Посмотреть на выход' },
  hy: { bathroom: 'Ականջ դնել լոգարանի դռանը', front_door: 'Նայել մուտքի դռանը', elevator: 'Նայել վերելակի մեջ', window: 'Նայել պատուհանից', stairs: 'Նայել աստիճաններին' },
};

const GENERIC_LOOK: Record<Lang, string> = { en: 'Look closer', ru: 'Присмотреться', hy: 'Նայել ավելի մոտիկից' };

export function lookLabel(lang: Lang, target: { object?: string; role?: string; place?: string }): string {
  const l = LOOK_OBJECT[lang] ? lang : 'en';
  if (target.object) return LOOK_OBJECT[l][target.object as DslObject] ?? LOOK_OBJECT.en[target.object as DslObject] ?? GENERIC_LOOK[l];
  if (target.role) return LOOK_ROLE[l][target.role as DslRole] ?? LOOK_ROLE.en[target.role as DslRole] ?? GENERIC_LOOK[l];
  if (target.place) return LOOK_PLACE[l][target.place as DslPlace] ?? LOOK_PLACE.en[target.place as DslPlace] ?? GENERIC_LOOK[l];
  return GENERIC_LOOK[l];
}

/* -------------------------------------------------------------- player UI --- */

const UI = {
  en: {
    whatCanIDo: 'What can I do?',
    lookAround: 'Look',
    decide: 'Decide',
    decideHint: 'A decision ends the scene. Then you see what the author did.',
    doIt: 'Do this',
    cancel: 'Not yet',
    approaching: 'Going there…',
    orienting: 'Take in the room',
    skipIntro: 'Skip',
    skip: 'Skip',
    close: 'Close',
    tapHint: 'Tap something in the room, or open the list.',
    clickHint: 'Click something lit in the room, or open the list.',
    keyHint: 'Tab — next · Enter — choose · Esc — back',
    youChose: 'You chose',
    andI: 'And I…',
    why: 'Why',
    after: 'What happened next',
    withheld: 'The author has not said what they did.',
    notCorrect: 'This is what one person did — not the right answer.',
    replay: 'Play again',
    feed: 'Back to the feed',
    similar: 'Something like this happened to me',
    myWhy: 'Why I chose this',
    myWhyHint: 'Only you see this. It stays on this device.',
    save: 'Save',
    saved: 'Saved on this device',
    related: 'A story told in reply',
    noStats: 'Vivi does not show how others chose yet: there is no shared data, and we do not invent it.',
    replayNote: 'Replays are not counted as a new first choice.',
    yourFirst: 'Your first choice here',
    unknownContent: 'The story does not say what else is there.',
    noReply: 'What they said is not part of this story.',
    textFallback: 'Shown as text: the room has no clear path there.',
    sceneEnd: 'This is where the scene stops.',
    known: 'You know',
    hard: 'Why it is hard',
    observation: 'Looking changes nothing yet.',
    decisionBadge: 'Decision',
    lookBadge: 'Look',
    memory: 'A memory',
    textStory: 'A story',
    fromStory: 'from the author’s story',
    authorTook: 'The author’s deed is closest to',
    sameAsAuthor: 'You did what the author did.',
    editorial: 'Fictional editorial story, written for QA',
    authorWords: 'In the author’s words',
    demo: 'Demo story',
    noRelated: 'No one has answered this story with their own yet.',
    yourDeed: 'Your deed',
    thenWhat: 'Then',
    playAgainNote: 'Replays stay on this device and do not change your first choice.',
    choices: 'choices',
  },
  ru: {
    whatCanIDo: 'Что я могу сделать?',
    lookAround: 'Осмотреться',
    decide: 'Решить',
    decideHint: 'Решение завершает сцену. Потом — то, что сделал автор.',
    doIt: 'Сделать это',
    cancel: 'Пока нет',
    approaching: 'Иду туда…',
    orienting: 'Осмотритесь',
    skipIntro: 'Дальше',
    skip: 'Пропустить',
    close: 'Закрыть',
    tapHint: 'Коснитесь чего-нибудь в комнате или откройте список.',
    clickHint: 'Нажмите на подсвеченное в комнате или откройте список.',
    keyHint: 'Tab — дальше · Enter — выбрать · Esc — назад',
    youChose: 'Ты выбрал(а)',
    andI: 'А я…',
    why: 'Почему',
    after: 'Что было потом',
    withheld: 'Автор не рассказал, что сделал.',
    notCorrect: 'Это то, как поступил один человек, — не правильный ответ.',
    replay: 'Сыграть ещё раз',
    feed: 'В ленту',
    similar: 'У меня было похоже',
    myWhy: 'Почему я выбрал(а) так',
    myWhyHint: 'Это видите только вы. Хранится на этом устройстве.',
    save: 'Сохранить',
    saved: 'Сохранено на этом устройстве',
    related: 'История, рассказанная в ответ',
    noStats: 'Vivi пока не показывает, как выбирали другие: общих данных нет, и мы их не выдумываем.',
    replayNote: 'Повторные прохождения не считаются новым первым выбором.',
    yourFirst: 'Ваш первый выбор здесь',
    unknownContent: 'Что там ещё — в истории не сказано.',
    noReply: 'Что ответили — в этой истории не сказано.',
    textFallback: 'Показано текстом: в комнате нет понятного пути туда.',
    sceneEnd: 'На этом сцена останавливается.',
    known: 'Вы знаете',
    hard: 'Почему это трудно',
    observation: 'Посмотреть — ещё не значит решить.',
    decisionBadge: 'Решение',
    lookBadge: 'Посмотреть',
    memory: 'Воспоминание',
    textStory: 'История',
    fromStory: 'из рассказа автора',
    authorTook: 'Поступок автора ближе всего к',
    sameAsAuthor: 'Ты поступил(а) так же, как автор.',
    editorial: 'Вымышленная редакционная история для QA',
    authorWords: 'Со слов автора',
    demo: 'Демо-история',
    noRelated: 'На эту историю пока никто не ответил своей.',
    yourDeed: 'Твой поступок',
    thenWhat: 'Потом',
    playAgainNote: 'Повторы хранятся на этом устройстве и не меняют первый выбор.',
    choices: 'варианта',
  },
  hy: {
    whatCanIDo: 'Ի՞նչ կարող եմ անել',
    lookAround: 'Նայել շուրջը',
    decide: 'Որոշել',
    decideHint: 'Որոշումն ավարտում է տեսարանը։ Հետո՝ այն, ինչ արեց հեղինակը։',
    doIt: 'Անել դա',
    cancel: 'Դեռ ոչ',
    approaching: 'Գնում եմ այնտեղ…',
    orienting: 'Նայեք շուրջը',
    skipIntro: 'Առաջ',
    skip: 'Բաց թողնել',
    close: 'Փակել',
    tapHint: 'Հպեք սենյակում ինչ-որ բանի կամ բացեք ցանկը։',
    clickHint: 'Սեղմեք սենյակում լուսավորվածի վրա կամ բացեք ցանկը։',
    keyHint: 'Tab — հաջորդը · Enter — ընտրել · Esc — հետ',
    youChose: 'Դու ընտրեցիր',
    andI: 'Իսկ ես…',
    why: 'Ինչու',
    after: 'Ինչ եղավ հետո',
    withheld: 'Հեղինակը չի պատմել, թե ինչ արեց։',
    notCorrect: 'Սա մեկ մարդու արարքն է, ոչ թե ճիշտ պատասխան։',
    replay: 'Խաղալ նորից',
    feed: 'Դեպի լրահոս',
    similar: 'Ինձ հետ նման բան եղել է',
    myWhy: 'Ինչու ընտրեցի այսպես',
    myWhyHint: 'Սա տեսնում եք միայն դուք։ Պահվում է այս սարքում։',
    save: 'Պահել',
    saved: 'Պահված է այս սարքում',
    related: 'Ի պատասխան պատմված պատմություն',
    noStats: 'Vivi-ն դեռ ցույց չի տալիս, թե ինչպես են ընտրել ուրիշները. ընդհանուր տվյալներ չկան, և մենք դրանք չենք հորինում։',
    replayNote: 'Կրկնակի խաղերը չեն հաշվվում որպես նոր առաջին ընտրություն։',
    yourFirst: 'Ձեր առաջին ընտրությունն այստեղ',
    unknownContent: 'Թե ինչ կա այնտեղ դեռ, պատմության մեջ ասված չէ։',
    noReply: 'Թե ինչ պատասխանեցին, այս պատմության մեջ ասված չէ։',
    textFallback: 'Ցույց է տրված տեքստով։',
    sceneEnd: 'Այստեղ տեսարանը կանգ է առնում։',
    known: 'Դուք գիտեք',
    hard: 'Ինչու է դժվար',
    observation: 'Նայելը դեռ որոշում չէ։',
    decisionBadge: 'Որոշում',
    lookBadge: 'Նայել',
    memory: 'Հուշ',
    textStory: 'Պատմություն',
    fromStory: 'հեղինակի պատմությունից',
    authorTook: 'Հեղինակի արարքն ամենամոտն է',
    sameAsAuthor: 'Դու արեցիր այն, ինչ արեց հեղինակը։',
    editorial: 'Հորինված խմբագրական պատմություն՝ QA-ի համար',
    authorWords: 'Հեղինակի խոսքերով',
    demo: 'Դեմո պատմություն',
    noRelated: 'Այս պատմությանը դեռ ոչ ոք չի պատասխանել իր պատմությամբ։',
    yourDeed: 'Քո արարքը',
    thenWhat: 'Հետո',
    playAgainNote: 'Կրկնությունները պահվում են այս սարքում և չեն փոխում առաջին ընտրությունը։',
    choices: 'տարբերակ',
  },
} as const;

export type UiKey = keyof (typeof UI)['en'];

export function ui(lang: string | undefined, key: UiKey): string {
  const l = (lang && lang in UI ? lang : 'en') as keyof typeof UI;
  return UI[l][key] ?? UI.en[key];
}

/* ------------------------------------------------------- author flow copy --- */

/** The one question that would make a story playable, by what is missing. Russian is the author UI's language. */
export const CLARIFY_QUESTION: Record<MissingInfo, { ru: string; en: string }> = {
  author_act: { ru: 'Что ты сделал(а) в этот момент?', en: 'What did you do in that moment?' },
  stakes: { ru: 'Почему было трудно решить? Одно-два предложения.', en: 'Why was it hard to decide? A sentence or two.' },
  decision_moment: { ru: 'В какой момент нужно было решить, что делать?', en: 'At what moment did you have to decide what to do?' },
  alternatives: { ru: 'Что ещё ты мог(ла) сделать тогда?', en: 'What else could you have done then?' },
  perspective: { ru: 'Эта история — о тебе? Расскажи её от первого лица.', en: 'Is this your story? Tell it as “I”.' },
};

export const MISSING_LABEL: Record<MissingInfo, string> = {
  perspective: 'история рассказана не изнутри (нет «я»)',
  decision_moment: 'в истории нет момента, когда нужно было что-то решить',
  alternatives: 'меньше двух по-настоящему разных поступков',
  stakes: 'не сказано, почему было трудно',
  author_act: 'не сказано, что сделал автор',
};
