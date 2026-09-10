import * as THREE from 'three';
import { toonMat, addOutline } from './Toon';

export interface Weapon {
  group: THREE.Group;
  /** 発光 0..1 */
  setGlow(v: number): void;
  /** 刀身の根元と先端（group ローカル座標）。軌跡エフェクト用 */
  base: THREE.Vector3;
  tip: THREE.Vector3;
}

/** 刀。右手（-X 方向に伸びる腕）に持たせる前提で刃は -X 方向 */
export function createKatana(accent?: THREE.Material, dark?: THREE.Material): Weapon {
  const accentMat = accent ?? toonMat(0xffb347, { emissive: 0xffb347, emissiveIntensity: 0.15 });
  const darkMat = dark ?? toonMat(0x2a1420);
  const w = new THREE.Group();
  const bladeMat = toonMat(0xf4f0ff, { emissive: 0xff5a2a, emissiveIntensity: 0 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.042, 0.009), bladeMat);
  blade.position.x = -0.58;
  addOutline(blade, 0.01);
  w.add(blade);
  // 刃先の発光ライン（攻撃時に赤く燃える）
  const edgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.9, 0.3), toneMapped: false, transparent: true, opacity: 0, depthWrite: false });
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.012, 0.014), edgeMat);
  edge.position.set(-0.58, 0.018, 0);
  w.add(edge);
  const edge2 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.02), edgeMat);
  edge2.position.set(-0.58, 0, 0);
  w.add(edge2);
  // 鍔
  const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.016, 12), accentMat);
  guard.rotation.z = Math.PI / 2;
  guard.position.x = -0.12;
  addOutline(guard, 0.008);
  w.add(guard);
  // 柄
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.26, 8), darkMat);
  grip.rotation.z = Math.PI / 2;
  w.add(grip);
  for (let i = 0; i < 4; i++) {
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.006, 6, 12), accentMat);
    wrap.rotation.y = Math.PI / 2;
    wrap.position.x = -0.09 + i * 0.06;
    w.add(wrap);
  }
  // 柄頭の房
  const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.1, 6), accentMat);
  tassel.position.set(0.18, -0.03, 0);
  tassel.rotation.z = Math.PI;
  w.add(tassel);
  w.rotation.z = 0.15;
  return {
    group: w,
    base: new THREE.Vector3(-0.14, 0, 0),
    tip: new THREE.Vector3(-1.03, 0, 0),
    setGlow(v) {
      bladeMat.emissiveIntensity = v * 1.2;
      edgeMat.opacity = Math.min(1, v * 1.2);
    },
  };
}

/** ボスの杖。先端に浮遊する宝玉 */
export function createStaff(accent?: THREE.Material, dark?: THREE.Material): Weapon {
  const accentMat = accent ?? toonMat(0xff60d0, { emissive: 0xff60d0, emissiveIntensity: 0.15 });
  const darkMat = dark ?? toonMat(0x2a1420);
  const w = new THREE.Group();
  const orbMat = toonMat(0xd070ff, { emissive: 0xa040ff, emissiveIntensity: 0.6 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 1.5, 8), darkMat);
  pole.rotation.z = Math.PI / 2;
  pole.position.x = -0.4;
  addOutline(pole, 0.008);
  w.add(pole);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), orbMat);
  orb.position.x = -1.2;
  w.add(orb);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.018, 8, 24), accentMat);
  ring.position.x = -1.2;
  ring.rotation.y = Math.PI / 2;
  w.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.012, 8, 24), accentMat);
  ring2.position.x = -1.2;
  ring2.rotation.y = Math.PI / 2;
  ring2.rotation.x = 0.9;
  w.add(ring2);
  for (const s of [1, -1]) {
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.04), orbMat);
    crystal.position.set(-1.2, s * 0.24, 0);
    w.add(crystal);
  }
  return {
    group: w,
    base: new THREE.Vector3(-0.4, 0, 0),
    tip: new THREE.Vector3(-1.2, 0, 0),
    setGlow(v) {
      orbMat.emissiveIntensity = 0.6 + v * 1.8;
    },
  };
}
