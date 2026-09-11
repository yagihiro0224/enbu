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


// ---- 腕を方向ベクトルで指定する補助 ----
// 方向はキャラの根元座標（+Z 前、+Y 上、+X 左）。上腕の向きと前腕（肘→拳）の向きを与えると、
// spine の回転を考慮して upperArm / lowerArm のオイラー角を返す。
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();

/** 休止方向 (sign,0,0) を d に向ける [0, y, z] を返す */
function eulerForDir(sign: number, d: THREE.Vector3): Vec3 {
  const y = clamp(d.y * sign, -1, 1);
  const c = Math.asin(y);
  const cc = Math.cos(c);
  const b = Math.abs(cc) > 1e-4 ? Math.atan2((-d.z * sign) / cc, (d.x * sign) / cc) : 0;
  return [0, b, c];
}

export type ArmDirs = { L?: [Vec3, Vec3]; R?: [Vec3, Vec3] };

/** 腕の方向指定をポーズ（upperArm / lowerArm の角度）に変換する */
export function arms(dirs: ArmDirs, spine: Vec3 = [0, 0, 0]): Pose {
  const out: Pose = {};
  _q1.setFromEuler(_e.set(spine[0], spine[1], spine[2], 'XYZ'));
  const inv = _q1.clone().invert();
  for (const side of ['L', 'R'] as const) {
    const d = dirs[side];
    if (!d) continue;
    const sign = side === 'L' ? 1 : -1;
    const upper = _v.set(d[0][0], d[0][1], d[0][2]).normalize().applyQuaternion(inv).clone();
    const eU = eulerForDir(sign, upper);
    _q2.setFromEuler(_e.set(eU[0], eU[1], eU[2], 'XYZ'));
    const qUpperWorld = _q1.clone().multiply(_q2);
    const fore = _v.set(d[1][0], d[1][1], d[1][2]).normalize().applyQuaternion(qUpperWorld.invert()).clone();
    const eL = eulerForDir(sign, fore);
    if (side === 'L') { out.upperArmL = eU; out.lowerArmL = eL; }
    else { out.upperArmR = eU; out.lowerArmR = eL; }
  }
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

/** 待機: 逆手ナイフの格闘の構え（オーソドックス。左足・左肩が前、左拳を顎の前、右のナイフを胸の前で刃を下に） */
const IDLE_SPINE: Vec3 = [0.1, -0.35, 0];
const IDLE_ARMS = arms({ L: [[0.35, -0.85, 0.4], [-0.15, 0.8, 0.55]], R: [[-0.35, -0.9, 0.3], [0.1, 0.75, 0.65]] }, IDLE_SPINE);
export function poseIdle(t: number): Pose {
  const br = Math.sin(t * 2.2) * 0.02;
  const sw = Math.sin(t * 1.4) * 0.05;
  const a = arms({ L: [[0.35, -0.85, 0.4 + sw], [-0.15, 0.8, 0.55 + sw]], R: [[-0.35, -0.9, 0.3 - sw], [0.1, 0.75, 0.65 - sw]] }, IDLE_SPINE);
  return {
    hipsY: -0.05 + br,
    spine: [IDLE_SPINE[0] + br, IDLE_SPINE[1], 0],
    head: [-0.05, 0.3 + Math.sin(t * 0.7) * 0.05, 0],
    ...a,
    upperLegL: [-0.35, 0, -0.1],
    lowerLegL: [0.5, 0, 0],
    upperLegR: [0.3, 0, 0.12],
    lowerLegR: [0.35, 0, 0],
  };
}
void IDLE_ARMS;

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
const GUARD_SPINE: Vec3 = [0.1, -0.35, 0];
const GUARD: Pose = {
  hipsY: -0.05,
  spine: GUARD_SPINE,
  head: [-0.05, 0.3, 0],
  ...arms({ L: [[0.35, -0.85, 0.4], [-0.15, 0.8, 0.55]], R: [[-0.35, -0.9, 0.3], [0.1, 0.75, 0.65]] }, GUARD_SPINE),
  upperLegL: [-0.35, 0, -0.1],
  lowerLegL: [0.5, 0, 0],
  upperLegR: [0.3, 0, 0.12],
  lowerLegR: [0.35, 0, 0],
};

/** キー生成の短縮: 構えに差分と腕の方向指定を重ねる */
function key(p: number, spine: Vec3, a: ArmDirs, rest: Pose = {}): [number, Pose] {
  return [p, { ...GUARD, ...rest, spine, ...arms(a, spine) }];
}
const GL: [Vec3, Vec3] = [[0.35, -0.85, 0.4], [-0.15, 0.8, 0.55]]; // 構えの左腕
const GR: [Vec3, Vec3] = [[-0.35, -0.9, 0.3], [0.1, 0.75, 0.65]]; // 構えの右腕

const JAB: [number, Pose][] = [
  [0, GUARD],
  key(0.15, [0.1, -0.15, 0], { L: [[0.45, -0.7, 0.5], [-0.2, 0.7, 0.6]], R: GR }, { hipsY: -0.06, head: [-0.05, 0.1, 0] }),
  key(0.32, [0.22, -0.9, 0], { L: [[0.05, -0.05, 1], [0, 0, 1]], R: [[-0.3, -0.85, 0.4], [0.15, 0.7, 0.7]] }, { hipsY: -0.08, head: [0, 0.75, 0], upperLegL: [-0.5, 0, -0.1], lowerLegL: [0.55, 0, 0], upperLegR: [0.55, 0, 0.12], lowerLegR: [0.2, 0, 0] }),
  key(0.44, [0.22, -1.0, 0], { L: [[0.02, -0.02, 1], [0, 0, 1]], R: [[-0.3, -0.85, 0.4], [0.15, 0.7, 0.7]] }, { hipsY: -0.08, head: [0, 0.8, 0], upperLegL: [-0.5, 0, -0.1], lowerLegL: [0.55, 0, 0], upperLegR: [0.55, 0, 0.12], lowerLegR: [0.2, 0, 0] }),
  key(0.75, [0.15, -0.6, 0], { L: [[0.3, -0.5, 0.8], [-0.1, 0.6, 0.8]], R: GR }, { head: [0, 0.5, 0] }),
  [1, GUARD],
];

const HOOK: [number, Pose][] = [
  [0, GUARD],
  key(0.24, [0.12, -0.75, 0], { L: [[0.4, -0.7, 0.5], [-0.2, 0.7, 0.6]], R: [[-0.9, -0.15, -0.4], [-0.35, 0.05, 0.95]] }, { hipsY: -0.07, head: [0, 0.6, 0] }),
  key(0.4, [0.18, 0.85, 0], { L: [[0.4, -0.7, 0.5], [-0.2, 0.7, 0.6]], R: [[0.3, -0.05, 0.95], [0.95, 0, 0.3]] }, { hipsY: -0.09, head: [0, -0.6, 0], upperLegL: [-0.35, 0, -0.1], lowerLegL: [0.5, 0, 0], upperLegR: [0.45, 0, 0.2], lowerLegR: [0.25, 0, 0] }),
  key(0.5, [0.18, 1.0, 0], { L: [[0.4, -0.7, 0.5], [-0.2, 0.7, 0.6]], R: [[0.45, -0.05, 0.9], [0.98, 0, 0.15]] }, { hipsY: -0.09, head: [0, -0.7, 0], upperLegL: [-0.35, 0, -0.1], lowerLegL: [0.5, 0, 0], upperLegR: [0.45, 0, 0.2], lowerLegR: [0.25, 0, 0] }),
  key(0.8, [0.12, 0.3, 0], { L: GL, R: [[-0.2, -0.6, 0.75], [0.3, 0.5, 0.8]] }, { head: [0, -0.2, 0] }),
  [1, GUARD],
];

const UPPER: [number, Pose][] = [
  [0, GUARD],
  key(0.28, [0.55, -0.1, 0], { L: [[0.3, -0.9, -0.3], [0.1, -0.3, 0.95]], R: [[-0.35, -0.85, 0.35], [0.1, 0.7, 0.7]] }, { hipsY: -0.24, head: [-0.3, 0.2, 0], upperLegL: [-0.7, 0, -0.1], lowerLegL: [1.1, 0, 0], upperLegR: [-0.1, 0, 0.1], lowerLegR: [0.9, 0, 0] }),
  key(0.45, [-0.3, -0.7, 0], { L: [[0.2, 0.55, 0.8], [0, 0.95, 0.3]], R: GR }, { hipsY: 0.08, head: [0.2, 0.5, 0], upperLegL: [-0.2, 0, -0.1], lowerLegL: [0.15, 0, 0], upperLegR: [0.35, 0, 0.1], lowerLegR: [0.2, 0, 0] }),
  key(0.55, [-0.35, -0.75, 0], { L: [[0.2, 0.7, 0.7], [-0.05, 0.98, 0.2]], R: GR }, { hipsY: 0.1, head: [0.25, 0.5, 0], upperLegL: [-0.2, 0, -0.1], lowerLegL: [0.15, 0, 0], upperLegR: [0.35, 0, 0.1], lowerLegR: [0.2, 0, 0] }),
  key(0.8, [0, -0.4, 0], { L: [[0.3, -0.3, 0.9], [-0.1, 0.7, 0.7]], R: GR }, {}),
  [1, GUARD],
];

const KICK: [number, Pose][] = [
  [0, GUARD],
  key(0.3, [0.25, 0.3, 0], { L: [[0.45, -0.7, 0.5], [-0.2, 0.7, 0.6]], R: [[-0.6, -0.5, -0.6], [-0.5, 0.2, -0.8]] }, { hipsY: -0.08, head: [-0.1, -0.2, 0], upperLegL: [-0.15, 0, -0.12], lowerLegL: [0.35, 0, 0], upperLegR: [-1.5, 0, 0.25], lowerLegR: [2.0, 0, 0] }),
  key(0.45, [-0.55, -0.3, 0], { L: [[0.5, -0.6, 0.6], [-0.1, 0.5, 0.85]], R: [[-0.7, -0.3, -0.65], [-0.6, 0.3, -0.75]] }, { hipsY: 0.02, head: [0.3, 0.2, 0], upperLegL: [0.25, 0, -0.12], lowerLegL: [0.15, 0, 0], upperLegR: [-2.45, 0, 0.35], lowerLegR: [0.1, 0, 0] }),
  key(0.56, [-0.6, -0.35, 0], { L: [[0.5, -0.6, 0.6], [-0.1, 0.5, 0.85]], R: [[-0.7, -0.3, -0.65], [-0.6, 0.3, -0.75]] }, { hipsY: 0.03, head: [0.3, 0.2, 0], upperLegL: [0.25, 0, -0.12], lowerLegL: [0.15, 0, 0], upperLegR: [-2.6, 0, 0.35], lowerLegR: [0.05, 0, 0] }),
  key(0.8, [0.1, 0, 0], { L: GL, R: GR }, { hipsY: -0.06, upperLegR: [-1.0, 0, 0.2], lowerLegR: [1.6, 0, 0] }),
  [1, GUARD],
];

const SPIN: [number, Pose][] = [
  [0, GUARD],
  key(0.18, [0.5, 0.4, 0], { L: [[0.5, -0.8, -0.3], [0.3, -0.5, 0.8]], R: [[-0.5, -0.8, -0.3], [-0.3, -0.5, 0.8]] }, { hipsY: -0.22, head: [-0.25, -0.2, 0], upperLegL: [-0.7, 0, -0.1], lowerLegL: [1.2, 0, 0], upperLegR: [-0.3, 0, 0.1], lowerLegR: [1.1, 0, 0] }),
  key(0.32, [0, 0, 0], { L: [[0.5, 0.8, 0.3], [0.3, 0.95, 0.1]], R: [[-0.5, 0.8, 0.3], [-0.3, 0.95, 0.1]] }, { hipsY: 0.75, head: [0, 0, 0], upperLegL: [-1.3, 0, -0.1], lowerLegL: [1.8, 0, 0], upperLegR: [-0.9, 0, 0.2], lowerLegR: [1.7, 0, 0] }),
  key(0.5, [-0.35, 0, 0], { L: [[0.95, 0.2, 0.2], [0.95, 0.1, 0.3]], R: [[-0.95, 0.2, 0.2], [-0.95, 0.1, 0.3]] }, { hipsY: 0.85, head: [0.3, 0, 0], upperLegL: [-0.7, 0, -0.15], lowerLegL: [1.3, 0, 0], upperLegR: [-2.4, 0, 0.45], lowerLegR: [0.05, 0, 0] }),
  key(0.66, [0.1, 0, 0], { L: [[0.7, -0.4, 0.4], [0.5, 0.2, 0.8]], R: [[-0.7, -0.4, 0.4], [-0.5, 0.2, 0.8]] }, { hipsY: 0.35, upperLegL: [-0.8, 0, -0.1], lowerLegL: [1.2, 0, 0], upperLegR: [-1.0, 0, 0.2], lowerLegR: [1.2, 0, 0] }),
  key(0.82, [0.5, 0.2, 0], { L: [[0.5, -0.8, 0.2], [0.2, -0.3, 0.9]], R: [[-0.5, -0.8, 0.2], [-0.2, -0.3, 0.9]] }, { hipsY: -0.2, head: [-0.2, 0, 0], upperLegL: [-0.7, 0, -0.1], lowerLegL: [1.2, 0, 0], upperLegR: [-0.3, 0, 0.1], lowerLegR: [1.1, 0, 0] }),
  [1, GUARD],
];

/**
 * 5 段の格闘コンボ。p は 0..1 の進行度。
 * 各段は 予備動作（ゆっくり）→ 打撃（2〜3 コマで伸び切る）→ 行き過ぎて止まる → 戻り、の順。
 * 1 ジャブ、2 フック（ナイフ）、3 アッパー、4 ハイキック、5 ジャンプ回し蹴り
 */
export function poseAttack(step: 1 | 2 | 3 | 4 | 5, p: number): Pose {
  switch (step) {
    case 1: return poseSeq(JAB, p);
    case 2: return poseSeq(HOOK, p);
    case 3: return poseSeq(UPPER, p);
    case 4: return poseSeq(KICK, p);
    default: {
      const spin = clamp((p - 0.28) / 0.4, 0, 1);
      const seq = poseSeq(SPIN, p);
      seq.hipsYaw = spin >= 1 ? 0 : -smoothstep(spin) * Math.PI * 2;
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

// ---- 杉本ちさと: 鋭い型。刺突ジャブ → ナイフの斜め切り下ろし → 切り上げ → 前蹴り → 回転切り ----
const C_JAB: [number, Pose][] = [
  [0, GUARD],
  key(0.1, [0.05, -0.2, 0], { L: [[0.4, -0.7, 0.5], [-0.2, 0.6, 0.7]], R: GR }, { hipsY: -0.05 }),
  key(0.24, [0.15, -0.8, 0], { L: [[0.05, 0.05, 1], [0, 0.02, 1]], R: [[-0.3, -0.85, 0.4], [0.15, 0.7, 0.7]] }, { hipsY: -0.07, head: [0, 0.65, 0], upperLegL: [-0.5, 0, -0.1], lowerLegL: [0.5, 0, 0], upperLegR: [0.5, 0, 0.12], lowerLegR: [0.2, 0, 0] }),
  key(0.32, [0.15, -0.9, 0], { L: [[0.02, 0.05, 1], [0, 0.02, 1]], R: [[-0.3, -0.85, 0.4], [0.15, 0.7, 0.7]] }, { hipsY: -0.07, head: [0, 0.7, 0], upperLegL: [-0.5, 0, -0.1], lowerLegL: [0.5, 0, 0], upperLegR: [0.5, 0, 0.12], lowerLegR: [0.2, 0, 0] }),
  key(0.62, [0.1, -0.5, 0], { L: [[0.3, -0.5, 0.8], [-0.1, 0.6, 0.8]], R: GR }, { head: [0, 0.4, 0] }),
  [1, GUARD],
];

const C_DOWNSLASH: [number, Pose][] = [
  [0, GUARD],
  key(0.2, [0.05, 0.55, 0], { L: [[0.4, -0.7, 0.5], [-0.2, 0.6, 0.7]], R: [[-0.65, 0.65, -0.35], [-0.25, 0.95, 0.15]] }, { hipsY: -0.02, head: [-0.1, -0.4, 0] }),
  key(0.36, [0.35, -0.45, 0], { L: [[0.45, -0.6, 0.6], [-0.1, 0.5, 0.85]], R: [[0.35, -0.35, 0.85], [0.65, -0.65, 0.4]] }, { hipsY: -0.1, head: [0.1, 0.3, 0], upperLegL: [-0.5, 0, -0.1], lowerLegL: [0.6, 0, 0], upperLegR: [0.45, 0, 0.15], lowerLegR: [0.25, 0, 0] }),
  key(0.46, [0.4, -0.55, 0], { L: [[0.45, -0.6, 0.6], [-0.1, 0.5, 0.85]], R: [[0.45, -0.45, 0.75], [0.75, -0.6, 0.3]] }, { hipsY: -0.11, head: [0.1, 0.35, 0], upperLegL: [-0.5, 0, -0.1], lowerLegL: [0.6, 0, 0], upperLegR: [0.45, 0, 0.15], lowerLegR: [0.25, 0, 0] }),
  key(0.78, [0.15, -0.2, 0], { L: GL, R: [[-0.1, -0.7, 0.7], [0.3, 0.3, 0.9]] }, {}),
  [1, GUARD],
];

const C_UPSLASH: [number, Pose][] = [
  [0, GUARD],
  key(0.18, [0.3, -0.5, 0], { L: [[0.45, -0.6, 0.6], [-0.1, 0.5, 0.85]], R: [[0.2, -0.9, 0.35], [0.5, -0.55, 0.65]] }, { hipsY: -0.12, head: [0.05, 0.3, 0] }),
  key(0.34, [-0.2, 0.6, 0], { L: [[0.4, -0.7, 0.5], [-0.2, 0.6, 0.7]], R: [[-0.5, 0.45, 0.72], [-0.7, 0.7, 0.15]] }, { hipsY: -0.02, head: [0.15, -0.45, 0], upperLegL: [-0.35, 0, -0.1], lowerLegL: [0.45, 0, 0], upperLegR: [0.4, 0, 0.15], lowerLegR: [0.25, 0, 0] }),
  key(0.44, [-0.25, 0.7, 0], { L: [[0.4, -0.7, 0.5], [-0.2, 0.6, 0.7]], R: [[-0.55, 0.55, 0.62], [-0.72, 0.68, 0.1]] }, { hipsY: -0.02, head: [0.15, -0.5, 0], upperLegL: [-0.35, 0, -0.1], lowerLegL: [0.45, 0, 0], upperLegR: [0.4, 0, 0.15], lowerLegR: [0.25, 0, 0] }),
  key(0.78, [0.05, 0.1, 0], { L: GL, R: [[-0.35, -0.6, 0.6], [0.05, 0.55, 0.8]] }, {}),
  [1, GUARD],
];

const C_FRONTKICK: [number, Pose][] = [
  [0, GUARD],
  key(0.28, [0.2, -0.2, 0], { L: [[0.45, -0.7, 0.5], [-0.2, 0.6, 0.7]], R: [[-0.5, -0.6, 0.4], [-0.2, 0.4, 0.85]] }, { hipsY: -0.06, head: [-0.05, 0.2, 0], upperLegL: [-0.1, 0, -0.12], lowerLegL: [0.3, 0, 0], upperLegR: [-1.7, 0, 0.12], lowerLegR: [2.2, 0, 0] }),
  key(0.44, [-0.4, -0.15, 0], { L: [[0.5, -0.6, 0.6], [-0.1, 0.5, 0.85]], R: [[-0.6, -0.5, 0.5], [-0.3, 0.3, 0.9]] }, { hipsY: 0.0, head: [0.25, 0.1, 0], upperLegL: [0.2, 0, -0.12], lowerLegL: [0.15, 0, 0], upperLegR: [-1.75, 0, 0.12], lowerLegR: [0.05, 0, 0] }),
  key(0.54, [-0.45, -0.15, 0], { L: [[0.5, -0.6, 0.6], [-0.1, 0.5, 0.85]], R: [[-0.6, -0.5, 0.5], [-0.3, 0.3, 0.9]] }, { hipsY: 0.01, head: [0.25, 0.1, 0], upperLegL: [0.2, 0, -0.12], lowerLegL: [0.15, 0, 0], upperLegR: [-1.85, 0, 0.12], lowerLegR: [0.0, 0, 0] }),
  key(0.78, [0.1, -0.2, 0], { L: GL, R: GR }, { hipsY: -0.06, upperLegR: [-1.0, 0, 0.12], lowerLegR: [1.6, 0, 0] }),
  [1, GUARD],
];

const C_WHIRL: [number, Pose][] = [
  [0, GUARD],
  key(0.22, [0.45, -0.6, 0], { L: [[0.5, -0.7, 0.3], [0.1, -0.2, 0.95]], R: [[0.3, -0.85, 0.3], [0.7, -0.5, 0.5]] }, { hipsY: -0.2, head: [-0.2, 0.4, 0], upperLegL: [-0.7, 0, -0.1], lowerLegL: [1.2, 0, 0], upperLegR: [-0.2, 0, 0.1], lowerLegR: [1.0, 0, 0] }),
  key(0.4, [0.15, 0, 0], { L: [[0.5, -0.6, -0.5], [0.3, -0.3, -0.9]], R: [[-0.95, -0.05, -0.2], [-0.98, -0.05, 0.1]] }, { hipsY: -0.14, head: [0, 0, 0], upperLegL: [-0.5, 0, -0.15], lowerLegL: [0.9, 0, 0], upperLegR: [0.1, 0, 0.2], lowerLegR: [0.7, 0, 0] }),
  key(0.6, [0.15, 0, 0], { L: [[0.5, -0.6, -0.5], [0.3, -0.3, -0.9]], R: [[-0.95, -0.05, 0.2], [-0.98, -0.05, 0.15]] }, { hipsY: -0.12, head: [0, 0, 0], upperLegL: [-0.5, 0, -0.15], lowerLegL: [0.9, 0, 0], upperLegR: [0.1, 0, 0.2], lowerLegR: [0.7, 0, 0] }),
  key(0.8, [0.3, -0.3, 0], { L: [[0.4, -0.7, 0.5], [-0.2, 0.6, 0.7]], R: [[0.5, -0.4, 0.75], [0.85, -0.3, 0.4]] }, { hipsY: -0.15, head: [-0.1, 0.2, 0], upperLegL: [-0.6, 0, -0.1], lowerLegL: [1.0, 0, 0], upperLegR: [0.2, 0, 0.1], lowerLegR: [0.8, 0, 0] }),
  [1, GUARD],
];

export function poseAttackChisato(step: 1 | 2 | 3 | 4 | 5, p: number): Pose {
  switch (step) {
    case 1: return poseSeq(C_JAB, p);
    case 2: return poseSeq(C_DOWNSLASH, p);
    case 3: return poseSeq(C_UPSLASH, p);
    case 4: return poseSeq(C_FRONTKICK, p);
    default: {
      // 地上で腰を一回転させる回転切り（0.3〜0.7）
      const spin = clamp((p - 0.3) / 0.4, 0, 1);
      const seq = poseSeq(C_WHIRL, p);
      seq.hipsYaw = spin >= 1 ? 0 : -smoothstep(spin) * Math.PI * 2;
      return seq;
    }
  }
}
