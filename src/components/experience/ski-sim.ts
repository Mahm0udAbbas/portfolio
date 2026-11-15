import * as THREE from "three";
import PATH from "./ski-path.json";
import { RUN, WIDE_FROM, progressToS } from "./ski-timeline";

export { RUN, WIDE_FROM, progressToS };

/**
 * The ski run as a plain class (kept out of React state): samples the path exported from Blender,
 * drives the skier (carving, jump arc, crouch, hockey stop), the chase camera, and the snow effects.
 * Everything is a pure function of the scroll position `s` (metres along the run) plus smoothing,
 * so scrolling back simply rewinds.
 */

const PTS = (PATH.points as number[][]).map(([x, y, z]) => new THREE.Vector3(x, y, z));
const smooth = (t: number) => {
  const c = Math.min(Math.max(t, 0), 1);
  return c * c * (3 - 2 * c);
};
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();

/** Point on the path (surface of the ice) at distance s. */
export function pathAt(s: number, out = new THREE.Vector3()) {
  const f = Math.min(Math.max(s / RUN.step, 0), PTS.length - 1.0001);
  const i = Math.floor(f);
  return out.copy(PTS[i]).lerp(PTS[i + 1], f - i);
}
/** Horizontal heading (radians, three.js yaw for a model facing -Z) at distance s. */
function headingAt(s: number) {
  pathAt(s - 0.8, tmpA);
  pathAt(s + 0.8, tmpB);
  return Math.atan2(-(tmpB.x - tmpA.x), -(tmpB.z - tmpA.z));
}
function pitchAt(s: number) {
  pathAt(s - 0.8, tmpA);
  pathAt(s + 0.8, tmpB);
  return Math.atan2(tmpB.y - tmpA.y, Math.hypot(tmpB.x - tmpA.x, tmpB.z - tmpA.z));
}
/** Skier height including the jump arc between the lip and the landing. */
function skierPos(s: number, out: THREE.Vector3) {
  pathAt(s, out);
  const { lip, land } = RUN.jump;
  if (s > lip && s < land) {
    const t = (s - lip) / (land - lip);
    const yLip = pathAt(lip, tmpA).y;
    const yLand = pathAt(land, tmpB).y;
    const arc = yLip + (yLand - yLip) * t + 2.0 * 4 * t * (1 - t);
    out.y = Math.max(out.y, arc);
  }
  return out;
}

const SNOW_COUNT = 900;
const SPRAY_COUNT = 260;
const SPARKLE_COUNT = 70;

export class SkiRunSim {
  root = new THREE.Group();
  private skier?: THREE.Object3D;
  private body?: THREE.Object3D;
  private camera?: THREE.Camera;
  private s = 0;
  private lastS = 0;
  private roll = 0;
  private stopped = false;
  private camPos = new THREE.Vector3(0, 20, 20);
  private camLook = new THREE.Vector3();
  private pos = new THREE.Vector3();
  private fwd = new THREE.Vector3();
  private v = new THREE.Vector3();
  private w = new THREE.Vector3();

  // effects
  private tracks!: THREE.Mesh;
  private trackVertsPerSeg = 12; // 2 tracks x 2 triangles x 3 vertices
  private snow!: THREE.Points;
  private spray!: THREE.Points;
  private sprayVel = new Float32Array(SPRAY_COUNT * 3);
  private sprayLife = new Float32Array(SPRAY_COUNT);
  private sprayNext = 0;
  private sparkle!: THREE.Points;

  attach(scene: THREE.Object3D, camera: THREE.Camera, reduced: boolean) {
    this.skier = scene.getObjectByName("Skier") ?? undefined;
    this.body = scene.getObjectByName("SkierBody") ?? undefined;
    this.camera = camera;
    this.dispose(); // effects may be rebuilt (Strict Mode / HMR) — never keep two sets
    this.root.clear();
    this.root.add(this.buildTracks(), this.buildSnow(reduced), this.buildSpray(), this.buildSparkle());
    this.update(0, 0, 0, true);
  }

