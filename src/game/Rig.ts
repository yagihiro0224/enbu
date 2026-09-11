import * as THREE from 'three';
import type { Weapon } from './Weapons';

/**
 * キャラクターの骨格抽象。
 * プリミティブ製キャラも VRM も同じインターフェースで手続きアニメを当てる。
 * 規約: root は足元原点、+Z が正面、T ポーズ基準（左腕は +X、右腕は -X 方向）。
 */
export interface Rig {
  root: THREE.Group;
  hips: THREE.Object3D;
  spine: THREE.Object3D;
  head: THREE.Object3D;
  upperArmL: THREE.Object3D;
  lowerArmL: THREE.Object3D;
  upperArmR: THREE.Object3D;
  lowerArmR: THREE.Object3D;
  upperLegL: THREE.Object3D;
  lowerLegL: THREE.Object3D;
  upperLegR: THREE.Object3D;
  lowerLegR: THREE.Object3D;
  /** 武器を付けるノード（右手先） */
  handR: THREE.Object3D;
  /** 持っている武器（軌跡エフェクト用） */
  weapon: Weapon | null;
  /** 揺れ物（ポニーテールなど）。速度に応じてなびかせる */
  hairBones: THREE.Object3D[];
  /** 骨盤の基準高さ（足元からの距離） */
  hipsHeight: number;
  height: number;
  /** ダメージ時の白フラッシュ 0..1 */
  setFlash(v: number): void;
  /** 武器の発光 0..1 */
  setWeaponGlow(v: number): void;
  /** 指を握る 0..1（指の骨がある VRM のみ有効） */
  setFist?(left: number, right: number): void;
  /**
   * 揺れ物の物理を今の姿勢で初期化する。
   * 瞬間移動のように位置が飛ぶと髪が引き伸ばされて壊れるので、その直後に呼ぶ。
   */
  resetSprings?(): void;
  update(dt: number): void;
  dispose(): void;
}
