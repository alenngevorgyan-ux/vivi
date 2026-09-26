import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw, Volume2 } from 'lucide-react';
import { SceneArt } from '../assets/worlds/SceneArt';
import { CharacterFigure } from '../assets/characters/CharacterFigure';
import { heroStories, type HeroAction, type HeroStory } from '../data/heroStories';
import { worldTemplates } from '../world/templates';

export function ViviPlay({ story, onExit }: { story: HeroStory; onExit: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const [position, setPosition] = useState<[number, number]>([38, 77]);
  const [selected, setSelected] = useState<HeroAction | null>(null);
  const [committed, setCommitted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [observation, setObservation] = useState('');
  const [response, setResponse] = useState('');
  const [responseSaved, setResponseSaved] = useState(false);
  const startRef = useRef(Date.now());
  const hiddenAtRef = useRef<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const update = () => { if (!document.hidden) setElapsed(Date.now() - startRef.current); };
    const onVisibility = () => {
      if (document.hidden) hiddenAtRef.current = Date.now();
      else if (hiddenAtRef.current !== null) { startRef.current += Date.now() - hiddenAtRef.current; hiddenAtRef.current = null; update(); }
    };
    const id = window.setInterval(update, 200);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);
  useEffect(() => {
    if (committed) return;
    const handler = (event: KeyboardEvent) => {
      const movement: Record<string, [number, number]> = { ArrowLeft: [-3, 0], a: [-3, 0], ArrowRight: [3, 0], d: [3, 0], ArrowUp: [0, -3], w: [0, -3], ArrowDown: [0, 3], s: [0, 3] };
      const step = movement[event.key]; if (!step) return; event.preventDefault();
      setPosition(([x,y]) => [Math.max(7, Math.min(93, x + step[0])), Math.max(50, Math.min(88, y + step[1]))]);
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [committed]);
  const cueVisible = elapsed >= story.cueAtMs;
  const pressureVisible = elapsed >= story.pressureAtMs;
  const currentModifier = [...story.modifiers].reverse().find(item => elapsed >= item.atMs);
  const world = worldTemplates[story.world];
  const anchorAlias: Record<string, string> = { phone_screen: story.world === 'apartment_night' ? 'phone_table' : story.world === 'bar_or_party' ? 'phone_area' : 'phone_screen', room: 'decision_center', hallway: 'long_sight_line', door: 'front_door', entrance: 'exit', train: 'platform_edge', bedroom: 'bedroom', director: 'director' };
  const resolveAnchor = (name: string) => world.slots.find(slot => slot.id === name || slot.id === anchorAlias[name]) || world.slots.find(slot => slot.id === 'decision_center') || { x: 50, y: 56 };
  const cuePosition = currentModifier ? resolveAnchor(currentModifier.anchor) : { x: 50, y: 56 };
  const timeSlot = resolveAnchor(story.id === 'the-message' ? 'phone_table' : story.id === '0317' ? 'intercom' : story.id === 'the-presentation' ? 'meeting_clock' : story.id === 'last-walk' ? 'bus_stop' : story.id === 'the-last-train' ? 'station_board' : story.modifiers[0]?.anchor || 'decision_center');
  const timeReadout = story.id === '0317' ? (cueVisible ? '03:17' : '03:16') : story.id === 'the-message' && cueVisible ? `LOCKS ${Math.max(0, 35 - Math.floor((elapsed - story.cueAtMs) / 1000))}s` : story.id === 'the-presentation' && pressureVisible ? `${Math.max(0, 10 - Math.floor((elapsed - story.pressureAtMs) / 1000))}s` : story.id === 'the-last-train' ? (pressureVisible ? '00:45' : cueVisible ? '00:46' : '00:47') : story.timerAnchor;
  const choose = (action: HeroAction) => { setPosition([action.x, Math.max(53, Math.min(88, action.y + (action.y < 50 ? 21 : 0)))]); setSelected(action); setObservation(action.observation); };
  const walk = (event: React.MouseEvent<HTMLDivElement>) => { if (committed) return; const bounds = stageRef.current?.getBoundingClientRect(); if (!bounds) return; const x = (event.clientX - bounds.left) / bounds.width * 100; const y = (event.clientY - bounds.top) / bounds.height * 100; if (y > 48) setPosition([Math.max(7, Math.min(93, x)), Math.max(50, Math.min(88, y))]); };
  const restart = () => { startRef.current = Date.now(); hiddenAtRef.current = document.hidden ? Date.now() : null; setElapsed(0); setPosition([38,77]); setSelected(null); setCommitted(false); setRevealed(false); setObservation(''); setResponse(''); setResponseSaved(false); };
  const selectedEnding = selected ? story.endings[selected.id] : '';
  return <main className="vivi-play">
    <header className="vivi-play-header"><button className="vivi-back" onClick={onExit}><ArrowLeft size={18}/> Feed</button><div><span className="vivi-eyebrow">YOU ARE IN SOMEONE ELSE’S STORY</span><h1>{story.title}</h1></div><button className="vivi-restart" onClick={restart} aria-label="Restart story"><RotateCcw size={18}/></button></header>
    <div className="vivi-play-layout"><section className="vivi-stage-shell"><div className="vivi-stage" ref={stageRef} onClick={walk}>
      <SceneArt world={story.world} active={cueVisible}/>
      <div className="vivi-stage-vignette"/>
      <div className="vivi-stage-caption"><span>{world.label.toUpperCase()}</span></div>
      <div className="vivi-prop-readout" style={{ left: `${timeSlot.x}%`, top: `${Math.max(11, timeSlot.y - 13)}%` }}>{timeReadout}</div>
      <div className="vivi-npc" style={{ left: `${story.world === 'hallway_night' ? 83 : story.world === 'office_night' ? 65 : 69}%`, top: `${story.world === 'office_night' ? 72 : 76}%` }}><CharacterFigure id={story.world === 'neighborhood_sunset' ? 'young_adult_masc_02' : 'adult_fem_01'} facing="left" pose={pressureVisible ? 'turn' : 'wait'} size={92}/></div>
      <div className="vivi-player" style={{ left: `${position[0]}%`, top: `${position[1]}%` }}><CharacterFigure id="young_adult_masc_01" facing={position[0] > 58 ? 'right' : 'front'} pose="idle" size={96}/></div>
      {cueVisible && !committed && story.actions.map(action => <button type="button" className={`vivi-world-action ${selected?.id === action.id ? 'selected' : ''}`} key={action.id} style={{ left: `${action.x}%`, top: `${action.y}%` }} onClick={event => { event.stopPropagation(); choose(action); }}><span className="vivi-action-dot"/><span className="vivi-action-label">{action.label}</span></button>)}
      {currentModifier && !committed && <div className="vivi-diegetic-cue" key={currentModifier.id} style={{ left: `${cuePosition.x}%`, top: `${Math.max(14, cuePosition.y - 24)}%` }}><span>{currentModifier.kind.toUpperCase()}</span>{currentModifier.payload}</div>}
      {committed && <div className="vivi-stage-freeze"><span>THE MOMENT AFTER</span><p>{selectedEnding}</p></div>}
    </div><div className="vivi-stage-under"><span><Volume2 size={15}/> Sound imagined · captions always on</span><span>CLICK TO MOVE · WASD / ARROWS</span></div></section>
    <aside className="vivi-story-panel"><div className="vivi-panel-top"><span className="vivi-eyebrow">A PLAYABLE POST · {story.duration.toUpperCase()}</span><h2>{committed ? 'You chose.' : cueVisible ? 'The moment is yours.' : 'Enter the moment.'}</h2><p className="vivi-setup">{story.setup}</p></div>
      <div className="vivi-story-beats"><div className="vivi-beat"><span>01 / SETUP</span><p>{story.openingLine}</p></div>{cueVisible && <div className="vivi-beat current"><span>02 / CUE</span><p>{story.cue}</p></div>}{pressureVisible && !committed && <div className="vivi-beat pressure"><span>03 / PRESSURE</span><p>{story.pressure}</p></div>}{observation && !committed && <div className="vivi-beat observation"><span>YOU NOTICE</span><p>{observation}</p></div>}</div>
      {!cueVisible && <p className="vivi-wait-hint">Move around the world. The situation is unfolding.</p>}
      {cueVisible && !committed && <div className="vivi-commit"><span className="vivi-eyebrow">EXPLORE THE SPACE, THEN COMMIT</span><div className="vivi-action-list">{story.actions.map(action => <button key={action.id} className={selected?.id === action.id ? 'active' : ''} onClick={() => choose(action)}>{action.label}<ArrowRight size={15}/></button>)}</div><button className="vivi-button" disabled={!selected} onClick={() => setCommitted(true)}>{selected ? selected.commit : 'Choose an action in the world'} <ArrowRight size={17}/></button></div>}
      {committed && <div className="vivi-result"><span className="vivi-eyebrow">YOUR PATH</span><p>{selectedEnding}</p>{!revealed ? <button className="vivi-button" onClick={() => setRevealed(true)}>Reveal what happened <ArrowRight size={17}/></button> : <><div className="vivi-reality"><span className="vivi-eyebrow">WHAT REALLY HAPPENED · DEMO STORY</span><p>{story.reality}</p></div><div className="vivi-compare"><span className="vivi-eyebrow">COMPARE THE PATHS</span><h3>{story.crowdQuestion}</h3><p>There are {story.actions.length} possible commitments in this situation. In a live post, consenting players’ aggregate responses would appear here after they decide.</p><div>{story.actions.filter(action => action.id !== selected?.id).map(action => <span key={action.id}>{action.commit}</span>)}</div></div><div className="vivi-respond"><span className="vivi-eyebrow">RESPOND</span><label htmlFor="vivi-response">What would you tell the author?</label><textarea id="vivi-response" value={response} onChange={event => { setResponse(event.target.value); setResponseSaved(false); }} maxLength={280} placeholder="A thought, not a verdict…"/><button disabled={!response.trim()} onClick={() => setResponseSaved(true)}>{responseSaved ? 'Saved in this session' : 'Keep this reflection'}</button><small>Demo reflections stay on this screen and are not sent.</small></div><button className="vivi-text-button" onClick={restart}>Try another path ↗</button></>}</div>}
    </aside></div>
    <footer className="vivi-play-footer"><span>ENTER → EXPERIENCE → COMMIT → REVEAL → COMPARE → RESPOND</span><span>{heroStories.findIndex(item => item.id === story.id) + 1} / {heroStories.length}</span></footer>
  </main>;
}
