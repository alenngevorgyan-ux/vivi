import { C } from './kit.mjs';
import { figure, FAMILY } from './figure.mjs';
import { frameBoard, save, T, wrap } from './board.mjs';

const W = 2400;
const parts = [];
const list = [
  ['neutral', 'Neutral', 'Breath and slow weight shift. The baseline everything returns to.'],
  ['notice', 'Notice', 'Head leads, shoulders follow 200 ms later.'],
  ['listen', 'Listen', 'Weight forward, one arm folds in, head tilts a few degrees.'],
  ['hesitate', 'Hesitate', 'Weight back, hand half-lifted and held.'],
  ['avoid', 'Avoid', 'Torso turned off-axis, gaze lowered, arms close.'],
  ['turnToward', 'Turn toward', 'Feet last. Chest opens to the target.'],
  ['turnAway', 'Turn away', 'Shoulder first; the back becomes the message.'],
  ['reach', 'Reach', 'Lean from the hip; hand arrives before the arm straightens.'],
  ['stopHand', 'Stop hand', 'Palm out at chest height; body leans back.'],
  ['sit', 'Sit', 'Hip drops to 27 units; feet planted; hands rest.'],
  ['stand', 'Stand', 'Upright, equal weight. Rise is a 600 ms clip.'],
  ['raiseHand', 'Raise hand', 'Arm travels to shoulder height and holds.'],
  ['speak', 'Speak', 'Hands open, small lean; no mouth, never lip-sync.'],
  ['wait', 'Wait', 'Hands low and clasped; slow weight shift.'],
  ['leave', 'Leave', 'Stride starts from the hip; head last.'],
  ['returnP', 'Return', 'Slower stride, gaze lowered, arrives off-centre.'],
  ['freeze', 'Freeze', 'Every oscillator stops. A stillness that is visible.'],
  ['lowerGaze', 'Lower gaze', 'Head pitch +22°, shoulders drop 2 units.'],
  ['lookAtOther', 'Look at another', 'Pairs with a second figure; yaw locks to them.'],
  ['phone', 'Look at phone', 'Both hands rise; head drops toward the light.'],
  ['sitForward', 'Lean in (seated)', 'Seated variant of notice / listen.'],
];
const cw = 300, ch = 330, x0 = 60, y0 = 240;
list.forEach(([k, name, d], i) => {
  const cx = x0 + (i % 7) * (cw + 30), cy = y0 + Math.floor(i / 7) * (ch + 40);
  parts.push(`<rect x="${cx}" y="${cy}" width="${cw}" height="${ch - 70}" fill="#1E2735"/><rect x="${cx}" y="${cy + ch - 150}" width="${cw}" height="80" fill="#2A2F3E"/>`);
  parts.push(`<ellipse cx="${cx + 90}" cy="${cy + 120}" rx="140" ry="120" fill="url(#gLamp)" opacity=".5" style="mix-blend-mode:screen"/>`);
  if (k === 'sit' || k === 'sitForward') parts.push(`<rect x="${cx + 70}" y="${cy + 150}" width="90" height="10" fill="#4A4F5E"/><rect x="${cx + 80}" y="${cy + 160}" width="8" height="52" fill="#3A3F4E"/><rect x="${cx + 142}" y="${cy + 160}" width="8" height="52" fill="#3A3F4E"/>`);
  parts.push(figure(cx + 125, cy + ch - 82, 175, k, 'hero', 1, { light: -1, rim: '#FFC983' }));
  if (k === 'lookAtOther') parts.push(figure(cx + 235, cy + ch - 82, 170, 'neutral', 'other', -1, { light: 1 }));
  parts.push(T(cx, cy + ch - 40, name, { weight: 600, size: 15 }));
  parts.push(wrap(cx, cy + ch - 20, d, cw - 6, { size: 12.5 }));
});

// same clips, different timing
const ry = y0 + 3 * (ch + 40) + 20;
parts.push(T(60, ry, 'EMOTIONAL VARIATION FROM THE SAME CLIPS: order, hold, and distance', { fam: 'mono', size: 12, fill: C.rust, ls: 2 }));
const rows = [
  ['Decided', ['stand', 'reach', 'reach'], 'notice → reach, no hold. 0.4 s.'],
  ['Doubting', ['notice', 'reach', 'hesitate'], 'reach, stop, hold 1.4 s, retract half, hold again.'],
  ['Ashamed', ['lowerGaze', 'lowerGaze', 'reach'], 'lower gaze first, 0.8 s, then a smaller reach with the body turned away.'],
  ['Guarded', ['stopHand', 'avoid', 'turnAway'], 'stop hand, then turn away: the same clips as “refusal”, with distance doubled.'],
];
rows.forEach((r, i) => {
  const y = ry + 30 + i * 150;
  parts.push(T(60, y + 70, r[0], { fam: 'serif', size: 24 }));
  r[1].forEach((k, j) => {
    const x = 300 + j * 190;
    parts.push(`<rect x="${x - 30}" y="${y - 6}" width="170" height="130" fill="#1E2735"/>`);
    parts.push(figure(x + 48, y + 118, 110, k, 'hero', 1, { light: -1 }));
    parts.push(`<path d="M${x + 150} ${y + 60} h26" stroke="${C.rust}" stroke-width="1.6"/>`);
  });
  parts.push(wrap(900, y + 56, r[2], 600, { size: 15, fill: C.text }));
});
// families
const fy = ry + 30 + 4 * 150 + 20;
parts.push(T(60, fy, 'FAMILIES (silhouette, build, clothing). The hero is always the warmest mass; others are cooler and lower in chroma', { fam: 'mono', size: 12, fill: C.rust, ls: 2 }));
['hero', 'mira', 'dir', 'other', 'warm', 'bg'].forEach((k, i) => {
  const x = 120 + i * 360;
  parts.push(`<rect x="${x - 70}" y="${fy + 20}" width="250" height="230" fill="#1E2735"/>`);
  parts.push(figure(x + 50, fy + 230, 190, 'neutral', k, 1, { light: -1 }));
  parts.push(T(x + 160, fy + 270, k, { fam: 'mono', size: 12, anchor: 'end', fill: C.muted }));
});
const H = fy + 330;
await save('board-07-characters', frameBoard({ W, H, eyebrow: 'CHARACTER LANGUAGE', title: 'A body-language vocabulary', sub: 'Twenty-one reusable poses solved from joint angles. No facial animation. Emotion comes from weight, orientation, hands, timing and distance. Faces are a lighter plane that turns; hands are the only drawn detail.', body: parts.join(''), foot: 'ART-DIRECTION PROOF · GENERATED FROM A SMALL KIT · NOT FINAL ART' }), W, H);
