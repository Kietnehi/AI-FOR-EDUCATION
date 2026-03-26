"use client";

import { memo } from "react";
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
  ChevronLeft,
  Settings,
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
        bg-[var(--bg-elevated)] border-r border-[var(--border-light)]
      "
    >
      {/* Brand */}
      <Link href="/" className="flex items-center gap-3 px-6 h-20 border-b border-[var(--border-light)] no-underline hover:opacity-90 transition-opacity overflow-hidden shrink-0">
        <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0 shadow-[0_4px_10px_rgba(99,102,241,0.3)]">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <span
          className="font-bold text-xl text-[var(--text-primary)] whitespace-nowrap transition-opacity duration-200 uppercase tracking-wide"
          style={{
            opacity: collapsed ? 0 : 1,
            fontFamily: "var(--font-display)",
          }}
        >
          AI Studio
        </span>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-4 space-y-6 overflow-y-auto">
        
        <div className="space-y-2">
          {!collapsed && (
            <h3 className="px-4 text-xs font-bold tracking-wider text-[var(--text-tertiary)] uppercase mb-4">
              Overview
            </h3>
          )}
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
                  relative flex items-center gap-4 px-4 py-3 rounded-2xl
                  text-[15px] font-medium no-underline transition-all duration-200
                  ${isActive
                    ? "text-brand-600 bg-brand-50"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                  }
                `}
              >
                <Icon className={`w-[22px] h-[22px] flex-shrink-0 ${isActive ? 'text-brand-600' : 'text-[var(--text-tertiary)]'}`} strokeWidth={isActive ? 2.5 : 2} />
                <span
                  className="whitespace-nowrap transition-opacity duration-200 overflow-hidden"
                  style={{ opacity: collapsed ? 0 : 1 }}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="space-y-2 pt-4">
          {!collapsed && (
            <h3 className="px-4 text-xs font-bold tracking-wider text-[var(--text-tertiary)] uppercase mb-4">
              Settings
            </h3>
          )}
          <Link
            href="/settings"
            className={`
              relative flex items-center gap-4 px-4 py-3 rounded-2xl
              text-[15px] font-medium no-underline transition-all duration-200
              text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]
            `}
          >
            <Settings className="w-[22px] h-[22px] flex-shrink-0 text-[var(--text-tertiary)]" strokeWidth={2} />
            <span
              className="whitespace-nowrap transition-opacity duration-200 overflow-hidden"
              style={{ opacity: collapsed ? 0 : 1 }}
            >
              Cài đặt
            </span>
          </Link>
        </div>

      </nav>

      {/* Collapse toggle */}
      <div className="p-4 border-t border-[var(--border-light)] shrink-0">
        <button
          onClick={onToggle}
          className="
            w-full flex items-center justify-center gap-2 py-3 rounded-2xl
            text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]
            hover:bg-[var(--bg-secondary)] bg-transparent border-0
            transition-colors duration-200 cursor-pointer
          "
          title={collapsed ? "Mở rộng" : "Thu gọn"}
        >
          <ChevronLeft
            className="w-5 h-5 transition-transform duration-200"
            style={{ transform: collapsed ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </button>
      </div>
    </aside>
  );
});
