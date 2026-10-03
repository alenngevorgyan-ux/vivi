import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import type { GameSpec } from './types/gameSpec';
import { SOCIAL_MEMORIES } from './data/socialMemories';
import { Navbar } from './components/Navbar';
import { ViviCreate } from './components/ViviCreate';
import { ViviFeed } from './components/ViviFeed';
import { ViviPlay } from './components/ViviPlay';
import { FeedView } from './components/FeedView';
import { heroStoryById, type HeroStory } from './data/heroStories';
import {
  type StoredPlayablePost,
  isStoredPlayablePost,
} from './engine/runtime/generationPipeline';
import type { CanonicalScenario } from './engine/runtime/RuntimeCompiler';
import { experienceFixtureById } from './data/experienceFixtures';
import { compileFixture } from './data/experienceFixtures/replay';
import { loadPlayable } from './engine/v3/compat/loadPlayable';

const STORAGE_KEY = 'vivi_community_stories_v1';

/** Development-only Director Lab; compiled out of production builds. */
const DirectorLab = import.meta.env.DEV ? lazy(() => import('./components/dev/DirectorLab')) : null;

/** Development-only V3 foundation harness (`?v3=foundation`); compiled out of production builds. */
const V3Harness = import.meta.env.DEV ? lazy(() => import('./components/experience/v3/V3Harness')) : null;
const v3HarnessRequested = import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('v3') === 'foundation';

