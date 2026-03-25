"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Presentation,
  Download,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Star,
  Image as ImageIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Toast } from "@/components/ui/toast";
import { CardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { apiDownloadUrl, getGeneratedContent } from "@/lib/api";
import { GeneratedContent } from "@/types";

/* ──────────────── Types for new slide structure ──────────────── */

interface SlideElement {
  type: "bullet" | "image" | "highlight";
  content?: string | string[];
  query?: string;
}

interface SlideData {
  title: string;
  layout: "title_only" | "text_only" | "text_image";
  elements: SlideElement[];
}

/* ──────────────── Component ──────────────── */

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

  // Support both old format (string[]) and new format (SlideData[])
  const rawSlides: (string | SlideData)[] =
    content?.json_content?.slides || content?.outline || [];

  const slides: SlideData[] = rawSlides.map((s, i) => {
    if (typeof s === "string") {
      return {
        title: s,
        layout: i === 0 ? "title_only" : "text_only",
        elements: [],
      } as SlideData;
    }
    // Legacy format with type/bullets
    if ("bullets" in (s as any) && !("elements" in (s as any))) {
      const legacy = s as any;
      const elems: SlideElement[] = [];
      if (legacy.bullets?.length) {
        elems.push({ type: "bullet", content: legacy.bullets });
      }
      return {
        title: legacy.title || `Slide ${i + 1}`,
        layout: legacy.type === "title" ? "title_only" : "text_only",
        elements: elems,
      } as SlideData;
    }
    return s as SlideData;
  });

  const current = slides[currentSlide];

  /* ── Element renderers ── */

  const renderBullet = (el: SlideElement, idx: number) => {
    const items = Array.isArray(el.content) ? el.content : [];
    return (
      <ul key={idx} className="space-y-2 m-0 pl-0 list-none">
        {items.map((item, j) => (
          <motion.li
            key={j}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: j * 0.08 }}
            className="flex items-start gap-2.5 text-[15px] text-[var(--text-secondary)]"
          >
            <span className="text-brand-500 mt-0.5 text-sm shrink-0">▸</span>
            <span>{item}</span>
          </motion.li>
        ))}
      </ul>
    );
  };

  const renderHighlight = (el: SlideElement, idx: number) => {
    const text = typeof el.content === "string" ? el.content : "";
    if (!text) return null;
    return (
      <motion.div
        key={idx}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50"
      >
        <Star className="w-4 h-4 text-amber-500 shrink-0 fill-amber-400" />
        <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
          {text}
        </span>
      </motion.div>
    );
  };

  const renderImage = (el: SlideElement, idx: number) => {
    const query = el.query || "";
    if (!query) return null;
    return (
      <motion.div
        key={idx}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="flex flex-col items-center justify-center gap-2 px-6 py-8 rounded-xl bg-brand-50/50 dark:bg-brand-950/20 border border-brand-100 dark:border-brand-900/30"
      >
        <ImageIcon className="w-8 h-8 text-brand-300 dark:text-brand-700" />
        <span className="text-xs text-[var(--text-tertiary)] text-center italic">
          🖼 {query}
        </span>
      </motion.div>
    );
  };

  /* ── Layout renderers ── */

  const layoutClass =
    current?.layout === "text_image"
      ? "grid grid-cols-1 md:grid-cols-2 gap-6"
      : "space-y-4";

  const renderElements = () => {
    if (!current) return null;
    const elems = current.elements || [];
    const bullets = elems.filter((e) => e.type === "bullet");
    const images = elems.filter((e) => e.type === "image");
    const highlights = elems.filter((e) => e.type === "highlight");

    if (current.layout === "title_only") {
      return (
        <div className="flex flex-col items-center justify-center text-center space-y-4 py-4">
          {bullets.map(renderBullet)}
          {highlights.map(renderHighlight)}
        </div>
      );
    }

    if (current.layout === "text_image") {
      return (
        <div className={layoutClass}>
          <div className="space-y-4">
            {bullets.map(renderBullet)}
            {highlights.map(renderHighlight)}
          </div>
          <div className="space-y-3">
            {images.map(renderImage)}
          </div>
        </div>
      );
    }

    // text_only
    return (
      <div className="space-y-4">
        {elems.map((el, i) => {
          if (el.type === "bullet") return renderBullet(el, i);
          if (el.type === "highlight") return renderHighlight(el, i);
          if (el.type === "image") return renderImage(el, i);
          return null;
        })}
      </div>
    );
  };

  /* ── Layout badge labels ── */
  const layoutLabels: Record<string, string> = {
    title_only: "Trang bìa",
    text_only: "Nội dung",
    text_image: "Nội dung + Hình",
  };

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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge status={content.generation_status} />
                <span className="text-sm text-[var(--text-tertiary)]">
                  Phiên bản v{content.version}
                </span>
                {content.json_content?.tone && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400 font-medium">
                    {content.json_content.tone}
                  </span>
                )}
              </div>
              <span className="text-sm text-[var(--text-tertiary)]">
                {slides.length} slides
              </span>
            </div>
          </Card>

          {/* Slide Preview */}
          {slides.length > 0 ? (
            <>
              <Card padding="lg" className="relative overflow-hidden">
                <motion.div
                  key={currentSlide}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25 }}
                  className="min-h-[220px]"
                >
                  {/* Slide header */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400 text-xs font-semibold">
                        <Presentation className="w-3 h-3" />
                        Slide {currentSlide + 1} / {slides.length}
                      </div>
                      {current && (
                        <span className="text-[10px] uppercase tracking-wider font-medium text-[var(--text-tertiary)] px-2 py-0.5 rounded bg-[var(--bg-tertiary)]">
                          {layoutLabels[current.layout] || current.layout}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Slide title */}
                  {current && (
                    <>
                      {current.layout === "title_only" ? (
                        <div className="text-center py-6">
                          <h2
                            className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-2"
                            style={{ fontFamily: "var(--font-display)" }}
                          >
                            {current.title}
                          </h2>
                          {content.json_content?.title && current.title !== content.json_content.title && (
                            <p className="text-sm text-[var(--text-tertiary)]">
                              {content.json_content.title}
                            </p>
                          )}
                        </div>
                      ) : (
                        <h3
                          className="text-xl font-bold text-[var(--text-primary)] mb-4"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          {current.title}
                        </h3>
                      )}
                    </>
                  )}

                  {/* Slide body */}
                  {renderElements()}
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
                {slides.map((slide: SlideData, idx: number) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <Card
                      hover
                      padding="sm"
                      className={`!cursor-pointer ${idx === currentSlide ? "!border-brand-400 !bg-brand-50/50 dark:!bg-brand-950/20" : ""}`}
                      onClick={() => setCurrentSlide(idx)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-brand-500">
                          Slide {idx + 1}
                        </span>
                        <span className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)]">
                          {layoutLabels[slide.layout] || ""}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] line-clamp-2 font-medium">
                        {slide.title}
                      </p>
                      {/* Preview highlight if exists */}
                      {slide.elements?.find((e) => e.type === "highlight") && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 line-clamp-1 flex items-center gap-1">
                          <Star className="w-2.5 h-2.5 fill-amber-400" />
                          {typeof slide.elements.find((e) => e.type === "highlight")?.content === "string"
                            ? (slide.elements.find((e) => e.type === "highlight")?.content as string)
                            : ""}
                        </p>
                      )}
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
