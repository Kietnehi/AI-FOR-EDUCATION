"use client";

import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Upload,
  BookOpen,
  Sparkles,
  MessageSquareText,
  ArrowRight,
  TrendingUp,
  FileText,
  Gamepad2,
  Mic,
  MapPin,
  Mail,
  Send,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { TiltCard } from "@/components/ui/tilt-card";
import { TurnstileCaptcha } from "@/components/auth/turnstile-captcha";
import { listMaterials, subscribeToMaterialsRealtime, submitCooperationContact } from "@/lib/api";
import { Material } from "@/types";
import dynamic from "next/dynamic";
import { useAuth } from "@/components/auth-provider";

const GithubIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

const AIVisualizer = dynamic(() => import("@/components/3d/ai-visualizer").then(mod => mod.AIVisualizer), {
  ssr: false,
  loading: () => <div className="absolute inset-0 z-0 bg-transparent" />
});

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const DATE_FORMATTER = new Intl.DateTimeFormat("vi-VN");

const techStackLogos = [
  { name: "ChromaDB", src: "/logo-tech-stack/chromadb.png" },
  { name: "Cloudflare", src: "/logo-tech-stack/cloudflare.png" },
  { name: "Docker", src: "/logo-tech-stack/docker.png" },
  { name: "Gemini", src: "/logo-tech-stack/gemini.jpg" },
  { name: "GitHub", src: "/logo-tech-stack/github.png" },
  { name: "GitHub Actions", src: "/logo-tech-stack/github_actions.png" },
  { name: "Google", src: "/logo-tech-stack/google.png" },
  { name: "MongoDB", src: "/logo-tech-stack/mongodb.png" },
  { name: "Next.js", src: "/logo-tech-stack/nextjs.png" },
  { name: "Node.js", src: "/logo-tech-stack/nodjs.jpg" },
  { name: "OpenAI", src: "/logo-tech-stack/openai.png" },
  { name: "Python", src: "/logo-tech-stack/python.png" },
  { name: "Redis", src: "/logo-tech-stack/redis.png" },
];

const statCards = [
  { label: "Học liệu", icon: BookOpen, color: "from-brand-500 to-brand-600" },
  { label: "Slide đã tạo", icon: FileText, color: "from-accent-500 to-accent-600" },
  { label: "Podcast", icon: Mic, color: "from-emerald-500 to-emerald-600" },
  { label: "Minigame", icon: Gamepad2, color: "from-amber-500 to-amber-600" },
];

