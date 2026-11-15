"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Environment, Lightformer, useGLTF } from "@react-three/drei";
import { scrollToSection } from "@/lib/lenis";

const MODEL = "/models/ui-toys.glb";
const DRACO = "/draco/"; // self-hosted decoder (copied from three/examples/jsm/libs/draco/gltf)
useGLTF.preload(MODEL, DRACO);

export type ToysInput = {
  /** 0 → 1 scroll progress through the hero */
  progress: React.RefObject<number>;
  /** pointer in -1..1 (x right, y up) */
  pointer: React.RefObject<{ x: number; y: number }>;
  /** flips true once the preloader is gone → toys pop in */
  entered: React.RefObject<boolean>;
  reduced: boolean;
  onReady: () => void;
};

const ACCENT = new THREE.Color("#FF8A4C");
const CHARCOAL = new THREE.Color("#2A2D36");
const { damp, clamp } = THREE.MathUtils;
const easeOutBack = (x: number) => 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2);

type Part = { obj: THREE.Object3D; base: THREE.Vector3; baseScale: THREE.Vector3 };
type Toy = {
  root: THREE.Object3D;
  kind: string;
  basePos: THREE.Vector3;
  baseRot: THREE.Euler;
  baseScale: number;
  dir: THREE.Vector3; // scatter direction on scroll
  phase: number;
  delay: number;
  hovered: boolean;
  hover: number;
  press: number;
  spin: number;
  spinTarget: number;
  on: boolean;
  value: number; // slider target
  parts: Record<string, Part>;
};

type Rest = { pos: THREE.Vector3; rot: THREE.Euler; scale: THREE.Vector3 };

/**
 * The model's authored transform, captured the first time we see an object and reused afterwards.
 * Effects can run more than once (React Strict Mode in dev, HMR) after frames have already moved things —
 * reading live transforms then would bake the animated/hidden state in as the "rest" pose.
 */
const rest = (o: THREE.Object3D): Rest =>
  (o.userData.rest ??= { pos: o.position.clone(), rot: o.rotation.clone(), scale: o.scale.clone() }) as Rest;

const part = (root: THREE.Object3D, name: string): Part | null => {
  const obj = root.getObjectByName(name);
  if (!obj) return null;
  const r = rest(obj);
  return { obj, base: r.pos.clone(), baseScale: r.scale.clone() };
};

type Frame = {
  t: number;
  dt: number;
  p: number;
  ptr: { x: number; y: number };
  scatter: number;
  enteredAt: number | null;
  reduced: boolean;
};

