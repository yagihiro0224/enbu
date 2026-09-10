import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM, type VRMHumanBoneName } from '@pixiv/three-vrm';
import type { Rig } from './Rig';
import { createKatana } from './Weapons';

/**
 * public/models/player.vrm があれば読み込んで Rig にする。無ければ null。
 * VRoid Studio で作ったキャラを置くだけで差し替えられる。
 */
export async function tryLoadVrm(url: string): Promise<Rig | null> {
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

  const katana = createKatana();
  get('rightHand').add(katana.group);

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
    weapon: katana,
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
      katana.setGlow(v);
    },
    update(dt) {
      vrm.update(dt);
    },
    dispose() {
      VRMUtils.deepDispose(vrm.scene);
    },
  };
}
