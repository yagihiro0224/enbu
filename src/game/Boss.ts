import * as THREE from 'three';
import type { Rig } from './Rig';
import { Animator, poseFloat, poseCast, poseLunge, poseHit, poseDead, type Pose } from './Anim';
import { blobShadow } from './Toon';
import { clamp, damp, dampAngle, rand, randInt, TAU } from './util';
import type { Ctx } from './Ctx';

type BState = 'idle' | 'cast' | 'charge' | 'lunge' | 'stagger' | 'phase' | 'dead';
type Pattern = Generator<number, void, unknown>;

export class Boss {
  readonly group = new THREE.Group();
  pos = new THREE.Vector3(0, 0, -6);
  heading = 0;
  vel = new THREE.Vector3();
  hp = 800;
  maxHp = 800;
  radius = 0.55;
  poise = 0;
  poiseMax = 110;
  state: BState = 'idle';
  st = 0;
  phase = 1;
  parried = false;
  private gen: Pattern | null = null;
  private wait = 1.2;
  private lastPattern = '';
  private strafeDir = 1;
  private strafeTimer = 0;
  private lungeDir = new THREE.Vector3();
  private lungeHit = false;
  private staggerDur = 0;
  private flash = 0;
  private glow = 0;
  private t = 0;
  private anim: Animator;
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();

  constructor(public rig: Rig) {
    this.group.add(rig.root);
    this.group.add(blobShadow(0.7));
    this.anim = new Animator(rig);
  }

  reset() {
    this.pos.set(0, 0, -6);
    this.heading = 0;
    this.vel.set(0, 0, 0);
    this.hp = this.maxHp;
    this.poise = 0;
    this.state = 'idle';
    this.st = 0;
    this.phase = 1;
    this.gen = null;
    this.wait = 1.2;
    this.flash = this.glow = 0;
    this.rig.root.scale.setScalar(1);
    this.rig.root.visible = true;
    this.rig.setFlash(0);
    this.rig.setWeaponGlow(0);
  }

  get alive() {
    return this.state !== 'dead';
  }
  get center(): THREE.Vector3 {
    return this.tmp2.set(this.pos.x, this.pos.y + 1.05, this.pos.z);
  }
  private get speedMul() {
    return 1 + (this.phase - 1) * 0.18;
  }

  stagger(sec: number, ctx: Ctx) {
    if (!this.alive) return;
    this.state = 'stagger';
    this.st = 0;
    this.staggerDur = sec;
    this.gen = null;
    this.poise = 0;
    this.vel.set(0, 0, 0);
    ctx.particles.emit(this.center, { color: 0xd0a0ff, count: 20, speed: 5, size: 0.2, life: 0.5 });
  }

  takeDamage(dmg: number, poiseDmg: number, ctx: Ctx) {
    if (!this.alive || this.state === 'phase') return;
    const mul = this.state === 'stagger' ? 1.5 : 1;
    this.hp = Math.max(0, this.hp - dmg * mul);
    this.flash = 1;
    ctx.sfx.bossHurt();
    if (this.state !== 'stagger') {
      this.poise += poiseDmg;
      if (this.poise >= this.poiseMax) {
        this.stagger(1.8, ctx);
        ctx.ui.showBanner('体勢崩し！', '#d0a0ff', 1.0);
        ctx.sfx.heavyHit();
      }
    }
    ctx.ui.setBossHp(this.hp / this.maxHp);
    if (this.hp <= 0) {
      this.die(ctx);
      return;
    }
    if (this.phase === 1 && this.hp <= this.maxHp * 0.6) this.enterPhase(2, ctx);
    else if (this.phase === 2 && this.hp <= this.maxHp * 0.3) this.enterPhase(3, ctx);
  }

