"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, useGLTF } from "@react-three/drei";
import { BUG_PALETTES, PART_OVERRIDES, roleOf } from "./bug-palettes";

const MODEL = "/models/bugs.glb";
const DRACO = "/draco/";
useGLTF.preload(MODEL, DRACO);

type Species = "Ladybug" | "Ant" | "Spider";

/** Per-species look + personality. `px` = on-screen body length; speeds in px/s; `gait` = leg cycles per px. */
const SPECIES: Record<
  Species,
  { len: number; px: number; speed: number; flee: number; turn: number; gait: number; burst: boolean }
> = {
  Ladybug: { len: 1.6, px: 34, speed: 34, flee: 120, turn: 1.4, gait: 0.16, burst: false },
  Ant: { len: 1.75, px: 30, speed: 90, flee: 240, turn: 3.4, gait: 0.2, burst: false },
  Spider: { len: 2.0, px: 44, speed: 150, flee: 290, turn: 2.2, gait: 0.12, burst: true },
};
const MIX_DESKTOP: Species[] = ["Ladybug", "Ant", "Spider", "Ladybug", "Ant", "Ladybug", "Spider"];
const MIX_MOBILE: Species[] = ["Ladybug", "Ant", "Spider"];

export type BugsApi = {
  /** Pointer in footer px (origin top-left). `null` when it leaves. */
  point: (p: { x: number; y: number } | null) => void;
  /** Squash the bug under this footer px point; returns true if one was hit. */
  hit: (x: number, y: number) => boolean;
  /** Is there a live bug under this point (for the cursor)? */
  over: (x: number, y: number) => boolean;
};

type Leg = { o: THREE.Object3D; base: number; offset: number };
type Bug = {
  species: Species;
  outer: THREE.Group;
  inner: THREE.Group;
  legs: Leg[];
  head?: THREE.Object3D;
  antennae: THREE.Object3D[];
  scale: number;
  x: number;
  y: number;
  heading: number;
  speed: number;
  seed: number;
  phase: number;
  state: "walk" | "pause" | "squashed" | "gone";
  timer: number;
  burstLeft: number;
};

/**
 * The whole swarm as a plain class: three.js objects + a tiny steering sim (wander, edge avoidance,
 * flee the cursor, spider bursts) with procedural tripod gaits. Kept outside React state on purpose.
 */
class Swarm {
  root = new THREE.Group();
  bugs: Bug[] = [];
  private templates = new Map<Species, THREE.Object3D>();
  private ptr: { x: number; y: number } | null = null;
  private w = 800;
  private h = 300;
  private onFix: (x: number, y: number) => void = () => {};
  private onCount: (n: number) => void = () => {};
  private waveTimer = -1;
  private wave = 0;

  setTemplates(scene: THREE.Object3D) {
    for (const s of Object.keys(SPECIES) as Species[]) {
      const t = scene.getObjectByName(s);
      if (t) this.templates.set(s, t);
    }
  }
  setCallbacks(onFix: (x: number, y: number) => void, onCount: (n: number) => void) {
    this.onFix = onFix;
    this.onCount = onCount;
  }
  setSize(w: number, h: number) {
    this.w = w;
    this.h = h;
  }
  /** Canvas coords: origin centre, y up. */
  setPointer(p: { x: number; y: number } | null) {
    this.ptr = p;
  }

  private make(species: Species, i: number): Bug | null {
    const tpl = this.templates.get(species);
    if (!tpl) return null;
    const model = tpl.clone(true);
    model.position.set(0, 0, 0);
    const palettes = BUG_PALETTES[species];
    const palette = palettes[i % palettes.length]; // i = how many of this species came before (+ wave offset)
    const overrides = PART_OVERRIDES[palette.name] ?? {};
    const mats = new Map<string, THREE.MeshStandardMaterial>(); // one material per colour, per bug
    const legs: Leg[] = [];
    const antennae: THREE.Object3D[] = [];
    let head: THREE.Object3D | undefined;
    model.traverse((o) => {
      const part = o.name.slice(species.length + 1); // "Ant_Thorax" → "Thorax"
      const role = roleOf(part);
      if (o instanceof THREE.Mesh && role) {
        const color = overrides[part] ?? palette[role];
        let m = mats.get(color);
        if (!m) {
          m = (o.material as THREE.MeshStandardMaterial).clone();
          m.color.set(color);
          mats.set(color, m);
        }
        o.material = m;
      }
      const leg = o.name.match(/_Leg_([LR])(\d)$/);
      if (leg) {
        const n = Number(leg[2]);
        legs.push({ o, base: o.rotation.y, offset: ((n + (leg[1] === "L" ? 0 : 1)) % 2) * Math.PI });
      }
      if (/_Antenna[LR]$/.test(o.name)) antennae.push(o);
      if (o.name.endsWith("_Head")) head = o;
    });
    const inner = new THREE.Group();
    inner.rotation.x = Math.PI / 2; // model up (+Y) → toward the camera, model forward → screen +Y
    inner.add(model);
    const outer = new THREE.Group();
    outer.add(inner);
    this.root.add(outer);
    const scale = SPECIES[species].px / SPECIES[species].len;
    inner.scale.setScalar(scale);
    return {
      species,
      outer,
      inner,
      legs,
      head,
      antennae,
      scale,
      x: 0,
      y: 0,
      heading: 0,
      speed: 0,
      seed: Math.random() * 100,
      phase: Math.random() * 10,
      state: "walk",
      timer: 0,
      burstLeft: 0,
    };
  }

