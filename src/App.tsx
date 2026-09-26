/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { GameSpec } from './types/gameSpec';
import { SOCIAL_MEMORIES } from './data/socialMemories';
import { DEFAULT_GAMES } from './data/defaultGames';
import { Navbar } from './components/Navbar';
import { FeedView } from './components/FeedView';
import { ViviCreate } from './components/ViviCreate';
import { PlaySceneSwitcher } from './components/PlaySceneSwitcher';
import { sounds } from './utils/soundEffects';
import { ViviFeed } from './components/ViviFeed';
import { ViviPlay } from './components/ViviPlay';
import { HeroStory } from './data/heroStories';

const STORAGE_KEY = 'mythos_human_memories_v2';

export default function App() {
  const [games, setGames] = useState<GameSpec[]>(() => {
    // Initial stories are the human social memories first, then classic sci-fi/fantasy
    const allInit = [...SOCIAL_MEMORIES, ...DEFAULT_GAMES];
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Merge in new social memories if not already present
            const existingIds = new Set(parsed.map((p) => p.id));
            const missing = SOCIAL_MEMORIES.filter((m) => !existingIds.has(m.id));
            return [...missing, ...parsed];
          }
        }
      } catch (e) {
        console.error('Error loading stored memories:', e);
      }
    }
    return allInit;
  });

  const [activeTab, setActiveTab] = useState<'feed' | 'create' | 'play'>('feed');
  const [activeHero, setActiveHero] = useState<HeroStory | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [activeGame, setActiveGame] = useState<GameSpec | null>(null);
  const [gameToEdit, setGameToEdit] = useState<GameSpec | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  // Sync games to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }, [games]);

  const handlePlayGame = (game: GameSpec) => {
    setActiveHero(null);
    setActiveGame(game);
    setActiveTab('play');
  };

  const handleEditGame = (game: GameSpec) => {
    setGameToEdit(game);
    setActiveTab('create');
  };

  const handleCreateNew = () => {
    setActiveHero(null);
    setGameToEdit(null);
    setActiveTab('create');
  };

  const handleSaveGame = (updatedGame: GameSpec) => {
    sounds.playHeal();
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

  const handleImportGame = (importedGame: GameSpec) => {
    handleSaveGame(importedGame);
    handlePlayGame(importedGame);
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans ${(activeTab === 'feed' && !showArchive) || activeTab === 'create' || activeHero ? 'vivi-app' : 'bg-slate-950 text-slate-100'}`}>
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => { if (tab !== 'play') setActiveHero(null); if (tab === 'feed') setShowArchive(false); setActiveTab(tab); }}
        hasActiveGame={!!activeGame || !!activeHero}
        activeGameTitle={activeHero?.title || activeGame?.title}
        isAudioMuted={isAudioMuted}
        setIsAudioMuted={setIsAudioMuted}
      />

      <div className="flex-1 w-full">
        {activeTab === 'feed' && !showArchive && <ViviFeed onEnter={(story) => { setActiveHero(story); setActiveTab('play'); }} onCreate={handleCreateNew} onArchive={() => setShowArchive(true)} />}
        {activeTab === 'feed' && showArchive && (
          <FeedView
            games={games}
            onPlayGame={handlePlayGame}
            onEditGame={handleEditGame}
            onImportGame={handleImportGame}
            onCreateNew={handleCreateNew}
          />
        )}

        {activeTab === 'create' && (
          <ViviCreate
            key={gameToEdit?.id || 'new'}
            initialGameToEdit={gameToEdit}
            onSaveGame={handleSaveGame}
            onPlayGame={handlePlayGame}
          />
        )}

        {activeTab === 'play' && activeHero && <ViviPlay key={activeHero.id} story={activeHero} onExit={() => { setActiveHero(null); setShowArchive(false); setActiveTab('feed'); }} />}
        {activeTab === 'play' && !activeHero && activeGame && (
          <PlaySceneSwitcher
            gameSpec={activeGame}
            onExit={() => setActiveTab('feed')}
            onForkInStudio={(spec) => handleEditGame(spec)}
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
