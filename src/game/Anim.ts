import * as THREE from 'three';
import type { Rig } from './Rig';
import { damp, smoothstep, clamp } from './util';

export type BoneName =
  | 'hips' | 'spine' | 'head'
  | 'upperArmL' | 'lowerArmL' | 'upperArmR' | 'lowerArmR'
  | 'upperLegL' | 'lowerLegL' | 'upperLegR' | 'lowerLegR';

const BONES: BoneName[] = ['hips', 'spine', 'head', 'upperArmL', 'lowerArmL', 'upperArmR', 'lowerArmR', 'upperLegL', 'lowerLegL', 'upperLegR', 'lowerLegR'];

/** 各ボーンのオイラー角 [x, y, z] と骨盤の上下オフセット。hipsYaw は減衰なしで直接入る（回し蹴りの回転用） */
export type Pose = Partial<Record<BoneName, [number, number, number]>> & { hipsY?: number; hipsYaw?: number };

type Vec3 = [number, number, number];
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** キーフレーム列 [進行度, ポーズ] を p (0..1) で補間する。区間ごとに smoothstep で緩急を付ける */
export function poseSeq(keys: [number, Pose][], p: number): Pose {
  p = clamp(p, 0, 1);
  let i = 0;
  while (i < keys.length - 2 && p > keys[i + 1][0]) i++;
  const [t0, a] = keys[i];
  const [t1, b] = keys[Math.min(i + 1, keys.length - 1)];
  const t = t1 > t0 ? smoothstep((p - t0) / (t1 - t0)) : 1;
  const out: Pose = {};
  for (const bone of BONES) {
    const va = a[bone] ?? [0, 0, 0];
    const vb = b[bone] ?? [0, 0, 0];
    out[bone] = lerp3(va, vb, t);
  }
  out.hipsY = (a.hipsY ?? 0) + ((b.hipsY ?? 0) - (a.hipsY ?? 0)) * t;
  if (a.hipsYaw !== undefined || b.hipsYaw !== undefined) out.hipsYaw = (a.hipsYaw ?? 0) + ((b.hipsYaw ?? 0) - (a.hipsYaw ?? 0)) * t;
  return out;
}

/**
 * 手続きアニメーション。目標ポーズへ減衰補間するだけの軽量な仕組み。
 * ちびキャラも VRM も同じポーズ定義で動く。
 */
export class Animator {
  private cur = new Map<BoneName, THREE.Vector3>();
  private hipsY = 0;
  private hairSway = 0;
  private hairBase: number[];
  private hairBaseX: number[];
  private t = 0;

  constructor(private rig: Rig) {
    for (const b of BONES) this.cur.set(b, new THREE.Vector3());
    this.hairBase = rig.hairBones.map((h) => h.rotation.z);
    this.hairBaseX = rig.hairBones.map((h) => h.rotation.x);
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
    if (pose.hipsYaw !== undefined) {
      this.rig.hips.rotation.y = pose.hipsYaw;
      this.cur.get('hips')!.y = pose.hipsYaw;
    }
    // 髪の揺れ: 前進すると後ろへなびき（x 正で -Y の先端が -Z へ）、待機中は微かに揺れる
    this.hairSway = damp(this.hairSway, clamp(velForward * 0.07, -0.55, 0.55) + Math.sin(this.t * 2.5) * 0.06, 6, dt);
    this.rig.hairBones.forEach((h, i) => {
      h.rotation.x = this.hairBaseX[i] + this.hairSway;
      h.rotation.z = this.hairBase[i] + Math.sin(this.t * 3 + i) * 0.03;
    });
  }
}

// ---- ポーズ定義（T ポーズ基準。左腕 +X、右腕 -X）----
// 腕を下ろす: 左 z 負、右 z 正。腕を前へ: 左 y 負、右 y 正。
// 脚を前へ: x 負。膝を曲げる（かかとを上げる）: x 正。

