import React, { useState, useMemo } from 'react';
import {
  ArrowUpRight,
  Search,
  SlidersHorizontal,
  Heart,
  Bookmark,
  Sparkles,
  Users,
  Compass,
  CheckCircle2,
} from 'lucide-react';
import { heroStories, type HeroStory } from '../data/heroStories';
import type { GameSpec } from '../types/gameSpec';
import { type StoredPlayablePost, isStoredPlayablePost } from '../engine/runtime/generationPipeline';
import { SceneArt } from '../assets/worlds/SceneArt';
import { worldTemplates, type ViviWorldId } from '../world/templates';
import { EXPERIENCE_FIXTURES } from '../data/experienceFixtures';
import { SOCIAL_MEMORIES } from '../data/socialMemories';

const FIXTURE_WORLD: Record<string, ViviWorldId> = { apartment: 'apartment_night', office: 'office_night', night_hallway: 'hallway_night' };
const SEED_IDS = new Set(SOCIAL_MEMORIES.map(m => m.id));
const FORMAT_LABEL: Record<string, string> = { playable: 'СИТУАЦИЯ', illustrated_memory: 'ВОСПОМИНАНИЕ', text_story: 'ТЕКСТ' };

/**
 * Seeded legacy stories still name pre-V2 environments. SceneArt only knows
 * the current worlds, so map those to their closest current room instead of
 * crashing the whole feed.
 */
const LEGACY_WORLDS: Record<string, ViviWorldId> = { village_sunset: 'neighborhood_sunset', city_evening: 'city_rain' };
const cardWorld = (id: string | undefined): ViviWorldId =>
  id && id in worldTemplates ? (id as ViviWorldId) : (id && LEGACY_WORLDS[id]) || 'apartment_night';

const categories = [
  'All',
  'Relationship',
  'Creepy',
  'Social',
  'Work',
  'Money',
  'Family',
  'Moral',
  'Romance',
  'Memory',
];

interface ViviFeedProps {
  customGames?: (StoredPlayablePost | GameSpec)[];
  /** Editorial QA fixtures (fictional), compiled through the production pipeline on open. */
  onEnterFixture?: (id: string) => void;
  onEnter: (story: HeroStory) => void;
  onEnterGameSpec: (game: StoredPlayablePost | GameSpec) => void;
  onCreate: () => void;
  onArchive: () => void;
}

