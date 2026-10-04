/**
 * The Vivi character rig, ported from Design r4 (docs/visual-v3/correction-slice/generator/rig.py).
 *
 * A light 3D skeleton is solved from a body (proportions, garment, palette) and a pose (yaw, twist, spine, head,
 * per-limb flex/abduction/elbow/knee/toe), then projected orthographically into closed 2D part outlines in head
 * units: tapered limb chains, a torso built from width levels, a coat skirt hull with folds, collar, placket,
 * hands and a head with a hair cap and a face plane. Screen: x right, y down, ground at y = 0.
 *
 * Pure maths, no DOM. Poses are plain numbers, so the runtime can blend them every frame.
 */

export type V3 = [number, number, number];
export type V2 = [number, number];

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const N = (a: V3): V3 => {
  const n = len(a);
  return n > 1e-9 ? mul(a, 1 / n) : a;
};
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const perp = (v: V3, d: V3) => N(sub(v, mul(d, dot(v, d))));
const UP: V3 = [0, 1, 0];
const rad = (d: number) => (d * Math.PI) / 180;
const frame = (yawDeg: number): [V3, V3] => {
  const t = rad(yawDeg);
  return [[Math.sin(t), 0, Math.cos(t)], [-Math.cos(t), 0, Math.sin(t)]];
};

const a2 = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];
const s2 = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]];
const m2 = (a: V2, k: number): V2 => [a[0] * k, a[1] * k];
const d2 = (a: V2, b: V2) => a[0] * b[0] + a[1] * b[1];
const n2 = (a: V2): V2 => {
  const l = Math.hypot(a[0], a[1]);
  return l > 1e-9 ? [a[0] / l, a[1] / l] : a;
};
const lerp2 = (a: V2, b: V2, t: number): V2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const P2 = (v: V3): V2 => [v[0], -v[1]];

/* ------------------------------------------------------------------ bodies --- */

export type Garment = 'long' | 'jacket' | 'parka' | 'sweater' | 'shirt' | 'dress' | 'skirt';
export type Hair = 'crop' | 'short' | 'bob' | 'long' | 'tied' | 'bun' | 'curly' | 'thin' | 'scarf' | 'bald';

export interface Palette {
  coat: string;
  trousers: string;
  skin: string;
  hair: string;
  inner: string;
  shoe: string;
  scarf?: string;
}

export interface Body {
  heads: number;
  sb: number;
  shb: number;
  chest: number;
  waist: number;
  hip: number;
  depth: number;
  limb: number;
  head_w: number;
  head_h: number;
  neck_w: number;
  coat: Garment;
  hem: number;
  flare: number;
  open: boolean;
  hair: Hair;
  belt: boolean;
  stoop: number;
  hand: number;
  pal: Palette;
}

export const BASE: Body = {
  heads: 7.4, sb: 0.7, shb: 0.84, chest: 0.76, waist: 0.58, hip: 0.72, depth: 0.5,
  limb: 1.0, head_w: 0.76, head_h: 1.02, neck_w: 0.24,
  coat: 'long', hem: 2.0, flare: 0.06, open: true, hair: 'short', belt: false, stoop: 0, hand: 1.0,
  pal: { coat: '#C38A34', trousers: '#2A2B36', skin: '#C99A78', hair: '#2B211B', inner: '#B9A991', shoe: '#1C1A19', scarf: '#B5523A' },
};

export const body = (kw: Partial<Omit<Body, 'pal'>> & { pal?: Partial<Palette> } = {}): Body => {
  const { pal, ...rest } = kw;
  return { ...BASE, ...rest, pal: { ...BASE.pal, ...(pal ?? {}) } };
};

export const FAMILIES: Record<string, Partial<Body>> = {
  long: { heads: 7.8, sb: 0.62, shb: 0.76, chest: 0.68, waist: 0.54, hip: 0.66, limb: 0.92 },
  broad: { heads: 7.2, sb: 0.88, shb: 1.1, chest: 1.02, waist: 0.92, hip: 0.84, limb: 1.22, neck_w: 0.31, head_w: 0.8 },
  soft: { heads: 7.0, sb: 0.7, shb: 0.88, chest: 0.98, waist: 1.0, hip: 1.04, limb: 1.18, head_w: 0.78 },
  slight: { heads: 7.2, sb: 0.56, shb: 0.68, chest: 0.64, waist: 0.5, hip: 0.74, limb: 0.82, neck_w: 0.2, head_w: 0.7 },
  compact: { heads: 6.7, sb: 0.74, shb: 0.92, chest: 0.88, waist: 0.8, hip: 0.82, limb: 1.12, head_w: 0.8 },
};
export const GARMENTS: Record<string, Partial<Body>> = {
  'long coat': { coat: 'long', hem: 2.0 },
  'short jacket': { coat: 'jacket', hem: 3.3 },
  knit: { coat: 'sweater', hem: 3.6, open: false },
};

function lengths(b: Body) {
  const extra = b.heads - 7.25;
  return {
    ankle: 0.3, shin: 1.72 + extra * 0.3, thigh: 1.78 + extra * 0.3, spine: 2.15 + extra * 0.28, neck: 0.29 + extra * 0.06,
    uarm: 1.4 + extra * 0.2, farm: 1.2 + extra * 0.18, hand: 0.7 * b.hand,
  };
}

/* ------------------------------------------------------------------- poses --- */

