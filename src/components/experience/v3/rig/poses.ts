/**
 * Design r4's authored poses (generator/poses.py, frames2.py) and the runtime's continuous motion built from them:
 * a distance-driven walk cycle, breathing and weight shift, gaze, and cast bodies by build family.
 *
 * Yaw convention (rig): 0 faces the camera, +90 faces screen-right, -90 screen-left, 180 shows the back. A mark's
 * `facing` (`yaw_m80`) is the same yaw, so authored poses take the mark's yaw directly.
 */

import { blendPose, body, FAMILIES, GARMENTS, pose, type Body, type Pose } from './rig';

/* ------------------------------------------------------------------- the cast --- */

export type Build = 'hero' | 'slight' | 'broad';

/** A body for a build family (Design cast.py): the hero's belted long coat, a slight jacketed figure, a broad one. */
export function castBody(build: Build, palette: { coat: string; inner: string; trousers: string; skin: string; hair: string; shoe: string }): Body {
  if (build === 'hero') return body({ belt: true, pal: palette });
  if (build === 'slight') return body({ ...FAMILIES.slight, ...GARMENTS['short jacket'], hair: 'bob', pal: palette });
  return body({ ...FAMILIES.broad, ...GARMENTS['short jacket'], hair: 'thin', stoop: 0.3, pal: palette });
}

/* ---------------------------------------------------------- authored poses --- */

const seatedLegs = { legR: { flex: 86, knee: 90, abd: 4 }, legL: { flex: 82, knee: 86, abd: 7, turn: 8 } };
export const seated = (yaw: number, o: { head_yaw?: number; head_pitch?: number; arms?: 'lap' | 'table' | 'hold'; spine?: number } = {}) => {
  const arms = {
    lap: [{ flex: 12, abd: 6, elbow: 58, hand: 'rest' as const }, { flex: 10, abd: 8, elbow: 55, hand: 'rest' as const }],
    table: [{ flex: 52, abd: 6, elbow: 40, hand: 'rest' as const }, { flex: 40, abd: 8, elbow: 60, hand: 'rest' as const }],
    hold: [{ flex: 22, abd: 4, elbow: 88, inw: 40, hand: 'grip' as const, curl: 0.8 }, { flex: 18, abd: 6, elbow: 92, inw: 60, hand: 'relax' as const }],
  }[o.arms ?? 'lap'];
  return pose({ yaw, head_yaw: o.head_yaw ?? 0, head_pitch: o.head_pitch ?? 0, spine_pitch: o.spine ?? 0, ...seatedLegs, armR: arms[0], armL: arms[1], seat: true });
};

