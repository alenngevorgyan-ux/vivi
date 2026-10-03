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
import type { RuntimeSnapshot } from './contracts/state.ts';
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
  const entities = s.entities.map(e => (e.id === m.perspectiveActor ? { ...e, owner: { kind: 'location' as const, id: tx.toLocation } } : e));
  return {
    state: {
      ...s,
      phase: 'entering',
      scene: tx.toScene,
      location: tx.toLocation,
      arcIndex: portal.kind === 'spine' && spineIdx > s.arcIndex ? spineIdx : s.arcIndex,
      visitedScenes: s.visitedScenes.includes(tx.toScene) ? s.visitedScenes : [...s.visitedScenes, tx.toScene],
      entities,
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
