/** Render one stride as discrete phases, so the walk cycle can be reviewed as art. */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CharacterFigure } from '../src/assets/characters/CharacterFigure';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const steps = 8;
const cell = 120;

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cell * steps + 40}" height="330" viewBox="0 0 ${cell * steps + 40} 330"><rect width="100%" height="100%" fill="#f4efe7"/><text x="20" y="34" fill="#b85f49" font-family="Arial" font-size="12" letter-spacing="3">VIVI / WALK CYCLE — ONE STRIDE</text>`;

for (let i = 0; i < steps; i++) {
  const phase = i / steps;
  const x = 20 + i * cell;
  svg += `<rect x="${x}" y="60" width="${cell - 8}" height="200" rx="6" fill="#fffaf2" stroke="#ded3c7"/>`;
  svg += `<path d="M${x + 10} 248 H${x + cell - 18}" stroke="#ddd4c7"/>`;
  svg += `<text x="${x + 10} " y="280" fill="#7d6d63" font-family="Arial" font-size="10">phase ${phase.toFixed(3)}</text>`;
  svg += `<g transform="translate(${x + 26} 70)">${renderToStaticMarkup(
    <CharacterFigure id="young_adult_masc_01" facing="right" pose="walk" size={176} phase={phase} />
  )}</g>`;
}

svg += `<text x="20" y="312" fill="#867970" font-family="Arial" font-size="11">right-facing · alternating legs with knee flexion, arm counter-swing, pelvis lowest at double support</text></svg>`;

await writeFile(path.join(root, 'src/assets/characters/sheets/_walk-cycle.svg'), svg);
console.log('walk strip written');
