import React, { useMemo, useState, useEffect } from 'react';
import { heroStories } from '../../data/heroStories';
import { EVAL_CORPUS } from '../../data/evalCorpus';
import { compileHeroStoryToRuntime, type CanonicalScenario, type RuntimeAction } from '../../engine/runtime/RuntimeCompiler';
import { compileViviStory, type CompileStoryResult } from '../../engine/compiler/compileViviStory';
import { serializeDSL, type ViviExperienceDSL } from '../../engine/compiler/dsl';
import { preprocessStory, type StoryHints } from '../../engine/compiler/preprocess';
import { CanonicalViviEngine } from '../world/CanonicalViviEngine';
import { StoryBeatRunner } from '../../engine/runtime/StoryBeatRunner';
import { computePhysicalModifiers } from '../../engine/runtime/ModifierEngine';
import { actorFramesAt } from '../../engine/runtime/actors';
import { scenarioCast } from '../../engine/runtime/scenarioActors';
import type { DirectedShot } from '../../engine/cinematic/director';

/**
 * DIRECTOR LAB — development only (open with ?lab).
 *
 * Two jobs:
 *  1. Compiler inspector: story → preprocessing hints → DSL → ExperiencePlan →
 *     CanonicalScenario, with the compiler's own notes, sizes and provenance.
 *  2. Deterministic snapshots: render any moment of a scene with no animation
 *     loop, so a frame can be inspected even where requestAnimationFrame is
 *     throttled (hidden previews, headless browsers).
 */

interface LabSource {
  key: string;
  label: string;
  story?: string;
  outcome?: string;
  heroId?: string;
}

const SOURCES: LabSource[] = [
  ...heroStories.filter(s => s.dsl).map(s => ({ key: `hero:${s.id}`, label: `★ ${s.title} (golden DSL)`, heroId: s.id })),
  ...EVAL_CORPUS.map(e => ({ key: `eval:${e.id}`, label: `${e.acceptance ? `[${e.acceptance}] ` : ''}${e.id}`, story: e.story, outcome: e.outcome })),
  { key: 'custom', label: 'Custom story…' },
];

/** Rough token estimate for display only; real usage comes from the provider. */
const estimateTokens = (s: string) => {
  let latin = 0;
  let other = 0;
  for (const ch of s) ch.charCodeAt(0) < 0x250 ? latin++ : other++;
  return Math.ceil(latin / 3.4 + other / 1.7);
};

type GenerationReport = CompileStoryResult['report'] & { semanticProvider?: string };

/** Last generation made through the real Create flow (stored by ViviCreate in dev only). */
function readLastUiGeneration(): GenerationReport | null {
  try {
    const raw = sessionStorage.getItem('vivi:lastGeneration');
    return raw ? (JSON.parse(raw) as GenerationReport) : null;
  } catch {
    return null;
  }
}

/**
 * Development-only generation report: who answered, what it cost, whether it
 * needed a repair or fell back. Built from the server's compilerReport, which
 * never contains a key, headers or request objects.
 */
function GenerationReportPanel({ report, title }: { report: GenerationReport; title: string }) {
  const u = report.usage;
  const rows: Array<[string, React.ReactNode]> = [
    ['source', <strong key="s">{report.source}</strong>],
    ['provider', report.semanticProvider ?? report.providerId?.split(':')[0] ?? '—'],
    ['model', report.model ?? '—'],
    ['upstream', report.upstream ?? '—'],
    ['input tokens', u?.inputTokens ?? '—'],
    ['output tokens', u?.outputTokens ?? '—'],
    ['reasoning tokens', u?.reasoningTokens ?? '—'],
    ['cached input tokens', u?.cachedInputTokens ?? '—'],
    ['cost (reported)', u?.costUsd !== undefined ? `$${u.costUsd.toFixed(6)}` : '—'],
    ['latency', u?.latencyMs !== undefined ? `${u.latencyMs} ms` : '—'],
    ['first-pass valid', report.firstPassValid === undefined ? '—' : String(report.firstPassValid)],
    ['repair', report.repaired ? `yes${report.repairUsage?.costUsd !== undefined ? ` ($${report.repairUsage.costUsd.toFixed(6)})` : ''}` : 'no'],
    ['fallback', report.fallbackReason ?? 'no'],
    ['cache hit', String(report.cacheHit)],
    ['DSL bytes', report.dslBytes],
    ['compile', `${report.compileMs.toFixed(2)} ms`],
  ];
  return (
    <div className="vivi-lab-facts vivi-lab-generation">
      <div>
        <h4>{title}</h4>
        {rows.map(([k, v]) => (
          <p key={k}>
            {k}: {v}
          </p>
        ))}
        {report.firstPassErrors?.length ? <p>first-pass errors: {report.firstPassErrors.slice(0, 4).join(' · ')}</p> : null}
      </div>
    </div>
  );
}

