"use client";

import { FormEvent, useCallback, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  X,
  CloudUpload,
  CheckCircle2,
  Loader2,
  PenLine,
  ArrowRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

type UploadMode = "file" | "text";

export default function UploadMaterialPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<UploadMode>("file");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [tags, setTags] = useState("");
  const [rawText, setRawText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" }>({
    message: "",
    type: "success",
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setMode("file");
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setToast({ message: "", type: "success" });

    try {
      let response: Response;
      if (mode === "file" && file) {
        const form = new FormData();
        form.append("file", file);
        form.append("title", title);
        form.append("description", description);
        form.append("subject", subject);
        form.append("education_level", educationLevel);
        form.append("tags", tags);
        response = await fetch(`${API_BASE}/materials/upload`, {
          method: "POST",
          body: form,
        });
      } else {
        response = await fetch(`${API_BASE}/materials`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description,
            subject,
            education_level: educationLevel,
            tags: tags
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
            raw_text: rawText,
            source_type: "manual_text",
          }),
        });
      }

      if (!response.ok) throw new Error(await response.text());

      const data = await response.json();
      setToast({ message: "Tạo học liệu thành công! Đang chuyển hướng...", type: "success" });
      setTimeout(() => router.push(`/materials/${data.id}`), 800);
    } catch (error) {
      setToast({ message: `Lỗi: ${String(error)}`, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
          Tải lên học liệu
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Upload file hoặc nhập nội dung trực tiếp để bắt đầu tạo nội dung AI
        </p>
      </div>

      {/* Mode Switcher */}
      <div className="flex gap-2 p-1.5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-light)]">
        <button
          onClick={() => setMode("file")}
          className={`
            flex-1 flex items-center justify-center gap-2 py-3 rounded-xl
            text-sm font-semibold transition-all duration-200 cursor-pointer border-0
            ${mode === "file"
              ? "bg-[var(--bg-elevated)] text-brand-600 shadow-[var(--shadow-sm)]"
              : "bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }
          `}
        >
          <CloudUpload className="w-5 h-5" />
          Tải file lên
        </button>
        <button
          onClick={() => setMode("text")}
          className={`
            flex-1 flex items-center justify-center gap-2 py-3 rounded-xl
            text-sm font-semibold transition-all duration-200 cursor-pointer border-0
            ${mode === "text"
              ? "bg-[var(--bg-elevated)] text-brand-600 shadow-[var(--shadow-sm)]"
              : "bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }
          `}
        >
          <PenLine className="w-5 h-5" />
          Nhập văn bản
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* File Upload Zone */}
        <AnimatePresence mode="wait">
          {mode === "file" && (
            <motion.div
              key="file"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative flex flex-col items-center justify-center
                  p-10 rounded-2xl border-2 border-dashed cursor-pointer
                  transition-all duration-300
                  ${dragOver
                    ? "border-brand-400 bg-brand-50 scale-[1.02]"
                    : file
                      ? "border-emerald-400 bg-emerald-50"
                      : "border-[var(--border-default)] bg-[var(--bg-secondary)] hover:border-brand-300 hover:bg-brand-50/50"
                  }
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                {file ? (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
                      <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-[var(--text-primary)]">{file.name}</p>
                      <p className="text-xs text-[var(--text-tertiary)] mt-1">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      className="
                        flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                        text-xs font-medium text-rose-600 bg-rose-50
                        hover:bg-rose-100 transition-colors cursor-pointer border-0
                      "
                    >
                      <X className="w-3 h-3" />
                      Xóa file
                    </button>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <motion.div
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      className="w-14 h-14 rounded-2xl bg-brand-100 flex items-center justify-center"
                    >
                      <CloudUpload className="w-7 h-7 text-brand-600" />
                    </motion.div>
                    <div className="text-center">
                      <p className="font-semibold text-[var(--text-primary)]">
                        Kéo thả file vào đây
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)] mt-1">
                        hoặc nhấn để chọn file • PDF, DOCX, TXT, MD
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {mode === "text" && (
            <motion.div
              key="text"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Card>
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--text-primary)] mb-2 block">
                    Nội dung văn bản
                  </span>
                  <textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    rows={10}
                    required={mode === "text"}
                    placeholder="Dán hoặc nhập nội dung học liệu tại đây..."
                    className="
                      w-full px-4 py-3 rounded-xl resize-y
                      bg-[var(--bg-secondary)] border border-[var(--border-light)]
                      text-sm text-[var(--text-primary)]
                      placeholder:text-[var(--text-tertiary)]
                      focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100
                      transition-all duration-200
                      min-h-[200px]
                    "
                  />
                </label>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Metadata */}
        <Card>
          <h3 className="text-base font-semibold text-[var(--text-primary)] mb-4">
            Thông tin học liệu
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">
                Tiêu đề *
              </span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="VD: Bài giảng Sinh học lớp 10"
                className="
                  w-full h-10 px-4 rounded-xl
                  bg-[var(--bg-secondary)] border border-[var(--border-light)]
                  text-sm text-[var(--text-primary)]
                  placeholder:text-[var(--text-tertiary)]
                  focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100
                  transition-all duration-200
                "
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">
                Môn học
              </span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="VD: Sinh học"
                className="
                  w-full h-10 px-4 rounded-xl
                  bg-[var(--bg-secondary)] border border-[var(--border-light)]
                  text-sm text-[var(--text-primary)]
                  placeholder:text-[var(--text-tertiary)]
                  focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100
                  transition-all duration-200
                "
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">
                Cấp học
              </span>
              <input
                value={educationLevel}
                onChange={(e) => setEducationLevel(e.target.value)}
                placeholder="VD: THPT, Đại học"
                className="
                  w-full h-10 px-4 rounded-xl
                  bg-[var(--bg-secondary)] border border-[var(--border-light)]
                  text-sm text-[var(--text-primary)]
                  placeholder:text-[var(--text-tertiary)]
                  focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100
                  transition-all duration-200
                "
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">
                Tags (phân cách bằng dấu phẩy)
              </span>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="VD: biology, dna, genetics"
                className="
                  w-full h-10 px-4 rounded-xl
                  bg-[var(--bg-secondary)] border border-[var(--border-light)]
                  text-sm text-[var(--text-primary)]
                  placeholder:text-[var(--text-tertiary)]
                  focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100
                  transition-all duration-200
                "
              />
            </label>
          </div>
          <label className="block mt-4">
            <span className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">
              Mô tả
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Mô tả ngắn gọn về nội dung tài liệu..."
              className="
                w-full px-4 py-3 rounded-xl resize-y
                bg-[var(--bg-secondary)] border border-[var(--border-light)]
                text-sm text-[var(--text-primary)]
                placeholder:text-[var(--text-tertiary)]
                focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100
                transition-all duration-200
              "
            />
          </label>
        </Card>

        {/* Submit */}
        <div className="flex justify-end">
          <Button
            type="submit"
            size="lg"
            loading={loading}
            icon={loading ? undefined : <ArrowRight className="w-5 h-5" />}
          >
            {loading ? "Đang tạo..." : "Tạo học liệu"}
          </Button>
        </div>
      </form>

      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, message: "" })}
      />
    </motion.div>
  );
}
