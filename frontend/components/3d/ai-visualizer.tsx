"use client";

import { memo, Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { 
  Float, 
  Sparkles,
  Sphere,
  Icosahedron,
  Box,
  Cylinder,
  Ring,
  useTexture
} from "@react-three/drei";
import * as THREE from "three";

const DATA_PACKET_POSITIONS = Array.from({ length: 15 }, (_, i) => {
  const angle = (i / 15) * Math.PI * 2;
  return {
    key: i,
    position: [Math.cos(angle) * 2.35, Math.sin(i * 2) * 0.15, Math.sin(angle) * 2.35] as [number, number, number],
  };
});

const SPARKLE_LAYERS = [
  { count: 70, scale: 14, size: 1.5, speed: 0.4, opacity: 0.4, color: "#38bdf8" },
  { count: 36, scale: 10, size: 2.5, speed: 0.2, opacity: 0.6, color: "#f472b6" },
  { count: 24, scale: 12, size: 1.2, speed: 0.1, opacity: 0.3, color: "#a78bfa" },
] as const;

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
      {/* Core - Earth Map - reduced segments from 64 to 32 */}
      <Sphere ref={innerGlobeRef} args={[1.35, 32, 32]} rotation={[0, -Math.PI / 2, 0]}>
        <meshStandardMaterial
          map={earthTexture}
          color="#a5b4fc"
          emissive="#1e3a8a"
          emissiveIntensity={0.2}
          roughness={0.6}
          metalness={0.2}
        />
      </Sphere>

      {/* Inner Data Mesh - reduced detail from 8 to 4 */}
      <Icosahedron ref={meshLayerRef} args={[1.38, 4]}>
        <meshBasicMaterial
          color="#38bdf8"
          wireframe
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
        />
      </Icosahedron>

      {/* Outer Data Mesh - reduced detail from 6 to 3 */}
      <Icosahedron ref={outerLinesRef} args={[1.42, 3]}>
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

      {/* Removed MeshTransmissionMaterial (very expensive!) - replaced with simple transparent sphere */}
      <Sphere args={[1.48, 16, 16]}>
        <meshBasicMaterial
          color="#e0f2fe"
          transparent
          opacity={0.08}
          side={THREE.BackSide}
        />
      </Sphere>

      {/* Reduced point count from 300 to 100 */}
      <PointsCloud globeRadius={1.39} />
    </group>
  );
}

function PointsCloud({ globeRadius }: { globeRadius: number }) {
  const pointsCount = 100; // Reduced from 300
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
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.06;
      // Removed pulsing scale animation to reduce work per frame
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

// Simplified orbital rings - removed pointLights (expensive!)
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
    }
  });

  // Memoize the data packet positions
  const packetPositions = useMemo(() => {
    return Array.from({ length: 8 }).map((_, i) => { // Reduced from 15 to 8
      const angle = (i / 8) * Math.PI * 2;
      return [Math.cos(angle) * 2.35, Math.sin(i * 2) * 0.15, Math.sin(angle) * 2.35] as [number, number, number];
    });
  }, []);

  return (
    <group>
      {/* Rings - reduced segments from 64 to 32 */}
      <group ref={ringGroupRef}>
        <Ring args={[2.2, 2.21, 32]} rotation={[Math.PI / 2.2, 0.1, 0]}>
          <meshBasicMaterial color="#ec4899" transparent opacity={0.6} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
        </Ring>
        <Ring args={[2.5, 2.508, 32]} rotation={[-Math.PI / 2.5, -0.2, 0]}>
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.5} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
        </Ring>
        <Ring args={[2.8, 2.805, 32]} rotation={[Math.PI / 2, 0, Math.PI / 6]}>
          <meshBasicMaterial color="#a78bfa" transparent opacity={0.4} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
        </Ring>

        <ResourceSatellites />
      </group>

      {/* Data Packets - removed expensive pointLight per packet */}
      <group ref={dataPacketsRef}>
        {DATA_PACKET_POSITIONS.map((packet) => (
          <group key={packet.key} position={packet.position}>
            <Sphere args={[0.015, 8, 8]}>
              <meshBasicMaterial color="#fcd34d" transparent opacity={0.9} blending={THREE.AdditiveBlending} />
            </Sphere>
            <pointLight distance={0.5} color="#fcd34d" intensity={0.5} />
          </group>
        ))}
      </group>
    </group>
  );
}

// Simplified satellites - reduced geometry detail
function ResourceSatellites() {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = -state.clock.elapsedTime * 0.05;
    }
  });
  
  return (
    <group ref={groupRef}>
      {/* 1. Slide */}
      <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5} position={[2.2, 0.2, 0]}>
        <Box args={[0.2, 0.12, 0.01]}>
          <meshStandardMaterial color="#f472b6" emissive="#be185d" emissiveIntensity={1} />
        </Box>
      </Float>

      {/* 2. Minigame */}
      <Float speed={2.5} rotationIntensity={1} floatIntensity={0.8} position={[-2.3, -0.1, 1]}>
        <Sphere args={[0.08, 8, 8]} scale={[1, 0.4, 1]}>
          <meshStandardMaterial color="#34d399" emissive="#059669" emissiveIntensity={0.8} />
        </Sphere>
      </Float>

      {/* 3. Podcast Mic */}
      <Float speed={2} rotationIntensity={0.8} floatIntensity={0.5} position={[0.5, 0.4, -2.5]}>
        <Cylinder args={[0.04, 0.04, 0.1, 8]} position={[0, 0.05, 0]}>
          <meshStandardMaterial color="#a78bfa" emissive="#7c3aed" emissiveIntensity={1} wireframe />
        </Cylinder>
      </Float>

      {/* 4. Chatbot */}
      <Float speed={3} rotationIntensity={0.5} floatIntensity={0.4} position={[-1.2, -0.3, -2.1]}>
        <Sphere args={[0.1, 12, 12]}>
          <meshStandardMaterial color="#fbbf24" emissive="#b45309" emissiveIntensity={0.3} transparent opacity={0.8} />
        </Sphere>
      </Float>

      {/* 5. Books */}
      <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.4} position={[1.8, -0.2, 1.5]}>
        <Box args={[0.16, 0.06, 0.12]} rotation={[0, 0.2, 0]}>
          <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.5} />
        </Box>
      </Float>
    </group>
  );
}

function SceneModel() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
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

export const AIVisualizer = memo(function AIVisualizer() {
  return (
    <div className="absolute inset-0 z-0 flex items-center justify-center">
      {/* Use ACESFilmicToneMapping for a highly cinematic color space and realistic glows */}
      <Canvas 
        camera={{ position: [0, 0, 7.5], fov: 45 }} 
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
        dpr={[1, 1.25]}
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
        {SPARKLE_LAYERS.map((layer) => (
          <Sparkles
            key={`${layer.color}-${layer.count}`}
            count={layer.count}
            scale={layer.scale}
            size={layer.size}
            speed={layer.speed}
            opacity={layer.opacity}
            color={layer.color}
          />
        ))}
      </Canvas>
    </div>
  );
});
