import * as THREE from "three";
import ROUTE from "./ski-route.json";
import { SUMMIT_ARRIVE, SUMMIT_LEAVE, SEGMENTS, segmentAt, zoomAt } from "./ski-timeline";

/**
 * The realistic ski run, as a plain class (kept out of React state).
 * Everything is a function of scroll progress `p` (so scrolling back rewinds), plus smoothing:
 *  - route: summit → descent (S-turns, jump) → chairlift → next summit … (data from blender/build_ski_run.py)
 *  - an articulated skier: joint rotations blend between poses (stand, carve, tuck, sit, skate)
 *  - camera: high bird's-eye while travelling; dives to a close-up at each summit; wide shot at the end
 *  - terrain shader (aerial snow + tri-planar rock), instanced forests, snow spray, tracks, snowfall
 */

const v3 = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);
const SUMMITS = ROUTE.summits.map(v3);
const DESC = ROUTE.descents.map((d) => d.map(v3));
const LIFTS = ROUTE.lifts.map((l) => l.map(v3));
const [JUMP_A, JUMP_B] = ROUTE.jump as [number, number];

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt);

function along(pts: THREE.Vector3[], f: number, out: THREE.Vector3) {
  const x = clamp01(f) * (pts.length - 1);
  const i = Math.min(Math.floor(x), pts.length - 2);
  return out.copy(pts[i]).lerp(pts[i + 1], x - i);
}
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
/** Yaw (three.js, model facing -Z) of travel along a polyline at f. */
function yawAlong(pts: THREE.Vector3[], f: number) {
  const e = 1.2 / (pts.length - 1);
  along(pts, f - e, _a);
  along(pts, f + e, _b);
  return Math.atan2(-(_b.x - _a.x), -(_b.z - _a.z));
}
const yawTo = (from: THREE.Vector3, to: THREE.Vector3) => Math.atan2(-(to.x - from.x), -(to.z - from.z));
const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// ── Poses: joint → euler (three.js axes; built from the Blender pose angles) ──
type Pose = Record<string, [number, number, number]>;
const J_NAMES = [
  "Pelvis", "Spine", "Neck", "Head",
  "ShoulderL", "ShoulderR", "ElbowL", "ElbowR", "WristL", "WristR", "PoleL", "PoleR",
  "HipL", "HipR", "KneeL", "KneeR", "AnkleL", "AnkleR",
] as const;
const deg = THREE.MathUtils.degToRad;

/**
 * Carving technique. turn: -1..1 (+ = turning LEFT, i.e. yaw increasing), lean: whole-body inclination
 * already applied to the root, c: extra flex, reachL/R: pole-plant swing of each arm (0..1).
 *  - legs incline with the body, but the upper body stays quiet and level (angulation)
 *  - the upper body counter-rotates to face down the hill; the head stays steady
 *  - the inside leg flexes more, knees drive into the turn, ankles roll the skis onto their edges
 *  - sink through the turn, rise between turns (c), pole plant on the new inside at each turn start
 */
function carvePose(turn: number, lean: number, c: number, reachL: number, reachR: number): Pose {
  const f = 1 + c;
  const inL = Math.max(turn, 0); // left turn → left leg is the inside leg
  const inR = Math.max(-turn, 0);
  return {
    Pelvis: [0, turn * 0.12, 0],
    Spine: [-0.42 * f, -turn * 0.38, -lean * 0.75],
    Neck: [0.24 * f, turn * 0.3, lean * 0.25],
    HipL: [0.62 * f + inL * 0.35, 0, lean * 0.35], HipR: [0.62 * f + inR * 0.35, 0, lean * 0.35],
    KneeL: [-0.95 * f - inL * 0.45, 0, 0], KneeR: [-0.95 * f - inR * 0.45, 0, 0],
    AnkleL: [0.33 * f + inL * 0.1, 0, lean * 0.3], AnkleR: [0.33 * f + inR * 0.1, 0, lean * 0.3],
    ShoulderL: [0.6 + reachL * 0.65, deg(-16), 0], ShoulderR: [0.6 + reachR * 0.65, deg(16), 0],
    ElbowL: [0.85 - reachL * 0.35, 0, 0], ElbowR: [0.85 - reachR * 0.35, 0, 0],
    PoleL: [-1.5 + reachL * 1.15, 0, 0], PoleR: [-1.5 + reachR * 1.15, 0, 0],
  };
}
const STAND = (look: number): Pose => ({
  Spine: [-0.08, 0, 0], Neck: [0.05, look, 0],
  HipL: [0.18, 0, 0], HipR: [0.18, 0, 0], KneeL: [-0.32, 0, 0], KneeR: [-0.32, 0, 0],
  AnkleL: [0.14, 0, 0], AnkleR: [0.14, 0, 0],
  ShoulderL: [0.22, deg(-10), 0], ShoulderR: [0.22, deg(10), 0], ElbowL: [0.5, 0, 0], ElbowR: [0.5, 0, 0],
  PoleL: [-1.15, 0, 0], PoleR: [-1.15, 0, 0],
});
const TUCK: Pose = {
  Spine: [-0.95, 0, 0], Neck: [0.75, 0, 0],
  HipL: [1.2, 0, 0], HipR: [1.2, 0, 0], KneeL: [-1.75, 0, 0], KneeR: [-1.75, 0, 0],
  AnkleL: [0.55, 0, 0], AnkleR: [0.55, 0, 0],
  ShoulderL: [1.05, deg(-8), 0], ShoulderR: [1.05, deg(8), 0], ElbowL: [1.1, 0, 0], ElbowR: [1.1, 0, 0],
  PoleL: [-1.75, 0, 0], PoleR: [-1.75, 0, 0],
};
const SIT = (look: number): Pose => ({
  Spine: [0.05, 0, 0], Neck: [0, look, 0],
  HipL: [1.5, 0, 0], HipR: [1.5, 0, 0], KneeL: [-1.35, 0, 0], KneeR: [-1.35, 0, 0],
  AnkleL: [0.1, 0, 0], AnkleR: [0.1, 0, 0],
  ShoulderL: [0.25, deg(-8), 0], ShoulderR: [0.25, deg(8), 0], ElbowL: [0.9, 0, 0], ElbowR: [0.9, 0, 0],
  PoleL: [-1.2, 0, 0], PoleR: [-1.2, 0, 0],
});
const SKATE = (phase: number): Pose => {
  const s = Math.sin(phase);
  return {
    Spine: [-0.32, 0, 0], Neck: [0.25, 0, 0],
    HipL: [0.55 + 0.25 * s, 0, 0.12 * Math.max(-s, 0)], HipR: [0.55 - 0.25 * s, 0, -0.12 * Math.max(s, 0)],
    KneeL: [-0.8 - 0.2 * s, 0, 0], KneeR: [-0.8 + 0.2 * s, 0, 0],
    AnkleL: [0.3, 0, 0], AnkleR: [0.3, 0, 0],
    ShoulderL: [0.5 + 0.5 * s, deg(-12), 0], ShoulderR: [0.5 - 0.5 * s, deg(12), 0],
    ElbowL: [0.6, 0, 0], ElbowR: [0.6, 0, 0], PoleL: [-1.6 + 0.4 * s, 0, 0], PoleR: [-1.6 - 0.4 * s, 0, 0],
  };
};

