"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Trophy, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface QuizItem {
  id: string;
  question_type: string;
  question: string;
  options?: string[];
  correct_answer?: string;
  correct_answers?: string[];
  explanation: string;
}

interface QuizMixedPlayerProps {
  title: string;
  items: QuizItem[];
  onSubmit: (answers: Array<{ id: string; answer: string }>) => Promise<any>;
  loading?: boolean;
  submitting?: boolean;
}

export function QuizMixedPlayer({ title, items, onSubmit, loading, submitting }: QuizMixedPlayerProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const gameTypeLabels: Record<string, string> = {
    true_false: "Đúng/Sai",
    mcq: "Trắc nghiệm",
    multiple_select: "Chọn nhiều",
    fill_blank: "Điền từ",
  };

  const gameTypeColors: Record<string, string> = {
    true_false: "from-blue-500 to-blue-600",
    mcq: "from-brand-500 to-brand-600",
    multiple_select: "from-emerald-500 to-emerald-600",
    fill_blank: "from-accent-500 to-accent-600",
  };

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      const answerList = Object.entries(answers).map(([id, answer]) => ({ id, answer }));
      const submitted = await onSubmit(answerList);
      setResult(submitted);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReset() {
    setAnswers({});
    setResult(null);
  }

  if (loading) {
    return <div className="text-center py-8">Đang tải...</div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">{title}</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {items.length} câu hỏi &bull; Mix từ 4 dạng
        </p>
      </div>

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
                {!result && (
                  <Button size="sm" variant="ghost" onClick={handleReset} className="ml-auto">
                    Làm lại
                  </Button>
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Question Cards */}
      {items.length > 0 && (
        <div className="space-y-4">
          {items.map((item, idx) => {
            const feedback = result?.feedback?.find((f: any) => f.id === item.id);
            const isCorrect = feedback?.is_correct;

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card
                  className={`
                  transition-all duration-300
                  ${
                    feedback
                      ? isCorrect
                        ? "!border-emerald-300 !bg-emerald-50/50"
                        : "!border-rose-300 !bg-rose-50/50"
                      : ""
                  }
                `}
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div
                      className={`
                      w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-sm font-bold
                      bg-gradient-to-br ${gameTypeColors[item.question_type] || "from-brand-500 to-brand-600"}
                    `}
                    >
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-[var(--bg-secondary)] text-[var(--text-tertiary)]">
                          {gameTypeLabels[item.question_type] || item.question_type}
                        </span>
                        {feedback &&
                          (isCorrect ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <XCircle className="w-5 h-5 text-rose-500" />
                          ))}
                      </div>
                      <p className="text-base font-medium text-[var(--text-primary)]">{item.question}</p>
                    </div>
                  </div>

                  {/* Options */}
                  {Array.isArray(item.options) && item.options.length > 0 ? (
                    <div className="grid gap-2 ml-11">
                      {item.options.map((opt) => {
                        const isSelected = answers[item.id] === opt;
                        const showCorrect = feedback && opt === feedback.correct_answer;
                        const showWrong = feedback && isSelected && !isCorrect;

                        return (
                          <label
                            key={opt}
                            className={`
                              flex items-center gap-3 p-3 rounded-xl cursor-pointer
                              border transition-all duration-200
                              ${
                                result
                                  ? showCorrect
                                    ? "border-emerald-300 bg-emerald-50"
                                    : showWrong
                                      ? "border-rose-300 bg-rose-50"
                                      : "border-[var(--border-light)] bg-[var(--bg-secondary)]"
                                  : isSelected
                                    ? "border-brand-400 bg-brand-50 text-brand-700"
                                    : "border-[var(--border-light)] bg-[var(--bg-secondary)] hover:border-brand-300"
                              }
                            `}
                          >
                            <input
                              type="radio"
                              name={item.id}
                              value={opt}
                              checked={isSelected}
                              onChange={() =>
                                setAnswers((prev) => ({ ...prev, [item.id]: opt }))
                              }
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
                          setAnswers((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        disabled={!!result}
                        placeholder="Nhập đáp án..."
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

                  {feedback && feedback.explanation && (
                    <p className="text-xs text-[var(--text-secondary)] mt-3 p-2 bg-[var(--bg-secondary)] rounded">
                      💡 {feedback.explanation}
                    </p>
                  )}
                </Card>
              </motion.div>
            );
          })}

          {!result && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center pt-4">
              <Button
                size="lg"
                onClick={handleSubmit}
                loading={isSubmitting}
                icon={<Sparkles className="w-5 h-5" />}
              >
                Nộp bài
              </Button>
            </motion.div>
          )}

          {result && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center pt-4">
              <Button size="lg" variant="secondary" onClick={handleReset}>
                Làm lại
              </Button>
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  );
}
