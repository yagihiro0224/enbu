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

  // 服の色を操作できるマテリアル。
  // 生地が暗いと色を掛けても染まって見えないので、発光も一緒に動かす。
  // 発光は setFlash が毎フレーム base へ戻すため、その base 自体を書き換える
  type Tinted = THREE.Material & { color?: THREE.Color; shadeColorFactor?: THREE.Color };
  const cloth: { m: Tinted; base: THREE.Color; shade: THREE.Color | null; emi: { base: THREE.Color; m: Emissive } | null }[] = [];
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
      // 服だけを染められるよう、名前に CLOTH を含むマテリアルを覚えておく。
      // VRoid の命名は N00_010_01_Onepiece_00_CLOTH_01 のような形
      const c = m as Tinted;
      if (/CLOTH/i.test(m.name) && c.color instanceof THREE.Color) {
        const rec = mats.find((x) => x.m === (m as unknown as Emissive)) ?? null;
        cloth.push({ m: c, base: c.color.clone(), shade: c.shadeColorFactor?.clone() ?? null, emi: rec });
      }
    }
  });


  // ?clothdbg で、服として掴めたマテリアルを数える
  if (location.search.includes('clothdbg')) {
    console.info(`clothdbg ${url}: cloth=${cloth.length} emissive=${cloth.filter((c) => c.emi).length} 全体=${mats.length}`);
    for (const c of cloth) console.info(`clothdbg  ${c.m.name} base=#${c.base.getHexString()} emi=${c.emi ? 'あり' : 'なし'}`);
  }

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
    setClothTint(color, amount = 0.85) {
      const tint = color === null ? null : new THREE.Color(color);
      for (const c of cloth) {
        if (!c.m.color) continue;
        if (tint === null) {
          c.m.color.copy(c.base);
          if (c.m.shadeColorFactor && c.shade) c.m.shadeColorFactor.copy(c.shade);
          if (c.emi) { c.emi.base.setRGB(0, 0, 0); c.emi.m.emissive.copy(c.emi.base); }
        } else {
          // 生地の色を混ぜる割合は 1 まで。
          // それ以上の amount は「掛ける明るさ」になり、黒い生地を持ち上げて色を見せる
          const k = Math.min(1, amount);
          c.m.color.copy(c.base).lerp(tint, k).multiplyScalar(Math.max(1, amount));
          if (c.m.shadeColorFactor && c.shade) {
            c.m.shadeColorFactor.copy(c.shade).lerp(tint, k * 0.8).multiplyScalar(Math.max(1, amount * 0.7));
          }
          // 暗い生地でも色が分かるように光らせる
          if (c.emi) {
            c.emi.base.copy(tint).multiplyScalar(0.3 * Math.min(1.6, amount));
            c.emi.m.emissive.copy(c.emi.base);
            c.emi.m.emissiveIntensity = 1;
          }
        }
      }
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