/** Advance one toy by one frame (module-level so per-frame mutation stays out of React's render model). */
function stepToy(toy: Toy, { t, dt, p, ptr, scatter, enteredAt, reduced }: Frame) {
  const { root } = toy;
  toy.hover = damp(toy.hover, toy.hovered ? 1 : 0, 10, dt);
  toy.press = damp(toy.press, 0, 7, dt);
  toy.spin = damp(toy.spin, toy.spinTarget, 3.5, dt);

  const since = enteredAt === null ? -1 : t - enteredAt - toy.delay;
  const appear = reduced ? (enteredAt === null ? 0 : 1) : easeOutBack(clamp(since / 0.9, 0, 1));

  const bob = reduced ? 0 : Math.sin(t * 0.8 + toy.phase) * 0.12;
  root.position.copy(toy.basePos).addScaledVector(toy.dir, scatter);
  root.position.y += bob;

  const wob = reduced ? 0 : 1;
  root.rotation.set(
    toy.baseRot.x + wob * Math.sin(t * 0.6 + toy.phase) * 0.08 + p * 1.5,
    toy.baseRot.y + toy.spin + wob * Math.cos(t * 0.5 + toy.phase) * 0.12 + p * (toy.phase % 3),
    toy.baseRot.z + (toy.kind === "cursor" ? -ptr.x * 0.25 : wob * Math.sin(t * 0.4 + toy.phase) * 0.05),
  );
  root.scale.setScalar(Math.max(0.0001, toy.baseScale * appear * (1 + toy.hover * 0.1 - toy.press * 0.14)));

  const P = toy.parts;
  switch (toy.kind) {
    case "toggle": {
      const knob = P.ToggleKnob;
      if (knob) knob.obj.position.x = damp(knob.obj.position.x, toy.on ? knob.base.x : -knob.base.x, 12, dt);
      const mat = (root as THREE.Mesh).material as THREE.MeshStandardMaterial;
      mat.color.lerp(toy.on ? ACCENT : CHARCOAL, 1 - Math.exp(-10 * dt));
      break;
    }
    case "slider": {
      const thumb = P.SliderThumb;
      const fill = P.SliderFill;
      if (!thumb || !fill) break;
      const idle = reduced ? 0 : Math.sin(t * 0.9 + toy.phase) * 0.18;
      const x = clamp(toy.value + idle, -0.9, 0.9);
      thumb.obj.position.x = damp(thumb.obj.position.x, x, 6, dt);
      const left = fill.base.x - 0.575; // fill box is 1.15 wide
      const width = Math.max(0.12, thumb.obj.position.x - left);
      fill.obj.scale.x = (width / 1.15) * fill.baseScale.x;
      fill.obj.position.x = left + width / 2;
      break;
    }
    case "button": {
      const cap = P.ButtonCap;
      if (cap) cap.obj.position.z = cap.base.z - toy.hover * 0.04 - toy.press * 0.12;
      break;
    }
    case "braces": {
      if (P.BraceL) P.BraceL.obj.position.x = P.BraceL.base.x - toy.hover * 0.28;
      if (P.BraceR) P.BraceR.obj.position.x = P.BraceR.base.x + toy.hover * 0.28;
      break;
    }
    case "logo": {
      if (P.LogoCursor) P.LogoCursor.obj.visible = reduced || Math.floor(t * 1.8) % 2 === 0;
      break;
    }
    case "checkbox": {
      const m = P.CheckMark;
      if (m) m.obj.scale.setScalar(Math.max(0.0001, damp(m.obj.scale.x, toy.on ? m.baseScale.x : 0, 14, dt)));
      break;
    }
  }
}

