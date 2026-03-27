"use client";

import { ReactNode, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ThemeProvider } from "@/components/theme-provider";

// Load 3D component correctly
const FloatingMascot = dynamic(() => import("@/components/3d/floating-mascot").then(mod => mod.FloatingMascot), {
  ssr: false
});

export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const [mascotEnabled, setMascotEnabled] = useState(true);
  const [shouldRenderMascot, setShouldRenderMascot] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("mascot-enabled");
    if (saved === "false") {
      setMascotEnabled(false);
    }
  }, []);

  useEffect(() => {
    if (!mascotEnabled) {
      setShouldRenderMascot(false);
      return;
    }

    let cancelled = false;
    const scheduleRender = () => {
      if (!cancelled) {
        setShouldRenderMascot(true);
      }
    };

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(scheduleRender, { timeout: 1200 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(idleId);
      };
    }

    const timeoutId = globalThis.setTimeout(scheduleRender, 300);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(timeoutId);
    };
  }, [mascotEnabled]);

  const handleToggleMascot = () => {
    const next = !mascotEnabled;
    setMascotEnabled(next);
    localStorage.setItem("mascot-enabled", String(next));
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <a
          href="#main-content"
          className="
            sr-only focus:not-sr-only focus:absolute focus:z-50
            focus:top-2 focus:left-2 focus:px-4 focus:py-2
            focus:bg-brand-600 focus:text-white focus:rounded-xl
          "
        >
          Bỏ qua đến nội dung chính
        </a>

        <Sidebar 
          collapsed={sidebarCollapsed} 
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          width={sidebarWidth}
          setWidth={setSidebarWidth}
          isResizing={isResizing}
          setIsResizing={setIsResizing}
        />
        <Topbar
          sidebarCollapsed={sidebarCollapsed}
          sidebarWidth={sidebarWidth}
          isResizing={isResizing}
          mascotEnabled={mascotEnabled}
          onToggleMascot={handleToggleMascot}
        />

        <main
          id="main-content"
          style={{ 
            paddingLeft: sidebarCollapsed ? 80 : sidebarWidth,
            transition: isResizing ? "none" : "padding-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
          }}
          className="pt-16 min-h-screen"
        >
          <div className="max-w-[1400px] mx-auto px-6 sm:px-8 py-8 relative">
            {children}
          </div>
        </main>
        
        {/* Floating AI Mascot */}
        {mascotEnabled && shouldRenderMascot && <FloatingMascot />}
      </div>
    </ThemeProvider>
  );
}
