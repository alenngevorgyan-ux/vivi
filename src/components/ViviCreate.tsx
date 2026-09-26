import React, { useState } from 'react';
import { ArrowRight, ArrowUpRight, Sparkles } from 'lucide-react';
import type { GameSpec } from '../types/gameSpec';
import { CreateView } from './CreateView';

const prompts = [
  { title: 'The message', text: 'My partner went to shower. Their phone lit up with a message I could not unsee.' },
  { title: 'The meeting', text: 'A coworker presented my work as theirs. The director asked whether anyone had comments.' },
  { title: 'The doorway', text: 'For four nights the intercom rang at exactly the same time. Then the door handle moved.' },
];
export function ViviCreate({ initialGameToEdit, onSaveGame, onPlayGame }: { initialGameToEdit?: GameSpec | null; onSaveGame: (game: GameSpec) => void; onPlayGame: (game: GameSpec) => void }) {
  const [advanced, setAdvanced] = useState(false);
  const [story, setStory] = useState(initialGameToEdit?.description || '');
  const [reality, setReality] = useState(initialGameToEdit?.whatReallyHappened || '');
  const [author, setAuthor] = useState(initialGameToEdit?.author || 'Anonymous');
  const [pillar, setPillar] = useState('Relationships');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState<GameSpec | null>(initialGameToEdit || null);
  const generate = async () => {
    if (!story.trim()) return;
    setGenerating(true); setError('');
    try {
      const response = await fetch('/api/generate-story', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: story, whatReallyHappened: reality, genre: pillar, author: author || 'Anonymous' }) });
      const data = await response.json();
      if (!response.ok || !data.gameSpec) throw new Error(data.error || 'Vivi could not build this world.');
      setGenerated(data.gameSpec); onSaveGame(data.gameSpec);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.'); }
    finally { setGenerating(false); }
  };
  if (advanced) return <div className="vivi-create-advanced"><button onClick={() => setAdvanced(false)}>← Back to simple creator</button><CreateView initialGameToEdit={generated || initialGameToEdit} onSaveGame={onSaveGame} onPlayGame={onPlayGame}/></div>;
  return <main className="vivi-create"><div className="vivi-create-heading"><span className="vivi-eyebrow">CREATE A PLAYABLE POST</span><h1>Something happened<br/><em>to you.</em></h1><p>Tell Vivi the situation in your own words. We’ll turn it into a small world someone else can enter.</p></div>
    <div className="vivi-create-grid"><section className="vivi-create-form"><div className="vivi-create-step"><span>01 / THE SITUATION</span><h2>What happened?</h2><p>Describe the place, people, tension and the moment someone had to act.</p><textarea value={story} onChange={event => setStory(event.target.value)} rows={6} placeholder="I was in the meeting room when my coworker showed the director a slide I had made…"/></div>
      <div className="vivi-create-step"><span>02 / THE REVEAL</span><h2>What did you do?</h2><p>Only players who commit will see this part. You can edit it before publishing.</p><textarea value={reality} onChange={event => setReality(event.target.value)} rows={4} placeholder="I waited until after the meeting, then sent the original files to the director…"/></div>
      <div className="vivi-create-fields"><label>Story category<select value={pillar} onChange={event => setPillar(event.target.value)}>{['Relationships','Creepy','Social disaster','Work','Money','Family','Strange moments','Moral dilemma','Romance','Life turning point','Memory'].map(value => <option key={value}>{value}</option>)}</select></label><label>Byline<input value={author} onChange={event => setAuthor(event.target.value)} placeholder="Anonymous"/></label></div>
      {error && <p className="vivi-create-error" role="alert">{error}</p>}
      <button className="vivi-button vivi-create-submit" onClick={generate} disabled={generating || !story.trim()}><Sparkles size={17}/>{generating ? 'Building your world…' : 'Build my playable story'}<ArrowRight size={17}/></button>
      {generated && <div className="vivi-create-result"><span className="vivi-eyebrow">WORLD READY · PRIVATE PREVIEW</span><h3>{generated.title}</h3><p>{generated.synopsis}</p><button onClick={() => onPlayGame(generated)}>Enter preview <ArrowUpRight size={16}/></button></div>}
    </section><aside className="vivi-create-aside"><div><span className="vivi-eyebrow">START WITH A MOMENT</span><h2>Not a game pitch.<br/>A human situation.</h2><p>Where were you? What changed? What did you have to decide? Vivi supplies the world and staging.</p></div><div className="vivi-inspiration"><span className="vivi-eyebrow">TRY AN EXAMPLE</span>{prompts.map(prompt => <button key={prompt.title} onClick={() => setStory(prompt.text)}><strong>{prompt.title}</strong><span>{prompt.text}</span><ArrowUpRight size={16}/></button>)}</div><button className="vivi-advanced-link" onClick={() => setAdvanced(true)}>Open advanced story studio ↗</button></aside></div>
  </main>;
}
