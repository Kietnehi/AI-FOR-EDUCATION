"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
    Send, Bot, User, BookOpen, ArrowLeft,
    MessageSquare, Loader2, Paperclip, ExternalLink, Heart, Reply,
    ChevronRight, ChevronLeft, Layout, GripVertical, X, Trash2,
    Pencil, Upload, Image as ImageIcon, Sparkles, Settings2,
    Type, AlignLeft, Palette, Camera, Check, Globe, Save
} from "lucide-react";
import Image from "next/image";
import { Markdown } from "@/components/ui/markdown";
import { MaterialViewer } from "@/components/ui/material-viewer";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    getCommunityThread, listThreadComments,
    addThreadComment, askAICommunity, likeCommunityComment,
    deleteCommunityComment,
    updateCommunityThread,
    getMaterial,
    uploadFile,
    CommunityThread, ThreadComment,
    apiPreviewUrl
} from "@/lib/api";
import { useNotify } from "@/components/use-notify";
import { useAuth } from "@/components/auth-provider";
import { Material } from "@/types";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";

export default function ThreadDetailPage() {
    const { threadId } = useParams() as { threadId: string };
    const router = useRouter();
    const { user } = useAuth();
    const { success, error: notifyError } = useNotify();

    const [thread, setThread] = useState<CommunityThread | null>(null);
    const [comments, setComments] = useState<ThreadComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [input, setInput] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [askAI, setAskAI] = useState(false);
    const [replyTo, setReplyTo] = useState<ThreadComment | null>(null);
    const [aiGeneratingFor, setAiGeneratingFor] = useState<string | null>(null);

    // Edit States
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [editForm, setEditForm] = useState({ title: "", description: "", thumbnail_url: "" });
    const [savingEdit, setSavingEdit] = useState(false);
    const [uploadingThumb, setUploadingThumb] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Comment image state
    const [commentImage, setCommentImage] = useState<string | null>(null);
    const [uploadingCommentImage, setUploadingCommentImage] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const commentFileInputRef = useRef<HTMLInputElement>(null);

    // Deletion state
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Viewer states
    const [activeMaterial, setActiveMaterial] = useState<Material | null>(null);
    const [loadingMaterial, setLoadingMaterial] = useState(false);
    const [errorMaterial, setErrorMaterial] = useState<string | null>(null);
    const [showViewer, setShowViewer] = useState(false);

    const [viewerWidth, setViewerWidth] = useState(60);
    const [isResizing, setIsResizing] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const fetchData = async () => {
        try {
            const [threadData, commentsData] = await Promise.all([
                getCommunityThread(threadId),
                listThreadComments(threadId)
            ]);
            setThread(threadData);
            setComments(commentsData);
            setEditForm({
                title: threadData.title,
                description: threadData.description || "",
                thumbnail_url: threadData.thumbnail_url || ""
            });
        } catch (err) {
            notifyError("Lỗi khi tải thông tin chủ đề");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [threadId]);

    useEffect(() => {
        if (scrollRef.current && (comments.length > 0 || aiGeneratingFor)) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [comments, aiGeneratingFor]);

    const startResizing = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
    }, []);

    const resize = useCallback((e: MouseEvent) => {
        if (!isResizing || !containerRef.current) return;
        const containerRect = containerRef.current.getBoundingClientRect();
        const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
        if (newWidth >= 15 && newWidth <= 85) {
            setViewerWidth(newWidth);
        }
    }, [isResizing]);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizing, resize, stopResizing]);

    const handleOpenMaterial = async (m_id: string) => {
        setShowViewer(true);
        setLoadingMaterial(true);
        setErrorMaterial(null);
        try {
            const data = await getMaterial(m_id);
            setActiveMaterial(data);
        } catch (err) {
            setErrorMaterial("Không thể tải tài liệu này.");
        } finally {
            setLoadingMaterial(false);
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!input.trim() && !commentImage) || submitting) return;
        setSubmitting(true);
        const text = input.trim();
        const imageUrl = commentImage || undefined;
        const currentReplyId = replyTo?.reply_to_comment_id || replyTo?.id;
        
        setInput("");
        setCommentImage(null);
        setReplyTo(null);

        try {
            if (askAI) {
                const userComment = await addThreadComment(threadId, text, currentReplyId, imageUrl);
                setComments(prev => [...prev, userComment]);
                setAiGeneratingFor(userComment.id);
                const aiComment = await askAICommunity(threadId, text, userComment.id);
                setComments(prev => [...prev, aiComment]);
                setAiGeneratingFor(null);
                setAskAI(false);
            } else {
                const comment = await addThreadComment(threadId, text, currentReplyId, imageUrl);
                setComments(prev => [...prev, comment]);
            }
        } catch (err) {
            setAiGeneratingFor(null);
            notifyError("Lỗi khi gửi bình luận");
        } finally {
            setSubmitting(false);
        }
    };

    const handleLikeComment = async (id: string) => {
        try {
            const res = await likeCommunityComment(id);
            setComments(prev => prev.map(c => c.id === id ? { ...c, likes_count: res.likes_count, liked_by_user_ids: res.liked_by_user_ids || [] } : c));
        } catch (err) { console.error(err); }
    };

    const handleDeleteComment = async () => {
        if (!deletingId) return;
        try {
            await deleteCommunityComment(deletingId);
            success("Đã xóa bình luận thành công.");
            setComments(prev => prev.filter(c => c.id !== deletingId && c.reply_to_comment_id !== deletingId));
        } catch (err) { notifyError("Bạn không có quyền xóa bình luận này."); }
        finally { setDeletingId(null); }
    };

    const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingThumb(true);
        try {
            const data = await uploadFile(file);
            setEditForm(f => ({ ...f, thumbnail_url: data.file_url }));
            success("Đã cập nhật ảnh bìa thành công!");
        } catch (err) { notifyError("Lỗi upload ảnh."); }
        finally { setUploadingThumb(false); }
    };

    const uploadImageHelper = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            notifyError("Vui lòng chỉ chọn tệp hình ảnh.");
            return;
        }
        setUploadingCommentImage(true);
        try {
            const data = await uploadFile(file);
            setCommentImage(data.file_url);
            success("Đã tải ảnh lên thành công!");
        } catch (err) {
            notifyError("Lỗi khi tải ảnh lên.");
        } finally {
            setUploadingCommentImage(false);
        }
    };

    const handleCommentImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await uploadImageHelper(file);
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const file = items[i].getAsFile();
                if (file) await uploadImageHelper(file);
            }
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        const imageFile = files.find(f => f.type.startsWith("image/"));
        if (imageFile) {
            await uploadImageHelper(imageFile);
        }
    };

    const handleSaveEdit = async () => {
        if (!editForm.title.trim()) return notifyError("Tiêu đề không được để trống.");
        setSavingEdit(true);
        try {
            const updated = await updateCommunityThread(threadId, {
                title: editForm.title,
                description: editForm.description,
                thumbnail_url: editForm.thumbnail_url || undefined
            });
            setThread(updated);
            success("Đã cập nhật thông tin thành công.");
            setShowEditDialog(false);
        } catch (err) { notifyError("Lỗi khi cập nhật."); }
        finally { setSavingEdit(false); }
    };

    const rootComments = useMemo(() => {
        const roots = comments.filter(c => !c.reply_to_comment_id);
        return roots.map(root => {
            const allDescendants: ThreadComment[] = [];
            const collectDescendants = (parentId: string) => {
                const children = comments.filter(c => c.reply_to_comment_id === parentId);
                children.forEach(child => {
                    if (!allDescendants.find(d => d.id === child.id)) {
                        allDescendants.push(child);
                        collectDescendants(child.id);
                    }
                });
            };
            collectDescendants(root.id);
            allDescendants.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            return { ...root, replies: allDescendants };
        });
    }, [comments]);

    if (loading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-brand-500" /></div>;
    if (!thread) return <div className="text-center py-20">Không tìm thấy chủ đề.</div>;

    const isOwner = user && thread.creator_id === user.id;

    return (
        <div className="max-w-[1920px] mx-auto h-[calc(100vh-140px)] flex flex-col gap-4 overflow-hidden px-4">
            {/* Header Bar */}
            <div className="flex items-center justify-between bg-[var(--bg-elevated)] p-5 rounded-[2rem] border-2 border-[var(--border-structural)] shadow-md shrink-0">
                <div className="flex items-center gap-5">
                    <button onClick={() => router.back()} className="p-2.5 rounded-2xl hover:bg-[var(--bg-secondary)] border-2 border-transparent hover:border-[var(--border-structural)] transition-all active:scale-90 cursor-pointer">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="min-w-0 space-y-1">
                        <h1 className="text-xl font-black line-clamp-1 leading-tight tracking-tight text-[var(--text-primary)]">{thread.title}</h1>
                        <div className="flex items-center gap-3 text-[10px] text-[var(--text-tertiary)] uppercase font-black tracking-[0.1em]">
                            <span className="text-brand-600 bg-brand-500/10 px-2 py-0.5 rounded-md border border-brand-500/20">{thread.creator_name}</span>
                            <span className="opacity-30">•</span>
                            <span>{new Date(thread.created_at).toLocaleDateString("vi-VN")}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {isOwner && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setShowEditDialog(true)}
                            className="h-11 rounded-2xl border-2 border-brand-200 text-brand-600 hover:bg-brand-50 shadow-sm font-black uppercase tracking-widest text-[10px] cursor-pointer"
                            icon={<Pencil className="h-4 w-4" />}
                        >
                            Chỉnh sửa
                        </Button>
                    )}
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowViewer(!showViewer)}
                        className={`h-11 rounded-2xl border-2 cursor-pointer ${showViewer ? 'bg-brand-500 text-white border-brand-600 shadow-lg' : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-structural)]'}`}
                        icon={<Layout className="h-4 w-4" />}
                    >
                        {showViewer ? "Ẩn tài liệu" : "Xem tài liệu"}
                    </Button>
                </div>
            </div>

            <div ref={containerRef} className="flex-1 flex gap-0 overflow-hidden relative">
                {isResizing && <div className="absolute inset-0 z-[100] cursor-col-resize" />}

                {/* Left: Document List */}
                {!showViewer && (
                    <div className="w-[320px] shrink-0 flex flex-col gap-4 pr-4 h-full">
                        <Card className="h-full overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar bg-[var(--bg-elevated)] border-2 border-[var(--border-structural)] rounded-[2.5rem] shadow-sm">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-brand-600 flex items-center gap-2">
                                    <Paperclip className="h-4 w-4" /> Học liệu đính kèm
                                </h3>
                                <Badge variant="outline" className="text-[9px] font-black">{thread.material_ids.length}</Badge>
                            </div>
                            <div className="space-y-3">
                                {thread.material_ids.map(m_id => (
                                    <button
                                        key={m_id}
                                        onClick={() => handleOpenMaterial(m_id)}
                                        className={`w-full p-4 rounded-3xl border-2 transition-all text-left group flex flex-col gap-2 ${activeMaterial?.id === m_id
                                                ? 'border-brand-500 bg-brand-500/10 shadow-lg translate-x-1'
                                                : 'border-[var(--border-structural)] bg-[var(--bg-secondary)] hover:border-brand-300 cursor-pointer'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl transition-all ${activeMaterial?.id === m_id ? 'bg-brand-500 text-white rotate-12 shadow-md' : 'bg-[var(--bg-elevated)] text-gray-400 group-hover:text-brand-500'}`}>
                                                <BookOpen className="h-4 w-4" />
                                            </div>
                                            <span className={`text-[11px] font-black uppercase tracking-tighter ${activeMaterial?.id === m_id ? 'text-brand-500' : 'text-[var(--text-primary)]'}`}>
                                                ID: {m_id.slice(-8)}
                                            </span>
                                        </div>
                                        <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all ${activeMaterial?.id === m_id ? 'opacity-100 text-brand-500 translate-x-1' : 'opacity-0 group-hover:opacity-100 text-[var(--text-tertiary)]'}`}>
                                            Chi tiết <ChevronRight className="h-3 w-3" />
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </Card>
                    </div>
                )}

                {/* Middle/Left: The Viewer */}
                <AnimatePresence mode="popLayout">
                    {showViewer && (
                        <>
                            <div style={{ width: `${viewerWidth}%` }} className="flex-shrink-0 h-full relative">
                                <MaterialViewer material={activeMaterial} loading={loadingMaterial} error={errorMaterial} onClose={() => setShowViewer(false)} />
                            </div>
                            <div onMouseDown={startResizing} className="w-6 h-full flex items-center justify-center relative z-[101] shrink-0 cursor-col-resize touch-none group">
                                <div className={`w-1.5 h-32 rounded-full transition-all duration-300 ${isResizing ? 'bg-brand-500 h-full w-1' : 'bg-[var(--border-structural)] group-hover:bg-brand-400 group-hover:h-48'}`} />
                                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-brand-500 text-white p-2 rounded-xl shadow-xl border-2 border-white/20 transition-all duration-300 ${isResizing ? 'scale-110 rotate-90 shadow-brand-500/40' : 'opacity-0 group-hover:opacity-100'}`}>
                                    <GripVertical className="h-4 w-4" />
                                </div>
                            </div>
                        </>
                    )}
                </AnimatePresence>

                {/* Right: Discussion Area */}
                <div className="flex-1 min-w-[400px] h-full">
                    <Card className="h-full flex flex-col overflow-hidden bg-[var(--bg-elevated)] border-2 border-[var(--border-structural)] shadow-xl rounded-[2.5rem]">
                        <div className="p-5 border-b-2 border-[var(--border-structural)] bg-[var(--bg-secondary)]/30 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-xl bg-brand-500/10 text-brand-600 flex items-center justify-center border border-brand-500/20">
                                    <MessageSquare className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">Khu vực thảo luận</span>
                            </div>
                            <Badge variant="secondary" className="text-[10px] font-black">{comments.length} phản hồi</Badge>
                        </div>

                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-[var(--bg-secondary)]/5 custom-scrollbar">
                            {rootComments.length === 0 && !aiGeneratingFor ? (
                                <div className="h-full flex flex-col items-center justify-center text-[var(--text-tertiary)] gap-5">
                                    <div className="h-20 w-20 rounded-[2.5rem] bg-[var(--bg-secondary)] flex items-center justify-center border-2 border-dashed border-[var(--border-structural)] shadow-inner">
                                        <MessageSquare className="h-8 w-8 opacity-10" />
                                    </div>
                                    <p className="text-sm font-black uppercase tracking-[0.2em] opacity-40">Chưa có thảo luận</p>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {rootComments.map((comment) => (
                                        <div key={comment.id} className="space-y-4">
                                            <CommentItem comment={comment} currentUser={user} onLike={() => handleLikeComment(comment.id)} onReply={() => { setReplyTo(comment); setAskAI(false); }} onAskAI={() => { setReplyTo(comment); setAskAI(true); }} onDelete={() => setDeletingId(comment.id)} />
                                            <div className="ml-6 md:ml-10 space-y-4 border-l-2 border-[var(--border-structural)] pl-4 md:pl-6">
                                                {comment.replies.map(reply => (
                                                    <CommentItem key={reply.id} comment={reply} currentUser={user} isReply parentComments={comments} onLike={() => handleLikeComment(reply.id)} onReply={() => { setReplyTo(reply); setAskAI(false); }} onAskAI={() => { setReplyTo(reply); setAskAI(true); }} onDelete={() => setDeletingId(reply.id)} />
                                                ))}
                                                {aiGeneratingFor && (comments.find(c => c.id === aiGeneratingFor)?.id === comment.id || comment.replies.some(r => r.id === aiGeneratingFor)) && <AIGeneratingItem />}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Input Area */}
                        <div 
                            className={`p-6 border-t-2 border-[var(--border-structural)] bg-[var(--bg-elevated)] shrink-0 shadow-2xl relative transition-all ${isDragging ? "bg-brand-500/5 ring-4 ring-brand-500/20 inset-shadow-sm" : ""}`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <AnimatePresence>
                                {isDragging && (
                                    <motion.div 
                                        initial={{ opacity: 0 }} 
                                        animate={{ opacity: 1 }} 
                                        exit={{ opacity: 0 }}
                                        className="absolute inset-0 z-50 bg-brand-500/10 backdrop-blur-[2px] flex flex-col items-center justify-center border-4 border-dashed border-brand-500/40 m-2 rounded-[2rem] pointer-events-none"
                                    >
                                        <div className="bg-[var(--bg-elevated)] p-8 rounded-[2.5rem] shadow-2xl border-2 border-brand-500 flex flex-col items-center gap-4 scale-110">
                                            <div className="h-20 w-20 rounded-3xl bg-brand-500 text-white flex items-center justify-center shadow-lg shadow-brand-500/40 animate-bounce">
                                                <ImageIcon className="h-10 w-10" />
                                            </div>
                                            <p className="text-sm font-black uppercase tracking-[0.2em] text-brand-600">Thả ảnh vào đây</p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <AnimatePresence>
                                {replyTo && (
                                    <motion.div initial={{ height: 0, opacity: 0, marginBottom: 0 }} animate={{ height: "auto", opacity: 1, marginBottom: 16 }} exit={{ height: 0, opacity: 0, marginBottom: 0 }} className="flex items-center justify-between bg-brand-500/10 p-3.5 px-6 rounded-2xl border border-brand-500/20">
                                        <div className="flex items-center gap-3 text-[11px]">
                                            <div className="h-7 w-7 rounded-full bg-brand-500 flex items-center justify-center text-white shadow-md"><Reply className="h-4 w-4" /></div>
                                            <span className="text-[var(--text-tertiary)] font-black uppercase tracking-tighter">Đang trả lời </span>
                                            <span className="font-black text-brand-600 uppercase underline decoration-2 underline-offset-4">{replyTo.user_name}</span>
                                        </div>
                                        <button onClick={() => { setReplyTo(null); setAskAI(false); }} className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-rose-500/10 hover:text-rose-500 transition-all active:scale-90 cursor-pointer"><X className="h-5 w-5" /></button>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <form onSubmit={handleSend} className="space-y-4">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <button type="button" onClick={() => setAskAI(!askAI)} className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all cursor-pointer ${askAI ? "bg-brand-500 text-white shadow-lg shadow-brand-500/30 scale-105" : "bg-[var(--bg-secondary)] text-[var(--text-tertiary)] border-2 border-[var(--border-structural)] hover:border-brand-500 hover:text-brand-500"}`}>
                                            <Bot className="h-4 w-4" /> {askAI ? "AI Đã kích hoạt" : "Hỏi AI"}
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => commentFileInputRef.current?.click()}
                                            disabled={uploadingCommentImage}
                                            className="flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] bg-[var(--bg-secondary)] text-[var(--text-tertiary)] border-2 border-[var(--border-structural)] hover:border-brand-500 hover:text-brand-500 transition-all cursor-pointer disabled:opacity-50"
                                        >
                                            {uploadingCommentImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                                            {commentImage ? "Đổi ảnh" : "Đính kèm ảnh"}
                                        </button>
                                        {askAI && <Sparkles className="h-4 w-4 text-brand-500 animate-pulse" />}
                                    </div>
                                    
                                    <AnimatePresence>
                                        {commentImage && (
                                            <motion.div 
                                                initial={{ opacity: 0, scale: 0.9 }} 
                                                animate={{ opacity: 1, scale: 1 }} 
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                className="relative w-32 h-32 rounded-2xl overflow-hidden border-2 border-brand-500 shadow-lg group"
                                            >
                                                <Image src={apiPreviewUrl(commentImage)} alt="Preview" fill className="object-cover" unoptimized />
                                                <button 
                                                    type="button"
                                                    onClick={() => setCommentImage(null)}
                                                    className="absolute top-1 right-1 h-6 w-6 rounded-lg bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className="relative group/input">
                                        <textarea 
                                            value={input} 
                                            onChange={e => setInput(e.target.value)} 
                                            onPaste={handlePaste}
                                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e); } }} 
                                            placeholder={askAI ? "Bạn muốn AI phân tích tài liệu như thế nào?" : "Viết bình luận của bạn..."} 
                                            className="w-full p-6 pr-20 rounded-[2rem] border-2 border-[var(--border-structural)] bg-[var(--bg-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-brand-500 focus:bg-[var(--bg-elevated)] transition-all min-h-[80px] max-h-[250px] text-sm shadow-inner" 
                                        />
                                        <button type="submit" disabled={(!input.trim() && !commentImage) || submitting} className="absolute right-4 bottom-4 h-12 w-12 rounded-[1.25rem] bg-brand-500 text-white disabled:opacity-20 disabled:grayscale flex items-center justify-center shadow-xl shadow-brand-500/30 active:scale-90 transition-all hover:bg-brand-600 cursor-pointer">
                                            {submitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <Send className="h-6 w-6" />}
                                        </button>
                                    </div>
                                </div>
                                <input type="file" ref={commentFileInputRef} onChange={handleCommentImageUpload} className="hidden" accept="image/*" />
                            </form>
                        </div>
                    </Card>
                </div>
            </div>

            {/* --- MODERN CLEAN STUDIO EDIT DIALOG --- */}
            <Dialog
                open={showEditDialog}
                onClose={() => setShowEditDialog(false)}
                className="max-w-4xl p-0 overflow-hidden bg-transparent border-none shadow-none"
            >
                <div className="bg-[var(--bg-elevated)] rounded-[2.5rem] border-2 border-[var(--border-structural)] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">

                    {/* Header: Clean & Balanced */}
                    <div className="px-8 py-6 border-b border-[var(--border-structural)] bg-[var(--bg-elevated)] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-brand-500/10 text-brand-600 flex items-center justify-center border border-brand-500/20">
                                <Pencil className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-tight">Chỉnh sửa thảo luận</h2>
                                <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Cập nhật thông tin chủ đề của bạn</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowEditDialog(false)}
                            className="h-10 w-10 rounded-xl hover:bg-rose-500/10 hover:text-rose-500 flex items-center justify-center text-[var(--text-tertiary)] transition-all cursor-pointer"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {/* Visual Section: Gallery Style Thumbnail */}
                        <div className="p-8 pb-0">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-600 flex items-center gap-2 ml-1">
                                    <ImageIcon className="h-3.5 w-3.5" /> Ảnh bìa chủ đề
                                </label>
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="relative aspect-[21/9] rounded-2xl border-2 border-[var(--border-structural)] bg-[var(--bg-secondary)] overflow-hidden cursor-pointer group shadow-sm transition-all hover:border-brand-500"
                                >
                                    {uploadingThumb && (
                                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[var(--bg-elevated)]/80 backdrop-blur-sm">
                                            <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
                                            <p className="text-[10px] font-black uppercase text-brand-600 animate-pulse tracking-widest mt-2">Đang xử lý...</p>
                                        </div>
                                    )}

                                    {editForm.thumbnail_url ? (
                                        <>
                                            <Image src={apiPreviewUrl(editForm.thumbnail_url)} alt="Cover" fill className="object-cover transition-transform duration-700 group-hover:scale-105" unoptimized />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <div className="bg-white/20 backdrop-blur-md px-6 py-2.5 rounded-full border border-white/30 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-xl">
                                                    <Camera className="h-4 w-4" /> Thay đổi ảnh
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="h-full w-full flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-brand-500/5 to-brand-500/10">
                                            <div className="h-14 w-14 rounded-2xl bg-[var(--bg-elevated)] flex items-center justify-center border-2 border-dashed border-brand-500/30">
                                                <Upload className="h-6 w-6 text-brand-500/50" />
                                            </div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-brand-500/60">Tải ảnh bìa mới từ máy tính</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Content Section: Focused Inputs */}
                        <div className="p-8 space-y-8">
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-tertiary)] ml-1">
                                    <Type className="h-4 w-4" /> Tiêu đề thảo luận
                                </label>
                                <div className="p-1 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-structural)] focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/5 transition-all">
                                    <input
                                        value={editForm.title}
                                        onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                                        className="w-full h-12 px-5 bg-transparent text-base font-bold text-[var(--text-primary)] focus:outline-none"
                                        placeholder="Nhập tiêu đề..."
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-tertiary)] ml-1">
                                    <AlignLeft className="h-4 w-4" /> Mô tả chi tiết
                                </label>
                                <div className="p-1 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-structural)] focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/5 transition-all">
                                    <textarea
                                        value={editForm.description}
                                        onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                                        className="w-full bg-transparent p-5 text-sm font-medium text-[var(--text-secondary)] focus:outline-none h-32 custom-scrollbar"
                                        placeholder="Bạn muốn thảo luận về nội dung gì?"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer: Fixed Action Bar */}
                    <div className="p-8 border-t border-[var(--border-structural)] bg-[var(--bg-secondary)]/30 flex items-center justify-end gap-4">
                        <button
                            onClick={() => setShowEditDialog(false)}
                            disabled={savingEdit}
                            className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors px-6 py-2 cursor-pointer"
                        >
                            Đóng
                        </button>
                        <Button
                            loading={savingEdit}
                            onClick={handleSaveEdit}
                            className="bg-brand-500 hover:bg-brand-600 text-white px-10 h-12 rounded-xl shadow-lg shadow-brand-500/20 font-black uppercase tracking-widest text-[10px] transition-all cursor-pointer"
                            icon={<Save className="h-4 w-4" />}
                        >
                            Lưu thay đổi
                        </Button>
                    </div>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleThumbnailUpload} className="hidden" accept="image/*" />
            </Dialog>

            <ConfirmDialog open={!!deletingId} onClose={() => setDeletingId(null)} onConfirm={handleDeleteComment} title="Xóa bình luận?" description="Hành động này không thể hoàn tác. Các phản hồi liên quan cũng sẽ bị xóa." confirmText="Xóa ngay" variant="danger" />
        </div>
    );
}

function CommentItem({
    comment,
    currentUser,
    isReply = false,
    parentComments = [],
    onLike,
    onReply,
    onAskAI,
    onDelete
}: {
    comment: ThreadComment,
    currentUser: any,
    isReply?: boolean,
    parentComments?: ThreadComment[],
    onLike?: () => void,
    onReply?: () => void,
    onAskAI?: () => void,
    onDelete?: () => void
}) {
    const isLiked = currentUser && comment.liked_by_user_ids?.includes(currentUser.id);
    const isOwner = currentUser && comment.user_id === currentUser.id;
    const replyToName = useMemo(() => {
        if (!comment.reply_to_comment_id) return null;
        const parent = parentComments.find(pc => pc.id === comment.reply_to_comment_id);
        return parent?.user_name;
    }, [comment.reply_to_comment_id, parentComments]);

    const [isZoomed, setIsZoomed] = useState(false);

    return (
        <>
        <div className="flex gap-5 group/comment">
            <div className="relative flex-shrink-0 w-11 h-11 overflow-hidden rounded-[1.5rem] border-2 border-[var(--border-structural)] bg-[var(--bg-secondary)] flex items-center justify-center shadow-sm">
                {comment.user_avatar ? <Image src={comment.user_avatar} alt="avatar" fill className="object-cover" unoptimized /> : <User className="h-6 w-6 text-[var(--text-muted)]" />}
            </div>
            <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                    <span className={`text-[12px] font-black uppercase tracking-tight ${comment.is_ai_response ? "text-brand-600" : "text-[var(--text-primary)]"}`}>
                        {comment.user_name}
                    </span>
                    {comment.is_ai_response && <div className="bg-brand-500 text-white text-[8px] px-2 py-0.5 rounded-md font-black uppercase tracking-[0.2em] shadow-sm">AI</div>}
                    {replyToName && <span className="text-[10px] font-bold text-[var(--text-tertiary)] flex items-center gap-1"><Reply className="h-3 w-3" /> {replyToName}</span>}

                    <div className="ml-auto flex items-center gap-3">
                        <span className="text-[10px] text-[var(--text-tertiary)] font-bold opacity-60">
                            {new Date(comment.created_at).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isOwner && (
                            <button onClick={onDelete} className="p-1.5 rounded-lg text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover/comment:opacity-100 cursor-pointer">
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                <div className={`p-6 rounded-[2rem] text-sm leading-relaxed max-w-none shadow-sm transition-all ${comment.is_ai_response ? "bg-[var(--bg-elevated)] border-2 border-brand-500/20" : "bg-[var(--bg-secondary)] border-2 border-[var(--border-structural)] group-hover/comment:bg-[var(--bg-elevated)]"}`}>
                    <Markdown content={comment.content} />
                    {comment.image_url && (
                        <div 
                            onClick={() => setIsZoomed(true)}
                            className="mt-4 rounded-xl overflow-hidden border border-[var(--border-structural)] cursor-zoom-in max-w-[200px] max-h-[200px] group/img relative"
                        >
                            <Image src={apiPreviewUrl(comment.image_url)} alt="Comment image" width={400} height={400} className="w-full h-full object-cover transition-transform group-hover/img:scale-105" unoptimized />
                            <div className="absolute inset-0 bg-black/5 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="bg-white/90 p-2 rounded-lg shadow-xl"><ExternalLink className="h-4 w-4 text-brand-600" /></span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-6 px-3">
                    <button
                        onClick={onLike}
                        className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${isLiked ? "text-rose-500" : "text-[var(--text-tertiary)] hover:text-rose-500"}`}
                    >
                        <Heart className={`h-4 w-4 ${isLiked ? "fill-rose-500" : ""}`} /> {comment.likes_count || 0}
                    </button>
                    {!comment.is_ai_response && (
                        <>
                            <button
                                onClick={onReply}
                                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] hover:text-brand-600 transition-colors cursor-pointer"
                            >
                                <Reply className="h-4 w-4" /> Trả lời
                            </button>
                            <button
                                onClick={onAskAI}
                                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-brand-500/80 hover:text-brand-600 transition-colors cursor-pointer"
                            >
                                <Bot className="h-4 w-4" /> Hỏi AI
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>

        <AnimatePresence>
            {isZoomed && comment.image_url && (
                <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    onClick={() => setIsZoomed(false)}
                    className="fixed inset-0 z-[999] bg-white/[0.05] backdrop-blur-2xl flex items-center justify-center p-4 md:p-20 cursor-zoom-out"
                >
                    <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }} 
                        animate={{ scale: 1, opacity: 1 }} 
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="relative max-w-5xl max-h-full aspect-auto rounded-[2.5rem] overflow-hidden border-4 border-white/20 shadow-[0_0_80px_rgba(0,0,0,0.1)] bg-[var(--bg-elevated)]"
                    >
                        <Image src={apiPreviewUrl(comment.image_url)} alt="Zoomed Comment image" width={1920} height={1080} className="w-full h-full object-contain" unoptimized />
                        <button className="absolute top-6 right-6 h-12 w-12 rounded-2xl bg-white/20 text-[var(--text-primary)] backdrop-blur-md flex items-center justify-center hover:bg-white/40 border border-white/20 transition-all shadow-xl">
                            <X className="h-6 w-6" />
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
        </>
    );
}

function AIGeneratingItem() {
    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-5">
            <div className="relative flex-shrink-0 w-11 h-11 rounded-[1.5rem] border-2 border-brand-500/20 bg-brand-500/5 flex items-center justify-center shadow-sm">
                <Bot className="h-6 w-6 text-brand-500 animate-bounce" />
            </div>
            <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                    <span className="text-[12px] font-black uppercase tracking-tight text-brand-600">AI Assistant</span>
                    <span className="bg-brand-500 text-white text-[8px] px-2 py-0.5 rounded-md font-black uppercase tracking-[0.2em] animate-pulse">Đang suy nghĩ...</span>
                </div>
                <div className="p-6 rounded-[2rem] bg-brand-500/[0.03] border-2 border-dashed border-brand-500/20 flex gap-2">
                    <div className="h-2 w-2 bg-brand-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="h-2 w-2 bg-brand-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="h-2 w-2 bg-brand-600 rounded-full animate-bounce" />
                </div>
            </div>
        </motion.div>
    );
}
