import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM, type VRMHumanBoneName } from '@pixiv/three-vrm';
import type { Rig } from './Rig';
import { createStaff, type Weapon } from './Weapons';

/**
 * public/models/player.vrm があれば読み込んで Rig にする。無ければ null。
 * VRoid Studio で作ったキャラを置くだけで差し替えられる。
 */
export async function tryLoadVrm(url: string, opts: { weapon?: 'staff' } = {}): Promise<Rig | null> {
  try {
    const head = await fetch(url, { method: 'HEAD' });
    if (!head.ok) return null;
    const ct = head.headers.get('content-type') ?? '';
    if (ct.includes('text/html')) return null;
  } catch {
    return null;
  }
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const gltf = await loader.loadAsync(url);
  const vrm = gltf.userData.vrm as VRM | undefined;
  if (!vrm) return null;
  let tris = 0;
  gltf.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; });
  console.info(`VRM loaded: version=${vrm.meta.metaVersion} tris=${Math.round(tris)}`);
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.combineSkeletons(gltf.scene);
  VRMUtils.rotateVRM0(vrm);
  vrm.scene.traverse((o) => { o.frustumCulled = false; });

  const h = vrm.humanoid;
  const get = (n: VRMHumanBoneName): THREE.Object3D => h.getNormalizedBoneNode(n) ?? new THREE.Object3D();
  const root = new THREE.Group();
  root.add(vrm.scene);
  vrm.scene.updateMatrixWorld(true);
  const headPos = new THREE.Vector3();
  get('head').getWorldPosition(headPos);
  const height = headPos.y + 0.15;
  root.scale.setScalar(1.6 / Math.max(0.5, height));
  const hips = get('hips');

  // 発光を操作できるマテリアルを集める
  type Emissive = THREE.Material & { emissive: THREE.Color; emissiveIntensity: number };
  const mats: { m: Emissive; base: THREE.Color; baseI: number }[] = [];
  vrm.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of list) {
      const e = m as Emissive;
      if (e.emissive instanceof THREE.Color) mats.push({ m: e, base: e.emissive.clone(), baseI: e.emissiveIntensity ?? 1 });
    }
  });


  // 指の骨（T ポーズで指は ±X 方向、掌は下向き）。握る = Z 回転で掌側（-Y）へ曲げる
  const fingerBones = (side: 'left' | 'right') => {
    const names: VRMHumanBoneName[] = [];
    for (const f of ['Index', 'Middle', 'Ring', 'Little'] as const) {
      for (const j of ['Proximal', 'Intermediate', 'Distal'] as const) names.push(`${side}${f}${j}` as VRMHumanBoneName);
    }
    const thumbs: VRMHumanBoneName[] = [`${side}ThumbMetacarpal`, `${side}ThumbProximal`, `${side}ThumbDistal`] as VRMHumanBoneName[];
    return {
      fingers: names.map((n) => h.getNormalizedBoneNode(n)).filter((b): b is THREE.Object3D => !!b),
      thumbs: thumbs.map((n) => h.getNormalizedBoneNode(n)).filter((b): b is THREE.Object3D => !!b),
    };
  };
  const fL = fingerBones('left');
  const fR = fingerBones('right');
  const curl = (set: { fingers: THREE.Object3D[]; thumbs: THREE.Object3D[] }, sign: number, v: number) => {
    // 関節ごとに 第1 1.3, 第2 1.5, 第3 1.0 rad
    set.fingers.forEach((b, i) => {
      const k = [1.3, 1.5, 1.0][i % 3];
      b.rotation.set(0, 0, -sign * k * v);
    });
    // 親指は指の外側に被せる: 少し内へ回してから曲げる
    set.thumbs.forEach((b, i) => {
      const k = [0.2, 0.6, 0.7][i];
      b.rotation.set(-sign * 0.5 * v * (i === 0 ? 1 : 0), 0, -sign * k * v);
    });
  };

  // 武器（ボスの杖など）。指定があれば右手に持たせる
  let weapon: Weapon | null = null;
  if (opts.weapon === 'staff') {
    weapon = createStaff();
    // 杖は腕の軸に沿って伸びるので、180 度回して腕を下ろしたときに上を向くようにする。
    // VRM は等身大なので、そのままでは長すぎる
    weapon.group.scale.setScalar(0.6);
    weapon.group.rotation.z = Math.PI;
    get('rightHand').add(weapon.group);
  }

  return {
    root,
    hips,
    spine: get('spine'),
    head: get('head'),
    upperArmL: get('leftUpperArm'),
    lowerArmL: get('leftLowerArm'),
    upperArmR: get('rightUpperArm'),
    lowerArmR: get('rightLowerArm'),
    upperLegL: get('leftUpperLeg'),
    lowerLegL: get('leftLowerLeg'),
    upperLegR: get('rightUpperLeg'),
    lowerLegR: get('rightLowerLeg'),
    handR: get('rightHand'),
    weapon,
    hairBones: [],
    hipsHeight: hips.position.y,
    height: 1.6,
    setFlash(v) {
      for (const { m, base, baseI } of mats) {
        if (v > 0.001) { m.emissive.setRGB(v, v * 0.9, v * 0.85); m.emissiveIntensity = 1; }
        else { m.emissive.copy(base); m.emissiveIntensity = baseI; }
      }
    },
    setWeaponGlow(v) {
      weapon?.setGlow(v);
    },
    resetSprings() {
      vrm.springBoneManager?.reset();
    },
    setFist(l, r) {
      curl(fL, 1, l);
      curl(fR, -1, r);
    },
    update(dt) {
      vrm.update(dt);
    },
    dispose() {
      VRMUtils.deepDispose(vrm.scene);
    },
  };
}
