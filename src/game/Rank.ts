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

/** みんなで共有するランキングの URL。空なら端末内だけの記録になる */
const RANK_ENDPOINT = '';

/** 名前の最大文字数 */
export const NAME_MAX = 12;
const NAME_KEY = 'enbu.name';
const LIST_KEY = 'enbu.rank';
/** 端末内に残す件数 */
const KEEP = 100;

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
  /** 端末内の記録を見分けるための印。サーバーには送らない */
  mine?: boolean;
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

  /** この端末の記録。得点の高い順 */
  local(): Entry[] {
    try {
      const raw = localStorage.getItem(LIST_KEY);
      if (!raw) return [];
      const list = JSON.parse(raw) as Entry[];
      return Array.isArray(list) ? list.map((e) => ({ ...e, mine: true })) : [];
    } catch {
      return [];
    }
  }

  private saveLocal(list: Entry[]) {
    try {
      localStorage.setItem(LIST_KEY, JSON.stringify(list.slice(0, KEEP).map(({ mine, ...e }) => ({ ...e, mine }))));
    } catch {
      /* 保存できない設定でも動かす */
    }
  }

  /** 端末内に記録して、何位だったかを返す（1 始まり） */
  addLocal(e: Entry) {
    const list = this.local();
    list.push({ ...e, mine: true });
    list.sort((a, b) => b.score - a.score || a.seconds - b.seconds);
    this.saveLocal(list);
    return list.findIndex((x) => x.at === e.at && x.score === e.score) + 1;
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
    try {
      const { mine, ...body } = e;
      void mine;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
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
