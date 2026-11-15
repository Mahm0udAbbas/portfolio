"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, useGLTF, useTexture } from "@react-three/drei";
import { SkiRunSim, type TreeData } from "./ski-sim";

const MODEL = "/models/ski-run.glb";
const TREES = "/models/ski-trees.json";
const DRACO = "/draco/";
const TEX = { snow: "/textures/ski/snow_field_aerial_diff.jpg", rock: "/textures/ski/aerial_rocks_02_diff.jpg" };
useGLTF.preload(MODEL, DRACO);

const PAGE_BG = "#EEF0F4"; // haze fades the far range into the page

function Run({ progress, reduced }: { progress: React.RefObject<number>; reduced: boolean }) {
  const { scene } = useGLTF(MODEL, DRACO);
  const tex = useTexture(TEX, (t) => {
    for (const x of Array.isArray(t) ? t : [t]) {
      x.wrapS = x.wrapT = THREE.RepeatWrapping;
      x.colorSpace = THREE.SRGBColorSpace;
      x.anisotropy = 8;
    }
  });
  const camera = useThree((s) => s.camera);
  const [sim] = useState(() => new SkiRunSim());

  useLayoutEffect(() => {
    sim.attach(scene, camera, tex, reduced);
    return () => sim.dispose();
  }, [sim, scene, camera, tex, reduced]);

  useEffect(() => {
    let alive = true;
    fetch(TREES)
      .then((r) => r.json() as Promise<TreeData>)
      .then((data) => alive && sim.addTrees(scene, data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [sim, scene]);

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
      shadows
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.6]}
      camera={{ position: [0, 120, 120], fov: 40, near: 0.3, far: 1600 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.AgXToneMapping, toneMappingExposure: 1.05 }}
    >
      <fog attach="fog" args={[PAGE_BG, 220, 720]} />
      <hemisphereLight args={["#E8F0FF", "#9AA4B4", 0.35]} />
      <Environment files="/hdri/lago_disola_1k.hdr" environmentIntensity={1} />
      <Run progress={progress} reduced={reduced} />
    </Canvas>
  );
}
