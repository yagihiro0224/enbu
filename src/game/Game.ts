import * as THREE from 'three';
import { Input } from './Input';
import { UI } from './UI';
import { Sfx } from './Audio';
import { Bullets } from './Bullets';
import { Particles } from './Particles';
import { createArena, type ArenaResult } from './Arena';
import { createChibi } from './Chibi';
import { Player } from './Player';
import { Boss } from './Boss';
import { tryLoadVrm } from './VrmRig';
import type { Ctx } from './Ctx';
import { damp, rand } from './util';

const ARENA_R = 14;
const FOV = 50;

type GState = 'title' | 'play' | 'over';

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private input: Input;
  private ui: UI;
  private sfx = new Sfx();
  private bullets = new Bullets();
  private particles = new Particles(700);
  private arena: ArenaResult;
  private player: Player;
  private boss: Boss;
  private ctx: Ctx;
  private state: GState = 'title';
  private time = 0;
  private playTime = 0;
  private slowT = 0;
  private slowScale = 1;
  private shakeV = 0;
  private camPos = new THREE.Vector3(0, 4, 12);
  private camLook = new THREE.Vector3(0, 1, 0);
  private camYaw = Math.PI;
  private overTimer = 0;
  private overWin = false;
  private lastFrame = performance.now();
  private fpsAcc = 0;
  private fpsN = 0;
  private tmp = new THREE.Vector3();

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(FOV, window.innerWidth / window.innerHeight, 0.1, 400);
    this.scene.fog = new THREE.Fog(0x2a0f30, 30, 110);
    this.scene.background = new THREE.Color(0x1a0b14);

    this.arena = createArena(ARENA_R);
    this.scene.add(this.arena.group, this.bullets.group, this.particles.points);

    this.player = new Player(createChibi({
      hair: 0x2a1a2e, hairAccent: 0xff5a2a, eye: 0xff7a3a, top: 0xf6f0f0, skirt: 0xd8302a, accent: 0xffb347,
      hairStyle: 'twin', weapon: 'katana',
    }));
    this.boss = new Boss(createChibi({
      hair: 0xe8dcff, hairAccent: 0xa060ff, eye: 0xc040ff, skin: 0xfff0f4, top: 0x2a1040, skirt: 0x5a2090, accent: 0xff60d0,
      hairStyle: 'long', horns: true, weapon: 'staff',
    }));
    this.scene.add(this.player.group, this.boss.group);

    this.ui = new UI(container);
    this.input = new Input(container);
    this.ctx = {
      bullets: this.bullets, particles: this.particles, sfx: this.sfx, ui: this.ui, input: this.input,
      arenaR: ARENA_R, time: 0, camYaw: this.camYaw, player: this.player, boss: this.boss,
      hitstop: (sec, scale = 0.05) => { if (sec >= this.slowT) { this.slowT = sec; this.slowScale = scale; } },
      shake: (a) => { this.shakeV = Math.min(1.5, this.shakeV + a); },
      onBossDead: () => this.finish(true),
      onPlayerDead: () => this.finish(false),
    };

    this.ui.onStart = () => this.start();
    this.ui.onRetry = () => this.restart();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    document.addEventListener('visibilitychange', () => { this.lastFrame = performance.now(); });
    this.resize();
  }

  async init() {
    this.renderer.setAnimationLoop(() => this.frame());
    // 動作確認用: ?autostart で即開始、?t=秒 でその時間まで早送り、?bot で自動操作
    const q = new URLSearchParams(location.search);
    if (q.has('bot')) this.input.bot = true;
    if (q.has('autostart') || q.has('t')) {
      setTimeout(() => {
        this.start();
        const ff = Number(q.get('t') ?? 0);
        for (let i = 0; i < ff * 60; i++) this.step(1 / 60);
      }, 300);
    }
    try {
      const rig = await tryLoadVrm(`${import.meta.env.BASE_URL}models/player.vrm`);
      if (rig) this.player.setRig(rig);
    } catch (e) {
      console.warn('VRM の読み込みに失敗。ちびキャラを使います', e);
    }
  }

  private resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.particles.setViewport(h * this.renderer.getPixelRatio(), FOV);
  }

  private start() {
    if (this.state !== 'title') return;
    this.sfx.unlock();
    this.sfx.start();
    this.ui.hideTitle();
    this.tryFullscreen();
    this.beginPlay();
  }

  private restart() {
    this.ui.hideResult();
    this.bullets.clear();
    this.particles.clear();
    this.player.reset();
    this.boss.reset();
    this.ui.setBossHp(1);
    this.ui.setPlayerHp(1);
    this.ui.setCombo(0);
    this.slowT = 0;
    this.slowScale = 1;
    this.sfx.start();
    this.beginPlay();
  }

  private beginPlay() {
    this.state = 'play';
    this.playTime = 0;
    this.input.reset();
    this.input.enabled = true;
    this.ui.showBanner('浄化開始', '#ffd6c0', 1.2);
  }

  private finish(win: boolean) {
    if (this.state !== 'play') return;
    this.state = 'over';
    this.overWin = win;
    this.overTimer = 0;
    this.input.enabled = false;
    this.input.reset();
    this.ctx.hitstop(2.2, 0.3);
    if (win) { this.sfx.win(); this.ui.showBanner('浄化', '#ffe08a', 2); this.ui.flash(0.8); }
    else { this.sfx.lose(); this.ui.showBanner('散華', '#c0a0ff', 2); }
  }

  private tryFullscreen() {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    try {
      const p = el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.();
      p?.then(() => {
        const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
        o.lock?.('landscape').catch(() => {});
      }).catch(() => {});
    } catch { /* iOS では不可 */ }
  }

  private frame() {
    const now = performance.now();
    const real = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.fpsAcc += real; this.fpsN++;
    if (this.fpsAcc >= 1) { this.ui.setFps(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }
    this.step(real);
    this.renderer.render(this.scene, this.camera);
  }

  /** 実時間 real 秒ぶんゲームを進める */
  private step(real: number) {
    let scale = 1;
    if (this.slowT > 0) { this.slowT -= real; scale = this.slowScale; if (this.slowT <= 0) this.slowScale = 1; }
    const dt = real * scale;
    this.time += dt;
    this.ctx.time = this.time;
    this.ctx.camYaw = this.camYaw;

    this.input.update(real);
    this.ui.update(real);
    this.arena.update(dt);

    const playing = this.state === 'play';
    if (playing) this.playTime += dt;
    if (this.state === 'over') {
      this.overTimer += real;
      if (this.overTimer > 2.8 && this.overTimer - real <= 2.8) {
        this.ui.showResult(this.overWin, this.playTime, this.player.maxCombo, this.player.parries);
      }
    }

    this.player.update(dt, this.ctx);
    this.boss.update(dt, this.ctx, playing);
    this.bullets.update(dt, (b) => (b.owner === 'boss' ? this.player.center : this.boss.alive ? this.boss.center : null), ARENA_R);
    if (playing) this.collide();
    this.particles.update(dt);

    this.updateCamera(real, dt);
  }

  /** 線分 (x, y0..y1, z) と点の距離 */
  private distToCapsule(p: THREE.Vector3, x: number, z: number, y0: number, y1: number) {
    const y = Math.max(y0, Math.min(y1, p.y));
    return Math.hypot(p.x - x, p.y - y, p.z - z);
  }

  private collide() {
    const pl = this.player, bo = this.boss;
    for (const b of this.bullets.list) {
      if (!b.active) continue;
      if (b.owner === 'boss') {
        if (!pl.alive || pl.invuln > 0 || pl.state === 'dodge') continue;
        const d = this.distToCapsule(b.pos, pl.pos.x, pl.pos.z, pl.pos.y + 0.25, pl.pos.y + 1.35);
        if (d < b.r + pl.radius) {
          if (pl.takeDamage(b.damage, this.ctx, b.pos)) {
            b.active = false;
            this.particles.emit(b.pos, { color: b.color, count: 6, speed: 3, size: 0.18, life: 0.3 });
          }
        }
      } else {
        if (!bo.alive) continue;
        const d = this.distToCapsule(b.pos, bo.pos.x, bo.pos.z, bo.pos.y + 0.2, bo.pos.y + 1.7);
        if (d < b.r + bo.radius) {
          const reflected = b.owner === 'reflect';
          bo.takeDamage(b.damage, reflected ? 18 : 3, this.ctx);
          b.active = false;
          this.particles.emit(b.pos, { color: b.color, count: reflected ? 16 : 6, speed: reflected ? 7 : 3, size: 0.2, life: 0.35 });
          pl.registerHit(this.ctx);
          if (reflected) { this.ctx.shake(0.3); this.ctx.hitstop(0.04, 0.1); this.sfx.hit(); }
        }
      }
    }
  }

  private updateCamera(real: number, dt: number) {
    const pl = this.player, bo = this.boss;
    let desired: THREE.Vector3;
    let look: THREE.Vector3;
    if (this.state === 'title') {
      const a = this.time * 0.15;
      desired = new THREE.Vector3(Math.sin(a) * 11, 3.5, Math.cos(a) * 11);
      look = new THREE.Vector3(0, 1.2, 0);
    } else {
      // ロックオン式: ボスを背にしない位置へ回り込む
      const toB = this.tmp.set(bo.pos.x - pl.pos.x, 0, bo.pos.z - pl.pos.z);
      const len = toB.length();
      const dir = len > 0.05 ? toB.divideScalar(len) : pl.forward(new THREE.Vector3());
      desired = new THREE.Vector3(pl.pos.x - dir.x * 6.6, pl.pos.y + 3.7, pl.pos.z - dir.z * 6.6);
      look = new THREE.Vector3(pl.pos.x, pl.pos.y + 1.1, pl.pos.z).addScaledVector(dir, Math.min(len, 10) * 0.4);
      if (!bo.alive) { desired.y += 1; }
    }
    const rate = this.state === 'title' ? 2 : 5;
    this.camPos.x = damp(this.camPos.x, desired.x, rate, real);
    this.camPos.y = damp(this.camPos.y, desired.y, rate, real);
    this.camPos.z = damp(this.camPos.z, desired.z, rate, real);
    this.camLook.x = damp(this.camLook.x, look.x, 8, real);
    this.camLook.y = damp(this.camLook.y, look.y, 8, real);
    this.camLook.z = damp(this.camLook.z, look.z, 8, real);
    this.shakeV = Math.max(0, this.shakeV - real * 3);
    const s = this.shakeV * this.shakeV * 0.35;
    this.camera.position.set(this.camPos.x + rand(-s, s), Math.max(0.8, this.camPos.y + rand(-s, s)), this.camPos.z + rand(-s, s));
    this.camera.lookAt(this.camLook);
    this.camYaw = Math.atan2(this.camLook.x - this.camPos.x, this.camLook.z - this.camPos.z);
    void dt;
  }
}
