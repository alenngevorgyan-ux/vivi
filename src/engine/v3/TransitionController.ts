/**
 * Portal transactions, as pure functions over the snapshot.
 *
 *   request ─▶ eligibility recheck ─▶ freeze interaction ─▶ (host preloads)
 *     ─▶ atomic swap: scene, location, hero transfer, visited ─▶ entering
 *     ─▶ focus handoff ─▶ playing
 *
 * - A preload cannot change story state: only the commit does, and only for
 *   the transaction that is still current. Late or duplicate completions are
 *   rejected by transaction id.
 * - Failure before the swap leaves the source exactly as it was.
 * - Only the hero moves. Carried objects follow their owner; every other
 *   entity, fact, observation and variable stays where it was, so going back
 *   never resets the world or duplicates anything.
 * - Portal topology comes from the manifest; nothing is invented here.
 */

import type { PlaybackManifestV3 } from './contracts/manifest.ts';
import type { HeroPlacement, PreparationRecord, RuntimeSnapshot } from './contracts/state.ts';
import type { EntityState } from './contracts/manifest.ts';
import { pause, resume } from './ClockService.ts';
import { portalBlock } from './queries.ts';
import type { RejectionCode, StepResult } from './types.ts';

const reject = (state: RuntimeSnapshot, code: RejectionCode): StepResult => ({ state, effects: [], rejected: { code } });

export function beginTransition(m: PlaybackManifestV3, s: RuntimeSnapshot, portalId: string): StepResult {
  if (s.transition) return reject(s, 'busy'); // idempotent: a second request never opens a second transaction
  if (s.phase !== 'playing') return reject(s, 'wrong_phase');
  if (s.openObservation || s.modal) return reject(s, 'busy');
  const portal = m.portals.find(p => p.id === portalId);
  if (!portal) return reject(s, 'unknown_id');
  const block = portalBlock(m, s, portal);
  if (block) return reject(s, block === 'gate' ? 'unavailable' : block === 'closed' ? 'closed' : block === 'locked' ? 'locked' : block);

  const txId = `tx${s.txCounter + 1}`;
  let time = s.time;
  if (s.sheet) time = resume(time, 'modal', 'sheet');
  time = pause(time, 'transition', txId);
  return {
    state: {
      ...s,
      phase: 'transitioning',
      txCounter: s.txCounter + 1,
      // freeze conflicting interaction
      sheet: undefined,
      selectedTarget: undefined,
      time,
      transition: { id: txId, portal: portal.id, fromScene: s.scene, toScene: portal.toScene, fromLocation: s.location, toLocation: portal.to, status: 'preloading' },
    },
    effects: [{ type: 'preload_scene', txId, scene: portal.toScene }],
  };
}

export function commitTransition(m: PlaybackManifestV3, s: RuntimeSnapshot, txId: string): StepResult {
  const tx = s.transition;
  if (!tx || tx.id !== txId) return reject(s, 'stale_transaction');
  const portal = m.portals.find(p => p.id === tx.portal);
  if (!portal) return abortTransition(s, txId); // cannot happen with a validated manifest; fail safe
  const spineIdx = m.spine.indexOf(tx.toScene);
  const { entities, heroMarks, preparations } = moveHero(m, s, tx.fromLocation, tx.toLocation, tx.toScene);
  return {
    state: {
      ...s,
      phase: 'entering',
      scene: tx.toScene,
      location: tx.toLocation,
      arcIndex: portal.kind === 'spine' && spineIdx > s.arcIndex ? spineIdx : s.arcIndex,
      visitedScenes: s.visitedScenes.includes(tx.toScene) ? s.visitedScenes : [...s.visitedScenes, tx.toScene],
      entities,
      heroMarks,
      preparations,
      transition: undefined,
      time: resume(s.time, 'transition', tx.id),
    },
    effects: [{ type: 'save_snapshot' }, { type: 'focus_handoff', scene: tx.toScene }],
  };
}

export function abortTransition(s: RuntimeSnapshot, txId: string): StepResult {
  const tx = s.transition;
  if (!tx || tx.id !== txId) return reject(s, 'stale_transaction');
  return { state: { ...s, phase: 'playing', transition: undefined, time: resume(s.time, 'transition', tx.id) }, effects: [] };
}

/**
 * Only the hero moves. Its placement in the location it leaves is saved; in the destination it takes the
 * placement it left there, or on a first visit the destination scene's entry mark. A cut to another scene of
 * the same location keeps the same body where it is. The current location's placement lives only on the hero
 * entity, so there is never a second copy to drift.
 */
function moveHero(m: PlaybackManifestV3, s: RuntimeSnapshot, from: string, to: string, toScene: string): Pick<RuntimeSnapshot, 'entities' | 'heroMarks' | 'preparations'> {
  const hero = s.entities.find(e => e.id === m.perspectiveActor);
  const relocate = (e: EntityState): EntityState => ({ ...e, owner: { kind: 'location', id: to } });
  if (!hero || from === to) return { entities: s.entities.map(e => (e === hero ? relocate(e) : e)), heroMarks: s.heroMarks, preparations: s.preparations };

  const positional = (r: PreparationRecord) => r.undo.some(u => u.entity === hero.id && (u.kind === 'mark' || (u.kind === 'state' && u.key === 'mark_role')));
  const carried = s.preparations.filter(positional);
  const leaving: HeroPlacement = {
    ...(hero.mark ? { mark: { ...hero.mark } } : {}),
    ...(hero.state.mark_role ? { role: hero.state.mark_role } : {}),
    ...(carried.length ? { preparations: carried } : {}),
  };
  const { [to]: saved, ...others } = s.heroMarks;
  const entry = m.compiledScenes.find(c => c.id === toScene)?.entryMark;
  const arriving: HeroPlacement = saved ?? (entry ? { mark: { ...entry } } : {});

  const { mark: _mark, ...base } = relocate(hero);
  const { mark_role: _role, ...state } = hero.state;
  const placed: EntityState = {
    ...base,
    ...(arriving.mark ? { mark: { ...arriving.mark } } : {}),
    state: arriving.role ? { ...state, mark_role: arriving.role } : state,
  };
  return {
    entities: s.entities.map(e => (e === hero ? placed : e)),
    heroMarks: { ...others, [from]: leaving },
    preparations: [...s.preparations.filter(r => !positional(r)), ...(arriving.preparations ?? [])],
  };
}
