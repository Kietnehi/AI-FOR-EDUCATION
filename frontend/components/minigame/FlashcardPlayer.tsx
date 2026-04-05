"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, RotateCcw, Trophy, Sparkles, BookOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface FlashcardItem {
  id: string;
  front: string;
  back: string;
  tags?: string[];
}

interface FlashcardPlayerProps {
  title: string;
  items: FlashcardItem[];
  onSubmit: (answers: Array<{ id: string; answer: string }>) => Promise<any>;
  loading?: boolean;
}

export function FlashcardPlayer({ title, items, onSubmit, loading }: FlashcardPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const current = items[currentIndex];
  const answered = Object.keys(answers).length;
  const progress = (answered / items.length) * 100;

  function handleNext() {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    }
  }

  function handlePrev() {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    }
  }

  function handleKnown() {
    if (current) {
      setAnswers((prev) => ({ ...prev, [current.id]: "known" }));
      handleNext();
    }
  }

  function handleUnknown() {
    if (current) {
      setAnswers((prev) => ({ ...prev, [current.id]: "unknown" }));
      handleNext();
    }
  }

  async function handleFinish() {
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
    setCurrentIndex(0);
    setIsFlipped(false);
    setAnswers({});
    setResult(null);
  }

  if (loading) {
    return <div className="text-center py-8">Đang tải...</div>;
  }

  if (result) {
    // Result screen
    const knownCount = Object.values(answers).filter((v) => v === "known").length;

    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">{title}</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Kết quả học tập</p>
        </div>

        <Card className="relative overflow-hidden !border-emerald-200 !bg-gradient-to-r from-emerald-50 to-brand-50">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-200/30 rounded-full -translate-y-1/2 translate-x-1/4 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-emerald-800" style={{ fontFamily: "var(--font-display)" }}>
                Mastery: {Math.round((knownCount / items.length) * 100)}%
              </h3>
              <p className="text-sm text-emerald-600 mt-1">
                Bạn đã học được {knownCount}/{items.length} thẻ 🎉
              </p>
            </div>
          </div>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button size="lg" variant="secondary" onClick={handleReset} className="flex-1">
            <RotateCcw className="w-4 h-4" />
            Học lại
          </Button>
          <Button size="lg" className="flex-1">
            Tiếp tục
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">{title}</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {items.length} thẻ &bull; Lật để xem đáp án
        </p>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--text-secondary)]">Tiến độ học</span>
          <span className="font-semibold text-[var(--text-primary)]">
            {answered}/{items.length}
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Flashcard */}
      {current && (
        <div className="space-y-6">
          <div className="relative perspective">
            <AnimatePresence mode="wait">
              <motion.div
                key={isFlipped ? "back" : "front"}
                initial={{ rotate: 8, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -8, opacity: 0 }}
                transition={{ duration: 0.4 }}
                onClick={() => setIsFlipped(!isFlipped)}
                className="cursor-pointer"
              >
                <Card
                  className="!border-brand-400/60 !shadow-lg h-64 flex flex-col items-center justify-center text-center p-8 bg-[linear-gradient(145deg,var(--bg-elevated),var(--bg-secondary))] hover:shadow-xl transition-all"
                >
                  <div className="text-sm text-[var(--text-tertiary)] mb-4">
                    {isFlipped ? "Đáp án" : "Câu hỏi"} &bull; {currentIndex + 1}/{items.length}
                  </div>
                  {isFlipped && (
                    <div className="text-xs text-emerald-600 mb-3 flex items-center gap-1">
                      <BookOpen className="w-3 h-3" /> Nhấp để xem câu hỏi
                    </div>
                  )}
                  <p
                    className="text-2xl font-bold text-[var(--text-primary)]"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {isFlipped ? current.back : current.front}
                  </p>
                  {current.tags && current.tags.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2 mt-4">
                      {current.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-1 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Card>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePrev}
              disabled={currentIndex === 0}
              icon={<ChevronLeft className="w-4 h-4" />}
            >
              Trước
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={handleUnknown}
                className="text-[var(--text-secondary)] border-[var(--border-light)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
              >
                Chưa biết
              </Button>
              <Button
                variant="secondary"
                onClick={handleKnown}
                className="text-[var(--text-primary)] border-brand-400/60 hover:bg-brand-500/15"
              >
                Biết rồi
              </Button>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleNext}
              disabled={currentIndex === items.length - 1}
              icon={<ChevronRight className="w-4 h-4" />}
            >
              Sau
            </Button>
          </div>

          {/* Finish Button */}
          {answered === items.length && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Button
                size="lg"
                onClick={handleFinish}
                loading={isSubmitting}
                icon={<Sparkles className="w-5 h-5" />}
                className="w-full"
              >
                Xem kết quả
              </Button>
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  );
}
