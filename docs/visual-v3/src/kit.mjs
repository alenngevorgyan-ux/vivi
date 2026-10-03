// Vivi Visual Language V3 — board toolkit.
// Art-direction proofs only: these boards are generated from a small kit of
// primitives so that composition, light, framing and typography can be judged.
// They are NOT final art. See docs/VIVI_VISUAL_LANGUAGE_V3.md §"What these boards are".

export const C = {
  paper: '#ECE4D5', paperDeep: '#E2D8C5', graphite: '#4A4A48', ink: '#161B26',
  rust: '#B5523B', rustDeep: '#8E3D2B', coat: '#C58A3E', amber: '#F0B36A', cold: '#BFE0E6',
  text: '#202629', muted: '#7A7167',
};

let uidN = 0;
export const uid = (p = 'u') => `${p}${++uidN}`;
const f1 = (n) => Math.round(n * 10) / 10;

/* ------------------------------------------------------------- shared defs */
export function defs() {
  return `<defs>
  <filter id="paint" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.018 0.026" numOctaves="3" seed="4" result="warp"/>
    <feDisplacementMap in="SourceGraphic" in2="warp" scale="7" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="3" seed="11" result="g"/>
    <feColorMatrix in="g" type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 0 1" result="gg"/>
    <feComponentTransfer in="gg" result="gt"><feFuncR type="linear" slope="0.5" intercept="0.62"/><feFuncG type="linear" slope="0.5" intercept="0.62"/><feFuncB type="linear" slope="0.5" intercept="0.62"/></feComponentTransfer>
    <feBlend in="d" in2="gt" mode="multiply" result="b"/>
    <feComposite in="b" in2="d" operator="in"/>
  </filter>
  <filter id="pen" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="2" result="w"/><feDisplacementMap in="SourceGraphic" in2="w" scale="3.2" xChannelSelector="R" yChannelSelector="G"/></filter>
  <filter id="edge" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.016 0.02" numOctaves="4" seed="9" result="w"/><feDisplacementMap in="SourceGraphic" in2="w" scale="34" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="5"/></filter>
  <filter id="edgeHard" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.014 0.02" numOctaves="4" seed="5" result="w"/><feDisplacementMap in="SourceGraphic" in2="w" scale="20" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="1.8"/></filter>
  <filter id="blur6"><feGaussianBlur stdDeviation="6"/></filter>
  <filter id="blur14" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
  <filter id="blur30" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="30"/></filter>
  <filter id="paperTex" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.9 0.7" numOctaves="3" seed="21" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.2  0 0 0 0 0.12  0 0 0 -1.5 0.95"/>
  </filter>
  <filter id="paperMottle" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.006 0.009" numOctaves="3" seed="6" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.36  0 0 0 0 0.24  0 0 0 -1.2 0.7"/>
  </filter>
  <radialGradient id="gLamp"><stop offset="0" stop-color="#FFD39A" stop-opacity="1"/><stop offset="0.35" stop-color="#F0A857" stop-opacity=".55"/><stop offset="1" stop-color="#F0A857" stop-opacity="0"/></radialGradient>
  <radialGradient id="gCold"><stop offset="0" stop-color="#D5F0F4" stop-opacity="1"/><stop offset="0.4" stop-color="#8CC4CF" stop-opacity=".45"/><stop offset="1" stop-color="#8CC4CF" stop-opacity="0"/></radialGradient>
  <radialGradient id="gSodium"><stop offset="0" stop-color="#FFC27A" stop-opacity=".95"/><stop offset="0.4" stop-color="#E08A3C" stop-opacity=".4"/><stop offset="1" stop-color="#E08A3C" stop-opacity="0"/></radialGradient>
  <radialGradient id="gShade"><stop offset="0" stop-color="#05070D" stop-opacity=".7"/><stop offset="1" stop-color="#05070D" stop-opacity="0"/></radialGradient>
  <linearGradient id="gFloorFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05070D" stop-opacity="0"/><stop offset="1" stop-color="#05070D" stop-opacity=".55"/></linearGradient>
  <linearGradient id="gTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05070D" stop-opacity=".42"/><stop offset="1" stop-color="#05070D" stop-opacity="0"/></linearGradient>
  <linearGradient id="gBot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05070D" stop-opacity="0"/><stop offset="1" stop-color="#05070D" stop-opacity=".5"/></linearGradient>
  <linearGradient id="gSide" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#05070D" stop-opacity=".45"/><stop offset="1" stop-color="#05070D" stop-opacity="0"/></linearGradient>
  <linearGradient id="gSideR" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#05070D" stop-opacity="0"/><stop offset="1" stop-color="#05070D" stop-opacity=".45"/></linearGradient>
  <linearGradient id="gWet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFC27A" stop-opacity=".5"/><stop offset="1" stop-color="#FFC27A" stop-opacity="0"/></linearGradient>
  <filter id="cutShadow" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="4" dy="7" stdDeviation="4" flood-color="#1b1620" flood-opacity=".55"/></filter>
  <filter id="posterize" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.4 0.5 0.1 0 0  0.4 0.5 0.1 0 0  0.4 0.5 0.1 0 0  0 0 0 1 0"/><feComponentTransfer><feFuncR type="discrete" tableValues=".07 .09 .70 .93"/><feFuncG type="discrete" tableValues=".08 .09 .27 .90"/><feFuncB type="discrete" tableValues=".13 .13 .20 .82"/></feComponentTransfer></filter>
  <filter id="rimOnly" x="-10%" y="-10%" width="120%" height="120%"><feFlood flood-color="#FFC983"/><feComposite in2="SourceAlpha" operator="in"/></filter>
</defs>`;
}

