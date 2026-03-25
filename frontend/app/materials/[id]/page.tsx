"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Presentation,
  Mic,
  Gamepad2,
  MessageSquareText,
  Settings,
  ArrowLeft,
  Sparkles,
  FileText,
  Clock,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Toast } from "@/components/ui/toast";
import { CardSkeleton } from "@/components/ui/skeleton";
import {
  generateMinigame,
  generatePodcast,
  generateSlides,
  getMaterial,
  processMaterial,
} from "@/lib/api";
import { Material } from "@/types";

export default function MaterialDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const materialId = params.id;

  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [isFullPreview, setIsFullPreview] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" }>({
    message: "",
    type: "success",
  });

  const fullText = material?.cleaned_text || material?.raw_text || "";
  const previewLimit = 1000;
  const hasMore = fullText.length > previewLimit;

  useEffect(() => {
    if (!materialId) return;
    let cancelled = false;
    getMaterial(materialId)
      .then((data) => {
        if (!cancelled) {
          setMaterial(data);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setToast({ message: String(error), type: "error" });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [materialId]);

  async function handleProcess() {
    setBusyAction("process");
    try {
      await processMaterial(materialId);
      setToast({ message: "Đã xếp hàng xử lý tài liệu thành công!", type: "success" });
      const updated = await getMaterial(materialId);
      setMaterial(updated);
    } catch (error) {
      setToast({ message: String(error), type: "error" });
    } finally {
      setBusyAction("");
    }
  }

  async function handleGenerate(type: "slides" | "podcast" | "minigame") {
    setBusyAction(type);
    try {
      let generated;
      if (type === "slides") generated = await generateSlides(materialId);
      else if (type === "podcast") generated = await generatePodcast(materialId);
      else generated = await generateMinigame(materialId);

      router.push(`/materials/${materialId}/${type}?contentId=${generated.id}`);
    } catch (error) {
      setToast({ message: String(error), type: "error" });
    } finally {
      setBusyAction("");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (!material) {
    return (
      <Card className="text-center py-12">
        <BookOpen className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
        <p className="text-[var(--text-secondary)]">Không tìm thấy học liệu.</p>
        <Link href="/materials" className="mt-4 inline-block">
          <Button variant="secondary">Quay lại danh sách</Button>
        </Link>
      </Card>
    );
  }

  const contentActions = [
    {
      id: "slides",
      label: "Tạo Slides",
      icon: Presentation,
      gradient: "from-brand-500 to-brand-600",
      desc: "Tạo file PPTX tự động",
    },
    {
      id: "podcast",
      label: "Tạo Podcast",
      icon: Mic,
      gradient: "from-accent-500 to-accent-600",
      desc: "Kịch bản audio chi tiết",
    },
    {
      id: "minigame",
      label: "Tạo Minigame",
      icon: Gamepad2,
      gradient: "from-emerald-500 to-emerald-600",
      desc: "Quiz, flashcard, điền từ",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
        <Link href="/materials" className="hover:text-brand-600 transition-colors no-underline text-[var(--text-tertiary)]">
          <span className="flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            Học liệu
          </span>
        </Link>
        <span>/</span>
        <span className="text-[var(--text-secondary)] font-medium">{material.title}</span>
      </div>

      {/* Material Header */}
      <Card padding="lg">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-100 to-accent-100 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-7 h-7 text-brand-600" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
                {material.title}
              </h1>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                {material.description || "Không có mô tả"}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Badge status={material.processing_status} />
                {material.subject && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-medium">
                    {material.subject}
                  </span>
                )}
                {material.education_level && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                    {material.education_level}
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                  <Clock className="w-3 h-3" />
                  {new Date(material.updated_at).toLocaleDateString("vi-VN")}
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="secondary"
            icon={<Settings className="w-4 h-4 animate-spin" style={{ animationDuration: busyAction === "process" ? "1s" : "0s", animationPlayState: busyAction === "process" ? "running" : "paused" }} />}
            onClick={handleProcess}
            loading={busyAction === "process"}
          >
            {busyAction === "process" ? "Đang xử lý..." : "Xử lý tài liệu"}
          </Button>
        </div>
      </Card>

      {/* AI Generation Cards */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-accent-500" />
          <h2 className="text-lg font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
            Tạo nội dung AI
          </h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {contentActions.map((action) => {
            const Icon = action.icon;
            const isBusy = busyAction === action.id;
            return (
              <Card key={action.id} hover className="group">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${action.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">
                  {action.label}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                  {action.desc}
                </p>
                <Button
                  size="sm"
                  onClick={() => handleGenerate(action.id as "slides" | "podcast" | "minigame")}
                  loading={isBusy}
                  disabled={busyAction.length > 0}
                >
                  {isBusy ? "Đang tạo..." : "Bắt đầu tạo"}
                </Button>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Chat CTA */}
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-brand-200/30 to-accent-200/30 rounded-full -translate-y-1/2 translate-x-1/4 blur-2xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center flex-shrink-0 ai-glow">
              <MessageSquareText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                Chat với AI về tài liệu này
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Hỏi đáp thông minh dựa trên nội dung học liệu đã tải lên
              </p>
            </div>
          </div>
          <Link href={`/materials/${materialId}/chat`}>
            <Button icon={<MessageSquareText className="w-4 h-4" />}>
              Mở Chatbot
            </Button>
          </Link>
        </div>
      </Card>

      {/* Content Preview */}
      {fullText && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[var(--text-tertiary)]" />
              Nội dung trích xuất
            </h3>
            {hasMore && (
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => setIsFullPreview(!isFullPreview)}
              >
                {isFullPreview ? "Thu gọn" : "Xem toàn bộ nội dung"}
              </Button>
            )}
          </div>
          <div className="max-h-96 overflow-auto rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-light)] p-4">
            <pre className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap font-mono leading-relaxed m-0 bg-transparent border-0 p-0">
              {isFullPreview ? fullText : fullText.slice(0, previewLimit) + (hasMore ? "..." : "")}
            </pre>
          </div>
        </Card>
      )}

      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, message: "" })}
      />
    </motion.div>
  );
}
