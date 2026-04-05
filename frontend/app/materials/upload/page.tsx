"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  CloudUpload,
  PenLine,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";
import { useAuth } from "@/components/auth-provider";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

type UploadMode = "file" | "text";

type GuardrailResult = {
  is_academic: boolean;
  category: string;
  message: string;
};

const EDUCATION_LEVEL_OPTIONS = [
  "Tiểu học",
  "THCS",
  "THPT",
  "Đại học/Cao đẳng",
  "Khác",
] as const;

async function extractApiError(response: Response) {
  const raw = await response.text();

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.detail === "string") return parsed.detail;
    if (parsed?.detail?.message) return parsed.detail.message;
    if (parsed?.message) return parsed.message;
  } catch {
    return raw;
  }

  return raw;
}

export default function UploadMaterialPage() {
  const router = useRouter();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<UploadMode>("file");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [isCustomEducationLevel, setIsCustomEducationLevel] = useState(false);
  const [tags, setTags] = useState("");
  const [rawText, setRawText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [guardrailResult, setGuardrailResult] = useState<GuardrailResult | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" }>({
    message: "",
    type: "success",
  });

  const canCheck = useMemo(() => {
    if (mode === "file") return Boolean(file && title.trim());
    return Boolean(title.trim() && rawText.trim());
  }, [file, mode, rawText, title]);

  const canCreate = Boolean(guardrailResult?.is_academic);

  useEffect(() => {
    setGuardrailResult(null);
  }, [mode, title, description, subject, educationLevel, tags, rawText, file]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!user) {
      window.dispatchEvent(new CustomEvent("auth-required"));
      return;
    }
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setMode("file");
    }
  }, [user]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  function requireAuth(): boolean {
    if (user) {
      return true;
    }
    window.dispatchEvent(new CustomEvent("auth-required"));
    setToast({
      message: "Vui lòng đăng nhập hoặc đăng ký trước khi tải và tạo học liệu.",
      type: "info",
    });
    return false;
  }

  async function assertAuthResponse(response: Response): Promise<void> {
    if (response.status !== 401) {
      return;
    }
    window.dispatchEvent(new CustomEvent("auth-required"));
    throw new Error("Vui lòng đăng nhập trước khi thực hiện chức năng này.");
  }

  async function handleGuardrailCheck() {
    if (!requireAuth()) {
      return;
    }

    if (!canCheck) {
      setToast({
        message:
          mode === "file"
            ? "Hãy chọn file và nhập tiêu đề trước khi kiểm tra."
            : "Hãy nhập tiêu đề và nội dung trước khi kiểm tra.",
        type: "info",
      });
      return;
    }

    setChecking(true);
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
        response = await fetch(`${API_BASE}/materials/guardrail-check-upload`, {
          method: "POST",
          body: form,
          credentials: "include",
        });
      } else {
        response = await fetch(`${API_BASE}/materials/guardrail-check`, {
          method: "POST",
          credentials: "include",
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

      await assertAuthResponse(response);
      if (!response.ok) throw new Error(await extractApiError(response));

      const data: GuardrailResult = await response.json();
      setGuardrailResult(data);
      setToast({
        message: data.is_academic
          ? "Tài liệu đã được xác minh là học thuật. Bạn có thể tạo học liệu."
          : "Tài liệu chưa đạt yêu cầu học thuật. Hãy chỉnh lại nội dung hoặc chọn tài liệu khác.",
        type: data.is_academic ? "success" : "error",
      });
    } catch (error) {
      setGuardrailResult(null);
      setToast({ message: `Lỗi: ${String(error)}`, type: "error" });
    } finally {
      setChecking(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!requireAuth()) {
      return;
    }

    if (!canCreate) {
      setToast({
        message: "Bạn cần kiểm tra và được xác nhận là tài liệu học thuật trước khi tạo học liệu.",
        type: "info",
      });
      return;
    }

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
          credentials: "include",
        });
      } else {
        response = await fetch(`${API_BASE}/materials`, {
          method: "POST",
          credentials: "include",
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

      await assertAuthResponse(response);
      if (!response.ok) throw new Error(await extractApiError(response));

      const data = await response.json();
      setToast({ message: "Tạo học liệu thành công. Đang chuyển hướng...", type: "success" });
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
      className="mx-auto max-w-3xl space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
          Tải lên học liệu
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Tải file hoặc nhập nội dung trực tiếp. Tài liệu phải qua bước kiểm tra học thuật trước khi tạo học liệu.
        </p>
      </div>

      <div className="flex gap-2 rounded-2xl border border-[var(--border-light)] bg-[var(--bg-secondary)] p-1.5">
        <button
          type="button"
          onClick={() => setMode("file")}
          className={`
            flex flex-1 items-center justify-center gap-2 rounded-xl border-0 py-3 text-sm font-semibold transition-all duration-200 cursor-pointer
            ${mode === "file"
              ? "bg-[var(--bg-elevated)] text-brand-600 shadow-[var(--shadow-sm)]"
              : "bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"}
          `}
        >
          <CloudUpload className="h-5 w-5" />
          Tải file lên
        </button>
        <button
          type="button"
          onClick={() => setMode("text")}
          className={`
            flex flex-1 items-center justify-center gap-2 rounded-xl border-0 py-3 text-sm font-semibold transition-all duration-200 cursor-pointer
            ${mode === "text"
              ? "bg-[var(--bg-elevated)] text-brand-600 shadow-[var(--shadow-sm)]"
              : "bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"}
          `}
        >
          <PenLine className="h-5 w-5" />
          Nhập văn bản
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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
                onClick={() => {
                  if (!requireAuth()) {
                    return;
                  }
                  fileInputRef.current?.click();
                }}
                className={`
                  relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 transition-all duration-300
                  ${dragOver
                    ? "scale-[1.02] border-brand-400 bg-brand-50"
                    : file
                      ? "border-emerald-400 bg-emerald-50"
                      : "border-[var(--border-default)] bg-[var(--bg-secondary)] hover:border-brand-300 hover:bg-brand-50/50"}
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  onChange={(e) => {
                    if (!requireAuth()) {
                      e.currentTarget.value = "";
                      return;
                    }
                    setFile(e.target.files?.[0] || null);
                  }}
                  className="hidden"
                />
                {file ? (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
                      <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-[var(--text-primary)]">{file.name}</p>
                      <p className="mt-1 text-xs text-[var(--text-tertiary)]">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                      className="flex cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-100"
                    >
                      <X className="h-3 w-3" />
                      Xóa file
                    </button>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <motion.div
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100"
                    >
                      <CloudUpload className="h-7 w-7 text-brand-600" />
                    </motion.div>
                    <div className="text-center">
                      <p className="font-semibold text-[var(--text-primary)]">Kéo thả file vào đây</p>
                      <p className="mt-1 text-xs text-[var(--text-tertiary)]">Hoặc nhấn để chọn file • PDF, DOCX, TXT, MD</p>
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
                  <span className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">Nội dung văn bản</span>
                  <textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    rows={10}
                    required={mode === "text"}
                    placeholder="Dán hoặc nhập nội dung học liệu tại đây..."
                    className="min-h-[200px] w-full resize-y rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] px-4 py-3 text-sm text-[var(--text-primary)] transition-all duration-200 placeholder:text-[var(--text-tertiary)] focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </label>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <Card>
          <h3 className="mb-4 text-base font-semibold text-[var(--text-primary)]">Thông tin học liệu</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Tiêu đề *</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Ví dụ: Bài giảng Sinh học lớp 10"
                className="h-10 w-full rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] px-4 text-sm text-[var(--text-primary)] transition-all duration-200 placeholder:text-[var(--text-tertiary)] focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Môn học</span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ví dụ: Sinh học"
                className="h-10 w-full rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] px-4 text-sm text-[var(--text-primary)] transition-all duration-200 placeholder:text-[var(--text-tertiary)] focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-[var(--text-secondary)]">Cấp học</span>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {EDUCATION_LEVEL_OPTIONS.map((option) => {
                    const isSelected =
                      option === "Khác"
                        ? isCustomEducationLevel
                        : !isCustomEducationLevel && educationLevel === option;

                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          if (option === "Khác") {
                            setIsCustomEducationLevel(true);
                            setEducationLevel("");
                            return;
                          }
                          setIsCustomEducationLevel(false);
                          setEducationLevel(option);
                        }}
                        className={`rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-200 ${
                          isSelected
                            ? "border-brand-500 bg-brand-500/10 text-brand-600 shadow-sm"
                            : "border-[var(--border-light)] bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:border-brand-300 hover:text-[var(--text-primary)]"
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>

                {isCustomEducationLevel ? (
                  <input
                    value={educationLevel}
                    onChange={(e) => setEducationLevel(e.target.value)}
                    placeholder="Nhập cấp học khác"
                    className="h-10 w-full rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] px-4 text-sm text-[var(--text-primary)] transition-all duration-200 placeholder:text-[var(--text-tertiary)] focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                ) : null}
              </div>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Từ khóa</span>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Ví dụ: biology, dna, genetics"
                className="h-10 w-full rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] px-4 text-sm text-[var(--text-primary)] transition-all duration-200 placeholder:text-[var(--text-tertiary)] focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </label>
          </div>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Mô tả</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Mô tả ngắn gọn về nội dung tài liệu..."
              className="w-full resize-y rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] px-4 py-3 text-sm text-[var(--text-primary)] transition-all duration-200 placeholder:text-[var(--text-tertiary)] focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </label>
        </Card>

        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Kiểm tra học thuật</h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Hệ thống sẽ kiểm tra xem tài liệu này có phải là tài liệu học thuật phù hợp hay không.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleGuardrailCheck}
              loading={checking}
              disabled={!canCheck}
              icon={checking ? undefined : <ShieldCheck className="h-4 w-4" />}
            >
              {checking ? "Đang kiểm tra..." : "Kiểm tra tài liệu"}
            </Button>
          </div>

          <div
            className={`
              mt-4 rounded-2xl border px-4 py-3
              ${guardrailResult
                ? guardrailResult.is_academic
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-rose-200 bg-rose-50"
                : "border-[var(--border-light)] bg-[var(--bg-secondary)]"}
            `}
          >
            {guardrailResult ? (
              <div className="flex items-start gap-3">
                <div className={guardrailResult.is_academic ? "text-emerald-600" : "text-rose-600"}>
                  {guardrailResult.is_academic ? <ShieldCheck className="mt-0.5 h-5 w-5" /> : <ShieldAlert className="mt-0.5 h-5 w-5" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {guardrailResult.is_academic ? "Đây là tài liệu học thuật" : "Tài liệu này chưa đạt chuẩn học thuật"}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{guardrailResult.message}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <CircleHelp className="mt-0.5 h-5 w-5 text-[var(--text-tertiary)]" />
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Chưa có kết quả kiểm tra</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    Bấm nút kiểm tra để biết tài liệu có phải là tài liệu học thuật hay không.
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>

        <div className="flex justify-end">
          <Button
            type="submit"
            size="lg"
            loading={loading}
            disabled={!canCreate}
            icon={loading ? undefined : <ArrowRight className="h-5 w-5" />}
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
