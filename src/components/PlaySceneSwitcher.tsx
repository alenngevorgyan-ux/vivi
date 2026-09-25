import React, { useState } from 'react';
import { GameSpec } from '../types/gameSpec';
import { PlayableWorldEngine } from './world/PlayableWorldEngine';
import { PlayView as ClassicTextPlayView } from './PlayView';
import { Compass, Gamepad2, BookOpen } from 'lucide-react';
import { sounds } from '../utils/soundEffects';

interface PlaySceneSwitcherProps {
  gameSpec: GameSpec;
  onExit: () => void;
  onForkInStudio: (spec: GameSpec) => void;
}

export const PlaySceneSwitcher: React.FC<PlaySceneSwitcherProps> = ({
  gameSpec,
  onExit,
  onForkInStudio,
}) => {
  // Default to 2D Playable World Engine!
  const [viewMode, setViewMode] = useState<'2d_world' | 'classic_text'>('2d_world');

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Subtle Mode Switcher in corner */}
      <div className="absolute top-3.5 right-16 z-40 flex items-center gap-1 p-1 rounded-xl bg-slate-950/80 border border-slate-800 backdrop-blur-md text-[11px]">
        <button
          onClick={() => {
            sounds.playClick();
            setViewMode('2d_world');
          }}
          className={`px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 ${
            viewMode === '2d_world'
              ? 'bg-amber-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Gamepad2 className="w-3.5 h-3.5" />
          <span>2D Мир</span>
        </button>

        <button
          onClick={() => {
            sounds.playClick();
            setViewMode('classic_text');
          }}
          className={`px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 ${
            viewMode === 'classic_text'
              ? 'bg-amber-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Текст</span>
        </button>
      </div>

      {viewMode === '2d_world' ? (
        <PlayableWorldEngine
          gameSpec={gameSpec}
          onExit={onExit}
          onForkInStudio={onForkInStudio}
        />
      ) : (
        <ClassicTextPlayView
          gameSpec={gameSpec}
          onExit={onExit}
          onForkInStudio={onForkInStudio}
        />
      )}
    </div>
  );
};
