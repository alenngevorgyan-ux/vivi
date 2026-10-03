/**
 * Development harness for the Phase 1 substrate. Reached only in dev builds at
 * `?v3=foundation`. It mounts the foundation player on the neutral fixture
 * beside deliberately ordinary page content (a native button, a text field, a
 * contenteditable, a link, a long scrolling page) so real keyboard events can
 * prove who owns what. It exposes `window.__v3Test`; nothing here ships.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { RuntimeSnapshot } from '../../../engine/v3/contracts/state';
import type { ExperienceEvent, StepResult } from '../../../engine/v3/ExperienceController';
import type { InputIntent } from '../../../engine/input/InputManager';
import { loadPlayable } from '../../../engine/v3/compat/loadPlayable';
import { foundationPost, foundationReveal } from '../../../engine/v3/testing/foundationFixture';
import { harnessJournal } from '../../../devtools/v3HarnessJournal';
import type { DecisionRepository, HostConfig } from './hostContracts';
import { V3FoundationPlayer, type PlayerApi } from './V3FoundationPlayer';

declare global {
  interface Window {
    __v3Test?: {
      intents: InputIntent[];
      events: Array<{ type: string; rejected?: string }>;
      decisions: Array<{ decision: string; option: string }>;
      host: () => { status: unknown; revealRecord: unknown } | undefined;
      nativeClicks: number;
      getState: () => RuntimeSnapshot | undefined;
      dispatch: (e: ExperienceEvent) => StepResult | undefined;
    };
  }
}

export default function V3Harness() {
  const loaded = React.useMemo(() => loadPlayable(foundationPost()), []);
  const [mounted, setMounted] = useState(true);
  const [clicks, setClicks] = useState(0);
  const api = useRef<PlayerApi | null>(null);
  const log = useRef({ intents: [] as InputIntent[], events: [] as Array<{ type: string; rejected?: string }>, decisions: [] as Array<{ decision: string; option: string }> });

  useEffect(() => {
    window.__v3Test = {
      get intents() { return log.current.intents; },
      get events() { return log.current.events; },
      get decisions() { return log.current.decisions; },
      host: () => (api.current ? { status: api.current.host.getStatus(), revealRecord: api.current.host.revealRecord() } : undefined),
      get nativeClicks() { return Number(document.querySelector('[data-testid="native-clicks"]')?.textContent ?? 0); },
      getState: () => api.current?.getState(),
      dispatch: e => api.current?.dispatch(e),
    } as Window['__v3Test'];
    return () => { delete window.__v3Test; };
  }, []);

  const onReady = useCallback((a: PlayerApi) => { api.current = a; }, []);
  const onIntent = useCallback((i: InputIntent) => { log.current.intents.push(i); }, []);
  const onEvent = useCallback((e: ExperienceEvent, r: StepResult) => { log.current.events.push({ type: e.type, rejected: r.rejected?.code }); }, []);
  // The harness is a renderer-less shell, so it selects the explicit headless host. Everything else is a real contract:
  // the repository acknowledges the exact operation, the journal survives a reload (sessionStorage), and the private
  // record is fetched, validated and bound exactly as a visual host's would be.
  // Dev-only fault injection: `&persist=reject` always fails the repository write; `&persist=flaky` fails the first.
  const hostConfig = React.useMemo<HostConfig>(() => {
    const mode = () => new URLSearchParams(window.location.search).get('persist');
    let calls = 0;
    const repository: DecisionRepository = {
      record: op => {
        log.current.decisions.push({ decision: op.decisionId, option: op.option });
        calls++;
        if (mode() === 'reject' || (mode() === 'flaky' && calls === 1)) return Promise.reject(new Error('persist failed'));
        return Promise.resolve({ key: op.key, decisionId: op.decisionId, option: op.option });
      },
    };
    return {
      mode: 'headless',
      repository,
      journal: harnessJournal,
      loadReveal: () => Promise.resolve(foundationReveal()),
      reveal: { revealRef: 'reveal-foundation', recordRevision: 'r1' },
    };
  }, []);

  if (loaded.kind !== 'v3') return <p role="alert">The fixture did not load as V3.</p>;

  return (
    <main style={{ padding: '1rem' }}>
      <h1>V3 foundation harness</h1>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" data-testid="chrome-button" onClick={() => setClicks(c => c + 1)}>Chrome action</button>
        <span>native clicks: <b data-testid="native-clicks">{clicks}</b></span>
        <label>Typing field <input data-testid="typing-field" type="text" /></label>
        <div data-testid="editable" contentEditable suppressContentEditableWarning role="textbox" aria-label="Editable" style={{ minWidth: '8rem', border: '1px solid #888', padding: '0.25rem' }} />
        <a href="#probe" data-testid="probe-link">Probe link</a>
        <button type="button" data-testid="unmount-player" onClick={() => setMounted(false)}>Leave route</button>
        <button type="button" data-testid="mount-player" onClick={() => setMounted(true)}>Return to route</button>
      </div>
      {mounted ? <V3FoundationPlayer manifest={loaded.manifest} host={hostConfig} onIntent={onIntent} onEvent={onEvent} onReady={onReady} /> : <p data-testid="player-gone">The player is not mounted.</p>}
      <div aria-hidden="true" style={{ height: '2400px' }} data-testid="spacer">scroll space</div>
    </main>
  );
}
