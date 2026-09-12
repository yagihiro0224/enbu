export type Action = 'attack' | 'dodge' | 'parry' | 'shoot' | 'super';

const KEYMAP: Record<string, Action> = {
  KeyJ: 'attack', KeyZ: 'attack', Enter: 'attack',
  KeyK: 'dodge', Space: 'dodge', KeyX: 'dodge',
  KeyL: 'parry', ShiftLeft: 'parry', ShiftRight: 'parry', KeyC: 'parry',
  KeyI: 'shoot', KeyV: 'shoot', KeyH: 'shoot',
  KeyU: 'super', KeyE: 'super',
};

const CSS = `
#controls { position: fixed; inset: 0; pointer-events: none; z-index: 20; }
#stick-zone { position: absolute; left: 0; top: 0; bottom: 0; width: 50%; pointer-events: auto; }
#stick { position: absolute; width: 120px; height: 120px; margin: -60px 0 0 -60px; border-radius: 50%;
  background: rgba(255,255,255,0.08); border: 2px solid rgba(255,255,255,0.35); display: none; }
#knob { position: absolute; width: 52px; height: 52px; left: 34px; top: 34px; border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #fff2e0, #ff7a45 70%, #c0301a); box-shadow: 0 0 14px rgba(255,120,60,0.7); }
.btns { position: absolute; right: max(18px, env(safe-area-inset-right)); bottom: max(18px, env(safe-area-inset-bottom));
  width: 210px; height: 210px; pointer-events: none; }
.btn { position: absolute; border-radius: 50%; pointer-events: auto; display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 20px; color: #fff; border: 2px solid rgba(255,255,255,0.5);
  background: rgba(40,10,25,0.55); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
  text-shadow: 0 1px 3px rgba(0,0,0,0.8); transition: transform 0.06s; }
.btn.down { transform: scale(0.9); background: rgba(255,120,60,0.6); }
.btn.cool { opacity: 0.45; }
.btn small { display: block; font-size: 9px; font-weight: 400; opacity: 0.8; text-align: center; line-height: 1.1; }
.btn span { text-align: center; line-height: 1.05; }
#b-attack { width: 92px; height: 92px; right: 0; bottom: 0; font-size: 26px; border-color: #ff8a5a; }
#b-dodge { width: 70px; height: 70px; right: 104px; bottom: 6px; border-color: #7fd4ff; }
#b-parry { width: 70px; height: 70px; right: 16px; bottom: 108px; border-color: #ffd86a; }
#b-shoot { width: 60px; height: 60px; right: 98px; bottom: 96px; border-color: #ff6ab8; }
/* 必殺技。ゲージが満タンのときだけ出す */
#b-super { width: 78px; height: 78px; right: 150px; bottom: 150px; border-color: #ffe08a; font-size: 22px;
  background: rgba(90,30,10,0.72); display: none; }
#b-super.ready { display: flex; animation: superpulse 0.9s ease-in-out infinite; }
@keyframes superpulse {
  0%, 100% { box-shadow: 0 0 10px rgba(255,200,90,0.7); }
  50% { box-shadow: 0 0 26px rgba(255,220,140,1); }
}
@media (max-height: 420px) {
  .btns { width: 180px; height: 180px; }
  #b-attack { width: 80px; height: 80px; }
  #b-dodge { width: 62px; height: 62px; right: 90px; }
  #b-parry { width: 62px; height: 62px; bottom: 94px; }
  #b-shoot { width: 54px; height: 54px; right: 86px; bottom: 84px; }
  #b-super { width: 68px; height: 68px; right: 132px; bottom: 128px; }
}
`;

/** タッチ（仮想スティック + ボタン）とキーボードをまとめた入力 */
export class Input {
  /** x: 右 +、y: 前（スティック上）+。長さ 0..1 */
  move = { x: 0, y: 0 };
  private held = new Set<Action>();
  private pressTime = new Map<Action, number>();
  private now = 0;
  private stickId: number | null = null;
  private origin = { x: 0, y: 0 };
  private keys = new Set<string>();
  private stickEl: HTMLElement;
  private knobEl: HTMLElement;
  private btnEls = new Map<Action, HTMLElement>();
  enabled = false;
  private rootEl!: HTMLElement;
  /** 必殺ボタンの出し入れ。ゲージが満タンのときだけ出す */
  setSuperReady(v: boolean) {
    this.btnEls.get('super')?.classList.toggle('ready', v);
  }

  /** タイトルやリザルトでは操作 UI を隠す（左半分のスティック領域がボタンのタップを横取りするため） */
  setVisible(v: boolean) {
    this.rootEl.style.display = v ? '' : 'none';
  }

