import * as THREE from 'three';
import { dirt, dustyRubber, moteTexture, skyDome, wornPaint } from './field-textures';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * Rugged field-terminal laptop built from primitives.
 *
 * The camera always looks straight down the screen's normal, so the screen
 * projects to a perfect axis-aligned rectangle. The real Video.js player is a
 * flat DOM element laid exactly over that rectangle: text stays crisp, focus
 * and keyboard work as normal, and fullscreen needs no special handling.
 */

export const SCREEN_W = 1.6;
export const SCREEN_H = 0.9;
const TILT = THREE.MathUtils.degToRad(18); // lid leans back 18° past vertical
const CLOSED = Math.PI / 2;

// Chassis
const BW = 2.3;
const BD = 1.62;
const BH = 0.5;
// Lid
const LW = 2.2;
const LH = 1.5;
const LT = 0.11;
const BEZEL_BOTTOM = 0.34;
const SCREEN_CY = 0.02 + BEZEL_BOTTOM + SCREEN_H / 2;

export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BootCallbacks {
  /** Fires every frame the on-screen rect changes (during the dolly). */
  onRect?: (rect: ScreenRect) => void;
  /** Screen has powered on; good moment for boot text. */
  onScreenOn?: () => void;
  /** Intro finished (or skipped); hand over to the player. */
  onDone?: () => void;
}

// Intro timeline (seconds)
const LID_START = 0.35;
const LID_DUR = 1.5;
const DOLLY_START = 0.15;
const DOLLY_DUR = 3.0;
const DOLLY_FROM = 2.7;
const SCREEN_ON = 1.9;
export const INTRO_END = 3.9;

export interface LayoutOptions {
  /** Screen width in CSS px. */
  screenPx: number;
  /** Vertical position of the screen centre, 0 = top, 1 = bottom. */
  centerY: number;
}

function noiseTexture(size = 256, base = 128, spread = 60): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = base + (Math.random() - 0.5) * spread;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

function plateTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function radialShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,0.85)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.45)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export class LaptopScene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  private lid = new THREE.Group();
  private screenMat: THREE.MeshStandardMaterial;
  private screenGlow: THREE.PointLight;
  private keyLight: THREE.DirectionalLight;
  private leds: THREE.MeshStandardMaterial[] = [];
  private activityLed: THREE.MeshStandardMaterial;
  private clock = new THREE.Clock();
  private raf = 0;
  private playing = false;
  private boot = { start: 0, done: false, screenOn: false };
  private bootCb: BootCallbacks = {};
  private zoom: { start: number; ms: number; k0: number; cy0: number; onEnd?: () => void } | null = null;
  private dolly = DOLLY_FROM;
  private view = { vw: 1, vh: 1, screenPx: 1, centerY: 0.5, d: 1 };
  private pointer = new THREE.Vector2();
  private pointerSmooth = new THREE.Vector2();
  private reducedMotion: boolean;
  private sunDir = new THREE.Vector3();
  private motes!: THREE.Points;

  /** Screen centre and orientation with the lid fully open, in world space. */
  private screenCenter = new THREE.Vector3();
  private screenNormal = new THREE.Vector3();
  private screenUp = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean; lowPower: boolean }) {
    this.reducedMotion = opts.reducedMotion;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.lowPower ? 1.5 : 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // ---------- Field: dusk sky, haze, environment ----------
    this.sunDir.set(-6, 2.6, 1.8).normalize();
    const sky = skyDome(this.sunDir);
    this.scene.add(sky);
    this.scene.fog = new THREE.Fog(0x3b352b, 5, 30);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    envScene.add(skyDome(this.sunDir));
    this.scene.environment = pmrem.fromScene(envScene, 0.02).texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();

    // ---------- Materials ----------
    const paint = wornPaint(7);
    const paintDark = wornPaint(3, 512, '#283020');
    const rub = dustyRubber(11);
    const olive = new THREE.MeshStandardMaterial({
      ...paint,
      roughness: 1,
      metalness: 0.18,
      bumpScale: 1.4,
    });
    const oliveDark = new THREE.MeshStandardMaterial({ ...paintDark, roughness: 1, metalness: 0.15, bumpScale: 1 });
    const rubber = new THREE.MeshStandardMaterial({ ...rub, roughness: 1, metalness: 0, bumpScale: 0.6 });
    const keyMat = new THREE.MeshStandardMaterial({ ...rub, color: 0xd8d8d8, roughness: 0.8, metalness: 0.02, bumpScale: 0.3 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x7a7e74, roughness: 0.42, metalness: 0.85, roughnessMap: rub.roughnessMap });
    this.screenMat = new THREE.MeshStandardMaterial({
      color: 0x030403,
      roughness: 0.12,
      metalness: 0,
      emissive: new THREE.Color(0xdfe6d8),
      emissiveIntensity: 0,
    });

    const base = new THREE.Group();
    this.scene.add(base);

    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = base) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };

    // ---------- Chassis: two stacked modules ----------
    add(new RoundedBoxGeometry(BW - 0.05, 0.22, BD - 0.05, 3, 0.035), olive, 0, 0.11, 0);
    add(new THREE.BoxGeometry(BW - 0.09, 0.018, BD - 0.09), rubber, 0, 0.225, 0);
    add(new RoundedBoxGeometry(BW, 0.27, BD, 3, 0.04), olive, 0, 0.365, 0);

    const front = BD / 2;
    // Drive bays (left), latches (centre), LED panels (right) on both modules
    for (const [y, h] of [
      [0.36, 0.17],
      [0.11, 0.14],
    ] as const) {
      add(new THREE.BoxGeometry(0.98, h, 0.02), oliveDark, -0.55, y, front + 0.002);
      add(new RoundedBoxGeometry(0.32, h * 0.55, 0.05, 2, 0.015), rubber, -0.48, y, front + 0.02);
      add(new RoundedBoxGeometry(0.11, h * 0.85, 0.07, 2, 0.02), rubber, 0.08, y, front + 0.025);
      add(new THREE.BoxGeometry(0.72, h * 0.62, 0.02), rubber, 0.62, y, front + 0.004);
    }

    // Status LEDs on the upper panel
    const ledGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.01, 12).rotateX(Math.PI / 2);
    const ledColors = [0x9dff7a, 0x9dff7a, 0xffb347];
    ledColors.forEach((color, i) => {
      const mat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: i === 2 ? 0.2 : 1.6 });
      this.leds.push(mat);
      add(ledGeo, mat, 0.36 + i * 0.07, 0.385, front + 0.018);
    });
    this.activityLed = this.leds[1]!;
    // Power + blackout buttons
    const btnGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.02, 20).rotateX(Math.PI / 2);
    add(btnGeo, steel, 0.74, 0.36, front + 0.018);
    add(btnGeo, steel, 0.88, 0.36, front + 0.018);

    // Side vents
    const ventGeo = new THREE.BoxGeometry(0.012, 0.012, 0.22);
    for (let i = 0; i < 7; i++) {
      add(ventGeo, rubber, BW / 2 + 0.002, 0.3 + i * 0.022, 0.2);
      add(ventGeo, rubber, -BW / 2 - 0.002, 0.3 + i * 0.022, 0.2);
    }

    // ---------- Deck ----------
    const top = BH;
    add(new THREE.BoxGeometry(1.94, 0.012, 0.8), rubber, 0, top + 0.004, 0.02);
    add(new THREE.BoxGeometry(2.08, 0.012, 0.3), rubber, 0, top + 0.004, front - 0.21);

    // Keys (instanced)
    const keyW = 0.104;
    const pitch = 0.118;
    const keyGeo = new RoundedBoxGeometry(keyW, 0.03, 0.098, 2, 0.014);
    const placements: [number, number, number][] = []; // x, z, widthScale
    const rows = 6;
    const z0 = 0.02 - 0.8 / 2 + 0.07;
    for (let r = 0; r < rows; r++) {
      const z = z0 + r * 0.124;
      if (r === rows - 1) {
        for (const c of [0, 1, 2, 3]) placements.push([(c - 7) * pitch, z, 1]);
        placements.push([(6.5 - 7) * pitch, z, 5.6]);
        for (const c of [10, 11, 12, 13, 14]) placements.push([(c - 7) * pitch, z, 1]);
      } else {
        for (let c = 0; c < 15; c++) placements.push([(c - 7) * pitch, z, 1]);
      }
    }
    const keys = new THREE.InstancedMesh(keyGeo, keyMat, placements.length);
    const m4 = new THREE.Matrix4();
    placements.forEach(([x, z, s], i) => {
      m4.compose(new THREE.Vector3(x, top + 0.024, z), new THREE.Quaternion(), new THREE.Vector3(s === 1 ? 1 : (s * pitch) / keyW, r0(i, placements.length) ? 0.75 : 1, 1));
      keys.setMatrixAt(i, m4);
    });
    keys.castShadow = true;
    keys.receiveShadow = true;
    base.add(keys);
    function r0(i: number, _n: number) {
      return i < 15; // function row is shallower
    }

    // Pointing stick + mouse buttons
    add(new THREE.CylinderGeometry(0.018, 0.02, 0.03, 12), rubber, 0, top + 0.02, front - 0.24);
    add(new RoundedBoxGeometry(0.22, 0.02, 0.06, 2, 0.008), keyMat, -0.14, top + 0.016, front - 0.15);
    add(new RoundedBoxGeometry(0.22, 0.02, 0.06, 2, 0.008), keyMat, 0.14, top + 0.016, front - 0.15);

    // Deck screws
    const screwGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.012, 16);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(screwGeo, steel, sx * (BW / 2 - 0.07), top + 0.006, sz * (BD / 2 - 0.07));

    // Hinges
    const hingeY = top + 0.055;
    const hingeZ = -BD / 2 + 0.11;
    const hingeGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.42, 20).rotateZ(Math.PI / 2);
    add(hingeGeo, oliveDark, -0.62, hingeY, hingeZ);
    add(hingeGeo, oliveDark, 0.62, hingeY, hingeZ);
    add(new THREE.CylinderGeometry(0.035, 0.035, 2.0, 16).rotateZ(Math.PI / 2), steel, 0, hingeY, hingeZ);

    // ---------- Lid ----------
    this.lid.position.set(0, hingeY, hingeZ);
    base.add(this.lid);
    const lidZ = -0.06; // slab sits behind the hinge axis so the closed lid clears the keys
    const face = lidZ + LT / 2;
    add(new RoundedBoxGeometry(LW, LH, LT, 3, 0.04), olive, 0, LH / 2 + 0.02, lidZ, this.lid);

    // Screen gasket + glass
    add(new THREE.BoxGeometry(SCREEN_W + 0.1, SCREEN_H + 0.1, 0.012), rubber, 0, SCREEN_CY, face + 0.004, this.lid);
    const screen = add(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H), this.screenMat, 0, SCREEN_CY, face + 0.0115, this.lid);
    screen.castShadow = false;

    // Raised bezel lip
    const lip = 0.035;
    const lipW = SCREEN_W + 0.1 + lip * 2;
    add(new THREE.BoxGeometry(lipW, lip, 0.03), oliveDark, 0, SCREEN_CY + SCREEN_H / 2 + 0.05 + lip / 2, face + 0.012, this.lid);
    add(new THREE.BoxGeometry(lipW, lip, 0.03), oliveDark, 0, SCREEN_CY - SCREEN_H / 2 - 0.05 - lip / 2, face + 0.012, this.lid);
    add(new THREE.BoxGeometry(lip, SCREEN_H + 0.1, 0.03), oliveDark, SCREEN_W / 2 + 0.05 + lip / 2, SCREEN_CY, face + 0.012, this.lid);
    add(new THREE.BoxGeometry(lip, SCREEN_H + 0.1, 0.03), oliveDark, -SCREEN_W / 2 - 0.05 - lip / 2, SCREEN_CY, face + 0.012, this.lid);

    // Corner bumpers with screws
    const bumperGeo = new RoundedBoxGeometry(0.2, 0.2, LT + 0.05, 3, 0.05);
    const lidScrewGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.012, 16).rotateX(Math.PI / 2);
    for (const sx of [-1, 1]) {
      for (const sy of [0, 1]) {
        const x = sx * (LW / 2 - 0.06);
        const y = sy ? LH + 0.02 - 0.06 : 0.08;
        add(bumperGeo, rubber, x, y, lidZ, this.lid);
        add(lidScrewGeo, steel, x, y, face + 0.032, this.lid);
      }
    }
    // Top latch
    add(new RoundedBoxGeometry(0.26, 0.07, LT + 0.04, 2, 0.02), rubber, 0, LH + 0.03, lidZ, this.lid);

    // Lower bezel: brand plate, handle rail, speaker grille
    const plateY = 0.02 + BEZEL_BOTTOM / 2 - 0.01;
    const brand = plateTexture(
      (ctx, w, h) => {
        ctx.fillStyle = '#1a1c17';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(234,230,223,0.18)';
        ctx.lineWidth = 3;
        ctx.strokeRect(4, 4, w - 8, h - 8);
        ctx.fillStyle = '#cfcbc2';
        ctx.font = '700 58px "Big Shoulders Display", "Chakra Petch", sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText('RUGGED', 30, h / 2 + 2);
        ctx.font = '500 26px "JetBrains Mono", monospace';
        ctx.fillStyle = '#8f8c84';
        ctx.fillText('MK-1 // FIELD TERMINAL', 232, h / 2 + 2);
      },
      640,
      110,
    );
    add(new THREE.PlaneGeometry(0.62, 0.106), new THREE.MeshStandardMaterial({ map: brand, roughness: 0.6 }), -0.62, plateY, face + 0.002, this.lid);

    add(new RoundedBoxGeometry(0.6, 0.075, 0.05, 2, 0.02), rubber, 0.02, plateY, face + 0.02, this.lid);
    add(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 8).rotateZ(Math.PI / 2), steel, 0.02, plateY, face + 0.05, this.lid);

    const grille = plateTexture(
      (ctx, w, h) => {
        ctx.fillStyle = '#3c422e';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#0d0e0c';
        for (let y = 14; y < h; y += 22) for (let x = 14; x < w; x += 22) {
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      },
      400,
      100,
    );
    add(new THREE.PlaneGeometry(0.4, 0.1), new THREE.MeshStandardMaterial({ map: grille, roughness: 0.85 }), 0.66, plateY, face + 0.002, this.lid);

    // Screen anchor, used to aim the camera
    const anchor = new THREE.Object3D();
    anchor.position.set(0, SCREEN_CY, face + 0.0115);
    this.lid.add(anchor);
    this.lid.rotation.x = -TILT;
    this.lid.updateMatrixWorld(true);
    base.updateMatrixWorld(true);
    anchor.getWorldPosition(this.screenCenter);
    const q = new THREE.Quaternion();
    anchor.getWorldQuaternion(q);
    this.screenNormal.set(0, 0, 1).applyQuaternion(q);
    this.screenUp.set(0, 1, 0).applyQuaternion(q);

    // ---------- Ground: packed dirt, gravel, a few rocks, distant ridges ----------
    const ground = dirt(23);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 90),
      new THREE.MeshStandardMaterial({ ...ground, color: 0xb0b0b0, roughness: 1, metalness: 0, bumpScale: 2 }),
    );
    for (const t of [ground.map, ground.roughnessMap, ground.bumpMap]) t.repeat.set(22, 22);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const contact = new THREE.Mesh(
      new THREE.PlaneGeometry(BW * 1.45, BD * 1.6),
      new THREE.MeshBasicMaterial({ map: radialShadowTexture(), transparent: true, opacity: 0.8, depthWrite: false }),
    );
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.003;
    this.scene.add(contact);

    const rockMat = new THREE.MeshStandardMaterial({ ...ground, color: 0x9a9080, roughness: 1, bumpScale: 2 });
    const rocks: [number, number, number, number][] = [
      [-2.1, -0.4, 0.16, 1.2],
      [-3.2, -2.4, 0.3, 5.0],
      [-1.3, -2.2, 0.09, 1.7],
    ];
    for (const [x, z, s, rot] of rocks) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), rockMat);
      const pos = rock.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const k = 0.78 + Math.abs(Math.sin(i * 12.9898 + rot * 78.233)) * 0.3;
        pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.6, pos.getZ(i) * k);
      }
      rock.geometry.computeVertexNormals();
      rock.scale.setScalar(s);
      rock.position.set(x, s * 0.25, z);
      rock.rotation.set(rot * 0.3, rot, rot * 0.2);
      rock.castShadow = rock.receiveShadow = true;
      this.scene.add(rock);
    }

    // Distant ridgelines that sink into the haze
    const ridgeMat = new THREE.MeshStandardMaterial({ color: 0x1d1c17, roughness: 1, flatShading: true });
    for (const [radius, height, seed] of [
      [30, 5, 1.3],
      [44, 9, 4.1],
    ] as const) {
      const g = new THREE.CylinderGeometry(radius, radius, 1, 160, 1, true);
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        if (p.getY(i) > 0) {
          const a = Math.atan2(p.getZ(i), p.getX(i));
          const h = height * (0.35 + 0.35 * Math.sin(a * 3 + seed) + 0.2 * Math.sin(a * 11 + seed * 2) + 0.1 * Math.sin(a * 29));
          p.setY(i, Math.max(0.2, h));
        } else p.setY(i, -0.5);
      }
      g.computeVertexNormals();
      const ridge = new THREE.Mesh(g, ridgeMat);
      ridge.material.side = THREE.BackSide;
      this.scene.add(ridge);
    }

    // Dust motes drifting through the low sun
    const moteCount = opts.lowPower ? 90 : 220;
    const motePos = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      motePos[i * 3] = (Math.random() - 0.5) * 7;
      motePos[i * 3 + 1] = Math.random() * 3;
      motePos[i * 3 + 2] = (Math.random() - 0.5) * 5 - 0.5;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
    this.motes = new THREE.Points(
      moteGeo,
      new THREE.PointsMaterial({
        map: moteTexture(),
        color: 0xffd9a8,
        size: 0.035,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.scene.add(this.motes);

    // ---------- Lights ----------
    // Cool dusk sky from above, warm bounce from the dirt
    this.scene.add(new THREE.HemisphereLight(0x8fa3b8, 0x2e2a22, 0.6));

    // Low, warm sun raking across the chassis: long shadows, reveals wear
    this.keyLight = new THREE.DirectionalLight(0xffd3a2, 2.8);
    this.keyLight.position.copy(this.sunDir).multiplyScalar(9);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(opts.lowPower ? 1024 : 2048, opts.lowPower ? 1024 : 2048);
    this.keyLight.shadow.camera.left = -4.5;
    this.keyLight.shadow.camera.right = 4.5;
    this.keyLight.shadow.camera.top = 4;
    this.keyLight.shadow.camera.bottom = -4;
    this.keyLight.shadow.camera.far = 25;
    this.keyLight.shadow.bias = -0.0003;
    this.keyLight.shadow.normalBias = 0.025;
    this.keyLight.shadow.radius = 3;
    this.scene.add(this.keyLight);

    // Cool rim from behind-right to cut the silhouette out of the haze
    const rim = new THREE.SpotLight(0xa9c3e6, 40, 16, 0.55, 0.7, 1.5);
    rim.position.set(4, 3.4, -4.5);
    rim.target.position.set(0, 0.8, 0);
    this.scene.add(rim, rim.target);

    // Soft front fill so the keyboard reads
    const fill = new THREE.DirectionalLight(0xc8d0d8, 0.45);
    fill.position.set(2.5, 3, 6);
    this.scene.add(fill);

    // Screen spill onto keyboard
    this.screenGlow = new THREE.PointLight(0xdfe6d8, 0, 2.4, 1.8);
    this.screenGlow.position.copy(this.screenCenter).addScaledVector(this.screenNormal, 0.35).addScaledVector(this.screenUp, -0.2);
    this.scene.add(this.screenGlow);

    this.lid.rotation.x = CLOSED;

    window.addEventListener('pointermove', this.onPointer, { passive: true });
  }

  private onPointer = (e: PointerEvent) => {
    this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  };

  /** Place camera so the screen lands at the requested CSS rect. Returns that rect. */
  layout(vw: number, vh: number, { screenPx, centerY }: LayoutOptions): ScreenRect {
    this.renderer.setSize(vw, vh, false);
    const cam = this.camera;
    cam.aspect = vw / vh;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    this.view = { vw, vh, screenPx, centerY, d: (SCREEN_W * vh) / (2 * screenPx * tanHalf) };
    cam.up.copy(this.screenUp);
    cam.far = 200;
    // Lens shift: move the image so the screen centre sits at centerY.
    cam.setViewOffset(vw, vh, 0, (0.5 - centerY) * vh, vw, vh);
    return this.applyDolly(this.dolly);
  }

  /**
   * Dolly along the screen normal. Because the camera stays on that axis the
   * screen remains a perfect rectangle at every distance: it just scales about
   * its centre, so DOM can follow it exactly.
   */
  private applyDolly(k: number, centerY = this.view.centerY): ScreenRect {
    this.dolly = k;
    const { vw, vh, screenPx, d } = this.view;
    const cam = this.camera;
    cam.setViewOffset(vw, vh, 0, (0.5 - centerY) * vh, vw, vh);
    cam.position.copy(this.screenCenter).addScaledVector(this.screenNormal, d * k);
    cam.lookAt(this.screenCenter);
    cam.near = Math.max(0.05, d * k - 6);
    cam.updateProjectionMatrix();
    const width = screenPx / k;
    const height = (width * SCREEN_H) / SCREEN_W;
    const rect = { x: (vw - width) / 2, y: centerY * vh - height / 2, width, height };
    this.bootCb.onRect?.(rect);
    return rect;
  }

  /**
   * Intro: wide shot of the closed terminal, lid swings open while the camera
   * dollies in, screen powers on (onScreenOn), then hands over (onDone).
   */
  powerOn(cb: BootCallbacks) {
    this.bootCb = cb;
    this.boot = { start: performance.now(), done: false, screenOn: false };
    if (this.reducedMotion) this.skip();
  }

  /**
   * Pull back from a framing where the screen fills the viewport (dolly k0,
   * screen centred at cy0) to the resting framing. Used when leaving fullscreen.
   */
  zoomFrom(k0: number, cy0: number, ms: number, onEnd?: () => void) {
    if (this.reducedMotion || !this.boot.done) {
      onEnd?.();
      return;
    }
    this.zoom = { start: performance.now(), ms, k0, cy0, onEnd };
    this.applyDolly(k0, cy0);
  }

  /** Jump straight to the end of the intro. */
  skip() {
    if (this.boot.done) return;
    this.boot.start = performance.now() - INTRO_END * 1000;
  }

  setPlaying(playing: boolean) {
    this.playing = playing;
  }

  start() {
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      this.update();
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  private update() {
    const t = this.clock.getElapsedTime();
    let screenOn = 1;

    if (!this.boot.done && this.boot.start) {
      const e = (performance.now() - this.boot.start) / 1000;
      const clamp = (v: number) => Math.min(1, Math.max(0, v));
      // Fade up from black
      this.renderer.toneMappingExposure = clamp(e / 0.9);
      // Lid swing
      const lidT = clamp((e - LID_START) / LID_DUR);
      const eased = 1 - Math.pow(1 - lidT, 3);
      const settle = lidT >= 1 ? 0 : Math.sin(lidT * Math.PI) * 0.02 * lidT;
      this.lid.rotation.x = CLOSED + (-TILT - CLOSED) * eased - settle;
      // Dolly in: slow start, long soft landing
      const dT = clamp((e - DOLLY_START) / DOLLY_DUR);
      const dEase = dT < 0.5 ? 4 * dT * dT * dT : 1 - Math.pow(-2 * dT + 2, 4) / 2;
      this.applyDolly(DOLLY_FROM + (1 - DOLLY_FROM) * dEase);
      // Screen power-on flash
      const p = (e - SCREEN_ON) / 0.45;
      screenOn = clamp(p);
      this.screenMat.emissiveIntensity = p > 0 && p < 1 ? Math.sin(p * Math.PI) * 0.9 : 0;
      if (e >= SCREEN_ON + 0.08 && !this.boot.screenOn) {
        this.boot.screenOn = true;
        if (e < INTRO_END - 0.2) this.bootCb.onScreenOn?.();
      }
      if (e >= INTRO_END) {
        this.boot.done = true;
        this.renderer.toneMappingExposure = 1;
        this.lid.rotation.x = -TILT;
        this.applyDolly(1);
        this.screenMat.emissiveIntensity = 0;
        this.bootCb.onDone?.();
      }
    } else if (!this.boot.start) {
      screenOn = 0;
    }

    if (this.zoom) {
      const z = this.zoom;
      const p = Math.min(1, (performance.now() - z.start) / z.ms);
      const ease = 1 - Math.pow(1 - p, 4); // fast out of the screen, soft landing
      this.applyDolly(z.k0 + (1 - z.k0) * ease, z.cy0 + (this.view.centerY - z.cy0) * ease);
      if (p >= 1) {
        this.zoom = null;
        z.onEnd?.();
      }
    }

    // Screen spill: brighter + flickering while video plays
    const flicker = this.playing && !this.reducedMotion ? 0.18 * Math.sin(t * 7.3) * Math.sin(t * 2.1) : 0;
    const target = (this.playing ? 1.5 : 0.7) * screenOn + flicker * screenOn;
    this.screenGlow.intensity += (target - this.screenGlow.intensity) * 0.08;

    // Activity LED
    this.activityLed.emissiveIntensity = this.playing ? (Math.sin(t * 9) > 0 ? 2 : 0.3) : 1.2;
    this.leds[2]!.emissiveIntensity = this.playing ? 0.2 : 1.4;

    // Key light drifts gently with the pointer (lighting only, never the geometry)
    if (!this.reducedMotion) {
      this.pointerSmooth.lerp(this.pointer, 0.04);
      this.keyLight.position.copy(this.sunDir).multiplyScalar(9);
      this.keyLight.position.x += this.pointerSmooth.x * 0.9;
      this.keyLight.position.y -= this.pointerSmooth.y * 0.6;
      const mp = this.motes.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < mp.count; i++) {
        let x = mp.getX(i) + 0.0016 + Math.sin(t * 0.4 + i) * 0.0008;
        let y = mp.getY(i) + Math.sin(t * 0.7 + i * 1.7) * 0.0012 - 0.0003;
        if (x > 3.5) x = -3.5;
        if (y < 0) y = 3;
        mp.setXY(i, x, y);
      }
      mp.needsUpdate = true;
    }
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('pointermove', this.onPointer);
    this.renderer.dispose();
  }
}
