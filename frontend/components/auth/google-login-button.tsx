"use client";

import { useMemo, useState, useCallback } from "react";
import { CredentialResponse, GoogleLogin } from "@react-oauth/google";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { TurnstileCaptcha } from "@/components/auth/turnstile-captcha";

interface GoogleLoginButtonProps {
  mode: "login" | "register";
  onSuccess?: () => void;
}

function resolveApiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(error.message);
    if (parsed && typeof parsed.detail === "string" && parsed.detail.trim()) {
      return parsed.detail;
    }
  } catch {
    // Keep original message fallback when response is plain text
  }

  return error.message || fallback;
}

export function GoogleLoginButton({ mode, onSuccess }: GoogleLoginButtonProps) {
  const { login, register, googleAuthEnabled } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaExpired, setCaptchaExpired] = useState(false);

  const width = useMemo(() => {
    if (typeof window === "undefined") return 300;
    return Math.min(window.innerWidth - 80, 320);
  }, []);

  const handleCaptchaVerify = useCallback((token: string) => {
    setCaptchaToken(token);
    setCaptchaExpired(false);
    setError(null);
  }, []);

  const handleCaptchaExpire = useCallback(() => {
    setCaptchaToken(null);
    setCaptchaExpired(true);
    setError("Xác minh CAPTCHA đã hết hạn. Vui lòng thử lại.");
  }, []);

  const handleCaptchaError = useCallback(() => {
    setCaptchaToken(null);
    setError("Không thể tải CAPTCHA. Vui lòng tải lại trang.");
  }, []);

  const handleSuccess = async (credentialResponse: CredentialResponse) => {
    const idToken = credentialResponse.credential;
    if (!idToken) {
      setError("Không nhận được Google ID token. Vui lòng thử lại.");
      return;
    }

    if (!captchaToken) {
      setError("Vui lòng hoàn thành xác minh CAPTCHA trước.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      if (mode === "register") {
        await register(idToken, captchaToken);
      } else {
        await login(idToken, captchaToken);
      }
      onSuccess?.();
    } catch (err) {
      setError(
        resolveApiErrorMessage(
          err,
          mode === "register"
            ? "Đăng ký Google thất bại. Vui lòng thử lại."
            : "Đăng nhập Google thất bại. Vui lòng thử lại."
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCaptchaVerified = !!captchaToken && !captchaExpired;

  return (
    <div className="w-full space-y-3">
      {!googleAuthEnabled ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-900/10 dark:border-amber-800/20">
          Đăng nhập Google không khả dụng vì thiếu cấu hình Client ID.
        </div>
      ) : null}

      {/* Step 1: CAPTCHA */}
      <div className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
        isCaptchaVerified 
          ? "border-emerald-200 bg-emerald-50/20 py-2 dark:border-emerald-800/20 dark:bg-emerald-950/10" 
          : "border-[var(--border-light)] bg-[var(--bg-primary)] p-3"
      }`}>
        <div className="flex items-center justify-between px-3 py-1">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                isCaptchaVerified
                  ? "bg-emerald-500 text-white scale-110"
                  : "bg-[var(--border-light)] text-[var(--text-tertiary)]"
              }`}
            >
              {isCaptchaVerified ? "✓" : "1"}
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${
              isCaptchaVerified ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--text-tertiary)]"
            }`}>
              {isCaptchaVerified ? "Xác minh thành công" : "Xác minh con người"}
            </p>
          </div>
          {isCaptchaVerified && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
        </div>

        {!isCaptchaVerified && (
          <div className="flex justify-center mt-2 p-1">
            <TurnstileCaptcha
              onVerify={handleCaptchaVerify}
              onExpire={handleCaptchaExpire}
              onError={handleCaptchaError}
              theme="auto"
            />
          </div>
        )}
      </div>

      {/* Step 2: Google login – visible only after CAPTCHA */}
      <AnimatePresence>
        {googleAuthEnabled && isCaptchaVerified && (
          <motion.div
            key="google-login"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "backOut" }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2 px-1">
               <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[var(--border-light)]" />
               <span className="text-[10px] font-black text-[var(--text-tertiary)] uppercase tracking-tighter">Tiếp tục bước 2</span>
               <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[var(--border-light)]" />
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="min-h-[44px] flex items-center justify-center w-full">
                <GoogleLogin
                  onSuccess={handleSuccess}
                  onError={() =>
                    setError("Google không phản hồi yêu cầu đăng nhập.")
                  }
                  text="continue_with"
                  shape="pill"
                  size="large"
                  width={width}
                  theme="filled_blue"
                />
              </div>

              {isSubmitting && (
                <div className="flex items-center justify-center gap-2 text-xs font-bold text-brand-600 animate-pulse">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Đang đăng nhập...
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error ? (
        <motion.p 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }}
          className="text-[11px] font-bold text-rose-600 text-center bg-rose-50 dark:bg-rose-900/10 p-2 rounded-lg"
        >
          {error}
        </motion.p>
      ) : null}
    </div>
  );
}
