"use client";

import { ReactNode } from "react";

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
    rounded-2xl border transition-all duration-200
    ${paddingMap[padding]}
    ${glass
      ? "bg-[var(--glass-bg)] backdrop-blur-xl border-[var(--glass-border)]"
      : "bg-[var(--bg-elevated)] border-[var(--border-light)]"
    }
    ${hover ? "cursor-pointer hover:-translate-y-1 hover:shadow-xl" : "shadow-[var(--shadow-sm)]"}
    ${className}
  `;

  return (
    <div className={baseClasses} onClick={onClick}>
      {children}
    </div>
  );
}
