import { C, pencilRing, marginNote, commitMark } from './kit.mjs';
import { figure, backFigure } from './figure.mjs';
import { tile, fin } from './compose.mjs';
import { office } from './plates.mjs';
import { frameBoard, save, T, wrap, cap } from './board.mjs';

const W = 2400, TW = 528, TH = 330, GX = 56, X0 = 60;
const px = (i) => X0 + i * (TW + GX);
const f = (n) => ({ x: px(n % 4), y: 270 + Math.floor(n / 4) * 470 });
const wide = [0, 0, 1000, 625];
const room = () => [
  backFigure(330, 392, 92, 'bg', { rim: true }), backFigure(480, 388, 92, 'dir', { rim: true }),
  backFigure(640, 388, 92, 'bg', { rim: true }), backFigure(760, 392, 92, 'other', { rim: true }),
  figure(560, 330, 120, 'stand', 'mira', -1, { light: 1, rim: '#CFE9EE' }),
];
const slideTxt = `<text x="332" y="82" font-family="Inter" font-weight="600" font-size="14" fill="#1F3340">Q4 forecast</text><text x="332" y="134" font-family="Inter" font-size="9" fill="#365462">presented by Mira Hale</text>`;
const hero = (pose, x = 150, y = 540, h = 205, o = {}) => figure(x, y, h, pose, 'hero', 1, { light: 1, rim: '#CFE9EE', held: { kind: 'summary' }, ...o });
const T0 = [];
const caps = [];
const add = (n, t, title, d) => { const p = f(n); T0.push(tile({ ...p, w: TW, h: TH, plate: office, ...t })); caps.push(cap(p.x, p.y + TH + 34, n + 1, title, d, TW)); };

add(0, { crop: wide, finish: fin(wide, { l: .05, t: .05, r: -.1, b: .2 }), figures: [...room(), hero('stand')], over: [slideTxt],
  pxOver: T(26, TH - 22, 'Mira presents the forecast. I built it.', { fam: 'serif', style: 'italic', size: 17, fill: '#3A332D' }) },
  'Establishing', 'A long room, one bright plane. The screen is the brightest thing; the protagonist stands against the side wall with a printed summary. Seated colleagues are backs of heads, tone-on-tone with the chairs.');

const sight = `<g stroke="#3A332D" stroke-width="1.2" stroke-dasharray="5 6" fill="none" opacity=".75"><path d="M330 330 L440 190"/><path d="M480 326 L470 190"/><path d="M640 326 L520 190"/><path d="M760 330 L560 190"/><path d="M560 262 L500 190"/></g><g stroke="${C.rust}" stroke-width="1.6" fill="none" opacity=".9"><path d="M170 380 L300 190" stroke-dasharray="2 5"/></g>`;
add(1, { crop: wide, finish: fin(wide, { l: .05, t: .05, r: .05, b: .2 }), figures: [...room(), hero('stand')], over: [slideTxt, sight],
  pxOver: T(26, TH - 22, 'Every line points at the screen. None points at me.', { fam: 'serif', style: 'italic', size: 17, fill: '#3A332D' }) },
  'Social geometry', 'Annotation, not in-game: everyone’s attention runs to the screen; the protagonist’s runs to the same place along the rust line. The discomfort is composition and distance. Nobody turns.');

const sc = [300, 30, 440, 275];
add(2, { crop: sc, finish: fin(sc, { l: .02, t: .03, r: .02, b: .2 }), hard: true, figures: [], over: [slideTxt,
  `<path d="M392 202 L420 180 L470 192 L540 146" stroke="${C.rust}" stroke-width="3" fill="none" opacity=".9"/>`,
  pencilRing(540, 146, 16, 12, 3, '#1F3340', 1.4, .8)],
  pxOver: T(26, TH - 22, 'The revision I made last night.', { fam: 'serif', style: 'italic', size: 17, fill: '#3A332D' }) },
  'Hero object', 'The slide is a prop plate with real text, never baked art. One graphite loop sits on the point the protagonist recognises. Inspecting it states a fact; it does not accuse.');

