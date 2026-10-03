import fs from 'node:fs';
import { C, defs } from './kit.mjs';
import { render } from './render.mjs';

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const FAM = { serif: "Newsreader, 'Noto Serif Armenian', Georgia, serif", sans: "Inter, sans-serif", mono: "'IBM Plex Mono', monospace" };

export function T(x, y, str, { size = 15, fam = 'sans', weight = 400, fill = C.text, anchor = 'start', style = 'normal', ls = 0, op = 1 } = {}) {
  return `<text x="${x}" y="${y}" font-family="${FAM[fam]}" font-size="${size}" font-weight="${weight}" font-style="${style}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}" opacity="${op}">${esc(str)}</text>`;
}

// naive wrapper: width in px -> chars by an average advance
export function wrap(x, y, str, maxW, { size = 14, lh = 1.45, fam = 'sans', weight = 400, fill = C.muted, style = 'normal', adv = null, anchor = 'start', op = 1 } = {}) {
  const a = adv ?? (fam === 'serif' ? 0.47 : fam === 'mono' ? 0.6 : 0.52);
  const maxC = Math.max(8, Math.floor(maxW / (size * a)));
  const words = String(str).split(/\s+/);
  const lines = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > maxC) { lines.push(cur.trim()); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur);
  return lines.map((l, i) => T(x, y + i * size * lh, l, { size, fam, weight, fill, style, anchor, op })).join('') + `<!--lines:${lines.length}-->`;
}
export const lineCount = (str, maxW, size, fam = 'sans') => { const a = fam === 'serif' ? 0.47 : 0.52; const maxC = Math.max(8, Math.floor(maxW / (size * a))); let n = 1, cur = ''; for (const w of String(str).split(/\s+/)) { if ((cur + ' ' + w).trim().length > maxC) { n++; cur = w; } else cur = (cur + ' ' + w).trim(); } return n; };

export function cap(x, y, n, title, desc, w, { size = 13.5 } = {}) {
  return `${T(x, y, String(n).padStart(2, '0'), { fam: 'mono', size: 12, fill: C.rust, weight: 500 })}${T(x + 30, y, title, { weight: 600, size: 14.5 })}${wrap(x + 30, y + 22, desc, w - 30, { size })}`;
}

export function frameBoard({ W, H, eyebrow, title, sub, body, foot }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${defs()}
<rect width="${W}" height="${H}" fill="#E4DAC8"/>
<rect width="${W}" height="${H}" filter="url(#paperMottle)" opacity=".1"/>
${T(60, 70, eyebrow, { fam: 'mono', size: 13, fill: C.rust, ls: 2.2, weight: 500 })}
${T(60, 128, title, { fam: 'serif', size: 52, fill: C.text, ls: -1.2 })}
${sub ? wrap(60, 166, sub, Math.min(1500, W - 120), { size: 17, fill: C.muted, fam: 'sans' }) : ''}
${body}
${foot ? T(60, H - 34, foot, { fam: 'mono', size: 11.5, fill: '#8F8478', ls: 1.2 }) : ''}
<rect width="${W}" height="${H}" filter="url(#paperTex)" opacity=".1" style="mix-blend-mode:multiply"/>
</svg>`;
}

export async function save(name, svg, W, H) {
  const dir = new URL('../', import.meta.url).pathname;
  fs.writeFileSync(`/tmp/${name}.svg`, svg);
  await render(`/tmp/${name}.svg`, `${dir}${name}.jpg`, W, H);
  console.log('wrote', `${dir}${name}.jpg`);
}