  private enterPhase(p: number, ctx: Ctx) {
    this.phase = p;
    this.state = 'phase';
    this.st = 0;
    this.gen = null;
    this.vel.set(0, 0, 0);
    this.clearBullets(ctx);
    ctx.sfx.phase();
    ctx.shake(0.8);
    ctx.hitstop(0.5, 0.25);
    ctx.ui.showBanner(p === 2 ? '第二形態 ─ 憤怒' : '最終形態 ─ 慟哭', '#ff70d0', 1.6);
    ctx.particles.emit(this.center, { color: 0xc060ff, count: 60, speed: 9, size: 0.3, life: 0.9 });
  }

  private clearBullets(ctx: Ctx) {
    let n = 0;
    for (const b of ctx.bullets.list) {
      if (!b.active || b.owner !== 'boss') continue;
      b.active = false;
      if (n++ < 40) ctx.particles.emit(b.pos, { color: b.color, count: 2, speed: 2, size: 0.15, life: 0.3 });
    }
  }

  private die(ctx: Ctx) {
    this.state = 'dead';
    this.st = 0;
    this.gen = null;
    this.vel.set(0, 0, 0);
    this.clearBullets(ctx);
    ctx.onBossDead();
  }

  // ---- 弾の発射 ----
  private fire(ctx: Ctx, from: THREE.Vector3, dir: THREE.Vector3, speed: number, o: { kind?: 0 | 1 | 2; r?: number; color?: number; damage?: number; life?: number; homing?: number; gravity?: number; bounce?: boolean }) {
    return ctx.bullets.spawn({
      pos: from, vel: dir.clone().normalize().multiplyScalar(speed * this.speedMul), owner: 'boss',
      kind: o.kind ?? 0, r: o.r ?? 0.3, color: o.color ?? 0xff5fb0, damage: o.damage ?? 10, life: o.life ?? 8,
      homing: o.homing, gravity: o.gravity, bounce: o.bounce,
    });
  }
  private toPlayer(ctx: Ctx, out: THREE.Vector3) {
    return out.set(ctx.player.pos.x - this.pos.x, 0, ctx.player.pos.z - this.pos.z);
  }

  // ---- パターン ----
  private *ring(ctx: Ctx): Pattern {
    this.state = 'cast';
    ctx.sfx.bossCharge();
    yield 0.5;
    const bursts = 2 + this.phase;
    const n = 10 + this.phase * 3;
    for (let i = 0; i < bursts; i++) {
      const off = i * 0.23 + rand(0, 0.1);
      const c = this.center.clone();
      for (let j = 0; j < n; j++) {
        const a = off + (j / n) * TAU;
        this.fire(ctx, c, this.tmp.set(Math.sin(a), Math.sin(j * 1.7 + i) * 0.06, Math.cos(a)), 5.8, { color: 0xff5fb0, r: 0.27, damage: 8 });
      }
      ctx.sfx.bossShoot();
      yield 0.32;
    }
    this.state = 'idle';
  }

  private *fan(ctx: Ctx): Pattern {
    this.state = 'cast';
    yield 0.3;
    const volleys = 2 + this.phase;
    for (let v = 0; v < volleys; v++) {
      const base = this.toPlayer(ctx, this.tmp);
      const baseA = Math.atan2(base.x, base.z);
      const k = 5 + this.phase * 2;
      const spread = 0.9;
      const c = this.center.clone();
      for (let i = 0; i < k; i++) {
        const a = baseA + (i / (k - 1) - 0.5) * spread;
        this.fire(ctx, c, this.tmp.set(Math.sin(a), -0.02, Math.cos(a)), 12, { kind: 1, r: 0.17, color: 0xc070ff, damage: 10, life: 5 });
      }
      ctx.sfx.bossShoot();
      yield 0.42;
    }
    this.state = 'idle';
  }

