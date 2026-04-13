"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Footer } from "@/components/layout/footer";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuth } from "@/components/auth-provider";
import { getUserPreferences, updateUserPreferences } from "@/lib/api";

// Load 3D component correctly
const FloatingMascot = dynamic(() => import("@/components/3d/floating-mascot").then(mod => mod.FloatingMascot), {
  ssr: false
});

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const [mascotEnabled, setMascotEnabled] = useState(true);
  const [shouldRenderMascot, setShouldRenderMascot] = useState(false);
  const [authNoticeVisible, setAuthNoticeVisible] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("mascot-enabled");
    if (saved === "false") {
      setMascotEnabled(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    getUserPreferences()
      .then((preferences) => {
        if (cancelled) return;
        const next = preferences.mascot_enabled !== false;
        setMascotEnabled(next);
        localStorage.setItem("mascot-enabled", String(next));
      })
      .catch(() => {
        // Keep local fallback when server preference is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

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

  useEffect(() => {
    const onAuthRequired = () => {
      if (!user) {
        setAuthNoticeVisible(true);
      }
    };
    window.addEventListener("auth-required", onAuthRequired);
    return () => window.removeEventListener("auth-required", onAuthRequired);
  }, [user]);

  useEffect(() => {
    if (user) {
      setAuthNoticeVisible(false);
    }
  }, [user]);

  const handleToggleMascot = async () => {
    const next = !mascotEnabled;
    setMascotEnabled(next);
    localStorage.setItem("mascot-enabled", String(next));

    if (!user) {
      return;
    }

    try {
      await updateUserPreferences({ mascot_enabled: next });
    } catch {
      // Local value is already applied; server sync can retry later.
    }
  };

  if ((pathname || "").startsWith("/auth")) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-[var(--bg-primary)]">
          {children}
        </div>
      </ThemeProvider>
    );
  }

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

        <div
          style={{
            paddingLeft: sidebarCollapsed ? 80 : sidebarWidth,
            transition: isResizing ? "none" : "padding-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <Footer />
        </div>

        {authNoticeVisible ? (
          <div className="fixed right-4 bottom-4 z-40 max-w-sm rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-xl">
            <p className="text-sm font-semibold text-amber-900">Cần đăng nhập để tiếp tục</p>
            <p className="mt-1 text-sm text-amber-800">
              Bạn có thể xem trước tính năng, nhưng cần đăng nhập hoặc đăng ký trước khi thực hiện thao tác dữ liệu.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Link
                href={`/auth/login?next=${encodeURIComponent(pathname || "/")}`}
                className="rounded-xl bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-600"
              >
                Đăng nhập
              </Link>
              <Link
                href="/auth/register"
                className="rounded-xl border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
              >
                Đăng ký
              </Link>
              <button
                onClick={() => setAuthNoticeVisible(false)}
                className="rounded-xl border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
                type="button"
              >
                Để sau
              </button>
            </div>
          </div>
        ) : null}
        
        {/* Floating AI Mascot */}
        {mascotEnabled && shouldRenderMascot && <FloatingMascot />}
      </div>
    </ThemeProvider>
  );
}
