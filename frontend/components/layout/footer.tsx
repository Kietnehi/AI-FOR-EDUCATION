import Link from "next/link";
import { GitBranch, Mail, MapPin } from "lucide-react";

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
  return (
    <footer className="mt-10 border-t-2 border-[var(--border-structural)] bg-[var(--bg-surface)]">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-8 py-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="space-y-3 md:col-span-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-light)] bg-[var(--bg-secondary)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              AI Learning Studio
            </div>
            <h3 className="text-xl font-black text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
              Nền tảng tạo học liệu AI cho giáo dục hiện đại
            </h3>
            <p className="max-w-xl text-sm text-[var(--text-secondary)]">
              Tập trung hoá quy trình từ tải tài liệu, tạo slide/podcast/minigame đến chatbot hỏi đáp trong một workspace thống nhất.
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-tertiary)]">
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-light)] bg-[var(--bg-secondary)] px-3 py-1">
                <MapPin className="h-3.5 w-3.5" />
                Ho Chi Minh City, Vietnam
              </span>
              <a
                href="mailto:contact@ailearning.studio"
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border-light)] bg-[var(--bg-secondary)] px-3 py-1 no-underline hover:border-brand-300 hover:text-[var(--text-primary)]"
              >
                <Mail className="h-3.5 w-3.5" />
                contact@ailearning.studio
              </a>
              <a
                href="https://github.com/Kietnehi/AI-FOR-EDUCATION"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border-light)] bg-[var(--bg-secondary)] px-3 py-1 no-underline hover:border-brand-300 hover:text-[var(--text-primary)]"
              >
                <GitBranch className="h-3.5 w-3.5" />
                GitHub
              </a>
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-bold uppercase tracking-[0.15em] text-[var(--text-primary)]">Sản phẩm</h4>
            <div className="space-y-2">
              {productLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block text-sm text-[var(--text-secondary)] no-underline hover:text-brand-600"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-bold uppercase tracking-[0.15em] text-[var(--text-primary)]">Tài nguyên</h4>
            <div className="space-y-2">
              {resourceLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block text-sm text-[var(--text-secondary)] no-underline hover:text-brand-600"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-[var(--border-light)] pt-4 text-xs text-[var(--text-tertiary)] sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} AI Learning Studio. All rights reserved.</span>
          <span>Built with Next.js, FastAPI, MongoDB and ChromaDB.</span>
        </div>
      </div>
    </footer>
  );
}
