"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { WalkAnimator } from "./walk-animator";
import { chapterProgress, smoothDamp, WALK_CORNER, walkPath, walkTimeline, type WalkChapter } from "./walk-timeline";

function World({ progress, seek: seekRef, cut: cutRef, count, onChapter, onReady }: {
  progress: React.RefObject<number>; seek: React.RefObject<number | null>; cut: React.RefObject<boolean>; count: number; onChapter: (c: WalkChapter) => void; onReady: () => void;
}) {
  const cityAsset = useGLTF("/models/city-walk.glb", "/draco/");
  const walkerAsset = useGLTF("/models/walker.glb");
  const city = useMemo(() => cityAsset.scene.clone(true), [cityAsset.scene]);
  const walker = useMemo(() => clone(walkerAsset.scene), [walkerAsset.scene]);
  const actor = useRef<THREE.Group>(null);
  const animation = useRef<WalkAnimator | null>(null);
  const sim = useRef({ distance: 0, velocity: 0, walkTo: null as { distance: number; index: number } | null, direction: 1, yaw: Math.PI / 2, actorYaw: Math.PI / 2, key: "", snap: true, inspection: 0, ending: 0 });
  const cameraPosition = useMemo(() => new THREE.Vector3(), []);
  const cameraTarget = useMemo(() => new THREE.Vector3(), []);
  const cameraLook = useMemo(() => new THREE.Vector3(), []);
  const inspectionPosition = useMemo(() => new THREE.Vector3(), []);
  const inspectionTarget = useMemo(() => new THREE.Vector3(), []);
  const endPosition = useMemo(() => new THREE.Vector3(), []);
  const endTarget = useMemo(() => new THREE.Vector3(), []);
  const markerLabels = useRef<(HTMLSpanElement | null)[]>([]);
  const markers = useMemo(() => Array.from({ length: count }, (_, index) => {
    const distance = walkTimeline(chapterProgress(index, count), count).distance;
    return { distance, ...walkPath(distance) };
  }), [count]);

  useEffect(() => {
    city.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; }
      if ((o as THREE.PointLight).isPointLight) {
        // Blender's exported photometric intensity was >5,000 cd per lamp.
        const light = o as THREE.PointLight;
        light.intensity = 24;
        light.distance = 10;
        light.decay = 2;
      }
    });
    walker.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    animation.current = new WalkAnimator(walker, walkerAsset.animations);
    sim.current.snap = true;
    onReady();
    return () => { animation.current?.dispose(walker); animation.current = null; };
  }, [city, walker, walkerAsset.animations, onReady]);

  useFrame(({ camera }, delta) => {
    if (!actor.current) return;
    const dt = Math.min(delta, 0.05);
    const s = sim.current;
    // Skip: cut straight to wherever the scroll position says, no walking.
    if (cutRef.current) { cutRef.current = false; s.walkTo = null; s.snap = true; }
    // A chapter chip asks for a real walk to that stop, not a jump.
    if (seekRef.current !== null) {
      const stop = walkTimeline(seekRef.current, count);
      seekRef.current = null;
      if (Math.abs(stop.distance - s.distance) > 0.05) s.walkTo = { distance: stop.distance, index: stop.index };
    }
    const scrolled = walkTimeline(progress.current, count);
    const target = s.walkTo ? s.walkTo.distance : scrolled.distance;
    // A jump of a whole street (rewind to the start) is a cut, not a sprint.
    if (!s.walkTo && Math.abs(target - s.distance) > 25) s.snap = true;
    if (s.snap) { s.distance = target; s.velocity = 0; }
    const before = s.distance;
    // Scroll: a short glide that settles soon after the wheel stops.
    // Chip walk: accelerate to a brisk walking pace, cruise, and ease into the stop.
    const follow = s.walkTo
      ? smoothDamp(s.distance, target, s.velocity, 0.7, Math.min(2.5, Math.max(1.6, Math.abs(target - before) / 7)), dt)
      : smoothDamp(s.distance, target, s.velocity, 0.42, 3.4, dt);
    s.distance = follow.value;
    s.velocity = follow.velocity;
    if (s.walkTo && Math.abs(target - s.distance) < 0.02 && Math.abs(s.velocity) < 0.08) {
      s.distance = target;
      s.velocity = 0;
      s.walkTo = null;
    }
    // Cards and camera moves wait until the walker has actually reached the stop.
    const arrived = !s.walkTo && Math.abs(scrolled.distance - s.distance) < 0.15;
    const chapter: WalkChapter = s.walkTo || ((scrolled.kind === "entry" || scrolled.kind === "end") && !arrived)
      ? { kind: "travel", index: s.walkTo ? s.walkTo.index : scrolled.index }
      : scrolled;
    const inspecting = chapter.kind === "entry";
    s.inspection = THREE.MathUtils.damp(s.inspection, inspecting ? 1 : 0, 2.5, dt);
    if (s.snap) s.inspection = inspecting ? 1 : 0;
    // Journey's end: the camera comes round in front so the walker faces the viewer.
    const ending = chapter.kind === "end";
    s.ending = THREE.MathUtils.damp(s.ending, ending ? 1 : 0, 2.4, dt);
    if (s.snap) s.ending = ending ? 1 : 0;
    const distance = s.distance;
    markers.forEach((marker, index) => {
      const label = markerLabels.current[index];
      if (label) label.textContent = Math.abs(marker.distance - distance) < 0.4 ? "YOU ARE HERE" : `${Math.round(Math.abs(marker.distance - distance))} m`;
    });
    const change = distance - before;
    if (Math.abs(change) > 0.0005) s.direction = change > 0 ? 1 : -1;
    const route = walkPath(distance);
    const heading = route.yaw + (s.direction < 0 ? Math.PI : 0);
    s.yaw += Math.atan2(Math.sin(heading - s.yaw), Math.cos(heading - s.yaw)) * (1 - Math.exp(-5 * dt));
    if (s.snap) s.yaw = heading;
    actor.current.position.set(route.x, 0.12, route.z);
    // Face screen-right toward the information card, independently of travel heading.
    // This direction is the horizontal right vector of the checkpoint camera below.
    const cardHeading = Math.atan2(10, -2.6);
    // At the end, turn to face the end camera (placed ahead along the route).
    const facingCamera = route.yaw;
    const actorHeading = inspecting ? cardHeading : s.ending > 0.5 ? facingCamera : heading;
    s.actorYaw += Math.atan2(Math.sin(actorHeading - s.actorYaw), Math.cos(actorHeading - s.actorYaw)) * (1 - Math.exp(-3 * dt));
    if (s.snap) s.actorYaw = actorHeading;
    actor.current.rotation.y = s.actorYaw;
    const speed = s.snap ? 0 : Math.abs(change) / Math.max(dt, 0.001);
    animation.current?.update(speed, s.direction, distance > WALK_CORNER && distance < WALK_CORNER + Math.PI, dt);
    // Walking: a raised third-person view from the street side, angled toward the
    // shopfronts so their signs stay readable. Checkpoints pull out to an elevated
    // street-side view with room for the card.
    const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
    // Behind the walker in whichever direction it travels, but always on the street
    // side of the pavement (sides come from the route, not the travel heading), so
    // walking back to an earlier stop mirrors the view instead of entering the shops.
    const streetX = -Math.cos(route.yaw), streetZ = Math.sin(route.yaw);
    cameraPosition.set(route.x - fx * 5.2 + streetX * 2.4, 3.4, route.z - fz * 5.2 + streetZ * 2.4);
    cameraTarget.set(route.x + fx * 5 - streetX * 1.2, 2.3, route.z + fz * 5 - streetZ * 1.2);
    inspectionPosition.set(route.x + 5.2, 5.8, route.z + 8.4);
    inspectionTarget.set(route.x + 2.6, 1.1, route.z - 1.6);
    cameraPosition.lerp(inspectionPosition, s.inspection);
    cameraTarget.lerp(inspectionTarget, s.inspection);
    // In front of the walker, looking back at it. The look point sits to the walker's
    // screen-left, which places the walker in the right third beside the left-hand card.
    const rf = Math.sin(route.yaw), rz = Math.cos(route.yaw);
    const rightX = rz, rightZ = -rf; // camera's screen-right while looking back along the route
    endPosition.set(route.x + rf * 5.6 - rightX * 1.1, 1.75, route.z + rz * 5.6 - rightZ * 1.1);
    endTarget.set(route.x - rightX * 1.9, 1.25, route.z - rightZ * 1.9);
    cameraPosition.lerp(endPosition, s.ending);
    cameraTarget.lerp(endTarget, s.ending);
    const inspectingTransition = inspecting || s.inspection > 0.01 || ending || s.ending > 0.01;
    camera.position.lerp(cameraPosition, s.snap || !inspectingTransition ? 1 : 1 - Math.exp(-7 * dt));
    cameraLook.lerp(cameraTarget, s.snap || !inspectingTransition ? 1 : 1 - Math.exp(-5 * dt));
    camera.lookAt(cameraLook);
    s.snap = false;
    const key = `${chapter.kind}:${chapter.index}`;
    if (key !== s.key) { s.key = key; onChapter(chapter); }
  });

  return <>
    <primitive object={city} />
    {markers.map((marker, index) => <group key={index} position={[marker.x, 0.13, marker.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.65, 0.83, 48]} />
        <meshBasicMaterial color="#ffc18e" transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, 2.65, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.22, 0.42, 4]} />
        <meshStandardMaterial color="#ffc18e" emissive="#ff9d4d" emissiveIntensity={0.8} />
      </mesh>
      <Html position={[0, 3.15, 0]} center distanceFactor={9} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap rounded-lg border border-[#ffc18e]/60 bg-[#142139]/95 px-3 py-2 text-center font-mono text-[11px] text-[#ffc18e]">
          CHECKPOINT {String(index + 1).padStart(2, "0")}<br />
          <span ref={el => { markerLabels.current[index] = el; }} className="text-[9px] text-white/80" />
        </div>
      </Html>
    </group>)}
    <group ref={actor}><primitive object={walker} /></group>
  </>;
}

