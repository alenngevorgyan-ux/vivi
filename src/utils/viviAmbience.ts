/**
 * Diegetic sound for the canonical runtime.
 *
 * Everything here is a real source in the room: room tone, water, a phone
 * buzzing against wood, a door. There are no stings, no alerts and no music.
 * Levels are deliberately low — the loudest bed sits around -36 dBFS — because
 * the tension in these scenes comes from what stops, not from what is loud.
 */

type AmbientBed = 'room_tone' | 'shower_water' | 'rain_ambient' | 'bus_engine' | 'city_night';

const BED_FOR_CUE: Record<string, AmbientBed> = {
  shower_water: 'shower_water',
  rain_ambient: 'rain_ambient',
  bus_engine: 'bus_engine',
};

/** Pre-rendered noise, reused by every source so we allocate one buffer per context. */
function makeNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const seconds = 3;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    // Leaky integrator gives brown-ish noise, which reads as air rather than hiss.
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.2;
  }
  return buffer;
}

interface Bed {
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
}

class ViviAmbience {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private beds = new Map<AmbientBed, Bed>();
  private activeBed: AmbientBed | null = null;
  private muted = false;

  private ensure(): boolean {
    if (typeof window === 'undefined') return false;
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return false;
      try {
        this.ctx = new Ctor();
      } catch {
        return false;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      this.noise = makeNoiseBuffer(this.ctx);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return true;
  }

  private bedSpec(bed: AmbientBed): { type: BiquadFilterType; frequency: number; q: number; gain: number } {
    switch (bed) {
      case 'shower_water':
        return { type: 'bandpass', frequency: 1500, q: 0.6, gain: 0.05 };
      case 'rain_ambient':
        return { type: 'bandpass', frequency: 900, q: 0.5, gain: 0.04 };
      case 'bus_engine':
        return { type: 'lowpass', frequency: 220, q: 0.8, gain: 0.05 };
      case 'city_night':
        return { type: 'lowpass', frequency: 420, q: 0.7, gain: 0.018 };
      default:
        return { type: 'lowpass', frequency: 300, q: 0.7, gain: 0.014 };
    }
  }

  private getBed(bed: AmbientBed): Bed | null {
    if (!this.ctx || !this.noise || !this.master) return null;
    const existing = this.beds.get(bed);
    if (existing) return existing;

    const spec = this.bedSpec(bed);
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = spec.type;
    filter.frequency.value = spec.frequency;
    filter.Q.value = spec.q;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();

    const created = { source, filter, gain };
    this.beds.set(bed, created);
    return created;
  }

  /** Fade between ambient beds. A hard switch would read as an edit, not a room. */
  setBed(bed: AmbientBed | null, fadeSeconds = 1.4) {
    if (!this.ensure() || !this.ctx) return;
    if (this.activeBed === bed) return;

    const now = this.ctx.currentTime;
    if (this.activeBed) {
      const prev = this.beds.get(this.activeBed);
      if (prev) {
        prev.gain.gain.cancelScheduledValues(now);
        prev.gain.gain.setValueAtTime(prev.gain.gain.value, now);
        prev.gain.gain.linearRampToValueAtTime(0, now + fadeSeconds);
      }
    }
    if (bed) {
      const next = this.getBed(bed);
      if (next) {
        const target = this.bedSpec(bed).gain;
        next.gain.gain.cancelScheduledValues(now);
        next.gain.gain.setValueAtTime(next.gain.gain.value, now);
        next.gain.gain.linearRampToValueAtTime(target, now + fadeSeconds);
      }
    }
    this.activeBed = bed;
  }

  /** Map a modifier's ambient cue onto a bed; no cue means the room itself. */
  setCue(cue: string | null) {
    this.setBed(cue ? BED_FOR_CUE[cue] ?? 'room_tone' : 'room_tone');
  }

  /** A phone buzzing against a hard surface: body resonance, not a ringtone. */
  vibrate() {
    if (!this.ensure() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    for (let pulse = 0; pulse < 2; pulse++) {
      const at = now + pulse * 0.22;
      const osc = this.ctx.createOscillator();
      const body = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 58;
      body.type = 'sine';
      body.frequency.value = 124;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.055, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0008, at + 0.17);
      osc.connect(gain);
      body.connect(gain);
      gain.connect(this.master);
      osc.start(at);
      body.start(at);
      osc.stop(at + 0.19);
      body.stop(at + 0.19);
    }
  }

  /** A door meeting its frame. Low, short, no reverb tail. */
  doorThump(intensity = 1) {
    if (!this.ensure() || !this.ctx || !this.master || !this.noise) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(96, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.14);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.075 * intensity, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.3);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.32);

    const click = this.ctx.createBufferSource();
    click.buffer = this.noise;
    const clickFilter = this.ctx.createBiquadFilter();
    clickFilter.type = 'bandpass';
    clickFilter.frequency.value = 2200;
    const clickGain = this.ctx.createGain();
    clickGain.gain.setValueAtTime(0.03 * intensity, now);
    clickGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.07);
    click.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(this.master);
    click.start(now);
    click.stop(now + 0.09);
  }

  /** A building intercom: electrical, unpleasant, and over quickly. */
  intercom() {
    if (!this.ensure() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 620;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.03, now + 0.02);
    gain.gain.setValueAtTime(0.03, now + 0.42);
    gain.gain.linearRampToValueAtTime(0, now + 0.48);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  /** The elevator arriving. One note, and then the silence that matters. */
  ding() {
    if (!this.ensure() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 988;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 1.5);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 1.6);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (!this.master || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(muted ? 0 : 1, now + 0.25);
  }

  /** Called when a scene unmounts: stop the world, keep the context. */
  stop() {
    this.setBed(null, 0.4);
  }
}

export const ambience = new ViviAmbience();
