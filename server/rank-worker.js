/**
 * 炎舞 -ENBU- みんなのランキング（Cloudflare Workers 用）
 *
 * 置き方は server/README.md を参照。KV 名前空間を RANK という名前で結び付けること。
 *
 *   GET  /            上位を返す（?limit=50）
 *   POST /            記録を 1 件追加して、更新後の上位を返す
 *
 * どちらも JSON で { entries: [...] } を返す。
 */

const KEY = 'top';
/** 残す件数 */
const KEEP = 100;
/** 同じ名前で残す最高記録の件数（1 人が表を埋め尽くさないように） */
const PER_NAME = 3;
const NAME_MAX = 12;
/** ありえない点数をはじく上限 */
const SCORE_MAX = 1_000_000_000;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS },
  });

/** 文字を整える。制御文字を落として長さを切る */
function clean(v, max) {
  return [...String(v ?? '')]
    .filter((c) => {
      const code = c.codePointAt(0);
      return code >= 0x20 && code !== 0x7f;
    })
    .join('')
    .trim()
    .slice(0, max);
}

/** 送られてきた記録を検査して整える。おかしければ null */
function sanitize(body) {
  const score = Math.floor(Number(body?.score));
  if (!Number.isFinite(score) || score < 0 || score > SCORE_MAX) return null;
  const seconds = Number(body?.seconds);
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 3600) return null;
  return {
    name: clean(body?.name, NAME_MAX) || 'ななし',
    score,
    rank: clean(body?.rank, 12),
    char: clean(body?.char, 16),
    seconds: Math.round(seconds * 10) / 10,
    combo: Math.max(0, Math.min(9999, Math.floor(Number(body?.combo) || 0))),
    at: Date.now(),
  };
}

/** 得点の高い順。同点ならタイムが短い方が上 */
const byScore = (a, b) => b.score - a.score || a.seconds - b.seconds;

/** 1 人あたりの件数を絞る */
function limitPerName(list) {
  const count = new Map();
  const out = [];
  for (const e of list) {
    const n = count.get(e.name) ?? 0;
    if (n >= PER_NAME) continue;
    count.set(e.name, n + 1);
    out.push(e);
  }
  return out;
}

async function read(env) {
  const raw = await env.RANK.get(KEY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    if (request.method === 'GET') {
      const limit = Math.min(100, Math.max(1, Number(new URL(request.url).searchParams.get('limit')) || 50));
      const list = await read(env);
      return json({ entries: list.slice(0, limit) });
    }

    if (request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: '読めない本文' }, 400);
      }
      const entry = sanitize(body);
      if (!entry) return json({ error: 'おかしな記録' }, 400);

      const list = limitPerName([...(await read(env)), entry].sort(byScore)).slice(0, KEEP);
      await env.RANK.put(KEY, JSON.stringify(list));
      const rank = list.findIndex((e) => e.at === entry.at && e.score === entry.score) + 1;
      return json({ entries: list, rank });
    }

    return json({ error: '対応していない方法' }, 405);
  },
};
