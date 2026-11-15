"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Environment, Lightformer, useGLTF } from "@react-three/drei";
import { CuboidCollider, Physics, RigidBody, useRapier, type RapierRigidBody } from "@react-three/rapier";
import { CAP_COLORS, type SkillKey } from "./keycap-colors";

const MODEL = "/models/keycaps.glb";
const DRACO = "/draco/";
useGLTF.preload(MODEL, DRACO);

const unitsFor = (name: string) => (name.length <= 5 ? 1 : name.length <= 9 ? 1.5 : 2);
const MESH: Record<number, string> = { 1: "Key1u", 1.5: "Key15u", 2: "Key2u" };
const GRAVITY = 20;
const CAP_TOP = 0.595; // just above the dished top (Blender HEIGHT 0.62 minus the dish)

/** Deterministic pseudo-random in [0, 1) so renders stay pure. */
const rand = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function labelTexture(text: string, units: number, ink: string, font: string) {
  const h = 256;
  const w = Math.round(h * (units - 0.5) * 2);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  let size = 132;
  do {
    ctx.font = `600 ${size}px ${font}`;
    size -= 4;
  } while (ctx.measureText(text).width > w * 0.86 && size > 40);
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, h / 2 + 6);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Grab-and-throw for rapier bodies. A class (not hook state) so per-frame mutation stays out of React.
 * While held, a body is kinematic and follows the pointer on a camera-facing plane; on release it goes
 * dynamic again with the throw velocity — or, if it barely moved, gets a little "key press" hop.
 */
class DragController {
  body: RapierRigidBody | null = null;
  private plane = new THREE.Plane();
  private offset = new THREE.Vector3();
  private last = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private hit = new THREE.Vector3();
  private moved = 0;
  private types = { dynamic: 0, kinematic: 2 };

  setTypes(dynamic: number, kinematic: number) {
    this.types = { dynamic, kinematic };
  }

  start(body: RapierRigidBody, point: THREE.Vector3, camera: THREE.Camera) {
    this.body = body;
    body.setBodyType(this.types.kinematic, true);
    const n = camera.getWorldDirection(new THREE.Vector3()).negate();
    this.plane.setFromNormalAndCoplanarPoint(n, point);
    const t = body.translation();
    this.offset.set(t.x, t.y, t.z).sub(point);
    this.last.set(t.x, t.y, t.z);
    this.vel.set(0, 0, 0);
    this.moved = 0;
  }

  update(raycaster: THREE.Raycaster, dt: number, bounds: { w: number; d: number }) {
    if (!this.body || dt <= 0) return;
    if (!raycaster.ray.intersectPlane(this.plane, this.hit)) return;
    const target = this.hit.add(this.offset);
    target.x = THREE.MathUtils.clamp(target.x, -bounds.w + 0.6, bounds.w - 0.6);
    target.y = THREE.MathUtils.clamp(target.y, 0.8, 7);
    target.z = THREE.MathUtils.clamp(target.z, -bounds.d + 0.6, bounds.d - 0.6);
    this.vel.copy(target).sub(this.last).divideScalar(dt);
    this.moved += target.distanceTo(this.last);
    this.last.copy(target);
    this.body.setNextKinematicTranslation(target);
  }

  release() {
    const b = this.body;
    if (!b) return;
    this.body = null;
    b.setBodyType(this.types.dynamic, true);
    if (this.moved < 0.08) {
      hop(b);
    } else {
      this.vel.clampLength(0, 16).multiplyScalar(0.8);
      b.setLinvel(this.vel, true);
      b.setAngvel({ x: this.vel.z * 0.4, y: 0, z: -this.vel.x * 0.4 }, true);
    }
  }
}

/** A key-press hop: up, with a little spin. */
function hop(b: RapierRigidBody) {
  const m = b.mass();
  b.applyImpulse({ x: 0, y: 7 * m, z: 0 }, true);
  b.applyTorqueImpulse({ x: (Math.random() - 0.5) * 0.6 * m, y: (Math.random() - 0.5) * m, z: (Math.random() - 0.5) * 0.6 * m }, true);
}

export type PileMode = "play" | "arranged";

/**
 * Neat keyboard layout: one row per skill group (wrapping when a row is too wide), rows centred.
 * Returns each skill's resting position (body origin = keycap base centre).
 */
