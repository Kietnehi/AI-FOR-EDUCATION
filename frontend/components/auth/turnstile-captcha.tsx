"use client";

import { useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    turnstile: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
          language?: string;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

interface TurnstileCaptchaProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  theme?: "light" | "dark" | "auto";
}

const TURNSTILE_SCRIPT_ID = "cf-turnstile-script";
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export function TurnstileCaptcha({
  onVerify,
  onExpire,
  onError,
  theme = "auto",
}: TurnstileCaptchaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const renderedRef = useRef(false);

  const renderWidget = useCallback(() => {
    if (!containerRef.current || renderedRef.current) return;
    if (typeof window.turnstile === "undefined") return;

    renderedRef.current = true;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      callback: onVerify,
      "expired-callback": onExpire,
      "error-callback": onError,
      theme,
      language: "vi",
    });
  }, [onVerify, onExpire, onError, theme]);

  useEffect(() => {
    if (typeof window.turnstile !== "undefined") {
      renderWidget();
      return;
    }

    if (!document.getElementById(TURNSTILE_SCRIPT_ID)) {
      window.onTurnstileLoad = () => renderWidget();

      const script = document.createElement("script");
      script.id = TURNSTILE_SCRIPT_ID;
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    } else {
      // Script already loading – poll until ready
      const interval = setInterval(() => {
        if (typeof window.turnstile !== "undefined") {
          clearInterval(interval);
          renderWidget();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [renderWidget]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (
        widgetIdRef.current !== undefined &&
        typeof window.turnstile !== "undefined"
      ) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
      }
      renderedRef.current = false;
    };
  }, []);

  return <div ref={containerRef} className="cf-turnstile-widget" />;
}
