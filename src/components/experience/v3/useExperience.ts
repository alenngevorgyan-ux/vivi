import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PlaybackManifestV3 } from '../../../engine/v3/contracts/manifest';
import type { RuntimeSnapshot } from '../../../engine/v3/contracts/state';
import { createExperience, deriveScopes, movementEligible, step, type ControllerEffect, type ExperienceEvent, type StepResult } from '../../../engine/v3/ExperienceController';
import { buildReadableModel } from '../../../engine/v3/readable';
import type { InputManager } from '../../../engine/input/InputManager';

export interface UseExperienceOptions {
  manager: InputManager;
  /** Resolve the separate reveal record. Called only after the truth boundary. */
  loadReveal?: (experienceId: string, revision: string) => Promise<unknown>;
  /** Persist an accepted act. Must be idempotent on the decision version. */
  persistDecision?: (decision: string, option: string) => void | Promise<void>;
  onSave?: (snapshot: RuntimeSnapshot) => void;
  /** Every event and its outcome, for diagnostics and tests. Codes only. */
  onEvent?: (event: ExperienceEvent, result: StepResult) => void;
}

/**
 * Binds the pure reducer to React. The ref holds the authoritative snapshot so
 * two events in the same tick compose, the InputManager is told about scope
 * and eligibility changes SYNCHRONOUSLY (a modal stops movement in the same
 * tick, not after the next render), and React state is only a projection.
 */
export function useExperience(manifest: PlaybackManifestV3, opts: UseExperienceOptions) {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const [state, setState] = useState<RuntimeSnapshot>(() => createExperience(manifest, { attemptId: `attempt-${Date.now().toString(36)}` }));
  const ref = useRef(state);
  const dispatchRef = useRef<(e: ExperienceEvent) => StepResult>(null as unknown as (e: ExperienceEvent) => StepResult);

  const perform = useCallback((effect: ControllerEffect) => {
    const o = optsRef.current;
    const d = (e: ExperienceEvent) => dispatchRef.current(e);
    switch (effect.type) {
      case 'preload_scene': {
        // Nothing to preload yet; a host with real assets awaits them here. The late-completion guard is the txId.
        const txId = effect.txId;
        Promise.resolve().then(() => d({ type: 'TRANSITION_READY', txId }));
        break;
      }
      case 'persist_decision': {
        const { decision, option } = effect;
        Promise.resolve(o.persistDecision?.(decision, option)).then(() => d({ type: 'DECISION_RECORDED' }), () => undefined);
        break;
      }
      case 'enact':
        // Renderer-less presentation: the act is performed, held, and reaches the boundary. A presentation director replaces this.
        Promise.resolve().then(() => {
          d({ type: 'ENACTED' });
          d({ type: 'HOLD_DONE' });
          d({ type: 'BOUNDARY_DONE' });
        });
        break;
      case 'load_reveal':
        Promise.resolve(o.loadReveal?.(effect.experienceId, effect.revision) ?? Promise.resolve()).then(() => d({ type: 'REVEAL_LOADED' }), () => d({ type: 'REVEAL_FAILED' }));
        break;
      case 'save_snapshot':
        o.onSave?.(ref.current);
        break;
      case 'focus_handoff':
      case 'diagnostic':
        break;
    }
  }, []);

  const dispatch = useCallback(
    (event: ExperienceEvent): StepResult => {
      const result = step(manifest, ref.current, event);
      if (result.state !== ref.current) {
        ref.current = result.state;
        const { manager } = optsRef.current;
        manager.setScopes(deriveScopes(result.state));
        manager.setMovementEligible(movementEligible(result.state));
        setState(result.state);
      }
      result.effects.forEach(perform);
      optsRef.current.onEvent?.(event, result);
      return result;
    },
    [manifest, perform]
  );
  dispatchRef.current = dispatch;

  /* tab visibility and window focus pause the clocks; they are keyed, so they never unpause each other */
  useEffect(() => {
    const onVisibility = () => dispatch({ type: document.visibilityState === 'hidden' ? 'PAUSE' : 'RESUME', reason: 'hidden' });
    const onBlur = () => dispatch({ type: 'PAUSE', reason: 'blur' });
    const onFocus = () => dispatch({ type: 'RESUME', reason: 'blur' });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [dispatch]);

  const readable = useMemo(() => buildReadableModel(manifest, state), [manifest, state]);
  return { state, dispatch, readable, getState: () => ref.current };
}
