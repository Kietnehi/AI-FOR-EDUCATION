"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { TiltCard } from "@/components/ui/tilt-card";
import { listMaterials } from "@/lib/api";
import { Material } from "@/types";
import dynamic from "next/dynamic";

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

  useEffect(() => {
    listMaterials()
      .then((res) => setMaterials(res.items))
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
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
             <AIVisualizer />
          </div>

          <div className="relative z-10 max-w-xl pointer-events-none">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-sm font-medium mb-4 pointer-events-auto">
              <Sparkles className="w-4 h-4" />
              AI-Powered Learning
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight mb-4 pointer-events-auto" style={{ fontFamily: "var(--font-display)" }}>
              Tạo học liệu số
              <br />
              <span className="text-accent-200 drop-shadow-sm">thông minh với AI</span>
            </h1>
            <p className="text-base text-brand-50 mb-8 max-w-md pointer-events-auto text-lg leading-relaxed">
              Upload tài liệu, tự động tạo slide gốc, podcast, minigame và chatbot hỏi đáp chỉ trong vài phút.
            </p>
            <div className="flex flex-wrap gap-3 pointer-events-auto shadow-lg rounded-full w-fit">
              <Link href="/materials/upload">
                <Button variant="secondary" size="lg" icon={<Upload className="w-5 h-5" />} className="h-12 px-6 rounded-full font-semibold">
                  Tải lên học liệu
                </Button>
              </Link>
              <Link href="/materials">
                <Button
                  variant="ghost"
                  size="lg"
                  icon={<ArrowRight className="w-5 h-5" />}
                  className="!text-white/90 hover:!bg-white/20 h-12 px-6 rounded-full backdrop-blur-sm bg-white/5 font-semibold"
                >
                  Xem tất cả
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4" style={{ perspective: 1000 }}>
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const count =
            stat.label === "Học liệu"
              ? materials.length
              : 0;
          return (
            <TiltCard key={stat.label}>
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
      </motion.div>

      {/* Recent Materials */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
              Học liệu gần đây
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              Danh sách cập nhật mới nhất
            </p>
          </div>
          <Link href="/materials">
            <Button variant="ghost" size="sm" icon={<ArrowRight className="w-4 h-4" />}>
              Xem tất cả
            </Button>
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

        {!loading && !error && materials.length === 0 && (
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
                        {new Date(material.updated_at).toLocaleDateString("vi-VN")}
                      </span>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={item}>
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4" style={{ fontFamily: "var(--font-display)" }}>
          Hành động nhanh
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            {
              icon: Upload,
              title: "Tải lên tài liệu",
              desc: "PDF, DOCX, TXT hoặc nhập trực tiếp",
              href: "/materials/upload",
              gradient: "from-brand-500 to-brand-600",
            },
            {
              icon: Sparkles,
              title: "Tạo nội dung AI",
              desc: "Slides, podcast, minigame tự động",
              href: "/materials",
              gradient: "from-accent-500 to-accent-600",
            },
            {
              icon: MessageSquareText,
              title: "Chat với AI",
              desc: "Hỏi đáp thông minh theo tài liệu",
              href: "/chatbot",
              gradient: "from-emerald-500 to-emerald-600",
            },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href} className="no-underline">
                <Card hover className="group">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${action.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">
                    {action.title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)]">{action.desc}</p>
                </Card>
              </Link>
            );
          })}
        </div>
      </motion.div>

      {/* Geography Location */}
      <motion.div variants={item}>
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

      {/* Cooperation Contact */}
      <motion.div variants={item}>
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
                    className="h-6 object-contain"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={`https://img.shields.io/github/stars/${contact.username}?style=social&label=Stars`} 
                    alt="Stars" 
                    className="h-6 object-contain"
                  />
                </div>

                <div className="mt-auto text-brand-600 text-sm font-medium flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  Xem Github <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Card>
            </a>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
