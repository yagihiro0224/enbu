import * as THREE from 'three';
import { needleTexture, orbTexture } from './Face';

export type Owner = 'boss' | 'player' | 'reflect';
export type Kind = 0 | 1 | 2; // 0: 光弾, 1: 針, 2: 炎（プレイヤー射撃）

export interface Bullet {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  r: number;
  life: number;
  owner: Owner;
  kind: Kind;
  color: THREE.Color;
  /** 追尾の旋回速度 rad/s。0 で直進 */
  homing: number;
  gravity: number;
  bounce: boolean;
  damage: number;
  /** 一度だけ効果を発動した印（弾き返し等） */
  tag: number;
}

export interface SpawnOpts {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  owner: Owner;
  r?: number;
  life?: number;
  kind?: Kind;
  color?: THREE.ColorRepresentation;
  homing?: number;
  gravity?: number;
  bounce?: boolean;
  damage?: number;
}

const CAP: Record<Kind, number> = { 0: 700, 1: 250, 2: 120 };
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

/**
 * 弾幕プール。種類ごとに InstancedMesh 1 枚 + 加算グロー 1 枚で描く。
 * 当たり判定は Game 側が forEach で行う。
 */
export class Bullets {
  readonly group = new THREE.Group();
  readonly list: Bullet[] = [];
  private meshes: THREE.InstancedMesh[] = [];
  private glows: THREE.InstancedMesh[] = [];
  private orbMat: THREE.ShaderMaterial;
  private t = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private tmp = new THREE.Vector3();

