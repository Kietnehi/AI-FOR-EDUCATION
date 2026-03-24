"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Mic, ArrowLeft, User, Bot, Clock } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { getGeneratedContent } from "@/lib/api";
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
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
        <Link href={`/materials/${materialId}`} className="hover:text-brand-600 transition-colors no-underline text-[var(--text-tertiary)]">
          <span className="flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            Quay lại
          </span>
        </Link>
        <span>/</span>
        <span className="text-[var(--text-secondary)] font-medium flex items-center gap-1.5">
          <Mic className="w-4 h-4" />
          Podcast Script
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
        <>
          {/* Info */}
          <Card className="!p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge status={content.generation_status} />
                <span className="text-sm text-[var(--text-tertiary)]">
                  Phong cách: <strong className="text-[var(--text-secondary)]">{content.json_content?.style || "—"}</strong>
                </span>
              </div>
              <span className="text-sm text-[var(--text-tertiary)] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {segments.length} đoạn
              </span>
            </div>
          </Card>

          {/* Timeline-style segments */}
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-brand-300 via-accent-300 to-emerald-300" />

            <div className="space-y-4">
              {segments.map((segment: any, idx: number) => {
                const isHost = (segment.speaker || "").toLowerCase().includes("host");
                const Icon = isHost ? User : Bot;

                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.06 }}
                    className="relative pl-16"
                  >
                    {/* Timeline dot */}
                    <div className={`
                      absolute left-4 top-4 w-5 h-5 rounded-full
                      flex items-center justify-center z-10
                      ${isHost
                        ? "bg-brand-500"
                        : "bg-accent-500"
                      }
                    `}>
                      <Icon className="w-3 h-3 text-white" />
                    </div>

                    <Card className={`${isHost ? "!border-brand-100" : "!border-accent-100"}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                          isHost ? "bg-brand-50 text-brand-700" : "bg-accent-50 text-accent-700"
                        }`}>
                          {segment.speaker}
                        </span>
                        {segment.timestamp && (
                          <span className="text-xs text-[var(--text-tertiary)]">{segment.timestamp}</span>
                        )}
                      </div>
                      <p className="text-sm text-[var(--text-secondary)] leading-relaxed m-0">
                        {segment.text}
                      </p>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* TTS Placeholder */}
          {content.json_content?.tts_placeholder && (
            <Card>
              <h3 className="text-base font-semibold text-[var(--text-primary)] mb-3">
                Cấu hình TTS
              </h3>
              <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-light)] p-4 overflow-auto">
                <pre className="text-xs text-[var(--text-secondary)] m-0 bg-transparent border-0 p-0 font-mono">
                  {JSON.stringify(content.json_content.tts_placeholder, null, 2)}
                </pre>
              </div>
            </Card>
          )}
        </>
      )}
    </motion.div>
  );
}
