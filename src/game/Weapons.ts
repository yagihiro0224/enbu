import * as THREE from 'three';
import { toonMat, addOutline } from './Toon';

export interface Weapon {
  group: THREE.Group;
  /** 発光 0..1 */
  setGlow(v: number): void;
  /** 刃の根元と先端（group ローカル座標）。軌跡エフェクト用 */
  base: THREE.Vector3;
  tip: THREE.Vector3;
}

/**
 * ナイフ（逆手持ち）。右手（-X 方向に伸びる腕）の手首に付ける前提。
 * 逆手なので刃は小指側、つまり肘の方向（+X）へ伸び、前腕の少し下（-Y）を通る。
 */
export function createKnife(accent?: THREE.Material, dark?: THREE.Material): Weapon {
  const accentMat = accent ?? toonMat(0xffb347, { emissive: 0xffb347, emissiveIntensity: 0.15 });
  const darkMat = dark ?? toonMat(0x2a1420);
  const w = new THREE.Group();
  const bladeMat = toonMat(0xe8ecf4, { emissive: 0xff5a2a, emissiveIntensity: 0 });
  // 刃: 片刃の細長い板。先端を少し細く
  const bladeGeo = new THREE.BoxGeometry(0.24, 0.032, 0.006);
  const pos = bladeGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) if (pos.getX(i) > 0.1) pos.setY(i, pos.getY(i) * 0.35);
  bladeGeo.computeVertexNormals();
  const blade = new THREE.Mesh(bladeGeo, bladeMat);
  blade.position.set(0.17, -0.045, 0.0);
  addOutline(blade, 0.006);
  w.add(blade);
  const edgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.9, 0.3), toneMapped: false, transparent: true, opacity: 0, depthWrite: false });
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.012), edgeMat);
  edge.position.copy(blade.position);
  w.add(edge);
  // 鍔とグリップ（拳の中を通る）
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, 0.03), accentMat);
  guard.position.set(0.05, -0.04, 0);
  addOutline(guard, 0.005);
  w.add(guard);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.015, 0.11, 8), darkMat);
  grip.rotation.z = Math.PI / 2;
  grip.position.set(-0.01, -0.04, 0);
  addOutline(grip, 0.005);
  w.add(grip);
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), accentMat);
  pommel.position.set(-0.07, -0.04, 0);
  w.add(pommel);
  w.scale.setScalar(1.4);
  return {
    group: w,
    base: new THREE.Vector3(0.05, -0.045, 0),
    tip: new THREE.Vector3(0.29, -0.045, 0),
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
