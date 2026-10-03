import { C, pencilRing, marginNote, commitMark, R, P, E } from './kit.mjs';
import { figure } from './figure.mjs';
import { tile, fin } from './compose.mjs';
import { hallway } from './plates.mjs';
import { frameBoard, save, T, wrap, cap } from './board.mjs';

const W = 2400, TW = 528, TH = 330, GX = 56, X0 = 60;
const f = (n) => ({ x: X0 + (n % 4) * (TW + GX), y: 270 + Math.floor(n / 4) * 470 });
const wide = [0, 0, 1000, 625];
const T0 = [], caps = [];
const add = (n, t, title, d) => { const p = f(n); T0.push(tile({ ...p, w: TW, h: TH, plate: hallway, ...t })); caps.push(cap(p.x, p.y + TH + 34, n + 1, title, d, TW)); };
const bag = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-16 0 Q-18 -24 -4 -28 H8 Q20 -24 17 0 Z" fill="#6E5A46"/><rect x="-10" y="-14" width="22" height="9" fill="#54432F"/><path d="M-6 -28 Q2 -40 10 -28" stroke="#3E3022" stroke-width="3" fill="none"/><circle cx="14" cy="-6" r="4" fill="#C8B58A"/></g>`;
const hero = (pose, x, y, h, facing = 1, o = {}) => figure(x, y, h, pose, 'hero', facing, { light: 1, rim: '#CFE9EE', ...o });
const cap_ = (s) => T(26, TH - 22, s, { fam: 'serif', style: 'italic', size: 17, fill: '#3A332D' });

add(0, { state: { liftLit: true }, crop: wide, finish: fin(wide, { l: .05, t: -.1, r: .05, b: .2 }), figures: [hero('stand', 300, 590, 230, 1, { dim: 0 }), bag(500, 405, 1.1)],
  pxOver: cap_('2 a.m. The lift opens on an empty car.') },
  'Establishing', 'One-point corridor, two tired practicals, a lit car at the end. The only warm mass is the hero’s coat; the only thing in the car is a bag. No figure, no shadow, no flicker.');
add(1, { state: { liftLit: true }, crop: [300, 90, 520, 325], finish: fin([300, 90, 520, 325], { l: .03, t: .03, r: .03, b: .18 }), figures: [bag(500, 405, 1.1)],
  over: [pencilRing(596, 262, 14, 14, 4, '#E7E0D2', 1.2, .8), marginNote(596, 250, 'Nine is two floors up', { dx: 30, dy: -60, size: 17 })],
  pxOver: cap_('The call button is lit. Ventilation, nothing else.') },
  'Environmental observation', 'The corridor tells you where you are: floor number, the neighbour’s door two floors up. Each fact is a graphite note on the thing it describes. Ventilation is room tone, not a threat.');
add(2, { state: { liftLit: true }, crop: wide, finish: fin(wide, { l: .04, t: -.1, r: .04, b: .2 }),
  figures: [hero('walk', 215, 610, 240, 1, { flat: '#6a6358', flatOpacity: .25 }), hero('walk', 290, 560, 215, 1, { flat: '#6a6358', flatOpacity: .4 }), hero('walk', 370, 520, 195, 1), bag(500, 405, 1.1)],
  pxOver: cap_('Footsteps on tile, then carpet.') },
  'Player movement', 'Tap anywhere on the floor: the camera holds, the body crosses it. (Onion-skin shows the walk; in play it is simply movement.) Scale falls with depth along a fixed floor projection.');
