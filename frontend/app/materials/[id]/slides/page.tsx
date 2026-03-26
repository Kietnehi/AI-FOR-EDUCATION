"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Presentation,
  Download,
  ArrowLeft,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Toast } from "@/components/ui/toast";
import { CardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { apiDownloadUrl, getGeneratedContent } from "@/lib/api";
import { GeneratedContent } from "@/types";

export default function SlidesPage() {
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const contentId = searchParams.get("contentId") || "";
  const materialId = params.id;

  const [content, setContent] = useState<GeneratedContent | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (!contentId) {
      setLoading(false);
      return;
    }
    getGeneratedContent(contentId)
      .then(setContent)
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [contentId]);

  const slides = content?.json_content?.slides || content?.outline || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
          <Link href={`/materials/${materialId}`} className="hover:text-brand-600 transition-colors no-underline text-[var(--text-tertiary)]">
            <span className="flex items-center gap-1.5">
              <ArrowLeft className="w-4 h-4" />
              Quay lại
            </span>
          </Link>
          <span>/</span>
          <span className="text-[var(--text-secondary)] font-medium flex items-center gap-1.5">
            <Presentation className="w-4 h-4" />
            Slides
          </span>
        </div>
        {content?.file_url && (
          <a href={apiDownloadUrl(content.file_url)} target="_blank" rel="noreferrer">
            <Button icon={<Download className="w-4 h-4" />} variant="secondary">
              Tải PPTX
            </Button>
          </a>
        )}
      </div>

      {loading && <CardSkeleton />}

      {!loading && !contentId && (
        <EmptyState
          icon={<Presentation className="w-10 h-10" />}
          title="Chưa có nội dung slides"
          description="Hãy tạo slides từ trang chi tiết học liệu trước."
          action={
            <Link href={`/materials/${materialId}`}>
              <Button variant="secondary">Quay lại tạo</Button>
            </Link>
          }
        />
      )}

      {error && <Toast message={error} type="error" />}

      {content && (
        <>
          {/* Info bar */}
          <Card className="!p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge status={content.generation_status} />
                <span className="text-sm text-[var(--text-tertiary)]">
                  Phiên bản v{content.version}
                </span>
                {content.model_used && (
                  <span className="text-sm text-[var(--text-tertiary)]">
                    Model: {content.model_used}
                  </span>
                )}
                {content.fallback_applied && (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    {`Đã chuyển sang model dự phòng: ${content.model_used || "không xác định"}`}
                  </span>
                )}
              </div>
              <span className="text-sm text-[var(--text-tertiary)]">
                {slides.length} slides
              </span>
            </div>
          </Card>

          {/* Slide Preview Cards */}
          {Array.isArray(slides) && slides.length > 0 ? (
            <>
              {/* Current slide display */}
              <Card padding="lg" className="relative">
                <motion.div
                  key={currentSlide}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="min-h-[180px] flex items-center justify-center"
                >
                  <div className="text-center max-w-lg">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand-600 text-xs font-semibold mb-4">
                      <Presentation className="w-3 h-3" />
                      Slide {currentSlide + 1} / {slides.length}
                    </div>
                    <h3 className="text-xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
                      {typeof slides[currentSlide] === "string"
                        ? slides[currentSlide]
                        : slides[currentSlide]?.title || `Slide ${currentSlide + 1}`}
                    </h3>
                    {typeof slides[currentSlide] !== "string" && slides[currentSlide]?.content && (
                      <p className="text-sm text-[var(--text-secondary)] mt-3">
                        {slides[currentSlide].content}
                      </p>
                    )}
                  </div>
                </motion.div>

                {/* Navigation */}
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--border-light)]">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<ChevronLeft className="w-4 h-4" />}
                    onClick={() => setCurrentSlide((p) => Math.max(0, p - 1))}
                    disabled={currentSlide === 0}
                  >
                    Trước
                  </Button>
                  <div className="flex gap-1.5">
                    {slides.map((_: any, i: number) => (
                      <button
                        key={i}
                        onClick={() => setCurrentSlide(i)}
                        className={`
                          w-2.5 h-2.5 rounded-full border-0 cursor-pointer transition-all duration-200
                          ${i === currentSlide
                            ? "bg-brand-500 w-6"
                            : "bg-[var(--border-default)] hover:bg-brand-300"
                          }
                        `}
                      />
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentSlide((p) => Math.min(slides.length - 1, p + 1))}
                    disabled={currentSlide === slides.length - 1}
                  >
                    Sau
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </Card>

              {/* Slide thumbnails */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {slides.map((slide: any, idx: number) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <Card
                      hover
                      padding="sm"
                      className={`!cursor-pointer ${idx === currentSlide ? "!border-brand-400 !bg-brand-50/50" : ""}`}
                      onClick={() => setCurrentSlide(idx)}
                    >
                      <div className="text-xs font-medium text-brand-500 mb-1">
                        Slide {idx + 1}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                        {typeof slide === "string" ? slide : slide?.title || `Nội dung slide ${idx + 1}`}
                      </p>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </>
          ) : (
            <Card>
              <h3 className="text-base font-semibold mb-3">Outline</h3>
              <ul className="space-y-2 m-0 pl-5">
                {content.outline.map((item) => (
                  <li key={item} className="text-sm text-[var(--text-secondary)]">{item}</li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </motion.div>
  );
}
