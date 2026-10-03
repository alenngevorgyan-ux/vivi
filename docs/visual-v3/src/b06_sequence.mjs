import { C, pencilRing, R } from './kit.mjs';
import { figure } from './figure.mjs';
import { tile, fin } from './compose.mjs';
import { apartment, hallway, elevator, street, destination } from './plates.mjs';
import { frameBoard, save, T, wrap, cap } from './board.mjs';

const W = 2400, TW = 410, TH = 285, GAP = 56, X0 = 60;
const env = { kind: 'envelope' };
const hero = (pose, x, y, h, o = {}) => figure(x, y, h, pose, 'hero', 1, { held: env, light: 1, ...o });
const cap_ = (s) => T(22, TH - 20, s, { fam: 'serif', style: 'italic', size: 16, fill: '#3A332D' });
const wide = [0, 0, 1000, 625];
const ys = 250;
const X = (i) => X0 + i * (TW + GAP);
const parts = [];

// five places
const places = [
  { plate: apartment, st: { door: 'closed' }, crop: [420, 60, 580, 362], fig: [hero('stand', 900, 470, 215, { rim: '#FFC983' })], fin: [-.05, -.1, -.05, .2], txt: 'Coat on. The lamp stays behind.', name: 'Apartment', note: 'Warm lamp, plum wall. Safe, private.' },
  { plate: hallway, st: { liftLit: false }, crop: wide, fig: [hero('walk', 330, 590, 240, { rim: '#CFE9EE' })], fin: [.05, -.1, .05, .2], txt: 'The corridor. Nobody about.', name: 'Hallway', note: 'Cold fluorescent. Transit.' },
  { plate: elevator, st: {}, crop: wide, fig: [figure(560, 600, 330, 'wait', 'hero', 1, { held: env, light: 1, rim: '#CFE9EE' })], fin: [.05, -.1, .05, .2], txt: 'Seven floors. I read the name on it again.', name: 'Elevator', note: 'Enclosed, neutral. Held breath.' },
  { plate: street, st: {}, crop: wide, fig: [hero('walk', 300, 560, 190, { rim: '#FFC983' })], fin: [.05, -.1, .05, .2], txt: 'Cold air. One window lit down the road.', name: 'Street', note: 'Open, sodium. Distance.' },
  { plate: destination, st: {}, crop: [0, 40, 1000, 625], fig: [hero('hesitate', 520, 560, 250, { rim: '#FFC983' })], fin: [.05, -.1, .05, .2], txt: 'The door is lit. Nobody has seen me yet.', name: 'Destination', note: 'The warmest light in the sequence, and it is not mine.' },
];
places.forEach((p, i) => {
  const [l, t, r, b] = p.fin;
  parts.push(tile({ x: X(i), y: ys, w: TW, h: TH, plate: p.plate, state: p.st, crop: p.crop, finish: fin(p.crop, { l, t, r, b, rx: .1 }), figures: p.fig, pxOver: cap_(p.txt) }));
  parts.push(T(X(i), ys + TH + 36, `${i + 1}  ${p.name}`, { weight: 600, size: 15 }));
  parts.push(wrap(X(i), ys + TH + 58, p.note, TW, { size: 13.5 }));
  if (i < 4) parts.push(`<path d="M${X(i) + TW + 14} ${ys + TH / 2} h30 m-8 -7 l8 7 l-8 7" stroke="${C.rust}" stroke-width="2" fill="none"/>`);
});

// transitions: the world un-paints, the body and the envelope never do
const ty = 760;
const TH2 = 240, TW2 = 410;
const pairs = [[apartment, hallway, 'door → threshold'], [hallway, elevator, 'match cut on the lift door'], [elevator, street, 'doors open onto weather'], [street, destination, 'continuous walk']];
const wipe = (a, b, i) => {
  const c = wide;
  const A = tile({ x: X(i), y: ty, w: TW2, h: TH2, plate: a, crop: c, state: {}, finish: [[0, 0, 520, 600, 50]], hard: false });
  const B = tile({ x: X(i), y: ty, w: TW2, h: TH2, plate: b, crop: c, state: {}, finish: [[480, 20, 560, 600, 50]], paper: 'none', lines: true, bare: true,
    figures: [hero('walk', 500, 560, 220, { rim: '#FFC983' })] });
  return `${A}${B.replace(/<rect width="[0-9]+" height="[0-9]+" fill="#ECE4D5"\/>/, '')}`;
};
pairs.forEach((p, i) => {
  parts.push(wipe(p[0], p[1], i));
  parts.push(T(X(i), ty + TH2 + 30, `T${i + 1}  ${p[2]}`, { weight: 600, size: 14 }));
});
// 5th slot: the rules
parts.push(`<g>${T(X(4), ty + 16, 'THE RULE OF THE WASH', { fam: 'mono', size: 12, fill: C.rust, ls: 2 })}${wrap(X(4), ty + 46, 'Rooms un-paint to graphite and re-paint. The body and the carried envelope stay finished through every handoff. The viewer’s eye follows the only things that persist.', TW, { size: 15, fill: C.text })}</g>`);

