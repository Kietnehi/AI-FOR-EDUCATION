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

  return (
    <div ref={ref} className="w-full h-[250px] relative rounded-2xl overflow-hidden mt-6 shadow-sm border border-[var(--border-light)]">
      {show ? (
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
        />
      ) : (
        <div className="w-full h-full bg-[var(--bg-secondary)] flex items-center justify-center">
          <MapPin className="w-8 h-8 text-[var(--text-tertiary)] animate-pulse" />
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listMaterials()
      .then((res) => setMaterials(res.items))
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col xl:flex-row gap-8 animate-fade-in-up pb-10">
      
      {/* LEFT COLUMN - Main Content */}
      <div className="flex-1 space-y-8 min-w-0">
        
        {/* Banner Section */}
        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-r from-brand-500 to-accent-400 p-10 sm:p-12 text-white shadow-brand">
          {/* Subtle Sparkles Graphics */}
          <Sparkles className="absolute top-8 right-32 w-24 h-24 text-white opacity-20" />
          <Sparkles className="absolute bottom-10 right-10 w-48 h-48 text-white opacity-10" />
          <Sparkles className="absolute top-20 right-[40%] w-10 h-10 text-white opacity-40" />
          
          <div className="relative z-10 max-w-xl">
            <div className="uppercase tracking-widest text-[11px] font-bold text-white/80 mb-4">
              AI Learning Studio
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
                      
                      <h3 className="text-[15px] font-bold text-[var(--text-primary)] mt-3 mb-4 line-clamp-2 leading-snug group-hover:text-brand-600 transition-colors">
                        {material.title}
                      </h3>

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

                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
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

          <LazyMap />
        </div>

        {/* Your Mentor (Cooperation Contacts Wrapper) */}
        <div>
          <div className="flex items-center justify-between mb-6 px-1">
            <h3 className="font-bold text-lg text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
              Liên hệ hợp tác
            </h3>
            <button className="w-8 h-8 rounded-full border border-[var(--border-light)] bg-white flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] cursor-pointer">
              <Sparkles className="w-4 h-4" />
            </button>
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
