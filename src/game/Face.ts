import * as THREE from 'three';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, g: c.getContext('2d')! };
}

function finish(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/** アニメ調の目（片目ぶん）。左右は平面のスケールを反転して使う */
export function eyeTexture(color: THREE.ColorRepresentation): THREE.CanvasTexture {
  const { c, g } = canvas(256, 192);
  const base = new THREE.Color(color);
  const light = base.clone().lerp(new THREE.Color(0xffffff), 0.45);
  const dark = base.clone().lerp(new THREE.Color(0x000000), 0.55);
  const cx = 128, cy = 104;
  // 白目
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.ellipse(cx, cy, 82, 60, 0, 0, Math.PI * 2);
  g.fill();
  // 虹彩
  const grad = g.createLinearGradient(0, cy - 50, 0, cy + 50);
  grad.addColorStop(0, `#${dark.getHexString()}`);
  grad.addColorStop(0.45, `#${base.getHexString()}`);
  grad.addColorStop(1, `#${light.getHexString()}`);
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(cx, cy + 8, 50, 56, 0, 0, Math.PI * 2);
  g.fill();
  // 虹彩の縁
  g.strokeStyle = `#${dark.getHexString()}`;
  g.lineWidth = 5;
  g.stroke();
  // 瞳孔
  g.fillStyle = '#1a0a14';
  g.beginPath();
  g.ellipse(cx, cy + 12, 18, 26, 0, 0, Math.PI * 2);
  g.fill();
  // 下側の反射
  g.fillStyle = `rgba(255,255,255,0.35)`;
  g.beginPath();
  g.ellipse(cx + 8, cy + 40, 22, 10, 0, 0, Math.PI * 2);
  g.fill();
  // ハイライト
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.ellipse(cx - 22, cy - 18, 17, 20, -0.3, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(cx + 26, cy + 30, 7, 8, 0, 0, Math.PI * 2);
  g.fill();
  // 上まつげ
  g.strokeStyle = '#2a1420';
  g.lineCap = 'round';
  g.lineWidth = 16;
  g.beginPath();
  g.moveTo(cx - 84, cy - 30);
  g.quadraticCurveTo(cx - 10, cy - 96, cx + 86, cy - 44);
  g.stroke();
  // 目尻のはね
  g.lineWidth = 10;
  g.beginPath();
  g.moveTo(cx + 78, cy - 46);
  g.lineTo(cx + 100, cy - 66);
  g.stroke();
  // 下まつげ
  g.strokeStyle = 'rgba(42,20,32,0.6)';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(cx - 60, cy + 44);
  g.quadraticCurveTo(cx, cy + 74, cx + 66, cy + 40);
  g.stroke();
  return finish(c);
}

export function mouthTexture(): THREE.CanvasTexture {
  const { c, g } = canvas(128, 64);
  g.strokeStyle = '#8a2a3a';
  g.lineCap = 'round';
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(30, 26);
  g.quadraticCurveTo(64, 48, 98, 26);
  g.stroke();
  return finish(c);
}

/** 魔法陣（ボスの足元、詠唱中） */
export function magicCircleTexture(color: string): THREE.CanvasTexture {
  const S = 512;
  const { c, g } = canvas(S, S);
  const cx = S / 2;
  g.strokeStyle = color;
  g.lineCap = 'round';
  const ring = (r: number, w: number) => { g.lineWidth = w; g.beginPath(); g.arc(cx, cx, r, 0, Math.PI * 2); g.stroke(); };
  ring(240, 8); ring(224, 3); ring(150, 5); ring(70, 4);
  g.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const b = a + (Math.PI * 2) / 3;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * 224, cx + Math.sin(a) * 224);
    g.lineTo(cx + Math.cos(b) * 224, cx + Math.sin(b) * 224);
    g.stroke();
  }
  // ルーン風の刻み
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const r1 = 160, r2 = 160 + (i % 3 === 0 ? 40 : 18);
    g.lineWidth = i % 3 === 0 ? 5 : 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r1, cx + Math.sin(a) * r1);
    g.lineTo(cx + Math.cos(a) * r2, cx + Math.sin(a) * r2);
    g.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.26;
    g.lineWidth = 6;
    g.beginPath();
    g.arc(cx + Math.cos(a) * 205, cx + Math.sin(a) * 205, 9, 0, Math.PI * 2);
    g.stroke();
  }
  return finish(c);
}

