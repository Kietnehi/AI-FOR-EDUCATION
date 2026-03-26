"use client";

import { memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  BookOpen,
  Upload,
  MessageSquareText,
  Sparkles,
  Clapperboard,
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
  { href: "/materials/video", label: "Tạo Video AI", icon: Clapperboard },
  { href: "/chatbot", label: "Chatbot", icon: MessageSquareText },
  { href: "/generated", label: "Nội dung AI", icon: Sparkles },
];

export const Sidebar = memo(function Sidebar({ collapsed, onToggle }: SidebarProps) {
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
      <Link href="/" className={`flex items-center h-16 border-b border-[var(--border-light)] no-underline group transition-all duration-300 ${collapsed ? "justify-center px-0" : "gap-3 px-4"}`}>
        <div className="relative w-12 h-12 flex-shrink-0 rounded-[14px] overflow-hidden shadow-sm border border-[var(--border-light)] group-hover:shadow-md group-hover:border-brand-300 transition-all duration-300">
          <Image src="/logo.png" alt="AI Learning Studio Logo" width={48} height={48} className="w-full h-full object-cover scale-[1.02]" priority />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="flex flex-col justify-center whitespace-nowrap"
            >
              <span 
                className="font-extrabold text-[17px] leading-tight tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-brand-600 via-brand-500 to-accent-600 drop-shadow-sm"
                style={{ fontFamily: "var(--font-display)" }}
              >
                AI Learning
              </span>
              <span className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.2em] -mt-0.5 ml-[1px]">
                STUDIO
              </span>
            </motion.div>
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
});
