import * as THREE from 'three';
import type { Rig } from './Rig';
import { Animator, poseIdle, poseRun, poseAttack, poseDodge, poseParry, poseShoot, poseHit, poseDead, type Pose } from './Anim';
import { blobShadow } from './Toon';
import { clamp, damp, dampAngle, easeInCubic } from './util';
import type { Ctx } from './Ctx';

type State = 'idle' | 'run' | 'attack' | 'dodge' | 'parry' | 'hit' | 'dead';

interface AttackCfg { total: number; a0: number; a1: number; chain: number; dmg: number; poise: number; lunge: number }
const ATTACK: Record<1 | 2 | 3, AttackCfg> = {
  1: { total: 0.44, a0: 0.13, a1: 0.25, chain: 0.27, dmg: 12, poise: 14, lunge: 4.5 },
  2: { total: 0.44, a0: 0.12, a1: 0.24, chain: 0.26, dmg: 12, poise: 14, lunge: 4.5 },
  3: { total: 0.72, a0: 0.24, a1: 0.38, chain: 0.72, dmg: 28, poise: 42, lunge: 5.5 },
};
const SPEED = 6.5;
const DODGE_DUR = 0.34;
const PARRY_WINDOW = 0.24;
const PARRY_DUR = 0.38;

export class Player {
  readonly group = new THREE.Group();
  pos = new THREE.Vector3(0, 0, 5.5);
  heading = Math.PI;
  vel = new THREE.Vector3();
  hp = 100;
  maxHp = 100;
  radius = 0.45;
  state: State = 'idle';
  st = 0;
  attackStep: 1 | 2 | 3 = 1;
  private hitDone = false;
  private queued = false;
  invuln = 0;
  parryCd = 0;
  dodgeCd = 0;
  private shootCd = 0;
  private shootPose = 0;
  private dodgeDir = new THREE.Vector3();
  private knock = new THREE.Vector3();
  private parryHitThisState = false;
  combo = 0;
  comboTimer = 0;
  maxCombo = 0;
  parries = 0;
  private runCycle = 0;
  private flash = 0;
  private glow = 0;
  private idleT = 0;
  private anim: Animator;
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  private moveDir = new THREE.Vector3();
  private moveMag = 0;

  constructor(public rig: Rig) {
    this.group.add(rig.root);
    this.group.add(blobShadow(0.55));
    this.anim = new Animator(rig);
  }

  /** VRM などへ見た目を差し替える */
  setRig(rig: Rig) {
    this.group.remove(this.rig.root);
    this.rig.dispose();
    this.rig = rig;
    this.group.add(rig.root);
    this.anim = new Animator(rig);
  }

  reset() {
    this.pos.set(0, 0, 5.5);
    this.heading = Math.PI;
    this.vel.set(0, 0, 0);
    this.hp = this.maxHp;
    this.state = 'idle';
    this.st = 0;
    this.invuln = this.parryCd = this.dodgeCd = this.shootCd = this.shootPose = 0;
    this.combo = this.maxCombo = this.parries = 0;
    this.comboTimer = 0;
    this.flash = this.glow = 0;
    this.rig.setFlash(0);
    this.rig.setWeaponGlow(0);
  }

