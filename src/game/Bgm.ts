/**
 * 音声ファイルの BGM。`public/audio/` に mp3 を置くと合成 BGM の代わりに鳴る。
 *
 * 置けるファイル（すべて任意。bgm.mp3 だけは必須）:
 *   bgm.mp3       戦闘（これが無ければ合成 BGM のまま）
 *   bgm_calm.mp3  タイトルとリザルト。無ければ bgm.mp3 を小さく鳴らす
 *   bgm_hard.mp3  ボス第 3 形態。無ければ bgm.mp3 のまま
 *
 * ループは AudioBufferSourceNode の loop なので継ぎ目が出ない。
 * 曲が変わるときだけ重ねて入れ替える。
 */

export type Intensity = 0 | 1 | 2;

/** 濃さごとに使うファイル名 */
const FILES: Record<Intensity, string> = {
  0: 'bgm_calm.mp3',
  1: 'bgm.mp3',
  2: 'bgm_hard.mp3',
};

/** 濃さごとの音量。Sfx の master 0.5 を通った後の値になる */
const GAINS: Record<Intensity, number> = { 0: 0.38, 1: 0.62, 2: 0.7 };

const CROSSFADE = 0.9; // 秒

const url = (name: string) => `${import.meta.env.BASE_URL}audio/${name}`;

/**
 * 置かれている mp3 を調べる。無ければ null を返すので、呼び出し側は合成 BGM に落とす。
 * 起動を止めないよう、戦闘曲の有無だけを待てば良い作りにしてある。
 */
export async function findBgmFiles(): Promise<string[] | null> {
  const names = Object.values(FILES);
  const found = await Promise.all(
    names.map(async (n) => {
      try {
        const r = await fetch(url(n), { method: 'HEAD' });
        // 開発サーバーは存在しないパスに index.html を返すことがあるので型も見る
        const ct = r.headers.get('content-type') ?? '';
        return r.ok && !ct.includes('text/html') ? n : null;
      } catch {
        return null;
      }
    })
  );
  const list = found.filter((n): n is string => n !== null);
  return list.includes(FILES[1]) ? list : null;
}

export class Bgm {
  private ctx: BaseAudioContext;
  private bus: GainNode;
  private buffers = new Map<string, AudioBuffer>();
  private available: Set<string>;
  private src: AudioBufferSourceNode | null = null;
  private srcGain: GainNode | null = null;
  private playing: string | null = null;
  private intensity: Intensity = 0;
  private started = false;
  private muted = false;

  constructor(ctx: BaseAudioContext, dest: AudioNode, available: string[]) {
    this.ctx = ctx;
    this.available = new Set(available);
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(dest);
  }

  start() {
    if (this.started) return;
    this.started = true;
    void this.apply();
  }

  stop(fade = 0.6) {
    this.started = false;
    const t = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setValueAtTime(this.bus.gain.value, t);
    this.bus.gain.linearRampToValueAtTime(0, t + fade);
  }

  setIntensity(v: Intensity) {
    if (this.intensity === v) return;
    this.intensity = v;
    if (this.started) void this.apply();
  }

  setMuted(v: boolean) {
    this.muted = v;
    const t = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setValueAtTime(this.bus.gain.value, t);
    this.bus.gain.linearRampToValueAtTime(v ? 0 : GAINS[this.intensity], t + 0.4);
  }

  /** その濃さで実際に鳴らすファイル名。無ければ戦闘曲に落とす */
  private pick(v: Intensity) {
    const want = FILES[v];
    return this.available.has(want) ? want : FILES[1];
  }

  private async load(name: string) {
    const hit = this.buffers.get(name);
    if (hit) return hit;
    const res = await fetch(url(name));
    const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
    this.buffers.set(name, buf);
    return buf;
  }

  private async apply() {
    const name = this.pick(this.intensity);
    const vol = this.muted ? 0 : GAINS[this.intensity];

    // 同じ曲のままなら音量だけ動かす
    if (this.playing === name) {
      const t = this.ctx.currentTime;
      this.bus.gain.cancelScheduledValues(t);
      this.bus.gain.setValueAtTime(this.bus.gain.value, t);
      this.bus.gain.linearRampToValueAtTime(vol, t + CROSSFADE);
      return;
    }

    let buf: AudioBuffer;
    try {
      buf = await this.load(name);
    } catch {
      return; // 読めなければ何も鳴らさない
    }
    // 待っている間に切り替わっていたら諦める（後から来た apply が正しい）
    if (!this.started || this.pick(this.intensity) !== name) return;

    const t = this.ctx.currentTime;
    const old = this.src;
    const oldGain = this.srcGain;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + (old ? CROSSFADE : 0.6));
    g.connect(this.bus);
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.connect(g);
    s.start(t);
    this.src = s;
    this.srcGain = g;
    this.playing = name;

    if (old && oldGain) {
      oldGain.gain.cancelScheduledValues(t);
      oldGain.gain.setValueAtTime(oldGain.gain.value, t);
      oldGain.gain.linearRampToValueAtTime(0, t + CROSSFADE);
      old.stop(t + CROSSFADE + 0.05);
    }

    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setValueAtTime(this.bus.gain.value, t);
    this.bus.gain.linearRampToValueAtTime(vol, t + CROSSFADE);
  }
}