function layoutTargets(skills: SkillKey[], maxW: number) {
  const GAP = 0.12;
  const rows: SkillKey[][] = [];
  let row: SkillKey[] = [];
  let width = 0;
  let group = -1;
  for (const s of skills) {
    const u = unitsFor(s.name);
    if (s.group !== group || (row.length && width + GAP + u > maxW)) {
      if (row.length) rows.push(row);
      row = [];
      width = 0;
      group = s.group;
    }
    width += (row.length ? GAP : 0) + u;
    row.push(s);
  }
  if (row.length) rows.push(row);

  const pitch = 1.14;
  const targets = new Map<string, THREE.Vector3>();
  rows.forEach((r, ri) => {
    const total = r.reduce((a, s) => a + unitsFor(s.name), 0) + GAP * (r.length - 1);
    let x = -total / 2;
    const z = (ri - (rows.length - 1) / 2) * pitch;
    for (const s of r) {
      const u = unitsFor(s.name);
      targets.set(s.name, new THREE.Vector3(x + u / 2, 0, z));
      x += u + GAP;
    }
  });
  return targets;
}

/**
 * Arrange <-> explode. Arranged keys are kinematic and glide (with a little lift) into the layout,
 * face-up, rippling left to right; letters/clicks press them down like a keyboard.
 * Explode hands them back to physics with an outward, upward burst.
 */
class Arranger {
  mode: PileMode = "play";
  private targets = new Map<string, THREE.Vector3>();
  private order = new Map<string, number>();
  private press = new Map<string, number>();
  private t = 0;
  private q = new THREE.Quaternion();
  private up = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private goal = new THREE.Vector3();

  arrange(bodies: Map<string, RapierRigidBody>, targets: Map<string, THREE.Vector3>, kinematic: number) {
    this.mode = "arranged";
    this.targets = targets;
    this.t = 0;
    const sorted = [...targets.entries()].sort((a, b) => a[1].x - b[1].x + (a[1].z - b[1].z) * 0.2);
    sorted.forEach(([name], i) => this.order.set(name, i));
    bodies.forEach((b) => b.setBodyType(kinematic, true));
  }

  /**
   * Scatter: every key gets its own landing spot spread over the whole play area (jittered grid,
   * shuffled so neighbours fly apart) and is launched on a ballistic arc that lands it there, spinning.
   */
  explode(bodies: Map<string, RapierRigidBody>, dynamic: number, bounds: { w: number; d: number }, gravity: number) {
    this.mode = "play";
    const list = [...bodies.values()];
    const cols = Math.ceil(Math.sqrt(list.length * (bounds.w / bounds.d)));
    const rows = Math.ceil(list.length / cols);
    const slots = Array.from({ length: cols * rows }, (_, i) => i).sort(() => Math.random() - 0.5);
    const margin = 0.9;

    list.forEach((b, i) => {
      b.setBodyType(dynamic, true);
      const slot = slots[i];
      const cx = ((slot % cols) + 0.2 + Math.random() * 0.6) / cols; // 0..1 with jitter
      const cz = (Math.floor(slot / cols) + 0.2 + Math.random() * 0.6) / rows;
      const dest = {
        x: -bounds.w + margin + cx * (bounds.w - margin) * 2,
        z: -bounds.d + margin + cz * (bounds.d - margin) * 2,
      };
      const p = b.translation();
      const flight = 0.85 + Math.random() * 0.45; // seconds in the air
      b.setLinvel({ x: (dest.x - p.x) / flight, y: (gravity * flight) / 2, z: (dest.z - p.z) / flight }, true);
      b.setAngvel({ x: (Math.random() - 0.5) * 18, y: (Math.random() - 0.5) * 14, z: (Math.random() - 0.5) * 18 }, true);
    });
  }

  pressKey(name: string) {
    this.press.set(name, 1);
  }