/** Going back up a piste: herringbone / skating climb — skis in a V, alternate legs step, poles push. */
const CLIMB = (phase: number): Pose => {
  const s = Math.sin(phase);
  const l = Math.max(s, 0);
  const r = Math.max(-s, 0);
  return {
    Spine: [-0.38, 0, 0], Neck: [0.32, 0, 0],
    HipL: [0.45 + 0.5 * l, 0.3, 0], HipR: [0.45 + 0.5 * r, -0.3, 0],
    KneeL: [-0.6 - 0.65 * l, 0, 0], KneeR: [-0.6 - 0.65 * r, 0, 0],
    AnkleL: [0.25 + 0.15 * l, 0, 0], AnkleR: [0.25 + 0.15 * r, 0, 0],
    ShoulderL: [0.45 + 0.6 * r, deg(-14), 0], ShoulderR: [0.45 + 0.6 * l, deg(14), 0],
    ElbowL: [0.7, 0, 0], ElbowR: [0.7, 0, 0],
    PoleL: [-1.3 + 0.55 * r, 0, 0], PoleR: [-1.3 + 0.55 * l, 0, 0],
  };
};

const SNOW_COUNT = 1400;
const LENS_COUNT = 40;
const LENS_RANGE = 22; // only throw powder at the lens when the camera is this close (m)
const MAX_SPLATS_PER_BURST = 6;
const SPRAY_COUNT = 400;
const UP = new THREE.Vector3(0, 1, 0);

export type TreeData = { variants: string[]; trees: number[][] };

export class SkiRunSim {
  root = new THREE.Group();
  private skier?: THREE.Object3D;
  private joints = new Map<string, THREE.Object3D>();
  private pelvisRestY = 1.08;
  private chair?: THREE.Object3D;
  private camera?: THREE.Camera;
  private sun = new THREE.DirectionalLight("#fff4e6", 2.4);
  private ring!: THREE.Mesh;
  private snow!: THREE.Points;
  private spray!: THREE.Points;
  private sprayVel = new Float32Array(SPRAY_COUNT * 3);
  private sprayLife = new Float32Array(SPRAY_COUNT);
  private sprayNext = 0;
  private tracks: THREE.Mesh[] = [];
  private arrival: THREE.Vector3[] = [];

  private lastP = 0;
  /** Travelling back (scrolled up): the skier turns round and goes that way. Hysteresis via revAcc. */
  private rev = false;
  private revAcc = 0;
  private climbPhase = 0;
  private smoothP = 0;
  private yaw = 0;
  private roll = 0;
  private pitch = 0;
  private skatePhase = 0;
  private reachL = 0;
  private reachR = 0;
  private lastTurnSign = 0;
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private pos = new THREE.Vector3();
  private snapNext = true;
  // coarse terrain height grid (max height per 4 m cell) for camera collision
  private hm: Float32Array | null = null;
  private hmBox = { x0: 0, z0: 0, nx: 0, nz: 0, cell: 4 };
  // exact ground: the terrain is a regular 2 m grid, so heights per grid vertex + bilinear = the real surface
  private surf: Float32Array | null = null;
  private surfBox = { x0: 0, z0: 0, nx: 0, nz: 0, cell: 2 };
  private skiL?: THREE.Object3D;
  private skiR?: THREE.Object3D;
  private contactOffset = 0;