  constructor(parent: HTMLElement) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'controls';
    root.innerHTML = `
      <div id="stick-zone"><div id="stick"><div id="knob"></div></div></div>
      <div class="btns">
        <div class="btn" id="b-super" data-a="super"><span>必<small>U</small></span></div>
        <div class="btn" id="b-attack" data-a="attack"><span>打<small>J</small></span></div>
        <div class="btn" id="b-dodge" data-a="dodge"><span>避<small>K / Space</small></span></div>
        <div class="btn" id="b-parry" data-a="parry"><span>受<small>L</small></span></div>
        <div class="btn" id="b-shoot" data-a="shoot"><span>射<small>I</small></span></div>
      </div>`;
    parent.appendChild(root);
    this.rootEl = root;
    root.style.display = 'none';
    this.stickEl = root.querySelector('#stick')!;
    this.knobEl = root.querySelector('#knob')!;
    const zone = root.querySelector('#stick-zone') as HTMLElement;

    zone.addEventListener('pointerdown', (e) => {
      if (!this.enabled || this.stickId !== null) return;
      this.stickId = e.pointerId;
      this.origin = { x: e.clientX, y: e.clientY };
      this.stickEl.style.display = 'block';
      this.stickEl.style.left = `${e.clientX}px`;
      this.stickEl.style.top = `${e.clientY}px`;
      this.knobEl.style.transform = '';
      zone.setPointerCapture(e.pointerId);
    });
    const endStick = (e: PointerEvent) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null;
      this.move.x = 0;
      this.move.y = 0;
      this.stickEl.style.display = 'none';
    };
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stickId) return;
      const R = 48;
      let dx = e.clientX - this.origin.x;
      let dy = e.clientY - this.origin.y;
      const len = Math.hypot(dx, dy);
      if (len > R) { dx *= R / len; dy *= R / len; }
      this.knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
      // デッドゾーン付き
      const n = Math.min(1, len / R);
      const v = n < 0.12 ? 0 : (n - 0.12) / 0.88;
      const ang = Math.atan2(dy, dx);
      this.move.x = Math.cos(ang) * v;
      this.move.y = -Math.sin(ang) * v;
    });
    zone.addEventListener('pointerup', endStick);
    zone.addEventListener('pointercancel', endStick);

    for (const el of root.querySelectorAll<HTMLElement>('.btn')) {
      const a = el.dataset.a as Action;
      this.btnEls.set(a, el);
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (!this.enabled) return;
        el.setPointerCapture(e.pointerId);
        this.press(a);
        el.classList.add('down');
      });
      const up = () => { this.release(a); el.classList.remove('down'); };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      const a = KEYMAP[e.code];
      if (a && this.enabled) { this.press(a); this.btnEls.get(a)?.classList.add('down'); e.preventDefault(); }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      const a = KEYMAP[e.code];
      if (a) { this.release(a); this.btnEls.get(a)?.classList.remove('down'); }
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.held.clear();
      this.btnEls.forEach((el) => el.classList.remove('down'));
    });
  }

  private press(a: Action) {
    this.held.add(a);
    this.pressTime.set(a, this.now);
  }
  private release(a: Action) {
    this.held.delete(a);
  }

  /** 動作確認用の自動操作 */
  bot = false;
  private botTimer = 0;
  private botMove = { x: 0, y: 0 };

  /** 毎フレーム先頭で呼ぶ。キーボード移動を反映 */
  update(dt: number) {
    this.now += dt;
    if (this.bot && this.enabled) {
      this.botTimer -= dt;
      if (this.botTimer <= 0) {
        this.botTimer = 0.25 + Math.random() * 0.5;
        const a = Math.random() * Math.PI * 2;
        const on = Math.random() < 0.7;
        this.botMove = { x: on ? Math.cos(a) : 0, y: on ? Math.sin(a) : 0 };
        const r = Math.random();
        if (r < 0.45) this.press('attack');
        else if (r < 0.65) this.press('dodge');
        else if (r < 0.85) this.press('parry');
        else this.press('shoot');
      }
      this.move.x = this.botMove.x;
      this.move.y = this.botMove.y;
      return;
    }
    if (this.stickId === null) {
      let x = 0, y = 0;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
      const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
      this.move.x = x;
      this.move.y = y;
    }
  }

  isHeld(a: Action) {
    return this.held.has(a);
  }

  /** 直近 buffer 秒以内に押されていれば 1 回だけ true を返す（先行入力） */
  consume(a: Action, buffer = 0.18): boolean {
    const t = this.pressTime.get(a);
    if (t === undefined) return false;
    if (this.now - t <= buffer) {
      this.pressTime.delete(a);
      return true;
    }
    return false;
  }

  setCooldown(a: Action, cooling: boolean) {
    this.btnEls.get(a)?.classList.toggle('cool', cooling);
  }

  reset() {
    this.held.clear();
    this.pressTime.clear();
    this.move.x = 0;
    this.move.y = 0;
  }
}
