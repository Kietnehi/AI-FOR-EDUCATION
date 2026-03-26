"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, Presentation, Mic, Gamepad2, ArrowRight } from "lucide-react";

import { Card } from "@/components/ui/card";

export default function GeneratedIndexPage() {
  const categories = [
    {
      icon: Presentation,
      title: "Slides",
      desc: "Xem tất cả slide đã tạo từ học liệu",
      gradient: "from-brand-500 to-brand-600",
    },
    {
      icon: Mic,
      title: "Podcasts",
      desc: "Kịch bản podcast được tạo bởi AI",
      gradient: "from-accent-500 to-accent-600",
    },
    {
      icon: Gamepad2,
      title: "Minigames",
      desc: "Quiz, flashcard và bài tập tương tác",
      gradient: "from-emerald-500 to-emerald-600",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
          Nội dung AI
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Tất cả nội dung được tạo bởi AI từ học liệu của bạn
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {categories.map((cat, idx) => {
          const Icon = cat.icon;
          return (
            <motion.div
              key={cat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
            >
              <Link href="/materials" className="block no-underline">
                <Card hover className="group">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${cat.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                    {cat.title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mb-4">
                    {cat.desc}
                  </p>
                  <div className="flex items-center gap-1 text-sm font-medium text-brand-600">
                    Xem tất cả
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </div>

      <Card className="text-center py-8">
        <Sparkles className="w-12 h-12 text-accent-400 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">
          Tạo media theo học liệu
        </h3>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Mở chi tiết một học liệu rồi bấm nút &quot;Tạo Video + Infographic&quot;
        </p>
        <Link href="/materials">
          <span className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors">
            Đi đến Học liệu →
          </span>
        </Link>
      </Card>
    </motion.div>
  );
}
