"use client";

import { useEffect, useState } from "react";
import { Sparkles, BookOpen, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RemediationQuickStart, RemediationQuickStartItem } from "@/types";

interface RemediationQuickStartModalProps {
  open: boolean;
  onClose: () => void;
  data: RemediationQuickStart | null;
  onStartGame: (item: RemediationQuickStartItem) => void;
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Dễ",
  medium: "Trung bình",
  hard: "Khó",
};

function toDifficultyLabel(input?: string): string {
  if (!input) return "Trung bình";
  return DIFFICULTY_LABELS[input.toLowerCase()] || input;
}

export function RemediationQuickStartModal({
  open,
  onClose,
  data,
  onStartGame,
}: RemediationQuickStartModalProps) {
  const [expandedQuestions, setExpandedQuestions] = useState(false);

  useEffect(() => {
    if (!open) {
      setExpandedQuestions(false);
    }
  }, [open]);

  const questions = data?.top_wrong_questions || [];
  const visibleQuestions = expandedQuestions ? questions : questions.slice(0, 3);

  return (
    <Dialog open={open} onClose={onClose} title="Bộ ôn tập AI đã sẵn sàng" maxWidth="lg">
      {!data ? (
        <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-secondary)] p-5 text-sm text-[var(--text-secondary)]">
          Chưa có dữ liệu bộ ôn tập. Vui lòng tạo lại bộ câu hỏi AI.
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-secondary)] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-light)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="m-0 text-sm font-semibold text-[var(--text-primary)]">{data.message}</p>
                <p className="m-0 text-xs text-[var(--text-secondary)]">
                  Độ khó đề xuất: {toDifficultyLabel(data.recommended_difficulty)}
                </p>
              </div>
            </div>
          </div>

          {questions.length > 0 && (
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="m-0 text-sm font-semibold text-[var(--text-primary)]">Top 10 câu hỏi bạn sai nhiều nhất</p>
                {questions.length > 3 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setExpandedQuestions((prev) => !prev)}
                    icon={expandedQuestions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  >
                    {expandedQuestions ? "Thu gọn" : `Mở rộng (${questions.length})`}
                  </Button>
                )}
              </div>
              <div className="mt-2 space-y-2">
                {visibleQuestions.map((item, index) => (
                  <div
                    key={`${item.question}-${index}`}
                    className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] p-3"
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                      <div className="min-w-0 flex-1">
                        <p className="m-0 text-sm text-[var(--text-primary)]">
                          {index + 1}. {item.question}
                        </p>
                        <p className="m-0 mt-1 text-xs text-[var(--text-secondary)]">
                          Sai {item.wrong_count} lần
                          {item.correct_answer ? ` • Đáp án đúng: ${item.correct_answer}` : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {!expandedQuestions && questions.length > 3 && (
                <p className="m-0 mt-2 text-xs text-[var(--text-tertiary)]">
                  Đang hiển thị 3/{questions.length} câu. Bấm Mở rộng để xem toàn bộ danh sách.
                </p>
              )}
            </div>
          )}

          {data.generated_items[0] && (
            <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-secondary)] p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-light)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div>
                  <p className="m-0 text-sm font-semibold text-[var(--text-primary)]">{data.generated_items[0].title}</p>
                  <p className="m-0 text-xs text-[var(--text-secondary)]">
                    {toDifficultyLabel(data.generated_items[0].difficulty)}
                  </p>
                </div>
              </div>

              <Button size="sm" fullWidth onClick={() => onStartGame(data.generated_items[0])}>
                Bắt đầu quiz ôn tập
              </Button>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
