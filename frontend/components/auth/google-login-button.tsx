"use client";

import { useMemo, useState } from "react";
import { CredentialResponse, GoogleLogin } from "@react-oauth/google";
import { useAuth } from "@/components/auth-provider";

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
  const { login, register } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const width = useMemo(() => {
    if (typeof window === "undefined") return 320;
    return Math.min(window.innerWidth - 64, 360);
  }, []);

  const handleSuccess = async (credentialResponse: CredentialResponse) => {
    const idToken = credentialResponse.credential;
    if (!idToken) {
      setError("Không nhận được Google ID token. Vui lòng thử lại.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      if (mode === "register") {
        await register(idToken);
      } else {
        await login(idToken);
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

  return (
    <div className="space-y-3">
      <div className={`transition-opacity ${isSubmitting ? "opacity-60 pointer-events-none" : "opacity-100"}`}>
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => setError("Google không phản hồi yêu cầu đăng nhập.")}
          text="continue_with"
          shape="pill"
          size="large"
          width={width}
          theme="outline"
        />
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
