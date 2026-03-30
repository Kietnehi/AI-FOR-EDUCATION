"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { UserRoundPlus, Star, ShieldCheck } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { GoogleLoginButton } from "@/components/auth/google-login-button";

export default function RegisterPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [loading, router, user]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--bg-primary)]">
      <div className="absolute -top-20 left-1/3 h-64 w-64 rounded-full bg-emerald-300/20 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-brand-300/20 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full rounded-3xl border border-[var(--border-light)] bg-[var(--bg-elevated)] p-6 shadow-xl sm:p-10"
        >
          <div className="mx-auto max-w-xl space-y-6 text-center">
            <span className="mx-auto inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
              <UserRoundPlus className="h-4 w-4" />
              Đăng ký nhanh với Google
            </span>

            <h1 className="text-3xl font-extrabold text-[var(--text-primary)] sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
              Tạo tài khoản chỉ với một lần bấm
            </h1>
            <p className="text-[var(--text-secondary)]">
              Lần đăng nhập Google đầu tiên sẽ tự động tạo tài khoản học tập cho bạn, không cần điền form dài.
            </p>

            <div className="grid gap-3 rounded-2xl border border-[var(--border-light)] bg-[var(--bg-primary)] p-4 text-left">
              <p className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Star className="h-4 w-4 text-amber-500" />
                Tự động đồng bộ hồ sơ và ảnh đại diện.
              </p>
              <p className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Cookie phiên được bảo vệ, không lưu token trong localStorage.
              </p>
            </div>

            <div className="pt-2">
              <GoogleLoginButton mode="register" onSuccess={() => router.replace("/")} />
            </div>

            <p className="text-sm text-[var(--text-tertiary)]">
              Đã có tài khoản?{" "}
              <Link href="/auth/login" className="font-semibold text-brand-600 hover:text-brand-700">
                Quay về đăng nhập
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
