import { C, pencilRing, marginNote, commitMark } from './kit.mjs';
import { figure } from './figure.mjs';
import { tile, fin } from './compose.mjs';
import { apartment } from './plates.mjs';
import { frameBoard, save, T, wrap, cap } from './board.mjs';

const W = 2400, TW = 528, TH = 330, GX = 56, X0 = 60;
const px = (i) => X0 + i * (TW + GX);
const wide = [0, 70, 1000, 625];

const phoneProp = (lit, big = false, text = true) => {
  const g = `<g transform="translate(560 416)">
  <path d="M-15 -5 L12 -5 L15 4 L-17 4 Z" fill="${lit ? '#D6EDF1' : '#14181F'}"/>
  ${lit ? `<path d="M-13 -3.4 L10 -3.4 L12.4 2.6 L-14.6 2.6 Z" fill="#EAF7F8"/>` : `<path d="M-14 -4 L-4 -4 L-6 3 L-16 3 Z" fill="#3A4150" opacity=".5"/>`}
  ${lit && text ? `<text x="-11" y="-0.6" font-family="Inter" font-weight="600" font-size="2.6" fill="#1D2A33" transform="skewX(-12)">Mark</text><text x="-11" y="2.1" font-family="Inter" font-size="2.2" fill="#2E3F4A" transform="skewX(-12)">Have you told him yet?</text>` : ''}
  </g>`;
  return g;
};
const door = (open) => '';

const tiles = [];
const caps = [];

// 1 establishing
const f = (n) => ({ x: px(n % 4), y: 270 + Math.floor(n / 4) * 470 });

