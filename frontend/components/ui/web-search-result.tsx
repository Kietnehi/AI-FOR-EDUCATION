"use client";

import { ExternalLink, Globe } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Markdown } from "@/components/ui/markdown";

interface WebSearchResultProps {
  answer: string;
  sources: Array<{
    index: number;
    title: string;
    uri: string;
    snippet: string;
  }>;
  citations: Array<{
    index: number;
    title: string;
    url: string;
    source: string;
  }>;
  searchProvider: string;
  searchQueries?: string[];
}

export function WebSearchResult({
  answer,
  sources,
  citations,
  searchProvider,
  searchQueries,
}: WebSearchResultProps) {
  return (
    <div className="space-y-4">
      {/* Câu trả lời chính */}
      <Card className="p-4 bg-[var(--bg-elevated)] border-[var(--border-light)]">
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-5 h-5 text-brand-500" />
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              Kết quả tìm kiếm từ {(searchProvider === "google" || searchProvider === "google_search") ? "Google Search" : "Tavily"}
            </span>
          </div>
          <div className="prose prose-sm max-w-none prose-headings:text-[var(--text-primary)] prose-p:text-[var(--text-secondary)] prose-strong:text-[var(--text-primary)]">
            <Markdown content={answer} />
          </div>
        </div>
      </Card>

      {/* Các câu hỏi tìm kiếm được sử dụng */}
      {searchQueries && searchQueries.length > 0 && (
        <Card className="p-3 bg-[var(--bg-secondary)] border-[var(--border-light)]">
          <p className="text-xs font-semibold text-[var(--text-tertiary)] mb-2">Các câu hỏi tìm kiếm:</p>
          <div className="space-y-1">
            {searchQueries.map((q, idx) => (
              <p key={idx} className="text-sm text-[var(--text-secondary)]">
                • {q}
              </p>
            ))}
          </div>
        </Card>
      )}

      {/* Danh sách nguồn với trích dẫn */}
      {sources.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-[var(--text-secondary)]">Các nguồn tham khảo:</h4>
          <div className="space-y-2">
            {sources.map((source) => (
              <a
                key={source.index}
                href={source.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 bg-[var(--bg-elevated)] border border-[var(--border-light)] rounded-lg hover:border-brand-400 hover:bg-[var(--bg-secondary)] transition group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-block px-2 py-0.5 bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 text-xs font-semibold rounded">
                        [{source.index}]
                      </span>
                      <p className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-brand-600 truncate">
                        {source.title}
                      </p>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-1">
                      {source.snippet || "Không có mô tả"}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)] truncate">{source.uri}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[var(--text-muted)] group-hover:text-brand-600 flex-shrink-0 mt-1" />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
