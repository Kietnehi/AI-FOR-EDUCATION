"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Check,
  Filter,
  Pencil,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/skeleton";
import { deleteMaterial, listMaterials, subscribeToMaterialsRealtime, updateMaterial } from "@/lib/api";
import { Material } from "@/types";
import { useNotify } from "@/components/use-notify";

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
  const { success, error: notifyError } = useNotify();
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
  const editTitleInputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    return subscribeToMaterialsRealtime({
      onSnapshot: (snapshot) => {
        setMaterials(snapshot.items);
        setError("");
        setLoading(false);
      },
      onError: () => undefined,
    });
  }, []);

  useEffect(() => {
    if (!editingMaterial) return;

    const timeoutId = window.setTimeout(() => {
      editTitleInputRef.current?.focus();
      editTitleInputRef.current?.select();
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [editingMaterial]);

  const filtered = useMemo(() => {
    const s = deferredSearch.toLowerCase();
    return materials.filter(
      (material) =>
        material.title.toLowerCase().includes(s) ||
        (material.subject || "").toLowerCase().includes(s),
    );
  }, [materials, deferredSearch]);

  const openEditModal = (material: Material) => {
    const level = material.education_level || "";
    const isPresetLevel = EDUCATION_LEVEL_OPTIONS.some(
      (option) => option !== "Khác" && option === level,
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
      notifyError("Tiêu đề không được để trống.");
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
      setIsCustomEducationLevel(false);
      success("Đã cập nhật học liệu thành công.");
    } catch (err) {
      notifyError(`Lỗi khi cập nhật: ${err}`);
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
      setMaterials((prev) => prev.filter((item) => item.id !== id));
      success("Đã xóa học liệu thành công.");
    } catch (err) {
      notifyError(`Lỗi khi xóa: ${err}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"
      >
        <div>
          <h1
            className="text-2xl font-bold text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Học liệu
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Quản lý tất cả tài liệu học tập của bạn
          </p>
        </div>
        <Link href="/materials/upload">
          <Button icon={<Upload className="h-4 w-4" />}>Tải lên mới</Button>
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                type="text"
                placeholder="Tìm kiếm theo tên hoặc môn học..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="
                  h-10 w-full rounded-xl border border-[var(--border-light)]
                  bg-[var(--bg-secondary)] pl-10 pr-4 text-sm text-[var(--text-primary)]
                  placeholder:text-[var(--text-tertiary)]
                  focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100
                  transition-all duration-200
                "
              />
            </div>
            <Button variant="secondary" icon={<Filter className="h-4 w-4" />}>
              Bộ lọc
            </Button>
          </div>
        </Card>
      </motion.div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <CardSkeleton key={item} />
          ))}
        </div>
      ) : null}

      {error ? (
        <Card className="!border-rose-200 !bg-rose-50">
          <p className="text-sm text-rose-600">Lỗi: {error}</p>
        </Card>
      ) : null}

      {!loading && !error && filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-10 w-10" />}
          title={search ? "Không tìm thấy kết quả" : "Chưa có học liệu nào"}
          description={search ? "Thử từ khóa khác" : "Bắt đầu bằng cách tải lên tài liệu đầu tiên"}
          action={
            !search ? (
              <Link href="/materials/upload">
                <Button icon={<Upload className="h-4 w-4" />}>Tải lên ngay</Button>
              </Link>
            ) : undefined
          }
        />
      ) : null}

      {!loading && filtered.length > 0 ? (
        <motion.div variants={container} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((material, index) => (
            <motion.div
              key={material.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              <Card hover className="relative h-full">
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-100 to-accent-100">
                    <BookOpen className="h-5 w-5 text-brand-600" />
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge status={material.processing_status} />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openEditModal(material);
                      }}
                      className="rounded-lg bg-blue-50 p-2 text-blue-500 transition-colors hover:bg-blue-100 hover:text-blue-600"
                      title="Sửa học liệu"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(material.id);
                      }}
                      disabled={deletingId === material.id}
                      className="rounded-lg bg-red-50 p-2 text-red-500 transition-colors hover:bg-red-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                      title="Xóa học liệu"
                    >
                      {deletingId === material.id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Link href={`/materials/${material.id}`} className="block no-underline">
                  <h3 className="mb-1 line-clamp-2 text-base font-semibold text-[var(--text-primary)]">
                    {material.title}
                  </h3>
                  <p className="mb-4 line-clamp-2 text-sm text-[var(--text-secondary)]">
                    {material.description || "Không có mô tả"}
                  </p>
                  <div className="flex items-center justify-between border-t border-[var(--border-light)] pt-3 text-xs text-[var(--text-tertiary)]">
                    <div className="flex items-center gap-2">
                      {material.subject ? (
                        <span className="rounded-md bg-[var(--bg-secondary)] px-2 py-0.5 font-medium">
                          {material.subject}
                        </span>
                      ) : null}
                      {material.education_level ? (
                        <span className="rounded-md bg-[var(--bg-secondary)] px-2 py-0.5">
                          {material.education_level}
                        </span>
                      ) : null}
                    </div>
                    <ArrowRight className="h-4 w-4 text-brand-400" />
                  </div>
                </Link>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      ) : null}

      <Dialog open={Boolean(editingMaterial)} onClose={closeEditModal} title="Chỉnh sửa học liệu" maxWidth="xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Tiêu đề *</span>
            <input
              ref={editTitleInputRef}
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
                          ? "border-brand-400/70 bg-brand-500/15 text-[var(--text-primary)] shadow-[inset_0_0_0_1px_rgba(16,185,129,0.18)]"
                          : "border-[var(--border-light)] bg-[var(--bg-secondary)] text-[var(--text-border)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)]"
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
          <Button
            variant="secondary"
            onClick={closeEditModal}
            disabled={savingEdit}
            icon={<X className="h-4 w-4" />}
          >
            Hủy
          </Button>
          <Button onClick={handleSaveEdit} loading={savingEdit} icon={<Check className="h-4 w-4" />}>
            Lưu thay đổi
          </Button>
        </div>
      </Dialog>
    </motion.div>
  );
}
