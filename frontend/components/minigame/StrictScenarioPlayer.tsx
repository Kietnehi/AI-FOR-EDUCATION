"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, RotateCcw, AlertCircle, Trophy, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";

type SkillMap = Record<string, number>;

type StrictChoice = {
  id: string;
  text: string;
  feedback: string;
  learning_explanation: string;
  next_step: string;
  effects: {
    score: number;
    skills: SkillMap;
  };
};

type StrictStep = {
  id: string;
  scenario: string;
  knowledge_point?: string;
  choices: StrictChoice[];
};

type StrictEnding = {
  id: string;
  summary: string;
  suggestion: string;
};

type StrictGame = {
  title: string;
  initial_state?: {
    score?: number;
    skills?: SkillMap;
  };
  steps: StrictStep[];
  endings: StrictEnding[];
};

interface StrictScenarioPlayerProps {
  game: StrictGame;
  onSubmit: (answers: Array<{ step_id: string; answer: string }>) => Promise<any>;
}

export function StrictScenarioPlayer({ game, onSubmit }: StrictScenarioPlayerProps) {
  const stepMap = useMemo(() => {
    const map = new Map<string, StrictStep>();
    for (const step of game.steps || []) {
      map.set(step.id, step);
    }
    return map;
  }, [game.steps]);

  const endingMap = useMemo(() => {
    const map = new Map<string, StrictEnding>();
    for (const ending of game.endings || []) {
      map.set(ending.id, ending);
    }
    return map;
  }, [game.endings]);

  const startStepId = useMemo(() => {
    if (stepMap.has("step1")) return "step1";
    return game.steps?.[0]?.id || "";
  }, [game.steps, stepMap]);

  const [currentStepId, setCurrentStepId] = useState<string>(startStepId);
  const [selectedFeedback, setSelectedFeedback] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Array<{ step_id: string; answer: string }>>([]);
  const [localScore, setLocalScore] = useState<number>(game.initial_state?.score || 0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);

  const currentStep = stepMap.get(currentStepId);
  const currentEnding = !currentStep ? endingMap.get(currentStepId) : undefined;

  const totalSteps = (game.steps || []).length;
  const completedSteps = answers.length;

  async function handleChoice(choice: StrictChoice) {
    const stepId = currentStep?.id;
    if (!stepId) return;

    setSelectedFeedback(choice.feedback || "");

    setAnswers((prev) => [...prev, { step_id: stepId, answer: choice.id }]);
    setLocalScore((prev) => prev + Number(choice.effects?.score || 0));

    setTimeout(() => {
      setSelectedFeedback(null);
      const next = choice.next_step;
      if (stepMap.has(next) || endingMap.has(next)) {
        setCurrentStepId(next);
        return;
      }

      const fallbackEnding = game.endings?.[0]?.id;
      if (fallbackEnding) {
        setCurrentStepId(fallbackEnding);
        return;
      }

      setCurrentStepId("");
    }, 1400);
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      const result = await onSubmit(answers);
      setSubmitResult(result);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReset() {
    setCurrentStepId(startStepId);
    setSelectedFeedback(null);
    setAnswers([]);
    setLocalScore(game.initial_state?.score || 0);
    setSubmitResult(null);
  }

  if (submitResult) {
    const tips = submitResult.improvement_tips || [];

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-3xl mx-auto py-8"
      >
        <div className="rounded-3xl border border-[var(--border-light)] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600">
            <Trophy className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Game Over</h2>
          <p className="mt-1 text-[var(--text-secondary)]">Bạn đã hoàn thành chuỗi quyết định.</p>

          <div className="mt-6 rounded-2xl bg-[var(--bg-secondary)] px-6 py-5">
            <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Score</p>
            <p className="text-4xl font-black text-[var(--text-primary)]">
              {Math.round(submitResult.score || localScore)}
              <span className="text-xl text-[var(--text-tertiary)]"> / {Math.round(submitResult.max_score || 1)}</span>
            </p>
          </div>

          {tips.length > 0 && (
            <div className="mt-6 rounded-2xl border border-[var(--border-light)] p-4 text-left">
              <p className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Gợi ý cải thiện</p>
              {tips.slice(0, 3).map((tip: string) => (
                <p key={tip} className="text-sm text-[var(--text-secondary)]">- {tip}</p>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              onClick={handleSubmit}
              loading={isSubmitting}
              className="sm:min-w-48"
            >
              Gửi kết quả
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="secondary" onClick={handleReset} className="sm:min-w-48">
              <RotateCcw className="mr-2 h-4 w-4" />
              Chơi lại
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  if (currentEnding) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-3xl py-10"
      >
        <div className="rounded-3xl border border-[var(--border-light)] bg-white p-8 text-center shadow-sm">
          <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Kết cục</p>
          <h3 className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{currentEnding.id.replace("ending_", "").toUpperCase()}</h3>
          <p className="mt-4 text-lg font-semibold text-[var(--text-primary)]">{currentEnding.summary}</p>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">{currentEnding.suggestion}</p>

          <Button
            size="lg"
            onClick={handleSubmit}
            loading={isSubmitting}
            className="mt-6"
          >
            Gửi kết quả
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    );
  }

  if (!currentStep) {
    return (
      <div className="text-center py-12 text-[var(--text-secondary)]">Không tìm thấy tình huống hiện tại. Vui lòng thử lại.</div>
    );
  }

  const stepText = `Step ${Math.min(completedSteps + 1, totalSteps)}/${totalSteps}`;

  return (
    <div className="relative mx-auto min-h-[72vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-[var(--border-light)] bg-gradient-to-br from-slate-50 via-white to-cyan-50 p-5 sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 bottom-0 h-52 w-52 rounded-full bg-emerald-200/30 blur-3xl" />

      <div className="relative z-10 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">{stepText}</p>
          <h2 className="text-xl font-bold text-[var(--text-primary)] sm:text-2xl">{game.title}</h2>
        </div>
        <div className="rounded-xl bg-white/80 px-3 py-2 text-right shadow-sm backdrop-blur">
          <p className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">Score</p>
          <p className="text-xl font-black text-[var(--text-primary)]">{Math.round(localScore)}</p>
        </div>
      </div>

      <div className="relative z-10 mt-4 h-2 w-full overflow-hidden rounded-full bg-white/70">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500"
          style={{ width: `${Math.max(12, (Math.min(completedSteps + 1, totalSteps) / Math.max(totalSteps, 1)) * 100)}%` }}
        />
      </div>

      <motion.div
        key={currentStep.id}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 mt-6 rounded-3xl border border-[var(--border-light)] bg-white/95 p-6 shadow-lg backdrop-blur"
      >
        <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-cyan-700">
          <Zap className="h-3.5 w-3.5" />
          Tình huống trực tiếp
        </div>
        <p className="text-xl font-semibold leading-relaxed text-[var(--text-primary)] sm:text-2xl">
          {currentStep.scenario}
        </p>
        <div className="mt-3 inline-flex rounded-full bg-[var(--bg-secondary)] px-3 py-1 text-xs text-[var(--text-secondary)]">
          {currentStep.knowledge_point || "Ra quyết định nhanh và chính xác"}
        </div>
      </motion.div>

      <div className="relative z-10 mt-5 space-y-3">
        {currentStep.choices.map((choice, index) => {
          const letterLabel = String.fromCharCode(65 + index);
          const isSelected = answers.some((a) => a.step_id === currentStep.id && a.answer === choice.id);
          const isProcessing = selectedFeedback !== null;

          return (
            <motion.button
              key={choice.id}
              onClick={() => handleChoice(choice)}
              disabled={isProcessing}
              className={`
                group w-full rounded-2xl border p-4 text-left transition-all duration-200
                ${isSelected ? "border-cyan-500 bg-cyan-50" : "border-[var(--border-light)] bg-white hover:-translate-y-0.5 hover:border-cyan-300"}
                ${isProcessing && !isSelected ? "opacity-50 cursor-not-allowed" : ""}
              `}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="rounded-full bg-[var(--bg-secondary)] px-2 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                    {letterLabel}
                  </span>
                  <p className="mt-2 text-base font-semibold text-[var(--text-primary)] sm:text-lg">
                    {choice.text}
                  </p>
                </span>
                <div className="mt-1 text-xs text-[var(--text-secondary)]">
                  {choice.effects?.score ?? 0} điểm
                </div>
              </div>
              <ArrowRight className="mt-1 h-5 w-5 text-[var(--text-tertiary)]" />
              </div>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {selectedFeedback && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="absolute bottom-5 left-1/2 z-30 w-[92%] -translate-x-1/2 sm:w-[85%]"
          >
            <div className="rounded-2xl border border-slate-700 bg-slate-900/95 p-4 text-white shadow-2xl">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-cyan-500/20 p-1.5">
                  <AlertCircle className="h-4 w-4 text-cyan-300" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-cyan-300">Phản hồi</p>
                  <p className="text-sm font-medium leading-relaxed text-slate-100">{selectedFeedback}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
