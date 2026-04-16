"use client";

import { AlertTriangle, Loader2 } from "lucide-react";

import { Dialog } from "@/components/ui/dialog";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  tone?: "danger" | "default";
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  isLoading = false,
  tone = "default",
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const dangerTone = tone === "danger";

  return (
    <Dialog open={open} onClose={isLoading ? () => undefined : onClose} maxWidth="sm">
      <div className="space-y-5">
        <div className="flex items-start gap-4">
          <div
            className={[
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border",
              dangerTone
                ? "border-rose-200 dark:border-rose-900/30 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400"
                : "border-amber-200 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400",
            ].join(" ")}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>

          <div className="min-w-0 space-y-2">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
            <p className="text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] px-4 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={[
              "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              dangerTone ? "bg-rose-600 hover:bg-rose-700" : "bg-brand-600 hover:bg-brand-700",
            ].join(" ")}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
