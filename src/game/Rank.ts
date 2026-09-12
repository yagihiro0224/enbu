/**
 * ランキング。
 *
 * 保存先は 2 段構え:
 *   1. この端末（localStorage）。設定なしで必ず動く
 *   2. みんなで共有するサーバー（任意）。`RANK_ENDPOINT` に URL を入れると有効になる
 *
 * サーバーは `server/rank-worker.js` をそのまま置けば動く簡単な JSON API。
 * 期待する形は次のとおり:
 *   GET  <endpoint>?limit=50     → { entries: Entry[] }（得点の高い順）
 *   POST <endpoint>  Entry(JSON) → { entries: Entry[], rank: number }
 */

/**
 * みんなで共有するランキングの URL。空なら端末内だけの記録になる。
 * 実体は Cloudflare Workers（server/rank-worker.js、KV 名前空間 enbu-rank）。2026-09-12 に用意した
 */
const RANK_ENDPOINT = 'https://enbu-rank.yagi-hiro-0224.workers.dev/';

/** 名前の最大文字数 */
export const NAME_MAX = 12;
const NAME_KEY = 'enbu.name';
/** 名前ごとの自己ベスト。**一覧は持たない**（みんなのランキングがあるので端末内の順位表は不要） */
const BEST_KEY = 'enbu.best';
/** 昔の版が使っていた端末内の一覧。見つけたら消す */
const OLD_LIST_KEY = 'enbu.rank';

export interface Entry {
  name: string;
  score: number;
  /** 称号の表示名 */
  rank: string;
  /** 使ったキャラの表示名 */
  char: string;
  seconds: number;
  combo: number;
  /** 記録した時刻（ミリ秒） */
  at: number;
}

/** 名前を整える。制御文字と前後の空白を落とし、長さを切り詰める */
export function cleanName(v: string) {
  // 制御文字を落としてから前後の空白を削り、長さを切り詰める
  const s = Array.from(v)
    .filter((c) => {
      const code = c.codePointAt(0) ?? 0;
      return code >= 0x20 && code !== 0x7f;
    })
    .join('')
    .trim()
    .slice(0, NAME_MAX);
  return s || 'ななし';
}

/**
 * 検証用の起動かどうか。
 * ?win などは結果をでっち上げる指定なので、**本番のランキングに書き込んではいけない**。
 * 開発サーバー（localhost）からの書き込みも同じ理由で止める。
 */
function isDebugRun() {
  const q = new URLSearchParams(location.search);
  const forged = ['win', 'lose', 'bot', 'hp', 'lowhp', 't', 'rankdemo', 'sharetest'];
  if (forged.some((k) => q.has(k))) return true;
  // 試遊版（/preview/ 配下）も本番のランキングには載せない
  if (isPreview()) return true;
  return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
}

/** 試遊版かどうか。置き場所が /preview/ の下なら試遊版 */
export function isPreview() {
  return location.pathname.includes('/preview/');
}

/** サーバーの URL。?rank=<url> で差し替えられる（検証用） */
function endpoint() {
  const q = new URLSearchParams(location.search).get('rank');
  return (q || RANK_ENDPOINT).trim();
}

export class Ranking {
  /** みんなで共有するランキングが使えるか */
  readonly shared = endpoint() !== '';

  get name() {
    try {
      return localStorage.getItem(NAME_KEY) ?? '';
    } catch {
      return '';
    }
  }

  set name(v: string) {
    try {
      localStorage.setItem(NAME_KEY, cleanName(v));
    } catch {
      /* 保存できない設定でも動かす */
    }
  }

  /** 名前ごとの自己ベスト。{ 名前: 点数 } */
  private bests(): Record<string, number> {
    try {
      // 昔の版が残した一覧は使わないので片付ける
      localStorage.removeItem(OLD_LIST_KEY);
      const raw = localStorage.getItem(BEST_KEY);
      const o = raw ? (JSON.parse(raw) as Record<string, number>) : {};
      return o && typeof o === 'object' ? o : {};
    } catch {
      return {};
    }
  }

  /**
   * その名前のこれまでの最高点。記録がなければ 0。
   * 名前は打ち替えられるので、名前ごとに覚える
   */
  bestOf(name: string) {
    return this.bests()[cleanName(name)] ?? 0;
  }

  /** 自己ベストを更新する */
  saveBest(e: Entry) {
    const n = cleanName(e.name);
    const all = this.bests();
    if ((all[n] ?? 0) >= e.score) return;
    all[n] = e.score;
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify(all));
    } catch {
      /* 保存できない設定でも動かす */
    }
  }

  /** サーバーの上位を取る。使えないときや失敗したときは null */
  async fetchShared(limit = 50): Promise<Entry[] | null> {
    const url = endpoint();
    if (!url) return null;
    try {
      const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}limit=${limit}`, { cache: 'no-store' });
      if (!res.ok) return null;
      return normalize(await res.json());
    } catch {
      return null;
    }
  }

  /** サーバーへ記録を送り、更新後の上位を返す。失敗したら null */
  async submitShared(e: Entry): Promise<Entry[] | null> {
    const url = endpoint();
    if (!url) return null;
    // でっち上げた結果や開発中の起動は送らない
    if (isDebugRun()) {
      console.info('ランキングへの登録は検証用の起動なので見送った');
      return null;
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(e),
      });
      if (!res.ok) return null;
      return normalize(await res.json());
    } catch {
      return null;
    }
  }
}

/** サーバーの返事を Entry の配列にそろえる */
function normalize(data: unknown): Entry[] | null {
  const list = Array.isArray(data) ? data : (data as { entries?: unknown })?.entries;
  if (!Array.isArray(list)) return null;
  return list
    .filter((e): e is Entry => !!e && typeof (e as Entry).score === 'number')
    .map((e) => ({
      name: cleanName(String(e.name ?? '')),
      score: Math.max(0, Math.floor(e.score)),
      rank: String(e.rank ?? ''),
      char: String(e.char ?? ''),
      seconds: Number(e.seconds) || 0,
      combo: Number(e.combo) || 0,
      at: Number(e.at) || 0,
    }))
    .sort((a, b) => b.score - a.score || a.seconds - b.seconds);
}
