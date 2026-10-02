/** Generate reusable direction/pose reference sheets from the actual runtime vector component. */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CharacterFigure } from '../src/assets/characters/CharacterFigure';
import { characters, type CharacterFacing, type CharacterPose, type ViviCharacterId } from '../src/assets/characters/characters';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'src/assets/characters/sheets');
const facings: CharacterFacing[] = ['front', 'back', 'left', 'right'];
const poses: CharacterPose[] = ['idle', 'walk', 'sit', 'look_at_phone', 'talk', 'wait', 'turn', 'leave', 'hesitate'];
await mkdir(out, { recursive: true });
for (const id of Object.keys(characters) as ViviCharacterId[]) {
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1242" height="780" viewBox="0 0 1242 780"><rect width="1242" height="780" fill="#f4efe7"/><text x="30" y="47" fill="#b85f49" font-family="Arial" font-size="12" letter-spacing="3">VIVI / MODULAR CHARACTER SHEET</text><text x="30" y="91" fill="#202629" font-family="Georgia" font-size="34">${id.replaceAll('_', ' ')}</text>`;
  poses.forEach((pose, column) => svg += `<text x="${125 + column * 122}" y="135" fill="#7d6d63" font-family="Arial" font-size="10">${pose.toUpperCase().replaceAll('_',' ')}</text>`);
  facings.forEach((facing, row) => {
    svg += `<text x="25" y="${233 + row * 155}" fill="#b85f49" font-family="Arial" font-weight="bold" font-size="11">${facing.toUpperCase()}</text>`;
    poses.forEach((pose, column) => {
      const x = 109 + column * 122, y = 161 + row * 155;
      svg += `<rect x="${x}" y="${y}" width="112" height="135" rx="7" fill="#fffaf2" stroke="#ded3c7"/><path d="M${x+12} ${y+119}H${x+100}" stroke="#ddd4c7"/><g transform="translate(${x+32} ${y+10})">${renderToStaticMarkup(<CharacterFigure id={id} facing={facing} pose={pose} size={95}/>)}</g>`;
    });
  });
  svg += `<text x="30" y="758" fill="#867970" font-family="Arial" font-size="11">56 × 100 base proportion · vector source: CharacterFigure.tsx · use pose and facing in ExperiencePlan</text></svg>`;
  await writeFile(path.join(out, `${id}.svg`), svg);
}