/* ------------------------------------------------------------ primitives */
// Each primitive can be drawn as finished paint or as graphite construction.
export const R = (x, y, w, h, f, o = 1, opt = {}) => ({ t: 'r', x, y, w, h, f, o, ...opt });
export const P = (d, f, o = 1, opt = {}) => ({ t: 'p', d, f, o, ...opt });
export const E = (cx, cy, rx, ry, f, o = 1, opt = {}) => ({ t: 'e', cx, cy, rx, ry, f, o, ...opt });
export const poly = (pts, f, o = 1, opt = {}) => P('M' + pts.map((p) => p.join(' ')).join(' L') + ' Z', f, o, opt);

function paintEl(s) {
  const op = s.o !== 1 ? ` opacity="${s.o}"` : '';
  const bl = s.blend ? ` style="mix-blend-mode:${s.blend}"` : '';
  if (s.t === 'r') return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="${s.f}"${op}${bl}/>`;
  if (s.t === 'e') return `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" fill="${s.f}"${op}${bl}/>`;
  return `<path d="${s.d}" fill="${s.f}"${op}${bl}/>`;
}
function lineEl(s) {
  if (s.nl) return '';
  const st = `fill="none" stroke="${C.graphite}" stroke-width="${s.lw ?? 0.9}" stroke-opacity="${s.lo ?? 0.5}" stroke-linejoin="round"`;
  if (s.t === 'r') return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" ${st}/>`;
  if (s.t === 'e') return `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" ${st}/>`;
  return `<path d="${s.d}" ${st}/>`;
}
export const paintLayer = (shapes) => shapes.map(paintEl).join('');
export const lineLayer = (shapes) => shapes.map(lineEl).join('');

/* ---------------------------------------------------- hand-drawn mark bits */
// A slightly imperfect closed loop, as drawn by a pencil around an object.
export function pencilRing(cx, cy, rx, ry, seed = 1, stroke = C.graphite, w = 1.6, o = 0.85, gap = true) {
  const pts = [];
  const n = 28;
  const start = 0.4 + seed * 0.3;
  const sweep = gap ? Math.PI * 2 * 0.93 : Math.PI * 2.08;
  for (let i = 0; i <= n; i++) {
    const a = start + (i / n) * sweep;
    const wob = 1 + Math.sin(i * 1.9 + seed * 3) * 0.045 + (i / n) * 0.05;
    pts.push([cx + Math.cos(a) * rx * wob, cy + Math.sin(a) * ry * wob]);
  }
  const d = 'M' + pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join(' L');
  return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-opacity="${o}" stroke-linecap="round" stroke-linejoin="round" filter="url(#pen)"/>`;
}

// Margin note: a leader line and a few words in the editorial italic.
export function marginNote(x, y, text, { dx = 34, dy = -26, size = 15, color = '#E9E1D2', lead = '#E9E1D2', anchor = 'start', fam = 'Newsreader', style = 'italic' } = {}) {
  const tx = x + dx, ty = y + dy;
  const lx = anchor === 'end' ? tx + 4 : tx - 4;
  return `<g><path d="M${x} ${y} Q${f1((x + tx) / 2)} ${f1(y + dy * 0.2)} ${f1(lx)} ${f1(ty + 4)}" fill="none" stroke="${lead}" stroke-width="1" stroke-opacity=".8" stroke-linecap="round"/>
<text x="${tx}" y="${ty}" font-family="${fam}, Georgia, serif" font-style="${style}" font-size="${size}" fill="${color}" text-anchor="${anchor}">${text}</text></g>`;
}

// Commitment mark: heavy rust bracket + plain verb. Never used for observation.
export function commitMark(x, y, w, h, label, { size = 15, textColor = '#F6EBDD' } = {}) {
  const t = 7;
  const br = `M${x} ${y + t} V${y} H${x + t} M${x + w - t} ${y} H${x + w} V${y + t} M${x + w} ${y + h - t} V${y + h} H${x + w - t} M${x + t} ${y + h} H${x} V${y + h - t}`;
  return `<g><path d="${br}" fill="none" stroke="${C.rust}" stroke-width="3.2" stroke-linecap="square" filter="url(#pen)"/>
<rect x="${x}" y="${y - size - 24}" width="${label.length * size * 0.5 + 24}" height="${size + 14}" fill="${C.rust}"/>
<text x="${x + 12}" y="${y - 17}" font-family="Inter, sans-serif" font-weight="600" font-size="${size - 2}" fill="${textColor}">${label}</text></g>`;
}
