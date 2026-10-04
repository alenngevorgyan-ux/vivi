/**
 * DEVELOPMENT entry for THE CORRECTION's visual slice: `/?v3=correction` (dev builds only; App.tsx compiles it
 * out of production). It does not replace any V1/V2 route.
 *
 * It assembles a VISUAL host: scene preparation through the hash-verifying AssetCache, the dev sessionStorage
 * repository + journal (not a production service), the private record loader (dynamic import, after the gate)
 * and the public reveal binding. Query parameters:
 *   variant=rich|compressed
 *   preload=fail|fail-once        persist=reject|flaky|mismatch     journal=reject|flaky
 *   reveal=fail|fail-once|invalid|invalid-once|stale|missing
 * `window.__v3Correction` (dev only) exposes state, status and fault controls to browser QA.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadPlayable } from '../../../engine/v3/compat/loadPlayable';
import type { RuntimeSnapshot } from '../../../engine/v3/contracts/state';
import type { ExperienceEvent, StepResult } from '../../../engine/v3/ExperienceController';
import type { InputIntent } from '../../../engine/input/InputManager';
import { correctionPost, type CorrectionVariant } from '../../../data/experienceV3Fixtures/runtime/theCorrection';
import { CORRECTION_RUNTIME_GEOMETRY, CORRECTION_STAGING } from '../../../data/experienceV3Fixtures/runtime/theCorrection.geometry';
import { correctionActSlots, correctionPublicCopy } from '../../../data/experienceV3Fixtures/runtime/theCorrection.presentation';
import { devJournal, devPrefs, devRepository, devSnapshots, type JournalFault, type PersistFault } from '../../../devtools/v3DevRepository';
import { devFetchAsset } from '../../../devtools/v3AssetFetch';
import { AssetCache } from '../v3/AssetPreloader';
import { correctionPublicRevealBinding, correctionRevealLoader, type RevealFault } from './CorrectionRevealHost';
import { ExperiencePlayerV3, type PlayerApi, type PlayerCopy } from '../v3/ExperiencePlayerV3';
import type { PreloadScene, VisualHostConfig } from '../v3/hostContracts';
import { deskDescription, DeskTitleInsert } from './scenes/CorrectionDesk';
import { meetingDescription } from './scenes/CorrectionMeeting';
import { hallwayDescription, SummaryInsert } from './scenes/CorrectionHallway';

interface Faults {
  preload: 'none' | 'fail' | 'fail-once';
  persist: PersistFault;
  journal: JournalFault;
  reveal: RevealFault;
  /** Browser QA: hold every preparation until released (stale-completion tests). */
  holdPreloads: boolean;
}

declare global {
  interface Window {
    __v3Correction?: {
      faults: Faults;
      getState: () => RuntimeSnapshot | undefined;
      status: () => unknown;
      dispatch: (e: ExperienceEvent) => StepResult | undefined;
      events: Array<{ type: string; rejected?: string; screen?: { caption: boolean; pose?: string | null; boundaryLine: boolean; withdrawn: boolean } }>;
      intents: InputIntent[];
      decisions: Array<{ key: string; option: string }>;
      revealLoads: number;
      preloads: Array<{ sceneId: string; txId: string; outcome?: string }>;
      held: Array<{ sceneId: string; txId: string; resolve: () => void; reject: () => void }>;
      disclosures: string[];
      revealRecordPresent: () => boolean;
      assetsReady: (id: string) => boolean;
      unmount: () => void;
      remount: () => void;
    };
  }
}

/** What each Correction place sounds like: an open-plan office, a closed meeting room, a tiled corridor. */
const correctionRoomTone = (location: string) =>
  location === 'meeting' ? ({ tone: 'meeting', floor: 'carpet' } as const) : location === 'hallway' ? ({ tone: 'corridor', floor: 'tile' } as const) : ({ tone: 'open_plan', floor: 'carpet' } as const);

/** Design frames: the open-plan desk sits in warm daylight; the meeting room and the corridor under cold practicals. */
const correctionTint = (location: string) => (location === 'desk' ? ('warm' as const) : ('cold' as const));

const param = (k: string) => new URLSearchParams(window.location.search).get(k) ?? undefined;

