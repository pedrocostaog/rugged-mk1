import * as THREE from 'three';

/** Small deterministic PRNG so the wear pattern is identical on every load. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(size: number) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')!] as const;
}

function speckle(ctx: CanvasRenderingContext2D, size: number, r: () => number, count: number, color: string, maxR: number) {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    ctx.beginPath();
    ctx.arc(r() * size, r() * size, r() * maxR + 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function blotches(ctx: CanvasRenderingContext2D, size: number, r: () => number, count: number, rgb: string, alpha: number, minR: number, maxR: number) {
  for (let i = 0; i < count; i++) {
    const x = r() * size;
    const y = r() * size;
    const rad = minR + r() * (maxR - minR);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(${rgb},${alpha * (0.4 + r() * 0.6)})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}

function chip(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, r: () => number) {
  ctx.beginPath();
  const n = 6 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = s * (0.5 + r() * 0.7);
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr * (0.5 + r() * 0.6);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function toTexture(c: HTMLCanvasElement, color: boolean, repeat = 1) {
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  return t;
}

export interface PBRSet {
  map: THREE.Texture;
  roughnessMap: THREE.Texture;
  bumpMap: THREE.Texture;
}

/**
 * Field-worn olive drab: mottled paint, rain streaks, scratches, chipped
 * edges down to primer/metal, and settled dust. Colour, roughness and bump
 * are painted from the same random marks so they line up.
 */
export function wornPaint(seed = 7, size = 1024, base = '#384627'): PBRSet {
  const [cc, c] = canvas(size);
  const [rc, rgh] = canvas(size);
  const [bc, b] = canvas(size);
  const r = rng(seed);

  // Base coats
  c.fillStyle = base;
  c.fillRect(0, 0, size, size);
  rgh.fillStyle = '#b8b8b8'; // ~0.72 roughness
  rgh.fillRect(0, 0, size, size);
  b.fillStyle = '#808080';
  b.fillRect(0, 0, size, size);

  // Uneven paint: sun-faded and darker patches
  blotches(c, size, r, 90, '104,122,84', 0.12, 40, 220);
  blotches(c, size, r, 70, '18,22,12', 0.22, 30, 180);
  // Fine paint grain
  speckle(c, size, r, 9000, 'rgba(255,255,230,0.035)', 1.1);
  speckle(c, size, r, 9000, 'rgba(0,0,0,0.05)', 1.1);
  speckle(b, size, r, 14000, 'rgba(255,255,255,0.08)', 1.2);
  speckle(b, size, r, 14000, 'rgba(0,0,0,0.08)', 1.2);

  // Grime / rain streaks running down
  for (let i = 0; i < 70; i++) {
    const x = r() * size;
    const y = r() * size * 0.7;
    const len = 60 + r() * 320;
    const w = 2 + r() * 10;
    const g = c.createLinearGradient(x, y, x, y + len);
    g.addColorStop(0, 'rgba(20,18,10,0)');
    g.addColorStop(0.2, `rgba(20,18,10,${0.08 + r() * 0.14})`);
    g.addColorStop(1, 'rgba(20,18,10,0)');
    c.fillStyle = g;
    c.fillRect(x, y, w, len);
    rgh.fillStyle = 'rgba(230,230,230,0.12)';
    rgh.fillRect(x, y, w, len);
  }

  // Scratches: bright bare paint lines, smoother, slightly recessed
  for (let i = 0; i < 260; i++) {
    const x = r() * size;
    const y = r() * size;
    const a = (r() - 0.5) * Math.PI * (r() < 0.6 ? 0.35 : 1);
    const len = 8 + r() * (r() < 0.1 ? 180 : 60);
    const x2 = x + Math.cos(a) * len;
    const y2 = y + Math.sin(a) * len;
    const w = 0.5 + r() * 1.3;
    c.strokeStyle = `rgba(150,152,128,${0.25 + r() * 0.4})`;
    c.lineWidth = w;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x2, y2);
    c.stroke();
    rgh.strokeStyle = 'rgba(70,70,70,0.7)';
    rgh.lineWidth = w;
    rgh.beginPath();
    rgh.moveTo(x, y);
    rgh.lineTo(x2, y2);
    rgh.stroke();
    b.strokeStyle = 'rgba(40,40,40,0.8)';
    b.lineWidth = w;
    b.beginPath();
    b.moveTo(x, y);
    b.lineTo(x2, y2);
    b.stroke();
  }

  // Chips concentrated near the borders (box faces map edge-to-edge, so the
  // texture border ≈ the geometry edge)
  for (let i = 0; i < 340; i++) {
    const edge = r() < 0.8;
    let x = r() * size;
    let y = r() * size;
    if (edge) {
      const side = Math.floor(r() * 4);
      const d = Math.pow(r(), 2.2) * size * 0.08;
      if (side === 0) y = d;
      else if (side === 1) y = size - d;
      else if (side === 2) x = d;
      else x = size - d;
    }
    const s = 1.5 + Math.pow(r(), 3) * 14;
    // primer ring then bare metal
    chip(c, x, y, s * 1.25, r);
    c.fillStyle = 'rgba(72,74,60,0.9)';
    c.fill();
    chip(c, x, y, s, r);
    c.fillStyle = r() < 0.5 ? '#6f716a' : '#3a3833';
    c.fill();
    chip(rgh, x, y, s, r);
    rgh.fillStyle = '#4a4a4a';
    rgh.fill();
    chip(b, x, y, s * 1.2, r);
    b.fillStyle = '#4c4c4c';
    b.fill();
  }

  // Settled dust: pale, rough, clings to the lower part of each face
  const dust = c.createLinearGradient(0, 0, 0, size);
  dust.addColorStop(0, 'rgba(150,135,105,0.02)');
  dust.addColorStop(0.7, 'rgba(150,135,105,0.035)');
  dust.addColorStop(1, 'rgba(150,135,105,0.1)');
  c.fillStyle = dust;
  c.fillRect(0, 0, size, size);
  blotches(c, size, r, 50, '160,145,112', 0.05, 20, 120);
  speckle(c, size, r, 1800, 'rgba(175,160,125,0.18)', 1.2);
  blotches(rgh, size, r, 50, '255,255,255', 0.15, 20, 120);

  return { map: toTexture(cc, true), roughnessMap: toTexture(rc, false), bumpMap: toTexture(bc, false) };
}

