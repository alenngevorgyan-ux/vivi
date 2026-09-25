import React from 'react';
import { Sparkles, Compass, PlusCircle, Gamepad2, Volume2, VolumeX, BookOpen, Layers } from 'lucide-react';
import { sounds } from '../utils/soundEffects';

interface NavbarProps {
  activeTab: 'feed' | 'create' | 'play';
  setActiveTab: (tab: 'feed' | 'create' | 'play') => void;
  hasActiveGame: boolean;
  activeGameTitle?: string;
  isAudioMuted: boolean;
  setIsAudioMuted: (muted: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  hasActiveGame,
  activeGameTitle,
  isAudioMuted,
  setIsAudioMuted,
}) => {
  const toggleMute = () => {
    const next = !isAudioMuted;
    setIsAudioMuted(next);
    sounds.setMuted(next);
    if (!next) sounds.playClick();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div 
          onClick={() => {
            sounds.playClick();
            setActiveTab('feed');
          }}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="relative w-9 h-9 rounded-lg bg-gradient-to-tr from-amber-600 via-rose-600 to-indigo-600 p-[1px] shadow-lg shadow-amber-500/10 transition-transform group-hover:scale-105">
            <div className="w-full h-full bg-slate-950 rounded-[7px] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-amber-400 group-hover:rotate-12 transition-transform" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-cinzel text-lg font-bold tracking-widest bg-gradient-to-r from-amber-200 via-slate-100 to-rose-200 bg-clip-text text-transparent">
                MYTHOS
              </span>
              <span className="text-[10px] font-code px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 tracking-wider">
                ENGINE
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-sans hidden sm:block">AI Interactive Fiction & Game Studio</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('feed');
            }}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
              activeTab === 'feed'
                ? 'bg-slate-800 text-amber-300 border border-amber-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Stories</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('create');
            }}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
              activeTab === 'create'
                ? 'bg-slate-800 text-amber-300 border border-amber-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create & AI</span>
          </button>

          {hasActiveGame && (
            <button
              onClick={() => {
                sounds.playClick();
                setActiveTab('play');
              }}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                activeTab === 'play'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-amber-200 hover:bg-amber-500/10'
              }`}
            >
              <Gamepad2 className="w-4 h-4 text-amber-400 animate-pulse" />
              <span className="max-w-[120px] sm:max-w-[160px] truncate">
                {activeGameTitle ? `Play: ${activeGameTitle}` : 'Play Session'}
              </span>
            </button>
          )}
        </nav>

        {/* Right Tools (Mute / Engine Info) */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            title={isAudioMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg border border-slate-800/80 transition-colors"
          >
            {isAudioMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-amber-400" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
