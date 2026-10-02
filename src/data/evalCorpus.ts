/**
 * Evaluation corpus for the Experience Compiler.
 *
 * Short, fresh stories across Vivi's territory — not variants of the
 * flagships. The eight `acceptance` entries are the required fresh inputs;
 * the rest widen coverage across categories and languages. `expect` holds
 * only what a reasonable reader would insist on (the kind of room, an object
 * that must exist), never a specific compiled shape.
 */
export interface EvalStory {
  id: string;
  category: 'relationships' | 'creepy' | 'work' | 'family' | 'money' | 'friendship' | 'departure' | 'moral' | 'social' | 'strange';
  story: string;
  outcome?: string;
  acceptance?: string;
  expect?: { worlds?: string[]; objects?: string[] };
}

export const EVAL_CORPUS: EvalStory[] = [
  // ------------------------------------------------------------- acceptance
  { id: 'A-last-train', acceptance: 'A', category: 'departure', story: 'My ex called me five minutes before the last train left and said they needed to tell me something before I left.', expect: { worlds: ['station'], objects: ['phone', 'train'] } },
  { id: 'B-shower-message', acceptance: 'B', category: 'relationships', story: 'My partner went into the shower and a message from a stranger appeared on their phone.', expect: { worlds: ['apt', 'bedroom'], objects: ['phone'] } },
  { id: 'C-stolen-slides', acceptance: 'C', category: 'work', story: 'During a meeting my coworker presented slides I had made as their own.', expect: { worlds: ['office'], objects: ['screen', 'laptop'] } },
  { id: 'D-cash-envelope', acceptance: 'D', category: 'money', story: 'I found an envelope with a large amount of cash outside my apartment. There was an address written on it.', expect: { worlds: ['hall', 'street'], objects: ['envelope'] } },
  { id: 'E-wedding-call', acceptance: 'E', category: 'family', story: 'My sister called me ten minutes before her wedding and told me something nobody else knew.', expect: { worlds: ['bar', 'home'], objects: ['phone'] } },
  { id: 'F-empty-elevator', acceptance: 'F', category: 'creepy', story: 'The elevator opened on my floor at 3 AM, but nobody came out.', expect: { worlds: ['hall'], objects: ['elevator'] } },
  { id: 'G-rental-photo', acceptance: 'G', category: 'creepy', story: 'I saw a photo of myself inside the apartment I had just rented.', expect: { worlds: ['rental'], objects: ['photo'] } },
  { id: 'H-take-the-blame', acceptance: 'H', category: 'work', story: "My manager asked me to take responsibility for a mistake I hadn't made.", expect: { worlds: ['office'] } },

  // ---------------------------------------------------------- relationships
  { id: 'rel-location', category: 'relationships', story: 'My husband said he was at a conference. His phone location showed him at an address I did not recognise, at midnight.', expect: { objects: ['phone'] } },
  { id: 'rel-old-letter', category: 'relationships', story: 'Cleaning the bedroom, I found a letter my girlfriend had written to her ex, dated last week.', expect: { objects: ['letter'] } },
  { id: 'rel-ru-message', category: 'relationships', story: 'Муж уснул, а на его телефоне всплыло сообщение: «Ты сказал ей?»', expect: { objects: ['phone'] } },
  { id: 'rel-proposal', category: 'relationships', story: 'At dinner with my parents my boyfriend got down on one knee. I had told him I was not ready.', outcome: 'I said yes in front of everyone and told him the truth in the car.' },

  // ----------------------------------------------------------------- creepy
  { id: 'creepy-knock', category: 'creepy', story: 'Someone knocked on my door three times at 2:40 AM. The peephole showed an empty landing.', expect: { worlds: ['hall'] } },
  { id: 'creepy-ru-intercom', category: 'creepy', story: 'В 03:12 зазвонил домофон. На экране никого не было, а потом лифт поехал на мой этаж.', expect: { worlds: ['hall'] } },
  { id: 'creepy-hotel-key', category: 'creepy', story: 'In the hotel, a second key card was waiting on the table with my name spelled wrong.', expect: { worlds: ['rental'] } },
  { id: 'creepy-car', category: 'strange', story: 'A man in a parked car with the lights off watched me walk home in the rain every night that week.', expect: { worlds: ['street'] } },

  // ------------------------------------------------------------------- work
  { id: 'work-layoffs', category: 'work', story: 'My boss showed me the layoff list before the meeting. My best friend at work was on it, and she was sitting next to me.', expect: { worlds: ['office'] } },
  { id: 'work-ru-credit', category: 'work', story: 'На планерке коллега выдал мой отчёт за свой, а директор попросил всех похлопать.', expect: { worlds: ['office'] } },
  { id: 'work-wrong-email', category: 'work', story: 'I accidentally saw an email on my manager\'s laptop saying our whole team would be replaced next month.', expect: { worlds: ['office'], objects: ['laptop'] } },

  // ----------------------------------------------------------------- family
  { id: 'family-adopted', category: 'family', story: 'In my mother\'s drawer I found a birth certificate with a different name for my father.', expect: { worlds: ['home'], objects: ['document'] } },
  { id: 'family-hy-letter', category: 'family', story: 'Տատիկիս տանը գտա մի նամակ, որը հայրս երբեք չէր ուղարկել։', expect: { objects: ['letter'] } },
  { id: 'family-will', category: 'family', story: 'At my grandfather\'s house after the funeral, my uncle asked me to sign the will before anyone else arrived.', expect: { worlds: ['home'] } },

  // ------------------------------------------------------------------ money
  { id: 'money-bribe', category: 'money', story: 'A stranger offered me cash to deliver a sealed envelope, no questions asked.', expect: { objects: ['envelope'] } },
  { id: 'money-wallet', category: 'money', story: 'I found a wallet on the train platform with a lot of money and a photo of a little girl inside.', expect: { worlds: ['station'] } },
  { id: 'money-ru-transfer', category: 'money', story: 'Мне по ошибке перевели крупную сумму, а через минуту позвонил незнакомец и попросил вернуть.', expect: { objects: ['phone'] } },

  // ------------------------------------------------------------- friendship
  { id: 'friend-secret', category: 'friendship', story: 'At the party my best friend confessed he was cheating. His girlfriend was walking over to us.', expect: { worlds: ['bar'] } },
  { id: 'friend-screenshot', category: 'friendship', story: 'Someone sent me a screenshot of my friends mocking me in a group chat, ten minutes before I met them at the bar.', expect: { worlds: ['bar'], objects: ['phone'] } },
  { id: 'friend-goodbye', category: 'friendship', story: 'My oldest friend was moving abroad. We had one walk to the bus stop left.', expect: { worlds: ['park'] } },

  // -------------------------------------------------------------- departure
  { id: 'dep-airport-call', category: 'departure', story: 'My father called while I was boarding a flight and said he was sorry for the first time in my life.', expect: { objects: ['phone'] } },
  { id: 'dep-ru-train', category: 'departure', story: 'Она стояла на платформе, а последний поезд уже подъезжал. Я так и не сказал, что люблю её.', expect: { worlds: ['station'] } },

  // ------------------------------------------------------------------ moral
  { id: 'moral-cheating-exam', category: 'moral', story: 'During the exam I saw the answers on the teacher\'s desk when she left the room.' },
  { id: 'moral-hit-car', category: 'moral', story: 'In the parking lot I scraped a stranger\'s car. Nobody saw it happen.', expect: { worlds: ['street'] } },

  // ----------------------------------------------------------------- social
  { id: 'social-toast', category: 'social', story: 'At my sister\'s wedding the microphone was handed to me and everyone looked at me. I had nothing prepared.', expect: { worlds: ['bar'] } },
  { id: 'social-wrong-name', category: 'social', story: 'At the restaurant I called my new boss by the wrong name in front of the whole team and everyone laughed.', expect: { worlds: ['bar', 'office'] } },

  // ---------------------------------------------------------------- strange
  { id: 'strange-photo-wall', category: 'strange', story: 'In the guesthouse there was a framed photo on the wall of my family\'s old kitchen.', expect: { worlds: ['rental'], objects: ['photo'] } },
  { id: 'strange-note', category: 'strange', story: 'There was a note on my windshield in my own handwriting that I don\'t remember writing.' },
];
