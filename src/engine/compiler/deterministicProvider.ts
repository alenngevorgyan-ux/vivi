import type { ViviExperienceDSL, DslCastMember, DslCommitment, DslEvent } from './dsl.ts';
import type { DslGrammar, DslObject, DslPlace, DslRole, DslVerb, DslWorld } from './vocabulary.ts';
import { WORLDS } from './vocabulary.ts';
import { resolvePlace, hostSlot, CARRIED } from './worldKnowledge.ts';
import type { StoryHints } from './preprocess.ts';
import type { Lang } from './i18n.ts';

/**
 * The deterministic semantic provider.
 *
 * With no model available Vivi still writes a valid DSL program from the
 * preprocessing hints, and that program goes through exactly the same
 * compiler as a model's. It cannot understand a story the way a model can —
 * its labels are generic and its choices come from grammar recipes — but it
 * always stages the right kind of room with the right kind of objects and a
 * physically sensible set of choices.
 */

/** World each grammar defaults to when the story names no place. */
const GRAMMAR_WORLD: Record<DslGrammar, DslWorld> = {
  betrayal: 'apt', intrusion: 'hall', scrutiny: 'bar', credit: 'office', find: 'hall', secret: 'bar',
  departure: 'station', family: 'home', temptation: 'street', message: 'bedroom', stranger: 'street', transition: 'apt',
};

/** Grammar each world defaults to when the story names no situation. */
const WORLD_GRAMMAR: Record<DslWorld, DslGrammar> = {
  apt: 'betrayal', hall: 'intrusion', bar: 'scrutiny', office: 'credit', station: 'departure', street: 'stranger',
  home: 'family', rental: 'intrusion', park: 'departure', bedroom: 'message',
};

type Labels = Record<string, string>;

/** Commitment labels by verb, optionally specialised by target. Short, physical, in the story's language. */
const COMMIT_LABELS: Record<Lang, Labels> = {
  en: {
    read: 'Read it', 'read:phone': 'Read the message', 'read:document': 'Read the document', 'read:letter': 'Read the letter',
    confront: 'Confront them', ask: 'Ask them directly', wait: 'Say nothing and wait', leave: 'Walk away',
    speak_up: 'Say it out loud', show: 'Show the evidence', call_help: 'Call for help', call: 'Call back',
    'call:phone': 'Call them back', answer: 'Answer', 'answer:intercom': 'Answer the intercom', follow: 'Follow them',
    return: 'Return it', 'return:envelope': 'Take it to the address', keep: 'Keep it', hide: 'Hide it', open: 'Open the door',
    lock: 'Lock the door', board: 'Get on the train', stay: 'Stay', accept: 'Accept', refuse: 'Refuse', tell: 'Tell someone',
    comfort: 'Comfort them', look: 'Look closer', 'look:photo': 'Look at the photo', 'keep:envelope': 'Keep the envelope',
    'look:board': 'Check the departure board', 'answer:phone': 'Answer the call',
  },
  ru: {
    read: 'Прочитать', 'read:phone': 'Прочитать сообщение', 'read:document': 'Прочитать документ', 'read:letter': 'Прочитать письмо',
    confront: 'Высказать всё', ask: 'Спросить прямо', wait: 'Промолчать и ждать', leave: 'Уйти',
    speak_up: 'Сказать вслух', show: 'Показать доказательства', call_help: 'Позвать на помощь', call: 'Перезвонить',
    'call:phone': 'Перезвонить', answer: 'Ответить', 'answer:intercom': 'Ответить в домофон', follow: 'Пойти следом',
    return: 'Вернуть', 'return:envelope': 'Отнести по адресу', keep: 'Оставить себе', hide: 'Спрятать', open: 'Открыть дверь',
    lock: 'Запереть дверь', board: 'Сесть в поезд', stay: 'Остаться', accept: 'Согласиться', refuse: 'Отказаться',
    tell: 'Рассказать', comfort: 'Утешить', look: 'Присмотреться', 'look:photo': 'Рассмотреть фото', 'keep:envelope': 'Оставить конверт',
    'look:board': 'Посмотреть на табло', 'answer:phone': 'Ответить на звонок',
  },
  hy: {
    read: 'Կարդալ', 'read:phone': 'Կարդալ հաղորդագրությունը', ask: 'Հարցնել ուղիղ', wait: 'Լռել և սպասել', leave: 'Հեռանալ',
    speak_up: 'Ասել բարձրաձայն', show: 'Ցույց տալ ապացույցը', call_help: 'Օգնություն կանչել', call: 'Հետ զանգել',
    answer: 'Պատասխանել', return: 'Վերադարձնել', keep: 'Պահել', open: 'Բացել դուռը', board: 'Նստել գնացք', stay: 'Մնալ',
    accept: 'Համաձայնել', refuse: 'Հրաժարվել', tell: 'Պատմել', look: 'Նայել ավելի մոտիկից',
  },
};

