import type { ExperienceFormat, EnactmentKind, MeaningFamily } from '../../engine/experience/types.ts';

/**
 * EDITORIAL QA FIXTURES — Experience V2.
 *
 * These are fictional stories written by the Vivi team to tune and test the
 * experience. They are not posts by real people and are always labelled as
 * such in the interface.
 *
 * Each fixture plays through the production pipeline: `compileViviStory` with
 * a replay provider that returns `dsl` as if a model had written it. The DSL is
 * the stored, hand-checked "model output"; everything after it — validation,
 * review, compilation, the situation layer, the format gate and the runtime —
 * is the code every generated post goes through.
 */

export interface ExperienceFixture {
  id: string;
  lang: 'ru' | 'en' | 'hy';
  world: 'apartment' | 'office' | 'night_hallway';
  /** Short label for the feed. */
  title: string;
  /** The author's text before the decision. The only text the "model" saw. */
  source: string;
  /** What the source explicitly establishes (for reviewers and tests). */
  facts: string[];
  decisionMoment?: string;
  whyHard?: string;
  observations: string[];
  commitments: Array<{ label: string; meaning: MeaningFamily; enactment: EnactmentKind }>;
  /** The author's real deed and, optionally, why and what came after. Never sent to a model. */
  author?: { act: string; why?: string; after?: string };
  /** Index of the offered deed the author took, if one matches. */
  authorChoice?: number;
  expectedFormat: ExperienceFormat;
  /** Stored semantic program, returned by the replay provider. */
  dsl: Record<string, unknown>;
}

