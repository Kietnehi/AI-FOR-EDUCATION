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
  Pencil,
  Trash2,
  Check,
  Eye,
  Play,
  RefreshCw,
  Network,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Tabs } from "@/components/ui/tabs";
import { Toast } from "@/components/ui/toast";
import { CardSkeleton } from "@/components/ui/skeleton";
import { SlideGenerationDialog } from "@/components/ui/slide-generation-dialog";
import { useNotify } from "@/components/use-notify";
import {
  confirmNotebookLMArtifactGeneration,
  deleteGeneratedContent,
  deleteMaterial,
  generateMinigame,
  generateNotebookLMMediaFromMaterial,
  generatePodcast,
  generateSlides,
  generateKnowledgeGraph,
  getMaterial,
  apiDownloadUrl,
  apiPreviewUrl,
  processMaterial,
  subscribeToMaterialRealtime,
  updateMaterial,
  confirmNotebookLMDownload,
  cancelNotebookLMSession,
  listGeneratedContents,
} from "@/lib/api";
import {
  Material,
  NotebookLMArtifactConfirmationResult,
  NotebookLMMediaResult,
  NotebookLMConfirmationResult,
  NotebookLMResponse,
  NotebookLMSavedResult,
  GeneratedContent,
} from "@/types";

const DATE_FORMATTER = new Intl.DateTimeFormat("vi-VN");

function getStorageLabel(storageType?: string): string {
  switch ((storageType || "").toLowerCase()) {
    case "local":
      return "Local";
    case "minio":
      return "MinIO";
    case "r2":
    case "s3":
      return "Cloudflare R2";
    case "none":
      return "Không có file";
    default:
      return "Không rõ";
  }
}
const EDUCATION_LEVEL_OPTIONS = [
  "Tiểu học",
  "THCS",
  "THPT",
  "Đại học/Cao đẳng",
  "Khác",
] as const;

