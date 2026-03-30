"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { 
  Sparkles, 
  ShieldCheck, 
  Clock3, 
  BrainCircuit, 
  GraduationCap, 
  Zap,
  ArrowRight,
  Orbit,
  Network
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { GoogleLoginButton } from "@/components/auth/google-login-button";

export function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const nextPath = searchParams.get("next") || "/";

  useEffect(() => {
    if (!loading && user) {
      router.replace(nextPath);
    }
  }, [loading, nextPath, router, user]);

  return (
    <div className="relative h-screen overflow-hidden bg-[var(--bg-primary)] flex items-center justify-center p-4">
      {/* --- Background Elements --- */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.08),transparent_70%)]" />
        <svg className="w-full h-full opacity-10">
          <pattern id="grid-login" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="var(--border-default)" strokeWidth="1" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#grid-login)" />
        </svg>
      </div>

      {/* --- Main Card --- */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-5xl h-full max-h-[640px] grid lg:grid-cols-12 overflow-hidden rounded-[2.5rem] border border-[var(--border-light)] bg-[var(--bg-elevated)]/80 backdrop-blur-2xl shadow-2xl"
      >
        {/* Left Section (6/12 cols) */}
        <div className="hidden lg:flex lg:col-span-6 flex-col p-10 justify-between relative overflow-hidden bg-gradient-to-br from-brand-50/50 to-transparent dark:from-brand-950/20">
          <div className="space-y-6 relative z-10">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--bg-elevated)] px-3 py-1.5 border border-[var(--border-light)] shadow-sm"
            >
              <Sparkles className="h-3.5 w-3.5 text-brand-500" />
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-brand-600">AI Learning Agent</span>
            </motion.div>

            <div className="space-y-4">
              <h1 className="text-4xl xl:text-5xl font-black text-[var(--text-primary)] leading-[1.1] tracking-tight">
                Học tập <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-accent-600">thông minh hơn</span>
              </h1>
              <p className="text-base text-[var(--text-secondary)] font-medium max-w-sm">
                Trợ lý AI giúp bạn tóm tắt tài liệu, tạo câu hỏi ôn tập và lộ trình học tập cá nhân hóa.
              </p>
            </div>

            {/* Compact Features */}
            <div className="grid gap-3 pt-2">
              {[
                { icon: BrainCircuit, title: "Tóm tắt thông minh", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" },
                { icon: Network, title: "Lộ trình cá nhân", color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/20" },
                { icon: Orbit, title: "Hỗ trợ 24/7", color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20" }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-2xl border border-[var(--border-light)] bg-[var(--bg-elevated)]/40 group hover:bg-[var(--bg-elevated)] transition-colors">
                  <div className={`p-2 rounded-xl ${item.bg}`}>
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                  </div>
                  <span className="text-sm font-bold text-[var(--text-primary)]">{item.title}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 pt-4 border-t border-[var(--border-light)]/50">
             <div className="flex items-center gap-4 text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">
                <span>Next-Gen Education</span>
                <div className="h-1 w-1 rounded-full bg-brand-300" />
                <span>AI Agent Studio</span>
             </div>
          </div>

          {/* Abstract Visual BG */}
          <div className="absolute right-[-10%] bottom-[-5%] w-64 h-64 opacity-10 dark:opacity-20 pointer-events-none animate-pulse">
             <div className="w-full h-full rounded-full border-[16px] border-brand-500 border-dashed" />
          </div>
        </div>

        {/* Right Section: Form (6/12 cols) */}
        <div className="lg:col-span-6 flex flex-col justify-center p-8 md:p-12 lg:p-16 border-l border-[var(--border-light)] bg-[var(--bg-elevated)]/30">
          <div className="w-full max-w-sm mx-auto space-y-8">
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
                 <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">Đăng nhập</h2>
              <p className="text-sm font-medium text-[var(--text-secondary)]">
                Truy cập ngay kho tri thức AI của bạn.
              </p>
            </div>

            <div className="py-2">
              <GoogleLoginButton mode="login" onSuccess={() => router.replace(nextPath)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
               <div className="flex flex-col gap-2 p-3 rounded-2xl border border-[var(--border-light)] bg-[var(--bg-primary)]/40">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span className="text-[10px] font-bold text-[var(--text-primary)]">Bảo mật</span>
               </div>
               <div className="flex flex-col gap-2 p-3 rounded-2xl border border-[var(--border-light)] bg-[var(--bg-primary)]/40">
                  <Clock3 className="h-4 w-4 text-brand-600" />
                  <span className="text-[10px] font-bold text-[var(--text-primary)]">Dưới 5s</span>
               </div>
            </div>

            <div className="text-center pt-6 border-t border-[var(--border-light)]/50">
              <p className="text-sm text-[var(--text-secondary)] font-medium">
                Chưa có tài khoản?{" "}
                <Link 
                  href="/auth/register" 
                  className="font-black text-brand-600 hover:text-brand-700 underline underline-offset-4 decoration-2 decoration-brand-100"
                >
                  Đăng ký
                </Link>
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
