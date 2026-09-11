/** 依存なしの合成効果音。初回タップで unlock() を呼ぶ */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  private tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; end?: number; attack?: number; delay?: number } = {}) {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime + (opts.delay ?? 0);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (opts.end) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.end), t0 + dur);
    const a = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.3, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, opts: { gain?: number; freq?: number; q?: number; type?: BiquadFilterType; end?: number; delay?: number } = {}) {
    if (!this.ctx || !this.master || !this.noiseBuf || this.muted) return;
    const t0 = this.ctx.currentTime + (opts.delay ?? 0);
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.frequency.setValueAtTime(opts.freq ?? 2000, t0);
    if (opts.end) f.frequency.exponentialRampToValueAtTime(opts.end, t0 + dur);
    f.Q.value = opts.q ?? 1;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(opts.gain ?? 0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t0);
    s.stop(t0 + dur + 0.02);
  }

  slash(step = 1) {
    this.noise(0.18, { gain: 0.35, freq: 3000 + step * 600, end: 700, q: 0.8 });
    this.tone(500 + step * 120, 0.08, { type: 'triangle', gain: 0.08, end: 200 });
  }
  /** 拳や蹴りの風切り */
  whoosh(pitch = 1) {
    this.noise(0.12, { gain: 0.28, freq: 900 * pitch, end: 2600 * pitch, q: 0.6 });
  }
  /** 重い風切り（まひろ）: 低くて長い */
  whooshHeavy(pitch = 1) {
    this.noise(0.2, { gain: 0.34, freq: 380 * pitch, end: 1500 * pitch, q: 0.7 });
    this.tone(90 * pitch, 0.16, { type: 'sine', gain: 0.12, end: 50 });
  }
  /** 重い刃の振り（まひろのナイフ） */
  slashHeavy() {
    this.noise(0.22, { gain: 0.36, freq: 1800, end: 400, q: 0.8 });
    this.tone(220, 0.12, { type: 'triangle', gain: 0.1, end: 90 });
  }
  /** 重い着弾: 低音の衝撃 */
  thud(w = 1) {
    this.noise(0.16 * w, { gain: 0.45, freq: 500, end: 120, type: 'lowpass' });
    this.tone(64, 0.28 * w, { type: 'sine', gain: 0.35, end: 30 });
    this.tone(140, 0.1, { type: 'square', gain: 0.12, end: 60 });
  }
  /** 鋭い風切り（ちさと）: 高くて短い */
  whooshSharp(pitch = 1) {
    this.noise(0.07, { gain: 0.26, freq: 2600 * pitch, end: 7000 * pitch, q: 0.9 });
    this.tone(2400 * pitch, 0.05, { type: 'sine', gain: 0.06, end: 3600 * pitch });
  }
  /** 鋭い刃の振り（ちさとのナイフ） */
  slashSharp(pitch = 1) {
    this.noise(0.09, { gain: 0.3, freq: 5200 * pitch, end: 1800 * pitch, q: 1.4 });
    this.tone(3000 * pitch, 0.07, { type: 'sine', gain: 0.08, end: 1200 * pitch });
  }
  /** 鋭い着弾: 金属的な高音 */
  ping(pitch = 1, heavy = false) {
    this.tone(1900 * pitch, heavy ? 0.16 : 0.09, { type: 'sine', gain: heavy ? 0.28 : 0.2, end: 800 * pitch });
    this.noise(0.05, { gain: 0.3, freq: 6000, q: 3 });
    if (heavy) this.tone(2800 * pitch, 0.3, { type: 'sine', gain: 0.12, delay: 0.02 });
  }
  hit() {
    this.noise(0.12, { gain: 0.4, freq: 1200, end: 300, type: 'lowpass' });
    this.tone(180, 0.15, { type: 'square', gain: 0.18, end: 60 });
  }
  heavyHit() {
    this.noise(0.25, { gain: 0.5, freq: 900, end: 150, type: 'lowpass' });
    this.tone(120, 0.3, { type: 'sawtooth', gain: 0.25, end: 40 });
  }
  parry() {
    this.tone(1800, 0.25, { type: 'triangle', gain: 0.3, end: 2400 });
    this.tone(2700, 0.4, { type: 'sine', gain: 0.2, delay: 0.03 });
    this.noise(0.08, { gain: 0.3, freq: 6000, q: 2 });
  }
  dodge() {
    this.noise(0.22, { gain: 0.25, freq: 600, end: 2500, q: 0.7 });
  }
  shoot() {
    this.tone(900, 0.12, { type: 'square', gain: 0.12, end: 300 });
    this.noise(0.08, { gain: 0.12, freq: 4000, end: 1000 });
  }
  hurt() {
    this.tone(300, 0.25, { type: 'sawtooth', gain: 0.25, end: 80 });
    this.noise(0.2, { gain: 0.3, freq: 500, type: 'lowpass' });
  }
  bossShoot() {
    this.tone(700, 0.1, { type: 'sine', gain: 0.07, end: 1100 });
  }
  bossCharge() {
    this.tone(200, 0.6, { type: 'sawtooth', gain: 0.15, end: 900, attack: 0.3 });
  }
  teleport() {
    this.noise(0.3, { gain: 0.25, freq: 800, end: 5000, q: 1.5 });
    this.tone(1200, 0.3, { type: 'sine', gain: 0.12, end: 2400 });
  }
  bossHurt() {
    this.tone(520, 0.12, { type: 'triangle', gain: 0.15, end: 380 });
  }
  win() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((n, i) => this.tone(n, 0.5, { type: 'triangle', gain: 0.2, delay: i * 0.12 }));
    this.tone(2093, 1.2, { type: 'sine', gain: 0.15, delay: 0.6 });
  }
  lose() {
    const notes = [440, 415, 392, 330];
    notes.forEach((n, i) => this.tone(n, 0.6, { type: 'sawtooth', gain: 0.15, delay: i * 0.25 }));
  }
  start() {
    this.tone(660, 0.15, { type: 'triangle', gain: 0.2 });
    this.tone(990, 0.3, { type: 'triangle', gain: 0.2, delay: 0.12 });
  }
  phase() {
    this.tone(150, 0.8, { type: 'sawtooth', gain: 0.25, end: 60 });
    this.noise(0.6, { gain: 0.3, freq: 300, end: 3000 });
  }
}
