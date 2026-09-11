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
.charsel { display: flex; gap: 18px; margin-top: 22px; flex-wrap: wrap; justify-content: center; }
.charsel.hidden { display: none; }
.charcard { pointer-events: auto; min-width: 180px; padding: 16px 26px; border-radius: 16px; border: 2px solid rgba(255,214,192,0.7);
  background: linear-gradient(180deg, rgba(60,20,40,0.7), rgba(20,6,14,0.85)); color: #fff; font-family: inherit; cursor: pointer; transition: transform 0.1s, border-color 0.1s; }
.charcard b { display: block; font-size: 22px; letter-spacing: 0.2em; }
.charcard small { display: block; font-size: 10px; letter-spacing: 0.3em; color: #ffd6c0; margin-top: 4px; }
.charcard:hover, .charcard:active { transform: scale(1.05); border-color: #ffb347; }
.charcard.selected { border-color: #ffb347; background: linear-gradient(180deg, rgba(255,120,60,0.55), rgba(160,30,20,0.7)); box-shadow: 0 0 18px rgba(255,150,80,0.5); }
#startbtn { pointer-events: auto; margin-top: 22px; font-size: 22px; font-weight: 900; padding: 14px 44px; border-radius: 34px; border: 2px solid #ffe0a0;
  background: linear-gradient(180deg, #ffb347, #ff5a2a); color: #fff; letter-spacing: 0.3em; font-family: inherit; cursor: pointer; box-shadow: 0 0 22px rgba(255,120,60,0.6); }
#startbtn:active { transform: scale(0.95); }
#startbtn.hidden { display: none; }
.overlay .hint { margin-top: 18px; font-size: 12px; color: rgba(255,255,255,0.65); letter-spacing: 0.1em; }
#swap { position: absolute; left: max(16px, env(safe-area-inset-left)); top: calc(max(12px, env(safe-area-inset-top)) + 44px); pointer-events: auto;
  width: 64px; height: 44px; border-radius: 22px; border: 2px solid rgba(255,255,255,0.5); background: rgba(40,10,25,0.55); color: #fff; font-family: inherit;
  font-weight: 700; font-size: 15px; letter-spacing: 0.1em; line-height: 1; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); transition: transform 0.06s, opacity 0.2s; }
#swap small { display: block; font-size: 9px; font-weight: 400; opacity: 0.8; }
#swap.hidden { display: none; }
#swap.cool { opacity: 0.45; }
#swap:active { transform: scale(0.92); background: rgba(255,120,60,0.6); }
/* ---- リザルト ---- */
#result { background: none; flex-direction: row; align-items: stretch; justify-content: flex-end; }
#result.lose { background: radial-gradient(ellipse at center, rgba(18,4,13,0.94), rgba(5,1,4,0.985)); flex-direction: column; align-items: center; justify-content: center; }
/* リザルト中は戦闘用の HUD を隠す */
#hud.result-on #php-wrap, #hud.result-on #bhp-wrap, #hud.result-on #help, #hud.result-on #combo { display: none; }
#res-panel { width: min(58vw, 760px); height: 100%; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center;
  gap: 10px; padding: 16px 30px 16px 40px;
  background: linear-gradient(90deg, rgba(10,3,9,0) 0%, rgba(12,4,11,0.62) 12%, rgba(12,4,11,0.88) 34%, rgba(12,4,11,0.94) 100%); }
#result.lose #res-panel { width: min(92vw, 600px); height: auto; align-items: stretch; padding: 20px 28px 22px; border-radius: 18px;
  border: 1px solid rgba(255,255,255,0.14); background: linear-gradient(180deg, rgba(22,7,17,0.94), rgba(9,2,8,0.97)); text-align: center; }
#result.lose #res-rank, #result.lose #res-title { text-align: center; }
#result.lose .btnrow { justify-content: center; }
#res-title { font-size: 13px; letter-spacing: 0.45em; color: #ffd6c0; opacity: 0.85; }
#res-rank { position: relative; line-height: 1; margin: 2px 0 6px; }
#res-rank .rk-name { display: block; position: relative; z-index: 1; font-weight: 900; white-space: nowrap; }
#res-rank .rk-sub { display: block; position: relative; z-index: 1; font-size: 11px; letter-spacing: 0.5em; color: rgba(255,255,255,0.55); margin-top: 6px; }
#res-rank .rays { position: absolute; left: -14%; top: 50%; width: 128%; aspect-ratio: 1; transform: translateY(-50%); z-index: 0; opacity: 0; pointer-events: none; }
/* 称号ごとの派手さ: lv4 神 → lv0 下手 */
.rk-lv4 .rk-name { font-size: clamp(40px, 8.4vw, 104px); letter-spacing: 0.06em; font-style: italic;
  background: linear-gradient(100deg, #fff7d6 0%, #ffd34a 30%, #ff5ad0 55%, #6ad8ff 80%, #fff7d6 100%); background-size: 260% 100%;
  -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 0 22px rgba(255,180,60,0.95)) drop-shadow(0 0 46px rgba(255,90,200,0.6));
  animation: rkflow 2.4s linear infinite, rkpop 0.55s cubic-bezier(0.2,1.7,0.4,1) both; }
.rk-lv4 .rays { opacity: 0.55; animation: rkspin 9s linear infinite;
  background: repeating-conic-gradient(from 0deg, rgba(255,200,90,0.5) 0deg 5deg, rgba(255,200,90,0) 5deg 16deg);
  -webkit-mask-image: radial-gradient(circle, #000 12%, transparent 66%); mask-image: radial-gradient(circle, #000 12%, transparent 66%); }
.rk-lv3 .rk-name { font-size: clamp(34px, 6.6vw, 82px); letter-spacing: 0.08em; font-style: italic;
  background: linear-gradient(180deg, #fff0f6 0%, #ff6ad0 45%, #8a2cff 100%); -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 0 16px rgba(255,80,190,0.8)); animation: rkpop 0.5s cubic-bezier(0.2,1.6,0.4,1) both, rkbeat 1.8s ease-in-out 0.6s infinite; }
.rk-lv3 .rays { opacity: 0.3; animation: rkspin 14s linear infinite reverse;
  background: repeating-conic-gradient(from 0deg, rgba(255,90,200,0.4) 0deg 4deg, rgba(255,90,200,0) 4deg 20deg);
  -webkit-mask-image: radial-gradient(circle, #000 14%, transparent 60%); mask-image: radial-gradient(circle, #000 14%, transparent 60%); }
.rk-lv2 .rk-name { font-size: clamp(28px, 5vw, 60px); letter-spacing: 0.12em;
  background: linear-gradient(180deg, #fff6e2, #ffb347 70%, #ff7a3a); -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 0 10px rgba(255,150,70,0.55)); animation: rkpop 0.45s ease-out both; }
.rk-lv1 .rk-name { font-size: clamp(24px, 3.8vw, 44px); letter-spacing: 0.16em; color: #f2ece8; animation: rkfade 0.5s ease-out both; }
.rk-lv0 .rk-name { font-size: clamp(20px, 3vw, 34px); letter-spacing: 0.2em; color: #9a8f96; animation: rkfade 0.7s ease-out both; }
.rk-lv0 .rk-sub, .rk-lv1 .rk-sub { color: rgba(255,255,255,0.35); }
@keyframes rkflow { to { background-position: 260% 0; } }
@keyframes rkspin { to { transform: translateY(-50%) rotate(360deg); } }
@keyframes rkpop { from { opacity: 0; transform: scale(2.1) rotate(-5deg); filter: blur(8px); } to { opacity: 1; transform: none; } }
@keyframes rkbeat { 0%,100% { transform: scale(1); } 50% { transform: scale(1.04); } }
@keyframes rkfade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
#res-body { display: flex; align-items: center; gap: 22px; }
/* 立ち絵は「バストアップ｜全身」の 2 コマ並びを想定し、左のバストアップだけを切り出して縦長の枠に収める。
   別の絵に差し替えるときは aspect-ratio と object-position を合わせ直す */
#res-cap { position: relative; flex: 0 0 auto; width: clamp(96px, 15vw, 190px); aspect-ratio: 0.64; }
#res-cap img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: 2% center; border-radius: 14px; }
#res-cap::after { content: ''; position: absolute; inset: -8px; border-radius: 18px; pointer-events: none;
  box-shadow: 0 0 26px var(--tint, #ff3a2a), inset 0 0 0 2px rgba(255,255,255,0.35); opacity: 0.55; }
#res-cap.noimg { display: none; }
#res-lines { flex: 1 1 auto; min-width: 0; }
.res-line { display: flex; align-items: baseline; gap: 10px; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.12);
  opacity: 1; animation: rkfade 0.3s ease-out backwards; }
.res-line .l { font-size: 13px; color: #ffd6c0; letter-spacing: 0.08em; white-space: nowrap; }
.res-line .d { font-size: 11px; color: rgba(255,255,255,0.45); flex: 1 1 auto; text-align: left; }
.res-line .p { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; color: #fff; white-space: nowrap; }
.res-line.zero .l, .res-line.zero .p { opacity: 0.4; }
.res-line.big .l { color: #ffe08a; }
.res-line.big .p { color: #ffe08a; text-shadow: 0 0 12px rgba(255,210,90,0.8); }
#res-total { display: flex; align-items: baseline; justify-content: space-between; gap: 14px; margin-top: 4px;
  padding-top: 8px; border-top: 2px solid rgba(255,255,255,0.35); }
#res-total span { font-size: 12px; letter-spacing: 0.4em; color: #ffd6c0; }
#res-total b { font-size: clamp(26px, 4.4vw, 52px); font-weight: 900; font-variant-numeric: tabular-nums; color: #fff;
  text-shadow: 0 0 18px rgba(255,170,80,0.8); }
#res-stats { font-size: 11px; color: rgba(255,255,255,0.5); letter-spacing: 0.1em; }
#result .btnrow { margin-top: 12px; }
@media (max-height: 480px) {
  #res-panel { gap: 3px; padding: 8px 22px 8px 30px; }
  #res-title { font-size: 11px; letter-spacing: 0.3em; }
  #res-rank { margin: 0 0 2px; }
  #res-rank .rk-sub { font-size: 9px; margin-top: 2px; letter-spacing: 0.35em; }
  .rk-lv4 .rk-name { font-size: clamp(28px, 5.4vw, 54px); }
  .rk-lv3 .rk-name { font-size: clamp(25px, 4.6vw, 46px); }
  .rk-lv2 .rk-name { font-size: clamp(22px, 3.8vw, 38px); }
  .rk-lv1 .rk-name { font-size: clamp(19px, 3vw, 30px); }
  .rk-lv0 .rk-name { font-size: clamp(17px, 2.6vw, 26px); }
  #res-body { gap: 14px; }
  #res-cap { width: clamp(66px, 10vw, 112px); }
  .res-line { padding: 2px 0; }
  .res-line .l { font-size: 12px; }
  .res-line .p { font-size: 13px; }
  #res-total { padding-top: 5px; margin-top: 2px; }
  #res-total b { font-size: clamp(22px, 3.4vw, 38px); }
  #res-total span { font-size: 10px; letter-spacing: 0.25em; }
  #res-stats { font-size: 10px; }
  #result .btnrow { margin-top: 6px; }
  #result .overlay button, #result button { font-size: 15px; padding: 8px 24px; }
}
@media (max-aspect-ratio: 1/1), (max-width: 700px) {
  #result { flex-direction: column; justify-content: flex-end; }
  #res-panel { width: 100%; height: auto; padding: 14px 18px 20px; justify-content: flex-end;
    background: linear-gradient(180deg, rgba(10,3,9,0) 0%, rgba(12,4,11,0.55) 26%, rgba(12,4,11,0.93) 46%); }
  #res-body { gap: 14px; }
  #res-cap { width: clamp(80px, 22vw, 130px); }
}
#help { position: absolute; left: 50%; bottom: max(10px, env(safe-area-inset-bottom)); transform: translateX(-50%); font-size: 11px; color: rgba(255,255,255,0.6);
  letter-spacing: 0.1em; text-shadow: 0 1px 3px #000; white-space: nowrap; }
#fps { position: absolute; left: 8px; bottom: 6px; font-size: 10px; color: rgba(255,255,255,0.4); font-family: monospace; }
`;

import type { ScoreResult } from './Score';

export type CharId = 'mahiro' | 'chisato';
export const CHARS: Record<CharId, { name: string; file: string; cap: string; tint: string }> = {
  mahiro: { name: '深川まひろ', file: 'player.vrm', cap: 'mahiro_cap.png', tint: '#ff3a2a' },
  chisato: { name: '杉本ちさと', file: 'chisato.vrm', cap: 'chisato_cap.png', tint: '#a040ff' },
};

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
  private resRank!: HTMLElement;
  private resRankName!: HTMLElement;
  private resRankSub!: HTMLElement;
  private resLines!: HTMLElement;
  private resTotal!: HTMLElement;
  private resCap!: HTMLElement;
  private resImg!: HTMLImageElement;
  private countRaf = 0;
  private hud!: HTMLElement;
  private fpsEl: HTMLElement;
  private comboTimer = 0;
  private flashV = 0;
  private vigV = 0;
  onStart: (c: CharId) => void = () => {};
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
      <div id="help">左半分ドラッグで移動 ／ PC: WASD 移動・J 打(連打)・K 回避・L 受け流し・I 射撃・Q 交代</div>
      <div id="fps"></div>
      <div id="flash"></div>
      <div class="overlay" id="title">
        <h1>炎舞<small>─ ENBU ─</small></h1>
        <p>妖魔の少女・紫苑が放つ立体弾幕を、回避と受け流しでさばきながらコンボを叩き込め。<br>
        「受」は弾に触れる直前に押すと弾き返して反撃できる。「避」は無敵で突っ切れる。</p>
        <div class="tap" id="loading">読み込み中…</div>
        <div class="charsel hidden" id="charsel">
          <button class="charcard" data-char="mahiro"><b>深川まひろ</b><small>FUKAGAWA MAHIRO</small></button>
          <button class="charcard" data-char="chisato"><b>杉本ちさと</b><small>SUGIMOTO CHISATO</small></button>
        </div>
        <button id="startbtn" class="hidden">ゲーム開始</button>
        <div class="hint">キャラクターを選んで「ゲーム開始」 ／ ゲーム中は「交代」でいつでも入れ替え</div>
      </div>
      <button id="swap" class="hidden"><span>交代</span><small>Q</small></button>
      <div class="overlay hidden" id="result">
        <div id="res-panel">
          <div id="res-title">浄化完了</div>
          <div id="res-rank" class="rk-lv0"><i class="rays"></i><span class="rk-name">下手人間</span><span class="rk-sub">ROOKIE</span></div>
          <div id="res-body">
            <div id="res-cap"><img id="res-img" alt=""></div>
            <div id="res-lines"></div>
          </div>
          <div id="res-total"><span>TOTAL SCORE</span><b id="res-total-n">0</b></div>
          <div id="res-stats"></div>
          <div class="btnrow"><button id="retry">もう一度</button></div>
        </div>
      </div>`;
    parent.appendChild(hud);
    this.hud = hud;
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
    this.resultTitle = q('#res-title');
    this.resultStats = q('#res-stats');
    this.resRank = q('#res-rank');
    this.resRankName = q('#res-rank .rk-name');
    this.resRankSub = q('#res-rank .rk-sub');
    this.resLines = q('#res-lines');
    this.resTotal = q('#res-total-n');
    this.resCap = q('#res-cap');
    this.resImg = q('#res-img') as HTMLImageElement;
    this.resImg.addEventListener('error', () => this.resCap.classList.add('noimg'));
    this.fpsEl = q('#fps');
    this.playerName = q('#php-wrap .name');
    this.loadingEl = q('#loading');
    this.charsel = q('#charsel');
    this.swapBtn = q('#swap');
    this.cards = Array.from(hud.querySelectorAll<HTMLElement>('.charcard'));
    for (const b of this.cards) {
      b.addEventListener('click', (e) => { e.stopPropagation(); this.select(b.dataset.char as CharId); });
    }
    this.startBtn = q('#startbtn');
    this.startBtn.addEventListener('click', (e) => { e.stopPropagation(); this.onStart(this.selected); });
    this.select('mahiro');
    this.swapBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.onSwap(); });
    q('#retry').addEventListener('click', () => this.onRetry());
  }

  private playerName: HTMLElement;
  private loadingEl: HTMLElement;
  private charsel: HTMLElement;
  private swapBtn: HTMLElement;
  private cards: HTMLElement[] = [];
  private startBtn: HTMLElement;
  selected: CharId = 'mahiro';
  onSwap: () => void = () => {};
  /** タイトルでキャラを選んだとき（背景のキャラを差し替える用） */
  onSelect: (c: CharId) => void = () => {};

  private select(c: CharId) {
    this.selected = c;
    for (const b of this.cards) b.classList.toggle('selected', b.dataset.char === c);
    this.onSelect(c);
  }

  /** 読み込み完了後にキャラ選択を出す */
  setReady(ready: boolean) {
    this.loadingEl.style.display = ready ? 'none' : '';
    this.charsel.classList.toggle('hidden', !ready);
    this.startBtn.classList.toggle('hidden', !ready);
  }
  setPlayerName(name: string) { this.playerName.textContent = name; }
  setSwapVisible(v: boolean) { this.swapBtn.classList.toggle('hidden', !v); }
  setSwapCooldown(v: boolean) { this.swapBtn.classList.toggle('cool', v); }

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
  showResult(win: boolean, score: ScoreResult, char: CharId, seconds: number, maxCombo: number) {
    this.resultTitle.textContent = win ? '浄 化 完 了' : '散 華';
    this.result.classList.toggle('win', win);
    this.result.classList.toggle('lose', !win);

    this.resRank.className = `rk-lv${score.rank.level}`;
    this.resRankName.textContent = score.rank.name;
    this.resRankSub.textContent = score.rank.sub;

    // 明細（0 点の行も内訳が分かるよう残し、薄く表示）
    this.resLines.innerHTML = score.lines.map((l, i) => `
      <div class="res-line${l.points === 0 ? ' zero' : ''}${l.big ? ' big' : ''}" style="animation-delay:${80 + i * 40}ms">
        <span class="l">${l.label}</span><span class="d">${l.detail}</span><span class="p">${l.points.toLocaleString()}</span>
      </div>`).join('');

    // 勝ったキャラの立ち絵のみ表示
    this.resCap.classList.toggle('noimg', !win);
    if (win) {
      this.resCap.style.setProperty('--tint', CHARS[char].tint);
      this.resImg.src = `${import.meta.env.BASE_URL}images/${CHARS[char].cap}`;
    }

    this.resultStats.textContent = `TIME ${seconds.toFixed(1)}s ／ MAX COMBO ${maxCombo}`;
    this.hud.classList.add('result-on');
    this.result.classList.remove('hidden');
    this.countUp(score.total, 420 + score.lines.length * 40);
  }

  /** 合計スコアを数え上げる */
  private countUp(total: number, delayMs: number) {
    cancelAnimationFrame(this.countRaf);
    this.resTotal.textContent = '0';
    const t0 = performance.now() + delayMs;
    const dur = 1100;
    const step = () => {
      const now = performance.now();
      const k = Math.min(1, Math.max(0, (now - t0) / dur));
      const e = 1 - Math.pow(1 - k, 3);
      this.resTotal.textContent = Math.round(total * e).toLocaleString();
      if (k < 1) this.countRaf = requestAnimationFrame(step);
    };
    this.countRaf = requestAnimationFrame(step);
  }
  hideResult() { this.result.classList.add('hidden'); this.hud.classList.remove('result-on'); }
}
