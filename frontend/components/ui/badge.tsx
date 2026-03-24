"use client";

type BadgeVariant = "default" | "processed" | "processing" | "uploaded" | "failed" | "generated" | "queued" | "generating";

interface BadgeProps {
  variant?: BadgeVariant;
  status?: string;
  children?: React.ReactNode;
  dot?: boolean;
}

const variantMap: Record<string, { bg: string; text: string; dot: string }> = {
  processed: {
    bg: "bg-emerald-50 border-emerald-200",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  generated: {
    bg: "bg-emerald-50 border-emerald-200",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  processing: {
    bg: "bg-amber-50 border-amber-200",
    text: "text-amber-700",
    dot: "bg-amber-500 animate-pulse",
  },
  generating: {
    bg: "bg-amber-50 border-amber-200",
    text: "text-amber-700",
    dot: "bg-amber-500 animate-pulse",
  },
  queued: {
    bg: "bg-brand-50 border-brand-200",
    text: "text-brand-700",
    dot: "bg-brand-500",
  },
  uploaded: {
    bg: "bg-accent-50 border-accent-200",
    text: "text-accent-600",
    dot: "bg-accent-500",
  },
  failed: {
    bg: "bg-rose-50 border-rose-200",
    text: "text-rose-700",
    dot: "bg-rose-500",
  },
  default: {
    bg: "bg-[var(--bg-secondary)] border-[var(--border-light)]",
    text: "text-[var(--text-secondary)]",
    dot: "bg-[var(--text-tertiary)]",
  },
};

const labelMap: Record<string, string> = {
  processed: "Đã xử lý",
  generated: "Đã tạo",
  processing: "Đang xử lý",
  generating: "Đang tạo",
  queued: "Trong hàng đợi",
  uploaded: "Đã tải lên",
  failed: "Thất bại",
};

export function Badge({ variant, status, children, dot = true }: BadgeProps) {
  const key = variant || status || "default";
  const styles = variantMap[key] || variantMap.default;
  const label = children || labelMap[key] || key;

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
        text-xs font-semibold border capitalize
        ${styles.bg} ${styles.text}
      `}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />}
      {label}
    </span>
  );
}
