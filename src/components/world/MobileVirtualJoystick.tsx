import React, { useRef } from 'react';
import { CharacterDirection } from '../../types/worldTypes';

interface MobileVirtualJoystickProps {
  onMove: (dir: CharacterDirection | null) => void;
  onInteract: () => void;
  canInteract: boolean;
  interactionLabel?: string;
}

export const MobileVirtualJoystick: React.FC<MobileVirtualJoystickProps> = ({
  onMove,
  onInteract,
  canInteract,
  interactionLabel = 'Вспомнить',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouch = (e: React.TouchEvent) => {
    if (!containerRef.current) return;
    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;

    if (Math.hypot(dx, dy) < 12) {
      onMove(null);
      return;
    }

    if (Math.abs(dx) > Math.abs(dy)) {
      onMove(dx > 0 ? 'right' : 'left');
    } else {
      onMove(dy > 0 ? 'down' : 'up');
    }
  };

  const handleEnd = () => {
    onMove(null);
  };

  return (
    <div className="relative z-40 flex items-center justify-between gap-4 px-6 pb-4 pt-1 select-none">
      {/* Virtual D-pad / Joystick */}
      <div
        ref={containerRef}
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
        onTouchEnd={handleEnd}
        className="relative w-24 h-24 rounded-full bg-slate-900/60 border border-slate-700/60 backdrop-blur-md flex items-center justify-center shadow-lg active:scale-95 transition-transform"
      >
        {/* Direction Arrows */}
        <span className="absolute top-2 text-slate-400 font-code text-xs">▲</span>
        <span className="absolute bottom-2 text-slate-400 font-code text-xs">▼</span>
        <span className="absolute left-2.5 text-slate-400 font-code text-xs">◀</span>
        <span className="absolute right-2.5 text-slate-400 font-code text-xs">▶</span>

        {/* Center Knob */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500/80 to-amber-400/80 border border-amber-300/60 shadow-md flex items-center justify-center">
          <div className="w-4 h-4 rounded-full bg-slate-950/40" />
        </div>
      </div>

      {/* Right Side Action Button */}
      <div className="flex flex-col items-center gap-1.5">
        <button
          onClick={onInteract}
          disabled={!canInteract}
          className={`w-16 h-16 rounded-full flex flex-col items-center justify-center font-bold text-xs shadow-xl backdrop-blur-md border transition-all active:scale-90 ${
            canInteract
              ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-amber-500/30 animate-pulse'
              : 'bg-slate-900/40 text-slate-600 border-slate-800 cursor-not-allowed'
          }`}
        >
          <span className="text-base font-black">E</span>
          <span className="text-[9px] font-sans truncate max-w-[60px]">{interactionLabel}</span>
        </button>
      </div>
    </div>
  );
};
