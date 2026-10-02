import React from 'react';
import { characters, type CharacterFacing, type CharacterPose, type ViviCharacterId } from './characters';
import { useViviClock } from './animationClock';

/**
 * Vivi figure geometry, in the shared 56 × 100 unit box.
 *
 * Head height is roughly a sixth of standing height: stylised, but adult.
 * Every pose solves the same two-segment limbs from these landmarks, so a
 * character keeps one silhouette across facings, poses and worlds.
 */
const CX = 28;
const HEAD_CY = 13.5;
const HEAD_RX = 6.9;
const HEAD_RY = 8;
const NECK_Y = 21;
const SHOULDER_Y = 26.5;
const CHEST_Y = 34;
const WAIST_Y = 47;
const HIP_Y = 55.5;
const KNEE_LEN = 21;
const SHIN_LEN = 20.5;
const UPPER_ARM = 14.5;
const FOREARM = 13.5;
const GROUND_Y = 95;

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

interface Joint {
  mx: number;
  my: number;
  ex: number;
  ey: number;
}

/** Solve a two-segment limb. Angles are degrees from straight-down, forward positive. */
function solveLimb(
  ox: number,
  oy: number,
  len1: number,
  len2: number,
  rootDeg: number,
  bendDeg: number
): Joint {
  const a1 = rootDeg * DEG;
  const mx = ox + Math.sin(a1) * len1;
  const my = oy + Math.cos(a1) * len1;
  const a2 = (rootDeg - bendDeg) * DEG;
  return { mx, my, ex: mx + Math.sin(a2) * len2, ey: my + Math.cos(a2) * len2 };
}

const limbPath = (ox: number, oy: number, j: Joint) =>
  `M${ox.toFixed(2)} ${oy.toFixed(2)} L${j.mx.toFixed(2)} ${j.my.toFixed(2)} L${j.ex.toFixed(2)} ${j.ey.toFixed(2)}`;

interface Rig {
  /** Vertical travel of the pelvis. Feet stay on the ground; only the body rides. */
  bob: number;
  /** Lateral weight shift of the pelvis. */
  sway: number;
  hipY: number;
  torsoLean: number;
  shoulderTilt: number;
  headTilt: number;
  headNudge: number;
  breath: number;
  legA: { root: number; bend: number };
  legB: { root: number; bend: number };
  armA: { root: number; bend: number };
  armB: { root: number; bend: number };
  seated: boolean;
  holdsPhone: boolean;
}

