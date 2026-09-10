import * as THREE from 'three';
import type { Rig } from './Rig';
import { damp, smoothstep, clamp } from './util';

export type BoneName =
  | 'hips' | 'spine' | 'head'
  | 'upperArmL' | 'lowerArmL' | 'upperArmR' | 'lowerArmR'
  | 'upperLegL' | 'lowerLegL' | 'upperLegR' | 'lowerLegR';

const BONES: BoneName[] = ['hips', 'spine', 'head', 'upperArmL', 'lowerArmL', 'upperArmR', 'lowerArmR', 'upperLegL', 'lowerLegL', 'upperLegR', 'lowerLegR'];

/** 各ボーンのオイラー角 [x, y, z] と骨盤の上下オフセット */
export type Pose = Partial<Record<BoneName, [number, number, number]>> & { hipsY?: number };

/**
 * 手続きアニメーション。目標ポーズへ減衰補間するだけの軽量な仕組み。
 * ちびキャラも VRM も同じポーズ定義で動く。
 */
export class Animator {
  private cur = new Map<BoneName, THREE.Vector3>();
  private hipsY = 0;
  private hairSway = 0;
  private hairBase: number[];
  private t = 0;

  constructor(private rig: Rig) {
    for (const b of BONES) this.cur.set(b, new THREE.Vector3());
    this.hairBase = rig.hairBones.map((h) => h.rotation.z);
  }

  /** pose へ rate の速さで近づける。velForward は髪をなびかせる用（正面方向速度） */
  apply(pose: Pose, rate: number, dt: number, velForward = 0) {
    this.t += dt;
    for (const b of BONES) {
      const c = this.cur.get(b)!;
      const target = pose[b] ?? [0, 0, 0];
      c.x = damp(c.x, target[0], rate, dt);
      c.y = damp(c.y, target[1], rate, dt);
      c.z = damp(c.z, target[2], rate, dt);
      this.rig[b].rotation.set(c.x, c.y, c.z);
    }
    this.hipsY = damp(this.hipsY, pose.hipsY ?? 0, rate, dt);
    this.rig.hips.position.y = this.rig.hipsHeight + this.hipsY;
    // 髪の揺れ: 前進すると後ろへなびき、待機中は微かに揺れる
    this.hairSway = damp(this.hairSway, clamp(-velForward * 0.07, -0.55, 0.55) + Math.sin(this.t * 2.5) * 0.06, 6, dt);
    this.rig.hairBones.forEach((h, i) => {
      h.rotation.x = this.hairSway;
      h.rotation.z = this.hairBase[i] + Math.sin(this.t * 3 + i) * 0.03;
    });
  }
}

// ---- ポーズ定義（T ポーズ基準。左腕 +X、右腕 -X）----
// 腕を下ろす: 左 z 負、右 z 正。腕を前へ: 左 y 負、右 y 正。
// 脚を前へ: x 負。膝を曲げる（かかとを上げる）: x 正。

export function poseIdle(t: number, sword = true): Pose {
  const br = Math.sin(t * 2) * 0.02;
  return {
    spine: [br, 0, 0],
    head: [-br, Math.sin(t * 0.7) * 0.08, 0],
    upperArmL: [0, 0.1, -1.25],
    lowerArmL: [0, -0.3, 0],
    upperArmR: [0, sword ? 0.35 : -0.1, 1.1],
    lowerArmR: [0, sword ? 0.5 : 0.3, 0],
    upperLegL: [0, 0, -0.05],
    upperLegR: [0, 0, 0.05],
  };
}

export function poseRun(cycle: number, f: number): Pose {
  const s = Math.sin(cycle);
  const c = Math.cos(cycle);
  const kneeL = clamp(0.5 - 0.5 * c, 0, 1) * 1.1 * f;
  const kneeR = clamp(0.5 + 0.5 * c, 0, 1) * 1.1 * f;
  return {
    spine: [0.18 * f, 0, 0],
    head: [-0.12 * f, 0, 0],
    upperLegL: [-s * 0.85 * f, 0, -0.05],
    lowerLegL: [kneeL, 0, 0],
    upperLegR: [s * 0.85 * f, 0, 0.05],
    lowerLegR: [kneeR, 0, 0],
    upperArmL: [0, s * 0.7 * f, -1.15],
    lowerArmL: [0, -0.9 * f - 0.2, 0],
    upperArmR: [0, s * 0.7 * f + 0.2, 1.15],
    lowerArmR: [0, 0.9 * f + 0.2, 0],
    hipsY: Math.abs(s) * 0.035 * f - 0.02 * f,
  };
}

const STANCE: Pose = {
  upperLegL: [-0.3, 0, -0.08],
  lowerLegL: [0.45, 0, 0],
  upperLegR: [0.3, 0, 0.08],
  lowerLegR: [0.35, 0, 0],
  hipsY: -0.05,
};