const OUTCOMES: Record<Lang, Labels> = {
  en: {
    read: 'You read it. Now you know more than you wanted to, and less than you need.',
    confront: 'You say it before you can stop yourself. Nothing in the room stays the same.',
    ask: 'You ask before you look. The answer now has to be given to your face.',
    wait: 'You let the moment pass. The question goes with you.',
    leave: 'You walk away with no answer and a clear memory of the moment.',
    speak_up: 'You say it out loud. Everyone in the room heard it.',
    show: 'You put the evidence in front of them. It is out of your hands now.',
    call_help: 'You call for help. Someone is on the way, and you are no longer alone with it.',
    call: 'You call. The line opens, and so does the conversation you were avoiding.',
    answer: 'You answer. Whatever happens next starts with your voice.',
    return: 'You take it back where it belongs. It costs you something to let it go.',
    keep: 'You keep it. Nobody saw. You will know.',
    hide: 'You hide it. The secret is now partly yours.',
    open: 'You open the door. The hall is emptier than you expected.',
    lock: 'You lock the door and stay behind it.',
    board: 'You step on. The doors close on everything you did not say.',
    stay: 'You stay. Whatever this costs, you are here for it.',
    accept: 'You say yes. It is done before you can think twice.',
    refuse: 'You say no. The offer disappears, and so does the easy way.',
    tell: 'You tell someone. It is no longer only yours to carry.',
    comfort: 'You reach for them. For a moment nothing else matters.',
    follow: 'You follow. You will learn where this leads.',
    look: 'You look closer. It is exactly what you feared it was.',
  },
  ru: {
    read: 'Вы прочитали. Теперь вы знаете больше, чем хотели, и меньше, чем нужно.',
    confront: 'Вы говорите это раньше, чем успеваете остановиться. Всё в комнате меняется.',
    ask: 'Вы спрашиваете прямо. Ответ теперь придётся дать вам в лицо.',
    wait: 'Вы даёте моменту пройти. Вопрос остаётся с вами.',
    leave: 'Вы уходите без ответа — и с очень ясной памятью об этом моменте.',
    speak_up: 'Вы говорите это вслух. Это услышали все.',
    show: 'Вы кладёте доказательства перед ними. Дальше — не в ваших руках.',
    call_help: 'Вы зовёте на помощь. Кто-то уже едет, и вы больше не одни.',
    call: 'Вы звоните. Линия открыта — и разговор, которого вы избегали, тоже.',
    answer: 'Вы отвечаете. Всё, что будет дальше, начинается с вашего голоса.',
    return: 'Вы возвращаете это туда, где ему место. Отпустить оказалось непросто.',
    keep: 'Вы оставляете это себе. Никто не видел. Вы будете знать.',
    hide: 'Вы прячете это. Теперь секрет отчасти ваш.',
    open: 'Вы открываете дверь. Коридор пустее, чем вы ожидали.',
    lock: 'Вы запираете дверь и остаётесь за ней.',
    board: 'Вы входите. Двери закрываются за всем несказанным.',
    stay: 'Вы остаётесь. Чего бы это ни стоило.',
    accept: 'Вы соглашаетесь. Всё случилось раньше, чем вы успели передумать.',
    refuse: 'Вы отказываетесь. Предложение исчезает — и лёгкий путь вместе с ним.',
    tell: 'Вы рассказываете. Теперь это не только ваша ноша.',
    comfort: 'Вы тянетесь к ним. На мгновение остальное неважно.',
    follow: 'Вы идёте следом. Вы узнаете, куда это ведёт.',
    look: 'Вы присматриваетесь. Это именно то, чего вы боялись.',
  },
  hy: {},
};

