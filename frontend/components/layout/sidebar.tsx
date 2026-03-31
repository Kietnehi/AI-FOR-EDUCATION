"use client";

import { memo, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Upload,
  MessageSquareText,
  Sparkles,
  Clapperboard,
  FileText,
  Globe,
  ChevronLeft,
  Settings,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  width: number;
  setWidth: (width: number) => void;
  isResizing: boolean;
  setIsResizing: (isResizing: boolean) => void;
}

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/materials", label: "Học liệu", icon: BookOpen },
  { href: "/materials/upload", label: "Tải lên", icon: Upload },
  { href: "/materials/video", label: "Tạo Video AI", icon: Clapperboard },      
  { href: "/chatbot", label: "Chatbot RAG", icon: MessageSquareText },
  { href: "/web-search", label: "Search Website Online", icon: Globe },
  { href: "/generated", label: "Nội dung AI", icon: Sparkles },
  { href: "/converter", label: "Chuyển đổi & trích xuất", icon: FileText }, 
];

export const Sidebar = memo(function Sidebar({ collapsed, onToggle, width, setWidth, isResizing, setIsResizing }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  useEffect(() => {
    if (!isResizing) {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      return;
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      let newWidth = e.clientX;
      if (newWidth < 200) newWidth = 200; // Minimum expanded width
      if (newWidth > 600) newWidth = 600; // Maximum expanded width
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, setWidth, setIsResizing]);

  return (
    <aside
      style={{
        width: collapsed ? 80 : width,
        transition: isResizing ? "none" : "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      className="
        fixed top-0 left-0 z-40 h-screen flex flex-col
        bg-[var(--bg-elevated)] border-r border-[var(--border-light)] shadow-[var(--shadow-md)]
      "
    >
      {!collapsed && (
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
          title="Kéo để thay đổi độ rộng sidebar"
          className="absolute top-0 -right-3 h-full w-6 cursor-col-resize z-50 flex items-center justify-center pointer-events-auto group/sidebar-resize"
        >
          <div
            className={`relative flex h-full w-full items-center justify-center transition-colors ${
              isResizing ? "bg-indigo-500/14" : "bg-transparent hover:bg-indigo-500/10"
            }`}
          >
            <div
              className={`flex h-16 w-3 flex-col items-center justify-center gap-1 rounded-full border border-indigo-200/80 bg-white/92 shadow-sm transition-all ${
                isResizing
                  ? "scale-105 border-indigo-300 bg-indigo-50 shadow-md"
                  : "opacity-90 group-hover/sidebar-resize:scale-105 group-hover/sidebar-resize:border-indigo-300"
              }`}
            >
              <span className="h-1 w-1 rounded-full bg-indigo-400" />
              <span className="h-1 w-1 rounded-full bg-indigo-400" />
              <span className="h-1 w-1 rounded-full bg-indigo-400" />
            </div>
            <div
              className={`absolute left-1/2 top-1/2 -translate-y-1/2 translate-x-4 rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-600 shadow-sm whitespace-nowrap transition-all ${
                isResizing
                  ? "opacity-100"
                  : "pointer-events-none opacity-0 group-hover/sidebar-resize:opacity-100 group-hover/sidebar-resize:translate-x-5"
              }`}
            >
              Kéo để resize
            </div>
          </div>
        </div>
      )}
      <Link href="/" className="flex items-center gap-3 px-6 h-20 border-b border-[var(--border-light)] no-underline group overflow-hidden shrink-0">
        <div className="relative flex h-[3.25rem] w-[3.25rem] flex-shrink-0 items-center justify-center rounded-[18px] border border-white/70 bg-gradient-to-br from-slate-950 via-indigo-950 to-brand-700 p-[1px] shadow-[0_18px_34px_-18px_rgba(79,70,229,0.55)] transition-all duration-300 group-hover:scale-[1.04] group-hover:shadow-[0_22px_40px_-18px_rgba(79,70,229,0.7)]">
          <span className="absolute inset-[1px] rounded-[17px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.3),transparent_55%),linear-gradient(160deg,rgba(15,23,42,0.96),rgba(49,46,129,0.88))]" />
          <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border border-white/60 bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.7)]" />
          <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[17px] bg-white/95 px-2 py-2 shadow-inner">
            <img
              src="/logo.png"
              alt="AI Learning Studio"
              className="h-full w-full object-contain drop-shadow-[0_6px_10px_rgba(15,23,42,0.18)]"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          </span>
        </div>
        <div
          className="flex flex-col justify-center whitespace-nowrap transition-all duration-300"
          style={{
            opacity: collapsed ? 0 : 1,
            transform: collapsed ? "translateX(-10px)" : "translateX(0)",
          }}
        >
          <span 
            className="font-black text-[18px] text-[var(--text-primary)] tracking-tight leading-none mb-0.5"
            style={{ fontFamily: "var(--font-display, inherit)" }}
          >
            AI Learning
          </span>
          <span className="font-bold text-[13px] bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 bg-clip-text text-transparent tracking-[0.14em] uppercase leading-none">
            Studio
          </span>
        </div>
      </Link>

      <nav className="flex-1 py-6 px-4 space-y-8 overflow-y-auto custom-scrollbar">
        <div className="space-y-1.5">
          {!collapsed && (
            <h3 className="px-4 text-[11px] font-bold tracking-[0.15em] text-[var(--text-tertiary)] uppercase mb-3">
              Overview
            </h3>
          )}
          {navItems.map((item) => {
            const isBestMatch =
              navItems.reduce((best, navItem) => {
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
                  group relative flex items-center gap-3.5 px-3 py-2.5 rounded-xl        
                  text-[14px] font-semibold no-underline transition-all duration-300 ease-out
                  ${
                    isActive
                      ? "text-indigo-600 bg-indigo-50/50 dark:bg-indigo-500/10 shadow-sm ring-1 ring-indigo-100/50 dark:ring-indigo-500/20"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                  }
                `}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${isActive ? 'bg-indigo-100/50 text-indigo-600' : 'text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] group-hover:bg-[var(--bg-secondary)]'}`}>
                  <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span
                  className="whitespace-nowrap transition-all duration-300 overflow-hidden"
                  style={{ opacity: collapsed ? 0 : 1, transform: collapsed ? "translateX(-5px)" : "translateX(0)" }}
                >
                  {item.label}
                </span>
                
                {isActive && !collapsed && (
                  <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.5)]" />
                )}
              </Link>
            );
          })}
        </div>

      </nav>

      <div className="p-4 border-t border-[var(--border-light)] bg-[var(--bg-secondary)]/50 shrink-0 space-y-2">
        {user ? (
          <Link
            href="/settings"
            className="
              group relative flex items-center gap-3.5 px-3 py-2.5 rounded-xl
              text-[14px] font-semibold no-underline transition-all duration-300 ease-out
              text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]
              border border-transparent hover:border-[var(--border-light)] hover:shadow-sm
            "
          >
            <div className="p-1.5 rounded-lg transition-colors text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] group-hover:bg-[var(--bg-secondary)]">
              <Settings className="w-5 h-5 flex-shrink-0" strokeWidth={2} />
            </div>
            <span
              className="whitespace-nowrap transition-all duration-300 overflow-hidden"
              style={{ opacity: collapsed ? 0 : 1, transform: collapsed ? "translateX(-5px)" : "translateX(0)" }}
            >
              Cài đặt
            </span>
          </Link>
        ) : null}

        <div className="h-px w-full bg-gray-100 dark:bg-gray-700/50" />
        <button
          onClick={onToggle}
          className="
            w-full flex items-center justify-center gap-2 py-2.5 rounded-xl      
            text-[var(--text-secondary)] hover:text-indigo-600      
            hover:bg-[var(--bg-elevated)] bg-transparent border border-transparent hover:border-[var(--border-light)] hover:shadow-sm
            transition-all duration-300 cursor-pointer group
          "
          title={collapsed ? "Mở rộng" : "Thu gọn"}
        >
          <ChevronLeft
            className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-0.5"
            style={{ transform: collapsed ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </button>
      </div>
    </aside>
  );
});
