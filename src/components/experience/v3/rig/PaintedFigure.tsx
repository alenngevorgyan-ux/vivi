/**
 * A painted figure, drawn the way Design r4 draws its frames (generator/render.py, style A), live:
 *
 *   contact shadow · (hero) cream paper-cut halo · per-mass shadow colour with the lit colour clipped and offset
 *   toward the light · coat folds and placket seam · head (hair cap, face plane, profile nose) · the held prop
 *   — all through Design's paint filter (edge displacement + pigment grain) and an optional location tint.
 *
 * `finish` < 1 lays a graphite outline under colours washed toward paper (a figure outside attention); `ink`
 * draws the boundary silhouette. Presentation only: geometry comes from the rig, placement from the viewport.
 */

import React, { useId } from 'react';
import { build, headShapes, mix, paletteRoles, SH_OFF, shade, smoothPath, type Body, type Part, type Pose, type V2 } from './rig';
import { propMode } from './poses';

export interface PaintedFigureProps {
  body: Body;
  pose: Pose;
  /** CSS px per head unit. */
  hu: number;
  hero?: boolean;
  finish?: number;
  ink?: boolean;
  tint?: 'cold' | 'warm';
  /** Coat hem drag, head units (screen x). */
  coatLag?: number;
  /** The hero's held summary. */
  prop?: { src?: string };
  testId?: string;
  label?: string;
  /** Ground contact shadows (off for a body seen through glass). */
  contact?: boolean;
  /** QA attributes (the runtime's pose name and posture). */
  dataPose?: string;
  dataPosture?: string;
}

const f = (v: number) => (Math.round(v * 1000) / 1000).toString();
const LIGHT: V2 = (() => {
  const l = Math.hypot(-1, -0.55);
  return [-1 / l, -0.55 / l];
})();

