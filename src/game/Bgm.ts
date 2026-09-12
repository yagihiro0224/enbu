/**
 * 音声ファイルの BGM。`public/audio/` に mp3 を置くと合成 BGM の代わりに鳴る。
 *
 * 探すファイル名は下の FILES にある。戦闘曲が無ければ合成 BGM のまま。
 *   戦闘    boss_battle_bgm_001.MP3（ユーザー提供）または bgm.mp3
 *   静か    bgm_calm.mp3  タイトルとリザルト。無ければ戦闘曲を小さく鳴らす
 *   終盤    bgm_hard.mp3  ボス第 3 形態。無ければ戦闘曲のまま
 *
 * ループは AudioBufferSourceNode の loop なので継ぎ目が出ない。
 * 曲が変わるときだけ重ねて入れ替える。
 */

export type Intensity = 0 | 1 | 2;

/**
 * 濃さごとに探すファイル名。先に見つかったものを使う。
 * 実際に置いてある名前をそのまま書いてよい（拡張子の大小も区別される）。
 */
const FILES: Record<Intensity, string[]> = {
  0: ['bgm_calm.mp3'],
  1: ['boss_battle_bgm_001.MP3', 'bgm.mp3'],
  2: ['bgm_hard.mp3'],
};

/**
 * 濃さごとの音量。Sfx の master 0.5 を通るので、実際はこの半分になる。
 * 合成 BGM（ピーク 0.39 前後）と釣り合う値にしてある。
 */
const GAINS: Record<Intensity, number> = { 0: 0.55, 1: 0.95, 2: 1.1 };

const CROSSFADE = 0.9; // 秒

const url = (name: string) => `${import.meta.env.BASE_URL}audio/${name}`;

/**
 * 曲の中身を先に取っておく入れ物。
 * **音を鳴らせるのは画面に触れてからだが、ダウンロードは開いた瞬間から始められる**。
 * 4.8MB あるので、これをやらないと曲が始まるまで何秒も無音になる
 */
const prefetched = new Map<string, Promise<ArrayBuffer>>();

function prefetch(name: string) {
  if (prefetched.has(name)) return;
  prefetched.set(
    name,
    fetch(url(name))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('読めない'))))
  );
  // 取れなくても握りつぶす（鳴らすときに取り直す）
  void prefetched.get(name)!.catch(() => {});
}

/** 無音とみなす振幅。-48dB 相当 */
const SILENCE = 0.004;

/**
 * 曲の前後の無音を探す。
 * 書き出した mp3 は頭と尻に無音が付くことが多く、そのままループすると継ぎ目で音が途切れる。
 * 粗く走査してから、その手前を細かく見て境目を決める。
 */
export function trimRange(buf: AudioBuffer): { start: number; end: number } {
  const ch = buf.getChannelData(0);
  const n = ch.length;
  const stride = 64;
  let head = 0;
  for (let i = 0; i < n; i += stride) {
    if (Math.abs(ch[i]) > SILENCE) { head = Math.max(0, i - stride); break; }
  }
  let tail = n - 1;
  for (let i = n - 1; i >= 0; i -= stride) {
    if (Math.abs(ch[i]) > SILENCE) { tail = Math.min(n - 1, i + stride); break; }
  }
  if (tail <= head) return { start: 0, end: buf.duration };
  return { start: head / buf.sampleRate, end: (tail + 1) / buf.sampleRate };
}

/**
 * 置かれている mp3 を調べる。無ければ null を返すので、呼び出し側は合成 BGM に落とす。
 * 起動を止めないよう、戦闘曲の有無だけを待てば良い作りにしてある。
 */
export async function findBgmFiles(): Promise<string[] | null> {
  const names = Object.values(FILES).flat();
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
  // 戦闘曲が無ければ合成 BGM のまま
  const battle = FILES[1].find((n) => list.includes(n));
  if (!battle) return null;
  prefetch(battle); // 触られるのを待たずに落とし始める
  return list;
}

