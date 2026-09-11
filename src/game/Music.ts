/**
 * BGM。音声ファイルは使わず、効果音と同じ WebAudio の合成音で鳴らす。
 * 4 小節を 1 周とし、先読みして音を予約する方式なのでループの継ぎ目が出ない。
 */

const SCHEDULE_AHEAD = 0.25; // 秒。これだけ先まで予約しておく
const TICK_MS = 40;
const STEPS_PER_BAR = 16; // 16 分音符
const BARS = 4;
const LOOP = STEPS_PER_BAR * BARS;

/** MIDI ノート番号から周波数 */
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** 4 小節のコード（Am → F → G → Em）。イ短調の素直な流れ */
const CHORDS = [
  [57, 60, 64], // Am
  [53, 57, 60], // F
  [55, 59, 62], // G
  [52, 55, 59], // Em
];
const BASS = [45, 41, 43, 40];

/** 主旋律。LOOP 個のうち鳴らす位置だけ音を入れる */
const LEAD: Record<number, number> = {
  0: 69, 6: 72, 10: 71, 12: 69,
  16: 65, 22: 69, 26: 72, 28: 71,
  32: 67, 38: 71, 42: 74, 44: 72,
  48: 64, 54: 67, 58: 71, 60: 69,
};

/** ベースを踏む位置 */
const BASS_STEPS = [0, 3, 6, 8, 11, 14];
/** バスドラを踏む位置 */
const KICK_STEPS = [0, 6, 8, 14];
/** スネアを鳴らす位置 */
const SNARE_STEPS = [4, 12];

export type Intensity = 0 | 1 | 2; // 0: 静か（タイトル・リザルト） 1: 戦闘 2: 終盤

export class Music {
  private ctx: BaseAudioContext;
  private bus: GainNode;
  private noise: AudioBuffer;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  private step = 0;
  private bpm = 126;
  private intensity: Intensity = 0;
  muted = false;

  constructor(ctx: BaseAudioContext, dest: AudioNode, noise: AudioBuffer) {
    this.ctx = ctx;
    this.noise = noise;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(dest);
  }

  /** 鳴らし始める。すでに鳴っていれば何もしない */
  start() {
    if (this.timer) return;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.timer = setInterval(() => this.schedule(), TICK_MS);
    this.fadeTo(this.muted ? 0 : this.targetGain(), 0.8);
  }

  stop(fade = 0.6) {
    this.fadeTo(0, fade);
    const t = this.timer;
    this.timer = null;
    if (t) setTimeout(() => clearInterval(t), fade * 1000 + 100);
  }

  setIntensity(v: Intensity) {
    if (this.intensity === v) return;
    this.intensity = v;
    if (this.timer) this.fadeTo(this.muted ? 0 : this.targetGain(), 0.6);
  }

  setMuted(v: boolean) {
    this.muted = v;
    this.fadeTo(v ? 0 : this.targetGain(), 0.3);
  }

  private targetGain() {
    // 効果音より一段下に収まる音量（Sfx の master 0.5 を通ったあとで peak 0.18 前後）
    return this.intensity === 0 ? 0.6 : this.intensity === 1 ? 0.5 : 0.56;
  }

