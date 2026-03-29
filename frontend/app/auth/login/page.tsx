"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, ShieldCheck, Clock3 } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { GoogleLoginButton } from "@/components/auth/google-login-button";

export default function LoginPage() {
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
    <div className="relative min-h-screen overflow-hidden bg-[var(--bg-primary)]">
      <div className="absolute -top-16 -right-20 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl" />
      <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-accent-400/20 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="grid w-full gap-6 rounded-3xl border border-[var(--border-light)] bg-[var(--bg-elevated)] p-6 shadow-xl lg:grid-cols-2 lg:p-10"
        >
          <section className="space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">
              <Sparkles className="h-4 w-4" />
              AI Learning Studio
            </span>
            <h1 className="text-3xl font-extrabold text-[var(--text-primary)] sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
              Đăng nhập để tiếp tục học tập cùng AI
            </h1>
            <p className="text-[var(--text-secondary)]">
              Đăng nhập bằng Google để đồng bộ học liệu, lịch sử chatbot và nội dung đã tạo trên mọi thiết bị.
            </p>

            <div className="space-y-3 rounded-2xl border border-[var(--border-light)] bg-[var(--bg-primary)] p-4">
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Phiên đăng nhập dùng cookie HttpOnly an toàn.
              </div>
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Clock3 className="h-4 w-4 text-brand-600" />
                Mất dưới 10 giây để bắt đầu.
              </div>
            </div>
          </section>

          <section className="flex flex-col justify-center rounded-2xl border border-[var(--border-light)] bg-[var(--bg-primary)] p-6">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Đăng nhập</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Chúng tôi chỉ dùng email và thông tin cơ bản để tạo tài khoản học tập cho bạn.
            </p>

            <div className="mt-6">
              <GoogleLoginButton mode="login" onSuccess={() => router.replace(nextPath)} />
            </div>

            <p className="mt-5 text-sm text-[var(--text-tertiary)]">
              Chưa có tài khoản?{" "}
              <Link href="/auth/register" className="font-semibold text-brand-600 hover:text-brand-700">
                Tạo tài khoản với Google
              </Link>
            </p>
          </section>
        </motion.div>
      </div>
    </div>
  );
}