/** 待機: 逆手ナイフの格闘の構え。左拳を顎の前、右のナイフを胸の前に、半身で */
export function poseIdle(t: number): Pose {
  const br = Math.sin(t * 2.2) * 0.02;
  const sway = Math.sin(t * 1.4) * 0.03;
  return {
    hipsY: -0.04 + br,
    spine: [0.08 + br, 0.35, 0],
    head: [-0.05, -0.3 + Math.sin(t * 0.7) * 0.05, 0],
    upperArmL: [0.2, -0.6 + sway, -1.25],
    lowerArmL: [0, -0.5, 2.2],
    upperArmR: [0, 0.5 - sway, 1.15],
    lowerArmR: [0, 0.9, -1.0],
    upperLegL: [-0.3, 0, -0.08],
    lowerLegL: [0.45, 0, 0],
    upperLegR: [0.3, 0, 0.1],
    lowerLegR: [0.35, 0, 0],
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

/** 構え（各打撃の起点と終点） */
const GUARD: Pose = {
  ...STANCE,
  spine: [0.08, 0.35, 0],
  head: [-0.05, -0.3, 0],
  upperArmL: [0.2, -0.6, -1.25],
  lowerArmL: [0, -0.5, 2.2],
  upperArmR: [0, 0.5, 1.15],
  lowerArmR: [0, 0.9, -1.0],
};

/** 5 段の格闘コンボ。p は 0..1 の進行度。1 ジャブ、2 フック（ナイフ）、3 アッパー、4 ハイキック、5 ジャンプ回し蹴り */
export function poseAttack(step: 1 | 2 | 3 | 4 | 5, p: number): Pose {
  switch (step) {
    case 1: // 左ジャブ: 肩を入れて真っ直ぐ突く
      return poseSeq([
        [0, GUARD],
        [0.12, { ...GUARD, spine: [0.1, 0.5, 0], upperArmL: [0.2, -0.4, -1.2], lowerArmL: [0, -0.4, 2.3] }],
        [0.38, { ...GUARD, hipsY: -0.06, spine: [0.15, -0.25, 0], head: [-0.05, 0.05, 0], upperArmL: [0, -1.55, -0.1], lowerArmL: [0, -0.05, 0], upperArmR: [0, 0.5, 1.15], lowerArmR: [0, 0.9, -1.0] }],
        [0.7, { ...GUARD, spine: [0.1, 0.1, 0], upperArmL: [0.05, -1.3, -0.5], lowerArmL: [0, -1.2, 0.1] }],
        [1, GUARD],
      ], p);
    case 2: // 右フック（ナイフ）: 腰を切って横から薙ぐ
      return poseSeq([
        [0, GUARD],
        [0.18, { ...GUARD, spine: [0.1, 0.75, 0], head: [-0.05, -0.5, 0], upperArmR: [0.2, -0.4, 0.4], lowerArmR: [0.4, 1.5, 0] }],
        [0.45, { ...GUARD, hipsY: -0.07, spine: [0.15, -0.55, 0], head: [-0.05, 0.2, 0], upperArmR: [0.1, 1.5, 0.15], lowerArmR: [0.2, 0.9, 0], upperArmL: [0.2, -0.5, -1.2], lowerArmL: [0, -0.4, 2.2], upperLegL: [-0.4, 0, -0.1], upperLegR: [0.35, 0, 0.15] }],
        [0.75, { ...GUARD, spine: [0.1, -0.1, 0], upperArmR: [0.1, 1.1, 0.6], lowerArmR: [0.3, 1.4, 0] }],
        [1, GUARD],
      ], p);
    case 3: // 左アッパー: 沈み込んでから下から突き上げる
      return poseSeq([
        [0, GUARD],
        [0.22, { ...GUARD, hipsY: -0.16, spine: [0.4, 0.4, 0], head: [-0.2, -0.3, 0], upperArmL: [0.2, -0.2, -1.35], lowerArmL: [0, -0.3, 2.4], upperLegL: [-0.55, 0, -0.08], lowerLegL: [0.9, 0, 0], upperLegR: [0.1, 0, 0.1], lowerLegR: [0.7, 0, 0] }],
        [0.5, { ...GUARD, hipsY: 0.04, spine: [-0.2, -0.2, 0], head: [0.15, 0.05, 0], upperArmL: [0.3, -1.25, 0.45], lowerArmL: [0, -1.25, 0.1], upperArmR: [0, 0.5, 1.15], lowerArmR: [0, 0.9, -1.0], upperLegL: [-0.15, 0, -0.08], lowerLegL: [0.2, 0, 0], upperLegR: [0.35, 0, 0.1], lowerLegR: [0.3, 0, 0] }],
        [0.8, { ...GUARD, spine: [0, 0.1, 0], upperArmL: [0.1, -1.2, -0.4], lowerArmL: [0, -1.5, 0.2] }],
        [1, GUARD],
      ], p);
    case 4: // 右ハイキック: 膝を抱えてから振り上げ、上体を反らす
      return poseSeq([
        [0, GUARD],
        [0.25, { ...GUARD, hipsY: -0.06, spine: [0.2, 0.2, 0], upperLegL: [-0.1, 0, -0.1], lowerLegL: [0.3, 0, 0], upperLegR: [-1.2, 0, 0.2], lowerLegR: [1.7, 0, 0], upperArmR: [0, 0.2, 0.9], lowerArmR: [0.3, 1.4, 0] }],
        [0.5, { ...GUARD, hipsY: 0.0, spine: [-0.4, -0.35, 0], head: [0.2, 0.1, 0], upperLegL: [0.15, 0, -0.1], lowerLegL: [0.2, 0, 0], upperLegR: [-2.2, 0, 0.25], lowerLegR: [0.15, 0, 0], upperArmL: [0.2, -0.5, -1.2], lowerArmL: [0, -0.4, 2.0], upperArmR: [0, -0.5, 0.7], lowerArmR: [0.2, 0.6, 0] }],
        [0.78, { ...GUARD, spine: [0.1, 0.1, 0], upperLegR: [-0.6, 0, 0.15], lowerLegR: [1.0, 0, 0] }],
        [1, GUARD],
      ], p);
    default: { // ジャンプ回し蹴り: 沈む → 跳ぶ → 一回転しながら蹴る → 着地
      const spin = clamp((p - 0.22) / 0.5, 0, 1);
      const yaw = -smoothstep(spin) * Math.PI * 2;
      const seq = poseSeq([
        [0, GUARD],
        [0.2, { ...GUARD, hipsY: -0.16, spine: [0.45, 0.5, 0], head: [-0.2, -0.3, 0], upperLegL: [-0.6, 0, -0.1], lowerLegL: [1.0, 0, 0], upperLegR: [-0.2, 0, 0.1], lowerLegR: [0.9, 0, 0], upperArmL: [0, -0.4, -0.9], lowerArmL: [0, -1.4, 0.2], upperArmR: [0, 0.2, 0.9], lowerArmR: [0.3, 1.2, 0] }],
        [0.38, { ...GUARD, hipsY: 0.5, spine: [0.1, 0, 0], upperLegL: [-1.1, 0, -0.1], lowerLegL: [1.6, 0, 0], upperLegR: [-0.7, 0, 0.2], lowerLegR: [1.5, 0, 0], upperArmL: [0, -0.3, -0.3], lowerArmL: [0, -1.0, 0.2], upperArmR: [0, 0.3, 0.3], lowerArmR: [0.2, 1.0, 0] }],
        [0.58, { ...GUARD, hipsY: 0.55, spine: [-0.35, 0, 0], head: [0.2, 0, 0], upperLegL: [-0.9, 0, -0.1], lowerLegL: [1.4, 0, 0], upperLegR: [-2.0, 0, 0.3], lowerLegR: [0.1, 0, 0], upperArmL: [0, -0.6, 0.2], lowerArmL: [0, -0.8, 0.2], upperArmR: [0, 0.6, -0.2], lowerArmR: [0.2, 0.8, 0] }],
        [0.8, { ...GUARD, hipsY: 0.05, spine: [0.1, 0, 0], upperLegL: [-0.5, 0, -0.1], lowerLegL: [0.8, 0, 0], upperLegR: [-0.3, 0, 0.15], lowerLegR: [0.7, 0, 0] }],
        [0.9, { ...GUARD, hipsY: -0.14, spine: [0.35, 0.2, 0], upperLegL: [-0.6, 0, -0.1], lowerLegL: [1.0, 0, 0], upperLegR: [-0.2, 0, 0.1], lowerLegR: [0.9, 0, 0] }],
        [1, GUARD],
      ], p);
      seq.hipsYaw = yaw;
      return seq;
    }
  }
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
