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
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { listMaterials } from "@/lib/api";
import { Material } from "@/types";

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
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-accent-600 to-brand-700 p-8 sm:p-10 text-white">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent-400/20 rounded-full translate-y-1/3 -translate-x-1/4 blur-2xl" />

          <div className="relative z-10 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" />
              AI-Powered Learning
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight mb-3" style={{ fontFamily: "var(--font-display)" }}>
              Tạo học liệu số
              <br />
              <span className="text-accent-200">thông minh với AI</span>
            </h1>
            <p className="text-base text-brand-100 mb-6 max-w-md">
              Upload tài liệu, tự động tạo slide, podcast, minigame và chatbot hỏi đáp trong vài phút.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/materials/upload">
                <Button variant="secondary" size="lg" icon={<Upload className="w-5 h-5" />}>
                  Tải lên học liệu
                </Button>
              </Link>
              <Link href="/materials">
                <Button
                  variant="ghost"
                  size="lg"
                  icon={<ArrowRight className="w-5 h-5" />}
                  className="!text-white/90 hover:!bg-white/10"
                >
                  Xem tất cả
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const count =
            stat.label === "Học liệu"
              ? materials.length
              : "—";
          return (
            <Card key={stat.label} className="!p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">{count}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">{stat.label}</p>
                </div>
              </div>
            </Card>
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
    </motion.div>
  );
}
