import type { BlindStory } from './blindCorpus.ts';

/**
 * HOLDOUT SET — written for the compiler quality pass, scored once at the end.
 *
 * Neither the semantic classifier, the grounding lexicons, the prompt nor the
 * compiler were looked at against these stories while they were being changed.
 * They exist to answer one question honestly: does the hardening generalise to
 * human stories nobody tuned against, or only to the corpus it was built on?
 *
 * Rules that apply to this file, forever:
 *   - never read a failure here back into a rule without first finding the
 *     same failure in the development corpus;
 *   - never name one of these ids anywhere in src/;
 *   - if it is ever used for tuning, it stops being a holdout and a new one
 *     has to be written.
 *
 * `expect` is a loose rubric in the same shape as the blind set: any
 * acceptable world, groups where one member must appear, the roles the story
 * actually supports on stage, and the kinds of event the central moment could
 * reasonably be written as.
 */
export const HOLDOUT_CORPUS: BlindStory[] = [
  // ------------------------------------------------------------- English
  {
    id: 'hold-en-rel-ring', lang: 'en', category: 'relationships',
    story: "I was looking for batteries in my girlfriend's drawer and found a ring box. Her birthday was months away and mine was yesterday.",
    expect: { worlds: ['apt', 'bedroom', 'home'], allowRoles: ['partner'], centralEvents: ['notice', 'echo', 'enter'] },
  },
  {
    id: 'hold-en-work-recording', lang: 'en', category: 'work',
    story: 'My manager left the meeting recording running and I heard them discussing which of us to cut. My name came up twice.',
    expect: { worlds: ['office'], objectGroups: [['laptop', 'screen', 'phone']], peopleGroups: [['boss']], allowRoles: ['boss', 'coworker', 'colleague'], centralEvents: ['msg', 'notice', 'say'] },
  },
  {
    id: 'hold-en-creepy-chair', lang: 'en', category: 'creepy',
    story: 'I came home and the kitchen chair was pulled out and turned to face the front door. I live alone and I lock up every morning.',
    expect: { worlds: ['apt', 'home', 'rental'], allowRoles: [], centralEvents: ['notice', 'sound', 'handle'] },
  },
  {
    id: 'hold-en-money-split', lang: 'en', category: 'money',
    story: 'At dinner my friend quietly paid the whole bill, and I knew he had just lost his job. The waiter was already bringing the card back.',
    expect: { worlds: ['bar'], peopleGroups: [['friend']], allowRoles: ['friend', 'guest', 'host', 'stranger'], centralEvents: ['say', 'notice', 'approach'] },
  },
  {
    id: 'hold-en-dep-platform', lang: 'en', category: 'departure',
    story: 'My father drove me to the station and said nothing the whole way. On the platform he finally started to speak and the train doors opened.',
    expect: { worlds: ['station'], peopleGroups: [['parent']], allowRoles: ['parent', 'commuter'], centralEvents: ['say', 'arrive', 'depart', 'open'] },
  },

  // ------------------------------------------------------------- Russian
  {
    id: 'hold-ru-family-photo', lang: 'ru', category: 'family',
    story: 'Разбирая вещи после переезда, я нашла детскую фотографию, где рядом со мной стоит женщина, которую мне никогда не показывали.',
    expect: { worlds: ['home', 'apt', 'rental'], objectGroups: [['photo']], allowRoles: ['parent', 'relative', 'sibling'], centralEvents: ['echo', 'notice'] },
  },
  {
    id: 'hold-ru-creepy-lift', lang: 'ru', category: 'creepy',
    story: 'Лифт сам поехал на мой этаж и открылся. Внутри горел свет и лежал мой зонт, который я потеряла неделю назад.',
    expect: { worlds: ['hall'], objectGroups: [['elevator']], allowRoles: ['neighbor', 'stranger'], centralEvents: ['elevator', 'notice', 'light'] },
  },
  {
    id: 'hold-ru-social-speech', lang: 'ru', category: 'social',
    story: 'На корпоративе меня вызвали сказать пару слов о компании, а я за день до этого написала заявление об увольнении. Все уже смотрели на меня.',
    expect: { worlds: ['bar', 'office'], allowRoles: ['boss', 'colleague', 'coworker', 'guest', 'host'], centralEvents: ['stare', 'say'] },
  },
  {
    id: 'hold-ru-moral-keys', lang: 'ru', category: 'moral',
    story: 'Сосед попросил присмотреть за квартирой и оставил ключи. Ночью оттуда стал доноситься звук, как будто кто-то ходит.',
    expect: { worlds: ['hall', 'apt'], objectGroups: [['keys', 'door']], peopleGroups: [['neighbor']], allowRoles: ['neighbor', 'stranger'], centralEvents: ['sound', 'handle', 'notice'] },
  },
  {
    id: 'hold-ru-rel-ticket', lang: 'ru', category: 'relationships',
    story: 'В кармане куртки мужа я нашла посадочный талон на рейс, о котором он мне не говорил, и дата была на прошлой неделе.',
    expect: { worlds: ['apt', 'bedroom', 'home'], objectGroups: [['ticket', 'document', 'letter']], allowRoles: ['partner'], centralEvents: ['notice', 'enter', 'msg'] },
  },

  // ------------------------------------------------------------ Armenian
  {
    id: 'hold-hy-family-debt', lang: 'hy', category: 'family',
    story: 'Եղբայրս խնդրեց, որ իր փոխարեն ստորագրեմ վարկի փաստաթղթերը, և ասաց, որ ծնողները չպետք է իմանան։',
    expect: { worlds: ['home', 'apt'], objectGroups: [['document', 'letter']], peopleGroups: [['sibling']], allowRoles: ['sibling', 'parent', 'relative'], centralEvents: ['say', 'notice'] },
  },
  {
    id: 'hold-hy-work-praise', lang: 'hy', category: 'work',
    story: 'Ղեկավարս բոլորի առաջ շնորհակալություն հայտնեց սխալ մարդուն, իսկ ես այդ աշխատանքը արել էի գիշերը։',
    expect: { worlds: ['office'], peopleGroups: [['boss']], allowRoles: ['boss', 'coworker', 'colleague'], centralEvents: ['say', 'stare'] },
  },
  {
    id: 'hold-hy-creepy-steps', lang: 'hy', category: 'creepy',
    story: 'Ամեն գիշեր վերևի հարկից քայլերի ձայն եմ լսում, բայց այդ բնակարանը երկու տարի է դատարկ է։',
    expect: { worlds: ['apt', 'bedroom', 'hall'], allowRoles: ['neighbor'], centralEvents: ['sound', 'stop', 'clock'] },
  },
  {
    id: 'hold-hy-dep-goodbye', lang: 'hy', category: 'departure',
    story: 'Ընկերուհիս ասաց, որ վաղը մեկնում է և այլևս չի վերադառնա, իսկ մենք կանգնած էինք կանգառում։',
    expect: { worlds: ['park', 'street', 'station'], allowRoles: ['partner', 'friend', 'commuter'], centralEvents: ['say', 'depart', 'arrive'] },
  },
  {
    id: 'hold-hy-money-envelope', lang: 'hy', category: 'money',
    story: 'Աշխատավայրում ինձ ծրար տվեցին և ասացին՝ «սա մեր միջև մնա»։ Ներսում փող կար։',
    expect: { worlds: ['office'], objectGroups: [['envelope']], allowRoles: ['boss', 'coworker', 'colleague', 'stranger'], centralEvents: ['say', 'notice'] },
  },
];