const bc = [380, 190, 300, 187];
add(3, { state: { liftLit: true }, crop: bc, finish: fin(bc, { l: .03, t: .03, r: .03, b: .2 }), hard: true,
  figures: [`<g transform="translate(500 394) scale(3.2)"><path d="M-16 0 Q-18 -24 -4 -28 H8 Q20 -24 17 0 Z" fill="#6E5A46"/><rect x="-10" y="-14" width="22" height="9" fill="#54432F"/><path d="M-6 -28 Q2 -40 10 -28" stroke="#3E3022" stroke-width="3" fill="none"/><circle cx="14" cy="-6" r="4" fill="#C8B58A"/><path d="M14 -6 q8 6 4 14" stroke="#9A8A66" stroke-width="1.2" fill="none"/><rect x="16" y="6" width="6" height="8" fill="#E8DFC8"/></g>`],
  over: [pencilRing(500, 372, 44, 40, 5, '#E7E0D2', 1.4, .85), marginNote(470, 350, 'Keys. A tag with a 9.', { dx: -40, dy: -70, size: 17, anchor: 'end' })],
  pxOver: cap_('The keys look like the ones from the ninth floor.') },
  'Interaction', 'Looking closer is an insert: the bag is its own prop plate, the key tag carries real text. The mark is a pencil loop; there is no “pick up” yet.');
add(4, { state: { liftLit: true }, crop: [260, 130, 520, 325], finish: fin([260, 130, 520, 325], { l: .03, t: .03, r: .03, b: .16 }),
  figures: [bag(500, 405, 1.2), hero('hesitate', 420, 520, 270, 1)],
  pxOver: cap_('Two in the morning. I don’t know her well.') },
  'Hesitation', 'Hand part-raised toward the car, weight on the back foot, the lift’s cold light on fingers and face plane. The threshold is the picture; nothing moves behind the player.');
add(5, { state: { liftLit: true }, crop: [260, 130, 520, 325], finish: fin([260, 130, 520, 325], { l: .03, t: .1, r: .03, b: .12 }),
  figures: [bag(500, 405, 1.2), hero('reach', 420, 520, 270, 1)], over: [commitMark(446, 330, 110, 100, 'Take the keys up to nine', { size: 15 })] },
  'Decision', 'The rust bracket appears only once the intent is chosen. The sentence names the physical act. A separate confirm. Walking away is a different, equally explicit act.');
add(6, { state: { liftLit: true }, crop: wide, finish: [[500, 300, 300, 250, 40]], figures: [hero('freeze', 420, 560, 240, 1), bag(500, 405, 1.1)],
  over: [R(430, 176, 70, 224, '#9FB3B7', .95, { nl: true })],
  pxOver: cap_('The doors begin to close.') },
  'Transition', 'The lift doors close on the held frame; the slit between them is paper-coloured. When they meet, the page is already there.');
{
  const p = f(7);
  T0.push(`<g transform="translate(${p.x} ${p.y})"><rect width="${TW}" height="${TH}" fill="${C.paper}"/><rect width="${TW}" height="${TH}" filter="url(#paperMottle)" opacity=".3"/>
  <rect x="${TW / 2 - 4}" y="0" width="8" height="${TH}" fill="#16202A" opacity=".9"/><rect x="0" y="0" width="${TW / 2 - 4}" height="${TH}" fill="#9FB3B7" opacity=".14"/>
  ${T(34, 62, 'YOU CHOSE', { fam: 'mono', size: 11.5, fill: C.rust, ls: 2 })}${T(34, 88, 'Take the keys up to nine', { fam: 'serif', size: 17, fill: '#6F665C' })}${T(34, 138, 'AND I…', { fam: 'mono', size: 11.5, fill: C.rust, ls: 2 })}${wrap(34, 172, 'left the bag where it was and knocked on nobody’s door. I stood there until the doors closed.', 250, { size: 21, fam: 'serif', fill: C.text, lh: 1.3 })}</g>`);
  caps.push(cap(p.x, p.y + TH + 34, 8, 'Reveal', 'Author text set on the paper the doors opened onto. (Invented author words for this board.)', TW));
}
const H = 270 + 470 * 2 - 30 + 60;
await save('board-05-night', frameBoard({ W, H, eyebrow: 'C · NIGHT HALLWAY · UNCERTAINTY', title: 'The bag in the lift', sub: 'Fictional editorial story for QA. Uncertainty comes from what the story does not say, not from added danger: no figure in the dark, no sting, no flicker, no red.', body: T0.join('') + caps.join(''), foot: 'ART-DIRECTION PROOF · GENERATED FROM A SMALL KIT · NOT FINAL ART' }), W, H);
