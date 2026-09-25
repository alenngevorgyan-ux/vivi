import React from 'react';
import { CharacterAppearance, CharacterDirection } from '../../types/worldTypes';

interface CharacterSpriteProps {
  appearance?: CharacterAppearance;
  direction?: CharacterDirection;
  isMoving?: boolean;
  name?: string;
  isPlayer?: boolean;
}

export const CharacterSprite: React.FC<CharacterSpriteProps> = ({
  appearance = { preset: 'boy_01', clothingColor: '#d97706', skinTone: '#fed7aa', hairColor: '#451a03' },
  direction = 'down',
  isMoving = false,
  name,
  isPlayer = false,
}) => {
  const {
    preset = 'boy_01',
    clothingColor = isPlayer ? '#f59e0b' : '#3b82f6',
    skinTone = '#fed7aa',
    hairColor = '#3e2723',
  } = appearance;

  // Determine silhouette features
  const isFemale = preset === 'girl_01' || preset === 'woman_01';
  const isTall = preset === 'man_01' || preset === 'woman_01';
  const isShadow = preset === 'shadow_01';

  // Walk bob animation offset
  const bobbing = isMoving ? 'animate-bounce-slight' : '';

  return (
    <div className={`relative flex flex-col items-center select-none ${bobbing}`}>
      {/* Name tag overhead */}
      {name && (
        <div className="absolute -top-6 px-2 py-0.5 rounded-full bg-slate-950/80 backdrop-blur-xs border border-slate-700/60 text-[10px] font-sans font-semibold text-slate-200 whitespace-nowrap shadow-sm pointer-events-none">
          {name}
        </div>
      )}

      {/* Ground Soft Drop Shadow */}
      <div className="absolute -bottom-1 w-7 h-2.5 bg-black/40 rounded-full blur-[1px] transform scale-x-110" />

      {/* SVG Stylized Character Figure */}
      <svg
        width={isTall ? 32 : 28}
        height={isTall ? 44 : 38}
        viewBox="0 0 32 44"
        className="relative filter drop-shadow-sm transition-transform"
        style={{
          transform: direction === 'left' ? 'scaleX(-1)' : 'scaleX(1)',
        }}
      >
        {isShadow ? (
          /* Mystical / Memory Shadow Figure */
          <g opacity="0.85">
            <ellipse cx="16" cy="11" rx="6.5" ry="7.5" fill="#1e1b4b" />
            <path
              d="M9 18 C9 15 23 15 23 18 L25 38 C25 41 7 41 7 38 Z"
              fill="#0f172a"
            />
            {/* Soft inner glow */}
            <ellipse cx="16" cy="10" rx="3" ry="3" fill="#a5b4fc" opacity="0.3" />
          </g>
        ) : (
          /* Illustrated Indie Character */
          <g>
            {/* Legs & Shoes */}
            <rect
              x={direction === 'down' ? '10' : direction === 'up' ? '11' : '11'}
              y="32"
              width="4"
              height="8"
              rx="1.5"
              fill="#1e293b"
            />
            <rect
              x={direction === 'down' ? '18' : direction === 'up' ? '17' : '17'}
              y="32"
              width="4"
              height="8"
              rx="1.5"
              fill="#1e293b"
            />
            {/* Shoes */}
            <ellipse cx="12" cy="40" rx="2.5" ry="1.5" fill="#0f172a" />
            <ellipse cx="20" cy="40" rx="2.5" ry="1.5" fill="#0f172a" />

            {/* Torso / Clothes (Coat, Hoodie, or Jacket) */}
            <path
              d={
                isFemale
                  ? 'M8 18 Q16 16 24 18 L26 33 Q16 34 6 33 Z'
                  : 'M8 18 Q16 16 24 18 L25 32 Q16 33 7 32 Z'
              }
              fill={clothingColor}
              stroke="#0f172a"
              strokeWidth="0.75"
            />

            {/* Collar or Scarf */}
            <path
              d="M11 18 Q16 21 21 18 L19 23 Q16 24 13 23 Z"
              fill="#f8fafc"
              opacity="0.8"
            />

            {/* Arms depending on direction */}
            {direction === 'down' && (
              <>
                <rect x="5.5" y="19" width="3" height="9" rx="1.5" fill={clothingColor} />
                <circle cx="7" cy="29" r="1.5" fill={skinTone} />
                <rect x="23.5" y="19" width="3" height="9" rx="1.5" fill={clothingColor} />
                <circle cx="25" cy="29" r="1.5" fill={skinTone} />
              </>
            )}
            {direction === 'up' && (
              <>
                <rect x="5.5" y="19" width="3" height="9" rx="1.5" fill={clothingColor} />
                <rect x="23.5" y="19" width="3" height="9" rx="1.5" fill={clothingColor} />
              </>
            )}
            {(direction === 'right' || direction === 'left') && (
              <>
                <rect x="18" y="19" width="3.5" height="9" rx="1.5" fill={clothingColor} />
                <circle cx="19.7" cy="29" r="1.5" fill={skinTone} />
              </>
            )}

            {/* Neck */}
            <rect x="14" y="14" width="4" height="4" fill={skinTone} />

            {/* Head */}
            <ellipse cx="16" cy="11" rx="6.5" ry="7" fill={skinTone} />

            {/* Face details (if facing forward or side) */}
            {direction === 'down' && (
              <>
                {/* Eyes */}
                <ellipse cx="13.5" cy="11.5" rx="1" ry="1.2" fill="#1e293b" />
                <ellipse cx="18.5" cy="11.5" rx="1" ry="1.2" fill="#1e293b" />
                {/* Cheeks blush */}
                <circle cx="11.5" cy="13.5" r="1.2" fill="#f43f5e" opacity="0.3" />
                <circle cx="20.5" cy="13.5" r="1.2" fill="#f43f5e" opacity="0.3" />
              </>
            )}
            {(direction === 'right' || direction === 'left') && (
              <>
                <ellipse cx="19" cy="11.5" rx="1" ry="1.2" fill="#1e293b" />
                <circle cx="20" cy="13.5" r="1.2" fill="#f43f5e" opacity="0.3" />
              </>
            )}

            {/* Hair */}
            {direction === 'up' ? (
              /* Back of head hair */
              <path
                d={
                  isFemale
                    ? 'M8 12 Q8 4 16 4 Q24 4 24 12 L24 20 Q16 18 8 20 Z'
                    : 'M9 13 Q9 4 16 4 Q23 4 23 13 L23 16 Q16 17 9 16 Z'
                }
                fill={hairColor}
              />
            ) : (
              /* Front / side hair */
              <path
                d={
                  isFemale
                    ? 'M8 10 Q8 4 16 4 Q24 4 24 10 Q24 13 22 10 Q16 6 10 10 Q8 12 8 10 Z'
                    : 'M9 9 Q9 4 16 4 Q23 4 23 9 Q20 7 16 7 Q12 7 9 9 Z'
                }
                fill={hairColor}
              />
            )}
            {/* Female ponytail / side bangs */}
            {isFemale && direction !== 'up' && (
              <>
                <path d="M7 10 L7 17 Q9 15 9 11 Z" fill={hairColor} />
                <path d="M25 10 L25 17 Q23 15 23 11 Z" fill={hairColor} />
              </>
            )}
          </g>
        )}
      </svg>
    </div>
  );
};