function buildRig(pose: CharacterPose, tMs: number, explicitPhase?: number): Rig {
  const walking = pose === 'walk' || pose === 'leave';
  const phase = explicitPhase ?? (tMs % 760) / 760;
  const theta = phase * TAU;

  // Two slow, unsynchronised oscillators keep a standing figure from looking frozen.
  const breath = Math.sin((tMs / 3400) * TAU);
  const weight = Math.sin((tMs / 5600) * TAU);

  if (walking) {
    const legSwing = pose === 'leave' ? 26 : 23;
    const legA = {
      root: Math.sin(theta) * legSwing,
      bend: Math.max(0, -Math.sin(theta + 0.9)) * 42,
    };
    const legB = {
      root: Math.sin(theta + Math.PI) * legSwing,
      bend: Math.max(0, -Math.sin(theta + Math.PI + 0.9)) * 42,
    };
    return {
      // Pelvis sits lowest at double support, when the legs are furthest apart.
      bob: Math.abs(Math.sin(theta)) * 1.15,
      sway: Math.sin(theta) * 0.45,
      hipY: HIP_Y,
      torsoLean: 2.2,
      shoulderTilt: -Math.sin(theta) * 1.1,
      headTilt: 0,
      headNudge: Math.sin(theta) * 0.2,
      breath: breath * 0.2,
      legA,
      legB,
      // Arms counter-swing against the legs, never in sympathy with them.
      armA: { root: -Math.sin(theta) * 17, bend: 14 + Math.max(0, Math.sin(theta)) * 16 },
      armB: { root: -Math.sin(theta + Math.PI) * 17, bend: 14 + Math.max(0, Math.sin(theta + Math.PI)) * 16 },
      seated: false,
      holdsPhone: false,
    };
  }

  if (pose === 'sit') {
    return {
      bob: 0,
      sway: 0,
      hipY: 70,
      torsoLean: 4,
      shoulderTilt: 0,
      headTilt: 3,
      headNudge: 0,
      breath: breath * 0.3,
      legA: { root: 74, bend: 78 },
      legB: { root: 69, bend: 74 },
      armA: { root: 18, bend: 44 },
      armB: { root: 14, bend: 38 },
      seated: true,
      holdsPhone: false,
    };
  }

  if (pose === 'look_at_phone') {
    return {
      bob: 0,
      sway: weight * 0.3,
      hipY: HIP_Y,
      torsoLean: 5,
      shoulderTilt: 0,
      // The head drops toward the light rather than the phone rising to the face.
      headTilt: 11,
      headNudge: 0.4,
      breath: breath * 0.25,
      legA: { root: 4, bend: 3 },
      legB: { root: -3, bend: 7 },
      armA: { root: 26, bend: 62 },
      armB: { root: -22, bend: 58 },
      seated: false,
      holdsPhone: true,
    };
  }

  if (pose === 'talk') {
    const gesture = Math.sin((tMs / 1500) * TAU);
    return {
      bob: 0,
      sway: weight * 0.4,
      hipY: HIP_Y,
      torsoLean: 1,
      shoulderTilt: gesture * 0.7,
      headTilt: -2,
      headNudge: gesture * 0.3,
      breath: breath * 0.4,
      legA: { root: 6, bend: 4 },
      legB: { root: -5, bend: 9 },
      armA: { root: 30 + gesture * 10, bend: 48 },
      armB: { root: -8, bend: 20 },
      seated: false,
      holdsPhone: false,
    };
  }

  if (pose === 'wait') {
    return {
      bob: 0,
      sway: weight * 0.9,
      hipY: HIP_Y,
      torsoLean: 0,
      shoulderTilt: 1.2,
      headTilt: 2,
      headNudge: weight * 0.5,
      breath: breath * 0.3,
      // Weight parked on one leg; the other is loose.
      legA: { root: 3, bend: 2 },
      legB: { root: -9, bend: 15 },
      armA: { root: 12, bend: 34 },
      armB: { root: -4, bend: 12 },
      seated: false,
      holdsPhone: false,
    };
  }

  if (pose === 'hesitate') {
    return {
      bob: 0,
      sway: weight * 0.5 - 0.8,
      hipY: HIP_Y,
      // Weight already travelling backwards while the front foot stays committed.
      torsoLean: -3,
      shoulderTilt: 1.6,
      headTilt: 4,
      headNudge: -0.5,
      breath: breath * 0.35,
      legA: { root: 13, bend: 6 },
      legB: { root: -14, bend: 24 },
      armA: { root: 8, bend: 40 },
      armB: { root: 6, bend: 36 },
      seated: false,
      holdsPhone: false,
    };
  }

  if (pose === 'turn') {
    return {
      bob: 0,
      sway: weight * 0.4,
      hipY: HIP_Y,
      torsoLean: 1,
      shoulderTilt: -1.4,
      headTilt: 0,
      headNudge: 0.8,
      breath: breath * 0.3,
      legA: { root: 9, bend: 5 },
      legB: { root: -7, bend: 12 },
      armA: { root: 6, bend: 22 },
      armB: { root: -2, bend: 16 },
      seated: false,
      holdsPhone: false,
    };
  }

  // idle
  return {
    bob: breath * 0.18,
    sway: weight * 0.7,
    hipY: HIP_Y,
    torsoLean: 0,
    shoulderTilt: weight * 0.6,
    headTilt: 0,
    headNudge: weight * 0.3,
    breath: breath * 0.45,
    legA: { root: 2.5, bend: 2 },
    legB: { root: -3.5, bend: 7 },
    armA: { root: 5, bend: 16 },
    armB: { root: -3, bend: 12 },
    seated: false,
    holdsPhone: false,
  };
}

