"use client";

import { motion } from "framer-motion";
import {
  FileText, PlaySquare, Globe,
  Database, MessageSquareText,
  Mic2, Gamepad2, Presentation,
  ArrowRight, Workflow, Shapes,
  ServerCog, Sparkles, Network, Share2
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const TechBadge = ({ logo, alt, size = 20 }: { logo: string, alt: string, size?: number }) => (
  <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-[var(--bg-surface)] dark:bg-slate-800 border border-[var(--border-structural)] dark:border-slate-700 flex items-center justify-center p-1 md:p-1.5 shadow-sm tooltip-container relative group shrink-0 hover:scale-110 transition-transform cursor-help z-50">
    <Image src={`/logo-tech-stack/${logo}`} alt={alt} width={size} height={size} className="w-full h-full object-contain" />
    <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl">
      {alt}
    </span>
  </div>
);

const FlowCard = ({
  icon: Icon, title, description, logos = [], delay = 0,
  colorClass = "text-blue-500", borderClass = "hover:border-blue-500/50",
  isActive = false
}: {
  icon: any, title: string, description: string, delay?: number,
  colorClass?: string, borderClass?: string, logos?: { file: string, name: string }[], isActive?: boolean
}) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, delay }}
    className={`relative flex flex-col gap-3 p-4 md:p-5 rounded-2xl bg-[var(--bg-secondary)] dark:bg-slate-800/90 border ${isActive ? 'border-brand-500 shadow-lg shadow-brand-500/20 dark:shadow-brand-500/40' : 'border-[var(--border-structural)] dark:border-slate-600'} shadow-sm z-10 w-full group ${borderClass} transition-all duration-300 hover:shadow-lg dark:hover:shadow-brand-500/10 cursor-default`}
  >
    <div className="flex items-start justify-between relative z-10">
      <div className={`p-2.5 rounded-xl bg-[var(--bg-surface)] dark:bg-slate-700 shadow-sm border border-[var(--border-structural)] dark:border-slate-600 ${colorClass} group-hover:scale-110 transition-transform duration-300 relative`}>
        {isActive && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full animate-ping" />}
        <Icon className="w-5 h-5 md:w-6 md:h-6" />
      </div>
      {logos.length > 0 && (
        <div className="flex items-center gap-1.5">
          {logos.map(logo => <TechBadge key={logo.name} logo={logo.file} alt={logo.name} />)}
        </div>
      )}
    </div>

    <div className="relative z-10">
      <h4 className="font-bold text-[var(--text-primary)] dark:text-slate-100 text-sm leading-tight">{title}</h4>
      <p className="text-[11px] md:text-xs text-[var(--text-secondary)] dark:text-slate-400 mt-1.5" style={{ lineHeight: "1.4" }}>{description}</p>
    </div>
  </motion.div>
);

const AnimatedConnection = ({ d }: { d: string }) => (
  <>
    {/* Base Path Background */}
    <path d={d} fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--border-medium)] dark:text-slate-500" vectorEffect="non-scaling-stroke" />
    {/* Flowing Dashed Path */}
    <motion.path
      d={d}
      fill="none"
      stroke="url(#gradient-pipe)"
      strokeWidth="3"
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
      strokeDasharray="8 12"
      animate={{ strokeDashoffset: [20, 0] }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
      className="drop-shadow-[0_0_6px_rgba(129,140,248,0.5)] dark:drop-shadow-[0_0_10px_rgba(129,140,248,0.8)]"
    />
  </>
);

