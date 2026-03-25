"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  BookOpen,
  Upload,
  MessageSquareText,
  Sparkles,
  ChevronLeft,
  GraduationCap,
} from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/materials", label: "Học liệu", icon: BookOpen },
  { href: "/materials/upload", label: "Tải lên", icon: Upload },
  { href: "/chatbot", label: "Chatbot", icon: MessageSquareText },
  { href: "/generated", label: "Nội dung AI", icon: Sparkles },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="
        fixed top-0 left-0 z-40 h-screen flex flex-col
        bg-[var(--glass-bg)] backdrop-blur-2xl
        border-r border-[var(--border-light)]
      "
    >
      {/* Brand */}
      <Link href="/" className="flex items-center gap-3 px-4 h-16 border-b border-[var(--border-light)] no-underline hover:opacity-80 transition-opacity">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center flex-shrink-0 shadow-md">
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="font-bold text-base text-[var(--text-primary)] whitespace-nowrap"
              style={{ fontFamily: "var(--font-display)" }}
            >
              AI Learning Studio
            </motion.span>
          )}
        </AnimatePresence>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          // Find the most specific match to avoid highlighting parent when child is active
          const isBestMatch = navItems.reduce((best, navItem) => {
            if (pathname === navItem.href || pathname.startsWith(navItem.href + "/")) {
              if (!best || navItem.href.length > best.length) {
                return navItem.href;
              }
            }
            return best;
          }, "") === item.href;

          const isActive = item.href === "/" ? pathname === "/" : isBestMatch;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                relative flex items-center gap-3 px-3 py-2.5 rounded-xl
                text-sm font-medium no-underline transition-all duration-200
                ${isActive
                  ? "text-brand-600 bg-brand-50"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                }
              `}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 bg-brand-50 rounded-xl border border-brand-200"
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                />
              )}
              <Icon className={`relative z-10 w-5 h-5 flex-shrink-0 ${isActive ? 'text-brand-600' : ''}`} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    className="relative z-10 whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-3 border-t border-[var(--border-light)]">
        <button
          onClick={onToggle}
          className="
            w-full flex items-center justify-center gap-2 p-2 rounded-xl
            text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]
            hover:bg-[var(--bg-secondary)] bg-transparent border-0
            transition-colors duration-200 cursor-pointer
          "
        >
          <motion.div
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronLeft className="w-5 h-5" />
          </motion.div>
        </button>
      </div>
    </motion.aside>
  );
}
