export const motion = {
  gestureMs: 180, cameraEaseMs: 950, revealHoldMs: 1600,
  reducedMotion: 'Prefer crossfades and keep critical cues visible as text.',
  easing: 'cubic-bezier(.22,.7,.18,1)',
} as const;

export type MotionTokenName =
  | 'FAST_UI'
  | 'NORMAL_UI'
  | 'CHARACTER_TURN'
  | 'WALK'
  | 'CAMERA_SOFT'
  | 'CAMERA_DRAMATIC'
  | 'REVEAL';

export interface MotionToken {
  durationMs: number;
  easing: string;
  note: string;
}

/**
 * One motion vocabulary for the whole product. Serious scenes get ease-out and
 * nothing else; spring is reserved for the feed, where a little life is welcome.
 */
export const motionTokens: Record<MotionTokenName, MotionToken> = {
  FAST_UI: {
    durationMs: 140,
    easing: 'cubic-bezier(.3,.8,.3,1)',
    note: 'Hover, focus ring, prompt fade. Should feel instant.',
  },
  NORMAL_UI: {
    durationMs: 240,
    easing: 'cubic-bezier(.22,.7,.18,1)',
    note: 'Panels, chips, state changes outside the world.',
  },
  CHARACTER_TURN: {
    durationMs: 260,
    easing: 'cubic-bezier(.33,.78,.2,1)',
    note: 'Head leads, torso follows. Never a sprite rotation.',
  },
  WALK: {
    durationMs: 760,
    easing: 'linear',
    note: 'One full stride cycle. Drives leg phase, not position.',
  },
  CAMERA_SOFT: {
    durationMs: 1400,
    easing: 'cubic-bezier(.22,.68,.16,1)',
    note: 'The default lens move. Should be almost invisible.',
  },
  CAMERA_DRAMATIC: {
    durationMs: 2600,
    easing: 'cubic-bezier(.4,.05,.5,.98)',
    note: 'Push-in only. Long enough that the viewer does not notice the start.',
  },
  REVEAL: {
    durationMs: 1600,
    easing: 'cubic-bezier(.19,.72,.16,1)',
    note: 'World hold into author truth. Crossfade, never a cut.',
  },
};

export const cssDuration = (name: MotionTokenName) => `${motionTokens[name].durationMs}ms`;
export const cssTransition = (name: MotionTokenName, property = 'all') =>
  `${property} ${motionTokens[name].durationMs}ms ${motionTokens[name].easing}`;
