import * as THREE from 'three';
import { toonMat, addOutline } from './Toon';
import { eyeTexture, mouthTexture } from './Face';
import { createKatana, createStaff, type Weapon } from './Weapons';
import type { Rig } from './Rig';

export interface FigureOptions {
  hair: THREE.ColorRepresentation;
  hairTip?: THREE.ColorRepresentation;
  eye: THREE.ColorRepresentation;
  skin?: THREE.ColorRepresentation;
  top: THREE.ColorRepresentation;
  sleeve?: THREE.ColorRepresentation;
  skirt: THREE.ColorRepresentation;
  accent: THREE.ColorRepresentation;
  socks?: THREE.ColorRepresentation;
  hairStyle: 'ponytail' | 'long';
  horns?: boolean;
  weapon: 'katana' | 'staff' | 'none';
}

const OL = 0.011;

function capsuleY(r: number, len: number, mat: THREE.Material, yCenter: number, outline = true): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 12), mat);
  m.position.y = yCenter;
  if (outline) addOutline(m, OL);
  return m;
}
/** X 軸方向に伸びるカプセル（腕用）。sign: +1 で +X、-1 で -X 方向へ伸びる */
function capsuleX(r: number, len: number, mat: THREE.Material, sign: number): THREE.Mesh {
  const g = new THREE.CapsuleGeometry(r, len, 4, 12);
  g.rotateZ(Math.PI / 2);
  g.translate((sign * len) / 2, 0, 0);
  const m = new THREE.Mesh(g, mat);
  addOutline(m, OL);
  return m;
}
function lathe(pts: [number, number][], mat: THREE.Material, seg = 20, zScale = 1): THREE.Mesh {
  const g = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
  if (zScale !== 1) g.scale(1, 1, zScale);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  addOutline(m, OL);
  return m;
}
/** 先細りの髪の房（上が根元） */
function strand(pts: [number, number][], mat: THREE.Material, zScale = 1): THREE.Mesh {
  return lathe(pts, mat, 10, zScale);
}

/**
 * 7 頭身のアニメ調フィギュア体型。全身プリミティブ + ろくろ形状。
 * T ポーズ基準、+Z 正面、左腕 +X。
 */
