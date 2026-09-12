const CSS = `
/* 操作 UI（#controls、z-index 20）より手前に置く。
   スティックの領域が左半分を覆うので、後ろにあると交代ボタンをタップできない */
#hud { position: fixed; inset: 0; pointer-events: none; z-index: 30; }
.bar { position: absolute; height: 14px; border-radius: 7px; background: rgba(0,0,0,0.5); border: 1.5px solid rgba(255,255,255,0.35); overflow: hidden; }
.bar > i { position: absolute; left: 0; top: 0; bottom: 0; width: 100%; transform-origin: left; transition: transform 0.12s; }
.bar > b { position: absolute; left: 0; top: 0; bottom: 0; width: 100%; transform-origin: left; background: rgba(255,255,255,0.55); transition: transform 0.5s ease-out 0.2s; }
#php-wrap { position: absolute; left: max(16px, env(safe-area-inset-left)); top: max(12px, env(safe-area-inset-top)); width: min(32vw, 240px); }
#php-wrap .name { font-size: 13px; font-weight: 700; letter-spacing: 0.15em; text-shadow: 0 1px 4px #000; margin-bottom: 4px; color: #ffd6c0; }
#php { position: relative; width: 100%; }
#php > i { background: linear-gradient(90deg, #ff3b2f, #ff9a4a); }
/* 主人公のゲージと重ならないよう、敵のゲージは一段下げる */
/* 主人公のゲージ（左上）と交代ボタン（左）に被らないよう右へ寄せる。
   上端は ♪ ボタンの下に来るように 46px 下げてある */
#bhp-wrap { position: absolute; right: max(16px, env(safe-area-inset-right)); top: calc(max(12px, env(safe-area-inset-top)) + 46px); width: min(46vw, 400px); text-align: right; }
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
.overlay .btnrow { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 22px; }
.overlay button { pointer-events: auto; font-size: 18px; font-weight: 700; padding: 12px 30px; border-radius: 30px; border: 2px solid #ffb347;
  background: linear-gradient(180deg, rgba(255,120,60,0.5), rgba(160,30,20,0.6)); color: #fff; letter-spacing: 0.2em; }
.overlay button:active { transform: scale(0.95); }
.overlay .stats { font-size: 15px; color: #ffe6c0; letter-spacing: 0.1em; }
.overlay .res-win { color: #ffe08a; }
.overlay .res-lose { background: linear-gradient(180deg, #d0c0ff, #8a5aff); -webkit-background-clip: text; background-clip: text; }
.charsel { display: flex; gap: 18px; margin-top: 22px; flex-wrap: wrap; justify-content: center; }
.charsel.hidden { display: none; }
.charcard { pointer-events: auto; display: flex; flex-direction: column; align-items: center; gap: 8px;
  min-width: 150px; padding: 12px 18px 14px; border-radius: 16px; border: 2px solid rgba(255,214,192,0.5);
  background: linear-gradient(180deg, rgba(60,20,40,0.7), rgba(20,6,14,0.85)); color: #fff; font-family: inherit; cursor: pointer;
  transition: transform 0.12s, border-color 0.12s, box-shadow 0.12s; }
.charcard b { display: block; font-size: 20px; letter-spacing: 0.18em; }
.charcard small { display: block; font-size: 9px; letter-spacing: 0.24em; color: #ffd6c0; margin-top: 2px; }
.cc-img { display: block; width: clamp(92px, 12vw, 140px); aspect-ratio: 0.64; border-radius: 12px; overflow: hidden;
  box-shadow: 0 0 0 2px rgba(255,255,255,0.18); transition: box-shadow 0.12s; }
.cc-img img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: 2% center;
  transition: filter 0.12s; filter: saturate(0.45) brightness(0.62); }
.cc-img.noimg { display: none; }
.charcard:hover, .charcard:active { transform: scale(1.04); border-color: rgba(255,255,255,0.75); }
.charcard.selected { border-color: var(--tint, #ffb347); box-shadow: 0 0 20px -2px var(--tint, #ffb347); }
.charcard.selected .cc-img { box-shadow: 0 0 0 2px rgba(255,255,255,0.6), 0 0 22px var(--tint, #ffb347); }
.charcard.selected .cc-img img { filter: none; }
#startbtn { pointer-events: auto; margin-top: 22px; font-size: 22px; font-weight: 900; padding: 14px 44px; border-radius: 34px; border: 2px solid #ffe0a0;
  background: linear-gradient(180deg, #ffb347, #ff5a2a); color: #fff; letter-spacing: 0.3em; font-family: inherit; cursor: pointer; box-shadow: 0 0 22px rgba(255,120,60,0.6); }
#startbtn:active { transform: scale(0.95); }
#startbtn.hidden { display: none; }
.overlay .hint { margin-top: 18px; font-size: 12px; color: rgba(255,255,255,0.65); letter-spacing: 0.1em; }
#swap { position: absolute; left: max(16px, env(safe-area-inset-left)); top: calc(max(12px, env(safe-area-inset-top)) + 48px); pointer-events: auto;
  width: 124px; padding: 5px 8px 6px; border-radius: 12px; border: 2px solid rgba(255,255,255,0.45); background: rgba(40,10,25,0.55); color: #fff; font-family: inherit;
  text-align: left; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); transition: transform 0.06s, opacity 0.2s; }
#swap .sw-l { display: inline-block; font-weight: 700; font-size: 12px; letter-spacing: 0.12em; }
#swap .sw-k { float: right; font-size: 9px; opacity: 0.65; line-height: 16px; }
#swap .sw-name { display: block; font-size: 10px; color: #ffd6c0; letter-spacing: 0.06em; margin: 1px 0 3px; }
#swap .sw-hp { position: relative; display: block; height: 7px; border-radius: 4px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.3); overflow: hidden; }
#swap .sw-hp > i { position: absolute; inset: 0; transform-origin: left; background: linear-gradient(90deg, #3fbf6a, #8ee08a); transition: transform 0.2s; }
#swap.hidden { display: none; }
#swap.cool { opacity: 0.45; }
#swap:active { transform: scale(0.92); background: rgba(255,120,60,0.6); }
/* 指で押しやすいよう当たり判定を外へ広げる（見た目は変えない） */
#swap::before { content: ''; position: absolute; inset: -10px; border-radius: 16px; }
/* ---- リザルト ---- */
#result { background: none; flex-direction: row; align-items: stretch; justify-content: flex-end; }
#result.lose { background: radial-gradient(ellipse at center, rgba(18,4,13,0.94), rgba(5,1,4,0.985)); flex-direction: column; align-items: center; justify-content: center; }
/* 戦闘用の HUD はプレイ中だけ出す（タイトルとリザルトでは隠す） */
#hud:not(.playing) #php-wrap, #hud:not(.playing) #bhp-wrap, #hud:not(.playing) #help, #hud:not(.playing) #combo,
#hud.result-on #php-wrap, #hud.result-on #bhp-wrap, #hud.result-on #help, #hud.result-on #combo { display: none; }
#res-panel, #rank-panel { width: min(58vw, 760px); height: 100%; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center;
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
/* 枠はゆっくり息をするように光る */
#res-cap::before { content: ''; position: absolute; inset: -22px; border-radius: 30px; pointer-events: none; z-index: -1;
  background: radial-gradient(ellipse at center, var(--tint, #ff3a2a) 0%, transparent 68%);
  opacity: 0.3; filter: blur(10px); animation: capaura 3.4s ease-in-out infinite; }
#res-cap::after { content: ''; position: absolute; inset: -6px; border-radius: 18px; pointer-events: none;
  box-shadow: 0 0 22px var(--tint, #ff3a2a), inset 0 0 0 2px rgba(255,255,255,0.4);
  animation: capglow 3.4s ease-in-out infinite; }
@keyframes capglow { 0%, 100% { opacity: 0.42; box-shadow: 0 0 16px var(--tint, #ff3a2a), inset 0 0 0 2px rgba(255,255,255,0.32); }
  50% { opacity: 0.9; box-shadow: 0 0 40px var(--tint, #ff3a2a), inset 0 0 0 2px rgba(255,255,255,0.6); } }
@keyframes capaura { 0%, 100% { opacity: 0.22; transform: scale(0.96); } 50% { opacity: 0.5; transform: scale(1.04); } }
#res-cap.noimg { display: none; }
#res-lines { flex: 1 1 auto; min-width: 0; animation: rkfade 0.45s ease-out 0.1s backwards; }
.res-line { display: flex; align-items: baseline; gap: 10px; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.12);
  opacity: 1; }
.res-line .l { font-size: 13px; color: #ffd6c0; letter-spacing: 0.08em; white-space: nowrap; }
.res-line .d { font-size: 11px; color: rgba(255,255,255,0.45); flex: 1 1 auto; text-align: left; }
.res-line .p { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; color: #fff; white-space: nowrap; }
.res-line.zero .l, .res-line.zero .p { opacity: 0.4; }
.res-line.big .l { color: #ffe08a; }
.res-line.big .p { color: #ffe08a; text-shadow: 0 0 12px rgba(255,210,90,0.8); }
.res-line.sum { border-bottom: none; padding-top: 8px; }
.res-line.sum .l, .res-line.sum .p { color: rgba(255,255,255,0.72); }
.res-line.mult { border-bottom: none; }
.res-line.mult .l { color: #9ad8ff; }
.res-line.mult .p { color: #9ad8ff; font-size: 17px; text-shadow: 0 0 12px rgba(120,200,255,0.7); }
#res-total { display: flex; align-items: baseline; justify-content: space-between; gap: 14px; margin-top: 4px;
  padding-top: 8px; border-top: 2px solid rgba(255,255,255,0.35); }
#res-total span { font-size: 12px; letter-spacing: 0.4em; color: #ffd6c0; }
#res-total b { font-size: clamp(26px, 4.4vw, 52px); font-weight: 900; font-variant-numeric: tabular-nums; color: #fff;
  text-shadow: 0 0 18px rgba(255,170,80,0.8); }
#res-stats { font-size: 11px; color: rgba(255,255,255,0.5); letter-spacing: 0.1em; }
#result .btnrow { margin-top: 12px; }
@media (max-height: 480px) {
  #swap { width: 108px; padding: 4px 7px 5px; }
  #swap .sw-name { font-size: 9px; }
  #title h1 { font-size: clamp(28px, 6vw, 46px); }
  #title h1 small { font-size: 0.28em; letter-spacing: 0.5em; margin-top: 1px; }
  #title p { font-size: 11px; line-height: 1.5; margin: 6px 20px; }
  .charsel { gap: 12px; margin-top: 10px; }
  .charcard { min-width: 0; padding: 8px 12px 10px; gap: 5px; }
  .charcard b { font-size: 16px; letter-spacing: 0.12em; }
  .charcard small { font-size: 8px; letter-spacing: 0.18em; }
  .cc-img { width: clamp(62px, 8vw, 88px); }
  #startbtn { margin-top: 8px; font-size: 17px; padding: 9px 32px; }
  .overlay .hint { margin-top: 6px; font-size: 10px; }
  #title p { margin: 4px 20px; }
  #res-panel, #rank-panel { gap: 3px; padding: 8px 22px 8px 30px; }
  #res-title { font-size: 11px; letter-spacing: 0.3em; }
  #res-rank { margin: 0 0 2px; }
  #res-rank .rk-sub { font-size: 9px; margin-top: 2px; letter-spacing: 0.35em; }
  .rk-lv4 .rk-name { font-size: clamp(28px, 5.4vw, 54px); }
  .rk-lv3 .rk-name { font-size: clamp(25px, 4.6vw, 46px); }
  .rk-lv2 .rk-name { font-size: clamp(22px, 3.8vw, 38px); }
  .rk-lv1 .rk-name { font-size: clamp(19px, 3vw, 30px); }
  .rk-lv0 .rk-name { font-size: clamp(17px, 2.6vw, 26px); }
  #res-body { gap: 14px; }
  #res-cap { width: clamp(60px, 9vw, 100px); }
  .res-line { padding: 1px 0; }
  .res-line .l { font-size: 11px; }
  .res-line .d { font-size: 10px; }
  .res-line .p { font-size: 12px; }
  .res-line.mult .p { font-size: 14px; }
  .res-line.sum { padding-top: 4px; }
  #res-total { padding-top: 5px; margin-top: 2px; }
  #res-total b { font-size: clamp(22px, 3.4vw, 38px); }
  #res-total span { font-size: 10px; letter-spacing: 0.25em; }
  #res-stats { display: none; }
  #result .btnrow { margin-top: 6px; }
  #result .overlay button, #result button { font-size: 15px; padding: 8px 24px; }
}
@media (max-aspect-ratio: 1/1), (max-width: 700px) {
  #result { flex-direction: column; justify-content: flex-end; }
  #res-panel, #rank-panel { width: 100%; height: auto; padding: 14px 18px 20px; justify-content: flex-end;
    background: linear-gradient(180deg, rgba(10,3,9,0) 0%, rgba(12,4,11,0.55) 26%, rgba(12,4,11,0.93) 46%); }
  #res-body { gap: 14px; }
  #res-cap { width: clamp(80px, 22vw, 130px); }
}
#help { position: absolute; left: 50%; bottom: max(10px, env(safe-area-inset-bottom)); transform: translateX(-50%); font-size: 11px; color: rgba(255,255,255,0.6);
  letter-spacing: 0.1em; text-shadow: 0 1px 3px #000; white-space: nowrap; }
/* 自己ベスト更新などの知らせ */
#res-new { display: flex; align-items: baseline; justify-content: center; gap: 10px; margin: 6px 0 2px;
  font-weight: 900; letter-spacing: 0.12em; animation: newrec 1.1s ease-in-out infinite; }
#res-new.hidden { display: none; }
#res-new b { font-size: 21px; background: linear-gradient(90deg, #ffe98a, #ffb347, #fff2c0, #ffb347);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 10px rgba(255,190,90,0.8)); }
#res-new small { font-size: 11px; font-weight: 700; color: #ffd6a0; letter-spacing: 0.08em; }
#res-new.top b { background: linear-gradient(90deg, #fff0a0, #ff7ad9, #8ad4ff, #fff0a0); }
@keyframes newrec { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }

/* 名前の入力（タイトル） */
#nameRow { display: flex; align-items: center; gap: 8px; margin-top: 16px; pointer-events: auto; }
#nameRow.hidden { display: none; }
#nameRow label { font-size: 12px; letter-spacing: 0.2em; color: #ffd6c0; }
#pname { width: 150px; padding: 8px 12px; border-radius: 20px; border: 2px solid rgba(255,179,71,0.7);
  background: rgba(20,6,14,0.8); color: #fff; font-size: 15px; font-family: inherit; text-align: center; outline: none; }
#pname:focus { border-color: #ffd86a; box-shadow: 0 0 12px rgba(255,180,80,0.5); }
#rankbtn { pointer-events: auto; font-size: 13px; font-weight: 700; padding: 8px 18px; border-radius: 20px;
  border: 2px solid rgba(200,160,255,0.7); background: rgba(30,10,40,0.8); color: #e8c8ff; cursor: pointer; font-family: inherit; }
#rankbtn:active { transform: scale(0.95); }

/* ランキングの表 */
.ranklist { width: 100%; display: flex; flex-direction: column; gap: 3px; }
.rank-row { display: grid; grid-template-columns: 34px 1fr auto; align-items: center; gap: 8px;
  padding: 5px 10px; border-radius: 8px; background: rgba(255,255,255,0.05); font-size: 13px; }
.rank-row .no { text-align: right; font-weight: 900; color: #ffd6a0; font-size: 12px; }
.rank-row .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
.rank-row .nm small { display: block; font-size: 9px; opacity: 0.6; letter-spacing: 0.05em; }
.rank-row .sc { font-weight: 900; letter-spacing: 0.03em; }
.rank-row.me { background: linear-gradient(90deg, rgba(255,140,60,0.35), rgba(255,90,140,0.18)); box-shadow: 0 0 0 1px rgba(255,190,120,0.5) inset; }
.rank-row.top1 .no { color: #ffe98a; }
.rank-row.top2 .no { color: #dfe6ff; }
.rank-row.top3 .no { color: #ffc08a; }
.rank-empty { font-size: 12px; color: rgba(255,255,255,0.5); padding: 10px; }
#rank-panel { width: min(92vw, 620px); height: auto; max-height: 84vh; overflow-y: auto; align-items: stretch; }
#rank-note { font-size: 11px; color: rgba(255,255,255,0.55); margin: 8px 0 2px; letter-spacing: 0.05em; }
#rank-title { font-size: 20px; font-weight: 900; letter-spacing: 0.3em; color: #ffe0a0; margin-bottom: 10px; }
/* リザルトの中に出す短いランキング */
#res-rankbox { margin-top: 12px; }
#res-rankbox .rank-row { font-size: 12px; }

/* タイトルやリザルトのオーバーレイに隠れないよう手前に出す
   （以前はタイトル中に ♪ を押せなかった） */
#music { z-index: 5; position: absolute; right: max(14px, env(safe-area-inset-right)); top: max(12px, env(safe-area-inset-top)); pointer-events: auto;
  width: 38px; height: 38px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.4); background: rgba(40,10,25,0.5);
  color: #fff; font-size: 16px; line-height: 1; font-family: inherit; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); transition: opacity 0.2s; }
/* 切れていることが一目で分かるように、斜線を引いて色も落とす。
   薄くするだけだと気づかれず「BGM が聞こえない」と言われた（2026-09-12） */
#music.off { opacity: 0.55; color: rgba(255,255,255,0.55); border-color: rgba(255,255,255,0.3); }
#music.off::after { content: ''; position: absolute; left: 50%; top: 50%; width: 128%; height: 2px;
  background: #ff8a8a; border-radius: 2px; transform: translate(-50%, -50%) rotate(-45deg);
  box-shadow: 0 0 6px rgba(255,90,90,0.8); }
#music:active { transform: scale(0.92); }
#fps { position: absolute; left: 8px; bottom: 6px; font-size: 10px; color: rgba(255,255,255,0.4); font-family: monospace; }
`;

