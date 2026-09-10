import type { Bullets } from './Bullets';
import type { Particles } from './Particles';
import type { Sfx } from './Audio';
import type { UI } from './UI';
import type { Input } from './Input';
import type { Player } from './Player';
import type { Boss } from './Boss';
import type { Fx } from './Fx';

/** 各エンティティが参照するゲーム共有コンテキスト */
export interface Ctx {
  bullets: Bullets;
  particles: Particles;
  fx: Fx;
  sfx: Sfx;
  ui: UI;
  input: Input;
  arenaR: number;
  /** ゲーム内経過時間 */
  time: number;
  /** カメラの向き（入力の基準） */
  camYaw: number;
  player: Player;
  boss: Boss;
  /** ヒットストップ／スロー。sec 秒だけ時間の進みを scale 倍にする */
  hitstop(sec: number, scale?: number): void;
  shake(amount: number): void;
  onBossDead(): void;
  onPlayerDead(): void;
}
