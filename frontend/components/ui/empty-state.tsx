"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { PackageOpen } from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-100 to-accent-100 flex items-center justify-center mb-6 text-brand-500"
      >
        {icon || <PackageOpen className="w-10 h-10" />}
      </motion.div>
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-[var(--text-secondary)] max-w-sm mb-6">{description}</p>
      )}
      {action}
    </motion.div>
  );
}
