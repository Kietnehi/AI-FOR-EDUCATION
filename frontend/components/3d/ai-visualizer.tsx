"use client";

import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { 
  Float, 
  Sparkles,
  Sphere,
  Icosahedron,
  Box,
  Cylinder,
  Ring,
  MeshTransmissionMaterial,
  useTexture
} from "@react-three/drei";
import * as THREE from "three";

// The sophisticated, high-resolution Digital Planet
function DigitalPlanet() {
  const innerGlobeRef = useRef<THREE.Mesh>(null);
  const meshLayerRef = useRef<THREE.Mesh>(null);
  const outerLinesRef = useRef<THREE.Mesh>(null);
  
  // Load Earth texture
  const earthTexture = useTexture("https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg");

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (innerGlobeRef.current) {
      innerGlobeRef.current.rotation.y = t * 0.05;
    }
    if (meshLayerRef.current) {
      meshLayerRef.current.rotation.y = t * 0.08;
      meshLayerRef.current.rotation.x = t * 0.02;
    }
    if (outerLinesRef.current) {
      outerLinesRef.current.rotation.y = -t * 0.04;
      outerLinesRef.current.rotation.z = t * 0.01;
    }
  });

  return (
    <group>
      {/* Core - Earth Map */}
      <Sphere ref={innerGlobeRef} args={[1.35, 64, 64]} rotation={[0, -Math.PI / 2, 0]}>
        <meshStandardMaterial
          map={earthTexture}
          color="#a5b4fc"
          emissive="#1e3a8a"
          emissiveIntensity={0.2}
          roughness={0.6}
          metalness={0.2}
        />
      </Sphere>

      {/* Inner Data Mesh - intricate lattice of land patterns */}
      <Icosahedron ref={meshLayerRef} args={[1.38, 8]}>
        <meshBasicMaterial
          color="#38bdf8"
          wireframe
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
        />
      </Icosahedron>

      {/* Outer Data Mesh - glowing neural network lines */}
      <Icosahedron ref={outerLinesRef} args={[1.42, 6]}>
        <meshStandardMaterial
          color="#c084fc"
          emissive="#8b5cf6"
          emissiveIntensity={2}
          wireframe
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
        />
      </Icosahedron>

      {/* Glassy Atmosphere Effect */}
      <Sphere args={[1.48, 32, 32]}>
        <MeshTransmissionMaterial
          backside
          samples={2}
          thickness={0.1}
          chromaticAberration={0.3}
          anisotropy={0.1}
          distortion={0.2}
          distortionScale={0.1}
          temporalDistortion={0.05}
          color="#e0f2fe"
          transmission={0.9}
          roughness={0.2}
        />
      </Sphere>

      {/* Embedded glowing data nodes */}
      <PointsCloud globeRadius={1.39} />
    </group>
  );
}

