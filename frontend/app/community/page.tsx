"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageSquare, Plus, Users, Search, 
  ArrowRight, Heart, User, Sparkles, 
  TrendingUp, Clock, Filter, BookOpen,
  ChevronRight, Hash, Activity, FileText
} from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listCommunityThreads, likeCommunityThread, apiPreviewUrl } from "@/lib/api";
import { CommunityThread } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemAnim = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

export default function CommunityPage() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<CommunityThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "trending" | "newest">("all");

  const fetchThreads = async () => {
    try {
      const data = await listCommunityThreads();
      setThreads(data);
    } catch (err) {
      console.error("Failed to fetch threads:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThreads();
  }, []);

  const handleLike = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await likeCommunityThread(id);
      setThreads(prev => prev.map(t => 
        t.id === id 
          ? { ...t, likes_count: res.likes_count, liked_by_user_ids: res.liked_by_user_ids || [] } 
          : t
      ));
    } catch (err) {
      console.error(err);
    }
  };

  const filteredThreads = useMemo(() => {
    let result = threads.filter(t => 
      t.title.toLowerCase().includes(search.toLowerCase()) || 
      t.description?.toLowerCase().includes(search.toLowerCase())
    );

    if (filter === "trending") {
      result = [...result].sort((a, b) => (b.likes_count + b.comment_count) - (a.likes_count + a.comment_count));
    } else if (filter === "newest") {
      result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return result;
  }, [threads, search, filter]);

  const stats = useMemo(() => ({
    totalThreads: threads.length,
    totalComments: threads.reduce((acc, t) => acc + (t.comment_count || 0), 0),
    totalMaterials: threads.reduce((acc, t) => acc + t.material_ids.length, 0),
    activeMembers: Array.from(new Set(threads.map(t => JSON.stringify({ name: t.creator_name, avatar: t.creator_avatar }))))
                        .map(s => JSON.parse(s))
                        .slice(0, 5)
  }), [threads]);

  return (
    <div className="max-w-[1400px] mx-auto space-y-10 pb-20 px-4 md:px-0">
      
      {/* --- HERO SECTION --- */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-[var(--bg-elevated)] border-2 border-[var(--border-structural)] p-8 md:p-14 shadow-xl">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-brand-500/5 to-transparent pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-12">
            <div className="space-y-8 flex-1 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 bg-brand-500/10 text-brand-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-brand-500/20">
                    <Activity className="h-3 w-3" /> Diễn đàn tri thức
                </div>
                <h1 className="text-4xl md:text-7xl font-black text-[var(--text-primary)] leading-[1.1] tracking-tighter">
                    Thảo luận <br />
                    <span className="text-brand-500">Đa phương thức.</span>
                </h1>
                <p className="text-[var(--text-secondary)] text-lg max-w-xl font-medium leading-relaxed opacity-80">
                    Sử dụng AI để phân tích và trả lời câu hỏi trực tiếp trên tài liệu. 
                    Mọi ý kiến của bạn đều đóng góp vào kho tàng tri thức chung.
                </p>
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6">
                    <Link href="/community/create">
                        <Button 
                            size="lg" 
                            className="bg-brand-500 hover:bg-brand-600 text-white px-10 h-14 rounded-2xl shadow-lg shadow-brand-500/20 transition-all active:scale-95"
                            icon={<Plus className="h-5 w-5 stroke-[3]" />}
                        >
                            Bắt đầu chủ đề mới
                        </Button>
                    </Link>
                    
                    {stats.activeMembers.length > 0 && (
                        <div className="flex flex-col items-center lg:items-start gap-2">
                             <div className="flex -space-x-3">
                                {stats.activeMembers.map((member, i) => (
                                    <div key={i} className="w-10 h-10 rounded-full border-4 border-[var(--bg-elevated)] bg-[var(--bg-secondary)] flex items-center justify-center overflow-hidden shadow-sm relative group">
                                        {member.avatar ? (
                                            <Image src={member.avatar} alt="avatar" fill className="object-cover" unoptimized />
                                        ) : (
                                            <User className="h-4 w-4 text-[var(--text-tertiary)]" />
                                        )}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <span className="text-[8px] text-white font-bold text-center p-1 leading-tight">{member.name}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">Thành viên tích cực</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full lg:w-[400px] shrink-0">
                <StatCard icon={<Hash className="text-blue-500" />} label="Chủ đề" value={stats.totalThreads} />
                <StatCard icon={<MessageSquare className="text-brand-500" />} label="Bình luận" value={stats.totalComments} />
                <StatCard icon={<BookOpen className="text-purple-500" />} label="Học liệu" value={stats.totalMaterials} />
                <StatCard icon={<TrendingUp className="text-rose-500" />} label="Tương tác" value={`${stats.totalThreads > 0 ? (stats.totalComments / stats.totalThreads).toFixed(1) : 0} / bài`} />
            </div>
        </div>
      </section>

      {/* --- FILTER BAR --- */}
      <section className="flex flex-col md:flex-row gap-6 items-center sticky top-20 z-40 bg-[var(--bg-section)]/90 backdrop-blur-md py-4">
        <div className="relative flex-1 w-full group">
          <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-tertiary)] group-focus-within:text-brand-500 transition-colors" />
          <input
            type="text"
            placeholder="Tìm theo tiêu đề, mô tả tài liệu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-14 w-full rounded-[1.5rem] border-2 border-[var(--border-structural)] bg-[var(--bg-elevated)] pl-14 pr-6 text-sm font-bold focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/5 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 bg-[var(--bg-secondary)]/50 p-1.5 rounded-[1.25rem] border border-[var(--border-structural)] shrink-0">
            <FilterButton active={filter === "all"} onClick={() => setFilter("all")} label="Tất cả" />
            <FilterButton active={filter === "trending"} onClick={() => setFilter("trending")} label="Nổi bật" />
            <FilterButton active={filter === "newest"} onClick={() => setFilter("newest")} label="Mới nhất" />
        </div>
      </section>

      {/* --- THREADS GRID --- */}
      {loading ? (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <div key={i} className="h-72 rounded-[2.5rem] bg-[var(--bg-elevated)] border-2 border-[var(--border-structural)] animate-pulse" />)}
        </div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {filteredThreads.map((thread) => {
            const isLiked = user && thread.liked_by_user_ids?.includes(user.id);
            const hasThumbnail = thread.thumbnail_url;
            
            return (
              <motion.div key={thread.id} variants={itemAnim}>
                <Link href={`/community/${thread.id}`} className="block no-underline group h-full">
                  <Card className="h-full flex flex-col p-0 overflow-hidden bg-[var(--bg-elevated)] border-2 border-[var(--border-structural)] rounded-[2.5rem] shadow-sm group-hover:shadow-2xl group-hover:border-brand-500 transition-all duration-300">
                    
                    {/* Header: DYNAMIC THUMBNAIL */}
                    <div className="h-40 bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-elevated)] border-b-2 border-[var(--border-structural)] relative flex items-center justify-center overflow-hidden">
                        {hasThumbnail ? (
                            <Image 
                                src={apiPreviewUrl(thread.thumbnail_url || "")} 
                                alt="thumbnail" 
                                fill 
                                className="object-cover transition-transform duration-700 group-hover:scale-105"
                                unoptimized
                            />
                        ) : (
                            <div className="flex flex-col items-center gap-2 opacity-20 group-hover:opacity-40 transition-all duration-500">
                                {thread.first_material_type === 'pdf' ? <FileText className="h-12 w-12 text-brand-500" /> : <Sparkles className="h-12 w-12 text-brand-500" />}
                                <span className="text-[10px] font-black uppercase tracking-widest">{thread.first_material_type || 'Topic'}</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors" />
                        
                        <div className="absolute top-4 left-6">
                             <div className="flex items-center gap-1.5 bg-brand-500 px-3 py-1 rounded-xl shadow-lg border-2 border-white/20">
                                <BookOpen className="h-3.5 w-3.5 text-white" />
                                <span className="text-[10px] font-black uppercase text-white tracking-tighter">{thread.material_ids.length} files</span>
                             </div>
                        </div>
                    </div>

                    <div className="p-7 flex-1 flex flex-col gap-5">
                        <div className="space-y-3 flex-1">
                            <h3 className="text-lg font-black text-[var(--text-primary)] line-clamp-2 leading-tight group-hover:text-brand-500 transition-colors">
                            {thread.title}
                            </h3>
                            <p className="text-xs text-[var(--text-tertiary)] line-clamp-2 font-medium leading-relaxed">
                            {thread.description || "Thảo luận chi tiết về các học liệu đính kèm..."}
                            </p>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-[var(--border-light)]">
                            <div className="flex items-center gap-3">
                                <div className="relative h-9 w-9 overflow-hidden rounded-xl border border-[var(--border-structural)] bg-[var(--bg-secondary)] flex items-center justify-center shadow-sm">
                                    {thread.creator_avatar ? (
                                        <Image src={thread.creator_avatar} alt="avatar" fill className="object-cover" unoptimized />
                                    ) : (
                                        <User className="h-4 w-4 text-[var(--text-muted)]" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black text-[var(--text-primary)] uppercase truncate tracking-tight">{thread.creator_name || "Ẩn danh"}</p>
                                    <p className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase">{new Date(thread.created_at.endsWith('Z') ? thread.created_at : thread.created_at + 'Z').toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 text-[10px] font-black text-[var(--text-tertiary)] uppercase">
                                    <MessageSquare className="h-3.5 w-3.5 text-brand-400" /> {thread.comment_count || 0}
                                </div>
                                <div 
                                    className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg transition-colors cursor-pointer ${isLiked ? 'text-rose-500 bg-rose-500/5' : 'text-[var(--text-tertiary)] hover:bg-rose-500/5'}`}
                                    onClick={(e) => handleLike(e, thread.id)}
                                >
                                    <Heart className={`h-3.5 w-3.5 ${isLiked ? 'fill-rose-500' : ''}`} /> {thread.likes_count || 0}
                                </div>
                            </div>
                        </div>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: any, label: string, value: any }) {
    return (
        <div className="p-5 flex flex-col items-center justify-center gap-1 bg-[var(--bg-secondary)]/30 border border-[var(--border-structural)] rounded-2xl transition-transform hover:translate-y-[-2px] cursor-default group">
            <div className="p-2.5 rounded-xl bg-[var(--bg-elevated)] group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <div className="text-xl font-black text-[var(--text-primary)] tracking-tighter">{value}</div>
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-tertiary)] opacity-60">{label}</div>
        </div>
    );
}

function FilterButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
    return (
        <button 
            onClick={onClick}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                active 
                ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20 translate-y-[-1px]" 
                : "bg-transparent text-[var(--text-tertiary)] hover:text-brand-500"
            }`}
        >
            <span>{label}</span>
        </button>
    );
}