const LINES: Record<Lang, Labels> = {
  en: {
    unknownMessage: 'New message from an unknown number',
    praise: 'Excellent work.',
    approve: 'Any questions before we approve it?',
    demand: 'I need an answer now.',
    rely: 'Can I count on you here?',
    downstairs: 'Are you coming?',
    calling: '',
  },
  ru: {
    unknownMessage: 'Новое сообщение с неизвестного номера',
    praise: 'Отличная работа.',
    approve: 'Есть вопросы, прежде чем утвердим?',
    demand: 'Мне нужен ответ сейчас.',
    rely: 'Я могу на тебя рассчитывать?',
    downstairs: 'Ты идёшь?',
    calling: '',
  },
  hy: {
    unknownMessage: 'Նոր հաղորդագրություն անհայտ համարից',
    praise: 'Հիանալի աշխատանք։',
    approve: 'Հարցեր կա՞ն, նախքան հաստատելը։',
    demand: 'Ինձ հիմա է պետք պատասխանը։',
    rely: 'Կարո՞ղ եմ հույս դնել քեզ վրա։',
    downstairs: 'Գալի՞ս ես։',
    calling: '',
  },
};

function label(lang: Lang, verb: DslVerb, target: string | null): string {
  const table = COMMIT_LABELS[lang] ?? COMMIT_LABELS.en;
  return (target && table[`${verb}:${target}`]) || table[verb] || COMMIT_LABELS.en[`${verb}:${target}`] || COMMIT_LABELS.en[verb] || verb;
}

function outcome(lang: Lang, verb: DslVerb): string | undefined {
  return (OUTCOMES[lang] ?? OUTCOMES.en)[verb] ?? OUTCOMES.en[verb];
}

function line(lang: Lang, key: string): string {
  return (LINES[lang] ?? LINES.en)[key] ?? LINES.en[key];
}

/** Choose a world, preferring what the story names and what the grammar implies. */
function chooseWorld(h: StoryHints, grammar: DslGrammar): DslWorld {
  const scores = { ...h.worldScores };
  scores[GRAMMAR_WORLD[grammar]] = (scores[GRAMMAR_WORLD[grammar]] ?? 0) + 0.6;
  // A home-adjacent find ("outside my apartment") happens in the hallway, not the living room.
  if (grammar === 'find' && scores.apt && !scores.office) scores.hall = (scores.hall ?? 0) + scores.apt + 0.1;
  if (grammar === 'departure' && h.objects.includes('train')) scores.station = (scores.station ?? 0) + 2;
  // "Rented" outranks the generic apartment words it usually comes with.
  if (scores.rental) scores.rental += 1;
  let top: DslWorld = GRAMMAR_WORLD[grammar];
  let topN = -1;
  for (const [w, n] of Object.entries(scores) as Array<[DslWorld, number]>) {
    if (n > topN) {
      top = w;
      topN = n;
    }
  }
  return top;
}

function chooseGrammar(h: StoryHints): DslGrammar {
  const scores = { ...h.grammarScores };
  // A partner plus a message is the canonical betrayal shape.
  if (h.roles.includes('partner') && h.objects.includes('phone')) scores.betrayal = (scores.betrayal ?? 0) + (scores.message ? 1 : 0.8);
  if (h.roles.includes('boss') || h.roles.includes('coworker')) scores.credit = (scores.credit ?? 0) + 0.5;
  if ((h.objects.includes('envelope') || h.objects.includes('letter')) && !scores.temptation) scores.find = (scores.find ?? 0) + 1;
  if (h.objects.includes('train') || h.worldScores.station) scores.departure = (scores.departure ?? 0) + 0.8;
  if (h.clock && /^0[0-5]:/.test(h.clock)) scores.intrusion = (scores.intrusion ?? 0) + 1;
  if (h.objects.includes('photo') && h.worldScores.rental) scores.intrusion = (scores.intrusion ?? 0) + 1.5;
  let top: DslGrammar | undefined;
  let topN = 0;
  for (const [g, n] of Object.entries(scores) as Array<[DslGrammar, number]>) {
    if (n > topN) {
      top = g;
      topN = n;
    }
  }
  if (top) return top;
  const world = h.world;
  return world ? WORLD_GRAMMAR[world] : 'transition';
}

/** The first role that fits, from what the story mentions or the grammar implies. */
function firstRole(h: StoryHints, preferred: DslRole[], fallback: DslRole): DslRole {
  return preferred.find(r => h.roles.includes(r)) ?? h.roles.find(r => r !== 'stranger') ?? fallback;
}

