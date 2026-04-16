"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Network,
  RefreshCw,
  Sparkles,
  Download,
  Share2,
  Layers,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Lightbulb,
  GitBranch,
  Activity,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNotify } from "@/components/use-notify";
import { generateKnowledgeGraph, getMaterial, listGeneratedContents } from "@/lib/api";
import type { GeneratedContent, Material } from "@/types";
import type { KnowledgeGraphData } from "@/components/3d/knowledge-graph-3d";

// Dynamic import – avoid SSR with Three.js
const KnowledgeGraph3D = dynamic(() => import("@/components/3d/knowledge-graph-3d"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full rounded-2xl flex items-center justify-center"
      style={{
        height: 580,
        background: "radial-gradient(ellipse at 30% 30%, #1a1040 0%, #0d0820 40%, #050510 100%)",
      }}
    >
      <div className="text-center space-y-3">
        <div
          className="w-14 h-14 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto"
          style={{ boxShadow: "0 0 20px #7c3aed" }}
        />
        <p className="text-slate-400 text-sm font-medium">Đang tải môi trường 3D…</p>
      </div>
    </div>
  ),
});

// ─── Category metadata ─────────────────────────────────────────────────────
const CATEGORY_META: Record<string, { label: string; icon: string; desc: string }> = {
  main:        { label: "Chủ đề chính",  icon: "⬡", desc: "Khái niệm trung tâm của tài liệu" },
  concept:     { label: "Khái niệm",     icon: "◈", desc: "Các khái niệm con và ý tưởng phụ" },
  process:     { label: "Quy trình",     icon: "⟳", desc: "Các bước và quy trình" },
  example:     { label: "Ví dụ",         icon: "◉", desc: "Ví dụ và trường hợp thực tiễn" },
  definition:  { label: "Định nghĩa",    icon: "◎", desc: "Thuật ngữ và định nghĩa" },
  principle:   { label: "Nguyên tắc",    icon: "◆", desc: "Quy tắc và nguyên tắc" },
  application: { label: "Ứng dụng",      icon: "◇", desc: "Ứng dụng thực tế" },
  other:       { label: "Khác",          icon: "○", desc: "Các khái niệm khác" },
};