// continuity chips and timelines
const cy = 1100;
parts.push(T(60, cy, 'CONTINUITY', { fam: 'mono', size: 12, fill: C.rust, ls: 2 }));
const chips = [['#ECE4D5', 'paper ground'], ['#161B26', 'ink'], ['#C58A3E', 'coat — warmest mass'], ['#F1E8D4', 'envelope — hero prop'], ['#B5523B', 'rust — decisions & author only']];
chips.forEach((c, i) => parts.push(`<rect x="${60 + i * 250}" y="${cy + 20}" width="56" height="56" fill="${c[0]}" stroke="#4A4A48" stroke-opacity=".4"/>${wrap(60 + i * 250 + 68, cy + 40, c[1], 160, { size: 13.5, fill: C.text })}`));
// light progression strip
parts.push(T(60, cy + 128, 'LIGHT PROGRESSION', { fam: 'mono', size: 12, fill: C.rust, ls: 2 }));
parts.push(`<defs><linearGradient id="lp"><stop offset="0" stop-color="#F0B36A"/><stop offset=".22" stop-color="#8FA0A0"/><stop offset=".4" stop-color="#B8C5C4"/><stop offset=".62" stop-color="#2D3A55"/><stop offset=".8" stop-color="#E08A3C" stop-opacity=".9"/><stop offset="1" stop-color="#F4CE92"/></linearGradient></defs><rect x="60" y="${cy + 148}" width="2280" height="22" fill="url(#lp)"/>`);
['warm private lamp', 'cold fluorescent', 'neutral lift strip', 'cold night + sodium', 'one warm window ahead'].forEach((s, i) => parts.push(T(60 + i * 450, cy + 194, s, { size: 13.5, fill: C.muted })));
// sound handoff lanes
parts.push(T(60, cy + 236, 'SOUND HANDOFF (beds crossfade over the cut; one-shots belong to events, not rooms)', { fam: 'mono', size: 12, fill: C.rust, ls: 2 }));
const lanes = [['room tone', [[0, 24], [20, 44]], '#B9A27A'], ['door / latch', [[16, 22]], '#8E8274'], ['steps', [[22, 40], [60, 100]], '#8E8274'], ['lift hum', [[38, 66]], '#7C8E92'], ['street air', [[62, 100]], '#7C8E92'], ['destination bed', [[82, 100]], '#C79F6B']];
lanes.forEach((l, i) => {
  parts.push(T(60, cy + 272 + i * 26, l[0], { size: 12.5, fill: C.muted }));
  l[1].forEach(([a, b]) => parts.push(`<rect x="${210 + a * 21}" y="${cy + 260 + i * 26}" width="${(b - a) * 21}" height="12" rx="6" fill="${l[2]}" opacity=".8"/>`));
});
// cut vs continuous
parts.push(T(60, cy + 450, 'CUT vs CONTINUOUS', { fam: 'mono', size: 12, fill: C.rust, ls: 2 }));
parts.push(wrap(60, cy + 478, 'Continuous (movement carries): apartment → hallway through the door; street → destination along one walk. Cut (a change of knowledge): hallway → lift is a match cut on the door seam; lift → street is a cut with the same rider position. A location change never loses the body, the envelope, the coat, or the paper.', 2200, { size: 15, fill: C.text }));
const H = 1760;
await save('board-06-sequence', frameBoard({ W, H, eyebrow: 'MULTI-SCENE · ONE MEMORY', title: 'The envelope', sub: 'Apartment → hallway → elevator → street → destination. A fictional sequence: five locations, one coat, one envelope, one paper. The decision waits at the lit door.', body: parts.join(''), foot: 'ART-DIRECTION PROOF · GENERATED FROM A SMALL KIT · NOT FINAL ART' }), W, H);