  update(dt: number, bodies: Map<string, RapierRigidBody>) {
    if (this.mode !== "arranged") return;
    this.t += dt;
    const k = 1 - Math.exp(-7 * dt);
    bodies.forEach((b, name) => {
      const target = this.targets.get(name);
      if (!target || this.t < (this.order.get(name) ?? 0) * 0.035) return;
      const pr = (this.press.get(name) ?? 0) * Math.exp(-9 * dt);
      this.press.set(name, pr);
      const p = b.translation();
      this.v.set(p.x, p.y, p.z);
      const dist = Math.hypot(target.x - p.x, target.z - p.z);
      this.goal.set(target.x, Math.min(2.2, dist * 0.45) - pr * 0.16, target.z);
      b.setNextKinematicTranslation(this.v.lerp(this.goal, k));
      const r = b.rotation();
      b.setNextKinematicRotation(this.q.set(r.x, r.y, r.z, r.w).slerp(this.up, k));
    });
  }
}

type KeycapProps = {
  skill: SkillKey;
  index: number;
  geometry: THREE.BufferGeometry;
  spreadX: number;
  font: string;
  onHover: (s: SkillKey | null) => void;
  onGrab: (e: ThreeEvent<PointerEvent>, body: RapierRigidBody, name: string) => void;
  register: (name: string, body: RapierRigidBody | null) => void;
};

function Keycap({ skill, index, geometry, spreadX, font, onHover, onGrab, register }: KeycapProps) {
  const body = useRef<RapierRigidBody>(null);
  const [hovered, setHovered] = useState(false);
  const units = unitsFor(skill.name);
  const c = CAP_COLORS[skill.group % CAP_COLORS.length];
  const label = useMemo(() => labelTexture(skill.name, units, c.ink, font), [skill.name, units, c.ink, font]);
  useEffect(() => () => label.dispose(), [label]);

  // Stable identities: RigidBody only reads these at creation (stacked high so keys rain down one by one).
  const spawn = useMemo<[number, number, number]>(
    () => [(rand(index, 1) - 0.5) * spreadX * 1.6, 5 + index * 0.75, (rand(index, 2) - 0.5) * 2.4],
    [index, spreadX],
  );
  const rotation = useMemo<[number, number, number]>(
    () => [rand(index, 3) * 2, rand(index, 4) * 6, rand(index, 5) * 2],
    [index],
  );

  return (
    <RigidBody
      ref={(b) => {
        body.current = b;
        register(skill.name, b);
      }}
      colliders="cuboid"
      position={spawn}
      rotation={rotation}
      restitution={0.25}
      friction={0.9}
      linearDamping={0.15}
      angularDamping={0.35}
    >
      <mesh
        geometry={geometry}
        castShadow
        receiveShadow
        onPointerDown={(e) => body.current && onGrab(e, body.current, skill.name)}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          onHover(skill);
          document.body.style.cursor = "grab";
        }}
        onPointerOut={() => {
          setHovered(false);
          onHover(null);
          document.body.style.cursor = "";
        }}
      >
        <meshPhysicalMaterial
          color={c.body}
          roughness={0.32}
          clearcoat={0.6}
          clearcoatRoughness={0.1}
          emissive="#C6FF3D"
          emissiveIntensity={hovered ? 0.22 : 0}
        />
      </mesh>
      <mesh position={[0, CAP_TOP, -0.05]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[units - 0.5, 0.5]} />
        <meshBasicMaterial map={label} transparent toneMapped={false} depthWrite={false} />
      </mesh>
    </RigidBody>
  );
}