  private *spiral(ctx: Ctx): Pattern {
    this.state = 'cast';
    ctx.sfx.bossCharge();
    yield 0.4;
    const arms = 1 + this.phase;
    const steps = 24 + this.phase * 6;
    const dirSign = Math.random() < 0.5 ? 1 : -1;
    for (let s = 0; s < steps; s++) {
      const c = this.center.clone();
      c.y = 0.5 + ((Math.sin(s * 0.45) + 1) / 2) * 1.6;
      for (let a = 0; a < arms; a++) {
        const ang = dirSign * s * 0.33 + (a / arms) * TAU;
        this.fire(ctx, c, this.tmp.set(Math.sin(ang), 0, Math.cos(ang)), 5.5, { color: a % 2 ? 0xff7ad9 : 0x8a5aff, r: 0.28, life: 7 });
      }
      if (s % 3 === 0) ctx.sfx.bossShoot();
      yield 0.065;
    }
    this.state = 'idle';
  }

  private *rain(ctx: Ctx): Pattern {
    this.state = 'cast';
    ctx.sfx.bossCharge();
    yield 0.4;
    const waves = 7 + this.phase * 2;
    for (let i = 0; i < waves; i++) {
      for (let j = 0; j < 3; j++) {
        const p = ctx.player.pos.clone();
        const a = rand(0, TAU), d = rand(0, 3.2 + this.phase * 0.5);
        p.x += Math.cos(a) * d;
        p.z += Math.sin(a) * d;
        const lim = ctx.arenaR - 0.5;
        const l = Math.hypot(p.x, p.z);
        if (l > lim) { p.x *= lim / l; p.z *= lim / l; }
        // 着弾点の予告
        ctx.particles.emit(new THREE.Vector3(p.x, 0.1, p.z), { color: 0xff9040, count: 6, speed: 0.8, size: 0.25, life: 0.7, drag: 0.5, up: 0.6 });
        p.y = 6.5;
        this.fire(ctx, p, this.tmp.set(0, -1, 0), 2.5, { color: 0xff9040, r: 0.32, gravity: 10, bounce: true, life: 4, damage: 12 });
      }
      ctx.sfx.bossShoot();
      yield 0.12;
    }
    this.state = 'idle';
  }

