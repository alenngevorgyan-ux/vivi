import type { ViviWorldId } from '../../world/templates/index.ts';

/**
 * The closed vocabulary of the Vivi Experience DSL.
 *
 * Everything a model may say is one of these symbols. Everything they expand
 * into — coordinates, timing, camera moves, light, sound — lives in the
 * compiler, so the vocabulary is the whole model-facing surface.
 */

export const DSL_VERSION = 1 as const;
export type ViviExperienceDSLVersion = typeof DSL_VERSION;

/** Bumped whenever the same DSL would compile to a materially different scene. */
export const COMPILER_VERSION = '1.1.0';

/* ---------------------------------------------------------------- worlds --- */

export const WORLDS = {
  apt: 'apartment_night',
  hall: 'hallway_night',
  bar: 'bar_or_party',
  office: 'office_night',
  station: 'train_station',
  street: 'city_rain',
  home: 'family_home',
  rental: 'hotel_or_rental',
  park: 'neighborhood_sunset',
  bedroom: 'bedroom_night',
} as const satisfies Record<string, ViviWorldId>;
export type DslWorld = keyof typeof WORLDS;

export const WORLD_FROM_ID: Record<ViviWorldId, DslWorld> = Object.fromEntries(
  Object.entries(WORLDS).map(([k, v]) => [v, k])
) as Record<ViviWorldId, DslWorld>;

/* -------------------------------------------------------------- grammars --- */

/** Human-situation grammars. Each one supplies pacing, camera, staging and sound defaults. */
export const GRAMMARS = [
  'betrayal', // RELATIONSHIP_BETRAYAL
  'intrusion', // CREEPY_INTRUSION
  'scrutiny', // PUBLIC_SOCIAL_PRESSURE
  'credit', // WORK_CREDIT_CONFLICT
  'find', // MORAL_FIND
  'secret', // SECRET_REVEAL
  'departure', // DEPARTURE_DECISION
  'family', // FAMILY_DISCOVERY
  'temptation', // MONEY_TEMPTATION
  'message', // PRIVATE_MESSAGE
  'stranger', // STRANGER_DANGER
  'transition', // LIFE_TRANSITION
] as const;
export type DslGrammar = (typeof GRAMMARS)[number];

export const TONES = ['restrained', 'tense', 'eerie', 'tender', 'raw'] as const;
export type DslTone = (typeof TONES)[number];

/* ------------------------------------------------------------------ cast --- */

export const ROLES = [
  'partner', 'ex', 'friend', 'sibling', 'parent', 'relative', 'child',
  'coworker', 'boss', 'colleague', 'stranger', 'neighbor', 'host', 'guest', 'commuter',
] as const;
export type DslRole = (typeof ROLES)[number];

/**
 * `on` stands in the room, `off` is only present through an object (a phone,
 * an intercom), `bg` is a low-cost background figure with deterministic behaviour.
 */
export const PRESENCE = ['on', 'off', 'bg'] as const;
export type DslPresence = (typeof PRESENCE)[number];

/* ------------------------------------------------------------- key objects --- */

export const OBJECTS = [
  'phone', 'door', 'photo', 'document', 'laptop', 'envelope', 'ticket',
  'clock', 'screen', 'letter', 'keys', 'intercom', 'elevator', 'board', 'train', 'bag', 'window',
] as const;
export type DslObject = (typeof OBJECTS)[number];

/**
 * Places a model may name. They are words, not slots: the compiler resolves
 * each against the chosen world, so `door` lands on the bathroom in one room
 * and the front door in another.
 */
export const PLACES = [
  'bathroom', 'front_door', 'bedroom', 'kitchen', 'window', 'sofa', 'table',
  'stairs', 'elevator', 'exit', 'screen', 'platform', 'bench', 'bar', 'corner',
  'street', 'car', 'balcony', 'desk', 'center',
] as const;
export type DslPlace = (typeof PLACES)[number];

export const SOUNDS = [
  'shower', 'rain', 'music', 'crowd', 'footsteps', 'traffic', 'train', 'tv', 'knock', 'voices',
] as const;
export type DslSound = (typeof SOUNDS)[number];

export const VEHICLES = ['train', 'bus', 'car'] as const;
export type DslVehicle = (typeof VEHICLES)[number];

