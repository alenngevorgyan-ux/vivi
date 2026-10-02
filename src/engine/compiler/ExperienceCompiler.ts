import { worldTemplates, type ViviWorldId } from '../../world/templates/index.ts';
import type { ViviCharacterId, CharacterFacing } from '../../assets/characters/characters.ts';
import type { ExperienceModifier, ModifierData } from '../modifiers/types.ts';
import type { StoryBeat } from '../runtime/StoryBeatRunner.ts';
import { resolveSemanticSlot, type SemanticSlotResolution } from '../runtime/semanticSlots.ts';
import type {
  CanonicalScenario,
  RuntimeAction,
  RuntimeKeyObject,
  CrowdStat,
  CommunityReflection,
} from '../runtime/RuntimeCompiler.ts';
import type {
  AuthorTruth,
  ExperiencePlan,
  StoredPlayablePost,
  StoryAnalysis,
  CompilerStamp,
} from '../runtime/generationPipeline.ts';
import { actorObstacle, travelSeconds, type ActorCue, type RuntimeActor } from '../runtime/actors.ts';
import { findPath, nearestWalkable, pathLength, semanticPath, type Point } from '../runtime/navigation.ts';
import type { CollisionBox } from '../runtime/collision.ts';
import { stagePair, type StagingPreset } from '../cinematic/staging.ts';
import type { CameraEvent } from '../cinematic/director.ts';
import { serializeDSL, type DslCommitment, type DslEvent, type ViviExperienceDSL } from './dsl.ts';
import {
  COMPILER_VERSION,
  DSL_VERSION,
  OBJECTS,
  PLACES,
  ROLES,
  WORLDS,
  type DslObject,
  type DslPlace,
  type DslRole,
  type DslSource,
  type DslSound,
} from './vocabulary.ts';
import { EXPERIENCE_GRAMMARS, LIGHTING_PROFILE_DEFS, toneAdjustedLighting } from './grammars.ts';
import { CARRIED, WORLD_KNOWLEDGE, defaultSlotForVerb, hostSlot, resolvePlace, type AmbientBedId } from './worldKnowledge.ts';
import { approachLabel, carriedLabel, detectLanguage, objectObservation, roleName, text, type Lang } from './i18n.ts';

/**
 * THE EXPERIENCE COMPILER
 *
 * Deterministically expands a validated ViviExperienceDSL into the runtime's
 * own formats: an ExperiencePlan, a CanonicalScenario and a StoredPlayablePost.
 *
 * The model chose a world, a grammar, who is there, what changes and what the
 * player can do. Everything below — where people stand, how they walk around
 * furniture, when each thing happens, what the camera does about it, how the
 * room is lit and what it sounds like — is decided here, the same way every
 * time for the same input.
 */

export interface CompileOptions {
  /** Stable id; derived from the DSL and story when omitted so results cache. */
  id?: string;
  /** The author's own words. Used only for titles and synopsis fallbacks. */
  story?: string;
  author?: string;
  authorHandle?: string;
  /** What the author says really happened. The only source of author truth. */
  actualOutcome?: string;
  /** Curated demo truth (hero fixtures) or documented sources (reserved). */
  truth?:
    | { status: 'fictional_demo'; text: string; sourceLabel?: string }
    | { status: 'documented_source'; text: string; sourceRefs: string[]; sourceLabel?: string };
  category?: string;
  responseToPostId?: string;
  source: DslSource;
  model?: string;
  lang?: Lang;
  /** Index of the commitment the author took, when known (curated content). */
  authorChoice?: number;
  /** Stable action ids for curated content, so saved decisions keep matching. */
  actionIds?: string[];
  seededReflections?: CommunityReflection[];
  responsePrompt?: string;
  duration?: string;
  createdAt?: number;
  stamp?: Partial<CompilerStamp>;
}

export interface CompiledExperience {
  /** The DSL with provenance stamped from the author's input. */
  dsl: ViviExperienceDSL;
  plan: ExperiencePlan;
  scenario: CanonicalScenario;
  post: StoredPlayablePost;
  /** Human-readable decisions the compiler made — shown in the inspector. */
  notes: string[];
}

/* -------------------------------------------------------------- tables --- */

const PLAYER_CHARACTER: ViviCharacterId = 'young_adult_masc_01';

const ROLE_CHARACTERS: Record<DslRole, ViviCharacterId[]> = {
  partner: ['adult_fem_01', 'young_adult_masc_02'],
  ex: ['young_adult_fem_01', 'young_adult_masc_02'],
  friend: ['young_adult_masc_02', 'young_adult_fem_02'],
  sibling: ['young_adult_fem_02', 'young_adult_fem_01'],
  parent: ['older_adult_01', 'adult_fem_01'],
  relative: ['adult_masc_01', 'older_adult_01'],
  child: ['memory_child_01', 'memory_child_02'],
  coworker: ['young_adult_masc_02', 'young_adult_fem_02'],
  boss: ['adult_fem_01', 'adult_masc_01'],
  colleague: ['adult_masc_01', 'young_adult_fem_01', 'anonymous_01', 'young_adult_fem_02'],
  stranger: ['anonymous_01', 'adult_masc_01'],
  neighbor: ['older_adult_01', 'adult_masc_01'],
  host: ['adult_masc_01', 'older_adult_01'],
  guest: ['young_adult_fem_01', 'adult_masc_01', 'young_adult_fem_02', 'anonymous_01'],
  commuter: ['anonymous_01', 'adult_masc_01', 'young_adult_fem_02'],
};

