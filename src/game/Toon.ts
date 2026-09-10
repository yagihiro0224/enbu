import * as THREE from 'three';

let gradient: THREE.DataTexture | null = null;
/** 3段階のトゥーン用グラデーションマップ */
export function toonGradient(): THREE.DataTexture {
  if (gradient) return gradient;
  const colors = new Uint8Array([70, 150, 255]);
  gradient = new THREE.DataTexture(colors, colors.length, 1, THREE.RedFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

export function toonMat(color: THREE.ColorRepresentation, opts: { emissive?: THREE.ColorRepresentation; emissiveIntensity?: number; side?: THREE.Side; transparent?: boolean; opacity?: number } = {}) {
  const m = new THREE.MeshToonMaterial({
    color,
    gradientMap: toonGradient(),
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
  });
  return m;
}

/** 裏面押し出し方式の輪郭線マテリアル */
export function outlineMaterial(thickness = 0.025, color: THREE.ColorRepresentation = 0x1c0a14) {
  return new THREE.ShaderMaterial({
    uniforms: { thickness: { value: thickness }, color: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `
      uniform float thickness;
      void main() {
        vec3 p = position + normalize(normal) * thickness;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      void main() { gl_FragColor = vec4(color, 1.0); }`,
    side: THREE.BackSide,
  });
}

/** メッシュに輪郭線を追加する。子として同じジオメトリを裏面で描く */
export function addOutline(mesh: THREE.Mesh, thickness = 0.025): THREE.Mesh {
  const o = new THREE.Mesh(mesh.geometry, outlineMaterial(thickness));
  o.name = 'outline';
  mesh.add(o);
  return o;
}

/** 放射状グラデーションのテクスチャ（足元の影や光のスポット用） */
export function radialTexture(size = 128, inner = 'rgba(0,0,0,0.55)', outer = 'rgba(0,0,0,0)'): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function blobShadow(radius = 0.5): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: radialTexture(), transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  m.renderOrder = 1;
  return m;
}
