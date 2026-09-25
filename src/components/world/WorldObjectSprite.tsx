import React from 'react';
import { WorldObject } from '../../types/worldTypes';

interface WorldObjectSpriteProps {
  object: WorldObject;
  isNearby?: boolean;
}

export const WorldObjectSprite: React.FC<WorldObjectSpriteProps> = ({ object, isNearby = false }) => {
  const { type, name, interactionPrompt = 'Вспомнить' } = object;

  return (
    <div className="relative flex flex-col items-center group cursor-pointer select-none">
      {/* Interaction Floating Bubble when player is near */}
      {isNearby && (
        <div className="absolute -top-9 z-30 px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 text-[11px] font-sans font-bold shadow-lg border border-amber-300 animate-bounce flex items-center gap-1.5 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
          <span>[E] {interactionPrompt}</span>
        </div>
      )}

      {/* SVG Stylized Indie Object Art */}
      {type === 'bench' && (
        <svg width="64" height="34" viewBox="0 0 64 34" className="drop-shadow-sm">
          {/* Ground shadow */}
          <ellipse cx="32" cy="30" rx="30" ry="4" fill="rgba(0,0,0,0.3)" />
          {/* Wooden slatted bench */}
          {/* Back rest */}
          <rect x="8" y="4" width="48" height="5" rx="1.5" fill="#78350f" stroke="#451a03" strokeWidth="0.8" />
          <rect x="8" y="11" width="48" height="5" rx="1.5" fill="#92400e" stroke="#451a03" strokeWidth="0.8" />
          {/* Seat */}
          <rect x="6" y="18" width="52" height="6" rx="2" fill="#b45309" stroke="#451a03" strokeWidth="0.8" />
          {/* Iron legs */}
          <path d="M12 18 L10 30 M52 18 L54 30" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
          <path d="M10 24 L54 24" stroke="#1e293b" strokeWidth="1.5" />
        </svg>
      )}

      {type === 'tree' && (
        <svg width="90" height="120" viewBox="0 0 90 120" className="drop-shadow-md">
          {/* Shadow */}
          <ellipse cx="45" cy="112" rx="35" ry="7" fill="rgba(0,0,0,0.3)" />
          {/* Trunk */}
          <path d="M40 70 Q45 95 38 112 L52 112 Q45 95 50 70 Z" fill="#5c3826" />
          {/* Branches and Foliage (Sunset warm tone) */}
          <ellipse cx="45" cy="62" rx="36" ry="32" fill="#b45309" opacity="0.95" />
          <ellipse cx="32" cy="48" rx="28" ry="26" fill="#d97706" />
          <ellipse cx="56" cy="46" rx="26" ry="24" fill="#f59e0b" opacity="0.9" />
          <ellipse cx="44" cy="30" rx="24" ry="22" fill="#fbbf24" opacity="0.85" />
        </svg>
      )}

      {type === 'streetlight' && (
        <svg width="36" height="100" viewBox="0 0 36 100" className="drop-shadow-md">
          {/* Base shadow */}
          <ellipse cx="18" cy="96" rx="12" ry="3" fill="rgba(0,0,0,0.35)" />
          {/* Pole */}
          <rect x="16.5" y="24" width="3" height="72" fill="#334155" />
          <path d="M14 96 L22 96 L20 88 L16 88 Z" fill="#1e293b" />
          {/* Curved Arm */}
          <path d="M18 24 Q18 10 28 10 L30 16" fill="none" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
          {/* Lantern Lamp */}
          <polygon points="24,16 34,16 32,24 26,24" fill="#0f172a" />
          {/* Warm Glow Bulb */}
          <circle cx="29" cy="22" r="4.5" fill="#fef08a" />
          {/* Light cone down */}
          <polygon points="29,24 5,98 53,98" fill="#fef08a" opacity="0.08" />
        </svg>
      )}

      {type === 'bicycle' && (
        <svg width="56" height="38" viewBox="0 0 56 38" className="drop-shadow-sm">
          {/* Shadow */}
          <ellipse cx="28" cy="35" rx="24" ry="3" fill="rgba(0,0,0,0.3)" />
          {/* Wheels */}
          <circle cx="12" cy="26" r="9" fill="none" stroke="#334155" strokeWidth="2.5" />
          <circle cx="44" cy="26" r="9" fill="none" stroke="#334155" strokeWidth="2.5" />
          {/* Spokes */}
          <line x1="12" y1="17" x2="12" y2="35" stroke="#94a3b8" strokeWidth="0.75" />
          <line x1="3" y1="26" x2="21" y2="26" stroke="#94a3b8" strokeWidth="0.75" />
          <line x1="44" y1="17" x2="44" y2="35" stroke="#94a3b8" strokeWidth="0.75" />
          <line x1="35" y1="26" x2="53" y2="26" stroke="#94a3b8" strokeWidth="0.75" />
          {/* Frame (Red/Vintage) */}
          <path d="M12 26 L26 26 L38 15 L22 15 Z" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinejoin="round" />
          <path d="M26 26 L22 11 M38 15 L44 26" stroke="#dc2626" strokeWidth="2" />
          {/* Handlebars & Seat */}
          <line x1="19" y1="11" x2="25" y2="11" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="36" y1="13" x2="42" y2="13" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      )}

      {type === 'desk' && (
        <svg width="74" height="42" viewBox="0 0 74 42" className="drop-shadow-sm">
          <ellipse cx="37" cy="38" rx="34" ry="4" fill="rgba(0,0,0,0.25)" />
          {/* Desktop */}
          <rect x="6" y="8" width="62" height="12" rx="2" fill="#334155" stroke="#1e293b" strokeWidth="1" />
          {/* Desk Legs */}
          <rect x="8" y="20" width="4" height="18" fill="#1e293b" />
          <rect x="62" y="20" width="4" height="18" fill="#1e293b" />
          {/* Drawer Unit */}
          <rect x="46" y="16" width="18" height="18" fill="#1e293b" rx="1" />
          <line x1="50" y1="22" x2="60" y2="22" stroke="#64748b" strokeWidth="1.5" />
          <line x1="50" y1="28" x2="60" y2="28" stroke="#64748b" strokeWidth="1.5" />
        </svg>
      )}

      {type === 'laptop' && (
        <svg width="34" height="24" viewBox="0 0 34 24" className="drop-shadow-sm">
          {/* Screen */}
          <rect x="6" y="3" width="22" height="14" rx="1.5" fill="#0f172a" stroke="#475569" strokeWidth="1" />
          {/* Screen Glow */}
          <rect x="8" y="5" width="18" height="10" fill="#38bdf8" opacity="0.85" />
          {/* Keyboard base */}
          <polygon points="2,19 32,19 28,22 6,22" fill="#64748b" />
        </svg>
      )}

      {type === 'whiteboard' && (
        <svg width="68" height="52" viewBox="0 0 68 52" className="drop-shadow-md">
          {/* Frame */}
          <rect x="6" y="4" width="56" height="38" rx="2" fill="#f8fafc" stroke="#475569" strokeWidth="2" />
          {/* Stand Legs */}
          <line x1="12" y1="42" x2="6" y2="50" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="56" y1="42" x2="62" y2="50" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
          {/* Graphs / Notes on Board */}
          <line x1="12" y1="14" x2="30" y2="14" stroke="#dc2626" strokeWidth="1.5" />
          <path d="M12 30 L20 22 L28 26 L38 16 L48 20" fill="none" stroke="#2563eb" strokeWidth="1.5" />
          <rect x="42" y="24" width="14" height="12" fill="#fef08a" stroke="#ca8a04" strokeWidth="0.5" />
        </svg>
      )}

      {type === 'coffee_cup' && (
        <svg width="22" height="20" viewBox="0 0 22 20" className="drop-shadow-sm">
          {/* Cup */}
          <path d="M4 6 L6 16 Q11 18 16 16 L18 6 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="0.8" />
          {/* Handle */}
          <path d="M17 8 Q21 11 17 14" fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
          {/* Coffee liquid surface */}
          <ellipse cx="11" cy="6" rx="7" ry="2" fill="#451a03" />
          {/* Steam wisps */}
          <path d="M9 3 Q10 1 11 3" stroke="#e2e8f0" strokeWidth="0.75" fill="none" opacity="0.6" />
        </svg>
      )}

      {type === 'cat' && (
        <svg width="28" height="22" viewBox="0 0 28 22" className="drop-shadow-sm animate-pulse-gentle">
          {/* Sleeping cat ball */}
          <ellipse cx="14" cy="14" rx="10" ry="7" fill="#ea580c" />
          <circle cx="8" cy="11" r="5" fill="#ea580c" />
          {/* Ears */}
          <polygon points="5,7 8,3 9,8" fill="#c2410c" />
          <polygon points="9,8 11,4 12,9" fill="#c2410c" />
          {/* Tail tucked */}
          <path d="M22 15 Q26 13 22 10" fill="none" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      )}

      {type === 'bus_stop' && (
        <svg width="60" height="75" viewBox="0 0 60 75" className="drop-shadow-md">
          {/* Base */}
          <ellipse cx="30" cy="72" rx="26" ry="3.5" fill="rgba(0,0,0,0.3)" />
          {/* Glass / Metal Shelter */}
          <rect x="10" y="8" width="40" height="62" rx="3" fill="#1e293b" opacity="0.7" stroke="#475569" strokeWidth="1.5" />
          {/* Canopy roof */}
          <path d="M6 10 L54 6 L54 12 L6 14 Z" fill="#0f172a" />
          {/* Bus Sign Post */}
          <line x1="52" y1="20" x2="52" y2="70" stroke="#64748b" strokeWidth="2" />
          <circle cx="52" cy="18" r="6" fill="#facc15" stroke="#ca8a04" strokeWidth="1" />
        </svg>
      )}

      {/* Default fallback for other props */}
      {!['bench', 'tree', 'streetlight', 'bicycle', 'desk', 'laptop', 'whiteboard', 'coffee_cup', 'cat', 'bus_stop'].includes(type) && (
        <div className="w-10 h-10 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-center text-amber-300 text-xs font-bold shadow-md">
          ✦
        </div>
      )}
    </div>
  );
};
