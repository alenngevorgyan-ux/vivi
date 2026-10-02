import type { StagingPreset } from '../cinematic/staging.ts';
import type { DslCameraGrammar, DslGrammar, DslTone, DslLighting } from './vocabulary.ts';

/**
 * Experience grammars: reusable human-situation shapes.
 *
 * A grammar is the compiler's answer to "how does this kind of moment
 * breathe?" It owns pacing, how much the room asks of the player, the camera
 * and staging defaults, how restrained the sound is and how the reveal lands.
 * A model picks one word; the grammar supplies the rest.
 */
export interface ExperienceGrammarDef {
  label: string;
  camera: DslCameraGrammar;
  staging: StagingPreset;
  tone: DslTone;
  /** When the first setup event happens. */
  setupAtMs: number;
  /** When the cue — the thing that changes — lands. */
  cueAtMs: number;
  /** When pressure starts to close the window. */
  pressureAtMs: number;
  /** Gap between consecutive events inside one phase. */
  spacingMs: number;
  /** Gap between the cue and a development beat (a second message, typing). */
  developAfterMs: number;
  /** A screen that locks counts down this many seconds after a message. 0 = no lock. */
  phoneLockSec: number;
  /** Seconds a countdown runs when an event names none. */
  countdownSec: number;
  /** 0 = sound fully present, 1 = near-silent beds. Silence is a tool. */
  soundRestraint: number;
  /** Multiplier on interaction radii: sparse rooms ask the player to walk further. */
  interactionReach: number;
  /** How long the world holds after a commitment before the consequence is read. */
  revealHoldMs: number;
  /** Extra darkness once pressure starts. */
  pressureDim: number;
  /** When pressure stops an exited person's sound source, they come back through that door. */
  returnThroughDoor: boolean;
}

export const EXPERIENCE_GRAMMARS: Record<DslGrammar, ExperienceGrammarDef> = {
  betrayal: {
    label: 'Relationship betrayal', camera: 'intimate', staging: 'normal_conversation', tone: 'restrained',
    setupAtMs: 2600, cueAtMs: 7000, pressureAtMs: 30000, spacingMs: 1400, developAfterMs: 11000,
    phoneLockSec: 35, countdownSec: 30, soundRestraint: 0.2, interactionReach: 1, revealHoldMs: 1600,
    pressureDim: 0.25, returnThroughDoor: true,
  },
  intrusion: {
    label: 'Creepy intrusion', camera: 'suspense', staging: 'isolated_subject', tone: 'eerie',
    setupAtMs: 2000, cueAtMs: 6000, pressureAtMs: 24000, spacingMs: 8000, developAfterMs: 10000,
    phoneLockSec: 0, countdownSec: 20, soundRestraint: 0.6, interactionReach: 1, revealHoldMs: 1800,
    pressureDim: 0.35, returnThroughDoor: false,
  },
  scrutiny: {
    label: 'Public social pressure', camera: 'scrutiny', staging: 'public_pressure', tone: 'tense',
    setupAtMs: 2400, cueAtMs: 6000, pressureAtMs: 24000, spacingMs: 3000, developAfterMs: 9000,
    phoneLockSec: 0, countdownSec: 10, soundRestraint: 0.1, interactionReach: 1.05, revealHoldMs: 1500,
    pressureDim: 0.15, returnThroughDoor: false,
  },
  credit: {
    label: 'Work credit conflict', camera: 'scrutiny', staging: 'public_pressure', tone: 'tense',
    setupAtMs: 2400, cueAtMs: 6000, pressureAtMs: 25000, spacingMs: 3000, developAfterMs: 9000,
    phoneLockSec: 0, countdownSec: 10, soundRestraint: 0.3, interactionReach: 1.05, revealHoldMs: 1500,
    pressureDim: 0.15, returnThroughDoor: false,
  },
  find: {
    label: 'Moral find', camera: 'discovery', staging: 'isolated_subject', tone: 'restrained',
    setupAtMs: 2200, cueAtMs: 5500, pressureAtMs: 23000, spacingMs: 4000, developAfterMs: 9000,
    phoneLockSec: 0, countdownSec: 25, soundRestraint: 0.4, interactionReach: 1, revealHoldMs: 1600,
    pressureDim: 0.2, returnThroughDoor: false,
  },
  secret: {
    label: 'Secret reveal', camera: 'intimate', staging: 'confrontation', tone: 'tense',
    setupAtMs: 2400, cueAtMs: 6500, pressureAtMs: 25000, spacingMs: 2500, developAfterMs: 9000,
    phoneLockSec: 0, countdownSec: 30, soundRestraint: 0.25, interactionReach: 1, revealHoldMs: 1600,
    pressureDim: 0.2, returnThroughDoor: true,
  },
  departure: {
    label: 'Departure decision', camera: 'departure', staging: 'walking_side_by_side', tone: 'tender',
    setupAtMs: 2400, cueAtMs: 7000, pressureAtMs: 26000, spacingMs: 3000, developAfterMs: 9000,
    phoneLockSec: 0, countdownSec: 45, soundRestraint: 0.15, interactionReach: 1.05, revealHoldMs: 1800,
    pressureDim: 0.15, returnThroughDoor: false,
  },
  family: {
    label: 'Family discovery', camera: 'discovery', staging: 'doorway_separation', tone: 'restrained',
    setupAtMs: 2400, cueAtMs: 7000, pressureAtMs: 26000, spacingMs: 3000, developAfterMs: 9000,
    phoneLockSec: 0, countdownSec: 30, soundRestraint: 0.35, interactionReach: 1, revealHoldMs: 1800,
    pressureDim: 0.2, returnThroughDoor: true,
  },
  temptation: {
    label: 'Money temptation', camera: 'moral', staging: 'across_table', tone: 'tense',
    setupAtMs: 2400, cueAtMs: 7000, pressureAtMs: 26000, spacingMs: 3000, developAfterMs: 9000,
    phoneLockSec: 0, countdownSec: 30, soundRestraint: 0.3, interactionReach: 1, revealHoldMs: 1600,
    pressureDim: 0.2, returnThroughDoor: false,
  },
  message: {
    label: 'Private message', camera: 'intimate', staging: 'isolated_subject', tone: 'restrained',
    setupAtMs: 2400, cueAtMs: 6500, pressureAtMs: 26000, spacingMs: 2500, developAfterMs: 10000,
    phoneLockSec: 30, countdownSec: 30, soundRestraint: 0.4, interactionReach: 1, revealHoldMs: 1600,
    pressureDim: 0.25, returnThroughDoor: false,
  },
  stranger: {
    label: 'Stranger danger', camera: 'suspense', staging: 'awkward_distance', tone: 'tense',
    setupAtMs: 2200, cueAtMs: 6000, pressureAtMs: 24000, spacingMs: 4000, developAfterMs: 9000,
    phoneLockSec: 0, countdownSec: 20, soundRestraint: 0.35, interactionReach: 1, revealHoldMs: 1700,
    pressureDim: 0.3, returnThroughDoor: false,
  },
  transition: {
    label: 'Life transition', camera: 'departure', staging: 'normal_conversation', tone: 'tender',
    setupAtMs: 2400, cueAtMs: 7000, pressureAtMs: 27000, spacingMs: 3000, developAfterMs: 10000,
    phoneLockSec: 0, countdownSec: 45, soundRestraint: 0.2, interactionReach: 1.05, revealHoldMs: 1800,
    pressureDim: 0.15, returnThroughDoor: false,
  },
};

