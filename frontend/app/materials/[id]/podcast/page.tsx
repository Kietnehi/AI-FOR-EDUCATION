"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Mic, ArrowLeft, User, Bot, Clock, Headphones, Sparkles, Code } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { AudioPlayer } from "@/components/ui/audio-player";
import { apiDownloadUrl, apiPreviewUrl, getGeneratedContent } from "@/lib/api";
import { GeneratedContent } from "@/types";

export default function PodcastPage() {
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const contentId = searchParams.get("contentId") || "";
  const materialId = params.id;

  const [content, setContent] = useState<GeneratedContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!contentId) {
      setLoading(false);
      return;
    }
    getGeneratedContent(contentId)
      .then(setContent)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [contentId]);

  const segments = content?.json_content?.segments || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-4xl mx-auto"
    >
      {/* Header Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
        <Link href={`/materials/${materialId}`} className="hover:text-brand-600 transition-colors no-underline text-[var(--text-tertiary)]">
          <span className="flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            Quay lại
          </span>
        </Link>
        <span>/</span>
        <span className="text-[var(--text-secondary)] font-medium flex items-center gap-1.5">
          <Headphones className="w-4 h-4" />
          Podcast Generator
        </span>
      </div>

      {loading && <CardSkeleton />}

      {!loading && !contentId && (
        <EmptyState
          icon={<Mic className="w-10 h-10" />}
          title="Chưa có podcast"
          description="Hãy tạo podcast từ trang chi tiết học liệu trước."
          action={
            <Link href={`/materials/${materialId}`}>
              <Button variant="secondary">Quay lại tạo</Button>
            </Link>
          }
        />
      )}

      {content && (
        <div className="space-y-8">
          {/* Header Section */}
          <div className="relative p-6 md:p-8 rounded-[2rem] bg-[var(--bg-primary)] border border-[var(--border-light)] shadow-sm overflow-hidden">
            {/* Subtle decorative glow */}
            <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-64 h-64 bg-accent-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="flex flex-col sm:flex-row gap-5 sm:items-center">
                <div className="flex-shrink-0 w-16 h-16 bg-[var(--bg-primary)] border border-[var(--border-light)] shadow-sm rounded-2xl flex items-center justify-center relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-accent-500/5 rounded-2xl transition-opacity group-hover:opacity-100" />
                  <Mic className="w-8 h-8 text-brand-600 dark:text-brand-400 relative z-10" />
                </div>
                <div className="space-y-3">
                  <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
                    {content.json_content?.title || "Kịch bản Podcast"}
                  </h1>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-light)] text-[var(--text-secondary)] shadow-sm transition-colors hover:border-brand-300">
                      <Sparkles className="w-4 h-4 text-brand-500" />
                      <span className="font-medium">
                        Phong cách: {content.json_content?.style || "Tiêu chuẩn"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-light)] text-[var(--text-secondary)] shadow-sm transition-colors hover:border-accent-300">
                      <Clock className="w-4 h-4 text-accent-500" />
                      <span className="font-medium">{segments.length} đoạn hội thoại</span>
                    </div>
                    {content.model_used && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-light)] text-[var(--text-secondary)] shadow-sm">
                        <span className="font-medium">Model: {content.model_used}</span>
                      </div>
                    )}
                    {content.fallback_applied && (
                      <div className="rounded-lg border border-amber-200 bg-amber-100 px-3 py-1.5 text-amber-700 shadow-sm">
                        {`Đã chuyển sang model dự phòng: ${content.model_used || "không xác định"}`}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0 flex items-center">
                 <Badge status={content.generation_status} className="px-3 py-1.5 text-sm shadow-sm" />
              </div>
            </div>
          </div>

          {/* Audio Player */}
          {content.file_url && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
              <AudioPlayer
                audioUrl={apiPreviewUrl(content.file_url)}
                downloadUrl={apiDownloadUrl(content.file_url)}
                title={content.json_content?.title || "Podcast Audio"}
                className="shadow-lg border-0 ring-1 ring-[var(--border-light)]"
              />
            </div>
          )}

          {/* Transcript Section */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Mic className="w-5 h-5 text-brand-500" />
              Nội dung kịch bản
            </h2>

            <div className="flex flex-col gap-6">
              {segments.map((segment: any, idx: number) => {
                const isHost = (segment.speaker || "").toLowerCase().includes("host");
                
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex gap-4 group"
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0 pt-1">
                      <div className={`
                        w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-105
                        ${isHost 
                          ? 'bg-gradient-to-br from-brand-400 to-brand-600 text-white' 
                          : 'bg-gradient-to-br from-accent-400 to-accent-600 text-white'
                        }
                      `}>
                        {isHost ? <User className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
                      </div>
                    </div>

                    {/* Content Bubble */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2.5">
                        <span className={`font-bold text-sm ${isHost ? 'text-brand-600 dark:text-brand-400' : 'text-accent-600 dark:text-accent-400'}`}>
                          {segment.speaker || (isHost ? "Host" : "Guest")}
                        </span>
                        {segment.timestamp && (
                          <span className="text-xs text-[var(--text-tertiary)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded-full font-medium">
                            {segment.timestamp}
                          </span>
                        )}
                      </div>
                      
                      <Card className={`
                        !p-5 border-0 shadow-sm
                        rounded-2xl rounded-tl-sm
                        transition-colors
                        ${isHost 
                          ? 'bg-brand-50/60 hover:bg-brand-50 dark:bg-brand-950/10 dark:hover:bg-brand-950/20' 
                          : 'bg-accent-50/60 hover:bg-accent-50 dark:bg-accent-950/10 dark:hover:bg-accent-950/20'
                        }
                      `}>
                        <p className="text-[var(--text-secondary)] leading-relaxed m-0 text-[15px]">
                          {segment.text}
                        </p>
                      </Card>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* TTS Placeholder / Technical Details */}
          {content.json_content?.tts_placeholder && (
            <details className="group border border-[var(--border-light)] rounded-2xl bg-[var(--bg-primary)] overflow-hidden transition-all shadow-sm">
              <summary className="flex items-center gap-2 p-4 cursor-pointer font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors list-none select-none">
                <Code className="w-4 h-4 text-[var(--text-tertiary)] group-open:text-brand-500 transition-colors" />
                <span className="flex-1 text-sm">Dữ liệu cấu hình TTS (Dành cho Developer)</span>
                <span className="text-[var(--text-tertiary)] text-xs opacity-60 group-open:opacity-0 transition-opacity">Nhấn để xem</span>
              </summary>
              <div className="p-4 border-t border-[var(--border-light)] bg-[var(--bg-secondary)]/50">
                <pre className="text-[13px] text-[var(--text-secondary)] font-mono overflow-x-auto whitespace-pre-wrap rounded-xl bg-black/5 dark:bg-white/5 p-4 border border-[var(--border-light)]">
                  {JSON.stringify(content.json_content.tts_placeholder, null, 2)}
                </pre>
              </div>
            </details>
          )}
        </div>
      )}
    </motion.div>
  );
}
