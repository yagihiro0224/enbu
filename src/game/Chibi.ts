import * as THREE from 'three';
import { toonMat, addOutline } from './Toon';
import type { Rig } from './Rig';

export interface ChibiOptions {
  hair: THREE.ColorRepresentation;
  hairAccent?: THREE.ColorRepresentation;
  eye: THREE.ColorRepresentation;
  skin?: THREE.ColorRepresentation;
  top: THREE.ColorRepresentation;
  skirt: THREE.ColorRepresentation;
  accent: THREE.ColorRepresentation;
  hairStyle: 'twin' | 'long';
  horns?: boolean;
  weapon: 'katana' | 'staff' | 'none';
}

const OUTLINE = 0.018;

function capsuleY(r: number, len: number, mat: THREE.Material, yCenter: number, outline = true): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 12), mat);
  m.position.y = yCenter;
  if (outline) addOutline(m, OUTLINE);
  return m;
}
/** X 軸方向に伸びるカプセル（腕用）。sign: +1 で +X 方向、-1 で -X 方向へ伸びる */
function capsuleX(r: number, len: number, mat: THREE.Material, sign: number, outline = true): THREE.Mesh {
  const g = new THREE.CapsuleGeometry(r, len, 4, 12);
  g.rotateZ(Math.PI / 2);
  g.translate((sign * len) / 2, 0, 0);
  const m = new THREE.Mesh(g, mat);
  if (outline) addOutline(m, OUTLINE);
  return m;
}
function sphere(r: number, mat: THREE.Material, outline = true, seg = 20): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg / 2)), mat);
  if (outline) addOutline(m, OUTLINE);
  return m;
}

/** 刀。右手（-X 方向に伸びる腕）に持たせる前提で刃は -X 方向 */
export function createKatana(accent?: THREE.Material, dark?: THREE.Material, scale = 1): { group: THREE.Group; glowMat: THREE.MeshToonMaterial } {
  const accentMat = accent ?? toonMat(0xffb347, { emissive: 0xffb347, emissiveIntensity: 0.15 });
  const darkMat = dark ?? toonMat(0x2a1420);
  const w = new THREE.Group();
  const bladeMat = toonMat(0xf4f0ff, { emissive: 0xff5a2a, emissiveIntensity: 0 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.045, 0.012), bladeMat);
  blade.position.x = -0.55;
  addOutline(blade, 0.012);
  w.add(blade);
  const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 10), accentMat);
  guard.rotation.z = Math.PI / 2;
  guard.position.x = -0.12;
  addOutline(guard, 0.01);
  w.add(guard);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.24, 8), darkMat);
  grip.rotation.z = Math.PI / 2;
  w.add(grip);
  w.rotation.z = 0.15;
  w.scale.setScalar(scale);
  return { group: w, glowMat: bladeMat };
}