interface LabCompiled {
  scenario: CanonicalScenario;
  dsl?: ViviExperienceDSL;
  hints?: StoryHints;
  notes: string[];
  plan?: unknown;
  report?: GenerationReport;
  story?: string;
}

export function DirectorLab({ onPlay }: { onPlay: (scenario: CanonicalScenario) => void }) {
  const [sourceKey, setSourceKey] = useState(SOURCES[0].key);
  const [customStory, setCustomStory] = useState('My partner went into the shower and a message from a stranger appeared on their phone.');
  const [customOutcome, setCustomOutcome] = useState('');
  const [compiled, setCompiled] = useState<LabCompiled | null>(null);
  const [error, setError] = useState('');
  const [t, setT] = useState(0);
  const [phase, setPhase] = useState<'live' | 'commit' | 'reveal'>('live');
  const [debug, setDebug] = useState(true);
  const [playerAt, setPlayerAt] = useState<string>('spawn');
  const [directed, setDirected] = useState<DirectedShot | null>(null);
  const [useServer, setUseServer] = useState(false);
  const [lastUi] = useState(readLastUiGeneration);

  const source = SOURCES.find(s => s.key === sourceKey)!;

  const compile = async () => {
    setError('');
    try {
      if (source.heroId) {
        const hero = heroStories.find(h => h.id === source.heroId)!;
        const scenario = compileHeroStoryToRuntime(hero);
        setCompiled({ scenario, dsl: hero.dsl?.dsl, hints: preprocessStory(hero.hook), notes: ['curated golden fixture'], story: hero.hook });
      } else {
        const story = source.key === 'custom' ? customStory : source.story!;
        const outcome = source.key === 'custom' ? customOutcome : source.outcome;
        if (useServer) {
          const res = await fetch('/api/generate-story', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: story, whatReallyHappened: outcome ?? '' }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'server compile failed');
          setCompiled({
            scenario: data.playablePost.scenario,
            dsl: data.dsl,
            hints: preprocessStory(story),
            notes: [`server: ${data.compilerReport?.source}${data.compilerReport?.fallbackReason ? ` (${data.compilerReport.fallbackReason})` : ''}`],
            plan: data.experiencePlan,
            report: data.compilerReport,
            story,
          });
        } else {
          const result = await compileViviStory({ story, actualOutcome: outcome });
          setCompiled({
            scenario: result.post.scenario,
            dsl: result.compiled.dsl,
            hints: result.hints,
            notes: result.compiled.notes,
            plan: result.compiled.plan,
            report: result.report,
            story,
          });
        }
      }
      setT(0);
      setPhase('live');
      setPlayerAt('spawn');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    if (sourceKey !== 'custom') void compile();
  }, [sourceKey]);

  const scenario = compiled?.scenario;

  const moments = useMemo(() => {
    if (!scenario) return [];
    const out: Array<{ label: string; t: number }> = [{ label: 'open', t: 0 }];
    const cue = scenario.beats.find(b => b.isCue)?.triggerPayload;
    const pressure = scenario.beats.find(b => b.isPressure)?.triggerPayload;
    for (const e of scenario.cinematic?.cameraEvents ?? []) out.push({ label: e.kind, t: e.atMs + 400 });
    if (typeof cue === 'number') out.push({ label: 'cue', t: cue + 200 });
    if (typeof pressure === 'number') out.push({ label: 'pressure', t: pressure + 600 });
    return out.sort((a, b) => a.t - b.t).filter((m, i, arr) => i === 0 || Math.abs(m.t - arr[i - 1].t) > 300);
  }, [scenario]);

  const runner = useMemo(() => {
    if (!scenario) return null;
    const r = new StoryBeatRunner(scenario.beats);
    r.checkTick(t);
    if (phase !== 'live' && scenario.actions[0]) {
      r.checkTick(Math.max(t, 60000));
      r.onObjectInspected(scenario.actions[0].targetSlot, scenario.actions[0].id, scenario.actions[0].observation);
    }
    return r;
  }, [scenario, t, phase]);

  const playerPos = useMemo<[number, number] | undefined>(() => {
    if (!scenario) return undefined;
    if (playerAt === 'spawn') return scenario.playerSpawn;
    const act = scenario.actions.find(a => a.id === playerAt);
    if (!act) return scenario.playerSpawn;
    if (act.actorId) {
      const cast = scenarioCast(scenario);
      const frame = actorFramesAt(cast.actors, cast.cues, t, { world: scenario.world, playerPos: scenario.playerSpawn, obstacles: cast.staticObstacles }).find(f => f.id === act.actorId);
      return frame ? [frame.pos[0] - 4, frame.pos[1] + 2] : scenario.playerSpawn;
    }
    return act.slotInfo.carried ? scenario.playerSpawn : [act.slotInfo.standX, act.slotInfo.standY];
  }, [scenario, playerAt, t]);

  const physical = scenario ? computePhysicalModifiers(scenario.modifiers, t, scenario.timerAnchor) : null;
  const frames = scenario
    ? (() => {
        const cast = scenarioCast(scenario);
        return actorFramesAt(cast.actors, cast.cues, t, {
          world: scenario.world,
          playerPos: playerPos ?? scenario.playerSpawn,
          obstacles: cast.staticObstacles,
          stare: physical?.stare,
        });
      })()
    : [];
  const dslText = compiled?.dsl ? serializeDSL(compiled.dsl) : '';
  const maxT = Math.max(42000, ...(scenario?.modifiers.map(m => m.atMs + 4000) ?? [0]));
  const selected: RuntimeAction | null = phase !== 'live' ? scenario?.actions[0] ?? null : null;

  return (
    <main className="vivi-lab">
      <header className="vivi-lab-head">
        <strong>DIRECTOR LAB</strong>
        <span>development only · deterministic snapshots · compiler inspector</span>
      </header>

      <section className="vivi-lab-controls">
        <label>
          Source
          <select value={sourceKey} onChange={e => setSourceKey(e.target.value)}>
            {SOURCES.map(s => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        {source.key === 'custom' && (
          <>
            <textarea value={customStory} onChange={e => setCustomStory(e.target.value)} rows={3} />
            <input value={customOutcome} onChange={e => setCustomOutcome(e.target.value)} placeholder="What really happened (optional)" />
          </>
        )}
        {!source.heroId && (
          <label className="vivi-lab-inline">
            <input type="checkbox" checked={useServer} onChange={e => setUseServer(e.target.checked)} /> compile on server (uses the
            configured model when present)
          </label>
        )}
        <div className="vivi-lab-row">
          <button onClick={() => void compile()}>Compile</button>
          {scenario && <button onClick={() => onPlay(scenario)}>Play live ▶</button>}
        </div>
        {error && <p className="vivi-lab-error">{error}</p>}
        {compiled?.report && <GenerationReportPanel report={compiled.report} title="Generation report (this compile)" />}
        {lastUi && <GenerationReportPanel report={lastUi} title="Last generation from the Create screen" />}
      </section>

      {scenario && runner && (
        <section className="vivi-lab-stage">
          <div className="vivi-lab-row vivi-lab-moments">
            {moments.map(m => (
              <button key={`${m.label}-${m.t}`} className={Math.abs(t - m.t) < 1 && phase === 'live' ? 'is-on' : ''} onClick={() => { setT(m.t); setPhase('live'); }}>
                {m.label} · {(m.t / 1000).toFixed(1)}s
              </button>
            ))}
            <button className={phase === 'commit' ? 'is-on' : ''} onClick={() => setPhase('commit')}>commit</button>
            <button className={phase === 'reveal' ? 'is-on' : ''} onClick={() => setPhase('reveal')}>reveal</button>
          </div>
          <div className="vivi-lab-row">
            <input type="range" min={0} max={maxT} step={100} value={t} onChange={e => { setT(Number(e.target.value)); setPhase('live'); }} />
            <code>{(t / 1000).toFixed(1)}s</code>
            <label className="vivi-lab-inline">
              <input type="checkbox" checked={debug} onChange={e => setDebug(e.target.checked)} /> collision & routes
            </label>
            <label className="vivi-lab-inline">
              player at
              <select value={playerAt} onChange={e => setPlayerAt(e.target.value)}>
                <option value="spawn">spawn</option>
                {scenario.actions.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.id}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="vivi-lab-engine">
            <CanonicalViviEngine
              key={`${scenario.id}-${phase}`}
              scenario={scenario}
              elapsedMs={t}
              phase={phase === 'reveal' ? 'revealed' : phase !== 'live' ? 'enacting' : 'exploring'}
              revealed={phase === 'reveal'}
              isMuted
              frozen={{ atMs: t, playerPos }}
              debug={debug}
              onDirected={setDirected}
            />
          </div>

          <div className="vivi-lab-facts">
            <div>
              <h4>Camera</h4>
              <p>
                <b>{directed?.shot}</b> — {directed?.reason}
                {directed?.slot ? ` @ ${directed.slot}` : ''}
                {directed?.locked ? ' (locked)' : ''}
              </p>
              <p>
                grammar <b>{scenario.cinematic?.cameraGrammar ?? 'authored shots'}</b> · staging {scenario.cinematic?.staging ?? '—'}
              </p>
            </div>
            <div>
              <h4>Light & sound</h4>
              <p>
                {scenario.cinematic?.lighting ?? 'world default'} · bed {String(physical?.bed ?? physical?.ambientAudioCue ?? scenario.cinematic?.bed ?? 'room_tone')}
                {physical?.lightMode ? ` · light ${physical.lightMode}` : ''}
              </p>
              <p>
                door {physical?.door.state} · phone {physical?.phone.isScreenLit ? 'lit' : 'dark'} · {physical?.timeDisplay.text || 'no readout'}
              </p>
            </div>
            <div>
              <h4>Actors</h4>
              {frames.map(f => (
                <p key={f.id}>
                  {f.id}: ({f.pos[0].toFixed(1)}, {f.pos[1].toFixed(1)}) {f.pose} {f.facing} {f.presence < 1 ? `· ${Math.round(f.presence * 100)}%` : ''}
                </p>
              ))}
              {!frames.length && <p>alone</p>}
            </div>
            <div>
              <h4>Actions</h4>
              {scenario.actions.map(a => (
                <p key={a.id}>
                  {a.id} → {a.targetSlot} · “{a.label}” / “{a.commitLabel}”
                </p>
              ))}
            </div>
            <div>
              <h4>Beat state</h4>
              <p>
                cue {String(runner.getState().cueTriggered)} · pressure {String(runner.getState().pressureTriggered)} · can commit{' '}
                {String(runner.getState().canCommit)}
              </p>
              <p>active modifiers: {physical?.activeModifiers.map(m => m.kind).join(', ') || 'none'}</p>
            </div>
          </div>
        </section>
      )}

      {compiled && (
        <section className="vivi-lab-inspector">
          <details open>
            <summary>1 · Story</summary>
            <p>{compiled.story}</p>
          </details>
          <details open>
            <summary>2 · Preprocessed hints</summary>
            <pre>{JSON.stringify(compiled.hints, (k, v) => (k === 'text' ? undefined : v), 2)}</pre>
          </details>
          <details open>
            <summary>
              3 · DSL — {new TextEncoder().encode(dslText).length} bytes · ~{estimateTokens(dslText)} tokens (estimate) · source{' '}
              {compiled.report?.source ?? scenario?.provenance?.source}
              {compiled.report?.usage?.outputTokens ? ` · actual output tokens ${compiled.report.usage.outputTokens}` : ''}
            </summary>
            <pre className="vivi-lab-dsl">{dslText}</pre>
            <pre>{compiled.dsl ? JSON.stringify(compiled.dsl, null, 1) : 'legacy scenario (no DSL)'}</pre>
          </details>
          <details open>
            <summary>4 · Compiler decisions</summary>
            <ul>
              {compiled.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </details>
          <details>
            <summary>5 · ExperiencePlan</summary>
            <pre>{JSON.stringify(compiled.plan ?? null, (k, v) => (k === 'dsl' ? '[above]' : v), 2)}</pre>
          </details>
          <details>
            <summary>6 · CanonicalScenario</summary>
            <pre>{JSON.stringify(scenario, null, 2)}</pre>
          </details>
        </section>
      )}
    </main>
  );
}

export default DirectorLab;
