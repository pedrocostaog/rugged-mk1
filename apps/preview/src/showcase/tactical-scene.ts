import * as THREE from 'three';

export type SceneFootage = 'film' | 'bright' | 'dark';
export type SceneTint = 'mono' | 'teal' | 'amber';
export type CameraPreset = 'orbit' | 'top' | 'low';

interface SectorProfile {
  seed: number;
  amp: number;
  freq: number;
  ridgeSharpness: number;
  coords: string;
  elevation: string;
  sectorCode: string;
}

const SECTOR_PROFILES: Record<SceneFootage, SectorProfile> = {
  film: {
    seed: 1.4,
    amp: 1.65,
    freq: 0.24,
    ridgeSharpness: 1.35,
    coords: '34°14\'08"N 118°09\'42"W',
    elevation: 'ALT 412.8 KM // ORBITAL',
    sectorCode: 'SEC-01 // KEPLER RIDGE',
  },
  bright: {
    seed: 4.8,
    amp: 2.2,
    freq: 0.28,
    ridgeSharpness: 1.75,
    coords: '67°51\'19"N 020°13\'30"E',
    elevation: 'ALT 04.2 KM // ALBEDO DECK',
    sectorCode: 'SEC-02 // BOREAL GLACIER',
  },
  dark: {
    seed: 9.2,
    amp: 1.3,
    freq: 0.18,
    ridgeSharpness: 1.15,
    coords: '36°14\'00"N 115°08\'11"W',
    elevation: 'ALT 01.1 KM // LOW-LUX BASIN',
    sectorCode: 'SEC-03 // BLACKSITE BASIN',
  },
};

const TINT_PALETTES: Record<SceneTint, { primary: number; dim: number; fog: number }> = {
  mono: {
    primary: 0xeae6df,
    dim: 0x4c4944,
    fog: 0x070706,
  },
  teal: {
    primary: 0xb8f6d2,
    dim: 0x265e4d,
    fog: 0x040a0b,
  },
  amber: {
    primary: 0xffbf47,
    dim: 0x6e4a15,
    fog: 0x0a0704,
  },
};

function pseudoNoise(x: number, z: number, seed: number): number {
  const n1 = Math.sin(x * 0.45 + seed) * Math.cos(z * 0.45 - seed * 0.7);
  const n2 = Math.sin((x + z) * 0.85 - seed * 1.3) * 0.5;
  const n3 = Math.cos(x * 1.7 - z * 1.4 + seed * 2.1) * 0.25;
  return n1 + n2 + n3;
}

export class TacticalEnvironment {
  #canvas: HTMLCanvasElement;
  #renderer: THREE.WebGLRenderer;
  #scene: THREE.Scene;
  #camera: THREE.PerspectiveCamera;

  #deskGroup: THREE.Group;
  #holoGlobeGroup: THREE.Group;
  #terrainGeo: THREE.PlaneGeometry;
  #terrainWire: THREE.LineSegments;
  #terrainMat: THREE.LineBasicMaterial;
  #scannerBeam: THREE.Mesh;
  #satMarker: THREE.Group;
  #tintMaterials: Array<THREE.LineBasicMaterial | THREE.MeshBasicMaterial | THREE.PointsMaterial> = [];

  #targetHeights: Float32Array;
  #currentHeights: Float32Array;

  #footage: SceneFootage = 'film';
  #tint: SceneTint = 'mono';
  #camPreset: CameraPreset = 'orbit';
  #isPlaying = false;
  #progress = 0;

  #pointerX = 0;
  #pointerY = 0;
  #clock = new THREE.Clock();
  #rafId = 0;
  #reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(canvas: HTMLCanvasElement) {
    this.#canvas = canvas;
    this.#renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const palette = TINT_PALETTES[this.#tint];
    this.#scene = new THREE.Scene();
    this.#scene.fog = new THREE.FogExp2(palette.fog, 0.028);

    this.#camera = new THREE.PerspectiveCamera(40, 1, 0.1, 120);
    this.#camera.position.set(0, 7.2, 21.5);
    this.#camera.lookAt(0, 0.4, 0);

    this.#deskGroup = new THREE.Group();
    this.#scene.add(this.#deskGroup);

    // 1. Physical Command Desk Surface & Precision Etched Bay Grid
    const deskGrid = new THREE.GridHelper(52, 52, palette.dim, palette.dim);
    const deskGridMat = deskGrid.material as THREE.LineBasicMaterial;
    deskGridMat.transparent = true;
    deskGridMat.opacity = 0.22;
    deskGrid.position.y = -3.8;
    this.#deskGroup.add(deskGrid);

