// Faceless adult figure, solved from joint angles. Units: 100 = standing height.
// Angles are degrees from straight down; positive = toward the way the figure faces.
import { C } from './kit.mjs';

const D = Math.PI / 180;
const f1 = (n) => Math.round(n * 100) / 100;

const L = { thigh: 24, shin: 23, upper: 15.5, fore: 14, torso: 33, neck: 3.5, head: 9.5 };

function limb(ox, oy, l1, l2, a, bend, sign) {
  const a1 = a * D;
  const mx = ox + Math.sin(a1) * l1, my = oy + Math.cos(a1) * l1;
  const a2 = (a + sign * bend) * D;
  return { m: [mx, my], e: [mx + Math.sin(a2) * l2, my + Math.cos(a2) * l2] };
}

// A pose is a small set of numbers. Everything else (clothes, build, colour) is the family.
export const POSES = {
  neutral:      { lean: 1,  pitch: 0,   yaw: .55, near: [4, 8],    far: [-3, 6],  lN: [2, 3],   lF: [-3, 2],  weight: 0 },
  notice:       { lean: 3,  pitch: 4,   yaw: .9,  near: [8, 14],   far: [-2, 8],  lN: [3, 4],   lF: [-4, 2],  weight: 1 },
  listen:       { lean: 5,  pitch: 6,   yaw: .85, near: [-6, 10],  far: [14, 62], lN: [2, 3],   lF: [-3, 2],  weight: 0 },
  hesitate:     { lean: -3, pitch: 7,   yaw: .8,  near: [28, 80],  far: [-4, 10], lN: [-8, 4],  lF: [10, 8],  weight: -1, hold: true },
  avoid:        { lean: -5, pitch: 12,  yaw: -.1, near: [-4, 20],  far: [10, 55], lN: [-6, 4],  lF: [6, 3],   weight: -2 },
  turnToward:   { lean: 6,  pitch: 2,   yaw: 1,   near: [10, 18],  far: [-2, 8],  lN: [6, 4],   lF: [-8, 3],  weight: 1 },
  turnAway:     { lean: -2, pitch: 5,   yaw: -.85, near: [-5, 12], far: [6, 14],  lN: [-6, 4],  lF: [4, 3],   weight: -1 },
  reach:        { lean: 14, pitch: 8,   yaw: .9,  near: [78, 14],  far: [-8, 22], lN: [14, 4],  lF: [-12, 8], weight: 2 },
  stopHand:     { lean: -4, pitch: 2,   yaw: .9,  near: [92, 8],   far: [-3, 10], lN: [-3, 3],  lF: [5, 3],   weight: -1 },
  stand:        { lean: 0,  pitch: 0,   yaw: .6,  near: [3, 6],    far: [-2, 6],  lN: [1, 2],   lF: [-2, 2],  weight: 0 },
  raiseHand:    { lean: 2,  pitch: -2,  yaw: .8,  near: [158, 18], far: [-2, 8],  lN: [2, 3],   lF: [-3, 2],  weight: 0 },
  speak:        { lean: 4,  pitch: -1,  yaw: 1,   near: [38, 70],  far: [8, 40],  lN: [3, 3],   lF: [-5, 2],  weight: 1 },
  wait:         { lean: 0,  pitch: 3,   yaw: .6,  near: [8, 24],   far: [-6, 24], lN: [2, 2],   lF: [-2, 2],  weight: 0 },
  leave:        { lean: 6,  pitch: 0,   yaw: .95, near: [-26, 8],  far: [30, 10], lN: [26, 10], lF: [-22, 22], weight: 0, walk: true },
  walk:         { lean: 4,  pitch: 0,   yaw: .9,  near: [-22, 8],  far: [22, 10], lN: [22, 8],  lF: [-18, 20], weight: 0, walk: true },
  returnP:      { lean: 5,  pitch: 5,   yaw: -.5, near: [-18, 10], far: [18, 10], lN: [20, 8],  lF: [-16, 18], weight: 0, walk: true },
  freeze:       { lean: -1, pitch: 0,   yaw: .9,  near: [3, 4],    far: [-1, 4],  lN: [0, 0],   lF: [0, 0],   weight: 0 },
  lowerGaze:    { lean: 3,  pitch: 22,  yaw: .6,  near: [4, 10],   far: [-3, 8],  lN: [2, 3],   lF: [-3, 2],  weight: 0 },
  lookAtOther:  { lean: 3,  pitch: 0,   yaw: 1,   near: [5, 10],   far: [-3, 7],  lN: [2, 3],   lF: [-3, 2],  weight: 1 },
  phone:        { lean: 6,  pitch: 18,  yaw: .7,  near: [44, 98],  far: [26, 84], lN: [2, 3],   lF: [-3, 2],  weight: 0 },
  sit:          { lean: 3,  pitch: 4,   yaw: .6,  near: [20, 70],  far: [14, 76], seat: true, weight: 0 },
  sitForward:   { lean: 18, pitch: 8,   yaw: .8,  near: [30, 60],  far: [24, 66], seat: true, weight: 0 },
};