  /** (Re)spawn a wave. `fromEdges` = crawl in from outside instead of appearing in place. */
  spawn(mix: Species[], fromEdges: boolean) {
    this.bugs.forEach((b) => this.root.remove(b.outer));
    this.bugs = [];
    const seen = new Map<Species, number>();
    mix.forEach((s, i) => {
      const n = seen.get(s) ?? 0;
      seen.set(s, n + 1);
      const b = this.make(s, n + this.wave); // every wave shifts the colourways
      if (!b) return;
      const hw = this.w / 2 - 40;
      const hh = this.h / 2 - 30;
      if (fromEdges) {
        const left = i % 2 === 0;
        b.x = left ? -this.w / 2 - 40 - i * 30 : this.w / 2 + 40 + i * 30;
        b.y = (Math.random() * 2 - 1) * hh;
        b.heading = left ? 0 : Math.PI;
      } else {
        b.x = (Math.random() * 2 - 1) * hw;
        b.y = (Math.random() * 2 - 1) * hh;
        b.heading = Math.random() * Math.PI * 2;
      }
      this.bugs.push(b);
    });
    this.onCount(this.bugs.length);
  }

  private nearest(x: number, y: number) {
    let best: Bug | null = null;
    let bestD = Infinity;
    for (const b of this.bugs) {
      if (b.state === "squashed" || b.state === "gone") continue;
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < SPECIES[b.species].px * 0.75 && d < bestD) {
        best = b;
        bestD = d;
      }
    }
    return best;
  }
  over(x: number, y: number) {
    return !!this.nearest(x, y);
  }
  hit(x: number, y: number) {
    const b = this.nearest(x, y);
    if (!b) return false;
    b.state = "squashed";
    b.timer = 0;
    this.onFix(b.x, b.y);
    const left = this.bugs.filter((x) => x.state !== "squashed" && x.state !== "gone").length;
    this.onCount(left);
    if (left === 0) {
      this.waveTimer = 3.5; // there are always more bugs
      this.wave++;
    }
    return true;
  }

  step(dt: number, t: number, reduced: boolean, mix: Species[]) {
    if (this.waveTimer > 0) {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) this.spawn(mix, true);
    }
    const hw = this.w / 2;
    const hh = this.h / 2;
    for (const b of this.bugs) {
      const sp = SPECIES[b.species];
      if (b.state === "gone") continue;

      if (b.state === "squashed") {
        b.timer += dt;
        const k = Math.min(b.timer / 0.1, 1);
        const fade = b.timer > 0.9 ? Math.max(0, 1 - (b.timer - 0.9) / 0.35) : 1;
        b.inner.scale.set(b.scale * (1 + 0.4 * k) * fade, b.scale * (1 - 0.85 * k) * fade, b.scale * (1 + 0.4 * k) * fade);
        b.legs.forEach((l) => (l.o.rotation.y = l.base + Math.sin(l.offset) * 0.6));
        if (fade === 0) {
          b.state = "gone";
          b.outer.visible = false;
        }
        continue;
      }

      if (!reduced) {
        const p = this.ptr;
        const dist = p ? Math.hypot(b.x - p.x, b.y - p.y) : Infinity;
        const fleeing = dist < 150;
        let desired: number;
        if (fleeing && p) desired = Math.atan2(b.y - p.y, b.x - p.x);
        else desired = b.heading + Math.sin(t * 0.8 + b.seed) * sp.turn * 0.6 + (Math.random() - 0.5) * sp.turn * 0.4;

        // steer back inside when near (or past) an edge
        const m = 36;
        if (b.x < -hw + m || b.x > hw - m || b.y < -hh + m || b.y > hh - m) {
          const toCentre = Math.atan2(-b.y * 0.6, -b.x);
          desired = fleeing ? desired : toCentre;
          if (b.x < -hw - 10 || b.x > hw + 10) desired = toCentre; // still entering
        }

        let diff = Math.atan2(Math.sin(desired - b.heading), Math.cos(desired - b.heading));
        const maxTurn = (fleeing ? sp.turn * 3 : sp.turn) * dt;
        diff = Math.max(-maxTurn, Math.min(maxTurn, diff));
        b.heading += diff;

        let target = fleeing ? sp.flee : sp.speed;
        if (sp.burst && !fleeing) {
          b.burstLeft -= dt;
          if (b.burstLeft <= 0) {
            b.state = b.state === "walk" ? "pause" : "walk";
            b.burstLeft = b.state === "walk" ? 0.35 + Math.random() * 0.8 : 0.5 + Math.random() * 1.6;
          }
          if (b.state === "pause") target = 0;
        } else if (b.state === "pause") b.state = "walk";
        b.speed += (target - b.speed) * (1 - Math.exp(-(fleeing ? 10 : 4) * dt));

        b.x += Math.cos(b.heading) * b.speed * dt;
        b.y += Math.sin(b.heading) * b.speed * dt;
        if (Math.abs(b.x) < hw + 200) b.y = Math.max(-hh + 8, Math.min(hh - 8, b.y));
        b.phase += b.speed * dt * sp.gait;
      }

      const amp = 0.42 * Math.min(1, b.speed / 15);
      b.legs.forEach((l) => (l.o.rotation.y = l.base + Math.sin(b.phase + l.offset) * amp));
      if (b.head) b.head.rotation.x = Math.sin(b.phase * 2) * 0.06 * Math.min(1, b.speed / 15);
      b.antennae.forEach((a, i) => (a.rotation.z = Math.sin(t * 7 + b.seed + i * 1.7) * 0.18));
      b.outer.position.set(b.x, b.y, 0);
      b.outer.rotation.z = b.heading - Math.PI / 2;
    }
  }
}