export function createFigure(opt: FigureOptions): Rig {
  const skin = toonMat(opt.skin ?? 0xffe6d6);
  const hair = toonMat(opt.hair);
  const hairTip = toonMat(opt.hairTip ?? opt.hair);
  const top = toonMat(opt.top);
  const sleeve = toonMat(opt.sleeve ?? opt.top, { side: THREE.DoubleSide });
  const skirt = toonMat(opt.skirt, { side: THREE.DoubleSide });
  const accent = toonMat(opt.accent, { emissive: opt.accent, emissiveIntensity: 0.12 });
  const socks = toonMat(opt.socks ?? 0xffffff);
  const dark = toonMat(0x241018);
  const brow = toonMat(new THREE.Color(opt.hair).lerp(new THREE.Color(0x000000), 0.3));
  const pink = toonMat(0xffa0b0, { transparent: true, opacity: 0.75 });
  const flashables: THREE.MeshToonMaterial[] = [skin, hair, hairTip, top, sleeve, skirt, accent, socks, dark, brow];

  const root = new THREE.Group();
  const hipsHeight = 0.86;
  const hips = new THREE.Group();
  hips.position.y = hipsHeight;
  root.add(hips);

  // ---- 脚 ----
  const mkLeg = (x: number) => {
    const upper = new THREE.Group();
    upper.position.set(x, 0, 0);
    upper.add(capsuleY(0.066, 0.3, skin, -0.2));
    // ニーソックスの上端
    const sockTop = capsuleY(0.069, 0.1, socks, -0.35);
    upper.add(sockTop);
    const lower = new THREE.Group();
    lower.position.y = -0.42;
    lower.add(capsuleY(0.056, 0.26, socks, -0.17));
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.075, 0.21), dark);
    boot.position.set(0, -0.395, 0.035);
    addOutline(boot, OL);
    lower.add(boot);
    const bootTop = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.1, 12), dark);
    bootTop.position.y = -0.33;
    addOutline(bootTop, OL);
    lower.add(bootTop);
    upper.add(lower);
    hips.add(upper);
    return { upper, lower };
  };
  const legL = mkLeg(0.09);
  const legR = mkLeg(-0.09);

  // ---- 胴 ----
  const spine = new THREE.Group();
  spine.position.y = 0.06;
  hips.add(spine);
  spine.add(lathe([[0.15, -0.02], [0.125, 0.1], [0.115, 0.17], [0.14, 0.28], [0.155, 0.4], [0.15, 0.46], [0.06, 0.5]], top, 20, 0.72));
  // 襟
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 8, 20), accent);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.48;
  collar.scale.set(1, 0.8, 1);
  addOutline(collar, 0.006);
  spine.add(collar);
  // 前立て（合わせ）
  const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.34, 0.01), accent);
  lapel.position.set(0, 0.3, 0.113);
  lapel.rotation.z = 0.35;
  spine.add(lapel);
  // 帯
  const obi = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.135, 0.11, 20), accent);
  obi.position.y = 0.11;
  obi.scale.z = 0.78;
  addOutline(obi, OL);
  spine.add(obi);
  const obiKnot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.05), accent);
  obiKnot.position.set(0, 0.12, -0.11);
  addOutline(obiKnot, OL);
  spine.add(obiKnot);
  for (const s of [1, -1]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.3, 0.012), accent);
    tail.position.set(s * 0.05, -0.05, -0.12);
    tail.rotation.z = s * 0.15;
    addOutline(tail, 0.006);
    spine.add(tail);
  }
  // スカート（腰から太もも中ほど）
  spine.add(lathe([[0.14, 0.08], [0.2, -0.06], [0.27, -0.22], [0.31, -0.34]], skirt, 24, 0.85));
  // 首
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.09, 10), skin);
  neck.position.y = 0.53;
  spine.add(neck);

  // ---- 腕 ----
  const mkArm = (sign: number) => {
    const upper = new THREE.Group();
    upper.position.set(sign * 0.16, 0.44, 0);
    upper.add(capsuleX(0.045, 0.2, top, sign));
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), top);
    addOutline(shoulder, OL);
    upper.add(shoulder);
    const lower = new THREE.Group();
    lower.position.x = sign * 0.26;
    lower.add(capsuleX(0.037, 0.2, skin, sign));
    // 広い袖
    const sg = new THREE.ConeGeometry(0.105, 0.26, 12, 1, true);
    sg.rotateZ(sign * Math.PI / 2);
    sg.translate(sign * 0.1, 0, 0);
    const sl = new THREE.Mesh(sg, sleeve);
    addOutline(sl, OL);
    lower.add(sl);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 16), accent);
    cuff.rotation.y = Math.PI / 2;
    cuff.position.x = sign * 0.225;
    lower.add(cuff);
    const hand = new THREE.Group();
    hand.position.x = sign * 0.25;
    const hm = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), skin);
    hm.scale.set(1.25, 0.75, 1);
    addOutline(hm, OL);
    hand.add(hm);
    lower.add(hand);
    upper.add(lower);
    spine.add(upper);
    return { upper, lower, hand };
  };
  const armL = mkArm(1);
  const armR = mkArm(-1);

  // ---- 頭 ----
  const head = new THREE.Group();
  head.position.y = 0.56;
  spine.add(head);
  const hc = 0.12;
  const R = 0.115;
  const face = new THREE.Mesh(new THREE.SphereGeometry(R, 28, 20), skin);
  face.scale.set(1, 1.08, 0.98);
  face.position.y = hc;
  addOutline(face, OL);
  head.add(face);
  // 顎を少し細く
  const chin = new THREE.Mesh(new THREE.SphereGeometry(R * 0.8, 20, 14), skin);
  chin.scale.set(0.95, 0.9, 0.9);
  chin.position.set(0, hc - 0.045, 0.012);
  addOutline(chin, OL);
  head.add(chin);

  // 目（テクスチャ平面）
  const eyeTex = eyeTexture(opt.eye);
  const eyeMat = new THREE.MeshBasicMaterial({ map: eyeTex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  for (const s of [1, -1]) {
    const e = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.06), eyeMat);
    e.position.set(s * 0.047, hc + 0.004, 0.106);
    e.rotation.y = s * 0.38;
    e.scale.x = s;
    e.renderOrder = 2;
    head.add(e);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.007, 0.004), brow);
    b.position.set(s * 0.047, hc + 0.052, 0.101);
    b.rotation.y = s * 0.38;
    b.rotation.z = -s * 0.12;
    head.add(b);
    const blush = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), pink);
    blush.scale.set(1, 0.5, 0.3);
    blush.position.set(s * 0.075, hc - 0.03, 0.088);
    head.add(blush);
  }
  const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.036, 0.018), new THREE.MeshBasicMaterial({ map: mouthTexture(), transparent: true, depthWrite: false }));
  mouth.position.set(0, hc - 0.052, 0.112);
  mouth.renderOrder = 2;
  head.add(mouth);

  // 髪。頭頂は全周、それより下は顔（+Z 側）を開けて後ろと横だけ覆う
  const capTop = new THREE.Mesh(new THREE.SphereGeometry(R + 0.016, 28, 10, 0, Math.PI * 2, 0, Math.PI * 0.3), hair);
  capTop.scale.set(1, 1.1, 1.02);
  capTop.position.y = hc + 0.008;
  addOutline(capTop, OL);
  head.add(capTop);
  // phi は -X から始まり π/2 で +Z（正面）。正面 100° ぶんを空ける
  const open = Math.PI * 0.56;
  const capBack = new THREE.Mesh(new THREE.SphereGeometry(R + 0.016, 28, 12, Math.PI / 2 + open / 2, Math.PI * 2 - open, Math.PI * 0.28, Math.PI * 0.36), hair);
  capBack.scale.set(1, 1.1, 1.02);
  capBack.position.y = hc + 0.008;
  addOutline(capBack, OL);
  head.add(capBack);
  // 前髪（額に沿って並ぶ房）
  const bangs = 7;
  for (let i = 0; i < bangs; i++) {
    const t = i / (bangs - 1) - 0.5;
    const a = t * 1.5;
    // 眉の少し下で止まる長さ。端の房ほど長く
    const len = 0.075 + (i % 2) * 0.02 + Math.abs(t) * 0.07;
    const g = new THREE.ConeGeometry(0.027, len, 6);
    // 先端を下に向け、根元が生え際に埋まるように
    g.rotateX(Math.PI);
    g.translate(0, -len / 2 + 0.025, 0);
    g.scale(1, 1, 0.5);
    const m = new THREE.Mesh(g, i % 3 === 1 ? hairTip : hair);
    m.rotation.order = 'YXZ';
    m.rotation.y = a;
    m.rotation.x = -0.25;
    m.rotation.z = t * 0.5;
    m.position.set(Math.sin(a) * (R - 0.002), hc + 0.095, Math.cos(a) * (R - 0.002));
    addOutline(m, OL * 0.7);
    head.add(m);
  }
  // 横髪
  for (const s of [1, -1]) {
    const sm = strand([[0.028, 0], [0.034, -0.12], [0.02, -0.3], [0, -0.38]], hair, 0.8);
    sm.position.set(s * 0.115, hc + 0.05, 0.035);
    sm.rotation.z = s * 0.1;
    head.add(sm);
  }
  const hairBones: THREE.Object3D[] = [];
  if (opt.hairStyle === 'ponytail') {
    const pivot = new THREE.Group();
    pivot.position.set(0, hc + 0.08, -0.1);
    const pt = strand([[0.05, 0], [0.075, -0.16], [0.06, -0.42], [0.03, -0.62], [0.0, -0.72]], hair);
    pivot.add(pt);
    const tip = strand([[0.035, -0.55], [0.028, -0.68], [0, -0.8]], hairTip);
    pivot.add(tip);
    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.05, 0.03), accent);
    ribbon.position.z = 0.01;
    addOutline(ribbon, OL);
    pivot.add(ribbon);
    const scrunch = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), hair);
    pivot.add(scrunch);
    pivot.rotation.x = 0.3;
    head.add(pivot);
    hairBones.push(pivot);
  } else {
    for (const s of [1, -1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.065, hc + 0.03, -0.07);
      const back = strand([[0.065, 0.02], [0.09, -0.2], [0.085, -0.5], [0.045, -0.75], [0, -0.86]], hair, 0.7);
      pivot.add(back);
      const tip = strand([[0.045, -0.6], [0.035, -0.74], [0, -0.9]], hairTip, 0.7);
      pivot.add(tip);
      pivot.rotation.z = s * 0.05;
      head.add(pivot);
      hairBones.push(pivot);
    }
  }
  if (opt.horns) {
    for (const s of [1, -1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.16, 8), accent);
      horn.position.set(s * 0.065, hc + 0.16, 0.01);
      horn.rotation.z = -s * 0.5;
      addOutline(horn, 0.006);
      head.add(horn);
    }
  }

  // ---- 武器 ----
  let weapon: Weapon | null = null;
  if (opt.weapon === 'katana') weapon = createKatana(accent, dark);
  else if (opt.weapon === 'staff') weapon = createStaff(accent, dark);
  if (weapon) armR.hand.add(weapon.group);

  const rig: Rig = {
    root, hips, spine, head,
    upperArmL: armL.upper, lowerArmL: armL.lower,
    upperArmR: armR.upper, lowerArmR: armR.lower,
    upperLegL: legL.upper, lowerLegL: legL.lower,
    upperLegR: legR.upper, lowerLegR: legR.lower,
    handR: armR.hand,
    weapon,
    hairBones,
    hipsHeight,
    height: 1.72,
    setFlash(v: number) {
      for (const m of flashables) {
        m.emissive.setRGB(v, v * 0.9, v * 0.85);
        m.emissiveIntensity = 1;
      }
      if (v <= 0.001) {
        accent.emissive.set(opt.accent);
        accent.emissiveIntensity = 0.12;
      }
    },
    setWeaponGlow(v: number) {
      weapon?.setGlow(v);
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
