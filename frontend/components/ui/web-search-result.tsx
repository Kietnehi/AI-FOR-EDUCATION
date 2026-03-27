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
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-semibold text-blue-900">
              Kết quả tìm kiếm từ {(searchProvider === "google" || searchProvider === "google_search") ? "Google Search" : "Tavily"}
            </span>
          </div>
          <div className="prose prose-sm max-w-none text-gray-800">
            <Markdown content={answer} />
          </div>
        </div>
      </Card>

      {/* Các câu hỏi tìm kiếm được sử dụng */}
      {searchQueries && searchQueries.length > 0 && (
        <Card className="p-3 bg-gray-50">
          <p className="text-xs font-semibold text-gray-600 mb-2">Các câu hỏi tìm kiếm:</p>
          <div className="space-y-1">
            {searchQueries.map((q, idx) => (
              <p key={idx} className="text-sm text-gray-700">
                • {q}
              </p>
            ))}
          </div>
        </Card>
      )}

      {/* Danh sách nguồn với trích dẫn */}
      {sources.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700">Các nguồn tham khảo:</h4>
          <div className="space-y-2">
            {sources.map((source) => (
              <a
                key={source.index}
                href={source.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                        [{source.index}]
                      </span>
                      <p className="text-sm font-semibold text-gray-800 group-hover:text-blue-600 truncate">
                        {source.title}
                      </p>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2 mb-1">
                      {source.snippet || "Không có mô tả"}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{source.uri}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-600 flex-shrink-0 mt-1" />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