export default function CorrectionDevEntry() {
  const variant: CorrectionVariant = param('variant') === 'compressed' ? 'compressed' : 'rich';
  const loaded = useMemo(() => loadPlayable(correctionPost(variant)), [variant]);
  const staging = CORRECTION_STAGING[variant];
  const geometry = CORRECTION_RUNTIME_GEOMETRY[variant];
  const assets = useMemo(() => new AssetCache(staging.assets, devFetchAsset), [staging]);
  const [assetMode, setAssetMode] = useState<'full' | 'readable'>(() => (param('pictures') === 'off' ? 'readable' : 'full'));
  const modeRef = useRef(assetMode);
  modeRef.current = assetMode;
  const [mounted, setMounted] = useState(true);
  const [mountKey, setMountKey] = useState(0);
  const api = useRef<PlayerApi | null>(null);
  const faults = useRef<Faults>({
    preload: (param('preload') as Faults['preload']) ?? 'none',
    persist: (param('persist') as PersistFault) ?? 'none',
    journal: (param('journal') as JournalFault) ?? 'none',
    reveal: (param('reveal') as RevealFault) ?? 'none',
    holdPreloads: param('hold') === '1',
  });
  const log = useRef({ events: [] as NonNullable<Window['__v3Correction']>['events'], intents: [] as InputIntent[], decisions: [] as Array<{ key: string; option: string }>, revealLoads: 0, preloads: [] as Array<{ sceneId: string; txId: string; outcome?: string }>, held: [] as NonNullable<Window['__v3Correction']>['held'], disclosures: [] as string[] });

  const manifest = loaded.kind === 'v3' ? loaded.manifest : undefined;

  /* scene preparation: every framing's plates + the props, hash-verified and decoded, before the scene mounts */
  const preloadScene = useCallback<PreloadScene>(
    async ({ sceneId, txId, signal }) => {
      const entry = { sceneId, txId } as { sceneId: string; txId: string; outcome?: string };
      log.current.preloads.push(entry);
      if (modeRef.current === 'readable') {
        entry.outcome = 'readable';
        return { sceneId, fallback: 'readable' };
      }
      if (faults.current.holdPreloads)
        await new Promise<void>((resolve, reject) => log.current.held.push({ sceneId, txId, resolve, reject: () => reject(new Error('held preparation failed')) }));
      const n = log.current.preloads.filter(p => p.outcome !== 'readable').length;
      if (faults.current.preload === 'fail' || (faults.current.preload === 'fail-once' && n === 1)) {
        entry.outcome = 'failed';
        throw new Error('scene assets unavailable');
      }
      const f = staging.framings[sceneId];
      const cams = f ? [f.landscape, f.portrait, ...Object.values(f.portraitByBeat ?? {}), ...Object.values(f.portraitByOption ?? {})] : [];
      const ids = [...new Set(cams.flatMap(c => [staging.plates[c].graphite, staging.plates[c].paint]))];
      ids.push(staging.props.summary, staging.props.display);
      try {
        await assets.prepare(ids, signal);
      } catch (e) {
        entry.outcome = 'failed';
        throw e;
      }
      entry.outcome = 'ready';
      return { sceneId };
    },
    [assets, staging]
  );

  const hostConfig = useMemo<VisualHostConfig | undefined>(
    () =>
      manifest && {
        mode: 'visual',
        preloadScene,
        repository: devRepository(() => faults.current.persist, op => log.current.decisions.push({ key: op.key, option: op.option })),
        journal: devJournal(() => faults.current.journal),
        loadReveal: correctionRevealLoader(manifest.primaryDecision?.options ?? [], () => faults.current.reveal, () => log.current.revealLoads++),
        reveal: correctionPublicRevealBinding(),
        onSave: snap => devSnapshots.write(manifest.experienceId, manifest.revision, snap),
      },
    [manifest, preloadScene]
  );

  // "Try pictures again": prepare the current scene's pictures; the viewport waits for them.
  const prevMode = useRef(assetMode);
  useEffect(() => {
    const was = prevMode.current;
    prevMode.current = assetMode;
    if (assetMode !== 'full' || was !== 'readable' || !api.current) return;
    const s = api.current.getState();
    void preloadScene({ sceneId: s.scene, txId: 'pictures', identity: api.current.host.identity(), signal: new AbortController().signal }).catch(() => setAssetMode('readable'));
  }, [assetMode, preloadScene]);

  const copy = useMemo<PlayerCopy>(() => {
    const pub = correctionPublicCopy();
    const acts = new Map(correctionActSlots().map(a => [a.option, a]));
    return {
      title: pub.title,
      hook: pub.hook,
      disclosure: pub.disclosure,
      displayTitle: pub.displayTitle,
      boundaryLine: pub.boundaryLine,
      observations: pub.observations,
      intention: o => acts.get(o)?.caption.text ?? o,
      confirmation: o => acts.get(o)!.confirmation,
      describeScene: id =>
        id === 'c_desk' || id === 'c_compressed_before' ? deskDescription(pub.displayTitle) : id === 'c_hallway' ? hallwayDescription() : meetingDescription(pub.displayTitle, id === 'c_meeting_question' || id === 'c_compressed_meeting'),
      insert: id =>
        id === 'obs_title' ? (
          <DeskTitleInsert displayTitle={pub.displayTitle} textureSrc={assets.url(staging.props.display)} readable={pub.observations[id]} />
        ) : id === 'obs_summary' ? (
          <SummaryInsert summarySrc={assets.url(staging.props.summary)} readable={pub.observations[id]} />
        ) : undefined,
    };
  }, [assets, staging]);

  // Read at every (re)mount: returning to the route resumes from the last completed save.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const restore = useMemo(() => (manifest && param('resume') !== '0' ? devSnapshots.read(manifest.experienceId, manifest.revision) : undefined), [manifest, mountKey]);

  useEffect(() => {
    window.__v3Correction = {
      faults: faults.current,
      getState: () => api.current?.getState(),
      status: () => api.current?.host.getStatus(),
      dispatch: e => api.current?.dispatch(e),
      get events() { return log.current.events; },
      get intents() { return log.current.intents; },
      get decisions() { return log.current.decisions; },
      get revealLoads() { return log.current.revealLoads; },
      get preloads() { return log.current.preloads; },
      get held() { return log.current.held; },
      get disclosures() { return log.current.disclosures; },
      revealRecordPresent: () => !!api.current?.host.revealRecord(),
      assetsReady: id => assets.has(id),
      unmount: () => setMounted(false),
      remount: () => (setMountKey(k => k + 1), setMounted(true)),
    } as Window['__v3Correction'];
    return () => {
      delete window.__v3Correction;
    };
  }, [assets]);

  const onReady = useCallback((a: PlayerApi) => {
    api.current = a;
  }, []);

  if (!manifest || !hostConfig) return <p role="alert">The Correction did not load as a V3 post.</p>;
  return (
    <main className="v3p-page" data-testid="correction-dev-entry" data-variant={variant}>
      {mounted ? (
        <ExperiencePlayerV3
          key={mountKey}
          manifest={manifest}
          host={hostConfig}
          staging={staging}
          geometry={geometry}
          assets={assets}
          copy={copy}
          assetMode={assetMode}
          onAssetMode={setAssetMode}
          restore={restore}
          prefs={devPrefs}
          onReady={onReady}
          onIntent={i => log.current.intents.push(i)}
          roomTone={correctionRoomTone}
          tintOf={correctionTint}
          onEvent={(e, r) => {
            // For QA: what was on screen when a presentation receipt was accepted.
            const receipt = e.type === 'ENACTED' || e.type === 'HOLD_DONE' || e.type === 'BOUNDARY_DONE' || e.type === 'SKIP';
            const q = (sel: string) => document.querySelector(sel);
            log.current.events.push({
              type: e.type,
              rejected: r.rejected?.code,
              ...(receipt ? { screen: { caption: !!q('[data-testid="enactment-caption"],[data-testid="held-caption"]')?.textContent, pose: q('[data-testid="figure-a_me"]')?.getAttribute('data-pose') ?? null, boundaryLine: !!q('[data-testid="boundary-line"]'), withdrawn: !!q('.v3p-paint.is-withdrawn') } } : {}),
            });
          }}
          onDisclosure={d => log.current.disclosures.push(d)}
        />
      ) : (
        <p data-testid="player-gone">The player is not mounted.</p>
      )}
    </main>
  );
}