{
  const p = f(0);
  const crop = wide;
  tiles.push(tile({ ...p, w: TW, h: TH, plate: apartment, state: {}, crop, finish: fin(crop, { l: 0.05, t: -0.1, r: -0.1, b: 0.19, rx: 0.1 }),
    figures: [figure(330, 500, 190, 'neutral', 'hero', 1, { light: -1 }), phoneProp(false)],
    pxOver: T(26, TH - 22, 'Ana is in the shower. I am alone in the room.', { fam: 'serif', style: 'italic', size: 17, fill: '#3A332D' }) }));
  caps.push(cap(p.x, p.y + TH + 34, 1, 'Establishing', 'The whole room, at rest. Nothing is marked. A lamp, a seam of cold light under a closed door, one dark phone. The relationship between body, phone and door is the picture.', TW));
}
{
  const p = f(1);
  const crop = [230, 210, 640, 400];
  tiles.push(tile({ ...p, w: TW, h: TH, plate: apartment, state: { phone: true }, crop, finish: fin(crop, { l: 0.07, t: 0.04, r: -0.06, b: 0.14, rx: 0.1 }),
    figures: [figure(360, 500, 190, 'notice', 'hero', 1, { light: -1 }), phoneProp(true, false, false)] }));
  caps.push(cap(p.x, p.y + TH + 34, 2, 'Attention moves', 'The phone lights; the camera drifts 1.4 s toward it; the head turns first, the feet after. The island of finished paint tightens around body and phone. No pulse, no dot.', TW));
}
{
  const p = f(2);
  const crop = [490, 372, 150, 93.75];
  tiles.push(tile({ ...p, w: TW, h: TH, plate: apartment, state: { phone: true }, crop, finish: fin(crop, { l: 0.03, t: 0.05, r: -0.05, b: 0.22, rx: 0.1 }), hard: true,
    figures: [phoneProp(true, true)],
    over: [pencilRing(560, 415, 27, 12, 2, '#E7E0D2', 0.7, 0.9)],
    pxOver: T(26, TH - 24, 'A preview, nothing more is visible.', { fam: 'serif', style: 'italic', size: 17, fill: '#3A332D' }) }));
  caps.push(cap(p.x, p.y + TH + 34, 3, 'Observation', 'An insert, not a panel. The phone is its own plate with live text. The only mark is a graphite loop and one line in the margin: it states a fact, it asks nothing of you.', TW));
}
{
  const p = f(3);
  const crop = [140, 120, 760, 475];
  tiles.push(tile({ ...p, w: TW, h: TH, plate: apartment, state: { phone: true }, crop, finish: fin(crop, { l: 0.04, t: 0.04, r: 0.03, b: 0.12, rx: 0.08 }),
    figures: [figure(385, 505, 205, 'hesitate', 'hero', 1, { light: -1 }), phoneProp(true, false, false)],
    over: [
      marginNote(560, 404, 'Open the thread', { dx: -8, dy: -62, size: 19, anchor: 'middle' }),
      marginNote(735, 250, 'Ask through the door', { dx: -4, dy: -58, size: 19, anchor: 'middle' }),
      marginNote(392, 400, 'Wait', { dx: -88, dy: 96, size: 19, anchor: 'middle' }),
    ] }));
  caps.push(cap(p.x, p.y + TH + 34, 4, 'Hesitation', 'Weight rocks back, hand half-lifted toward the table. What I could do arrives as three plain phrases hung on the objects they concern. Cream italic, graphite leader: possibilities, not buttons.', TW));
}
{
  const p = f(4);
  const crop = [330, 90, 640, 400];
  tiles.push(tile({ ...p, w: TW, h: TH, plate: apartment, state: { phone: true }, crop, finish: fin(crop, { l: 0.06, t: -0.05, r: -0.05, b: 0.2, rx: 0.1 }),
    figures: [figure(692, 428, 190, 'speak', 'hero', 1, { light: -1 }), phoneProp(true, false, false)],
    over: [commitMark(646, 94, 176, 212, 'Ask through the door about Mark', { size: 16 })] }));
  caps.push(cap(p.x, p.y + TH + 34, 5, 'Physical commitment', 'The one rust-ink mark in the whole experience. A bracket around the act, a sentence naming it, and a second, separate confirm. Walking here already happened; this is the only frame that cannot be undone.', TW));
}
{
  const p = f(5);
  const crop = [330, 90, 640, 400];
  tiles.push(tile({ ...p, w: TW, h: TH, plate: apartment, state: { phone: true }, crop, finish: [[380, 130, 400, 280, 40]],
    figures: [figure(692, 428, 190, 'freeze', 'hero', 1, { light: -1 }), phoneProp(true, false, false)],
    pxOver: T(26, TH - 22, 'That is where your version stops.', { fam: 'serif', style: 'italic', size: 19, fill: '#3A332D' }) }));
  caps.push(cap(p.x, p.y + TH + 34, 6, 'Scene boundary', 'The gesture ends and nothing answers it. 0.9 s of held frame; grain locked; paint begins to withdraw from the edges toward the body and the door. No reaction is invented.', TW));
}
{
  const p = f(6);
  const crop = [330, 90, 640, 400];
  tiles.push(tile({ ...p, w: TW, h: TH, plate: apartment, state: {}, crop, finish: [[750, 250, 80, 190, 30]], hard: true,
    figures: [figure(790, 428, 190, 'freeze', 'hero', 1, { flat: '#2A2724', flatOpacity: 0.92 })],
    pxOver: `${T(34, 62, 'YOU CHOSE', { fam: 'mono', size: 11.5, fill: C.rust, ls: 2 })}${T(34, 90, 'Ask through the door about Mark', { fam: 'serif', size: 17, fill: '#6F665C' })}${T(34, 150, 'AND I…', { fam: 'mono', size: 11.5, fill: C.rust, ls: 2 })}${wrap(34, 184, 'didn’t open the thread. I waited until Ana came out of the shower and asked who Mark was.', 300, { size: 24, fam: 'serif', fill: C.text, lh: 1.3 })}` }));
  caps.push(cap(p.x, p.y + TH + 34, 7, 'Author', 'The room is now a graphite drawing; the figure you were is flat ink. The author’s first-person words are the only large thing on the page. Hero silhouette → testimony.', TW));
}
{
  const p = f(7);
  tiles.push(`<g transform="translate(${p.x} ${p.y})"><rect width="${TW}" height="${TH}" fill="none" stroke="${C.graphite}" stroke-opacity=".35" stroke-dasharray="4 6"/>
  ${T(26, 44, 'DO NOT', { fam: 'mono', size: 12, fill: C.rust, ls: 2 })}
  ${wrap(26, 74, 'Guilt-coded light (red/green split, sinister underlight). Anyone staring at the phone. A second figure in the doorway. A held breath of silence presented as fact. Ana never appears: her absence is the source’s fact.', TW - 52, { size: 15, fill: C.text })}
  ${T(26, 214, 'NEUTRALITY CHECK', { fam: 'mono', size: 12, fill: C.rust, ls: 2 })}
  ${wrap(26, 244, 'A viewer shown only frames 1–5 with the text hidden should not be able to say whether the hero is “right” to look. The lamp is warm because lamps are; the cold seam is a bathroom.', TW - 52, { size: 15, fill: C.muted })}</g>`);
}

const body = tiles.join('') + caps.join('');
const H = 270 + 470 * 2 - 30 + 60;
await save('board-03-apartment', frameBoard({ W, H, eyebrow: 'A · APARTMENT · INTIMATE BOUNDARY', title: 'Ana’s phone', sub: 'Fictional editorial story for QA (existing V2 fixture). Seven beats on one plate: the camera is only a crop of the room; the painted region follows attention.', body, foot: 'ART-DIRECTION PROOF · GENERATED FROM A SMALL KIT · NOT FINAL ART' }), W, H);