function PointsCloud({ globeRadius }: { globeRadius: number }) {
  const pointsCount = 300;
  const positions = useMemo(() => {
    const pos = new Float32Array(pointsCount * 3);
    for (let i = 0; i < pointsCount; i++) {
      const phi = Math.acos(-1 + (2 * i) / pointsCount);
      const theta = Math.sqrt(pointsCount * Math.PI) * phi;
      const r = globeRadius + (Math.random() * 0.05);
      pos[i * 3] = r * Math.cos(theta) * Math.sin(phi);
      pos[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return pos;
  }, [globeRadius]);

  const pointsRef = useRef<THREE.Points>(null);
  useFrame((state) => {
    if (pointsRef.current) {
      // Pulse size and rotate
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.06;
      const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.2;
      pointsRef.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={pointsCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.015}
        color="#818cf8"
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

// Intertwined glowing data fiber pathways and abstract icons
function OrbitalRings() {
  const ringGroupRef = useRef<THREE.Group>(null);
  const dataPacketsRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ringGroupRef.current) {
      ringGroupRef.current.rotation.x = Math.sin(t * 0.1) * 0.1 + 0.2;
      ringGroupRef.current.rotation.y = t * 0.1;
    }
    if (dataPacketsRef.current) {
      dataPacketsRef.current.rotation.y = -t * 0.3;
      dataPacketsRef.current.rotation.z = Math.cos(t * 0.2) * 0.1;
    }
  });

  return (
    <group>
      {/* Futuristic Rings */}
      <group ref={ringGroupRef}>
        <Ring args={[2.2, 2.21, 64]} rotation={[Math.PI / 2.2, 0.1, 0]}>
          <meshBasicMaterial color="#ec4899" transparent opacity={0.6} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
        </Ring>
        <Ring args={[2.5, 2.508, 64]} rotation={[-Math.PI / 2.5, -0.2, 0]}>
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.5} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
        </Ring>
        <Ring args={[2.8, 2.805, 64]} rotation={[Math.PI / 2, 0, Math.PI / 6]}>
          <meshBasicMaterial color="#a78bfa" transparent opacity={0.4} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
        </Ring>

        {/* Orbiting Educational Resources as glowing stylized UI objects */}
        <ResourceSatellites />
      </group>

      {/* Moving Data Packets */}
      <group ref={dataPacketsRef}>
        {Array.from({ length: 15 }).map((_, i) => {
          const angle = (i / 15) * Math.PI * 2;
          return (
            <group key={i} position={[Math.cos(angle) * 2.35, Math.sin(i * 2) * 0.15, Math.sin(angle) * 2.35]}>
              <Sphere args={[0.015, 8, 8]}>
                <meshBasicMaterial color="#fcd34d" transparent opacity={0.9} blending={THREE.AdditiveBlending} />
              </Sphere>
              <pointLight distance={0.5} color="#fcd34d" intensity={0.5} />
            </group>
          );
        })}
      </group>
    </group>
  );
}

// High-fidelity abstract representation of educational nodes
function ResourceSatellites() {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = -state.clock.elapsedTime * 0.05;
    }
  });
  
  return (
    <group ref={groupRef}>
      {/* 1. Presentation Deck (Slide) */}
      <Float speed={2} rotationIntensity={1} floatIntensity={1} position={[2.2, 0.2, 0]}>
        <group>
          <Box args={[0.2, 0.12, 0.01]}>
            <meshPhysicalMaterial color="#f472b6" emissive="#be185d" emissiveIntensity={1} transmission={0.5} />
          </Box>
          <Box args={[0.16, 0.08, 0.01]} position={[0, 0, 0.011]}>
            <meshBasicMaterial color="#fdf2f8" transparent opacity={0.8} />
          </Box>
        </group>
      </Float>

      {/* 2. Minigame Joystick */}
      <Float speed={2.5} rotationIntensity={2} floatIntensity={1.5} position={[-2.3, -0.1, 1]}>
        <group>
          {/* Base */}
          <Sphere args={[0.08, 16, 16]} scale={[1, 0.4, 1]}>
             <meshPhysicalMaterial color="#34d399" emissive="#059669" emissiveIntensity={0.8} />
          </Sphere>
          {/* Stick */}
          <Cylinder args={[0.01, 0.01, 0.1]} position={[0, 0.06, 0]} rotation={[0.2, 0, 0]}>
             <meshStandardMaterial color="#e2e8f0" metalness={0.8} roughness={0.2} />
          </Cylinder>
          {/* Knob */}
          <Sphere args={[0.04]} position={[0, 0.12, 0.02]}>
             <meshPhysicalMaterial color="#ef4444" emissive="#b91c1c" emissiveIntensity={1.5} />
          </Sphere>
        </group>
      </Float>

      {/* 3. Podcast Mic */}
      <Float speed={2} rotationIntensity={1.5} floatIntensity={1} position={[0.5, 0.4, -2.5]}>
        <group>
          {/* Mic Head */}
          <Cylinder args={[0.04, 0.04, 0.1, 16]} position={[0, 0.05, 0]}>
             <meshStandardMaterial color="#a78bfa" emissive="#7c3aed" emissiveIntensity={1} wireframe={true} />
          </Cylinder>
          <Cylinder args={[0.035, 0.035, 0.09, 16]} position={[0, 0.05, 0]}>
             <meshPhysicalMaterial color="#4c1d95" transmission={0.9} roughness={0.1} />
          </Cylinder>
          {/* Stand */}
          <Box args={[0.01, 0.08, 0.01]} position={[0, -0.04, 0]}>
             <meshStandardMaterial color="#cbd5e1" metalness={1} roughness={0.2} />
          </Box>
        </group>
      </Float>

      {/* 4. Chatbot Bubble */}
      <Float speed={3} rotationIntensity={1} floatIntensity={0.8} position={[-1.2, -0.3, -2.1]}>
        <group>
          <Sphere args={[0.1, 32, 32]}>
            <MeshTransmissionMaterial color="#fbbf24" backside thickness={0.1} transmission={1} emissive="#b45309" emissiveIntensity={0.3} distortionScale={0} temporalDistortion={0} />
          </Sphere>
          {/* Inner dots */}
          <Sphere args={[0.015]} position={[-0.04, 0, 0.08]}><meshBasicMaterial color="#ffffff" /></Sphere>
          <Sphere args={[0.015]} position={[0, 0, 0.095]}><meshBasicMaterial color="#ffffff" /></Sphere>
          <Sphere args={[0.015]} position={[0.04, 0, 0.08]}><meshBasicMaterial color="#ffffff" /></Sphere>
        </group>
      </Float>

      {/* 5. Stack of Digitized Books */}
      <Float speed={1.5} rotationIntensity={1} floatIntensity={0.8} position={[1.8, -0.2, 1.5]}>
        <group>
          <Box args={[0.16, 0.02, 0.12]} position={[0, -0.02, 0]} rotation={[0, 0.2, 0]}>
            <meshPhysicalMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.5} transmission={0.5} />
          </Box>
          <Box args={[0.15, 0.02, 0.11]} position={[0, 0.01, 0]} rotation={[0, -0.1, 0]}>
            <meshPhysicalMaterial color="#818cf8" emissive="#4f46e5" emissiveIntensity={0.5} transmission={0.5} />
          </Box>
          <Box args={[0.16, 0.02, 0.12]} position={[0, 0.04, 0]} rotation={[0, 0.05, 0]}>
            <meshPhysicalMaterial color="#e879f9" emissive="#c026d3" emissiveIntensity={0.5} transmission={0.5} />
          </Box>
        </group>
      </Float>
    </group>
  );
}