  // snow on the lens
  private onSplat: ((ndcX: number, ndcY: number, sizePx: number) => void) | null = null;
  setSplatHandler(fn: ((ndcX: number, ndcY: number, sizePx: number) => void) | null) {
    this.onSplat = fn;
  }
  private lens!: THREE.Points;
  private lensVel = new Float32Array(LENS_COUNT * 3);
  private lensLive = new Uint8Array(LENS_COUNT);
  private lensHits = 0;
  private lastSeg = -1;
  private lastU = 0;
  private firedArrive = -1;

  // ── setup ────────────────────────────────────────────────────────────────
  attach(scene: THREE.Object3D, camera: THREE.Camera, tex: { snow: THREE.Texture; rock: THREE.Texture }, reduced: boolean) {
    this.dispose();
    this.root.clear();
    this.camera = camera;
    this.snapNext = true;

    const terrain = scene.getObjectByName("Terrain") as THREE.Mesh | undefined;
    if (terrain) {
      terrain.material = terrainMaterial(tex.snow, tex.rock);
      terrain.receiveShadow = true;
      this.buildHeightmap(terrain);
    }
    for (const name of ["Kicker", "Lift_1", "Lift_2"]) {
      scene.getObjectByName(name)?.traverse((o) => {
        o.receiveShadow = true;
      });
    }

    this.skier = scene.getObjectByName("Skier") ?? undefined;
    this.skier?.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    for (const n of J_NAMES) {
      const j = scene.getObjectByName(n);
      if (j) this.joints.set(n, j);
    }
    this.skiL = scene.getObjectByName("SkiL") ?? undefined;
    this.skiR = scene.getObjectByName("SkiR") ?? undefined;
    const pelvis = this.joints.get("Pelvis");
    if (pelvis) {
      pelvis.userData.restY ??= pelvis.position.y; // survive re-attach (Strict Mode / HMR)
      this.pelvisRestY = pelvis.userData.restY as number;
    }

    const tpl = scene.getObjectByName("Chair");
    if (tpl) {
      tpl.visible = false;
      this.chair = tpl.clone();
      this.chair.visible = true;
      this.root.add(this.chair);
    }

    // Where the skier steps off each lift (the ground beside the top station)
    const ray = new THREE.Raycaster();
    this.arrival = LIFTS.map((line) => {
      const end = line[line.length - 1].clone();
      if (terrain) {
        ray.set(new THREE.Vector3(end.x, end.y + 60, end.z), new THREE.Vector3(0, -1, 0));
        const hit = ray.intersectObject(terrain, false)[0];
        if (hit) return hit.point.clone();
      }
      return end.setY(end.y - 5);
    });

    // Sun follows the skier so it always has a crisp shadow
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -14;
    sc.right = sc.top = 14;
    sc.near = 1;
    sc.far = 140;
    this.sun.shadow.bias = -0.0005;
    this.root.add(this.sun, this.sun.target);

    this.root.add(this.buildRing(), this.buildSpray(), this.buildSnow(reduced), this.buildLens(), ...this.buildTracks());
  }

