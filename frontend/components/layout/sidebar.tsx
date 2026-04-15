"use client";

import { memo, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
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
  PlayCircle,
  ChevronLeft,
  Settings,
  Calendar,
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
  { href: "/",                  label: "Dashboard",              icon: LayoutDashboard },
  { href: "/materials",         label: "Học liệu",               icon: BookOpen },
  { href: "/materials/upload",  label: "Tải lên",                icon: Upload },
  { href: "/materials/video",   label: "Tạo Video AI",           icon: Clapperboard },
  { href: "/materials/youtube-lesson", label: "YouTube Tương tác", icon: PlayCircle },
  { href: "/chatbot",           label: "Chatbot RAG",            icon: MessageSquareText },
  { href: "/web-search",        label: "Search Website Online",  icon: Globe },
  { href: "/generated",         label: "Nội dung AI",            icon: Sparkles },
  { href: "/schedule",          label: "Lịch học & làm việc",    icon: Calendar },
  { href: "/converter",         label: "Chuyển đổi & trích xuất", icon: FileText },
];

export const Sidebar = memo(function Sidebar({
  collapsed,
  onToggle,
  width,
  setWidth,
  isResizing,
  setIsResizing,
}: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  /* ── resize drag logic ─────────────────────────── */
  useEffect(() => {
    if (!isResizing) {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      return;
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(600, Math.max(200, e.clientX));
      setWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, setWidth, setIsResizing]);

  /* ── active-route helper ───────────────────────── */
  const getIsActive = (href: string) => {
    if (href === "/") return pathname === "/";
    const best = navItems.reduce((b, n) => {
      if (pathname === n.href || pathname.startsWith(n.href + "/")) {
        if (!b || n.href.length > b.length) return n.href;
      }
      return b;
    }, "");
    return best === href;
  };

  return (
    <aside
      style={{
        width: collapsed ? 72 : width,
        transition: isResizing ? "none" : "width 0.3s cubic-bezier(0.4,0,0.2,1)",
      }}
      className="
        fixed top-0 left-0 z-40 h-screen flex flex-col
        bg-[var(--bg-surface)] border-r-2 border-[var(--border-structural)]
      "
    >
      {/* ── Resize Handle ── */}
      {!collapsed && (
        <div
          onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}
          title="Kéo để thay đổi độ rộng"
          className="absolute top-0 -right-3 h-full w-6 cursor-col-resize z-50 flex items-center justify-center group/r"
        >
          <div className={`h-full w-full flex items-center justify-center transition-colors ${isResizing ? "bg-[#A1E8AF]/10" : "hover:bg-[#A1E8AF]/10"}`}>
            <div className={`flex h-14 w-3 flex-col items-center justify-center gap-1 rounded-full border border-[var(--border-light)] bg-[var(--bg-elevated)] shadow-sm transition-all ${isResizing ? "scale-105 border-[#A1E8AF]" : "group-hover/r:scale-105 group-hover/r:border-[#A1E8AF]"}`}>
              <span className="h-1 w-1 rounded-full bg-[var(--text-border)]" />
              <span className="h-1 w-1 rounded-full bg-[var(--text-border)]" />
              <span className="h-1 w-1 rounded-full bg-[var(--text-border)]" />
            </div>
          </div>
        </div>
      )}

      {/* ── Logo ── */}
      <Link
        href="/"
        className="flex items-center gap-3 px-4 h-16 border-b-2 border-[var(--border-structural)] no-underline overflow-hidden shrink-0"
      >
        <div className="relative w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border border-[var(--border-light)] shadow-[var(--shadow-sm)] bg-[var(--bg-elevated)]">
          <Image
            src="/logo.png"
            alt="AI Agent Education logo"
            fill
            sizes="40px"
            className="object-cover"
            priority
          />
        </div>
        <div
          className="flex flex-col justify-center whitespace-nowrap transition-all duration-300 overflow-hidden"
          style={{ opacity: collapsed ? 0 : 1, transform: collapsed ? "translateX(-8px)" : "translateX(0)" }}
        >
          <span className="font-black text-[17px] text-[var(--text-primary)] leading-none" style={{ fontFamily: "var(--font-display)" }}>
            AI Learning
          </span>
          <span className="text-[11px] font-bold text-[var(--text-muted)] tracking-widest uppercase leading-none mt-0.5">
            Studio
          </span>
        </div>
      </Link>

      {/* ── Navigation ── */}
      <nav className="flex-1 py-5 px-3 space-y-1 overflow-y-auto">
        {!collapsed && (
          <p className="px-4 mb-3 text-[10px] font-bold tracking-[0.15em] uppercase text-[var(--text-muted)]">
            Overview
          </p>
        )}

        {navItems.map((item) => {
          const isActive = getIsActive(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`
                group flex items-center gap-3.5
                px-4 py-2.5 cursor-pointer no-underline
                text-[13.5px] font-semibold
                transition-all duration-200 rounded-full
                ${isActive
                  ? "bg-[#A1E8AF] text-slate-900"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-section)] hover:text-[var(--text-primary)]"
                }
              `}
            >
              <Icon
                className="w-[18px] h-[18px] flex-shrink-0"
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span
                className="whitespace-nowrap overflow-hidden transition-all duration-300"
                style={{ opacity: collapsed ? 0 : 1, maxWidth: collapsed ? 0 : 200 }}
              >
                {item.label}
              </span>
              {isActive && !collapsed && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-slate-900 flex-shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Footer ── */}
      <div className="p-3 border-t-2 border-[var(--border-structural)] shrink-0 space-y-1">
        {user && (
          <Link
            href="/settings"
            title={collapsed ? "Cài đặt" : undefined}
            className={`
              flex items-center gap-3.5 px-4 py-2.5 rounded-full no-underline
              text-[13.5px] font-semibold
              text-[var(--text-secondary)] hover:bg-[var(--bg-section)] hover:text-[var(--text-primary)]
              transition-all duration-200
            `}
          >
            <Settings className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={2} />
            <span
              className="whitespace-nowrap overflow-hidden transition-all duration-300"
              style={{ opacity: collapsed ? 0 : 1, maxWidth: collapsed ? 0 : 200 }}
            >
              Cài đặt
            </span>
          </Link>
        )}

        {/* Collapse Toggle */}
        <button
          onClick={onToggle}
          title={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
          className="
            w-full flex items-center justify-center gap-2 py-2.5 rounded-full
            text-[var(--text-muted)] hover:text-[var(--text-primary)]
            hover:bg-[var(--bg-section)] bg-transparent border-0
            transition-all duration-300 cursor-pointer
          "
        >
          <ChevronLeft
            className="w-4 h-4 transition-transform duration-300"
            style={{ transform: collapsed ? "rotate(180deg)" : "rotate(0deg)" }}
          />
          {!collapsed && (
            <span className="text-xs font-semibold">Thu gọn</span>
          )}
        </button>

        {!collapsed && (
          <p className="text-center text-[10px] text-[var(--text-muted)] pb-1">v1.0.2 · Docs · Support</p>
        )}
      </div>
    </aside>
  );
});