export default function App() {
  const [games, setGames] = useState<(StoredPlayablePost | GameSpec)[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch (e) {
        console.error('Error loading stored stories:', e);
      }
    }
    // Seed with initial human social memories
    return SOCIAL_MEMORIES;
  });

  // Development only: ?play=<story id> opens a story directly, for QA and screenshots.
  const devPlayId =
    import.meta.env.DEV && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('play') : null;
  const [labOpen] = useState(
    () => import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('lab')
  );
  const [activeTab, setActiveTab] = useState<'feed' | 'create' | 'play'>(() =>
    devPlayId && heroStoryById[devPlayId] ? 'play' : 'feed'
  );
  const [activeHero, setActiveHero] = useState<HeroStory | null>(() =>
    devPlayId && heroStoryById[devPlayId] ? heroStoryById[devPlayId] : null
  );
  const [activeScenario, setActiveScenario] = useState<CanonicalScenario | null>(null);
  const [activePost, setActivePost] = useState<StoredPlayablePost | null>(null);
  const [activeLegacyGame, setActiveLegacyGame] = useState<GameSpec | null>(null);
  const [postToEdit, setPostToEdit] = useState<StoredPlayablePost | null>(null);
  const [gameToEdit, setGameToEdit] = useState<GameSpec | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  // "Со мной было так же" response thread state
  const [responseThread, setResponseThread] = useState<{
    responseToPostId: string;
    themeKey: string;
    inspirationPrompt: string;
  } | null>(null);

  // Sync custom community games to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }, [games]);

  const handleEnterHero = (story: HeroStory) => {
    setActiveScenario(null);
    setActivePost(null);
    setActiveLegacyGame(null);
    setActiveHero(story);
    setActiveTab('play');
  };

  const handleEnterPost = (post: StoredPlayablePost | GameSpec) => {
    // One discriminated loader decides the player. V1/V2 posts and legacy GameSpecs take exactly the path
    // they always did; a V3 post or an unknown/future schema is never handed to the legacy player.
    const loaded = loadPlayable(post);
    if (loaded.kind === 'v3' || loaded.kind === 'invalid_v3' || loaded.kind === 'unsupported') {
      // The V3 player is mounted by a later integration; until then refuse safely rather than misread it.
      console.warn(`Vivi: cannot open this post here (${loaded.kind}).`);
      return;
    }
    setActiveHero(null);
    if (loaded.kind === 'legacy_stored_post') {
      setActiveLegacyGame(null);
      setActiveScenario(loaded.post.scenario);
      setActivePost(loaded.post);
    } else {
      setActiveScenario(null);
      setActivePost(null);
      setActiveLegacyGame(loaded.game);
    }
    setActiveTab('play');
  };

  /** Editorial QA fixtures play through the same pipeline and runtime as any generated post. */
  const handleEnterFixture = (fixtureId: string) => {
    const fixture = experienceFixtureById[fixtureId];
    if (!fixture) return;
    compileFixture(fixture).then(result => handleEnterPost(result.post));
  };

  // Development only: ?play=<editorial fixture id> opens it directly, for QA and screenshots.
  useEffect(() => {
    if (devPlayId && experienceFixtureById[devPlayId]) handleEnterFixture(devPlayId);
  }, []);

  /** A story told in reply to this one, or the one this replies to — only real links, never a guess. */
  const relatedFor = (id: string | undefined) => {
    if (!id) return null;
    const posts = games.filter(isStoredPlayablePost);
    const current = posts.find(p => p.id === id);
    const found = posts.find(p => p.responseToPostId === id) ?? (current?.responseToPostId ? posts.find(p => p.id === current.responseToPostId) : undefined);
    return found ? { id: found.id, title: found.title, synopsis: found.synopsis } : null;
  };

  const handleCreateNew = () => {
    setActiveHero(null);
    setActiveScenario(null);
    setActiveLegacyGame(null);
    setPostToEdit(null);
    setGameToEdit(null);
    setResponseThread(null);
    setActiveTab('create');
  };

  const handleRespondWithStory = (
    responseToPostId: string,
    themeKey: string,
    inspirationPrompt: string
  ) => {
    setActiveHero(null);
    setActiveScenario(null);
    setActiveLegacyGame(null);
    setPostToEdit(null);
    setGameToEdit(null);
    setResponseThread({ responseToPostId, themeKey, inspirationPrompt });
    setActiveTab('create');
  };

  const handleSavePost = (updatedItem: StoredPlayablePost | GameSpec) => {
    setGames((prev) => {
      const existsIndex = prev.findIndex((g) => g.id === updatedItem.id);
      if (existsIndex >= 0) {
        const copy = [...prev];
        copy[existsIndex] = updatedItem;
        return copy;
      }
      return [updatedItem, ...prev];
    });
    if (isStoredPlayablePost(updatedItem)) {
      setActiveScenario(updatedItem.scenario);
      setActivePost(updatedItem);
      setActiveLegacyGame(null);
    } else {
      setActiveLegacyGame(updatedItem);
      setActiveScenario(null);
    }
  };

  const legacyGamesForStudio: GameSpec[] = useMemo(() => {
    return games.map((g) => (isStoredPlayablePost(g) ? g.legacyGameSpec : g));
  }, [games]);

  if (V3Harness && v3HarnessRequested) {
    return (
      <Suspense fallback={null}>
        <V3Harness />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans vivi-app bg-[#f4efe7] text-[#202629]">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab !== 'play') {
            setActiveHero(null);
            setActiveScenario(null);
            setActiveLegacyGame(null);
          }
          if (tab === 'feed') setShowArchive(false);
          setActiveTab(tab);
        }}
        hasActiveGame={!!activeHero || !!activeScenario || !!activeLegacyGame}
        activeGameTitle={activeHero?.title || activeScenario?.title || activeLegacyGame?.title}
        isAudioMuted={isAudioMuted}
        setIsAudioMuted={setIsAudioMuted}
      />

      {/* Main View Area */}
      <div className="flex-1 w-full">
        {DirectorLab && labOpen && activeTab !== 'play' && (
          <Suspense fallback={null}>
            <DirectorLab
              onPlay={scenario => {
                setActiveHero(null);
                setActiveLegacyGame(null);
                setActiveScenario(scenario);
                setActiveTab('play');
              }}
            />
          </Suspense>
        )}

        {/* Main Feed View */}
        {activeTab === 'feed' && !showArchive && !labOpen && (
          <ViviFeed
            customGames={games}
            onEnterFixture={handleEnterFixture}
            onEnter={handleEnterHero}
            onEnterGameSpec={handleEnterPost}
            onCreate={handleCreateNew}
            onArchive={() => setShowArchive(true)}
          />
        )}

        {/* Developer Studio Archive view (if requested) */}
        {activeTab === 'feed' && showArchive && (
          <div className="max-w-6xl mx-auto p-6">
            <button
              onClick={() => setShowArchive(false)}
              className="text-stone-600 hover:text-stone-900 text-xs mb-4 flex items-center gap-1"
            >
              ← Назад в ленту Vivi
            </button>
            <FeedView
              games={legacyGamesForStudio}
              onPlayGame={(g) => {
                const found = games.find((item) => item.id === g.id);
                handleEnterPost(found || g);
              }}
              onEditGame={(g) => {
                const found = games.find((item) => item.id === g.id);
                if (found && isStoredPlayablePost(found)) {
                  setPostToEdit(found);
                  setGameToEdit(null);
                } else {
                  setGameToEdit(g);
                  setPostToEdit(null);
                }
                setActiveTab('create');
              }}
              onImportGame={(g) => {
                handleSavePost(g);
                handleEnterPost(g);
              }}
              onCreateNew={handleCreateNew}
            />
          </div>
        )}

        {/* Story Creator */}
        {activeTab === 'create' && (
          <ViviCreate
            key={postToEdit?.id || gameToEdit?.id || responseThread?.responseToPostId || 'new'}
            initialGameToEdit={gameToEdit}
            initialPostToEdit={postToEdit}
            initialPrompt={responseThread?.inspirationPrompt}
            responseToPostId={responseThread?.responseToPostId}
            themeKey={responseThread?.themeKey}
            onSavePost={handleSavePost}
            onPlayPost={handleEnterPost}
            onCancelResponse={() => setResponseThread(null)}
          />
        )}

        {/* Unified Canonical Playback Engine (Used for both Hero & User Stories!) */}
        {activeTab === 'play' && (activeHero || activeScenario || activeLegacyGame) && (
          <ViviPlay
            key={activeHero?.id || activeScenario?.id || activeLegacyGame?.id}
            story={activeHero}
            scenario={activeScenario}
            post={activePost}
            related={relatedFor(activeScenario?.id)}
            onOpenRelated={id => {
              const found = games.find(g => g.id === id);
              if (found) handleEnterPost(found);
            }}
            gameSpec={activeLegacyGame}
            onExit={() => {
              setActiveHero(null);
              setActiveScenario(null);
              setActiveLegacyGame(null);
              setShowArchive(false);
              setActiveTab('feed');
            }}
            onRespondWithStory={handleRespondWithStory}
            isMuted={isAudioMuted}
          />
        )}
      </div>

      {/* Footer */}
      <footer className="vivi-site-footer">
        <p>VIVI · STORIES YOU CAN ENTER</p>
      </footer>
    </div>
  );
}
