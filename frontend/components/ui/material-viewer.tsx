"use client";

import { memo } from "react";
import { 
  FileText, FileImage, Play, Download, X, 
  Loader2, AlertCircle, File as FileIcon, FileAudio
} from "lucide-react";
import Image from "next/image";
import { Markdown } from "./markdown";
import { AudioPlayer } from "./audio-player";
import { Button } from "./button";
import { apiPreviewUrl, apiDownloadUrl } from "@/lib/api";
import { Material } from "@/types";

interface MaterialViewerProps {
  material: Material | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

export const MaterialViewer = memo(({ material, loading, error, onClose }: MaterialViewerProps) => {
  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 bg-[var(--bg-secondary)]/30 rounded-[2rem] border-2 border-dashed border-[var(--border-structural)]">
        <div className="relative">
            <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
            <div className="absolute inset-0 bg-brand-500/20 blur-xl animate-pulse rounded-full" />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Đang tải tài liệu</p>
      </div>
    );
  }

  if (error || !material) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 bg-rose-500/5 rounded-[2rem] border-2 border-dashed border-rose-500/20 text-center p-8">
        <div className="h-16 w-16 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 mb-2 border border-rose-500/20 shadow-sm">
            <AlertCircle className="h-8 w-8" />
        </div>
        <h3 className="text-base font-bold text-rose-500 uppercase tracking-tight">{error || "Chưa chọn tài liệu"}</h3>
        <p className="text-xs text-[var(--text-tertiary)] max-w-xs leading-relaxed">Vui lòng chọn một học liệu từ danh sách bên trái để bắt đầu xem nội dung và thảo luận.</p>
      </div>
    );
  }

  const { source_type, file_url, raw_text, cleaned_text, title, file_name } = material;
  const previewUrl = file_url ? apiPreviewUrl(file_url) : null;
  const downloadUrl = file_url ? apiDownloadUrl(file_url) : null;

  const renderContent = () => {
    if (source_type === "pdf" && previewUrl) {
      return (
        <div className="w-full h-full bg-[#1e1e1e] relative">
            <iframe 
                src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=1`} 
                className="w-full h-full border-none" 
                title={title}
            />
            <div className="absolute inset-0 pointer-events-none border-[12px] border-[var(--bg-elevated)]/5 rounded-[2.5rem]" />
        </div>
      );
    }

    if (source_type === "image" && previewUrl) {
      return (
        <div className="h-full flex flex-col p-6 overflow-y-auto custom-scrollbar gap-8">
          <div className="relative w-full aspect-auto min-h-[400px] rounded-3xl overflow-hidden border-2 border-[var(--border-structural)] bg-[var(--bg-secondary)] shadow-lg group">
            <Image src={previewUrl} alt={title} fill className="object-contain" unoptimized />
          </div>
          {(cleaned_text || raw_text) && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-brand-500 font-bold text-[10px] uppercase tracking-[0.15em]">
                <FileText className="h-4 w-4" /> Nội dung văn bản
              </div>
              <div className="p-6 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-light)] text-[var(--text-primary)] text-sm leading-relaxed shadow-sm">
                {cleaned_text || raw_text}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (source_type === "audio" && previewUrl) {
      return (
        <div className="h-full flex flex-col p-8 overflow-y-auto custom-scrollbar gap-10">
          <div className="bg-[var(--bg-elevated)] p-10 rounded-[2.5rem] border border-[var(--border-structural)] shadow-xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-40 h-40 bg-brand-500/5 blur-3xl rounded-full" />
             <AudioPlayer audioUrl={previewUrl} title={title} />
          </div>
          {cleaned_text && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-brand-500 font-bold text-[10px] uppercase tracking-[0.15em]">
                <FileAudio className="h-4 w-4" /> Bản gỡ băng chi tiết
              </div>
              <div className="p-8 rounded-[2rem] bg-[var(--bg-secondary)] border border-[var(--border-light)]">
                <Markdown content={cleaned_text} />
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="h-full p-10 overflow-y-auto custom-scrollbar prose dark:prose-invert max-w-none">
        <Markdown content={cleaned_text || raw_text || "Không có nội dung để hiển thị."} />
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-[var(--bg-elevated)] rounded-[2rem] border-2 border-[var(--border-structural)] overflow-hidden shadow-2xl animate-fade-in-up">
      {/* Header Toolbar */}
      <div className="px-6 py-4 border-b-2 border-[var(--border-structural)] bg-[var(--bg-secondary)]/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-brand-500 text-white flex items-center justify-center shadow-md shadow-brand-500/20 shrink-0">
                {source_type === 'pdf' ? <FileText className="h-5 w-5" /> : 
                 source_type === 'audio' ? <FileAudio className="h-5 w-5" /> :
                 <FileIcon className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
                <h3 className="text-sm font-bold text-[var(--text-primary)] truncate leading-tight">{title}</h3>
                <p className="text-[10px] text-[var(--text-tertiary)] truncate font-medium uppercase tracking-wider">{file_name}</p>
            </div>
        </div>

        <div className="flex items-center gap-3">
            {downloadUrl && (
                <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                    <Button 
                        size="sm"
                        className="bg-[var(--mint)] hover:bg-[#86d697] text-slate-900 font-bold px-6 h-10 rounded-xl shadow-lg shadow-brand-500/10 border-none transition-all active:scale-95 text-[11px] uppercase tracking-tight"
                        icon={<Download className="h-4 w-4" />}
                    >
                        Tải xuống
                    </Button>
                </a>
            )}
            <button 
                onClick={onClose}
                className="h-10 w-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-structural)] hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all flex items-center justify-center text-[var(--text-tertiary)] active:scale-95"
            >
                <X className="h-5 w-5" />
            </button>
        </div>
      </div>

      {/* Actual Viewer Area */}
      <div className="flex-1 overflow-hidden relative bg-[var(--bg-section)]/30">
        {renderContent()}
      </div>
    </div>
  );
});

MaterialViewer.displayName = "MaterialViewer";