export type HandKind = 'relax' | 'open' | 'stop' | 'reach' | 'fist' | 'grip' | 'phone' | 'clasp' | 'rest' | 'pocket' | 'hidden';
export interface Arm {
  flex: number;
  abd: number;
  elbow: number;
  inw: number;
  wrist: number;
  hand: HandKind;
  shrug: number;
  curl: number;
  spread: number;
}
export interface Leg {
  flex: number;
  abd: number;
  knee: number;
  turn: number;
  toe: number;
}
export interface Pose {
  yaw: number;
  twist: number;
  head_yaw: number;
  head_pitch: number;
  head_roll: number;
  spine_pitch: number;
  spine_roll: number;
  pelvis_roll: number;
  neck_fwd: number;
  x: number;
  lift: number;
  support: 'both' | 'R' | 'L';
  seat: boolean;
  armR: Arm;
  armL: Arm;
  legR: Leg;
  legL: Leg;
}

const DEF_ARM: Arm = { flex: 4, abd: 6, elbow: 10, inw: 0, wrist: 0, hand: 'relax', shrug: 0, curl: 0.35, spread: 0 };
const DEF_LEG: Leg = { flex: 0, abd: 3, knee: 3, turn: 8, toe: 0 };

export type PoseInput = Partial<Omit<Pose, 'armR' | 'armL' | 'legR' | 'legL'>> & { armR?: Partial<Arm>; armL?: Partial<Arm>; legR?: Partial<Leg>; legL?: Partial<Leg> };
export const pose = (kw: PoseInput = {}): Pose => ({
  yaw: 35, twist: 0, head_yaw: 0, head_pitch: 0, head_roll: 0, spine_pitch: 0, spine_roll: 0, pelvis_roll: 0, neck_fwd: 0,
  x: 0, lift: 0, support: 'both', seat: false,
  ...kw,
  armR: { ...DEF_ARM, ...(kw.armR ?? {}) },
  armL: { ...DEF_ARM, ...(kw.armL ?? {}) },
  legR: { ...DEF_LEG, ...(kw.legR ?? {}) },
  legL: { ...DEF_LEG, ...(kw.legL ?? {}) },
});

const lerpN = (a: number, b: number, t: number) => a + (b - a) * t;
/** Blend two poses (numbers interpolate; discrete fields switch at the midpoint). */
export function blendPose(a: Pose, b: Pose, t: number): Pose {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const arm = (x: Arm, y: Arm): Arm => ({
    flex: lerpN(x.flex, y.flex, t), abd: lerpN(x.abd, y.abd, t), elbow: lerpN(x.elbow, y.elbow, t), inw: lerpN(x.inw, y.inw, t), wrist: lerpN(x.wrist, y.wrist, t),
    hand: t < 0.5 ? x.hand : y.hand, shrug: lerpN(x.shrug, y.shrug, t), curl: lerpN(x.curl, y.curl, t), spread: lerpN(x.spread, y.spread, t),
  });
  const leg = (x: Leg, y: Leg): Leg => ({ flex: lerpN(x.flex, y.flex, t), abd: lerpN(x.abd, y.abd, t), knee: lerpN(x.knee, y.knee, t), turn: lerpN(x.turn, y.turn, t), toe: lerpN(x.toe, y.toe, t) });
  // yaw takes the short way round
  let dy = ((b.yaw - a.yaw + 540) % 360) - 180;
  if (dy === -180) dy = 180;
  return {
    yaw: a.yaw + dy * t, twist: lerpN(a.twist, b.twist, t), head_yaw: lerpN(a.head_yaw, b.head_yaw, t), head_pitch: lerpN(a.head_pitch, b.head_pitch, t),
    head_roll: lerpN(a.head_roll, b.head_roll, t), spine_pitch: lerpN(a.spine_pitch, b.spine_pitch, t), spine_roll: lerpN(a.spine_roll, b.spine_roll, t),
    pelvis_roll: lerpN(a.pelvis_roll, b.pelvis_roll, t), neck_fwd: lerpN(a.neck_fwd, b.neck_fwd, t), x: lerpN(a.x, b.x, t), lift: lerpN(a.lift, b.lift, t),
    support: t < 0.5 ? a.support : b.support, seat: t < 0.5 ? a.seat : b.seat,
    armR: arm(a.armR, b.armR), armL: arm(a.armL, b.armL), legR: leg(a.legR, b.legR), legL: leg(a.legL, b.legL),
  };
}

/* ------------------------------------------------------------------- solve --- */

export interface Joints {
  P: V3; s: V3; fp: V3; rp: V3; fc: V3; rc: V3; Nb: V3;
  ShR: V3; ER: V3; WR: V3; hdR: V3; thR: V3;
  ShL: V3; EL: V3; WL: V3; hdL: V3; thL: V3;
  HR: V3; KR: V3; AR: V3; heelR: V3; toeR: V3;
  HL: V3; KL: V3; AL: V3; heelL: V3; toeL: V3;
  Hn: V3; Hc: V3; hup: V3; fh: V3; rh: V3; nd: V3;
}