export const POSES = {
  // hero, meeting (frames2.py)
  seatHold: seated(90, { head_yaw: 14, head_pitch: 4, arms: 'hold' }),
  seatDecide: seated(90, { head_yaw: 22, head_pitch: 0, arms: 'hold' }),
  seatSpeak: pose({ yaw: 90, head_yaw: 10, head_pitch: -12, spine_pitch: 6, ...seatedLegs, armR: { flex: 96, abd: 8, elbow: 52, hand: 'grip', curl: 0.8 }, armL: { flex: 12, abd: 8, elbow: 58, hand: 'rest' }, seat: true }),
  seatSilent: pose({ yaw: 90, head_yaw: 10, head_pitch: 2, spine_pitch: -4, ...seatedLegs, armR: { flex: 16, abd: 4, elbow: 62, inw: 30, hand: 'rest', curl: 0.25 }, armL: { flex: 14, abd: 6, elbow: 66, inw: 40, hand: 'rest', curl: 0.25 }, seat: true }),
  standReturn: pose({ yaw: 78, head_yaw: 6, head_pitch: 2, support: 'L', pelvis_roll: 3, legR: { flex: 6, knee: 6 }, legL: { flex: -6, knee: 4 }, armR: { flex: 12, abd: 6, elbow: 58, inw: 30, hand: 'grip', curl: 0.8 }, armL: { flex: -4, abd: 6, elbow: 14 } }),
  standDecide: pose({ yaw: 72, head_yaw: 14, head_pitch: -2, support: 'L', pelvis_roll: 3, spine_pitch: -2, legR: { flex: 8, knee: 6 }, legL: { flex: -6, knee: 4 }, armR: { flex: 16, abd: 6, elbow: 70, inw: 35, hand: 'grip', curl: 0.8 }, armL: { flex: -2, abd: 8, elbow: 24 } }),
  standSpeak: pose({ yaw: 74, head_pitch: -10, spine_roll: -3, legR: { flex: 8, knee: 6 }, legL: { flex: -6, knee: 4 }, armR: { flex: 104, abd: 10, elbow: 58, hand: 'grip', curl: 0.8 }, armL: { flex: -2, abd: 6, elbow: 18 } }),
  standSilent: pose({ yaw: 76, head_yaw: 4, head_pitch: 4, support: 'R', pelvis_roll: -4, legR: { flex: 2, knee: 2 }, legL: { flex: -4, knee: 10, toe: 6 }, armR: { flex: 2, abd: 6, elbow: 22, hand: 'grip', curl: 0.8 }, armL: { flex: 0, abd: 6, elbow: 16, hand: 'relax' } }),
  private: pose({ yaw: 90, spine_pitch: 20, head_pitch: 22, neck_fwd: 0.8, legR: { flex: 10, knee: 10 }, legL: { flex: -6, knee: 6 }, armR: { flex: 30, abd: 10, elbow: 84, hand: 'open', curl: 0.35, inw: 20 }, armL: { flex: 0, abd: 6, elbow: 20, hand: 'grip', curl: 0.8 } }),
  // hero, desk and hallway
  read: pose({ yaw: 28, head_pitch: 34, neck_fwd: 0.8, spine_pitch: 6, support: 'R', pelvis_roll: -4, legR: { flex: 2, knee: 2 }, legL: { flex: -6, knee: 12, toe: 8 }, armR: { flex: 30, abd: 4, elbow: 100, inw: 40, hand: 'grip', curl: 0.8 }, armL: { flex: 28, abd: 6, elbow: 96, inw: 60, hand: 'grip', curl: 0.8 } }),
  desk: pose({ yaw: -80, head_yaw: -10, head_pitch: 8, spine_pitch: 4, support: 'L', legR: { flex: 6, knee: 6 }, legL: { flex: -6, knee: 4 }, armR: { flex: 34, abd: 4, elbow: 84, inw: 30, hand: 'grip', curl: 0.8 }, armL: { flex: 26, abd: 10, elbow: 20, hand: 'rest', curl: 0.3 } }),
  // the cast
  mira: pose({ yaw: -58, spine_pitch: 4, head_yaw: -10, legR: { flex: 10, knee: 6 }, legL: { flex: -8, knee: 6 }, armR: { flex: 34, abd: 20, elbow: 70, hand: 'open', curl: 0.25, inw: -25 }, armL: { flex: 14, abd: 8, elbow: 50, hand: 'relax' } }),
  director: seated(-90, { head_yaw: -55, spine: -8, arms: 'table', head_pitch: -4 }),
  // a free standing hold for wherever the player stops (the summary in hand)
  standFree: pose({ yaw: 70, head_pitch: 2, support: 'L', pelvis_roll: 2, legR: { flex: 5, knee: 5 }, legL: { flex: -5, knee: 4 }, armR: { flex: 14, abd: 6, elbow: 56, inw: 30, hand: 'grip', curl: 0.8 }, armL: { flex: -3, abd: 6, elbow: 14 } }),
  // a gathered breath before speaking (public act anticipation)
  gather: pose({ yaw: 74, head_pitch: -4, spine_pitch: -6, legR: { flex: 6, knee: 4 }, legL: { flex: -6, knee: 4 }, armR: { flex: 30, abd: 8, elbow: 64, inw: 20, hand: 'grip', curl: 0.8, shrug: 0.5 }, armL: { flex: -2, abd: 6, elbow: 18, shrug: 0.4 } }),
};

