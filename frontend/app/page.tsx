"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import {
  Upload,
  BookOpen,
  Sparkles,
  MessageSquareText,
  FileText,
  Gamepad2,
  Mic,
  MapPin,
  Play,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Heart,
  Bell
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { listMaterials } from "@/lib/api";
import { Material } from "@/types";

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

const statCards = [
  { label: "Product Design", title: "Học liệu", icon: BookOpen, bg: "bg-brand-100", fg: "text-brand-600" },
  { label: "AI Contents", title: "Slide đã tạo", icon: FileText, bg: "bg-brand-100", fg: "text-brand-600" },
  { label: "Audio Logic", title: "Podcast", icon: Mic, bg: "bg-brand-100", fg: "text-brand-600" },
];

function LazyMap() {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShow(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

const DATE_FORMATTER = new Intl.DateTimeFormat("vi-VN");

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

  useEffect(() => {
    listMaterials()
      .then((res) => setMaterials(res.items))
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, []);

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

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Hero Section */}
      <motion.div variants={item}>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-accent-600 to-brand-700 p-8 sm:p-10 text-white min-h-[400px] flex flex-col justify-center">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent-400/20 rounded-full translate-y-1/3 -translate-x-1/4 blur-2xl pointer-events-none" />

          {/* 3D Visualizer Background */}
          <div className="absolute top-0 right-0 bottom-0 w-full sm:w-2/3 lg:w-1/2 min-h-[300px]">
             {showVisualizer ? <AIVisualizer /> : null}
          </div>

          <div className="relative z-10 max-w-xl pointer-events-none">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-sm font-medium mb-4 pointer-events-auto">
              <Sparkles className="w-4 h-4" />
              AI-Powered Learning
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-bold leading-[1.2] mb-8" style={{ fontFamily: "var(--font-display)" }}>
              Sharpen Your Skills With<br/>
              Professional Online Courses
            </h1>
            
            <Link href="/materials/upload" className="inline-block no-underline">
              <button className="flex items-center gap-3 bg-[var(--text-primary)] hover:bg-black text-white px-2 py-2 pr-6 rounded-full transition-colors cursor-pointer border-0">
                <div className="w-10 h-10 rounded-full bg-white text-[var(--text-primary)] flex items-center justify-center shrink-0">
                  <Play className="w-4 h-4 ml-1" fill="currentColor" />
                </div>
                <span className="font-semibold text-sm">Join Now</span>
              </button>
            </Link>
          </div>
        </div>

        {/* Quick Stats Pills */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {statCards.map((stat, i) => (
            <div key={i} className="flex items-center justify-between p-4 px-6 bg-[var(--bg-elevated)] rounded-3xl shadow-sm border border-[var(--border-light)]">
              <div className="flex items-center gap-4">
                <div className={`w-[52px] h-[52px] rounded-full ${stat.bg} ${stat.fg} flex items-center justify-center shrink-0`}>
                  <stat.icon className="w-6 h-6" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[var(--text-secondary)] mb-0.5 tracking-wide">
                    {stat.title === "Học liệu" ? `${materials.length}/10 Created` : "2/8 Generated"}
                  </p>
                  <p className="font-bold text-[var(--text-primary)]">{stat.label}</p>
                </div>
              </div>
              <button className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] bg-transparent border-0 cursor-pointer p-2">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>

        {/* Continue Watching / Recent Materials */}
        <div className="pt-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
              Học liệu gần đây
            </h2>
            <div className="flex gap-2">
              <button className="w-8 h-8 rounded-full border border-[var(--border-light)] bg-white flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] cursor-pointer">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button className="w-8 h-8 rounded-full border border-[var(--border-light)] bg-white flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] cursor-pointer">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {loading && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm">
              Lỗi: {error}
            </div>
          )}

          {!loading && !error && materials.length === 0 && (
            <EmptyState
              icon={<BookOpen className="w-10 h-10" />}
              title="Chưa có học liệu"
              description="Hãy tải lên tài liệu đầu tiên để bắt đầu."
              action={
                <Link href="/materials/upload">
                  <button className="mt-4 px-6 py-2.5 bg-brand-600 text-white rounded-xl font-medium border-0 cursor-pointer">
                    Tải lên ngay
                  </button>
                </Link>
              }
            />
          )}

          {!loading && materials.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {materials.slice(0, 3).map((material, index) => (
                <div key={material.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                  <Link href={`/materials/${material.id}`} className="block no-underline">
                    <div className="bg-[var(--bg-elevated)] rounded-[24px] p-5 shadow-sm border border-[var(--border-light)] hover:shadow-md hover:-translate-y-1 transition-all group">
                      
                      {/* Thumbnail Placeholder */}
                      <div className="relative w-full aspect-video rounded-2xl bg-gradient-to-br from-slate-800 to-indigo-900 overflow-hidden mb-5">
                        <div className="absolute inset-0 flex items-center justify-center text-white/20">
                           <BookOpen className="w-12 h-12" />
                        </div>
                        <button className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border-0 cursor-pointer hover:bg-white/40">
                          <Heart className="w-4 h-4" />
                        </button>
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

                      {/* Progress Bar Mockup */}
                      <div className="w-full h-1.5 bg-[var(--bg-secondary)] rounded-full mb-4 overflow-hidden">
                        <div className="h-full bg-brand-500 rounded-full w-1/3"></div>
                      </div>

                      {/* Author row */}
                      <div className="flex items-center gap-3 pt-1 border-t border-[var(--border-light)] mt-2">
                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center overflow-hidden shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="https://github.com/Kietnehi.png" alt="Author" className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[var(--text-primary)] mb-0">System Admin</p>
                          <p className="text-[10px] font-medium text-[var(--text-tertiary)] mb-0 tracking-wide uppercase">Software Developer</p>
                        </div>
                      </div>

      {/* Geography Location */}
      <motion.div variants={item} className="content-auto">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-5 h-5 text-brand-600" />
          <h2 className="text-xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
            Vị trí địa lý
          </h2>
        </div>
      </div>

      {/* RIGHT COLUMN - Mentors & Profile (Like Your Profile & Your Mentor in image) */}
      <div className="w-full xl:w-[320px] 2xl:w-[360px] shrink-0 space-y-8">
        
        {/* Profile Summary Widget */}
        <div className="bg-[var(--bg-elevated)] rounded-[32px] p-8 flex flex-col items-center text-center shadow-sm border border-[var(--border-light)]">
          <div className="flex justify-between w-full mb-6 relative">
            <h3 className="font-bold text-[var(--text-primary)] text-lg" style={{ fontFamily: "var(--font-display)" }}>Your Profile</h3>
            <button className="text-[var(--text-tertiary)] hover:text-brand-600 bg-transparent border-0 cursor-pointer absolute right-0">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
          
          <div className="w-24 h-24 rounded-full border-4 border-brand-100 p-1 mb-4 relative">
             <div className="absolute top-0 right-0 w-36 h-36 rounded-full border-2 border-brand-500 border-t-transparent border-l-transparent border-r-transparent -translate-x-6 -translate-y-6 rotate-45 transform"></div>
             {/* eslint-disable-next-line @next/next/no-img-element */}
             <img src="https://github.com/Kietnehi.png" alt="Profile" className="w-full h-full rounded-full object-cover" />
          </div>
          
          <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">Good Morning Admin</h2>
          <p className="text-xs text-[var(--text-secondary)] mb-6 px-4">Continue Your Journey And Achieve Your Target</p>
          
          <div className="flex gap-4 mb-2">
             <button className="w-10 h-10 rounded-full border border-[var(--border-light)] flex items-center justify-center text-[var(--text-secondary)] hover:text-brand-600 hover:border-brand-300 bg-white shadow-xs cursor-pointer">
                <Bell className="w-4 h-4" />
             </button>
             <button className="w-10 h-10 rounded-full border border-[var(--border-light)] flex items-center justify-center text-[var(--text-secondary)] hover:text-brand-600 hover:border-brand-300 bg-white shadow-xs cursor-pointer">
                <MessageSquareText className="w-4 h-4" />
             </button>
             <button className="w-10 h-10 rounded-full border border-[var(--border-light)] flex items-center justify-center text-[var(--text-secondary)] hover:text-brand-600 hover:border-brand-300 bg-white shadow-xs cursor-pointer">
                <Upload className="w-4 h-4" />
             </button>
          </div>

      {/* Cooperation Contact */}
      <motion.div variants={item} className="content-auto">
        <div className="flex items-center gap-2 mb-4">
          <GithubIcon className="w-5 h-5 text-brand-600" />
          <h2 className="text-xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
            Liên hệ hợp tác
          </h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            {
              name: "Kietnehi",
              username: "Kietnehi",
              role: "Developer",
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
              role: "Developer",
              gradient: "from-emerald-500 to-emerald-600",
            },
          ].map((contact) => (
            <a key={contact.username} href={`https://github.com/${contact.username}`} target="_blank" rel="noopener noreferrer" className="no-underline">
              <Card hover className="group flex flex-col items-center justify-center p-6 text-center h-full">
                {/* Avatar with gradient border */}
                <div className={`relative w-24 h-24 rounded-full bg-gradient-to-br ${contact.gradient} p-1 mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={`https://github.com/${contact.username}.png`} 
                    alt={contact.username} 
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full rounded-full object-cover border-4 border-white dark:border-gray-900"
                  />
                  <div className="absolute -bottom-1 -right-1 bg-white dark:bg-gray-800 rounded-full p-1.5 shadow-sm border border-gray-100 dark:border-gray-700">
                    <GithubIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
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

          <div className="bg-[var(--bg-elevated)] rounded-[32px] p-6 shadow-sm border border-[var(--border-light)] flex flex-col gap-5">
            {[
              { name: "Kietnehi", role: "Software Developer" },
              { name: "ductoanoxo", role: "Software Developer" },
              { name: "phatle224", role: "Software Developer" },
            ].map((contact, idx) => (
              <div key={idx} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-100 to-white border border-[var(--border-light)] object-cover overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`https://github.com/${contact.name}.png`} alt={contact.name} loading="lazy" />
                  </div>
                  <div>
                    <a href={`https://github.com/${contact.name}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-[var(--text-primary)] no-underline hover:text-brand-600 mb-0">
                      {contact.name}
                    </a>
                    <p className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-0 mt-0.5">{contact.role}</p>
                  </div>
                </div>
                <a href={`https://github.com/${contact.name}`} target="_blank" rel="noopener noreferrer" className="no-underline">
                  <button className="px-4 py-1.5 rounded-full bg-brand-600 text-white text-[11px] font-bold cursor-pointer border-0 opacity-90 group-hover:opacity-100 transition-opacity">
                    Follow
                  </button>
                </a>
              </div>
            ))}

            <button className="w-full mt-2 py-3 rounded-2xl bg-brand-50 text-brand-600 font-bold text-sm cursor-pointer border-0 hover:bg-brand-100 transition-colors">
              See All
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
