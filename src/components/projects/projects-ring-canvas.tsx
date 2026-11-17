"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Center, ContactShadows, Environment, Lightformer, Text3D } from "@react-three/drei";
import { gsap } from "gsap";
import { CARD_H, CARD_RADIUS, CARD_W, type RingAssets } from "./ring-assets";

/** Imperative handle the DOM wrapper drives the ring with. */
export type RingControl = {
  /** Fly card `i` out of the ring to face the viewer, then report its screen box via `onPresented`. */
  open: (i: number) => void;
  /** Put the presented card back in the ring. `onShown` fires on the first frame it's visible again. */
  release: (onShown: () => void) => void;
  /** Turn the ring so card `i` faces front (keyboard focus); `null` lets it spin again. */
  face: (i: number | null) => void;
};

export type ScreenBox = { left: number; top: number; width: number; height: number };

const SPIN = 0.22; // rad/s while idle
const HOVER_SPIN = 0.15; // fraction of SPIN while the pointer is over the stage
const TEXT_EM = 7.746; // width of "PROJECTS" in Geist Black, in ems
const ELEVATION = 0.17; // camera pitch above the ring (rad)
const LOOK_Y = 1.25;
const PRESENT_FILL = 0.66; // presented card height as a fraction of the view
const BODY_DEPTH = 0.05;
const BEVEL = 0.014;
const FACE_Z = BODY_DEPTH / 2 + BEVEL + 0.002;

/** Wide screens get the big word and a ring that fits fully; narrow ones zoom in on the word. */
const layoutFor = (aspect: number) =>
  aspect >= 1.05 ? { wide: true, text: 1.6, radius: 7.2 } : { wide: false, text: 0.95, radius: 4.8 };

function cardShape() {
  const w = CARD_W / 2;
  const h = CARD_H / 2;
  const r = CARD_RADIUS;
  const s = new THREE.Shape();
  s.moveTo(-w + r, -h);
  s.lineTo(w - r, -h);
  s.quadraticCurveTo(w, -h, w, -h + r);
  s.lineTo(w, h - r);
  s.quadraticCurveTo(w, h, w - r, h);
  s.lineTo(-w + r, h);
  s.quadraticCurveTo(-w, h, -w, h - r);
  s.lineTo(-w, -h + r);
  s.quadraticCurveTo(-w, -h, -w + r, -h);
  return s;
}

function useCardGeometry() {
  return useMemo(() => {
    const shape = cardShape();
    const face = new THREE.ShapeGeometry(shape, 10);
    const pos = face.attributes.position;
    const uv = face.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / CARD_W + 0.5, pos.getY(i) / CARD_H + 0.5);
    uv.needsUpdate = true;
    const body = new THREE.ExtrudeGeometry(shape, {
      depth: BODY_DEPTH,
      bevelEnabled: true,
      bevelThickness: BEVEL,
      bevelSize: BEVEL,
      bevelSegments: 3,
      curveSegments: 10,
    });
    body.translate(0, 0, -BODY_DEPTH / 2);
    return { face, body };
  }, []);
}

const texture = (c: HTMLCanvasElement) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

const easeOutBack = (x: number) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

type Props = {
  assets: RingAssets;
  count: number;
  running: boolean;
  intro: boolean;
  controlRef: React.RefObject<RingControl | null>;
  onPresented: (i: number, box: ScreenBox) => void;
  onHover: (i: number | null) => void;
};

