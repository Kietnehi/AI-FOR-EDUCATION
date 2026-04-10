"use client";

import { useState } from "react";
import { Search, Loader, AlertCircle, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { webSearch } from "@/lib/api";

interface WebSearchDialogProps {
  sessionId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: any) => void;
}

export function WebSearchDialog({ sessionId, isOpen, onClose, onSuccess }: WebSearchDialogProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useGoogle, setUseGoogle] = useState(true);

  const handleSearch = async () => {
    if (!query.trim()) {
      setError("Vui lòng nhập câu hỏi tìm kiếm");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const configuredModel = localStorage.getItem("chat_model_id") || localStorage.getItem("chat_model");
      const useGeminiRotation = localStorage.getItem("chat_use_gemini_rotation") !== "false";
      const result = await webSearch(sessionId, query, useGoogle, {
        model: configuredModel,
        useGeminiRotation,
      });
      onSuccess(result);
      setQuery("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tìm kiếm thất bại. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} title="Tìm kiếm trên web" maxWidth="md">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-brand-500" />
          <p className="text-sm text-[var(--text-secondary)]">
            Nhà cung cấp: {useGoogle ? "Google" : "Tavily"}
          </p>
        </div>
        <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Nhập câu hỏi của bạn..."
            className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-[var(--text-primary)] bg-[var(--bg-secondary)] placeholder:text-[var(--text-tertiary)]"
            disabled={loading}
        />

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="useGoogle"
            checked={useGoogle}
            onChange={(e) => setUseGoogle(e.target.checked)}
            disabled={loading}
            className="w-4 h-4 cursor-pointer accent-brand-600"
          />
          <label htmlFor="useGoogle" className="text-sm text-[var(--text-secondary)] cursor-pointer">
            Thử Google Search trước (nhanh hơn nếu hỗ trợ)
          </label>
        </div>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg p-3 flex gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-300 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-rose-700 dark:text-rose-200">{error}</p>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Button
            onClick={onClose}
            disabled={loading}
            variant="secondary"
            className="px-4 py-2"
          >
            Hủy
          </Button>
          <Button
            onClick={handleSearch}
            disabled={loading}
            className="px-4 py-2 flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Đang tìm kiếm...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Tìm kiếm
              </>
            )}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
