import type { ViviExperienceDSL } from '../../engine/compiler/dsl.ts';

/**
 * Golden fixtures: the flagship situations written in the Experience DSL.
 *
 * These are the proof that hand-authored quality and generated content run
 * on the same system. Each one is the kind of program a model is asked to
 * write — no coordinates, no timings, no camera moves — and the compiler
 * turns it into the scene players enter.
 *
 * The long strings are curated copy, not something a model has to produce:
 * a model would write the same fields, usually shorter.
 */
export interface HeroDslFixture {
  dsl: ViviExperienceDSL;
  /** Ids kept stable so saved decisions and seeded reflections keep matching. */
  actionIds: string[];
  /** Index into `dsl.a` of what the author did. */
  authorChoice: number;
}

export const HERO_DSL: Record<string, HeroDslFixture> = {
  'the-message': {
    actionIds: ['phone', 'bathroom', 'sofa', 'away'],
    authorChoice: 1,
    dsl: {
      v: 1,
      w: 'apt',
      g: 'betrayal',
      t: 'restrained',
      c: [['partner', 'on']],
      o: ['phone'],
      e: [
        ['exit', 'partner', 'bathroom'],
        ['sound', 'shower'],
        ['msg', 'phone', 'I still smell like you.'],
        ['typing', 'phone'],
        ['stop', 'shower'],
      ],
      a: [
        ['read', 'phone', 'Open the message', 'The preview is still on the screen. You have not opened it.', 'You read the thread. A fragment becomes a fact, but context is still missing.'],
        ['ask', 'partner', 'Ask them directly', 'Water runs. The handle is still.', 'You ask before looking. They can answer, but now they know what you saw.'],
        ['wait', 'sofa', 'Wait and say nothing', 'You sit where you were. The phone buzzes again.', 'You let the screen go dark. The question survives the night.'],
        ['leave', 'bedroom', 'Leave the room', 'You put distance between yourself and the phone.', 'You leave the room with no proof and a clear memory of the preview.'],
      ],
      cg: 'intimate',
      st: 'normal_conversation',
      x: {
        ti: 'The Message',
        op: '“I’m going to shower.” The door closes. Water starts.',
        cu: 'The phone vibrates. “I still smell like you.”',
        pr: 'The shower stops. Footsteps behind the bathroom door.',
        q: 'Would you look at the phone?',
      },
    },
  },

  '0317': {
    actionIds: ['intercom', 'peephole', 'phone', 'window'],
    authorChoice: 3,
    dsl: {
      v: 1,
      w: 'hall',
      g: 'intrusion',
      t: 'eerie',
      c: [],
      o: ['intercom', 'elevator', 'door', 'phone'],
      e: [
        ['clock', '03:17'],
        ['call', 'intercom'],
        ['elevator', 'empty'],
        ['handle', 'front_door'],
      ],
      a: [
        ['answer', 'intercom', 'Speak through the intercom', 'Only an empty landing fills the little screen.', 'A voice says your apartment number, then the line cuts.'],
        ['open', 'door', 'Open the door', 'You see the elevator doors and one sliver of floor.', 'The hall is empty when you open it. You hear someone on the stairs.'],
        ['call', 'phone', 'Call the neighbor', 'Your neighbor texted: “Do not come into the hallway.”', 'Your neighbor answers in a whisper and asks whether your door is locked.'],
        ['wait', null, 'Stay inside and call for help', 'A car is waiting below with its lights off.', 'You stay behind the lock. The elevator goes down again.'],
      ],
      cg: 'suspense',
      st: 'isolated_subject',
      x: {
        ti: '03:17',
        op: '03:16. You are awake before the intercom rings.',
        cu: '03:17. INTERCOM. The hall camera is empty.',
        pr: 'The elevator counts 6… 7… 8… 9. Ding. Your door handle moves.',
        q: 'Would you open the door?',
      },
    },
  },

  'the-presentation': {
    actionIds: ['interrupt', 'laptop', 'director', 'wait'],
    authorChoice: 3,
    dsl: {
      v: 1,
      w: 'office',
      g: 'credit',
      t: 'tense',
      c: [['coworker', 'on'], ['boss', 'on'], ['colleague', 'bg', 3]],
      o: ['screen', 'laptop', 'clock'],
      e: [
        ['say', 'boss', 'Excellent work.'],
        ['say', 'boss', 'Any questions before we approve it?'],
        ['countdown', 'clock', 10],
        ['stare', 'crowd'],
      ],
      a: [
        ['speak_up', 'screen', 'Claim the work in the room', 'Your coworker stops talking for half a beat.', 'You say it in front of everyone. The room turns toward your coworker.'],
        ['show', 'laptop', 'Show the drafts', 'Your dated draft and the original files are one click away.', 'You share the dated draft. The director pauses the approval.'],
        ['ask', 'boss', 'Ask for a private conversation', 'They are waiting for someone to speak.', 'You ask for a private meeting. The public moment passes.'],
        ['wait', null, 'Let approval proceed', 'The silence feels longer from your chair.', 'The work is approved under your coworker’s name. You keep your evidence.'],
      ],
      cg: 'scrutiny',
      st: 'public_pressure',
      x: {
        ti: 'The Presentation',
        op: 'The third slide is yours. So is the fourth.',
        cu: 'The director smiles. “Excellent work.”',
        pr: '“Any questions before we approve it?” Ten seconds of silence.',
        q: 'Would you speak up in the room?',
      },
    },
  },
};
