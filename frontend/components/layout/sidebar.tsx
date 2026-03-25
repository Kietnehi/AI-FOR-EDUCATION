"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
    <aside
      style={{
        width: collapsed ? 72 : 260,
        transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      className="
        fixed top-0 left-0 z-40 h-screen flex flex-col
        bg-[var(--bg-elevated)] border-r border-[var(--border-light)]
      "
    >
      {/* Brand */}
      <Link href="/" className="flex items-center gap-3 px-4 h-16 border-b border-[var(--border-light)] no-underline hover:opacity-80 transition-opacity overflow-hidden">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center flex-shrink-0 shadow-md">
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        <span
          className="font-bold text-base text-[var(--text-primary)] whitespace-nowrap transition-opacity duration-200"
          style={{
            opacity: collapsed ? 0 : 1,
            fontFamily: "var(--font-display)",
          }}
        >
          AI Learning Studio
        </span>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
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
                relative flex items-center gap-3 px-3 py-2.5 rounded-xl
                text-sm font-medium no-underline transition-all duration-200
                ${isActive
                  ? "text-brand-600 bg-brand-50 border border-brand-200"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                }
              `}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-brand-600' : ''}`} />
              <span
                className="whitespace-nowrap transition-opacity duration-200 overflow-hidden"
                style={{ opacity: collapsed ? 0 : 1 }}
              >
                {item.label}
              </span>
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
          <ChevronLeft
            className="w-5 h-5 transition-transform duration-200"
            style={{ transform: collapsed ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </button>
      </div>
    </aside>
  );
}
