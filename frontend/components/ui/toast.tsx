"use client";

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
    bg: "bg-emerald-50 border-emerald-200",
    text: "text-emerald-800",
    iconColor: "text-emerald-500",
  },
  error: {
    icon: XCircle,
    bg: "bg-rose-50 border-rose-200",
    text: "text-rose-800",
    iconColor: "text-rose-500",
  },
  info: {
    icon: AlertCircle,
    bg: "bg-brand-50 border-brand-200",
    text: "text-brand-800",
    iconColor: "text-brand-500",
  },
};

export function Toast({ message, type, onClose }: ToastProps) {
  if (!message) return null;
  const { icon: Icon, bg, text, iconColor } = config[type] || config.info;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.95 }}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${bg} ${text} mt-4`}
      >
        <Icon className={`w-5 h-5 flex-shrink-0 ${iconColor}`} />
        <p className="flex-1 text-sm font-medium">{message}</p>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/5 transition-colors bg-transparent border-0 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
