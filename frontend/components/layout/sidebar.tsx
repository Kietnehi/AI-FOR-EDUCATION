"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
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
  GripVertical,
  Calendar,
} from "lucide-react";
import { Reorder, useDragControls } from "framer-motion";
import { useAuth } from "@/components/auth-provider";
import { getUserPreferences, updateUserPreferences } from "@/lib/api";

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
  { href: "/learning-progress", label: "Tiến độ học tập",        icon: TrendingUp },
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

const navHrefSet = new Set(navItems.map((item) => item.href));

type NavItem = (typeof navItems)[number];

interface SidebarReorderItemProps {
  item: NavItem;
  collapsed: boolean;
  isActive: boolean;
  isDragging: boolean;
  setIsDragging: (isDragging: boolean) => void;
}

function SidebarReorderItem({
  item,
  collapsed,
  isActive,
  isDragging,
  setIsDragging,
}: SidebarReorderItemProps) {
  const Icon = item.icon;
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={item.href}
      className="relative"
      dragListener={false}
      dragControls={dragControls}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={() => {
        window.setTimeout(() => setIsDragging(false), 0);
      }}
    >
      {!collapsed && (
        <button
          type="button"
          title="Giữ và kéo để sắp xếp"
          aria-label={`Kéo để sắp xếp ${item.label}`}
          onPointerDown={(event) => {
            event.preventDefault();
            dragControls.start(event);
          }}
          className="
            absolute left-1.5 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center
            rounded-md text-[var(--text-muted)] opacity-80 transition hover:bg-[var(--bg-section)]
            hover:text-[var(--text-primary)] hover:opacity-100 cursor-grab active:cursor-grabbing touch-none
          "
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      <Link
        href={item.href}
        title={collapsed ? item.label : undefined}
        onClick={(e) => {
          if (isDragging) e.preventDefault();
        }}
        className={`
          group flex items-center gap-3.5
          px-4 py-2.5 cursor-pointer no-underline
          text-[13.5px] font-semibold
          transition-all duration-200 rounded-full
          ${!collapsed ? "pl-10" : ""}
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
    </Reorder.Item>
  );
}

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
  const [orderedHrefs, setOrderedHrefs] = useState<string[]>(
    navItems.map((item) => item.href)
  );
  const [isDragging, setIsDragging] = useState(false);
  const loadedFromPreferencesRef = useRef(false);

  const orderedItems = useMemo(() => {
    const lookup = new Map(navItems.map((item) => [item.href, item]));
    return orderedHrefs
      .map((href) => lookup.get(href))
      .filter((item): item is (typeof navItems)[number] => Boolean(item));
  }, [orderedHrefs]);

  useEffect(() => {
    loadedFromPreferencesRef.current = false;
    if (user) {
      getUserPreferences()
        .then((prefs) => {
          const baseOrder = navItems.map((item) => item.href);
          const preferred = (prefs.sidebar_order ?? []).filter((href) =>
            navHrefSet.has(href)
          );

          if (preferred.length === 0) {
            setOrderedHrefs(baseOrder);
            return;
          }

          const remaining = baseOrder.filter((href) => !preferred.includes(href));
          setOrderedHrefs([...preferred, ...remaining]);
        })
        .catch(() => {
          setOrderedHrefs(navItems.map((item) => item.href));
        })
        .finally(() => {
          loadedFromPreferencesRef.current = true;
        });
    } else {
      setOrderedHrefs(navItems.map((item) => item.href));
      loadedFromPreferencesRef.current = true;
    }
  }, [user]);

  const handleReorder = (newOrder: string[]) => {
    setOrderedHrefs(newOrder);
  };

  useEffect(() => {
    if (!user || !loadedFromPreferencesRef.current) return;

    const saveTimer = window.setTimeout(() => {
      updateUserPreferences({ sidebar_order: orderedHrefs }).catch(() => {});
    }, 250);

    return () => window.clearTimeout(saveTimer);
  }, [orderedHrefs, user]);

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
      <nav className="flex-1 py-5 px-3 space-y-1 overflow-y-auto hidden-scrollbar">
        {!collapsed && (
          <p className="px-4 mb-3 text-[10px] font-bold tracking-[0.15em] uppercase text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors">
            Overview
          </p>
        )}

        <Reorder.Group axis="y" values={orderedHrefs} onReorder={handleReorder} className="space-y-1">
          {orderedItems.map((item) => {
            const isActive = getIsActive(item.href);

            return (
              <SidebarReorderItem
                key={item.href}
                item={item}
                collapsed={collapsed}
                isActive={isActive}
                isDragging={isDragging}
                setIsDragging={setIsDragging}
              />
            );
          })}
        </Reorder.Group>
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
