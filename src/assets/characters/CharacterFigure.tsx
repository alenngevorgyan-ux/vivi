import React from 'react';
import { characters, type CharacterFacing, type CharacterPose, type ViviCharacterId } from './characters';

export function CharacterFigure({ id, facing = 'front', pose = 'idle', size = 94 }: { id: ViviCharacterId; facing?: CharacterFacing; pose?: CharacterPose; size?: number }) {
  const c = characters[id];
  const side = facing === 'left' || facing === 'right';
  const seated = pose === 'sit';
  const walking = pose === 'walk' || pose === 'leave';
  const height = c.build === 'small' ? 0.78 : c.build === 'tall' ? 1.08 : 1;
  return <svg width={size * .56} height={size} viewBox="0 0 56 100" role="img" aria-label={`${id.replaceAll('_', ' ')} ${pose} ${facing}`} style={{ overflow: 'visible', transform: `scale(${facing === 'left' ? -1 : 1},${height})`, transformOrigin: 'bottom center' }}>
    <ellipse cx="28" cy="96" rx="18" ry="4" fill="#202629" opacity=".22" />
    <g transform={seated ? 'translate(0 11)' : undefined}>
      <path d={seated ? 'M19 70 L12 79 L26 82 L23 95 M36 70 L43 79 L31 82 L34 95' : walking ? 'M21 70 L13 94 Q13 98 20 97 L29 76 M34 71 L42 93 Q43 97 36 97 L28 76' : 'M19 70 L17 94 Q17 98 23 98 L27 72 M32 72 L34 94 Q35 98 41 98 L37 70'} fill={c.trouser} stroke={c.trouser} strokeWidth="3" strokeLinecap="round" />
      {c.hairShape === 'long' && <path d="M17 24 Q11 31 14 55 L21 53 L35 53 L42 56 Q44 32 37 24Z" fill={c.hair} />}
      <path d="M18 43 Q28 38 38 43 L42 72 Q28 78 14 72 Z" fill={c.clothing} />
      <path d={pose === 'look_at_phone' ? 'M18 46 Q12 54 24 61 M38 46 Q43 53 30 61' : pose === 'talk' ? 'M18 47 Q10 50 8 42 M38 47 Q46 53 44 64' : pose === 'wait' ? 'M18 47 Q13 53 30 59 M38 47 Q42 54 24 59' : 'M18 47 Q12 56 14 67 M38 47 Q43 56 42 67'} fill="none" stroke={c.clothing} strokeWidth="8" strokeLinecap="round" />
      {pose === 'look_at_phone' && <rect x="23" y="55" width="10" height="16" rx="2" fill="#27343e" stroke="#bdd3cc" />}
      <rect x="24" y="34" width="8" height="11" rx="3" fill={c.skin} />
      <ellipse cx="28" cy="25" rx={side ? 11 : 13} ry="16" fill={c.skin} />
      <path d={c.hairShape === 'cropped' ? 'M17 22 Q16 8 29 9 Q41 10 39 22 Q30 17 17 22' : c.hairShape === 'wavy' ? 'M15 23 Q14 9 23 12 Q27 5 34 11 Q43 10 41 26 Q35 16 15 23' : 'M15 23 Q15 9 29 9 Q40 10 41 22 Q29 16 15 23'} fill={c.hair} />
      {facing === 'front' && <g fill="#4a3934" opacity=".7"><circle cx="23" cy="27" r="1"/><circle cx="33" cy="27" r="1"/></g>}
      {side && <circle cx="35" cy="27" r="1" fill="#4a3934" opacity=".7" />}
    </g>
  </svg>;
}
