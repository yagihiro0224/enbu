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
import type { Rig } from './Rig';
import { CHARS, type CharId } from './UI';
import { STYLES } from './Style';
import { computeScore, type ScoreResult } from './Score';
import { Ranking, cleanName, type Entry } from './Rank';
import { Items } from './Items';
import { Music } from './Music';
import { Bgm, findBgmFiles, trimRange } from './Bgm';
import { Animator, poseClap } from './Anim';
import type { Ctx } from './Ctx';
import { damp, rand } from './util';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const ARENA_R = 14;
/** 控えているキャラが 1 秒あたりに回復する量 */
const REST_REGEN = 2.5;
const FOV = 50;

type GState = 'title' | 'play' | 'over';

/** 影を落とす設定。輪郭線用の裏面メッシュは除く */
function castShadows(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.name !== 'outline') m.castShadow = true;
  });
}

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
  private items = new Items(ARENA_R, 3);
  /** 体力はキャラごとに持つ。控えは少しずつ回復する */
  private charHp: Record<CharId, number> = { mahiro: 100, chisato: 100 };
  /** 合成 BGM か、public/audio の mp3 のどちらか */
  private music: Music | Bgm | null = null;
  private ranking = new Ranking();
  /** 直前に記録したスコア。リザルトで自分の行を強調するのに使う */
  private myEntry: Entry | null = null;
  /** 置かれている mp3 を調べる非同期処理。起動は止めない */
  private bgmProbe: Promise<string[] | null> = findBgmFiles();
  private musicPending = false;
  /** 音が開く前に指定された濃さを覚えておく */
  private musicLv: 0 | 1 | 2 = 0;
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
  private punchV = 0;
  private baseFov = FOV;
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
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(FOV, window.innerWidth / window.innerHeight, 0.1, 400);
    this.scene.fog = new THREE.Fog(0x2a0f30, 30, 110);
    this.scene.background = new THREE.Color(0x1a0b14);

    this.arena = createArena(ARENA_R);
    this.scene.add(this.arena.group, this.bullets.group, this.particles.points, this.fx.group, this.items.group);

    // ブルーム（発光）。重い端末では自動で切る
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.75, 0.55, 0.82));
    this.composer.addPass(new OutputPass());
    if (new URLSearchParams(location.search).has('nobloom')) this.bloomOn = false;

    this.player = new Player(createFigure({
      hair: 0x1a1020, hairTip: 0xff4a1a, eye: 0xff6a2a, top: 0xf8f0ea, sleeve: 0xd8302a, skirt: 0xd0281e, accent: 0xffb347, socks: 0x1a1020,
      hairStyle: 'ponytail', weapon: 'none',
    }));
    this.boss = new Boss(createFigure({
      hair: 0xf0e8ff, hairTip: 0xa060ff, eye: 0xc040ff, skin: 0xfff0f4, top: 0x2a1040, sleeve: 0x4a2080, skirt: 0x3a1560, accent: 0xff60d0, socks: 0x2a1040,
      hairStyle: 'long', horns: true, weapon: 'staff',
    }));
    this.boss.attachFx(this.fx);
    castShadows(this.player.group);
    castShadows(this.boss.group);
    this.scene.add(this.player.group, this.boss.group);

    this.ui = new UI(container);
    this.input = new Input(container);
    this.ctx = {
      bullets: this.bullets, particles: this.particles, fx: this.fx, sfx: this.sfx, ui: this.ui, input: this.input,
      arenaR: ARENA_R, time: 0, camYaw: this.camYaw, player: this.player, boss: this.boss,
      hitstop: (sec, scale = 0.05) => { if (sec >= this.slowT) { this.slowT = sec; this.slowScale = scale; } },
      shake: (a) => { this.shakeV = Math.min(1.5, this.shakeV + a); },
      punch: (a) => { this.punchV = Math.min(1.2, this.punchV + a); },
      onBossDead: () => this.finish(true),
      onPlayerDead: () => this.finish(false),
    };

    this.ui.onStart = (c) => this.start(c);
    this.ui.onSelect = (c) => { if (this.state === 'title') this.setChar(c); };
    this.ui.onRetry = () => this.restart();
    this.ui.onSwap = () => this.swap();
    // タイトルでキャラを選んだ時点で音を開けるようにして、静かな曲を流し始める
    this.ui.onGesture = () => { this.ensureMusic(); this.setMusicLv(0); };
    this.ui.onMusicToggle = (on) => this.music?.setMuted(!on);
    // 名前とランキング
    this.ui.setName(this.ranking.name);
    this.ui.onName = (v) => { this.ranking.name = v; };
    this.ui.onRankOpen = () => void this.openRanking();
    this.ui.onShare = () => void this.share();
    window.addEventListener('keydown', (e) => { if (e.code === 'KeyQ' && !e.repeat) this.swap(); });
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
    // 2 人の主人公の VRM を読み込む（早送りより先に済ませる）
    const model = q.get('model');
    if (!model && !q.has('novrm')) {
      // VRM が読み込まれるまで仮のプリミティブ体型は見せない（選択前はまひろを表示する）
      this.player.group.visible = false;
      // ボスの VRM は待たない。読めた時点で差し替える（タイトルを早く出すため）
      void tryLoadVrm(`${import.meta.env.BASE_URL}models/boss_001.vrm`, { weapon: 'staff' })
        .then((rig) => { if (rig) { this.boss.setRig(rig); castShadows(rig.root); } })
        .catch((e) => console.warn('ボスの VRM 読み込みに失敗', e));
      const ids = Object.keys(CHARS) as CharId[];
      const loaded = await Promise.all(ids.map(async (id) => {
        try {
          return await tryLoadVrm(`${import.meta.env.BASE_URL}models/${CHARS[id].file}`);
        } catch (e) {
          console.warn(`${CHARS[id].name} の VRM 読み込みに失敗`, e);
          return null;
        }
      }));
      ids.forEach((id, i) => { this.rigs[id] = loaded[i]; });
      const first = (q.get('char') as CharId | null) ?? 'mahiro';
      this.setChar(this.rigs[first] ? first : ids.find((id) => this.rigs[id]) ?? first);
      this.player.group.visible = true;
    }
    this.ui.setReady(true);
    if (model) {
      try {
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const { autoRig } = await import('./AutoRig');
        const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/${model}.glb`);
        let mesh: THREE.Mesh | null = null;
        gltf.scene.traverse((o) => { if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh; });
        if (mesh) { this.player.setRig(autoRig(mesh, { height: 1.65 })); castShadows(this.player.group); }
        console.info(`model ${model} loaded in ${performance.now().toFixed(0)}ms`);
      } catch (e) {
        console.warn('モデルの読み込みに失敗', e);
      }
    }
    // ?hp=数値 で敵の体力を上書き（検証用）
    if (q.has('hp')) {
      this.boss.setMaxHp(Number(q.get('hp')) || this.boss.maxHp);
      this.ui.setBossHp(1);
    }
    // ?lowhp=数値 で主人公の体力を減らして始める（検証用）
    if (q.has('lowhp')) {
      this.player.hp = Number(q.get('lowhp')) || 40;
      this.charHp[this.current] = this.player.hp;
      this.ui.setPlayerHp(this.player.hp / this.player.maxHp);
    }
    // ?sfxtest で攻撃音をオフラインに描き出し、音量と長さを数値で確かめる
    if (q.has('sfxtest')) {
      const cases: [string, (x: Sfx) => void][] = [
        ['whooshHeavy', (x) => x.whooshHeavy()],
        ['thud', (x) => x.thud()],
        ['heavyHit', (x) => x.heavyHit()],
        ['whooshSharp', (x) => x.whooshSharp()],
        ['sharpHit', (x) => x.sharpHit(1, false)],
        ['sharpHitHeavy', (x) => x.sharpHit(1.15, true)],
        ['bossShoot', (x) => x.bossShoot()],
        ['parry', (x) => x.parry()],
      ];
      const only = q.get('sfxtest');
      for (const [name, run] of cases.filter(([n]) => !only || n.toLowerCase().includes(only.toLowerCase()))) {
        const off = new OfflineAudioContext(1, 44100, 44100);
        const sfx = new Sfx();
        sfx.bindTo(off, off.destination);
        run(sfx);
        const buf = await off.startRendering();
        const d = buf.getChannelData(0);
        let peak = 0, sum = 0, last = 0;
        for (let i = 0; i < d.length; i++) {
          const v = Math.abs(d[i]);
          if (v > peak) peak = v;
          if (v > 0.002) last = i;
          sum += d[i] * d[i];
        }
        console.info(`sfxtest ${name}: peak=${peak.toFixed(3)} rms=${Math.sqrt(sum / d.length).toFixed(4)} len=${(last / 44100).toFixed(2)}s`);
      }
    }
    // ?musictest で BGM をオフラインに描き出し、実際に音が出ているかを数値で確かめる
    if (q.has('musictest')) {
      const only = Number(q.get('musictest'));
      const levels = ([0, 1, 2] as const).filter((l) => !only || l === only);
      for (const lv of levels) {
        const sec = 6;
        const off = new OfflineAudioContext(1, 44100 * sec, 44100);
        const nb = off.createBuffer(1, 44100, 44100);
        const nd = nb.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        const m = new Music(off, off.destination, nb);
        m.scheduleOffline(sec, lv);
        const buf = await off.startRendering();
        const d = buf.getChannelData(0);
        let peak = 0, sum = 0;
        for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += d[i] * d[i]; }
        console.info(`musictest lv${lv}: peak=${peak.toFixed(3)} rms=${Math.sqrt(sum / d.length).toFixed(4)}`);
      }
    }
    // ?bgmtest で mp3 の BGM を調べる。読めているか、無音の除去位置、音量を数値で出す
    if (q.has('bgmtest')) {
      const files = await this.bgmProbe;
      console.info(`bgmtest files: ${files ? files.join(', ') : '(なし。合成 BGM を使う)'}`);
      for (const name of files ?? []) {
        const res = await fetch(`${import.meta.env.BASE_URL}audio/${name}`);
        const off = new OfflineAudioContext(1, 44100, 44100);
        const buf = await off.decodeAudioData(await res.arrayBuffer());
        const r = trimRange(buf);
        const d = buf.getChannelData(0);
        let peak = 0, sum = 0;
        for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += d[i] * d[i]; }
        console.info(
          `bgmtest ${name}: ${buf.duration.toFixed(1)}s trim=${r.start.toFixed(2)}..${r.end.toFixed(2)}s ` +
          `peak=${peak.toFixed(3)} rms=${Math.sqrt(sum / d.length).toFixed(4)}`
        );
      }
    }
    // ?rankdemo でランキング画面に見本を出す（見た目の確認用。記録は保存しない）
    if (q.has('rankdemo')) {
      const names = ['まひろ', 'ちさと', 'ヒロ', 'とても長い名前のひと', 'K', 'なな', 'ぼす'];
      const demo = names.map((name, i) => ({
        name,
        score: 98_000_000 - i * 13_400_000,
        rank: ['神人間', '鬼人間', '上級者人間', '一般人人間', '下手人間'][Math.min(4, i)],
        char: i % 2 ? '杉本ちさと' : '深川まひろ',
        seconds: 48 + i * 7.3,
        combo: 60 - i * 5,
        at: i === 2 ? 1 : 1000 + i,
      }));
      this.ui.showRankBoard(demo, 'みんなのランキング', 1);
    }
    if (q.has('bot')) this.input.bot = true;
    // ?hittest 単体ならタイトル画面の状態を調べる
    if (q.has('hittest') && !q.has('t') && !q.has('autostart')) setTimeout(() => this.hitTest(), 30);
    // ?hittest で、各ボタンの中心を実際にタップしたらどの要素に届くかを調べる。
    // 操作 UI（左半分のスティック領域）が HUD のボタンを覆っていないかの確認用。
    // 過去に 2 度この形で壊れた（タイトルのキャラカード、スマホの交代ボタン）

    if (q.has('autostart') || q.has('t')) {
      setTimeout(() => {
        this.start(this.current);
        if (q.has('t')) this.ui.hideTitleNow();
        const ff = Number(q.get('t') ?? 0);
        for (let i = 0; i < ff * 60; i++) this.step(1 / 60);
        // ?bphase=2|3 で進化後の見た目を確かめる
        if (q.has('bphase')) {
          this.boss.forcePhase(Math.max(2, Math.min(3, Number(q.get('bphase')) || 2)), this.ctx);
          for (let i = 0; i < Number(q.get('bf') ?? 40); i++) this.step(1 / 60);
        }
        // 戦闘中の状態でボタンの当たりを調べる
        if (q.has('hittest')) this.hitTest();
        // ?win=打撃数 でリザルト画面まで一気に進める（?dmg を付けると被弾ありになる）
        if (q.has('win')) {
          const pl = this.player;
          pl.meleeHits = Number(q.get('win')) || 42;
          pl.meleeParries = Number(q.get('mp') ?? 3);
          pl.bulletParries = Number(q.get('bp') ?? 7);
          pl.maxCombo = Number(q.get('mc') ?? 18);
          pl.damaged = q.has('dmg');
          this.playTime = Number(q.get('sec') ?? 52);
          this.finish(!q.has('lose'));
          for (let i = 0; i < Number(q.get('vt') ?? 3.4) * 60; i++) this.step(1 / 60);
          // ?dance で勝利の踊りを 15fps の連続コマにして貼る
          if (q.has('dance')) {
            const cols = Number(q.get('dc') ?? 6), rows = Number(q.get('dr') ?? 4);
            const tw = 320, th = 180;
            const every = Number(q.get('ds') ?? 8);
            const strip = document.createElement('canvas');
            strip.width = cols * tw; strip.height = rows * th;
            const g2 = strip.getContext('2d')!;
            g2.fillStyle = '#000'; g2.fillRect(0, 0, strip.width, strip.height);
            for (let tile = 0; tile < cols * rows; tile++) {
              for (let k = 0; k < every; k++) this.step(1 / 60);
              this.renderer.render(this.scene, this.camera);
              g2.drawImage(this.renderer.domElement, (tile % cols) * tw, Math.floor(tile / cols) * th, tw, th);
            }
            strip.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:auto;z-index:99;background:#000';
            document.body.appendChild(strip);
            console.info('dance strip done');
          }
          console.info(`win dbg total=${this.score?.total} rank=${this.score?.rank.name}`);
        }
        // ?tp でボスを一瞬で遠くへ飛ばす（瞬間移動と同じ状況を作る検証用）
        if (q.has('tp')) {
          this.boss.pos.set(7, 0, -7);
          for (let i = 0; i < Number(q.get('tpf') ?? 20); i++) this.step(1 / 60);
        }
        // ?swap で早送り後に交代を 1 回実行して 20 コマ進める
        if (q.has('swap')) { this.swap(); for (let i = 0; i < 20; i++) this.step(1 / 60); console.info(`swap dbg -> ${this.current}`); }
        // ?combo で 5 段コンボを 30fps の連続コマにして画面に貼る（cols 列 × rows 行）
        if (q.has('combo')) {
          this.player.invuln = 9;
          const cols = 8, rows = 7, tw = 240, th = 135;
          const strip = document.createElement('canvas');
          strip.width = cols * tw; strip.height = rows * th;
          const g = strip.getContext('2d')!;
          g.fillStyle = '#000'; g.fillRect(0, 0, strip.width, strip.height);
          const src = this.renderer.domElement;
          let tile = 0, done = false, frame = 0;
          while (tile < cols * rows && frame < 400) {
            this.step(1 / 60);
            if (!done) done = this.player.debugComboTick(this.ctx);
            if (frame % 2 === 0) {
              this.renderer.render(this.scene, this.camera);
              g.drawImage(src, (tile % cols) * tw, Math.floor(tile / cols) * th, tw, th);
              tile++;
            }
            frame++;
            if (done && frame % 2 === 0 && tile > 0) { /* 終了後も数コマ撮る */ if (this.player.state !== 'attack') break; }
          }
          strip.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:auto;z-index:99;background:#000';
          document.body.appendChild(strip);
          console.info(`combo strip: ${tile} tiles`);
        }
        // ?slash=1..5 で早送り後に攻撃の途中で止める
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
    this.baseFov = this.camera.aspect < 1 ? Math.min(78, FOV / Math.sqrt(this.camera.aspect)) : FOV;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
    this.composer.setSize(w, h);
    this.particles.setViewport(h * this.renderer.getPixelRatio(), this.camera.fov);
  }

  private rigs: Partial<Record<CharId, Rig | null>> = {};
  private current: CharId = 'mahiro';
  private swapCd = 0;
  /** 勝利演出: 隣で拍手する相棒 */
  private partner: { rig: Rig; anim: Animator; t: number } | null = null;
  private victoryDir = new THREE.Vector3(0, 0, 1);
  private score: ScoreResult | null = null;

  /** 主人公を切り替える（読み込み済みの VRM のみ） */
  private setChar(id: CharId) {
    const rig = this.rigs[id];
    if (!rig) return false;
    // いまのキャラの体力をしまい、交代先の体力を取り出す
    this.charHp[this.current] = this.player.hp;
    if (this.player.rig !== rig) { this.player.setRig(rig, true); castShadows(rig.root); }
    this.current = id;
    this.player.hp = this.charHp[id];
    this.player.style = STYLES[id];
    this.fx.playerTrail.setColor(STYLES[id].color, STYLES[id].sharp ? 2.8 : 2.0);
    this.ui.setPlayerName(CHARS[id].name);
    this.ui.setPlayerHp(this.player.hp / this.player.maxHp);
    this.refreshRest();
    return true;
  }

  /** 控えているキャラの表示を更新する */
  private refreshRest() {
    const other: CharId = this.current === 'mahiro' ? 'chisato' : 'mahiro';
    this.ui.setRest(CHARS[other].name, this.charHp[other] / this.player.maxHp);
  }

  /** ゲーム中の交代 */
  private swap() {
    if (this.state !== 'play' || this.swapCd > 0 || !this.player.canSwap) return;
    const next: CharId = this.current === 'mahiro' ? 'chisato' : 'mahiro';
    if (!this.rigs[next]) return;
    const c = this.player.center.clone();
    const col = STYLES[next].hot;
    this.fx.flash(c, 0xffffff, 3.2, 0.25);
    this.fx.ring(this.player.pos, col, 2.5, 0.35);
    this.particles.emit(c, { color: col, count: 30, speed: 5, size: 0.22, life: 0.5 });
    this.setChar(next);
    this.player.invuln = Math.max(this.player.invuln, 0.5);
    this.swapCd = 1.2;
    this.ui.showBanner(CHARS[next].name, '#ffd6c0', 0.9);
    this.sfx.teleport();
  }

  /** 各ボタンの中心に届く要素を調べて console に出す（?hittest） */
  private hitTest() {
    const names = ['#swap', '#music', '#b-attack', '#b-dodge', '#b-parry', '#startbtn', '#pname', '#rankbtn'];
    console.info(`hittest viewport: ${innerWidth}x${innerHeight}`);
    for (const sel of names) {
      const el = document.querySelector(sel) as HTMLElement | null;
      const r = el?.getBoundingClientRect();
      if (!el || !r || r.width === 0 || getComputedStyle(el).display === 'none') {
        console.info(`hittest ${sel}: 非表示`);
        continue;
      }
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) as HTMLElement | null;
      const owner = top?.closest('[id]') as HTMLElement | null;
      const hit = owner?.id === el.id;
      console.info(`hittest ${sel}: ${hit ? 'OK' : 'NG'} 手前は #${owner?.id ?? '不明'}`);
    }
  }

  /** クリアしたスコアをランキングに登録し、リザルトに順位を出す */
  private async submitScore() {
    if (!this.score) return;
    const entry: Entry = {
      name: cleanName(this.ui.enteredName || this.ranking.name),
      score: this.score.total,
      rank: this.score.rank.name,
      char: CHARS[this.current].name,
      seconds: this.playTime,
      combo: this.player.maxCombo,
      at: Date.now(),
    };
    this.myEntry = entry;
    this.ranking.addLocal(entry);
    // みんなのランキングが使えるなら送る。失敗したら端末内の記録を出す
    const shared = await this.ranking.submitShared(entry);
    this.ui.setResultRanking(shared ?? this.ranking.local(), entry.at);
  }

  /** ランキング画面を開く */
  private async openRanking() {
    const meAt = this.myEntry?.at ?? 0;
    const local = this.ranking.local();
    if (!this.ranking.shared) {
      this.ui.showRankBoard(local, 'この端末に残っている記録です', meAt);
      return;
    }
    this.ui.showRankBoard(local, '読み込み中…', meAt);
    const shared = await this.ranking.fetchShared();
    this.ui.showRankBoard(shared ?? local, shared ? 'みんなのランキング' : '通信できないので、この端末の記録を出しています', meAt);
  }

  /** 結果を共有する。共有機能が無ければクリップボードへ写す */
  private async share() {
    const e = this.myEntry;
    const text = e
      ? `炎舞 -ENBU- で ${e.score.toLocaleString()} 点（${e.rank}）を出した。${e.char}／${e.seconds.toFixed(1)}秒`
      : '炎舞 -ENBU- で遊んでみて';
    const url = location.origin + location.pathname;
    try {
      const nav = navigator as Navigator & { share?: (d: { title: string; text: string; url: string }) => Promise<void> };
      if (nav.share) {
        await nav.share({ title: '炎舞 -ENBU-', text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      this.ui.showBanner('コピーしました', '#ffd6a0', 1.2);
    } catch {
      this.ui.showBanner('共有できませんでした', '#ffa0a0', 1.2);
    }
  }

  /** BGM の濃さを指定する。まだ音が開けていなければ覚えておく */
  private setMusicLv(v: 0 | 1 | 2) {
    this.musicLv = v;
    this.music?.setIntensity(v);
  }

  /**
   * 音が開けていれば BGM を用意する。
   * public/audio に mp3 があればそれを、無ければ合成 BGM を鳴らす。
   */
  private ensureMusic() {
    this.sfx.unlock();
    if (this.music || this.musicPending) return;
    const a = this.sfx.audio;
    if (!a) return;
    this.musicPending = true;
    void this.bgmProbe.then((files) => {
      this.musicPending = false;
      if (this.music) return;
      const bgm = files ? new Bgm(a.ctx, a.dest, files) : null;
      this.music = bgm ?? new Music(a.ctx, a.dest, a.noise);
      this.music.setMuted(!this.ui.musicOn);
      this.music.start();
      this.music.setIntensity(this.musicLv);
      // mp3 が読めなかったら合成 BGM に戻す
      if (bgm) void bgm.ready().then((ok) => {
        if (ok || this.music !== bgm) return;
        bgm.dispose();
        this.music = new Music(a.ctx, a.dest, a.noise);
        this.music.setMuted(!this.ui.musicOn);
        this.music.start();
        this.music.setIntensity(this.musicLv);
      });
    });
  }

  private start(char: CharId) {
    if (this.state !== 'title') return;
    this.setChar(char);
    this.ensureMusic();
    this.sfx.start();
    this.ui.hideTitle();
    this.beginPlay();
  }

  private restart() {
    this.clearVictory();
    this.ui.hideResult();
    this.bullets.clear();
    this.particles.clear();
    this.fx.clear();
    this.items.reset();
    this.charHp.mahiro = 100;
    this.charHp.chisato = 100;
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
    this.input.setVisible(true);
    this.ui.setPlaying(true);
    this.ui.setSwapVisible(!!(this.rigs.mahiro && this.rigs.chisato));
    this.refreshRest();
    this.setMusicLv(1);
    this.ui.showBanner('浄化開始', '#ffd6c0', 1.2);
  }

  private finish(win: boolean) {
    if (this.state !== 'play') return;
    this.state = 'over';
    this.overWin = win;
    this.overTimer = 0;
    this.input.enabled = false;
    this.input.reset();
    this.input.setVisible(false);
    this.ui.setSwapVisible(false);
    this.setMusicLv(0);
    this.ctx.hitstop(2.2, 0.3);
    this.score = computeScore({
      hits: this.player.meleeHits,
      meleeParries: this.player.meleeParries,
      bulletParries: this.player.bulletParries,
      noDamage: !this.player.damaged,
      seconds: this.playTime,
      maxCombo: this.player.maxCombo,
    });
    // 勝ったときだけランキングに載せる
    if (win) void this.submitScore();
    if (win) {
      this.sfx.win();
      this.ui.showBanner('浄化', '#ffe08a', 2);
      this.ui.flash(0.8);
      this.setupVictory();
    } else {
      this.sfx.lose();
      this.ui.showBanner('散華', '#c0a0ff', 2);
    }
  }

  /** 勝ったキャラを正面から大きく見せ、もう一人を隣に立たせて拍手させる */
  private setupVictory() {
    this.player.startWin();
    this.victoryDir.set(Math.sin(this.player.heading), 0, Math.cos(this.player.heading));
    const otherId: CharId = this.current === 'mahiro' ? 'chisato' : 'mahiro';
    const rig = this.rigs[otherId];
    if (!rig || rig === this.player.rig) return;
    // カメラから見た右方向。相棒は画面の左側（スコア面板の反対側）に置く
    const right = new THREE.Vector3(this.victoryDir.z, 0, -this.victoryDir.x);
    rig.root.position.copy(this.player.pos).addScaledVector(right, -1.05).addScaledVector(this.victoryDir, -0.5);
    rig.root.rotation.y = this.player.heading + 0.3;
    rig.setFist?.(0.25, 1);
    castShadows(rig.root);
    this.scene.add(rig.root);
    this.partner = { rig, anim: new Animator(rig), t: 0 };
    console.info(`victory: winner=${this.current} partner=${otherId}`);
  }

  private clearVictory() {
    if (!this.partner) return;
    this.scene.remove(this.partner.rig.root);
    this.partner.rig.root.position.set(0, 0, 0);
    this.partner.rig.root.rotation.y = 0;
    this.partner = null;
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
        if (this.lowFpsSec >= 3) {
          this.bloomOn = false;
          this.renderer.shadowMap.enabled = false;
          this.arena.sun.castShadow = false;
          console.info('低フレームレートのためブルームと影を無効化');
        }
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
    if (this.swapCd > 0) { this.swapCd -= real; if (this.swapCd <= 0) this.ui.setSwapCooldown(false); else this.ui.setSwapCooldown(true); }
    this.arena.update(dt);

    const playing = this.state === 'play';
    if (playing) this.playTime += dt;
    if (this.state === 'over') {
      this.overTimer += real;
      if (this.overTimer > 2.8 && this.overTimer - real <= 2.8) {
        if (this.score) this.ui.showResult(this.overWin, this.score, this.current, this.playTime, this.player.maxCombo);
      }
    }

    this.player.update(dt, this.ctx);
    if (this.partner) {
      this.partner.t += dt;
      // 少し遅れて拍手を始める
      const pt = Math.max(0, this.partner.t - 0.5);
      this.partner.anim.apply(poseClap(pt), 12, dt);
      this.partner.rig.update(dt);
    }
    this.boss.update(dt, this.ctx, playing);
    this.items.update(dt, this.ctx, playing);
    // 終盤は曲を厚くする
    if (playing) this.setMusicLv(this.boss.phase >= 3 ? 2 : 1);
    // 控えているキャラは少しずつ回復する
    if (playing) {
      const other: CharId = this.current === 'mahiro' ? 'chisato' : 'mahiro';
      if (this.rigs[other] && this.charHp[other] < this.player.maxHp) {
        this.charHp[other] = Math.min(this.player.maxHp, this.charHp[other] + REST_REGEN * dt);
        this.refreshRest();
      }
    }
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
    if (debugCam === 'torii') {
      // 動作確認用: 鳥居を正面から見る
      desired = new THREE.Vector3(0, 3.2, -ARENA_R + 4);
      look = new THREE.Vector3(0, 3.0, -ARENA_R - 3.2);
    } else if (debugCam === 'hand' || debugCam === 'handR') {
      // 動作確認用: 手元のアップ（拳の形を見る）
      const arm = debugCam === 'hand' ? pl.rig.lowerArmL : pl.rig.lowerArmR;
      pl.group.updateMatrixWorld(true);
      const hand = arm.localToWorld(new THREE.Vector3((debugCam === 'hand' ? 1 : -1) * pl.rig.height * 0.2, 0, 0));
      const yaw = pl.heading + (debugCam === 'hand' ? -Math.PI / 2 : Math.PI / 2);
      desired = new THREE.Vector3(hand.x + Math.sin(yaw) * 0.9, hand.y + 0.25, hand.z + Math.cos(yaw) * 0.9);
      look = hand;
    } else if (debugCam === 'front' || debugCam === 'boss' || debugCam === 'side' || debugCam === 'side2' || debugCam === 'q') {
      // 動作確認用: キャラのアップ。front=正面、side=キャラの左側から、side2=右側から、q=斜め前
      const t = debugCam === 'boss' ? bo : pl;
      const off = debugCam === 'side' ? Math.PI / 2 : debugCam === 'side2' ? -Math.PI / 2 : debugCam === 'q' ? Math.PI / 4 : 0;
      const yaw = t.heading + off;
      desired = new THREE.Vector3(t.pos.x + Math.sin(yaw) * 3.2, t.pos.y + 1.5, t.pos.z + Math.cos(yaw) * 3.2);
      look = new THREE.Vector3(t.pos.x, t.pos.y + 1.0, t.pos.z);
    } else if (this.state === 'over' && this.overWin) {
      // 正面から全身を大きく。被写体が画面の左に寄るよう、注視点を右へずらす
      const d = this.victoryDir;
      const right = new THREE.Vector3(d.z, 0, -d.x);
      const wide = this.camera.aspect >= 1;
      desired = new THREE.Vector3(pl.pos.x + d.x * 3.3, pl.pos.y + 1.0, pl.pos.z + d.z * 3.3);
      look = new THREE.Vector3(pl.pos.x, pl.pos.y + 0.9, pl.pos.z)
        .addScaledVector(right, wide ? 0.8 : 0.3);
      if (!wide) look.y += 0.35;
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
    // 打撃の寄り: 画角を一瞬狭めて戻す
    this.punchV = Math.max(0, this.punchV - real * 5);
    const fov = this.baseFov * (1 - this.punchV * 0.09);
    if (Math.abs(fov - this.camera.fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
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
