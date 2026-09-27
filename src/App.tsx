import React, { useState, useEffect } from 'react';
import type { GameSpec } from './types/gameSpec';
import { SOCIAL_MEMORIES } from './data/socialMemories';
import { Navbar } from './components/Navbar';
import { ViviCreate } from './components/ViviCreate';
import { ViviFeed } from './components/ViviFeed';
import { ViviPlay } from './components/ViviPlay';
import { FeedView } from './components/FeedView';
import type { HeroStory } from './data/heroStories';

const STORAGE_KEY = 'vivi_community_stories_v1';

export default function App() {
  const [games, setGames] = useState<GameSpec[]>(() => {
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
  const [activeGame, setActiveGame] = useState<GameSpec | null>(null);
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
    setActiveGame(null);
    setActiveHero(story);
    setActiveTab('play');
  };

  const handleEnterGameSpec = (game: GameSpec) => {
    setActiveHero(null);
    setActiveGame(game);
    setActiveTab('play');
  };

  const handleCreateNew = () => {
    setActiveHero(null);
    setActiveGame(null);
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
    setActiveGame(null);
    setGameToEdit(null);
    setResponseThread({ responseToPostId, themeKey, inspirationPrompt });
    setActiveTab('create');
  };

  const handleSaveGame = (updatedGame: GameSpec) => {
    setGames((prev) => {
      const existsIndex = prev.findIndex((g) => g.id === updatedGame.id);
      if (existsIndex >= 0) {
        const copy = [...prev];
        copy[existsIndex] = updatedGame;
        return copy;
      }
      return [updatedGame, ...prev];
    });
    setActiveGame(updatedGame);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans vivi-app bg-[#f4efe7] text-[#202629]">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab !== 'play') {
            setActiveHero(null);
            setActiveGame(null);
          }
          if (tab === 'feed') setShowArchive(false);
          setActiveTab(tab);
        }}
        hasActiveGame={!!activeGame || !!activeHero}
        activeGameTitle={activeHero?.title || activeGame?.title}
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
            onEnterGameSpec={handleEnterGameSpec}
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
              games={games}
              onPlayGame={handleEnterGameSpec}
              onEditGame={(g) => {
                setGameToEdit(g);
                setActiveTab('create');
              }}
              onImportGame={(g) => {
                handleSaveGame(g);
                handleEnterGameSpec(g);
              }}
              onCreateNew={handleCreateNew}
            />
          </div>
        )}

        {/* Story Creator */}
        {activeTab === 'create' && (
          <ViviCreate
            key={gameToEdit?.id || responseThread?.responseToPostId || 'new'}
            initialGameToEdit={gameToEdit}
            initialPrompt={responseThread?.inspirationPrompt}
            responseToPostId={responseThread?.responseToPostId}
            themeKey={responseThread?.themeKey}
            onSaveGame={handleSaveGame}
            onPlayGame={handleEnterGameSpec}
            onCancelResponse={() => setResponseThread(null)}
          />
        )}

        {/* Unified Canonical Playback Engine (Used for both Hero & User Stories!) */}
        {activeTab === 'play' && (activeHero || activeGame) && (
          <ViviPlay
            key={activeHero?.id || activeGame?.id}
            story={activeHero}
            gameSpec={activeGame}
            onExit={() => {
              setActiveHero(null);
              setActiveGame(null);
              setShowArchive(false);
              setActiveTab('feed');
            }}
            onRespondWithStory={handleRespondWithStory}
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
