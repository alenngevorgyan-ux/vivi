import type { ViviWorldId } from '../../world/templates';
import type { ViviCharacterId, CharacterPose } from '../../assets/characters/characters';
import type { ShotCue } from './shotTypes';
import type { ExperienceModifier } from '../modifiers/types';

/** Design contract between story compilation and playback; authored hero scripts are a lightweight first use. */
export interface ExperiencePlan {
  id: string;
  world: ViviWorldId;
  durationTargetSeconds: [number, number];
  cast: Array<{ role: string; character: ViviCharacterId; slot: string; pose: CharacterPose }>;
  objects: Array<{ id: string; slot: string; inspectable: boolean }>;
  shots: ShotCue[];
  modifiers: ExperienceModifier[];
  commitments: Array<{ id: string; objectOrZone: string; label: string }>;
  reveal: { immediate: Record<string, string>; authorAccount: string };
  responsePrompt?: string;
}