export default function DashboardPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showVisualizer, setShowVisualizer] = useState(false);
  const { user, loading: authLoading } = useAuth();
  
  // Quản lý trạng thái Custom Video Player
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactSubject, setContactSubject] = useState("Liên hệ hợp tác từ website");
  const [contactMessage, setContactMessage] = useState("");
  const [contactCaptchaToken, setContactCaptchaToken] = useState<string | null>(null);
  const [contactCaptchaExpired, setContactCaptchaExpired] = useState(false);
  const [contactCaptchaKey, setContactCaptchaKey] = useState(0);
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSuccess, setContactSuccess] = useState("");
  const [contactError, setContactError] = useState("");
  const [contactExpanded, setContactExpanded] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setMaterials([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    listMaterials()
      .then((res) => setMaterials(res.items))
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  useEffect(() => {
    if (authLoading || !user) return;

    return subscribeToMaterialsRealtime({
      onSnapshot: (snapshot) => {
        setMaterials(snapshot.items);
        setError("");
        setLoading(false);
      },
      onError: () => undefined,
    });
  }, [user, authLoading]);

  useEffect(() => {
    let cancelled = false;
    const enableVisualizer = () => {
      if (!cancelled) {
        setShowVisualizer(true);
      }
    };

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(enableVisualizer, { timeout: 1500 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(idleId);
      };
    }

    const timeoutId = globalThis.setTimeout(enableVisualizer, 400);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(timeoutId);
    };
  }, []);

  const handleContactSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setContactError("");
    setContactSuccess("");

    if (!contactCaptchaToken) {
      setContactError("Vui lòng hoàn thành xác minh CAPTCHA trước khi gửi.");
      return;
    }

    setContactSubmitting(true);
    try {
      const response = await submitCooperationContact({
        name: contactName,
        email: contactEmail,
        subject: contactSubject,
        message: contactMessage,
        captchaToken: contactCaptchaToken,
      });
      setContactSuccess(response.message);
      setContactMessage("");
      setContactSubject("Liên hệ hợp tác từ website");
      setContactCaptchaToken(null);
      setContactCaptchaExpired(false);
      setContactCaptchaKey((value) => value + 1);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? (() => {
              try {
                const parsed = JSON.parse(submitError.message);
                return parsed.detail || submitError.message;
              } catch {
                return submitError.message;
              }
            })()
          : "Không thể gửi liên hệ lúc này.";
      setContactError(message);
      setContactCaptchaToken(null);
      setContactCaptchaExpired(true);
      setContactCaptchaKey((value) => value + 1);
    } finally {
      setContactSubmitting(false);
    }
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-8"
    >
      {/* Hero Section — Soft Brutalism: Dark slate + Mint accents */}
      <motion.div variants={item} className="order-1">
        <div className="relative overflow-hidden rounded-2xl border-2 border-slate-800 bg-slate-900 text-white p-8 sm:p-12 min-h-[380px] flex flex-col justify-center" style={{ boxShadow: "var(--shadow-soft)" }}>
          {/* Decorative background */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-[#A1E8AF]/10 rounded-full -translate-y-1/3 translate-x-1/4 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#A1E8AF]/5 rounded-full translate-y-1/3 -translate-x-1/4 blur-2xl pointer-events-none" />

          {/* 3D Visualizer */}
          <div className="absolute top-0 right-0 bottom-0 w-full sm:w-2/3 lg:w-1/2 min-h-[300px]">
            {showVisualizer ? <AIVisualizer /> : null}
          </div>

          <div className="relative z-10 max-w-xl pointer-events-none">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#A1E8AF] text-slate-900 text-xs font-bold mb-6 pointer-events-auto uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5" />
              AI-Powered Learning
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight mb-4 pointer-events-auto" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
              Tạo học liệu
              <br />
              <span className="text-[#A1E8AF]">thông minh với AI</span>
            </h1>
            <p className="text-base text-slate-400 mb-8 max-w-md pointer-events-auto text-lg leading-relaxed">
              Upload tài liệu, tự động tạo slide gốc, podcast, minigame và chatbot hỏi đáp chỉ trong vài phút.
            </p>
            <div className="flex flex-wrap gap-3 pointer-events-auto w-fit">
              <Link href="/materials/upload">
                <Button variant="secondary" size="lg" icon={<Upload className="w-5 h-5" />} className="h-12 px-6 rounded-full font-bold !bg-[#A1E8AF] !text-slate-900 !border-[#A1E8AF] hover:brightness-110 dark:!bg-[#A1E8AF] dark:!text-slate-900 dark:hover:brightness-105">
                  Tải lên học liệu
                </Button>
              </Link>
              <Link href="/materials">
                <Button
                  variant="ghost"
                  size="lg"
                  icon={<ArrowRight className="w-5 h-5" />}
                  className="h-12 px-6 rounded-full border-2 border-white/20 bg-white/10 font-bold text-white/90 hover:bg-white/15 dark:border-slate-700 dark:bg-slate-900/40 dark:text-white/90 dark:hover:bg-slate-800/70"
                >
                  Xem tất cả
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Video Intro Section */}
      <motion.div variants={item} className="order-2">
        <div className="mb-8">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="relative mt-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 via-accent-500 to-emerald-500 p-[1px] shadow-[0_16px_36px_-18px_rgba(99,102,241,0.6)]">
                <div className="absolute inset-[1px] rounded-[15px] bg-[linear-gradient(160deg,rgba(15,23,42,0.96),rgba(49,46,129,0.88))]" />
                <div className="relative flex h-full w-full items-center justify-center rounded-[15px] bg-white/12 backdrop-blur-xl">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="space-y-1">
                <span className="inline-flex rounded-full border border-brand-200/70 bg-brand-50/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-700">
                  Showcase
                </span>
                <h2 className="text-3xl font-black tracking-tight text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
                  Video giới thiệu
                </h2>
                <p className="max-w-2xl text-sm text-[var(--text-secondary)] sm:text-[15px]">
                  Xem nhanh cách hệ thống vận hành và trải nghiệm học tập AI được trình bày trong giao diện thực tế.
                </p>
              </div>
            </div>
            <div className="h-px w-full bg-gradient-to-r from-brand-500/45 via-accent-500/20 to-transparent sm:mb-2 sm:ml-6 sm:w-48" />
          </div>
          
          <div className="relative max-w-5xl mx-auto">
            {/* Animated outer glow rings */}
            <div className="absolute -inset-6 flex items-center justify-center">
              <div className="w-full h-full rounded-3xl bg-gradient-to-br from-brand-500/10 via-accent-500/10 to-emerald-500/10 animate-pulse-slow blur-3xl" />
            </div>
            <div className="absolute -inset-3 flex items-center justify-center">
              <div className="w-full h-full rounded-2xl border border-brand-500/20 animate-spin-slow" style={{ animationDuration: '20s' }} />
            </div>
            
            <Card className="relative overflow-hidden shadow-2xl border-0 bg-gradient-to-br from-gray-900/98 via-gray-800/98 to-gray-900/98 backdrop-blur-2xl ring-1 ring-white/10">
              {/* Animated top border with shimmer */}
              <div className="absolute top-0 left-0 right-0 h-1 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-500 to-transparent w-[200%] animate-shimmer" />
                <div className="absolute inset-0 bg-gradient-to-r from-brand-500 via-accent-500 to-emerald-500 opacity-80" />
              </div>
              
              {/* Decorative light beams */}
              <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-brand-500/30 via-transparent to-transparent" />
              <div className="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-accent-500/30 via-transparent to-transparent" />
              
              <div className="relative aspect-video w-full group cursor-pointer overflow-hidden rounded-xl">
                {/* Video with dynamic filter based on playing state */}
                <video
                  ref={videoRef}
                  controls={isVideoPlaying}
                  className="w-full h-full object-contain relative z-10 transition-all duration-700"
                  preload="metadata"
                  poster="/video-poster.jpg"
                  style={{ 
                    filter: isVideoPlaying ? 'brightness(1) contrast(1)' : 'brightness(0.6) contrast(1.1) saturate(1.2) blur(1px)',
                  }}
                  onPlay={() => setIsVideoPlaying(true)}
                  onPause={() => setIsVideoPlaying(false)}
                  onEnded={() => setIsVideoPlaying(false)}
                >
                  <source src="/intro_videos/Intro_Videos.mp4" type="video/mp4" />
                  Trình duyệt của bạn không hỗ trợ phát video.
                </video>
                
                {/* Premium hover overlay - Hides completely when playing */}
                <div 
                  className={`absolute inset-0 bg-gradient-to-br from-brand-900/60 via-gray-900/60 to-black/80 flex items-center justify-center z-20 transition-all duration-700 ease-out ${isVideoPlaying ? 'opacity-0 pointer-events-none scale-105 blur-md' : 'opacity-100 group-hover:from-brand-900/40 group-hover:to-black/60'}`}
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.play();
                    }
                  }}
                >
                  
                  {/* Floating decorative elements */}
                  {!isVideoPlaying && (
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                      {[...Array(8)].map((_, i) => (
                        <div
                          key={i}
                          className="absolute w-2 h-2 bg-white/20 rounded-full animate-float"
                          style={{
                            left: `${10 + i * 12}%`,
                            top: `${20 + (i % 3) * 30}%`,
                            animationDelay: `${i * 0.5}s`,
                            animationDuration: `${3 + i * 0.3}s`,
                          }}
                        />
                      ))}
                    </div>
                  )}
                  
                  {/* Center brand badge and play CTA */}
                  <div className={`relative flex flex-col items-center gap-5 transition-all duration-500 ease-out ${isVideoPlaying ? 'scale-150 opacity-0' : 'scale-95 group-hover:scale-100'}`}>
                    <div className="absolute -inset-8 rounded-[2rem] bg-gradient-to-br from-brand-500/25 via-accent-500/25 to-emerald-500/20 blur-3xl animate-pulse-slow" />
                    <div className="relative flex items-center gap-4 rounded-[1.75rem] border border-white/15 bg-white/10 px-5 py-4 backdrop-blur-2xl shadow-[0_20px_60px_-24px_rgba(15,23,42,0.8)]">
                      <div className="relative flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-slate-950 via-brand-950 to-brand-700 p-[1px] shadow-[0_16px_35px_-20px_rgba(99,102,241,0.9)]">
                        <div className="absolute inset-[1px] rounded-[1.15rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.28),transparent_58%),linear-gradient(160deg,rgba(15,23,42,0.96),rgba(67,56,202,0.92))]" />
                        <div className="relative flex h-full w-full items-center justify-center rounded-[1.15rem] bg-white/95 p-2.5">
                          <Image
                            src="/logo.png"
                            alt="AI Learning Studio"
                            width={44}
                            height={44}
                            className="h-full w-full object-contain drop-shadow-[0_6px_12px_rgba(15,23,42,0.18)]"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/55">
                          AI Learning Studio
                        </span>
                        <span
                          className="text-xl font-bold leading-tight text-white"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          Khám phá video demo
                        </span>
                        <span className="text-sm text-white/70">
                          Giao diện học tập AI trực quan hơn, gọn hơn.
                        </span>
                      </div>
                    </div>

                    <div className="relative flex items-center gap-3 rounded-full border border-white/20 bg-black/30 px-4 py-3 backdrop-blur-xl shadow-[0_18px_38px_-22px_rgba(15,23,42,0.9)]">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 via-accent-500 to-emerald-500 shadow-[0_0_30px_rgba(99,102,241,0.55)] transition-shadow duration-500 group-hover:shadow-[0_0_46px_rgba(99,102,241,0.78)]">
                        <svg className="ml-1 h-7 w-7 text-white drop-shadow-xl" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                      <div className="flex flex-col items-start pr-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-300/85">
                          Demo
                        </span>
                        <span className="text-sm font-semibold text-white">
                          Xem ngay trải nghiệm mở đầu
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Text hint with animation */}
                  <div className={`absolute bottom-12 flex flex-col items-center gap-2 transition-all duration-500 delay-100 ${isVideoPlaying ? 'translate-y-8 opacity-0' : 'translate-y-0 opacity-100'}`}>
                    <span className="text-white font-bold tracking-wide drop-shadow-lg text-lg bg-black/30 px-6 py-2 rounded-full backdrop-blur-md border border-white/10">
                      Bấm để phát Video
                    </span>
                    <div className="flex items-center gap-2 text-white/70 text-sm mt-2">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <span>Trải nghiệm tính năng AI đột phá</span>
                    </div>
                  </div>
                </div>
                
                {/* Subtle film grain texture */}
                <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22 opacity=%220.03%22/%3E%3C/svg%3E')] pointer-events-none z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                
                {/* Premium corner decorations with multiple layers */}
                <div className="absolute top-4 left-4">
                  <div className="w-12 h-12 relative">
                    <div className="absolute top-0 left-0 w-8 h-1 bg-gradient-to-r from-brand-500/90 to-transparent rounded-full shadow-lg shadow-brand-500/50" />
                    <div className="absolute top-0 left-0 w-1 h-8 bg-gradient-to-b from-brand-500/90 to-transparent rounded-full shadow-lg shadow-brand-500/50" />
                    <div className="absolute top-1 left-1 w-1 h-1 rounded-full bg-brand-500/80" />
                  </div>
                </div>
                <div className="absolute top-4 right-4">
                  <div className="w-12 h-12 relative">
                    <div className="absolute top-0 right-0 w-8 h-1 bg-gradient-to-l from-accent-500/90 to-transparent rounded-full shadow-lg shadow-accent-500/50" />
                    <div className="absolute top-0 right-0 w-1 h-8 bg-gradient-to-b from-accent-500/90 to-transparent rounded-full shadow-lg shadow-accent-500/50" />
                    <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-accent-500/80" />
                  </div>
                </div>
                <div className="absolute bottom-4 left-4">
                  <div className="w-12 h-12 relative">
                    <div className="absolute bottom-0 left-0 w-8 h-1 bg-gradient-to-r from-emerald-500/90 to-transparent rounded-full shadow-lg shadow-emerald-500/50" />
                    <div className="absolute bottom-0 left-0 w-1 h-8 bg-gradient-to-t from-emerald-500/90 to-transparent rounded-full shadow-lg shadow-emerald-500/50" />
                    <div className="absolute bottom-1 left-1 w-1 h-1 rounded-full bg-emerald-500/80" />
                  </div>
                </div>
                <div className="absolute bottom-4 right-4">
                  <div className="w-12 h-12 relative">
                    <div className="absolute bottom-0 right-0 w-8 h-1 bg-gradient-to-l from-brand-500/90 to-transparent rounded-full shadow-lg shadow-brand-500/50" />
                    <div className="absolute bottom-0 right-0 w-1 h-8 bg-gradient-to-t from-brand-500/90 to-transparent rounded-full shadow-lg shadow-brand-500/50" />
                    <div className="absolute bottom-1 right-1 w-1 h-1 rounded-full bg-brand-500/80" />
                  </div>
                </div>
                
                {/* Elegant control hint that slides in */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out pointer-events-none z-30">
                  <div className="flex items-center justify-center gap-4 text-white/70 text-sm">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      <span>Phát</span>
                    </div>
                    <div className="w-px h-4 bg-white/20" />
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                      </svg>
                      <span>Thanh tiến độ</span>
                    </div>
                    <div className="w-px h-4 bg-white/20" />
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M4.586 15.536a5 5 0 010-7.072m12.728 0l-1.757 1.757M3 12h6m-6 0l-1.757 1.757M21 12l-1.757-1.757M3 12l6-6m12 0l1.757-1.757" />
                      </svg>
                      <span>Toàn màn hình</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </motion.div>

      <motion.div variants={item} className="order-7">
        <Card className="tech-stack-card relative overflow-hidden shadow-sm">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="tech-stack-kicker mb-1 text-xs font-semibold uppercase tracking-[0.24em]">
                Tech Stack
              </p>
              <h2
                className="tech-stack-heading text-xl font-bold"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {"N\u1ec1n t\u1ea3ng c\u00f4ng ngh\u1ec7 \u0111ang v\u1eadn h\u00e0nh h\u1ec7 th\u1ed1ng"}
              </h2>
            </div>

          </div>

          <div className="logo-marquee-shell">
            <div className="logo-marquee-track">
              {[...techStackLogos, ...techStackLogos].map((logo, index) => (
                <div
                  key={`${logo.name}-${index}`}
                  className="logo-marquee-item"
                  aria-hidden={index >= techStackLogos.length}
                >
                  <span className="logo-marquee-thumb">
                    <Image
                      src={logo.src}
                      alt={logo.name}
                      width={112}
                      height={44}
                      className="logo-marquee-image"
                    />
                  </span>
                  <span className="logo-marquee-label">{logo.name}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Quick Stats */}
      <motion.div variants={item} className="order-3 w-full overflow-x-clip">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const count =
            stat.label === "Học liệu"
              ? materials.length
              : 0;
          return (
            <TiltCard key={stat.label} className="min-w-0">
              <Card className="!p-4 h-full shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center flex-shrink-0 shadow-inner`}>
                    <Icon className="w-5 h-5 text-white drop-shadow-md" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">{count}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">{stat.label}</p>
                  </div>
                </div>
              </Card>
            </TiltCard>
          );
        })}
        </div>
      </motion.div>

      {/* Recent Materials */}
      <motion.div variants={item} className="order-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-black text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
              Học liệu gần đây
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              Danh sách cập nhật mới nhất
            </p>
          </div>
          <Link href="/materials">
            <button className="flex items-center gap-1.5 px-4 h-9 rounded-full border-2 border-[var(--border-structural)] text-sm font-semibold text-[var(--text-secondary)] hover:border-[#A1E8AF] hover:text-[var(--text-primary)] transition-all cursor-pointer bg-transparent">
              Xem tất cả <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </Link>
        </div>

        {loading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        )}

        {error && (
          <Card className="!border-rose-200 !bg-rose-50">
            <p className="text-rose-600 text-sm">Lỗi: {error}</p>
          </Card>
        )}

        {!loading && !error && !user && materials.length === 0 && (
          <EmptyState
            icon={<MapPin className="w-10 h-10" />}
            title="Đăng nhập để xem học liệu"
            description="Vui lòng đăng nhập bằng Google ở góc phải để xem danh sách học liệu của bạn."
          />
        )}

        {!loading && !error && user && materials.length === 0 && (
          <EmptyState
            icon={<BookOpen className="w-10 h-10" />}
            title="Chưa có học liệu nào"
            description="Bắt đầu bằng cách tải lên tài liệu đầu tiên của bạn"
            action={
              <Link href="/materials/upload">
                <Button icon={<Upload className="w-4 h-4" />}>Tải lên ngay</Button>
              </Link>
            }
          />
        )}

        {!loading && materials.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {materials.slice(0, 6).map((material, index) => (
              <motion.div
                key={material.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link href={`/materials/${material.id}`} className="block no-underline">
                  <Card hover>
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-accent-100 flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-5 h-5 text-brand-600" />
                      </div>
                      <Badge status={material.processing_status} />
                    </div>
                    <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1 line-clamp-1">
                      {material.title}
                    </h3>
                    <p className="text-sm text-[var(--text-secondary)] mb-3 line-clamp-2">
                      {material.description || "Không có mô tả"}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                      {material.subject && (
                        <span className="px-2 py-0.5 rounded-md bg-[var(--bg-secondary)] font-medium">
                          {material.subject}
                        </span>
                      )}
                      <span className="ml-auto">
                        {DATE_FORMATTER.format(new Date(material.updated_at))}
                      </span>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Quick Actions — Soft Brutalism cards */}
      <motion.div variants={item} className="order-4">
        <h2 className="text-xl font-black text-[var(--text-primary)] mb-4" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
          Công cụ AI của bạn
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            {
              icon: Upload,
              title: "Tải lên tài liệu",
              desc: "PDF, DOCX, TXT hoặc nhập trực tiếp",
              href: "/materials/upload",
              tags: ["PDF", "Docx"],
            },
            {
              icon: Sparkles,
              title: "Nội dung AI",
              desc: "Slides, podcast, minigame tự động",
              href: "/materials",
              tags: ["Hot"],
            },
            {
              icon: MessageSquareText,
              title: "Chatbot RAG",
              desc: "Hỏi đáp thông minh theo tài liệu",
              href: "/chatbot",
              tags: ["Interactive"],
            },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href} className="no-underline group">
                <div className="sb-card cursor-pointer p-6">
                  <div className="w-12 h-12 rounded-xl bg-[var(--bg-section)] flex items-center justify-center mb-4 border-2 border-[var(--border-structural)] group-hover:bg-[#A1E8AF] group-hover:border-[#A1E8AF] transition-colors">
                    <Icon className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-slate-900 transition-colors" />
                  </div>
                  <h3 className="text-base font-bold text-[var(--text-primary)] mb-2">
                    {action.title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mb-4">{action.desc}</p>
                  <div className="flex items-center gap-1.5">
                    {action.tags.map(tag => (
                      <span key={tag} className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--bg-section)] text-[var(--text-secondary)] uppercase border border-[var(--border-structural)]">{tag}</span>
                    ))}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </motion.div>

      {/* Geography Location */}
      {/* Cooperation Contact */}
      <motion.div variants={item} className="order-6 content-auto">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-brand-600" />
          <h2 className="text-xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
            Liên hệ hợp tác
          </h2>
          </div>
          <button
            type="button"
            onClick={() => setContactExpanded((prev) => !prev)}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            {contactExpanded ? "Thu gọn" : "Xem chi tiết"}
            {contactExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
        <div className="relative overflow-hidden rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 shadow-[var(--shadow-lg)] sm:p-4">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top_left,rgba(79,70,229,0.12),transparent_58%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.1),transparent_42%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.16),transparent_58%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_42%)]" />
        <Card className="relative mb-4 overflow-hidden border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-[var(--shadow-md)]">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-600 mb-2">
                Hợp tác chiến lược
              </p>
              <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2" style={{ fontFamily: "var(--font-display)" }}>
                Gửi nội dung hợp tác trực tiếp đến email
              </h3>
              <p className="text-sm leading-6 text-[var(--text-secondary)]">
                Điền thông tin, xác minh Turnstile rồi gửi để hệ thống chuyển nội dung hợp tác đến email đã cấu hình.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  "AI giáo dục",
                  "Chống spam",
                  "Gửi thẳng email",
                ].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-brand-200/70 bg-brand-50/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700 dark:border-brand-400/20 dark:bg-brand-500/10 dark:text-brand-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="hidden sm:flex h-14 w-14 items-center justify-center rounded-[20px] bg-gradient-to-br from-brand-600 to-accent-500 text-white shadow-[0_18px_34px_-22px_rgba(37,99,235,0.75)]">
              <Send className="w-5 h-5" />
            </div>
          </div>

          {!contactExpanded ? (
            <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-secondary)] p-4 text-sm text-[var(--text-secondary)]">
              Biểu mẫu đang được thu gọn để giao diện gọn hơn. Nhấn <strong>Xem chi tiết</strong> để mở form liên hệ và danh sách thành viên.
            </div>
          ) : (
          <form onSubmit={handleContactSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Họ và tên</span>
                <input
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                  className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3.5 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-tertiary)] focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                  placeholder="Nhập tên của bạn"
                  autoComplete="name"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Email phản hồi</span>
                <input
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  type="email"
                  className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3.5 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-tertiary)] focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Chủ đề</span>
              <input
                value={contactSubject}
                onChange={(event) => setContactSubject(event.target.value)}
                className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3.5 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-tertiary)] focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                placeholder="Ví dụ: Đề xuất hợp tác nội dung AI cho giáo dục"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Nội dung muốn gửi</span>
              <textarea
                value={contactMessage}
                onChange={(event) => setContactMessage(event.target.value)}
                className="min-h-[200px] w-full rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-4 text-sm leading-6 text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-tertiary)] focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                placeholder="Mô tả ngắn nhu cầu hợp tác, mục tiêu và cách bạn muốn được liên hệ."
                required
              />
            </label>

            <div className="rounded-[24px] border border-dashed border-brand-300/60 bg-[var(--bg-secondary)] p-4 dark:border-brand-400/25">
              <p className="mb-3 text-sm font-medium text-[var(--text-primary)]">Xác minh chống spam</p>
              <TurnstileCaptcha
                key={contactCaptchaKey}
                onVerify={(token) => {
                  setContactCaptchaToken(token);
                  setContactCaptchaExpired(false);
                  setContactError("");
                }}
                onExpire={() => {
                  setContactCaptchaToken(null);
                  setContactCaptchaExpired(true);
                }}
                onError={() => {
                  setContactCaptchaToken(null);
                  setContactCaptchaExpired(false);
                  setContactError("Không thể tải CAPTCHA. Vui lòng tải lại trang và thử lại.");
                }}
              />
              <p className="mt-3 text-xs leading-5 text-[var(--text-tertiary)]">
                {contactCaptchaToken
                  ? "CAPTCHA đã xác minh, bạn có thể gửi biểu mẫu."
                  : contactCaptchaExpired
                    ? "CAPTCHA đã hết hạn. Vui lòng xác minh lại trước khi gửi."
                    : "Biểu mẫu chỉ được gửi sau khi xác minh thành công."}
              </p>
            </div>

            {contactError && (
              <div className="rounded-2xl border border-rose-200/90 bg-rose-50/95 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                {contactError}
              </div>
            )}
            {contactSuccess && (
              <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/95 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                {contactSuccess}
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-[var(--border-light)]/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-md text-xs leading-5 text-[var(--text-tertiary)]">
                Email sẽ được gửi đến địa chỉ đã cấu hình ở backend.
              </p>
              <Button type="submit" disabled={contactSubmitting || !contactCaptchaToken} className="h-12 rounded-2xl bg-gradient-to-r from-brand-600 via-accent-600 to-emerald-500 px-6 text-sm font-semibold text-white shadow-[0_20px_40px_-22px_rgba(37,99,235,0.7)] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60">
                {contactSubmitting ? "Đang gửi..." : "Gửi liên hệ hợp tác"}
              </Button>
            </div>
          </form>
          )}
        </Card>
        {contactExpanded ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {[
            {
              name: "Kietnehi",
              username: "Kietnehi",
              role: "AI Engineer & Researcher",
              gradient: "from-brand-500 to-brand-600",
            },
            {
              name: "ductoanoxo",
              username: "ductoanoxo",
              role: "Developer",
              gradient: "from-accent-500 to-accent-600",
            },
            {
              name: "phatle224",
              username: "phatle224",
              role: "Data Engineer",
              gradient: "from-emerald-500 to-emerald-600",
            },
          ].map((contact) => (
            <a key={contact.username} href={`https://github.com/${contact.username}`} target="_blank" rel="noopener noreferrer" className="no-underline">
              <Card hover className="group h-full overflow-hidden border-[var(--border-default)] bg-[var(--bg-elevated)] text-center shadow-[var(--shadow-sm)]">
                {/* Avatar with gradient border */}
                <div className={`relative mx-auto mb-4 h-20 w-20 rounded-[22px] bg-gradient-to-br ${contact.gradient} p-[3px] group-hover:scale-105 transition-transform duration-300 shadow-[0_18px_32px_-22px_rgba(15,23,42,0.55)]`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={`https://github.com/${contact.username}.png`} 
                    alt={contact.username} 
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full rounded-[18px] object-cover"
                  />
                  <div className="absolute -bottom-1 -right-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1.5 shadow-sm">
                    <GithubIcon className="w-4 h-4 text-[var(--text-secondary)]" />
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">
                  {contact.name}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] font-medium mb-4">
                  {contact.role}
                </p>

                {/* Shields.io badges like README */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-4 w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={`https://img.shields.io/github/followers/${contact.username}?style=social`} 
                    alt="Followers" 
                    loading="lazy"
                    decoding="async"
                    className="h-6 object-contain"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={`https://img.shields.io/github/stars/${contact.username}?style=social&label=Stars`} 
                    alt="Stars" 
                    loading="lazy"
                    decoding="async"
                    className="h-6 object-contain"
                  />
                </div>

                <div className="mt-auto flex items-center justify-center gap-1 text-sm font-medium text-brand-600 opacity-80 transition-opacity group-hover:opacity-100">
                  Xem Github <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Card>
            </a>
          ))}
        </div>
        ) : null}
        </div>
      </motion.div>

      {/* Geography Location */}
      <motion.div variants={item} className="order-8 content-auto">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-5 h-5 text-brand-600" />
          <h2 className="text-xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
            Vị trí địa lý
          </h2>
        </div>
        <Card className="overflow-hidden !p-0 border-[var(--border-light)] shadow-sm">
          <div className="p-4 bg-[var(--bg-secondary)] border-b border-[var(--border-light)]">
            <h3 className="font-semibold text-[var(--text-primary)]">Trường Đại học Sài Gòn</h3>
            <p className="text-sm text-[var(--text-secondary)]">273 An Dương Vương, Phường 3, Quận 5, Thành phố Hồ Chí Minh</p>
          </div>
          <div className="w-full h-[400px] relative">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d9309.215601568438!2d106.67968337575233!3d10.759917089387919!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31752f1b7c3ed289%3A0xa06651894598e488!2zVHLGsOG7nW5nIMSQ4bqhaSBo4buNYyBTw6BpIEfDsm4!5e1!3m2!1svi!2sus!4v1774422510403!5m2!1svi!2sus"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen={true}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="SGU Map"
              className="grayscale-[0.2] contrast-[1.1]"
            ></iframe>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
