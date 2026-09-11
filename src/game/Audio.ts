/** 依存なしの合成効果音。初回タップで unlock() を呼ぶ */
export class Sfx {
  private ctx: BaseAudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  /** 残響への送り。打撃に厚みと余韻を足す */
  private revIn: GainNode | null = null;
  /** 歪みの曲線。打撃の芯を潰して太くする */
  private curve: Float32Array<ArrayBuffer> | null = null;
  muted = false;

  unlock() {
    if (this.ctx) {
      const live = this.ctx as AudioContext;
      if (live.state === 'suspended') void live.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      this.setup(ctx, ctx.destination);
      void ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  /** 検証用: OfflineAudioContext などに繋ぐ */
  bindTo(ctx: BaseAudioContext, dest: AudioNode) {
    this.setup(ctx, dest);
  }

  private setup(ctx: BaseAudioContext, dest: AudioNode) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(dest);

    // ノイズ音源
    const len = Math.floor(ctx.sampleRate);
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // 短い残響。減衰するノイズを畳み込む
    const rl = Math.floor(ctx.sampleRate * 0.42);
    const ir = ctx.createBuffer(2, rl, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < rl; i++) {
        const k = 1 - i / rl;
        ch[i] = (Math.random() * 2 - 1) * Math.pow(k, 2.6);
      }
    }
    const conv = ctx.createConvolver();
    conv.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    conv.connect(wet).connect(this.master);
    this.revIn = ctx.createGain();
    this.revIn.gain.value = 1;
    this.revIn.connect(conv);

    // 柔らかく潰す曲線
    const n = 1024;
    const curve = new Float32Array(new ArrayBuffer(n * 4));
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 2.6);
    }
    this.curve = curve;
  }

  /** 指定のノードを残響へ送る */
  private send(node: AudioNode, amount: number) {
    if (!this.ctx || !this.revIn) return;
    const g = this.ctx.createGain();
    g.gain.value = amount;
    node.connect(g);
    g.connect(this.revIn);
  }

  /** 歪ませる段を作る */
  private drive(): WaveShaperNode | null {
    if (!this.ctx || !this.curve) return null;
    const w = this.ctx.createWaveShaper();
    w.curve = this.curve;
    w.oversample = '2x';
    return w;
  }

  /** BGM が使う音声の入り口。unlock() 済みのときだけ返る */
  get audio(): { ctx: BaseAudioContext; dest: AudioNode; noise: AudioBuffer } | null {
    if (!this.ctx || !this.master || !this.noiseBuf) return null;
    return { ctx: this.ctx, dest: this.master, noise: this.noiseBuf };
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

  /** 包絡を掛けて master へ繋ぎ、その出口を返す */
  private envNode(node: AudioNode, t: number, dur: number, peak: number, attack = 0.004) {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    node.connect(g);
    g.connect(this.master!);
    return g;
  }

  private osc(type: OscillatorType, f: number, t: number, dur: number) {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  private noiseSrc(t: number, dur: number) {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noiseBuf!;
    s.start(t);
    s.stop(t + dur + 0.02);
    return s;
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
  /** 重い風切り（まひろ）: 低い唸りが弧を描いて通り過ぎる */
  whooshHeavy(pitch = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // 帯域を上げてから下げることで「ブンッ」と通過する感じを作る
    const n = this.noiseSrc(t, 0.26);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(240 * pitch, t);
    bp.frequency.exponentialRampToValueAtTime(1250 * pitch, t + 0.1);
    bp.frequency.exponentialRampToValueAtTime(200 * pitch, t + 0.26);
    n.connect(bp);
    const g = this.envNode(bp, t, 0.26, 1.15, 0.03);
    this.send(g, 0.2);
    // 空気が押される低い成分
    this.tone(88 * pitch, 0.18, { type: 'sine', gain: 0.12, end: 44 });
  }

  /** 重い刃の振り（予備。いまは使っていない） */
  slashHeavy() {
    this.noise(0.22, { gain: 0.36, freq: 1800, end: 400, q: 0.8 });
    this.tone(220, 0.12, { type: 'triangle', gain: 0.1, end: 90 });
  }

  /** 重い着弾: 芯の効いた低音と、潰れた胴鳴り、余韻 */
  thud(w = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // 立ち上がりの破裂
    const crack = this.noiseSrc(t, 0.03);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3200;
    crack.connect(hp);
    this.envNode(hp, t, 0.03, 0.34, 0.001);
    // 胴鳴り（歪ませて太く）
    const body = this.osc('triangle', 150 * w, t, 0.26);
    body.frequency.exponentialRampToValueAtTime(96, t + 0.05);
    const dr = this.drive();
    if (dr) {
      body.connect(dr);
      const g = this.envNode(dr, t, 0.26, 0.3 * w, 0.002);
      this.send(g, 0.3);
    }
    // 低い芯。下げ幅を小さくして「ボヨン」と跳ねないようにする
    const sub = this.osc('sine', 72, t, 0.42 * w);
    sub.frequency.exponentialRampToValueAtTime(46, t + 0.06);
    this.envNode(sub, t, 0.42 * w, 0.58 * w, 0.003);
    // 余韻
    const tail = this.noiseSrc(t + 0.01, 0.2);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1100, t);
    lp.frequency.exponentialRampToValueAtTime(260, t + 0.2);
    tail.connect(lp);
    const tg = this.envNode(lp, t + 0.01, 0.2, 0.14, 0.004);
    this.send(tg, 0.35);
  }

  /** 鋭い風切り（ちさと）: 高く短く抜ける */
  whooshSharp(pitch = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const n = this.noiseSrc(t, 0.09);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.3;
    bp.frequency.setValueAtTime(1800 * pitch, t);
    bp.frequency.exponentialRampToValueAtTime(9000 * pitch, t + 0.09);
    n.connect(bp);
    const g = this.envNode(bp, t, 0.09, 1.05, 0.004);
    this.send(g, 0.12);
    this.tone(2600 * pitch, 0.05, { type: 'sine', gain: 0.05, end: 4200 * pitch });
  }

  /** 鋭い刃の振り（予備。いまは使っていない） */
  slashSharp(pitch = 1) {
    this.noise(0.09, { gain: 0.3, freq: 5200 * pitch, end: 1800 * pitch, q: 1.4 });
    this.tone(3000 * pitch, 0.07, { type: 'sine', gain: 0.08, end: 1200 * pitch });
  }

  /**
   * 鋭い着弾（ちさと）: 素手の当たりなので金属音にはせず、
   * 短い破裂と締まった中域、下に軽い芯を置いて「パンッ」と鳴らす。
   */
  sharpHit(pitch = 1, heavy = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // 立ち上がり
    const crack = this.noiseSrc(t, 0.014);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4800;
    crack.connect(hp);
    this.envNode(hp, t, 0.014, 0.3, 0.001);
    // 締まった中域（これが主役）
    const snapDur = heavy ? 0.1 : 0.06;
    const snap = this.noiseSrc(t, snapDur);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.0;
    bp.frequency.setValueAtTime(1900 * pitch, t);
    bp.frequency.exponentialRampToValueAtTime(620 * pitch, t + snapDur);
    snap.connect(bp);
    const dr = this.drive();
    let out: AudioNode = bp;
    if (dr) { bp.connect(dr); out = dr; }
    const g = this.envNode(out, t, snapDur, heavy ? 0.95 : 0.75, 0.001);
    this.send(g, 0.22);
    // 下に置く短い芯
    const body = this.osc('sine', 240 * pitch, t, heavy ? 0.17 : 0.11);
    body.frequency.exponentialRampToValueAtTime(84, t + (heavy ? 0.13 : 0.08));
    this.envNode(body, t, heavy ? 0.17 : 0.11, heavy ? 0.34 : 0.26, 0.002);
    // 余韻
    if (heavy) {
      const tail = this.noiseSrc(t + 0.01, 0.16);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2600, t);
      lp.frequency.exponentialRampToValueAtTime(500, t + 0.16);
      tail.connect(lp);
      const tg = this.envNode(lp, t + 0.01, 0.16, 0.12, 0.003);
      this.send(tg, 0.3);
    }
  }

  hit() {
    this.noise(0.12, { gain: 0.4, freq: 1200, end: 300, type: 'lowpass' });
    this.tone(180, 0.15, { type: 'square', gain: 0.18, end: 60 });
  }
  heavyHit() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.osc('sawtooth', 110, t, 0.44);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.07);
    const dr = this.drive();
    if (dr) {
      o.connect(dr);
      const g = this.envNode(dr, t, 0.34, 0.3, 0.003);
      this.send(g, 0.4);
    }
    const n = this.noiseSrc(t, 0.28);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1400, t);
    lp.frequency.exponentialRampToValueAtTime(180, t + 0.28);
    n.connect(lp);
    const g2 = this.envNode(lp, t, 0.28, 0.24, 0.002);
    this.send(g2, 0.3);
  }
  /** 回復 */
  heal() {
    [784, 1047, 1319].forEach((n, i) => this.tone(n, 0.45, { type: 'sine', gain: 0.2, delay: i * 0.07 }));
    this.noise(0.25, { gain: 0.1, freq: 3000, end: 7000, q: 1.2 });
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
  /** 敵の発射: 上がる音は跳ねて聞こえるので、低く落ちる音で重さを出す */
  bossShoot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.osc('sine', 200, t, 0.15);
    o.frequency.exponentialRampToValueAtTime(68, t + 0.11);
    const g = this.envNode(o, t, 0.15, 0.2, 0.002);
    this.send(g, 0.16);
    // 押し出される空気
    const n = this.noiseSrc(t, 0.06);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1100, t);
    lp.frequency.exponentialRampToValueAtTime(280, t + 0.06);
    n.connect(lp);
    this.envNode(lp, t, 0.06, 0.16, 0.002);
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
