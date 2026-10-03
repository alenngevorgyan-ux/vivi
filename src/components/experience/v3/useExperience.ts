import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { PlaybackManifestV3 } from '../../../engine/v3/contracts/manifest';
import type { RuntimeSnapshot } from '../../../engine/v3/contracts/state';
import { deriveScopes, movementEligible, type ExperienceEvent, type StepResult } from '../../../engine/v3/ExperienceController';
import { buildReadableModel } from '../../../engine/v3/readable';
import type { InputManager } from '../../../engine/input/InputManager';
import { ExperienceHost } from './ExperienceHost';
import type { HostConfig, HostStatus } from './hostContracts';

export interface UseExperienceOptions {
  manager: InputManager;
  /**
   * The host contracts (preparation, journal, repository, reveal loader, binding). Read when the host is created:
   * keep it stable for a manifest revision. A different manifest revision creates a new host and detaches the old.
   */
  host: HostConfig;
  /** A stored snapshot to resume. Validated; an invalid one starts fresh. */
  restore?: unknown;
  attemptId?: string;
  /** Every event and its outcome, for diagnostics and tests. Codes only. */
  onEvent?: (event: ExperienceEvent, result: StepResult) => void;
}

/**
 * Binds ExperienceHost to React. The host owns the authoritative snapshot, so two events in the same tick
 * compose; React state is only a projection of it. The InputManager is told about scope and eligibility changes
 * SYNCHRONOUSLY from the host's own notification (a modal stops movement in the same tick, not after a render).
 *
 * Mounting attaches the host (recovery, entry preparation, resumed persistence); unmounting or a revision change
 * detaches it, and every callback of that mount becomes stale. Nothing here completes preparation, persistence,
 * presentation or the reveal on its own.
 */
export function useExperience(manifest: PlaybackManifestV3, opts: UseExperienceOptions) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const host = useMemo(
    () =>
      new ExperienceHost(manifest, optsRef.current.host, {
        attemptId: optsRef.current.attemptId,
        restore: optsRef.current.restore,
        onStep: (e, r) => optsRef.current.onEvent?.(e, r),
      }),
    // A new manifest revision or decision version is a new host: its stale callbacks can never land here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [manifest.experienceId, manifest.revision, manifest.decisionVersion]
  );

  useEffect(() => {
    const sync = () => {
      const s = host.getState();
      optsRef.current.manager.setScopes(deriveScopes(s));
      optsRef.current.manager.setMovementEligible(movementEligible(s));
    };
    const off = host.subscribe(sync);
    sync();
    host.attach();
    return () => {
      off();
      host.detach();
    };
  }, [host]);

  const state = useSyncExternalStore(host.subscribe.bind(host), () => host.getState());
  const status: HostStatus = useSyncExternalStore(host.subscribe.bind(host), () => host.getStatus());
  const dispatch = useCallback((event: ExperienceEvent): StepResult => host.dispatch(event), [host]);

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
  const getState = useCallback((): RuntimeSnapshot => host.getState(), [host]);
  return { host, state, status, dispatch, readable, getState };
}