/** Which hand holds the hero's summary in an authored pose (Design hero_prop_fn modes). */
export const propMode = (p: Pose): 'R' | 'L' | 'lap' => (p.armL.hand === 'grip' && p.armR.hand !== 'grip' ? 'L' : p.armR.hand === 'grip' ? 'R' : p.seat ? 'lap' : 'R');

/* --------------------------------------------------------------- walk cycle --- */

const ss = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/**
 * The walk at a phase (strides; one cycle = two steps), blended in by `amount` (0 standing → 1 full stride).
 * Swing leg bends and clears; the trailing heel peels off the floor (toe-off); arms counter-swing with the elbow
 * softening on the forward swing; the pelvis drops toward the swing side and the chest counter-rotates a little.
 * The rig grounds the lowest foot, so the body sinks at full stride and rises at passing on its own.
 */
export function walkPose(phase: number, yaw: number, amount: number, base: Pose): Pose {
  const th = phase * Math.PI * 2;
  const sn = Math.sin(th);
  const cs = Math.cos(th);
  const leg = (sg: 1 | -1) => {
    const swing = sg * sn; // + : this leg forward
    const swingPhase = sg * cs; // + : moving forward (in the air)
    return {
      flex: 24 * swing,
      knee: 6 + 30 * Math.pow(Math.max(0, swingPhase), 1.4) + 6 * Math.max(0, -swing),
      toe: 26 * ss(-swing * 1.4) * (swingPhase > -0.2 ? 1 : 0.4),
      abd: 3,
      turn: 6,
    };
  };
  const walk = pose({
    yaw,
    spine_pitch: 4,
    twist: -7 * sn,
    head_yaw: 6 * sn,
    head_pitch: 3,
    pelvis_roll: 3 * sn,
    spine_roll: -1.5 * sn,
    legR: leg(1),
    legL: leg(-1),
    // the summary hand stays carried; the free arm swings against the near leg
    armR: { ...base.armR, flex: base.armR.hand === 'grip' ? base.armR.flex - 4 * sn : -18 * sn, elbow: base.armR.hand === 'grip' ? base.armR.elbow : 18 + 10 * Math.max(0, -sn) },
    armL: { ...base.armL, flex: base.armL.hand === 'grip' ? base.armL.flex + 4 * sn : 18 * sn, elbow: base.armL.hand === 'grip' ? base.armL.elbow : 18 + 10 * Math.max(0, sn) },
  });
  return blendPose({ ...base, yaw }, walk, amount);
}

/* ----------------------------------------------------------- living stillness --- */

/**
 * Non-informational idle (visual bible §9): a ≈3.4 s breath in the chest and shoulders and a ≈5.6 s weight shift.
 * `t` in seconds; `seed` keeps two people from breathing in step. Seated bodies only breathe.
 */
export function breathe(p: Pose, t: number, seed = 0, amount = 1): Pose {
  const b = Math.sin(((t + seed * 1.7) / 3.4) * Math.PI * 2) * amount;
  const w = Math.sin(((t + seed * 2.3) / 5.6) * Math.PI * 2) * amount;
  return {
    ...p,
    spine_pitch: p.spine_pitch + b * 0.9,
    head_pitch: p.head_pitch - b * 0.6,
    pelvis_roll: p.seat ? p.pelvis_roll : p.pelvis_roll + w * 1.4,
    spine_roll: p.seat ? p.spine_roll : p.spine_roll - w * 0.7,
    armR: { ...p.armR, shrug: p.armR.shrug + b * 0.05 },
    armL: { ...p.armL, shrug: p.armL.shrug + b * 0.05 },
  };
}

/** Turn the head toward a yaw (degrees), within the neck's comfortable range. */
export const gaze = (p: Pose, towardYaw: number | undefined, amount: number): Pose => {
  if (towardYaw === undefined || amount <= 0) return p;
  const want = ((towardYaw - p.yaw - p.twist + 540) % 360) - 180;
  return { ...p, head_yaw: p.head_yaw + (Math.max(-55, Math.min(55, want)) - p.head_yaw) * amount };
};

/** A pose at a yaw: the authored body language, facing where the mark (or the walk) says. */
export const atYaw = (p: Pose, yaw: number | undefined): Pose => (yaw === undefined ? p : { ...p, yaw });
