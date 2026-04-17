"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Tabs } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { useAuth } from "@/components/auth-provider";
import {
  Upload, Link as LinkIcon, FileText, Loader2, Link2,
  FileImage, Download, TableProperties, ChevronDown, ChevronUp, Eye, Code, X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

const API_BASE = typeof window !== "undefined"
  ? "/api"
  : ((process.env.BACKEND_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api").replace(/\/+$/, ""));

async function fetchWithAuth(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    credentials: "include",
  });

  if (response.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth-required"));
  }

  return response;
}

interface ExtractionSummary {
  pdf_filename: string;
  extracted_at: string;
  text_files: number;
  tables_count: number;
  images_count: number;
  images: string[];
  equations_count?: number;
}

interface TableData {
  headers: string[];
  rows: Record<string, string>[];
}

function normalizeEquationForKatex(rawEquation: string): string {
  let equation = rawEquation.trim();

  // Some extraction outputs use \| between aligned lines; convert it to LaTeX line break.
  equation = equation.replace(/\\\|/g, "\\\\");

  const hasAlignment = equation.includes("&") || equation.includes("\\\\");
  const hasAlignedEnvironment = /\\begin\{(aligned|align|array)\}/.test(equation);

  if (hasAlignment && !hasAlignedEnvironment) {
    equation = `\\begin{aligned} ${equation} \\end{aligned}`;
  }

  return equation;
}

function prettifyExtractedMarkdown(markdown: string): string {
  const compacted = markdown
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^[ \t]+$/gm, "")
    .trim();

  const normalizeDelimitedMath = (input: string): string => {
    const normalize = (equation: string) => normalizeEquationForKatex(equation);

    // Normalize display math blocks to reduce KaTeX parse errors from extracted formulas.
    let output = input.replace(/\$\$([\s\S]*?)\$\$/g, (_full, eq) => `$$\n${normalize(eq)}\n$$`);
    output = output.replace(/\\\[([\s\S]*?)\\\]/g, (_full, eq) => `\\[${normalize(eq)}\\]`);
    return output;
  };

  return normalizeDelimitedMath(compacted);
}

// ── inline table viewer ──────────────────────────────────────────────
function TableViewer({ extractId, filename, index }: { extractId: string; filename: string; index: number }) {
  const [data, setData] = useState<TableData | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (data) { setOpen(!open); return; }
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/converter/extracted/${extractId}/tables/${filename}/data`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
      setOpen(true);
    }
  };

  return (
    <div className="border border-[var(--border-light)] rounded-2xl overflow-hidden shadow-sm">
      <button
        onClick={load}
        className="w-full flex items-center justify-between p-4 bg-[var(--bg-secondary)] hover:bg-[var(--bg-elevated)] transition-colors"
      >
        <span className="flex items-center gap-2 font-medium text-sm text-[var(--text-primary)]">
          <TableProperties className="w-4 h-4 text-emerald-500" />
          Bảng {index + 1}
        </span>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-brand-500" />}
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      <AnimatePresence>
        {open && data && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-auto max-h-[400px]"
          >
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[var(--bg-elevated)] sticky top-0">
                  {data.headers.map((h) => (
                    <th key={h} className="border border-[var(--border-light)] px-3 py-2 text-left font-semibold text-[var(--text-primary)] whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? "bg-[var(--bg-elevated)]" : "bg-[var(--bg-secondary)]"}>
                    {data.headers.map((h) => (
                      <td key={h} className="border border-[var(--border-light)] px-3 py-1.5 text-[var(--text-secondary)]">
                        {row[h] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── image viewer (inline, no new tab) ───────────────────────────────
function ImageViewer({ src, alt }: { src: string; alt: string }) {
  const [enlarged, setEnlarged] = useState(false);

  useEffect(() => {
    if (!enlarged) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEnlarged(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enlarged]);

  return (
    <>
      <div
        onClick={() => setEnlarged(true)}
        className="border border-[var(--border-light)] rounded-xl overflow-hidden cursor-zoom-in bg-[var(--bg-secondary)] hover:border-brand-300 transition-colors"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="w-full h-[130px] object-contain" />
        <p className="text-center text-[10px] text-[var(--text-tertiary)] py-1">{alt}</p>
      </div>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {enlarged && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEnlarged(false)}
                className="fixed inset-0 z-[120] bg-black/75 flex items-center justify-center p-4"
              >
                <button
                  type="button"
                  onClick={() => setEnlarged(false)}
                  aria-label="Đóng ảnh phóng to"
                  className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 bg-black/40 text-white hover:bg-black/60"
                >
                  <X className="h-5 w-5" />
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={alt}
                  className="max-w-full max-h-full rounded-xl shadow-2xl"
                  onClick={(event) => event.stopPropagation()}
                />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

// ── copy button ─────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      title="Copy Markdown"
      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all duration-200 ${
        copied
          ? "bg-emerald-50 text-emerald-600 border-emerald-200"
          : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-light)] hover:bg-[var(--bg-elevated)] hover:text-brand-600 hover:border-brand-200"
      }`}
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Đã copy!
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

