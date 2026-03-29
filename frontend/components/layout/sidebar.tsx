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
  ChevronLeft,
  Settings,
} from "lucide-react";

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
  { href: "/generated", label: "Nội dung AI", icon: Sparkles },
  { href: "/converter", label: "Chuyển đổi & trích xuất", icon: FileText }, 
];

export const Sidebar = memo(function Sidebar({ collapsed, onToggle, width, setWidth, isResizing, setIsResizing }: SidebarProps) {
  const pathname = usePathname();

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
          className="absolute top-0 -right-1 w-2 h-full cursor-col-resize hover:bg-indigo-500/20 active:bg-indigo-500/30 transition-colors z-50 flex items-center justify-center pointer-events-auto"
        >
          <div className="w-[2px] h-8 bg-indigo-400 rounded-full opacity-0 hover:opacity-100 transition-opacity" />
        </div>
      )}
      <Link href="/" className="flex items-center gap-3 px-6 h-20 border-b border-[var(--border-light)] no-underline group overflow-hidden shrink-0">
        <div className="w-12 h-12 flex items-center justify-center flex-shrink-0 bg-[var(--bg-secondary)] rounded-[14px] shadow-sm border border-[var(--border-light)] group-hover:shadow group-hover:scale-105 transition-all duration-300 p-0.5">
          <img src="/logo.png" alt="AI Learning Studio" className="w-full h-full object-cover rounded-xl" onError={(e) => { e.currentTarget.style.display = 'none' }} />
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
          <span className="font-bold text-[13px] text-indigo-600 tracking-[0.1em] uppercase leading-none">
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

        <div className="space-y-1.5">
          {!collapsed && (
            <h3 className="px-4 text-[11px] font-bold tracking-[0.15em] text-[var(--text-tertiary)] uppercase mb-3">
              Settings
            </h3>
          )}
          <Link
            href="/settings"
            className="
              group relative flex items-center gap-3.5 px-3 py-2.5 rounded-xl
              text-[14px] font-semibold no-underline transition-all duration-300 ease-out  
              text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]
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
        </div>
      </nav>

      <div className="p-4 border-t border-[var(--border-light)] bg-[var(--bg-secondary)]/50 shrink-0">      
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
