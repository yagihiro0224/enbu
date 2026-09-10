import * as THREE from 'three';
import { toonMat, addOutline } from './Toon';
import { rand, TAU } from './util';

/** 床の魔法陣テクスチャ */
function groundTexture(): THREE.CanvasTexture {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#3b2238';
  g.fillRect(0, 0, S, S);
  // 石畳のノイズ
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${rand(40, 90)}, ${rand(20, 50)}, ${rand(50, 90)}, ${rand(0.15, 0.4)})`;
    const w = rand(6, 40);
    g.fillRect(rand(0, S), rand(0, S), w, w * rand(0.3, 1));
  }
  const cx = S / 2;
  g.strokeStyle = 'rgba(255, 120, 70, 0.55)';
  g.lineWidth = 3;
  const ring = (r: number, w = 3) => { g.lineWidth = w; g.beginPath(); g.arc(cx, cx, r, 0, TAU); g.stroke(); };
  ring(S * 0.47, 6); ring(S * 0.44, 2); ring(S * 0.3, 4); ring(S * 0.28, 1.5); ring(S * 0.1, 3);
  g.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * S * 0.1, cx + Math.sin(a) * S * 0.1);
    g.lineTo(cx + Math.cos(a) * S * 0.44, cx + Math.sin(a) * S * 0.44);
    g.stroke();
  }
  // 六芒星
  g.lineWidth = 3;
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

function skyDome(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color(0x0b0418) },
      mid: { value: new THREE.Color(0x3a1240) },
      bottom: { value: new THREE.Color(0x9a3a30) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;
        vec3 c = h < 0.12 ? mix(bottom, mid, smoothstep(-0.05, 0.12, h)) : mix(mid, top, smoothstep(0.12, 0.7, h));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(150, 24, 12), mat);
  m.renderOrder = -10;
  return m;
}

export interface ArenaResult {
  group: THREE.Group;
  embers: THREE.Points;
  update(dt: number): void;
}

export function createArena(R: number): ArenaResult {
  const group = new THREE.Group();

  // 床
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 64), new THREE.MeshToonMaterial({ map: groundTexture(), color: 0xffffff }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = false;
  group.add(floor);
  // 縁の石段
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.6, R + 1.2, 0.7, 64, 1, true), toonMat(0x2c1a2e, { side: THREE.DoubleSide }));
  rim.position.y = -0.35;
  group.add(rim);
  // 発光する縁
  const edge = new THREE.Mesh(new THREE.TorusGeometry(R, 0.06, 8, 96), new THREE.MeshBasicMaterial({ color: 0xff6a3a, toneMapped: false }));
  edge.rotation.x = Math.PI / 2;
  edge.position.y = 0.04;
  group.add(edge);

  // 鳥居
  const red = toonMat(0xd63a2a);
  const black = toonMat(0x241018);
  const torii = new THREE.Group();
  for (const s of [1, -1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 5.2, 12), red);
    post.position.set(s * 2.2, 2.6, 0);
    addOutline(post, 0.03);
    torii.add(post);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.3, 12), black);
    foot.position.set(s * 2.2, 0.15, 0);
    torii.add(foot);
  }
  const kasagi = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.4, 0.5), black);
  kasagi.position.y = 5.3;
  addOutline(kasagi, 0.03);
  torii.add(kasagi);
  const nuki = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.28, 0.32), red);
  nuki.position.y = 4.4;
  addOutline(nuki, 0.03);
  torii.add(nuki);
  torii.position.set(0, 0, -R - 2.5);
  group.add(torii);

  // 石灯籠
  const stone = toonMat(0x6a5670);
  const lanternLight = new THREE.MeshBasicMaterial({ color: 0xffc070, toneMapped: false });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8;
    const l = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.3, 8), stone);
    base.position.y = 0.15;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.4, 8), stone);
    pole.position.y = 1.0;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.6), stone);
    box.position.y = 1.95;
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.62), lanternLight);
    glow.position.y = 1.95;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.4, 4), black);
    roof.position.y = 2.4;
    roof.rotation.y = Math.PI / 4;
    for (const m of [base, pole, box, roof]) addOutline(m, 0.02);
    l.add(base, pole, box, glow, roof);
    l.position.set(Math.cos(a) * (R + 2.2), -0.2, Math.sin(a) * (R + 2.2));
    group.add(l);
  }

  // 遠景の山と月
  const mountain = toonMat(0x1a0c22);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + rand(-0.1, 0.1);
    const h = rand(14, 30);
    const m = new THREE.Mesh(new THREE.ConeGeometry(rand(10, 20), h, 5), mountain);
    const d = rand(48, 70);
    m.position.set(Math.cos(a) * d, h / 2 - 6, Math.sin(a) * d);
    group.add(m);
  }
  const moon = new THREE.Mesh(new THREE.SphereGeometry(6, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffe0a8, toneMapped: false, fog: false }));
  moon.position.set(-40, 45, -90);
  group.add(moon);
  group.add(skyDome());

  // 舞い散る火の粉
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

  // ライト
  const hemi = new THREE.HemisphereLight(0x9a6ab8, 0x3a1020, 0.9);
  const dir = new THREE.DirectionalLight(0xffd8b0, 1.6);
  dir.position.set(-8, 14, -6);
  const fill = new THREE.DirectionalLight(0xff6a4a, 0.5);
  fill.position.set(6, 4, 8);
  group.add(hemi, dir, fill);

  let t = 0;
  return {
    group,
    embers,
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
    },
  };
}
