/**
 * A painted-mass body for the scene viewport: three cast members drawn from Design's rig palette, in the handful
 * of poses the approved frames use. Presentation only — position, owner and posture come from the snapshot,
 * compiled marks and staging; a pose never changes a receipt.
 *
 * Coordinates: viewBox 0 0 60 100, 100 units = stature, feet centre at (30, 100), facing right (mirrored for left).
 * The held summary (an object the holder owns) is drawn at the pose's hand or lap slot.
 */

import React from 'react';
import type { FigureSpec } from './staging';

export type FigurePose = 'hold' | 'look' | 'read' | 'walk' | 'speak' | 'ask' | 'still' | 'gesture' | 'table';

interface Props {
  spec: FigureSpec;
  posture: 'stand' | 'seat';
  pose: FigurePose;
  facingLeft: boolean;
  /** Draw the held summary (the holder owns it). */
  holding?: { src?: string };
  /** Boundary: the body becomes ink; nothing else changes. */
  ink?: boolean;
  testId?: string;
  label?: string;
}

const PAPER_EDGE = '#EFE6D4';
type Pt = [number, number];

export function Figure({ spec, posture, pose, facingLeft, holding, ink, testId, label }: Props) {
  const p = spec.palette;
  const c = (x: string) => (ink ? '#211F1D' : x);
  const seated = posture === 'seat';
  const slight = spec.build === 'slight';
  const broad = spec.build === 'broad';
  const shoulderW = broad ? 17 : slight ? 13 : 15;
  const hemY = spec.build === 'hero' ? (seated ? 82 : 74) : seated ? 76 : 54;
  const lean = pose === 'ask' ? 18 : pose === 'speak' ? -3 : 0;

  // Skeleton (standing frame unless seated).
  const hip: Pt = seated ? [29, 72] : [30, 51];
  const shoulderY = seated ? 41 : 19;
  const head: Pt = seated ? [31, 31] : [31.5, 9];
  const headDown = pose === 'read' ? 2 : pose === 'ask' ? 1 : 0;

  const arm = (shoulder: Pt, elbow: Pt, hand: Pt, colour: string, key: string) => (
    <g key={key}>
      <path d={`M${shoulder[0]} ${shoulder[1]} L${elbow[0]} ${elbow[1]} L${hand[0]} ${hand[1]}`} fill="none" stroke={c(colour)} strokeWidth={broad ? 5.4 : 4.6} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={hand[0]} cy={hand[1]} r={1.9} fill={c(p.skin)} />
    </g>
  );

  // Hands per pose (near = right side of the body when facing right).
  const sNear: Pt = [30 + shoulderW / 2 - 1, shoulderY + 2];
  const sFar: Pt = [30 - shoulderW / 2 + 2, shoulderY + 2];
  let near: [Pt, Pt];
  let far: [Pt, Pt];
  let prop: Pt | undefined = holding ? [0, 0] : undefined;
  switch (pose) {
    case 'speak':
      near = [[sNear[0] + 6, sNear[1] + 4], [sNear[0] + 14, sNear[1] - 1]];
      far = [[sFar[0] + 1, sFar[1] + 13], [sFar[0] + 3, sFar[1] + 24]];
      prop = holding && near[1];
      break;
    case 'ask':
      near = [[sNear[0] + 6, sNear[1] + 8], [sNear[0] + 12, sNear[1] + 12]];
      far = [[sFar[0] + 4, sFar[1] + 12], [sFar[0] + 9, sFar[1] + 20]];
      prop = holding && far[1];
      break;
    case 'look':
      near = [[sNear[0] + 4, sNear[1] + 12], [sNear[0] + 13, sNear[1] + 16]];
      far = [[sFar[0] + 4, sFar[1] + 12], [sFar[0] + 9, sFar[1] + 8]];
      prop = holding && far[1];
      break;
    case 'read':
      near = [[sNear[0] + 3, sNear[1] + 12], [sNear[0] + 2, sNear[1] + 6]];
      far = [[sFar[0] + 5, sFar[1] + 12], [sFar[0] + 9, sFar[1] + 7]];
      prop = holding && [sNear[0] + 1, sNear[1] + 7];
      break;
    case 'gesture':
      near = [[sNear[0] + 4, sNear[1] + 6], [sNear[0] + 13, sNear[1] + 2]];
      far = [[sFar[0] + 1, sFar[1] + 13], [sFar[0] + 2, sFar[1] + 24]];
      break;
    case 'table':
      near = [[sNear[0] + 3, sNear[1] + 12], [sNear[0] + 14, sNear[1] + 12]];
      far = [[sFar[0] + 4, sFar[1] + 12], [sFar[0] + 14, sFar[1] + 13]];
      break;
    case 'still':
      near = [[sNear[0] + 1, sNear[1] + 13], [sNear[0] + 3, sNear[1] + (seated ? 22 : 25)]];
      far = [[sFar[0] + 2, sFar[1] + 13], [sFar[0] + 6, sFar[1] + (seated ? 22 : 25)]];
      prop = holding && (seated ? [hip[0] + 8, hip[1] - 2] : near[1]);
      break;
    default: // hold / walk
      near = [[sNear[0] + 2, sNear[1] + 12], [sNear[0] + 9, sNear[1] + 16]];
      far = [[sFar[0] + 1, sFar[1] + 13], [sFar[0] + 2, sFar[1] + 24]];
      prop = holding && (seated ? [hip[0] + 9, hip[1] - 4] : near[1]);
  }

  const legs = seated ? (
    <g>
      <path d={`M${hip[0] - 2} ${hip[1]} L${hip[0] + 15} ${hip[1] + 1} L${hip[0] + 15} 96`} fill="none" stroke={c(p.trousers)} strokeWidth={5.6} strokeLinejoin="round" />
      <path d={`M${hip[0] - 4} ${hip[1] - 1} L${hip[0] + 13} ${hip[1] - 1} L${hip[0] + 12} 96`} fill="none" stroke={c(p.trousers)} strokeWidth={5.2} strokeLinejoin="round" opacity={0.85} />
      <ellipse cx={hip[0] + 17} cy={98} rx={4.4} ry={1.8} fill={c(p.shoe)} />
      <ellipse cx={hip[0] + 14} cy={98.6} rx={4} ry={1.6} fill={c(p.shoe)} />
    </g>
  ) : (
    <g>
      <path d={`M${hip[0] - 3} ${hip[1]} L${hip[0] - (pose === 'walk' ? 6 : 3)} 97`} stroke={c(p.trousers)} strokeWidth={5.4} strokeLinecap="round" />
      <path d={`M${hip[0] + 2} ${hip[1]} L${hip[0] + (pose === 'walk' ? 6 : 2)} 97`} stroke={c(p.trousers)} strokeWidth={5.6} strokeLinecap="round" />
      <ellipse cx={hip[0] - (pose === 'walk' ? 5 : 2)} cy={98.5} rx={4} ry={1.5} fill={c(p.shoe)} />
      <ellipse cx={hip[0] + (pose === 'walk' ? 8 : 4)} cy={98.8} rx={4.2} ry={1.6} fill={c(p.shoe)} />
    </g>
  );

  const torsoTop = shoulderY;
  const half = shoulderW / 2;
  const coat = `M${30 - half} ${torsoTop + 1} Q30 ${torsoTop - 2} ${30 + half} ${torsoTop + 1} L${30 + half + 2} ${hemY} L${30 - half - 2} ${hemY} Z`;
  const body = (
    <g transform={`rotate(${lean} ${hip[0]} ${hip[1]})`}>
      {arm(sFar, far[0], far[1], p.coat, 'far')}
      <path d={coat} fill={c(p.coat)} />
      <path d={`M29.2 ${torsoTop + 2} L30.8 ${torsoTop + 2} L30.4 ${Math.min(hemY, torsoTop + 22)} L29.6 ${Math.min(hemY, torsoTop + 22)} Z`} fill={c(p.inner)} opacity={0.7} />
      <rect x={29.2} y={torsoTop - 4} width={3.4} height={5} fill={c(p.skin)} />
      <g transform={`rotate(${headDown * 6} ${head[0]} ${head[1] + 6})`}>
        <ellipse cx={head[0]} cy={head[1]} rx={5.1} ry={6.4} fill={c(p.skin)} />
        <path d={`M${head[0] - 5.4} ${head[1] - 0.5} Q${head[0] - 4} ${head[1] - 8.4} ${head[0] + 2} ${head[1] - 6.8} Q${head[0] + 5.6} ${head[1] - 5} ${head[0] + 4.4} ${head[1] - 2.2} L${head[0] - 1} ${head[1] - 3.4} L${head[0] - 3} ${head[1] + 3.5} Z`} fill={c(p.hair)} />
      </g>
      {arm(sNear, near[0], near[1], p.coat, 'near')}
      {prop && holding && (
        <g data-testid={testId ? `${testId}-summary` : undefined}>
          {holding.src && !ink ? (
            <image href={holding.src} x={prop[0] - 3.6} y={prop[1] - 9.2} width={7.2} height={9.6} preserveAspectRatio="none" />
          ) : (
            <rect x={prop[0] - 3.6} y={prop[1] - 9.2} width={7.2} height={9.6} fill={ink ? '#F2ECE0' : '#F4EFE6'} stroke="#8A8279" strokeWidth={0.3} />
          )}
        </g>
      )}
    </g>
  );

  return (
    <svg viewBox="0 0 60 100" preserveAspectRatio="xMidYMax meet" width="100%" height="100%" aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label} data-testid={testId} data-pose={pose} data-posture={posture} style={{ overflow: 'visible', display: 'block' }}>
      <g transform={facingLeft ? 'translate(60 0) scale(-1 1)' : undefined} style={{ paintOrder: 'stroke' }} stroke={ink ? undefined : PAPER_EDGE} strokeWidth={0}>
        <ellipse cx={30} cy={99.4} rx={13} ry={2.2} fill="#1C1A19" opacity={ink ? 0.18 : 0.14} />
        {legs}
        {body}
      </g>
    </svg>
  );
}