// ── main component ───────────────────────────────────────────────────
export function PdfConverter() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("file-to-pdf");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractId, setExtractId] = useState<string | null>(null);
  const [summary, setSummary] = useState<ExtractionSummary | null>(null);
  const [extractedText, setExtractedText] = useState<string>("");
  const [equations, setEquations] = useState<string[]>([]);
  const [textView, setTextView] = useState<"rendered" | "raw">("rendered");
  const [notice, setNotice] = useState("");

  const renderedMarkdown = useMemo(() => prettifyExtractedMarkdown(extractedText), [extractedText]);

  const notifyAuthRequired = () => {
    window.dispatchEvent(new CustomEvent("auth-required"));
    setNotice("Vui lòng đăng nhập trước khi thực hiện thao tác này.");
  };

  const ensureAuthenticated = () => {
    if (user) {
      return true;
    }
    notifyAuthRequired();
    return false;
  };

  const handleUploadAreaMouseDown = (event: React.MouseEvent<HTMLElement>) => {
    if (user) {
      return;
    }
    event.preventDefault();
    notifyAuthRequired();
  };

  const handleUploadAreaClick = (event: React.MouseEvent<HTMLElement>) => {
    if (user) {
      return;
    }
    event.preventDefault();
    notifyAuthRequired();
  };

  const handleDownload = async (blob: Blob, filename: string) => {
    const u = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(u);
  };

  const handleFileConvert = async (e: React.FormEvent) => {
    e.preventDefault(); if (!file) return;
    if (!ensureAuthenticated()) return;
    setLoading(true); setError(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetchWithAuth(`${API_BASE}/converter/convert-file`, { method: "POST", body: fd });
      if (res.status === 401) {
        notifyAuthRequired();
        return;
      }
      if (!res.ok) throw new Error(await res.text() || "Lỗi chuyển đổi");
      const cd = res.headers.get("Content-Disposition");
      let name = "converted.pdf";
      if (cd) { const m = cd.match(/filename="(.+)"/); if (m) name = m[1]; }
      handleDownload(await res.blob(), name);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleUrlConvert = async (e: React.FormEvent) => {
    e.preventDefault(); if (!url) return;
    if (!ensureAuthenticated()) return;
    setLoading(true); setError(null);
    try {
      const fd = new FormData(); fd.append("url", url);
      const res = await fetchWithAuth(`${API_BASE}/converter/convert-url`, { method: "POST", body: fd });
      if (res.status === 401) {
        notifyAuthRequired();
        return;
      }
      if (!res.ok) throw new Error(await res.text() || "Lỗi chuyển đổi");
      const cd = res.headers.get("Content-Disposition");
      let name = "webpage.pdf";
      if (cd) { const m = cd.match(/filename="(.+)"/); if (m) name = m[1]; }
      handleDownload(await res.blob(), name);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleExtractPdf = async (e: React.FormEvent) => {
    e.preventDefault(); if (!pdfFile) return;
    if (!ensureAuthenticated()) return;
    setLoading(true); setError(null);
    setExtractId(null); setSummary(null); setExtractedText(""); setEquations([]);

    try {
      const fd = new FormData(); fd.append("file", pdfFile);
      const res = await fetchWithAuth(`${API_BASE}/converter/extract-pdf`, { method: "POST", body: fd });
      if (res.status === 401) {
        notifyAuthRequired();
        return;
      }
      if (!res.ok) throw new Error(await res.text() || "Lỗi trích xuất");
      const data = await res.json();
      setExtractId(data.extract_id);
      setSummary(data.summary);

      const tr = await fetchWithAuth(`${API_BASE}/converter/extracted/${data.extract_id}/text`);
      if (tr.status === 401) {
        notifyAuthRequired();
        return;
      }
      if (tr.ok) setExtractedText((await tr.json()).content ?? "");

      const eqRes = await fetchWithAuth(`${API_BASE}/converter/extracted/${data.extract_id}/equations`);
      if (eqRes.status === 401) {
        notifyAuthRequired();
        return;
      }
      if (eqRes.ok) {
        const equationPayload = await eqRes.json();
        setEquations(Array.isArray(equationPayload?.equations) ? equationPayload.equations : []);
      }
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="w-full space-y-6">
      <Toast message={notice} type="info" onClose={() => setNotice("")} />
      <Tabs
        tabs={[
          { id: "file-to-pdf", label: "Office/Ảnh → PDF", icon: <FileImage className="w-4 h-4" /> },
          { id: "web-to-pdf",  label: "Web → PDF",        icon: <LinkIcon  className="w-4 h-4" /> },
          { id: "extract-pdf", label: "Trích xuất PDF",   icon: <FileText  className="w-4 h-4" /> },
        ]}
        defaultTab={activeTab}
        onChange={setActiveTab}
      >
        {(active) => (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="pt-4">

            {/* ── File → PDF ── */}
            {active === "file-to-pdf" && (
              <Card className="p-8 border-[var(--border-light)] bg-[var(--glass-bg)] backdrop-blur-3xl shadow-lg">
                <form onSubmit={handleFileConvert} className="space-y-6">
                  <label
                    onMouseDown={handleUploadAreaMouseDown}
                    onClick={handleUploadAreaClick}
                    className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-[var(--border-medium)] rounded-2xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer relative"
                  >
                    <input type="file" className={`absolute inset-0 opacity-0 cursor-pointer ${!user ? "pointer-events-none" : ""}`}
                      onClick={(e) => {
                        if (!ensureAuthenticated()) {
                          e.preventDefault();
                          e.stopPropagation();
                        }
                      }}
                      onChange={(e) => {
                        if (!ensureAuthenticated()) {
                          e.currentTarget.value = "";
                          return;
                        }
                        setFile(e.target.files?.[0] || null);
                      }}
                      accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.bmp" />
                    <div className="p-4 bg-[var(--bg-elevated)] rounded-full shadow-sm mb-4">
                      <Upload className="w-8 h-8 text-brand-500" />
                    </div>
                    <p className="text-lg font-medium">{file ? file.name : "Tải lên Word, Excel, PPT hoặc Ảnh"}</p>
                    <p className="text-sm text-[var(--text-tertiary)] mt-1">Kéo thả hoặc nhấp để chọn</p>
                  </label>
                  {error && <p className="text-red-500 text-sm">{error}</p>}
                  <div className="flex justify-end">
                    <Button type="submit" disabled={!file || loading}>
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Chuyển sang PDF"}
                    </Button>
                  </div>
                </form>
              </Card>
            )}

            {/* ── Web → PDF ── */}
            {active === "web-to-pdf" && (
              <Card className="p-8 border-[var(--border-light)] bg-[var(--glass-bg)] backdrop-blur-3xl shadow-lg">
                <form onSubmit={handleUrlConvert} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--text-secondary)]">URL Trang Web</label>
                    <div className="relative">
                      <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-tertiary)]" />
                      <input type="url" placeholder="https://example.com" value={url}
                        onChange={(e) => setUrl(e.target.value)} required
                        className="w-full pl-11 pr-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-xl focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all" />
                    </div>
                  </div>
                  {error && <p className="text-red-500 text-sm">{error}</p>}
                  <div className="flex justify-end">
                    <Button type="submit" disabled={!url || loading}>
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Chuyển sang PDF"}
                    </Button>
                  </div>
                </form>
              </Card>
            )}

            {/* ── Extract PDF ── */}
            {active === "extract-pdf" && (
              <div className="space-y-6">
                <Card className="p-8 border-[var(--border-light)] bg-[var(--glass-bg)] backdrop-blur-3xl shadow-lg">
                  <form onSubmit={handleExtractPdf} className="space-y-6">
                    <label
                      onMouseDown={handleUploadAreaMouseDown}
                      onClick={handleUploadAreaClick}
                      className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-[var(--border-medium)] rounded-2xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer relative"
                    >
                      <input type="file" className={`absolute inset-0 opacity-0 cursor-pointer ${!user ? "pointer-events-none" : ""}`}
                          onClick={(e) => {
                            if (!ensureAuthenticated()) {
                              e.preventDefault();
                              e.stopPropagation();
                            }
                          }}
                        onChange={(e) => {
                          if (!ensureAuthenticated()) {
                            e.currentTarget.value = "";
                            return;
                          }
                          setPdfFile(e.target.files?.[0] || null);
                        }} accept=".pdf" />
                      <div className="p-4 bg-[var(--bg-elevated)] rounded-full shadow-sm mb-4">
                        <FileText className="w-8 h-8 text-accent-500" />
                      </div>
                      <p className="text-lg font-medium">{pdfFile ? pdfFile.name : "Tải lên PDF để trích xuất"}</p>
                      <p className="text-sm text-[var(--text-tertiary)] mt-1">Văn bản · Bảng biểu · Hình ảnh</p>
                    </label>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <div className="flex justify-end">
                      <Button type="submit" disabled={!pdfFile || loading}
                        className="bg-accent-600 hover:bg-accent-700 text-white min-w-[150px]">
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                          <span className="flex items-center gap-2"><Download className="w-4 h-4" /> Scan PDF</span>
                        )}
                      </Button>
                    </div>
                  </form>
                </Card>

                {/* Results */}
                {extractId && summary && (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

                    {/* Summary bar */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center p-4 rounded-2xl border border-emerald-200 bg-emerald-50">
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="font-semibold text-emerald-800">Phân tích thành công</span>
                        <span className="text-sm text-emerald-700">
                          · {summary.tables_count} bảng · {summary.images_count} ảnh · {summary.equations_count ?? equations.length} công thức
                        </span>
                      </div>
                      <a href={`${API_BASE}/converter/extracted/${extractId}/download`} download>
                        <Button variant="secondary" size="sm">Tải .zip</Button>
                      </a>
                    </div>

                    {/* Text viewer */}
                    <Card className="border-[var(--border-light)] shadow-sm overflow-hidden">
                      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-light)]">
                        <h3 className="font-bold text-base flex items-center gap-2">
                          <FileText className="w-5 h-5 text-blue-500" /> Văn bản gốc
                        </h3>
                        <div className="flex items-center gap-2">
                          <CopyButton text={extractedText} />
                          <div className="flex gap-1 bg-[var(--bg-secondary)] p-1 rounded-xl">
                            <button onClick={() => setTextView("rendered")}
                              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all ${textView === "rendered" ? "bg-[var(--bg-elevated)] shadow font-semibold text-brand-600" : "text-[var(--text-secondary)]"}`}>
                              <Eye className="w-3.5 h-3.5" /> Rendered
                            </button>
                            <button onClick={() => setTextView("raw")}
                              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all ${textView === "raw" ? "bg-[var(--bg-elevated)] shadow font-semibold text-brand-600" : "text-[var(--text-secondary)]"}`}>
                              <Code className="w-3.5 h-3.5" /> Raw
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="h-[420px] overflow-y-auto p-6">
                        {textView === "rendered" ? (
                          <div className="markdown-rendered text-[var(--text-secondary)]">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm, remarkMath]}
                              rehypePlugins={[[rehypeKatex, { strict: "ignore", throwOnError: false }]]}
                            >
                              {renderedMarkdown}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <pre className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap font-mono leading-relaxed">
                            {extractedText}
                          </pre>
                        )}
                      </div>
                    </Card>

                    {/* Tables */}
                    {summary.tables_count > 0 && (
                      <Card className="p-6 border-[var(--border-light)] shadow-sm space-y-3">
                        <h3 className="font-bold text-base flex items-center gap-2 border-b border-[var(--border-light)] pb-4">
                          <TableProperties className="w-5 h-5 text-emerald-500" /> Bảng biểu ({summary.tables_count})
                        </h3>
                        {Array.from({ length: summary.tables_count }).map((_, i) => (
                          <TableViewer key={i} extractId={extractId} filename={`table_${i + 1}.xlsx`} index={i} />
                        ))}
                      </Card>
                    )}

                    {/* Equations */}
                    {(summary.equations_count ?? equations.length) > 0 && (
                      <Card className="p-6 border-[var(--border-light)] shadow-sm space-y-3">
                        <h3 className="font-bold text-base flex items-center gap-2 border-b border-[var(--border-light)] pb-4">
                          <Code className="w-5 h-5 text-amber-500" /> Công thức ({summary.equations_count ?? equations.length})
                        </h3>
                        <div className="space-y-3">
                          {equations.map((equation, i) => (
                            <div key={i} className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] p-4">
                              <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-2">Equation {i + 1}</div>
                              <div className="equation-render text-[var(--text-secondary)] overflow-x-auto">
                                <ReactMarkdown
                                  remarkPlugins={[remarkMath]}
                                  rehypePlugins={[[rehypeKatex, { strict: "ignore", throwOnError: false }]]}
                                >
                                  {`$$\n${normalizeEquationForKatex(equation)}\n$$`}
                                </ReactMarkdown>
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    )}

                    {/* Images */}
                    {summary.images_count > 0 && summary.images && (
                      <Card className="p-6 border-[var(--border-light)] shadow-sm">
                        <h3 className="font-bold text-base flex items-center gap-2 border-b border-[var(--border-light)] pb-4 mb-4">
                          <FileImage className="w-5 h-5 text-indigo-500" /> Hình ảnh ({summary.images_count})
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                          {summary.images.map((filename, i) => (
                            <ImageViewer
                              key={i}
                              src={`${API_BASE}/converter/extracted/${extractId}/images/${filename}`}
                              alt={`Ảnh ${i + 1}`}
                            />
                          ))}
                        </div>
                      </Card>
                    )}
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </Tabs>
    </div>
  );
}