  constructor() {
    const geos: THREE.BufferGeometry[] = [
      new THREE.SphereGeometry(1, 10, 8),
      new THREE.CapsuleGeometry(1, 5, 2, 8),
      new THREE.SphereGeometry(1, 8, 6).scale(1, 1, 2.4),
    ];
    // 丸い弾はカメラを向く板に模様を描く（球だと塗りつぶした円に見えるため）
    geos[0] = new THREE.PlaneGeometry(2, 2);
    this.orbMat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: orbTexture() }, uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vTint;
        void main() {
          vUv = uv;
          #ifdef USE_INSTANCING_COLOR
            vTint = instanceColor;
          #else
            vTint = vec3(1.0);
          #endif
          // インスタンスの中心をビューに移し、板をカメラに正対させる
          vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float s = length(instanceMatrix[0].xyz) * 1.75;
          mv.xy += position.xy * s;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vTint;
        void main() {
          // 模様をゆっくり回す
          vec2 p = vUv - 0.5;
          float c = cos(uTime), sn = sin(uTime);
          p = mat2(c, -sn, sn, c) * p;
          vec4 t = texture2D(uMap, p + 0.5);
          gl_FragColor = vec4(vTint * 2.1 * t.rgb, t.a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const needle = needleTexture();
    for (let k = 0 as Kind; k < 3; k++) {
      const geo = geos[k];
      // ブルームに乗るよう 1.0 を超える明るさで描く
      const mat: THREE.Material = k === 0
        ? this.orbMat
        : new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.8, 1.8), toneMapped: false, map: k === 1 ? needle : null });
      const mesh = new THREE.InstancedMesh(geo, mat, CAP[k]);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP[k] * 3), 3).setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.frustumCulled = false;
      const glowGeo = geo.clone().scale(1.45, 1.45, 1.45);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xffffff, toneMapped: false, transparent: true, opacity: 0.2,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const glow = new THREE.InstancedMesh(glowGeo, glowMat, CAP[k]);
      glow.instanceMatrix = mesh.instanceMatrix;
      glow.instanceColor = mesh.instanceColor;
      glow.count = 0;
      glow.frustumCulled = false;
      // 丸い弾は板そのものに光が描いてあるので、別の発光は使わない
      if (k === 0) glow.visible = false;
      this.meshes.push(mesh);
      this.glows.push(glow);
      this.group.add(mesh, glow);
    }
    const total = CAP[0] + CAP[1] + CAP[2];
    for (let i = 0; i < total; i++) {
      this.list.push({
        active: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), r: 0.3, life: 0,
        owner: 'boss', kind: 0, color: new THREE.Color(), homing: 0, gravity: 0, bounce: false, damage: 10, tag: 0,
      });
    }
  }

  get activeCount() {
    let n = 0;
    for (const b of this.list) if (b.active) n++;
    return n;
  }

  spawn(o: SpawnOpts): Bullet | null {
    const kind = o.kind ?? 0;
    let cap = 0;
    for (const b of this.list) if (b.active && b.kind === kind) cap++;
    if (cap >= CAP[kind]) return null;
    for (const b of this.list) {
      if (b.active) continue;
      b.active = true;
      b.pos.copy(o.pos);
      b.vel.copy(o.vel);
      b.r = o.r ?? 0.3;
      b.life = o.life ?? 8;
      b.owner = o.owner;
      b.kind = kind;
      b.color.set(o.color ?? 0xff66aa);
      b.homing = o.homing ?? 0;
      b.gravity = o.gravity ?? 0;
      b.bounce = o.bounce ?? false;
      b.damage = o.damage ?? 10;
      b.tag = 0;
      return b;
    }
    return null;
  }

  update(dt: number, target: (b: Bullet) => THREE.Vector3 | null, arenaR: number) {
    this.t += dt;
    this.orbMat.uniforms.uTime.value = this.t * 0.6;
    for (const b of this.list) {
      if (!b.active) continue;
      b.life -= dt;
      if (b.homing > 0) {
        const t = target(b);
        if (t) {
          this.tmp.copy(t).sub(b.pos);
          const speed = b.vel.length();
          this.tmp.normalize();
          // 現在の進行方向を目標へ最大 homing*dt ラジアン回す
          const cur = this.s.copy(b.vel).normalize();
          const ang = cur.angleTo(this.tmp);
          const k = ang > 1e-4 ? Math.min(1, (b.homing * dt) / ang) : 0;
          cur.lerp(this.tmp, k).normalize().multiplyScalar(speed);
          b.vel.copy(cur);
        }
      }
      if (b.gravity) b.vel.y -= b.gravity * dt;
      b.pos.addScaledVector(b.vel, dt);
      if (b.pos.y < b.r) {
        if (b.bounce) {
          b.pos.y = b.r;
          b.vel.y = Math.abs(b.vel.y) * 0.55;
          b.bounce = false;
          b.gravity *= 0.6;
        } else if (b.gravity) {
          b.active = false;
          continue;
        }
      }
      const d2 = b.pos.x * b.pos.x + b.pos.z * b.pos.z;
      if (b.life <= 0 || b.pos.y < -2 || b.pos.y > 30 || d2 > (arenaR + 8) * (arenaR + 8)) b.active = false;
    }
    this.sync();
  }

  private sync() {
    const counts = [0, 0, 0];
    for (const b of this.list) {
      if (!b.active) continue;
      const mesh = this.meshes[b.kind];
      const i = counts[b.kind]++;
      if (b.kind === 0) {
        this.q.identity();
        this.s.setScalar(b.r);
      } else if (b.kind === 1) {
        this.tmp.copy(b.vel).normalize();
        this.q.setFromUnitVectors(Y, this.tmp);
        this.s.set(b.r, b.r, b.r);
      } else {
        this.tmp.copy(b.vel).normalize();
        this.q.setFromUnitVectors(Z, this.tmp);
        this.s.setScalar(b.r);
      }
      this.m.compose(b.pos, this.q, this.s);
      mesh.setMatrixAt(i, this.m);
      mesh.setColorAt(i, b.color);
    }
    for (let k = 0; k < 3; k++) {
      this.meshes[k].count = counts[k];
      this.glows[k].count = counts[k];
      this.meshes[k].instanceMatrix.needsUpdate = true;
      if (this.meshes[k].instanceColor) this.meshes[k].instanceColor!.needsUpdate = true;
    }
  }

  clear() {
    for (const b of this.list) b.active = false;
    this.sync();
  }
}