export class Bgm {
  private ctx: BaseAudioContext;
  private bus: GainNode;
  private buffers = new Map<string, AudioBuffer>();
  /** 曲ごとの、無音を除いた再生範囲 */
  private ranges = new Map<string, { start: number; end: number }>();
  private available: Set<string>;
  private src: AudioBufferSourceNode | null = null;
  private srcGain: GainNode | null = null;
  private playing: string | null = null;
  private intensity: Intensity = 0;
  private started = false;
  private muted = false;
  /** 最初の曲を鳴らせたか。失敗したら呼び出し側が合成 BGM に戻す */
  private firstLoad: Promise<boolean>;
  private settleFirst: (ok: boolean) => void = () => {};

  constructor(ctx: BaseAudioContext, dest: AudioNode, available: string[]) {
    this.ctx = ctx;
    this.available = new Set(available);
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(dest);
    this.firstLoad = new Promise((res) => { this.settleFirst = res; });
  }

  /** 最初の曲が鳴り出せたかを返す。false なら合成 BGM に切り替えること */
  ready() {
    return this.firstLoad;
  }

  /** 状態の要約（診断用） */
  status() {
    const g = this.bus.gain.value.toFixed(2);
    return `mp3 ${this.playing ?? '未再生'} 音量${g} 読込${this.buffers.size}本`;
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
    this.bus.gain.linearRampToValueAtTime(this.vol, t + 0.4);
  }

  /** その濃さで実際に鳴らすファイル名。無ければ戦闘曲に落とす */
  private pick(v: Intensity) {
    const want = FILES[v].find((n) => this.available.has(n));
    return want ?? FILES[1].find((n) => this.available.has(n))!;
  }

  private async load(name: string) {
    const hit = this.buffers.get(name);
    if (hit) return hit;
    // 先に取ってあればそれを使う。無ければ今から取る
    let bytes: ArrayBuffer;
    try {
      bytes = await (prefetched.get(name) ?? fetch(url(name)).then((r) => r.arrayBuffer()));
    } catch {
      bytes = await fetch(url(name)).then((r) => r.arrayBuffer());
    }
    // decodeAudioData は渡した中身を消費するので、写しを渡す
    const buf = await this.ctx.decodeAudioData(bytes.slice(0));
    this.buffers.set(name, buf);
    this.ranges.set(name, trimRange(buf));
    return buf;
  }

  /** いま出すべき音量。muted と濃さから毎回求める */
  private get vol() {
    return this.muted ? 0 : GAINS[this.intensity];
  }

  private async apply() {
    const name = this.pick(this.intensity);

    // 同じ曲のままなら音量だけ動かす
    if (this.playing === name) {
      const t = this.ctx.currentTime;
      this.bus.gain.cancelScheduledValues(t);
      this.bus.gain.setValueAtTime(this.bus.gain.value, t);
      this.bus.gain.linearRampToValueAtTime(this.vol, t + CROSSFADE);
      return;
    }

    let buf: AudioBuffer;
    try {
      buf = await this.load(name);
    } catch {
      this.settleFirst(false); // 読めなかった。呼び出し側が合成 BGM に戻す
      return;
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
    // 前後の無音を飛ばしてループさせる
    const r = this.ranges.get(name) ?? { start: 0, end: buf.duration };
    s.loopStart = r.start;
    s.loopEnd = r.end;
    s.connect(g);
    s.start(t, r.start);
    this.src = s;
    this.srcGain = g;
    this.playing = name;

    if (old && oldGain) {
      oldGain.gain.cancelScheduledValues(t);
      oldGain.gain.setValueAtTime(oldGain.gain.value, t);
      oldGain.gain.linearRampToValueAtTime(0, t + CROSSFADE);
      old.stop(t + CROSSFADE + 0.05);
    }

    // **音量は読み込みを待ったあとに計算し直す**。
    // 待っている間に ♪ を押されていると、古い値で上書きして無音のままになる
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setValueAtTime(this.bus.gain.value, t);
    this.bus.gain.linearRampToValueAtTime(this.vol, t + CROSSFADE);
    this.settleFirst(true);
  }

  /** 合成 BGM に戻すときに音を止めて切り離す */
  dispose() {
    this.started = false;
    try { this.src?.stop(); } catch { /* すでに止まっている */ }
    this.bus.disconnect();
  }
}
