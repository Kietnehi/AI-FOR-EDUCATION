"use client";

import { Search, Moon, Sun, Bell, User, Bot } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { motion } from "framer-motion";
import { useState, memo } from "react";

interface TopbarProps {
  sidebarCollapsed: boolean;
  mascotEnabled: boolean;
  onToggleMascot: () => void;
}

export const Topbar = memo(function Topbar({ sidebarCollapsed, mascotEnabled, onToggleMascot }: TopbarProps) {
  const { theme, toggle } = useTheme();
  const [searchFocused, setSearchFocused] = useState(false);

  return (
    <header
      style={{ 
        paddingLeft: sidebarCollapsed ? 72 : 260,
        transition: "padding-left 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
      }}
      className="
        fixed top-0 right-0 left-0 z-30 h-16
        flex items-center gap-4 px-6
        bg-[var(--glass-bg)] backdrop-blur-2xl
        border-b border-[var(--border-light)]
      "
    >
      {/* Search */}
      <div className={`
        relative flex items-center flex-1 max-w-md
        transition-all duration-300
        ${searchFocused ? "max-w-lg" : ""}
      `}>
        <Search className="absolute left-3 w-4 h-4 text-[var(--text-tertiary)]" />
        <input
          type="text"
          placeholder="Tìm kiếm học liệu, nội dung..."
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          className="
            w-full h-10 pl-10 pr-4 rounded-xl
            bg-[var(--bg-secondary)] border border-[var(--border-light)]
            text-sm text-[var(--text-primary)]
            placeholder:text-[var(--text-tertiary)]
            focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100
            transition-all duration-200
          "
        />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={onToggleMascot}
          className={`
            w-10 h-10 rounded-xl flex items-center justify-center
            border transition-all duration-200 cursor-pointer
            ${mascotEnabled
              ? "bg-brand-50 border-brand-300 text-brand-600 hover:bg-brand-100"
              : "bg-transparent border-[var(--border-light)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] hover:border-brand-300"
            }
          `}
          aria-label={mascotEnabled ? "Tắt mascot" : "Bật mascot"}
          title={mascotEnabled ? "Tắt mascot" : "Bật mascot"}
        >
          <Bot className="w-4 h-4" />
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="
            w-10 h-10 rounded-xl flex items-center justify-center
            bg-transparent border border-[var(--border-light)]
            text-[var(--text-secondary)] hover:text-[var(--text-primary)]
            hover:bg-[var(--bg-secondary)] hover:border-brand-300
            transition-all duration-200 cursor-pointer
          "
          aria-label="Chuyển chế độ sáng/tối"
        >
          <motion.div
            key={theme}
            initial={{ rotate: -45, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </motion.div>
        </button>

        {/* Notifications */}
        <button
          className="
            relative w-10 h-10 rounded-xl flex items-center justify-center
            bg-transparent border border-[var(--border-light)]
            text-[var(--text-secondary)] hover:text-[var(--text-primary)]
            hover:bg-[var(--bg-secondary)] hover:border-brand-300
            transition-all duration-200 cursor-pointer
          "
          aria-label="Thông báo"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full" />
        </button>

        {/* User avatar */}
        <button
          className="
            w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center
            bg-gradient-to-br from-brand-500 to-accent-500
            text-white text-sm font-bold cursor-pointer border-0
            hover:shadow-lg hover:shadow-brand-500/25
            transition-all duration-200
          "
          aria-label="Tài khoản"
        >
          <User className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
});
