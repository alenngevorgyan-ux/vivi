/**
 * c_meeting_before / c_meeting_question — one meeting room, two arc purposes, the same three bodies. The slide
 * carries the same live title on the meeting display; nothing on it changes on return. The director's question
 * is shown only as the Gold fact text (F11), verbatim. The description names who is present, nothing more.
 */

export const meetingDescription = (displayTitle: string, question: boolean) =>
  `The meeting room${question ? ', after the break' : ''}. Mira and the director are here. The display shows “${displayTitle}”.`;
