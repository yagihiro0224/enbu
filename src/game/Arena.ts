import * as THREE from 'three';

import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rand, TAU } from './util';

function makeCanvas(size: number) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return { c, g: c.getContext('2d')! };
}

/** 石畳。継ぎ目と汚れ、欠けを描く。タイル状に繰り返して使う */
function stoneTexture(S = 512): HTMLCanvasElement {
  const { c, g } = makeCanvas(S);
  g.fillStyle = '#2e2230';
  g.fillRect(0, 0, S, S);
  const cells = 4;
  const step = S / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      // 一段ごとに半分ずらす
      const ox = (y % 2) * step * 0.5;
      const px = (x * step + ox) % S;
      const py = y * step;
      const m = step * 0.045;
      const shade = rand(0.78, 1.18);
      const base = [86, 66, 88].map((v) => Math.min(255, v * shade));
      g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
      // 角を少し丸めた石
      const r = step * 0.06;
      const x0 = px + m, y0 = py + m, w = step - m * 2, h = step - m * 2;
      g.beginPath();
      g.moveTo(x0 + r, y0);
      g.arcTo(x0 + w, y0, x0 + w, y0 + h, r);
      g.arcTo(x0 + w, y0 + h, x0, y0 + h, r);
      g.arcTo(x0, y0 + h, x0, y0, r);
      g.arcTo(x0, y0, x0 + w, y0, r);
      g.closePath();
      g.fill();
      // 石の粒と汚れ
      for (let i = 0; i < 90; i++) {
        const a = rand(0.04, 0.16);
        g.fillStyle = Math.random() < 0.5 ? `rgba(255,240,255,${a})` : `rgba(20,10,24,${a * 1.6})`;
        const s = rand(1, step * 0.09);
        g.fillRect(x0 + rand(0, w - s), y0 + rand(0, h - s), s, s * rand(0.4, 1));
      }
      // 上辺のハイライト
      g.fillStyle = 'rgba(255,235,255,0.09)';
      g.fillRect(x0, y0, w, Math.max(1, step * 0.02));
    }
  }
  return c;
}

/** 石畳の高さ。継ぎ目を掘り、石の面を持ち上げる */
function stoneHeight(S = 512): HTMLCanvasElement {
  const { c, g } = makeCanvas(S);
  g.fillStyle = '#202020';
  g.fillRect(0, 0, S, S);
  const cells = 4;
  const step = S / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const ox = (y % 2) * step * 0.5;
      const px = (x * step + ox) % S;
      const py = y * step;
      const m = step * 0.045;
      const v = Math.round(rand(190, 235));
      g.fillStyle = `rgb(${v},${v},${v})`;
      const r = step * 0.06;
      const x0 = px + m, y0 = py + m, w = step - m * 2, h = step - m * 2;
      g.beginPath();
      g.moveTo(x0 + r, y0);
      g.arcTo(x0 + w, y0, x0 + w, y0 + h, r);
      g.arcTo(x0 + w, y0 + h, x0, y0 + h, r);
      g.arcTo(x0, y0 + h, x0, y0, r);
      g.arcTo(x0, y0, x0 + w, y0, r);
      g.closePath();
      g.fill();
      for (let i = 0; i < 40; i++) {
        const a = rand(0.05, 0.2);
        g.fillStyle = Math.random() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
        const s = rand(2, step * 0.1);
        g.fillRect(x0 + rand(0, w - s), y0 + rand(0, h - s), s, s);
      }
    }
  }
  return c;
}

/** 外周の土。まだらな汚れだけの簡単な模様 */
function dirtTexture(S = 512): HTMLCanvasElement {
  const { c, g } = makeCanvas(S);
  g.fillStyle = '#3a2b3c';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 1400; i++) {
    const x = rand(0, S), y = rand(0, S), r = rand(3, 34);
    const a = rand(0.03, 0.12);
    g.fillStyle = Math.random() < 0.55 ? `rgba(96,74,92,${a})` : `rgba(22,14,26,${a * 1.5})`;
    g.beginPath();
    g.ellipse(x, y, r, r * rand(0.4, 1), rand(0, 3), 0, TAU);
    g.fill();
  }
  // 小石
  for (let i = 0; i < 500; i++) {
    g.fillStyle = `rgba(150,130,150,${rand(0.05, 0.18)})`;
    g.fillRect(rand(0, S), rand(0, S), rand(1, 4), rand(1, 3));
  }
  return c;
}

