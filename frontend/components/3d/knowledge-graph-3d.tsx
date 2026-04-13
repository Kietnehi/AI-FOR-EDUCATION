"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as THREE from "three";

// ─── Types ─────────────────────────────────────────────────────────────────
export interface KGNode {
  id: string;
  label: string;
  category: string;
  description: string;
  size: number;
  color: string;
}

export interface KGEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  weight: number;
}

export interface KnowledgeGraphData {
  title: string;
  nodes: KGNode[];
  edges: KGEdge[];
  metadata: {
    total_nodes: number;
    total_edges: number;
    categories: string[];
    category_colors: Record<string, string>;
  };
}

interface Props {
  data: KnowledgeGraphData;
  height?: number;
}

// ─── Force-directed layout (Fruchterman-Reingold style in 3D) ──────────────
function forceLayout(nodes: KGNode[], edges: KGEdge[], iterations = 120) {
  const k = 6; // ideal spring length
  const positions = new Map<string, THREE.Vector3>();
  const velocities = new Map<string, THREE.Vector3>();

  // Initialize on a sphere
  nodes.forEach((node, i) => {
    const phi = Math.acos(-1 + (2 * i) / nodes.length);
    const theta = Math.sqrt(nodes.length * Math.PI) * phi;
    const r = 6 + Math.random() * 2;
    positions.set(node.id, new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi),
    ));
    velocities.set(node.id, new THREE.Vector3());
  });

  const tmp = new THREE.Vector3();

  for (let iter = 0; iter < iterations; iter++) {
    const cooling = 1 - iter / iterations;

    // Repulsion between all node pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const pi = positions.get(nodes[i].id)!;
        const pj = positions.get(nodes[j].id)!;
        tmp.subVectors(pi, pj);
        const dist = Math.max(tmp.length(), 0.5);
        const force = (k * k) / dist;
        tmp.normalize().multiplyScalar(force);
        velocities.get(nodes[i].id)!.add(tmp);
        velocities.get(nodes[j].id)!.sub(tmp);
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const ps = positions.get(edge.source);
      const pt = positions.get(edge.target);
      if (!ps || !pt) continue;
      tmp.subVectors(pt, ps);
      const dist = Math.max(tmp.length(), 0.5);
      const force = (dist * dist) / k;
      tmp.normalize().multiplyScalar(force);
      velocities.get(edge.source)!.add(tmp);
      velocities.get(edge.target)!.sub(tmp);
    }

    // Apply with cooling
    for (const node of nodes) {
      const vel = velocities.get(node.id)!;
      const pos = positions.get(node.id)!;
      const speed = vel.length();
      if (speed > 0) {
        pos.add(vel.clone().normalize().multiplyScalar(Math.min(speed, 2) * cooling));
      }
      vel.multiplyScalar(0.85);
    }
  }

  return positions;
}

// ─── Create canvas texture for node labels ─────────────────────────────────
function makeLabelTexture(text: string, color: string): THREE.CanvasTexture {
  const W = 320, H = 80;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Pill background
  ctx.clearRect(0, 0, W, H);
  ctx.beginPath();
  ctx.roundRect(4, 14, W - 8, H - 22, 12);
  ctx.fillStyle = "rgba(10,10,30,0.75)";
  ctx.fill();
  ctx.strokeStyle = color + "99";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Text
  ctx.font = "bold 22px 'Inter', sans-serif";
  ctx.fillStyle = "#e2e8f0";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const maxLen = 22;
  const label = text.length > maxLen ? text.slice(0, maxLen - 1) + "…" : text;
  ctx.fillText(label, W / 2, H / 2);

  return new THREE.CanvasTexture(canvas);
}

// ─── Animated particle along edge ──────────────────────────────────────────
interface EdgeParticle {
  mesh: THREE.Mesh;
  curve: THREE.CatmullRomCurve3;
  t: number;
  speed: number;
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function KnowledgeGraph3D({ data, height = 600 }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const frameRef = useRef<number>(0);
  const groupRef = useRef<THREE.Group | null>(null);

  // Interaction state
  const isDragging = useRef(false);
  const prevMouse = useRef({ x: 0, y: 0 });
  const rotXRef = useRef(-0.2);
  const rotYRef = useRef(0);
  const autoRotRef = useRef(true);

  // Object maps
  const meshMapRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const edgeParticlesRef = useRef<EdgeParticle[]>([]);
  const edgeMeshesRef = useRef<THREE.Mesh[]>([]);

  // React state
  const [hoveredNode, setHoveredNode] = useState<KGNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<KGNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());
  const [showPanel, setShowPanel] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const raycaster = useRef(new THREE.Raycaster());
  const mouse2d = useRef(new THREE.Vector2());