// Families: silhouette + clothing. Hero is always the warmest mass in a frame.
export const FAMILY = {
  hero:   { skin: '#B98462', hair: '#1F1D22', top: C.coat, bottom: '#2A3040', coat: true, torsoW: 17, h: 1 },
  mira:   { skin: '#C09379', hair: '#2B2427', top: '#59606E', bottom: '#2F3440', coat: false, torsoW: 15.5, h: .98 },
  dir:    { skin: '#A97A62', hair: '#6B6A6A', top: '#3E4A55', bottom: '#262B35', coat: false, torsoW: 18.5, h: 1.04 },
  other:  { skin: '#A88672', hair: '#1D1C21', top: '#4A5260', bottom: '#2B303B', coat: false, torsoW: 16, h: 1 },
  warm:   { skin: '#B98462', hair: '#262024', top: '#8B6A5C', bottom: '#2E3340', coat: false, torsoW: 15.5, h: .97 },
  bg:     { skin: '#6D5B56', hair: '#1B1B20', top: '#33394A', bottom: '#222633', coat: false, torsoW: 16, h: 1 },
};

/**
 * figure({x,y}, height px, pose name, family, facing 1|-1, options)
 * x,y is the ground contact. opts.light = +1|-1 rim side, opts.rim colour, opts.phone, opts.dim 0..1, opts.held {kind}
 */