export default function MaterialDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const materialId = params.id;
  const { success, error, info } = useNotify();

  const [material, setMaterial] = useState<Material | null>(null);
  const [generatedContents, setGeneratedContents] = useState<GeneratedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [isFullPreview, setIsFullPreview] = useState(false);
  const [showSlideDialog, setShowSlideDialog] = useState(false);
  const [slideProgress, setSlideProgress] = useState(0);
  const [notebookArtifactPending, setNotebookArtifactPending] = useState<NotebookLMArtifactConfirmationResult | null>(null);
  const [notebookGenerated, setNotebookGenerated] = useState<NotebookLMMediaResult | null>(null);
  const [isArtifactGenerating, setIsArtifactGenerating] = useState(false);
  const [notebookSaved, setNotebookSaved] = useState<NotebookLMSavedResult | null>(null);
  const [notebookForceRegenerate, setNotebookForceRegenerate] = useState(false);
  const [notebookConfirmation, setNotebookConfirmation] = useState<NotebookLMConfirmationResult | null>(null);
  const [selectedInfographic, setSelectedInfographic] = useState<{ file_name: string; file_url: string } | null>(null);
  const [isEditingMaterial, setIsEditingMaterial] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingGeneratedId, setDeletingGeneratedId] = useState("");
  const [libraryModalType, setLibraryModalType] = useState<"slides" | "podcast" | "minigame" | null>(null);
  const [showNotebookLibraryModal, setShowNotebookLibraryModal] = useState(false);
  const [forceRegenerateSlides, setForceRegenerateSlides] = useState(false);
  const [isCustomEducationLevel, setIsCustomEducationLevel] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    subject: "",
    education_level: "",
    tags: "",
  });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" }>({
    message: "",
    type: "success",
  });
  const [showProcessDialog, setShowProcessDialog] = useState(false);
  const [chunkingStrategy, setChunkingStrategy] = useState<"semantic" | "fixed">("fixed");

  // Wrapper để vừa hiện toast cũ, vừa thêm vào notification system mới
  const showToastAndNotify = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type });
    if (type === "success") success(message);
    else if (type === "error") error(message);
    else info(message);
  };

  // Wrapper để vừa hiện toast cũ, vừa thêm vào notification system mới
  const showToastAndNotify = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type });
    if (type === "success") success(message);
    else if (type === "error") error(message);
    else info(message);
  };

  const fullText = material?.cleaned_text || material?.raw_text || "";
  const previewLimit = 1000;
  const hasMore = fullText.length > previewLimit;

  useEffect(() => {
    if (!materialId) return;
    let cancelled = false;

    async function fetchData() {
      try {
        const [materialData, contentsData] = await Promise.all([
          getMaterial(materialId),
          listGeneratedContents(materialId),
        ]);
        if (!cancelled) {
          setMaterial(materialData);
          setGeneratedContents(contentsData);
        }
      } catch (error) {
        if (!cancelled) {
          setToast({ message: String(error), type: "error" });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [materialId]);

  useEffect(() => {
    if (!materialId) return;

    return subscribeToMaterialRealtime(materialId, {
      onSnapshot: (snapshot) => {
        setLoading(false);
        if (snapshot.deleted || !snapshot.material) {
          setToast({ message: "Học liệu này đã bị xóa hoặc không còn khả dụng.", type: "info" });
          router.push("/materials");
          return;
        }
        setMaterial(snapshot.material);
        setGeneratedContents(snapshot.generated_contents);
      },
      onError: () => undefined,
    });
  }, [materialId, router]);

  useEffect(() => {
    if (!material) return;
    const level = material.education_level || "";
    const isPresetLevel = EDUCATION_LEVEL_OPTIONS.some(
      (option) => option !== "Khác" && option === level
    );
    setIsCustomEducationLevel(Boolean(level) && !isPresetLevel);
    setEditForm({
      title: material.title,
      description: material.description || "",
      subject: material.subject || "",
      education_level: material.education_level || "",
      tags: material.tags.join(", "),
    });
  }, [material]);

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
    setShowProcessDialog(false);
    setBusyAction("process");
    try {
      await processMaterial(materialId, { 
        force_reprocess: true, 
        chunking_strategy: chunkingStrategy 
      });
      showToastAndNotify("Đã xếp hàng xử lý tài liệu với cấu hình mới thành công!", "success");
      const updated = await getMaterial(materialId);
      setMaterial(updated);
    } catch (error) {
      setToast({ message: String(error), type: "error" });
    } finally {
      setBusyAction("");
    }
  }

  async function handleGenerate(type: "slides" | "podcast" | "minigame") {
    const actionLabelMap: Record<"slides" | "podcast" | "minigame", string> = {
      slides: "tạo slides",
      podcast: "tạo podcast",
      minigame: "tạo minigame",
    };

    if (!ensureMaterialProcessed(actionLabelMap[type])) {
      return;
    }

    // For slides, show dialog first
    if (type === "slides") {
      setForceRegenerateSlides(false);
      setShowSlideDialog(true);
      return;
    }

    // For other types, generate directly
    setBusyAction(type);
    try {
      if (type === "podcast") {
        const generated = await generatePodcast(materialId, false);
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
  async function handleGenerateSlides(maxSlides: number, skipRefine: boolean, forceRegenerate = false) {
    if (!ensureMaterialProcessed("tạo slides")) {
      return;
    }

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
      const generated = await generateSlides(materialId, {
        max_slides: maxSlides,
        skip_refine: skipRefine,
        force_regenerate: forceRegenerate,
      });
      clearInterval(progressInterval);
      setSlideProgress(100);

      // Brief delay to show 100% completion
      await new Promise(resolve => setTimeout(resolve, 500));

      setShowSlideDialog(false);
      setForceRegenerateSlides(false);
      router.push(`/materials/${materialId}/slides?contentId=${generated.id}`);
    } catch (error) {
      clearInterval(progressInterval);
      setSlideProgress(0);
      setToast({ message: String(error), type: "error" });
    } finally {
      setForceRegenerateSlides(false);
      setBusyAction("");
    }
  }

  function getContentsByType(type: "slides" | "podcast" | "minigame") {
    return generatedContents
      .filter((content) => content.content_type === type)
      .sort((a, b) => Number(b.version || 0) - Number(a.version || 0));
  }

  async function refreshGeneratedContents() {
    const contentsData = await listGeneratedContents(materialId);
    setGeneratedContents(contentsData);
  }

  function openLibrary(type: "slides" | "podcast" | "minigame") {
    setLibraryModalType(type);
  }

  function openGeneratedItem(item: GeneratedContent) {
    if (item.content_type === "slides") {
      router.push(`/materials/${materialId}/slides?contentId=${item.id}`);
      return;
    }
    if (item.content_type === "podcast") {
      router.push(`/materials/${materialId}/podcast?contentId=${item.id}`);
      return;
    }
    if (item.content_type === "minigame") {
      router.push(`/materials/${materialId}/minigame?contentId=${item.id}`);
    }
  }

  async function handleCreateNewVersion(type: "slides" | "podcast" | "minigame") {
    if (!ensureMaterialProcessed(`tạo phiên bản mới ${type}`)) {
      return;
    }

    if (type === "slides") {
      setLibraryModalType(null);
      setForceRegenerateSlides(true);
      setShowSlideDialog(true);
      return;
    }

    setBusyAction(type);
    try {
      if (type === "podcast") {
        const generated = await generatePodcast(materialId, true);
        setLibraryModalType(null);
        await refreshGeneratedContents();
        router.push(`/materials/${materialId}/podcast?contentId=${generated.id}`);
        return;
      }

      setLibraryModalType(null);
      router.push(`/materials/${materialId}/minigame?mode=create`);
    } catch (error) {
      setToast({ message: String(error), type: "error" });
    } finally {
      setBusyAction("");
    }
  }

  async function handleDeleteGeneratedItem(item: GeneratedContent) {
    const difficultyLabel =
      item.difficulty === "easy"
        ? "Dễ"
        : item.difficulty === "hard"
          ? "Khó"
          : "Trung bình";
    const minigameName = minigameTypeLabels[item.game_type || ""] || "Minigame";
    const label = item.content_type === "minigame"
      ? `${minigameName} (${difficultyLabel})`
      : `${item.content_type} v${item.version}`;
    const confirmed = window.confirm(`Bạn có chắc muốn xóa ${label}?`);
    if (!confirmed) return;

    setDeletingGeneratedId(item.id);
    try {
      await deleteGeneratedContent(item.id);
      await refreshGeneratedContents();
      showToastAndNotify(`Đã xóa ${label} thành công.`, "success");
    } catch (error) {
      showToastAndNotify(String(error), "error");
    } finally {
      setDeletingGeneratedId("");
    }
  }

  async function handleGenerateNotebookMedia(confirm: boolean = false, forceRegenerate: boolean = false) {
    if (!confirm && !ensureMaterialProcessed("tạo video + infographic")) {
      return;
    }

    setBusyAction("notebooklm");
    try {
      if (!confirm) {
        setNotebookForceRegenerate(forceRegenerate);
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

      const payload = await generateNotebookLMMediaFromMaterial(
        materialId,
        undefined,
        confirm,
        confirm ? notebookForceRegenerate : forceRegenerate
      );

      if ("status" in payload && payload.status === "awaiting_confirmation") {
        setNotebookConfirmation(payload);
      } else if ("status" in payload && payload.status === "awaiting_artifact_confirmation") {
        setNotebookConfirmation(null);
        setNotebookArtifactPending(payload as NotebookLMArtifactConfirmationResult);
        showToastAndNotify(payload.message || "Đã upload xong. Xác nhận để bấm tạo Video + Infographic.", "info");
      } else if ("status" in payload && payload.status === "generation_complete") {
        setNotebookConfirmation(null);
        setNotebookArtifactPending(null);
        setNotebookGenerated(payload as NotebookLMMediaResult);
        showToastAndNotify(payload.message || "Đã tạo xong! Vui lòng xác nhận để tải xuống.", "success");
      } else if ("status" in payload && payload.status === "saved") {
        setNotebookConfirmation(null);
        setNotebookArtifactPending(null);
        setNotebookGenerated(null);
        setNotebookSaved(payload as NotebookLMSavedResult);
        setShowNotebookLibraryModal(true);
        showToastAndNotify("Đã tìm thấy nội dung đã tạo trước đó.", "info");
      }
    } catch (error) {
      showToastAndNotify(String(error), "error");
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
        showToastAndNotify(payload.message || "Đã bấm tạo trên NotebookLM. Khi render xong, bấm tải xuống.", "success");
      }
    } catch (error) {
      setNotebookGenerated(null);
      setNotebookArtifactPending(notebookArtifactPending);
      showToastAndNotify(String(error), "error");
    } finally {
      setIsArtifactGenerating(false);
      setBusyAction("");
    }
  }

  const handleForceDownload = (url: string, filename: string, showToast = true) => {
    showToastAndNotify(`Đang chuẩn bị tải xuống: ${filename}...`, "info");
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
      await refreshGeneratedContents();
      setNotebookSaved(result);
      setNotebookGenerated(null);
      setNotebookArtifactPending(null);
      setIsArtifactGenerating(false);

      const total = result.videos.length + result.infographics.length;
      showToastAndNotify(`Đã bắt đầu tải ${total} tệp (video + infographic) về máy.`, "success");

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
      showToastAndNotify("Đã hủy session và đóng browser", "info");
    } catch (error) {
      showToastAndNotify(String(error), "error");
    } finally {
      setBusyAction("");
    }
  }

  function handleOpenChatbot() {
    if (!ensureMaterialProcessed("mở chatbot")) {
      return;
    }
    router.push(`/materials/${materialId}/chat`);
  }

  function ensureMaterialProcessed(actionLabel: string): boolean {
    if (material?.processing_status === "processed") {
      return true;
    }

    setToast({
      message: `Vui lòng xử lý học liệu trước khi ${actionLabel}.`,
      type: "info",
    });
    return false;
  }

  async function handleSaveMaterialEdits() {
    const title = editForm.title.trim();
    if (!title) {
      showToastAndNotify("Tiêu đề không được để trống.", "error");
      return;
    }

    setSavingEdit(true);
    try {
      const updated = await updateMaterial(materialId, {
        title,
        description: editForm.description.trim() || undefined,
        subject: editForm.subject.trim() || undefined,
        education_level: editForm.education_level.trim() || undefined,
        tags: editForm.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });

      setMaterial(updated);
      showToastAndNotify("Đã cập nhật học liệu thành công.", "success");
      // Đóng dialog sau khi save thành công
      setIsEditingMaterial(false);
    } catch (error) {
      showToastAndNotify(String(error), "error");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteMaterial() {
    const confirmed = window.confirm("Bạn có chắc muốn xóa học liệu này không?");
    if (!confirmed) return;

    setBusyAction("delete");
    try {
      await deleteMaterial(materialId);
      showToastAndNotify("Đã xóa học liệu thành công.", "success");
      router.push("/materials");
    } catch (error) {
      showToastAndNotify(String(error), "error");
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
      label: "Slides bài giảng",
      icon: Presentation,
      gradient: "from-brand-500 to-brand-600",
      desc: "Tạo file PPTX tự động",
      items: getContentsByType("slides"),
    },
    {
      id: "podcast",
      label: "Podcast học tập",
      icon: Mic,
      gradient: "from-accent-500 to-accent-600",
      desc: "Kịch bản audio chi tiết",
      items: getContentsByType("podcast"),
    },
    {
      id: "minigame",
      label: "Minigame tương tác",
      icon: Gamepad2,
      gradient: "from-emerald-500 to-emerald-600",
      desc: "Quiz, flashcard, điền từ",
      items: getContentsByType("minigame"),
    },
  ];

  const libraryTypeLabels: Record<"slides" | "podcast" | "minigame", string> = {
    slides: "Slides bài giảng",
    podcast: "Podcast học tập",
    minigame: "Minigame tương tác",
  };

  const minigameTypeLabels: Record<string, string> = {
    quiz_mixed: "Quiz hỗn hợp",
    flashcard: "Flashcard",
    shooting_quiz: "Bắn gà ôn tập",
  };

  const difficultyLabels: Record<string, string> = {
    easy: "Dễ",
    medium: "Trung bình",
    hard: "Khó",
  };

  const libraryItems = libraryModalType ? getContentsByType(libraryModalType) : [];
  const notebookVideoItems = generatedContents.filter((content) => content.content_type === "video");
  const notebookInfographicItems = generatedContents.filter((content) => content.content_type === "infographic");

  // Get only the latest version for preview (highest version number)
  const latestVideo = notebookVideoItems.length > 0 
    ? notebookVideoItems.reduce((latest, current) => (current.version > latest.version ? current : latest))
    : null;
  const latestInfographic = notebookInfographicItems.length > 0
    ? notebookInfographicItems.reduce((latest, current) => (current.version > latest.version ? current : latest))
    : null;
  
  const hasNotebookMedia = notebookVideoItems.length > 0 || notebookInfographicItems.length > 0;

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
                <span className="text-xs px-2 py-0.5 rounded-md bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-medium">
                  Trạng thái: {material.processing_status === "processed" ? "Đã xử lý" : "Chưa xử lý"}
                </span>
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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              icon={<Settings className="w-4 h-4 animate-spin" style={{ animationDuration: busyAction === "process" ? "1s" : "0s", animationPlayState: busyAction === "process" ? "running" : "paused" }} />}
              onClick={() => setShowProcessDialog(true)}
              loading={busyAction === "process"}
            >
              {busyAction === "process" ? "Đang xử lý..." : "Xử lý tài liệu"}
            </Button>
            <Button
              variant="secondary"
              icon={<Pencil className="w-4 h-4" />}
              onClick={() => setIsEditingMaterial(true)}
              disabled={busyAction.length > 0}
            >
              Sửa
            </Button>
            <Button
              variant="secondary"
              icon={<Trash2 className="w-4 h-4" />}
              onClick={handleDeleteMaterial}
              loading={busyAction === "delete"}
              disabled={busyAction.length > 0 && busyAction !== "delete"}
            >
              Xóa
            </Button>
          </div>
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
            const existingCount = action.items.length;
            const hasExisting = existingCount > 0;
            
            return (
              <Card key={action.id} hover className="group relative">
                {hasExisting && (
                  <div className="absolute top-3 right-3">
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                      <Check className="w-3 h-3" />
                      {existingCount} phiên bản
                    </span>
                  </div>
                )}
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${action.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">
                  {action.label}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                  {action.desc}
                </p>
                <div className="flex flex-col gap-2 w-full">
                  {!hasExisting ? (
                    <Button
                      fullWidth
                      size="lg"
                      onClick={() => handleGenerate(action.id as "slides" | "podcast" | "minigame")}
                      loading={isBusy}
                      disabled={busyAction.length > 0}
                      className="rounded-2xl shadow-sm hover:shadow-md transition-all h-11"
                    >
                      Bắt đầu tạo
                    </Button>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <Button
                        fullWidth
                        size="lg"
                        onClick={() => openLibrary(action.id as "slides" | "podcast" | "minigame")}
                        loading={isBusy}
                        disabled={busyAction.length > 0 || deletingGeneratedId.length > 0}
                        icon={action.id === "minigame" ? <Play className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        className={`rounded-2xl h-11 shadow-sm hover:shadow-md transition-all font-bold text-white border-none bg-gradient-to-r ${action.gradient}`}
                      >
                        {isBusy ? "Đang xử lý..." : action.id === "minigame" ? "Chọn game đã tạo" : "Xem danh sách đã tạo"}
                      </Button>
                      
                      <button
                        type="button"
                        onClick={() => handleCreateNewVersion(action.id as "slides" | "podcast" | "minigame")}
                        disabled={busyAction.length > 0}
                        className="flex items-center justify-center gap-2 w-full h-10 px-4 rounded-xl border border-[var(--border-light)] bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors text-sm font-medium disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? "animate-spin" : ""}`} />
                        Tạo phiên bản mới
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Knowledge Graph Card */}
        {(() => {
          const kgItems = generatedContents.filter((c) => c.content_type === "knowledge_graph");
          const hasKg = kgItems.length > 0;
          const isKgBusy = busyAction === "knowledge_graph";

          return (
            <Card className="mt-4 group relative overflow-hidden" hover>
              {/* Subtle animated background */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-violet-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

              <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/30 group-hover:scale-110 transition-transform duration-300">
                    <Network className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold text-[var(--text-primary)]">
                        Knowledge Graph 3D
                      </h3>
                      {hasKg && (
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                          <Check className="w-3 h-3" />
                          Đã tạo
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                      Biểu đồ kiến thức tương tác 3D – trực quan hóa mối liên hệ giữa các khái niệm
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                  {hasKg ? (
                    <>
                      <Button
                        icon={<Eye className="w-4 h-4" />}
                        onClick={() => router.push(`/materials/${materialId}/knowledge-graph`)}
                        disabled={busyAction.length > 0}
                        className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-none shadow-sm hover:shadow-md"
                      >
                        Xem Knowledge Graph
                      </Button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!ensureMaterialProcessed("tạo lại knowledge graph")) return;
                          setBusyAction("knowledge_graph");
                          try {
                            await generateKnowledgeGraph(materialId, true);
                            await refreshGeneratedContents();
                            showToastAndNotify("Đã tạo lại Knowledge Graph!", "success");
                          } catch (error) {
                            setToast({ message: String(error), type: "error" });
                          } finally {
                            setBusyAction("");
                          }
                        }}
                        disabled={busyAction.length > 0}
                        className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-[var(--border-light)] bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors text-sm font-medium disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isKgBusy ? "animate-spin" : ""}`} />
                        Tạo lại
                      </button>
                    </>
                  ) : (
                    <Button
                      icon={<Sparkles className="w-4 h-4" />}
                      onClick={async () => {
                        if (!ensureMaterialProcessed("tạo knowledge graph")) return;
                        setBusyAction("knowledge_graph");
                        try {
                          await generateKnowledgeGraph(materialId, false);
                          await refreshGeneratedContents();
                          router.push(`/materials/${materialId}/knowledge-graph`);
                        } catch (error) {
                          setToast({ message: String(error), type: "error" });
                          setBusyAction("");
                        }
                      }}
                      loading={isKgBusy}
                      disabled={busyAction.length > 0}
                      className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-none shadow-sm hover:shadow-lg"
                    >
                      {isKgBusy ? "Đang tạo Knowledge Graph…" : "Tạo Knowledge Graph"}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })()}

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
              hasNotebookMedia ? (
                <div className="flex flex-col items-stretch sm:items-end gap-2">
                  <Button
                      onClick={() => setShowNotebookLibraryModal(true)}
                    disabled={busyAction.length > 0 || deletingGeneratedId.length > 0}
                    icon={<Eye className="w-4 h-4" />}
                  >
                    Xem danh sách đã tạo
                  </Button>
                  <button
                    type="button"
                    onClick={() => handleGenerateNotebookMedia(false, true)}
                    disabled={busyAction.length > 0}
                    className="flex items-center justify-center gap-2 w-full sm:w-auto h-10 px-4 rounded-xl border border-[var(--border-light)] bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors text-sm font-medium disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${busyAction === "notebooklm" ? "animate-spin" : ""}`} />
                    {busyAction === "notebooklm" ? "Đang upload lên NotebookLM..." : "Tạo phiên bản mới"}
                  </button>
                </div>
              ) : (
                <Button
                  onClick={() => handleGenerateNotebookMedia(false)}
                  loading={busyAction === "notebooklm"}
                  disabled={busyAction.length > 0}
                >
                  {busyAction === "notebooklm" ? "Đang upload học liệu lên NotebookLM..." : "Tạo Video + Infographic"}
                </Button>
              )
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
                      onClick={() => handleGenerateNotebookMedia(true, notebookForceRegenerate)}
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
        <Card className="bg-[var(--bg-secondary)] border-[var(--border-light)]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Đã lưu nội dung NotebookLM vào thư viện</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Video: {notebookSaved.videos.length} • Infographic: {notebookSaved.infographics.length}
              </p>
            </div>
            <Button
              onClick={() => setShowNotebookLibraryModal(true)}
              disabled={busyAction.length > 0 || deletingGeneratedId.length > 0}
              icon={<Eye className="w-4 h-4" />}
            >
              Mở thư viện Video + Infographic
            </Button>
          </div>
        </Card>
      )}

      {/* Preview Video và Infographic mới nhất */}
      {(latestVideo || latestInfographic) && (
        <Card className="relative overflow-hidden border border-[var(--border-light)] bg-[var(--bg-elevated)] shadow-lg">
          {/* Gradient overlay background */}
          <div className="absolute inset-0 bg-gradient-to-br from-brand-500/[0.03] via-transparent to-accent-500/[0.03] dark:from-brand-500/[0.08] dark:to-accent-500/[0.08] pointer-events-none" />
          
          <div className="relative">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4 border-b border-[var(--border-light)]">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 shadow-md">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
                      Video + Infographic
                    </h3>
                    <p className="text-xs text-[var(--text-tertiary)] font-medium">
                      Phiên bản mới nhất
                    </p>
                  </div>
                </div>
                <p className="text-sm text-[var(--text-secondary)] mt-2">
                  Xem trước nội dung mới nhất được tạo từ học liệu này.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowNotebookLibraryModal(true)}
                icon={<Eye className="w-4 h-4" />}
                className="flex-shrink-0"
              >
                Xem tất cả
              </Button>
            </div>

            {/* Content */}
            <div className="grid gap-5 p-5 md:grid-cols-2">
              {/* Video Preview */}
              {latestVideo && (
                <div className="group space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-500/10 dark:bg-brand-500/20">
                        <Presentation className="w-4 h-4 text-brand-500" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-[var(--text-primary)]">
                          Video
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-[var(--text-tertiary)]">
                            v{latestVideo.version}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-500 text-white shadow-sm">
                            MỚI
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] text-[var(--text-tertiary)] font-medium">
                      {DATE_FORMATTER.format(new Date(latestVideo.created_at))}
                    </span>
                  </div>
                  
                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 to-black dark:from-gray-950 dark:to-black shadow-lg ring-1 ring-[var(--border-light)] group-hover:shadow-xl transition-all duration-300">
                    <video 
                      controls 
                      preload="metadata" 
                      playsInline
                      className="w-full aspect-video" 
                      src={apiPreviewUrl(latestVideo.file_url || "")} 
                    />
                  </div>
                </div>
              )}

              {/* Infographic Preview */}
              {latestInfographic && (
                <div className="group space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent-500/10 dark:bg-accent-500/20">
                        <Sparkles className="w-4 h-4 text-accent-500" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-[var(--text-primary)]">
                          Infographic
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-[var(--text-tertiary)]">
                            v{latestInfographic.version}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-500 text-white shadow-sm">
                            MỚI
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] text-[var(--text-tertiary)] font-medium">
                      {DATE_FORMATTER.format(new Date(latestInfographic.created_at))}
                    </span>
                  </div>
                  
                  <div className="relative overflow-hidden rounded-xl bg-[var(--bg-secondary)] shadow-lg ring-1 ring-[var(--border-light)] group-hover:shadow-xl transition-all duration-300">
                    <button
                      type="button"
                      onClick={() => setSelectedInfographic({ file_name: `infographic_v${latestInfographic.version}`, file_url: latestInfographic.file_url || "" })}
                      className="group/btn relative block w-full overflow-hidden rounded-xl"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={apiPreviewUrl(latestInfographic.file_url || "")}
                        alt={`Infographic v${latestInfographic.version}`}
                        loading="lazy"
                        className="w-full aspect-auto transition-all duration-300 group-hover/btn:scale-[1.02] brightness-[0.98] dark:brightness-[0.95]"
                      />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/95 dark:bg-white/10 backdrop-blur-sm">
                          <Eye className="w-4 h-4 text-gray-900 dark:text-white" />
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            Xem phóng to
                          </span>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
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

      {libraryModalType &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm"
            onClick={() => setLibraryModalType(null)}
          >
            <div
              className="relative w-full max-w-4xl rounded-[28px] border border-white/10 bg-[var(--bg-elevated)] p-5 shadow-[0_30px_80px_rgba(2,6,23,0.45)]"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setLibraryModalType(null)}
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-light)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                aria-label="Đóng danh sách nội dung đã tạo"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="mb-4 pr-12">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                  Thư viện nội dung đã tạo
                </p>
                <h3 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                  {libraryTypeLabels[libraryModalType]}
                </h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {libraryModalType === "minigame"
                    ? "Chọn game đã tạo để mở lại, hoặc tạo game mới."
                    : "Chọn phiên bản đã tạo để mở lại, hoặc tạo phiên bản mới."}
                </p>
              </div>

              <div className="mb-4 flex items-center justify-end gap-2">
                <Button
                  onClick={() => handleCreateNewVersion(libraryModalType)}
                  loading={busyAction === libraryModalType}
                  disabled={busyAction.length > 0 || deletingGeneratedId.length > 0}
                  icon={<RefreshCw className="w-4 h-4" />}
                >
                  {libraryModalType === "minigame" ? "Tạo game mới" : "Tạo phiên bản mới"}
                </Button>
              </div>

              <div className="max-h-[65vh] space-y-3 overflow-auto pr-1">
                {libraryItems.length === 0 && (
                  <Card className="border-dashed">
                    <p className="text-sm text-[var(--text-secondary)] m-0">
                      Chưa có nội dung nào cho mục này.
                    </p>
                  </Card>
                )}

                {libraryItems.map((item) => {
                  const minigameDifficultyLabel = difficultyLabels[(item.difficulty || "medium").toLowerCase()] || (item.difficulty || "medium");
                  const title =
                    item.content_type === "podcast"
                      ? item.json_content?.title || `Podcast v${item.version}`
                      : item.content_type === "minigame"
                        ? `${minigameTypeLabels[item.game_type || ""] || "Minigame"} • ${minigameDifficultyLabel}`
                        : `Slides v${item.version}`;

                  return (
                    <Card key={item.id} className="border border-[var(--border-light)]">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h4 className="m-0 text-sm font-semibold text-[var(--text-primary)]">{title}</h4>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-tertiary)]">
                            {item.content_type !== "minigame" && (
                              <>
                                <span>Phiên bản {item.version}</span>
                                <span>•</span>
                              </>
                            )}
                            <span>{DATE_FORMATTER.format(new Date(item.created_at))}</span>
                            {item.model_used ? (
                              <>
                                <span>•</span>
                                <span>Model: {item.model_used}</span>
                              </>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={item.content_type === "minigame" ? <Play className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            onClick={() => openGeneratedItem(item)}
                            disabled={busyAction.length > 0 || deletingGeneratedId.length > 0}
                          >
                            {item.content_type === "minigame" ? "Vào game" : "Mở lại"}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            icon={<Trash2 className="w-4 h-4" />}
                            onClick={() => handleDeleteGeneratedItem(item)}
                            loading={deletingGeneratedId === item.id}
                            disabled={busyAction.length > 0}
                          >
                            Xóa
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {showNotebookLibraryModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm"
            onClick={() => setShowNotebookLibraryModal(false)}
          >
            <div
              className="relative w-full max-w-6xl max-h-[90vh] flex flex-col rounded-[28px] border border-[var(--border-light)] bg-[var(--bg-elevated)] shadow-[0_30px_80px_rgba(2,6,23,0.45)]"
              onClick={(event) => event.stopPropagation()}
            >
              {/* Header */}
              <div className="relative flex-shrink-0 px-6 pt-6 pb-4 border-b border-[var(--border-light)]">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-500/[0.05] via-transparent to-accent-500/[0.05] dark:from-brand-500/[0.1] dark:to-accent-500/[0.1] pointer-events-none rounded-t-[28px]" />
                <button
                  type="button"
                  onClick={() => setShowNotebookLibraryModal(false)}
                  className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-light)] text-[var(--text-secondary)] transition-all hover:text-[var(--text-primary)] hover:scale-105"
                  aria-label="Đóng thư viện video và infographic"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="relative">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 shadow-md">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
                        Thư viện Video + Infographic
                      </h3>
                      <p className="text-sm text-[var(--text-secondary)]">
                        Quản lý và xem lại tất cả phiên bản đã tạo
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions Bar */}
              <div className="flex-shrink-0 flex items-center justify-between gap-3 px-6 py-4 bg-[var(--bg-secondary)]/50 border-b border-[var(--border-light)]">
                <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
                  <Presentation className="w-4 h-4" />
                  <span className="font-medium">{notebookVideoItems.length} video{notebookVideoItems.length !== 1 ? 's' : ''}</span>
                  <span className="text-[var(--border-light)]">•</span>
                  <Sparkles className="w-4 h-4" />
                  <span className="font-medium">{notebookInfographicItems.length} infographic{notebookInfographicItems.length !== 1 ? 's' : ''}</span>
                </div>
                <Button
                  onClick={() => {
                    setShowNotebookLibraryModal(false);
                    handleGenerateNotebookMedia(false, true);
                  }}
                  loading={busyAction === "notebooklm"}
                  disabled={busyAction.length > 0}
                  icon={<RefreshCw className="w-4 h-4" />}
                  size="sm"
                >
                  Tạo phiên bản mới
                </Button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="grid gap-5 lg:grid-cols-2">
                  {/* Video Column */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2.5 pb-2 border-b border-[var(--border-light)]">
                      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-brand-500/10 dark:bg-brand-500/20">
                        <Presentation className="w-4 h-4 text-brand-500" />
                      </div>
                      <h4 className="text-sm font-bold text-[var(--text-primary)]">
                        Video
                      </h4>
                      <span className="ml-auto text-xs font-semibold text-[var(--text-tertiary)] bg-[var(--bg-secondary)] px-2 py-1 rounded-full">
                        {notebookVideoItems.length}
                      </span>
                    </div>

                    {notebookVideoItems.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Presentation className="w-12 h-12 text-[var(--text-tertiary)] opacity-30 mb-3" />
                        <p className="text-sm text-[var(--text-secondary)] font-medium">Chưa có video</p>
                        <p className="text-xs text-[var(--text-tertiary)] mt-1">Tạo phiên bản đầu tiên để bắt đầu</p>
                      </div>
                    )}

                    {notebookVideoItems
                      .sort((a, b) => b.version - a.version)
                      .map((item, index) => (
                        <Card 
                          key={item.id} 
                          className={`relative overflow-hidden border transition-all duration-200 ${
                            index === 0 
                              ? 'border-brand-500 shadow-md bg-gradient-to-br from-brand-500/[0.05] to-transparent dark:from-brand-500/[0.1]' 
                              : 'border-[var(--border-light)] bg-[var(--bg-secondary)] opacity-80 hover:opacity-100'
                          }`}
                        >
                          {index === 0 && (
                            <div className="absolute top-3 right-3 z-10">
                              <span className="inline-flex items-center gap-1 rounded-full bg-brand-500 px-2.5 py-1 text-[10px] font-bold text-white shadow-lg">
                                <Sparkles className="w-3 h-3" />
                                MỚI NHẤT
                              </span>
                            </div>
                          )}
                          
                          <div className="space-y-3 p-4">
                            <div className="overflow-hidden rounded-lg bg-black">
                              <video 
                                controls 
                                preload="metadata" 
                                playsInline
                                className="w-full aspect-video" 
                                src={apiPreviewUrl(item.file_url || "")} 
                              />
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-sm font-bold text-[var(--text-primary)]">
                                  Phiên bản {item.version}
                                </span>
                                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                                  {DATE_FORMATTER.format(new Date(item.created_at))}
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                icon={<Download className="w-3.5 h-3.5" />}
                                onClick={() => handleForceDownload(apiDownloadUrl(item.file_url || ""), `video_v${item.version}.mp4`)}
                                className="flex-1"
                              >
                                Tải xuống
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                icon={<Trash2 className="w-3.5 h-3.5" />}
                                onClick={() => handleDeleteGeneratedItem(item)}
                                loading={deletingGeneratedId === item.id}
                                disabled={busyAction.length > 0}
                              >
                                Xóa
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                  </div>

                  {/* Infographic Column */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2.5 pb-2 border-b border-[var(--border-light)]">
                      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-accent-500/10 dark:bg-accent-500/20">
                        <Sparkles className="w-4 h-4 text-accent-500" />
                      </div>
                      <h4 className="text-sm font-bold text-[var(--text-primary)]">
                        Infographic
                      </h4>
                      <span className="ml-auto text-xs font-semibold text-[var(--text-tertiary)] bg-[var(--bg-secondary)] px-2 py-1 rounded-full">
                        {notebookInfographicItems.length}
                      </span>
                    </div>

                    {notebookInfographicItems.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Sparkles className="w-12 h-12 text-[var(--text-tertiary)] opacity-30 mb-3" />
                        <p className="text-sm text-[var(--text-secondary)] font-medium">Chưa có infographic</p>
                        <p className="text-xs text-[var(--text-tertiary)] mt-1">Tạo phiên bản đầu tiên để bắt đầu</p>
                      </div>
                    )}

                    {notebookInfographicItems
                      .sort((a, b) => b.version - a.version)
                      .map((item, index) => (
                        <Card 
                          key={item.id} 
                          className={`relative overflow-hidden border transition-all duration-200 ${
                            index === 0 
                              ? 'border-accent-500 shadow-md bg-gradient-to-br from-accent-500/[0.05] to-transparent dark:from-accent-500/[0.1]' 
                              : 'border-[var(--border-light)] bg-[var(--bg-secondary)] opacity-80 hover:opacity-100'
                          }`}
                        >
                          {index === 0 && (
                            <div className="absolute top-3 right-3 z-10">
                              <span className="inline-flex items-center gap-1 rounded-full bg-accent-500 px-2.5 py-1 text-[10px] font-bold text-white shadow-lg">
                                <Sparkles className="w-3 h-3" />
                                MỚI NHẤT
                              </span>
                            </div>
                          )}
                          
                          <div className="space-y-3 p-4">
                            <button
                              type="button"
                              onClick={() => setSelectedInfographic({ file_name: `infographic_v${item.version}`, file_url: item.file_url || "" })}
                              className="group block w-full overflow-hidden rounded-lg"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={apiPreviewUrl(item.file_url || "")}
                                alt={`Infographic v${item.version}`}
                                loading="lazy"
                                className="w-full transition-transform duration-300 group-hover:scale-[1.02]"
                              />
                            </button>
                            
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-sm font-bold text-[var(--text-primary)]">
                                  Phiên bản {item.version}
                                </span>
                                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                                  {DATE_FORMATTER.format(new Date(item.created_at))}
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                icon={<Download className="w-3.5 h-3.5" />}
                                onClick={() => handleForceDownload(apiDownloadUrl(item.file_url || ""), `infographic_v${item.version}.png`)}
                                className="flex-1"
                              >
                                Tải xuống
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                icon={<Trash2 className="w-3.5 h-3.5" />}
                                onClick={() => handleDeleteGeneratedItem(item)}
                                loading={deletingGeneratedId === item.id}
                                disabled={busyAction.length > 0}
                              >
                                Xóa
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                  </div>
                </div>
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
          <Button icon={<MessageSquareText className="w-4 h-4" />} onClick={handleOpenChatbot}>
            Mở Chatbot
          </Button>
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
            setForceRegenerateSlides(false);
          }
        }}
        onGenerate={(maxSlides, skipRefine) => handleGenerateSlides(maxSlides, skipRefine, forceRegenerateSlides)}
        loading={busyAction === "slides"}
        progress={slideProgress}
      />

      <Dialog
        open={isEditingMaterial}
        onClose={() => {
          if (!savingEdit) setIsEditingMaterial(false);
        }}
        title="Chỉnh sửa học liệu"
        maxWidth="xl"
      >
        <div className="material-edit-dialog space-y-4">
          <style jsx>{`
            .material-edit-dialog > h3 {
              display: none;
            }
          `}</style>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Chỉnh sửa học liệu</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Tiêu đề *</span>
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="h-10 w-full rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] px-4 text-sm text-[var(--text-primary)]"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Môn học</span>
                <input
                  value={editForm.subject}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, subject: e.target.value }))}
                  className="h-10 w-full rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] px-4 text-sm text-[var(--text-primary)]"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Cấp học</span>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {EDUCATION_LEVEL_OPTIONS.map((option) => {
                      const isSelected =
                        option === "Khác"
                          ? isCustomEducationLevel
                          : !isCustomEducationLevel && editForm.education_level === option;

                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            if (option === "Khác") {
                              setIsCustomEducationLevel(true);
                              setEditForm((prev) => ({ ...prev, education_level: "" }));
                              return;
                            }
                            setIsCustomEducationLevel(false);
                            setEditForm((prev) => ({ ...prev, education_level: option }));
                          }}
                          className={`rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-200 ${
                            isSelected
                              ? "border-brand-400/70 bg-brand-500/15 text-[var(--text-primary)] shadow-[inset_0_0_0_1px_rgba(16,185,129,0.18)]"
                              : "border-[var(--border-light)] bg-[var(--bg-secondary)] text-[var(--text-border)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)]"
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>

                  {isCustomEducationLevel ? (
                    <input
                      value={editForm.education_level}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, education_level: e.target.value }))}
                      placeholder="Nhập cấp học khác"
                      className="h-10 w-full rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] px-4 text-sm text-[var(--text-primary)]"
                    />
                  ) : null}
                </div>
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Từ khóa</span>
                <input
                  value={editForm.tags}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, tags: e.target.value }))}
                  placeholder="Ngăn cách bằng dấu phẩy"
                  className="h-10 w-full rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] px-4 text-sm text-[var(--text-primary)]"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Mô tả</span>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] px-4 py-3 text-sm text-[var(--text-primary)]"
                />
              </label>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setIsEditingMaterial(false)}
                disabled={savingEdit}
                icon={<X className="w-4 h-4" />}
              >
                Hủy
              </Button>
              <Button onClick={handleSaveMaterialEdits} loading={savingEdit} icon={<Check className="w-4 h-4" />}>
                Lưu thay đổi
              </Button>
            </div>
        </div>
      </Dialog>
      {/* Processing Strategy Dialog */}
      {showProcessDialog &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm"
            onClick={() => setShowProcessDialog(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="relative w-full max-w-2xl rounded-[28px] border border-white/10 bg-[var(--bg-elevated)] p-7 shadow-[0_30px_80px_rgba(2,6,23,0.45)]"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowProcessDialog(false)}
                className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-light)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="mb-6">
                <div className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center mb-4">
                  <Settings className="w-6 h-6 text-brand-600" />
                </div>
                <h3 className="text-xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
                  Cấu hình xử lý học liệu
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  Chọn phương pháp chia nhỏ tài liệu (chunking) để AI đạt hiệu quả tốt nhất.
                </p>
              </div>

              <div className="space-y-4 mb-8">
                {/* Fixed Strategy Option */}
                <div 
                  className={`relative p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                    chunkingStrategy === "fixed" 
                      ? "border-brand-500 bg-brand-50/10" 
                      : "border-[var(--border-light)] hover:border-brand-300"
                  }`}
                  onClick={() => setChunkingStrategy("fixed")}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${chunkingStrategy === "fixed" ? "border-brand-500" : "border-[var(--border-light)]"}`}>
                      {chunkingStrategy === "fixed" && <div className="w-2 h-2 rounded-full bg-brand-500" />}
                    </div>
                    <span className="font-bold text-[var(--text-primary)]">Mặc định (Fixed Size + Overlap)</span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed ml-7">
                    Chia tài liệu thành các đoạn có độ dài cố định (2500 tokens) và gối đầu (500 tokens). 
                    <strong className="block mt-1 text-brand-600">Ưu điểm: Ổn định nhất, không mất thông tin ở các điểm cắt, tốc độ xử lý nhanh.</strong>
                  </p>
                </div>

                {/* Semantic Strategy Option */}
                <div 
                  className={`relative p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                    chunkingStrategy === "semantic" 
                      ? "border-accent-500 bg-accent-50/10" 
                      : "border-[var(--border-light)] hover:border-accent-300"
                  }`}
                  onClick={() => setChunkingStrategy("semantic")}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${chunkingStrategy === "semantic" ? "border-accent-500" : "border-[var(--border-light)]"}`}>
                      {chunkingStrategy === "semantic" && <div className="w-2 h-2 rounded-full bg-accent-500" />}
                    </div>
                    <span className="font-bold text-[var(--text-primary)]">Tự động theo ngữ nghĩa (Semantic Chunking)</span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed ml-7">
                    Dùng AI để nhận diện các điểm chuyển giao chủ đề và tự động tách đoạn khi nội dung thay đổi.
                    <strong className="block mt-1 text-accent-600">Ưu điểm: Các đoạn trích có nội dung hoàn chỉnh và tập trung vào một chủ đề duy nhất.</strong>
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => setShowProcessDialog(false)}
                >
                  Hủy bỏ
                </Button>
                <Button
                  fullWidth
                  onClick={handleProcess}
                  loading={busyAction === "process"}
                  icon={<Sparkles className="w-4 h-4" />}
                >
                  Bắt đầu xử lý
                </Button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}
    </motion.div>
  );
}