/** 3段コンボ。p は 0..1 の進行度 */
export function poseAttack(step: 1 | 2 | 3, p: number): Pose {
  // 振りかぶり → 振り抜き
  const swing = smoothstep((p - 0.15) / 0.3);
  if (step === 1) {
    // 右から左への横薙ぎ
    return {
      ...STANCE,
      spine: [0.1, 0.5 - swing * 1.0, 0],
      head: [-0.05, -0.3 + swing * 0.5, 0],
      upperArmR: [0, -1.0 + swing * 2.7, 0.25 + swing * 0.3],
      lowerArmR: [0, 0.3 - swing * 0.2, 0],
      upperArmL: [0, 0.4 - swing * 0.7, -1.0],
      lowerArmL: [0, -0.6, 0],
    };
  }
  if (step === 2) {
    // 左から右への返し
    return {
      ...STANCE,
      spine: [0.12, -0.5 + swing * 1.0, 0],
      head: [-0.05, 0.3 - swing * 0.5, 0],
      upperArmR: [0, 1.7 - swing * 2.5, 0.2 + swing * 0.2],
      lowerArmR: [0, 0.4, 0],
      upperArmL: [0, -0.4 + swing * 0.6, -1.0],
      lowerArmL: [0, -0.6, 0],
    };
  }
  // 大上段からの振り下ろし
  const lean = smoothstep((p - 0.2) / 0.25);
  return {
    ...STANCE,
    hipsY: -0.05 - lean * 0.08,
    spine: [-0.15 + lean * 0.55, 0, 0],
    head: [0.1 - lean * 0.4, 0, 0],
    upperArmR: [0, 0.3 + lean * 1.0, -1.35 + lean * 2.3],
    lowerArmR: [0, 0.2, 0],
    upperArmL: [0, -0.2 - lean * 0.6, -0.9 - lean * 0.3],
    lowerArmL: [0, -0.8, 0],
  };
}

export function poseDodge(): Pose {
  return {
    hipsY: -0.12,
    spine: [0.45, 0, 0],
    head: [-0.3, 0, 0],
    upperArmL: [0, 0.9, -1.3],
    lowerArmL: [0, -0.5, 0],
    upperArmR: [0, -0.9, 1.3],
    lowerArmR: [0, 0.5, 0],
    upperLegL: [-0.7, 0, -0.05],
    lowerLegL: [1.1, 0, 0],
    upperLegR: [0.3, 0, 0.05],
    lowerLegR: [0.9, 0, 0],
  };
}

export function poseParry(): Pose {
  return {
    ...STANCE,
    spine: [0.05, 0.35, 0],
    head: [0, -0.2, 0],
    upperArmR: [0, 1.4, 0.35],
    lowerArmR: [0, 0.9, 0],
    upperArmL: [0, -1.1, -0.6],
    lowerArmL: [0, -0.9, 0],
  };
}

export function poseShoot(base: Pose): Pose {
  return {
    ...base,
    upperArmL: [0, -1.55, -0.15],
    lowerArmL: [0, -0.15, 0],
  };
}

export function poseHit(): Pose {
  return {
    spine: [-0.35, 0, 0],
    head: [-0.3, 0, 0],
    upperArmL: [0, 0.6, -0.8],
    lowerArmL: [0, -0.5, 0],
    upperArmR: [0, -0.6, 0.8],
    lowerArmR: [0, 0.5, 0],
    upperLegL: [0.2, 0, -0.1],
    upperLegR: [-0.2, 0, 0.1],
    lowerLegR: [0.4, 0, 0],
  };
}

export function poseDead(hipsHeight: number): Pose {
  return {
    hips: [-1.5, 0, 0],
    hipsY: -hipsHeight + 0.28,
    spine: [-0.1, 0, 0],
    head: [-0.3, 0.2, 0],
    upperArmL: [0, 0, -0.4],
    upperArmR: [0, 0, 0.4],
    lowerArmL: [0, -0.3, 0],
    lowerArmR: [0, 0.3, 0],
    upperLegL: [0.1, 0, -0.15],
    upperLegR: [0.05, 0, 0.15],
    lowerLegL: [0.3, 0, 0],
  };
}

/** ボスの詠唱（両手を掲げる） */
export function poseCast(t: number, intensity = 1): Pose {
  const w = Math.sin(t * 6) * 0.08 * intensity;
  return {
    hipsY: 0.02,
    spine: [-0.12, 0, 0],
    head: [-0.18, 0, 0],
    upperArmL: [0, -0.3 + w, 0.55],
    lowerArmL: [0, -0.5, 0.3],
    upperArmR: [0, 0.3 - w, -0.55],
    lowerArmR: [0, 0.5, -0.3],
    upperLegL: [0, 0, -0.1],
    upperLegR: [0, 0, 0.1],
  };
}

/** ボスの突進 */
export function poseLunge(): Pose {
  return {
    hipsY: -0.08,
    spine: [0.35, -0.2, 0],
    head: [-0.25, 0.1, 0],
    upperArmR: [0, 1.6, 0.15],
    lowerArmR: [0, 0.3, 0],
    upperArmL: [0, 0.8, -1.2],
    lowerArmL: [0, -0.6, 0],
    upperLegL: [-0.7, 0, -0.05],
    lowerLegL: [0.9, 0, 0],
    upperLegR: [0.4, 0, 0.05],
    lowerLegR: [0.8, 0, 0],
  };
}

/** ボスの浮遊待機 */
export function poseFloat(t: number): Pose {
  return {
    hipsY: Math.sin(t * 1.6) * 0.06 + 0.02,
    spine: [Math.sin(t * 1.6) * 0.03, 0, 0],
    head: [Math.sin(t * 1.1) * 0.05, Math.sin(t * 0.6) * 0.15, 0],
    upperArmL: [0, -0.2, -0.95],
    lowerArmL: [0, -0.8, 0.2],
    upperArmR: [0, 0.6, 0.9],
    lowerArmR: [0, 0.7, 0],
    upperLegL: [0.15, 0, -0.08],
    lowerLegL: [0.3, 0, 0],
    upperLegR: [-0.1, 0, 0.08],
    lowerLegR: [0.35, 0, 0],
  };
}
