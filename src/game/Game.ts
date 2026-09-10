import * as THREE from 'three';
import { Input } from './Input';
import { UI } from './UI';
import { Sfx } from './Audio';
import { Bullets } from './Bullets';
import { Particles } from './Particles';
import { createArena, type ArenaResult } from './Arena';
import { createFigure } from './Figure';
import { Fx } from './Fx';
import { Player } from './Player';
import { Boss } from './Boss';
import { tryLoadVrm } from './VrmRig';
import type { Ctx } from './Ctx';
import { damp, rand } from './util';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

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
  private particles = new Particles(900);
  private fx = new Fx();
  private composer: EffectComposer;
  private bloomOn = true;
  private lowFpsSec = 0;
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
    this.scene.add(this.arena.group, this.bullets.group, this.particles.points, this.fx.group);

    // ブルーム（発光）。重い端末では自動で切る
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.75, 0.55, 0.82));
    this.composer.addPass(new OutputPass());
    if (new URLSearchParams(location.search).has('nobloom')) this.bloomOn = false;

    this.player = new Player(createFigure({
      hair: 0x1a1020, hairTip: 0xff4a1a, eye: 0xff6a2a, top: 0xf8f0ea, sleeve: 0xd8302a, skirt: 0xd0281e, accent: 0xffb347, socks: 0x1a1020,
      hairStyle: 'ponytail', weapon: 'knife',
    }));
    this.boss = new Boss(createFigure({
      hair: 0xf0e8ff, hairTip: 0xa060ff, eye: 0xc040ff, skin: 0xfff0f4, top: 0x2a1040, sleeve: 0x4a2080, skirt: 0x3a1560, accent: 0xff60d0, socks: 0x2a1040,
      hairStyle: 'long', horns: true, weapon: 'staff',
    }));
    this.boss.attachFx(this.fx);
    this.scene.add(this.player.group, this.boss.group);

    this.ui = new UI(container);
    this.input = new Input(container);
    this.ctx = {
      bullets: this.bullets, particles: this.particles, fx: this.fx, sfx: this.sfx, ui: this.ui, input: this.input,
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
    // ?model=名前 で public/models/<名前>.glb（骨なしメッシュ）を自動リグして主人公にする
    // ヘッドレス Chrome の仮想時間では createImageBitmap が返ってこないので、?nobitmap で無効化できるようにする
    if (q.has('nobitmap')) (window as unknown as { createImageBitmap?: unknown }).createImageBitmap = undefined;
    // public/models/player.vrm があれば主人公を VRM にする（早送りより先に済ませる）
    const model = q.get('model');
    if (!model && !q.has('novrm')) {
      try {
        const rig = await tryLoadVrm(`${import.meta.env.BASE_URL}models/player.vrm`);
        if (rig) this.player.setRig(rig);
      } catch (e) {
        console.warn('VRM の読み込みに失敗。標準キャラを使います', e);
      }
    }
    if (model) {
      try {
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const { autoRig } = await import('./AutoRig');
        const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/${model}.glb`);
        let mesh: THREE.Mesh | null = null;
        gltf.scene.traverse((o) => { if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh; });
        if (mesh) this.player.setRig(autoRig(mesh, { height: 1.65, weapon: true }));
        console.info(`model ${model} loaded in ${performance.now().toFixed(0)}ms`);
      } catch (e) {
        console.warn('モデルの読み込みに失敗', e);
      }
    }
    if (q.has('bot')) this.input.bot = true;
    if (q.has('autostart') || q.has('t')) {
      setTimeout(() => {
        this.start();
        if (q.has('t')) this.ui.hideTitleNow();
        const ff = Number(q.get('t') ?? 0);
        for (let i = 0; i < ff * 60; i++) this.step(1 / 60);
        // ?slash=1..3 で早送り後に斬撃の途中で止める
        const slash = Number(q.get('slash') ?? 0);
        if (slash >= 1 && slash <= 5) {
          this.player.invuln = 5;
          this.player.debugAttack(slash as 1 | 2 | 3 | 4 | 5, this.ctx);
          const frames = Number(q.get('f') ?? 14);
          for (let i = 0; i < frames; i++) this.step(1 / 60);
          const r = this.player.rig;
          console.info(`slash dbg step=${slash} st=${this.player.st.toFixed(3)} state=${this.player.state} upperLegR=${r.upperLegR.rotation.x.toFixed(2)} lowerLegR=${r.lowerLegR.rotation.x.toFixed(2)} upperArmL=${r.upperArmL.rotation.toArray().slice(0, 3).map((v) => Number(v).toFixed(2)).join(',')}`);
        }
      }, 300);
    }
  }

  private resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    // 縦画面では縦の画角を広げて視野を確保する
    this.camera.fov = this.camera.aspect < 1 ? Math.min(78, FOV / Math.sqrt(this.camera.aspect)) : FOV;
    this.camera.updateProjectionMatrix();
    this.composer.setSize(w, h);
    this.particles.setViewport(h * this.renderer.getPixelRatio(), this.camera.fov);
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
    this.fx.clear();
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
    if (this.fpsAcc >= 1) {
      const fps = this.fpsN / this.fpsAcc;
      this.ui.setFps(fps);
      this.fpsAcc = 0; this.fpsN = 0;
      // 3 秒続けて 35fps を下回ったらブルームを切る
      if (this.bloomOn && this.state === 'play') {
        this.lowFpsSec = fps < 35 ? this.lowFpsSec + 1 : 0;
        if (this.lowFpsSec >= 3) { this.bloomOn = false; console.info('低フレームレートのためブルームを無効化'); }
      }
    }
    this.step(real);
    if (this.bloomOn) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
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
    this.fx.update(dt);

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
        const d = this.distToCapsule(b.pos, pl.pos.x, pl.pos.z, pl.pos.y + 0.25, pl.pos.y + pl.rig.height * 0.85);
        if (d < b.r + pl.radius) {
          if (pl.takeDamage(b.damage, this.ctx, b.pos)) {
            b.active = false;
            this.particles.emit(b.pos, { color: b.color, count: 6, speed: 3, size: 0.18, life: 0.3 });
          }
        }
      } else {
        if (!bo.alive) continue;
        const hover = bo.rig.root.position.y;
        const d = this.distToCapsule(b.pos, bo.pos.x, bo.pos.z, bo.pos.y + hover + 0.2, bo.pos.y + hover + bo.rig.height * 0.95);
        if (d < b.r + bo.radius) {
          const reflected = b.owner === 'reflect';
          bo.takeDamage(b.damage, reflected ? 18 : 3, this.ctx);
          b.active = false;
          this.particles.emit(b.pos, { color: b.color, count: reflected ? 20 : 8, speed: reflected ? 8 : 3, size: 0.22, life: 0.35 });
          this.fx.flash(b.pos, b.color, reflected ? 2.4 : 1.2, 0.15);
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
    const debugCam = new URLSearchParams(location.search).get('cam');
    if (debugCam === 'front' || debugCam === 'boss' || debugCam === 'side' || debugCam === 'side2' || debugCam === 'q') {
      // 動作確認用: キャラのアップ。front=正面、side=キャラの左側から、side2=右側から、q=斜め前
      const t = debugCam === 'boss' ? bo : pl;
      const off = debugCam === 'side' ? Math.PI / 2 : debugCam === 'side2' ? -Math.PI / 2 : debugCam === 'q' ? Math.PI / 4 : 0;
      const yaw = t.heading + off;
      desired = new THREE.Vector3(t.pos.x + Math.sin(yaw) * 3.2, t.pos.y + 1.5, t.pos.z + Math.cos(yaw) * 3.2);
      look = new THREE.Vector3(t.pos.x, t.pos.y + 1.0, t.pos.z);
    } else if (this.state === 'title') {
      const a = this.time * 0.15;
      desired = new THREE.Vector3(Math.sin(a) * 11, 3.5, Math.cos(a) * 11);
      look = new THREE.Vector3(0, 1.2, 0);
    } else {
      // ロックオン式: ボスを背にしない位置へ回り込む
      const toB = this.tmp.set(bo.pos.x - pl.pos.x, 0, bo.pos.z - pl.pos.z);
      const len = toB.length();
      const dir = len > 0.05 ? toB.divideScalar(len) : pl.forward(new THREE.Vector3());
      // 縦画面では少し引く
      const k = this.camera.aspect < 1 ? 1.3 : 1;
      desired = new THREE.Vector3(pl.pos.x - dir.x * 6.6 * k, pl.pos.y + 3.7 * k, pl.pos.z - dir.z * 6.6 * k);
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
    // カメラに被る灯籠は隠す
    for (const l of this.arena.lanterns) {
      l.visible = Math.hypot(l.position.x - this.camPos.x, l.position.z - this.camPos.z) > 2.8;
    }
    void dt;
  }
}
