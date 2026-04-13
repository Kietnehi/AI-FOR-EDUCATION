"use client";

import Link from "next/link";
import { Bell, Bot, Sun, Moon, LogOut, User } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useTheme } from "@/components/theme-provider";
import { useNotifications } from "@/components/notification-provider";
import { motion, AnimatePresence } from "framer-motion";
import { useState, memo, useRef, useEffect } from "react";
import { NotificationDropdown } from "@/components/notification-dropdown";

interface TopbarProps {
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  isResizing?: boolean;
  mascotEnabled: boolean;
  onToggleMascot: () => void;
}

export const Topbar = memo(function Topbar({
  sidebarCollapsed,
  sidebarWidth,
  isResizing,
  mascotEnabled,
  onToggleMascot,
}: TopbarProps) {
  const { user, logout, loading } = useAuth();
  const { theme, toggle } = useTheme();
  const { unreadCount } = useNotifications();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target as Node)) {
        setNotifDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header
      style={{
        paddingLeft: sidebarCollapsed ? 72 : sidebarWidth,
        transition: isResizing ? "none" : "padding-left 0.3s cubic-bezier(0.4,0,0.2,1)",
      }}
      className="
        fixed top-0 right-0 left-0 z-30 h-16
        flex items-center gap-4 px-6
        bg-[var(--glass-bg)] backdrop-blur-xl
        border-b-2 border-[var(--border-structural)]
      "
    >
      {/* ── Right Actions ── */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Mascot toggle */}
        <button
          onClick={onToggleMascot}
          className={`
            w-10 h-10 rounded-full flex items-center justify-center
            border-2 transition-all duration-200 cursor-pointer
            ${mascotEnabled
              ? "bg-[#A1E8AF] border-[#A1E8AF] text-slate-900"
              : "bg-transparent border-[var(--border-structural)] text-[var(--text-secondary)] hover:border-[#A1E8AF] hover:text-[var(--text-primary)]"
            }
          `}
          aria-label={mascotEnabled ? "Tắt mascot" : "Bật mascot"}
          title={mascotEnabled ? "Tắt mascot" : "Bật mascot"}
        >
          <Bot className="w-4 h-4" />
        </button>

        {/* Dark mode toggle */}
        <button
          onClick={toggle}
          className="
            w-10 h-10 rounded-full flex items-center justify-center
            bg-transparent border-2 border-[var(--border-structural)]
            text-[var(--text-secondary)] hover:text-[var(--text-primary)]
            hover:border-[#A1E8AF]
            transition-all duration-200 cursor-pointer
          "
          aria-label={theme === "dark" ? "Chế độ sáng" : "Chế độ tối"}
          title={theme === "dark" ? "Chế độ sáng" : "Chế độ tối"}
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifDropdownRef}>
          <button
            onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
            className="
              relative w-10 h-10 rounded-full flex items-center justify-center
              bg-transparent border-2 border-[var(--border-structural)] dark:border-slate-600
              text-[var(--text-secondary)] dark:text-slate-300 hover:text-[var(--text-primary)] dark:hover:text-white
              hover:border-[#A1E8AF] dark:hover:border-brand-400
              transition-all duration-200 cursor-pointer
            "
            aria-label="Thông báo"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-4.5 px-1 flex items-center justify-center bg-rose-500 dark:bg-rose-600 rounded-full text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          <NotificationDropdown isOpen={notifDropdownOpen} onClose={() => setNotifDropdownOpen(false)} />
        </div>

        {/* User / Auth */}
        <div className="relative" ref={dropdownRef}>
          {loading ? (
            <div className="w-10 h-10 rounded-full bg-[var(--bg-section)] animate-pulse border-2 border-[var(--border-structural)]" />
          ) : user ? (
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="
                w-10 h-10 rounded-full overflow-hidden flex items-center justify-center
                border-2 border-[var(--border-structural)]
                text-white text-sm font-bold cursor-pointer
                bg-gradient-to-br from-[#A1E8AF] to-[#22c55e]
                hover:border-[#A1E8AF] hover:shadow-md
                transition-all duration-200
              "
              aria-label="Tài khoản"
            >
              {user.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.picture} alt={user.name || "User"} className="w-full h-full object-cover" />
              ) : (
                <span className="text-slate-900 font-black">
                  {user.name ? user.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                </span>
              )}
            </button>
          ) : (
            <Link
              href="/auth/login"
              className="
                px-5 h-10 rounded-full flex items-center justify-center gap-2
                bg-[#A1E8AF] border-2 border-[#A1E8AF]
                text-slate-900 text-sm font-bold cursor-pointer
                hover:brightness-110
                transition-all duration-200 no-underline
              "
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.16v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.16C1.43 8.55 1 10.22 1 12s.43 3.45 1.16 4.93l3.68-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.16 7.07l3.68 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Đăng nhập
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
                  bg-[var(--bg-surface)] border-2 border-[var(--border-structural)]
                  shadow-[var(--shadow-soft)] overflow-hidden
                "
              >
                <div className="p-4 border-b-2 border-[var(--border-structural)]">
                  <p className="text-sm font-bold text-[var(--text-primary)] truncate">{user.name}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{user.email}</p>
                </div>
                <div className="p-2">
                  <button
                    onClick={() => { setUserDropdownOpen(false); logout(); }}
                    className="
                      w-full flex items-center gap-2 px-3 py-2 rounded-full
                      text-sm font-semibold text-rose-600 cursor-pointer
                      hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors border-0 bg-transparent
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