/* ------------------------------------------------------------- lighting --- */

/**
 * Lighting profiles grade the whole frame over the world's own painted light.
 * They never move a light; they decide how dark the room is, which way its
 * colour leans, how hard a key object glows and how much the room closes in
 * under pressure.
 */
export interface LightingProfileDef {
  /** Extra base darkness, 0–1. */
  darkness: number;
  /** Colour the frame leans toward. */
  tint: string;
  tintStrength: number;
  /** How strongly an active key object glows. */
  objectEmphasis: number;
  /** Additional darkness once pressure begins. */
  pressureDim: number;
  /** Vignette tightness, 0–1. */
  vignette: number;
}

export const LIGHTING_PROFILE_DEFS: Record<DslLighting, LightingProfileDef> = {
  domestic_warm_night: { darkness: 0.03, tint: '#3a2418', tintStrength: 0.16, objectEmphasis: 1, pressureDim: 0.072, vignette: 0.55 },
  cold_hallway: { darkness: 0.06, tint: '#0e2430', tintStrength: 0.22, objectEmphasis: 0.9, pressureDim: 0.108, vignette: 0.7 },
  sterile_office: { darkness: 0.01, tint: '#12303a', tintStrength: 0.14, objectEmphasis: 0.8, pressureDim: 0.048, vignette: 0.4 },
  rain_city: { darkness: 0.05, tint: '#10283a', tintStrength: 0.2, objectEmphasis: 0.9, pressureDim: 0.072, vignette: 0.55 },
  family_evening: { darkness: 0.025, tint: '#4a2c14', tintStrength: 0.16, objectEmphasis: 1, pressureDim: 0.06, vignette: 0.5 },
  hotel_unease: { darkness: 0.02, tint: '#2e3a22', tintStrength: 0.14, objectEmphasis: 1.1, pressureDim: 0.084, vignette: 0.6 },
  station_midnight: { darkness: 0.05, tint: '#1a2640', tintStrength: 0.2, objectEmphasis: 0.9, pressureDim: 0.06, vignette: 0.55 },
  golden_hour: { darkness: 0.0, tint: '#7a4a14', tintStrength: 0.14, objectEmphasis: 0.8, pressureDim: 0.036, vignette: 0.35 },
  party_low: { darkness: 0.04, tint: '#3a1830', tintStrength: 0.18, objectEmphasis: 0.9, pressureDim: 0.06, vignette: 0.5 },
};

/** Tone leans a profile without replacing it. */
export function toneAdjustedLighting(base: LightingProfileDef, tone: DslTone): LightingProfileDef {
  switch (tone) {
    case 'eerie':
      return { ...base, darkness: base.darkness + 0.03, pressureDim: base.pressureDim + 0.04, vignette: Math.min(1, base.vignette + 0.1) };
    case 'tender':
      return { ...base, darkness: Math.max(0, base.darkness - 0.03), vignette: Math.max(0, base.vignette - 0.1) };
    case 'raw':
      return { ...base, tintStrength: base.tintStrength * 0.7, pressureDim: base.pressureDim + 0.04 };
    case 'tense':
      return { ...base, vignette: Math.min(1, base.vignette + 0.05) };
    default:
      return base;
  }
}
