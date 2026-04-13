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
import { CardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useNotify } from "@/components/use-notify";
import { apiDownloadUrl, apiPreviewUrl, getGeneratedContent } from "@/lib/api";
import { GeneratedContent } from "@/types";

interface SlideElement {
  type: "bullet" | "image" | "image_source" | "doc_image" | "highlight";
  content?: string | string[];
  query?: string;
  image_id?: string;
  image_context?: string;
  image_url?: string;
}

interface SlideData {
  title: string;
  layout: "title_only" | "text_only" | "text_image";
  elements: SlideElement[];
  image_url?: string;
}

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

function hasImageElement(elements: SlideElement[] = []): boolean {
  return elements.some((element) =>
    ["image", "image_source", "doc_image"].includes(element.type),
  );
}

export default function SlidesPage() {
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const contentId = searchParams.get("contentId") || "";
  const materialId = params.id;
  const { success, error: notifyError, info } = useNotify();

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
      .then((data) => {
        setContent(data);
        if (data?.json_content?.slides?.length) {
          success(`Đã tải ${data.json_content.slides.length} slides thành công!`);
        }
      })
      .catch((err) => {
        const msg = String(err);
        setError(msg);
        notifyError(msg);
      })
      .finally(() => setLoading(false));
  }, [contentId, notifyError, success]);

  const rawSlides: (string | SlideData | Record<string, any>)[] =
    content?.json_content?.slides || content?.outline || [];

  const slides: SlideData[] = rawSlides.map((slide, index) => {
    if (typeof slide === "string") {
      return {
        title: slide,
        layout: index === 0 ? "title_only" : "text_only",
        elements: [],
      };
    }

    if ("bullets" in slide && !("elements" in slide)) {
      const elements: SlideElement[] = [];
      if (Array.isArray(slide.bullets) && slide.bullets.length) {
        elements.push({ type: "bullet", content: slide.bullets });
      }
      if (slide.image_source_id || slide.image_url) {
        elements.push({
          type: "image_source",
          image_id: slide.image_source_id ? String(slide.image_source_id) : undefined,
          image_context: "Ảnh từ tài liệu nguồn",
          image_url: slide.image_url ? String(slide.image_url) : undefined,
        });
      }

      return {
        title: String(slide.title || `Slide ${index + 1}`),
        layout:
          slide.type === "title"
            ? "title_only"
            : slide.image_source_id || slide.image_url
              ? "text_image"
              : "text_only",
        elements,
        image_url: slide.image_url ? String(slide.image_url) : undefined,
      };
    }

    return slide as SlideData;
  });

  const current = slides[currentSlide];

  const renderBullet = (element: SlideElement, index: number) => {
    const items = Array.isArray(element.content) ? element.content : [];
    return (
      <ul key={index} className="m-0 list-none space-y-2 pl-0">
        {items.map((item, itemIndex) => (
          <motion.li
            key={itemIndex}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: itemIndex * 0.08 }}
            className="flex items-start gap-2.5 text-[15px] text-[var(--text-secondary)]"
          >
            <span className="mt-0.5 shrink-0 text-sm text-brand-500">•</span>
            <span>{item}</span>
          </motion.li>
        ))}
      </ul>
    );
  };

  const renderHighlight = (element: SlideElement, index: number) => {
    const text = typeof element.content === "string" ? element.content : "";
    if (!text) return null;

    return (
      <motion.div
        key={index}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/50 dark:bg-amber-950/30"
      >
        <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-500" />
        <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
          {text}
        </span>
      </motion.div>
    );
  };

  const renderImage = (element: SlideElement, index: number) => {
    const query = element.query || "";
    const sourceId = element.image_id || "";
    const context = element.image_context || "";
    const imageUrl = element.image_url || "";

    if (!query && !sourceId && !context && !imageUrl) return null;

    return (
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="overflow-hidden rounded-xl border border-brand-100 bg-brand-50/50 dark:border-brand-900/30 dark:bg-brand-950/20"
      >
        {imageUrl ? (
          <img
            src={apiPreviewUrl(imageUrl)}
            alt={context || sourceId || "Ảnh minh họa slide"}
            className="h-56 w-full object-contain bg-white/80"
          />
        ) : (
          <div className="flex h-56 w-full flex-col items-center justify-center gap-2 px-6 py-8 text-center">
            <ImageIcon className="h-8 w-8 text-brand-300 dark:text-brand-700" />
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              Ảnh từ tài liệu nguồn
            </span>
            {sourceId ? (
              <span className="text-xs italic text-[var(--text-tertiary)]">
                {sourceId}
              </span>
            ) : null}
          </div>
        )}
        <div className="space-y-1 border-t border-brand-100 px-4 py-3 dark:border-brand-900/30">
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            Ảnh từ tài liệu nguồn
          </p>
          {context ? (
            <p className="text-xs text-[var(--text-tertiary)]">{context}</p>
          ) : null}
          {!imageUrl && query ? (
            <p className="text-xs italic text-[var(--text-tertiary)]">
              Ảnh minh họa: {query}
            </p>
          ) : null}
        </div>
      </motion.div>
    );
  };

  const layoutClass =
    current?.layout === "text_image"
      ? "grid grid-cols-1 gap-6 md:grid-cols-2"
      : "space-y-4";

  const renderElements = () => {
    if (!current) return null;

    const elements = current.elements || [];
    const bullets = elements.filter((element) => element.type === "bullet");
    const images = elements.filter((element) =>
      ["image", "image_source", "doc_image"].includes(element.type),
    );
    const highlights = elements.filter((element) => element.type === "highlight");

    if (current.layout === "title_only") {
      return (
        <div className="flex flex-col items-center justify-center space-y-4 py-4 text-center">
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
          <div className="space-y-3">{images.map(renderImage)}</div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {elements.map((element, index) => {
          if (element.type === "bullet") return renderBullet(element, index);
          if (element.type === "highlight") return renderHighlight(element, index);
          if (["image", "image_source", "doc_image"].includes(element.type)) {
            return renderImage(element, index);
          }
          return null;
        })}
      </div>
    );
  };

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
          <Link
            href={`/materials/${materialId}`}
            className="no-underline text-[var(--text-tertiary)] transition-colors hover:text-brand-600"
          >
            <span className="flex items-center gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Quay lại
            </span>
          </Link>
          <span>/</span>
          <span className="flex items-center gap-1.5 font-medium text-[var(--text-secondary)]">
            <Presentation className="h-4 w-4" />
            Slides
          </span>
        </div>
        {content?.file_url ? (
          <Button
            icon={<Download className="h-4 w-4" />}
            variant="secondary"
            onClick={() => {
              info("Đang tải slide...");
              window.open(apiDownloadUrl(content.file_url!), "_blank");
            }}
          >
            Tải PPTX
          </Button>
        ) : null}
      </div>

      {loading ? <CardSkeleton /> : null}

      {!loading && !contentId ? (
        <EmptyState
          icon={<Presentation className="h-10 w-10" />}
          title="Chưa có nội dung slides"
          description="Hãy tạo slides từ trang chi tiết học liệu trước."
          action={
            <Link href={`/materials/${materialId}`}>
              <Button variant="secondary">Quay lại tạo</Button>
            </Link>
          }
        />
      ) : null}

      {content ? (
        <>
          <Card className="!p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge status={content.generation_status} />
                <span className="text-sm text-[var(--text-tertiary)]">
                  Phiên bản v{content.version}
                </span>
                <span className="rounded-full bg-[var(--bg-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                  Lưu trữ: {getStorageLabel(content.storage_type)}
                </span>
                {content.json_content?.tone ? (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600 dark:bg-brand-950/30 dark:text-brand-400">
                    {content.json_content.tone}
                  </span>
                ) : null}
              </div>
              <span className="text-sm text-[var(--text-tertiary)]">
                {slides.length} slides
              </span>
            </div>
          </Card>

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
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600 dark:bg-brand-950/30 dark:text-brand-400">
                        <Presentation className="h-3 w-3" />
                        Slide {currentSlide + 1} / {slides.length}
                      </div>
                      {current ? (
                        <span className="rounded bg-[var(--bg-tertiary)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                          {layoutLabels[current.layout] || current.layout}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {current ? (
                    <>
                      {current.layout === "title_only" ? (
                        <div className="py-6 text-center">
                          <h2
                            className="mb-2 text-2xl font-bold text-[var(--text-primary)] md:text-3xl"
                            style={{ fontFamily: "var(--font-display)" }}
                          >
                            {current.title}
                          </h2>
                          {content.json_content?.title &&
                          current.title !== content.json_content.title ? (
                            <p className="text-sm text-[var(--text-tertiary)]">
                              {content.json_content.title}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <h3
                          className="mb-4 text-xl font-bold text-[var(--text-primary)]"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          {current.title}
                        </h3>
                      )}
                    </>
                  ) : null}

                  {renderElements()}
                </motion.div>

                <div className="mt-6 flex items-center justify-between border-t border-[var(--border-light)] pt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<ChevronLeft className="h-4 w-4" />}
                    onClick={() => setCurrentSlide((prev) => Math.max(0, prev - 1))}
                    disabled={currentSlide === 0}
                  >
                    Trước
                  </Button>
                  <div className="flex gap-1.5">
                    {slides.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentSlide(index)}
                        className={`h-2.5 rounded-full border-0 transition-all duration-200 ${
                          index === currentSlide
                            ? "w-6 bg-brand-500"
                            : "w-2.5 bg-[var(--border-default)] hover:bg-brand-300"
                        }`}
                      />
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setCurrentSlide((prev) => Math.min(slides.length - 1, prev + 1))
                    }
                    disabled={currentSlide === slides.length - 1}
                  >
                    Sau
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </Card>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {slides.map((slide, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <Card
                      hover
                      padding="sm"
                      className={`!cursor-pointer ${
                        index === currentSlide
                          ? "!border-brand-400 !bg-brand-50/50 dark:!bg-brand-950/20"
                          : ""
                      }`}
                      onClick={() => setCurrentSlide(index)}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-medium text-brand-500">
                          Slide {index + 1}
                        </span>
                        <span className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)]">
                          {layoutLabels[slide.layout] || ""}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-xs font-medium text-[var(--text-secondary)]">
                        {slide.title}
                      </p>
                      {slide.elements?.find((element) => element.type === "highlight") ? (
                        <p className="mt-1 flex items-center gap-1 line-clamp-1 text-[10px] text-amber-600 dark:text-amber-400">
                          <Star className="h-2.5 w-2.5 fill-amber-400" />
                          {typeof slide.elements.find((element) => element.type === "highlight")
                            ?.content === "string"
                            ? (slide.elements.find((element) => element.type === "highlight")
                                ?.content as string)
                            : ""}
                        </p>
                      ) : null}
                      {hasImageElement(slide.elements) ? (
                        <p className="mt-1 flex items-center gap-1 text-[10px] text-brand-500">
                          <ImageIcon className="h-2.5 w-2.5" />
                          Có ảnh minh họa
                        </p>
                      ) : null}
                    </Card>
                  </motion.div>
                ))}
              </div>
            </>
          ) : (
            <Card>
              <h3 className="mb-3 text-base font-semibold">Outline</h3>
              <ul className="m-0 space-y-2 pl-5">
                {content.outline.map((item) => (
                  <li key={item} className="text-sm text-[var(--text-secondary)]">
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      ) : null}
    </motion.div>
  );
}
