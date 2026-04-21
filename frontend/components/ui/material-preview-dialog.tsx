"use client";

import { useEffect, useState } from "react";
import { 
  X, Loader2, FileText, FileImage, 
  Play, Download, ExternalLink, BookOpen,
  AlertCircle, File as FileIcon, FileAudio
} from "lucide-react";
import Image from "next/image";

import { Dialog } from "./dialog";
import { Button } from "./button";
import { Markdown } from "./markdown";
import { AudioPlayer } from "./audio-player";
import { Badge } from "./badge";
import { getMaterial, apiPreviewUrl, apiDownloadUrl } from "@/lib/api";
import { Material } from "@/types";

interface MaterialPreviewDialogProps {
  materialId: string | null;
  onClose: () => void;
}

export function MaterialPreviewDialog({ materialId, onClose }: MaterialPreviewDialogProps) {
  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!materialId) {
      setMaterial(null);
      setError(null);
      return;
    }

    const fetchMaterial = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getMaterial(materialId);
        setMaterial(data);
      } catch (err) {
        console.error("Failed to fetch material for preview:", err);
        setError("Không thể tải thông tin học liệu này.");
      } finally {
        setLoading(false);
      }
    };

    fetchMaterial();
  }, [materialId]);

  const renderPreviewContent = () => {
    if (!material) return null;

    const { source_type, file_url, raw_text, cleaned_text, title } = material;
    const previewUrl = file_url ? apiPreviewUrl(file_url) : null;

    // 1. PDF Preview
    if (source_type === "pdf" && previewUrl) {
      return (
        <div className="flex-1 min-h-[600px] rounded-2xl overflow-hidden border-2 border-[var(--border-light)] bg-[var(--bg-secondary)] shadow-inner">
          <iframe 
            src={`${previewUrl}#toolbar=0&navpanes=0`} 
            className="w-full h-full" 
            title={title}
          />
        </div>
      );
    }

    // 2. Image Preview
    if (source_type === "image" && previewUrl) {
      return (
        <div className="space-y-6">
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden border-2 border-[var(--border-light)] bg-black/5 group">
            <Image 
              src={previewUrl} 
              alt={title} 
              fill 
              className="object-contain transition-transform duration-500 group-hover:scale-[1.02]"
              unoptimized
            />
          </div>
          {(cleaned_text || raw_text) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-brand-600 font-bold text-sm uppercase tracking-wider">
                <FileText className="h-4 w-4" /> Nội dung nhận diện (OCR)
              </div>
              <div className="p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-light)] text-[var(--text-primary)] text-sm leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap shadow-sm">
                {cleaned_text || raw_text}
              </div>
            </div>
          )}
        </div>
      );
    }

    // 3. Audio Preview
    if (source_type === "audio" && previewUrl) {
      return (
        <div className="space-y-8 py-4">
          <div className="bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-900/20 dark:to-brand-800/20 p-8 rounded-3xl border-2 border-brand-200/30 shadow-lg">
            <AudioPlayer audioUrl={previewUrl} title={title} />
          </div>
          {cleaned_text && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-brand-600 font-bold text-sm uppercase tracking-wider">
                  <FileAudio className="h-4 w-4" /> Bản gỡ băng (Transcript)
                </div>
                <Badge variant="generated" className="text-[10px]">AI Generated</Badge>
              </div>
              <div className="p-6 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-light)] text-[var(--text-primary)] shadow-sm max-h-[400px] overflow-y-auto">
                <Markdown content={cleaned_text} />
              </div>
            </div>
          )}
        </div>
      );
    }

    // 4. Default: Text/Markdown
    const contentToShow = cleaned_text || raw_text || "Tài liệu này không có nội dung văn bản để hiển thị.";
    return (
      <div className="p-8 rounded-3xl bg-[var(--bg-secondary)] border-2 border-[var(--border-light)] shadow-inner max-h-[70vh] overflow-y-auto prose dark:prose-invert max-w-none">
        <Markdown content={contentToShow} />
      </div>
    );
  };

  const downloadUrl = material?.file_url ? apiDownloadUrl(material.file_url) : null;

  return (
    <Dialog 
      open={!!materialId} 
      onClose={onClose}
      maxWidth="xl"
    >
      <div className="bg-[var(--bg-elevated)] rounded-[2.5rem] border-4 border-[var(--border-structural)] overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b-4 border-[var(--border-structural)] bg-[var(--bg-secondary)] flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="h-12 w-12 rounded-2xl bg-brand-500 text-white flex items-center justify-center shadow-[4px_4px_0px_rgba(0,0,0,0.1)] shrink-0">
               {material?.source_type === 'pdf' ? <FileText className="h-6 w-6" /> : 
                material?.source_type === 'image' ? <FileImage className="h-6 w-6" /> :
                material?.source_type === 'audio' ? <Play className="h-6 w-6 ml-1" /> :
                <FileIcon className="h-6 w-6" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-black text-[var(--text-primary)] truncate leading-tight">
                {material?.title || "Đang tải..."}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-tighter">
                    {material?.source_type || 'Unknown'}
                </Badge>
                <span className="text-[10px] text-[var(--text-tertiary)] font-medium">
                    {material?.file_name}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {downloadUrl && (
              <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                <Button 
                    className="bg-brand-500 hover:bg-brand-600 text-white border-b-4 border-brand-700 active:border-b-0 active:translate-y-[2px] transition-all px-6 h-11"
                    icon={<Download className="h-4 w-4" />}
                >
                  Tải xuống
                </Button>
              </a>
            )}
            <button 
              onClick={onClose}
              className="h-11 w-11 rounded-2xl bg-[var(--bg-secondary)] border-2 border-[var(--border-structural)] flex items-center justify-center text-[var(--text-tertiary)] hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 transition-all shadow-sm"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {loading ? (
            <div className="py-32 flex flex-col items-center justify-center gap-6">
              <div className="relative">
                <Loader2 className="h-16 w-16 animate-spin text-brand-500" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-8 w-8 bg-brand-500/20 rounded-full animate-pulse" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-lg font-bold text-[var(--text-primary)]">Đang mở tài liệu...</p>
                <p className="text-sm text-[var(--text-tertiary)]">Vui lòng đợi trong giây lát</p>
              </div>
            </div>
          ) : error ? (
            <div className="py-32 flex flex-col items-center justify-center gap-4 text-center">
              <div className="h-20 w-20 rounded-3xl bg-rose-50 flex items-center justify-center text-rose-500 mb-4 border-2 border-rose-100 shadow-sm">
                <AlertCircle className="h-10 w-10" />
              </div>
              <h3 className="text-xl font-bold text-rose-600">{error}</h3>
              <p className="text-[var(--text-secondary)] max-w-xs mx-auto">Hệ thống không tìm thấy file hoặc bạn không có quyền truy cập.</p>
              <Button variant="secondary" onClick={onClose} className="mt-4">Đóng cửa sổ</Button>
            </div>
          ) : (
            <div className="animate-fade-in-up">
              {renderPreviewContent()}
            </div>
          )}
        </div>

        {/* Footer Info */}
        {!loading && !error && (
            <div className="px-8 py-4 bg-[var(--bg-secondary)]/30 border-t border-[var(--border-light)] flex justify-between items-center text-[10px] text-[var(--text-tertiary)] font-medium">
                <div className="flex gap-4">
                    <span>Dung lượng: {material?.file_name ? "Đang tính..." : "N/A"}</span>
                    <span>Ngày tải lên: {material ? new Date(material.created_at).toLocaleDateString("vi-VN") : ""}</span>
                </div>
                <div className="flex items-center gap-1 text-brand-600">
                    <BookOpen className="h-3 w-3" /> AI Learning Studio Verified
                </div>
            </div>
        )}
      </div>
    </Dialog>
  );
}