    // Desk front Console Edge & Keyboard/Touchpad Deck Frame in 3D
    const padEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(15.5, 0.18, 4.2));
    const padMat = new THREE.LineBasicMaterial({ color: palette.primary, transparent: true, opacity: 0.35 });
    this.#tintMaterials.push(padMat);
    const deskPad = new THREE.LineSegments(padEdges, padMat);
    deskPad.position.set(0, -3.68, 6.2);
    this.#deskGroup.add(deskPad);

    // 2. Rear Command Bay Structural Pillars / Server Racks
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue;
      const rackEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.8, 14, 1.2));
      const rackMat = new THREE.LineBasicMaterial({ color: palette.primary, transparent: true, opacity: 0.11 });
      this.#tintMaterials.push(rackMat);
      const rack = new THREE.LineSegments(rackEdges, rackMat);
      rack.position.set(i * 5.2, 3.2, -9.5);
      this.#deskGroup.add(rack);
    }

    // 3. Holo-Projector Topographic Pad on the Command Desk
    const segs = 48;
    this.#terrainGeo = new THREE.PlaneGeometry(28, 16, segs, segs);
    this.#terrainGeo.rotateX(-Math.PI / 2);

    const vertexCount = this.#terrainGeo.attributes.position.count;
    this.#targetHeights = new Float32Array(vertexCount);
    this.#currentHeights = new Float32Array(vertexCount);

    const wireGeo = new THREE.WireframeGeometry(this.#terrainGeo);
    this.#terrainMat = new THREE.LineBasicMaterial({
      color: palette.primary,
      transparent: true,
      opacity: 0.18,
    });
    this.#tintMaterials.push(this.#terrainMat);
    this.#terrainWire = new THREE.LineSegments(wireGeo, this.#terrainMat);
    this.#terrainWire.position.set(0, -3.5, -1.5);
    this.#deskGroup.add(this.#terrainWire);

    // 4. 3D Holographic Orbital Globe & Radar Array (floating behind/beside the PC)
    this.#holoGlobeGroup = new THREE.Group();
    this.#holoGlobeGroup.position.set(0, 1.2, -3.2);
    this.#scene.add(this.#holoGlobeGroup);

    const sphereWire = new THREE.WireframeGeometry(new THREE.SphereGeometry(5.6, 20, 14));
    const sphereMat = new THREE.LineBasicMaterial({ color: palette.primary, transparent: true, opacity: 0.13 });
    this.#tintMaterials.push(sphereMat);
    const globe = new THREE.LineSegments(sphereWire, sphereMat);
    this.#holoGlobeGroup.add(globe);

    // Radar sweep cone on the desk
    const sweepGeo = new THREE.CircleGeometry(10.5, 32, 0, Math.PI * 0.3);
    sweepGeo.rotateX(-Math.PI / 2);
    const sweepMat = new THREE.MeshBasicMaterial({
      color: palette.primary,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.#tintMaterials.push(sweepMat);
    this.#scannerBeam = new THREE.Mesh(sweepGeo, sweepMat);
    this.#scannerBeam.position.set(0, -3.45, -1.5);
    this.#deskGroup.add(this.#scannerBeam);

    // Orbital Satellite Ring & Live Playhead Drone Marker
    const orbitPts: THREE.Vector3[] = [];
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      orbitPts.push(new THREE.Vector3(Math.cos(a) * 12.8, Math.sin(a) * 2.4, Math.sin(a) * 7.8));
    }
    const orbitMat = new THREE.LineBasicMaterial({ color: palette.primary, transparent: true, opacity: 0.34 });
    this.#tintMaterials.push(orbitMat);
    const orbitRing = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(orbitPts), orbitMat);
    orbitRing.position.y = 1.4;
    this.#scene.add(orbitRing);

    this.#satMarker = new THREE.Group();
    const satMat = new THREE.LineBasicMaterial({ color: palette.primary, transparent: true, opacity: 0.9 });
    this.#tintMaterials.push(satMat);
    const satBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.5, 0.5, 0.5)), satMat);
    this.#satMarker.add(satBox);
    this.#scene.add(this.#satMarker);

    this.#computeTargetTerrain(this.#footage);
    this.#applyImmediateTerrain();
    this.#handleResize();

    window.addEventListener('resize', this.#handleResize);
    window.addEventListener('pointermove', this.#handlePointerMove, { passive: true });

    this.#animate();
  }

  setFootage(footage: SceneFootage): SectorProfile {
    this.#footage = footage;
    this.#computeTargetTerrain(footage);
    return SECTOR_PROFILES[footage];
  }

  setTint(tint: SceneTint) {
    this.#tint = tint;
    const palette = TINT_PALETTES[tint];
    this.#scene.fog = new THREE.FogExp2(palette.fog, 0.028);
    for (const mat of this.#tintMaterials) {
      mat.color.setHex(palette.primary);
    }
  }

  setCameraPreset(preset: CameraPreset) {
    this.#camPreset = preset;
  }

  setPlaybackState(isPlaying: boolean, progressRatio: number) {
    this.#isPlaying = isPlaying;
    if (Number.isFinite(progressRatio)) {
      this.#progress = Math.max(0, Math.min(1, progressRatio));
    }
  }

  #computeTargetTerrain(footage: SceneFootage) {
    const profile = SECTOR_PROFILES[footage];
    const pos = this.#terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const dist = Math.hypot(x * 0.08, z * 0.08);
      const falloff = Math.max(0.15, 1 - dist * 0.42);
      const raw = pseudoNoise(x * profile.freq, z * profile.freq, profile.seed);
      const ridged = Math.pow(Math.abs(raw), profile.ridgeSharpness) * Math.sign(raw);
      this.#targetHeights[i] = ridged * profile.amp * falloff;
    }
  }

  #applyImmediateTerrain() {
    const pos = this.#terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      this.#currentHeights[i] = this.#targetHeights[i];
      pos.setY(i, this.#currentHeights[i]);
    }
    pos.needsUpdate = true;
    this.#rebuildWireframe();
  }

  #rebuildWireframe() {
    this.#terrainWire.geometry.dispose();
    this.#terrainWire.geometry = new THREE.WireframeGeometry(this.#terrainGeo);
  }

  #handleResize = () => {
    const rect = this.#canvas.parentElement?.getBoundingClientRect();
    const width = rect ? Math.max(1, rect.width) : window.innerWidth;
    const height = rect ? Math.max(1, rect.height) : window.innerHeight;
    this.#camera.aspect = width / height;
    this.#camera.updateProjectionMatrix();
    this.#renderer.setSize(width, height, false);
  };

  #handlePointerMove = (e: PointerEvent) => {
    if (this.#reducedMotion) return;
    this.#pointerX = (e.clientX / window.innerWidth - 0.5) * 2;
    this.#pointerY = (e.clientY / window.innerHeight - 0.5) * 2;
  };

  #animate = () => {
    this.#rafId = requestAnimationFrame(this.#animate);
    const dt = Math.min(0.05, this.#clock.getDelta());
    const elapsed = this.#clock.getElapsedTime();

    let needsWireUpdate = false;
    const pos = this.#terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const diff = this.#targetHeights[i] - this.#currentHeights[i];
      if (Math.abs(diff) > 0.008) {
        this.#currentHeights[i] += diff * Math.min(1, dt * 6);
        pos.setY(i, this.#currentHeights[i]);
        needsWireUpdate = true;
      }
    }
    if (needsWireUpdate) {
      pos.needsUpdate = true;
      this.#rebuildWireframe();
    }

    let targetCamX = 0;
    let targetCamY = 7.2;
    let targetCamZ = 21.5;

    if (this.#camPreset === 'top') {
      targetCamX = 0;
      targetCamY = 23.0;
      targetCamZ = 4.0;
    } else if (this.#camPreset === 'low') {
      targetCamX = -4.5;
      targetCamY = 3.2;
      targetCamZ = 16.5;
    } else {
      const slowDrift = this.#reducedMotion ? 0 : Math.sin(elapsed * 0.16) * 1.4;
      targetCamX = slowDrift;
      targetCamY = 7.2;
      targetCamZ = 21.5;
    }

    targetCamX += this.#pointerX * 1.2;
    targetCamY += -this.#pointerY * 0.65;

    this.#camera.position.x += (targetCamX - this.#camera.position.x) * Math.min(1, dt * 4);
    this.#camera.position.y += (targetCamY - this.#camera.position.y) * Math.min(1, dt * 4);
    this.#camera.position.z += (targetCamZ - this.#camera.position.z) * Math.min(1, dt * 4);
    this.#camera.lookAt(0, 0.2, 0);

    if (!this.#reducedMotion) {
      const sweepSpeed = this.#isPlaying ? 1.25 : 0.35;
      this.#scannerBeam.rotation.y -= dt * sweepSpeed;
      this.#holoGlobeGroup.rotation.y = elapsed * (this.#isPlaying ? 0.28 : 0.1);
    }

    const orbitAngle = this.#progress * Math.PI * 2 + (this.#reducedMotion ? 0 : elapsed * 0.08);
    this.#satMarker.position.set(
      Math.cos(orbitAngle) * 12.8,
      1.4 + Math.sin(orbitAngle) * 2.4,
      Math.sin(orbitAngle) * 7.8,
    );
    this.#satMarker.rotation.y = -orbitAngle;

    this.#renderer.render(this.#scene, this.#camera);
  };

  destroy() {
    cancelAnimationFrame(this.#rafId);
    window.removeEventListener('resize', this.#handleResize);
    window.removeEventListener('pointermove', this.#handlePointerMove);
    this.#renderer.dispose();
  }
}