export function figure(x, y, height, poseName, fam = 'hero', facing = 1, opts = {}) {
  const p = { ...POSES[poseName] };
  const F = FAMILY[fam];
  const s = (height / 100) * F.h;
  const rim = opts.rim ?? '#FFC983';
  const light = opts.light ?? 0;
  const dim = opts.dim ?? 0;

  const seat = !!p.seat;
  const hipH = seat ? 27 : 47 - (p.hold ? 1 : 0) - (p.weight === 2 ? 2 : 0);
  const hip = [0, -hipH];
  const lean = p.lean * D;
  const sh = [hip[0] + Math.sin(lean) * L.torso, hip[1] - Math.cos(lean) * L.torso];
  const pr = (p.lean + p.pitch) * D;
  const neck = [sh[0] + Math.sin(lean) * L.neck, sh[1] - Math.cos(lean) * L.neck];
  const head = [neck[0] + Math.sin(pr) * L.head, neck[1] - Math.cos(pr) * L.head];

  // arms
  const aN = limb(sh[0] + 1.5, sh[1] + 2, L.upper, L.fore, p.near[0], p.near[1], +1);
  const aF = limb(sh[0] - 1.5, sh[1] + 2, L.upper, L.fore, p.far[0], p.far[1], +1);
  if (opts.phone) { // two hands bring the phone up under the face plane
    aN.e = [head[0] + 6, head[1] + 16]; aN.m = [sh[0] + 7, sh[1] + 14];
    aF.e = [head[0] + 4, head[1] + 17]; aF.m = [sh[0] + 4, sh[1] + 15];
  }
  // legs
  let lN, lF;
  if (seat) {
    lN = limb(hip[0], hip[1], L.thigh, L.shin, 84, 86, -1);
    lF = limb(hip[0] - 2, hip[1], L.thigh, L.shin, 80, 80, -1);
  } else {
    const st = p.walk ? 1 : 0;
    lN = limb(hip[0] + 1, hip[1], L.thigh, L.shin, p.lN[0], p.lN[1], -1);
    lF = limb(hip[0] - 1, hip[1], L.thigh, L.shin, p.lF[0], p.lF[1], -1);
    // plant feet on ground
    const dN = -lN.e[1], dF = -lF.e[1];
    lN.m[1] += dN; lN.e[1] += dN; lF.m[1] += dF; lF.e[1] += dF;
    void st;
  }
  const seatY = seat ? 0 : 0;
  void seatY;

  const draw = (col) => {
    const k = (c) => (col ? col : c);
    const dark = (c) => (col ? col : shade(c, -0.22));
    const tw = F.torsoW;
    let out = '';
    // far arm, far leg
    out += stroke([sh[0] - 1.5, sh[1] + 2], aF.m, aF.e, 5.2, dark(F.top));
    out += stroke([hip[0] - 1, hip[1]], lF.m, lF.e, 9.4, dark(F.bottom));
    // torso
    out += `<path d="M${f1(hip[0])} ${f1(hip[1])} L${f1(sh[0])} ${f1(sh[1])}" stroke="${k(F.top)}" stroke-width="${tw}" stroke-linecap="round" fill="none"/>`;
    if (F.coat) { // coat skirt
      const sk = seat ? 6 : 17;
      out += `<path d="M${f1(hip[0] - tw / 2 + 1)} ${f1(hip[1] - 4)} L${f1(hip[0] + tw / 2 + 2)} ${f1(hip[1] - 4)} L${f1(hip[0] + tw / 2 + 4)} ${f1(hip[1] + sk)} L${f1(hip[0] - tw / 2 - 1)} ${f1(hip[1] + sk)} Z" fill="${k(shade(F.top, -0.08))}"/>`;
    }
    // near leg
    out += stroke([hip[0] + 1, hip[1]], lN.m, lN.e, 10, k(F.bottom));
    // feet
    const foot = (e, dir) => `<ellipse cx="${f1(e[0] + dir * 3)}" cy="${f1(e[1] + 1)}" rx="5.4" ry="2.3" fill="${k('#15171E')}"/>`;
    out += foot(lF.e, 1) + foot(lN.e, 1);
    // near arm
    out += stroke([sh[0] + 1.5, sh[1] + 2], aN.m, aN.e, 5.6, k(F.top));
    // hands: lighter, they are where attention goes
    out += `<ellipse cx="${f1(aF.e[0])}" cy="${f1(aF.e[1] + 1.5)}" rx="2.7" ry="3.1" fill="${k(shade(F.skin, -0.18))}"/>`;
    out += `<ellipse cx="${f1(aN.e[0])}" cy="${f1(aN.e[1] + 1.5)}" rx="2.9" ry="3.3" fill="${k(F.skin)}"/>`;
    // neck + head (no features): hair mass behind, a lighter face plane toward the yaw
    out += `<path d="M${f1(sh[0])} ${f1(sh[1])} L${f1(neck[0])} ${f1(neck[1])}" stroke="${k(shade(F.skin, -0.12))}" stroke-width="5" stroke-linecap="round" fill="none"/>`;
    out += `<ellipse cx="${f1(head[0])}" cy="${f1(head[1])}" rx="5.7" ry="7.1" fill="${k(F.skin)}" transform="rotate(${f1(p.pitch * 0.6)} ${f1(head[0])} ${f1(head[1])})"/>`;
    if (!col) {
      const hx = head[0] - 1.9 * Math.max(0.2, p.yaw);
      out += `<path d="M${f1(head[0] - 6)} ${f1(head[1] + 1)} C${f1(head[0] - 6.5)} ${f1(head[1] - 9)} ${f1(head[0] + 4)} ${f1(head[1] - 9.4)} ${f1(head[0] + 5.8)} ${f1(head[1] - 3.5)} C${f1(hx + 1)} ${f1(head[1] - 4.8)} ${f1(hx - 1)} ${f1(head[1] - 2)} ${f1(hx - 2.2)} ${f1(head[1] + 3)} Z" fill="${F.hair}"/>`;
      if (p.yaw > -0.3) out += `<ellipse cx="${f1(head[0] + 2.6 * p.yaw)}" cy="${f1(head[1] + 1.4)}" rx="${f1(2.2 + p.yaw)}" ry="3.9" fill="#FFE2C0" opacity="${0.16 + 0.1 * p.yaw}"/>`;
    }
    return out;
  };

  const hold = opts.held ? heldObject(opts.held, aN, aF, head) : '';
  const g = (inner, extra = '') => `<g transform="translate(${f1(x)} ${f1(y)}) scale(${f1(s * facing)} ${f1(s)}) ${extra}">${inner}</g>`;
  const shadow = `<ellipse cx="${f1(x + 2 * facing * s)}" cy="${f1(y + 1)}" rx="${f1(17 * s)}" ry="${f1(3.6 * s)}" fill="#05070D" opacity="${0.55}"/>`;
  const rimLayer = light ? g(draw(rim), `translate(${f1(1.9 * light * facing)} -0.4)`) : '';
  const dimmer = dim ? `<g transform="translate(${f1(x)} ${f1(y)}) scale(${f1(s * facing)} ${f1(s)})" opacity="${dim}"></g>` : '';
  void dimmer;
  if (opts.flat) return `<g class="fig" opacity="${opts.flatOpacity ?? 0.9}">${g(draw(opts.flat))}</g>`;
  return `<g class="fig">${shadow}${rimLayer}${g(draw(null) + hold)}</g>`;
}

