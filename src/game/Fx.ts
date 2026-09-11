import * as THREE from 'three';
import { flashTexture, magicCircleTexture } from './Face';
import { easeOutCubic } from './util';

interface Item {
  obj: THREE.Object3D;
  life: number;
  max: number;
  tick: (obj: THREE.Object3D, t: number) => void;
}

/** 刀の軌跡。刀身の根元と先端を毎フレーム記録して帯にする */
export class Trail {
  readonly mesh: THREE.Mesh;
  private samples: { b: THREE.Vector3; t: THREE.Vector3; age: number }[] = [];
  private readonly N = 36;
  private readonly maxAge = 0.3;
  private pos: Float32Array;
  private alpha: Float32Array;
  private geo: THREE.BufferGeometry;

  constructor(color: THREE.ColorRepresentation) {
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.N * 2 * 3);
    this.alpha = new Float32Array(this.N * 2);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const idx: number[] = [];
    for (let i = 0; i < this.N - 1; i++) {
      const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
      idx.push(a, b, c, b, d, c);
    }
    this.geo.setIndex(idx);
    this.geo.setDrawRange(0, 0);
    const c = new THREE.Color(color);
    const mat = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Vector3(c.r * 2.2, c.g * 2.2, c.b * 2.2) } },
      vertexShader: /* glsl */ `
        attribute float alpha; varying float vA; varying vec2 vUv;
        void main() { vA = alpha; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 color; varying float vA;
        void main() { gl_FragColor = vec4(color * vA, vA); }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
  }

  setColor(color: THREE.ColorRepresentation, k = 2.2) {
    const c = new THREE.Color(color);
    (this.mesh.material as THREE.ShaderMaterial).uniforms.color.value.set(c.r * k, c.g * k, c.b * k);
  }

  push(base: THREE.Vector3, tip: THREE.Vector3) {
    this.samples.push({ b: base.clone(), t: tip.clone(), age: 0 });
    if (this.samples.length > this.N) this.samples.shift();
  }

  update(dt: number) {
    for (const s of this.samples) s.age += dt;
    this.samples = this.samples.filter((s) => s.age < this.maxAge);
    const n = this.samples.length;
    for (let i = 0; i < n; i++) {
      const s = this.samples[i];
      const a = 1 - s.age / this.maxAge;
      this.pos.set([s.b.x, s.b.y, s.b.z, s.t.x, s.t.y, s.t.z], i * 6);
      this.alpha[i * 2] = a * 0.25;
      this.alpha[i * 2 + 1] = a;
    }
    this.geo.setDrawRange(0, n >= 2 ? (n - 1) * 6 : 0);
    (this.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('alpha') as THREE.BufferAttribute).needsUpdate = true;
  }

  clear() {
    this.samples.length = 0;
    this.geo.setDrawRange(0, 0);
  }
}

/** 短命な演出（斬撃の三日月、衝撃波、閃光、魔法陣） */
export class Fx {
  readonly group = new THREE.Group();
  readonly playerTrail = new Trail(0xff7a2a);
  private items: Item[] = [];
  private flashTex = flashTexture();
  private crescentGeo = new THREE.RingGeometry(0.78, 1.2, 32, 1, 0, 2.7);
  private ringGeo = new THREE.RingGeometry(0.85, 1.0, 40);
  private circleTex = magicCircleTexture('rgba(220,120,255,0.95)');

  constructor() {
    this.group.add(this.playerTrail.mesh);
  }

  private add(obj: THREE.Object3D, life: number, tick: Item['tick']) {
    this.group.add(obj);
    this.items.push({ obj, life, max: life, tick });
  }

  private hdr(color: THREE.ColorRepresentation, k = 1.8) {
    const c = new THREE.Color(color);
    return c.multiplyScalar(k);
  }

  /**
   * 斬撃の三日月。yaw はキャラの向き、mode: 'h' 横薙ぎ(右→左)、'hr' 横薙ぎ(左→右)、'v' 縦
   */
  crescent(pos: THREE.Vector3, yaw: number, mode: 'h' | 'hr' | 'v', color: THREE.ColorRepresentation = 0xff8a3a, size = 1) {
    const mat = new THREE.MeshBasicMaterial({ color: this.hdr(color, 1.7), toneMapped: false, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(this.crescentGeo, mat);
    m.position.copy(pos);
    m.rotation.order = 'YXZ';
    // カメラはキャラの後ろにいるので、進行方向に正対する面に描くと弧がはっきり見える
    m.rotation.y = yaw;
    m.rotation.x = -0.25;
    const z0 = mode === 'h' ? -0.9 : mode === 'hr' ? Math.PI + 0.5 : Math.PI * 0.55;
    const sweep = mode === 'h' ? 1.0 : mode === 'hr' ? -1.0 : 1.3;
    m.rotation.z = z0;
    const s0 = 0.8 * size, s1 = 1.35 * size;
    // 2 枚重ねて中心を白く
    const core = new THREE.Mesh(this.crescentGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.4, 1.1), toneMapped: false, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    core.scale.setScalar(0.85);
    m.add(core);
    this.add(m, 0.26, (o, t) => {
      const k = easeOutCubic(t);
      const s = s0 + (s1 - s0) * k;
      o.scale.set(s, s, s);
      o.rotation.z = z0 + sweep * k;
      mat.opacity = 1 - t * t;
      (core.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - t * 1.6);
    });
  }

  /** 地面の衝撃波リング */
  ring(pos: THREE.Vector3, color: THREE.ColorRepresentation, maxR = 3.5, dur = 0.4) {
    const mat = new THREE.MeshBasicMaterial({ color: this.hdr(color, 1.6), toneMapped: false, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(this.ringGeo, mat);
    m.position.set(pos.x, 0.06, pos.z);
    m.rotation.x = -Math.PI / 2;
    this.add(m, dur, (o, t) => {
      const k = easeOutCubic(t);
      o.scale.setScalar(0.3 + maxR * k);
      mat.opacity = 1 - k;
    });
  }

  /** 閃光スプライト */
  flash(pos: THREE.Vector3, color: THREE.ColorRepresentation, size = 2, dur = 0.18) {
    const mat = new THREE.SpriteMaterial({ map: this.flashTex, color: this.hdr(color, 1.5), toneMapped: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, rotation: Math.random() * Math.PI });
    const s = new THREE.Sprite(mat);
    s.position.copy(pos);
    this.add(s, dur, (o, t) => {
      const k = easeOutCubic(t);
      o.scale.setScalar(size * (0.4 + k * 1.2));
      mat.opacity = 1 - k;
    });
  }

  /** 細く鋭い斬線。yaw 方向へ伸び、tilt で傾ける（ラジアン、0 で水平） */
  line(pos: THREE.Vector3, yaw: number, tilt: number, color: THREE.ColorRepresentation, len = 2.4, dur = 0.16) {
    const mat = new THREE.MeshBasicMaterial({ color: this.hdr(color, 2.2), toneMapped: false, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.07), mat);
    m.position.copy(pos);
    m.rotation.order = 'YXZ';
    m.rotation.y = yaw + Math.PI / 2;
    m.rotation.z = tilt;
    const core = new THREE.Mesh(new THREE.PlaneGeometry(len * 0.9, 0.025), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.0, 2.4), toneMapped: false, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.add(core);
    this.add(m, dur, (o, t) => {
      const k = easeOutCubic(t);
      o.scale.set(0.3 + k * 1.1, 1 - k * 0.7, 1);
      mat.opacity = 1 - t;
      (core.material as THREE.MeshBasicMaterial).opacity = 1 - t * 1.5;
    });
  }

  /** 縦に伸びる光の柱（フィニッシュやパリィ） */
  pillar(pos: THREE.Vector3, color: THREE.ColorRepresentation, h = 6, r = 0.6, dur = 0.5) {
    const mat = new THREE.MeshBasicMaterial({ color: this.hdr(color, 1.5), toneMapped: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r, h, 16, 1, true), mat);
    m.position.set(pos.x, h / 2, pos.z);
    this.add(m, dur, (o, t) => {
      const k = easeOutCubic(t);
      o.scale.set(1 + k * 0.6, 1, 1 + k * 0.6);
      mat.opacity = (1 - t) * 0.8;
    });
  }

  /** 魔法陣メッシュ。呼び出し側が visible と scale を制御する */
  magicCircle(size = 3.2): THREE.Mesh {
    const mat = new THREE.MeshBasicMaterial({ map: this.circleTex, color: new THREE.Color(1.6, 1.2, 2.0), toneMapped: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.04;
    m.visible = false;
    return m;
  }

  update(dt: number) {
    this.playerTrail.update(dt);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      const t = 1 - Math.max(0, it.life) / it.max;
      it.tick(it.obj, Math.min(1, t));
      if (it.life <= 0) {
        this.group.remove(it.obj);
        it.obj.traverse((o) => {
          const mesh = o as THREE.Mesh;
          const mat = mesh.material as THREE.Material | undefined;
          mat?.dispose();
          if (mesh.geometry && mesh.geometry !== this.crescentGeo && mesh.geometry !== this.ringGeo) mesh.geometry.dispose();
        });
        this.items.splice(i, 1);
      }
    }
  }

  clear() {
    for (const it of this.items) this.group.remove(it.obj);
    this.items.length = 0;
    this.playerTrail.clear();
  }
}
