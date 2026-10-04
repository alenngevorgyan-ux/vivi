/**
 * Turns "what this body is doing" into a pose every frame, with weight.
 *
 * Inputs are presentation facts (the authored pose for the moment, which way it faces, how fast it is walking,
 * where it is looking); output is a rig pose. Transitions ease with a time constant (no bounce); the yaw turns
 * the short way at a bounded rate, a little ahead of the feet; the walk is mixed in by speed; the coat hem
 * trails the body; breathing and weight shift keep a still body alive. Pose changes are sampled on twos
 * (12 fps, Design's figure timing) while position, light and camera stay smooth.
 */

import { blendPose, type Pose } from './rig';
import { breathe, gaze, walkPose } from './poses';

export interface AnimatorInput {
  /** The authored pose for this moment (already at its yaw). */
  base: Pose;
  /** Walking: 0 still … 1 full speed. */
  speed: number;
  /** Heading yaw while walking (degrees). */
  heading?: number;
  /** Distance-driven stride phase. */
  stride: number;
  /** Where the head would like to look (yaw), and how much. */
  look?: { yaw: number; amount: number };
  /** Breathing amplitude (0 holds the breath: the frozen frame). */
  breath: number;
  /** Seconds a pose change should take (sit/stand is slower than a hand). */
  ease: number;
  /** Screen-x direction of travel (+1 right, -1 left, 0) for the coat's trail. */
  travelX: number;
  seed: number;
  reducedMotion: boolean;
}

const short = (from: number, to: number) => {
  let d = ((to - from + 540) % 360) - 180;
  if (d === -180) d = 180;
  return d;
};

export class FigureAnimator {
  private base: Pose | null = null;
  private yaw = 0;
  private walk = 0;
  private lag = 0;
  private clock = 0;
  private t = 0;
  private sampled: { pose: Pose; lag: number } | null = null;

  /** Advance by `dt` seconds; returns the pose to draw (re-sampled at 12 fps). */
  update(dt: number, i: AnimatorInput): { pose: Pose; coatLag: number } {
    this.t += dt;
    const k = (tau: number) => (i.reducedMotion ? 1 : 1 - Math.exp(-dt / Math.max(0.001, tau)));
    if (!this.base) {
      this.base = i.base;
      this.yaw = i.base.yaw;
    }
    this.base = blendPose(this.base, i.base, k(i.ease));
    // Turn: toward the heading while walking, else toward the authored yaw. Bounded rate, eased.
    const wantYaw = i.speed > 0.05 && i.heading !== undefined ? i.heading : i.base.yaw;
    const dy = short(this.yaw, wantYaw);
    const maxStep = (i.reducedMotion ? 9999 : 420) * dt;
    this.yaw += Math.max(-maxStep, Math.min(maxStep, dy * k(0.16)));
    this.walk += (Math.min(1, i.speed) - this.walk) * k(i.speed > this.walk ? 0.12 : 0.2);
    this.lag += (i.travelX * this.walk * 0.22 - this.lag) * k(0.35);

    this.clock += dt;
    if (!this.sampled || this.clock >= 1 / 12 || i.reducedMotion) {
      this.clock = 0;
      let p = walkPose(i.stride, this.yaw, this.walk, { ...this.base, yaw: this.yaw });
      p = breathe(p, this.t, i.seed, i.breath * (1 - this.walk));
      if (i.look) p = gaze(p, i.look.yaw, i.look.amount * (1 - this.walk * 0.6));
      this.sampled = { pose: p, lag: this.lag };
    }
    return { pose: this.sampled.pose, coatLag: this.sampled.lag };
  }

  /** Jump straight to a pose (scene cut, restore, reduced motion). */
  reset(p: Pose) {
    this.base = p;
    this.yaw = p.yaw;
    this.walk = 0;
    this.lag = 0;
    this.sampled = null;
  }
}
