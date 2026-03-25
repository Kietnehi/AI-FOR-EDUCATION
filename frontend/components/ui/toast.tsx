"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, AlertCircle, X } from "lucide-react";

interface ToastProps {
  message: string;
  type: "success" | "error" | "info";
  onClose?: () => void;
}

const config = {
  success: {
    icon: CheckCircle2,
    bg: "border-emerald-200/80 bg-[var(--bg-elevated)]/96 dark:border-emerald-700/70 dark:bg-[var(--bg-elevated)]/96",
    text: "text-[var(--text-primary)]",
    iconColor: "text-emerald-600 dark:text-emerald-300",
    badge: "Thành công",
    accent: "from-emerald-500 via-emerald-400 to-emerald-300 dark:from-emerald-400 dark:via-emerald-300 dark:to-teal-200",
  },
  error: {
    icon: XCircle,
    bg: "border-rose-200/80 bg-[var(--bg-elevated)]/96 dark:border-rose-700/70 dark:bg-[var(--bg-elevated)]/96",
    text: "text-[var(--text-primary)]",
    iconColor: "text-rose-600 dark:text-rose-300",
    badge: "Lỗi",
    accent: "from-rose-500 via-rose-400 to-orange-300 dark:from-rose-400 dark:via-rose-300 dark:to-orange-200",
  },
  info: {
    icon: AlertCircle,
    bg: "border-brand-200/80 bg-[var(--bg-elevated)]/96 dark:border-sky-700/70 dark:bg-[var(--bg-elevated)]/96",
    text: "text-[var(--text-primary)]",
    iconColor: "text-brand-600 dark:text-sky-300",
    badge: "Thông báo",
    accent: "from-brand-500 via-sky-400 to-sky-300 dark:from-sky-400 dark:via-brand-300 dark:to-cyan-200",
  },
};

export function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    if (!message || !onClose) return;

    const timeoutId = window.setTimeout(() => {
      onClose();
    }, 6000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [message, onClose]);

  if (!message) return null;
  const { icon: Icon, bg, text, iconColor, badge, accent } = config[type] || config.info;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -18, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -16, scale: 0.96 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        role="alert"
        aria-live="polite"
        className={`fixed top-20 right-4 left-4 sm:left-auto sm:w-[420px] z-[80] overflow-hidden rounded-2xl border ${bg} ${text} shadow-[0_20px_60px_rgba(15,23,42,0.18)] dark:shadow-[0_20px_60px_rgba(2,6,23,0.55)] backdrop-blur-xl`}
      >
        <div className={`h-1 w-full bg-gradient-to-r ${accent}`} />
        <div className="flex items-start gap-3 px-4 py-4">
          <div className={`mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--bg-secondary)] shadow-sm dark:shadow-none ${iconColor}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              {badge}
            </p>
            <p className="text-sm font-medium leading-6 text-[var(--text-primary)]">{message}</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
