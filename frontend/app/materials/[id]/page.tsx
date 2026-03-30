"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  Download,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Toast } from "@/components/ui/toast";
import { CardSkeleton } from "@/components/ui/skeleton";
import { SlideGenerationDialog } from "@/components/ui/slide-generation-dialog";
import {
  confirmNotebookLMArtifactGeneration,
  generateMinigame,
  generateNotebookLMMediaFromMaterial,
  generatePodcast,
  generateSlides,
  getMaterial,
  apiDownloadUrl,
  apiPreviewUrl,
  processMaterial,
  confirmNotebookLMDownload,
  cancelNotebookLMSession,
} from "@/lib/api";
import {
  Material,
  NotebookLMArtifactConfirmationResult,
  NotebookLMMediaResult,
  NotebookLMConfirmationResult,
  NotebookLMResponse,
  NotebookLMSavedResult,
} from "@/types";

const DATE_FORMATTER = new Intl.DateTimeFormat("vi-VN");

function getStorageLabel(storageType?: string): string {
  switch ((storageType || "").toLowerCase()) {
    case "local":
      return "Local";
    case "minio":
      return "MinIO";
    case "s3":
      return "S3";
    case "none":
      return "Không có file";
    default:
      return "Không rõ";
  }
}

export default function MaterialDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const materialId = params.id;

  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [isFullPreview, setIsFullPreview] = useState(false);
  const [showSlideDialog, setShowSlideDialog] = useState(false);
  const [slideProgress, setSlideProgress] = useState(0);
  const [notebookArtifactPending, setNotebookArtifactPending] = useState<NotebookLMArtifactConfirmationResult | null>(null);
  const [notebookGenerated, setNotebookGenerated] = useState<NotebookLMMediaResult | null>(null);
  const [isArtifactGenerating, setIsArtifactGenerating] = useState(false);
  const [notebookSaved, setNotebookSaved] = useState<NotebookLMSavedResult | null>(null);
  const [notebookConfirmation, setNotebookConfirmation] = useState<NotebookLMConfirmationResult | null>(null);
  const [selectedInfographic, setSelectedInfographic] = useState<{ file_name: string; file_url: string } | null>(null);
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

  useEffect(() => {
    if (!selectedInfographic) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedInfographic(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedInfographic]);

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
    // For slides, show dialog first
    if (type === "slides") {
      setShowSlideDialog(true);
      return;
    }

    // For other types, generate directly
    setBusyAction(type);
    try {
      if (type === "podcast") {
        const generated = await generatePodcast(materialId);
        router.push(`/materials/${materialId}/podcast?contentId=${generated.id}`);
        return;
      } else {
        // Minigame: navigate to minigame page without contentId
        // User will select game type there
        router.push(`/materials/${materialId}/minigame`);
        return;
      }
    } catch (error) {
      setToast({ message: String(error), type: "error" });
    } finally {
      setBusyAction("");
    }
  }
  async function handleGenerateSlides(maxSlides: number, skipRefine: boolean) {
    setBusyAction("slides");
    setSlideProgress(0);

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setSlideProgress((prev) => {
        if (prev >= 95) return prev; // Stop at 95%, let API completion bring it to 100%
        const increment = Math.random() * 15 + 5; // Random 5-20% increments
        return Math.min(prev + increment, 95);
      });
    }, 800);

    try {
      const generated = await generateSlides(materialId, { max_slides: maxSlides, skip_refine: skipRefine });
      clearInterval(progressInterval);
      setSlideProgress(100);

      // Brief delay to show 100% completion
      await new Promise(resolve => setTimeout(resolve, 500));

      setShowSlideDialog(false);
      router.push(`/materials/${materialId}/slides?contentId=${generated.id}`);
    } catch (error) {
      clearInterval(progressInterval);
      setSlideProgress(0);
      setToast({ message: String(error), type: "error" });
    } finally {
      setBusyAction("");
    }
  }

  async function handleGenerateNotebookMedia(confirm: boolean = false) {
    setBusyAction("notebooklm");
    try {
      if (!confirm) {
        setNotebookGenerated(null);
        setNotebookArtifactPending(null);
        setNotebookSaved(null);
      } else {
        // Show step-2 confirmation card immediately while upload is in progress.
        setNotebookConfirmation(null);
        setNotebookArtifactPending({
          status: "awaiting_artifact_confirmation",
          session_id: "",
          material_id: materialId,
          prompt: "",
          notebook_title: "",
          message: "Đang upload học liệu lên NotebookLM. Bước xác nhận tạo Video + Infographic sẽ sẵn sàng ngay khi upload hoàn tất.",
        });
      }

      const payload = await generateNotebookLMMediaFromMaterial(materialId, undefined, confirm);

      if ("status" in payload && payload.status === "awaiting_confirmation") {
        setNotebookConfirmation(payload);
      } else if ("status" in payload && payload.status === "awaiting_artifact_confirmation") {
        setNotebookConfirmation(null);
        setNotebookArtifactPending(payload as NotebookLMArtifactConfirmationResult);
        setToast({ message: payload.message || "Đã upload xong. Xác nhận để bấm tạo Video + Infographic.", type: "info" });
      } else if ("status" in payload && payload.status === "generation_complete") {
        setNotebookConfirmation(null);
        setNotebookArtifactPending(null);
        setNotebookGenerated(payload as NotebookLMMediaResult);
        setToast({ message: payload.message || "Đã tạo xong! Vui lòng xác nhận để tải xuống.", type: "success" });
      }
    } catch (error) {
      setToast({ message: String(error), type: "error" });
    } finally {
      setBusyAction("");
    }
  }

  async function handleConfirmArtifactGeneration() {
    if (!notebookArtifactPending?.session_id) return;
    setBusyAction("confirm-artifacts");
    setIsArtifactGenerating(true);

    try {
      const payload = await confirmNotebookLMArtifactGeneration(notebookArtifactPending.session_id);
      if (payload.status === "generation_complete") {
        setNotebookArtifactPending(null);
        setNotebookGenerated(payload as NotebookLMMediaResult);
        setToast({ message: payload.message || "Đã bấm tạo trên NotebookLM. Khi render xong, bấm tải xuống.", type: "success" });
      }
    } catch (error) {
      setNotebookGenerated(null);
      setNotebookArtifactPending(notebookArtifactPending);
      setToast({ message: String(error), type: "error" });
    } finally {
      setIsArtifactGenerating(false);
      setBusyAction("");
    }
  }

  const handleForceDownload = (url: string, filename: string, showToast = true) => {
    if (showToast) setToast({ message: `Đang chuẩn bị tải xuống: ${filename}...`, type: "info" });
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  async function handleConfirmDownload() {
    if (!notebookGenerated?.session_id) return;
    setBusyAction("confirm-download");
    try {
      const result = await confirmNotebookLMDownload(notebookGenerated.session_id);
      setNotebookSaved(result);
      setNotebookGenerated(null);
      setNotebookArtifactPending(null);
      setIsArtifactGenerating(false);

      const total = result.videos.length + result.infographics.length;
      setToast({ message: `Đã bắt đầu tải ${total} tệp (video + infographic) về máy.`, type: "success" });

      // Trigger direct browser downloads so user receives files immediately.
      const filesToDownload = [...result.videos, ...result.infographics];
      for (const file of filesToDownload) {
        handleForceDownload(apiDownloadUrl(file.file_url), file.file_name, false);
      }

    } catch (error) {
      setToast({ message: String(error), type: "error" });
    } finally {
      setBusyAction("");
    }
  }

  async function handleCancelPreview() {
    const sessionId = notebookGenerated?.session_id || notebookArtifactPending?.session_id;
    if (!sessionId) return;
    setBusyAction("cancel-preview");
    try {
      await cancelNotebookLMSession(sessionId);
      setNotebookGenerated(null);
      setNotebookArtifactPending(null);
      setIsArtifactGenerating(false);
      setToast({ message: "Đã hủy session và đóng browser", type: "info" });
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
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, message: "" })}
      />

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
                <span className="text-xs px-2 py-0.5 rounded-md bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-medium">
                  Lưu trữ: {getStorageLabel(material.storage_type)}
                </span>
                <span className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                  <Clock className="w-3 h-3" />
                  {DATE_FORMATTER.format(new Date(material.updated_at))}
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

        <Card className="mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Tạo Video + Infographic từ học liệu này</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Hệ thống sẽ dùng chính nội dung học liệu hiện tại để tạo media trên NotebookLM.
              </p>
            </div>
            {!notebookConfirmation ? (
              !notebookArtifactPending ? (
              <Button
                onClick={() => handleGenerateNotebookMedia(false)}
                loading={busyAction === "notebooklm"}
                disabled={busyAction.length > 0}
              >
                {busyAction === "notebooklm" ? "Đang upload học liệu lên NotebookLM..." : "Tạo Video + Infographic"}
              </Button>
              ) : (
                <div className="flex flex-col items-end gap-2">
                  <p className="text-sm text-blue-700 font-medium bg-blue-50 p-2 rounded max-w-sm text-right">
                    {notebookArtifactPending.message}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={handleCancelPreview}
                      disabled={busyAction.length > 0}
                    >
                      Hủy
                    </Button>
                    <Button
                      onClick={handleConfirmArtifactGeneration}
                      loading={busyAction === "confirm-artifacts"}
                      disabled={busyAction.length > 0 || !notebookArtifactPending.session_id}
                    >
                      {busyAction === "confirm-artifacts"
                        ? "Đang bấm tạo trên NotebookLM..."
                        : notebookArtifactPending.session_id
                          ? "Xác nhận và bắt đầu tạo Video + Infographic"
                          : "Đang chờ upload hoàn tất..."}
                    </Button>
                  </div>
                </div>
              )
            ) : (
              <div className="flex flex-col items-end gap-2">
                <p className="text-sm text-amber-600 font-medium bg-amber-50 p-2 rounded max-w-sm text-right">
                  {notebookConfirmation.message}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setNotebookConfirmation(null)}
                    disabled={busyAction.length > 0}
                  >
                    Hủy
                  </Button>
                  <Button
                    onClick={() => handleGenerateNotebookMedia(true)}
                    loading={busyAction === "notebooklm"}
                    disabled={busyAction.length > 0}
                  >
                    {busyAction === "notebooklm" ? "Đang mở NotebookLM và upload tài liệu..." : "Xác nhận và bắt đầu upload"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {notebookGenerated && (
        <Card className="bg-emerald-50 border-emerald-200">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-base font-semibold text-emerald-900 mb-1">Media đã tạo xong trên NotebookLM</h3>
              <p className="text-sm text-emerald-700 mb-3">
                {notebookGenerated.message}
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={handleConfirmDownload}
                  loading={busyAction === "confirm-download"}
                  disabled={busyAction === "confirm-download"}
                >
                  {busyAction === "confirm-download" ? "Đang tải xuống..." : "Xác nhận và tải xuống"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleCancelPreview}
                  loading={busyAction === "cancel-preview"}
                  disabled={busyAction.length > 0}
                >
                  Hủy
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {notebookSaved && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-3">Video từ NotebookLM</h3>
            <div className="space-y-3">
              {notebookSaved.videos.length === 0 && (
                <p className="text-sm text-[var(--text-secondary)]">Chưa có video được tải về.</p>
              )}
              {notebookSaved.videos.map((item) => (
                <div key={item.file_name} className="rounded-xl border border-[var(--border-light)] p-3 bg-[var(--bg-secondary)]">
                  <video controls preload="metadata" className="w-full rounded-lg mb-2" src={apiPreviewUrl(item.file_url)} />
                  <div className="flex flex-col gap-2 mt-3">
                    <span className="text-xs font-medium text-[var(--text-tertiary)] truncate px-1" title={item.file_name}>
                      {item.file_name}
                    </span>
                    <button
                      onClick={() => handleForceDownload(apiDownloadUrl(item.file_url), item.file_name)}
                      className="inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-600 to-accent-500 text-white shadow-sm hover:shadow-md hover:shadow-brand-500/25 rounded-xl transition-all font-medium text-sm border-none cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      Tải Video về máy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-3">Infographic từ NotebookLM</h3>
            <div className="space-y-3">
              {notebookSaved.infographics.length === 0 && (
                <p className="text-sm text-[var(--text-secondary)]">Chưa có infographic được tải về.</p>
              )}
              {notebookSaved.infographics.map((item) => (
                <div key={item.file_name} className="rounded-xl border border-[var(--border-light)] p-3 bg-[var(--bg-secondary)] mb-4">
                  <button
                    type="button"
                    onClick={() => setSelectedInfographic(item)}
                    className="group block w-full cursor-zoom-in rounded-xl border-0 bg-transparent p-0 text-left"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={apiPreviewUrl(item.file_url)}
                      alt={item.file_name}
                      loading="lazy"
                      decoding="async"
                      className="w-full rounded-lg mb-2 transition-transform duration-300 group-hover:scale-[1.01]"
                    />
                  </button>
                  <div className="flex flex-col gap-2 mt-3">
                    <span className="text-xs font-medium text-[var(--text-tertiary)] truncate px-1" title={item.file_name}>
                      {item.file_name}
                    </span>
                    <button
                      onClick={() => handleForceDownload(apiDownloadUrl(item.file_url), item.file_name)}
                      className="inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-600 to-accent-500 text-white shadow-sm hover:shadow-md hover:shadow-brand-500/25 rounded-xl transition-all font-medium text-sm border-none cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      Tải Infographic về máy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {selectedInfographic &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/82 px-4 py-8 backdrop-blur-sm"
            onClick={() => setSelectedInfographic(null)}
          >
            <div
              className="relative w-full max-w-5xl rounded-[28px] border border-white/10 bg-[var(--bg-elevated)] p-4 shadow-[0_30px_80px_rgba(2,6,23,0.45)]"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setSelectedInfographic(null)}
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-light)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                aria-label="Đóng xem infographic"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="mb-4 pr-12">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                  Xem infographic
                </p>
                <h3 className="mt-1 text-base font-semibold text-[var(--text-primary)]">
                  {selectedInfographic.file_name}
                </h3>
              </div>
              <div className="max-h-[78vh] overflow-auto rounded-2xl bg-[var(--bg-secondary)] p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={apiPreviewUrl(selectedInfographic.file_url)}
                  alt={selectedInfographic.file_name}
                  loading="lazy"
                  decoding="async"
                  className="mx-auto h-auto max-w-full rounded-xl"
                />
              </div>
            </div>
          </div>,
          document.body,
        )}

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

      <SlideGenerationDialog
        open={showSlideDialog}
        onClose={() => {
          if (busyAction !== "slides") {
            setShowSlideDialog(false);
            setSlideProgress(0);
          }
        }}
        onGenerate={handleGenerateSlides}
        loading={busyAction === "slides"}
        progress={slideProgress}
      />
    </motion.div>
  );
}