function PaintedFigureImpl({ body: b, pose: p, hu, hero, finish = 1, ink, tint, coatLag = 0, prop, testId, label, contact = true, dataPose, dataPosture }: PaintedFigureProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const { parts, head, J } = build(b, p, coatLag);
  const roles = paletteRoles(b);
  const seams = parts.filter(x => x.role === 'seam' || x.role === 'fold');
  type D = Part & { headPart?: boolean };
  const draw: D[] = parts.filter(x => x.role !== 'seam' && x.role !== 'fold');
  // the head is drawn last among body parts (Design z = 2)
  for (const [role, pts] of headShapes(head)) draw.push({ role, pts, z: 2, tag: 'head', shade: role === 'skin', group: role === 'skin' ? 'headskin' : undefined, headPart: true });

  const P = (d: D) => smoothPath(d.pts, true, d.smooth === false ? 0.18 : 0.5);
  const colOf = (d: D) => {
    let c = roles[d.role] ?? '#888888';
    if (finish < 1) c = mix('#C9C0AF', c, finish);
    return c;
  };

  // Bounds in head units, for the svg box.
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const d of draw)
    for (const q of d.pts) {
      if (q[0] < x0) x0 = q[0];
      if (q[0] > x1) x1 = q[0];
      if (q[1] < y0) y0 = q[1];
      if (q[1] > y1) y1 = q[1];
    }
  const pad = 0.9;
  x0 -= pad;
  x1 += pad;
  y0 -= pad;
  y1 = Math.max(y1, 0) + 0.5;
  const W = (x1 - x0) * hu;
  const H = (y1 - y0) * hu;

  // Group consecutive parts that share a group key (the coat's torso + skirt shade as one mass).
  const items: D[][] = [];
  for (const d of draw) {
    const last = items[items.length - 1];
    if (d.group && last && last[0].group === d.group) last.push(d);
    else items.push([d]);
  }

  const g: React.ReactNode[] = [];
  const defs: React.ReactNode[] = [];
  if (ink) {
    g.push(
      <g key="ink" fill="#1d1b1a">
        {draw.map((d, i) => (
          <path key={i} d={P(d)} />
        ))}
      </g>
    );
  } else {
    if (finish < 1)
      g.push(
        <g key="graphite" fill="#5B5650" stroke="#5B5650" strokeWidth={0.07} strokeLinejoin="round" opacity={Math.min(1, 1.2 * (1 - finish))}>
          {draw.map((d, i) => (
            <path key={i} d={P(d)} />
          ))}
        </g>
      );
    if (hero)
      g.push(
        <g key="halo" fill="#EDE5D3" stroke="#EDE5D3" strokeWidth={0.17} strokeLinejoin="round" opacity={0.88}>
          {draw.map((d, i) => (
            <path key={i} d={P(d)} />
          ))}
        </g>
      );
    items.forEach((grp, gi) => {
      const d0 = grp[0];
      const col = colOf(d0);
      const off = d0.shade ? Math.max(...grp.map(d => SH_OFF[d.tag ?? ''] ?? 0)) : 0;
      if (off > 0 && finish > 0.4) {
        const cid = `${uid}c${gi}`;
        defs.push(
          <clipPath key={cid} id={cid}>
            {grp.map((d, i) => (
              <path key={i} d={P(d)} />
            ))}
          </clipPath>
        );
        g.push(
          <g key={`s${gi}`} fill={shade(col, -0.22)}>
            {grp.map((d, i) => (
              <path key={i} d={P(d)} />
            ))}
          </g>,
          <g key={`l${gi}`} clipPath={`url(#${cid})`}>
            <g fill={col} transform={`translate(${f(LIGHT[0] * off)},${f(LIGHT[1] * off * 0.6)})`}>
              {grp.map((d, i) => (
                <path key={i} d={P(d)} />
              ))}
            </g>
          </g>
        );
      } else grp.forEach((d, i) => g.push(<path key={`p${gi}-${i}`} d={P(d)} fill={colOf(d)} />));
    });
    if (finish > 0.6)
      seams.forEach((sm, i) =>
        g.push(
          <path
            key={`seam${i}`}
            d={smoothPath(sm.pts, false)}
            fill="none"
            stroke={shade(roles.coat, sm.role === 'fold' ? -0.32 : -0.3)}
            strokeWidth={sm.role === 'fold' ? 0.032 : 0.035}
            strokeLinecap="round"
            opacity={sm.role === 'fold' ? 0.75 : 1}
          />
        )
      );
  }

  // The held summary at the gripping hand (Design hero_prop_fn).
  let propNode: React.ReactNode = null;
  if (prop && !ink) {
    const mode = propMode(p);
    const hand = mode === 'L' ? J.WL : J.WR;
    const arm = mode === 'L' ? p.armL : p.armR;
    let c: V2 = [hand[0], -hand[1]];
    let ang = -8;
    let scale = 1;
    if (mode === 'lap') {
      c = [(J.WR[0] + J.WL[0]) / 2, -(J.WR[1] + J.WL[1]) / 2 - 0.06];
      ang = -78;
      scale = 0.85;
    } else if (arm.flex > 60) {
      c = [c[0] + 0.22, c[1] - 0.38];
      ang = -4;
    } else if (arm.flex < 8) {
      c = [c[0] + 0.08, c[1] - 0.05];
      ang = -80;
      scale = 0.95;
    } else c = [c[0] + 0.25, c[1] - 0.35];
    const w = 0.7 * scale;
    const h = 0.96 * scale;
    propNode = (
      <g transform={`translate(${f(c[0])},${f(c[1])}) rotate(${ang})`} data-testid={testId ? `${testId}-summary` : undefined}>
        <rect x={-w / 2 + 0.05} y={-h / 2 + 0.05} width={w} height={h} fill="#D9D1C0" />
        {prop.src ? <image href={prop.src} x={-w / 2} y={-h / 2} width={w} height={h} preserveAspectRatio="none" /> : <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="#F1EBDF" />}
      </g>
    );
  }

  // Contact: a soft pool under each grounded foot (Design contactG), plus a broad ground shadow.
  const shadows: React.ReactNode[] = [];
  if (contact && !ink) {
    for (const sd of ['R', 'L'] as const) {
      const hl = J[`heel${sd}`];
      const tl = J[`toe${sd}`];
      if (Math.min(hl[1], tl[1]) < 0.12) {
        const cx = (hl[0] + tl[0]) / 2;
        const ln = Math.abs(hl[0] - tl[0]) / 2 + 0.25;
        shadows.push(<ellipse key={sd} cx={f(cx)} cy={0.02} rx={f(ln)} ry={0.075} fill={`url(#${uid}cg)`} />);
      }
    }
  }
  const px = (J.P[0] + 0) as number;
  const dispScale = Math.max(1.2, Math.min(6, hu * 0.075));
  const fid = `${uid}paint`;
  const tid = `${uid}tint`;

  return (
    <svg
      className="v3p-figure"
      width={W}
      height={H}
      viewBox={`${f(x0 * hu)} ${f(y0 * hu)} ${f(W)} ${f(H)}`}
      style={{ position: 'absolute', left: x0 * hu, top: y0 * hu, overflow: 'visible', pointerEvents: 'none' }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-testid={testId}
      data-pose-yaw={Math.round(p.yaw)}
      data-pose={dataPose}
      data-posture={dataPosture}
    >
      <defs>
        <radialGradient id={`${uid}cg`}>
          <stop offset="0" stopColor="#120e0b" stopOpacity={0.5} />
          <stop offset="0.6" stopColor="#120e0b" stopOpacity={0.22} />
          <stop offset="1" stopColor="#120e0b" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${uid}gs`}>
          <stop offset="0" stopColor="#2b2620" stopOpacity={0.22} />
          <stop offset="1" stopColor="#2b2620" stopOpacity={0} />
        </radialGradient>
        <filter id={fid} x="-15%" y="-10%" width="130%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency={0.045 * (60 / Math.max(20, hu))} numOctaves={3} seed={4} result="n1" />
          <feDisplacementMap in="SourceGraphic" in2="n1" scale={dispScale} xChannelSelector="R" yChannelSelector="G" result="d" />
          <feTurbulence type="fractalNoise" baseFrequency={0.85} numOctaves={2} seed={9} result="n2" />
          <feColorMatrix in="n2" type="matrix" values="0 0 0 0 0.08  0 0 0 0 0.06  0 0 0 0 0.04  0 0 0 -1.3 0.78" result="gr" />
          <feComposite in="gr" in2="d" operator="in" result="gd" />
          <feMerge>
            <feMergeNode in="d" />
            <feMergeNode in="gd" />
          </feMerge>
        </filter>
        {tint && (
          <filter id={tid} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
            <feFlood floodColor={tint === 'cold' ? '#D2DAE1' : '#F7E9D2'} result="fl" />
            <feBlend in="SourceGraphic" in2="fl" mode="multiply" result="m" />
            <feComposite in="m" in2="SourceAlpha" operator="in" />
          </filter>
        )}
      </defs>
      {contact && !ink && <ellipse cx={px * hu} cy={0.02 * hu} rx={1.5 * hu} ry={0.16 * hu} fill={`url(#${uid}gs)`} />}
      <g transform={`scale(${f(hu)})`}>{shadows}</g>
      <g filter={tint && !ink ? `url(#${tid})` : undefined}>
        <g filter={`url(#${fid})`}>
          <g transform={`scale(${f(hu)})`}>
            <defs>{defs}</defs>
            {g}
          </g>
        </g>
        {propNode && <g transform={`scale(${f(hu)})`}>{propNode}</g>}
      </g>
    </svg>
  );
}

/**
 * Redrawn only when what it shows changes: the pose object is re-sampled on twos (12 fps), the scale is
 * quantized by the caller, so a following camera costs a CSS transform, not a repaint of filtered paint.
 */
export const PaintedFigure = React.memo(PaintedFigureImpl, (a, b) =>
  a.body === b.body && a.pose === b.pose && a.hu === b.hu && a.hero === b.hero && a.finish === b.finish && a.ink === b.ink && a.tint === b.tint && a.coatLag === b.coatLag && a.prop?.src === b.prop?.src && a.contact === b.contact && a.dataPose === b.dataPose && a.dataPosture === b.dataPosture && a.label === b.label
);
