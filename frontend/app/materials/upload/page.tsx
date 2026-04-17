"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AudioLines,
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  CloudUpload,
  Image as ImageIcon,
  Mic,
  PenLine,
  ShieldAlert,
  ShieldCheck,
  Square,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";
import { useAuth } from "@/components/auth-provider";
import type { SttModel } from "@/types";

const API_BASE = typeof window !== "undefined"
  ? "/api"
  : ((process.env.BACKEND_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api").replace(/\/+$/, ""));

type UploadMode = "file" | "image" | "audio" | "text";

type GuardrailResult = {
  is_academic: boolean;
  category: string;
  message: string;
};

type OCRWord = {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

type OCRPreviewResult = {
  text: string;
  words: OCRWord[];
};

const EDUCATION_LEVEL_OPTIONS = [
  "Tiểu học",
  "THCS",
  "THPT",
  "Đại học/Cao đẳng",
  "Khác",
] as const;

const STT_MODEL_OPTIONS: Array<{ value: SttModel; label: string }> = [
  { value: "local-base", label: "Local Whisper Base" },
  { value: "local-small", label: "Local Whisper Small" },
  { value: "whisper-large-v3", label: "Groq Whisper Large v3" },
  { value: "whisper-large-v3-turbo", label: "Groq Whisper Large v3 Turbo" },
];

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
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const ocrCanvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [mode, setMode] = useState<UploadMode>("file");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [isCustomEducationLevel, setIsCustomEducationLevel] = useState(false);
  const [tags, setTags] = useState("");
  const [rawText, setRawText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sttModel, setSttModel] = useState<SttModel>("local-base");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [guardrailResult, setGuardrailResult] = useState<GuardrailResult | null>(null);
  const [ocrPreview, setOcrPreview] = useState<OCRPreviewResult | null>(null);
  const [transcriptPreview, setTranscriptPreview] = useState("");
  const [audioPreviewUrl, setAudioPreviewUrl] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" }>({
    message: "",
    type: "success",
  });

  const canCheck = useMemo(() => {
    if (mode === "file") return Boolean(file && title.trim());
    if (mode === "image") return Boolean(imageFile && title.trim());
    if (mode === "audio") return Boolean(audioFile && title.trim());
    return Boolean(title.trim() && rawText.trim());
  }, [audioFile, file, imageFile, mode, rawText, title]);

  const canCreate = Boolean(guardrailResult?.is_academic);

  useEffect(() => {
    setGuardrailResult(null);
  }, [mode, title, description, subject, educationLevel, tags, rawText, file, imageFile, audioFile, sttModel]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl("");
      setOcrPreview(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    setOcrPreview(null);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  useEffect(() => {
    if (!imagePreviewUrl || !ocrPreview || !ocrCanvasRef.current) {
      return;
    }

    const canvas = ocrCanvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const image = new window.Image();
    image.onload = () => {
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      context.lineWidth = 2;
      context.strokeStyle = "#ef4444";
      context.fillStyle = "#ef4444";
      context.font = "16px sans-serif";

      for (const word of ocrPreview.words) {
        context.strokeRect(word.left, word.top, word.width, word.height);
        if (word.text) {
          const textY = Math.max(14, word.top - 4);
          context.fillText(word.text, word.left, textY);
        }
      }
    };
    image.src = imagePreviewUrl;
  }, [imagePreviewUrl, ocrPreview]);

  useEffect(() => {
    setTranscriptPreview("");
  }, [audioFile, sttModel]);

  useEffect(() => {
    if (!audioFile) {
      setAudioPreviewUrl("");
      return;
    }

    const url = URL.createObjectURL(audioFile);
    setAudioPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioFile]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      stopRecordingStream();
    };
  }, []);

  useEffect(() => {
    if (mode !== "audio" && isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      } else {
        stopRecordingStream();
        setIsRecording(false);
      }
    }
  }, [isRecording, mode]);

  function stopRecordingStream() {
    if (!recordingStreamRef.current) {
      return;
    }
    recordingStreamRef.current.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
  }

  function getRecordingMimeType() {
    if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
      return undefined;
    }

    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ];

    return candidates.find((type) => MediaRecorder.isTypeSupported(type));
  }

  function getAudioExtensionFromMimeType(mimeType: string) {
    if (mimeType.includes("mp4") || mimeType.includes("aac")) {
      return "m4a";
    }
    if (mimeType.includes("ogg") || mimeType.includes("opus")) {
      return "ogg";
    }
    return "webm";
  }

  async function startAudioRecording() {
    if (!requireAuth()) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setToast({ message: "Trình duyệt không hỗ trợ ghi âm trực tiếp.", type: "error" });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = getRecordingMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const type = recorder.mimeType || audioChunksRef.current[0]?.type || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type });
        stopRecordingStream();

        if (!blob.size) {
          setToast({ message: "Không thu được âm thanh. Vui lòng thử lại.", type: "error" });
          setIsRecording(false);
          mediaRecorderRef.current = null;
          return;
        }

        const extension = getAudioExtensionFromMimeType(type);
        const recordedFile = new File([blob], `voice-recording-${Date.now()}.${extension}`, {
          type,
          lastModified: Date.now(),
        });

        setAudioFile(recordedFile);
        setToast({ message: "Đã ghi âm xong. Bạn có thể xem transcript hoặc tạo học liệu ngay.", type: "success" });
        setIsRecording(false);
        mediaRecorderRef.current = null;
      };

      recorder.start();
      setToast({ message: "Đang ghi âm... Nhấn Dừng ghi âm để hoàn tất.", type: "info" });
      setIsRecording(true);
    } catch {
      stopRecordingStream();
      setIsRecording(false);
      setToast({ message: "Không thể truy cập microphone. Hãy kiểm tra quyền truy cập micro.", type: "error" });
    }
  }

  function stopAudioRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      return;
    }
    stopRecordingStream();
    setIsRecording(false);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!user) {
      window.dispatchEvent(new CustomEvent("auth-required"));
      return;
    }
    if (mode === "audio" && isRecording) {
      setToast({ message: "Hãy dừng ghi âm trước khi thay đổi tệp âm thanh.", type: "info" });
      return;
    }
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (mode === "image") {
        setImageFile(droppedFile);
        return;
      }
      if (mode === "audio") {
        setAudioFile(droppedFile);
        return;
      }
      setFile(droppedFile);
    }
  }, [isRecording, mode, user]);

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
            : mode === "image"
              ? "Hãy chọn ảnh và nhập tiêu đề trước khi kiểm tra."
              : mode === "audio"
                ? "Hãy chọn file âm thanh và nhập tiêu đề trước khi kiểm tra."
            : "Hãy nhập tiêu đề và nội dung trước khi kiểm tra.",
        type: "info",
      });
      return;
    }

    setChecking(true);
    setToast({ message: "", type: "success" });

    try {
      let response: Response;

      if (mode !== "text") {
        const uploadFile = mode === "image" ? imageFile : mode === "audio" ? audioFile : file;
        if (!uploadFile) {
          throw new Error("Không tìm thấy tệp để kiểm tra.");
        }
        const form = new FormData();
        form.append("file", uploadFile);
        form.append("title", title);
        form.append("description", description);
        form.append("subject", subject);
        form.append("education_level", educationLevel);
        form.append("tags", tags);
        if (mode === "audio") {
          form.append("stt_model", sttModel);
        }
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

  async function handleOCRPreview() {
    if (!requireAuth()) {
      return;
    }

    if (!imageFile) {
      setToast({ message: "Hãy chọn ảnh trước khi OCR.", type: "info" });
      return;
    }

    setOcrLoading(true);
    try {
      const form = new FormData();
      form.append("file", imageFile);
      const response = await fetch(`${API_BASE}/materials/ocr-preview-upload`, {
        method: "POST",
        body: form,
        credentials: "include",
      });

      await assertAuthResponse(response);
      if (!response.ok) {
        throw new Error(await extractApiError(response));
      }

      const data: OCRPreviewResult = await response.json();
      setOcrPreview(data);
      setToast({ message: "OCR hoàn tất. Bạn có thể đối chiếu ảnh gốc và kết quả OCR.", type: "success" });
    } catch (error) {
      setOcrPreview(null);
      setToast({ message: `Lỗi OCR: ${String(error)}`, type: "error" });
    } finally {
      setOcrLoading(false);
    }
  }

  async function handleTranscriptPreview() {
    if (!requireAuth()) {
      return;
    }

    if (!audioFile) {
      setToast({ message: "Hãy chọn file âm thanh trước khi xem transcript.", type: "info" });
      return;
    }

    setTranscriptLoading(true);
    try {
      const form = new FormData();
      form.append("file", audioFile);
      form.append("stt_model", sttModel);

      const response = await fetch(`${API_BASE}/chat/transcribe`, {
        method: "POST",
        body: form,
        credentials: "include",
      });

      await assertAuthResponse(response);
      if (!response.ok) {
        throw new Error(await extractApiError(response));
      }

      const data = (await response.json()) as { text: string };
      setTranscriptPreview(data.text || "");
      setToast({ message: "Đã tạo transcript thành công.", type: "success" });
    } catch (error) {
      setTranscriptPreview("");
      setToast({ message: `Lỗi transcript: ${String(error)}`, type: "error" });
    } finally {
      setTranscriptLoading(false);
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
      if (mode !== "text") {
        const uploadFile = mode === "image" ? imageFile : mode === "audio" ? audioFile : file;
        if (!uploadFile) {
          throw new Error("Không tìm thấy tệp để tải lên.");
        }
        const form = new FormData();
        form.append("file", uploadFile);
        form.append("title", title);
        form.append("description", description);
        form.append("subject", subject);
        form.append("education_level", educationLevel);
        form.append("tags", tags);
        if (mode === "audio") {
          form.append("stt_model", sttModel);
        }
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
      className="mx-auto max-w-4xl space-y-8 pb-12"
    >
      <div className="flex flex-col items-center text-center space-y-3">
        <div className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-600 ring-1 ring-inset ring-brand-500/20 dark:bg-brand-950/30 dark:text-brand-300 dark:ring-brand-500/30">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500"></span>
          </span>
          <span className="text-xs">AI-Powered Extraction</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
          Tạo mới <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-indigo-500 dark:from-brand-400 dark:to-indigo-400">Học liệu</span>
        </h1>
        <p className="max-w-xl text-base text-[var(--text-secondary)]">
          Tải file, xử lý ảnh bằng OCR hoặc nhập văn bản trực tiếp. Hệ thống AI sẽ tự động phân tích và chuyển đổi thành học liệu thông minh.
        </p>
      </div>

      <div className="mx-auto w-full max-w-2xl rounded-2xl bg-[var(--bg-secondary)] p-1.5 shadow-sm ring-1 ring-inset ring-[var(--border-light)]">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {(["file", "image", "audio", "text"] as const).map((m) => {
          const isActive = mode === m;
          const Icon = m === "file" ? CloudUpload : m === "image" ? ImageIcon : m === "audio" ? AudioLines : PenLine;
          const label =
            m === "file"
              ? "Tải file"
              : m === "image"
                ? "Ảnh OCR"
                : m === "audio"
                  ? "Âm thanh"
                  : "Văn bản";
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`relative z-10 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-300 cursor-pointer ${
                isActive 
                  ? "text-[var(--text-primary)] font-bold tracking-tight" 
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="active-mode-bg"
                  className="absolute inset-0 z-[-1] rounded-xl bg-[var(--bg-elevated)] shadow-sm ring-1 ring-[var(--border-light)]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">{label}</span>
            </button>
          );
        })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
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

          {mode === "audio" && (
            <motion.div
              key="audio"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => {
                  if (isRecording) {
                    return;
                  }
                  if (!requireAuth()) {
                    return;
                  }
                  audioInputRef.current?.click();
                }}
                className={`
                  relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 transition-all duration-300
                  ${dragOver
                    ? "scale-[1.02] border-brand-400 bg-brand-50"
                    : audioFile
                      ? "border-emerald-400 bg-emerald-50"
                      : "border-[var(--border-default)] bg-[var(--bg-secondary)] hover:border-brand-300 hover:bg-brand-50/50"}
                `}
              >
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*,.mp4,.m4a,.wav,.mp3,.ogg,.webm,.opus,.aac,.flac,.mpga,.mpeg"
                  onChange={(e) => {
                    if (!requireAuth()) {
                      e.currentTarget.value = "";
                      return;
                    }
                    setAudioFile(e.target.files?.[0] || null);
                  }}
                  className="hidden"
                />
                {audioFile ? (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
                      <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-[var(--text-primary)]">{audioFile.name}</p>
                      <p className="mt-1 text-xs text-[var(--text-tertiary)]">{(audioFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isRecording) {
                          return;
                        }
                        setAudioFile(null);
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
                      <AudioLines className="h-7 w-7 text-brand-600" />
                    </motion.div>
                    <div className="text-center">
                      <p className="font-semibold text-[var(--text-primary)]">Kéo thả file âm thanh/video vào đây</p>
                      <p className="mt-1 text-xs text-[var(--text-tertiary)]">Hỗ trợ audio và MP4 chỉ có tiếng</p>
                    </div>
                  </div>
                )}
              </div>

              <Card>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">Ghi âm trực tiếp</h3>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">Bạn có thể thu âm bằng micro thay vì tải file lên.</p>
                  </div>
                  <Button
                    type="button"
                    variant={isRecording ? "danger" : "secondary"}
                    onClick={isRecording ? stopAudioRecording : startAudioRecording}
                    icon={isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    disabled={transcriptLoading || loading || checking}
                  >
                    {isRecording ? "Dừng ghi âm" : "Ghi âm trực tiếp"}
                  </Button>
                </div>

                {audioPreviewUrl ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Nghe lại âm thanh đã chọn</p>
                    <audio
                      controls
                      src={audioPreviewUrl}
                      className="w-full"
                    />
                  </div>
                ) : null}
              </Card>

              <Card>
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Model Whisper</span>
                    <select
                      value={sttModel}
                      onChange={(e) => setSttModel(e.target.value as SttModel)}
                      className="h-10 w-full rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] px-4 text-sm text-[var(--text-primary)] transition-all duration-200 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    >
                      {STT_MODEL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-[var(--text-primary)]">Xem transcript</h3>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">Xem trước nội dung chuyển giọng nói thành văn bản trước khi tạo học liệu.</p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleTranscriptPreview}
                      loading={transcriptLoading}
                      disabled={!audioFile}
                    >
                      {transcriptLoading ? "Đang tạo transcript..." : "Xem transcript"}
                    </Button>
                  </div>

                  {transcriptPreview ? (
                    <div>
                      <p className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Transcript</p>
                      <textarea
                        value={transcriptPreview}
                        readOnly
                        rows={10}
                        className="w-full resize-y rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] px-4 py-3 text-sm text-[var(--text-primary)]"
                      />
                    </div>
                  ) : null}
                </div>
              </Card>
            </motion.div>
          )}

          {mode === "image" && (
            <motion.div
              key="image"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => {
                  if (!requireAuth()) {
                    return;
                  }
                  imageInputRef.current?.click();
                }}
                className={`
                  relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 transition-all duration-300
                  ${dragOver
                    ? "scale-[1.02] border-brand-400 bg-brand-50"
                    : imageFile
                      ? "border-emerald-400 bg-emerald-50"
                      : "border-[var(--border-default)] bg-[var(--bg-secondary)] hover:border-brand-300 hover:bg-brand-50/50"}
                `}
              >
                <input
                  ref={imageInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.bmp"
                  onChange={(e) => {
                    if (!requireAuth()) {
                      e.currentTarget.value = "";
                      return;
                    }
                    setImageFile(e.target.files?.[0] || null);
                  }}
                  className="hidden"
                />

                {imageFile ? (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
                      <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-[var(--text-primary)]">{imageFile.name}</p>
                      <p className="mt-1 text-xs text-[var(--text-tertiary)]">{(imageFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImageFile(null);
                      }}
                      className="flex cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-100"
                    >
                      <X className="h-3 w-3" />
                      Xóa ảnh
                    </button>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <motion.div
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100"
                    >
                      <ImageIcon className="h-7 w-7 text-brand-600" />
                    </motion.div>
                    <div className="text-center">
                      <p className="font-semibold text-[var(--text-primary)]">Kéo thả ảnh vào đây</p>
                      <p className="mt-1 text-xs text-[var(--text-tertiary)]">Hoặc nhấn để chọn ảnh • PNG, JPG, WEBP, BMP</p>
                    </div>
                  </div>
                )}
              </div>

              <Card>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">Xem trước OCR</h3>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">OCR ảnh để đối chiếu bản gốc và bản đã nhận diện trước khi tạo học liệu.</p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleOCRPreview}
                    loading={ocrLoading}
                    disabled={!imageFile}
                  >
                    {ocrLoading ? "Đang OCR..." : "OCR ảnh"}
                  </Button>
                </div>

                {imagePreviewUrl && ocrPreview ? (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">Ảnh gốc</p>
                        <img
                          src={imagePreviewUrl}
                          alt="Ảnh gốc tải lên"
                          className="max-h-[420px] w-full rounded-xl border border-[var(--border-light)] object-contain bg-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">Ảnh sau OCR (đánh dấu vùng chữ)</p>
                        <canvas
                          ref={ocrCanvasRef}
                          className="max-h-[420px] w-full rounded-xl border border-[var(--border-light)] bg-white object-contain"
                        />
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Nội dung OCR</p>
                      <textarea
                        value={ocrPreview.text}
                        readOnly
                        rows={8}
                        className="w-full resize-y rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] px-4 py-3 text-sm text-[var(--text-primary)]"
                      />
                    </div>

                  </div>
                ) : null}
              </Card>
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