  get alive() {
    return this.state !== 'dead';
  }
  get center(): THREE.Vector3 {
    return this.tmp2.set(this.pos.x, this.pos.y + this.rig.height * 0.52, this.pos.z);
  }
  forward(out: THREE.Vector3): THREE.Vector3 {
    return out.set(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  registerHit(ctx: Ctx) {
    this.combo++;
    this.comboTimer = 2.4;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    ctx.ui.setCombo(this.combo);
  }

  takeDamage(dmg: number, ctx: Ctx, from?: THREE.Vector3): boolean {
    if (!this.alive) return false;
    if (this.invuln > 0 || this.state === 'dodge') return false;
    this.hp = Math.max(0, this.hp - dmg);
    this.invuln = 0.9;
    this.combo = 0;
    this.comboTimer = 0;
    ctx.ui.setCombo(0);
    ctx.ui.hurt();
    ctx.sfx.hurt();
    ctx.shake(0.6);
    ctx.hitstop(0.06, 0.1);
    this.flash = 1;
    this.knock.set(0, 0, 0);
    if (from) {
      this.knock.set(this.pos.x - from.x, 0, this.pos.z - from.z);
      if (this.knock.lengthSq() > 1e-4) this.knock.normalize().multiplyScalar(7);
    }
    ctx.particles.emit(this.center, { color: 0xff4040, count: 14, speed: 5, size: 0.2, life: 0.4 });
    this.state = 'hit';
    this.st = 0;
    this.queued = false;
    if (this.hp <= 0) {
      this.state = 'dead';
      this.st = 0;
      ctx.onPlayerDead();
    }
    return true;
  }

  /** 動作確認用: 指定段の攻撃を強制的に開始する */
  debugAttack(step: 1 | 2 | 3, ctx: Ctx) {
    this.state = 'idle';
    this.startAttack(step, ctx);
  }

  private startAttack(step: 1 | 2 | 3, ctx: Ctx) {
    this.state = 'attack';
    this.st = 0;
    this.attackStep = step;
    this.hitDone = false;
    this.queued = false;
    const boss = ctx.boss;
    const dx = boss.pos.x - this.pos.x, dz = boss.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (boss.alive && dist < 8) this.heading = Math.atan2(dx, dz);
    else if (this.moveMag > 0.2) this.heading = Math.atan2(this.moveDir.x, this.moveDir.z);
    ctx.sfx.slash(step);
  }

  private doHit(ctx: Ctx) {
    const cfg = ATTACK[this.attackStep];
    const fwd = this.forward(this.tmp);
    const boss = ctx.boss;
    const c = this.center.clone();
    const heavy = this.attackStep === 3;
    // 斬撃の三日月
    const cp = c.clone().addScaledVector(fwd, 1.1);
    ctx.fx.crescent(cp, this.heading, this.attackStep === 1 ? 'h' : this.attackStep === 2 ? 'hr' : 'v', heavy ? 0xff6a2a : 0xff9a3a, heavy ? 1.5 : 1.05);
    if (heavy) ctx.fx.ring(this.pos.clone().addScaledVector(fwd, 1.2), 0xff6a2a, 3, 0.35);
    let hitSomething = false;
    if (boss.alive) {
      const dx = boss.pos.x - this.pos.x, dz = boss.pos.z - this.pos.z;
      const dist = Math.hypot(dx, dz);
      const dot = dist > 1e-4 ? (dx * fwd.x + dz * fwd.z) / dist : 1;
      if (dist < 2.5 + boss.radius && dot > Math.cos(1.35)) {
        boss.takeDamage(cfg.dmg, cfg.poise, ctx);
        ctx.hitstop(heavy ? 0.1 : 0.05, 0.05);
        ctx.shake(heavy ? 0.7 : 0.3);
        const bc = boss.center.clone();
        ctx.particles.emit(bc, { color: 0xffb060, count: heavy ? 36 : 18, speed: heavy ? 11 : 7, size: 0.24, life: 0.5 });
        ctx.particles.emit(bc, { color: 0xff5a2a, count: heavy ? 20 : 8, speed: 4, size: 0.3, life: 0.35, up: 2 });
        ctx.fx.flash(bc, 0xffc070, heavy ? 2.4 : 1.3);
        if (heavy) {
          ctx.fx.pillar(boss.pos, 0xff7a3a, 5, 0.6, 0.4);
          ctx.fx.ring(boss.pos, 0xffb347, 4.5, 0.45);
          ctx.ui.flash(0.2);
        }
        if (heavy) ctx.sfx.heavyHit(); else ctx.sfx.hit();
        this.registerHit(ctx);
        hitSomething = true;
      }
    }
    // 斬撃で弾を消す
    let destroyed = 0;
    for (const b of ctx.bullets.list) {
      if (!b.active || b.owner !== 'boss') continue;
      const dx = b.pos.x - this.pos.x, dz = b.pos.z - this.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 2.6 + b.r) continue;
      const dot = dist > 1e-4 ? (dx * fwd.x + dz * fwd.z) / dist : 1;
      if (dot < Math.cos(1.45)) continue;
      if (Math.abs(b.pos.y - c.y) > 1.7) continue;
      b.active = false;
      if (destroyed < 12) {
        ctx.particles.emit(b.pos, { color: b.color, count: 5, speed: 4, size: 0.18, life: 0.3 });
        if (destroyed < 4) ctx.fx.flash(b.pos, b.color, 1.0, 0.12);
      }
      destroyed++;
    }
    if (destroyed > 0 && !hitSomething) ctx.sfx.hit();
    // 3 段目は炎の斬撃波を飛ばす
    if (this.attackStep === 3) {
      const p = c.clone().addScaledVector(fwd, 0.9);
      ctx.bullets.spawn({ pos: p, vel: fwd.clone().multiplyScalar(14), owner: 'player', kind: 2, r: 0.7, damage: 12, life: 1.1, color: 0xff7a30 });
      ctx.particles.emit(p, { color: 0xff8a30, count: 16, speed: 3, size: 0.28, life: 0.5, dir: fwd, drag: 1 });
    }
  }

  private startDodge(ctx: Ctx) {
    this.state = 'dodge';
    this.st = 0;
    this.queued = false;
    this.parryHitThisState = false;
    if (this.moveMag > 0.15) this.dodgeDir.copy(this.moveDir).normalize();
    else {
      const boss = ctx.boss;
      this.dodgeDir.set(this.pos.x - boss.pos.x, 0, this.pos.z - boss.pos.z);
      if (this.dodgeDir.lengthSq() < 1e-4) this.forward(this.dodgeDir).negate();
      this.dodgeDir.normalize();
    }
    this.heading = Math.atan2(this.dodgeDir.x, this.dodgeDir.z);
    this.dodgeCd = 0.5;
    ctx.sfx.dodge();
    ctx.fx.ring(this.pos, 0x80d0ff, 1.6, 0.25);
  }

  private startParry(ctx: Ctx) {
    this.state = 'parry';
    this.st = 0;
    this.queued = false;
    this.parryHitThisState = false;
    this.parryCd = 0.55;
    const boss = ctx.boss;
    const dx = boss.pos.x - this.pos.x, dz = boss.pos.z - this.pos.z;
    if (Math.hypot(dx, dz) > 0.1) this.heading = Math.atan2(dx, dz);
    this.glow = 0.6;
  }

  private parryCheck(ctx: Ctx) {
    const c = this.center.clone();
    const boss = ctx.boss;
    let n = 0;
    for (const b of ctx.bullets.list) {
      if (!b.active || b.owner !== 'boss' || b.tag !== 0) continue;
      if (b.pos.distanceTo(c) > 2.4 + b.r) continue;
      b.owner = 'reflect';
      b.tag = 1;
      const dir = boss.center.clone().sub(b.pos).normalize();
      const speed = Math.max(b.vel.length() * 1.6, 18);
      b.vel.copy(dir).multiplyScalar(speed);
      b.color.set(0xffe066);
      b.damage = 16;
      b.homing = 5;
      b.gravity = 0;
      b.bounce = false;
      b.life = 4;
      n++;
    }
    if (n > 0) {
      if (!this.parryHitThisState) {
        this.parryHitThisState = true;
        ctx.sfx.parry();
        ctx.hitstop(0.16, 0.08);
        ctx.shake(0.35);
        ctx.ui.showBanner('弾き返し！', '#ffe066');
        ctx.ui.flash(0.25);
        ctx.fx.flash(c, 0xffe066, 3.5, 0.25);
        ctx.fx.ring(this.pos, 0xffe066, 3.2, 0.35);
        this.parries++;
        this.registerHit(ctx);
      }
      ctx.particles.emit(c, { color: 0xffe066, count: Math.min(30, 8 + n * 3), speed: 8, size: 0.24, life: 0.45 });
    }
    // 突進のパリィ
    if (boss.state === 'lunge' && !boss.parried) {
      const d = Math.hypot(boss.pos.x - this.pos.x, boss.pos.z - this.pos.z);
      if (d < 2.6 + boss.radius) {
        boss.parried = true;
        boss.stagger(1.8, ctx);
        boss.takeDamage(30, 0, ctx);
        ctx.ui.showBanner('パリィ！', '#fff0a0', 1.1);
        ctx.ui.flash(0.5);
        ctx.sfx.parry();
        ctx.hitstop(0.22, 0.05);
        ctx.shake(0.9);
        this.parries++;
        this.registerHit(ctx);
        ctx.particles.emit(c, { color: 0xfff0a0, count: 48, speed: 11, size: 0.3, life: 0.6 });
        ctx.fx.flash(c, 0xfff0a0, 5, 0.3);
        ctx.fx.pillar(this.pos, 0xffe066, 7, 0.9, 0.5);
        ctx.fx.ring(this.pos, 0xfff0a0, 5, 0.5);
      }
    }
  }

  private tryShoot(ctx: Ctx) {
    const input = ctx.input;
    if (this.shootCd > 0) return;
    if (!(input.consume('shoot') || input.isHeld('shoot'))) return;
    const boss = ctx.boss;
    if (!boss.alive) return;
    const dx = boss.pos.x - this.pos.x, dz = boss.pos.z - this.pos.z;
    if (this.moveMag < 0.2) this.heading = Math.atan2(dx, dz);
    const fwd = this.forward(this.tmp);
    // 左手（キャラの +X）から撃つ
    const hand = this.center.clone().add(new THREE.Vector3(Math.cos(this.heading) * 0.35, 0.1, -Math.sin(this.heading) * 0.35)).addScaledVector(fwd, 0.4);
    const target = boss.center.clone();
    const dir = target.sub(hand).normalize();
    ctx.bullets.spawn({ pos: hand, vel: dir.multiplyScalar(24), owner: 'player', kind: 2, r: 0.26, damage: 4, life: 1.5, color: 0xffa040 });
    ctx.particles.emit(hand, { color: 0xffc080, count: 6, speed: 2, size: 0.14, life: 0.25 });
    ctx.fx.flash(hand, 0xffa040, 0.9, 0.1);
    this.shootCd = 0.28;
    this.shootPose = 0.3;
    ctx.sfx.shoot();
  }

  update(dt: number, ctx: Ctx) {
    const input = ctx.input;
    this.st += dt;
    this.idleT += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.parryCd = Math.max(0, this.parryCd - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.shootCd = Math.max(0, this.shootCd - dt);
    this.shootPose = Math.max(0, this.shootPose - dt);
    this.flash = Math.max(0, this.flash - dt * 6);
    this.glow = Math.max(0, this.glow - dt * 3);
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0 && this.combo > 0) { this.combo = 0; ctx.ui.setCombo(0); }
    }

    // カメラ基準の移動方向
    const yaw = ctx.camYaw;
    const mx = input.move.x, my = input.move.y;
    this.moveMag = clamp(Math.hypot(mx, my), 0, 1);
    // 前 = (sin yaw, 0, cos yaw)、右 = 前 × 上 = (-cos yaw, 0, sin yaw)
    this.moveDir.set(Math.sin(yaw) * my - Math.cos(yaw) * mx, 0, Math.cos(yaw) * my + Math.sin(yaw) * mx);

    const canAct = this.alive && this.state !== 'hit';
    const inFree = this.state === 'idle' || this.state === 'run';

    // 状態ごとの処理
    if (inFree) {
      const targetV = this.moveDir.clone().multiplyScalar(SPEED * (this.shootPose > 0 ? 0.6 : 1));
      this.vel.x = damp(this.vel.x, targetV.x, 12, dt);
      this.vel.z = damp(this.vel.z, targetV.z, 12, dt);
      if (this.moveMag > 0.1) {
        this.heading = dampAngle(this.heading, Math.atan2(this.moveDir.x, this.moveDir.z), 14, dt);
        this.runCycle += dt * 11 * this.moveMag;
        this.state = 'run';
      } else {
        this.state = 'idle';
      }
    } else if (this.state === 'attack') {
      const cfg = ATTACK[this.attackStep];
      const fwd = this.forward(this.tmp);
      const lungeV = this.st < cfg.a1 ? cfg.lunge : 0;
      this.vel.x = damp(this.vel.x, fwd.x * lungeV, 10, dt);
      this.vel.z = damp(this.vel.z, fwd.z * lungeV, 10, dt);
      if (this.st >= cfg.a0 && !this.hitDone) {
        this.hitDone = true;
        this.glow = 1;
        this.doHit(ctx);
      }
      if (this.attackStep < 3 && this.st > cfg.a0 * 0.5 && input.consume('attack')) this.queued = true;
      if (this.queued && this.st >= cfg.chain && this.attackStep < 3) {
        this.startAttack((this.attackStep + 1) as 1 | 2 | 3, ctx);
      } else if (this.st >= cfg.total) {
        this.state = 'idle';
        this.st = 0;
      }
    } else if (this.state === 'dodge') {
      const k = 1 - easeInCubic(this.st / DODGE_DUR) * 0.7;
      this.vel.copy(this.dodgeDir).multiplyScalar(16 * k);
      this.invuln = Math.max(this.invuln, 0.02);
      if (this.st < 0.26) ctx.particles.emit(this.center, { color: 0x80d0ff, count: 2, speed: 0.5, size: 0.35, life: 0.3, drag: 6 });
      if (this.st >= DODGE_DUR) { this.state = 'idle'; this.st = 0; }
    } else if (this.state === 'parry') {
      this.vel.multiplyScalar(Math.max(0, 1 - dt * 10));
      if (this.st < PARRY_WINDOW) this.parryCheck(ctx);
      if (this.st >= PARRY_DUR) { this.state = 'idle'; this.st = 0; }
    } else if (this.state === 'hit') {
      this.vel.copy(this.knock).multiplyScalar(Math.max(0, 1 - this.st / 0.35));
      if (this.st >= 0.4) { this.state = 'idle'; this.st = 0; }
    } else if (this.state === 'dead') {
      this.vel.multiplyScalar(Math.max(0, 1 - dt * 6));
    }

    // 行動入力（優先順: 回避 > 受け流し > 攻撃 > 射撃）
    if (canAct) {
      const attackCfg = this.state === 'attack' ? ATTACK[this.attackStep] : null;
      const canCancelToDodge = inFree || this.state === 'parry' && this.st > 0.2 || (attackCfg !== null && this.st > attackCfg.a0);
      const canCancelToParry = inFree || (attackCfg !== null && this.st > attackCfg.a1);
      if (this.dodgeCd <= 0 && canCancelToDodge && input.consume('dodge')) this.startDodge(ctx);
      else if (this.parryCd <= 0 && canCancelToParry && input.consume('parry')) this.startParry(ctx);
      else if (inFree && input.consume('attack')) this.startAttack(1, ctx);
      else if (inFree) this.tryShoot(ctx);
    }

    // 移動と場外制限
    this.pos.addScaledVector(this.vel, dt);
    const lim = ctx.arenaR - 0.6;
    const d = Math.hypot(this.pos.x, this.pos.z);
    if (d > lim) { this.pos.x *= lim / d; this.pos.z *= lim / d; }

    // アニメーション
    let pose: Pose;
    let rate = 14;
    switch (this.state) {
      case 'run': pose = poseRun(this.runCycle, this.moveMag); break;
      case 'attack': pose = poseAttack(this.attackStep, this.st / ATTACK[this.attackStep].total); rate = 24; break;
      case 'dodge': pose = poseDodge(); rate = 18; break;
      case 'parry': pose = poseParry(); rate = 26; break;
      case 'hit': pose = poseHit(); rate = 18; break;
      case 'dead': pose = poseDead(this.rig.hipsHeight); rate = 6; break;
      default: pose = poseIdle(this.idleT); break;
    }
    if (this.shootPose > 0 && (this.state === 'idle' || this.state === 'run')) pose = poseShoot(pose);
    const fwd = this.forward(this.tmp);
    const velF = this.vel.x * fwd.x + this.vel.z * fwd.z;
    this.anim.apply(pose, rate, dt, velF);
    this.rig.update(dt);
    this.group.position.copy(this.pos);
    this.rig.root.rotation.y = this.heading;
    // 刀の軌跡と火の粉（振り抜き中）
    if (this.state === 'attack' && this.rig.weapon) {
      const cfg = ATTACK[this.attackStep];
      if (this.st > cfg.a0 - 0.06 && this.st < cfg.a1 + 0.06) {
        this.group.updateMatrixWorld(true);
        const w = this.rig.weapon;
        const b = w.group.localToWorld(w.base.clone());
        const t = w.group.localToWorld(w.tip.clone());
        // 軌跡は刀身より少し外まで伸ばして派手に
        t.sub(b).multiplyScalar(1.45).add(b);
        ctx.fx.playerTrail.push(b, t);
        ctx.particles.emit(t, { color: 0xff9a40, count: 2, speed: 1.5, size: 0.15, life: 0.3, drag: 3, up: 0.5 });
      }
    }
    // 無敵中の点滅
    const blink = this.invuln > 0 && this.invuln < 2 && this.state !== 'dodge' && this.alive ? (Math.sin(this.idleT * 40) > 0 ? 0.35 : 0) : 0;
    this.rig.setFlash(Math.max(this.flash, blink));
    this.rig.setWeaponGlow(this.glow);

    ctx.ui.setPlayerHp(this.hp / this.maxHp);
    input.setCooldown('dodge', this.dodgeCd > 0);
    input.setCooldown('parry', this.parryCd > 0);
  }
}