export function deterministicDSL(h: StoryHints): ViviExperienceDSL {
  const lang = h.lang;
  const grammar = chooseGrammar(h);
  const w = chooseWorld(h, grammar);
  const world = WORLDS[w];
  const place = (p: DslPlace): DslPlace | null => (resolvePlace(world, p) ? p : null);
  const cast: DslCastMember[] = [];
  const objects = new Set<DslObject>();
  const events: DslEvent[] = [];
  const commitments: DslCommitment[] = [];
  const addCast = (role: DslRole, presence: 'on' | 'off' | 'bg', count?: number) => {
    if (cast.some(c => c[0] === role)) return;
    cast.push(count ? [role, presence, count] : [role, presence]);
  };
  const commit = (verb: DslVerb, target: string | null) => {
    if (commitments.length >= 4 || commitments.some(c => c[0] === verb && c[1] === target)) return;
    commitments.push([verb, target, label(lang, verb, target), '', outcome(lang, verb) ?? '']);
  };
  const remote = (role: DslRole) => h.remoteRoles.includes(role);
  const messageText = h.quote ?? line(lang, 'unknownMessage');
  const carriedPhone = hostSlot(world, 'phone') === CARRIED;

  switch (grammar) {
    case 'betrayal':
    case 'message': {
      const who = firstRole(h, ['partner', 'friend', 'ex', 'sibling'], 'partner');
      const showering = h.sounds.includes('shower') && !!place('bathroom');
      addCast(who, remote(who) ? 'off' : 'on');
      objects.add('phone');
      if (showering && !remote(who)) {
        events.push(['exit', who, 'bathroom'], ['sound', 'shower']);
      }
      events.push(['msg', 'phone', messageText], ['typing', 'phone']);
      if (showering && !remote(who)) events.push(['stop', 'shower']);
      else if (!remote(who)) events.push(['approach', who]);
      commit('read', 'phone');
      commit('ask', who);
      commit('wait', place('sofa') ?? null);
      commit('leave', null);
      break;
    }
    case 'intrusion':
    case 'stranger': {
      const stranger = h.roles.includes('stranger') && grammar === 'stranger';
      if (h.clock) events.push(['clock', h.clock]);
      if (w === 'hall') {
        objects.add('door');
        if (h.objects.includes('elevator') || !h.objects.includes('intercom')) {
          objects.add('elevator');
          events.push(['elevator', 'empty'], ['light', 'flicker']);
        } else {
          objects.add('intercom');
          events.push(['call', 'intercom'], ['elevator', 'empty']);
        }
        events.push(['handle', 'front_door']);
        if (objects.has('intercom')) commit('answer', 'intercom');
        commit('open', 'door');
        commit('call_help', 'phone');
        commit('wait', null);
      } else {
        const thing: DslObject = h.objects.find((o): o is DslObject => ['photo', 'letter', 'envelope', 'document'].includes(o)) ?? 'photo';
        objects.add(thing);
        if (stranger) addCast('stranger', 'on');
        events.push(['notice', thing], ['sound', 'footsteps']);
        if (stranger) events.push(['approach', 'stranger']);
        else events.push(['light', 'dim']);
        events.push(['handle', place('front_door') ? 'front_door' : 'exit']);
        commit('look', thing);
        commit(stranger ? 'ask' : 'leave', stranger ? 'stranger' : null);
        commit('call_help', 'phone');
        commit(stranger ? 'leave' : 'hide', null);
      }
      break;
    }
    case 'credit':
    case 'scrutiny': {
      const office = w === 'office';
      const accuser = firstRole(h, office ? ['boss', 'coworker'] : ['friend', 'stranger', 'guest'], office ? 'boss' : 'friend');
      if (office) {
        const stolenCredit = h.roles.includes('coworker');
        if (stolenCredit) addCast('coworker', 'on');
        addCast('boss', 'on');
        addCast('colleague', 'bg', 3);
        objects.add('screen');
        objects.add('laptop');
        objects.add('clock');
        if (stolenCredit) {
          events.push(['say', 'boss', h.quote ?? line(lang, 'praise')]);
          events.push(['say', 'boss', line(lang, 'approve')]);
        } else {
          events.push(['approach', 'boss'], ['say', 'boss', h.quote ?? line(lang, 'rely')]);
        }
        events.push(['countdown', 'clock', 10], ['stare', 'crowd']);
        commit('speak_up', 'screen');
        commit('show', 'laptop');
        commit('ask', 'boss');
        commit('wait', null);
      } else {
        addCast(accuser, 'on');
        addCast('guest', 'bg', 3);
        objects.add('phone');
        events.push(['sound', 'music'], ['say', accuser, h.quote ?? line(lang, 'demand')], ['stop', 'music'], ['stare', 'crowd']);
        commit('speak_up', place('center') ?? null);
        commit('confront', accuser);
        commit('read', 'phone');
        commit('leave', null);
      }
      break;
    }
    case 'find':
    case 'temptation': {
      const thing: DslObject =
        h.objects.find((o): o is DslObject => ['envelope', 'letter', 'bag', 'keys', 'document', 'photo'].includes(o)) ?? 'envelope';
      objects.add(thing);
      const giver = grammar === 'temptation' ? firstRole(h, ['stranger', 'boss', 'friend'], 'stranger') : null;
      if (giver) addCast(giver, 'on');
      events.push(['notice', thing]);
      if (giver) events.push(['say', giver, h.quote ?? line(lang, 'demand')]);
      events.push(['sound', 'footsteps']);
      if (w === 'hall') events.push(['elevator', 'arrive']);
      else if (giver) events.push(['approach', giver]);
      else events.push(['light', 'dim']);
      if (grammar === 'temptation') {
        commit('accept', thing);
        commit('refuse', giver);
      } else {
        commit('keep', thing);
        commit('return', null);
      }
      commit('call_help', 'phone');
      commit('leave', null);
      break;
    }
    case 'secret':
    case 'family': {
      const keeper = firstRole(h, grammar === 'family' ? ['parent', 'relative', 'sibling'] : ['sibling', 'friend', 'partner'], grammar === 'family' ? 'parent' : 'friend');
      const isRemote = remote(keeper);
      addCast(keeper, isRemote ? 'off' : 'on');
      if (h.publicScene && WORLDS[w] && (w === 'bar' || w === 'park' || w === 'station')) addCast('guest', 'bg', 3);
      if (grammar === 'family') {
        const doc: DslObject = h.objects.find((o): o is DslObject => ['document', 'letter', 'photo'].includes(o)) ?? 'document';
        objects.add(doc);
        events.push(['notice', doc]);
        events.push(['say', keeper, line(lang, 'downstairs')]);
        if (!isRemote) events.push(['approach', keeper]);
        else events.push(['sound', 'footsteps']);
        commit('read', doc);
        commit('ask', keeper);
        commit('hide', doc);
        commit('leave', null);
      } else {
        objects.add('phone');
        events.push(['call', 'phone', keeper]);
        if (w === 'bar') events.push(['sound', 'music']);
        events.push(['typing', 'phone']);
        if (w === 'bar') events.push(['stop', 'music'], ['stare', 'crowd']);
        else events.push(['light', 'dim']);
        commit('call', keeper);
        commit('tell', place('center') ?? null);
        commit('keep', null);
        commit('leave', null);
      }
      break;
    }
    case 'departure':
    case 'transition': {
      const other = firstRole(h, ['ex', 'partner', 'friend', 'sibling', 'parent'], 'friend');
      const isRemote = remote(other);
      addCast(other, isRemote ? 'off' : 'on');
      if (w === 'station') addCast('commuter', 'bg', 2);
      if (isRemote) {
        objects.add('phone');
        events.push(['call', 'phone', other]);
      } else {
        events.push(['say', other, h.quote ?? line(lang, 'demand')]);
      }
      if (w === 'station') {
        objects.add('board');
        objects.add('train');
        const seconds = Math.min(120, Math.max(20, (h.minutes ?? 2) * 12));
        events.push(['countdown', 'board', seconds], ['arrive', 'train']);
        commit(isRemote ? 'answer' : 'stay', isRemote ? 'phone' : other);
        commit('board', 'train');
        commit('wait', 'bench');
        commit('look', 'board');
      } else {
        events.push(['light', 'dim']);
        commit(isRemote ? 'answer' : 'tell', isRemote ? 'phone' : other);
        commit('stay', null);
        commit('leave', null);
        commit('wait', null);
      }
      break;
    }
  }

  // A carried phone never needs to be walked to, so a remote person is reached through it.
  if (carriedPhone) objects.add('phone');

  return {
    v: 1,
    w,
    g: grammar,
    c: cast,
    o: [...objects].slice(0, 4),
    e: events.slice(0, 9),
    a: commitments.slice(0, 4),
  };
}
