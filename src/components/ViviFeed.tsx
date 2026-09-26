import React, { useState } from 'react';
import { ArrowUpRight, Search, SlidersHorizontal } from 'lucide-react';
import { heroStories, type HeroStory } from '../data/heroStories';
import { SceneArt } from '../assets/worlds/SceneArt';

const categories = ['All', 'Relationship', 'Creepy', 'Social', 'Work', 'Money', 'Family', 'Moral', 'Romance', 'Memory'];
export function ViviFeed({ onEnter, onCreate, onArchive }: { onEnter: (story: HeroStory) => void; onCreate: () => void; onArchive: () => void }) {
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const stories = heroStories.filter(story => (category === 'All' || story.pillar === category.toLowerCase()) && `${story.title} ${story.hook}`.toLowerCase().includes(query.toLowerCase()));
  const featured = heroStories[0];
  return <main className="vivi-feed">
    <section className="vivi-feed-intro">
      <div className="vivi-eyebrow"><span className="vivi-signal" /> THE FEED · STORIES YOU CAN ENTER</div>
      <div className="vivi-intro-row"><h1>Other people’s lives.<br/><em>Your next move.</em></h1><p>Real human situations, rebuilt as tiny worlds. Step inside. Decide what you would do. Then see what happened.</p></div>
    </section>
    <section className="vivi-feature" aria-label="Featured experience">
      <div className="vivi-feature-art"><SceneArt world={featured.world} active /></div>
      <div className="vivi-feature-content"><div className="vivi-eyebrow">01 / FEATURED SITUATION · 3 MIN</div><h2>{featured.title}</h2><p>{featured.hook}</p><button className="vivi-button" onClick={() => onEnter(featured)}>Enter this story <ArrowUpRight size={18}/></button></div>
      <span className="vivi-feature-index">V / 01</span>
    </section>
    <div className="vivi-feed-toolbar"><div><span className="vivi-eyebrow">EXPLORE SITUATIONS</span><h2>What would you do?</h2></div><div className="vivi-search"><Search size={18}/><input aria-label="Search stories" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search a situation"/></div></div>
    <div className="vivi-filter-row" aria-label="Story categories"><SlidersHorizontal size={16}/>{categories.map(item => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div>
    <section className="vivi-story-grid" aria-label="Playable stories">{stories.map((story, index) => <button className="vivi-story-card" key={story.id} onClick={() => onEnter(story)} aria-label={`Enter ${story.title}`}>
      <div className="vivi-card-art"><SceneArt world={story.world} active={index % 2 === 0}/><span className="vivi-card-number">{String(index + 1).padStart(2, '0')}</span></div>
      <div className="vivi-card-copy"><span className="vivi-eyebrow">{story.pillar.replace('_', ' ').toUpperCase()} · {story.duration.toUpperCase()}</span><h3>{story.title}</h3><p>{story.hook}</p><span className="vivi-card-enter">ENTER STORY <ArrowUpRight size={16}/></span></div>
    </button>)}</section>
    {stories.length === 0 && <p className="vivi-empty">No situations match that search.</p>}
    <div className="vivi-feed-end"><div><span className="vivi-eyebrow">YOUR TURN</span><h2>Something happened to you?</h2><p>Tell Vivi the situation. Give someone else the chance to enter it.</p></div><button className="vivi-button" onClick={onCreate}>Create a story <ArrowUpRight size={18}/></button></div>
    <button className="vivi-archive-link" onClick={onArchive}>Explore the original story archive →</button>
  </main>;
}
