"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { BookOpen, Search, Filter, Upload, ArrowRight, Trash2, Pencil, X, Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { listMaterials, deleteMaterial, updateMaterial } from "@/lib/api";
import { Material } from "@/types";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const EDUCATION_LEVEL_OPTIONS = [
  "Tiểu học",
  "THCS",
  "THPT",
  "Đại học/Cao đẳng",
  "Khác",
] as const;

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [isCustomEducationLevel, setIsCustomEducationLevel] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    subject: "",
    education_level: "",
    tags: "",
  });
  const deferredSearch = useDeferredValue(search);

  const openEditModal = (material: Material) => {
    const level = material.education_level || "";
    const isPresetLevel = EDUCATION_LEVEL_OPTIONS.some(
      (option) => option !== "Khác" && option === level
    );

    setEditingMaterial(material);
    setIsCustomEducationLevel(Boolean(level) && !isPresetLevel);
    setEditForm({
      title: material.title,
      description: material.description || "",
      subject: material.subject || "",
      education_level: material.education_level || "",
      tags: material.tags.join(", "),
    });
  };

  const closeEditModal = () => {
    if (savingEdit) return;
    setEditingMaterial(null);
    setIsCustomEducationLevel(false);
  };

  const handleSaveEdit = async () => {
    if (!editingMaterial) return;
    if (!editForm.title.trim()) {
      alert("Tiêu đề không được để trống.");
      return;
    }

    setSavingEdit(true);
    try {
      const updated = await updateMaterial(editingMaterial.id, {
        title: editForm.title.trim(),
        description: editForm.description.trim() || undefined,
        subject: editForm.subject.trim() || undefined,
        education_level: editForm.education_level.trim() || undefined,
        tags: editForm.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });

      setMaterials((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setEditingMaterial(null);
    } catch (err) {
      alert(`Lỗi khi cập nhật: ${err}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa học liệu này không?")) {
      return;
    }

    setDeletingId(id);
    try {
      await deleteMaterial(id);
      setMaterials((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      alert(`Lỗi khi xóa: ${err}`);
    } finally {
      setDeletingId(null);
    }
  };

  const reloadMaterials = async () => {
    setLoading(true);
    try {
      const res = await listMaterials();
      setMaterials(res.items);
      setError("");
    } catch (err) {
      try {
        const parsed = JSON.parse((err as Error).message || "{}");
        if (parsed?.code === "AUTH_REQUIRED") {
          setMaterials([]);
          setError("");
          return;
        }
      } catch {
        // Fall through to generic error handling.
      }
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadMaterials();
  }, []);

  const filtered = useMemo(() => {
    const s = deferredSearch.toLowerCase();
    return materials.filter(
      (m) =>
        m.title.toLowerCase().includes(s) ||
        (m.subject || "").toLowerCase().includes(s)
    );
  }, [materials, deferredSearch]);

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
              <Card hover className="h-full relative">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-accent-100 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-5 h-5 text-brand-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge status={material.processing_status} />
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openEditModal(material);
                      }}
                      className="p-2 rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                      title="Sửa học liệu"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(material.id);
                      }}
                      disabled={deletingId === material.id}
                      className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Xóa học liệu"
                    >
                      {deletingId === material.id ? (
                        <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <Link href={`/materials/${material.id}`} className="block no-underline">
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
                </Link>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {editingMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Chỉnh sửa học liệu</h3>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-lg border border-[var(--border-light)] p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
                disabled={savingEdit}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Tiêu đề *</span>
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="h-10 w-full rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] px-4 text-sm text-[var(--text-primary)]"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Môn học</span>
                <input
                  value={editForm.subject}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, subject: e.target.value }))}
                  className="h-10 w-full rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] px-4 text-sm text-[var(--text-primary)]"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Cấp học</span>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {EDUCATION_LEVEL_OPTIONS.map((option) => {
                      const isSelected =
                        option === "Khác"
                          ? isCustomEducationLevel
                          : !isCustomEducationLevel && editForm.education_level === option;

                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            if (option === "Khác") {
                              setIsCustomEducationLevel(true);
                              setEditForm((prev) => ({ ...prev, education_level: "" }));
                              return;
                            }
                            setIsCustomEducationLevel(false);
                            setEditForm((prev) => ({ ...prev, education_level: option }));
                          }}
                          className={`rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-200 ${
                            isSelected
                              ? "border-brand-300 bg-brand-50 text-brand-700"
                              : "border-[var(--border-light)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:border-brand-300 hover:text-[var(--text-primary)]"
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>

                  {isCustomEducationLevel ? (
                    <input
                      value={editForm.education_level}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, education_level: e.target.value }))}
                      placeholder="Nhập cấp học khác"
                      className="h-10 w-full rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] px-4 text-sm text-[var(--text-primary)]"
                    />
                  ) : null}
                </div>
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Từ khóa</span>
                <input
                  value={editForm.tags}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, tags: e.target.value }))}
                  placeholder="Ngăn cách bằng dấu phẩy"
                  className="h-10 w-full rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] px-4 text-sm text-[var(--text-primary)]"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Mô tả</span>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] px-4 py-3 text-sm text-[var(--text-primary)]"
                />
              </label>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={closeEditModal} disabled={savingEdit} icon={<X className="w-4 h-4" />}>
                Hủy
              </Button>
              <Button onClick={handleSaveEdit} loading={savingEdit} icon={<Check className="w-4 h-4" />}>
                Lưu thay đổi
              </Button>
            </div>
          </Card>
        </div>
      )}
    </motion.div>
  );
}
