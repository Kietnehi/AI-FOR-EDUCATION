"use client";

import Link from "next/link";
import Image from "next/image";
import { GitBranch, Mail, MapPin, ArrowUp, Globe, Cpu, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

const productLinks = [
  { label: "Dashboard", href: "/" },
  { label: "Học liệu", href: "/materials" },
  { label: "Tải lên", href: "/materials/upload" },
  { label: "Chatbot RAG", href: "/chatbot" },
];

const resourceLinks = [
  { label: "Nội dung AI", href: "/generated" },
  { label: "Web Search", href: "/web-search" },
  { label: "Converter", href: "/converter" },
  { label: "Cài đặt", href: "/settings" },
];

export function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="relative mt-20 border-t-2 border-[var(--border-structural)] bg-[var(--bg-surface)] overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-[var(--border-structural)] via-transparent to-transparent opacity-50" />
      <div className="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-[var(--border-structural)] via-transparent to-transparent opacity-50" />
      
      <div className="max-w-[1400px] mx-auto px-6 sm:px-8 py-12 relative z-10">
        <div className="grid gap-12 lg:grid-cols-12">
          {/* Brand Column */}
          <div className="lg:col-span-5 space-y-6">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="flex items-center gap-3"
            >
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white p-2 shadow-sm border-2 border-[var(--border-structural)]">
                <Image
                  src="/logo.png"
                  alt="AI Learning Studio"
                  width={32}
                  height={32}
                  className="object-contain"
                />
              </div>
              <div>
                <h3 className="text-xl font-black text-[var(--text-primary)] leading-none" style={{ fontFamily: "var(--font-display)" }}>
                  AI Learning Studio
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-600">
                  Education Revolution
                </span>
              </div>
            </motion.div>
            
            <p className="max-w-md text-sm text-[var(--text-secondary)] leading-relaxed">
              Nền tảng tạo học liệu thông minh, tập trung hoá quy trình từ tài liệu thô đến 
              hệ sinh thái học tập AI đa dạng (Slides, Podcast, Quiz, Chatbot).
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href="https://github.com/Kietnehi/AI-FOR-EDUCATION"
                target="_blank"
                rel="noreferrer"
                className="sb-card flex items-center gap-2 px-4 py-2 text-xs font-bold no-underline hover:bg-[var(--bg-secondary)]"
              >
                <GitBranch className="h-4 w-4 text-brand-600" />
                GitHub Project
              </a>
              <div className="flex items-center gap-2 rounded-full border border-[var(--border-light)] bg-[var(--bg-secondary)] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                System Operational
              </div>
            </div>
          </div>

          {/* Links Columns */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">Sản phẩm</h4>
            <nav className="flex flex-col gap-2.5">
              {productLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-[var(--text-secondary)] no-underline hover:text-brand-600 hover:translate-x-1 transition-all flex items-center gap-2 group"
                >
                  <span className="h-1 w-1 rounded-full bg-transparent group-hover:bg-brand-400 transition-colors" />
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">Tài nguyên</h4>
            <nav className="flex flex-col gap-2.5">
              {resourceLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-[var(--text-secondary)] no-underline hover:text-brand-600 hover:translate-x-1 transition-all flex items-center gap-2 group"
                >
                  <span className="h-1 w-1 rounded-full bg-transparent group-hover:bg-brand-400 transition-colors" />
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Contact Column */}
          <div className="lg:col-span-3 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">Liên hệ</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="mt-1 p-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-light)]">
                  <MapPin className="h-3.5 w-3.5 text-brand-600" />
                </div>
                <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  <p className="font-bold text-[var(--text-primary)]">Trường Đại học Sài Gòn</p>
                  <p>273 An Dương Vương, P3, Q5, TP. HCM</p>
                </div>
              </div>
              <a
                href="mailto:truongquockiet1211@gmail.com"
                className="flex items-center gap-3 no-underline group"
              >
                <div className="p-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-light)] group-hover:border-brand-300 group-hover:bg-brand-50 transition-colors">
                  <Mail className="h-3.5 w-3.5 text-brand-600" />
                </div>
                <span className="text-xs text-[var(--text-secondary)] group-hover:text-brand-600 transition-colors">
                  truongquockiet1211@gmail.com
                </span>
              </a>
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-light)]">
                  <Globe className="h-3.5 w-3.5 text-brand-600" />
                </div>
                <span className="text-xs text-[var(--text-secondary)]">Toàn - Phát - Kiệt Team</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-12 pt-8 border-t border-[var(--border-light)] flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-[var(--text-primary)]">
              © {new Date().getFullYear()} AI Learning Studio. Bản quyền thuộc về Team AI-FOR-EDUCATION.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-[9px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
              <span className="flex items-center gap-1"><Cpu className="h-2.5 w-2.5" /> Next.js & FastAPI</span>
              <span className="w-1 h-1 rounded-full bg-[var(--border-medium)]" />
              <span className="flex items-center gap-1"><ShieldCheck className="h-2.5 w-2.5" /> MongoDB & ChromaDB</span>
              <span className="w-1 h-1 rounded-full bg-[var(--border-medium)]" />
              <span>Vercel & Docker</span>
            </div>
          </div>

          <motion.button
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.95 }}
            onClick={scrollToTop}
            className="sb-card group flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--bg-surface)] transition-all hover:bg-brand-50 hover:border-brand-300 shadow-sm"
            aria-label="Back to top"
          >
            <ArrowUp className="h-5 w-5 text-[var(--text-secondary)] group-hover:text-brand-600 transition-all" />
          </motion.button>
        </div>
      </div>

      {/* Subtle bottom decorative line */}
      <div className="h-1 w-full bg-gradient-to-r from-brand-400 via-accent-400 to-emerald-400 opacity-30" />
    </footer>
  );
}