/** プリミティブで組む、今風ローポリのちびキャラ */
export function createChibi(opt: ChibiOptions): Rig {
  const skin = toonMat(opt.skin ?? 0xffe3d0);
  const hair = toonMat(opt.hair);
  const hairAccent = toonMat(opt.hairAccent ?? opt.hair);
  const top = toonMat(opt.top);
  const skirt = toonMat(opt.skirt, { side: THREE.DoubleSide });
  const accent = toonMat(opt.accent, { emissive: opt.accent, emissiveIntensity: 0.15 });
  const white = toonMat(0xffffff);
  const eye = toonMat(opt.eye, { emissive: opt.eye, emissiveIntensity: 0.25 });
  const dark = toonMat(0x2a1420);
  const pink = toonMat(0xffa0b0, { transparent: true, opacity: 0.8 });
  const flashables: THREE.MeshToonMaterial[] = [skin, hair, hairAccent, top, skirt, accent, white, eye, dark];

  const root = new THREE.Group();
  const hipsHeight = 0.62;

  // 骨盤
  const hips = new THREE.Group();
  hips.position.y = hipsHeight;
  root.add(hips);

  // 脚
  const mkLeg = (x: number) => {
    const upper = new THREE.Group();
    upper.position.set(x, 0, 0);
    upper.add(capsuleY(0.075, 0.16, skin, -0.15));
    const lower = new THREE.Group();
    lower.position.y = -0.3;
    lower.add(capsuleY(0.07, 0.16, skin, -0.15));
    // 靴
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.09, 0.22), dark);
    shoe.position.set(0, -0.3, 0.04);
    addOutline(shoe, OUTLINE);
    lower.add(shoe);
    upper.add(lower);
    hips.add(upper);
    return { upper, lower };
  };
  const legL = mkLeg(0.12);
  const legR = mkLeg(-0.12);

  // 胴
  const spine = new THREE.Group();
  spine.position.y = 0.05;
  hips.add(spine);
  spine.add(capsuleY(0.16, 0.22, top, 0.22));
  // スカート
  const sk = new THREE.Mesh(new THREE.ConeGeometry(0.31, 0.3, 18, 1, true), skirt);
  sk.position.y = 0.0;
  addOutline(sk, OUTLINE);
  spine.add(sk);
  // 胸元のリボン
  const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.05), accent);
  ribbon.position.set(0, 0.3, 0.16);
  addOutline(ribbon, OUTLINE);
  spine.add(ribbon);
  // 帯
  const obi = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.08, 18), accent);
  obi.position.y = 0.1;
  addOutline(obi, OUTLINE);
  spine.add(obi);

  // 腕（T ポーズ基準）
  const mkArm = (sign: number) => {
    const upper = new THREE.Group();
    upper.position.set(sign * 0.18, 0.36, 0);
    // 袖
    upper.add(capsuleX(0.075, 0.16, top, sign));
    const lower = new THREE.Group();
    lower.position.x = sign * 0.22;
    lower.add(capsuleX(0.06, 0.14, skin, sign));
    const hand = new THREE.Group();
    hand.position.x = sign * 0.21;
    hand.add(sphere(0.065, skin, true, 12));
    lower.add(hand);
    upper.add(lower);
    spine.add(upper);
    return { upper, lower, hand };
  };
  const armL = mkArm(1);
  const armR = mkArm(-1);

  // 頭
  const head = new THREE.Group();
  head.position.y = 0.5;
  spine.add(head);
  const headR = 0.32;
  const face = sphere(headR, skin, true, 28);
  face.position.y = 0.22;
  head.add(face);
  const hc = 0.22; // 頭の中心 y

  // 目
  for (const s of [1, -1]) {
    const eyeWhite = sphere(0.06, white, false, 12);
    eyeWhite.scale.set(1, 1.45, 0.35);
    eyeWhite.position.set(s * 0.12, hc + 0.02, 0.275);
    head.add(eyeWhite);
    const pupil = sphere(0.043, eye, false, 12);
    pupil.scale.set(1, 1.4, 0.35);
    pupil.position.set(s * 0.12, hc + 0.01, 0.298);
    head.add(pupil);
    const hi = sphere(0.016, white, false, 8);
    hi.position.set(s * 0.1, hc + 0.045, 0.325);
    head.add(hi);
    const blush = sphere(0.045, pink, false, 10);
    blush.scale.set(1, 0.55, 0.3);
    blush.position.set(s * 0.2, hc - 0.07, 0.235);
    head.add(blush);
  }
  const mouth = sphere(0.02, dark, false, 8);
  mouth.scale.set(1.4, 0.6, 0.5);
  mouth.position.set(0, hc - 0.1, 0.305);
  head.add(mouth);

  // 髪（頭頂のキャップ）
  const cap = new THREE.Mesh(new THREE.SphereGeometry(headR + 0.03, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.58), hair);
  cap.position.y = hc + 0.01;
  addOutline(cap, OUTLINE);
  head.add(cap);
  // 前髪
  const bangCount = 5;
  for (let i = 0; i < bangCount; i++) {
    const t = i / (bangCount - 1) - 0.5;
    const bang = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.24, 7), i % 2 === 0 ? hair : hairAccent);
    bang.rotation.x = Math.PI + 0.25;
    bang.rotation.z = -t * 0.5;
    bang.position.set(t * 0.42, hc + 0.13, 0.27 - Math.abs(t) * 0.07);
    addOutline(bang, OUTLINE);
    head.add(bang);
  }
  // 横髪
  for (const s of [1, -1]) {
    const side = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.34, 7), hair);
    side.rotation.x = Math.PI;
    side.rotation.z = s * 0.12;
    side.position.set(s * 0.3, hc - 0.03, 0.1);
    addOutline(side, OUTLINE);
    head.add(side);
  }
  const hairBones: THREE.Object3D[] = [];
  if (opt.hairStyle === 'twin') {
    for (const s of [1, -1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.3, hc + 0.12, -0.08);
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.42, 4, 10), hair);
      tail.position.y = -0.3;
      addOutline(tail, OUTLINE);
      pivot.add(tail);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.24, 8), hairAccent);
      tip.rotation.x = Math.PI;
      tip.position.y = -0.62;
      addOutline(tip, OUTLINE);
      pivot.add(tip);
      const tie = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), accent);
      pivot.add(tie);
      pivot.rotation.z = s * 0.35;
      head.add(pivot);
      hairBones.push(pivot);
    }
  } else {
    const pivot = new THREE.Group();
    pivot.position.set(0, hc + 0.08, -0.2);
    const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.55, 4, 14), hair);
    back.position.y = -0.36;
    back.scale.set(1, 1, 0.6);
    addOutline(back, OUTLINE);
    pivot.add(back);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 10), hairAccent);
    tip.rotation.x = Math.PI;
    tip.position.y = -0.8;
    tip.scale.set(1, 1, 0.6);
    addOutline(tip, OUTLINE);
    pivot.add(tip);
    head.add(pivot);
    hairBones.push(pivot);
  }
  if (opt.horns) {
    for (const s of [1, -1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 8), accent);
      horn.position.set(s * 0.17, hc + 0.36, 0.02);
      horn.rotation.z = -s * 0.45;
      addOutline(horn, OUTLINE);
      head.add(horn);
    }
  }

  // 武器
  let glowMat: THREE.MeshToonMaterial | null = null;
  if (opt.weapon === 'katana') {
    const k = createKatana(accent, dark);
    glowMat = k.glowMat;
    armR.hand.add(k.group);
  } else if (opt.weapon === 'staff') {
    const w = new THREE.Group();
    const orbMat = toonMat(0xd070ff, { emissive: 0xa040ff, emissiveIntensity: 0.6 });
    glowMat = orbMat;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.3, 8), dark);
    pole.rotation.z = Math.PI / 2;
    pole.position.x = -0.3;
    addOutline(pole, 0.01);
    w.add(pole);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), orbMat);
    orb.position.x = -0.98;
    w.add(orb);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 8, 20), accent);
    ring.position.x = -0.98;
    ring.rotation.y = Math.PI / 2;
    w.add(ring);
    armR.hand.add(w);
  }

  const rig: Rig = {
    root,
    hips,
    spine,
    head,
    upperArmL: armL.upper,
    lowerArmL: armL.lower,
    upperArmR: armR.upper,
    lowerArmR: armR.lower,
    upperLegL: legL.upper,
    lowerLegL: legL.lower,
    upperLegR: legR.upper,
    lowerLegR: legR.lower,
    handR: armR.hand,
    hairBones,
    hipsHeight,
    height: 1.55,
    setFlash(v: number) {
      for (const m of flashables) {
        m.emissive.setRGB(v, v * 0.9, v * 0.85);
        m.emissiveIntensity = 1;
      }
      // 目とアクセントは元の発光を保つ
      if (v <= 0.001) {
        eye.emissive.set(opt.eye);
        eye.emissiveIntensity = 0.25;
        accent.emissive.set(opt.accent);
        accent.emissiveIntensity = 0.15;
      }
    },
    setWeaponGlow(v: number) {
      if (glowMat) glowMat.emissiveIntensity = opt.weapon === 'staff' ? 0.6 + v * 1.5 : v * 1.6;
    },
    update() {},
    dispose() {
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const m = o.material as THREE.Material | THREE.Material[];
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m.dispose();
        }
      });
    },
  };
  return rig;
}