export function solve(b: Body, p: Pose): Joints {
  const L = lengths(b);
  const J: Record<string, V3> = {};
  const [fp, rp] = frame(p.yaw);
  const stoop = b.stoop;
  const hipH = L.ankle + L.shin + L.thigh;
  const P: V3 = [0, hipH, 0];
  const pr = rad(p.pelvis_roll);
  const rp2 = N(add(mul(rp, Math.cos(pr)), mul(UP, Math.sin(pr))));
  const sp = rad(p.spine_pitch + stoop * 10);
  const sr = rad(p.spine_roll);
  const s = N(add(add(mul(UP, Math.cos(sp) * Math.cos(sr)), mul(fp, Math.sin(sp))), mul(rp, Math.sin(sr))));
  const [fc0, rc0] = frame(p.yaw + p.twist);
  const fc = perp(fc0, s);
  let rc = mul(N(cross(fc, s)), -1);
  if (dot(rc, rc0) < 0) rc = mul(rc, -1);
  let Nb = add(P, mul(s, L.spine));
  Nb = add(Nb, mul(fc, 0.1 * stoop + 0.06 * p.neck_fwd));
  Object.assign(J, { P, s, fp, rp: rp2, fc, rc, Nb });
  for (const [side, a, sg] of [['R', p.armR, 1], ['L', p.armL, -1]] as const) {
    const sh = add(add(add(sub(add(Nb, mul(rc, sg * b.sb)), mul(s, 0.26)), mul(s, a.shrug * 0.22)), mul(fc, a.shrug * 0.05)), [0, 0, 0]);
    const sideV = mul(rc, sg);
    const fl = rad(a.flex);
    const ab = rad(a.abd);
    const fhor = N([fc0[0], 0, fc0[2]]);
    const d = N(add(add(mul(UP, -Math.cos(fl) * Math.cos(ab)), mul(fhor, Math.sin(fl) * Math.cos(ab))), mul(sideV, Math.sin(ab))));
    const E = add(sh, mul(d, L.uarm));
    const inw = rad(a.inw);
    const ref = add(sub(mul(fhor, Math.cos(inw)), mul(sideV, Math.sin(inw))), mul(UP, 0.15));
    let bb = sub(ref, mul(d, dot(ref, d)));
    if (len(bb) < 1e-3) bb = sub(UP, mul(d, dot(UP, d)));
    bb = N(bb);
    const e = rad(a.elbow);
    const fd = N(add(mul(d, Math.cos(e)), mul(bb, Math.sin(e))));
    const W = add(E, mul(fd, L.farm));
    const bb2 = Math.abs(dot(bb, fd)) < 0.99 ? perp(bb, fd) : bb;
    const w = rad(a.wrist);
    const hd = N(add(mul(fd, Math.cos(w)), mul(bb2, Math.sin(w))));
    const t3 = perp(sub(mul(fhor, 0.8), mul(sideV, 0.5)), hd);
    J['Sh' + side] = sh;
    J['E' + side] = E;
    J['W' + side] = W;
    J['hd' + side] = hd;
    J['th' + side] = t3;
  }
  for (const [side, a, sg] of [['R', p.legR, 1], ['L', p.legL, -1]] as const) {
    const hp = add(P, mul(rp2, sg * b.hip * 0.62));
    const sideV = mul(rp, sg);
    const fl = rad(a.flex);
    const ab = rad(a.abd);
    const t = N(add(add(mul(UP, -Math.cos(fl) * Math.cos(ab)), mul(fp, Math.sin(fl) * Math.cos(ab))), mul(sideV, Math.sin(ab))));
    const K = add(hp, mul(t, L.thigh));
    const bk = Math.abs(dot(fp, t)) < 0.99 ? perp(mul(fp, -1), t) : mul(UP, -1);
    const k = rad(a.knee);
    const sd = N(add(mul(t, Math.cos(k)), mul(bk, Math.sin(k))));
    const A = add(K, mul(sd, L.shin));
    const [ff] = frame(p.yaw + sg * -a.turn);
    const tp = rad(a.toe);
    const fdir = N(sub(mul(ff, Math.cos(tp)), mul(UP, Math.sin(tp))));
    let heel = sub(sub(A, mul(UP, 0.26)), mul(ff, 0.12));
    let toe = add(sub(A, mul(UP, 0.26)), mul(fdir, 0.86));
    if (a.toe > 0) {
      heel = sub(sub(A, mul(UP, 0.2)), mul(fdir, 0.14));
      toe = add(heel, mul(fdir, 0.98));
    }
    J['H' + side] = hp;
    J['K' + side] = K;
    J['A' + side] = A;
    J['heel' + side] = heel;
    J['toe' + side] = toe;
  }
  const hp_ = rad(p.head_pitch);
  const [fh0, rh0] = frame(p.yaw + p.twist + p.head_yaw);
  const nd = N(add(s, mul(fc, 0.18 + 0.25 * p.neck_fwd + 0.2 * stoop)));
  let headUp = N(add(mul(nd, Math.cos(hp_)), mul(fh0, Math.sin(hp_))));
  headUp = N(add(headUp, mul(rh0, Math.sin(rad(p.head_roll)))));
  const fh = perp(sub(fh0, mul(UP, Math.sin(hp_))), headUp);
  const Hn = add(Nb, mul(nd, L.neck));
  const Hc = add(add(Hn, mul(headUp, 0.42)), mul(fh, 0.05));
  Object.assign(J, { Hn, Hc, hup: headUp, fh, rh: rh0, nd });
  const feet: number[] = [];
  for (const side of ['R', 'L']) if (p.support === 'both' || p.support === side) feet.push(J['heel' + side][1], J['toe' + side][1]);
  const lo = Math.min(...feet);
  const shift: V3 = [p.x, -lo + p.lift, 0];
  const dirs = new Set(['s', 'fp', 'rp', 'fc', 'rc', 'fh', 'rh', 'hup', 'nd']);
  for (const k of Object.keys(J)) if (!dirs.has(k) && !k.startsWith('hd') && !k.startsWith('th')) J[k] = add(J[k], shift);
  return J as unknown as Joints;
}

/* ------------------------------------------------------------- 2D outlines --- */

