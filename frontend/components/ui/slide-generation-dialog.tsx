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
        <div>
          <label htmlFor="maxSlides" className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">
            Số lượng slide
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              id="maxSlides"
              min="3"
              max="50"
              value={maxSlides}
              onChange={(e) => setMaxSlides(parseInt(e.target.value, 10))}
              disabled={loading}
              className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-[var(--bg-tertiary)] accent-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <div className="flex h-10 w-16 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] shadow-sm">
              <span className="text-lg font-bold text-brand-600 dark:text-brand-400">{maxSlides}</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-[var(--text-tertiary)]">Từ 3 đến 50 slides, khuyến nghị 10-20.</p>
        </div>

        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="skipRefine"
            checked={skipRefine}
            onChange={(e) => setSkipRefine(e.target.checked)}
            disabled={loading}
            className="mt-0.5 h-4 w-4 cursor-pointer rounded border-[var(--border-default)] bg-[var(--bg-primary)] accent-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div>
            <label htmlFor="skipRefine" className="cursor-pointer text-sm font-medium text-[var(--text-primary)]">
              Tối ưu thời gian
            </label>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              Giảm thời gian xử lý, có thể ảnh hưởng nhẹ đến chất lượng refine.
            </p>
          </div>
        </div>

        {loading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-[var(--text-secondary)]">Đang tạo slides...</span>
              <span className="font-semibold text-brand-600">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
              <div
                className="h-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-center text-xs text-[var(--text-tertiary)]">
              Vui lòng đợi, quá trình này có thể mất {estimatedTime}.
            </p>
          </div>
        )}

        {!loading && (
          <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/30 dark:bg-blue-900/20">
            <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
            <div className="text-sm">
              <p className="mb-1 font-medium text-blue-900 dark:text-blue-100">Ước tính:</p>
              <ul className="space-y-1 text-xs text-blue-700 dark:text-blue-300">
                <li>
                  Thời gian: <span className="font-semibold">{estimatedTime}</span>
                </li>
                <li>Kết quả: file PPTX có thể tải về</li>
              </ul>
            </div>
          </div>
        )}

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
            icon={!loading ? <Sparkles className="h-4 w-4" /> : undefined}
            className="flex-1"
          >
            {loading ? "Đang tạo..." : "Bắt đầu tạo"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