function Toys({ progress, pointer, entered, reduced, onReady }: ToysInput) {
  const { scene } = useGLTF(MODEL, DRACO);
  const group = useRef<THREE.Group>(null!);
  const size = useThree((s) => s.size);
  const enteredAt = useRef<number | null>(null);

  // Per-frame mutable state lives in refs (R3F convention), built once the model is in.
  const toysRef = useRef<Toy[]>([]);
  const byRoot = useRef(new Map<THREE.Object3D, Toy>());

  useLayoutEffect(() => {
    scene.traverse((o) => void rest(o)); // before anything below moves or hides an object
    const list: Toy[] = [];
    scene.children.forEach((root, i) => {
      const r = rest(root);
      const kind = String(root.userData.toy ?? "dot");
      const parts: Record<string, Part> = {};
      for (const n of ["ToggleKnob", "SliderThumb", "SliderFill", "ButtonCap", "BraceL", "BraceR", "LogoCursor", "CheckMark"]) {
        const p = part(root, n);
        if (p) parts[n] = p;
      }
      // Own material for the toggle track so turning it "off" doesn't recolour every accent part.
      if (kind === "toggle" && root instanceof THREE.Mesh && !root.userData.ownMaterial) {
        root.material = (root.material as THREE.Material).clone();
        root.userData.ownMaterial = true;
      }

      const flat = new THREE.Vector3(r.pos.x, r.pos.y, 0);
      const dir =
        kind === "cursor"
          ? new THREE.Vector3(-1.4, -1.1, 1.2) // the cursor dives toward the next section
          : flat.lengthSq() < 0.01
            ? new THREE.Vector3(0, 0, 1.4) // the centred logo flies at the camera
            : flat.normalize().add(new THREE.Vector3(0, 0, 0.5));

      list.push({
        root,
        kind,
        basePos: r.pos.clone(),
        baseRot: r.rot.clone(),
        baseScale: r.scale.x,
        dir,
        phase: i * 1.73,
        delay: kind === "logo" ? 0 : 0.08 + i * 0.06,
        hovered: false,
        hover: 0,
        press: 0,
        spin: 0,
        spinTarget: 0,
        on: true,
        value: 0.12,
        parts,
      });
      root.scale.setScalar(0.0001); // hidden until the entrance
    });
    toysRef.current = list;
    byRoot.current = new Map(list.map((t) => [t.root, t]));
  }, [scene]);

  const toyOf = (o: THREE.Object3D) => {
    while (o.parent && o.parent !== scene) o = o.parent;
    return byRoot.current.get(o);
  };

  useEffect(() => onReady(), [onReady]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const p = reduced ? 0 : (progress.current ?? 0);
    const ptr = pointer.current ?? { x: 0, y: 0 };
    if (entered.current && enteredAt.current === null) enteredAt.current = t;

    // Layout: right of the copy on desktop, under it on narrow screens.
    const narrow = size.width < 768;
    const g = group.current;
    g.position.set(narrow ? 0 : 2.35, narrow ? -1.35 : 0.05, 0);
    g.scale.setScalar(narrow ? 0.52 : Math.min(0.88, (size.width / size.height) * 0.5));
    g.rotation.y = damp(g.rotation.y, reduced ? 0 : ptr.x * 0.28, 3, dt);
    g.rotation.x = damp(g.rotation.x, reduced ? 0 : -ptr.y * 0.16, 3, dt);

    const scatter = p * p * 7;
    for (const toy of toysRef.current) stepToy(toy, { t, dt, p, ptr, scatter, enteredAt: enteredAt.current, reduced });
  });

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const toy = toyOf(e.object);
    if (!toy) return;
    toysRef.current.forEach((t) => (t.hovered = t === toy));
    document.body.style.cursor = "pointer";
  };
  const out = (e: ThreeEvent<PointerEvent>) => {
    const toy = toyOf(e.object);
    if (toy) toy.hovered = false;
    document.body.style.cursor = "";
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const toy = toyOf(e.object);
    if (!toy) return;
    toy.press = 1;
    switch (toy.kind) {
      case "toggle":
      case "checkbox":
        toy.on = !toy.on;
        break;
      case "slider":
        toy.value = THREE.MathUtils.randFloat(-0.8, 0.8);
        break;
      case "logo":
        toy.spinTarget += Math.PI * 2;
        break;
      case "button":
        setTimeout(() => scrollToSection("contact"), 250);
        break;
      default:
        toy.spinTarget += Math.PI;
    }
  };

  useEffect(() => () => void (document.body.style.cursor = ""), []);

  return (
    <group ref={group}>
      <primitive object={scene} onPointerOver={over} onPointerOut={out} onClick={click} />
    </group>
  );
}

export default function ToysCanvas({ active, ...input }: ToysInput & { active: boolean }) {
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.2, 12], fov: 30 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping }}
    >
      <ambientLight intensity={0.45} />
      <directionalLight position={[-4, 6, 6]} intensity={2.2} color="#FFF4E6" />
      <directionalLight position={[5, -2, 3]} intensity={0.6} color="#DDE6FF" />
      <Environment resolution={128}>
        <Lightformer form="rect" intensity={3} position={[-5, 5, 5]} scale={[6, 4, 1]} />
        <Lightformer form="rect" intensity={1.4} position={[5, 0, 4]} scale={[4, 6, 1]} color="#DDE6FF" />
        <Lightformer form="ring" intensity={2.2} position={[0, 4, -6]} scale={5} color="#FF8A4C" />
      </Environment>
      <Toys {...input} />
    </Canvas>
  );
}
