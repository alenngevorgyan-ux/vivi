import type { CommunityReflection } from '../../engine/runtime/RuntimeCompiler.ts';

/**
 * Curated facts about the flagship stories that used to live as `story.id`
 * branches inside the runtime compiler. They are content, so they live with
 * the content.
 */
export interface HeroCuration {
  /** Action id of what the author did. */
  authorChoiceId?: string;
  /** Whether a second person is physically in the room. */
  companion?: boolean;
  /** Seeded demo reflections. */
  reflections?: CommunityReflection[];
}

const companion = { companion: true } as const;

export const HERO_CURATION: Record<string, HeroCuration> = {
  'the-message': {
    authorChoiceId: 'bathroom',
    companion: true,
    reflections: [
      {
        id: 'ref_msg_1',
        authorHandle: '@author_verified',
        authorName: 'Author Note',
        text: 'Looking back, what hurt most wasn’t the notification itself, but how instantly trust felt like glass. We stayed together for another year, but that silence while the shower ran never really left me.',
        timestamp: 'Pinned by author',
        isAuthorResponse: true,
        upvotes: 142,
      },
      {
        id: 'ref_msg_2',
        authorHandle: '@clara_m',
        authorName: 'Clara',
        choiceLabel: 'Open the message',
        text: 'I voted to look. Everyone says trust until it’s your gut screaming at 11 PM. You can’t unsee it, but living in doubt is worse.',
        timestamp: '3 hours ago',
        upvotes: 56,
      },
      {
        id: 'ref_msg_3',
        authorHandle: '@mark_d',
        authorName: 'Mark',
        choiceLabel: 'Ask them directly',
        text: 'Knocking on the bathroom door is the only way to retain your own dignity. If they lie, that’s on them.',
        timestamp: '5 hours ago',
        upvotes: 38,
      },
    ],
  },
  '0317': {
    authorChoiceId: 'window',
    reflections: [
      {
        id: 'ref_0317_1',
        authorHandle: '@author_verified',
        authorName: 'Author Note',
        text: 'I didn’t sleep normally for two weeks after this. The sound of the elevator counting up was the scariest part.',
        timestamp: 'Pinned by author',
        isAuthorResponse: true,
        upvotes: 89,
      },
      {
        id: 'ref_0317_2',
        authorHandle: '@night_owl_99',
        authorName: 'Viktor',
        choiceLabel: 'Stay inside and call for help',
        text: 'Never open a door at 3 AM. No curiosity is worth that risk.',
        timestamp: '1 day ago',
        upvotes: 67,
      },
    ],
  },
  'the-presentation': { authorChoiceId: 'wait', ...companion },
  'last-walk': { authorChoiceId: 'quiet', ...companion },
  'the-secret': companion,
  'the-screenshot': companion,
  'the-envelope': companion,
  'the-wedding': companion,
  'the-family-document': companion,
  'the-last-train': companion,
};