export function ViviFeed({
  customGames = [],
  onEnterFixture,
  onEnter,
  onEnterGameSpec,
  onCreate,
  onArchive,
}: ViviFeedProps) {
  const [feedTab, setFeedTab] = useState<'curated' | 'community' | 'my_decisions'>('curated');
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');

  // Local user decisions & bookmarks
  const myDecisions = useMemo<Record<string, { choiceId: string; commitLabel: string; timestamp: number }>>(() => {
    try {
      return JSON.parse(localStorage.getItem('vivi_my_decisions') || '{}');
    } catch {
      return {};
    }
  }, []);

  const bookmarkedIds = useMemo<Set<string>>(() => {
    const ids = new Set<string>();
    if (typeof window === 'undefined') return ids;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('vivi_bookmarked_') && localStorage.getItem(key) === 'true') {
        ids.add(key.replace('vivi_bookmarked_', ''));
      }
    }
    return ids;
  }, []);

  // Filter curated stories
  const filteredHeroStories = useMemo(() => {
    return heroStories.filter(story => {
      const matchCat = category === 'All' || story.pillar.toLowerCase() === category.toLowerCase();
      const matchQuery = `${story.title} ${story.hook} ${story.author}`.toLowerCase().includes(query.toLowerCase());
      if (feedTab === 'my_decisions') {
        return (myDecisions[story.id] || bookmarkedIds.has(story.id)) && matchQuery;
      }
      return matchCat && matchQuery;
    });
  }, [category, query, feedTab, myDecisions, bookmarkedIds]);

  // Filter community/custom stories
  const filteredCommunityStories = useMemo(() => {
    return customGames.filter(game => {
      const isPost = isStoredPlayablePost(game);
      const title = game.title || '';
      const synopsis = isPost ? game.synopsis : (game.synopsis || game.description || '');
      const author = isPost ? game.authorHandle : (game.author || '');
      const matchQuery = `${title} ${synopsis} ${author}`.toLowerCase().includes(query.toLowerCase());
      if (feedTab === 'my_decisions') {
        return (myDecisions[game.id] || bookmarkedIds.has(game.id)) && matchQuery;
      }
      return matchQuery;
    });
  }, [customGames, query, feedTab, myDecisions, bookmarkedIds]);

  const featured = heroStories[0];

  return (
    <main className="vivi-feed">
      {/* Intro section */}
      <section className="vivi-feed-intro">
        <div className="vivi-eyebrow">
          <span className="vivi-signal" /> THE FEED · STORIES YOU CAN ENTER
        </div>
        <div className="vivi-intro-row">
          <h1>
            Чужие жизни.<br />
            <em>Ваш следующий шаг.</em>
          </h1>
          <p>
            Человеческие ситуации, воссозданные как крошечные миры. Войдите внутрь, сделайте свой выбор — и узнайте, как поступил автор.
          </p>
        </div>
      </section>

      {/* Editorial Experience V2 episodes: fictional, labelled, played through the production pipeline. */}
      {feedTab === 'curated' && onEnterFixture && (
        <section className="vivi-editorial" aria-label="Редакционные эпизоды">
          <div className="vivi-editorial-head">
            <span className="vivi-eyebrow">РЕДАКЦИОННЫЕ ЭПИЗОДЫ · EXPERIENCE V2</span>
            <p>Вымышленные истории, написанные командой Vivi для проверки опыта. Это не посты настоящих людей.</p>
          </div>
          <div className="vivi-editorial-grid">
            {EXPERIENCE_FIXTURES.map(f => (
              <button key={f.id} type="button" className="vivi-editorial-card" onClick={() => onEnterFixture(f.id)}>
                <div className="vivi-editorial-art" aria-hidden="true">
                  <SceneArt world={FIXTURE_WORLD[f.world]} active />
                </div>
                <span className="vivi-eyebrow">
                  {FORMAT_LABEL[f.expectedFormat]} · {f.lang.toUpperCase()}
                </span>
                <strong>{f.title}</strong>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Featured Experience */}
      {feedTab === 'curated' && (
        <section className="vivi-feature" aria-label="Featured experience">
          <div className="vivi-feature-art">
            <SceneArt world={featured.world} active />
          </div>
          <div className="vivi-feature-content">
            <div className="vivi-eyebrow">01 / ГЛАВНАЯ СИТУАЦИЯ · 3 МИН</div>
            <h2>{featured.title}</h2>
            <p>{featured.hook}</p>
            <button className="vivi-button" onClick={() => onEnter(featured)}>
              Войти в эту историю <ArrowUpRight size={18} />
            </button>
          </div>
          <span className="vivi-feature-index">V / 01</span>
        </section>
      )}

      {/* Social Feed Navigation Tabs */}
      <div className="flex items-center gap-3 mt-10 border-b border-stone-300 pb-3 overflow-x-auto">
        <button
          onClick={() => setFeedTab('curated')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
            feedTab === 'curated'
              ? 'bg-stone-900 text-stone-100 shadow-sm'
              : 'text-stone-600 hover:bg-stone-200'
          }`}
        >
          <Compass size={14} />
          <span>Избранные ситуации ({heroStories.length})</span>
        </button>

        <button
          onClick={() => setFeedTab('community')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
            feedTab === 'community'
              ? 'bg-stone-900 text-stone-100 shadow-sm'
              : 'text-stone-600 hover:bg-stone-200'
          }`}
        >
          <Users size={14} />
          <span>Истории сообщества ({customGames.length})</span>
        </button>

        <button
          onClick={() => setFeedTab('my_decisions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
            feedTab === 'my_decisions'
              ? 'bg-stone-900 text-stone-100 shadow-sm'
              : 'text-stone-600 hover:bg-stone-200'
          }`}
        >
          <CheckCircle2 size={14} />
          <span>Мои решения и закладки ({Object.keys(myDecisions).length + bookmarkedIds.size})</span>
        </button>
      </div>

      {/* Toolbar: Category Filters & Search */}
      <div className="vivi-feed-toolbar">
        <div>
          <span className="vivi-eyebrow">ИССЛЕДОВАНИЕ СИТУАЦИЙ</span>
          <h2>Что бы вы сделали?</h2>
        </div>
        <div className="vivi-search">
          <Search size={18} />
          <input
            aria-label="Search stories"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по ситуации, автору или теме…"
          />
        </div>
      </div>

      {feedTab === 'curated' && (
        <div className="vivi-filter-row" aria-label="Story categories">
          <SlidersHorizontal size={16} />
          {categories.map((item) => (
            <button
              key={item}
              className={category === item ? 'active' : ''}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
      )}

      {/* Grid of Playable Situations */}
      <section className="vivi-story-grid" aria-label="Playable stories">
        {/* Curated flagships */}
        {(feedTab === 'curated' || feedTab === 'my_decisions') &&
          filteredHeroStories.map((story, index) => {
            const decision = myDecisions[story.id];
            const isSaved = bookmarkedIds.has(story.id);

            return (
              <div
                className="vivi-story-card cursor-pointer group flex flex-col"
                key={story.id}
                onClick={() => onEnter(story)}
                aria-label={`Enter ${story.title}`}
              >
                <div className="vivi-card-art relative">
                  <SceneArt world={story.world} active={index % 2 === 0} />
                  <span className="vivi-card-number">{String(index + 1).padStart(2, '0')}</span>

                  {decision && (
                    <span className="absolute left-3 top-3 px-2 py-0.5 rounded bg-amber-600 text-white font-mono text-[9px] font-bold">
                      ВЫБОР: {decision.commitLabel.slice(0, 18)}…
                    </span>
                  )}

                  {isSaved && (
                    <span className="absolute right-12 top-3 p-1 rounded bg-black/60 text-amber-300">
                      <Bookmark size={12} className="fill-amber-400 text-amber-400" />
                    </span>
                  )}
                </div>

                <div className="vivi-card-copy flex-1 flex flex-col justify-between p-5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="vivi-eyebrow">
                        {story.pillar.replace('_', ' ').toUpperCase()} · {story.duration.toUpperCase()}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-stone-200 text-stone-700 text-[9px] font-mono">
                        ДЕМО
                      </span>
                    </div>

                    <h3 className="group-hover:text-amber-800 transition-colors">{story.title}</h3>
                    <p className="line-clamp-2">{story.hook}</p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-stone-200 mt-auto">
                    <span className="text-[11px] text-stone-500 font-mono">
                      {story.author.includes('Alex') ? '@alex_k' : '@anonymous'}
                    </span>
                    <span className="vivi-card-enter">
                      ВОЙТИ В ИСТОРИЮ <ArrowUpRight size={15} />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

        {/* Community / User-created stories */}
        {(feedTab === 'community' || feedTab === 'my_decisions') &&
          filteredCommunityStories.map((game, index) => {
            const isPost = isStoredPlayablePost(game);
            const decision = myDecisions[game.id];
            const isSaved = bookmarkedIds.has(game.id);
            const worldTemplate = cardWorld(isPost ? game.world : game.nodes[game.startNodeId]?.worldConfig?.template);
            const genre = isPost ? (game.pillar || game.themeKey || 'COMMUNITY') : (game.genre || 'COMMUNITY');
            const author = isPost ? game.authorHandle : `@${game.author ? game.author.toLowerCase().replace(/\s+/g, '_') : 'creator'}`;
            const synopsis = isPost ? game.synopsis : (game.synopsis || game.description);

            return (
              <div
                className="vivi-story-card cursor-pointer group flex flex-col"
                key={game.id}
                onClick={() => onEnterGameSpec(game)}
                aria-label={`Enter ${game.title}`}
              >
                <div className="vivi-card-art relative">
                  <SceneArt
                    world={worldTemplate}
                    active
                  />
                  <span className="vivi-card-number">C / {String(index + 1).padStart(2, '0')}</span>

                  {decision && (
                    <span className="absolute left-3 top-3 px-2 py-0.5 rounded bg-amber-600 text-white font-mono text-[9px] font-bold">
                      ВЫБОР СДЕЛАН
                    </span>
                  )}

                  {isSaved && (
                    <span className="absolute right-12 top-3 p-1 rounded bg-black/60 text-amber-300">
                      <Bookmark size={12} className="fill-amber-400 text-amber-400" />
                    </span>
                  )}
                </div>

                <div className="vivi-card-copy flex-1 flex flex-col justify-between p-5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="vivi-eyebrow">
                        {genre.toUpperCase()} · 3 MIN
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-stone-200 text-stone-700 text-[9px] font-mono">
                        {SEED_IDS.has(game.id) ? 'ПРИМЕР' : isPost && game.format ? FORMAT_LABEL[game.format] : 'ВАША ИСТОРИЯ'}
                      </span>
                    </div>

                    <h3 className="group-hover:text-amber-800 transition-colors">{game.title}</h3>
                    <p className="line-clamp-2">{synopsis}</p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-stone-200 mt-auto">
                    <span className="text-[11px] text-stone-500 font-mono">
                      {author}
                    </span>
                    <span className="vivi-card-enter">
                      ВОЙТИ В ИСТОРИЮ <ArrowUpRight size={15} />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
      </section>

      {/* Empty State */}
      {filteredHeroStories.length === 0 && filteredCommunityStories.length === 0 && (
        <div className="vivi-empty py-16 text-center">
          <p className="text-base text-stone-600">В этой категории пока нет подходящих ситуаций.</p>
        </div>
      )}

      {/* CTA Bottom Banner */}
      <div className="vivi-feed-end">
        <div>
          <span className="vivi-eyebrow">ВАШ ЧЕРЕД</span>
          <h2>С вами произошло нечто подобное?</h2>
          <p>Расскажите Vivi вашу ситуацию. Дайте другим возможность прожить ее и проверить свои инстинкты.</p>
        </div>
        <button className="vivi-button" onClick={onCreate}>
          <Sparkles size={17} />
          <span>Создать историю</span>
          <ArrowUpRight size={18} />
        </button>
      </div>

      <button className="vivi-archive-link text-stone-400 hover:text-stone-600 text-xs block mx-auto mt-8" onClick={onArchive}>
        Открыть студийный архив прототипов →
      </button>
    </main>
  );
}