  private buildHeightmap(terrain: THREE.Mesh) {
    terrain.updateWorldMatrix(true, false);
    const g = terrain.geometry;
    g.computeBoundingBox();
    const bb = g.boundingBox!.clone().applyMatrix4(terrain.matrixWorld);
    const cell = 4;
    const nx = Math.ceil((bb.max.x - bb.min.x) / cell) + 1;
    const nz = Math.ceil((bb.max.z - bb.min.z) / cell) + 1;
    const hm = new Float32Array(nx * nz).fill(-1e9);
    const posAttr = g.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i).applyMatrix4(terrain.matrixWorld);
      const cx = Math.round((v.x - bb.min.x) / cell);
      const cz = Math.round((v.z - bb.min.z) / cell);
      const k = cz * nx + cx;
      if (v.y > hm[k]) hm[k] = v.y;
    }
    for (let k = 0; k < hm.length; k++) if (hm[k] < -1e8) hm[k] = hm[Math.max(0, k - 1)];
    this.hm = hm;
    this.hmBox = { x0: bb.min.x, z0: bb.min.z, nx, nz, cell };

    const c2 = 2;
    const sx = Math.round((bb.max.x - bb.min.x) / c2) + 1;
    const sz = Math.round((bb.max.z - bb.min.z) / c2) + 1;
    const surf = new Float32Array(sx * sz).fill(NaN);
    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i).applyMatrix4(terrain.matrixWorld);
      const ix = Math.round((v.x - bb.min.x) / c2);
      const iz = Math.round((v.z - bb.min.z) / c2);
      if (ix >= 0 && iz >= 0 && ix < sx && iz < sz) surf[iz * sx + ix] = v.y;
    }
    for (let k = 0; k < surf.length; k++) if (Number.isNaN(surf[k])) surf[k] = surf[Math.max(0, k - 1)] || 0;
    this.surf = surf;
    this.surfBox = { x0: bb.min.x, z0: bb.min.z, nx: sx, nz: sz, cell: c2 };
  }

  /** Height of the snow surface at (x, z) — bilinear over the terrain's own grid. */
  surfaceAt(x: number, z: number) {
    const { x0, z0, nx, nz, cell } = this.surfBox;
    if (!this.surf) return -1e9;
    const fx = Math.min(Math.max((x - x0) / cell, 0), nx - 1.001);
    const fz = Math.min(Math.max((z - z0) / cell, 0), nz - 1.001);
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const tx = fx - ix;
    const tz = fz - iz;
    const h = this.surf;
    const a = h[iz * nx + ix];
    const b = h[iz * nx + ix + 1];
    const c = h[(iz + 1) * nx + ix];
    const d = h[(iz + 1) * nx + ix + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }

  private groundAt(x: number, z: number) {
    const { x0, z0, nx, nz, cell } = this.hmBox;
    if (!this.hm) return -1e9;
    const cx = Math.round((x - x0) / cell);
    const cz = Math.round((z - z0) / cell);
    if (cx < 0 || cz < 0 || cx >= nx || cz >= nz) return -1e9;
    let h = -1e9; // max of the cell and its neighbours = safe clearance
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const ix = Math.min(Math.max(cx + dx, 0), nx - 1);
        const iz = Math.min(Math.max(cz + dz, 0), nz - 1);
        h = Math.max(h, this.hm[iz * nx + ix]);
      }
    return h;
  }

  addTrees(scene: THREE.Object3D, data: TreeData) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    data.variants.forEach((name, vi) => {
      const node = scene.getObjectByName(name);
      if (!node) return;
      node.visible = false;
      const list = data.trees.filter((t) => t[5] === vi);
      const meshes: THREE.Mesh[] = [];
      node.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
      });
      for (const mesh of meshes) {
        const inst = new THREE.InstancedMesh(mesh.geometry, mesh.material, list.length);
        list.forEach(([x, y, z, rot, sc], k) => {
          m.compose(p.set(x, y, z), q.setFromAxisAngle(UP, rot), s.set(sc, sc, sc));
          inst.setMatrixAt(k, m);
        });
        inst.instanceMatrix.needsUpdate = true;
        inst.computeBoundingSphere();
        this.root.add(inst);
      }
    });
  }

  private buildRing() {
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(1.5, 2.1, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: "#FF8A4C", transparent: true, opacity: 0.9, depthWrite: false }),
    );
    this.ring.renderOrder = 2;
    return this.ring;
  }

  private buildSpray() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SPRAY_COUNT * 3).fill(-9999), 3));
    this.spray = new THREE.Points(
      g,
      new THREE.PointsMaterial({ color: "#FFFFFF", size: 0.12, transparent: true, opacity: 0.95, depthWrite: false }),
    );
    this.spray.frustumCulled = false;
    return this.spray;
  }

  /** Big powder chunks thrown at the camera on skid stops / landings. */
  private buildLens() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(LENS_COUNT * 3).fill(-9999), 3));
    this.lens = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        color: "#FFFFFF",
        size: 0.32,
        map: flakeTexture(),
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      }),
    );
    this.lens.frustumCulled = false;
    return this.lens;
  }

  /** Throw a burst of powder from the skier toward the lens (only when the camera is close). */
  private lensBurst(n: number) {
    const cam = this.camera;
    if (!cam || this.camPos.distanceTo(this.pos) > LENS_RANGE) return;
    const arr = (this.lens.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const camDir = cam.getWorldDirection(new THREE.Vector3());
    const right = new THREE.Vector3().crossVectors(camDir, UP).normalize();
    const up = new THREE.Vector3().crossVectors(right, camDir).normalize();
    this.lensHits = 0;
    for (let j = 0, i = 0; i < LENS_COUNT && j < n; i++) {
      if (this.lensLive[i]) continue;
      j++;
      this.lensLive[i] = 1;
      const start = new THREE.Vector3(
        this.pos.x + (Math.random() - 0.5) * 0.8,
        this.pos.y + 0.3 + Math.random() * 0.5,
        this.pos.z + (Math.random() - 0.5) * 0.8,
      );
      // aim at a random spot just in front of the lens, inside the visible frame
      const target = cam.position
        .clone()
        .addScaledVector(camDir, 0.7)
        .addScaledVector(right, (Math.random() - 0.5) * 0.42)
        .addScaledVector(up, (Math.random() - 0.5) * 0.26);
      const speed = 12 + Math.random() * 8;
      const v = target.sub(start).normalize().multiplyScalar(speed);
      arr[i * 3] = start.x;
      arr[i * 3 + 1] = start.y;
      arr[i * 3 + 2] = start.z;
      this.lensVel[i * 3] = v.x;
      this.lensVel[i * 3 + 1] = v.y;
      this.lensVel[i * 3 + 2] = v.z;
    }
  }

  private stepLens(dt: number) {
    const cam = this.camera;
    if (!cam) return;
    const attr = this.lens.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const camDir = cam.getWorldDirection(new THREE.Vector3());
    const p = new THREE.Vector3();
    for (let i = 0; i < LENS_COUNT; i++) {
      if (!this.lensLive[i]) continue;
      this.lensVel[i * 3 + 1] -= 0.6 * dt; // barely any drop: they're flying straight at you
      arr[i * 3] += this.lensVel[i * 3] * dt;
      arr[i * 3 + 1] += this.lensVel[i * 3 + 1] * dt;
      arr[i * 3 + 2] += this.lensVel[i * 3 + 2] * dt;
      p.set(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]);
      const rel = p.clone().sub(cam.position);
      const ahead = rel.dot(camDir);
      if (ahead < 0.9) {
        // reached the lens: leave a clump where it hit (if it's in view and we haven't overdone it)
        const ndc = p.clone().project(cam);
        if (ahead > -0.5 && this.lensHits < MAX_SPLATS_PER_BURST && Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1) {
          this.lensHits++;
          this.onSplat?.(ndc.x, ndc.y, 90 + Math.random() * 130);
        }
        this.lensLive[i] = 0;
        arr[i * 3 + 1] = -9999;
      } else if (rel.length() > 60) {
        this.lensLive[i] = 0;
        arr[i * 3 + 1] = -9999;
      }
    }
    attr.needsUpdate = true;
  }

  private buildSnow(reduced: boolean) {
    const a = new Float32Array(SNOW_COUNT * 3);
    for (let i = 0; i < SNOW_COUNT; i++) {
      a[i * 3] = (Math.random() - 0.5) * 90;
      a[i * 3 + 1] = (Math.random() - 0.5) * 70;
      a[i * 3 + 2] = (Math.random() - 0.5) * 90;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(a, 3));
    this.snow = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        color: "#FFFFFF",
        size: 4.5,
        sizeAttenuation: false, // flakes stay visible from the high camera
        map: flakeTexture(),
        alphaTest: 0.02,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    this.snow.visible = !reduced;
    this.snow.frustumCulled = false;
    return this.snow;
  }

  private buildTracks() {
    return DESC.map((pts, di) => {
      const pos: number[] = [];
      const side = new THREE.Vector3();
      for (let i = 0; i < pts.length - 1; i++) {
        const f0 = i / (pts.length - 1);
        const air = di === 0 && f0 > JUMP_A - 0.005 && f0 < JUMP_B;
        for (const off of [-0.17, 0.17]) {
          const quad = [0, 1].flatMap((k) => {
            const p = pts[i + k];
            const yaw = yawAlong(pts, (i + k) / (pts.length - 1));
            side.set(Math.cos(yaw), 0, -Math.sin(yaw));
            return [-0.05, 0.05].map((e) => {
              const q = p.clone().addScaledVector(side, off + e);
              return q.setY(air ? q.y - 5 : this.surfaceAt(q.x, q.z) + 0.025);
            });
          });
          for (const k of [0, 2, 3, 0, 3, 1]) pos.push(quad[k].x, quad[k].y, quad[k].z);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setDrawRange(0, 0);
      const mesh = new THREE.Mesh(
        g,
        new THREE.MeshBasicMaterial({ color: "#C5D3E2", transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }),
      );
      mesh.frustumCulled = false;
      this.tracks.push(mesh);
      return mesh;
    });
  }

  // ── per frame ────────────────────────────────────────────────────────────
  update(target: number, dt: number, t: number) {
    const skier = this.skier;
    const cam = this.camera;
    if (!skier || !cam) return;
    const snap = this.snapNext;
    this.snapNext = false;
    // the run eases toward where you scrolled, so the skier glides instead of jumping
    this.smoothP += (target - this.smoothP) * (snap ? 1 : damp(1.15, dt));
    const p = this.smoothP;
    const dp = p - this.lastP;
    this.lastP = p;
    const { index, seg, t: u } = segmentAt(p);
    // which way are we really travelling? (needs a little sustained movement to turn round, so jitter can't flip it)
    if (snap) this.revAcc = 0;
    this.revAcc = Math.min(Math.max(this.revAcc + dp, -0.002), 0.002);
    if (this.revAcc <= -0.0015) this.rev = true;
    else if (this.revAcc >= 0.0015) this.rev = false;
    const rev = this.rev;
    const BACK = Math.PI;

    let pose: Pose = STAND(0);
    let seated = false;
    let tucked = false;
    let carveRoll = 0;
    let travelYaw = this.yaw;
    let pitch = 0;
    let ramp = 0; // extra ground height while riding up the kicker
    let chairPos: THREE.Vector3 | null = null;
    let chairYaw = 0;
    const pos = this.pos;
    const skate = () => SKATE((this.skatePhase += Math.abs(dp) * 260));

    // ── where is the skier, and what is it doing? ──
    if (seg.kind === "intro" || seg.kind === "summit" || seg.kind === "end") {
      const i = seg.i;
      const S = SUMMITS[i];
      const from = seg.kind === "summit" && i > 0 ? this.arrival[i - 1] : S;
      const to = i < DESC.length ? DESC[i][0] : S;
      if (seg.kind === "summit" && u < SUMMIT_ARRIVE && i > 0) {
        pos.copy(from).lerp(S, smooth(u / SUMMIT_ARRIVE));
        travelYaw = rev ? yawTo(S, from) : yawTo(from, S); // backing off the summit toward the lift
        pose = skate();
      } else if (seg.kind === "summit" && u > SUMMIT_LEAVE && i < DESC.length) {
        pos.copy(S).lerp(to, smooth((u - SUMMIT_LEAVE) / (1 - SUMMIT_LEAVE)));
        travelYaw = rev ? yawTo(to, S) : yawTo(S, to); // climbing back onto the summit
        pose = skate();
      } else {
        pos.copy(S);
        // at the top: face down the next run (on the last summit, back over the range you came from)
        // going back: turn toward the lift you came up (you'll ride it down)
        travelYaw =
          rev && seg.kind === "summit" && i > 0 ? yawTo(S, from) : i < DESC.length ? yawTo(S, to) : yawTo(S, SUMMITS[1]);
        pose = STAND(Math.sin(t * 0.6) * 0.5);
      }
    } else if (seg.kind === "descent") {
      const pts = DESC[seg.i];
      along(pts, u, pos);
      travelYaw = yawAlong(pts, u);
      along(pts, u - 0.006, _a);
      along(pts, u + 0.006, _b);
      pitch = Math.atan2(_b.y - _a.y, Math.hypot(_b.x - _a.x, _b.z - _a.z));
      if (rev) {
        // heading back up the piste: face uphill and herringbone/skate up it (no carving, no jump)
        travelYaw += BACK;
        pitch = -pitch;
        pose = CLIMB((this.climbPhase += Math.abs(dp) * 1500));
        if (seg.i === 0 && u > JUMP_A - 0.024 && u <= JUMP_A) {
          ramp = 1.3 * ((u - (JUMP_A - 0.024)) / 0.024); // walk back up over the kicker
          pitch = -0.35;
        }
      } else {
        // curvature (+ = turning left) → lean INTO the turn; each new turn → pole plant on the new inside hand
        const curv = angleDiff(yawAlong(pts, u + 0.02), yawAlong(pts, u - 0.02));
        const turn = Math.max(-1, Math.min(1, curv * 2.4));
        carveRoll = turn * 0.72;
        const sign = Math.abs(turn) > 0.18 ? Math.sign(turn) : 0;
        if (sign !== 0 && sign !== this.lastTurnSign && dp !== 0) {
          if (sign > 0) this.reachL = 1;
          else this.reachR = 1;
          this.lastTurnSign = sign;
        }
        this.reachL *= Math.exp(-2.8 * dt);
        this.reachR *= Math.exp(-2.8 * dt);
        // sink through the turn, rise (unweight) through the transition
        pose = carvePose(turn, this.roll, 0.02 + 0.38 * Math.abs(turn), this.reachL, this.reachR);
        // ride up the kicker's 1.3 m ramp just before the lip
        const RAMP = 0.024;
        if (seg.i === 0 && u > JUMP_A - RAMP && u <= JUMP_A) {
          ramp = 1.3 * ((u - (JUMP_A - RAMP)) / RAMP);
          pitch = 0.35;
        }
        if (seg.i === 0 && u > JUMP_A - 0.03 && u < JUMP_B + 0.02) {
          // the career-switch jump: crouch on the kicker, arc through the air in a tuck, absorb the landing
          const ja = (u - JUMP_A) / (JUMP_B - JUMP_A);
          if (ja > 0 && ja < 1) {
            const ya = along(pts, JUMP_A, _a).y + 1.3;
            const yb = along(pts, JUMP_B, _b).y;
            pos.y = Math.max(pos.y, ya + (yb - ya) * ja + 6 * ja * (1 - ja));
            pose = TUCK;
            tucked = true;
            carveRoll = 0;
            pitch = -0.15 + 0.3 * ja;
          } else pose = carvePose(0, 0, 0.55, 0, 0);
        }
      }
    } else if (seg.kind === "lift") {
      const line = LIFTS[seg.i];
      const base = DESC[seg.i][DESC[seg.i].length - 1];
      const board = 0.08;
      const unload = 0.9;
      const k = clamp01((u - board) / (unload - board));
      chairPos = along(line, k, new THREE.Vector3());
      chairYaw = yawAlong(line, Math.min(Math.max(k, 0.02), 0.98));
      const seat = chairPos.clone().add(new THREE.Vector3(0, -2.26 + 0.1 - this.pelvisRestY, 0));
      if (rev) chairYaw += BACK; // the chair comes back down the line facing the valley
      travelYaw = chairYaw;
      if (u < board) {
        pos.copy(base).lerp(seat, smooth(u / board));
        seated = u >= board * 0.6;
        pose = seated ? SIT(0) : skate();
      } else if (u > unload) {
        const kk = smooth((u - unload) / (1 - unload));
        pos.copy(seat).lerp(this.arrival[seg.i], kk);
        seated = kk < 0.4;
        pose = seated ? SIT(0) : STAND(0);
      } else {
        pos.copy(seat);
        seated = true;
        pose = SIT(Math.sin(t * 0.5) * 0.6);
      }
    }

    // ── apply transform + pose (smoothed) ──
    const kPose = snap ? 1 : damp(6, dt);
    this.yaw += angleDiff(travelYaw, this.yaw) * (snap ? 1 : damp(5, dt));
    this.roll += (carveRoll - this.roll) * (snap ? 1 : damp(4.5, dt));
    for (const [name, j] of this.joints) {
      const target = pose[name] ?? [0, 0, 0];
      j.rotation.x += (target[0] - j.rotation.x) * kPose;
      j.rotation.y += (target[1] - j.rotation.y) * kPose;
      j.rotation.z += (target[2] - j.rotation.z) * kPose;
    }
    // keep the skis on the snow: bent legs lower the hips (simple FK on the left leg)
    const pelvis = this.joints.get("Pelvis");
    if (pelvis) {
      const th = this.joints.get("HipL")?.rotation.x ?? 0;
      const sh = th + (this.joints.get("KneeL")?.rotation.x ?? 0);
      const drop = seated ? 0 : 0.44 * (1 - Math.cos(th)) + 0.42 * (1 - Math.cos(sh));
      pelvis.position.y = this.pelvisRestY - drop;
    }
    this.pitch += (pitch - this.pitch) * (snap ? 1 : damp(6, dt));
    skier.position.copy(pos);
    skier.rotation.set(this.pitch, this.yaw, this.roll, "YXZ");
    // the body stays balanced over the skis instead of tipping with the slope
    const spine = this.joints.get("Spine");
    if (spine && !seated) spine.rotation.x -= this.pitch * 0.55;

    // Ski–snow contact: measure where both skis really are after posing, and rest them ON the snow
    if (!seated && !tucked && this.skiL && this.skiR && this.surf) {
      skier.updateMatrixWorld(true);
      const pl = this.skiL.getWorldPosition(_a);
      const gl = this.surfaceAt(pl.x, pl.z);
      const yl = pl.y;
      const pr = this.skiR.getWorldPosition(_b);
      const gr = this.surfaceAt(pr.x, pr.z);
      const yr = pr.y;
      // ski centre sits 1.1 cm above its base; edged skis dip by roughly half their width
      const clear = 0.016 + Math.abs(this.roll) * 0.05;
      const want = Math.max(gl + ramp + clear - yl, gr + ramp + clear - yr);
      this.contactOffset += (want - this.contactOffset) * (snap ? 1 : damp(14, dt));
      skier.position.y += this.contactOffset;
      pos.y = skier.position.y;
    } else if (tucked) {
      this.contactOffset *= Math.exp(-6 * dt);
    }

    if (this.chair) {
      this.chair.visible = !!chairPos;
      if (chairPos) {
        this.chair.position.copy(chairPos);
        this.chair.rotation.set(0, chairYaw, 0);
      }
    }

    // ── camera: high & following → dive in at summits → wide at the end ──
    const zoom = zoomAt(seg.kind, u);
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const side = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const want = pos.clone().addScaledVector(fwd, -14).addScaledVector(side, 4).add(new THREE.Vector3(0, 10, 0));
    const look = pos.clone().addScaledVector(fwd, 2).add(new THREE.Vector3(0, 0.9, 0)); // keep the skier centred
    const close = pos.clone().addScaledVector(side, 3.3).addScaledVector(fwd, 1.6).add(new THREE.Vector3(0, 1.65, 0));
    want.lerp(close, zoom);
    look.lerp(pos.clone().add(new THREE.Vector3(0, 1.2, 0)), zoom);
    if (seg.kind === "end") {
      // pull back behind the skier on the top summit, looking out over the range you skied
      const w = smooth(u / 0.7);
      want.lerp(pos.clone().addScaledVector(fwd, -24).add(new THREE.Vector3(0, 14, 0)), w);
      look.lerp(pos.clone().addScaledVector(fwd, 90).add(new THREE.Vector3(0, -25, 0)), w);
    }
    // never let the camera dip into the mountain
    want.y = Math.max(want.y, this.groundAt(want.x, want.z) + (zoom > 0.5 ? 1.2 : 3.5));
    // position eases (cinematic), but the aim tracks the skier tightly so it never drifts out of frame
    this.camPos.lerp(want, snap ? 1 : damp(zoom > 0.02 ? 3.5 : 2.6, dt));
    this.camLook.lerp(look, snap ? 1 : damp(9, dt));
    cam.position.copy(this.camPos);
    cam.lookAt(this.camLook);

    // sun + shadow follow the skier
    this.sun.position.copy(pos).add(new THREE.Vector3(-30, 55, 25));
    this.sun.target.position.copy(pos);

    // orange marker so the tiny skier is easy to spot from high up
    this.ring.position.set(pos.x, pos.y + 0.15, pos.z);
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - zoom) * (seated ? 0 : 1);
    this.ring.scale.setScalar(1 + 0.12 * Math.sin(t * 3));

    // tracks: finished descents stay; the current one grows (and rewinds) with the skier
    this.tracks.forEach((mesh, di) => {
      const segIdx = SEGMENTS.findIndex((s) => s.kind === "descent" && s.i === di);
      const verts = (mesh.geometry.attributes.position as THREE.BufferAttribute).count;
      const f = index > segIdx ? 1 : index < segIdx ? 0 : u;
      mesh.geometry.setDrawRange(0, Math.floor((f * verts) / 12) * 12);
    });

    // snow spray off the edges while carving forward, and a burst when stopping at a summit
    if (seg.kind === "descent" && dp > 0 && !tucked) {
      this.emit(2, 0.7); // the skis always kick up a little powder
      const edge = Math.floor(Math.abs(this.roll) * 12 + dp * 2500);
      if (edge > 0) this.emit(Math.min(8, edge), 2.2);
    }
    if (seg.kind === "summit" && dp > 0 && u > SUMMIT_ARRIVE - 0.02 && u < SUMMIT_ARRIVE + 0.01) {
      this.emit(20, 3);
      if (this.firedArrive !== index && seg.i > 0) {
        this.firedArrive = index;
        this.lensBurst(26); // skid stop sprays the camera
      }
    }
    if (seg.kind !== "summit") this.firedArrive = -1;
    const landed = seg.kind === "descent" && seg.i === 0 && index === this.lastSeg && this.lastU < JUMP_B && u >= JUMP_B;
    if (landed && dp > 0) {
      this.emit(30, 3.2);
      this.lensBurst(22); // landing throws powder at the lens
    }
    // rewinding: the skis still brush the snow (lighter), but nothing gets thrown at the lens
    if (seg.kind === "descent" && dp < 0 && Math.random() < 0.3) this.emit(1, 0.4); // climbing kicks a little snow
    this.lastSeg = index;
    this.lastU = u;
    this.stepSpray(dt);
    this.stepLens(dt);

    // snowfall: a box of flakes that travels with the camera (so there is always snow in front of you)
    if (this.snow.visible) {
      this.snow.position.copy(this.camPos).lerp(pos, 0.35);
      const attr = this.snow.geometry.attributes.position as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < SNOW_COUNT; i++) {
        arr[i * 3 + 1] -= dt * (1.4 + (i % 9) * 0.15);
        arr[i * 3] += Math.sin(t * 0.5 + i) * dt * 0.6;
        if (arr[i * 3 + 1] < -35) arr[i * 3 + 1] = 35;
      }
      attr.needsUpdate = true;
    }
  }

  private emit(n: number, power: number) {
    const arr = (this.spray.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const back = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const side = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).multiplyScalar(Math.sign(this.roll || 1));
    for (let j = 0; j < n; j++) {
      const i = this.sprayNext;
      this.sprayNext = (i + 1) % SPRAY_COUNT;
      arr[i * 3] = this.pos.x + back.x * 0.7 + (Math.random() - 0.5) * 0.5;
      arr[i * 3 + 1] = this.pos.y + 0.04;
      arr[i * 3 + 2] = this.pos.z + back.z * 0.7 + (Math.random() - 0.5) * 0.5;
      const spread = Math.random();
      this.sprayVel[i * 3] = (back.x * 0.5 + side.x * (0.6 + spread)) * power;
      this.sprayVel[i * 3 + 1] = (0.7 + Math.random()) * power;
      this.sprayVel[i * 3 + 2] = (back.z * 0.5 + side.z * (0.6 + spread)) * power;
      this.sprayLife[i] = 0.5 + Math.random() * 0.5;
    }
  }

  private stepSpray(dt: number) {
    const attr = this.spray.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < SPRAY_COUNT; i++) {
      if (this.sprayLife[i] <= 0) continue;
      this.sprayLife[i] -= dt;
      this.sprayVel[i * 3 + 1] -= 9.8 * dt;
      arr[i * 3] += this.sprayVel[i * 3] * dt;
      arr[i * 3 + 1] += this.sprayVel[i * 3 + 1] * dt;
      arr[i * 3 + 2] += this.sprayVel[i * 3 + 2] * dt;
      if (this.sprayLife[i] <= 0) arr[i * 3 + 1] = -9999;
    }
    attr.needsUpdate = true;
  }

  dispose() {
    for (const o of [this.ring, this.spray, this.snow, this.lens, ...this.tracks]) {
      o?.geometry.dispose();
      ((o?.material as THREE.PointsMaterial | undefined)?.map as THREE.Texture | null | undefined)?.dispose();
      (o?.material as THREE.Material | undefined)?.dispose();
    }
    this.tracks = [];
    this.root.traverse((o) => {
      if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
    });
  }
}