/* ---------------------------------------------------------------- events --- */

/**
 * Event signatures. Each argument is typed by the kind of symbol it takes:
 * `role` (a cast role), `obj`, `place`, `sound`, `vehicle`, `text` (short
 * user-facing string), `int` (small integer) or `mode` (event-specific word).
 * A trailing `?` marks an optional argument.
 */
export const EVENT_SIGNATURES = {
  exit: ['role', 'place?'], // a person leaves the room
  enter: ['role', 'place?'], // a person comes in
  approach: ['role'], // a person walks toward the player
  say: ['role', 'text'], // a person says one short line aloud
  msg: ['obj', 'text'], // a message arrives on a screen
  call: ['obj', 'role?'], // a phone or intercom rings
  typing: ['obj'], // someone is typing
  sound: ['sound'], // a sound source starts
  stop: ['sound'], // a sound source stops — silence is an event
  handle: ['place'], // a door handle moves
  open: ['place'], // a door opens
  elevator: ['mode?'], // an elevator climbs and stops; `empty` means nobody leaves it
  clock: ['text'], // a diegetic clock shows a time, e.g. "03:17"
  countdown: ['obj', 'int?'], // a board or clock starts counting down seconds
  arrive: ['vehicle'],
  depart: ['vehicle'],
  light: ['mode'], // flicker | dim | out
  notice: ['obj'], // an object catches the light / the eye
  stare: ['role'], // people turn to look at the player
  echo: ['obj'], // memory echo at an object
} as const;
export type DslEventKind = keyof typeof EVENT_SIGNATURES;
export const EVENT_KINDS = Object.keys(EVENT_SIGNATURES) as DslEventKind[];

export const LIGHT_MODES = ['flicker', 'dim', 'out'] as const;
export const ELEVATOR_MODES = ['empty', 'arrive'] as const;

/* ----------------------------------------------------------- commitments --- */

/** Physical verbs a commitment may use. The world turns each into a place. */
export const VERBS = [
  'read', 'confront', 'ask', 'wait', 'leave', 'speak_up', 'show', 'call_help',
  'call', 'answer', 'follow', 'return', 'keep', 'hide', 'open', 'lock',
  'board', 'stay', 'accept', 'refuse', 'tell', 'comfort', 'look',
] as const;
export type DslVerb = (typeof VERBS)[number];

/* ------------------------------------------------------- presentation --- */

export const CAMERA_GRAMMARS = ['intimate', 'suspense', 'scrutiny', 'departure', 'moral', 'discovery'] as const;
export type DslCameraGrammar = (typeof CAMERA_GRAMMARS)[number];

export const STAGINGS = [
  'intimate_close', 'normal_conversation', 'awkward_distance', 'confrontation', 'across_table',
  'doorway_separation', 'walking_side_by_side', 'one_person_leaving', 'isolated_subject', 'public_pressure',
] as const;
export type DslStaging = (typeof STAGINGS)[number];

export const LIGHTING_PROFILES = [
  'domestic_warm_night', 'cold_hallway', 'sterile_office', 'rain_city',
  'family_evening', 'hotel_unease', 'station_midnight', 'golden_hour', 'party_low',
] as const;
export type DslLighting = (typeof LIGHTING_PROFILES)[number];

/* ------------------------------------------------------------- provenance --- */

/**
 * `documented_source` is reserved for future documented-history experiences.
 * It is only accepted when the caller supplies source references; no model
 * output can select it.
 */
export const TRUTH_STATUSES = ['author_supplied', 'withheld', 'fictional_demo', 'documented_source'] as const;
export type DslTruth = (typeof TRUTH_STATUSES)[number];

export const SOURCES = ['model', 'deterministic', 'hero_fixture', 'manual'] as const;
export type DslSource = (typeof SOURCES)[number];

/* ---------------------------------------------------------------- limits --- */

export const LIMITS = {
  cast: 6,
  objects: 4,
  events: 9,
  commitments: { min: 2, max: 4 },
  /** Situation layer (optional): things to look at, and facts the hero knows. */
  observations: 3,
  facts: 4,
  text: { label: 48, line: 120, title: 48, note: 160 },
} as const;
