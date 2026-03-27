"use client";

import { useState } from "react";
import { Sparkles, Info } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SlideGenerationDialogProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (maxSlides: number, skipRefine: boolean) => void;
  loading?: boolean;
  progress?: number;
}

export function SlideGenerationDialog({
  open,
  onClose,
  onGenerate,
  loading = false,
  progress = 0,
}: SlideGenerationDialogProps) {
  const [maxSlides, setMaxSlides] = useState(10);
  const [skipRefine, setSkipRefine] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate(maxSlides, skipRefine);
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const estimatedTime = maxSlides <= 10 ? "30-60s" : maxSlides <= 20 ? "60-90s" : "90-120s";

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!loading) onClose();
      }}
      title="Tạo Slides"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Max Slides Input */}
        <div>
          <label htmlFor="maxSlides" className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
            Số lượng slide
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              id="maxSlides"
              min="3"
              max="50"
              value={maxSlides}
              onChange={(e) => setMaxSlides(parseInt(e.target.value))}
              disabled={loading}
              className="flex-1 h-2 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="flex items-center justify-center w-16 h-10 rounded-lg bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800/50">
              <span className="text-lg font-bold text-brand-600 dark:text-brand-400">
                {maxSlides}
              </span>
            </div>
          </div>
          <p className="text-xs text-[var(--text-tertiary)] mt-2">
            Từ 3 đến 50 slides (khuyến nghị: 10-20)
          </p>
        </div>

        {/* Skip Refine Checkbox */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="skipRefine"
            checked={skipRefine}
            onChange={(e) => setSkipRefine(e.target.checked)}
            disabled={loading}
            className="mt-0.5 w-4 h-4 rounded border-[var(--border-default)] bg-[var(--bg-primary)] accent-brand-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <div>
            <label htmlFor="skipRefine" className="text-sm font-medium text-[var(--text-primary)] cursor-pointer">
              Tối ưu thời gian (skip refine)
            </label>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              Giảm 50% thời gian xử lý, có thể ảnh hưởng chất lượng một chút
            </p>
          </div>
        </div>

        {/* Progress Bar when loading */}
        {loading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-secondary)] font-medium">Đang tạo slides...</span>
              <span className="text-brand-600 dark:text-brand-400 font-semibold">{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-[var(--text-tertiary)] text-center">
              Vui lòng đợi, quá trình này có thể mất {estimatedTime}
            </p>
          </div>
        )}

        {/* Info Box */}
        {!loading && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-blue-900 dark:text-blue-100 font-medium mb-1">Ước tính:</p>
              <ul className="space-y-1 text-blue-700 dark:text-blue-300 text-xs">
                <li>⏱ Thời gian: <span className="font-semibold">{estimatedTime}</span> {skipRefine && <span className="text-emerald-600 dark:text-emerald-400">(giảm 50%)</span>}</li>
                <li>📄 Kết quả: File PPTX có thể tải về</li>
              </ul>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={loading}
            className="flex-1"
          >
            {loading ? "Đang xử lý..." : "Hủy"}
          </Button>
          <Button
            type="submit"
            loading={loading}
            icon={!loading ? <Sparkles className="w-4 h-4" /> : undefined}
            className="flex-1"
          >
            {loading ? "Đang tạo..." : "Bắt đầu tạo"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
