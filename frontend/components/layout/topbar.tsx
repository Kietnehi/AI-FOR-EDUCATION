"use client";

import Link from "next/link";
import { Search, Bell, User, Bot, LogOut } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { motion, AnimatePresence } from "framer-motion";
import { useState, memo, useRef, useEffect } from "react";

interface TopbarProps {
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  isResizing?: boolean;
  mascotEnabled: boolean;
  onToggleMascot: () => void;
}

export const Topbar = memo(function Topbar({ sidebarCollapsed, sidebarWidth, isResizing, mascotEnabled, onToggleMascot }: TopbarProps) {
  const { user, logout, loading } = useAuth();
  const [searchFocused, setSearchFocused] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  return (
    <header
      style={{ 
        paddingLeft: sidebarCollapsed ? 80 : sidebarWidth,
        transition: isResizing ? "none" : "padding-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
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

        {/* User / Auth */}
        <div className="relative" ref={dropdownRef}>
          {loading ? (
            <div className="w-10 h-10 rounded-xl bg-[var(--bg-secondary)] animate-pulse" />
          ) : user ? (
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="
                w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center
                bg-gradient-to-br from-brand-500 to-accent-500
                text-white text-sm font-bold cursor-pointer border-0
                hover:shadow-lg hover:shadow-brand-500/25
                transition-all duration-200
              "
              aria-label="Tài khoản"
            >
              {user.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.picture} alt={user.name || "User"} className="w-full h-full object-cover" />
              ) : (
                <span>{user.name ? user.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}</span>
              )}
            </button>
          ) : (
            <Link
              href="/auth/login"
              className="
                px-4 h-10 rounded-xl flex items-center justify-center gap-2
                bg-[var(--bg-elevated)] border border-[var(--border-default)] hover:bg-[var(--bg-secondary)]
                text-[var(--text-primary)] text-sm font-semibold cursor-pointer
                transition-all duration-200
              "
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.16v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.16C1.43 8.55 1 10.22 1 12s.43 3.45 1.16 4.93l3.68-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.16 7.07l3.68 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Đăng nhập/Đăng ký
            </Link>
          )}

          <AnimatePresence>
            {userDropdownOpen && user && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="
                  absolute right-0 mt-2 w-56 rounded-2xl
                  bg-[var(--bg-elevated)] border border-[var(--border-light)]
                  shadow-xl overflow-hidden
                "
              >
                <div className="p-4 border-b border-[var(--border-light)]">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{user.name}</p>
                  <p className="text-xs text-[var(--text-tertiary)] truncate mt-0.5">{user.email}</p>
                </div>
                <div className="p-2">
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      logout();
                    }}
                    className="
                      w-full flex items-center gap-2 px-3 py-2 rounded-xl
                      text-sm font-medium text-rose-600 cursor-pointer
                      hover:bg-rose-50 transition-colors border-0 bg-transparent
                    "
                  >
                    <LogOut className="w-4 h-4" />
                    Đăng xuất
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
});