const SOUND_BED: Record<DslSound, AmbientBedId | null> = {
  shower: 'shower_water',
  rain: 'rain_ambient',
  music: 'music_muffled',
  crowd: 'crowd_murmur',
  voices: 'crowd_murmur',
  traffic: 'city_night',
  train: 'train_idle',
  tv: 'room_tone',
  footsteps: null,
  knock: null,
};

/** Objects the engine draws as props; the rest are part of a world's architecture. */
const PROP_OBJECTS = new Set<DslObject>(['phone', 'photo', 'document', 'envelope', 'ticket', 'letter', 'keys', 'bag', 'laptop']);
const ARCHITECTURE_PROPS: Partial<Record<ViviWorldId, DslObject[]>> = { office_night: ['laptop'] };

const GRAMMAR_THEME: Record<string, string> = {
  betrayal: 'Relationships', intrusion: 'Creepy', scrutiny: 'Social disaster', credit: 'Work', find: 'Moral dilemma',
  secret: 'Moral dilemma', departure: 'Life turning point', family: 'Family', temptation: 'Money', message: 'Relationships',
  stranger: 'Creepy', transition: 'Life turning point',
};

/** Events that are the moment something changes. */
const CUE_KINDS = new Set(['msg', 'call', 'notice', 'say', 'echo']);
/** Events that close the window. */
const PRESSURE_KINDS = new Set(['stop', 'handle', 'open', 'approach', 'stare', 'countdown', 'arrive', 'depart', 'light']);
/** Events that establish the room before anything changes. */
const SETUP_KINDS = new Set(['exit', 'enter', 'sound']);

/* ------------------------------------------------------------- helpers --- */

function hash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const isObject = (v: unknown): v is DslObject => typeof v === 'string' && (OBJECTS as readonly string[]).includes(v);
const isRole = (v: unknown): v is DslRole => typeof v === 'string' && (ROLES as readonly string[]).includes(v);
const isPlace = (v: unknown): v is DslPlace => typeof v === 'string' && (PLACES as readonly string[]).includes(v);

function prevMinute(clock: string): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(clock.trim());
  if (!m) return null;
  let h = Number(m[1]);
  let min = Number(m[2]) - 1;
  if (min < 0) {
    min = 59;
    h = (h + 23) % 24;
  }
  return `${String(h).padStart(m[1].length, '0')}:${String(min).padStart(2, '0')}`;
}

function firstSentence(story: string | undefined, max: number): string | undefined {
  if (!story) return undefined;
  const s = story.replace(/\s+/g, ' ').trim();
  if (!s) return undefined;
  const cut = s.split(/(?<=[.!?…])\s/)[0] ?? s;
  return cut.length <= max ? cut : `${cut.slice(0, max - 1).trimEnd()}…`;
}

/** A fallback title: the story's first clause, or its first few words. Models normally supply `x.ti`. */
function shortTitle(story: string | undefined): string | undefined {
  const first = firstSentence(story, 200);
  if (!first) return undefined;
  const clause = first.split(/[,;:—–]/)[0].replace(/[.!?…]+$/, '').trim();
  if (clause.length >= 6 && clause.length <= 36) return clause;
  const words = clause.split(/\s+/).slice(0, 5).join(' ');
  return words.length < clause.length ? `${words}…` : words;
}