  // Derived
  const categories = useMemo(() => data.metadata?.categories ?? [], [data]);
  const categoryColors = useMemo(() => data.metadata?.category_colors ?? {}, [data]);

  // Connected edges for selected node
  const connectedNodes = useMemo(() => {
    if (!selectedNode) return [];
    return data.edges
      .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
      .map((e) => {
        const otherId = e.source === selectedNode.id ? e.target : e.source;
        const other = data.nodes.find((n) => n.id === otherId);
        return { edge: e, node: other ?? null, direction: e.source === selectedNode.id ? "→" : "←" };
      })
      .filter((x) => x.node !== null);
  }, [selectedNode, data]);

  // ── Build Three.js scene ────────────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !data?.nodes?.length) return;

    setIsReady(false);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, height);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / height, 0.1, 300);
    camera.position.set(0, 0, 24);
    cameraRef.current = camera;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.DirectionalLight(0xa8b4ff, 1.8);
    key.position.set(15, 25, 15);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xff88cc, 0.6);
    fill.position.set(-15, -10, 10);
    scene.add(fill);
    const rim = new THREE.PointLight(0x44ffcc, 0.8, 60);
    rim.position.set(0, 20, -15);
    scene.add(rim);

    // ── Star field
    const starGeo = new THREE.BufferGeometry();
    const N = 600;
    const sp = new Float32Array(N * 3);
    const sc = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      sp[i * 3] = (Math.random() - 0.5) * 200;
      sp[i * 3 + 1] = (Math.random() - 0.5) * 200;
      sp[i * 3 + 2] = (Math.random() - 0.5) * 200;
      const bri = 0.4 + Math.random() * 0.6;
      sc[i * 3] = bri * (0.7 + Math.random() * 0.3);
      sc[i * 3 + 1] = bri * (0.7 + Math.random() * 0.3);
      sc[i * 3 + 2] = bri;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    starGeo.setAttribute("color", new THREE.BufferAttribute(sc, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 0.1, vertexColors: true, transparent: true, opacity: 0.6 })));

    // ── Main rotatable group
    const group = new THREE.Group();
    group.rotation.x = rotXRef.current;
    scene.add(group);
    groupRef.current = group;

    // ── Compute layout
    const positions = forceLayout(data.nodes, data.edges);

    const meshMap = new Map<string, THREE.Mesh>();
    const particles: EdgeParticle[] = [];
    const edgeMeshes: THREE.Mesh[] = [];

    // ── Draw edges
    data.edges.forEach((edge) => {
      const ps = positions.get(edge.source);
      const pt = positions.get(edge.target);
      if (!ps || !pt) return;

      // Slightly curved tube
      const mid = ps.clone().lerp(pt, 0.5).add(
        new THREE.Vector3((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5)
      );
      const curve = new THREE.CatmullRomCurve3([ps.clone(), mid, pt.clone()]);
      const tubeGeo = new THREE.TubeGeometry(curve, 16, 0.025 * Math.max(edge.weight, 0.5), 6, false);

      const srcNode = data.nodes.find((n) => n.id === edge.source);
      const edgeColor = srcNode ? new THREE.Color(srcNode.color) : new THREE.Color(0x6366f1);
      edgeColor.multiplyScalar(0.6);

      const tubeMat = new THREE.MeshStandardMaterial({
        color: edgeColor,
        emissive: edgeColor,
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.55,
        roughness: 1,
        metalness: 0,
      });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      tubeMesh.userData.isEdge = true;
      tubeMesh.userData.edgeId = edge.id;
      group.add(tubeMesh);
      edgeMeshes.push(tubeMesh);

      // Floating particle along edge
      const particleGeo = new THREE.SphereGeometry(0.07, 8, 8);
      const pColor = srcNode ? new THREE.Color(srcNode.color) : new THREE.Color(0x88aaff);
      const particleMat = new THREE.MeshBasicMaterial({ color: pColor });
      const pMesh = new THREE.Mesh(particleGeo, particleMat);
      pMesh.userData.isEdgeParticle = true;
      group.add(pMesh);
      particles.push({ mesh: pMesh, curve, t: Math.random(), speed: 0.003 + Math.random() * 0.003 });
    });
    edgeParticlesRef.current = particles;
    edgeMeshesRef.current = edgeMeshes;

    // ── Draw nodes
    data.nodes.forEach((node) => {
      const pos = positions.get(node.id) ?? new THREE.Vector3();
      const radius = 0.28 + node.size * 0.22;

      // Outer glow ring
      const ringGeo = new THREE.TorusGeometry(radius + 0.18, 0.06, 8, 48);
      const ringColor = new THREE.Color(node.color);
      const ringMat = new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.25 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(pos);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);

      // Core sphere
      const geo = new THREE.SphereGeometry(radius, 40, 40);
      const color = new THREE.Color(node.color);
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.35,
        roughness: 0.15,
        metalness: 0.8,
        envMapIntensity: 1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      mesh.userData.nodeId = node.id;
      group.add(mesh);
      meshMap.set(node.id, mesh);

      // Glow halo sprite
      const sp2 = new THREE.Sprite(
        new THREE.SpriteMaterial({ color, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      sp2.scale.setScalar(radius * 8);
      sp2.position.copy(pos);
      group.add(sp2);

      // Label
      const tex = makeLabelTexture(node.label, node.color);
      const labelSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, sizeAttenuation: true })
      );
      labelSprite.scale.set(4, 1, 1);
      labelSprite.position.copy(pos).add(new THREE.Vector3(0, radius + 0.6, 0));
      group.add(labelSprite);
    });

    meshMapRef.current = meshMap;

    // ── Animate
    let t = 0;
    function animate() {
      frameRef.current = requestAnimationFrame(animate);
      t += 0.01;

      // Auto-rotate
      if (autoRotRef.current && !isDragging.current) {
        rotYRef.current += 0.003;
      }
      group.rotation.x = rotXRef.current;
      group.rotation.y = rotYRef.current;

      // Animate particles along edges
      for (const p of edgeParticlesRef.current) {
        p.t = (p.t + p.speed) % 1;
        const pt = p.curve.getPoint(p.t);
        p.mesh.position.copy(pt);
        // Pulse scale
        const s = 0.7 + 0.3 * Math.sin(t * 4 + p.t * Math.PI * 2);
        p.mesh.scale.setScalar(s);
      }

      // Pulse nodes
      meshMapRef.current.forEach((mesh, id) => {
        const node = data.nodes.find((n) => n.id === id);
        if (!node) return;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        const isSelected = selectedNode?.id === id;
        const isHovered = hoveredNode?.id === id;
        const pulse = 1 + 0.05 * Math.sin(t * 2 + node.size);
        if (isSelected) {
          mesh.scale.setScalar(pulse * 1.45);
          mat.emissiveIntensity = 0.9 + 0.1 * Math.sin(t * 4);
        } else if (isHovered) {
          mesh.scale.setScalar(pulse * 1.2);
          mat.emissiveIntensity = 0.65;
        } else {
          mesh.scale.setScalar(pulse);
          mat.emissiveIntensity = 0.35;
        }
      });

      renderer.render(scene, camera);
    }
    animate();

    // Resize
    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / height;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, height);
    };
    window.addEventListener("resize", onResize);

    const onWheelInternal = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (cameraRef.current) {
        cameraRef.current.position.z = Math.max(8, Math.min(60, cameraRef.current.position.z + e.deltaY * 0.04));
      }
    };
    renderer.domElement.addEventListener("wheel", onWheelInternal, { passive: false });

    setIsReady(true);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("wheel", onWheelInternal);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, height]);

  // ── Dim non-selected nodes when category filter active ─────────────────
  useEffect(() => {
    meshMapRef.current.forEach((mesh, id) => {
      const node = data.nodes.find((n) => n.id === id);
      if (!node) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (activeCategories.size === 0 || activeCategories.has(node.category)) {
        mat.transparent = false;
        mat.opacity = 1;
      } else {
        mat.transparent = true;
        mat.opacity = 0.15;
      }
    });
  }, [activeCategories, data.nodes]);

  // ── Mouse handlers ──────────────────────────────────────────────────────
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const mount = mountRef.current;
      const camera = cameraRef.current;
      const group = groupRef.current;
      if (!mount || !camera || !group) return;

      const rect = mount.getBoundingClientRect();

      if (isDragging.current) {
        const dx = e.clientX - prevMouse.current.x;
        const dy = e.clientY - prevMouse.current.y;
        rotYRef.current += dx * 0.007;
        rotXRef.current += dy * 0.007;
        rotXRef.current = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotXRef.current));
        prevMouse.current = { x: e.clientX, y: e.clientY };
        return;
      }

      // Raycasting
      mouse2d.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse2d.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.current.setFromCamera(mouse2d.current, camera);

      const meshes = Array.from(meshMapRef.current.values());
      const hits = raycaster.current.intersectObjects(meshes);

      if (hits.length > 0) {
        const nodeId = hits[0].object.userData.nodeId as string;
        const node = data.nodes.find((n) => n.id === nodeId) ?? null;
        setHoveredNode(node);
        setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        mount.style.cursor = "pointer";
      } else {
        setHoveredNode(null);
        setTooltipPos(null);
        mount.style.cursor = "grab";
      }
    },
    [data.nodes]
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    autoRotRef.current = false;
    prevMouse.current = { x: e.clientX, y: e.clientY };
    if (mountRef.current) mountRef.current.style.cursor = "grabbing";
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    if (mountRef.current) mountRef.current.style.cursor = "grab";
  }, []);

  const handleClick = useCallback(() => {
    if (hoveredNode) {
      setSelectedNode((prev) => (prev?.id === hoveredNode.id ? null : hoveredNode));
      setShowPanel(true);
    } else {
      setSelectedNode(null);
    }
  }, [hoveredNode]);

  const toggleCategory = (cat: string) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full overflow-hidden" style={{ height, borderRadius: 20 }}>

      {/* Canvas */}
      <div
        ref={mountRef}
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at 30% 30%, #1a1040 0%, #0d0820 40%, #050510 100%)",
          cursor: "grab",
          touchAction: "none",
        }}        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
      />

      {/* Loading overlay */}
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center z-30"
          style={{ background: "radial-gradient(ellipse at center, #1a1040, #050510)" }}>
          <div className="text-center">
            <div className="w-14 h-14 rounded-full border-2 border-violet-500 border-t-transparent animate-spin mx-auto mb-4"
              style={{ boxShadow: "0 0 20px #7c3aed" }} />
            <p className="text-slate-300 text-sm font-medium">Đang tính toán bố cục graph…</p>
          </div>
        </div>
      )}

      {/* ── Top controls bar */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20 pointer-events-none">
        {/* Left: title */}
        <div className="px-3 py-1.5 rounded-xl text-xs font-semibold pointer-events-auto"
          style={{ background: "rgba(10,5,30,0.7)", color: "#a78bfa", backdropFilter: "blur(10px)", border: "1px solid rgba(124,58,237,0.3)" }}>
          <span className="mr-1">🕸</span>{data.title}
        </div>

        {/* Right: buttons */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => { autoRotRef.current = !autoRotRef.current; }}
            className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={{ background: "rgba(10,5,30,0.7)", color: "#94a3b8", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)" }}
            title="Bật/tắt xoay tự động"
          >
            ↻ Auto
          </button>
          <button
            onClick={() => { rotXRef.current = -0.2; rotYRef.current = 0; if (cameraRef.current) cameraRef.current.position.z = 24; }}
            className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={{ background: "rgba(10,5,30,0.7)", color: "#94a3b8", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)" }}
            title="Reset góc nhìn"
          >
            ⌖ Reset
          </button>
          <button
            onClick={() => { if (cameraRef.current) cameraRef.current.position.z = Math.max(8, cameraRef.current.position.z - 4); }}
            className="w-8 h-8 rounded-xl text-sm font-bold flex items-center justify-center"
            style={{ background: "rgba(10,5,30,0.7)", color: "#a78bfa", backdropFilter: "blur(10px)", border: "1px solid rgba(124,58,237,0.3)" }}
          >+</button>
          <button
            onClick={() => { if (cameraRef.current) cameraRef.current.position.z = Math.min(60, cameraRef.current.position.z + 4); }}
            className="w-8 h-8 rounded-xl text-sm font-bold flex items-center justify-center"
            style={{ background: "rgba(10,5,30,0.7)", color: "#a78bfa", backdropFilter: "blur(10px)", border: "1px solid rgba(124,58,237,0.3)" }}
          >−</button>
        </div>
      </div>

      {/* ── Category filter pills (bottom-left) */}
      {categories.length > 0 && (
        <div className="absolute bottom-14 left-3 z-20 max-w-xs">
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => {
              const col = categoryColors[cat] ?? "#64748b";
              const active = activeCategories.has(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
                  style={{
                    background: active ? col + "33" : "rgba(10,5,30,0.65)",
                    border: `1px solid ${active ? col : "rgba(255,255,255,0.1)"}`,
                    color: active ? col : "#64748b",
                    backdropFilter: "blur(8px)",
                    transform: active ? "scale(1.05)" : "scale(1)",
                    boxShadow: active ? `0 0 8px ${col}55` : "none",
                  }}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col, boxShadow: active ? `0 0 5px ${col}` : "none" }} />
                  {cat}
                </button>
              );
            })}
            {activeCategories.size > 0 && (
              <button
                onClick={() => setActiveCategories(new Set())}
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
                style={{ background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171", backdropFilter: "blur(8px)" }}
              >
                ✕ Xóa lọc
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Controls hint */}
      <div className="absolute bottom-3 left-3 z-20 text-[10px] flex items-center gap-2"
        style={{ color: "#475569" }}>
        <span>🖱 Kéo xoay</span>
        <span>·</span>
        <span>⚙ Cuộn zoom</span>
        <span>·</span>
        <span>Click nút để xem chi tiết</span>
      </div>

      {/* ── Stats bottom-right */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2 text-[10px]"
        style={{ color: "#475569" }}>
        <span className="px-2 py-1 rounded-lg" style={{ background: "rgba(10,5,30,0.6)", backdropFilter: "blur(8px)" }}>
          {data.nodes.length} khái niệm · {data.edges.length} liên hệ
        </span>
      </div>

      {/* ── Hover tooltip */}
      {hoveredNode && tooltipPos && !selectedNode && (
        <div
          className="absolute z-30 pointer-events-none rounded-xl px-3 py-2 text-xs"
          style={{
            left: Math.min(tooltipPos.x + 14, (mountRef.current?.clientWidth ?? 400) - 200),
            top: tooltipPos.y - 10,
            background: "rgba(10,5,30,0.92)",
            border: `1px solid ${hoveredNode.color}55`,
            backdropFilter: "blur(12px)",
            boxShadow: `0 4px 20px rgba(0,0,0,0.5), 0 0 10px ${hoveredNode.color}22`,
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: hoveredNode.color, boxShadow: `0 0 6px ${hoveredNode.color}` }} />
            <span className="font-bold" style={{ color: hoveredNode.color }}>{hoveredNode.label}</span>
          </div>
          <div className="font-mono text-[10px]" style={{ color: "#64748b" }}>{hoveredNode.category}</div>
        </div>
      )}

      {/* ── Node detail panel (right side) */}
      {selectedNode && showPanel && (
        <div
          className="absolute right-3 top-12 bottom-14 w-64 rounded-2xl z-20 overflow-hidden"
          style={{
            background: "rgba(10,5,30,0.88)",
            border: `1px solid ${selectedNode.color}44`,
            backdropFilter: "blur(20px)",
            boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${selectedNode.color}22`,
          }}
        >
          {/* Header */}
          <div className="p-4 border-b" style={{ borderColor: selectedNode.color + "22" }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5"
                  style={{ background: selectedNode.color, boxShadow: `0 0 10px ${selectedNode.color}` }} />
                <div>
                  <div className="font-bold text-white text-sm leading-tight">{selectedNode.label}</div>
                  <div className="text-[10px] mt-1 px-1.5 py-0.5 rounded-md inline-block font-medium"
                    style={{ background: selectedNode.color + "22", color: selectedNode.color }}>
                    {selectedNode.category}
                  </div>
                </div>
              </div>
              <button onClick={() => { setSelectedNode(null); setShowPanel(false); }}
                className="text-slate-500 hover:text-slate-300 transition-colors text-lg leading-none flex-shrink-0">×</button>
            </div>

            {selectedNode.description && (
              <p className="mt-3 text-xs leading-relaxed" style={{ color: "#94a3b8" }}>
                {selectedNode.description}
              </p>
            )}
          </div>

          {/* Connections */}
          <div className="p-3 overflow-y-auto" style={{ maxHeight: "calc(100% - 140px)" }}>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "#475569" }}>
              Kết nối ({connectedNodes.length})
            </div>
            {connectedNodes.length === 0 && (
              <p className="text-xs" style={{ color: "#334155" }}>Không có kết nối</p>
            )}
            {connectedNodes.map(({ edge, node: other, direction }, i) => (
              <button
                key={edge.id + i}
                onClick={() => {
                  if (other) {
                    setSelectedNode(other);
                  }
                }}
                className="w-full text-left p-2 rounded-xl mb-1.5 transition-all hover:bg-white/5 group"
                style={{ border: `1px solid rgba(255,255,255,0.05)` }}
              >
                <div className="flex items-center gap-2">
                  <span style={{ color: "#64748b" }} className="text-[10px]">{direction}</span>
                  <div className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: other?.color ?? "#64748b", boxShadow: `0 0 4px ${other?.color ?? "#64748b"}` }} />
                  <span className="text-xs font-medium text-white/80 group-hover:text-white truncate transition-colors">
                    {other?.label}
                  </span>
                </div>
                <div className="ml-6 mt-0.5 text-[10px] truncate" style={{ color: "#475569" }}>
                  {edge.label}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
