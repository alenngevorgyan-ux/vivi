import type { Point } from '../runtime/navigation.ts';
import type { CanonicalScenario, RuntimeAction } from '../runtime/RuntimeCompiler.ts';
import { recipeFor } from './enactment.ts';
import type { CommitmentSpec, ExperienceV2, ObservationSpec } from './types.ts';

/**
 * Hotspots: the things in the room a player can choose, each with every
 * intent that concerns it. "Look at the phone" and "Open the conversation"
 * live on the same phone; "wait" and "say it in the room" live on the hero,
 * not on a chair invented to hold them.
 */

export type IntentKind = 'look' | 'deed';

export interface Intent {
  id: string;
  kind: IntentKind;
  label: string;
}

export interface Hotspot {
  key: string;
  /** Where the hotspot is drawn and what the hero faces. */
  anchor: Point;
  /** Authored standing spot for deeds that walk here. */
  stand?: Point;
  /** The hotspot is the hero: acted on in place. */
  self?: boolean;
  actorId?: string;
  /** The person is behind a door; the hotspot is the door. */
  throughDoor?: boolean;
  /** Short name: the first intent's label. */
  label: string;
  intents: Intent[];
}

export interface HotspotFrame {
  pos: Point;
  presence: number;
}

/** Deeds performed where the hero stands, with nothing in the room to aim at. */
function isSelfDeed(c: CommitmentSpec): boolean {
  if (c.carried) return true;
  if (c.actorId || c.objectId) return false;
  return c.enactment === 'hold' || c.enactment === 'speak_up' || c.enactment === 'use_device';
}

export function targetKey(t: { actorId?: string; objectId?: string; targetSlot: string; carried?: boolean }): string {
  if (t.carried) return 'self';
  if (t.actorId) return `actor:${t.actorId}`;
  if (t.objectId) return `obj:${t.objectId}`;
  return `slot:${t.targetSlot}`;
}

export interface HotspotContext {
  scenario: CanonicalScenario;
  experience: ExperienceV2;
  playerPos: Point;
  frames: Record<string, HotspotFrame>;
  slotPoint: (slot: string) => Point | undefined;
}

export function buildHotspots(ctx: HotspotContext): Hotspot[] {
  const { scenario, experience } = ctx;
  const byKey = new Map<string, Hotspot>();
  const actionById = new Map<string, RuntimeAction>(scenario.actions.map(a => [a.id, a]));
  const objectPos = (id?: string) => scenario.keyObjects?.find(k => k.id === id)?.pos;

  const place = (key: string, init: () => Omit<Hotspot, 'key' | 'intents' | 'label'> | null, intent: Intent) => {
    let spot = byKey.get(key);
    if (!spot) {
      const base = init();
      if (!base) return;
      spot = { key, ...base, label: intent.label, intents: [] };
      byKey.set(key, spot);
    }
    spot.intents.push(intent);
  };

  const anchorFor = (t: ObservationSpec | CommitmentSpec): Omit<Hotspot, 'key' | 'intents' | 'label'> | null => {
    if (t.actorId) {
      const frame = ctx.frames[t.actorId];
      if (!frame) return null;
      const action = scenario.actions.find(a => a.actorId === t.actorId);
      if (frame.presence >= 0.5) return { anchor: frame.pos, actorId: t.actorId };
      // Someone behind a door can be spoken to through it; otherwise they are simply not here.
      if (action?.awayLabel) return { anchor: frame.pos, actorId: t.actorId, throughDoor: true };
      return null;
    }
    const obj = objectPos(t.objectId);
    if (obj) return { anchor: obj };
    const slot = ctx.slotPoint(t.targetSlot);
    return slot ? { anchor: slot } : null;
  };

  for (const o of experience.observations) {
    const key = targetKey(o);
    const intent: Intent = { id: o.id, kind: 'look', label: o.label };
    if (key === 'self') place('self', () => ({ anchor: ctx.playerPos, self: true }), intent);
    else place(key, () => anchorFor(o), intent);
  }

  for (const c of experience.commitments) {
    const intent: Intent = { id: c.id, kind: 'deed', label: c.label };
    if (isSelfDeed(c)) {
      place('self', () => ({ anchor: ctx.playerPos, self: true }), intent);
      continue;
    }
    const key = targetKey(c);
    const action = actionById.get(c.id);
    place(
      key,
      () => {
        const base = anchorFor(c);
        if (!base) return null;
        const recipe = recipeFor(c);
        const stand: Point | undefined = action && !c.actorId && recipe.approach ? [action.slotInfo.standX, action.slotInfo.standY] : undefined;
        return { ...base, ...(stand ? { stand } : {}) };
      },
      intent
    );
    // A later deed may carry the authored spot when the hotspot was opened by a look.
    const spot = byKey.get(key);
    if (spot && !spot.stand && action && !c.actorId && recipeFor(c).approach) spot.stand = [action.slotInfo.standX, action.slotInfo.standY];
  }

  // Two hotspots on the same thing (a door, and the person behind it) are one place to the player.
  const merged: Hotspot[] = [];
  for (const spot of byKey.values()) {
    const twin = merged.find(
      m =>
        !m.self &&
        !spot.self &&
        // A person behind a door is the door: a door is tall, so "near" reaches further.
        Math.hypot(m.anchor[0] - spot.anchor[0], m.anchor[1] - spot.anchor[1]) < (m.throughDoor || spot.throughDoor ? 18 : 7) &&
        !(m.actorId && spot.actorId && !m.throughDoor && !spot.throughDoor)
    );
    if (twin) {
      twin.intents.push(...spot.intents);
      // The person is who the hotspot is about; stand where they would be heard, not on the wall.
      if (!twin.actorId && spot.actorId) Object.assign(twin, { actorId: spot.actorId, throughDoor: spot.throughDoor, key: spot.key, anchor: spot.anchor });
      twin.stand ??= spot.stand;
    } else merged.push({ ...spot, intents: [...spot.intents] });
  }

  // Looks before deeds inside each hotspot, and the hero last in the Tab order.
  const spots = merged.map(s => ({ ...s, intents: [...s.intents.filter(i => i.kind === 'look'), ...s.intents.filter(i => i.kind === 'deed')] }));
  spots.forEach(s => (s.label = s.intents[0]?.label ?? s.label));
  return spots.sort((a, b) => (a.self ? 1 : 0) - (b.self ? 1 : 0) || a.anchor[0] - b.anchor[0]);
}

export function intentById(experience: ExperienceV2, id: string): { kind: IntentKind; observation?: ObservationSpec; commitment?: CommitmentSpec } | undefined {
  const observation = experience.observations.find(o => o.id === id);
  if (observation) return { kind: 'look', observation };
  const commitment = experience.commitments.find(c => c.id === id);
  if (commitment) return { kind: 'deed', commitment };
  return undefined;
}
