import { C, paintLayer } from './kit.mjs';
import { figure } from './figure.mjs';
import { tile, fin } from './compose.mjs';
import { apartment } from './plates.mjs';
import { frameBoard, save, T, wrap } from './board.mjs';

const W = 2400, TW = 704, TH = 440, X0 = 60, GAP = 44;
const crop = [0, 70, 1000, 625];
const hero = (o = {}) => figure(330, 500, 190, 'notice', 'hero', 1, { light: -1, ...o });
const ph = `<g transform="translate(560 416)"><path d="M-15 -5 L12 -5 L15 4 L-17 4 Z" fill="#D6EDF1"/></g>`;
const X = (i) => X0 + i * (TW + GAP);
const parts = [];

// A — cut-paper diorama: separate layers, hard edges, drop shadows between them, lifted palette
{
  const x = X(0), y = 250;
  const layers = `<g filter="url(#cutShadow)">${paintLayer(apartment.back.slice(0, 1))}</g><g filter="url(#cutShadow)">${paintLayer(apartment.back.slice(1))}</g><g filter="url(#cutShadow)">${paintLayer(apartment.mid)}</g>`;
  parts.push(`<g transform="translate(${x} ${y})"><clipPath id="ca"><rect width="${TW}" height="${TH}"/></clipPath><rect x="-14" y="-14" width="${TW + 28}" height="${TH + 28}" fill="#C9B79A"/><g clip-path="url(#ca)"><rect width="${TW}" height="${TH}" fill="#3D4260"/><svg width="${TW}" height="${TH}" viewBox="${crop.join(' ')}"><g style="filter:saturate(1.35) brightness(1.25)">${layers}</g><g filter="url(#cutShadow)">${hero()}${ph}</g></svg></g></g>`);
}
// B — ink panels: posterised to ink / rust / paper, heavy gutters
{
  const x = X(1), y = 250;
  parts.push(`<g transform="translate(${x} ${y})"><clipPath id="cb"><rect width="${TW}" height="${TH}"/></clipPath><rect x="-10" y="-10" width="${TW + 20}" height="${TH + 20}" fill="#EDE6D6"/><g clip-path="url(#cb)"><svg width="${TW}" height="${TH}" viewBox="${crop.join(' ')}"><g filter="url(#posterize)"><g style="filter:brightness(1.75) contrast(1.1)">${paintLayer(apartment.back)}${paintLayer(apartment.mid)}${apartment.lights({ phone: true })}${hero()}${ph}</g></g></svg></g><rect x="-10" y="-10" width="${TW + 20}" height="${TH + 20}" fill="none" stroke="#111" stroke-width="10"/>${T(14, TH - 14, 'ANA IS IN THE SHOWER.', { fam: 'mono', size: 13, fill: '#111', weight: 500, ls: 1 })}</g>`);
}
// C — remembered room
parts.push(tile({ x: X(2), y: 250, w: TW, h: TH, plate: apartment, state: { phone: true }, crop, finish: fin(crop, { l: .05, t: -.1, r: -.1, b: .16 }), figures: [hero(), ph],
  pxOver: T(26, TH - 20, 'Ana is in the shower. I am alone in the room.', { fam: 'serif', style: 'italic', size: 19, fill: '#3A332D' }) }));

const names = [['A', 'Cut-paper diorama', 'Layered paper in a shadow-box. Tactile, charming, bright. Reads as craft: a miniature you look down on.', 'Rejected: toy distance, kit seams show, “children’s book” risk.'],
  ['B', 'Ink planes', 'Three inks, hard shapes, panel gutters. Graphic and cheap. Reads as a diagram or comic: light and material are lost.', 'Rejected: loses practical light, the body is a pictogram.'],
  ['C', 'The remembered room', 'Painted gouache on visible paper, finished only where attention rests; the rest is graphite. Warm body, cold rooms, one rust accent.', 'CHOSEN.']];
names.forEach((n, i) => {
  const x = X(i), y = 250 + TH + 50;
  parts.push(`${T(x, y, n[0], { fam: 'mono', size: 13, fill: C.rust, weight: 500 })}${T(x + 26, y, n[1], { fam: 'serif', size: 26 })}${wrap(x, y + 30, n[2], TW, { size: 15, fill: C.text })}${T(x, y + 100, n[3], { size: 14, weight: 600, fill: i === 2 ? C.rust : C.muted })}`);
});
const rows = [
  ['World', 'Shadow-box, front-on. Foreground/mid/back as separate paper cut-outs.', 'Flat orthographic. Few planes, big silhouettes.', 'Shallow 3/4 plates; architecture first; one occluder; edges dissolve to graphite.'],
  ['Characters', 'Paper dolls with a white edge.', 'Black silhouettes, no interior.', 'Faceless painted adults; face plane, hands, weight, rim light.'],
  ['Material', 'Cardstock, drop shadows, glue-edge.', 'Ink, halftone-free flat fills.', 'Gouache on paper tooth, baked granulation, graphite construction.'],
  ['Light', 'Soft ambient; shadows are the lighting.', 'Binary: lit or ink.', 'Practical pools; one warm, one cold; subtractive.'],
  ['Reveal', 'Paper curtain lifts.', 'Panel turns to a caption.', 'Paint withdraws; page is already there. Same material as the shell.'],
  ['Per-story cost', 'Medium: many cut layers per scene.', 'Lowest.', 'Low: two plates (sketch/finished) + masks per kit; edges are unfinished by design.'],
];
const ry = 250 + TH + 200;
rows.forEach((r, i) => {
  const yy = ry + i * 74;
  parts.push(`<line x1="60" y1="${yy - 20}" x2="2340" y2="${yy - 20}" stroke="#4A4A48" stroke-opacity=".2"/>${T(60, yy - 2, r[0], { fam: 'mono', size: 12, fill: C.rust, ls: 1.5 })}`);
  [1, 2, 3].forEach((c) => parts.push(wrap(X(c - 1), yy + 18, r[c], TW, { size: 14.5, fill: c === 3 ? C.text : C.muted })));
});
const H = ry + 6 * 74 + 60;
await save('board-00-directions', frameBoard({ W, H, eyebrow: 'THREE DIRECTIONS · ONE MOMENT', title: 'Ana’s phone, three ways', sub: 'The same plate and the same figure rendered under three material systems (quick approximations, to compare reading, not polish).', body: parts.join(''), foot: 'ART-DIRECTION PROOF · GENERATED FROM A SMALL KIT · NOT FINAL ART' }), W, H);