function stroke(o, m, e, w, col) {
  return `<path d="M${f1(o[0])} ${f1(o[1])} L${f1(m[0])} ${f1(m[1])} L${f1(e[0])} ${f1(e[1])}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255, a = Math.abs(amt);
  r = Math.round((t - r) * a + r); g = Math.round((t - g) * a + g); b = Math.round((t - b) * a + b);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function heldObject(h, aN, aF, head) {
  const e = aN.e;
  if (h.kind === 'envelope') return `<g transform="translate(${f1(e[0] + 1)} ${f1(e[1] - 1)}) rotate(-12)"><rect x="-6.5" y="-4.4" width="13" height="9" fill="#F1E8D4"/><path d="M-6.5 -4.4 L0 1 L6.5 -4.4" fill="none" stroke="#B9AC92" stroke-width=".7"/><rect x="-3.4" y="1.4" width="6.8" height=".8" fill="#6E5F4C" opacity=".6"/></g>`;
  if (h.kind === 'phone') return `<g transform="translate(${f1(e[0] + 1)} ${f1(e[1] - 3)}) rotate(-8)"><rect x="-2.6" y="-4.8" width="5.2" height="9.6" rx="1" fill="#DCEFF2"/></g>`;
  if (h.kind === 'summary') return `<g transform="translate(${f1(e[0] + 1)} ${f1(e[1] - 1)}) rotate(-6)"><rect x="-5.5" y="-7" width="11" height="14" fill="#F2EBDD"/><rect x="-3.6" y="-5" width="6" height=".9" fill="#7C6F5E"/><rect x="-3.6" y="-2.6" width="7" height=".6" fill="#B4A998"/><rect x="-3.6" y="-1" width="7" height=".6" fill="#B4A998"/></g>`;
  return '';
}

/** Seen from behind, seated at a table facing away: shoulders, head, chair back. Used for meeting rooms. */
export function backFigure(x, y, h, fam = 'bg', opts = {}) {
  const F = FAMILY[fam]; const s = h / 100; const tilt = opts.tilt ?? 0;
  const col = opts.rim ? '#9FC3CC' : null;
  return `<g transform="translate(${f1(x)} ${f1(y)}) scale(${f1(s)})">
  <ellipse cx="0" cy="3" rx="${f1(18)}" ry="3.4" fill="#05070D" opacity=".5"/>
  <path d="M-15 0 L-14 -42 Q0 -50 14 -42 L15 0 Z" fill="${shade(F.bottom, -0.1)}"/>
  <path d="M-15 -36 Q-17 -56 -10 -64 L10 -64 Q17 -56 15 -36 Z" fill="${F.top}"/>
  <rect x="-3.2" y="-70" width="6.4" height="7" fill="${F.skin}"/>
  <ellipse cx="${f1(tilt)}" cy="-77" rx="6.6" ry="7.6" fill="${F.hair}"/>
  ${opts.rim ? `<path d="M-15 -36 Q-17 -56 -10 -64" stroke="#9FC3CC" stroke-width="1.2" fill="none" opacity=".7"/><ellipse cx="${f1(tilt - 5.6)}" cy="-77" rx="1" ry="6.5" fill="#9FC3CC" opacity=".5"/>` : ''}
  </g>`;
}
