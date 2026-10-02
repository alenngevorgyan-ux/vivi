import React, { useState, useEffect, useMemo } from 'react';
import type { GameSpec } from './types/gameSpec';
import { SOCIAL_MEMORIES } from './data/socialMemories';
import { Navbar } from './components/Navbar';
import { ViviCreate } from './components/ViviCreate';
import { ViviFeed } from './components/ViviFeed';
import { ViviPlay } from './components/ViviPlay';
import { FeedView } from './components/FeedView';
import type { HeroStory } from './data/heroStories';
import {
  type StoredPlayablePost,
  isStoredPlayablePost,
} from './engine/runtime/generationPipeline';
import type { CanonicalScenario } from './engine/runtime/RuntimeCompiler';

const STORAGE_KEY = 'vivi_community_stories_v1';

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

  const [activeTab, setActiveTab] = useState<'feed' | 'create' | 'play'>('feed');
  const [activeHero, setActiveHero] = useState<HeroStory | null>(null);
  const [activeScenario, setActiveScenario] = useState<CanonicalScenario | null>(null);
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
    setActiveLegacyGame(null);
    setActiveHero(story);
    setActiveTab('play');
  };

  const handleEnterPost = (post: StoredPlayablePost | GameSpec) => {
    setActiveHero(null);
    if (isStoredPlayablePost(post)) {
      setActiveLegacyGame(null);
      setActiveScenario(post.scenario);
    } else {
      setActiveScenario(null);
      setActiveLegacyGame(post);
    }
    setActiveTab('play');
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
      setActiveLegacyGame(null);
    } else {
      setActiveLegacyGame(updatedItem);
      setActiveScenario(null);
    }
  };

  const legacyGamesForStudio: GameSpec[] = useMemo(() => {
    return games.map((g) => (isStoredPlayablePost(g) ? g.legacyGameSpec : g));
  }, [games]);

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
        {/* Main Feed View */}
        {activeTab === 'feed' && !showArchive && (
          <ViviFeed
            customGames={games}
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
