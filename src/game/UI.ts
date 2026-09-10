const CSS = `
#hud { position: fixed; inset: 0; pointer-events: none; z-index: 10; }
.bar { position: absolute; height: 14px; border-radius: 7px; background: rgba(0,0,0,0.5); border: 1.5px solid rgba(255,255,255,0.35); overflow: hidden; }
.bar > i { position: absolute; left: 0; top: 0; bottom: 0; width: 100%; transform-origin: left; transition: transform 0.12s; }
.bar > b { position: absolute; left: 0; top: 0; bottom: 0; width: 100%; transform-origin: left; background: rgba(255,255,255,0.55); transition: transform 0.5s ease-out 0.2s; }
#php-wrap { position: absolute; left: max(16px, env(safe-area-inset-left)); top: max(12px, env(safe-area-inset-top)); width: min(38vw, 260px); }
#php-wrap .name { font-size: 13px; font-weight: 700; letter-spacing: 0.15em; text-shadow: 0 1px 4px #000; margin-bottom: 4px; color: #ffd6c0; }
#php { position: relative; width: 100%; }
#php > i { background: linear-gradient(90deg, #ff3b2f, #ff9a4a); }
#bhp-wrap { position: absolute; left: 50%; top: max(12px, env(safe-area-inset-top)); transform: translateX(-50%); width: min(50vw, 420px); text-align: center; }
#bhp-wrap .name { font-size: 14px; font-weight: 700; letter-spacing: 0.2em; text-shadow: 0 1px 4px #000; margin-bottom: 4px; color: #e8c8ff; }
#bhp { position: relative; width: 100%; height: 12px; }
#bhp > i { background: linear-gradient(90deg, #7a2cff, #d05aff, #ff7ad9); }
#bhp .ph { position: absolute; top: -2px; bottom: -2px; width: 2px; background: rgba(255,255,255,0.7); }
#combo { position: absolute; right: max(20px, env(safe-area-inset-right)); top: 30%; text-align: right; opacity: 0; transition: opacity 0.2s; }
#combo .n { font-size: 44px; font-weight: 900; color: #ffb347; text-shadow: 0 0 12px #ff5a2a, 0 2px 4px #000; line-height: 1; font-style: italic; }
#combo .l { font-size: 12px; letter-spacing: 0.3em; color: #ffe6c0; text-shadow: 0 1px 3px #000; }
#banner { position: absolute; left: 50%; top: 34%; transform: translate(-50%, -50%) scale(0.6); font-size: 40px; font-weight: 900; letter-spacing: 0.15em;
  color: #fff; text-shadow: 0 0 18px #ffb347, 0 2px 6px #000; opacity: 0; transition: opacity 0.15s, transform 0.15s; white-space: nowrap; }
#banner.show { opacity: 1; transform: translate(-50%, -50%) scale(1); }
#vignette { position: absolute; inset: 0; background: radial-gradient(ellipse at center, rgba(255,0,0,0) 45%, rgba(255,20,20,0.55) 100%); opacity: 0; transition: opacity 0.08s; }
#flash { position: absolute; inset: 0; background: #fff; opacity: 0; }
#lowhp { position: absolute; inset: 0; box-shadow: inset 0 0 80px rgba(255,30,30,0.6); opacity: 0; }
.overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
  background: radial-gradient(ellipse at center, rgba(40,8,24,0.75), rgba(10,2,8,0.92)); pointer-events: auto; transition: opacity 0.4s, visibility 0.4s; }
.overlay.hidden { opacity: 0; visibility: hidden; pointer-events: none; }
.overlay h1 { font-size: clamp(40px, 9vw, 84px); margin: 0; letter-spacing: 0.25em; font-weight: 900;
  background: linear-gradient(180deg, #fff4e0, #ffb347 55%, #ff4a2a); -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 0 16px rgba(255,120,60,0.6)); }
.overlay h1 small { display: block; font-size: 0.3em; letter-spacing: 0.6em; color: #ffd6c0; -webkit-text-fill-color: #ffd6c0; filter: none; margin-top: 4px; }
.overlay p { margin: 10px 24px; font-size: 14px; line-height: 1.7; color: #f0e0e8; max-width: 520px; }
.overlay .tap { margin-top: 18px; font-size: 18px; font-weight: 700; letter-spacing: 0.3em; color: #fff; animation: blink 1.4s infinite; }
@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
.overlay .btnrow { display: flex; gap: 14px; margin-top: 22px; }
.overlay button { pointer-events: auto; font-size: 18px; font-weight: 700; padding: 12px 30px; border-radius: 30px; border: 2px solid #ffb347;
  background: linear-gradient(180deg, rgba(255,120,60,0.5), rgba(160,30,20,0.6)); color: #fff; letter-spacing: 0.2em; }
.overlay button:active { transform: scale(0.95); }
.overlay .stats { font-size: 15px; color: #ffe6c0; letter-spacing: 0.1em; }
.overlay .res-win { color: #ffe08a; }
.overlay .res-lose { background: linear-gradient(180deg, #d0c0ff, #8a5aff); -webkit-background-clip: text; background-clip: text; }
#help { position: absolute; left: 50%; bottom: max(10px, env(safe-area-inset-bottom)); transform: translateX(-50%); font-size: 11px; color: rgba(255,255,255,0.6);
  letter-spacing: 0.1em; text-shadow: 0 1px 3px #000; white-space: nowrap; }
#fps { position: absolute; left: 8px; bottom: 6px; font-size: 10px; color: rgba(255,255,255,0.4); font-family: monospace; }
`;

