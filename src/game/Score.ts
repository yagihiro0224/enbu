/** クリア後のスコア集計。配点はユーザー指定（2026-09-11） */

export interface ScoreInput {
  /** 打撃を当てた回数 */
  hits: number;
  /** 敵の打撃（突進）をパリィした回数 */
  meleeParries: number;
  /** 敵の弾をパリィした回数 */
  bulletParries: number;
  /** 一度もダメージを受けていない */
  noDamage: boolean;
  /** クリアタイム（秒） */
  seconds: number;
  /** 最大コンボ（表示のみ） */
  maxCombo: number;
}

export interface ScoreLine {
  label: string;
  /** 「30万 × 12」のような内訳。空なら表示しない */
  detail: string;
  points: number;
  /** 強調表示する行（ノーダメージなど） */
  big?: boolean;
}

export interface ScoreResult {
  lines: ScoreLine[];
  /** ボーナスの合計（倍率をかける前） */
  base: number;
  /** コンボ倍率 1.0〜3.0 */
  mult: number;
  maxCombo: number;
  total: number;
  rank: Rank;
}

export type RankId = 'kami' | 'oni' | 'jokyusha' | 'ippan' | 'heta';
export interface Rank {
  id: RankId;
  name: string;
  sub: string;
  /** 演出の派手さ 0（地味）〜4（超派手） */
  level: number;
}

export const HIT_PT = 300_000;
export const MELEE_PARRY_PT = 500_000;
export const BULLET_PARRY_PT = 100_000;
export const NO_DAMAGE_PT = 10_000_000;

/** 称号のしきい値（2026-09-11 ユーザー確定） */
export const RANKS: (Rank & { min: number })[] = [
  { id: 'kami', name: '神人間', sub: 'GOD', level: 4, min: 100_000_000 },
  { id: 'oni', name: '鬼人間', sub: 'DEMON', level: 3, min: 50_000_000 },
  { id: 'jokyusha', name: '上級者人間', sub: 'EXPERT', level: 2, min: 10_000_000 },
  { id: 'ippan', name: '一般人人間', sub: 'ORDINARY', level: 1, min: 5_000_000 },
  { id: 'heta', name: '下手人間', sub: 'ROOKIE', level: 0, min: 0 },
];

/**
 * コンボ倍率。ボーナスの合計にこれを掛ける。
 * ボスの体力から打撃は 70 発前後が上限で、ボーナスの合計は最大でも 3700 万ほど。
 * そのままでは鬼人間（5000万）に届かず神人間（1億）は出せないので、
 * 途切れずに攻め続けた分を倍率にして上位へ届くようにしている（最大コンボ 60 で 4 倍）。
 * 2026-09-11 に敵の体力を半分にしたため、打撃の上限も半分になった。それに合わせて倍率の上限を 3 倍から 4 倍に上げている。
 */
export const MULT_CAP_COMBO = 60;
export function comboMult(maxCombo: number): number {
  return 1 + Math.min(maxCombo, MULT_CAP_COMBO) / 20;
}

/** クリアタイムのボーナス */
function timeBonus(sec: number): { pt: number; label: string } {
  if (sec <= 60) return { pt: 1_000_000, label: '1分以内' };
  if (sec <= 120) return { pt: 500_000, label: '2分以内' };
  if (sec <= 180) return { pt: 200_000, label: '3分以内' };
  return { pt: 0, label: '3分超' };
}

export const man = (n: number) => (n % 100_000_000 === 0 ? `${n / 100_000_000}億` : n >= 10_000 ? `${Math.round(n / 10_000).toLocaleString()}万` : String(n));

export function computeScore(i: ScoreInput): ScoreResult {
  const lines: ScoreLine[] = [];
  lines.push({
    label: '打撃ヒット',
    detail: `${man(HIT_PT)} × ${i.hits}`,
    points: HIT_PT * i.hits,
  });
  lines.push({
    label: '打撃をパリィ',
    detail: `${man(MELEE_PARRY_PT)} × ${i.meleeParries}`,
    points: MELEE_PARRY_PT * i.meleeParries,
  });
  lines.push({
    label: '弾をパリィ',
    detail: `${man(BULLET_PARRY_PT)} × ${i.bulletParries}`,
    points: BULLET_PARRY_PT * i.bulletParries,
  });
  const t = timeBonus(i.seconds);
  lines.push({
    label: 'タイムボーナス',
    detail: `${i.seconds.toFixed(1)}秒 ／ ${t.label}`,
    points: t.pt,
  });
  lines.push({
    label: 'ノーダメージ',
    detail: i.noDamage ? '達成' : '被弾あり',
    points: i.noDamage ? NO_DAMAGE_PT : 0,
    big: i.noDamage,
  });
  const base = lines.reduce((a, l) => a + l.points, 0);
  const mult = comboMult(i.maxCombo);
  const total = Math.round(base * mult);
  const rank = RANKS.find((r) => total >= r.min) ?? RANKS[RANKS.length - 1];
  return { lines, base, mult, maxCombo: i.maxCombo, total, rank };
}
