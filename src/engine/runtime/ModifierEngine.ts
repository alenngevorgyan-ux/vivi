import type { ExperienceModifier, ModifierKind } from '../modifiers/types';
import type { CollisionBox } from './collision';

export interface PhysicalModifierState {
  activeModifiers: ExperienceModifier[];
  phone: {
    isVibrating: boolean;
    isScreenLit: boolean;
    previewText: string;
    lockCountdownSeconds?: number;
  };
  door: {
    state: 'closed' | 'ajar' | 'open' | 'handle_moving';
    isLocked: boolean;
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
}

export function computePhysicalModifiers(
  modifiers: ExperienceModifier[],
  elapsedMs: number,
  storyId: string
): PhysicalModifierState {
  const activeModifiers = modifiers.filter(m => elapsedMs >= m.atMs);

  // Phone state
  let isVibrating = false;
  let isScreenLit = false;
  let previewText = '';
  let lockCountdownSeconds: number | undefined = undefined;

  // Door state
  let doorState: PhysicalModifierState['door']['state'] = 'closed';
  let doorLocked = false;

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

  // Story-specific physical orchestration
  if (storyId === 'the-message') {
    // 0s-4s: partner in living room
    // 4s: partner walks to bathroom, shower starts
    // 7s: phone vibrates "I still smell like you."
    // 18s: typing indicator
    // 30s: shower stops, footsteps behind door
    // 36s: door handle jiggles
    if (elapsedMs >= 4000 && elapsedMs < 30000) {
      ambientAudioCue = 'shower_water';
      npcAction.pose = 'leave';
      npcAction.x = 76;
      npcAction.y = 52;
    }
    if (elapsedMs >= 7000) {
      isScreenLit = true;
      previewText = 'I still smell like you.';
      isVibrating = elapsedMs < 11000 || (elapsedMs >= 17000 && elapsedMs < 20000);
      lockCountdownSeconds = Math.max(0, 35 - Math.floor((elapsedMs - 7000) / 1000));
      timeText = `LOCKS IN ${lockCountdownSeconds}s`;
    }
    if (elapsedMs >= 18000 && elapsedMs < 24000) {
      previewText = 'Typing…';
    }
    if (elapsedMs >= 30000) {
      doorState = 'handle_moving';
      npcAction.pose = 'turn';
      isExpiring = true;
    }
    if (elapsedMs >= 36000) {
      doorState = 'ajar';
    }
  } else if (storyId === '0317') {
    // 03:16 -> 03:17
    const isRing = elapsedMs >= 6000;
    timeText = isRing ? '03:17' : '03:16';
    if (isRing) {
      ambientAudioCue = 'intercom_ring';
    }
    if (elapsedMs >= 16000 && elapsedMs < 24000) {
      // Elevator counting 6..7..8..9
      const floorStep = Math.min(9, 6 + Math.floor((elapsedMs - 16000) / 2000));
      currentFloor = floorStep;
      elevatorText = `FL ${floorStep}`;
      isDingActive = floorStep === 9;
    }
    if (elapsedMs >= 24000) {
      elevatorText = 'FL 9';
      doorState = 'handle_moving';
      isExpiring = true;
    }
  } else if (storyId === 'the-presentation') {
    if (elapsedMs >= 6000) {
      npcAction.pose = 'talk';
      npcAction.speakingLine = 'Excellent work.';
    }
    if (elapsedMs >= 25000) {
      const remaining = Math.max(0, 10 - Math.floor((elapsedMs - 25000) / 1000));
      timeText = `${remaining}s`;
      isExpiring = true;
      npcAction.pose = 'turn';
    } else {
      timeText = '10:42';
    }
  } else if (storyId === 'last-walk') {
    timeText = elapsedMs >= 26000 ? 'BUS ARRIVING' : 'DUE 3 MIN';
    if (elapsedMs >= 7000) {
      npcAction.pose = 'turn';
    }
    if (elapsedMs >= 26000) {
      ambientAudioCue = 'bus_engine';
      npcAction.pose = 'walk';
    }
  } else if (storyId === 'the-last-train') {
    timeText = elapsedMs >= 26000 ? '00:45 DEPARTING' : elapsedMs >= 7000 ? '00:46 BOARDING' : '00:47';
    if (elapsedMs >= 26000) {
      doorsOpen = true;
      isExpiring = true;
    }
  } else {
    // Generic fallback for user-generated or other stories
    const lastModifier = activeModifiers[activeModifiers.length - 1];
    if (lastModifier) {
      if (lastModifier.kind === 'message' || lastModifier.kind === 'call') {
        isScreenLit = true;
        previewText = lastModifier.payload;
        isVibrating = true;
      }
      if (lastModifier.kind === 'door') {
        doorState = 'handle_moving';
      }
      if (lastModifier.kind === 'timer') {
        timeText = lastModifier.payload;
        isExpiring = true;
      }
    }
  }

  return {
    activeModifiers,
    phone: {
      isVibrating,
      isScreenLit,
      previewText,
      lockCountdownSeconds,
    },
    door: {
      state: doorState,
      isLocked: doorLocked,
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
  };
}
