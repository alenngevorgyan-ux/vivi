import { worldTemplates, type ViviWorldId } from '../../world/templates';
import type { ShotCue, ShotType } from './shotTypes';

export type ViviCameraShot =
  | 'ESTABLISHING_WIDE'
  | 'SOFT_FOLLOW'
  | 'TWO_SHOT'
  | 'OBJECT_INSERT'
  | 'OVER_SHOULDER'
  | 'STATIC_TENSION'
  | 'SLOW_PUSH_IN'
  | 'WIDE_SILENCE'
  | 'NPC_EXIT'
  | 'FINAL_COMMIT'
  | 'REALITY_HOLD';

export type CameraSubject = 'world' | 'player' | 'npc' | 'slot' | 'midpoint';

/** Fraction of the stage kept clear of UI on each edge for this shot. */
export interface CameraSafeZone {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface CameraPresetDef {
  /** What the lens is pointed at. */
  subject: CameraSubject;
  /** Semantic slot used when subject is 'slot'; falls back to world centre. */
  slot?: string;
  /** Zoom at the start of the move. */
  zoom: number;
  /** Zoom at the end of the move; equal to zoom for a locked frame. */
  zoomTo?: number;
  /** Where the subject sits in frame, as a fraction of the stage. */
  framing: [number, number];
  /** How long the move takes to settle. */
  durationMs: number;
  easing: string;
  /** Whether the player keeps control while the shot is held. */
  control: 'locked' | 'free';
  safeZone: CameraSafeZone;
}

const STANDARD_SAFE: CameraSafeZone = { top: 0.12, right: 0.1, bottom: 0.18, left: 0.1 };
const INSERT_SAFE: CameraSafeZone = { top: 0.16, right: 0.14, bottom: 0.26, left: 0.14 };
const WIDE_SAFE: CameraSafeZone = { top: 0.1, right: 0.08, bottom: 0.14, left: 0.08 };

/** Almost-invisible settle. Nothing in this language overshoots. */
const EASE_SOFT = 'cubic-bezier(.22,.68,.16,1)';
/** Slightly firmer arrival for a cut-adjacent move. */
const EASE_FIRM = 'cubic-bezier(.33,.78,.2,1)';
/** Long, near-linear creep used only by the push-in. */
const EASE_CREEP = 'cubic-bezier(.4,.05,.5,.98)';

/**
 * The Vivi camera language. Every preset is deliberately understated: the
 * largest single jump is 1.0 → 1.9 across 2.6 seconds, and nothing bounces.
 */
export const viviCameraLanguage: Record<ViviCameraShot, CameraPresetDef> = {
  ESTABLISHING_WIDE: {
    subject: 'world',
    zoom: 1,
    framing: [0.5, 0.52],
    durationMs: 2000,
    easing: EASE_SOFT,
    control: 'locked',
    safeZone: WIDE_SAFE,
  },
  SOFT_FOLLOW: {
    subject: 'player',
    zoom: 1.14,
    framing: [0.44, 0.6],
    durationMs: 1400,
    easing: EASE_SOFT,
    control: 'free',
    safeZone: STANDARD_SAFE,
  },
  TWO_SHOT: {
    subject: 'midpoint',
    zoom: 1.2,
    framing: [0.5, 0.56],
    durationMs: 1500,
    easing: EASE_SOFT,
    control: 'free',
    safeZone: STANDARD_SAFE,
  },
  OBJECT_INSERT: {
    subject: 'slot',
    zoom: 1.78,
    framing: [0.5, 0.48],
    durationMs: 1250,
    easing: EASE_FIRM,
    control: 'locked',
    safeZone: INSERT_SAFE,
  },
  OVER_SHOULDER: {
    subject: 'player',
    zoom: 1.5,
    framing: [0.38, 0.62],
    durationMs: 1300,
    easing: EASE_SOFT,
    control: 'locked',
    safeZone: INSERT_SAFE,
  },
  STATIC_TENSION: {
    subject: 'midpoint',
    zoom: 1.1,
    framing: [0.5, 0.54],
    durationMs: 1800,
    easing: EASE_SOFT,
    control: 'free',
    safeZone: STANDARD_SAFE,
  },
  SLOW_PUSH_IN: {
    subject: 'slot',
    zoom: 1.16,
    zoomTo: 1.44,
    framing: [0.5, 0.5],
    durationMs: 2600,
    easing: EASE_CREEP,
    control: 'free',
    safeZone: STANDARD_SAFE,
  },
  WIDE_SILENCE: {
    subject: 'world',
    zoom: 0.98,
    framing: [0.5, 0.5],
    durationMs: 2400,
    easing: EASE_SOFT,
    control: 'free',
    safeZone: WIDE_SAFE,
  },
  NPC_EXIT: {
    subject: 'npc',
    zoom: 1.12,
    framing: [0.58, 0.56],
    durationMs: 1700,
    easing: EASE_SOFT,
    control: 'free',
    safeZone: STANDARD_SAFE,
  },
  FINAL_COMMIT: {
    subject: 'player',
    zoom: 1.34,
    framing: [0.46, 0.58],
    durationMs: 1500,
    easing: EASE_FIRM,
    control: 'locked',
    safeZone: INSERT_SAFE,
  },
  REALITY_HOLD: {
    subject: 'world',
    zoom: 1.06,
    framing: [0.5, 0.52],
    durationMs: 2200,
    easing: EASE_SOFT,
    control: 'locked',
    safeZone: WIDE_SAFE,
  },
};

/** Authored `ShotType` values map onto the camera language one-to-one. */
const SHOT_TYPE_TO_CAMERA: Record<ShotType, ViviCameraShot> = {
  ESTABLISHING_WIDE: 'ESTABLISHING_WIDE',
  PLAYER_REVEAL: 'SOFT_FOLLOW',
  FOLLOW: 'SOFT_FOLLOW',
  TWO_SHOT: 'TWO_SHOT',
  OVER_SHOULDER: 'OVER_SHOULDER',
  OBJECT_INSERT: 'OBJECT_INSERT',
  PHONE_INSERT: 'OBJECT_INSERT',
  MEMORY_ECHO: 'WIDE_SILENCE',
  SLOW_PUSH_IN: 'SLOW_PUSH_IN',
  STATIC_TENSION: 'STATIC_TENSION',
  WIDE_SILENCE: 'WIDE_SILENCE',
  NPC_EXIT: 'NPC_EXIT',
  FINAL_COMMIT: 'FINAL_COMMIT',
  REALITY_REVEAL: 'REALITY_HOLD',
};

export function cameraShotForType(type: ShotType): ViviCameraShot {
  return SHOT_TYPE_TO_CAMERA[type];
}

/** Slot the lens should favour when an authored cue names no explicit target. */
const DEFAULT_INSERT_SLOT: Record<ViviWorldId, string> = {
  apartment_night: 'phone_table',
  hallway_night: 'front_door',
  bar_or_party: 'phone_area',
  office_night: 'presentation_screen',
  train_station: 'station_board',
  city_rain: 'window',
  family_home: 'documents',
  hotel_or_rental: 'photo',
  neighborhood_sunset: 'bus_stop',
  bedroom_night: 'phone_screen',
};

export interface CameraAnchors {
  player: [number, number];
  npc?: [number, number];
}

/** Resolve the world-space point (0–100) a shot should centre on. */
export function resolveCameraTarget(
  shot: ViviCameraShot,
  world: ViviWorldId,
  anchors: CameraAnchors,
  slotOverride?: string,
  pointOverride?: [number, number]
): [number, number] {
  const preset = viviCameraLanguage[shot];
  const template = worldTemplates[world];
  const heroCamera = template.heroCamera;

  switch (preset.subject) {
    case 'player':
      return anchors.player;
    case 'npc':
      return anchors.npc ?? anchors.player;
    case 'midpoint': {
      if (!anchors.npc) return anchors.player;
      return [
        (anchors.player[0] + anchors.npc[0]) / 2,
        (anchors.player[1] + anchors.npc[1]) / 2,
      ];
    }
    case 'slot': {
      if (pointOverride) return pointOverride;
      const wanted = slotOverride || preset.slot || DEFAULT_INSERT_SLOT[world];
      const found = template.slots.find(s => s.id === wanted);
      return found ? [found.x, found.y] : heroCamera;
    }
    default:
      return heroCamera;
  }
}

export interface CameraFrame {
  /** Stage-percent offset of the world layer, so a tap can be mapped back into the world. */
  translate: [number, number];
  /** CSS transform for the camera layer, with transform-origin at 0 0. */
  transform: string;
  transition: string;
  zoom: number;
  safeZone: CameraSafeZone;
  control: 'locked' | 'free';
}

/**
 * Build the CSS frame for a shot.
 *
 * The camera layer is the same size as the stage, so a percentage translate
 * maps directly onto stage fractions: screen = zoom * world + translate.
 */
export function buildCameraFrame(
  shot: ViviCameraShot,
  world: ViviWorldId,
  anchors: CameraAnchors,
  options: { slot?: string; point?: [number, number]; progress?: number; reducedMotion?: boolean; zoomScale?: number } = {}
): CameraFrame {
  const preset = viviCameraLanguage[shot];
  const [targetX, targetY] = resolveCameraTarget(shot, world, anchors, options.slot, options.point);

  const progress = options.progress ?? 1;
  const baseZoom =
    preset.zoomTo !== undefined
      ? preset.zoom + (preset.zoomTo - preset.zoom) * Math.min(1, Math.max(0, progress))
      : preset.zoom;
  // Never below 1: the camera may widen for a small screen but must not reveal
  // the world's own edges.
  const zoom = Math.max(1, baseZoom * (options.zoomScale ?? 1));

  // Keep the framed point inside the world so the camera never shows past an edge.
  const halfW = 50 / zoom;
  const halfH = 50 / zoom;
  const clampedX = Math.min(100 - halfW, Math.max(halfW, targetX));
  const clampedY = Math.min(100 - halfH, Math.max(halfH, targetY));

  const [framingX, framingY] = preset.framing;
  const translateX = (framingX - (clampedX / 100) * zoom) * 100;
  const translateY = (framingY - (clampedY / 100) * zoom) * 100;

  return {
    translate: [translateX, translateY],
    transform: `translate(${translateX.toFixed(3)}%, ${translateY.toFixed(3)}%) scale(${zoom.toFixed(4)})`,
    transition: options.reducedMotion
      ? 'none'
      : `transform ${preset.durationMs}ms ${preset.easing}`,
    zoom,
    safeZone: preset.safeZone,
    control: preset.control,
  };
}

/** Timeline entry produced from an authored shot list. */
export interface ResolvedShot {
  shot: ViviCameraShot;
  startMs: number;
  endMs: number;
  control: 'locked' | 'free';
  slot?: string;
}

/**
 * Lay authored cues onto an absolute timeline. A cue's own `control` wins over
 * the preset default so an author can keep the player moving through a push-in.
 */
export function resolveShotTimeline(cues: ShotCue[] | undefined): ResolvedShot[] {
  if (!cues || cues.length === 0) return [];
  const timeline: ResolvedShot[] = [];
  let cursor = 0;
  for (const cue of cues) {
    const shot = cameraShotForType(cue.type);
    timeline.push({
      shot,
      startMs: cursor,
      endMs: cursor + cue.durationMs,
      control: cue.control,
      slot: cue.target,
    });
    cursor += cue.durationMs;
  }
  return timeline;
}

/** The shot that owns a given moment, or null once the timeline has run out. */
export function shotAt(timeline: ResolvedShot[], elapsedMs: number): ResolvedShot | null {
  for (const entry of timeline) {
    if (elapsedMs >= entry.startMs && elapsedMs < entry.endMs) return entry;
  }
  return null;
}
