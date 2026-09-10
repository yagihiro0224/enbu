import * as THREE from 'three';

/**
 * キャラクターの骨格抽象。
 * プリミティブ製ちびキャラも VRM も同じインターフェースで手続きアニメを当てる。
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
  /** 揺れ物（ツインテールなど）。速度に応じてなびかせる */
  hairBones: THREE.Object3D[];
  /** 骨盤の基準高さ（足元からの距離） */
  hipsHeight: number;
  height: number;
  /** ダメージ時の白フラッシュ 0..1 */
  setFlash(v: number): void;
  /** 武器の発光 0..1 */
  setWeaponGlow(v: number): void;
  update(dt: number): void;
  dispose(): void;
}