function hairFront(shape: string) {
  switch (shape) {
    case 'cropped':
      return 'M21.2 9.6 Q28 3.6 35 9.8 Q36.3 13.6 35.4 15.6 Q33.6 11.4 28 11 Q22.6 10.8 20.8 15.4 Q20.2 12.4 21.2 9.6Z';
    case 'wavy':
      return 'M20.4 14.6 Q19.2 6.4 25.4 7.2 Q28.4 4.2 32.4 7 Q38.4 6.6 36.6 15.2 Q35.4 10.4 31.6 10.2 Q27.4 8.6 24.4 11.4 Q21.8 11.6 20.4 14.6Z';
    case 'long':
      return 'M20.6 13.4 Q20 5.6 28 5.4 Q36.2 5.6 35.6 13.6 Q33.4 9.6 28 9.4 Q22.8 9.4 20.6 13.4Z';
    default:
      return 'M20.8 13.8 Q20.6 5.8 28 5.6 Q35.6 5.8 35.4 13.6 Q33.2 9.8 28 9.6 Q22.8 9.8 20.8 13.8Z';
  }
}

/** Hair mass seen from behind: the whole head reads as one shape, no face. */
function hairBack(shape: string) {
  switch (shape) {
    case 'long':
      return 'M20.2 11 Q20 4.6 28 4.4 Q36 4.6 35.8 11 L36.6 28 Q28 31 19.4 28Z';
    case 'wavy':
      return 'M20.2 12 Q19.6 4.8 28 4.6 Q36.4 4.8 35.8 12 L36 21.6 Q28 24 20 21.6Z';
    case 'cropped':
      return 'M21 11.6 Q21 5.2 28 5 Q35 5.2 35 11.6 L35.2 18.4 Q28 20 20.8 18.4Z';
    default:
      return 'M20.6 11.4 Q20.4 4.8 28 4.6 Q35.6 4.8 35.4 11.4 L35.6 19.8 Q28 21.8 20.4 19.8Z';
  }
}