  // ── builders ─────────────────────────────────────────────────────────────
  private buildTracks() {
    const { lip, land } = RUN.jump;
    const pos: number[] = [];
    const side = new THREE.Vector3();
    for (let i = 0; i < PTS.length - 1; i++) {
      const s0 = i * RUN.step;
      const s1 = s0 + RUN.step;
      const air = s1 > lip && s0 < land;
      for (const off of [-0.16, 0.16]) {
        const quad: THREE.Vector3[] = [];
        for (const [s, e] of [
          [s0, -0.035],
          [s1, -0.035],
          [s1, 0.035],
          [s0, 0.035],
        ]) {
          const h = headingAt(s);
          side.set(Math.cos(h), 0, -Math.sin(h)); // right-hand side of travel
          const p = pathAt(s, new THREE.Vector3()).addScaledVector(side, off + e);
          p.y += air ? -2 : 0.015;
          quad.push(p);
        }
        for (const k of [0, 1, 2, 0, 2, 3]) pos.push(quad[k].x, quad[k].y, quad[k].z);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setDrawRange(0, 0);
    this.tracks = new THREE.Mesh(
      g,
      new THREE.MeshBasicMaterial({ color: "#A9C6DC", transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.tracks.frustumCulled = false;
    return this.tracks;
  }

  private buildSnow(reduced: boolean) {
    const p = new Float32Array(SNOW_COUNT * 3);
    for (let i = 0; i < SNOW_COUNT; i++) {
      p[i * 3] = (Math.random() - 0.5) * 70;
      p[i * 3 + 1] = Math.random() * 30;
      p[i * 3 + 2] = 8 - Math.random() * 80;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    this.snow = new THREE.Points(
      g,
      new THREE.PointsMaterial({ color: "#FFFFFF", size: 0.13, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    this.snow.visible = !reduced;
    this.snow.frustumCulled = false;
    return this.snow;
  }

  private buildSpray() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SPRAY_COUNT * 3).fill(-999), 3));
    this.spray = new THREE.Points(
      g,
      new THREE.PointsMaterial({ color: "#FFFFFF", size: 0.09, transparent: true, opacity: 0.95, depthWrite: false }),
    );
    this.spray.frustumCulled = false;
    return this.spray;
  }

  private buildSparkle() {
    const p = new Float32Array(SPARKLE_COUNT * 3);
    const phase = new Float32Array(SPARKLE_COUNT);
    const v = new THREE.Vector3();
    for (let i = 0; i < SPARKLE_COUNT; i++) {
      const s = Math.random() * RUN.finish;
      pathAt(s, v);
      const h = headingAt(s);
      const off = (Math.random() - 0.5) * 2.4;
      p[i * 3] = v.x + Math.cos(h) * off;
      p[i * 3 + 1] = v.y + 0.06;
      p[i * 3 + 2] = v.z - Math.sin(h) * off;
      phase[i] = Math.random() * 100;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    g.setAttribute("phase", new THREE.BufferAttribute(phase, 1));
    this.sparkle = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */ `
          attribute float phase;
          uniform float uTime;
          varying float vA;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vA = pow(max(sin(uTime * 2.3 + phase), 0.0), 14.0);
            gl_PointSize = (2.0 + 7.0 * vA) * (40.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          varying float vA;
          void main() {
            vec2 c = gl_PointCoord - 0.5;
            float star = max(0.0, 1.0 - (abs(c.x) + abs(c.y)) * 2.2) + max(0.0, 0.5 - length(c) * 2.0);
            gl_FragColor = vec4(1.0, 1.0, 1.0, star * vA);
          }`,
      }),
    );
    this.sparkle.frustumCulled = false;
    return this.sparkle;
  }

  // ── per frame ────────────────────────────────────────────────────────────
  /** p = scroll progress 0..1 (already smoothed by ScrollTrigger scrub). */
  update(p: number, dt: number, t: number, snap = false) {
    const skier = this.skier;
    const cam = this.camera;
    if (!skier || !cam) return;

    this.lastS = this.s;
    this.s = progressToS(p);
    const s = this.s;
    const ds = s - this.lastS;
    const forward = ds > 0.0005;

    // Skier transform
    skierPos(s, this.pos);
    const { lip, land, ramp_start } = RUN.jump;
    const stopT = smooth((s - (RUN.finish - 1.6)) / 1.6); // hockey stop: turn sideways at the end
    const yaw = headingAt(s) + stopT * 1.25;
    const curv = headingAt(s + 1) - headingAt(s - 1);
    const targetRoll = Math.max(-0.5, Math.min(0.5, -curv * 2.4)) * (1 - stopT) - stopT * 0.35;
    this.roll += (targetRoll - this.roll) * (snap ? 1 : 1 - Math.exp(-8 * dt));
    const airborne = s > lip && s < land;
    const pitch = airborne ? -0.15 + 0.3 * ((s - lip) / (land - lip)) : pitchAt(s);
    skier.position.copy(this.pos);
    skier.rotation.set(pitch, yaw, this.roll, "YXZ");

    // Body: crouch before the lip and on landing, lean forward when carving
    if (this.body) {
      const crouch =
        smooth((s - ramp_start) / (lip - ramp_start)) * (1 - smooth((s - lip) / 0.6)) +
        (1 - smooth(Math.abs(s - land) / 0.9)) +
        stopT * 0.4;
      this.body.scale.set(1, 1 - 0.22 * Math.min(crouch, 1), 1);
      this.body.rotation.set(0.12 + 0.25 * Math.min(crouch, 1), 0, this.roll * 0.4);
    }

    // Chase camera → wide shot at the end
    this.fwd.set(-Math.sin(yaw - stopT * 1.25), 0, -Math.cos(yaw - stopT * 1.25));
    this.v.copy(this.pos).addScaledVector(this.fwd, -6.2).add(this.w.set(0, 3.1, 0));
    const lookAhead = this.w.copy(this.pos).addScaledVector(this.fwd, 3.5);
    lookAhead.y += 0.4;
    const wide = smooth((p - WIDE_FROM) / (1 - WIDE_FROM));
    if (wide > 0) {
      this.v.lerp(new THREE.Vector3(-6, 30, 24), wide);
      lookAhead.lerp(new THREE.Vector3(1, 3, -32), wide);
    }
    const k = snap ? 1 : 1 - Math.exp(-5 * dt);
    this.camPos.lerp(this.v, k);
    this.camLook.lerp(lookAhead, k);
    cam.position.copy(this.camPos);
    cam.lookAt(this.camLook);

    // Tracks follow the skier (rewind with it)
    const seg = Math.max(0, Math.floor(s / RUN.step));
    this.tracks.geometry.setDrawRange(0, seg * this.trackVertsPerSeg);

    // Spray: from the ski tails while carving forward, and a burst at the hockey stop
    const speed = Math.abs(ds) / Math.max(dt, 1e-3);
    if (forward && !airborne) this.emit(Math.min(6, Math.floor(speed * 0.25 + Math.abs(this.roll) * 6)), 1.2);
    if (forward && stopT > 0.85 && !this.stopped) {
      this.emit(90, 3.2);
      this.stopped = true;
    }
    if (stopT < 0.5) this.stopped = false;
    this.stepSpray(dt);

    // Snowfall drifts down and wraps; sparkle shader time
    if (this.snow.visible) {
      const a = this.snow.geometry.attributes.position as THREE.BufferAttribute;
      const arr = a.array as Float32Array;
      for (let i = 0; i < SNOW_COUNT; i++) {
        arr[i * 3 + 1] -= dt * (0.9 + (i % 7) * 0.12);
        arr[i * 3] += Math.sin(t * 0.6 + i) * dt * 0.25;
        if (arr[i * 3 + 1] < -2) arr[i * 3 + 1] = 28;
      }
      a.needsUpdate = true;
    }
    (this.sparkle.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
  }

  private emit(n: number, power: number) {
    if (!this.skier || n <= 0) return;
    const arr = (this.spray.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const yaw = this.skier.rotation.y;
    const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)); // opposite of travel
    const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    for (let j = 0; j < n; j++) {
      const i = this.sprayNext;
      this.sprayNext = (i + 1) % SPRAY_COUNT;
      arr[i * 3] = this.pos.x + back.x * 0.6 + (Math.random() - 0.5) * 0.4;
      arr[i * 3 + 1] = this.pos.y + 0.08;
      arr[i * 3 + 2] = this.pos.z + back.z * 0.6 + (Math.random() - 0.5) * 0.4;
      const sideways = (Math.random() - 0.5) * 2 + Math.sign(this.roll || 1) * 0.8;
      this.sprayVel[i * 3] = (back.x * 0.6 + side.x * sideways) * power;
      this.sprayVel[i * 3 + 1] = (0.8 + Math.random() * 1.2) * power;
      this.sprayVel[i * 3 + 2] = (back.z * 0.6 + side.z * sideways) * power;
      this.sprayLife[i] = 0.5 + Math.random() * 0.4;
    }
  }

  private stepSpray(dt: number) {
    const attr = this.spray.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < SPRAY_COUNT; i++) {
      if (this.sprayLife[i] <= 0) continue;
      this.sprayLife[i] -= dt;
      this.sprayVel[i * 3 + 1] -= 9 * dt;
      arr[i * 3] += this.sprayVel[i * 3] * dt;
      arr[i * 3 + 1] += this.sprayVel[i * 3 + 1] * dt;
      arr[i * 3 + 2] += this.sprayVel[i * 3 + 2] * dt;
      if (this.sprayLife[i] <= 0) arr[i * 3 + 1] = -999;
    }
    attr.needsUpdate = true;
  }

  dispose() {
    for (const o of [this.tracks, this.snow, this.spray, this.sparkle]) {
      o?.geometry.dispose();
      (o?.material as THREE.Material | undefined)?.dispose();
    }
  }
}