export default function KnowledgeGraphPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const materialId = params.id;
  const { success, error: notifyError, info } = useNotify();

  const [material, setMaterial] = useState<Material | null>(null);
  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [showNodeList, setShowNodeList] = useState(false);

  // Load material + existing knowledge graph
  useEffect(() => {
    if (!materialId) return;
    let cancelled = false;

    async function load() {
      try {
        const [mat, contents] = await Promise.all([
          getMaterial(materialId),
          listGeneratedContents(materialId, "knowledge_graph"),
        ]);
        if (cancelled) return;
        setMaterial(mat);
        if (contents.length > 0) {
          const latest = contents.reduce((a, b) => (b.version > a.version ? b : a));
          setGeneratedContent(latest);
          const kg = latest.json_content as KnowledgeGraphData;
          if (kg?.nodes?.length) {
            setGraphData(kg);
            success(`Đã tải Knowledge Graph phiên bản ${latest.version} thành công!`);
          }
        }
      } catch (err) {
        if (!cancelled) notifyError(`Không thể tải dữ liệu: ${String(err)}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [materialId, notifyError, success]);

  const handleGenerate = useCallback(async (forceRegenerate = false) => {
    if (!material) return;
    if (material.processing_status !== "processed") {
      info("Vui lòng xử lý tài liệu trước khi tạo knowledge graph.");
      return;
    }
    if (forceRegenerate) {
      info("Đang tạo lại Knowledge Graph...");
    }
    setGenerating(true);
    try {
      const result = await generateKnowledgeGraph(materialId, forceRegenerate);
      setGeneratedContent(result);
      const kg = result.json_content as KnowledgeGraphData;
      if (kg?.nodes?.length) {
        setGraphData(kg);
        success(`Đã tạo Knowledge Graph với ${kg.nodes.length} khái niệm và ${kg.edges.length} mối liên hệ!`);
      }
    } catch (err) {
      notifyError(`Không thể tạo Knowledge Graph: ${String(err)}`);
    } finally {
      setGenerating(false);
    }
  }, [material, materialId, success, notifyError, info]);

  const handleExportJSON = () => {
    if (!graphData) return;
    const blob = new Blob([JSON.stringify(graphData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `knowledge-graph-${materialId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    success("Đã xuất file JSON thành công!");
  };

  const usedCategories = graphData?.metadata?.categories ?? [];
  const categoryColors = graphData?.metadata?.category_colors ?? {};

  // Group nodes by category for the list panel
  const nodesByCategory = usedCategories.map((cat) => ({
    cat,
    nodes: graphData?.nodes.filter((n) => n.category === cat) ?? [],
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* ── Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
        <Link href={`/materials/${materialId}`} className="hover:text-[var(--mint-dark)] transition-colors no-underline text-[var(--text-tertiary)]">
          <span className="flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            {material?.title ?? "Học liệu"}
          </span>
        </Link>
        <span>/</span>
        <span className="text-[var(--text-secondary)] font-medium">Knowledge Graph 3D</span>
      </div>

      {/* ── Header Card */}
      <div className="relative overflow-hidden rounded-2xl" style={{
        background: "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 50%, rgba(6,182,212,0.05) 100%)",
        border: "1px solid rgba(99,102,241,0.2)",
      }}>
        {/* Decorative orbs */}
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20 pointer-events-none"
          style={{ background: "radial-gradient(circle, #6366f1, transparent)" }} />
        <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full opacity-15 pointer-events-none"
          style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }} />

        <div className="relative p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Left: title block */}
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 8px 24px rgba(99,102,241,0.35)" }}>
                <Network className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]"
                  style={{ fontFamily: "var(--font-display)" }}>
                  Knowledge Graph 3D
                </h1>
                <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                  {material?.title ?? "Đang tải…"}
                </p>

                {generatedContent && graphData && (
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: "rgba(99,102,241,0.15)", color: "var(--text-primary)" }}>
                      <BookOpen className="w-3 h-3" /> {graphData.nodes.length} Khái niệm
                    </span>
                    <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: "rgba(6,182,212,0.15)", color: "var(--text-primary)" }}>
                      <GitBranch className="w-3 h-3" /> {graphData.edges.length} Kết nối
                    </span>
                    <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: "rgba(16,185,129,0.15)", color: "var(--text-primary)" }}>
                      <Layers className="w-3 h-3" /> {usedCategories.length} Danh mục
                    </span>
                    {generatedContent.model_used && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-mono"
                        style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-tertiary)" }}>
                        {generatedContent.model_used}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex flex-wrap gap-2 flex-shrink-0">
              {graphData && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Download className="w-3.5 h-3.5" />}
                    onClick={handleExportJSON}
                  >
                    Xuất JSON
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                    onClick={() => handleGenerate(true)}
                    loading={generating}
                  >
                    Tạo lại
                  </Button>
                </>
              )}
              {!graphData && (
                <Button
                  icon={<Sparkles className="w-4 h-4" />}
                  onClick={() => handleGenerate(false)}
                  loading={generating}
                  disabled={loading}
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none" }}
                >
                  {generating ? "Đang phân tích tài liệu…" : "Tạo Knowledge Graph"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content */}
      {loading ? (
        <Card>
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-[var(--text-secondary)] text-sm">Đang kiểm tra dữ liệu…</p>
            </div>
          </div>
        </Card>
      ) : graphData ? (
        <div className="space-y-4">
          {/* ── 3D Viewport */}
          <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ boxShadow: "0 20px 60px rgba(99,102,241,0.15)" }}>
            <KnowledgeGraph3D data={graphData} height={580} />
          </div>

          {/* ── Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Khái niệm",
                value: graphData.nodes.length,
                sub: "nodes",
                icon: <BookOpen className="w-5 h-5" />,
                from: "#6366f1",
                to: "#8b5cf6",
              },
              {
                label: "Mối liên hệ",
                value: graphData.edges.length,
                sub: "edges",
                icon: <GitBranch className="w-5 h-5" />,
                from: "#06b6d4",
                to: "#8b5cf6",
              },
              {
                label: "Danh mục",
                value: usedCategories.length,
                sub: "categories",
                icon: <Layers className="w-5 h-5" />,
                from: "#10b981",
                to: "#06b6d4",
              },
              {
                label: "Phiên bản",
                value: generatedContent?.version ?? 1,
                sub: `v${generatedContent?.version ?? 1}`,
                icon: <Activity className="w-5 h-5" />,
                from: "#f59e0b",
                to: "#ef4444",
              },
            ].map((stat) => (
              <motion.div key={stat.label} whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 300 }}>
                <div className="rounded-2xl p-4 text-center relative overflow-hidden group cursor-default"
                  style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-light)" }}>
                  {/* Gradient hover overlay */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{ background: `linear-gradient(135deg, ${stat.from}10, ${stat.to}08)` }} />
                  <div className="relative">
                    <div className="w-9 h-9 rounded-xl mx-auto mb-2 flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${stat.from}22, ${stat.to}22)`, color: stat.from }}>
                      {stat.icon}
                    </div>
                    <div className="text-2xl font-bold" style={{ background: `linear-gradient(135deg, ${stat.from}, ${stat.to})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                      {stat.value}
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{stat.label}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* ── Legend + Node List toggle */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Category Legend */}
            <div className="rounded-2xl overflow-hidden flex flex-col" style={{ border: "1px solid var(--border-light)", background: "var(--bg-elevated)" }}>
              <button
                className="w-full flex items-center justify-between p-4 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex-shrink-0"
                onClick={() => setShowLegend((v) => !v)}
              >
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-[var(--text-secondary)]" />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">Chú thích danh mục</span>
                </div>
                {showLegend ? <ChevronUp className="w-4 h-4 text-[var(--text-tertiary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />}
              </button>
              <AnimatePresence>
                {showLegend && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                    <div className="px-4 pb-4 space-y-2 max-h-80 overflow-y-auto">
                      {usedCategories.map((cat) => {
                        const meta = CATEGORY_META[cat] ?? { label: cat, icon: "○", desc: "" };
                        const col = categoryColors[cat] ?? "#64748b";
                        const count = graphData.nodes.filter((n) => n.category === cat).length;
                        return (
                          <div key={cat} className="flex items-center gap-3 p-2.5 rounded-xl group"
                            style={{ background: col + "10", border: `1px solid ${col}30` }}>
                            <div className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                              style={{ background: col, boxShadow: `0 0 8px ${col}60` }} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold" style={{ color: col }}>{meta.icon} {meta.label}</span>
                                <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                                  style={{ background: col + "25", color: col }}>{count}</span>
                              </div>
                              <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{meta.desc}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Node list by category */}
            <div className="rounded-2xl overflow-hidden flex flex-col" style={{ border: "1px solid var(--border-light)", background: "var(--bg-elevated)" }}>
              <button
                className="w-full flex items-center justify-between p-4 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex-shrink-0"
                onClick={() => setShowNodeList((v) => !v)}
              >
                <div className="flex items-center gap-2">
                  <Network className="w-4 h-4 text-[var(--text-secondary)]" />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">Danh sách khái niệm</span>
                </div>
                <div className="flex items-center gap-2">
                  {graphData.nodes.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>
                      {graphData.nodes.length}
                    </span>
                  )}
                  {showNodeList ? <ChevronUp className="w-4 h-4 text-[var(--text-tertiary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />}
                </div>
              </button>
              <AnimatePresence>
                {showNodeList && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                    <div className="px-4 pb-4 space-y-3 max-h-80 overflow-y-auto">
                      {nodesByCategory.map(({ cat, nodes }) => {
                        if (nodes.length === 0) return null;
                        const col = categoryColors[cat] ?? "#64748b";
                        const meta = CATEGORY_META[cat];
                        return (
                          <div key={cat}>
                            <div className="flex items-center gap-2 mb-2 sticky top-0 py-1 z-10" style={{ background: "var(--bg-elevated)" }}>
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: col }} />
                              <div className="text-xs font-bold" style={{ color: col }}>
                                {meta?.icon} {meta?.label ?? cat}
                              </div>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                                style={{ background: col + "20", color: col }}>
                                {nodes.length}
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              {nodes.map((node) => (
                                <div key={node.id} className="group flex items-start gap-2 p-2.5 rounded-lg transition-all hover:scale-[1.01] hover:shadow-sm"
                                  style={{ background: col + "08", border: `1px solid ${col}15` }}>
                                  <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1 transition-transform group-hover:scale-125"
                                    style={{ background: col }} />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-semibold text-[var(--text-primary)] truncate">{node.label}</div>
                                    {node.description && (
                                      <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5 line-clamp-2">{node.description}</div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ── Tips card */}
          <div className="rounded-2xl p-4 flex items-start gap-3"
            style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
            <Share2 className="w-4 h-4 text-[var(--text-secondary)] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[var(--text-secondary)]">
              <strong className="text-[var(--text-primary)]">Hướng dẫn tương tác:</strong>{" "}
              Kéo để xoay không gian 3D · Cuộn chuột để phóng to/thu nhỏ · Click vào nút để xem mô tả và danh sách kết nối ·
              Dùng bộ lọc màu (trong khung 3D phía dưới bên trái) để highlight theo danh mục ·
              Nhấn <strong className="text-[var(--text-primary)]">Auto</strong> để bật/tắt xoay tự động.
            </p>
          </div>
        </div>
      ) : (
        /* ── Empty state */
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-light)", background: "var(--bg-elevated)" }}>
          <div className="flex flex-col items-center justify-center py-20 text-center px-8">
            {/* Animated icon */}
            <motion.div
              animate={{ y: [0, -6, 0], rotate: [0, 2, -2, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="w-24 h-24 rounded-3xl mb-6 flex items-center justify-center relative"
              style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))", border: "1px solid rgba(99,102,241,0.25)" }}
            >
              <Network className="w-12 h-12 text-indigo-400" />
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full animate-bounce"
                style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 0 10px #6366f1" }} />
            </motion.div>

            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-3" style={{ fontFamily: "var(--font-display)" }}>
              Tạo Knowledge Graph 3D
            </h2>
            <p className="text-sm text-[var(--text-secondary)] max-w-md mb-2 leading-relaxed">
              AI sẽ phân tích tài liệu và tự động trích xuất các khái niệm quan trọng cùng mối liên hệ giữa chúng,
              rồi trực quan hóa thành biểu đồ kiến thức 3D tương tác.
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mb-8">
              Hỗ trợ xoay, zoom, lọc theo danh mục và xem chi tiết từng khái niệm.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {[
                { icon: "🕸", text: "Force-directed layout" },
                { icon: "✨", text: "Particles animation" },
                { icon: "🎨", text: "Màu theo danh mục" },
                { icon: "🔍", text: "Lọc & tìm kiếm" },
                { icon: "📋", text: "Xuất JSON" },
              ].map((f) => (
                <span key={f.text} className="text-xs px-3 py-1.5 rounded-full font-medium"
                  style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "var(--text-primary)" }}>
                  {f.icon} {f.text}
                </span>
              ))}
            </div>

            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleGenerate(false)}
                disabled={generating || material?.processing_status !== "processed"}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-white disabled:opacity-50 transition-all"
                style={{
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  boxShadow: "0 8px 24px rgba(99,102,241,0.4)",
                }}
              >
                {generating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Đang phân tích…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Tạo Knowledge Graph
                  </>
                )}
              </motion.button>
              <Button variant="secondary" onClick={() => router.push(`/materials/${materialId}`)}>
                Quay lại
              </Button>
            </div>

            {material?.processing_status !== "processed" && (
              <p className="text-xs text-amber-500 mt-4 flex items-center gap-1.5">
                <span>⚠</span>
                Tài liệu chưa được xử lý. Hãy xử lý tài liệu trước để sử dụng tính năng này.
              </p>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
