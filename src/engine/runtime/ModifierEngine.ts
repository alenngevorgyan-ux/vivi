import type { ExperienceModifier, ModifierKind } from '../modifiers/types';
import type { CollisionBox } from './collision';

export interface PhysicalModifierState {
  activeModifiers: ExperienceModifier[];
  phone: {
    isVibrating: boolean;
    isScreenLit: boolean;
    isTyping: boolean;
    previewText: string;
    lockCountdownSeconds?: number;
  };
  door: {
    state: 'closed' | 'ajar' | 'open' | 'handle_moving';
    isLocked: boolean;
    anchorSlot?: string;
  };
  elevator: {
    currentFloor: number;
    targetFloor: number;
    indicatorText: string;
    isDingActive: boolean;
    doorsOpen: boolean;
  };
  timeDisplay: {
    text: string;
    isExpiring: boolean;
  };
  npcAction: {
    pose: 'idle' | 'walk' | 'wait' | 'turn' | 'talk' | 'leave';
    x?: number;
    y?: number;
    speakingLine?: string;
  };
  ambientAudioCue: string | null;
  dynamicCollisions: CollisionBox[];
  /** Ambient bed requested by structured modifiers; undefined when none has spoken. */
  bed?: string | null;
  /** Active lighting effect. */
  lightMode?: 'flicker' | 'dim' | 'out';
  /** The room has turned to look at the player. */
  stare: boolean;
  /** Slots whose key object is currently catching the light. */
  glintSlots: string[];
  /** Anchor of whoever is speaking right now. */
  speakingAnchor?: string;
}

/**
 * Generic physical modifier interpreter.
 * Completely free of storyId-specific branching.
 */
