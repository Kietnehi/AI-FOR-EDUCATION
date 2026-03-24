"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glass?: boolean;
  padding?: "sm" | "md" | "lg";
  onClick?: () => void;
}

const paddingMap = {
  sm: "p-4",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8",
};

export function Card({
  children,
  className = "",
  hover = false,
  glass = false,
  padding = "md",
  onClick,
}: CardProps) {
  const baseClasses = `
    rounded-2xl border transition-all duration-300
    ${paddingMap[padding]}
    ${glass
      ? "bg-[var(--glass-bg)] backdrop-blur-xl border-[var(--glass-border)]"
      : "bg-[var(--bg-elevated)] border-[var(--border-light)]"
    }
    ${hover ? "cursor-pointer" : ""}
    ${className}
  `;

  if (hover) {
    return (
      <motion.div
        className={baseClasses}
        whileHover={{ y: -4, boxShadow: "var(--shadow-xl)" }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        onClick={onClick}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={`${baseClasses} shadow-[var(--shadow-sm)]`} onClick={onClick}>
      {children}
    </div>
  );
}
