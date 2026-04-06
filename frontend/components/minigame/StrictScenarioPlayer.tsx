"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, RotateCcw, AlertCircle, Trophy, Target, CheckCircle2 } from "lucide-react";

import { Card } from "@/components/ui/card";
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
  const [selectedLearning, setSelectedLearning] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Array<{ step_id: string; answer: string }>>([]);
  const [localScore, setLocalScore] = useState<number>(game.initial_state?.score || 0);
  const [localSkills, setLocalSkills] = useState<SkillMap>(game.initial_state?.skills || {});
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
    setSelectedLearning(choice.learning_explanation || "");

    setAnswers((prev) => [...prev, { step_id: stepId, answer: choice.id }]);
    setLocalScore((prev) => prev + Number(choice.effects?.score || 0));
    setLocalSkills((prev) => {
      const next = { ...prev };
      const delta = choice.effects?.skills || {};
      for (const [key, val] of Object.entries(delta)) {
        next[key] = (next[key] || 0) + Number(val || 0);
      }
      return next;
    });

    setTimeout(() => {
      setSelectedFeedback(null);
      setSelectedLearning(null);
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
    }, 2800);
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
    setSelectedLearning(null);
    setAnswers([]);
    setLocalScore(game.initial_state?.score || 0);
    setLocalSkills(game.initial_state?.skills || {});
    setSubmitResult(null);
  }

  if (submitResult) {
    const skills = submitResult.skills_gained || Object.keys(localSkills).filter((k) => localSkills[k] > 0);
    const tips = submitResult.improvement_tips || [];

    return (
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="max-w-4xl mx-auto space-y-8 py-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2" style={{ fontFamily: "var(--font-display)" }}>Hoàn Thành Nhiệm Vụ!</h2>
          <p className="text-[var(--text-secondary)]">Bạn đã xuất sắc vượt qua tất cả tình huống.</p>
        </div>

        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-3xl p-8 border border-emerald-100 flex flex-col items-center justify-center text-center relative overflow-hidden">
           <div className="w-24 h-24 bg-[var(--bg-elevated)] rounded-full flex items-center justify-center shadow-sm mb-6 z-10 border border-[var(--border-light)]">
             <Trophy className="w-12 h-12 text-emerald-500" />
          </div>
          <h3 className="text-4xl font-black text-emerald-800 mb-2 z-10" style={{ fontFamily: "var(--font-display)" }}>
            {Math.round(submitResult.score || localScore)} / {Math.round(submitResult.max_score || Math.max(localScore, 10))}
          </h3>
          <p className="text-emerald-600 font-medium z-10">Điểm số tổng kết của bạn</p>
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-200/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {skills.length > 0 && (
            <div className="bg-[var(--bg-elevated)] rounded-3xl p-6 border border-[var(--border-light)] shadow-sm">
              <h4 className="font-bold text-[var(--text-primary)] flex items-center gap-3 mb-4 text-lg">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-amber-600" />
                </div>
                Kỹ năng đạt được
              </h4>
              <ul className="space-y-3">
                {skills.map((skill: string) => (
                  <li key={skill} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <span className="text-[var(--text-secondary)] font-medium">{skill}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tips.length > 0 && (
            <div className="bg-[var(--bg-elevated)] rounded-3xl p-6 border border-[var(--border-light)] shadow-sm">
              <h4 className="font-bold text-[var(--text-primary)] flex items-center gap-3 mb-4 text-lg">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-blue-600" />
                </div>
                Gợi ý cải thiện
              </h4>
              <ul className="space-y-3">
                {tips.map((tip: string) => (
                  <li key={tip} className="flex items-start gap-3">
                    <ArrowRight className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    <span className="text-[var(--text-secondary)] font-medium">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex justify-center pt-4">
          <Button size="lg" onClick={handleReset} className="px-10 h-14 rounded-full text-lg shadow-brand border-0 bg-brand-600 hover:bg-brand-700">
            <RotateCcw className="w-5 h-5 mr-2" />
            Chơi lại từ đầu
          </Button>
        </div>
      </motion.div>
    );
  }

  if (currentEnding) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="max-w-4xl mx-auto space-y-8 py-8 text-center pt-20">
        <div className="inline-block bg-brand-50 border-2 border-brand-100 rounded-3xl p-10 max-w-2xl mx-auto w-full">
            <div className="w-20 h-20 rounded-full bg-brand-600 text-white flex items-center justify-center mx-auto mb-6 shadow-brand">
              <Trophy className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-brand-900 mb-4" style={{ fontFamily: "var(--font-display)" }}>Kịch Bản Đã Hoàn Tất</h3>
            <p className="text-brand-800 font-medium mb-3 text-lg leading-relaxed">{currentEnding.summary}</p>
            <p className="text-brand-700 mb-10 text-sm">Gợi ý: {currentEnding.suggestion}</p>
            
            <Button
              size="lg"
              onClick={handleSubmit}
              loading={isSubmitting}
              className="w-full sm:w-auto px-12 h-14 rounded-full text-lg shadow-brand bg-brand-600 hover:bg-brand-700 border-0"
            >
              Gửi kết quả
              <ArrowRight className="w-5 h-5 ml-2" />
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
    <div className="max-w-5xl mx-auto w-full pt-4 pb-12 animate-fade-in-up">
      {/* HEADER */}
      <div className="flex items-end justify-between mb-2">
        <div>
          <span className="inline-block text-xs font-bold px-3 py-1 rounded bg-brand-100 text-brand-700 mb-3 tracking-wide uppercase">
            {stepText}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] leading-tight" style={{ fontFamily: "var(--font-display)" }}>
            {game.title}
          </h1>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Score</div>
          <div className="text-2xl font-black text-[var(--text-primary)] leading-none">{Math.round(localScore)}</div>
        </div>
      </div>
      
      {/* PROGRESS BAR */}
      <div className="w-full h-px bg-[var(--border-light)] mb-8 relative">
        <div className="absolute top-0 left-0 h-[3px] -mt-[1px] bg-brand-500 rounded-full" style={{ width: `${Math.max(8, (Math.min(completedSteps + 1, totalSteps) / Math.max(totalSteps, 1)) * 100)}%`, transition: 'width 0.5s ease-in-out' }} />
      </div>

      {/* QUESTION BOX */}
      <motion.div 
        key={currentStep.id} 
        initial={{ opacity: 0, x: -20 }} 
        animate={{ opacity: 1, x: 0 }}
        className="bg-[var(--bg-elevated)] border-[1.5px] border-[var(--border-light)] rounded-2xl p-6 sm:p-8 mb-8 shadow-sm"
      >
        <p className="text-lg text-[var(--text-primary)] font-medium leading-[1.7] whitespace-pre-wrap mb-4">
          {currentStep.scenario}
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-[var(--text-secondary)] bg-[var(--bg-secondary)] px-3 py-2 leading-none w-fit rounded border border-[var(--border-light)] shadow-xs">
          <div className="flex items-center gap-2 shrink-0">
             <Target className="w-4 h-4 text-brand-500" />
             <span className="font-semibold text-brand-600">Mục tiêu kỹ năng:</span>
          </div>
          <span>{currentStep.knowledge_point || "Đưa ra quyết định tốt nhất."}</span>
        </div>
      </motion.div>

      {/* CHOICES LIST */}
      <div className="space-y-4">
        {currentStep.choices.map((choice, index) => {
          const letterLabel = String.fromCharCode(65 + index); // A, B, C
          const isSelected = answers.some((a) => a.step_id === currentStep.id && a.answer === choice.id);
          const isProcessing = selectedFeedback !== null;
          
          return (
            <motion.button
              key={choice.id}
              onClick={() => handleChoice(choice)}
              disabled={isProcessing}
              className={`
                group w-full text-left bg-[var(--bg-elevated)] border border-[var(--border-light)] rounded-2xl p-5 sm:p-6
                flex items-center justify-between transition-all duration-300 relative overflow-hidden
                ${isSelected ? "ring-2 ring-brand-400/70 border-brand-400/70 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.18)]" : "hover:border-brand-300 hover:shadow-md cursor-pointer"}
                ${isProcessing && !isSelected ? "opacity-50 cursor-not-allowed" : ""}
              `}
            >
              <div className="flex flex-col gap-2 relative z-10 w-full pr-8">
                <span className={`text-[11px] font-bold px-3 py-1 rounded bg-brand-50 text-brand-600 w-fit`}>
                  Lựa chọn {letterLabel}
                </span>
                <p className="text-[15px] sm:text-base font-semibold text-[var(--text-primary)] mt-1">
                  {choice.text}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)] font-medium mt-1 opacity-80">
                  <span>+{choice.effects?.score ?? 0} điểm</span>
                  <span className="text-[var(--border-default)]">|</span>
                  <span>kỹ năng: <span className="text-brand-600">{Object.keys(choice.effects?.skills || {}).join(", ") || "n/a"}</span></span>
                </div>
              </div>
              <div className="relative z-10 w-10 h-10 shrink-0 flex items-center justify-center text-[var(--text-tertiary)] group-hover:text-brand-500 transition-colors">
                {isSelected ? <CheckCircle2 className="w-6 h-6 text-brand-500" /> : <ArrowRight className="w-5 h-5" />}
              </div>

              {isSelected && <div className="absolute inset-0 bg-brand-500/12 z-0" />}
            </motion.button>
          );
        })}
      </div>

      {/* FEEDBACK POPUP OVERLAY */}
      <AnimatePresence>
        {selectedFeedback && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4"
          >
            <div className="bg-[var(--bg-elevated)] p-6 rounded-3xl shadow-2xl flex flex-col sm:flex-row items-start gap-4 border border-[var(--border-light)]">
              <div className="w-12 h-12 rounded-full bg-brand-500 flex items-center justify-center shrink-0">
                 <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
               <h4 className="font-bold text-sm text-brand-600 mb-2 uppercase tracking-wide">Phản hồi hệ thống</h4>
               <p className="text-sm text-[var(--text-primary)] leading-relaxed font-medium mb-3">{selectedFeedback}</p>
                {selectedLearning && (
                 <div className="mt-3 p-3 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-light)] text-[13px] text-[var(--text-secondary)] leading-relaxed">
                      Lý giải: {selectedLearning}
                   </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