export function WorkflowVisualization() {
  return (
    <section className="py-16 md:py-24 relative overflow-hidden bg-gradient-to-b from-[var(--bg-section)] to-[var(--bg-surface)] dark:from-slate-950 dark:to-slate-900 border-t border-[var(--border-structural)] dark:border-slate-700 relative">

      {/* Defined Gradients for SVG */}
      <svg className="w-0 h-0 absolute">
        <defs>
          <linearGradient id="gradient-pipe" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
      </svg>

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 text-xs font-bold mb-4 uppercase tracking-widest border border-brand-500/20"
          >
            <Workflow className="w-3.5 h-3.5" />
            Dynamic Workflow
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-5xl font-black mb-4 tracking-tight leading-tight text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Hệ sinh thái <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-accent-600 dark:from-brand-400 dark:to-accent-400">Luồng công việc AI</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-[var(--text-secondary)] dark:text-slate-300 text-base md:text-lg"
          >
            Mô phỏng dòng chảy dữ liệu từ mọi nguồn đầu vào qua hệ lõi xử lý thông minh để kiến tạo nên những sản phẩm học liệu số độc bản.
          </motion.p>
        </div>

        {/* --- DESKTOP DYNAMIC PIPELINE --- */}
        <div className="hidden lg:flex flex-row items-stretch justify-between w-full max-w-7xl mx-auto h-[720px] relative z-10 px-4">

          {/* COLUMN 1: Inputs (4 Items) */}
          <div className="flex flex-col justify-around h-full w-[260px] relative z-10 py-6">
            <div className="absolute -left-8 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] uppercase font-bold tracking-[0.2em] text-[var(--text-muted)] dark:text-slate-500 whitespace-nowrap">1. Multi-source Input</div>
            <FlowCard
              icon={FileText} title="Tài liệu & Tri thức" description="Phân tích PDF, DOCX, Sách điện tử & OCR hình ảnh mạnh mẽ."
              logos={[{ file: 'python.png', name: 'Python' }]} isActive colorClass="text-blue-500" delay={0.1}
            />
            <FlowCard
              icon={PlaySquare} title="YouTube & Media" description="Bóc tách transcript, tóm tắt video & chuyển đổi âm thanh (STT)."
              logos={[{ file: 'openai.png', name: 'Whisper' }, { file: 'github_actions.png', name: 'FFmpeg' }]} isActive colorClass="text-rose-500" delay={0.15}
            />
            <FlowCard
              icon={Globe} title="Webpages & URLs" description="Trích xuất nội dung từ website, blog & tài nguyên học tập trực tuyến."
              logos={[{ file: 'cloudflare.png', name: 'Cloudflare' }]} isActive colorClass="text-purple-500" delay={0.2}
            />
            <FlowCard
              icon={Shapes} title="Images & Graphics" description="Nhận diện ký tự (OCR) và mô tả nội dung hình ảnh thông minh."
              logos={[{ file: 'google.png', name: 'Google' }]} isActive colorClass="text-amber-500" delay={0.25}
            />
          </div>

          {/* SVG CONNECTOR 1 -> 2 (4 to 3 mapping) */}
          <div className="flex-1 min-w-[60px] relative pointer-events-none py-6">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
              <AnimatedConnection d="M 0 12.5 C 40 12.5, 60 16.6, 100 16.6" />
              <AnimatedConnection d="M 0 37.5 C 40 37.5, 60 16.6, 100 16.6" />
              <AnimatedConnection d="M 0 62.5 C 40 62.5, 60 50, 100 50" />
              <AnimatedConnection d="M 0 87.5 C 40 87.5, 60 83.3, 100 83.3" />
            </svg>
          </div>

          {/* COLUMN 2: Infrastructure (3 Items) */}
          <div className="flex flex-col justify-around h-full w-[260px] relative z-10 py-6">
            <div className="absolute -left-6 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] uppercase font-bold tracking-[0.2em] text-indigo-500 dark:text-indigo-400 whitespace-nowrap">2. Smart Infrastructure</div>
            <FlowCard
              icon={ServerCog} title="Distributed Workers" description="Hệ thống Celery & Redis điều phối hàng ngàn tác vụ xử lý song song."
              logos={[{ file: 'redis.png', name: 'Redis' }, { file: 'docker.png', name: 'Docker' }]} colorClass="text-indigo-500" borderClass="border-l-4 border-l-indigo-500" delay={0.3}
            />
            <FlowCard
              icon={Database} title="Vector & Semantic" description="Lưu trữ Vector Embedding cho tìm kiếm ngữ nghĩa cực nhanh."
              logos={[{ file: 'chromadb.png', name: 'ChromaDB' }]} colorClass="text-emerald-500" borderClass="border-l-4 border-l-emerald-500" delay={0.4}
            />
            <FlowCard
              icon={Network} title="Knowledge Graph" description="Xây dựng mạng lưới liên kết kiến trúc tri thức có cấu trúc."
              logos={[{ file: 'mongodb.png', name: 'MongoDB' }]} colorClass="text-cyan-500" borderClass="border-l-4 border-l-cyan-500" delay={0.5}
            />
          </div>

          {/* SVG CONNECTOR 2 -> 3 (3 to 1 mapping) */}
          <div className="flex-1 min-w-[60px] relative pointer-events-none py-6">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
              <AnimatedConnection d="M 0 16.6 C 50 16.6, 50 50, 100 50" />
              <AnimatedConnection d="M 0 50 C 50 50, 50 50, 100 50" />
              <AnimatedConnection d="M 0 83.3 C 50 83.3, 50 50, 100 50" />
            </svg>
          </div>

          {/* COLUMN 3: AI Brain (1 Big Item) */}
          <div className="flex flex-col justify-center h-full w-[280px] relative z-10 py-6">
            <div className="absolute -left-6 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] uppercase font-bold tracking-[0.2em] text-brand-500 dark:text-brand-400 whitespace-nowrap">3. Multi-Agent AI Core</div>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} transition={{ delay: 0.6 }}
              className="w-full rounded-[2.5rem] bg-slate-900 dark:bg-slate-800 border border-slate-700 dark:border-slate-600 shadow-2xl dark:shadow-slate-900/50 relative overflow-hidden flex flex-col items-center justify-center p-8 min-h-[420px]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-brand-600/20 to-accent-600/20 dark:from-brand-500/30 dark:to-accent-500/30 opacity-50" />
              <div className="w-20 h-20 rounded-3xl bg-brand-500 flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(99,102,241,0.5)] dark:shadow-[0_0_60px_rgba(99,102,241,0.6)] z-10">
                <Sparkles className="w-10 h-10 text-white animate-pulse" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 z-10 text-center">AI Orchestrator</h3>
              <p className="text-[10px] text-slate-300 dark:text-slate-400 text-center mb-6 z-10 px-2 line-clamp-3">Kết hợp Gemini,OpenAI với Real-time Web Search để cung cấp tri thức chính xác, cập nhật nhất.</p>
              <div className="flex gap-2 z-10">
                <TechBadge logo="gemini.jpg" alt="Google Gemini" size={24} />
                <TechBadge logo="google.png" alt="Google Search API" size={24} />
                <TechBadge logo="python.png" alt="LangChain Agents" size={24} />
              </div>
              {/* Decorative circuit lines */}
              <div className="absolute bottom-0 w-full h-2 bg-gradient-to-r from-brand-500 to-accent-500 opacity-80" />
            </motion.div>
          </div>

          {/* SVG CONNECTOR 3 -> 4 (1 to 5 mapping) */}
          <div className="flex-1 min-w-[60px] relative pointer-events-none py-6">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
              <AnimatedConnection d="M 0 50 C 40 50, 60 10, 100 10" />
              <AnimatedConnection d="M 0 50 C 40 50, 60 30, 100 30" />
              <AnimatedConnection d="M 0 50 C 40 50, 60 50, 100 50" />
              <AnimatedConnection d="M 0 50 C 40 50, 60 70, 100 70" />
              <AnimatedConnection d="M 0 50 C 40 50, 60 90, 100 90" />
            </svg>
          </div>

          {/* COLUMN 4: Outputs (5 Items) */}
          <div className="flex flex-col justify-around h-full w-[260px] relative z-10 py-6">
            <div className="absolute -right-6 top-1/2 -translate-y-1/2 rotate-90 text-[10px] uppercase font-bold tracking-[0.2em] text-emerald-500 dark:text-emerald-400 whitespace-nowrap">4. Digital Ecosystem</div>
            <FlowCard icon={Presentation} title="Học liệu thông minh" description="Slides tự động hóa & Tài liệu thu gọn." logos={[{ file: 'nextjs.png', name: 'Next.js' }]} colorClass="text-orange-500" delay={0.7} borderClass="hover:border-orange-500/50" />
            <FlowCard icon={Mic2} title="Audio Podcast" description="Chuyển đổi tri thức thành âm thanh đa vai." logos={[{ file: 'nodjs.jpg', name: 'Node.js' }]} colorClass="text-emerald-500" delay={0.75} borderClass="hover:border-emerald-500/50" />
            <FlowCard icon={Share2} title="Knowledge Graph" description="Bản đồ tư duy tương tác 3D trực quan." logos={[{ file: 'nextjs.png', name: 'React 18' }]} colorClass="text-cyan-500" delay={0.8} borderClass="hover:border-cyan-500/50" />
            <FlowCard icon={Gamepad2} title="Minigames & Quiz" description="Vừa chơi vừa học với thử thách 3D." logos={[{ file: 'nextjs.png', name: 'React 18' }]} colorClass="text-indigo-500" delay={0.85} borderClass="hover:border-indigo-500/50" />
            <FlowCard icon={MessageSquareText} title="Chatbot Expert" description="Hỏi đáp vạn năng cá nhân hóa 24/7." logos={[{ file: 'google.png', name: 'Google' }]} colorClass="text-yellow-500" delay={0.9} borderClass="hover:border-yellow-500/50" />
          </div>

        </div>

        {/* --- MOBILE DYNAMIC FLOWCHART --- */}
        <div className="lg:hidden flex flex-col gap-6 w-full max-w-sm mx-auto relative px-2 py-8">
          {/* Central Dynamic Spine */}
          <div className="absolute top-12 bottom-12 left-8 w-1.5 rounded-full bg-gradient-to-b from-brand-400 to-accent-400 dark:from-brand-500 dark:to-accent-500 overflow-hidden shadow-lg dark:shadow-brand-500/50">
            <motion.div
              className="w-full h-32 bg-brand-500/80 rounded-full blur-[2px]"
              animate={{ y: ["-100%", "900px"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
          </div>

          {/* Mobile Stack */}
          <div className="pl-14 relative z-10 mb-8">
            <div className="absolute left-[34px] top-6 w-5 h-5 rounded-full bg-blue-500 animate-pulse border-4 border-[var(--bg-surface)] dark:border-slate-900 flex items-center justify-center -ml-[19px]"></div>
            <h3 className="text-xl font-bold mb-4 text-blue-500 dark:text-blue-400">1. Đa nguồn đầu vào</h3>
            <div className="flex flex-col gap-3">
              <FlowCard icon={FileText} title="Tài liệu & Hình ảnh" description="PDF, Docs, OCR phân tích sâu" logos={[{ file: 'python.png', name: 'Python' }]} isActive colorClass="text-blue-500" />
              <FlowCard icon={PlaySquare} title="Video & Web Data" description="YouTube, URLs & Web Crawling" logos={[{ file: 'openai.png', name: 'OpenAI' }]} isActive colorClass="text-rose-500" />
            </div>
          </div>

          <div className="pl-14 relative z-10 mb-8">
            <div className="absolute left-[34px] top-6 w-5 h-5 rounded-full bg-indigo-500 animate-pulse border-4 border-[var(--bg-surface)] dark:border-slate-900 flex items-center justify-center -ml-[19px]"></div>
            <h3 className="text-xl font-bold mb-4 text-indigo-500 dark:text-indigo-400">2. Hạ tầng thông minh</h3>
            <div className="flex flex-col gap-3">
              <FlowCard icon={Network} title="Vector & Graph DB" description="ChromaDB & MongoDB tri thức" logos={[{ file: 'chromadb.png', name: 'ChromaDB' }]} colorClass="text-emerald-500" />
              <FlowCard icon={ServerCog} title="Distributed Systems" description="Celery workers & Task queue" logos={[{ file: 'redis.png', name: 'Redis' }]} colorClass="text-indigo-500" />
            </div>
          </div>

          <div className="pl-14 relative z-10 mb-8">
            <div className="absolute left-[34px] top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-brand-500 border-4 border-[var(--bg-surface)] dark:border-slate-900 flex items-center justify-center -ml-[21.5px] shadow-[0_0_20px_rgba(99,102,241,0.5)]">
              <div className="w-2 h-2 rounded-full bg-white animate-ping" />
            </div>
            <div className="bg-slate-900 dark:bg-slate-800 rounded-[2rem] p-6 text-center shadow-xl dark:shadow-slate-900/50 border border-brand-500/30 relative overflow-hidden">
              <Sparkles className="w-10 h-10 text-white mx-auto mb-3" />
              <h3 className="text-2xl font-black text-white mb-1 tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Lõi Trí Tuệ AI</h3>
              <p className="text-white/70 text-xs mb-4">Gemini + Search + Agents</p>
              <div className="flex justify-center gap-3">
                <TechBadge logo="gemini.jpg" alt="Gemini" size={24} />
                <TechBadge logo="google.png" alt="Search" size={24} />
              </div>
            </div>
          </div>

          <div className="pl-14 relative z-10">
            <div className="absolute left-[34px] top-6 w-5 h-5 rounded-full bg-emerald-500 animate-pulse border-4 border-[var(--bg-surface)] dark:border-slate-900 flex items-center justify-center -ml-[19px]"></div>
            <h3 className="text-xl font-bold mb-4 text-emerald-500 dark:text-emerald-400">3. Sản phẩm học tập</h3>
            <div className="flex flex-col gap-3">
              <FlowCard icon={Presentation} title="Slides & Podcast" description="Đa phương thức tự động" logos={[{ file: 'nextjs.png', name: 'Next.js' }]} colorClass="text-orange-500" />
              <FlowCard icon={Share2} title="Knowledge Map 3D" description="Đồ thị tri thức tương tác" logos={[{ file: 'nextjs.png', name: 'React' }]} colorClass="text-cyan-500" />
              <FlowCard icon={Gamepad2} title="AI Chatbot & Games" description="Học tập qua trải nghiệm" logos={[{ file: 'nextjs.png', name: 'React' }]} colorClass="text-indigo-500" />
            </div>
          </div>
        </div>

        {/* --- BOTTOM ACTIONS --- */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="mt-20 md:mt-32 p-8 md:p-12 rounded-[2rem] border-2 border-brand-500/40 dark:border-brand-400/50 bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg-secondary)] dark:from-slate-800 dark:to-slate-900 shadow-xl dark:shadow-2xl dark:shadow-brand-500/20 text-center relative overflow-hidden group max-w-4xl mx-auto"
        >
          <div className="absolute -inset-0 bg-gradient-to-r from-brand-500/10 to-accent-500/10 dark:from-brand-500/20 dark:to-accent-500/20 group-hover:from-brand-500/20 group-hover:to-accent-500/20 dark:group-hover:from-brand-500/30 dark:group-hover:to-accent-500/30 transition-colors duration-500" />
          <div className="relative z-10 w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white mx-auto flex items-center justify-center mb-6 shadow-lg dark:shadow-brand-500/50">
            <Shapes className="w-8 h-8" />
          </div>

          <h3 className="text-2xl md:text-3xl font-black text-[var(--text-primary)] dark:text-white mb-4 relative z-10 tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            Sẵn sàng đưa tài liệu của bạn vào đường ống?
          </h3>
          <p className="text-[var(--text-secondary)] dark:text-slate-300 mb-8 max-w-xl mx-auto relative z-10 text-sm md:text-base">
            Trải nghiệm khả năng phân tích và bóc tách kiến thức tuyệt vời từ hệ thống bằng cách đăng tải một tệp thực tế.
          </p>
          <div className="flex justify-center flex-wrap gap-4 relative z-10">
            <Link href="/materials/upload" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto px-8 h-12 md:h-14 rounded-full bg-brand-500 text-white text-sm md:text-base font-bold hover:bg-brand-600 transition-all flex items-center justify-center gap-2 group shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 hover:-translate-y-1">
                Mở xưởng chế tác <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