/** Dusty black rubber. */
export function dustyRubber(seed = 11, size = 512): PBRSet {
  const [cc, c] = canvas(size);
  const [rc, rgh] = canvas(size);
  const [bc, b] = canvas(size);
  const r = rng(seed);
  c.fillStyle = '#151614';
  c.fillRect(0, 0, size, size);
  blotches(c, size, r, 40, '110,100,80', 0.12, 15, 90);
  speckle(c, size, r, 3000, 'rgba(160,145,115,0.18)', 1);
  rgh.fillStyle = '#e8e8e8';
  rgh.fillRect(0, 0, size, size);
  speckle(rgh, size, r, 2000, 'rgba(150,150,150,0.4)', 1.5);
  b.fillStyle = '#808080';
  b.fillRect(0, 0, size, size);
  speckle(b, size, r, 12000, 'rgba(255,255,255,0.12)', 1);
  speckle(b, size, r, 12000, 'rgba(0,0,0,0.12)', 1);
  return { map: toTexture(cc, true), roughnessMap: toTexture(rc, false), bumpMap: toTexture(bc, false) };
}

/** Dry packed dirt with gravel. */
export function dirt(seed = 23, size = 1024): PBRSet {
  const [cc, c] = canvas(size);
  const [rc, rgh] = canvas(size);
  const [bc, b] = canvas(size);
  const r = rng(seed);
  c.fillStyle = '#2a261f';
  c.fillRect(0, 0, size, size);
  blotches(c, size, r, 160, '80,70,54', 0.2, 30, 200);
  blotches(c, size, r, 120, '20,17,12', 0.35, 20, 160);
  speckle(c, size, r, 30000, 'rgba(120,108,88,0.25)', 1.3);
  speckle(c, size, r, 20000, 'rgba(10,8,5,0.3)', 1.3);
  rgh.fillStyle = '#f0f0f0';
  rgh.fillRect(0, 0, size, size);
  b.fillStyle = '#707070';
  b.fillRect(0, 0, size, size);
  blotches(b, size, r, 200, '200,200,200', 0.35, 10, 80);
  // gravel
  for (let i = 0; i < 1400; i++) {
    const x = r() * size;
    const y = r() * size;
    const s = 1 + Math.pow(r(), 2.5) * 7;
    const tone = 50 + r() * 55;
    chip(c, x, y, s, r);
    c.fillStyle = `rgb(${tone},${tone * 0.93},${tone * 0.82})`;
    c.fill();
    chip(b, x, y, s, r);
    b.fillStyle = `rgb(${200 + r() * 55},${200},${200})`;
    b.fill();
    chip(rgh, x, y, s, r);
    rgh.fillStyle = '#bdbdbd';
    rgh.fill();
  }
  return { map: toTexture(cc, true, 6), roughnessMap: toTexture(rc, false, 6), bumpMap: toTexture(bc, false, 6) };
}

/** Large dusk sky dome; also used to bake the environment map. */
export function skyDome(sunDir: THREE.Vector3): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      sunDir: { value: sunDir.clone().normalize() },
      top: { value: new THREE.Color(0x0b1117) },
      mid: { value: new THREE.Color(0x2a2f30) },
      horizon: { value: new THREE.Color(0x8a6f4c) },
      ground: { value: new THREE.Color(0x15130f) },
      sun: { value: new THREE.Color(0xffc27a) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 sunDir, top, mid, horizon, ground, sun;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.18, h));
        col = mix(col, top, smoothstep(0.18, 0.7, h));
        col = mix(col, ground, smoothstep(0.0, -0.08, h));
        float s = max(dot(vDir, sunDir), 0.0);
        col += sun * (pow(s, 6.0) * 0.35 + pow(s, 80.0) * 1.2) * smoothstep(-0.05, 0.05, h);
        // haze band on the horizon
        col += horizon * 0.25 * exp(-abs(h) * 22.0);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(80, 48, 24), mat);
}

/** Soft round sprite for dust motes. */
export function moteTexture(): THREE.Texture {
  const [c, ctx] = canvas(64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,240,215,1)');
  g.addColorStop(0.35, 'rgba(255,230,200,0.35)');
  g.addColorStop(1, 'rgba(255,230,200,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
