import { C, pencilRing, marginNote, commitMark } from './kit.mjs';
import { figure } from './figure.mjs';
import { tile, fin } from './compose.mjs';
import { apartment } from './plates.mjs';
import { frameBoard, save, T, wrap, cap } from './board.mjs';

const W = 2400, TW = 528, TH = 330, GX = 56, X0 = 60;
const f = (n) => ({ x: X0 + (n % 4) * (TW + GX), y: 260 + Math.floor(n / 4) * 470 });
const crop = [230, 210, 640, 400];
const phone = (lit) => `<g transform="translate(560 416)"><path d="M-15 -5 L12 -5 L15 4 L-17 4 Z" fill="${lit ? '#D6EDF1' : '#14181F'}"/></g>`;
const T0 = [], caps = [];
const add = (n, st, fig, over, title, d, px = '') => { const p = f(n); T0.push(tile({ ...p, w: TW, h: TH, plate: apartment, state: st, crop, finish: fin(crop, { l: .04, t: .04, r: -.05, b: .12 }), figures: fig, over, pxOver: px })); caps.push(cap(p.x, p.y + TH + 34, n + 1, title, d, TW)); };
const hero = (pose, x = 340, o = {}) => figure(x, 500, 190, pose, 'hero', 1, { light: -1, ...o });
add(0, {}, [hero('neutral'), phone(false)], [], 'Dormant', 'No mark. The object is simply in the room, drawn like everything else. Nothing glows, nothing pulses.');
add(1, { phone: true }, [hero('notice'), phone(true)], [], 'Pulled attention', 'The world gives the cue: the phone lights, the head turns, the camera drifts. Local contrast and spatial sound are the only “highlight”.');
add(2, { phone: true }, [hero('notice', 420), phone(true)], [pencilRing(560, 414, 40, 20, 1, '#E7E0D2', 1.4, .8)], 'Near: the pencil loop', 'Within reach, a loose graphite loop draws itself in 240 ms. It is not a button: it is how a drawing marks what it is about.');
add(3, { phone: true }, [hero('notice', 420), phone(true)], [pencilRing(560, 414, 40, 20, 1, '#E7E0D2', 1.4, .8), marginNote(560, 404, 'Ana’s phone', { dx: 30, dy: -70, size: 20 })], 'Hover / focus: the label', 'A two-word italic note and a leader. Touch gets the same note on a 300 ms hold. Always in the DOM for screen readers.');
add(4, { phone: true }, [hero('hesitate', 420), phone(true)], [pencilRing(560, 414, 40, 20, 1, '#E7E0D2', 1.4, .9), marginNote(560, 404, 'Open the thread', { dx: -20, dy: -60, size: 20, anchor: 'middle' }), `<path d="M505 340 H615" stroke="#E7E0D2" stroke-width="2" opacity=".9" filter="url(#pen)"/>`], 'Intent chosen', 'Selecting underlines the phrase in graphite. This is still reversible: Esc, tap elsewhere, or walk away. The frame is not yet rust.');
add(5, { phone: true }, [hero('reach', 420), phone(true)], [commitMark(488, 380, 150, 70, 'Open the thread', { size: 16 })], 'Commit pending', 'The only rust-ink mark. Its sentence names the physical act. A second, deliberate confirm follows (Enter after release / “Hold to do this”). Exploring can never reach this state by accident.');

const mx = f(6);
T0.push(`<g transform="translate(${mx.x} ${mx.y})"><rect width="${TW * 2 + GX}" height="${TH + 20}" fill="none" stroke="${C.graphite}" stroke-opacity=".35" stroke-dasharray="4 6"/>
${T(26, 42, 'OBSERVATION  vs  COMMITMENT', { fam: 'mono', size: 12, fill: C.rust, ls: 2 })}
${['', 'Material', 'Geometry', 'Type', 'Timing', 'Sound', 'Undo', 'Input'].map((t, i) => T(26, 76 + i * 34, t, { size: 13, weight: 600, fill: C.muted })).join('')}
${T(190, 76, 'OBSERVATION', { fam: 'mono', size: 12, fill: C.text, ls: 1.5 })}${T(630, 76, 'COMMITMENT', { fam: 'mono', size: 12, fill: C.rust, ls: 1.5 })}
${[['graphite pencil, cream italic', 'rust ink, heavy, flat'], ['loose loop, leader line', 'closed bracket at four corners'], ['serif italic, 2–4 words', 'sans, a full verb phrase'], ['fades in 240 ms, out on leave', 'appears only after a chosen intent'], ['soft paper brush, no pitch', 'low wooden tick, once'], ['always (leave, Esc, tap away)', 'never after confirm; skip only fast-forwards'], ['tap / hover / focus / Enter', 'tap + separate confirm / Enter after release']].map((r, i) => T(190, 110 + i * 34, r[0], { size: 14, fill: C.text }) + T(630, 110 + i * 34, r[1], { size: 14, fill: C.text })).join('')}
${T(26, 380, 'Retired: glowing dots, pulse rings, sparkles, “!” badges, floating pill buttons, an action grid beside the world.', { size: 14, fill: C.muted })}
</g>`);
const H = 260 + 470 * 2 + 20;
await save('board-08-interaction', frameBoard({ W, H, eyebrow: 'INTERACTION LANGUAGE', title: 'Noticing is drawn. Deciding is inked.', sub: 'One object (a phone) through every state. Discovery is staged by the world first (light, gaze, camera, sound), then marked the way a drawing would mark it. Observation and commitment never share a material.', body: T0.join('') + caps.join(''), foot: 'ART-DIRECTION PROOF · GENERATED FROM A SMALL KIT · NOT FINAL ART' }), W, H);
