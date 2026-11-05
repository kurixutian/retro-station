// ============================================================================
// RETRO WEB AUDIO SYNTHESIZER
// ============================================================================
export class RetroAudioSynth {
  ctx: AudioContext | null;
  muted: boolean;

  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  tone(
    freq = 440,
    duration = 0.08,
    type: OscillatorType = 'square',
    slide: number | null = null,
    vol = 0.06
  ) {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      if (slide) {
        osc.frequency.exponentialRampToValueAtTime(slide, this.ctx.currentTime + duration);
      }
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {}
      };
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Ignore audio policy restrictions before user gesture
    }
  }

  jump() { this.tone(240, 0.13, 'square', 640, 0.05); }
  laser() { this.tone(920, 0.08, 'sawtooth', 190, 0.05); }
  coin() {
    this.tone(987.77, 0.06, 'square', null, 0.06);
    setTimeout(() => this.tone(1318.51, 0.14, 'square', null, 0.06), 60);
  }
  hit() { this.tone(140, 0.18, 'sawtooth', 48, 0.07); }
  encounter() {
    this.tone(600, 0.06, 'square', 900, 0.06);
    setTimeout(() => this.tone(750, 0.06, 'square', 1100, 0.06), 70);
    setTimeout(() => this.tone(900, 0.14, 'square', 400, 0.06), 140);
  }
  save() {
    this.tone(523.25, 0.06, 'triangle', null, 0.07);
    setTimeout(() => this.tone(659.25, 0.06, 'triangle', null, 0.07), 65);
    setTimeout(() => this.tone(1046.5, 0.14, 'triangle', null, 0.07), 130);
  }
}

export const soundFX = new RetroAudioSynth();