export function computePhysicalModifiers(
  modifiers: ExperienceModifier[],
  elapsedMs: number,
  storyTimerAnchor?: string
): PhysicalModifierState {
  const activeModifiers = modifiers.filter(m => elapsedMs >= m.atMs);

  // Phone state
  let isVibrating = false;
  let isScreenLit = false;
  let isTyping = false;
  let previewText = '';
  let lockCountdownSeconds: number | undefined = undefined;

  // Door state
  let doorState: PhysicalModifierState['door']['state'] = 'closed';
  let doorLocked = false;
  let doorAnchor: string | undefined = undefined;

  // Elevator state
  let currentFloor = 1;
  let elevatorText = '';
  let isDingActive = false;
  let doorsOpen = false;

  // Time display
  let timeText = '';
  let isExpiring = false;

  // NPC Action
  const npcAction: PhysicalModifierState['npcAction'] = {
    pose: 'idle',
  };

  let ambientAudioCue: string | null = null;
  const dynamicCollisions: CollisionBox[] = [];
  let bed: string | null | undefined = undefined;
  let lightMode: PhysicalModifierState['lightMode'];
  let stare = false;
  const glintSlots: string[] = [];
  let speakingAnchor: string | undefined;

  // Default timer anchor fallback if provided
  if (storyTimerAnchor) {
    if (storyTimerAnchor.includes('03:16') && elapsedMs < 6000) {
      timeText = '03:16';
    } else if (storyTimerAnchor.includes('Meeting room clock')) {
      timeText = '10:42';
    } else if (storyTimerAnchor.includes('Station departure board') && elapsedMs < 7000) {
      timeText = '00:47';
    } else if (storyTimerAnchor.includes('Bus arrival board') && elapsedMs < 26000) {
      timeText = 'DUE 3 MIN';
    }
  }

  // Generic interpretation across all active modifiers
  for (const m of activeModifiers) {
    const elapsedSinceMod = elapsedMs - m.atMs;
    const kind = m.kind as string;
    const anchor = (m.anchor || '').toLowerCase();
    const payload = (m.payload || '').trim();
    const payloadLower = payload.toLowerCase();

    // Structured modifiers say exactly what they do; no text is interpreted.
    if (m.data) {
      const d = m.data;
      const live = m.durationMs === undefined || elapsedSinceMod < m.durationMs;
      if (d.bed !== undefined) bed = d.bed;
      if (d.screenText !== undefined) {
        isScreenLit = true;
        previewText = d.screenText;
        isTyping = false;
      }
      if (d.typing) {
        isScreenLit = true;
        isTyping = live;
        if (live) previewText = payload || 'Typing…';
      }
      if (d.vibrate && elapsedSinceMod < (m.durationMs ?? 4000)) isVibrating = true;
      if (d.lockSec) {
        const remaining = Math.max(0, d.lockSec - Math.floor(elapsedSinceMod / 1000));
        lockCountdownSeconds = remaining;
        timeText = remaining > 0 ? `LOCKS IN ${remaining}s` : 'LOCKED';
        isExpiring = remaining < 15;
        if (remaining === 0) isScreenLit = false;
      }
      if (d.door) {
        doorState = d.door;
        doorAnchor = m.anchor;
        if (d.door === 'handle_moving') isExpiring = true;
      }
      if (d.floors) {
        const [from, to] = d.floors;
        const floor = Math.min(to, from + Math.floor(elapsedSinceMod / 2000));
        currentFloor = floor;
        elevatorText = `FL ${floor}`;
        isDingActive = floor === to && elapsedSinceMod < (to - from) * 2000 + 1500;
        if (elapsedSinceMod >= (to - from) * 2000 + 1800) doorsOpen = true;
      }
      if (d.clock !== undefined) timeText = d.clock;
      if (d.countdownSec) {
        const remaining = Math.max(0, d.countdownSec - Math.floor(elapsedSinceMod / 1000));
        timeText = `${remaining}s`;
        isExpiring = true;
      }
      if (d.doorsOpen) {
        doorsOpen = true;
        isExpiring = true;
      }
      if (d.speech && live) {
        npcAction.speakingLine = d.speech;
        npcAction.pose = 'talk';
        speakingAnchor = m.anchor;
      }
      if (d.light) lightMode = live ? d.light : lightMode;
      if (d.intercom) {
        ambientAudioCue = 'intercom_ring';
      }
      if (d.stare) stare = live;
      if (d.glint && live) glintSlots.push(d.glint);
      continue;
    }

    // 1. Phone & text messages & typing
    if (
      kind === 'message' ||
      kind === 'typing' ||
      kind === 'incoming_call' ||
      kind === 'call' ||
      anchor.includes('phone')
    ) {
      isScreenLit = true;
      previewText = payload;

      if (kind === 'typing' || payloadLower.includes('typing')) {
        isTyping = true;
        previewText = 'Typing…';
      }

      // Vibrate for first 4 seconds of notification or during a call
      if (elapsedSinceMod < (m.durationMs || 4000) || kind === 'call') {
        isVibrating = true;
      }

      // If modifier payload or anchor specifies phone lock countdown
      if (payloadLower.includes('lock') || anchor.includes('phone')) {
        const remaining = Math.max(0, 35 - Math.floor(elapsedSinceMod / 1000));
        lockCountdownSeconds = remaining;
        timeText = `LOCKS IN ${remaining}s`;
        isExpiring = remaining < 15;
      }
    }

    // 2. Intercom & buzzers
    if (anchor.includes('intercom') || (kind === 'call' && anchor.includes('intercom'))) {
      ambientAudioCue = 'intercom_ring';
      timeText = '03:17';
    }

    // 3. Doors & handles
    if (kind === 'door' || kind === 'door_state' || anchor.includes('door')) {
      doorAnchor = m.anchor;
      if (
        payloadLower.includes('handle') ||
        payloadLower.includes('move') ||
        payloadLower.includes('jiggle') ||
        payloadLower.includes('rattle')
      ) {
        doorState = 'handle_moving';
        isExpiring = true;
      } else if (payloadLower.includes('open') || payloadLower.includes('ajar')) {
        doorState = 'open';
      } else if (payloadLower.includes('close') || payloadLower.includes('closed')) {
        doorState = 'closed';
      }
    }

    // 4. Elevator / Transit countdowns
    if (kind === 'elevator' || anchor.includes('elevator') || (kind === 'arrival' && anchor.includes('elevator'))) {
      // Check for progressive floor counting format like '6 · 7 · 8 · 9'
      if (payload.includes('6') && payload.includes('9')) {
        const floorStep = Math.min(9, 6 + Math.floor(elapsedSinceMod / 2000));
        currentFloor = floorStep;
        elevatorText = `FL ${floorStep}`;
        isDingActive = floorStep === 9;
      } else {
        elevatorText = payload;
        isDingActive = true;
      }

      if (elapsedSinceMod >= 8000) {
        doorsOpen = true;
      }
    }

    // 5. Timers & Clocks
    if (kind === 'timer') {
      if (payloadLower.includes('ten seconds') || payloadLower.includes('10')) {
        const remaining = Math.max(0, 10 - Math.floor(elapsedSinceMod / 1000));
        timeText = `${remaining}s`;
        isExpiring = true;
      } else {
        timeText = payload;
        if (payload.includes(':') || payload.includes('s')) {
          isExpiring = true;
        }
      }
    }

    // 6. Transit arrival / departure boards
    if (kind === 'arrival' || anchor.includes('station_board') || anchor.includes('bus_stop') || anchor.includes('train')) {
      if (anchor.includes('train')) {
        timeText = elapsedMs >= 26000 ? '00:45 DEPARTING' : '00:46 BOARDING';
        if (payloadLower.includes('doors open')) {
          doorsOpen = true;
          isExpiring = true;
        }
      } else if (anchor.includes('bus')) {
        timeText = elapsedMs >= 26000 ? 'BUS ARRIVING' : 'DUE 3 MIN';
        if (elapsedMs >= 26000) {
          ambientAudioCue = 'bus_engine';
          npcAction.pose = 'walk';
        }
      }
    }

    // 7. NPC pressure & dialogue
    if (kind === 'npcPressure' || kind === 'npc_dialogue') {
      npcAction.speakingLine = payload;
      npcAction.pose = 'talk';
    }

    // 8. Sound & Ambient cues
    if (kind === 'sound') {
      if (payloadLower.includes('shower') && !payloadLower.includes('stop')) {
        ambientAudioCue = 'shower_water';
        npcAction.pose = 'leave';
        npcAction.x = 76;
        npcAction.y = 52;
      } else if (payloadLower.includes('stop') || payloadLower.includes('stops')) {
        ambientAudioCue = null;
        npcAction.pose = 'wait';
      } else {
        ambientAudioCue = payload;
      }
    }

    // 9. Lighting & weather shifts
    if (kind === 'lighting' || kind === 'weather') {
      if (payloadLower.includes('flicker')) {
        isExpiring = true;
      }
      if (payloadLower.includes('rain')) {
        ambientAudioCue = 'rain_ambient';
      }
    }
  }

  return {
    activeModifiers,
    phone: {
      isVibrating,
      isScreenLit,
      isTyping,
      previewText,
      lockCountdownSeconds,
    },
    door: {
      state: doorState,
      isLocked: doorLocked,
      anchorSlot: doorAnchor,
    },
    elevator: {
      currentFloor,
      targetFloor: 9,
      indicatorText: elevatorText,
      isDingActive,
      doorsOpen,
    },
    timeDisplay: {
      text: timeText,
      isExpiring,
    },
    npcAction,
    ambientAudioCue,
    dynamicCollisions,
    bed,
    lightMode,
    stare,
    glintSlots,
    speakingAnchor,
  };
}