function Pile({
  skills,
  mode,
  onHover,
}: {
  skills: SkillKey[];
  mode: PileMode;
  onHover: (s: SkillKey | null) => void;
}) {
  const { nodes } = useGLTF(MODEL, DRACO);
  const { rapier } = useRapier();
  const camera = useThree((s) => s.camera);
  const raycaster = useThree((s) => s.raycaster);
  const pointer = useThree((s) => s.pointer);
  const viewport = useThree((s) => s.viewport);
  const [drag] = useState(() => new DragController());
  const [arranger] = useState(() => new Arranger());
  const bodies = useRef(new Map<string, RapierRigidBody>());

  const vp = viewport.getCurrentViewport(camera, [0, 0, 0]);
  const bounds = { w: Math.max(2.6, vp.width / 2 - 0.4), d: 2.6 };
  const font = useMemo(
    () => getComputedStyle(document.documentElement).getPropertyValue("--font-jetbrains-mono").trim() || "monospace",
    [],
  );

  useEffect(() => {
    drag.setTypes(rapier.RigidBodyType.Dynamic, rapier.RigidBodyType.KinematicPositionBased);
    const up = () => {
      drag.release();
      document.body.style.cursor = "";
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [drag, rapier]);

  // Arrange <-> explode when the mode flips (and re-layout on resize while arranged).
  const { w: boundW, d: boundD } = bounds;
  const maxW = boundW * 2 - 0.6;
  useEffect(() => {
    const { Dynamic, KinematicPositionBased } = rapier.RigidBodyType;
    if (mode === "arranged") {
      drag.release();
      arranger.arrange(bodies.current, layoutTargets(skills, maxW), KinematicPositionBased);
    } else if (arranger.mode === "arranged") {
      arranger.explode(bodies.current, Dynamic, { w: boundW, d: boundD }, GRAVITY);
    }
  }, [mode, maxW, boundW, boundD, skills, arranger, drag, rapier]);

  // Easter egg: typing a letter makes every skill starting with it hop (or press down when arranged).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA"].includes(t.tagName))) return;
      const k = e.key.toLowerCase();
      bodies.current.forEach((b, name) => {
        if (!name.toLowerCase().startsWith(k)) return;
        if (arranger.mode === "arranged") arranger.pressKey(name);
        else hop(b);
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [arranger]);

  useFrame((_, dt) => {
    arranger.update(dt, bodies.current);
    if (!drag.body) return;
    raycaster.setFromCamera(pointer, camera);
    drag.update(raycaster, dt, bounds);
  });

  const grab = (e: ThreeEvent<PointerEvent>, body: RapierRigidBody, name: string) => {
    e.stopPropagation();
    if (arranger.mode === "arranged") return arranger.pressKey(name); // keyboard mode: just press it
    drag.start(body, e.point, camera);
    document.body.style.cursor = "grabbing";
  };
  const register = (name: string, b: RapierRigidBody | null) => {
    if (b) bodies.current.set(name, b);
    else bodies.current.delete(name);
  };

  return (
    <>
      {skills.map((s, i) => (
        <Keycap
          key={s.name}
          skill={s}
          index={i}
          geometry={(nodes[MESH[unitsFor(s.name)]] as THREE.Mesh).geometry}
          spreadX={bounds.w}
          font={font}
          onHover={onHover}
          onGrab={grab}
          register={register}
        />
      ))}

      {/* Box: floor + four invisible walls sized to the visible area */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[40, 0.5, 40]} position={[0, -0.5, 0]} />
        <CuboidCollider args={[0.5, 10, bounds.d]} position={[-bounds.w - 0.5, 10, 0]} />
        <CuboidCollider args={[0.5, 10, bounds.d]} position={[bounds.w + 0.5, 10, 0]} />
        <CuboidCollider args={[bounds.w, 10, 0.5]} position={[0, 10, -bounds.d - 0.5]} />
        <CuboidCollider args={[bounds.w, 10, 0.5]} position={[0, 10, bounds.d + 0.5]} />
      </RigidBody>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <shadowMaterial opacity={0.4} />
      </mesh>
    </>
  );
}

export default function KeycapPile({
  skills,
  running,
  mode,
  onHover,
}: {
  skills: SkillKey[];
  running: boolean;
  mode: PileMode;
  onHover: (s: SkillKey | null) => void;
}) {
  useEffect(() => () => void (document.body.style.cursor = ""), []);
  return (
    <Canvas
      shadows
      frameloop={running ? "always" : "never"}
      dpr={[1, 1.75]}
      camera={{ position: [0, 9, 9.5], fov: 30 }}
      onCreated={({ camera }) => camera.lookAt(0, 0.6, 0)}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[-4, 10, 6]}
        intensity={2}
        color="#FFF4E6"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <Environment resolution={128}>
        <Lightformer form="rect" intensity={3} position={[-5, 6, 5]} scale={[6, 4, 1]} />
        <Lightformer form="rect" intensity={1.4} position={[6, 2, 4]} scale={[4, 6, 1]} color="#DDE6FF" />
        <Lightformer form="ring" intensity={2} position={[0, 5, -6]} scale={5} color="#C6FF3D" />
      </Environment>
      <Physics paused={!running} gravity={[0, -GRAVITY, 0]}>
        <Pile skills={skills} mode={mode} onHover={onHover} />
      </Physics>
    </Canvas>
  );
}