function clampText(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

/* ------------------------------------------------------------ compiler --- */

export function compileExperience(input: ViviExperienceDSL, options: CompileOptions): CompiledExperience {
  const notes: string[] = [];
  const world: ViviWorldId = WORLDS[input.w];
  const template = worldTemplates[world];
  const know = WORLD_KNOWLEDGE[world];
  const grammar = EXPERIENCE_GRAMMARS[input.g];
  const lang: Lang = options.lang ?? (input.lang as Lang | undefined) ?? detectLanguage(options.story ?? JSON.stringify(input.a));
  const tone = input.t ?? grammar.tone;
  const cameraGrammar = input.cg ?? grammar.camera;
  const onStageRoles = input.c.filter(c => c[1] === 'on').map(c => c[0]);
  const staging: StagingPreset = input.st ?? (onStageRoles.length ? grammar.staging : 'isolated_subject');
  const lighting = input.lp ?? know.lighting;
  const lightingDef = toneAdjustedLighting(LIGHTING_PROFILE_DEFS[lighting], tone);

  notes.push(`world ${input.w} → ${world}; grammar ${input.g} (${grammar.label}); tone ${tone}`);
  notes.push(`camera ${cameraGrammar}${input.cg ? '' : ' (grammar default)'}; staging ${staging}${input.st ? '' : ' (derived)'}; lighting ${lighting}`);

  const slotAnchor = (slot: string): Point => {
    const s = template.slots.find(sl => sl.id === slot);
    return s ? [s.x, s.y] : [50, 70];
  };
  const standOf = (slot: string): Point => {
    const r = resolveSemanticSlot(world, slot);
    return [r.standX, r.standY];
  };
  const placeSlot = (place: string | undefined, fallback: string): string =>
    (place && isPlace(place) && resolvePlace(world, place)) || fallback;

  const playerSpawn = nearestWalkable(world, know.spawn);

  /* ------------------------------------------------------------ actors --- */

  const usedCharacters = new Set<ViviCharacterId>([PLAYER_CHARACTER]);
  const pickCharacter = (role: DslRole): ViviCharacterId => {
    const options = ROLE_CHARACTERS[role];
    const free = options.find(c => !usedCharacters.has(c));
    const chosen = free ?? options[0];
    usedCharacters.add(chosen);
    return chosen;
  };

  const firstEventOf = (role: DslRole) => input.e.find(ev => ev[1] === role);
  const actors: RuntimeActor[] = [];
  const actorByRole = new Map<DslRole, RuntimeActor>();
  const staticObstacles: CollisionBox[] = [];
  // Nobody is staged standing on the story's object: keep a little floor clear around each one.
  const keepOut: CollisionBox[] = input.o
    .map(obj => hostSlot(world, obj))
    .filter(slot => slot !== CARRIED)
    .map(slot => {
      const [x, y] = slotAnchor(slot);
      return { id: `keepout:${slot}`, name: slot, x1: x - 3, y1: y - 4, x2: x + 3, y2: y + 2, blocksMovement: true };
    });
  const stageAt = (p: Point) => nearestWalkable(world, p, [...staticObstacles, ...keepOut]);
  let side: 'left' | 'right' = playerSpawn[0] < 50 ? 'right' : 'left';

  input.c.forEach(([role, presence, count], castIndex) => {
    if (presence === 'off') return;
    if (presence === 'on') {
      const roleSlot = know.roleSlots[role];
      const first = firstEventOf(role);
      let spawn: Point;
      let hiddenUntilMs: number | undefined;
      if (roleSlot) {
        spawn = nearestWalkable(world, slotAnchor(roleSlot), staticObstacles);
        notes.push(`${role}: stands at ${roleSlot} (world role slot)`);
      } else if (first && first[0] === 'enter') {
        spawn = standOf(placeSlot(first[2] as string | undefined, know.door));
        hiddenUntilMs = 1e9; // revealed by the enter cue (finite so it survives JSON)
        notes.push(`${role}: arrives later through ${placeSlot(first[2] as string | undefined, know.door)}`);
      } else if (first && first[0] === 'exit') {
        // Partway along the line they will walk, so their exit reads as travel.
        const exitStand = standOf(placeSlot(first[2] as string | undefined, know.door));
        spawn = stageAt([
          playerSpawn[0] + (exitStand[0] - playerSpawn[0]) * 0.45,
          playerSpawn[1] + (exitStand[1] - playerSpawn[1]) * 0.45,
        ]);
        notes.push(`${role}: staged on the way to ${placeSlot(first[2] as string | undefined, know.door)}`);
      } else {
        const preset: StagingPreset = staging === 'isolated_subject' || staging === 'public_pressure' ? 'normal_conversation' : staging;
        const pair = stagePair(playerSpawn, actors.length === 0 ? preset : 'normal_conversation', side);
        spawn = stageAt(pair.counterpart);
        side = side === 'right' ? 'left' : 'right';
        notes.push(`${role}: staged ${preset} from the player`);
      }
      const actor: RuntimeActor = {
        id: `${role}_${castIndex}`,
        role,
        character: pickCharacter(role),
        cls: actors.some(a => a.cls === 'primary') ? 'secondary' : 'primary',
        spawn,
        facing: spawn[0] > playerSpawn[0] ? 'left' : 'right',
        pose: roleSlot === 'coworker' ? 'talk' : 'wait',
        behavior: roleSlot === 'coworker' ? 'present' : 'present',
        attention: roleSlot === 'coworker' ? undefined : 'player',
        hiddenUntilMs,
      };
      if (roleSlot === 'coworker') actor.facing = 'front';
      actors.push(actor);
      actorByRole.set(role, actor);
      return;
    }

    // Background: deterministic, zero-token people who make a room inhabited.
    if (!know.seats.length) {
      notes.push(`${role}: background cast dropped — ${world} is a private space`);
      return;
    }
    const n = count ?? (role === 'colleague' || role === 'guest' || role === 'commuter' ? 2 : 1);
    for (let k = 0; k < n; k++) {
      const seat = know.seats.find(
        s =>
          !actors.some(a => Math.hypot(a.spawn[0] - s.pos[0], a.spawn[1] - s.pos[1]) < 6) &&
          Math.hypot(playerSpawn[0] - s.pos[0], playerSpawn[1] - s.pos[1]) > 8
      );
      if (!seat) {
        notes.push(`${role}: no free seat for background figure ${k + 1}`);
        break;
      }
      const actor: RuntimeActor = {
        id: `${role}_${castIndex}_${k}`,
        role,
        character: pickCharacter(role),
        cls: 'background',
        spawn: seat.pos,
        facing: seat.facing,
        pose: seat.pose,
        behavior: seat.pose === 'sit' ? 'sit' : 'watch',
        attention: know.seatAttention,
      };
      actors.push(actor);
      staticObstacles.push(actorObstacle(actor.id, actor.spawn, seat.pose === 'sit'));
    }
  });
  if (input.c.some(c => c[2] !== undefined || c[1] === 'bg')) {
    notes.push(`background figures: ${actors.filter(a => a.cls === 'background').length}`);
  }

  const actorCues: ActorCue[] = [];

  /* ---------------------------------------------------------- timeline --- */

  const events = input.e;
  let cueIndex = events.findIndex(ev => CUE_KINDS.has(ev[0]));
  if (cueIndex < 0) cueIndex = events.findIndex(ev => !SETUP_KINDS.has(ev[0]) && ev[0] !== 'clock');
  if (cueIndex < 0) cueIndex = events.length - 1;

  const times: number[] = new Array(events.length).fill(0);
  const exitArrival = new Map<number, number>(); // event index → arrival ms
  let cursor = grammar.setupAtMs;
  let lastSetup = 0;

  const travelMs = (from: Point, to: Point) => travelSeconds(pathLength(findPath(world, from, to, { extra: staticObstacles }))) * 1000;

  for (let i = 0; i < cueIndex; i++) {
    const ev = events[i];
    if (ev[0] === 'clock') continue;
    let at = cursor;
    // A sound that follows someone leaving through a door starts once they are behind it.
    const prev = events[i - 1];
    if (ev[0] === 'sound' && prev && prev[0] === 'exit' && exitArrival.has(i - 1)) {
      at = Math.max(at, exitArrival.get(i - 1)! + 600);
    }
    times[i] = at;
    if (ev[0] === 'exit') {
      const actor = actorByRole.get(ev[1] as DslRole);
      if (actor) exitArrival.set(i, at + travelMs(actor.spawn, standOf(placeSlot(ev[2] as string, know.door))));
    }
    lastSetup = at;
    cursor = at + grammar.spacingMs;
  }

  const cueAtMs = Math.max(grammar.cueAtMs, lastSetup + 1600);
  times[cueIndex] = cueAtMs;
  let pressureAtMs = grammar.pressureAtMs;
  let pressureAssigned = false;
  let developK = 1;
  let last = cueAtMs;
  for (let i = cueIndex + 1; i < events.length; i++) {
    const kind = events[i][0];
    const prevKind = events[i - 1]?.[0];
    if (kind === 'clock') {
      times[i] = cueAtMs;
      continue;
    }
    if (!pressureAssigned && PRESSURE_KINDS.has(kind)) {
      times[i] = Math.max(grammar.pressureAtMs, last + 2500);
      pressureAtMs = times[i];
      pressureAssigned = true;
    } else if (!pressureAssigned) {
      times[i] = Math.max(last + 1500, Math.min(cueAtMs + grammar.developAfterMs * developK, grammar.pressureAtMs - 2500));
      developK++;
    } else {
      const gap = kind === 'handle' && prevKind === 'stop' ? 1000 : kind === 'open' && prevKind === 'handle' ? 5000 : Math.max(1500, grammar.spacingMs);
      times[i] = last + gap;
    }
    last = times[i];
  }
  // A clock placed before the cue still changes at the cue.
  events.forEach((ev, i) => {
    if (ev[0] === 'clock') times[i] = cueAtMs;
  });
  notes.push(`timeline: cue at ${cueAtMs} ms (${events[cueIndex]?.[0]}), pressure at ${pressureAtMs} ms`);

  /* ------------------------------------------- semantic event expansion --- */

  const modifiers: ExperienceModifier[] = [];
  const cameraEvents: CameraEvent[] = [];
  let modId = 0;
  const mod = (
    kind: ExperienceModifier['kind'],
    atMs: number,
    anchor: string,
    payload: string,
    data: ModifierData,
    durationMs?: number
  ) => {
    modifiers.push({ id: `m${++modId}`, kind, atMs: Math.round(atMs), anchor, payload, visibleToPlayer: true, data, ...(durationMs ? { durationMs } : {}) });
  };
  const camera = (kind: CameraEvent['kind'], atMs: number, extra: Partial<CameraEvent> = {}) =>
    cameraEvents.push({ kind, atMs: Math.round(atMs), ...extra });

  const objectActiveAt = new Map<DslObject, number>();
  const echoObjects = new Set<DslObject>();
  const markObject = (obj: DslObject, at: number) => {
    if (!objectActiveAt.has(obj) || objectActiveAt.get(obj)! > at) objectActiveAt.set(obj, at);
  };
  /** Who left through which slot, and the sound they started behind it. */
  const exitedThrough = new Map<string, { actor: RuntimeActor; sound?: DslSound }>();
  const explicitDoorEvents = new Set<string>();
  events.forEach(ev => {
    if (ev[0] === 'handle' || ev[0] === 'open') explicitDoorEvents.add(`${ev[0]}:${placeSlot(ev[1] as string, know.door)}`);
  });
  let cueLine: string | undefined;
  let pressureLine: string | undefined;

  const doorFor = (slot: string) => resolveSemanticSlot(world, slot).diegeticType === 'door' || resolveSemanticSlot(world, slot).diegeticType === 'elevator';

  const reenter = (actor: RuntimeActor, slot: string, at: number) => {
    const stand = standOf(slot);
    const doorway = nearestWalkable(world, [stand[0] - 2, stand[1] + 4], staticObstacles);
    actorCues.push({ atMs: at, actor: actor.id, act: 'enter', to: stand, then: doorway });
    actorCues.push({ atMs: at + 1200, actor: actor.id, act: 'turn_to', target: 'player' });
    camera('npc_enter', at, { actor: actor.id, slot });
  };

  events.forEach((ev, i) => {
    const at = times[i];
    const [kind, a1, a2] = ev as [string, string | number | undefined, string | number | undefined];
    switch (kind) {
      case 'exit': {
        const actor = actorByRole.get(a1 as DslRole);
        const slot = placeSlot(a2 as string, know.door);
        if (!actor) break;
        const to = standOf(slot);
        actorCues.push({ atMs: at, actor: actor.id, act: 'exit', to, via: semanticPath(world, 'living_room', slot) ?? undefined });
        const arrive = exitArrival.get(i) ?? at + travelMs(actor.spawn, to);
        if (doorFor(slot)) {
          mod('door', arrive - 250, slot, 'Door opens', { door: 'open' });
          mod('door', arrive + 1300, slot, 'Door closes', { door: 'closed' });
        }
        const next = events[i + 1];
        exitedThrough.set(slot, { actor, sound: next && next[0] === 'sound' ? (next[1] as DslSound) : undefined });
        camera('npc_exit', at, { actor: actor.id, slot });
        break;
      }
      case 'enter': {
        const actor = actorByRole.get(a1 as DslRole);
        const slot = placeSlot(a2 as string, know.door);
        if (!actor) break;
        if (doorFor(slot)) {
          mod('door', at - 300, slot, 'Door opens', { door: 'open' });
          mod('door', at + 1800, slot, 'Door closes', { door: 'closed' });
        }
        const toward = stagePair(playerSpawn, 'confrontation', actor.spawn[0] > playerSpawn[0] ? 'right' : 'left').counterpart;
        actorCues.push({ atMs: at, actor: actor.id, act: 'enter', to: standOf(slot), then: nearestWalkable(world, toward, staticObstacles) });
        camera('npc_enter', at, { actor: actor.id, slot });
        break;
      }
      case 'approach': {
        const actor = actorByRole.get(a1 as DslRole);
        if (!actor) break;
        const toward = stagePair(playerSpawn, 'confrontation', actor.spawn[0] > playerSpawn[0] ? 'right' : 'left').counterpart;
        actorCues.push({ atMs: at, actor: actor.id, act: 'walk_to', to: nearestWalkable(world, toward, staticObstacles) });
        actorCues.push({ atMs: at + 3000, actor: actor.id, act: 'turn_to', target: 'player' });
        camera('approach', at, { actor: actor.id });
        break;
      }
      case 'say': {
        const line = String(a2);
        const actor = actorByRole.get(a1 as DslRole);
        const duration = Math.max(2400, Math.min(5200, 1800 + line.length * 55));
        mod('npcPressure', at, actor?.id ?? String(a1), line, { speech: line }, duration);
        if (actor) {
          actorCues.push({ atMs: at, actor: actor.id, act: 'talk', durationMs: duration });
          camera('speech', at, { actor: actor.id });
        }
        if (i === cueIndex) cueLine = line;
        else if (at >= pressureAtMs && !pressureLine) pressureLine = line;
        break;
      }
      case 'msg': {
        const obj = a1 as DslObject;
        const slot = hostSlot(world, obj);
        const line = String(a2);
        mod('message', at, slot, line, {
          screenText: line,
          vibrate: obj === 'phone',
          ...(obj === 'phone' && grammar.phoneLockSec ? { lockSec: grammar.phoneLockSec } : {}),
        }, 4000);
        markObject(obj, at);
        camera('object_active', at, { slot });
        if (i === cueIndex) cueLine = line;
        break;
      }
      case 'call': {
        const obj = a1 as DslObject;
        const slot = hostSlot(world, obj);
        if (obj === 'intercom') {
          mod('call', at, slot, 'INTERCOM', { intercom: true }, 2000);
        } else {
          const caller = isRole(a2) ? roleName(lang, a2) : '';
          const screen = caller ? `${text(lang, 'calling')} · ${caller}` : text(lang, 'calling');
          mod('call', at, slot, screen, { screenText: screen, vibrate: true }, 9000);
        }
        markObject(obj, at);
        camera('object_active', at, { slot });
        break;
      }
      case 'typing': {
        const obj = a1 as DslObject;
        mod('typing', at, hostSlot(world, obj), 'Typing…', { typing: true }, 6000);
        markObject(obj, at);
        break;
      }
      case 'sound': {
        const src = a1 as DslSound;
        const bed = SOUND_BED[src];
        if (bed) mod('sound', at, 'room', src, { bed });
        else mod('sound', at, 'room', src, { oneShot: src === 'knock' ? 'knock' : 'footsteps' });
        break;
      }
      case 'stop': {
        const src = a1 as DslSound;
        mod('sound', at, 'room', `${src} stops`, { bed: null });
        camera('silence', at);
        if (!pressureLine && at >= pressureAtMs) pressureLine = undefined;
        // Door anticipation: whoever went behind a door with that sound comes back through it.
        if (grammar.returnThroughDoor) {
          for (const [slot, who] of exitedThrough) {
            if (who.sound !== src) continue;
            if (!explicitDoorEvents.has(`handle:${slot}`)) {
              mod('door', at + 1000, slot, 'Handle moves', { door: 'handle_moving' });
              camera('pressure', at + 1000, { slot });
            }
            if (!explicitDoorEvents.has(`open:${slot}`)) {
              mod('door', at + 6000, slot, 'Door opens', { door: 'open' });
              reenter(who.actor, slot, at + 6000);
            }
            notes.push(`"${src}" stopping brings ${who.actor.role} back through ${slot}`);
          }
        }
        break;
      }
      case 'handle': {
        const slot = placeSlot(a1 as string, know.door);
        mod('door', at, slot, 'Handle moves', { door: 'handle_moving' });
        camera('pressure', at, { slot });
        break;
      }
      case 'open': {
        const slot = placeSlot(a1 as string, know.door);
        mod('door', at, slot, 'Door opens', { door: 'open' });
        const who = exitedThrough.get(slot);
        if (who) reenter(who.actor, slot, at);
        else camera('pressure', at, { slot });
        break;
      }
      case 'elevator': {
        const slot = hostSlot(world, 'elevator');
        mod('elevator', at, slot, '6 · 7 · 8 · 9', { floors: [6, 9], emptyCar: a1 === 'empty' });
        markObject('elevator', at);
        camera('object_active', at, { slot });
        camera('silence', at + 7400);
        break;
      }
      case 'clock': {
        const reading = String(a1);
        const before = prevMinute(reading);
        if (before) mod('clock', 0, 'clock', before, { clock: before });
        mod('clock', at, 'clock', reading, { clock: reading });
        break;
      }
      case 'countdown': {
        const obj = a1 as DslObject;
        const slot = hostSlot(world, obj);
        // Unspecified countdowns run out shortly after pressure peaks, never minutes later.
        const secs = typeof a2 === 'number' ? a2 : Math.max(8, Math.min(grammar.countdownSec, Math.round((pressureAtMs + 14000 - at) / 1000)));
        mod('timer', at, slot, `${secs}s`, { countdownSec: secs });
        markObject(obj, at);
        camera('pressure', at, { slot });
        break;
      }
      case 'arrive': {
        const vehicle = a1 as string;
        const slot = vehicle === 'train' ? hostSlot(world, 'train') : know.door;
        const bed: AmbientBedId = vehicle === 'train' ? 'train_idle' : vehicle === 'bus' ? 'bus_engine' : 'city_night';
        mod('arrival', at, slot, 'Doors open', { bed, doorsOpen: vehicle !== 'car' });
        camera('arrival', at, { slot });
        break;
      }
      case 'depart': {
        const vehicle = a1 as string;
        const slot = vehicle === 'train' ? hostSlot(world, 'train') : know.door;
        mod('exit', at, slot, 'Departing', { bed: null });
        camera('silence', at);
        break;
      }
      case 'light': {
        const mode = a1 as 'flicker' | 'dim' | 'out';
        mod('lighting', at, 'room', mode, { light: mode }, mode === 'flicker' ? 3200 : undefined);
        break;
      }
      case 'notice': {
        const obj = a1 as DslObject;
        const slot = hostSlot(world, obj);
        mod('lighting', at, slot, 'catches the light', { glint: slot }, 6000);
        markObject(obj, at);
        camera('object_active', at, { slot });
        break;
      }
      case 'stare': {
        mod('crowd', at, 'room', 'They look at you', { stare: true }, 6500);
        camera('stare', at);
        break;
      }
      case 'echo': {
        // The object glints on the timeline; the memory itself plays when the player reaches it.
        const obj = a1 as DslObject;
        const slot = hostSlot(world, obj);
        mod('lighting', at, slot, 'memory', { glint: slot }, 6000);
        markObject(obj, at);
        echoObjects.add(obj);
        camera('memory', at, { slot });
        break;
      }
    }
  });

  // A presenter is mid-sentence when the player arrives.
  for (const actor of actors) {
    if (actor.pose === 'talk') {
      for (let at = 400; at < cueAtMs - 1500; at += 4200) actorCues.push({ atMs: at, actor: actor.id, act: 'talk', durationMs: 3200 });
      actorCues.push({ atMs: cueAtMs - 400, actor: actor.id, act: 'wait' });
    }
  }

  modifiers.sort((x, y) => x.atMs - y.atMs);
  cameraEvents.sort((x, y) => x.atMs - y.atMs);
  actorCues.sort((x, y) => x.atMs - y.atMs);

  /* -------------------------------------------------------- key objects --- */

  // Who a memory shows: the player and the first person the story is about, even one who is only on the phone.
  const remembered = input.c.find(c => c[1] !== 'bg')?.[0];
  const echoCast: ViviCharacterId[] = [
    PLAYER_CHARACTER,
    remembered ? actorByRole.get(remembered)?.character ?? ROLE_CHARACTERS[remembered][0] : 'memory_child_01',
  ];

  const keyObjects: RuntimeKeyObject[] = input.o.map(obj => {
    const slot = hostSlot(world, obj);
    return {
      id: obj,
      kind: obj,
      slot,
      pos: slot === CARRIED ? playerSpawn : slotAnchor(slot),
      ...(objectActiveAt.has(obj) ? { activeAtMs: objectActiveAt.get(obj) } : {}),
      prop: slot !== CARRIED && PROP_OBJECTS.has(obj) && !(ARCHITECTURE_PROPS[world] ?? []).includes(obj),
      actionIds: [],
      ...(echoObjects.has(obj) ? { echo: { characters: echoCast } } : {}),
    };
  });

  /* -------------------------------------------------------- commitments --- */

  const actions: RuntimeAction[] = [];
  const endings: Record<string, string> = {};
  const usedSlots = new Set<string>();
  const usedIds = new Set<string>();
  const fallbackSlots = [know.rest, know.exit, resolvePlace(world, 'center'), ...template.slots.map(s => s.id)].filter(
    (s): s is string => !!s
  );

  input.a.forEach((commitment: DslCommitment, i) => {
    const [verb, target, label, observation, outcome] = commitment;
    let slot: string;
    let actorId: string | undefined;
    let objectId: DslObject | undefined;
    let approach: string;

    if (isObject(target)) {
      slot = hostSlot(world, target);
      objectId = target;
      approach = slot === CARRIED ? carriedLabel(lang, target) : approachLabel(lang, { object: target, verb });
    } else if (isRole(target)) {
      const actor = actorByRole.get(target);
      const presence = input.c.find(c => c[0] === target)?.[1];
      if (actor && actor.cls !== 'background') {
        actorId = actor.id;
        slot = `actor:${actor.id}`;
        approach = approachLabel(lang, { role: target, verb });
      } else if (presence === 'off') {
        // Someone only present through a device: you act on them through it.
        const device = input.o.includes('intercom') ? 'intercom' : 'phone';
        slot = hostSlot(world, device);
        objectId = device;
        approach = slot === CARRIED ? carriedLabel(lang, device) : approachLabel(lang, { object: device, verb });
      } else {
        slot = defaultSlotForVerb(world, verb, input.o);
        approach = approachLabel(lang, { verb });
      }
    } else if (isPlace(target)) {
      slot = resolvePlace(world, target) ?? defaultSlotForVerb(world, verb, input.o);
      approach = approachLabel(lang, { place: target, verb });
    } else {
      slot = defaultSlotForVerb(world, verb, input.o);
      const placeWord = Object.entries(know.places).find(([, s]) => s === slot)?.[0] as DslPlace | undefined;
      // Waiting is not a place; it is staying put somewhere sensible.
      const placeless = verb === 'leave' || verb === 'hide' || ((verb === 'wait' || verb === 'stay') && placeWord === 'center');
      approach = placeless || !placeWord ? approachLabel(lang, { verb }) : approachLabel(lang, { place: placeWord, verb });
    }

    // Two choices on one spot would hide one of them; move the later one and relabel it for where it went.
    if (!actorId && usedSlots.has(slot)) {
      const alternative = fallbackSlots.find(s => !usedSlots.has(s) && s !== CARRIED);
      if (alternative) {
        notes.push(`commitment ${verb}: ${slot} already used, moved to ${alternative}`);
        slot = alternative;
        objectId = undefined;
        const placeWord = Object.entries(know.places).find(([, s]) => s === alternative)?.[0] as DslPlace | undefined;
        approach = placeWord && verb !== 'leave' ? approachLabel(lang, { place: placeWord, verb }) : approachLabel(lang, { verb });
      }
    }
    usedSlots.add(slot);

    let slotInfo: SemanticSlotResolution;
    if (slot === CARRIED) {
      slotInfo = {
        id: CARRIED,
        label: objectId ?? 'phone',
        anchorX: playerSpawn[0],
        anchorY: playerSpawn[1],
        standX: playerSpawn[0],
        standY: playerSpawn[1],
        interactionRadius: 0,
        diegeticType: 'phone',
        carried: true,
      };
    } else if (actorId) {
      const actor = actors.find(a => a.id === actorId)!;
      slotInfo = {
        id: slot,
        label: actor.role,
        anchorX: actor.spawn[0],
        anchorY: actor.spawn[1],
        standX: actor.spawn[0],
        standY: actor.spawn[1],
        interactionRadius: 12 * grammar.interactionReach,
        diegeticType: 'person',
      };
    } else {
      const resolved = resolveSemanticSlot(world, slot);
      slotInfo = { ...resolved, interactionRadius: resolved.interactionRadius * grammar.interactionReach };
    }

    let id = options.actionIds?.[i] ?? `${verb}${target ? `_${target}` : ''}`;
    while (usedIds.has(id)) id = `${id}_${i}`;
    usedIds.add(id);

    const obs = observation && observation.trim() ? observation : objectId ? objectObservation(lang, objectId) ?? text(lang, 'observation') : text(lang, 'observation');
    // While the person is behind a door, the choice reads as the door.
    let awayLabel: string | undefined;
    if (actorId && isRole(target)) {
      const exitEv = input.e.find(ev => ev[0] === 'exit' && ev[1] === target);
      const exitPlace = exitEv?.[2];
      if (isPlace(exitPlace)) awayLabel = approachLabel(lang, { place: exitPlace, verb });
    }
    actions.push({
      id,
      targetSlot: slot,
      ...(awayLabel ? { awayLabel } : {}),
      slotInfo,
      label: approach,
      observation: obs,
      commitLabel: label,
      verb,
      ...(actorId ? { actorId } : {}),
      ...(objectId ? { objectId } : {}),
    });
    endings[id] = outcome && outcome.trim() ? outcome : text(lang, 'outcome', { label });
    if (objectId) keyObjects.find(k => k.id === objectId)?.actionIds.push(id);
  });

  /* ------------------------------------------------------------ truth --- */

  const outcome = options.actualOutcome?.trim();
  let authorTruth: AuthorTruth;
  if (options.truth?.status === 'documented_source' && options.truth.sourceRefs.length > 0 && options.truth.text.trim()) {
    authorTruth = { status: 'documented_source', text: options.truth.text.trim(), sourceRefs: options.truth.sourceRefs, sourceLabel: options.truth.sourceLabel ?? 'по документальным источникам' };
  } else if (outcome && outcome.length > 5) {
    // Preserved exactly: the author's words are never paraphrased.
    authorTruth = { status: 'author_supplied', text: options.actualOutcome!.trim(), sourceLabel: 'со слов автора' };
  } else if (options.truth?.status === 'fictional_demo' && options.truth.text.trim()) {
    authorTruth = { status: 'fictional_demo', text: options.truth.text, sourceLabel: options.truth.sourceLabel ?? 'Заданная для демо развязка' };
  } else {
    authorTruth = { status: 'withheld', withheldReason: text(lang, 'withheld') };
  }
  const truthText = authorTruth.status === 'withheld' ? '' : authorTruth.text ?? '';

  const dsl: ViviExperienceDSL = { ...input, tr: authorTruth.status, lang };

  /* ------------------------------------------------------------ beats --- */

  const story = options.story?.trim();
  const title = input.x?.ti ?? shortTitle(story) ?? text(lang, 'untitled');
  const opening = input.x?.op ?? firstSentence(story, 110) ?? '';
  const synopsis = story ? clampText(story.replace(/\s+/g, ' '), 140) : opening;
  const cueText = input.x?.cu ?? cueLine ?? text(lang, 'cue');
  const pressureText = input.x?.pr ?? pressureLine ?? text(lang, 'pressure');

  const beats: StoryBeat[] = [
    { id: 'beat_arrival', type: 'arrival', trigger: 'time_elapsed', triggerPayload: 0, title: 'Arrival', description: opening },
    { id: 'beat_cue', type: 'cue', trigger: 'time_elapsed', triggerPayload: cueAtMs, title: 'The Cue', description: cueText, isCue: true },
    { id: 'beat_pressure', type: 'pressure', trigger: 'time_elapsed', triggerPayload: pressureAtMs, title: 'Pressure', description: pressureText, isPressure: true },
    { id: 'beat_commitment', type: 'commitment', trigger: 'player_committed', title: 'Commitment', description: 'The moment of decision' },
    { id: 'beat_reveal', type: 'reveal', trigger: 'previous_beat_complete', title: 'The Reality', description: truthText },
  ];
  if (events.some(ev => ev[0] === 'echo')) {
    const echoAt = times[events.findIndex(ev => ev[0] === 'echo')];
    beats.splice(2, 0, { id: 'beat_echo', type: 'memoryEcho', trigger: 'time_elapsed', triggerPayload: echoAt, title: 'Memory', description: '' });
    beats.sort((x, y) => (typeof x.triggerPayload === 'number' ? x.triggerPayload : Infinity) - (typeof y.triggerPayload === 'number' ? y.triggerPayload : Infinity));
  }

  /* ------------------------------------------------------- comparison --- */

  const rawP = [52, 28, 20, 10].slice(0, actions.length);
  const sumP = rawP.reduce((s, p) => s + p, 0);
  const seededStats: CrowdStat[] = actions.map((act, i) => {
    const pct = Math.round((rawP[i] / sumP) * 100);
    return { choiceId: act.id, label: act.commitLabel, percentage: pct, count: pct, source: 'seed_demo' };
  });
  const reflections: CommunityReflection[] = options.seededReflections ?? [
    {
      id: 'ref_demo_1',
      authorHandle: '@reader_sample',
      authorName: 'Sample Reader (демо)',
      text: 'The hesitation before deciding is captured so well here.',
      timestamp: 'Пример отклика (демо)',
      upvotes: 4,
      source: 'seed_demo',
    },
  ];

  /* ----------------------------------------------------------- assemble --- */

  const serialized = serializeDSL(input);
  const id = options.id ?? `exp_${hash(`${serialized}|${story ?? ''}|${options.actualOutcome ?? ''}`)}`;
  const author = options.author?.trim() || 'Anonymous';
  const authorHandle = options.authorHandle ?? (author.startsWith('@') ? author : `@${author.toLowerCase().replace(/\s+/g, '_')}`);
  const focusSlot = keyObjects[0]?.slot ?? actions.find(a => !a.actorId)?.targetSlot;
  const theme = options.category ?? GRAMMAR_THEME[input.g] ?? 'Human Moment';

  const scenario: CanonicalScenario = {
    id,
    title,
    hook: synopsis,
    setup: opening,
    synopsis,
    author,
    authorHandle,
    duration: options.duration ?? '3 min',
    pillar: theme,
    world,
    playerSpawn,
    playerCharacter: PLAYER_CHARACTER,
    actors,
    actorCues,
    keyObjects,
    actions,
    beats,
    modifiers,
    endings,
    reality: truthText,
    authorTruth,
    crowdQuestion: input.x?.q ?? text(lang, 'crowd'),
    ...(options.authorChoice !== undefined && actions[options.authorChoice] ? { authorChoiceId: actions[options.authorChoice].id } : {}),
    seededStats,
    communityReflections: reflections,
    responsePrompt: options.responsePrompt ?? text(lang, 'response'),
    themeKey: theme,
    ...(options.responseToPostId ? { responseToPostId: options.responseToPostId } : {}),
    cinematic: {
      grammar: input.g,
      tone,
      cameraGrammar,
      staging,
      cameraEvents,
      focusSlot,
      lighting,
      lightingDef,
      bed: know.bed,
      soundRestraint: grammar.soundRestraint,
      cueAtMs,
      pressureAtMs,
      revealHoldMs: grammar.revealHoldMs,
    },
    provenance: {
      dslVersion: DSL_VERSION,
      compilerVersion: COMPILER_VERSION,
      source: options.source,
      ...(options.model ? { model: options.model } : {}),
    },
  };

  const plan: ExperiencePlan = {
    id,
    title,
    synopsis,
    worldTemplate: world,
    durationMinutes: 3,
    cast: actors.map(a => ({ role: a.role, character: a.character, slot: know.roleSlots[a.role as DslRole] ?? 'staged', pose: a.pose })),
    beats,
    interactions: actions.map(a => ({ id: a.id, targetSlot: a.targetSlot, label: a.label, observation: a.observation, commitLabel: a.commitLabel })),
    modifiers,
    commitments: actions.map(a => ({ id: a.id, targetSlot: a.targetSlot, label: a.commitLabel, outcome: endings[a.id] })),
    authorTruth,
    crowdQuestion: scenario.crowdQuestion,
    responsePrompt: scenario.responsePrompt,
    dsl,
    compiler: {
      dslVersion: DSL_VERSION,
      compilerVersion: COMPILER_VERSION,
      source: options.source,
      ...(options.model ? { model: options.model } : {}),
      dslBytes: new TextEncoder().encode(serialized).length,
      ...options.stamp,
    },
  };

  const analysis: StoryAnalysis = {
    setting: template.label,
    people: ['player', ...input.c.map(c => c[0])],
    emotionalCore: grammar.label,
    centralTension: synopsis,
    pivotalMoment: cueText,
    importantObjects: [...input.o],
    ...(authorTruth.status === 'author_supplied' ? { actualOutcome: authorTruth.text } : {}),
    experienceGrammar: input.g,
    themeKey: theme,
  };

  const post: StoredPlayablePost = {
    id,
    schemaVersion: 2,
    title,
    author,
    authorHandle,
    pillar: theme,
    world,
    synopsis,
    scenario,
    analysis,
    experiencePlan: plan,
    ...(options.responseToPostId ? { responseToPostId: options.responseToPostId } : {}),
    themeKey: theme,
    ...(story ? { inspirationPrompt: story } : {}),
    createdAt: options.createdAt ?? Date.now(),
    dsl,
    compiler: plan.compiler,
  };

  return { dsl, plan, scenario, post, notes };
}
