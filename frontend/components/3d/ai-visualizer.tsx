"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { 
  Sphere, 
  Float, 
  Sparkles,
} from "@react-three/drei";
import * as THREE from "three";

function createEarthTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return null;
  }

  const oceanGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  oceanGradient.addColorStop(0, "#1d4ed8");
  oceanGradient.addColorStop(0.5, "#1e40af");
  oceanGradient.addColorStop(1, "#172554");
  ctx.fillStyle = oceanGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const drawContinent = (x: number, y: number, r: number, color: string) => {
    ctx.beginPath();
    for (let i = 0; i < 14; i += 1) {
      const angle = (i / 14) * Math.PI * 2;
      const wobble = 0.7 + Math.sin(i * 1.7) * 0.2;
      const radius = r * wobble;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };

  drawContinent(320, 380, 170, "#84cc16");
  drawContinent(500, 520, 110, "#65a30d");
  drawContinent(780, 360, 230, "#4d7c0f");
  drawContinent(1090, 500, 150, "#65a30d");
  drawContinent(1320, 330, 200, "#4d7c0f");
  drawContinent(1660, 420, 160, "#84cc16");
  drawContinent(1830, 620, 90, "#65a30d");

  for (let i = 0; i < 35; i += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const size = 12 + Math.random() * 24;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function createCloudTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return null;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 180; i += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const w = 60 + Math.random() * 180;
    const h = 20 + Math.random() * 60;
    const alpha = 0.06 + Math.random() * 0.18;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function EarthGlobe() {
  const earthRef = useRef<THREE.Mesh>(null);
  const cloudRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);
  const earthMap = useMemo(() => createEarthTexture(), []);
  const cloudMap = useMemo(() => createCloudTexture(), []);

  useFrame((state) => {
    if (earthRef.current) {
      earthRef.current.rotation.y = state.clock.elapsedTime * 0.16;
    }
    if (cloudRef.current) {
      cloudRef.current.rotation.y = state.clock.elapsedTime * 0.2;
    }
    if (atmosphereRef.current) {
      atmosphereRef.current.rotation.y = -state.clock.elapsedTime * 0.04;
    }
  });

  return (
    <group>
      <Sphere ref={earthRef} args={[1.35, 96, 96]}>
        <meshStandardMaterial
          map={earthMap ?? undefined}
          roughness={0.88}
          metalness={0.02}
          emissive="#0f172a"
          emissiveIntensity={0.16}
        />
      </Sphere>

      <Sphere ref={cloudRef} args={[1.39, 96, 96]}>
        <meshStandardMaterial
          map={cloudMap ?? undefined}
          transparent
          opacity={0.46}
          depthWrite={false}
        />
      </Sphere>

      <Sphere ref={atmosphereRef} args={[1.47, 48, 48]}>
        <meshPhongMaterial
          color="#93c5fd"
          transparent
          opacity={0.14}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
        />
      </Sphere>

      <mesh rotation={[Math.PI / 5, 0, 0]}>
        <torusGeometry args={[2.05, 0.01, 20, 180]} />
        <meshBasicMaterial color="#f472b6" transparent opacity={0.2} />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.25, 0.008, 20, 180]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0.16} />
      </mesh>
    </group>
  );
}

function GroupModel() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      const targetX = state.pointer.x * 0.45;
      const targetY = state.pointer.y * 0.35;

      groupRef.current.rotation.x += 0.05 * (targetY - groupRef.current.rotation.x);
      groupRef.current.rotation.y += 0.05 * (targetX - groupRef.current.rotation.y);
    }
  });

  return (
    <group ref={groupRef}>
      <Float speed={1.6} rotationIntensity={0.5} floatIntensity={0.9}>
        <EarthGlobe />
      </Float>
    </group>
  );
}

export function AIVisualizer() {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
        <ambientLight intensity={0.42} color="#dbeafe" />
        <directionalLight position={[5, 2, 5]} intensity={1.9} color="#fff7ed" />
        <directionalLight position={[-5, -2, -4]} intensity={1.2} color="#93c5fd" />
        <pointLight position={[0, 0, 4]} intensity={10} distance={12} color="#bfdbfe" />
        
        <GroupModel />

        <Sparkles 
          count={95} 
          scale={10} 
          size={1.8} 
          speed={0.25} 
          opacity={0.5} 
          color="#fde68a" 
        />
      </Canvas>
    </div>
  );
}
