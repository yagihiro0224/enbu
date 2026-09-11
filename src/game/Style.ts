import type { Sfx } from './Audio';
import { poseAttack, poseAttackChisato, type Pose } from './Anim';
import type { CharId } from './UI';

export type Step = 1 | 2 | 3 | 4 | 5;
export type Kind = 'punch' | 'knife' | 'kick' | 'spin';
export type TrailPart = 'fist' | 'fistR' | 'knife' | 'leg';
export interface AttackCfg {
  total: number; a0: number; a1: number; chain: number;
  dmg: number; poise: number; lunge: number; reach: number;
  kind: Kind; trail: TrailPart;
}

/** キャラごとの戦闘スタイル（モーション、音、効果の色と重さ） */
export interface FightStyle {
  id: CharId;
  attacks: Record<Step, AttackCfg>;
  pose(step: Step, p: number): Pose;
  /** 効果の基本色、明るい色、火花の色 */
  color: number; hot: number; spark: number;
  /** ヒット時の止め・揺れ・寄りの倍率 */
  hitstop: number; shake: number; punch: number;
  /** true なら細く鋭い効果（線・薄い弧）、false なら太く重い効果（衝撃波・太い弧） */
  sharp: boolean;
  swing(sfx: Sfx, kind: Kind): void;
  hit(sfx: Sfx, kind: Kind, heavy: boolean): void;
}

/** 深川まひろ: 重い。ジャブ → 右フック → アッパー → ハイキック → ジャンプ回し蹴り */
const MAHIRO: FightStyle = {
  id: 'mahiro',
  attacks: {
    1: { total: 0.32, a0: 0.1, a1: 0.16, chain: 0.17, dmg: 7, poise: 10, lunge: 5.5, reach: 1.9, kind: 'punch', trail: 'fist' },
    2: { total: 0.4, a0: 0.15, a1: 0.22, chain: 0.23, dmg: 10, poise: 14, lunge: 5.5, reach: 1.95, kind: 'punch', trail: 'fistR' },
    3: { total: 0.44, a0: 0.18, a1: 0.26, chain: 0.27, dmg: 13, poise: 20, lunge: 6.0, reach: 1.9, kind: 'punch', trail: 'fist' },
    4: { total: 0.5, a0: 0.2, a1: 0.3, chain: 0.32, dmg: 15, poise: 22, lunge: 5.0, reach: 2.4, kind: 'kick', trail: 'leg' },
    5: { total: 0.9, a0: 0.42, a1: 0.58, chain: 0.9, dmg: 30, poise: 50, lunge: 7.5, reach: 2.8, kind: 'spin', trail: 'leg' },
  },
  pose: poseAttack,
  color: 0xff3a2a, hot: 0xff8a60, spark: 0xffb090,
  hitstop: 1.4, shake: 1.5, punch: 1.3,
  sharp: false,
  swing(sfx, kind) {
    sfx.whooshHeavy(kind === 'spin' ? 0.6 : kind === 'kick' ? 0.75 : 0.95);
  },
  hit(sfx, kind, heavy) {
    if (heavy) sfx.heavyHit();
    sfx.thud(kind === 'kick' || heavy ? 1.2 : 1);
  },
};

/** 杉本ちさと: 鋭い。刺突ジャブ → 手刀の振り下ろし → 掌底の切り上げ → 前蹴り → 回転裏拳 */
const CHISATO: FightStyle = {
  id: 'chisato',
  attacks: {
    1: { total: 0.26, a0: 0.08, a1: 0.13, chain: 0.14, dmg: 5, poise: 7, lunge: 6.0, reach: 1.9, kind: 'punch', trail: 'fist' },
    2: { total: 0.32, a0: 0.11, a1: 0.17, chain: 0.19, dmg: 8, poise: 10, lunge: 6.0, reach: 2.0, kind: 'punch', trail: 'fistR' },
    3: { total: 0.32, a0: 0.11, a1: 0.17, chain: 0.19, dmg: 8, poise: 10, lunge: 6.0, reach: 2.0, kind: 'punch', trail: 'fistR' },
    4: { total: 0.4, a0: 0.15, a1: 0.23, chain: 0.26, dmg: 11, poise: 16, lunge: 5.0, reach: 2.3, kind: 'kick', trail: 'leg' },
    5: { total: 0.62, a0: 0.28, a1: 0.42, chain: 0.62, dmg: 22, poise: 36, lunge: 9.0, reach: 2.6, kind: 'spin', trail: 'fistR' },
  },
  pose: poseAttackChisato,
  color: 0xa040ff, hot: 0xd090ff, spark: 0xe8c0ff,
  hitstop: 0.7, shake: 0.6, punch: 0.5,
  sharp: true,
  swing(sfx, kind) {
    sfx.whooshSharp(kind === 'spin' ? 0.8 : kind === 'kick' ? 0.9 : 1.15);
  },
  hit(sfx, kind, heavy) {
    sfx.sharpHit(kind === 'spin' ? 1.15 : 1, heavy);
  },
};

export const STYLES: Record<CharId, FightStyle> = { mahiro: MAHIRO, chisato: CHISATO };
