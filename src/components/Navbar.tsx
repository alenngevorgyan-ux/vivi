import React from 'react';
import { Compass, PlusCircle, Gamepad2, Volume2, VolumeX } from 'lucide-react';
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
  };

  return (
    <header className="vivi-navbar sticky top-0 z-50 w-full border-b backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand / Logo */}
        <div
          onClick={() => setActiveTab('feed')}
          className="flex items-center gap-3 cursor-pointer group shrink-0"
        >
          <div className="vivi-brand-symbol" aria-hidden="true">
            V<span>.</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="vivi-wordmark font-serif tracking-wider font-bold">VIVI</span>
            </div>
            <p className="vivi-tagline hidden sm:block">STORIES YOU CAN ENTER</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setActiveTab('feed')}
            aria-label="Лента"
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
              activeTab === 'feed'
                ? 'bg-stone-800 text-stone-100 shadow-sm'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/70'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span className="hidden min-[420px]:inline">Лента</span>
          </button>

          <button
            onClick={() => setActiveTab('create')}
            aria-label="Создать историю"
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
              activeTab === 'create'
                ? 'bg-stone-800 text-stone-100 shadow-sm'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/70'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden min-[420px]:inline">Создать историю</span>
          </button>

          {hasActiveGame && (
            <button
              onClick={() => setActiveTab('play')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                activeTab === 'play'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-stone-600 hover:text-amber-900 hover:bg-amber-100/60'
              }`}
            >
              <Gamepad2 className="w-4 h-4" />
              <span className="hidden sm:inline max-w-[160px] truncate">
                {activeGameTitle ? activeGameTitle : 'Сессия'}
              </span>
            </button>
          )}
        </nav>

        {/* Right Tools (Mute / Captions) */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            title={isAudioMuted ? 'Включить атмосферный звук' : 'Выключить звук'}
            aria-label={isAudioMuted ? 'Включить звук' : 'Выключить звук'}
            aria-pressed={!isAudioMuted}
            className="p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-200/70 rounded-lg transition-colors"
          >
            {isAudioMuted ? (
              <VolumeX className="w-4 h-4 text-rose-500" />
            ) : (
              <Volume2 className="w-4 h-4 text-stone-600" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