export class UI {
  private php: HTMLElement;
  private phpGhost: HTMLElement;
  private bhp: HTMLElement;
  private bhpGhost: HTMLElement;
  private combo: HTMLElement;
  private comboN: HTMLElement;
  private banner: HTMLElement;
  private bannerTimer = 0;
  private vignette: HTMLElement;
  private flashEl: HTMLElement;
  private lowhp: HTMLElement;
  private title: HTMLElement;
  private result: HTMLElement;
  private resultTitle: HTMLElement;
  private resultStats: HTMLElement;
  private fpsEl: HTMLElement;
  private comboTimer = 0;
  private flashV = 0;
  private vigV = 0;
  onStart: () => void = () => {};
  onRetry: () => void = () => {};

  constructor(parent: HTMLElement) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    const hud = document.createElement('div');
    hud.id = 'hud';
    hud.innerHTML = `
      <div id="vignette"></div><div id="lowhp"></div>
      <div id="php-wrap"><div class="name">深川まひろ</div><div class="bar" id="php"><b></b><i></i></div></div>
      <div id="bhp-wrap"><div class="name">妖魔 ─ 紫苑</div><div class="bar" id="bhp"><b></b><i></i><span class="ph" style="left:60%"></span><span class="ph" style="left:30%"></span></div></div>
      <div id="combo"><div class="n">0</div><div class="l">COMBO</div></div>
      <div id="banner"></div>
      <div id="help">左半分ドラッグで移動 ／ PC: WASD 移動・J 打(連打)・K 回避・L 受け流し・I 射撃</div>
      <div id="fps"></div>
      <div id="flash"></div>
      <div class="overlay" id="title">
        <h1>炎舞<small>─ ENBU ─</small></h1>
        <p>妖魔の少女・紫苑が放つ立体弾幕を、回避と受け流しでさばきながらコンボを叩き込め。<br>
        「受」は弾に触れる直前に押すと弾き返して反撃できる。「避」は無敵で突っ切れる。</p>
        <div class="tap">タップして開始</div>
      </div>
      <div class="overlay hidden" id="result">
        <h1 id="result-title">浄化完了</h1>
        <div class="stats" id="result-stats"></div>
        <div class="btnrow"><button id="retry">もう一度</button></div>
      </div>`;
    parent.appendChild(hud);
    const q = (s: string) => hud.querySelector(s) as HTMLElement;
    this.php = q('#php > i');
    this.phpGhost = q('#php > b');
    this.bhp = q('#bhp > i');
    this.bhpGhost = q('#bhp > b');
    this.combo = q('#combo');
    this.comboN = q('#combo .n');
    this.banner = q('#banner');
    this.vignette = q('#vignette');
    this.flashEl = q('#flash');
    this.lowhp = q('#lowhp');
    this.title = q('#title');
    this.result = q('#result');
    this.resultTitle = q('#result-title');
    this.resultStats = q('#result-stats');
    this.fpsEl = q('#fps');
    this.title.addEventListener('pointerdown', () => this.onStart());
    q('#retry').addEventListener('click', () => this.onRetry());
  }

  setPlayerHp(frac: number) {
    this.php.style.transform = `scaleX(${Math.max(0, frac)})`;
    this.phpGhost.style.transform = `scaleX(${Math.max(0, frac)})`;
    this.lowhp.style.opacity = frac < 0.3 && frac > 0 ? String(0.6 + Math.sin(performance.now() / 150) * 0.3) : '0';
  }
  setBossHp(frac: number) {
    this.bhp.style.transform = `scaleX(${Math.max(0, frac)})`;
    this.bhpGhost.style.transform = `scaleX(${Math.max(0, frac)})`;
  }
  setCombo(n: number) {
    if (n <= 1) { this.combo.style.opacity = '0'; return; }
    this.comboN.textContent = String(n);
    this.combo.style.opacity = '1';
    this.comboN.style.transform = 'scale(1.3)';
    requestAnimationFrame(() => { this.comboN.style.transition = 'transform 0.15s'; this.comboN.style.transform = 'scale(1)'; });
    this.comboTimer = 1.6;
  }
  showBanner(text: string, color = '#fff', dur = 0.9) {
    this.banner.textContent = text;
    this.banner.style.color = color;
    this.banner.classList.add('show');
    this.bannerTimer = dur;
  }
  hurt() { this.vigV = 1; }
  flash(v = 0.6) { this.flashV = Math.max(this.flashV, v); }
  setFps(v: number) { this.fpsEl.textContent = `${v.toFixed(0)} fps`; }

  update(dt: number) {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.banner.classList.remove('show');
    }
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo.style.opacity = '0';
    }
    if (this.flashV > 0) {
      this.flashV = Math.max(0, this.flashV - dt * 3);
      this.flashEl.style.opacity = String(this.flashV);
    }
    if (this.vigV > 0) {
      this.vigV = Math.max(0, this.vigV - dt * 2.5);
      this.vignette.style.opacity = String(this.vigV);
    }
  }

  hideTitle() { this.title.classList.add('hidden'); }
  /** 動作確認用: フェードなしで即座に消す */
  hideTitleNow() { this.title.style.display = 'none'; }
  showResult(win: boolean, seconds: number, maxCombo: number, parries: number) {
    this.resultTitle.textContent = win ? '浄化完了' : '散華';
    this.resultTitle.className = win ? 'res-win' : 'res-lose';
    this.resultStats.innerHTML = `TIME ${seconds.toFixed(1)}s ／ MAX COMBO ${maxCombo} ／ PARRY ${parries}`;
    this.result.classList.remove('hidden');
  }
  hideResult() { this.result.classList.add('hidden'); }
}
