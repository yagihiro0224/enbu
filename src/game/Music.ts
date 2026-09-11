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

/**
 * 4 小節のコード。Am → G → F → E のアンダルシア終止。
 * 最後の E は長三和音（G#）で、イ短調に対して強い緊張を作る。
 */
const CHORDS = [
  [57, 60, 64], // Am
  [55, 59, 62], // G
  [53, 57, 60], // F
  [52, 56, 59], // E（G# を含む）
];
const BASS = [45, 43, 41, 40];

/** 主旋律。イ短調＋和声的短音階（G#）の 8 分音符で押していく */
const LEAD: Record<number, number> = {
  0: 69, 2: 72, 4: 71, 6: 69, 8: 76, 10: 74, 12: 72, 14: 71,
  16: 67, 18: 71, 20: 74, 22: 71, 24: 67, 26: 74, 28: 72, 30: 71,
  32: 65, 34: 69, 36: 72, 38: 69, 40: 65, 42: 72, 44: 71, 46: 69,
  48: 64, 50: 68, 52: 71, 54: 68, 56: 76, 58: 71, 60: 68, 62: 64,
};

/** ベース。8 分で刻み、裏で 1 オクターブ上へ跳ねる */
const BASS_STEPS = [0, 2, 4, 6, 8, 10, 12, 14];
const BASS_OCT_STEPS = [7, 15];
/** バスドラ。食い気味に踏む */
const KICK_STEPS = [0, 3, 8, 11];
const KICK_STEPS_HARD = [0, 3, 6, 8, 11, 14];
/** スネア */
const SNARE_STEPS = [4, 12];
/** 裏拍の刺し（和音の短い打ち込み） */
const STAB_STEPS = [7, 15];

export type Intensity = 0 | 1 | 2; // 0: 静か（タイトル・リザルト） 1: 戦闘 2: 終盤

export class Music {
  private ctx: BaseAudioContext;
  private bus: GainNode;
  private noise: AudioBuffer;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  private step = 0;
  private bpm = 152;
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
    const beat = 60 / this.bpm;

    // パッドと、ずっと鳴り続ける低い持続音（緊張の土台）
    if (s === 0) {
      for (const n of chord) this.pad(hz(n), t, beat * 4 * 0.95, i === 0 ? 0.07 : 0.03);
      if (i >= 1) this.drone(hz(33), t, beat * 4);
    }

    // アルペジオ
    const arpEvery = i === 0 ? 4 : 2;
    if (s % arpEvery === 0) {
      const n = chord[(step / arpEvery) % chord.length | 0];
      this.pluck(hz(n + 12), t, i === 0 ? 0.06 : 0.045);
    }

    if (i === 0) return;

    // ベース
    if (BASS_STEPS.includes(s)) this.bass(hz(BASS[bar]), t, beat * 0.42);
    if (BASS_OCT_STEPS.includes(s)) this.bass(hz(BASS[bar] + 12), t, beat * 0.22);

    // ドラム
    const kicks = i === 2 ? KICK_STEPS_HARD : KICK_STEPS;
    if (kicks.includes(s)) this.kick(t);
    if (SNARE_STEPS.includes(s)) this.snare(t);
    const hatEvery = i === 2 ? 1 : 2;
    if (s % hatEvery === 0) this.hat(t, s % 4 === 0 ? 0.11 : 0.05);

    // 裏拍の刺し
    if (STAB_STEPS.includes(s)) this.stab(chord, t, i === 2 ? 0.05 : 0.035);

    // 主旋律
    const lead = LEAD[step];
    if (lead !== undefined) {
      this.lead(hz(lead), t, beat * 0.45, i === 2 ? 0.1 : 0.085);
      if (i === 2) this.lead(hz(lead - 12), t, beat * 0.45, 0.045);
    }

    // 4 小節の終わりに立ち上がるノイズ（次の周回へ向けた煽り）
    if (i >= 1 && step === 56) this.sweep(t, beat * 2);
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
    lp.frequency.setValueAtTime(1400, t);
    lp.frequency.exponentialRampToValueAtTime(220, t + dur);
    lp.Q.value = 9;
    o.connect(lp);
    this.env(lp, t, dur, 0.24, 0.003);
  }

  /** 低い持続音。緊張感の土台 */
  private drone(f: number, t: number, dur: number) {
    const o = this.osc('sawtooth', f, t, dur);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(160, t);
    lp.Q.value = 2;
    o.connect(lp);
    this.env(lp, t, dur, 0.1, 0.6);
  }

  /** 裏拍に刺す短い和音 */
  private stab(chord: number[], t: number, peak: number) {
    for (const n of chord) {
      const o = this.osc('sawtooth', hz(n + 12), t, 0.1);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3200, t);
      lp.frequency.exponentialRampToValueAtTime(900, t + 0.09);
      o.connect(lp);
      this.env(lp, t, 0.09, peak, 0.002);
    }
  }

  /** 立ち上がるノイズ */
  private sweep(t: number, dur: number) {
    const n = this.noiseSrc(t, dur);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.exponentialRampToValueAtTime(6000, t + dur);
    bp.Q.value = 1.4;
    n.connect(bp);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + dur * 0.92);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    bp.connect(g).connect(this.bus);
  }

  private lead(f: number, t: number, dur: number, peak = 0.08) {
    // のこぎり波をフィルタで削って鋭く
    const o = this.osc('sawtooth', f, t, dur);
    // わずかなビブラート
    const lfo = this.ctx.createOscillator();
    lfo.frequency.setValueAtTime(5.5, t);
    const lg = this.ctx.createGain();
    lg.gain.setValueAtTime(f * 0.006, t);
    lfo.connect(lg).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.03);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f * 6, t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(400, f * 2), t + dur);
    lp.Q.value = 3;
    o.connect(lp);
    this.env(lp, t, dur, peak, 0.008);
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
