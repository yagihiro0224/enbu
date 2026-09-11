import * as THREE from 'three';
import { flashTexture } from './Face';
import { TAU } from './util';
import type { Ctx } from './Ctx';

/** 1 個あたりの回復量 */
export const HEAL_AMOUNT = 30;
const PICK_RADIUS = 1.0;

interface Item {
  group: THREE.Group;
  core: THREE.Mesh;
  halo: THREE.Sprite;
  ring: THREE.Mesh;
  pos: THREE.Vector3;
  taken: boolean;
  phase: number;
}

/**
 * ステージに置く回復アイテム。触れると回復して消える。
 * 1 戦闘につき 1 個 1 回。やり直すと元に戻る。
 */
export class Items {
  readonly group = new THREE.Group();
  private list: Item[] = [];
  private t = 0;

  constructor(arenaR: number, count = 3) {
    const haloTex = flashTexture();
    const coreGeo = new THREE.OctahedronGeometry(0.24, 0);
    const shellGeo = new THREE.OctahedronGeometry(0.38, 0);
    const ringGeo = new THREE.RingGeometry(0.55, 0.72, 28);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + Math.PI / 2;
      const d = arenaR * 0.64;
      const g = new THREE.Group();
      const core = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 1.5, 0.75), toneMapped: false }));
      const shell = new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.15, 0.8, 0.45), toneMapped: false, transparent: true, opacity: 0.25,
        blending: THREE.AdditiveBlending, depthWrite: false, wireframe: true,
      }));
      core.add(shell);
      core.position.y = 0.95;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: haloTex, color: new THREE.Color(0.16, 0.62, 0.34), toneMapped: false,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      halo.scale.setScalar(0.8);
      halo.position.y = 0.95;
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.2, 0.9, 0.5), toneMapped: false, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      g.add(core, halo, ring);
      g.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
      this.group.add(g);
      this.list.push({ group: g, core, halo, ring, pos: g.position.clone(), taken: false, phase: i * 1.7 });
    }
  }

  reset() {
    for (const it of this.list) {
      it.taken = false;
      it.group.visible = true;
    }
  }

  /** 残っている個数 */
  get remaining() {
    return this.list.filter((i) => !i.taken).length;
  }

  update(dt: number, ctx: Ctx, active: boolean) {
    this.t += dt;
    for (const it of this.list) {
      if (it.taken) continue;
      // 浮いて回る
      const bob = Math.sin(this.t * 1.8 + it.phase) * 0.14;
      it.core.position.y = 0.95 + bob;
      it.halo.position.y = 0.95 + bob;
      it.core.rotation.y += dt * 1.1;
      it.core.rotation.x += dt * 0.45;
      const pulse = 0.85 + Math.sin(this.t * 2.6 + it.phase) * 0.25;
      it.halo.scale.setScalar(0.8 * pulse);
      (it.ring.material as THREE.MeshBasicMaterial).opacity = 0.3 + pulse * 0.2;
      it.ring.rotation.z += dt * 0.5;
      if (!active) continue;
      // 拾う
      const pl = ctx.player;
      if (!pl.alive || pl.hp >= pl.maxHp) continue;
      const dx = pl.pos.x - it.pos.x, dz = pl.pos.z - it.pos.z;
      if (dx * dx + dz * dz > PICK_RADIUS * PICK_RADIUS) continue;
      it.taken = true;
      it.group.visible = false;
      pl.heal(HEAL_AMOUNT, ctx);
      const c = it.pos.clone().setY(0.95);
      ctx.particles.emit(c, { color: 0x60ffa0, count: 30, speed: 4, size: 0.2, life: 0.6, up: 2 });
      ctx.fx.flash(c, 0x80ffb0, 2.6, 0.3);
      ctx.fx.ring(it.pos, 0x60ffa0, 2.4, 0.4);
      ctx.sfx.heal();
      ctx.ui.showBanner('回復', '#7cffb0', 0.8);
      console.info(`heal picked: +${HEAL_AMOUNT} hp=${Math.round(pl.hp)} remaining=${this.remaining}`);
    }
  }
}