function SceneModel() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      // Very subtle mouse parallax to feel interactive but stable
      const targetX = state.pointer.x * 0.15;
      const targetY = state.pointer.y * 0.15;
      groupRef.current.rotation.x += 0.02 * (targetY - groupRef.current.rotation.x);
      groupRef.current.rotation.y += 0.02 * (targetX - groupRef.current.rotation.y);
    }
  });

  return (
    <group ref={groupRef}>
      <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.4}>
        <DigitalPlanet />
        <OrbitalRings />
      </Float>
    </group>
  );
}

export function AIVisualizer() {
  return (
    <div className="absolute inset-0 z-0 flex items-center justify-center">
      {/* Use ACESFilmicToneMapping for a highly cinematic color space and realistic glows */}
      <Canvas 
        camera={{ position: [0, 0, 7.5], fov: 45 }} 
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
        dpr={[1, 1.5]}
        performance={{ min: 0.5 }}
      >
        <ambientLight intensity={1.5} color="#312e81" />
        
        {/* Dynamic studio lighting setup for the translucent/glossy materials */}
        <directionalLight position={[10, 5, 5]} intensity={3} color="#fbcfe8" />
        <directionalLight position={[-10, -5, -5]} intensity={2.5} color="#7dd3fc" />
        <spotLight position={[0, 5, -5]} intensity={5} color="#c084fc" distance={20} angle={0.5} penumbra={1} />
        
        {/* Fill light to bring out details in darker areas */}
        <pointLight position={[0, -2, 4]} intensity={2} distance={15} color="#2dd4bf" />
        
        <Suspense fallback={null}>
          <SceneModel />
        </Suspense>

        {/* Dense ambient digital particle field */}
        <Sparkles 
          count={100} 
          scale={14} 
          size={1.5} 
          speed={0.4} 
          opacity={0.4} 
          color="#38bdf8" 
        />
        <Sparkles 
          count={60} 
          scale={10} 
          size={2.5} 
          speed={0.2} 
          opacity={0.6} 
          color="#f472b6" 
        />
        <Sparkles 
          count={40} 
          scale={12} 
          size={1.2} 
          speed={0.1} 
          opacity={0.3} 
          color="#a78bfa" 
        />
      </Canvas>
    </div>
  );
}
