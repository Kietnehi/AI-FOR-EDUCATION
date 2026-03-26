"use client";

import { Search, Moon, Sun, Bell, User, Bot, SlidersHorizontal } from "lucide-react";
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
        fixed top-0 right-0 left-0 z-30 h-24
        flex items-center gap-6 px-10
        bg-[var(--bg-primary)]
      "
    >
      {/* Search */}
      <div className={`
        relative flex items-center flex-1 max-w-2xl
        transition-all duration-300
        ${searchFocused ? "max-w-3xl" : ""}
      `}>
        <Search className="absolute left-4 w-5 h-5 text-[var(--text-tertiary)]" />
        <input
          type="text"
          placeholder="Search your course here..."
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          className="
            w-full h-12 pl-12 pr-12 rounded-2xl
            bg-[var(--bg-elevated)] border border-[var(--border-light)]
            text-sm text-[var(--text-primary)] shadow-xs
            placeholder:text-[var(--text-tertiary)]
            focus:outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100/50
            transition-all duration-200
          "
        />
        <button className="absolute right-3 w-8 h-8 flex items-center justify-center text-[var(--text-tertiary)] hover:text-brand-600 transition-colors">
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        <button
          onClick={onToggleMascot}
          className={`
            w-11 h-11 rounded-full flex items-center justify-center
            border transition-all duration-200 cursor-pointer
            ${mascotEnabled
              ? "bg-brand-50 border-brand-200 text-brand-600"
              : "bg-white border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-brand-300"
            }
          `}
          aria-label={mascotEnabled ? "Tắt mascot" : "Bật mascot"}
          title={mascotEnabled ? "Tắt mascot" : "Bật mascot"}
        >
          <Bot className="w-5 h-5" />
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="
            w-11 h-11 rounded-full flex items-center justify-center
            bg-white border border-[var(--border-default)]
            text-[var(--text-secondary)] hover:text-[var(--text-primary)]
            hover:border-brand-300
            transition-all duration-200 cursor-pointer shadow-xs
          "
          aria-label="Chuyển chế độ sáng/tối"
        >
          {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Notifications */}
        <button
          className="
            relative w-11 h-11 rounded-full flex items-center justify-center
            bg-white border border-[var(--border-default)]
            text-[var(--text-secondary)] hover:text-[var(--text-primary)]
            hover:border-brand-300
            transition-all duration-200 cursor-pointer shadow-xs
          "
          aria-label="Thông báo"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full" />
        </button>

        <div className="w-px h-8 bg-[var(--border-light)] mx-2"></div>

        {/* User profile section like in image */}
        <button
          className="
            flex items-center gap-3 p-1 pr-4 rounded-full border border-transparent
            hover:bg-white hover:border-[var(--border-light)] hover:shadow-xs
            transition-all duration-200 cursor-pointer
          "
        >
          <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm ring-2 ring-brand-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://github.com/Kietnehi.png" alt="User" className="w-full h-full object-cover" />
          </div>
        </button>
      </div>
    </header>
  );
});
