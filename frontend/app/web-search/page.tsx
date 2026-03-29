"use client";

import { ReactNode, useEffect, useState } from "react";
import {
  Book,
  Calendar,
  Globe,
  Image as ImageIcon,
  LayoutGrid,
  Newspaper,
  PlayCircle,
  Search,
  Video,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { searchDuckDuckGo } from "@/lib/api";
import { DuckDuckGoSearchItem, DuckDuckGoSearchType } from "@/types";

type SearchTab = {
  id: DuckDuckGoSearchType;
  label: string;
  icon: ReactNode;
};

const TABS: SearchTab[] = [
  { id: "text", label: "Tất cả", icon: <Globe className="w-4 h-4" /> },
  { id: "news", label: "Tin tức", icon: <Newspaper className="w-4 h-4" /> },
  { id: "images", label: "Hình ảnh", icon: <ImageIcon className="w-4 h-4" /> },
  { id: "videos", label: "Video", icon: <Video className="w-4 h-4" /> },
  { id: "books", label: "Sách", icon: <Book className="w-4 h-4" /> },
];

export default function WebSearchPage() {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<DuckDuckGoSearchType>("text");
  const [maxResults, setMaxResults] = useState(10);
  const [results, setResults] = useState<DuckDuckGoSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);
    setError(null);

    try {
      const data = await searchDuckDuckGo(query, searchType, maxResults);
      setResults(data);
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : "Không thể tìm kiếm. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasSearched || !query.trim()) return;
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchType, maxResults]);

  const renderTextResult = (item: DuckDuckGoSearchItem, index: number) => (
    <Card key={index} className="!p-4 space-y-2">
      <p className="text-xs text-[var(--text-tertiary)] line-clamp-1">{item.href || item.url}</p>
      <a
        href={item.href || item.url}
        target="_blank"
        rel="noreferrer"
        className="text-lg font-semibold text-brand-600 hover:text-brand-700 hover:underline"
      >
        {item.title || "Không có tiêu đề"}
      </a>
      <p className="text-sm text-[var(--text-secondary)]">{item.body || item.snippet || item.description}</p>
    </Card>
  );

  const renderNewsResult = (item: DuckDuckGoSearchItem, index: number) => (
    <Card key={index} className="!p-4 space-y-2">
      <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
        <span className="font-semibold uppercase">{item.source || "Nguồn tin"}</span>
        {item.date && (
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {item.date}
          </span>
        )}
      </div>
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="text-base font-semibold text-brand-600 hover:text-brand-700 hover:underline"
      >
        {item.title || "Không có tiêu đề"}
      </a>
      <p className="text-sm text-[var(--text-secondary)]">{item.body || item.snippet || ""}</p>
    </Card>
  );

  const renderImageResult = (item: DuckDuckGoSearchItem, index: number) => (
    <div key={index} className="break-inside-avoid mb-4">
      <Card className="!p-0 overflow-hidden">
        <a href={item.image || item.url} target="_blank" rel="noreferrer" className="block">
          <img
            src={item.thumbnail || item.image || "https://via.placeholder.com/320x220?text=No+Image"}
            alt={item.title || "Kết quả hình ảnh"}
            className="w-full h-48 object-cover"
            onError={(e) => {
              e.currentTarget.src = "https://via.placeholder.com/320x220?text=No+Image";
            }}
          />
        </a>
        <div className="p-3 space-y-1">
          <p className="text-sm text-[var(--text-primary)] line-clamp-2">{item.title || "Không có tiêu đề"}</p>
          <p className="text-xs text-[var(--text-tertiary)] line-clamp-1">{item.source || item.url || ""}</p>
        </div>
      </Card>
    </div>
  );

  const renderVideoResult = (item: DuckDuckGoSearchItem, index: number) => (
    <Card key={index} className="!p-4 flex gap-4 items-start">
      <div className="relative w-44 sm:w-56 aspect-video rounded-lg overflow-hidden bg-[var(--bg-secondary)] shrink-0">
        <img
          src={item.images?.large || item.images?.medium || item.images?.small || item.image || "https://via.placeholder.com/320x180?text=Video"}
          alt={item.title || "Video"}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
          <PlayCircle className="w-10 h-10 text-white/90" />
        </div>
      </div>
      <div className="space-y-2 min-w-0">
        <a
          href={item.content || item.url}
          target="_blank"
          rel="noreferrer"
          className="text-base font-semibold text-brand-600 hover:text-brand-700 hover:underline line-clamp-2"
        >
          {item.title || "Không có tiêu đề"}
        </a>
        <p className="text-xs text-[var(--text-tertiary)] line-clamp-1">
          {item.publisher || item.uploader || "Nguồn video"}
        </p>
        <p className="text-sm text-[var(--text-secondary)] line-clamp-2">{item.description || item.body || ""}</p>
      </div>
    </Card>
  );

  const renderBookResult = (item: DuckDuckGoSearchItem, index: number) => (
    <Card key={index} className="!p-4 flex gap-4 items-start">
      <div className="w-20 sm:w-24 aspect-[2/3] rounded-lg bg-[var(--bg-secondary)] overflow-hidden shadow-sm shrink-0">
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.title || "Sách"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--text-tertiary)]">
            <Book className="w-8 h-8 opacity-20" />
          </div>
        )}
      </div>
      <div className="space-y-2 min-w-0 flex-1">
        <a
          href={item.link || item.url || item.href}
          target="_blank"
          rel="noreferrer"
          className="text-lg font-bold text-brand-600 hover:text-brand-700 hover:underline line-clamp-2"
        >
          {item.title || "Không có tiêu đề"}
        </a>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-tertiary)] font-medium">
          {item.authors && (
            <span className="text-brand-700">Tác giả: {Array.isArray(item.authors) ? item.authors.join(", ") : item.authors}</span>
          )}
          {item.publisher && <span>NXB: {item.publisher}</span>}
          {item.publishedDate && <span>Năm: {item.publishedDate}</span>}
          {item.pageCount && <span>{item.pageCount} trang</span>}
        </div>

        {item.averageRating && (
          <div className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 w-fit px-2 py-0.5 rounded-full">
            <span>{item.averageRating} ★</span>
            {item.ratingsCount && <span className="opacity-70">({item.ratingsCount} lượt đánh giá)</span>}
          </div>
        )}

        <p className="text-sm text-[var(--text-secondary)] line-clamp-3 leading-relaxed">
          {item.description || item.body || ""}
        </p>

        <div className="flex gap-3 pt-1">
          {item.previewLink && (
            <a
              href={item.previewLink}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold px-3 py-1.5 rounded-md bg-brand-50 text-brand-700 hover:bg-brand-100 transition"
            >
              Đọc thử
            </a>
          )}
          {item.buyLink && (
            <a
              href={item.buyLink}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold px-3 py-1.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
            >
              Mua sách
            </a>
          )}
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[30px] border border-[var(--border-light)] bg-[var(--bg-elevated)] px-6 py-7 shadow-[0_8px_30px_rgba(15,23,42,0.05)] sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-sky-400 via-cyan-400 to-sky-200" />

        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <div className="relative flex h-36 w-36 shrink-0 items-center justify-center rounded-[30px] bg-[linear-gradient(145deg,#f0f9ff,#d8f3ff)] ring-1 ring-sky-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_20px_45px_rgba(14,165,233,0.18)] sm:h-40 sm:w-40">
            <div className="pointer-events-none absolute inset-3 rounded-[24px] bg-[radial-gradient(circle,rgba(255,255,255,0.95),rgba(186,230,253,0.35)_72%,transparent_100%)]" />
            <img
              src="/searching.png"
              alt="Tìm kiếm website"
              className="relative z-10 h-[90%] w-[90%] object-contain drop-shadow-[0_10px_18px_rgba(14,165,233,0.18)]"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-sky-700 ring-1 ring-sky-100">
              <span className="h-2 w-2 rounded-full bg-sky-500" />
              Web Search
            </div>

            <h1
              className="max-w-4xl text-[2.2rem] font-black leading-[0.98] tracking-[-0.05em] text-slate-900 sm:text-[3.35rem]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Tìm kiếm Website Online
            </h1>

            <p className="mt-4 max-w-3xl text-[15px] leading-7 text-slate-600 sm:text-[17px]">
              Tích hợp Web Search Online trực tiếp trong AI Learning Studio để tra cứu website, tin tức,
              hình ảnh và video nhanh hơn, gọn hơn, tập trung hơn.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <div className="inline-flex items-center gap-2">
                <Globe className="h-4 w-4 text-sky-600" />
                <span>Tra cứu đa định dạng</span>
              </div>
              <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:block" />
              <div className="inline-flex items-center gap-2">
                <Newspaper className="h-4 w-4 text-sky-600" />
                <span>Tin tức và liên kết</span>
              </div>
              <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:block" />
              <div className="inline-flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-sky-600" />
                <span>Hình ảnh và video</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nhập từ khóa để tìm kiếm..."
              className="w-full h-11 pl-10 pr-24 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-light)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
            <button
              type="submit"
              disabled={loading}
              className="absolute right-1.5 top-1.5 h-8 px-4 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? "Đang tìm..." : "Tìm"}
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSearchType(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition ${
                  searchType === tab.id
                    ? "bg-brand-50 text-brand-700 border-brand-200"
                    : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-light)] hover:bg-[var(--bg-secondary)]"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}

            <div className="ml-auto inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <span>Max:</span>
              <select
                value={maxResults}
                onChange={(e) => setMaxResults(Number(e.target.value))}
                className="h-8 rounded-md border border-[var(--border-light)] bg-[var(--bg-elevated)] px-2"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </form>
      </Card>

      {!hasSearched && !loading && (
        <Card className="!py-12 text-center">
          <LayoutGrid className="w-12 h-12 mx-auto text-[var(--text-tertiary)] mb-3" />
          <p className="text-[var(--text-secondary)]">Nhập từ khóa để bắt đầu tìm kiếm</p>
        </Card>
      )}

      {error && (
        <Card className="!border-rose-200 !bg-rose-50">
          <p className="text-sm text-rose-700">{error}</p>
        </Card>
      )}

      {loading && (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="!p-4">
              <div className="space-y-2 animate-pulse">
                <div className="h-3 w-1/3 bg-[var(--bg-secondary)] rounded" />
                <div className="h-5 w-2/3 bg-[var(--bg-secondary)] rounded" />
                <div className="h-12 w-full bg-[var(--bg-secondary)] rounded" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading && hasSearched && !error && (
        <div className="space-y-4">
          <p className="text-xs text-[var(--text-tertiary)]">Đã tìm thấy {results.length} kết quả</p>

          {results.length === 0 && (
            <Card className="!py-10 text-center">
              <p className="text-[var(--text-secondary)]">Không tìm thấy kết quả phù hợp.</p>
            </Card>
          )}

          {results.length > 0 && (
            <div className={searchType === "images" ? "columns-2 md:columns-3 gap-4" : "space-y-4"}>
              {results.map((item, index) => {
                if (searchType === "images") return renderImageResult(item, index);
                if (searchType === "videos") return renderVideoResult(item, index);
                if (searchType === "news") return renderNewsResult(item, index);
                if (searchType === "books") return renderBookResult(item, index);
                return renderTextResult(item, index);
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