export function CharacterFigure({
  id,
  facing = 'front',
  pose = 'idle',
  size = 94,
  phase,
  animate = true,
}: {
  id: ViviCharacterId;
  facing?: CharacterFacing;
  pose?: CharacterPose;
  size?: number;
  /** Explicit walk phase 0–1. When omitted the shared clock drives the stride. */
  phase?: number;
  animate?: boolean;
}) {
  const c = characters[id];
  const tMs = useViviClock(animate && phase === undefined);
  const rig = buildRig(pose, tMs, phase);

  const side = facing === 'left' || facing === 'right';
  const back = facing === 'back';
  const buildScale = c.build === 'small' ? 0.78 : c.build === 'tall' ? 1.08 : 1;

  // Side views narrow the body; a profile that keeps full shoulder width reads as a sign, not a person.
  const widthScale = side ? 0.64 : 1;
  const shoulderHalf = 10.4 * widthScale;
  const chestHalf = 9.9 * widthScale;
  const waistHalf = 8.3 * widthScale;
  const hipHalf = 9.1 * widthScale;

  // Sitting lowers the entire upper body; raising only the pelvis would stretch the torso.
  const torsoDrop = rig.seated ? rig.hipY - HIP_Y : 0;
  const hipX = CX + rig.sway;
  const hipY = rig.hipY + rig.bob;
  const shoulderY = SHOULDER_Y + torsoDrop + rig.bob + rig.breath * -0.4;
  const shoulderX = CX + rig.sway + rig.torsoLean * 0.18;

  // Stance leg first so the swing leg always overlaps it.
  const legBack = solveLimb(hipX - hipHalf * 0.42, hipY, KNEE_LEN, SHIN_LEN, rig.legB.root, rig.legB.bend);
  const legFront = solveLimb(hipX + hipHalf * 0.42, hipY, KNEE_LEN, SHIN_LEN, rig.legA.root, rig.legA.bend);

  const armBack = solveLimb(
    shoulderX - shoulderHalf * 0.82,
    shoulderY + 1.5 - rig.shoulderTilt,
    UPPER_ARM,
    FOREARM,
    rig.armB.root,
    rig.armB.bend
  );
  const armFront = solveLimb(
    shoulderX + shoulderHalf * 0.82,
    shoulderY + 1.5 + rig.shoulderTilt,
    UPPER_ARM,
    FOREARM,
    rig.armA.root,
    rig.armA.bend
  );

  const headX = CX + rig.sway * 0.7 + rig.headNudge + rig.torsoLean * 0.3;
  const headY = HEAD_CY + torsoDrop + rig.bob + rig.breath * -0.3;
  const headRx = side ? HEAD_RX * 0.88 : HEAD_RX;

  const neckTop = shoulderY - 5.5;
  const torso = [
    `M${shoulderX - shoulderHalf} ${shoulderY}`,
    `C${shoulderX - chestHalf - 0.6} ${CHEST_Y + torsoDrop + rig.bob} ${shoulderX - waistHalf - 0.8} ${WAIST_Y + torsoDrop + rig.bob - 4} ${shoulderX - waistHalf} ${WAIST_Y + torsoDrop + rig.bob}`,
    `L${hipX - hipHalf} ${hipY + 2.5}`,
    `L${hipX + hipHalf} ${hipY + 2.5}`,
    `L${shoulderX + waistHalf} ${WAIST_Y + torsoDrop + rig.bob}`,
    `C${shoulderX + waistHalf + 0.8} ${WAIST_Y + torsoDrop + rig.bob - 4} ${shoulderX + chestHalf + 0.6} ${CHEST_Y + torsoDrop + rig.bob} ${shoulderX + shoulderHalf} ${shoulderY}`,
    `Q${shoulderX + 3.4} ${shoulderY + 2.6} ${shoulderX} ${shoulderY + 2.2}`,
    `Q${shoulderX - 3.4} ${shoulderY + 2.6} ${shoulderX - shoulderHalf} ${shoulderY}Z`,
  ].join(' ');

  // Feet never sink through the floor, whatever the pose solver returns.
  const footY = (y: number) => Math.min(rig.seated ? 99 : GROUND_Y, y);
  const shadowWidth = rig.seated ? 15 : side ? 11 : 13.5;

  return (
    <svg
      width={size * 0.56}
      height={size}
      viewBox="0 0 56 100"
      role="img"
      aria-label={`${id.replaceAll('_', ' ')} ${pose} ${facing}`}
      style={{ overflow: 'visible' }}
    >
      <g transform={`translate(0 100) scale(1 ${buildScale}) translate(0 -100)${facing === 'left' ? ' translate(56 0) scale(-1 1)' : ''}`}>
      <ellipse cx={CX} cy={97.5} rx={shadowWidth} ry={2.9} fill="#161b1f" opacity={0.26} />

      {/* Far limbs sit behind the torso so the silhouette never flattens. */}
      <path
        d={limbPath(hipX - hipHalf * 0.42, hipY, { ...legBack, ey: footY(legBack.ey) })}
        fill="none"
        stroke={c.trouser}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.82}
      />
      <ellipse cx={legBack.ex} cy={footY(legBack.ey) + 1.6} rx={3.5} ry={1.7} fill="#23282c" opacity={0.82} />
      <path
        d={limbPath(shoulderX - shoulderHalf * 0.82, shoulderY + 1.5 - rig.shoulderTilt, armBack)}
        fill="none"
        stroke={c.clothing}
        strokeWidth={5.1}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.78}
      />

      <path
        d={limbPath(hipX + hipHalf * 0.42, hipY, { ...legFront, ey: footY(legFront.ey) })}
        fill="none"
        stroke={c.trouser}
        strokeWidth={6.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse cx={legFront.ex} cy={footY(legFront.ey) + 1.6} rx={3.7} ry={1.8} fill="#1d2226" />

      <path d={torso} fill={c.clothing} />
      {/* A single interior crease gives the clothing volume without an outline. */}
      <path
        d={`M${shoulderX - chestHalf * 0.5} ${shoulderY + 4} Q${shoulderX} ${CHEST_Y + torsoDrop + rig.bob + 3} ${shoulderX + chestHalf * 0.5} ${shoulderY + 4}`}
        fill="none"
        stroke="#000"
        strokeOpacity={0.09}
        strokeWidth={1.6}
      />

      <rect x={headX - 2.6} y={neckTop} width={5.2} height={7} rx={2.2} fill={c.skin} />
      <rect x={headX - 2.6} y={neckTop} width={5.2} height={3} fill="#000" opacity={0.12} />

      <path
        d={limbPath(shoulderX + shoulderHalf * 0.82, shoulderY + 1.5 + rig.shoulderTilt, armFront)}
        fill="none"
        stroke={c.clothing}
        strokeWidth={5.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={armFront.ex} cy={armFront.ey} r={1.9} fill={c.skin} />
      {!side && !back && <circle cx={armBack.ex} cy={armBack.ey} r={1.9} fill={c.skin} opacity={0.82} />}

      {rig.holdsPhone && (
        <g>
          <rect
            x={(armFront.ex + armBack.ex) / 2 - 2.6}
            y={(armFront.ey + armBack.ey) / 2 - 4}
            width={5.2}
            height={8}
            rx={1}
            fill="#1b2026"
          />
          <rect
            x={(armFront.ex + armBack.ex) / 2 - 1.9}
            y={(armFront.ey + armBack.ey) / 2 - 3.3}
            width={3.8}
            height={6.6}
            rx={0.5}
            fill="#f6dcae"
            opacity={0.95}
          />
        </g>
      )}

      <g transform={`rotate(${rig.headTilt} ${headX} ${headY + HEAD_RY})`}>
        {c.hairShape === 'long' && !back && (
          <path
            d={`M${headX - headRx - 0.3} ${headY - 2} Q${headX - headRx - 1.6} ${headY + 12} ${headX - headRx + 1.4} ${headY + 15} L${headX + headRx - 1.4} ${headY + 15} Q${headX + headRx + 1.6} ${headY + 12} ${headX + headRx + 0.3} ${headY - 2}Z`}
            fill={c.hair}
            opacity={0.95}
          />
        )}

        <ellipse cx={headX} cy={headY} rx={headRx} ry={HEAD_RY} fill={c.skin} />

        {back ? (
          <path d={hairBack(c.hairShape)} fill={c.hair} transform={`translate(${headX - CX} ${headY - HEAD_CY})`} />
        ) : (
          <path d={hairFront(c.hairShape)} fill={c.hair} transform={`translate(${headX - CX} ${headY - HEAD_CY})`} />
        )}

        {/* Eyes are the smallest mark that still reads; they vanish from behind. */}
        {!back && facing === 'front' && (
          <g fill="#30241f" opacity={0.72}>
            <ellipse cx={headX - 2.5} cy={headY + 1.6} rx={0.72} ry={0.9} />
            <ellipse cx={headX + 2.5} cy={headY + 1.6} rx={0.72} ry={0.9} />
          </g>
        )}
        {side && <ellipse cx={headX + 2.9} cy={headY + 1.6} rx={0.72} ry={0.9} fill="#30241f" opacity={0.72} />}

        {/* Ambient occlusion under the hairline keeps the head from reading as a ball. */}
        <ellipse cx={headX} cy={headY - HEAD_RY * 0.1} rx={headRx * 0.92} ry={2.4} fill="#000" opacity={0.07} />
      </g>
      </g>
    </svg>
  );
}
