/**
 * The room's sound: presentation only, procedural (no assets), and never informational.
 *
 * Visual bible §10–§12: room-tone beds per location crossfade over the transition (~1.2 s); one-shots belong to
 * events — a paper brush (no pitch) when the body comes within reach of something, a low wooden tick once when an
 * act is confirmed — and footsteps follow the walk's ground contact. No music, no stings. At the boundary the
 * sound ducks to room tone and ends. Nothing here may imply an arrival, a message or a reaction.
 *
 * The AudioContext is created only from a trusted gesture (browsers require it) and fully closed on dispose.
 */

export type RoomTone = 'open_plan' | 'meeting' | 'corridor';
type Room = RoomTone;

const ROOMS: Record<Room, { lp: number; gain: number; hum: number; humGain: number; air?: number }> = {
  open_plan: { lp: 520, gain: 0.05, hum: 58, humGain: 0.008, air: 2400 },
  meeting: { lp: 380, gain: 0.04, hum: 96, humGain: 0.006, air: 900 },
  corridor: { lp: 300, gain: 0.055, hum: 118, humGain: 0.011 },
};

export class SoundscapeV3 {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private bed: { gain: GainNode; stop: () => void } | null = null;
  private room: Room | null = null;
  private wanted: Room | null = null;
  private stepFoot = 0;
  muted = false;

  /** Call from inside a trusted input handler. Idempotent. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC: typeof AudioContext | undefined = typeof window !== 'undefined' ? window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext : undefined;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(ctx.destination);
    // Two seconds of brown-ish noise, shared by every voice.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    this.noise = buf;
    if (this.wanted) this.setRoom(this.wanted);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.08);
  }

  /** Room tone for a location; crossfades from the previous one. `null` = silence (the boundary). */
  setRoom(room: Room | null, fade = 1.2): void {
    this.wanted = room;
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noise || room === this.room) return;
    const t = ctx.currentTime;
    if (this.bed) {
      const old = this.bed;
      old.gain.gain.cancelScheduledValues(t);
      old.gain.gain.setValueAtTime(old.gain.gain.value, t);
      old.gain.gain.linearRampToValueAtTime(0, t + fade);
      setTimeout(() => old.stop(), (fade + 0.2) * 1000);
      this.bed = null;
    }
    this.room = room;
    if (!room) return;
    const p = ROOMS[room];
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(p.gain, t + fade);
    gain.connect(this.master);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = p.lp;
    src.connect(lp).connect(gain);
    const hum = ctx.createOscillator();
    hum.frequency.value = p.hum;
    const hg = ctx.createGain();
    hg.gain.value = p.humGain / Math.max(1e-6, p.gain);
    hum.connect(hg).connect(gain);
    const extra: AudioScheduledSourceNode[] = [];
    if (p.air) {
      const air = ctx.createBufferSource();
      air.buffer = this.noise;
      air.loop = true;
      air.playbackRate.value = 1.7;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = p.air;
      bp.Q.value = 0.7;
      const ag = ctx.createGain();
      ag.gain.value = 0.18;
      air.connect(bp).connect(ag).connect(gain);
      air.start();
      extra.push(air);
    }
    src.start();
    hum.start();
    this.bed = {
      gain,
      stop: () => {
        for (const n of [src, hum, ...extra]) {
          try {
            n.stop();
          } catch {
            /* already stopped */
          }
        }
        gain.disconnect();
      },
    };
  }

  private burst(opts: { at?: number; dur: number; type: BiquadFilterType; freq: number; q?: number; gain: number; sweepTo?: number; rate?: number }): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noise || this.muted) return;
    const t = opts.at ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = opts.rate ?? 1;
    const f = ctx.createBiquadFilter();
    f.type = opts.type;
    f.frequency.setValueAtTime(opts.freq, t);
    if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, t + opts.dur);
    f.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(opts.gain, t + Math.min(0.012, opts.dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 1.5);
    src.stop(t + opts.dur + 0.05);
  }

  /** One footfall: a soft heel then a lighter toe, alternating feet; carpet is duller than tile. */
  step(surface: 'carpet' | 'tile' = 'tile'): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.stepFoot ^= 1;
    const t = ctx.currentTime;
    const v = 0.9 + Math.random() * 0.2;
    const base = surface === 'carpet' ? 260 : 520;
    this.burst({ at: t, dur: 0.07, type: 'lowpass', freq: base * (this.stepFoot ? 1 : 0.9), gain: 0.22 * v, rate: 3 });
    this.burst({ at: t + 0.05, dur: 0.05, type: 'bandpass', freq: base * 2.4, q: 1.2, gain: 0.05 * v, rate: 4 });
  }

  /** Noticing: a paper brush, no pitch. */
  notice(): void {
    this.burst({ dur: 0.22, type: 'bandpass', freq: 2600, sweepTo: 4200, q: 0.8, gain: 0.05, rate: 2 });
  }

  /** Commitment: a low wooden tick, once. */
  tick(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(210, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.32, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.2);
    this.burst({ at: t, dur: 0.03, type: 'highpass', freq: 1800, gain: 0.08, rate: 2 });
  }

  /** A door: the latch and a soft swing of air. */
  door(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.burst({ at: t, dur: 0.05, type: 'bandpass', freq: 1400, q: 3, gain: 0.08, rate: 2 });
    this.burst({ at: t + 0.06, dur: 0.6, type: 'lowpass', freq: 600, sweepTo: 200, gain: 0.05 });
  }

  dispose(): void {
    this.bed?.stop();
    this.bed = null;
    void this.ctx?.close();
    this.ctx = null;
  }
}

/** The story binding says what each of its places sounds like and what its floor is. */
export type RoomToneOf = (location: string) => { tone: RoomTone; floor: 'carpet' | 'tile' };
