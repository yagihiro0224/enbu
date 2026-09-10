import * as THREE from 'three';
import type { Rig } from './Rig';
import { createKnife } from './Weapons';
import { toonGradient } from './Toon';

/**
 * 骨の無い人型メッシュ（A ポーズ、正面 +Z）に、比率ベースで骨とウェイトを自動で付ける。
 * Hunyuan3D などの画像→3D 出力をそのままキャラとして動かすための簡易リグ。
 * 出来上がる骨は Rig の規約（T ポーズ基準、左腕 +X）に合わせる。
 */

type BoneName = 'hips' | 'spine' | 'head' | 'upperArmL' | 'lowerArmL' | 'upperArmR' | 'lowerArmR' | 'upperLegL' | 'lowerLegL' | 'upperLegR' | 'lowerLegR';
const ORDER: BoneName[] = ['hips', 'spine', 'head', 'upperArmL', 'lowerArmL', 'upperArmR', 'lowerArmR', 'upperLegL', 'lowerLegL', 'upperLegR', 'lowerLegR'];

interface Seg { a: THREE.Vector3; b: THREE.Vector3; radius: number; xMin?: number; yMax?: number; yMin?: number }

function distToSeg(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, tmp: THREE.Vector3): number {
  const ab = tmp.subVectors(b, a);
  const l2 = ab.lengthSq();
  let t = l2 > 0 ? (p.x - a.x) * ab.x / l2 + (p.y - a.y) * ab.y / l2 + (p.z - a.z) * ab.z / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + ab.x * t, cy = a.y + ab.y * t, cz = a.z + ab.z * t;
  return Math.hypot(p.x - cx, p.y - cy, p.z - cz);
}

export interface AutoRigOptions {
  height?: number;
  weapon?: boolean;
  toon?: boolean;
}

