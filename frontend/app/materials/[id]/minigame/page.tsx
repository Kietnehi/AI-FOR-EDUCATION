"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gamepad2,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Trophy,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Toast } from "@/components/ui/toast";
import { getGeneratedContent, submitGameAttempt } from "@/lib/api";
import { GeneratedContent } from "@/types";

export default function MinigamePage() {
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const contentId = searchParams.get("contentId") || "";
  const materialId = params.id;

  const [content, setContent] = useState<GeneratedContent | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!contentId) {
      setLoading(false);
      return;
    }
    getGeneratedContent(contentId)
      .then(setContent)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [contentId]);

  const items = useMemo(() => {
    const games = content?.json_content?.games || [];
    return games.flatMap((game: any) =>
      (game.items || []).map((item: any) => ({ ...item, gameType: game.type }))
    );
  }, [content]);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const answerList = Object.entries(answers).map(([id, answer]) => ({ id, answer }));
      const submitted = await submitGameAttempt(contentId, answerList);
      setResult(submitted);
    } catch (error) {
      // handle error
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setAnswers({});
    setResult(null);
  }

  const gameTypeLabels: Record<string, string> = {
    mcq: "Trắc nghiệm",
    fill_blank: "Điền từ",
    matching: "Ghép cặp",
    flashcard: "Flashcard",
  };

  const gameTypeColors: Record<string, string> = {
    mcq: "from-brand-500 to-brand-600",
    fill_blank: "from-accent-500 to-accent-600",
    matching: "from-emerald-500 to-emerald-600",
    flashcard: "from-amber-500 to-amber-600",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
          <Link href={`/materials/${materialId}`} className="hover:text-brand-600 transition-colors no-underline text-[var(--text-tertiary)]">
            <span className="flex items-center gap-1.5">
              <ArrowLeft className="w-4 h-4" />
              Quay lại
            </span>
          </Link>
          <span>/</span>
          <span className="text-[var(--text-secondary)] font-medium flex items-center gap-1.5">
            <Gamepad2 className="w-4 h-4" />
            Minigame
          </span>
        </div>
        {result && (
          <Button variant="ghost" size="sm" icon={<RotateCcw className="w-4 h-4" />} onClick={handleReset}>
            Làm lại
          </Button>
        )}
      </div>

      {loading && <CardSkeleton />}

      {!loading && !contentId && (
        <EmptyState
          icon={<Gamepad2 className="w-10 h-10" />}
          title="Chưa có minigame"
          description="Hãy tạo minigame từ trang chi tiết học liệu trước."
          action={
            <Link href={`/materials/${materialId}`}>
              <Button variant="secondary">Quay lại tạo</Button>
            </Link>
          }
        />
      )}

      {/* Result Banner */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <Card className="relative overflow-hidden !border-emerald-200 !bg-gradient-to-r from-emerald-50 to-brand-50">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-200/30 rounded-full -translate-y-1/2 translate-x-1/4 blur-2xl" />
              <div className="relative flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-emerald-800" style={{ fontFamily: "var(--font-display)" }}>
                    Kết quả: {result.score}/{result.max_score}
                  </h3>
                  <p className="text-sm text-emerald-600 mt-1">
                    {result.score === result.max_score
                      ? "Tuyệt vời! Bạn đã trả lời đúng tất cả! 🎉"
                      : result.score > result.max_score / 2
                        ? "Khá tốt! Hãy xem lại các câu sai nhé."
                        : "Cần ôn tập thêm. Hãy thử lại!"}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Question Cards */}
      {items.length > 0 && (
        <div className="space-y-4">
          {content && (
            <Card className="!p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge status={content.generation_status} />
                <span className="text-sm text-[var(--text-tertiary)]">Phiên bản v{content.version}</span>
                {content.model_used && (
                  <span className="text-sm text-[var(--text-tertiary)]">Model: {content.model_used}</span>
                )}
                {content.fallback_applied && (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    {`Đã chuyển sang model dự phòng: ${content.model_used || "không xác định"}`}
                  </span>
                )}
              </div>
            </Card>
          )}
          {items.map((item: any, idx: number) => {
            const feedback = result?.feedback?.find((f: any) => f.id === item.id);
            const isCorrect = feedback?.correct;

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className={`
                  transition-all duration-300
                  ${feedback
                    ? isCorrect
                      ? "!border-emerald-300 !bg-emerald-50/50"
                      : "!border-rose-300 !bg-rose-50/50"
                    : ""
                  }
                `}>
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`
                      w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-sm font-bold
                      bg-gradient-to-br ${gameTypeColors[item.gameType] || "from-brand-500 to-brand-600"}
                    `}>
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-[var(--bg-secondary)] text-[var(--text-tertiary)]">
                          {gameTypeLabels[item.gameType] || item.gameType}
                        </span>
                        {feedback && (
                          isCorrect
                            ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            : <XCircle className="w-5 h-5 text-rose-500" />
                        )}
                      </div>
                      <p className="text-base font-medium text-[var(--text-primary)]">
                        {item.question || item.front}
                      </p>
                    </div>
                  </div>

                  {/* MCQ Options */}
                  {Array.isArray(item.options) && item.options.length > 0 ? (
                    <div className="grid gap-2 ml-11">
                      {item.options.map((opt: string) => {
                        const isSelected = answers[item.id] === opt;
                        const showCorrect = feedback && opt === feedback.correct_answer;
                        const showWrong = feedback && isSelected && !isCorrect;

                        return (
                          <label
                            key={opt}
                            className={`
                              flex items-center gap-3 p-3 rounded-xl cursor-pointer
                              border transition-all duration-200
                              ${result
                                ? showCorrect
                                  ? "border-emerald-300 bg-emerald-50"
                                  : showWrong
                                    ? "border-rose-300 bg-rose-50"
                                    : "border-[var(--border-light)] bg-[var(--bg-secondary)]"
                                : isSelected
                                  ? "border-brand-400 bg-brand-50"
                                  : "border-[var(--border-light)] bg-[var(--bg-secondary)] hover:border-brand-300"
                              }
                            `}
                          >
                            <input
                              type="radio"
                              name={item.id}
                              value={opt}
                              checked={isSelected}
                              onChange={() => setAnswers((prev) => ({ ...prev, [item.id]: opt }))}
                              disabled={!!result}
                              className="w-4 h-4 accent-[var(--color-brand-500)]"
                            />
                            <span className="text-sm text-[var(--text-primary)]">{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="ml-11">
                      <input
                        value={answers[item.id] || ""}
                        onChange={(e) =>
                          setAnswers((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        disabled={!!result}
                        placeholder={
                          item.gameType === "flashcard"
                            ? "Nhập nội dung bạn nhớ..."
                            : "Nhập đáp án..."
                        }
                        className="
                          w-full h-10 px-4 rounded-xl
                          bg-[var(--bg-secondary)] border border-[var(--border-light)]
                          text-sm text-[var(--text-primary)]
                          placeholder:text-[var(--text-tertiary)]
                          focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100
                          transition-all duration-200
                          disabled:opacity-60
                        "
                      />
                      {feedback && !isCorrect && feedback.correct_answer && (
                        <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Đáp án đúng: {feedback.correct_answer}
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              </motion.div>
            );
          })}

          {/* Submit Button */}
          {!result && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-center pt-4"
            >
              <Button
                size="lg"
                onClick={handleSubmit}
                loading={submitting}
                icon={<Sparkles className="w-5 h-5" />}
              >
                Nộp bài
              </Button>
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  );
}