function Bugs({
  reduced,
  apiRef,
  onFix,
  onCount,
}: {
  reduced: boolean;
  apiRef: React.RefObject<BugsApi | null>;
  onFix: (x: number, y: number) => void;
  onCount: (n: number) => void;
}) {
  const { scene } = useGLTF(MODEL, DRACO);
  const size = useThree((s) => s.size);
  const group = useRef<THREE.Group>(null!);
  const [swarm] = useState(() => new Swarm());
  const mix = size.width < 640 ? MIX_MOBILE : MIX_DESKTOP;

  useLayoutEffect(() => {
    swarm.setCallbacks(onFix, onCount); // before spawn, so the first count reaches the footer
    swarm.setTemplates(scene);
    swarm.setSize(size.width, size.height);
    swarm.spawn(mix, false);
    const g = group.current;
    g.add(swarm.root);
    return () => {
      g.remove(swarm.root);
    };
    // respawn only when the model or the mobile/desktop mix changes — not on every resize
  }, [scene, swarm, mix]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => swarm.setSize(size.width, size.height), [swarm, size.width, size.height]);
  useEffect(() => swarm.setCallbacks(onFix, onCount), [swarm, onFix, onCount]);

  // DOM-side API (footer px → canvas coords: origin centre, y up)
  useEffect(() => {
    const toCanvas = (x: number, y: number) => ({ x: x - size.width / 2, y: size.height / 2 - y });
    apiRef.current = {
      point: (p) => swarm.setPointer(p ? toCanvas(p.x, p.y) : null),
      hit: (x, y) => {
        const c = toCanvas(x, y);
        return swarm.hit(c.x, c.y);
      },
      over: (x, y) => {
        const c = toCanvas(x, y);
        return swarm.over(c.x, c.y);
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, swarm, size.width, size.height]);

  useFrame((state, dt) => swarm.step(Math.min(dt, 0.05), state.clock.elapsedTime, reduced, mix));

  return <group ref={group} />;
}

export default function BugsCanvas({
  active,
  reduced,
  apiRef,
  onFix,
  onCount,
}: {
  active: boolean;
  reduced: boolean;
  apiRef: React.RefObject<BugsApi | null>;
  onFix: (x: number, y: number) => void;
  onCount: (n: number) => void;
}) {
  return (
    <Canvas
      orthographic
      frameloop={active ? "always" : "never"}
      dpr={[1, 2]}
      camera={{ position: [0, 0, 200], zoom: 1, near: 1, far: 1000 }} // 1 unit = 1 CSS px
      gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping }}
      style={{ pointerEvents: "none" }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[-200, 300, 400]} intensity={2.2} color="#FFF4E6" />
      <Environment resolution={64}>
        <Lightformer form="rect" intensity={3} position={[-5, 5, 5]} scale={[6, 4, 1]} />
        <Lightformer form="ring" intensity={1.5} position={[3, -2, 4]} scale={3} color="#FF8A4C" />
      </Environment>
      <Bugs reduced={reduced} apiRef={apiRef} onFix={onFix} onCount={onCount} />
    </Canvas>
  );
}