  private fadeTo(v: number, sec: number) {
    const g = this.bus.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(0.0001, g.value), now);
    g.linearRampToValueAtTime(v, now + sec);
  }

  /** 検証用: タイマーを使わず、指定秒ぶんを一度に予約する（OfflineAudioContext 向け） */
  scheduleOffline(seconds: number, intensity: Intensity) {
    this.intensity = intensity;
    this.bus.gain.value = this.targetGain();
    const spb = 60 / this.bpm / 4;
    let t = 0.05;
    let step = 0;
    while (t < seconds) {
      this.scheduleStep(step, t);
      t += spb;
      step = (step + 1) % LOOP;
    }
  }

  private schedule() {
    const spb = 60 / this.bpm / 4; // 16 分音符 1 個ぶんの秒数
    while (this.nextTime < this.ctx.currentTime + SCHEDULE_AHEAD) {
      this.scheduleStep(this.step, this.nextTime);
      this.nextTime += spb;
      this.step = (this.step + 1) % LOOP;
    }
  }

  private scheduleStep(step: number, t: number) {
    const bar = Math.floor(step / STEPS_PER_BAR);
    const s = step % STEPS_PER_BAR;
    const chord = CHORDS[bar];
    const i = this.intensity;

    // パッド（どの場面でも鳴らす土台）
    if (s === 0) {
      for (const n of chord) this.pad(hz(n), t, 60 / this.bpm * 4 * 0.95, i === 0 ? 0.07 : 0.038);
    }

    // アルペジオ。静かなときは間引く
    const arpEvery = i === 0 ? 4 : i === 1 ? 2 : 2;
    if (s % arpEvery === 0) {
      const n = chord[(step / arpEvery) % chord.length | 0] + (i === 2 && s % 8 === 4 ? 12 : 0);
      this.pluck(hz(n + 12), t, i === 0 ? 0.06 : 0.06);
    }

    if (i === 0) return;

    // ベース
    if (BASS_STEPS.includes(s)) this.bass(hz(BASS[bar]), t, 0.16);
    // ドラム
    if (KICK_STEPS.includes(s)) this.kick(t);
    if (SNARE_STEPS.includes(s)) this.snare(t);
    const hatEvery = i === 2 ? 1 : 2;
    if (s % hatEvery === 0) this.hat(t, s % 4 === 0 ? 0.1 : 0.05);
    // 終盤は裏拍にもバスドラ
    if (i === 2 && (s === 3 || s === 11)) this.kick(t, 0.7);

    // 主旋律
    const lead = LEAD[step];
    if (lead !== undefined) {
      this.lead(hz(lead), t, 60 / this.bpm / 2);
      if (i === 2) this.lead(hz(lead + 12), t, 60 / this.bpm / 2, 0.35);
    }
  }

  // ---- 音色 ----
  private env(node: AudioNode, t: number, dur: number, peak: number, attack = 0.004) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    node.connect(g);
    g.connect(this.bus);
    return g;
  }

  private osc(type: OscillatorType, f: number, t: number, dur: number) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.start(t);
    o.stop(t + dur + 0.03);
    return o;
  }

  private noiseSrc(t: number, dur: number) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.start(t);
    s.stop(t + dur + 0.02);
    return s;
  }

  private pad(f: number, t: number, dur: number, peak: number) {
    for (const d of [-4, 0, 4]) {
      const o = this.osc('triangle', f * Math.pow(2, d / 1200), t, dur);
      this.env(o, t, dur, peak, 0.5);
    }
  }

  private pluck(f: number, t: number, peak: number) {
    const o = this.osc('square', f, t, 0.2);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2600, t);
    lp.frequency.exponentialRampToValueAtTime(700, t + 0.18);
    o.connect(lp);
    this.env(lp, t, 0.18, peak);
  }

  private bass(f: number, t: number, dur: number) {
    const o = this.osc('sawtooth', f, t, dur);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(180, t + dur);
    lp.Q.value = 6;
    o.connect(lp);
    this.env(lp, t, dur, 0.22);
  }

  private lead(f: number, t: number, dur: number, peak = 0.08) {
    const o = this.osc('triangle', f, t, dur);
    // わずかなビブラート
    const lfo = this.ctx.createOscillator();
    lfo.frequency.setValueAtTime(5.5, t);
    const lg = this.ctx.createGain();
    lg.gain.setValueAtTime(f * 0.006, t);
    lfo.connect(lg).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.03);
    this.env(o, t, dur, peak, 0.02);
  }

  private kick(t: number, level = 1) {
    const o = this.osc('sine', 130, t, 0.16);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
    this.env(o, t, 0.16, 0.42 * level, 0.002);
    const n = this.noiseSrc(t, 0.03);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1600;
    n.connect(lp);
    this.env(lp, t, 0.03, 0.1 * level, 0.001);
  }

  private snare(t: number) {
    const n = this.noiseSrc(t, 0.14);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1700;
    bp.Q.value = 0.8;
    n.connect(bp);
    this.env(bp, t, 0.14, 0.2, 0.002);
    const o = this.osc('triangle', 220, t, 0.09);
    this.env(o, t, 0.09, 0.07, 0.002);
  }

  private hat(t: number, peak: number) {
    const n = this.noiseSrc(t, 0.04);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7500;
    n.connect(hp);
    this.env(hp, t, 0.04, peak, 0.001);
  }
}
