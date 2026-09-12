import * as THREE from 'three';
import type { Rig } from './Rig';
import { Animator, poseIdle, poseRun, poseDodge, poseParry, poseShoot, poseHit, poseDead, poseVictory, type Pose } from './Anim';
import { STYLES, type FightStyle, type Step } from './Style';
import { blobShadow } from './Toon';
import { clamp, damp, dampAngle, easeInCubic } from './util';
import type { Ctx } from './Ctx';

type State = 'idle' | 'run' | 'attack' | 'dodge' | 'parry' | 'hit' | 'dead' | 'win';

const SPEED = 6.5;
const DODGE_DUR = 0.34;
const PARRY_WINDOW = 0.24;
const PARRY_DUR = 0.38;

/**
 * 必殺ゲージの溜まり方。1.0 で満タン。
 * 一戦で 1 回ぶん溜まるくらいを狙っている。殴るだけでは届かず、
 * 受け流しや被弾も混ぜないと満タンにならない重さにしてある
 */
const SUPER_PER_HIT = 0.016;        // 打撃 1 発（63 発で満タン）
const SUPER_PER_MELEE_PARRY = 0.07; // 突進のパリィ
const SUPER_PER_BULLET_PARRY = 0.03; // 弾のパリィ
const SUPER_PER_DAMAGE = 0.08;      // 被弾

/** 敵から受けるダメージの倍率。難易度調整（2026-09-11 に 1.0 → 1.2、2026-09-12 にさらに 1.3 倍して 1.56） */
const ENEMY_DMG_MUL = 1.56;

export class Player {
  readonly group = new THREE.Group();
  /** 戦闘スタイル（キャラごとに差し替える） */
  style: FightStyle = STYLES.mahiro;
  pos = new THREE.Vector3(0, 0, 5.5);
  heading = Math.PI;
  vel = new THREE.Vector3();
  hp = 100;
  maxHp = 100;
  radius = 0.45;
  state: State = 'idle';
  st = 0;
  attackStep: Step = 1;
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
  /** スコア集計用のカウンタ（Game がリザルトで読む） */
  meleeHits = 0;
  meleeParries = 0;
  bulletParries = 0;
  damaged = false;
  /** 必殺ゲージ 0..1。満タンで合体必殺技が撃てる */
  superGauge = 0;
  private runCycle = 0;
  private flash = 0;
  private glow = 0;
  private idleT = 0;
  private anim: Animator;
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  private moveDir = new THREE.Vector3();
  private moveMag = 0;
  private lastPos = new THREE.Vector3(0, 0, 5.5);

  constructor(public rig: Rig) {
    this.group.add(rig.root);
    this.group.add(blobShadow(0.55));
    this.anim = new Animator(rig);
  }

  /** VRM などへ見た目を差し替える。keepOld を付けると元のリグを破棄しない（交代用） */
  setRig(rig: Rig, keepOld = false) {
    this.group.remove(this.rig.root);
    if (!keepOld) this.rig.dispose();
    this.rig = rig;
    this.group.add(rig.root);
    rig.root.rotation.y = this.heading;
    this.anim = new Animator(rig);
    // 格闘スタイルなので両手は常に握る（右手はナイフのグリップ）
    rig.setFist?.(1, 1);
    this.rig.setFlash(0);
    this.rig.setWeaponGlow(0);
    this.group.updateMatrixWorld(true);
    rig.resetSprings?.();
  }

  /** 勝利ポーズに入る */
  startWin() {
    this.state = 'win';
    this.st = 0;
    this.vel.set(0, 0, 0);
    this.rig.setFlash(0);
    this.rig.setWeaponGlow(0);
  }

