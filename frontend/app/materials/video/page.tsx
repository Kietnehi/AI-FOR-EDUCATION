"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Clapperboard, Sparkles, ArrowRight } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function MaterialsVideoLandingPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
          Tạo Video AI Từ Học Liệu
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Chọn một học liệu, sau đó bấm &quot;Tạo Video + Infographic&quot; trong trang chi tiết.
        </p>
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center">
            <Clapperboard className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Luồng tạo media theo học liệu</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Hệ thống sẽ dùng nội dung học liệu bạn đã tải lên để tạo video và infographic bằng NotebookLM.
            </p>
          </div>
          <Link href="/materials" className="no-underline">
            <Button icon={<ArrowRight className="w-4 h-4" />}>
              Chọn học liệu
            </Button>
          </Link>
        </div>
      </Card>

      <Card className="text-sm text-[var(--text-secondary)]">
        <div className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 mt-0.5 text-accent-500" />
          <p>
            Nếu bạn chưa có học liệu, hãy vào mục Tải lên trước, sau đó quay lại đây để tạo media.
          </p>
        </div>
      </Card>
    </motion.div>
  );
}