  private *homing(ctx: Ctx): Pattern {
    this.state = 'cast';
    yield 0.3;
    const n = 4 + this.phase * 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const c = this.center.clone();
      this.fire(ctx, c, this.tmp.set(Math.sin(a), 1.1, Math.cos(a)), 7, { color: 0x60e0ff, r: 0.34, homing: 2.0 + this.phase * 0.5, life: 4.5, damage: 12 });
      ctx.sfx.bossShoot();
      yield 0.13;
    }
    this.state = 'idle';
  }

  private *wall(ctx: Ctx): Pattern {
    this.state = 'cast';
    ctx.sfx.bossCharge();
    yield 0.45;
    const count = 2 + this.phase;
    for (let w = 0; w < count; w++) {
      const base = this.toPlayer(ctx, this.tmp).normalize();
      const right = new THREE.Vector3(-base.z, 0, base.x);
      const n = 11;
      const gap = randInt(1, n - 3);
      const c = this.center.clone();
      for (let i = 0; i < n; i++) {
        if (i === gap || i === gap + 1) continue;
        const p = c.clone().addScaledVector(right, (i - (n - 1) / 2) * 0.95);
        this.fire(ctx, p, base, 9.5, { kind: 1, r: 0.2, color: 0xff70d0, life: 6, damage: 12 });
      }
      ctx.sfx.bossShoot();
      yield 0.6;
    }
    this.state = 'idle';
  }

  private *lunge(ctx: Ctx): Pattern {
    this.state = 'charge';
    this.parried = false;
    this.glow = 1;
    ctx.sfx.bossCharge();
    ctx.particles.emit(this.center, { color: 0xff40a0, count: 16, speed: 3, size: 0.25, life: 0.5 });
    yield 0.62;
    this.toPlayer(ctx, this.lungeDir).normalize();
    this.heading = Math.atan2(this.lungeDir.x, this.lungeDir.z);
    this.state = 'lunge';
    this.st = 0;
    this.lungeHit = false;
    ctx.sfx.dodge();
    yield 0.7;
    this.state = 'idle';
  }

  private *teleport(ctx: Ctx): Pattern {
    ctx.particles.emit(this.center, { color: 0xc060ff, count: 30, speed: 4, size: 0.25, life: 0.5 });
    ctx.sfx.teleport();
    this.rig.root.visible = false;
    yield 0.25;
    const p = ctx.player.pos;
    const a = Math.atan2(this.pos.x - p.x, this.pos.z - p.z) + rand(-1.6, 1.6);
    const d = rand(6, 8.5);
    this.pos.set(p.x + Math.sin(a) * d, 0, p.z + Math.cos(a) * d);
    const lim = ctx.arenaR - 1.2;
    const l = Math.hypot(this.pos.x, this.pos.z);
    if (l > lim) { this.pos.x *= lim / l; this.pos.z *= lim / l; }
    this.vel.set(0, 0, 0);
    this.rig.root.visible = true;
    ctx.particles.emit(this.center, { color: 0xc060ff, count: 30, speed: 4, size: 0.25, life: 0.5 });
    yield 0.3;
  }

  private pick(ctx: Ctx): Pattern {
    const dist = this.toPlayer(ctx, this.tmp).length();
    const table: [string, number][] = [
      ['ring', 3], ['fan', 3], ['spiral', this.phase >= 2 ? 3 : 2], ['lunge', dist < 9 ? 2 : 0], ['teleport', dist > 10 ? 3 : 1],
    ];
    if (this.phase >= 2) table.push(['rain', 2], ['homing', 2], ['wall', 2]);
    if (this.phase >= 3) table.push(['spiral', 1], ['wall', 1], ['homing', 1]);
    let total = 0;
    for (const [name, w] of table) if (name !== this.lastPattern) total += w;
    let r = Math.random() * total;
    let chosen = 'ring';
    for (const [name, w] of table) {
      if (name === this.lastPattern) continue;
      r -= w;
      if (r <= 0) { chosen = name; break; }
    }
    this.lastPattern = chosen;
    switch (chosen) {
      case 'fan': return this.fan(ctx);
      case 'spiral': return this.spiral(ctx);
      case 'lunge': return this.lunge(ctx);
      case 'teleport': return this.teleport(ctx);
      case 'rain': return this.rain(ctx);
      case 'homing': return this.homing(ctx);
      case 'wall': return this.wall(ctx);
      default: return this.ring(ctx);
    }
  }

  update(dt: number, ctx: Ctx, active: boolean) {
    this.t += dt;
    this.st += dt;
    this.flash = Math.max(0, this.flash - dt * 5);
    this.glow = Math.max(0, this.glow - dt * 1.5);
    if (this.state !== 'stagger') this.poise = Math.max(0, this.poise - dt * 10);

    const player = ctx.player;
    const toP = this.toPlayer(ctx, this.tmp);
    const dist = toP.length();

    // 向き
    if (this.state !== 'lunge' && this.state !== 'dead' && dist > 0.1) {
      this.heading = dampAngle(this.heading, Math.atan2(toP.x, toP.z), this.state === 'charge' ? 10 : 5, dt);
    }

    // 行動
    if (active && this.alive && player.alive) {
      if (this.state === 'stagger') {
        if (this.st >= this.staggerDur) { this.state = 'idle'; this.st = 0; this.wait = 0.5; }
      } else if (this.state === 'phase') {
        this.glow = 1;
        if (this.st >= 1.4) { this.state = 'idle'; this.st = 0; this.wait = 0.3; }
      } else if (this.state === 'lunge') {
        const k = this.st < 0.3 ? 1 : 0.15;
        this.vel.copy(this.lungeDir).multiplyScalar(24 * k);
        if (this.st < 0.06) ctx.particles.emit(this.center, { color: 0xff40a0, count: 3, speed: 1, size: 0.3, life: 0.3 });
        if (!this.lungeHit && this.st < 0.4 && dist < 1.5 + player.radius) {
          if (player.takeDamage(22, ctx, this.pos)) this.lungeHit = true;
        }
        if (this.st >= 0.5) { this.state = 'idle'; this.st = 0; }
      } else {
        // 通常移動: 距離を保ちつつ横移動
        const desired = this.phase >= 3 ? 6 : 7;
        const radial = clamp((dist - desired) * 0.8, -3, 3);
        this.strafeTimer -= dt;
        if (this.strafeTimer <= 0) { this.strafeDir = Math.random() < 0.5 ? 1 : -1; this.strafeTimer = rand(1.5, 3.5); }
        const n = dist > 0.1 ? toP.clone().divideScalar(dist) : new THREE.Vector3(0, 0, 1);
        const tangent = new THREE.Vector3(-n.z, 0, n.x).multiplyScalar(this.strafeDir * (this.state === 'cast' ? 1.2 : 2.6));
        const target = n.multiplyScalar(this.state === 'charge' ? 0 : radial).add(this.state === 'charge' ? new THREE.Vector3() : tangent);
        this.vel.x = damp(this.vel.x, target.x, 3, dt);
        this.vel.z = damp(this.vel.z, target.z, 3, dt);
      }
      // パターン進行
      if (this.state === 'idle' || this.state === 'cast' || this.state === 'charge') {
        this.wait -= dt;
        let guard = 0;
        while (this.wait <= 0 && (this.state === 'idle' || this.state === 'cast' || this.state === 'charge') && guard++ < 50) {
          if (!this.gen) this.gen = this.pick(ctx);
          const r = this.gen.next();
          if (r.done) {
            this.gen = null;
            if (this.state === 'cast' || this.state === 'charge') this.state = 'idle';
            this.wait += this.phase === 1 ? 0.7 : this.phase === 2 ? 0.45 : 0.3;
          } else {
            this.wait += r.value;
          }
        }
      }
    } else if (this.state !== 'dead') {
      this.vel.multiplyScalar(Math.max(0, 1 - dt * 5));
    }

    // 移動
    this.pos.addScaledVector(this.vel, dt);
    const lim = ctx.arenaR - 1.0;
    const l = Math.hypot(this.pos.x, this.pos.z);
    if (l > lim) { this.pos.x *= lim / l; this.pos.z *= lim / l; }

    // アニメーション
    let pose: Pose;
    let rate = 8;
    let hover = 0.3 + Math.sin(this.t * 1.5) * 0.12;
    switch (this.state) {
      case 'cast': pose = poseCast(this.t); rate = 12; break;
      case 'charge': pose = poseCast(this.t, 2.5); rate = 16; hover = 0.5; break;
      case 'phase': pose = poseCast(this.t, 3); rate = 10; hover = 0.8 + Math.sin(this.t * 6) * 0.1; break;
      case 'lunge': pose = poseLunge(); rate = 20; hover = 0.35; break;
      case 'stagger': pose = poseHit(); rate = 10; hover = 0; break;
      case 'dead': pose = poseDead(this.rig.hipsHeight); rate = 5; hover = 0; break;
      default: pose = poseFloat(this.t); break;
    }
    this.anim.apply(pose, rate, dt, this.vel.length() * 0.5);
    this.rig.update(dt);
    this.rig.root.position.y = damp(this.rig.root.position.y, hover, 6, dt);
    this.group.position.copy(this.pos);
    this.rig.root.rotation.y = this.heading;
    this.rig.setFlash(this.flash);
    this.rig.setWeaponGlow(this.glow + (this.phase >= 3 ? 0.5 : 0));

    if (this.state === 'dead') {
      // 消滅演出
      if (this.st > 0.4) {
        const s = Math.max(0, 1 - (this.st - 0.4) / 1.8);
        this.rig.root.scale.setScalar(s);
        if (s > 0 && Math.random() < 0.6) ctx.particles.emit(this.center, { color: Math.random() < 0.5 ? 0xffd0ff : 0xc060ff, count: 4, speed: 4, size: 0.25, life: 0.8, up: 2 });
        if (s <= 0) this.rig.root.visible = false;
      }
    }
  }
}