export const EXPERIENCE_FIXTURES: ExperienceFixture[] = [
  /* -------------------------------------------- A. APARTMENT / PRIVATE BOUNDARY */
  {
    id: 'v2-apartment-ru',
    lang: 'ru',
    world: 'apartment',
    title: 'Сообщение от Марка',
    source:
      'Мы с Аней живём вместе третий год. В тот вечер она сказала, что пойдёт в душ, и закрыла дверь ванной. Слышно было, как шумит вода. Её телефон остался на журнальном столике передо мной. Экран загорелся: сообщение от контакта «Марк» — «Ты уже сказала ему?». Больше на экране ничего не было видно. Пароля на телефоне нет, она никогда не запрещала мне его брать. Но мы давно договорились не читать переписки друг друга. Я не знаю никакого Марка.',
    facts: [
      'Аня в душе, дверь ванной закрыта, шумит вода.',
      'На экране её телефона сообщение от «Марк»: «Ты уже сказала ему?».',
      'Больше на экране ничего не видно.',
      'Пароля нет; они договорились не читать переписки друг друга.',
    ],
    decisionMoment: 'Телефон Ани передо мной, на экране сообщение от Марка. Открыть переписку или нет?',
    whyHard: 'Мы давно договорились не читать переписки друг друга, а я не знаю никакого Марка.',
    observations: ['Экран телефона: только превью сообщения', 'Дверь ванной: шумит вода'],
    commitments: [
      { label: 'Открыть переписку', meaning: 'look_private', enactment: 'inspect_object' },
      { label: 'Спросить через дверь про Марка', meaning: 'address', enactment: 'address_person' },
      { label: 'Не трогать телефон и ждать', meaning: 'hold', enactment: 'hold' },
    ],
    author: {
      act: 'Я не стал открывать переписку. Дождался, пока Аня выйдет из душа, и спросил, кто такой Марк.',
      why: 'Если бы я прочитал, то уже не смог бы спросить честно.',
      after: 'Марк оказался её коллегой: она собиралась сказать начальнику, что уходит. Мне было неловко, что я так испугался.',
    },
    authorChoice: 2,
    expectedFormat: 'playable',
    dsl: {
      v: 1,
      w: 'apt',
      g: 'message',
      t: 'restrained',
      c: [['partner', 'on']],
      o: ['phone'],
      e: [
        ['exit', 'partner', 'bathroom'],
        ['sound', 'shower'],
        ['msg', 'phone', 'Ты уже сказала ему?'],
      ],
      a: [
        ['read', 'phone', 'Открыть переписку'],
        ['ask', 'partner', 'Спросить через дверь про Марка'],
        ['wait', null, 'Не трогать телефон и ждать'],
      ],
      ob: [
        ['phone', 'На экране: «Марк: Ты уже сказала ему?». Больше на экране ничего не видно.', 'Посмотреть на экран'],
        ['bathroom', 'За дверью ванной шумит вода.'],
      ],
      m: {
        d: 'Телефон Ани передо мной, на экране сообщение от Марка. Открыть переписку или нет?',
        h: 'Мы давно договорились не читать переписки друг друга, а я не знаю никакого Марка.',
        k: [
          'Аня в душе, дверь ванной закрыта.',
          'Сообщение от контакта «Марк»: «Ты уже сказала ему?».',
          'Пароля на телефоне нет.',
          'Мы договорились не читать переписки друг друга.',
        ],
        f: 'play',
      },
      cg: 'intimate',
      st: 'doorway_separation',
      x: { ti: 'Сообщение от Марка', op: 'Аня закрывает дверь ванной. Шумит вода.', q: 'Ты бы открыл переписку?' },
    },
  },

  /* ------------------------------------------------------- B. OFFICE / CREDIT */
  {
    id: 'v2-office-ru',
    lang: 'ru',
    world: 'office',
    title: 'Чужая фамилия на слайде',
    source:
      'Два месяца я делал модель прогноза продаж для нашего отдела. Сегодня на планёрке её показывал мой коллега Игорь — от своего имени, с его фамилией на первом слайде. В переговорной были руководитель отдела Ольга и ещё трое коллег. Ольга сказала: «Отличная работа, Игорь». Потом она спросила: «Вопросы есть?» Я сидел у стены. Все исходные файлы модели — у меня. Но Игорь ведёт этот проект, и через месяц именно он пишет на меня отзыв.',
    facts: [
      'Модель два месяца делал рассказчик.',
      'Игорь показывает её от своего имени; его фамилия на первом слайде.',
      'Ольга сказала «Отличная работа, Игорь» и спросила «Вопросы есть?».',
      'В комнате ещё трое коллег; Игорь через месяц пишет отзыв на рассказчика.',
    ],
    decisionMoment: 'Ольга хвалит Игоря за мою модель и спрашивает, есть ли вопросы.',
    whyHard: 'Игорь ведёт этот проект, и через месяц именно он пишет на меня отзыв.',
    observations: ['Слайд с фамилией Игоря', 'Ольга ждёт вопросов'],
    commitments: [
      { label: 'Сказать, что модель моя', meaning: 'speak_public', enactment: 'speak_up' },
      { label: 'Попросить Ольгу поговорить после', meaning: 'address', enactment: 'address_person' },
      { label: 'Промолчать', meaning: 'hold', enactment: 'hold' },
    ],
    author: {
      act: 'На планёрке я промолчал. Вечером написал Ольге письмо и приложил исходные файлы с датами.',
      why: 'Сказать это при всех я не смог — голос бы дрогнул, и это выглядело бы как скандал.',
      after: 'Ольга ответила через два дня. Авторство в протоколе исправили; с Игорем мы теперь говорим только по делу.',
    },
    authorChoice: 2,
    expectedFormat: 'playable',
    dsl: {
      v: 1,
      w: 'office',
      g: 'credit',
      t: 'tense',
      c: [
        ['boss', 'on'],
        ['coworker', 'on'],
        ['colleague', 'bg', 3],
      ],
      o: ['screen'],
      e: [
        ['notice', 'screen'],
        ['say', 'boss', 'Отличная работа, Игорь.'],
        ['say', 'boss', 'Вопросы есть?'],
      ],
      a: [
        ['speak_up', null, 'Сказать, что модель моя'],
        ['ask', 'boss', 'Попросить Ольгу поговорить после'],
        ['wait', null, 'Промолчать'],
      ],
      ob: [
        ['screen', 'На первом слайде — фамилия Игоря.', 'Посмотреть на слайд'],
        ['boss', 'Ольга сказала: «Отличная работа, Игорь». Потом спросила: «Вопросы есть?»', 'Посмотреть на Ольгу'],
      ],
      m: {
        d: 'Ольга хвалит Игоря за мою модель и спрашивает, есть ли вопросы.',
        h: 'Игорь ведёт этот проект, и через месяц именно он пишет на меня отзыв.',
        k: [
          'Два месяца я делал модель прогноза продаж.',
          'Игорь показывает её от своего имени.',
          'Все исходные файлы модели у меня.',
          'Через месяц Игорь пишет на меня отзыв.',
        ],
        f: 'play',
      },
      cg: 'scrutiny',
      st: 'across_table',
      x: { ti: 'Чужая фамилия на слайде', op: 'На экране — моя модель. На первом слайде — фамилия Игоря.', q: 'Ты бы сказал это при всех?' },
    },
  },

  /* ---------------------------------------- C. NIGHT HALLWAY / UNCERTAINTY */
  {
    id: 'v2-hallway-ru',
    lang: 'ru',
    world: 'night_hallway',
    title: 'Рюкзак в пустом лифте',
    source:
      'Я возвращался домой во втором часу ночи. Вызвал лифт на первом этаже, двери открылись — внутри никого. На полу кабины лежал чей-то рюкзак, расстёгнутый, сверху — ключи с брелоком в виде синей рыбки. Такой брелок я видел у соседки с девятого этажа, мы почти не знакомы. Я живу на седьмом. У дома есть общий чат. Стучать в два ночи к почти незнакомому человеку неловко, а оставить ключи в лифте я не хотел.',
    facts: [
      'Второй час ночи, первый этаж, в лифте никого.',
      'В кабине расстёгнутый рюкзак, сверху ключи с синей рыбкой.',
      'Такой брелок рассказчик видел у соседки с девятого этажа.',
      'У дома есть общий чат.',
    ],
    decisionMoment: 'В пустом лифте лежит рюкзак с ключами, похожими на ключи соседки с девятого. Что с ним делать?',
    whyHard: 'Стучать в два ночи к почти незнакомому человеку неловко, а оставить ключи в лифте я не хотел.',
    observations: ['Рюкзак: расстёгнут, сверху ключи с синей рыбкой', 'Кабина: внутри никого'],
    commitments: [
      { label: 'Забрать рюкзак домой до утра', meaning: 'keep', enactment: 'handle_object' },
      { label: 'Подняться с рюкзаком на девятый', meaning: 'go_toward', enactment: 'move_to' },
      { label: 'Написать в домовой чат', meaning: 'seek_help', enactment: 'use_device' },
      { label: 'Оставить и уйти по лестнице', meaning: 'withdraw', enactment: 'leave' },
    ],
    author: {
      act: 'Я забрал рюкзак к себе, а утром отнёс его на девятый.',
      why: 'Будить почти незнакомого человека в два ночи я не решился, а оставлять ключи в лифте не хотел.',
      after: 'Соседка сказала, что уронила рюкзак, когда выносила вещи, и полночи искала ключи.',
    },
    authorChoice: 0,
    expectedFormat: 'playable',
    dsl: {
      v: 1,
      w: 'hall',
      g: 'find',
      t: 'restrained',
      c: [],
      o: ['elevator', 'bag', 'phone'],
      e: [
        ['elevator', 'empty'],
        ['notice', 'bag'],
      ],
      a: [
        ['keep', 'bag', 'Забрать рюкзак домой до утра'],
        ['board', 'elevator', 'Подняться с рюкзаком на девятый'],
        ['call', 'phone', 'Написать в домовой чат'],
        ['leave', 'stairs', 'Оставить и уйти по лестнице'],
      ],
      ob: [
        ['bag', 'Рюкзак расстёгнут, сверху ключи с брелоком в виде синей рыбки.', 'Посмотреть на рюкзак'],
        ['elevator', 'Двери открылись — внутри никого.', 'Заглянуть в кабину'],
      ],
      m: {
        d: 'В пустом лифте лежит рюкзак с ключами, похожими на ключи соседки с девятого. Что с ним делать?',
        h: 'Стучать в два ночи к почти незнакомому человеку неловко, а оставить ключи в лифте я не хотел.',
        k: [
          'Во втором часу ночи двери лифта открылись — внутри никого.',
          'Ключи с брелоком в виде синей рыбки.',
          'Такой брелок я видел у соседки с девятого этажа.',
          'У дома есть общий чат.',
        ],
        f: 'play',
      },
      cg: 'discovery',
      st: 'isolated_subject',
      x: { ti: 'Рюкзак в пустом лифте', op: 'Двери лифта открываются. Внутри никого.', q: 'Что бы ты сделал с рюкзаком?' },
    },
  },

  /* ---------------------------- C′. Short input with no decision: a memory */
  {
    id: 'v2-hallway-memory-ru',
    lang: 'ru',
    world: 'night_hallway',
    title: 'Пустой лифт',
    source: 'Ночью лифт открылся на моём этаже, а внутри никого не было. Свет в кабине мигнул, и двери закрылись.',
    facts: ['Ночь, лифт открылся пустым, свет мигнул, двери закрылись.'],
    observations: [],
    commitments: [],
    expectedFormat: 'illustrated_memory',
    dsl: {
      v: 1,
      w: 'hall',
      g: 'intrusion',
      t: 'eerie',
      c: [],
      o: ['elevator'],
      e: [
        ['elevator', 'empty'],
        ['light', 'flicker'],
      ],
      a: [
        ['look', 'elevator', 'Посмотреть в кабину'],
        ['wait', null, 'Постоять'],
      ],
      ob: [['elevator', 'Лифт открылся на моём этаже, внутри никого.']],
      m: { f: 'memory' },
      x: { ti: 'Пустой лифт', op: 'Лифт открылся на моём этаже. Внутри никого.' },
    },
  },

  /* ------------------------------------------- language QA variants: EN, HY */
  {
    id: 'v2-apartment-en',
    lang: 'en',
    world: 'apartment',
    title: 'A message from Mark',
    source:
      'Anya and I have lived together for three years. That evening she said she was going to shower and closed the bathroom door. I could hear the water running. Her phone stayed on the coffee table in front of me. The screen lit up: a message from a contact called “Mark” — “Have you told him yet?”. Nothing else was visible on the screen. Her phone has no passcode, and she has never minded me picking it up. But we agreed long ago not to read each other’s messages. I don’t know any Mark.',
    facts: ['Anya is in the shower.', 'Mark: “Have you told him yet?”', 'No passcode.', 'They agreed not to read each other’s messages.'],
    decisionMoment: 'Anya’s phone is in front of me with a message from Mark. Do I open the conversation?',
    whyHard: 'We agreed long ago not to read each other’s messages, and I don’t know any Mark.',
    observations: ['The preview on the screen', 'Water behind the bathroom door'],
    commitments: [
      { label: 'Open the conversation', meaning: 'look_private', enactment: 'inspect_object' },
      { label: 'Ask through the door', meaning: 'address', enactment: 'address_person' },
      { label: 'Leave the phone and wait', meaning: 'hold', enactment: 'hold' },
    ],
    author: {
      act: 'I didn’t open it. I waited until Anya came out of the shower and asked who Mark was.',
      why: 'If I had read it, I could not have asked her honestly.',
    },
    authorChoice: 2,
    expectedFormat: 'playable',
    dsl: {
      v: 1,
      w: 'apt',
      g: 'message',
      t: 'restrained',
      c: [['partner', 'on']],
      o: ['phone'],
      e: [
        ['exit', 'partner', 'bathroom'],
        ['sound', 'shower'],
        ['msg', 'phone', 'Have you told him yet?'],
      ],
      a: [
        ['read', 'phone', 'Open the conversation'],
        ['ask', 'partner', 'Ask through the door'],
        ['wait', null, 'Leave the phone and wait'],
      ],
      ob: [
        ['phone', 'On the screen: “Mark: Have you told him yet?”. Nothing else was visible on the screen.'],
        ['bathroom', 'I could hear the water running.'],
      ],
      m: {
        d: 'Anya’s phone is in front of me with a message from Mark. Do I open the conversation?',
        h: 'We agreed long ago not to read each other’s messages, and I don’t know any Mark.',
        k: ['She closed the bathroom door.', 'A message from “Mark” — “Have you told him yet?”', 'Her phone has no passcode.'],
        f: 'play',
      },
      cg: 'intimate',
      st: 'doorway_separation',
      x: { ti: 'A message from Mark', op: 'Anya closes the bathroom door. Water starts.', q: 'Would you open it?' },
    },
  },
  {
    id: 'v2-hallway-hy',
    lang: 'hy',
    world: 'night_hallway',
    title: 'Ուսապարկը դատարկ վերելակում',
    source:
      'Գիշերվա երկուսին էի տուն վերադառնում։ Առաջին հարկում կանչեցի վերելակը, դռները բացվեցին՝ ներսում ոչ ոք չկար։ Խցիկի հատակին ինչ-որ մեկի բաց ուսապարկ էր, վրան՝ կապույտ ձկնիկով բանալիներ։ Այդպիսի բանալիկախոց տեսել էի իններորդ հարկի հարևանուհու մոտ, մենք գրեթե ծանոթ չենք։ Ես ապրում եմ յոթերորդ հարկում։ Մեր շենքն ունի ընդհանուր չատ։ Գիշերվա երկուսին գրեթե անծանոթ մարդու դուռը թակելն անհարմար է, իսկ բանալիները վերելակում թողնել չէի ուզում։',
    facts: ['Գիշեր, վերելակը դատարկ է։', 'Բաց ուսապարկ, կապույտ ձկնիկով բանալիներ։', 'Շենքն ունի ընդհանուր չատ։'],
    decisionMoment: 'Դատարկ վերելակում ուսապարկ կա՝ հարևանուհու բանալիների նման բանալիներով։ Ի՞նչ անել։',
    whyHard: 'Գիշերվա երկուսին գրեթե անծանոթ մարդու դուռը թակելն անհարմար է, իսկ բանալիները վերելակում թողնել չէի ուզում։',
    observations: ['Ուսապարկը', 'Դատարկ խցիկը'],
    commitments: [
      { label: 'Ուսապարկը տանել տուն', meaning: 'keep', enactment: 'handle_object' },
      { label: 'Գրել շենքի չատում', meaning: 'seek_help', enactment: 'use_device' },
      { label: 'Թողնել ու բարձրանալ աստիճաններով', meaning: 'withdraw', enactment: 'leave' },
    ],
    author: { act: 'Ուսապարկը տարա տուն, իսկ առավոտյան բարձրացրի իններորդ հարկ։' },
    authorChoice: 0,
    expectedFormat: 'playable',
    dsl: {
      v: 1,
      w: 'hall',
      g: 'find',
      t: 'restrained',
      c: [],
      o: ['elevator', 'bag', 'phone'],
      e: [
        ['elevator', 'empty'],
        ['notice', 'bag'],
      ],
      a: [
        ['keep', 'bag', 'Ուսապարկը տանել տուն'],
        ['call', 'phone', 'Գրել շենքի չատում'],
        ['leave', 'stairs', 'Թողնել ու բարձրանալ աստիճաններով'],
      ],
      ob: [
        ['bag', 'Բաց ուսապարկ, վրան՝ կապույտ ձկնիկով բանալիներ։', 'Նայել ուսապարկին'],
        ['elevator', 'Դռները բացվեցին՝ ներսում ոչ ոք չկար։'],
      ],
      m: {
        d: 'Դատարկ վերելակում ուսապարկ կա՝ հարևանուհու բանալիների նման բանալիներով։ Ի՞նչ անել։',
        h: 'Գիշերվա երկուսին գրեթե անծանոթ մարդու դուռը թակելն անհարմար է, իսկ բանալիները վերելակում թողնել չէի ուզում։',
        k: ['Ներսում ոչ ոք չկար։', 'Կապույտ ձկնիկով բանալիներ։', 'Մեր շենքն ունի ընդհանուր չատ։'],
        f: 'play',
      },
      cg: 'discovery',
      st: 'isolated_subject',
      x: { ti: 'Ուսապարկը դատարկ վերելակում', op: 'Վերելակի դռները բացվում են։ Ներսում ոչ ոք չկա։', q: 'Ի՞նչ կանեիր ուսապարկի հետ։' },
    },
  },
];

export const experienceFixtureById: Record<string, ExperienceFixture> = Object.fromEntries(EXPERIENCE_FIXTURES.map(f => [f.id, f]));

const normalise = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

/** Replay lookup: the stored program for a story text, if it is one of the fixtures. */
export function fixtureForStory(story: string): ExperienceFixture | undefined {
  const key = normalise(story);
  return EXPERIENCE_FIXTURES.find(f => normalise(f.source) === key);
}
