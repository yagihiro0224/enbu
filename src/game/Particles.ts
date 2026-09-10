import * as THREE from 'three';
import { rand } from './util';

interface P {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; maxLife: number;
  r: number; g: number; b: number;
  size: number; gravity: number; drag: number;
}

/** 1 つの Points で描く軽量パーティクル（火花、光の粒） */
export class Particles {
  readonly points: THREE.Points;
  private list: P[] = [];
  private free: P[] = [];
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private geo: THREE.BufferGeometry;
  private mat: THREE.ShaderMaterial;

  constructor(max = 600) {
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 300 } },
      vertexShader: /* glsl */ `
        attribute float size; attribute float alpha; attribute vec3 color;
        varying vec3 vColor; varying float vAlpha;
        uniform float uScale;
        void main() {
          vColor = color; vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor; varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          if (d > 1.0) discard;
          float a = (1.0 - d * d) * vAlpha;
          gl_FragColor = vec4(vColor * a * 1.7, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    for (let i = 0; i < max; i++) {
      this.free.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, r: 1, g: 1, b: 1, size: 1, gravity: 0, drag: 0 });
    }
  }

  /** カメラ・画面に合わせた点サイズの基準を更新 */
  setViewport(heightPx: number, fovDeg: number) {
    this.mat.uniforms.uScale.value = heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
  }

  emit(pos: THREE.Vector3, opts: { color: THREE.Color | number; count?: number; speed?: number; spread?: number; size?: number; life?: number; gravity?: number; drag?: number; dir?: THREE.Vector3; up?: number }) {
    const c = opts.color instanceof THREE.Color ? opts.color : new THREE.Color(opts.color);
    const n = opts.count ?? 8;
    const sp = opts.speed ?? 4;
    const spread = opts.spread ?? 1;
    for (let i = 0; i < n; i++) {
      const p = this.free.pop();
      if (!p) return;
      p.x = pos.x; p.y = pos.y; p.z = pos.z;
      const dx = rand(-1, 1), dy = rand(-1, 1), dz = rand(-1, 1);
      const l = Math.hypot(dx, dy, dz) || 1;
      const s = sp * rand(0.4, 1);
      p.vx = (dx / l) * s * spread + (opts.dir?.x ?? 0) * sp;
      p.vy = (dy / l) * s * spread + (opts.dir?.y ?? 0) * sp + (opts.up ?? 0);
      p.vz = (dz / l) * s * spread + (opts.dir?.z ?? 0) * sp;
      p.maxLife = p.life = (opts.life ?? 0.5) * rand(0.6, 1.2);
      p.r = c.r; p.g = c.g; p.b = c.b;
      p.size = (opts.size ?? 0.18) * rand(0.7, 1.3);
      p.gravity = opts.gravity ?? 0;
      p.drag = opts.drag ?? 2;
      this.list.push(p);
    }
  }

  update(dt: number) {
    let n = 0;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.list.splice(i, 1);
        this.free.push(p);
        continue;
      }
      const k = Math.max(0, 1 - p.drag * dt);
      p.vx *= k; p.vz *= k; p.vy = p.vy * k - p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const t = p.life / p.maxLife;
      this.pos[n * 3] = p.x; this.pos[n * 3 + 1] = p.y; this.pos[n * 3 + 2] = p.z;
      this.col[n * 3] = p.r; this.col[n * 3 + 1] = p.g; this.col[n * 3 + 2] = p.b;
      this.size[n] = p.size * (0.4 + 0.6 * t);
      this.alpha[n] = Math.min(1, t * 2);
      n++;
    }
    this.geo.setDrawRange(0, n);
    for (const a of ['position', 'color', 'size', 'alpha']) (this.geo.getAttribute(a) as THREE.BufferAttribute).needsUpdate = true;
  }

  clear() {
    for (const p of this.list) this.free.push(p);
    this.list.length = 0;
    this.geo.setDrawRange(0, 0);
  }
}
