import React from 'react';

/**
 * Small, cheap props for first-class story objects. The world art already
 * draws architecture (doors, screens, boards); these are the loose things a
 * story turns on — a phone, an envelope, a photograph — so a generated scene
 * shows the object it is about instead of a generic marker.
 */
interface KeyObjectPropProps {
  kind: string;
  /** World position in percent. */
  x: number;
  y: number;
  /** Lit, ringing or catching the light. */
  active: boolean;
  /** Buzzing against the surface. */
  vibrating?: boolean;
  /** Text on a lit screen. */
  screenText?: string;
  /** Pixel scale, tracking figure size. */
  scale: number;
}

function Glyph({ kind }: { kind: string }) {
  switch (kind) {
    case 'envelope':
      return (
        <g>
          <rect x="1" y="5" width="22" height="14" rx="1.5" fill="#e9dcc2" stroke="#6d5c48" strokeWidth="1" />
          <path d="M1.5 6 L12 13 L22.5 6" fill="none" stroke="#6d5c48" strokeWidth="1" />
          <path d="M4 17 H11" stroke="#8a7760" strokeWidth="0.9" />
        </g>
      );
    case 'photo':
      return (
        <g transform="rotate(-6 12 12)">
          <rect x="2" y="3" width="20" height="17" rx="1" fill="#f1ead9" stroke="#5f5446" strokeWidth="0.8" />
          <rect x="4" y="5" width="16" height="11" fill="#5b6870" />
          <circle cx="12" cy="9.5" r="2.6" fill="#c9a98b" />
          <path d="M7.5 16 Q12 11.5 16.5 16Z" fill="#3c464d" />
        </g>
      );
    case 'document':
    case 'letter':
      return (
        <g transform="rotate(-4 12 12)">
          <rect x="4" y="1" width="16" height="21" rx="1" fill="#efe6d4" stroke="#6b5f50" strokeWidth="0.8" />
          <path d="M7 6 H17 M7 9 H17 M7 12 H15 M7 15 H16" stroke="#8b7f6e" strokeWidth="0.9" />
          {kind === 'document' && <circle cx="15" cy="18.5" r="2" fill="none" stroke="#a24f3f" strokeWidth="0.9" />}
        </g>
      );
    case 'ticket':
      return (
        <g transform="rotate(5 12 12)">
          <rect x="1" y="7" width="22" height="10" rx="1" fill="#efd9a8" stroke="#6b5a3a" strokeWidth="0.8" />
          <path d="M16 7 V17" stroke="#6b5a3a" strokeDasharray="1.4 1.2" strokeWidth="0.7" />
          <path d="M4 11 H13 M4 13.5 H10" stroke="#8a7550" strokeWidth="0.8" />
        </g>
      );
    case 'keys':
      return (
        <g>
          <circle cx="8" cy="9" r="4.2" fill="none" stroke="#c9b27a" strokeWidth="1.6" />
          <path d="M11 12 L19 20 M16 17 L18 15 M18 19 L20 17" stroke="#c9b27a" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    case 'bag':
      // A soft backpack lying on its side: rounded body, flap, one strap.
      return (
        <g>
          <path d="M3.5 21 Q2.5 12 7 10.5 H17 Q21.5 12 20.5 21Z" fill="#4f5a52" stroke="#262c28" strokeWidth="0.8" />
          <path d="M5 13.5 Q12 11 19 13.5 L18.6 16.5 Q12 14.5 5.4 16.5Z" fill="#3f4842" />
          <path d="M8.5 10.6 Q9 6.5 12 6.5 Q15 6.5 15.5 10.6" fill="none" stroke="#262c28" strokeWidth="1.3" />
          <circle cx="16.4" cy="18.4" r="1.1" fill="#4c8fbf" />
        </g>
      );
    case 'laptop':
      return (
        <g>
          <rect x="4" y="5" width="16" height="11" rx="1" fill="#1b2932" />
          <rect x="5.5" y="6.5" width="13" height="8" fill="#7fa7b2" opacity="0.8" />
          <path d="M2 17 H22 L20.5 19.5 H3.5Z" fill="#2b3b44" />
        </g>
      );
    default:
      return null;
  }
}

export function KeyObjectProp({ kind, x, y, active, vibrating, screenText, scale }: KeyObjectPropProps) {
  if (kind === 'phone') {
    return (
      <div className={`vivi-prop-phone ${vibrating ? 'is-vibrating' : ''}`} style={{ left: `${x}%`, top: `${y - 4}%` }}>
        <div className={`vivi-prop-phone-body ${active ? 'is-lit' : ''}`}>
          <span className="vivi-prop-phone-screen" />
        </div>
        {active && screenText && <span className="vivi-prop-phone-text">{screenText}</span>}
      </div>
    );
  }
  const size = Math.round(Math.max(16, Math.min(30, scale * 0.26)));
  return (
    <div className={`vivi-prop ${active ? 'is-active' : ''}`} style={{ left: `${x}%`, top: `${y - 3}%`, width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <Glyph kind={kind} />
      </svg>
    </div>
  );
}