function limb(p1: V2, p2: V2, w1: number, w2: number, bulge = 0, n = 7, cap = 6): V2[] {
  let d = s2(p2, p1);
  let l = Math.hypot(d[0], d[1]);
  if (l < 1e-6) {
    d = [0, 1];
    l = 1e-6;
  }
  d = m2(d, 1 / l);
  const nn: V2 = [-d[1], d[0]];
  const left: V2[] = [];
  const right: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const w = w1 + (w2 - w1) * t + bulge * Math.sin(Math.PI * t);
    const c = lerp2(p1, p2, t);
    left.push(a2(c, m2(nn, w)));
    right.push(s2(c, m2(nn, w)));
  }
  const pts = [...left];
  const a0 = Math.atan2(nn[1], nn[0]);
  for (let i = 1; i < cap; i++) {
    const a = a0 - (Math.PI * i) / cap;
    pts.push(a2(p2, [Math.cos(a) * w2, Math.sin(a) * w2]));
  }
  pts.push(...right.reverse());
  for (let i = 1; i < cap; i++) {
    const a = a0 + Math.PI - (Math.PI * i) / cap;
    pts.push(a2(p1, [Math.cos(a) * w1, Math.sin(a) * w1]));
  }
  return pts;
}

export function chain(pts: V2[], ws: number[], n = 5, cap = 6): V2[] {
  const left: V2[] = [];
  const right: V2[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const d = n2(s2(b, a));
    const nn: V2 = [-d[1], d[0]];
    const steps = n + (i === pts.length - 2 ? 1 : 0);
    for (let j = 0; j < steps; j++) {
      const t = j / n;
      const c = lerp2(a, b, t);
      const w = ws[i] + (ws[i + 1] - ws[i]) * t;
      left.push(a2(c, m2(nn, w)));
      right.push(s2(c, m2(nn, w)));
    }
  }
  const d0 = n2(s2(pts[1], pts[0]));
  const d1 = n2(s2(pts[pts.length - 1], pts[pts.length - 2]));
  const out = [...left];
  const n1: V2 = [-d1[1], d1[0]];
  let a0 = Math.atan2(n1[1], n1[0]);
  for (let i = 1; i < cap; i++) {
    const a = a0 - (Math.PI * i) / cap;
    out.push(a2(pts[pts.length - 1], [Math.cos(a) * ws[ws.length - 1], Math.sin(a) * ws[ws.length - 1]]));
  }
  out.push(...right.reverse());
  const n0: V2 = [-d0[1], d0[0]];
  a0 = Math.atan2(n0[1], n0[0]);
  for (let i = 1; i < cap; i++) {
    const a = a0 + Math.PI - (Math.PI * i) / cap;
    out.push(a2(pts[0], [Math.cos(a) * ws[0], Math.sin(a) * ws[0]]));
  }
  return out;
}

export function ellipse(c: V2, rx: number, ry: number, rot = 0, n = 20): V2[] {
  const out: V2[] = [];
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    out.push([c[0] + x * cr - y * sr, c[1] + x * sr + y * cr]);
  }
  return out;
}