const c4 = [20, 150, 520, 325];
add(3, { crop: c4, finish: fin(c4, { l: .04, t: .04, r: .04, b: .06 }), figures: [figure(150, 540, 330, 'lowerGaze', 'hero', 1, { light: 1, rim: '#CFE9EE', held: { kind: 'summary' } })], over: [],
  pxOver: '' },
  'Protagonist awareness', 'Close, still, hands forward. The screen’s cold light catches the hands and the face plane; the head is lowered a few degrees. Awareness is posture, not an expression.');

add(4, { crop: wide, finish: fin(wide, { l: .05, t: .05, r: .05, b: .2 }), figures: [...room(), hero('hesitate')], over: [slideTxt,
  marginNote(170, 300, 'Say it’s my work', { dx: 30, dy: -34, size: 20 }),
  marginNote(190, 400, 'Ask Mira after', { dx: 40, dy: 60, size: 20 }),
  marginNote(150, 480, 'Say nothing', { dx: 60, dy: 70, size: 20 })] },
  'Possible intervention', 'Three phrases hang beside the person who would say them. Selecting one only underlines it in graphite and pulls the camera two steps nearer; the room does not react.');

add(5, { crop: wide, finish: fin(wide, { l: .05, t: .05, r: .05, b: .2 }), figures: [...room(), hero('raiseHand')], over: [slideTxt, commitMark(90, 330, 130, 215, 'Say the forecast is my work', { size: 16 })],
  pxOver: '' },
  'Physical act', 'Confirm is separate from the act. The hand rises to shoulder height; the head comes up. Everyone else keeps their authored, neutral pose.');

add(6, { crop: wide, finish: [[500, 300, 420, 260, 40]], figures: [...room(), hero('freeze', 150, 540, 205, { held: { kind: 'summary' } })], over: [slideTxt],
  pxOver: T(26, TH - 22, 'Where your version stops. Nobody answers.', { fam: 'serif', style: 'italic', size: 17, fill: '#3A332D' }) },
  'Stop before invented reaction', 'Hand still up; the room is held exactly as it was. No head turns, no stare, no applause. Paint withdraws from the edges; the boundary is the picture simply ceasing.');

{
  const p = f(7);
  T0.push(tile({ ...p, w: TW, h: TH, plate: office, crop: wide, finish: [[170, 380, 90, 170, 30]], hard: true, figures: [figure(150, 540, 205, 'raiseHand', 'hero', 1, { flat: '#2A2724', flatOpacity: .92 })],
    pxOver: `${T(250, 62, 'YOU CHOSE', { fam: 'mono', size: 11.5, fill: C.rust, ls: 2 })}${T(250, 88, 'Say the forecast is my work', { fam: 'serif', size: 17, fill: '#6F665C' })}${T(250, 138, 'AND I…', { fam: 'mono', size: 11.5, fill: C.rust, ls: 2 })}${wrap(250, 172, 'said, “I built the forecast, and I can explain the revision.” My voice shook.', 250, { size: 22, fam: 'serif', fill: C.text, lh: 1.3 })}` }));
  caps.push(cap(p.x, p.y + TH + 34, 8, 'Reveal', 'Same body, now ink. The author’s words are the largest thing. Aftermath (“she stopped inviting me”) is withheld until the reader asks for it.', TW));
}
const H = 270 + 470 * 2 - 30 + 60;
await save('board-04-office', frameBoard({ W, H, eyebrow: 'B · OFFICE · PUBLIC SOCIAL TENSION', title: 'The forecast', sub: 'Fictional editorial story for QA. Public geometry without hostile NPCs: the pressure is distance, the brightness of the screen, and being the only person standing against a wall.', body: T0.join('') + caps.join(''), foot: 'ART-DIRECTION PROOF · GENERATED FROM A SMALL KIT · NOT FINAL ART' }), W, H);