import type { ScoreResult } from './Score';
import type { Entry } from './Rank';

/** 名前をそのまま HTML に入れないための逃がし */
const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export type CharId = 'mahiro' | 'chisato';
export const CHARS: Record<CharId, { name: string; sub: string; file: string; cap: string; tint: string }> = {
  mahiro: { name: '深川まひろ', sub: 'FUKAGAWA MAHIRO', file: 'player.vrm', cap: 'mahiro_cap.png', tint: '#ff3a2a' },
  chisato: { name: '杉本ちさと', sub: 'SUGIMOTO CHISATO', file: 'chisato.vrm', cap: 'chisato_cap.png', tint: '#a040ff' },
};
export const CHAR_IDS = Object.keys(CHARS) as CharId[];

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
      <button id="music" title="BGM">♪</button>
      <div id="fps"></div>
      <div id="flash"></div>
      <div class="overlay" id="title">
        <h1>炎舞<small>─ ENBU ─</small></h1>
        <p>妖魔の少女・紫苑が放つ立体弾幕を、回避と受け流しでさばきながらコンボを叩き込め。<br>
        「受」は弾に触れる直前に押すと弾き返して反撃できる。「避」は無敵で突っ切れる。</p>
        <div class="tap" id="loading">読み込み中…</div>
        <div class="charsel hidden" id="charsel">${CHAR_IDS.map((id) => `
          <button class="charcard" data-char="${id}" style="--tint:${CHARS[id].tint}">
            <span class="cc-img"><img src="${import.meta.env.BASE_URL}images/${CHARS[id].cap}" alt=""></span>
            <b>${CHARS[id].name}</b><small>${CHARS[id].sub}</small>
          </button>`).join('')}
        </div>
        <div id="nameRow" class="hidden">
          <label for="pname">なまえ</label>
          <input id="pname" maxlength="12" placeholder="ななし" autocomplete="off" spellcheck="false">
          <button id="rankbtn" type="button">ランキング</button>
        </div>
        <button id="startbtn" class="hidden">ゲーム開始</button>
        <div class="hint">キャラクターを選んで「ゲーム開始」 ／ ゲーム中は「交代」でいつでも入れ替え</div>
      </div>
      <button id="swap" class="hidden">
        <span class="sw-l">交代</span><span class="sw-k">Q</span>
        <span class="sw-name">-</span>
        <span class="sw-hp"><i></i></span>
      </button>
      <div class="overlay hidden" id="rankboard">
        <div id="rank-panel">
          <div id="rank-title">ランキング</div>
          <div id="rank-list" class="ranklist"></div>
          <div id="rank-note"></div>
          <div class="btnrow"><button id="rankclose">閉じる</button></div>
        </div>
      </div>
      <div class="overlay hidden" id="result">
        <div id="res-panel">
          <div id="res-title">浄化完了</div>
          <div id="res-rank" class="rk-lv0"><i class="rays"></i><span class="rk-name">下手人間</span><span class="rk-sub">ROOKIE</span></div>
          <div id="res-body">
            <div id="res-cap"><img id="res-img" alt=""></div>
            <div id="res-lines"></div>
          </div>
          <div id="res-total"><span>TOTAL SCORE</span><b id="res-total-n">0</b></div>
          <div id="res-new" class="hidden"><b></b><small></small></div>
          <div id="res-stats"></div>
          <div id="res-rankbox"></div>
          <div class="btnrow">
            <button id="retry">もう一度</button>
          </div>
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
    this.resNew = q('#res-new');
    this.resCap = q('#res-cap');
    this.resImg = q('#res-img') as HTMLImageElement;
    this.resImg.addEventListener('error', () => this.resCap.classList.add('noimg'));
    this.fpsEl = q('#fps');
    this.playerName = q('#php-wrap .name');
    this.loadingEl = q('#loading');
    this.charsel = q('#charsel');
    this.swapBtn = q('#swap');
    this.swapName = q('#swap .sw-name');
    this.swapHp = q('#swap .sw-hp > i');
    for (const im of hud.querySelectorAll<HTMLImageElement>('.cc-img img')) {
      im.addEventListener('error', () => im.parentElement?.classList.add('noimg'));
    }
    this.cards = Array.from(hud.querySelectorAll<HTMLElement>('.charcard'));
    for (const b of this.cards) {
      b.addEventListener('click', (e) => { e.stopPropagation(); this.select(b.dataset.char as CharId, true); });
    }
    this.startBtn = q('#startbtn');
    this.startBtn.addEventListener('click', (e) => { e.stopPropagation(); this.onStart(this.selected); });
    this.musicBtn = q('#music');
    this.musicBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.musicOn = !this.musicOn;
      this.musicBtn.classList.toggle('off', !this.musicOn);
      try { localStorage.setItem('enbu.music', this.musicOn ? '1' : '0'); } catch { /* 保存できなくても動く */ }
      this.onMusicToggle(this.musicOn);
    });
    try { this.musicOn = localStorage.getItem('enbu.music') !== '0'; } catch { /* 既定は鳴らす */ }
    // ?nomusic で切った状態から始める（見た目の確認用）
    if (new URLSearchParams(location.search).has('nomusic')) this.musicOn = false;
    this.musicBtn.classList.toggle('off', !this.musicOn);
    this.select('mahiro');
    this.swapBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.onSwap(); });
    q('#retry').addEventListener('click', () => this.onRetry());

    // 名前の入力。打ち替えるたびに呼び出し側へ渡す
    this.nameRow = q('#nameRow');
    this.nameInput = q('#pname') as HTMLInputElement;
    this.nameInput.addEventListener('input', () => this.onName(this.nameInput.value));
    this.nameInput.addEventListener('keydown', (e) => {
      e.stopPropagation(); // ゲームの操作キーに拾われないように
      if (e.key === 'Enter') this.nameInput.blur();
    });
    this.nameInput.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.rankBoard = q('#rankboard');
    this.rankList = q('#rank-list');
    this.rankNote = q('#rank-note');
    this.resRankBox = q('#res-rankbox');
    q('#rankbtn').addEventListener('click', (e) => { e.stopPropagation(); this.onRankOpen(); });
    q('#rankclose').addEventListener('click', (e) => { e.stopPropagation(); this.hideRankBoard(); });
  }

  private playerName: HTMLElement;
  private loadingEl: HTMLElement;
  private charsel: HTMLElement;
  private swapBtn: HTMLElement;
  private swapName!: HTMLElement;
  private swapHp!: HTMLElement;
  private cards: HTMLElement[] = [];
  private startBtn: HTMLElement;
  selected: CharId = 'mahiro';
  onSwap: () => void = () => {};
  /** タイトルでキャラを選んだとき（背景のキャラを差し替える用） */
  onSelect: (c: CharId) => void = () => {};

  private nameRow!: HTMLElement;
  private nameInput!: HTMLInputElement;
  private rankBoard!: HTMLElement;
  private rankList!: HTMLElement;
  private rankNote!: HTMLElement;
  private resRankBox!: HTMLElement;
  private resNew!: HTMLElement;

  /**
   * 記録の知らせ。
   * 'first' はじめての記録、'record' 自己ベスト更新、'top' みんなの 1 位、'none' 何も出さない
   */
  setRecordNote(kind: 'none' | 'first' | 'record' | 'top', gain = 0) {
    if (!this.resNew) return;
    this.resNew.classList.toggle('hidden', kind === 'none');
    this.resNew.classList.toggle('top', kind === 'top');
    if (kind === 'none') return;
    const label = kind === 'top' ? 'WORLD 1st' : 'NEW RECORD';
    const sub = kind === 'top' ? 'みんなの 1 位' : kind === 'first' ? 'はじめての記録' : `自己ベスト +${gain.toLocaleString()}`;
    (this.resNew.querySelector('b') as HTMLElement).textContent = label;
    (this.resNew.querySelector('small') as HTMLElement).textContent = sub;
  }
  /** 名前が打ち替えられたとき */
  onName: (v: string) => void = () => {};
  /** タイトルの「ランキング」 */
  onRankOpen: () => void = () => {};

  /** 入力欄に入っている名前 */
  get enteredName() { return this.nameInput?.value ?? ''; }
  setName(v: string) { if (this.nameInput) this.nameInput.value = v; }

  /**
   * ランキングの表を描く。
   * meAt は自分の記録の時刻。一致する行を強調し、上位から外れていたら末尾に足す
   */
  private renderList(el: HTMLElement, entries: Entry[], meAt: number, limit: number) {
    if (entries.length === 0) {
      el.innerHTML = '<div class="rank-empty">まだ記録がありません</div>';
      return;
    }
    const meIdx = meAt === 0 ? -1 : entries.findIndex((e) => e.at === meAt);
    const rows = entries.slice(0, limit).map((e, i) => this.row(e, i + 1, i === meIdx));
    if (meIdx >= limit) {
      rows.push('<div class="rank-row" style="opacity:.5"><span class="no"></span><span class="nm">…</span><span class="sc"></span></div>');
      rows.push(this.row(entries[meIdx], meIdx + 1, true));
    }
    el.innerHTML = rows.join('');
  }

  private row(e: Entry, no: number, me: boolean) {
    const cls = `rank-row${me ? ' me' : ''}${no <= 3 ? ` top${no}` : ''}`;
    const sub = [e.rank, e.char, `${e.seconds.toFixed(1)}s`].filter(Boolean).join(' ／ ');
    return `<div class="${cls}"><span class="no">${no}</span>` +
      `<span class="nm">${esc(e.name)}<small>${esc(sub)}</small></span>` +
      `<span class="sc">${e.score.toLocaleString()}</span></div>`;
  }

  /** タイトルから開くランキング */
  showRankBoard(entries: Entry[], note: string, meAt = 0) {
    this.renderList(this.rankList, entries, meAt, 20);
    this.rankNote.textContent = note;
    this.rankBoard.classList.remove('hidden');
  }
  hideRankBoard() { this.rankBoard.classList.add('hidden'); }
  /** リザルトの中に出す短い順位表 */
  setResultRanking(entries: Entry[], meAt: number) {
    this.renderList(this.resRankBox, entries, meAt, 5);
  }

  private musicBtn!: HTMLElement;
  /** BGM を鳴らすか。localStorage に覚える */
  musicOn = true;
  onMusicToggle: (on: boolean) => void = () => {};
  /** 最初の操作（AudioContext を開けるようになった合図） */
  onGesture: () => void = () => {};

  private select(c: CharId, byUser = false) {
    this.selected = c;
    for (const b of this.cards) b.classList.toggle('selected', b.dataset.char === c);
    this.onSelect(c);
    if (byUser) this.onGesture();
  }

  /** 読み込み完了後にキャラ選択を出す */
  setReady(ready: boolean) {
    this.loadingEl.style.display = ready ? 'none' : '';
    this.charsel.classList.toggle('hidden', !ready);
    this.startBtn.classList.toggle('hidden', !ready);
    this.nameRow.classList.toggle('hidden', !ready);
  }
  setPlayerName(name: string) { this.playerName.textContent = name; }
  /** 戦闘用 HUD の表示。タイトル中は出さない */
  setPlaying(v: boolean) { this.hud.classList.toggle('playing', v); }
  setSwapVisible(v: boolean) { this.swapBtn.classList.toggle('hidden', !v); }
  setSwapCooldown(v: boolean) { this.swapBtn.classList.toggle('cool', v); }
  /** 控えているキャラの名前と体力 */
  setRest(name: string, frac: number) {
    this.swapName.textContent = name;
    this.swapHp.style.transform = `scaleX(${Math.max(0, frac)})`;
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
  showResult(win: boolean, score: ScoreResult, char: CharId, seconds: number, maxCombo: number) {
    this.setRecordNote('none');
    this.resultTitle.textContent = win ? '浄 化 完 了' : '散 華';
    this.result.classList.toggle('win', win);
    this.result.classList.toggle('lose', !win);

    this.resRank.className = `rk-lv${score.rank.level}`;
    this.resRankName.textContent = score.rank.name;
    this.resRankSub.textContent = score.rank.sub;

    // 明細（0 点の行も内訳が分かるよう残し、薄く表示）
    this.resLines.innerHTML = score.lines.map((l) => `
      <div class="res-line${l.points === 0 ? ' zero' : ''}${l.big ? ' big' : ''}">
        <span class="l">${l.label}</span><span class="d">${l.detail}</span><span class="p">${l.points.toLocaleString()}</span>
      </div>`).join('') + `
      <div class="res-line sum">
        <span class="l">小計</span><span class="d"></span><span class="p">${score.base.toLocaleString()}</span>
      </div>
      <div class="res-line mult">
        <span class="l">コンボ倍率</span><span class="d">最大コンボ ${score.maxCombo}</span><span class="p">× ${score.mult.toFixed(2)}</span>
      </div>`;

    // 勝ったキャラの立ち絵のみ表示
    this.resCap.classList.toggle('noimg', !win);
    if (win) {
      this.resCap.style.setProperty('--tint', CHARS[char].tint);
      this.resImg.src = `${import.meta.env.BASE_URL}images/${CHARS[char].cap}`;
    }

    this.resultStats.textContent = `TIME ${seconds.toFixed(1)}s ／ MAX COMBO ${maxCombo}`;
    this.hud.classList.add('result-on');
    this.result.classList.remove('hidden');
    this.countUp(score.total, 500 + score.lines.length * 40);
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