function Ring({ assets, count, intro, controlRef, onPresented, onHover }: Omit<Props, "running">) {
  const { camera, size, gl } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const layout = layoutFor(size.width / size.height);
  const ring = useRef<THREE.Group>(null);
  const word = useRef<THREE.Group>(null);
  const cards = useRef<(THREE.Group | null)[]>([]);
  const geo = useCardGeometry();
  const maps = useMemo(
    () => ({ fronts: assets.fronts.map(texture), backs: assets.backs.map(texture) }),
    [assets],
  );
  useEffect(
    () => () => {
      maps.fronts.forEach((t) => t.dispose());
      maps.backs.forEach((t) => t.dispose());
    },
    [maps],
  );

  // All per-frame state lives here, outside React.
  const stateRef = useRef({
    angle: 0.35,
    vel: SPIN,
    over: false,
    drag: false,
    lastX: 0,
    lastT: 0,
    moved: 0,
    hovered: -1,
    faced: null as number | null,
    phase: "idle" as "idle" | "opening" | "presented" | "releasing",
    focus: -1,
    hidden: -1,
    onShown: null as (() => void) | null,
    anim: { focus: 0, intro: 0 },
    lift: [] as number[],
  });

  const tmp = useMemo(
    () => ({
      v: new THREE.Vector3(),
      slotPos: new THREE.Vector3(),
      slotQuat: new THREE.Quaternion(),
      ringQuat: new THREE.Quaternion(),
      pose: { pos: new THREE.Vector3(), quat: new THREE.Quaternion() },
      m: new THREE.Matrix4(),
      e: new THREE.Euler(),
      one: new THREE.Vector3(1, 1, 1),
    }),
    [],
  );

  // Fit the camera to the layout: every card on the ring (wide) or the word + front card (narrow).
  useEffect(() => {
    const textHalf = (TEXT_EM * layout.text) / 2;
    const pts: THREE.Vector3[] = [];
    for (const x of [-textHalf, textHalf]) for (const y of [0, layout.text * 0.75]) pts.push(new THREE.Vector3(x, y, 0.4));
    const steps = layout.wide ? 36 : 1;
    for (let k = 0; k < steps; k++) {
      const phi = (k / steps) * Math.PI * 2;
      const c = new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi)).multiplyScalar(layout.radius);
      const t = new THREE.Vector3(Math.cos(phi), 0, -Math.sin(phi)).multiplyScalar(CARD_W / 2);
      for (const sign of [-1, 1]) for (const y of [0, CARD_H + 0.15]) pts.push(c.clone().addScaledVector(t, sign).setY(y));
    }
    const target = new THREE.Vector3(0, LOOK_Y, 0);
    const place = (d: number) => {
      cam.position.set(0, LOOK_Y + Math.sin(ELEVATION) * d, Math.cos(ELEVATION) * d);
      cam.lookAt(target);
      cam.updateMatrixWorld();
    };
    const fits = (d: number) => {
      place(d);
      return pts.every((p) => {
        const v = p.clone().project(cam);
        return Math.abs(v.x) < 0.94 && v.y < 0.8 && v.y > -0.86 && v.z < 1;
      });
    };
    let lo = 6;
    let hi = 120;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    place(hi);
  }, [cam, layout.radius, layout.text, layout.wide, size.width, size.height]);

  // Intro: the word rises and the cards pop into their slots once the page is ready.
  useEffect(() => {
    if (!intro) return;
    const s = stateRef.current;
    const t = gsap.to(s.anim, { intro: 1, duration: 2.2, ease: "none" });
    return () => void t.kill();
  }, [intro]);

  // Drag to spin (horizontal only — vertical swipes keep scrolling the page).
  useEffect(() => {
    const el = gl.domElement;
    const s = stateRef.current;
    const down = (e: PointerEvent) => {
      s.drag = true;
      s.moved = 0;
      s.lastX = e.clientX;
      s.lastT = performance.now();
    };
    const move = (e: PointerEvent) => {
      if (!s.drag || s.phase !== "idle") return;
      const now = performance.now();
      const dx = e.clientX - s.lastX;
      const da = (dx / el.clientWidth) * Math.PI * 1.1;
      const dt = Math.max(1, now - s.lastT) / 1000;
      s.moved += Math.abs(dx);
      s.angle += da;
      s.vel = THREE.MathUtils.clamp(THREE.MathUtils.lerp(s.vel, da / dt, 0.5), -5, 5);
      s.lastX = e.clientX;
      s.lastT = now;
      if (s.moved > 6) s.faced = null;
    };
    const up = () => {
      s.drag = false;
      if (performance.now() - s.lastT > 90) s.vel *= 0.2; // held still before letting go: no fling
    };
    const enter = () => (s.over = true);
    const leave = () => {
      s.over = false;
      up();
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
    };
  }, [gl]);

  // Where a presented card sits: centred in front of the camera, facing it.
  const presentPose = (out: { pos: THREE.Vector3; quat: THREE.Quaternion }) => {
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const d = Math.max(CARD_H / (PRESENT_FILL * 2 * tanHalf), CARD_W / (0.86 * 2 * tanHalf * cam.aspect));
    out.pos.copy(cam.position).addScaledVector(cam.getWorldDirection(tmp.v), d);
    out.quat.copy(cam.quaternion);
  };

  const screenBox = (card: THREE.Object3D): ScreenBox => {
    const rect = gl.domElement.getBoundingClientRect();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const v = tmp.v.set((x * CARD_W) / 2, (y * CARD_H) / 2, FACE_Z).applyMatrix4(card.matrixWorld).project(cam);
      const px = rect.left + ((v.x + 1) / 2) * rect.width;
      const py = rect.top + ((1 - v.y) / 2) * rect.height;
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }
    return { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
  };

  useEffect(() => {
    const s = stateRef.current;
    controlRef.current = {
      open(i) {
        if (s.phase !== "idle") return;
        s.phase = "opening";
        s.focus = i;
        s.faced = null;
        gsap.fromTo(
          s.anim,
          { focus: 0 },
          {
            focus: 1,
            duration: 0.95,
            ease: "power3.inOut",
            onComplete: () => {
              const card = cards.current[i];
              if (!card) return;
              card.updateMatrixWorld(true);
              s.phase = "presented";
              s.hidden = i;
              onPresented(i, screenBox(card));
            },
          },
        );
      },
      release(onShown) {
        if (s.phase !== "presented") return onShown();
        s.phase = "releasing";
        s.hidden = -1;
        s.onShown = onShown;
        gsap.to(s.anim, {
          focus: 0,
          duration: 0.9,
          ease: "power3.inOut",
          onComplete: () => {
            s.phase = "idle";
            s.focus = -1;
            s.vel = 0;
          },
        });
      },
      face(i) {
        s.faced = i;
      },
    };
    return () => {
      controlRef.current = null;
    };
    // screenBox/presentPose only read refs + stable three objects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlRef, onPresented]);

  useFrame((state, delta) => {
    const s = stateRef.current;
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const g = ring.current;
    if (!g) return;
    const step = Math.PI * 2 / count;

    // Ring spin
    if (s.phase !== "idle") {
      s.vel *= Math.exp(-6 * dt);
      s.angle += s.vel * dt;
    } else if (s.faced !== null) {
      const goal = s.angle + wrapAngle(-s.faced * step - s.angle);
      s.angle += (goal - s.angle) * (1 - Math.exp(-4 * dt));
      s.vel = 0;
    } else if (!s.drag) {
      const target = s.over ? SPIN * HOVER_SPIN : SPIN;
      s.vel += (target - s.vel) * (1 - Math.exp(-(Math.abs(s.vel) > SPIN * 1.5 ? 1.4 : 2.6) * dt));
      s.angle += s.vel * dt;
    }
    g.rotation.y = s.angle;
    g.updateMatrixWorld();

    // Intro
    const intro = s.anim.intro;
    if (word.current) {
      const k = 1 - Math.pow(1 - clamp01(intro / 0.55), 3);
      word.current.position.y = (k - 1) * 1.6;
      word.current.scale.setScalar(0.6 + 0.4 * k);
    }

    tmp.ringQuat.copy(g.quaternion).invert();
    for (let i = 0; i < count; i++) {
      const card = cards.current[i];
      if (!card) continue;
      const phi = i * step;
      const pop = easeOutBack(clamp01((intro - 0.25 - i * 0.09) / 0.5));
      const hovered = (s.hovered === i || s.faced === i) && s.phase === "idle";
      s.lift[i] = THREE.MathUtils.lerp(s.lift[i] ?? 0, hovered ? 1 : 0, 1 - Math.exp(-10 * dt));
      const out = layout.radius + s.lift[i] * 0.35;
      const bob = Math.sin(t * 1.1 + i * 1.7) * 0.07;

      tmp.slotPos.set(Math.sin(phi) * out, CARD_H / 2 + 0.12 + bob + s.lift[i] * 0.12, Math.cos(phi) * out);
      tmp.slotQuat.setFromEuler(tmp.e.set(0, phi, 0));

      if (i === s.focus && s.anim.focus > 0) {
        // Blend the ring slot (in world space) toward the presented pose, then back into ring space.
        const f = s.anim.focus;
        presentPose(tmp.pose);
        const worldSlot = tmp.slotPos.clone().applyMatrix4(g.matrixWorld);
        const worldQuat = g.quaternion.clone().multiply(tmp.slotQuat);
        worldSlot.lerp(tmp.pose.pos, f);
        worldSlot.y += Math.sin(f * Math.PI) * 0.5;
        worldQuat.slerp(tmp.pose.quat, f);
        g.worldToLocal(worldSlot);
        card.position.copy(worldSlot);
        card.quaternion.copy(tmp.ringQuat).multiply(worldQuat);
        card.scale.setScalar(1);
      } else {
        card.position.copy(tmp.slotPos);
        card.quaternion.copy(tmp.slotQuat);
        card.scale.setScalar(Math.max(0.0001, pop * (1 + s.lift[i] * 0.05)));
      }
      card.visible = s.hidden !== i;
    }

    if (s.onShown && s.hidden === -1) {
      const cb = s.onShown;
      s.onShown = null;
      cb(); // same frame the card is drawn again, so the DOM stand-in can disappear without a flicker
    }
  });

  const setHover = (i: number | null) => {
    stateRef.current.hovered = i ?? -1;
    onHover(i);
  };

  return (
    <>
      <group ref={word}>
        <Center position={[0, layout.text * 0.36, 0]}>
          <Text3D
            font={assets.font as never}
            size={layout.text}
            height={layout.text * 0.36}
            curveSegments={10}
            bevelEnabled
            bevelThickness={layout.text * 0.04}
            bevelSize={layout.text * 0.022}
            bevelSegments={5}
            letterSpacing={-0.01 * layout.text}
          >
            PROJECTS
            <meshPhysicalMaterial color="#FF8A4C" roughness={0.28} clearcoat={1} clearcoatRoughness={0.12} />
          </Text3D>
        </Center>
      </group>

      <group ref={ring}>
        {Array.from({ length: count }, (_, i) => (
          <group
            key={i}
            ref={(el) => void (cards.current[i] = el)}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHover(i);
            }}
            onPointerOut={() => stateRef.current.hovered === i && setHover(null)}
            onClick={(e) => {
              e.stopPropagation();
              if (stateRef.current.moved > 6) return; // that was a drag
              controlRef.current?.open(i);
            }}
          >
            <mesh geometry={geo.body}>
              <meshPhysicalMaterial color="#ffffff" roughness={0.35} clearcoat={0.6} clearcoatRoughness={0.2} />
            </mesh>
            <mesh geometry={geo.face} position-z={FACE_Z}>
              <meshBasicMaterial map={maps.fronts[i]} toneMapped={false} />
            </mesh>
            <mesh geometry={geo.face} position-z={-FACE_Z} rotation-y={Math.PI}>
              <meshBasicMaterial map={maps.backs[i]} toneMapped={false} />
            </mesh>
          </group>
        ))}
      </group>

      <ContactShadows position={[0, 0, 0]} scale={layout.radius * 3.2} far={4} blur={2.6} opacity={0.32} resolution={512} />
    </>
  );
}

export default function ProjectsRingCanvas({ running, ...props }: Props) {
  return (
    <Canvas
      frameloop={running ? "always" : "never"}
      dpr={[1, 1.75]}
      camera={{ position: [0, 4, 20], fov: 32 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping }}
      style={{ touchAction: "pan-y" }}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[-5, 9, 7]} intensity={1.8} color="#FFF4E6" />
      <Environment resolution={128}>
        <Lightformer form="rect" intensity={3} position={[-6, 6, 6]} scale={[7, 4, 1]} />
        <Lightformer form="rect" intensity={1.4} position={[7, 2, 5]} scale={[4, 6, 1]} color="#DDE6FF" />
        <Lightformer form="ring" intensity={2} position={[0, 5, -7]} scale={5} color="#FF8A4C" />
      </Environment>
      <Ring {...props} />
    </Canvas>
  );
}