  /** 交代できる状態か（待機・移動中のみ） */
  get canSwap() {
    return this.alive && (this.state === 'idle' || this.state === 'run');
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
    this.meleeHits = this.meleeParries = this.bulletParries = 0;
    this.damaged = false;
    this.superGauge = 0;
    this.comboTimer = 0;
    this.flash = this.glow = 0;
    this.rig.setFlash(0);
    this.rig.setWeaponGlow(0);
    this.group.position.copy(this.pos);
    this.group.updateMatrixWorld(true);
    this.rig.resetSprings?.();
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

  /** 必殺ゲージを溜める */
  addSuper(v: number) {
    this.superGauge = Math.min(1, this.superGauge + v);
  }
  /** 必殺ゲージが満タンか */
  get superReady() {
    return this.superGauge >= 1;
  }
  /** 必殺技を使ってゲージを空にする */
  spendSuper() {
    this.superGauge = 0;
  }

  takeDamage(dmg: number, ctx: Ctx, from?: THREE.Vector3): boolean {
    if (!this.alive) return false;
    if (this.invuln > 0 || this.state === 'dodge') return false;
    // 敵から受けるダメージはすべてここを通るので、難易度の倍率もここで掛ける
    this.hp = Math.max(0, this.hp - dmg * ENEMY_DMG_MUL);
    this.damaged = true;
    this.addSuper(SUPER_PER_DAMAGE);
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

  /** 回復する。上限を超えない */
  heal(amount: number, ctx: Ctx) {
    if (!this.alive) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.healFlash = 1;
    ctx.ui.setPlayerHp(this.hp / this.maxHp);
  }
  private healFlash = 0;

  /** 動作確認用: 指定段の攻撃を強制的に開始する */
  debugAttack(step: Step, ctx: Ctx) {
    this.state = 'idle';
    this.startAttack(step, ctx);
  }

  /** 動作確認用: 毎フレーム呼ぶと 5 段を最速で繋ぐ。終わったら true */
  debugComboTick(ctx: Ctx): boolean {
    if (this.state === 'idle' || this.state === 'run') {
      if (this.attackStep === 5 && this.comboDone) return true;
      this.comboDone = false;
      this.startAttack(1, ctx);
      return false;
    }
    if (this.state === 'attack') {
      const cfg = this.style.attacks[this.attackStep];
      if (this.attackStep < 5 && this.st >= cfg.chain) this.startAttack((this.attackStep + 1) as Step, ctx);
      else if (this.attackStep === 5 && this.st >= cfg.total - 0.02) this.comboDone = true;
    }
    return false;
  }
  private comboDone = false;

  private startAttack(step: Step, ctx: Ctx) {
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
    const cfg = this.style.attacks[step];
    // 間合いが遠ければ踏み込みで詰める（最大 5.5m）
    this.lungeBoost = 0;
    if (boss.alive && dist > cfg.reach + boss.radius && dist < 5.5) {
      this.lungeBoost = Math.min(14, (dist - cfg.reach - boss.radius + 0.4) / Math.max(0.08, cfg.a0));
    }
    this.style.swing(ctx.sfx, cfg.kind);
    ctx.punch((cfg.kind === 'spin' ? 0.6 : 0.25) * this.style.punch);
  }
  private lungeBoost = 0;

  private doHit(ctx: Ctx) {
    const cfg = this.style.attacks[this.attackStep];
    const fwd = this.forward(this.tmp);
    const boss = ctx.boss;
    const c = this.center.clone();
    const kind = cfg.kind;
    const heavy = kind === 'spin';
    const st = this.style;
    // 演出: 重い型は太い弧と衝撃波、鋭い型は細い斬線と薄い弧
    const cp = c.clone().addScaledVector(fwd, 0.9);
    // 刃物は弧や斬線、拳と蹴りは放射状の衝撃
    if (cfg.trail === 'knife') {
      if (st.sharp) {
        if (kind === 'spin') { ctx.fx.crescent(cp, this.heading, 'h', st.color, 1.1); ctx.fx.line(cp, this.heading, 0.1, st.hot, 3.2, 0.18); }
        else ctx.fx.line(cp, this.heading, this.attackStep === 2 ? -0.9 : 0.9, st.hot, 2.6, 0.14);
      } else {
        ctx.fx.crescent(cp, this.heading, 'h', st.color, kind === 'spin' ? 1.6 : 0.95);
      }
    } else {
      ctx.fx.impact(cp, st.hot, heavy ? 2.6 : kind === 'kick' ? 1.9 : 1.35, st.sharp);
      if (kind !== 'punch') ctx.fx.ring(this.pos.clone().addScaledVector(fwd, 1.0), st.color, heavy ? 3.2 : 1.8, heavy ? 0.4 : 0.25);
    }
    let hitSomething = false;
    if (boss.alive) {
      const dx = boss.pos.x - this.pos.x, dz = boss.pos.z - this.pos.z;
      const dist = Math.hypot(dx, dz);
      const dot = dist > 1e-4 ? (dx * fwd.x + dz * fwd.z) / dist : 1;
      if (dist < cfg.reach + boss.radius && dot > Math.cos(1.2)) {
        boss.takeDamage(cfg.dmg, cfg.poise, ctx);
        this.meleeHits++;
        this.addSuper(SUPER_PER_HIT);
        ctx.hitstop((kind === 'spin' ? 0.16 : kind === 'kick' ? 0.1 : 0.065) * st.hitstop, 0.04);
        ctx.shake((kind === 'spin' ? 0.9 : kind === 'kick' ? 0.55 : 0.38) * st.shake);
        ctx.punch((kind === 'spin' ? 1 : 0.5) * st.punch);
        const bc = boss.center.clone();
        if (st.sharp) {
          // 鋭い: 細く速い火花と斬線
          ctx.particles.emit(bc, { color: st.spark, count: heavy ? 30 : 12, speed: heavy ? 16 : 11, size: 0.11, life: 0.28, drag: 5 });
          if (cfg.trail === 'knife') {
            ctx.fx.flash(bc, st.hot, heavy ? 1.6 : 0.9, 0.1);
            ctx.fx.line(bc, this.heading + 0.6, 0.8, st.hot, heavy ? 3 : 1.8, 0.14);
            ctx.fx.line(bc, this.heading - 0.5, -0.7, st.hot, heavy ? 2.6 : 1.5, 0.12);
          } else {
            ctx.fx.impact(bc, st.hot, heavy ? 2.4 : 1.6, true);
          }
          if (heavy) { ctx.fx.ring(boss.pos, st.color, 3.5, 0.3); ctx.ui.flash(0.15); }
        } else {
          // 重い: 大きな火花と閃光、地面の衝撃波
          ctx.particles.emit(bc, { color: st.spark, count: heavy ? 40 : 18, speed: heavy ? 11 : 6, size: 0.26, life: 0.5 });
          ctx.particles.emit(bc, { color: st.color, count: heavy ? 24 : 8, speed: 4, size: 0.32, life: 0.4, up: 2 });
          if (cfg.trail === 'knife') ctx.fx.flash(bc, st.hot, heavy ? 2.8 : 1.6);
          else ctx.fx.impact(bc, st.hot, heavy ? 3.2 : kind === 'kick' ? 2.3 : 1.8, false);
          ctx.fx.ring(boss.pos, st.color, heavy ? 4.5 : 2.2, heavy ? 0.45 : 0.3);
          if (heavy) { ctx.fx.pillar(boss.pos, st.color, 5, 0.6, 0.4); ctx.ui.flash(0.25); }
        }
        st.hit(ctx.sfx, kind, heavy);
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
      if (dist > cfg.reach + 0.3 + b.r) continue;
      const dot = dist > 1e-4 ? (dx * fwd.x + dz * fwd.z) / dist : 1;
      if (dot < Math.cos(1.45)) continue;
      if (Math.abs(b.pos.y - c.y) > 1.7) continue;
      b.active = false;
      if (destroyed < 12) {
        ctx.particles.emit(b.pos, { color: b.color, count: 5, speed: 4, size: 0.18, life: 0.3 });
        if (destroyed < 4) ctx.fx.flash(b.pos, st.hot, 1.0, 0.12);
      }
      destroyed++;
    }
    if (destroyed > 0 && !hitSomething) st.hit(ctx.sfx, kind, false);
    // 5 段目（回し蹴り）は衝撃波を飛ばす
    if (kind === 'spin') {
      const p = c.clone().addScaledVector(fwd, 0.9);
      ctx.bullets.spawn({ pos: p, vel: fwd.clone().multiplyScalar(st.sharp ? 20 : 14), owner: 'player', kind: 2, r: st.sharp ? 0.5 : 0.7, damage: 12, life: 1.1, color: st.hot });
      ctx.particles.emit(p, { color: st.hot, count: 16, speed: 3, size: st.sharp ? 0.16 : 0.28, life: 0.5, dir: fwd, drag: 1 });
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
        this.bulletParries++;
        this.addSuper(SUPER_PER_BULLET_PARRY);
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
        this.meleeParries++;
        this.addSuper(SUPER_PER_MELEE_PARRY);
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
    this.doShoot(ctx);
  }

  /** 検証用に 1 発撃たせる（?shot） */
  debugShoot(ctx: Ctx) {
    this.doShoot(ctx);
  }

  private doShoot(ctx: Ctx) {
    const boss = ctx.boss;
    if (!boss.alive) return;
    const dx = boss.pos.x - this.pos.x, dz = boss.pos.z - this.pos.z;
    if (this.moveMag < 0.2) this.heading = Math.atan2(dx, dz);
    const fwd = this.forward(this.tmp);
    // 左手（キャラの +X）から撃つ
    const hand = this.center.clone().add(new THREE.Vector3(Math.cos(this.heading) * 0.35, 0.1, -Math.sin(this.heading) * 0.35)).addScaledVector(fwd, 0.4);
    const target = boss.center.clone();
    const dir = target.sub(hand).normalize();
    const st = this.style;
    // 弾はスタイルの色で、細く速く
    ctx.bullets.spawn({ pos: hand, vel: dir.clone().multiplyScalar(34), owner: 'player', kind: 2, r: 0.22, damage: 4, life: 1.2, color: st.hot });
    // 銃口の光と、前へ吹く火花
    ctx.fx.flash(hand, st.hot, 2.2, 0.16);
    ctx.fx.flash(hand, 0xffffff, 0.7, 0.08);
    ctx.particles.emit(hand, { color: st.spark, count: 10, speed: 5, size: 0.13, life: 0.22 });
    // 撃った軌跡。敵までの距離ぶん伸ばす
    const reach = Math.min(14, Math.max(3, hand.distanceTo(boss.center)));
    ctx.fx.beam(hand, dir, st.hot, reach, 0.2);
    // 足元に広がる反動の輪
    ctx.fx.ring(this.pos, st.color, 1.4, 0.22);
    // 反動
    this.vel.addScaledVector(fwd, -1.6);
    ctx.punch(0.12 * st.punch);
    ctx.shake(0.12 * st.shake);
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
    this.healFlash = Math.max(0, this.healFlash - dt * 1.6);
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

    const canAct = this.alive && this.state !== 'hit' && this.state !== 'win';
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
      const cfg = this.style.attacks[this.attackStep];
      const fwd = this.forward(this.tmp);
      const lungeV = this.st < cfg.a0 ? cfg.lunge + this.lungeBoost : this.st < cfg.a1 ? cfg.lunge : 0;
      this.vel.x = damp(this.vel.x, fwd.x * lungeV, 10, dt);
      this.vel.z = damp(this.vel.z, fwd.z * lungeV, 10, dt);
      if (this.st >= cfg.a0 && !this.hitDone) {
        this.hitDone = true;
        this.glow = 1;
        this.doHit(ctx);
      }
      if (this.attackStep < 5 && this.st > cfg.a0 * 0.5 && input.consume('attack')) this.queued = true;
      if (this.queued && this.st >= cfg.chain && this.attackStep < 5) {
        this.startAttack((this.attackStep + 1) as Step, ctx);
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
    } else if (this.state === 'dead' || this.state === 'win') {
      this.vel.multiplyScalar(Math.max(0, 1 - dt * 6));
    }

    // 行動入力（優先順: 回避 > 受け流し > 攻撃 > 射撃）
    if (canAct) {
      const attackCfg = this.state === 'attack' ? this.style.attacks[this.attackStep] : null;
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
      case 'attack': pose = this.style.pose(this.attackStep, this.st / this.style.attacks[this.attackStep].total); rate = 50; break;
      case 'dodge': pose = poseDodge(); rate = 18; break;
      case 'parry': pose = poseParry(); rate = 26; break;
      case 'hit': pose = poseHit(); rate = 18; break;
      case 'dead': pose = poseDead(this.rig.hipsHeight); rate = 6; break;
      case 'win': pose = poseVictory(this.st, this.style.sharp); rate = 9; break;
      default: pose = poseIdle(this.idleT); break;
    }
    if (this.shootPose > 0 && (this.state === 'idle' || this.state === 'run')) pose = poseShoot(pose);
    const fwd = this.forward(this.tmp);
    const velF = this.vel.x * fwd.x + this.vel.z * fwd.z;
    this.anim.apply(pose, rate, dt, velF);
    this.rig.update(dt);
    this.group.position.copy(this.pos);
    this.rig.root.rotation.y = this.heading;
    // 位置が一気に飛んだら揺れ物を組み直す（開始位置に戻したときなど）
    if (this.lastPos.distanceToSquared(this.pos) > 4) {
      this.group.updateMatrixWorld(true);
      this.rig.resetSprings?.();
    }
    this.lastPos.copy(this.pos);
    // 軌跡: ナイフは刃、蹴りは右脚（膝→足先）に付ける
    if (this.state === 'attack') {
      const cfg = this.style.attacks[this.attackStep];
      if (this.st > cfg.a0 - 0.06 && this.st < cfg.a1 + 0.06) {
        this.group.updateMatrixWorld(true);
        const sharp = this.style.sharp;
        const pc = this.style.hot;
        if (cfg.trail === 'knife' && this.rig.weapon) {
          const w = this.rig.weapon;
          const b = w.group.localToWorld(w.base.clone());
          const t = w.group.localToWorld(w.tip.clone());
          t.sub(b).multiplyScalar(sharp ? 3.0 : 2.2).add(b);
          ctx.fx.playerTrail.push(b, t);
          ctx.particles.emit(t, { color: pc, count: sharp ? 1 : 2, speed: 1.5, size: sharp ? 0.09 : 0.16, life: 0.3, drag: 3, up: 0.5 });
        } else if (cfg.trail === 'leg') {
          const leg = this.rig.lowerLegR;
          const b = leg.localToWorld(new THREE.Vector3(0, 0, 0));
          const t = leg.localToWorld(new THREE.Vector3(0, -this.rig.height * 0.34, 0));
          ctx.fx.playerTrail.push(b, t);
          ctx.particles.emit(t, { color: pc, count: sharp ? 2 : 3, speed: 1.5, size: sharp ? 0.09 : 0.15, life: 0.25, drag: 3 });
        } else {
          // 拳: 前腕（肘→拳）。左右は trail で選ぶ
          const right = cfg.trail === 'fistR';
          const arm = right ? this.rig.lowerArmR : this.rig.lowerArmL;
          const b = arm.localToWorld(new THREE.Vector3(0, 0, 0));
          const t = arm.localToWorld(new THREE.Vector3((right ? -1 : 1) * this.rig.height * 0.2, 0, 0));
          ctx.fx.playerTrail.push(b, t);
          ctx.particles.emit(t, { color: pc, count: 2, speed: 1.2, size: sharp ? 0.08 : 0.13, life: 0.2, drag: 3 });
        }
      }
    }
    // 無敵中の点滅
    const blink = this.invuln > 0 && this.invuln < 2 && this.state !== 'dodge' && this.alive ? (Math.sin(this.idleT * 40) > 0 ? 0.35 : 0) : 0;
    this.rig.setFlash(Math.max(this.flash, blink));
    // 回復中は淡い光の粒をまとう
    if (this.healFlash > 0 && Math.random() < this.healFlash * 0.7) {
      ctx.particles.emit(this.center, { color: 0x7cffb0, count: 1, speed: 1.2, size: 0.14, life: 0.5, up: 1.4, drag: 1 });
    }
    this.rig.setWeaponGlow(this.glow);

    ctx.ui.setPlayerHp(this.hp / this.maxHp);
    input.setCooldown('dodge', this.dodgeCd > 0);
    input.setCooldown('parry', this.parryCd > 0);
  }
}
