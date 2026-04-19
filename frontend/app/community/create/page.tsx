"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Check, BookOpen, Search, ArrowLeft, Loader2, 
  Upload, Image as ImageIcon, X, AlertCircle 
} from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listMaterials, createCommunityThread, apiPreviewUrl, uploadFile } from "@/lib/api";
import { Material } from "@/types";
import { useNotify } from "@/components/use-notify";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";

export default function CreateThreadPage() {
  const router = useRouter();
  const { success, error: notifyError } = useNotify();
  
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [form, setForm] = useState({ title: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  
  // Custom Thumbnail State
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const res = await listMaterials();
        setMaterials(res.items);
      } catch (err) {
        console.error("Failed to fetch materials:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMaterials();
  }, []);

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        return notifyError("Vui lòng chọn file hình ảnh.");
    }

    setUploadingThumb(true);
    try {
      const data = await uploadFile(file);
      setThumbnailUrl(data.file_url);
      success("Đã tải ảnh bìa lên thành công!");
    } catch (err) {
      notifyError("Lỗi khi tải ảnh bìa.");
    } finally {
      setUploadingThumb(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) return notifyError("Vui lòng nhập tiêu đề");
    if (selectedIds.length === 0) return notifyError("Vui lòng chọn ít nhất 1 tài liệu");

    setSubmitting(true);
    try {
      const thread = await createCommunityThread({
        title: form.title,
        description: form.description,
        material_ids: selectedIds,
        thumbnail_url: thumbnailUrl || undefined
      });
      success("Đã tạo chủ đề thảo luận cộng đồng thành công!");
      router.push(`/community/${thread.id}`);
    } catch (err) {
      notifyError("Lỗi khi tạo chủ đề");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = materials.filter(m => m.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-20 px-4">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[var(--text-tertiary)] hover:text-brand-500 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Quay lại cộng đồng
      </button>

      <div className="space-y-2">
        <h1 className="text-4xl font-black text-[var(--text-primary)] tracking-tight">Tạo thảo luận mới</h1>
        <p className="text-[var(--text-secondary)] font-medium">Chia sẻ tài liệu và bắt đầu cuộc hội thoại cùng AI và mọi người.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Form Info */}
        <div className="lg:col-span-2 space-y-8">
            <Card className="p-8 bg-[var(--bg-elevated)] border-2 border-[var(--border-structural)] rounded-[2.5rem] shadow-xl">
                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-600 ml-1">Tiêu đề thảo luận *</label>
                            <input 
                                value={form.title}
                                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                placeholder="VD: Phân tích báo cáo tài chính Q1/2024"
                                className="w-full h-14 px-6 rounded-2xl border-2 border-[var(--border-structural)] bg-[var(--bg-secondary)] text-sm font-bold focus:outline-none focus:border-brand-500 transition-all shadow-inner"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-tertiary)] ml-1">Mô tả chi tiết</label>
                            <textarea 
                                value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="Gợi ý mọi người những gì nên thảo luận về bộ tài liệu này..."
                                className="w-full p-6 rounded-[1.5rem] border-2 border-[var(--border-structural)] bg-[var(--bg-secondary)] text-sm font-medium focus:outline-none focus:border-brand-500 transition-all shadow-inner h-32"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-600">Chọn tài liệu đính kèm ({selectedIds.length})</label>
                            <div className="relative w-48">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                                <input 
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Tìm tài liệu..."
                                    className="w-full h-9 pl-9 pr-4 rounded-xl border border-[var(--border-structural)] bg-[var(--bg-secondary)] text-[10px] font-bold"
                                />
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 max-h-[400px] overflow-y-auto p-2 custom-scrollbar border-2 border-dashed border-[var(--border-structural)] rounded-[2rem] bg-[var(--bg-secondary)]/30">
                            {loading ? (
                                <div className="col-span-2 py-20 flex justify-center"><Loader2 className="animate-spin text-brand-500" /></div>
                            ) : filtered.length === 0 ? (
                                <div className="col-span-2 text-center py-20 text-[var(--text-tertiary)] font-bold text-xs uppercase tracking-widest">Kho học liệu trống</div>
                            ) : (
                                filtered.map(material => {
                                    const isSelected = selectedIds.includes(material.id);
                                    return (
                                        <button
                                            key={material.id}
                                            type="button"
                                            onClick={() => toggleSelect(material.id)}
                                            className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                                                isSelected 
                                                ? "border-brand-500 bg-brand-500/10 shadow-md translate-y-[-2px]" 
                                                : "border-[var(--border-structural)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-secondary)] opacity-60 hover:opacity-100"
                                            }`}
                                        >
                                            <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${isSelected ? "bg-brand-500 text-white" : "bg-[var(--bg-secondary)] text-gray-400"}`}>
                                                <BookOpen className="h-5 w-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] font-black truncate uppercase tracking-tight">{material.title}</p>
                                                <p className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase">{material.source_type}</p>
                                            </div>
                                            {isSelected && <div className="bg-brand-500 rounded-full p-1"><Check className="h-3 w-3 text-white stroke-[4]" /></div>}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end pt-6">
                        <Button 
                            type="submit" 
                            loading={submitting} 
                            disabled={selectedIds.length === 0}
                            className="bg-brand-500 hover:bg-brand-600 text-white px-10 h-14 rounded-2xl shadow-xl shadow-brand-500/20 active:scale-95 text-sm font-black uppercase tracking-widest"
                        >
                            Đăng chủ đề cộng đồng
                        </Button>
                    </div>
                </form>
            </Card>
        </div>

        {/* Right Column: Thumbnail Upload */}
        <div className="space-y-6">
            <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-600 ml-1">Ảnh bìa chủ đề (R2)</label>
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`
                        relative aspect-square rounded-[2.5rem] border-4 border-dashed transition-all cursor-pointer overflow-hidden flex flex-col items-center justify-center group
                        ${thumbnailUrl ? 'border-brand-500 bg-brand-500/5' : 'border-[var(--border-structural)] bg-[var(--bg-elevated)] hover:border-brand-400 hover:bg-[var(--bg-secondary)]'}
                    `}
                >
                    {uploadingThumb ? (
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
                            <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Đang tải lên R2...</p>
                        </div>
                    ) : thumbnailUrl ? (
                        <>
                            <Image src={apiPreviewUrl(thumbnailUrl)} alt="Preview" fill className="object-cover transition-transform duration-500 group-hover:scale-110" unoptimized />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                <p className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                    <Upload className="h-4 w-4" /> Đổi ảnh khác
                                </p>
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setThumbnailUrl(null); }}
                                className="absolute top-4 right-4 h-10 w-10 rounded-xl bg-black/60 text-white flex items-center justify-center hover:bg-rose-500 transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </>
                    ) : (
                        <div className="flex flex-col items-center gap-4 text-center p-8">
                            <div className="h-16 w-16 rounded-3xl bg-[var(--bg-secondary)] flex items-center justify-center border-2 border-[var(--border-structural)] group-hover:shadow-lg transition-all group-hover:scale-110">
                                <ImageIcon className="h-8 w-8 text-[var(--text-tertiary)]" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">Tải ảnh bìa</p>
                                <p className="text-[10px] text-[var(--text-tertiary)] font-bold uppercase tracking-tighter">Click để chọn từ máy</p>
                            </div>
                        </div>
                    )}
                    <input type="file" ref={fileInputRef} onChange={handleThumbnailUpload} className="hidden" accept="image/*" />
                </div>
                <div className="p-4 rounded-2xl bg-brand-50/5 border border-brand-100/10 flex gap-3">
                    <AlertCircle className="h-5 w-5 text-brand-500 shrink-0" />
                    <p className="text-[10px] text-[var(--text-tertiary)] leading-relaxed font-medium italic">
                        Mẹo: Một bức ảnh bìa đẹp sẽ thu hút nhiều người tham gia thảo luận hơn. Ảnh sẽ được lưu trữ an toàn trên Cloudflare R2.
                    </p>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}