export function hull(points: V2[]): V2[] {
  const seen = new Set<string>();
  const pts = points
    .map(p => [Math.round(p[0] * 1e4) / 1e4, Math.round(p[1] * 1e4) / 1e4] as V2)
    .filter(p => (seen.has(`${p[0]},${p[1]}`) ? false : (seen.add(`${p[0]},${p[1]}`), true)))
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length <= 2) return pts;
  const cr = (o: V2, a: V2, b: V2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: V2[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cr(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: V2[] = [];
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cr(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/* --------------------------------------------------------------------- hands --- */

function handShapes(W: V2, ang: number, thumbSign: number, kind: HandKind, curl0: number, s: number, spread: number): V2[][] {
  const d: V2 = [Math.cos(ang), Math.sin(ang)];
  const nn: V2 = m2([-d[1], d[0]], thumbSign);
  const at = (x: number, y: number): V2 => a2(a2(W, m2(d, x * s)), m2(nn, y * s));
  const polys: V2[][] = [];
  if (kind === 'hidden') return polys;
  let curl = curl0;
  if (kind === 'fist') curl = 1;
  if (kind === 'open' || kind === 'stop' || kind === 'reach') curl = Math.min(curl, 0.12);
  if (kind === 'grip' || kind === 'phone') curl = 0.85;
  const pw0 = 0.1;
  const pw1 = 0.13;
  const pl = 0.34;
  polys.push(limb(at(-0.02, 0), at(pl - 0.02, 0), pw0, pw1, 0, 4, 5));
  const ys = [0.09, 0.03, -0.03, -0.09];
  const lens = [0.34, 0.37, 0.35, 0.28];
  ys.forEach((y, i) => {
    const spr = spread * (1.5 - i) * 0.18;
    const l1 = lens[i] * 0.55;
    const l2 = lens[i] * 0.45;
    const base = at(pl, y * 1.05);
    const dir1: V2 = [Math.cos(spr), Math.sin(spr)];
    const seg1 = m2(a2(m2(d, dir1[0]), m2(nn, dir1[1])), l1 * s * (1 - 0.55 * curl));
    const mid = a2(base, seg1);
    const bend = curl * 1.6;
    const dir2: V2 = [Math.cos(spr + bend), Math.sin(spr + bend)];
    const seg2 = m2(a2(m2(d, dir2[0]), m2(nn, dir2[1])), l2 * s * (1 - 0.85 * curl));
    const tip = a2(mid, seg2);
    const fw = 0.048 * s;
    polys.push(chain([base, mid, tip], [fw * 1.05, fw, fw * 0.85], 2, 4));
  });
  const ta = ({ relax: 0.35, open: 0.85, stop: 0.75, reach: 0.55, fist: 0.15, grip: 0.25, phone: 0.3, clasp: 0.2, rest: 0.45, pocket: 0.3 } as Record<string, number>)[kind] ?? 0.4;
  const tb = at(0.06, pw0 * 0.9);
  const tdir = a2(m2(d, Math.cos(ta)), m2(nn, Math.sin(ta)));
  const tm = a2(tb, m2(tdir, 0.17 * s));
  const tdir2 = a2(m2(d, Math.cos(ta * 0.4)), m2(nn, Math.sin(ta * 0.4)));
  const tt = a2(tm, m2(tdir2, 0.15 * s));
  polys.push(chain([tb, tm, tt], [0.065 * s, 0.055 * s, 0.045 * s], 2, 4));
  return polys;
}

/* --------------------------------------------------------------------- build --- */

export type Role = 'coat' | 'coat_far' | 'trousers' | 'trousers_far' | 'skin' | 'skin_far' | 'skin_sh' | 'hair' | 'inner' | 'inner_sleeve' | 'inner_far' | 'shoe' | 'scarf' | 'belt' | 'fold' | 'seam';
export interface Part {
  role: Role;
  pts: V2[];
  z: number;
  tag?: string;
  shade?: boolean;
  group?: string;
  smooth?: boolean;
}
export interface HeadSpec {
  c: V2;
  rx: number;
  ry: number;
  rot: number;
  side: number;
  facing: number;
  hair: Hair;
}

export interface Built {
  parts: Part[];
  head: HeadSpec;
  J: Joints;
}

/**
 * Outlines for a body in a pose. `coatLag` (head units, screen x) drags the coat's hem behind a moving body,
 * a presentation nicety the Design generator does not need for stills.
 */
export function build(b: Body, p: Pose, coatLag = 0): Built {
  const J = solve(b, p);
  const lm = b.limb;
  const parts: Part[] = [];
  const add_ = (role: Role, pts: V2[], z = 0, o: Partial<Part> = {}) => parts.push({ role, pts, z, shade: true, smooth: true, ...o });

  // legs (far first)
  const legs = (['R', 'L'] as const).map(side => ({ z: J[`K${side}`][2], side, H: P2(J[`H${side}`]), K: P2(J[`K${side}`]), A: P2(J[`A${side}`]) })).sort((x, y) => x.z - y.z);
  legs.forEach((l, i) => {
    add_(i === 0 ? 'trousers_far' : 'trousers', chain([l.H, l.K, l.A], [0.3 * lm, 0.205 * lm, 0.165 * lm], 4), l.z, { tag: 'leg' + l.side });
    const heel = P2(J[`heel${l.side}`]);
    const toe = P2(J[`toe${l.side}`]);
    add_('shoe', chain([heel, lerp2(heel, toe, 0.5), toe], [0.125, 0.115, 0.075], 3), l.z, { tag: 'foot', shade: false });
  });
  // pelvis block
  const pelvis: V2[] = [];
  for (const side of ['R', 'L'] as const) {
    const H = P2(J[`H${side}`]);
    const K = P2(J[`K${side}`]);
    const dd = n2(s2(K, H));
    const nn: V2 = [-dd[1], dd[0]];
    for (const t of [0, 0.25]) {
      const c = lerp2(H, K, t);
      pelvis.push(a2(c, m2(nn, 0.32 * lm)), s2(c, m2(nn, 0.32 * lm)));
    }
  }
  const sv = P2(add(J.P, mul(J.s, 0.5)));
  pelvis.push(a2(sv, [0.3, 0]), s2(sv, [0.3, 0]));
  add_('trousers', hull(pelvis), 0, { tag: 'pelvis' });

  // arms
  const chestZ = J.Nb[2];
  const arms = (['R', 'L'] as const).map(side => ({ side, a: side === 'R' ? p.armR : p.armL, Sh: J[`Sh${side}`], E: J[`E${side}`], W: J[`W${side}`], z: (J[`E${side}`][2] + J[`W${side}`][2]) / 2 })).sort((x, y) => x.z - y.z);
  const armParts = (side: 'R' | 'L', a: Arm, Sh: V3, E: V3, W: V3, far: boolean): Array<[Role, V2[]]> => {
    const out: Array<[Role, V2[]]> = [];
    let role: Role = far ? 'coat_far' : 'coat';
    if (b.coat === 'shirt' || b.coat === 'dress') role = far ? 'inner_far' : 'inner_sleeve';
    const Sh2 = P2(Sh);
    const E2 = P2(E);
    const W2 = P2(W);
    const cuff = lerp2(W2, E2, 0.06);
    out.push([role, chain([Sh2, E2, cuff], [0.215 * lm, 0.185 * lm, 0.16 * lm], 4)]);
    if (!far && a.elbow > 25 && role.startsWith('coat')) {
      const u1 = n2(s2(E2, Sh2));
      let nrm: V2 = [-u1[1], u1[0]];
      if (d2(s2(W2, E2), nrm) < 0) nrm = m2(nrm, -1);
      out.push(['fold', [s2(a2(E2, m2(nrm, 0.15)), m2(u1, 0.16)), a2(a2(E2, m2(nrm, 0.06)), m2(u1, 0.02)), a2(a2(E2, m2(nrm, 0.13)), m2(n2(s2(W2, E2)), 0.16))]]);
    }
    if (!far && role.startsWith('coat')) {
      const ec = s2(E2, cuff);
      const ln = Math.max(1e-6, Math.hypot(ec[0], ec[1]));
      const nv: V2 = [-ec[1] / ln, ec[0] / ln];
      const base = a2(cuff, m2(ec, 0.16));
      out.push(['fold', [a2(base, m2(nv, 0.15)), s2(base, m2(nv, 0.15))]]);
    }
    if (a.hand !== 'hidden' && a.hand !== 'pocket') {
      const hd = J[`hd${side}`];
      const h2: V2 = [hd[0], -hd[1]];
      const hl = Math.hypot(h2[0], h2[1]);
      const ang = Math.atan2(h2[1], h2[0]);
      const t3 = J[`th${side}`];
      const t2: V2 = [t3[0], -t3[1]];
      const nrm: V2 = [-h2[1], h2[0]];
      const ts = d2(t2, nrm) >= 0 ? 1 : -1;
      const sc = (0.55 + 0.45 * Math.min(1, hl / Math.max(1e-6, len(hd)))) * b.hand;
      for (const pp of handShapes(W2, ang, ts, a.hand, a.curl, sc, a.spread)) out.push([far ? 'skin_far' : 'skin', pp]);
    }
    return out;
  };
  const back: Array<[Role, V2[]]> = [];
  const front: Array<[Role, V2[]]> = [];
  const fcz = Math.abs(dot(J.fc, [0, 0, 1]));
  for (const ar of arms) {
    const far = ar.z < chestZ - 0.05 && !(fcz > 0.85);
    if (ar.z < chestZ - 0.15 || (far && Math.abs(J.fc[2]) < 0.85 && ar.z === arms[0].z)) back.push(...armParts(ar.side, ar.a, ar.Sh, ar.E, ar.W, true));
    else front.push(...armParts(ar.side, ar.a, ar.Sh, ar.E, ar.W, false));
  }
  for (const [role, pts] of back) add_(role, pts, -1, { tag: 'arm', shade: role.startsWith('coat') });

  // torso
  const { P, s, fc, rc, fp, rp } = J;
  const sp2 = n2(s2(P2(J.Nb), P2(P)));
  const nn2: V2 = [-sp2[1], sp2[0]];
  const levels: Array<[number, number]> = [[0, b.hip], [0.3, (b.hip + b.waist) / 2], [0.5, b.waist], [0.75, b.chest], [0.93, b.shb]];
  const left: V2[] = [];
  const right: V2[] = [];
  for (const [t, br] of levels) {
    const bl = Math.min(1, Math.max(0, (t - 0.35) / 0.5));
    const f_ = N(add(mul(fp, 1 - bl), mul(fc, bl)));
    const r_ = N(add(mul(rp, 1 - bl), mul(rc, bl)));
    const dep = b.depth * (t < 0.6 ? 0.9 : 1.0);
    const ease = ['long', 'jacket', 'parka'].includes(b.coat) ? 0.06 : 0;
    const w = Math.sqrt((br * r_[0]) ** 2 + (dep * f_[0]) ** 2) + ease;
    const c = P2(add(add(P, mul(sub(J.Nb, P), t)), mul(f_, 0.06 * Math.sin(Math.PI * t))));
    left.push(a2(c, m2(nn2, w)));
    right.push(s2(c, m2(nn2, w)));
  }
  const top = P2(J.Nb);
  const neckw = b.neck_w;
  const shs = [P2(J.ShR), P2(J.ShL)].sort((x, y) => d2(s2(x, top), nn2) - d2(s2(y, top), nn2));
  const torso: V2[] = [
    ...right,
    s2(s2(shs[0], m2(nn2, 0.19)), m2(sp2, 0.05)), a2(s2(shs[0], m2(nn2, 0.07)), m2(sp2, 0.19)),
    a2(s2(top, m2(nn2, neckw)), m2(sp2, 0.06)), a2(a2(top, m2(nn2, neckw)), m2(sp2, 0.06)),
    a2(a2(shs[1], m2(nn2, 0.07)), m2(sp2, 0.19)), s2(a2(shs[1], m2(nn2, 0.19)), m2(sp2, 0.05)),
    ...[...left].reverse(),
  ];
  const coatkind = b.coat;
  const folds: V2[][] = [];
  if (['long', 'parka', 'jacket', 'dress', 'skirt'].includes(coatkind)) {
    const hipY = P[1];
    const Lc = Math.max(0.05, hipY - b.hem);
    const sk: V2[] = [];
    const down: V2 = [0, 1];
    for (const side of ['R', 'L'] as const) {
      const H = P2(J[`H${side}`]);
      const K = P2(J[`K${side}`]);
      const th = s2(K, H);
      const tl = Math.hypot(th[0], th[1]);
      const along = th[1] < tl * 0.9 ? Math.min(Lc, tl * 0.85) : Math.min(Lc, tl);
      const aPt = a2(H, m2(n2(th), along));
      const rem = Lc - along;
      const gdir = rem > 0 ? n2(a2(m2(n2(th), 0.35), m2(down, 0.65))) : down;
      let end: V2;
      let mid: V2;
      if (th[1] >= tl * 0.9) {
        end = a2(H, m2(n2(a2(m2(n2(th), 0.55), m2(down, 0.45))), Lc));
        mid = lerp2(H, end, 0.5);
      } else {
        end = a2(aPt, m2(gdir, rem));
        mid = aPt;
      }
      // the hem trails a moving body a little (coat lag)
      end = [end[0] - coatLag * Math.min(1, Lc / 2), end[1]];
      const fl = b.flare + (coatkind === 'dress' || coatkind === 'skirt' ? 0.12 : 0);
      sk.push([mid[0] + 0.31, mid[1]], [mid[0] - 0.31, mid[1]], [end[0] + 0.31 + fl, end[1]], [end[0] - 0.31 - fl, end[1]]);
    }
    sk.push(left[0], right[0], left[1], right[1]);
    const skirt = hull(sk);
    add_('coat', skirt, 0, { tag: 'skirt', group: 'coat', smooth: false });
    if (['long', 'parka', 'dress'].includes(coatkind) && Lc > 0.6) {
      const xs = skirt.map(q => q[0]);
      const mx0 = Math.min(...xs);
      const mx1 = Math.max(...xs);
      const ytop = P2(P)[1] + 0.25;
      const ybot = Math.max(...skirt.map(q => q[1])) - 0.1;
      const w_ = mx1 - mx0;
      for (const [fr, dr, ln] of [[0.3, -0.05, 0.95], [0.56, 0.02, 0.7], [0.8, 0.06, 0.9]]) {
        const a: V2 = [mx0 + w_ * fr - coatLag * 0.15, ytop + (1 - ln) * 0.3];
        const bp: V2 = [mx0 + w_ * (fr + dr) - coatLag * 0.5 * ln, ytop + (ybot - ytop) * ln + (1 - ln) * 0.3];
        folds.push([a, a2(lerp2(a, bp, 0.5), [0.025, 0]), bp]);
      }
      const low = [...skirt].sort((x, y) => y[1] - x[1]).slice(0, 2).sort((x, y) => x[0] - y[0]);
      if (low.length === 2) folds.push([a2(low[0], [0.06, -0.07]), a2(low[1], [-0.06, -0.07])]);
    }
  }
  const trole: Role = ['long', 'jacket', 'parka', 'dress', 'skirt', 'sweater'].includes(coatkind) ? 'coat' : 'inner';
  add_(trole, torso, 0, { tag: 'torso', group: 'coat', smooth: false });
  if (['long', 'jacket', 'parka'].includes(coatkind)) {
    const col: V2[] = [a2(s2(top, m2(nn2, neckw + 0.13)), [0, 0.05]), a2(s2(top, m2(nn2, neckw + 0.04)), [0, -0.3]), a2(a2(top, m2(nn2, neckw + 0.04)), [0, -0.3]), a2(a2(top, m2(nn2, neckw + 0.13)), [0, 0.05])];
    add_('coat', col, 0.3, { tag: 'collar', shade: false, smooth: false });
  }
  const facing = fc[2];
  if (b.open && (coatkind === 'long' || coatkind === 'jacket') && facing > 0.15) {
    const strip: V2[] = [0.9, 0.7, 0.5, 0.25].map(t => P2(add(add(P, mul(sub(J.Nb, P), t)), mul(fc, b.depth * 0.92))));
    const wds = [0.12, 0.09, 0.05, 0.025];
    const wsc = Math.min(1, facing * 1.3);
    add_('inner', chain(strip, wds.map(w => w * wsc + 0.01), 2, 3), 0.1, { tag: 'opening', shade: false });
    if (coatkind === 'long') {
      const seamEnd = a2(P2(add(P, mul(fc, b.depth * 0.95))), [0, (P[1] - b.hem) * 0.98]);
      add_('seam', [...strip, seamEnd], 0.12, { tag: 'seam', shade: false });
    }
  }
  if (['long', 'parka', 'dress'].includes(coatkind)) {
    for (const f of folds) add_('fold', f, 0.11, { tag: 'fold', shade: false });
    if (b.belt && coatkind === 'long') {
      const i = 2;
      add_('belt', [a2(a2(left[i], m2(sp2, 0.08)), m2(nn2, 0.02)), s2(a2(right[i], m2(sp2, 0.08)), m2(nn2, 0.02)), s2(s2(right[i], m2(sp2, 0.08)), m2(nn2, 0.02)), a2(s2(left[i], m2(sp2, 0.08)), m2(nn2, 0.02))], 0.13, { tag: 'belt', shade: false, smooth: false });
    }
    if (facing > -0.2) {
      const pc = a2(P2(add(add(P, mul(fc, b.depth * 0.9)), mul(rc, 0.28))), [0, 0.55]);
      add_('fold', [a2(pc, [-0.18, 0.02]), a2(pc, [0.18, -0.02])], 0.11, { tag: 'fold', shade: false });
    }
  }
  for (const [role, pts] of front) add_(role, pts, 1, { tag: 'arm', shade: role.startsWith('coat') });

  // neck + head
  const Hn = P2(J.Hn);
  const Hc = P2(J.Hc);
  add_('skin', limb(P2(sub(J.Nb, mul(J.nd, 0.05))), lerp2(Hn, Hc, 0.35), b.neck_w * 0.72, b.neck_w * 0.62, 0, 3), 1.5, { tag: 'neck', shade: false });
  const up2 = n2([J.hup[0], -J.hup[1]]);
  const rot = Math.atan2(up2[1], up2[0]) + Math.PI / 2;
  const head: HeadSpec = { c: Hc, rx: b.head_w / 2, ry: b.head_h / 2, rot, side: J.fh[0], facing: J.fh[2], hair: b.hair };
  return { parts, head, J };
}

/* ---------------------------------------------------------------------- head --- */

function egg(c: V2, rx: number, ry: number, rot: number, n = 28, chin = 0.16): V2[] {
  const out: V2[] = [];
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    const y = Math.sin(a) * ry;
    const x = Math.cos(a) * rx * (1 - chin * Math.max(0, Math.sin(a)));
    out.push([c[0] + x * cr - y * sr, c[1] + x * sr + y * cr]);
  }
  return out;
}

/** Head parts in draw order: back hair, skin egg, profile nose, hair cap, the face plane's shadow. */
export function headShapes(h: HeadSpec): Array<[Role, V2[]]> {
  const { c, rx, ry, rot, side, facing, hair } = h;
  const sg = side >= 0 ? 1 : -1;
  const asd = Math.min(1, Math.abs(side));
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  const L = (x0: number, y: number): V2 => {
    const x = x0 * sg;
    return [c[0] + x * cr - y * sr, c[1] + x * sr + y * cr];
  };
  const out: Array<[Role, V2[]]> = [];
  if (hair === 'long' || hair === 'tied') {
    const bk = -0.55 * asd;
    out.push(['hair', [L(bk * rx - 0.05, -0.3 * ry), L(bk * rx - 0.45 * rx * asd - 0.1, 0.4 * ry), L(bk * rx - 0.35 * asd - 0.05, (hair === 'long' ? 1.45 : 1.0) * ry), L(0.15 * rx * (1 - asd) + bk * rx * 0.2, (hair === 'long' ? 1.5 : 0.9) * ry), L(0.55 * rx * (1 - asd), 1.2 * ry), L(0.6 * rx * (1 - asd), -0.3 * ry)]]);
  }
  if (hair === 'bob') out.push(['hair', [L(-1.08 * rx, -0.2 * ry), L(-1.12 * rx, 0.55 * ry), L(-0.2 * rx * asd, 0.72 * ry), L(0.2 * rx * (1 - asd), 0.7 * ry), L(1.05 * rx * (1 - asd) + 0.1 * asd, 0.5 * ry), L(rx, -0.3 * ry)]]);
  out.push(['skin', egg(c, rx, ry, rot, 28, 0.18)]);
  if (facing > -0.35 && asd > 0.35) {
    const k = (asd - 0.35) / 0.65;
    out.push(['skin', [L(0.88 * rx, -0.12 * ry), L(rx + 0.07 * k, 0.14 * ry), L(0.93 * rx, 0.2 * ry), L(0.8 * rx, 0.12 * ry)]]);
  }
  const vol = ({ crop: 1.04, short: 1.09, bob: 1.1, long: 1.09, tied: 1.06, bun: 1.07, curly: 1.22, thin: 1.02, scarf: 1.12, bald: 1.0 } as Record<string, number>)[hair] ?? 1.08;
  if (hair !== 'bald') {
    let a0 = 18 + 52 * asd;
    let a1 = 162 + 92 * asd;
    if (hair === 'crop' || hair === 'thin') {
      a0 += 10;
      a1 -= 10 * (1 - asd);
    }
    if (facing < -0.15) {
      const t = Math.min(1, (-facing - 0.15) * 2.2);
      a1 = a1 + (360 + a0 - 8 - a1) * t;
    }
    const arc: V2[] = [];
    for (let i = 0; i <= 16; i++) {
      const a = rad(a0 + ((a1 - a0) * i) / 16);
      arc.push(L(Math.cos(a) * rx * vol, -Math.sin(a) * ry * (Math.sin(a) > 0 ? vol : 1.02)));
    }
    let pts: V2[];
    if (facing < -0.15 && a1 - a0 > 300) pts = arc;
    else {
      const hl = hair === 'crop' || hair === 'thin' ? 0.55 : 0.42;
      const fr: V2[] = [[-0.62, -0.3], [0, -hl - 0.05], [0.62, -0.3]];
      const pr: V2[] = [[-0.32, 0.3], [0.3, -0.12], [0.55, -0.3]];
      pts = [...arc, ...fr.map((f, i) => L((f[0] * (1 - asd) + pr[i][0] * asd) * rx, (f[1] * (1 - asd) + pr[i][1] * asd) * ry))];
    }
    out.push(['hair', pts]);
  }
  // Design face option B: a brow/nose shadow plane when the face is toward the camera.
  if (facing > 0.5 && asd < 0.3) {
    const nx = (0.12 + 0.75 * asd) * rx;
    out.push(['skin_sh', [L(nx + 0.01, -0.1 * ry), L(nx + 0.035, 0.2 * ry), L(nx - 0.07, 0.22 * ry)]]);
  }
  return out;
}

/* --------------------------------------------------------------------- paths --- */

const f3 = (v: number) => (Math.round(v * 1000) / 1000).toString();
export function smoothPath(pts: V2[], closed = true, tension = 0.5): string {
  const n = pts.length;
  if (n < 3) return 'M' + pts.map(p => `${f3(p[0])},${f3(p[1])}`).join(' L') + (closed ? 'Z' : '');
  let d = `M${f3(pts[0][0])},${f3(pts[0][1])}`;
  const end = closed ? n : n - 1;
  for (let i = 0; i < end; i++) {
    const p0 = closed || i > 0 ? pts[(i - 1 + n) % n] : pts[i];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = closed || i + 2 < n ? pts[(i + 2) % n] : p2;
    const c1 = a2(p1, m2(s2(p2, p0), tension / 3));
    const c2 = s2(p2, m2(s2(p3, p1), tension / 3));
    d += ` C${f3(c1[0])},${f3(c1[1])} ${f3(c2[0])},${f3(c2[1])} ${f3(p2[0])},${f3(p2[1])}`;
  }
  return d + (closed ? 'Z' : '');
}

/* -------------------------------------------------------------------- colour --- */

const hexrgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgbhex = (c: number[]) => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
/** k < 0 darkens; k > 0 lightens toward paper. */
export const shade = (h: string, k: number) => {
  const c = hexrgb(h);
  if (k < 0) return rgbhex(c.map(v => v * (1 + k)));
  const tgt = [236, 228, 212];
  return rgbhex(c.map((v, i) => v + (tgt[i] - v) * k));
};
export const mix = (a: string, b: string, t: number) => {
  const A = hexrgb(a);
  const B = hexrgb(b);
  return rgbhex(A.map((x, i) => x + (B[i] - x) * t));
};

export function paletteRoles(b: Body): Record<string, string> {
  const pal = b.pal;
  const coat = b.coat === 'shirt' ? pal.inner : pal.coat;
  return {
    coat, coat_far: shade(coat, -0.18), trousers: pal.trousers, trousers_far: shade(pal.trousers, -0.25),
    skin: pal.skin, skin_far: shade(pal.skin, -0.15), skin_sh: shade(pal.skin, -0.28), hair: pal.hair, inner: pal.inner,
    inner_sleeve: pal.inner, inner_far: shade(pal.inner, -0.15), shoe: pal.shoe, scarf: pal.scarf ?? '#B5523A', belt: shade(coat, -0.2),
  };
}

/** Light-side shading offsets (head units) per part tag (Design SH_OFF). */
export const SH_OFF: Record<string, number> = { skirt: 0.3, torso: 0.26, arm: 0.1, leg: 0.11, pelvis: 0, head: 0.08 };
