"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { 
  Sphere, 
  MeshDistortMaterial, 
  Float, 
  Sparkles,
} from "@react-three/drei";
import * as THREE from "three";

function GroupModel() {
  const groupRef = useRef<THREE.Group>(null);
  
  // Follow mouse movement slightly
  useFrame((state) => {
    if (groupRef.current) {
      const targetX = (state.pointer.x * 0.5);
      const targetY = (state.pointer.y * 0.5);
      
      groupRef.current.rotation.x += 0.05 * (targetY - groupRef.current.rotation.x);
      groupRef.current.rotation.y += 0.05 * (targetX - groupRef.current.rotation.y);
    }
  });

  return (
    <group ref={groupRef}>
      <Float speed={2} rotationIntensity={1.5} floatIntensity={1.5}>
        <AICore />
      </Float>
      {/* Outer interactive ring */}
      <mesh>
        <torusGeometry args={[2.2, 0.02, 16, 100]} />
        <meshStandardMaterial color="#f472b6" transparent opacity={0.3} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.5, 0.01, 16, 100]} />
        <meshStandardMaterial color="#818cf8" transparent opacity={0.2} />
      </mesh>
    </group>
  );
}

function AICore() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.15;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.2;
    }
  });

  return (
    <group>
      <Sphere ref={meshRef} args={[1.3, 64, 64]}>
        <MeshDistortMaterial 
          color="#a78bfa" 
          attach="material" 
          distort={0.4} 
          speed={2.5} 
          roughness={0.2}
          metalness={0.8}
        />
      </Sphere>
      {/* Transparent outer shell */}
      <Sphere args={[1.5, 32, 32]}>
        <meshPhysicalMaterial 
          color="#c084fc" 
          transparent 
          opacity={0.15} 
          roughness={0.1}
          metalness={0.9}
          wireframe
        />
      </Sphere>
    </group>
  );
}

export function AIVisualizer() {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 20, 5]} intensity={2.5} color="#ec4899" />
        <directionalLight position={[-10, -20, -5]} intensity={2} color="#818cf8" />
        <pointLight position={[0, 0, 0]} intensity={30} distance={10} color="#c084fc" />
        
        <GroupModel />

        <Sparkles 
          count={150} 
          scale={10} 
          size={2} 
          speed={0.4} 
          opacity={0.6} 
          color="#fbcfe8" 
        />
      </Canvas>
    </div>
  );
}