/** Soft round snowflake sprite (canvas-generated, no download). */
function flakeTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.45, "rgba(255,255,255,0.8)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Terrain: aerial snow from above, tri-planar rock on steep faces (mask R), brighter groomed pistes (mask G). */
function terrainMaterial(snow: THREE.Texture, rock: THREE.Texture) {
  const m = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.82, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uSnow = { value: snow };
    shader.uniforms.uRock = { value: rock };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec4 color;\nvarying vec4 vMask;\nvarying vec3 vWPos;\nvarying vec3 vWNormal;",
      )
      .replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvMask = color;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNormal = normalize(mat3(modelMatrix) * objectNormal);",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform sampler2D uSnow;\nuniform sampler2D uRock;\nvarying vec4 vMask;\nvarying vec3 vWPos;\nvarying vec3 vWNormal;",
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        vec3 snowC = texture2D(uSnow, vWPos.xz / 36.0).rgb;
        vec3 bw = abs(normalize(vWNormal)); bw = pow(bw, vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
        vec3 rockC = texture2D(uRock, vWPos.zy / 26.0).rgb * bw.x
                   + texture2D(uRock, vWPos.xz / 26.0).rgb * bw.y
                   + texture2D(uRock, vWPos.xy / 26.0).rgb * bw.z;
        // the aerial snow photo is a bluish grey (~0.53): lift it to fresh, bright snow, keep its grain
        snowC = mix(clamp(snowC * 1.55, 0.0, 1.0), vec3(0.97, 0.98, 1.0), 0.45);
        vec3 groomed = mix(snowC, vec3(0.975, 0.982, 0.995), vMask.g * 0.8);
        // winter: snow everywhere except true cliffs; exposed rock is cold grey and dusted with snow
        float grey = dot(rockC, vec3(0.299, 0.587, 0.114));
        rockC = mix(rockC, vec3(grey), 0.75) * vec3(0.86, 0.9, 0.98);
        rockC = mix(rockC, snowC, 0.22);
        float ny = normalize(vWNormal).y;
        float rockAmt = smoothstep(0.55, 0.95, vMask.r) * (1.0 - smoothstep(0.42, 0.6, ny)) * 0.9;
        diffuseColor.rgb *= mix(groomed, rockC, rockAmt);`,
      );
  };
  return m;
}
