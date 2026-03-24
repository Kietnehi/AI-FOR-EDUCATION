"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Search, Filter, Upload, ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { listMaterials } from "@/lib/api";
import { Material } from "@/types";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    listMaterials()
      .then((res) => setMaterials(res.items))
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = materials.filter(
    (m) =>
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      (m.subject || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
            Học liệu
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Quản lý tất cả tài liệu học tập của bạn
          </p>
        </div>
        <Link href="/materials/upload">
          <Button icon={<Upload className="w-4 h-4" />}>Tải lên mới</Button>
        </Link>
      </motion.div>

      {/* Search & Filter */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
              <input
                type="text"
                placeholder="Tìm kiếm theo tên hoặc môn học..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="
                  w-full h-10 pl-10 pr-4 rounded-xl
                  bg-[var(--bg-secondary)] border border-[var(--border-light)]
                  text-sm text-[var(--text-primary)]
                  placeholder:text-[var(--text-tertiary)]
                  focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100
                  transition-all duration-200
                "
              />
            </div>
            <Button variant="secondary" icon={<Filter className="w-4 h-4" />}>
              Bộ lọc
            </Button>
          </div>
        </Card>
      </motion.div>

      {/* Material Grid */}
      {loading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {error && (
        <Card className="!border-rose-200 !bg-rose-50">
          <p className="text-rose-600 text-sm">Lỗi: {error}</p>
        </Card>
      )}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          icon={<BookOpen className="w-10 h-10" />}
          title={search ? "Không tìm thấy kết quả" : "Chưa có học liệu nào"}
          description={search ? "Thử từ khóa khác" : "Bắt đầu bằng cách tải lên tài liệu đầu tiên"}
          action={
            !search ? (
              <Link href="/materials/upload">
                <Button icon={<Upload className="w-4 h-4" />}>Tải lên ngay</Button>
              </Link>
            ) : undefined
          }
        />
      )}

      {!loading && filtered.length > 0 && (
        <motion.div
          variants={container}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filtered.map((material, index) => (
            <motion.div
              key={material.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              <Link href={`/materials/${material.id}`} className="block no-underline">
                <Card hover className="h-full">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-accent-100 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-5 h-5 text-brand-600" />
                    </div>
                    <Badge status={material.processing_status} />
                  </div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1 line-clamp-2">
                    {material.title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mb-4 line-clamp-2">
                    {material.description || "Không có mô tả"}
                  </p>
                  <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)] pt-3 border-t border-[var(--border-light)]">
                    <div className="flex items-center gap-2">
                      {material.subject && (
                        <span className="px-2 py-0.5 rounded-md bg-[var(--bg-secondary)] font-medium">
                          {material.subject}
                        </span>
                      )}
                      {material.education_level && (
                        <span className="px-2 py-0.5 rounded-md bg-[var(--bg-secondary)]">
                          {material.education_level}
                        </span>
                      )}
                    </div>
                    <ArrowRight className="w-4 h-4 text-brand-400" />
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