/** 高さマップから法線マップを作る */
function normalFromHeight(src: HTMLCanvasElement, strength = 2.2): THREE.CanvasTexture {
  const S = src.width;
  const sg = src.getContext('2d')!;
  const h = sg.getImageData(0, 0, S, S).data;
  const { c, g } = makeCanvas(S);
  const out = g.createImageData(S, S);
  const at = (x: number, y: number) => h[(((y + S) % S) * S + ((x + S) % S)) * 4] / 255;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * S + x) * 4;
      out.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      out.data[i + 2] = (1 / len) * 0.5 * 255 + 127;
      out.data[i + 3] = 255;
    }
  }
  g.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** 床に焼き付ける魔法陣（石畳の上に重ねる薄い層） */
function circleDecal(S = 1024): THREE.CanvasTexture {
  const { c, g } = makeCanvas(S);
  const cx = S / 2;
  g.strokeStyle = 'rgba(255, 120, 70, 0.5)';
  g.lineCap = 'round';
  const ring = (r: number, w: number) => { g.lineWidth = w; g.beginPath(); g.arc(cx, cx, r, 0, TAU); g.stroke(); };
  ring(S * 0.47, 5); ring(S * 0.44, 2); ring(S * 0.3, 3.5); ring(S * 0.28, 1.5); ring(S * 0.1, 2.5);
  g.lineWidth = 1.8;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * S * 0.1, cx + Math.sin(a) * S * 0.1);
    g.lineTo(cx + Math.cos(a) * S * 0.44, cx + Math.sin(a) * S * 0.44);
    g.stroke();
  }
  g.lineWidth = 2.5;
  for (const off of [0, Math.PI / 6]) {
    g.beginPath();
    for (let i = 0; i <= 3; i++) {
      const a = off + (i / 3) * TAU - Math.PI / 2;
      const x = cx + Math.cos(a) * S * 0.3, y = cx + Math.sin(a) * S * 0.3;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** 地表の靄。横に長いぼかした帯 */
function hazeTexture(): THREE.CanvasTexture {
  const w = 512, h = 128;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 26; i++) {
    const x = rand(-40, w), y = rand(h * 0.25, h * 0.8);
    const rx = rand(60, 190), ry = rand(10, 30);
    const grd = g.createRadialGradient(x, y, 0, x, y, rx);
    grd.addColorStop(0, `rgba(255,225,235,${rand(0.05, 0.13)})`);
    grd.addColorStop(1, 'rgba(255,225,235,0)');
    g.fillStyle = grd;
    g.save();
    g.translate(x, y);
    g.scale(1, ry / rx);
    g.beginPath();
    g.arc(0, 0, rx, 0, TAU);
    g.fill();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** 木材。縦の木目と風化した色むら */
function woodTexture(S = 256): HTMLCanvasElement {
  const { c, g } = makeCanvas(S);
  g.fillStyle = '#9e2f22';
  g.fillRect(0, 0, S, S);
  // 縦の木目
  for (let i = 0; i < 170; i++) {
    const x = rand(0, S);
    const w = rand(0.6, 3.2);
    const dark = Math.random() < 0.6;
    g.strokeStyle = dark ? `rgba(60,16,12,${rand(0.06, 0.2)})` : `rgba(220,120,96,${rand(0.05, 0.14)})`;
    g.lineWidth = w;
    g.beginPath();
    let x0 = x;
    g.moveTo(x0, 0);
    for (let y = 0; y <= S; y += 16) {
      x0 += rand(-1.4, 1.4);
      g.lineTo(x0, y);
    }
    g.stroke();
  }
  // 風化した剥がれ
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(52,20,18,${rand(0.05, 0.16)})`;
    const w = rand(3, 24), h = rand(6, 40);
    g.fillRect(rand(0, S - w), rand(0, S - h), w, h);
  }
  return c;
}

/** 頂点に色を塗る。fn は局所座標から色を返す */
function paint(src: THREE.BufferGeometry, fn: (x: number, y: number, z: number) => THREE.Color): THREE.BufferGeometry {
  const geo = src.index ? src.toNonIndexed() : src;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const c = fn(pos.getX(i), pos.getY(i), pos.getZ(i));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

/** 稜線をばらつかせた山。頂上ほど明るくする */
function mountainGeo(radius: number, height: number, seed: number, dark: THREE.Color, light: THREE.Color): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(radius, height, 14, 5);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const n = (a: number) => Math.sin(a * 3 + seed) * 0.2 + Math.sin(a * 7 + seed * 2.3) * 0.1 + Math.sin(a * 13 + seed * 3.7) * 0.055;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-4) continue;
    const a = Math.atan2(z, x);
    // 裾ほど大きく崩す
    const t = 1 - (y + height / 2) / height;
    const k = 1 + n(a) * (0.35 + t * 0.75);
    pos.setXYZ(i, x * k, y + Math.sin(a * 5 + seed) * height * 0.02, z * k);
  }
  g.computeVertexNormals();
  const tmp = new THREE.Color();
  return paint(g, (_x, y) => {
    const t = (y + height / 2) / height;
    return tmp.copy(dark).lerp(light, Math.pow(Math.max(0, (t - 0.55) / 0.45), 1.4));
  });
}

/** 針葉樹。幹と、段になった葉 */
function coniferGeos(h: number, tint: THREE.Color): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const trunkH = h * 0.26;
  const trunk = new THREE.CylinderGeometry(h * 0.028, h * 0.045, trunkH, 5);
  trunk.translate(0, trunkH / 2, 0);
  out.push(paint(trunk, () => new THREE.Color(0x2a1a20)));
  const tiers = 3;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const r = h * (0.3 - t * 0.16) * rand(0.9, 1.12);
    const hh = h * (0.42 - t * 0.1);
    const y = trunkH * 0.7 + (h - trunkH) * t * 0.62;
    const cone = new THREE.ConeGeometry(r, hh, 7);
    cone.rotateY(rand(0, 3));
    cone.translate(rand(-0.04, 0.04) * h, y + hh / 2, rand(-0.04, 0.04) * h);
    const c = tint.clone().multiplyScalar(rand(0.8, 1.25));
    out.push(paint(cone, (_x, yy) => c.clone().multiplyScalar(0.75 + 0.45 * ((yy - y) / hh))));
  }
  return out;
}

/** 広葉樹。幹と、塊になった葉 */
function broadleafGeos(h: number, tint: THREE.Color): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const trunkH = h * 0.45;
  const trunk = new THREE.CylinderGeometry(h * 0.035, h * 0.06, trunkH, 5);
  trunk.translate(0, trunkH / 2, 0);
  out.push(paint(trunk, () => new THREE.Color(0x2a1a20)));
  const blobs = 3;
  for (let i = 0; i < blobs; i++) {
    const r = h * rand(0.2, 0.3);
    const b = new THREE.IcosahedronGeometry(r, 0);
    b.scale(1, rand(0.7, 0.95), 1);
    b.translate(rand(-0.18, 0.18) * h, trunkH + rand(0.05, 0.3) * h, rand(-0.18, 0.18) * h);
    const c = tint.clone().multiplyScalar(rand(0.75, 1.2));
    out.push(paint(b, (_x, yy) => c.clone().multiplyScalar(0.7 + 0.5 * (yy / (h * 1.1)))));
  }
  return out;
}

function skyDome(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color(0x070310) },
      high: { value: new THREE.Color(0x241036) },
      mid: { value: new THREE.Color(0x5b1c44) },
      low: { value: new THREE.Color(0xa8402c) },
      horizon: { value: new THREE.Color(0xe8804a) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top; uniform vec3 high; uniform vec3 mid; uniform vec3 low; uniform vec3 horizon;
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;
        vec3 c;
        if (h < 0.015) c = mix(horizon, low, smoothstep(-0.06, 0.015, h));
        else if (h < 0.1) c = mix(low, mid, smoothstep(0.015, 0.1, h));
        else if (h < 0.32) c = mix(mid, high, smoothstep(0.1, 0.32, h));
        else c = mix(high, top, smoothstep(0.32, 0.8, h));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 18), mat);
  m.renderOrder = -10;
  return m;
}

export interface ArenaResult {
  group: THREE.Group;
  embers: THREE.Points;
  lanterns: THREE.Group[];
  /** 影を落とす太陽光。性能が足りないときは castShadow を切る */
  sun: THREE.DirectionalLight;
  update(dt: number): void;
}

export function createArena(R: number): ArenaResult {
  const group = new THREE.Group();

  // ---- 床（石畳）----
  const stone = new THREE.CanvasTexture(stoneTexture());
  stone.colorSpace = THREE.SRGBColorSpace;
  stone.wrapS = stone.wrapT = THREE.RepeatWrapping;
  stone.anisotropy = 8;
  const stoneN = normalFromHeight(stoneHeight(), 2.4);
  const floorGeo = new THREE.CircleGeometry(R, 72);
  // UV を広げて石畳を繰り返す（1 タイル ≒ 2m）
  const uv = floorGeo.attributes.uv as THREE.BufferAttribute;
  const rep = R / 3.5;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * rep, uv.getY(i) * rep);
  const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({
    map: stone, normalMap: stoneN, normalScale: new THREE.Vector2(0.9, 0.9),
    roughness: 0.92, metalness: 0.02, color: 0xb0a0b4,
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // 外周の地面。舞台が宙に浮いて見えないように広く敷く
  const dirt = new THREE.CanvasTexture(dirtTexture());
  dirt.colorSpace = THREE.SRGBColorSpace;
  dirt.wrapS = dirt.wrapT = THREE.RepeatWrapping;
  dirt.repeat.set(26, 26);
  dirt.anisotropy = 8;
  const outer = new THREE.Mesh(
    new THREE.CircleGeometry(120, 64),
    new THREE.MeshStandardMaterial({ map: dirt, roughness: 1, metalness: 0, color: 0x8a7a8e }),
  );
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.78;
  outer.receiveShadow = true;
  group.add(outer);

  // 魔法陣（床の少し上）
  const decal = new THREE.Mesh(
    new THREE.CircleGeometry(R * 0.99, 64),
    new THREE.MeshBasicMaterial({ map: circleDecal(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }),
  );
  decal.rotation.x = -Math.PI / 2;
  decal.position.y = 0.015;
  decal.renderOrder = 1;
  group.add(decal);

  // 縁の石段
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(R + 0.6, R + 1.3, 0.8, 72, 1, true),
    new THREE.MeshStandardMaterial({ map: stone.clone(), normalMap: stoneN, roughness: 0.95, metalness: 0, color: 0x6a5a70, side: THREE.DoubleSide }),
  );
  (rim.material as THREE.MeshStandardMaterial).map!.repeat.set(14, 1);
  (rim.material as THREE.MeshStandardMaterial).map!.needsUpdate = true;
  rim.position.y = -0.4;
  rim.receiveShadow = true;
  group.add(rim);

  // 発光する縁
  const edge = new THREE.Mesh(new THREE.TorusGeometry(R, 0.055, 8, 120), new THREE.MeshBasicMaterial({ color: 0xff6a3a, toneMapped: false }));
  edge.rotation.x = Math.PI / 2;
  edge.position.y = 0.05;
  group.add(edge);

  // ---- 鳥居（明神鳥居。柱は内側に傾き、笠木は反りを持たせる）----
  const wood = new THREE.CanvasTexture(woodTexture());
  wood.colorSpace = THREE.SRGBColorSpace;
  wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
  wood.anisotropy = 8;
  const woodMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.86, metalness: 0, color: 0xd8a89a });
  const darkWoodMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.9, metalness: 0, color: 0x4a3038 });
  const torii = new THREE.Group();
  const halfSpan = 2.35, postH = 4.7, lean = 0.035;
  for (const s of [1, -1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.27, postH, 16), woodMat);
    post.position.set(s * halfSpan, postH / 2, 0);
    post.rotation.z = s * lean; // 内側へわずかに傾ける
    post.castShadow = true;
    post.receiveShadow = true;
    torii.add(post);
    // 根元の亀腹
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.46, 0.34, 14), new THREE.MeshStandardMaterial({ color: 0x6d5c72, roughness: 0.95 }));
    foot.position.set(s * halfSpan, 0.17, 0);
    foot.castShadow = true;
    torii.add(foot);
  }
  // 貫（柱を貫いて外へ出る）
  const nuki = new THREE.Mesh(new THREE.BoxGeometry(halfSpan * 2 + 1.0, 0.3, 0.38), darkWoodMat);
  nuki.position.y = postH * 0.72;
  nuki.castShadow = true;
  torii.add(nuki);
  // 額束（貫と島木の間の短い柱）
  const gaku = new THREE.Mesh(new THREE.BoxGeometry(0.26, postH * 0.2, 0.3), darkWoodMat);
  gaku.position.y = postH * 0.72 + postH * 0.1 + 0.15;
  torii.add(gaku);
  // 島木と笠木。反りを付けるため頂点を持ち上げる
  const sweep = (geo: THREE.BufferGeometry, half: number, amount: number, tipTaper: number) => {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const t = Math.abs(x) / half;
      pos.setY(i, pos.getY(i) + t * t * amount);
      if (t > 0.86) pos.setY(i, pos.getY(i) * (1 - (t - 0.86) * tipTaper));
    }
    geo.computeVertexNormals();
    return geo;
  };
  const simaHalf = halfSpan + 0.75;
  const sima = new THREE.Mesh(sweep(new THREE.BoxGeometry(simaHalf * 2, 0.3, 0.46, 24, 1, 1), simaHalf, 0.34, 0.5), darkWoodMat);
  sima.position.y = postH + 0.02;
  sima.castShadow = true;
  torii.add(sima);
  const kasaHalf = halfSpan + 1.0;
  const kasa = new THREE.Mesh(sweep(new THREE.BoxGeometry(kasaHalf * 2, 0.34, 0.6, 28, 1, 1), kasaHalf, 0.46, 0.55), woodMat);
  kasa.position.y = postH + 0.33;
  kasa.castShadow = true;
  torii.add(kasa);
  torii.position.set(0, 0, -R - 3.2);
  torii.rotation.y = 0.06;
  group.add(torii);

  // ---- 石灯籠 ----
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6d5c72, roughness: 0.95, metalness: 0 });
  const lanternLight = new THREE.MeshBasicMaterial({ color: 0xffc070, toneMapped: false });
  const lanterns: THREE.Group[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8;
    const l = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.3, 8), stoneMat);
    base.position.y = 0.15;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.4, 8), stoneMat);
    pole.position.y = 1.0;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.6), stoneMat);
    box.position.y = 1.95;
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.62), lanternLight);
    glow.position.y = 1.95;
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x453845, roughness: 0.95, metalness: 0, flatShading: true });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.42, 4), roofMat);
    roof.position.y = 2.42;
    roof.rotation.y = Math.PI / 4;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), roofMat);
    cap.position.y = 2.66;
    for (const m of [base, pole, box, roof, cap]) { m.castShadow = true; m.receiveShadow = true; }
    l.add(base, pole, box, glow, roof, cap);
    l.position.set(Math.cos(a) * (R + 3.4), -0.3, Math.sin(a) * (R + 3.4));
    group.add(l);
    lanterns.push(l);
  }

  // ---- 足元の岩と砂利 ----
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x4a3c50, roughness: 1, metalness: 0, flatShading: true });
  const rockGeos: THREE.BufferGeometry[] = [];
  const mtx = new THREE.Matrix4();
  const eul = new THREE.Euler();
  const qt = new THREE.Quaternion();
  const vp = new THREE.Vector3();
  const vs = new THREE.Vector3();
  for (let i = 0; i < 60; i++) {
    const a = rand(0, TAU);
    const d = R + rand(1.4, 14);
    const sz = rand(0.16, 0.7);
    const gme = new THREE.DodecahedronGeometry(sz, 0);
    vp.set(Math.cos(a) * d, -0.72 + sz * rand(0.25, 0.6), Math.sin(a) * d);
    qt.setFromEuler(eul.set(rand(0, 3), rand(0, 3), rand(0, 3)));
    vs.set(rand(0.8, 1.3), rand(0.45, 0.9), rand(0.8, 1.3));
    gme.applyMatrix4(mtx.compose(vp, qt, vs));
    rockGeos.push(gme);
  }
  const rocks = new THREE.Mesh(mergeGeometries(rockGeos, false)!, rockMat);
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  group.add(rocks);

  // ---- 遠景: 手前の尾根、奥の尾根、樹林の輪郭 ----
  const ridge = (dist: number, hMin: number, hMax: number, n: number, dark: number, light: number, wMin: number, wMax: number, yBase: number) => {
    const gs: THREE.BufferGeometry[] = [];
    const dc = new THREE.Color(dark), lc = new THREE.Color(light);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(-0.16, 0.16);
      const h = rand(hMin, hMax);
      const gme = mountainGeo(rand(wMin, wMax), h, rand(0, 30), dc, lc);
      const d = dist * rand(0.82, 1.2);
      gme.rotateY(rand(0, 6));
      gme.translate(Math.cos(a) * d, h / 2 + yBase, Math.sin(a) * d);
      gs.push(gme);
    }
    const m = new THREE.Mesh(mergeGeometries(gs, false)!, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 1, metalness: 0, flatShading: true, fog: true,
    }));
    group.add(m);
  };
  ridge(102, 30, 56, 15, 0x1a0d2a, 0x5a3f6e, 20, 36, -9);  // 奥（空に溶ける）
  ridge(70, 18, 34, 17, 0x1c0e28, 0x50305f, 12, 24, -8);   // 中
  ridge(47, 9, 19, 21, 0x181120, 0x3f2a4a, 6, 13, -3);     // 手前
  // 樹林。針葉樹と広葉樹を混ぜ、群れで置いて壁に見えないようにする
  const treeGeos: THREE.BufferGeometry[] = [];
  const near = new THREE.Color(0x241432), far = new THREE.Color(0x1a0e26);
  for (let c = 0; c < 26; c++) {
    const ca = rand(0, TAU);
    const cd = rand(28, 46);
    const cnt = Math.round(rand(2, 6));
    for (let i = 0; i < cnt; i++) {
      const a = ca + rand(-0.09, 0.09);
      const d = cd + rand(-3.5, 3.5);
      const h = rand(2.6, 7.2);
      const tint = (d < 36 ? near : far).clone();
      const parts = Math.random() < 0.7 ? coniferGeos(h, tint) : broadleafGeos(h, tint);
      for (const gme of parts) {
        gme.translate(Math.cos(a) * d, -1.0, Math.sin(a) * d);
        treeGeos.push(gme);
      }
    }
  }
  const trees = new THREE.Mesh(mergeGeometries(treeGeos, false)!, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 1, metalness: 0, flatShading: true, fog: true,
  }));
  trees.castShadow = false;
  group.add(trees);

  // ---- 地表の靄 ----
  const hazeTex = hazeTexture();
  const hazeBands: THREE.Mesh[] = [];
  // 靄は地面のすぐ上に置く
  for (let i = 0; i < 3; i++) {
    const r = 30 + i * 12;
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, 5 + i * 2, 48, 1, true),
      new THREE.MeshBasicMaterial({
        map: hazeTex.clone(), transparent: true, depthWrite: false, side: THREE.BackSide,
        opacity: 0.5 - i * 0.1, color: 0xffd8c8, fog: false, blending: THREE.NormalBlending,
      }),
    );
    (m.material as THREE.MeshBasicMaterial).map!.repeat.set(3 + i, 1);
    (m.material as THREE.MeshBasicMaterial).map!.needsUpdate = true;
    m.position.y = -1.2 + i * 0.6;
    m.renderOrder = -5;
    group.add(m);
    hazeBands.push(m);
  }

  // ---- 月と星 ----
  const moon = new THREE.Mesh(new THREE.SphereGeometry(6, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffe8bc, toneMapped: false, fog: false }));
  moon.position.set(-40, 45, -90);
  group.add(moon);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: (() => {
      const { c, g } = makeCanvas(256);
      const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      grd.addColorStop(0, 'rgba(255,230,190,0.75)');
      grd.addColorStop(0.22, 'rgba(255,215,175,0.28)');
      grd.addColorStop(1, 'rgba(255,200,160,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 256, 256);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })(),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
  }));
  halo.position.copy(moon.position);
  halo.scale.setScalar(44);
  group.add(halo);

  const starN = 320;
  const sp = new Float32Array(starN * 3);
  for (let i = 0; i < starN; i++) {
    const a = rand(0, TAU);
    const y = rand(0.12, 0.95);
    const r = Math.sqrt(1 - y * y) * 130;
    sp[i * 3] = Math.cos(a) * r;
    sp[i * 3 + 1] = y * 130;
    sp[i * 3 + 2] = Math.sin(a) * r;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xfff0e0, size: 0.75, sizeAttenuation: true, transparent: true, opacity: 0.85, fog: false, depthWrite: false }));
  group.add(stars);

  group.add(skyDome());

  // ---- 舞い散る火の粉 ----
  const N = 260;
  const pos = new Float32Array(N * 3);
  const seeds = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = rand(-R - 6, R + 6);
    pos[i * 3 + 1] = rand(0, 9);
    pos[i * 3 + 2] = rand(-R - 6, R + 6);
    seeds[i] = rand(0, 100);
  }
  const eg = new THREE.BufferGeometry();
  eg.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  const embers = new THREE.Points(eg, new THREE.PointsMaterial({ color: 0xffa050, size: 0.09, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  embers.frustumCulled = false;
  group.add(embers);

  // ---- ライト ----
  const hemi = new THREE.HemisphereLight(0x8a5ea8, 0x3a1020, 0.75);
  const sun = new THREE.DirectionalLight(0xffd0a8, 1.5);
  sun.position.set(-9, 15, -7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  const sc = sun.shadow.camera as THREE.OrthographicCamera;
  sc.left = -R - 3; sc.right = R + 3; sc.top = R + 3; sc.bottom = -R - 3;
  sc.updateProjectionMatrix();
  sun.shadow.bias = -0.0012;
  sun.shadow.normalBias = 0.035;
  const fill = new THREE.DirectionalLight(0xff7a58, 0.6);
  fill.position.set(7, 4, 9);
  group.add(hemi, sun, fill);

  let t = 0;
  return {
    group,
    embers,
    lanterns,
    sun,
    update(dt) {
      t += dt;
      const p = eg.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < N; i++) {
        let y = p.getY(i) + dt * (0.5 + (seeds[i] % 1) * 0.6);
        const x = p.getX(i) + Math.sin(t * 0.8 + seeds[i]) * dt * 0.5;
        if (y > 9) y = 0;
        p.setXYZ(i, x, y, p.getZ(i));
      }
      p.needsUpdate = true;
      // 靄をゆっくり流す
      hazeBands.forEach((m, i) => {
        const map = (m.material as THREE.MeshBasicMaterial).map!;
        map.offset.x = (map.offset.x + dt * (0.004 + i * 0.0022)) % 1;
      });
    },
  };
}
