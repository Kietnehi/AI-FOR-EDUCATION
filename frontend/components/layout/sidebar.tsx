"use client";

import { memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  BookOpen,
  Upload,
  MessageSquareText,
  Sparkles,
  Clapperboard,
  ChevronLeft,
  GraduationCap,
  FileText,
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
  { href: "/converter", label: "Chuyển đổi & trích xuất PDF", icon: FileText },
];

export const Sidebar = memo(function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: collapsed ? 80 : 280,
        transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      className="
        fixed top-0 left-0 z-40 h-screen flex flex-col
        bg-[var(--glass-bg)] backdrop-blur-3xl
        border-r border-[var(--border-light)]
        shadow-[4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.2)]
      "
    >
      {/* Brand */}
      <Link 
        href="/" 
        className={`flex items-center h-[72px] border-b border-[var(--border-light)] no-underline group transition-all duration-300 ${collapsed ? "justify-center px-0" : "gap-3.5 px-5"}`}
      >
        <div className="relative w-14 h-14 flex-shrink-0 rounded-2xl overflow-hidden shadow-sm border border-[var(--border-light)] group-hover:shadow-md group-hover:ring-2 group-hover:ring-brand-500/20 group-hover:border-brand-400/50 transition-all duration-300">
          <Image src="/logo.png" alt="AI Learning Studio Logo" width={56} height={56} className="w-full h-full object-cover scale-105 bg-[var(--bg-elevated)]" priority />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10, filter: "blur(4px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: -10, filter: "blur(4px)" }}
              transition={{ duration: 0.2 }}
              className="flex flex-col justify-center whitespace-nowrap"
            >
              <span 
                className="font-extrabold text-[18px] leading-tight tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-brand-600 to-indigo-600 dark:from-brand-400 dark:to-indigo-400 drop-shadow-sm"
              >
                AI Learning
              </span>
              <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.25em] mt-0.5">
                STUDIO
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3.5 space-y-1.5 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--border-default)]">
        <AnimatePresence>
          {navItems.map((item) => {
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
                  relative flex items-center gap-3.5 px-3 py-2.5 rounded-xl
                  text-[14px] font-medium transition-all duration-300 group
                  ${isActive
                    ? "text-brand-700 dark:text-brand-300"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                  }
                `}
                title={collapsed ? item.label : undefined}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 bg-brand-50/80 dark:bg-brand-500/10 rounded-xl border border-brand-200/50 dark:border-brand-500/20 shadow-sm"
                    initial={false}
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  >
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-1/2 bg-brand-500 dark:bg-brand-400 rounded-r-full shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                  </motion.div>
                )}
                
                <div className={`
                  relative z-10 flex items-center justify-center w-8 h-8 rounded-lg transition-transform duration-300
                  ${isActive ? 'scale-105' : 'group-hover:scale-110 group-hover:-rotate-3'}
                `}>
                  <Icon className={`
                    w-5 h-5 flex-shrink-0 transition-colors duration-300
                    ${isActive ? 'text-brand-600 dark:text-brand-400 drop-shadow-sm' : ''}
                  `} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                
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
              </Link>
            );
          })}
        </AnimatePresence>
      </nav>

      {/* Collapse toggle */}
      <div className="p-4 border-t border-[var(--border-light)]">
        <button
          onClick={onToggle}
          className="
            w-full flex items-center justify-center gap-2 p-2.5 rounded-xl
            text-[var(--text-tertiary)] hover:text-[var(--text-primary)]
            hover:bg-[var(--bg-secondary)] bg-transparent border border-transparent
            hover:border-[var(--border-light)]
            transition-all duration-300 cursor-pointer shadow-sm hover:shadow
          "
          title={collapsed ? "Mở rộng" : "Thu gọn"}
        >
          <motion.div
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <ChevronLeft className="w-5 h-5" />
          </motion.div>
          {!collapsed && (
            <span className="text-sm font-medium">Thu gọn</span>
          )}
        </button>
      </div>
    </aside>
  );
});
