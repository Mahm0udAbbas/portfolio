"use client";

import { useLayoutEffect, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, useGLTF } from "@react-three/drei";
import { SkiRunSim } from "./ski-sim";

const MODEL = "/models/ski-run.glb";
const DRACO = "/draco/";
useGLTF.preload(MODEL, DRACO);

const PAGE_BG = "#EEF0F4"; // fog fades the far mountains into the page

function Run({ progress, reduced }: { progress: React.RefObject<number>; reduced: boolean }) {
  const { scene } = useGLTF(MODEL, DRACO);
  const camera = useThree((s) => s.camera);
  const [sim] = useState(() => new SkiRunSim());

  useLayoutEffect(() => {
    sim.attach(scene, camera, reduced);
    return () => sim.dispose();
  }, [sim, scene, camera, reduced]);

  useFrame((state, dt) => sim.update(progress.current ?? 0, Math.min(dt, 0.05), state.clock.elapsedTime));

  return (
    <>
      <primitive object={scene} />
      <primitive object={sim.root} />
    </>
  );
}

export default function SkiCanvas({
  active,
  progress,
  reduced,
}: {
  active: boolean;
  progress: React.RefObject<number>;
  reduced: boolean;
}) {
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.75]}
      camera={{ position: [0, 20, 20], fov: 42, near: 0.1, far: 200 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping }}
    >
      <fog attach="fog" args={[PAGE_BG, 28, 85]} />
      <hemisphereLight args={["#FFFFFF", "#B9C3D6", 1.1]} />
      <directionalLight position={[-20, 40, 20]} intensity={2.1} color="#FFF6EC" />
      <Environment resolution={128}>
        <Lightformer form="rect" intensity={3} position={[-8, 10, 8]} scale={[10, 6, 1]} />
        <Lightformer form="rect" intensity={1.6} position={[10, 4, 6]} scale={[6, 8, 1]} color="#DDE6FF" />
        <Lightformer form="ring" intensity={1.6} position={[0, 8, -10]} scale={6} color="#FF8A4C" />
      </Environment>
      <Run progress={progress} reduced={reduced} />
    </Canvas>
  );
}