export function autoRig(src: THREE.Mesh, opt: AutoRigOptions = {}): Rig {
  const H = opt.height ?? 1.62;
  // ---- ジオメトリを正規化（足元原点、身長 H、中心 x/z=0）----
  src.updateWorldMatrix(true, false);
  const geo = src.geometry.clone().applyMatrix4(src.matrixWorld);
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const s = H / (bb.max.y - bb.min.y);
  geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  geo.scale(s, s, s);
  geo.computeVertexNormals();
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const n = pos.count;

  // ---- 計測: 腕の位置（A ポーズで体の外側にある頂点の重心）----
  const measure = (y0: number, y1: number, xMin: number, sign: number) => {
    let sx = 0, sy = 0, c = 0;
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      if (y < y0 * H || y > y1 * H) continue;
      if (x * sign < xMin * H) continue;
      sx += x; sy += y; c++;
    }
    return c > 20 ? { x: sx / c, y: sy / c, c } : null;
  };
  const armX = (sign: number) => {
    const elbow = measure(0.6, 0.7, 0.17, sign) ?? { x: sign * 0.22 * H, y: 0.65 * H };
    const wrist = measure(0.44, 0.54, 0.17, sign) ?? { x: sign * 0.245 * H, y: 0.49 * H };
    return { elbow, wrist };
  };
  const L = armX(1), R = armX(-1);
  const shoulderX = 0.155 * H;
  const shoulderY = 0.80 * H;
  const v = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);

  // ---- 骨の区間（ウェイト計算用。座標は正規化後のワールド）----
  const segs: Record<BoneName, Seg> = {
    hips: { a: v(0, 0.40 * H), b: v(0, 0.62 * H), radius: 0.16 * H },
    spine: { a: v(0, 0.62 * H), b: v(0, 0.86 * H), radius: 0.16 * H },
    head: { a: v(0, 0.86 * H), b: v(0, 1.02 * H), radius: 0.14 * H },
    upperArmL: { a: v(shoulderX, shoulderY), b: v(L.elbow.x, L.elbow.y), radius: 0.07 * H, xMin: shoulderX * 0.85 },
    lowerArmL: { a: v(L.elbow.x, L.elbow.y), b: v(L.wrist.x, L.wrist.y - 0.08 * H), radius: 0.06 * H, xMin: shoulderX * 0.85 },
    upperArmR: { a: v(-shoulderX, shoulderY), b: v(R.elbow.x, R.elbow.y), radius: 0.07 * H, xMin: shoulderX * 0.85 },
    lowerArmR: { a: v(R.elbow.x, R.elbow.y), b: v(R.wrist.x, R.wrist.y - 0.08 * H), radius: 0.06 * H, xMin: shoulderX * 0.85 },
    upperLegL: { a: v(0.085 * H, 0.50 * H), b: v(0.09 * H, 0.27 * H), radius: 0.09 * H, yMax: 0.56 * H },
    lowerLegL: { a: v(0.09 * H, 0.27 * H), b: v(0.09 * H, 0.0, 0.03 * H), radius: 0.08 * H, yMax: 0.56 * H },
    upperLegR: { a: v(-0.085 * H, 0.50 * H), b: v(-0.09 * H, 0.27 * H), radius: 0.09 * H, yMax: 0.56 * H },
    lowerLegR: { a: v(-0.09 * H, 0.27 * H), b: v(-0.09 * H, 0.0, 0.03 * H), radius: 0.08 * H, yMax: 0.56 * H },
  };

  // ---- ウェイト: 近い 2 本の骨に距離の逆数で配分 ----
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  const p = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    let b1 = 0, d1 = Infinity, b2 = 0, d2 = Infinity;
    for (let k = 0; k < ORDER.length; k++) {
      const sg = segs[ORDER[k]];
      if (sg.xMin !== undefined && Math.abs(p.x) < sg.xMin) continue;
      if (sg.yMax !== undefined && p.y > sg.yMax) continue;
      const d = distToSeg(p, sg.a, sg.b, tmp) / sg.radius;
      if (d < d1) { b2 = b1; d2 = d1; b1 = k; d1 = d; }
      else if (d < d2) { b2 = k; d2 = d; }
    }
    let w1 = 1, w2 = 0;
    if (d2 < d1 * 2.2 && Number.isFinite(d2)) {
      const e1 = 1 / Math.pow(d1 + 0.05, 3), e2 = 1 / Math.pow(d2 + 0.05, 3);
      w1 = e1 / (e1 + e2); w2 = 1 - w1;
    }
    skinIndex[i * 4] = b1; skinIndex[i * 4 + 1] = b2;
    skinWeight[i * 4] = w1; skinWeight[i * 4 + 1] = w2;
  }
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));

  // ---- 骨の階層（バインド時は A ポーズ。回転 0 が T ポーズになるよう、腕は A ポーズの角度を持たせる）----
  const mk = (name: string) => { const b = new THREE.Bone(); b.name = name; return b; };
  const hips = mk('hips'), spine = mk('spine'), head = mk('head');
  const upperArmL = mk('upperArmL'), lowerArmL = mk('lowerArmL'), upperArmR = mk('upperArmR'), lowerArmR = mk('lowerArmR');
  const upperLegL = mk('upperLegL'), lowerLegL = mk('lowerLegL'), upperLegR = mk('upperLegR'), lowerLegR = mk('lowerLegR');
  const handR = mk('handR');
  const hipsHeight = 0.52 * H;
  hips.position.set(0, hipsHeight, 0);
  spine.position.set(0, 0.62 * H - hipsHeight, 0);
  head.position.set(0, 0.86 * H - 0.62 * H, 0);
  hips.add(spine); spine.add(head);

  const buildArm = (sign: number, upper: THREE.Bone, lower: THREE.Bone, m: { elbow: { x: number; y: number }; wrist: { x: number; y: number } }) => {
    upper.position.set(sign * shoulderX, shoulderY - 0.62 * H, 0);
    const ux = m.elbow.x - sign * shoulderX, uy = m.elbow.y - shoulderY;
    const uLen = Math.hypot(ux, uy);
    // 腕の軸は左 +X／右 -X。実際の向きとの角度を Z 回転で持つ
    const uAng = Math.atan2(uy, ux * sign) * (sign > 0 ? 1 : -1);
    upper.rotation.z = uAng;
    lower.position.set(sign * uLen, 0, 0);
    const lx = m.wrist.x - m.elbow.x, ly = m.wrist.y - m.elbow.y;
    const lLen = Math.hypot(lx, ly);
    const lAng = Math.atan2(ly, lx * sign) * (sign > 0 ? 1 : -1);
    lower.rotation.z = lAng - uAng;
    spine.add(upper); upper.add(lower);
    return lLen;
  };
  buildArm(1, upperArmL, lowerArmL, L);
  const lLenR = buildArm(-1, upperArmR, lowerArmR, R);
  handR.position.set(-lLenR, 0, 0);
  lowerArmR.add(handR);

  const buildLeg = (sign: number, upper: THREE.Bone, lower: THREE.Bone) => {
    upper.position.set(sign * 0.085 * H, 0.50 * H - hipsHeight, 0);
    lower.position.set(0, -(0.50 - 0.27) * H, 0);
    hips.add(upper); upper.add(lower);
  };
  buildLeg(1, upperLegL, lowerLegL);
  buildLeg(-1, upperLegR, lowerLegR);

  const bones: THREE.Bone[] = [hips, spine, head, upperArmL, lowerArmL, upperArmR, lowerArmR, upperLegL, lowerLegL, upperLegR, lowerLegR];

  // ---- マテリアル: GLB のテクスチャを保ちつつトゥーンに ----
  const srcMat = (Array.isArray(src.material) ? src.material[0] : src.material) as THREE.MeshStandardMaterial;
  const map = srcMat.map ?? null;
  const mat = opt.toon === false
    ? new THREE.MeshStandardMaterial({ map, roughness: 0.9, emissive: 0x000000 })
    : new THREE.MeshToonMaterial({ map, gradientMap: toonGradient(), emissive: 0x000000 });
  const skinned = new THREE.SkinnedMesh(geo, mat);
  skinned.frustumCulled = false;
  const root = new THREE.Group();
  root.add(skinned);
  skinned.add(hips);
  root.updateMatrixWorld(true);
  skinned.bind(new THREE.Skeleton(bones));

  let weapon = null as ReturnType<typeof createKnife> | null;
  if (opt.weapon) {
    weapon = createKnife();
    handR.add(weapon.group);
  }

  return {
    root, hips, spine, head,
    upperArmL, lowerArmL, upperArmR, lowerArmR,
    upperLegL, lowerLegL, upperLegR, lowerLegR,
    handR, weapon, hairBones: [],
    hipsHeight, height: H,
    setFlash(v) { mat.emissive.setRGB(v, v * 0.9, v * 0.85); },
    setWeaponGlow(v) { weapon?.setGlow(v); },
    update() {},
    dispose() { geo.dispose(); mat.dispose(); },
  };
}