/** 閃光スプライト用の放射グラデーション */
export function flashTexture(): THREE.CanvasTexture {
  const { c, g } = canvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.7)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.15)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  // 十字の光芒
  g.globalCompositeOperation = 'lighter';
  const star = g.createLinearGradient(0, 64, 128, 64);
  star.addColorStop(0, 'rgba(255,255,255,0)');
  star.addColorStop(0.5, 'rgba(255,255,255,0.9)');
  star.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = star;
  g.fillRect(0, 60, 128, 8);
  g.save();
  g.translate(64, 64);
  g.rotate(Math.PI / 2);
  g.translate(-64, -64);
  g.fillRect(0, 60, 128, 8);
  g.restore();
  return finish(c);
}

/** 打撃の衝撃（放射状のトゲ）。拳や蹴りが当たった瞬間に出す */
export function impactTexture(spikes = 14): THREE.CanvasTexture {
  const S = 256;
  const { c, g } = canvas(S, S);
  const cx = S / 2;
  g.translate(cx, cx);
  // 中心の光
  const core = g.createRadialGradient(0, 0, 0, 0, 0, S * 0.2);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = core;
  g.beginPath();
  g.arc(0, 0, S * 0.2, 0, Math.PI * 2);
  g.fill();
  // 放射状のトゲ。長短を交互にして手描きらしく
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2;
    const len = (i % 2 === 0 ? 0.48 : 0.3) * S * (0.85 + ((i * 37) % 10) / 40);
    const w = (i % 2 === 0 ? 0.052 : 0.036) * Math.PI * 2;
    const grad = g.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.5)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(Math.cos(a - w) * S * 0.07, Math.sin(a - w) * S * 0.07);
    g.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    g.lineTo(Math.cos(a + w) * S * 0.07, Math.sin(a + w) * S * 0.07);
    g.closePath();
    g.fill();
  }
  return finish(c);
}

/** 敵の弾。中心の光、二重の輪、外周の粒と光条 */
export function orbTexture(): THREE.CanvasTexture {
  const S = 160;
  const { c, g } = canvas(S, S);
  const cx = S / 2;
  g.translate(cx, cx);
  // 外側のほのかな光
  const halo = g.createRadialGradient(0, 0, 0, 0, 0, cx);
  halo.addColorStop(0, 'rgba(255,255,255,0.3)');
  halo.addColorStop(0.42, 'rgba(255,255,255,0.16)');
  halo.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = halo;
  g.beginPath();
  g.arc(0, 0, cx, 0, Math.PI * 2);
  g.fill();
  // 光条
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const grad = g.createLinearGradient(0, 0, Math.cos(a) * cx, Math.sin(a) * cx);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.55, 'rgba(255,255,255,0.4)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    const w = 0.035 * Math.PI * 2;
    g.beginPath();
    g.moveTo(Math.cos(a - w) * cx * 0.42, Math.sin(a - w) * cx * 0.42);
    g.lineTo(Math.cos(a) * cx, Math.sin(a) * cx);
    g.lineTo(Math.cos(a + w) * cx * 0.42, Math.sin(a + w) * cx * 0.42);
    g.closePath();
    g.fill();
  }
  // 二重の輪
  const ring = (r: number, w: number, a: number) => {
    g.strokeStyle = `rgba(255,255,255,${a})`;
    g.lineWidth = w;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();
  };
  ring(cx * 0.58, 9, 0.22);
  ring(cx * 0.58, 5, 0.9);
  ring(cx * 0.44, 1.6, 0.45);
  // 外周の粒
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.beginPath();
    g.arc(Math.cos(a) * cx * 0.74, Math.sin(a) * cx * 0.74, 2.6, 0, Math.PI * 2);
    g.fill();
  }
  // 中心の芯
  const core = g.createRadialGradient(0, 0, 0, 0, 0, cx * 0.38);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(0.4, 'rgba(255,255,255,0.75)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = core;
  g.beginPath();
  g.arc(0, 0, cx * 0.38, 0, Math.PI * 2);
  g.fill();
  return finish(c);
}

/** 針の弾。先端ほど明るい縦のグラデーション */
export function needleTexture(): THREE.CanvasTexture {
  const w = 8, h = 64;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  // v=1 が先端
  const grad = g.createLinearGradient(0, h, 0, 0);
  grad.addColorStop(0, '#5a4a66');
  grad.addColorStop(0.45, '#b8a0d0');
  grad.addColorStop(0.85, '#ffffff');
  grad.addColorStop(1, '#ffffff');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