export default function CityWalkCanvas({ active, ...props }: {
  active: boolean; progress: React.RefObject<number>; seek: React.RefObject<number | null>; cut: React.RefObject<boolean>; count: number;
  onChapter: (c: WalkChapter) => void; onReady: () => void;
}) {
  return <Canvas shadows frameloop={active ? "always" : "never"} dpr={[1, 1.5]}
    camera={{ position: [-30, 15, 28], fov: 42, near: 0.1, far: 180 }}
    gl={{ antialias: true, toneMapping: THREE.AgXToneMapping, toneMappingExposure: 0.95 }}>
    <color attach="background" args={["#263E65"]} />
    <fog attach="fog" args={["#263E65", 65, 150]} />
    <hemisphereLight args={["#9DBBFF", "#4C3445", 0.65]} />
    <directionalLight position={[-15, 38, 20]} intensity={1.25} color="#FFD5A6" castShadow
      shadow-mapSize={[2048, 2048]} shadow-camera-left={-85} shadow-camera-right={85}
      shadow-camera-top={55} shadow-camera-bottom={-55} shadow-camera-far={180} shadow-bias={-0.0003} />
    <Suspense fallback={null}>
      <Environment files="/hdri/lago_disola_1k.hdr" environmentIntensity={0.12} />
      <World {...props} />
    </Suspense>
  </Canvas>;
}
