"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Trophy, RotateCcw, CheckCircle2, AlertCircle, Zap, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Choice {
  id: string;
  text: string;
  feedback: string;
  impact: "positive" | "negative" | "neutral";
  next_node_id?: string;
}

interface ScenarioNode {
  id: string;
  prompt: string;
  choices?: Choice[];
  is_end?: boolean;
  result?: {
    score: number;
    skills_gained: string[];
    improvement_tips: string[];
  };
}

interface Scenario {
  id: string;
  title: string;
  description: string;
  root_node_id: string;
  nodes: ScenarioNode[];
}

interface ScenarioPlayerProps {
  title: string;
  scenarios: Scenario[];
  onSubmit: (answers: Array<{ node_id: string; answer: string }>) => Promise<any>;
  loading?: boolean;
}

export function ScenarioPlayer({
  title,
  scenarios,
  onSubmit,
  loading,
}: ScenarioPlayerProps) {
  const [currentScenarioIdx, setCurrentScenarioIdx] = useState(0);
  const [nodeHistory, setNodeHistory] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Array<{ node_id: string; answer: string }>>([]);
  const [result, setResult] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<string | null>(null);

  const scenario = scenarios[currentScenarioIdx];
  const nodeMap = scenario
    ? Object.fromEntries(scenario.nodes.map((n) => [n.id, n]))
    : {};
  const currentNodeId = nodeHistory.length > 0 ? nodeHistory[nodeHistory.length - 1] : scenario?.root_node_id;
  const currentNode = currentNodeId ? nodeMap[currentNodeId] : null;

  function initScenario() {
    setNodeHistory([scenario.root_node_id]);
    setAnswers([]);
    setSelectedFeedback(null);
  }

  function handleChoice(choice: Choice) {
    setSelectedFeedback(choice.feedback);
    setAnswers((prev) => [
      ...prev,
      { node_id: currentNodeId, answer: choice.id },
    ]);

    setTimeout(() => {
      if (choice.next_node_id) {
        setNodeHistory((prev) => [...prev, choice.next_node_id!]);
      }
      setSelectedFeedback(null);
    }, 2500);
  }

  async function handleFinishScenario() {
    if (currentScenarioIdx < scenarios.length - 1) {
      setCurrentScenarioIdx(currentScenarioIdx + 1);
      setNodeHistory([]);
      setAnswers([]);
      setSelectedFeedback(null);
    } else {
      handleSubmitAll();
    }
  }

  async function handleSubmitAll() {
    setIsSubmitting(true);
    try {
      const submitted = await onSubmit(answers);
      setResult(submitted);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReset() {
    setCurrentScenarioIdx(0);
    setNodeHistory([]);
    setAnswers([]);
    setResult(null);
    setSelectedFeedback(null);
  }

  if (loading) {
    return <div className="text-center py-12 text-[var(--text-secondary)]">Đang tải tiến trình game...</div>;
  }

  if (scenario && nodeHistory.length === 0) {
    initScenario();
  }

  if (result) {
    const skillsList = result.skills_gained || [];
    const tips = result.improvement_tips || [];

    return (
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="max-w-4xl mx-auto space-y-8 py-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2" style={{ fontFamily: "var(--font-display)" }}>Hoàn Thành Nhiệm Vụ!</h2>
          <p className="text-[var(--text-secondary)]">
            Bạn đã vượt qua {scenarios.length} thử thách kịch bản.
          </p>
        </div>

        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-3xl p-8 border border-emerald-100 flex flex-col items-center justify-center text-center relative overflow-hidden">
           <div className="w-24 h-24 bg-[var(--bg-elevated)] rounded-full flex items-center justify-center shadow-sm mb-6 z-10 border border-[var(--border-light)]">
             <Trophy className="w-12 h-12 text-emerald-500" />
          </div>
          <h3 className="text-4xl font-black text-emerald-800 mb-2 z-10" style={{ fontFamily: "var(--font-display)" }}>
            {Math.round(result.score)} / {Math.round(result.max_score)}
          </h3>
          <p className="text-emerald-600 font-medium z-10">Điểm số tổng kết của bạn</p>
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-200/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {skillsList.length > 0 && (
            <div className="bg-[var(--bg-elevated)] rounded-3xl p-6 border border-[var(--border-light)] shadow-sm">
              <h4 className="font-bold text-[var(--text-primary)] flex items-center gap-3 mb-4 text-lg">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-amber-600" />
                </div>
                Kỹ năng đạt được
              </h4>
              <ul className="space-y-3">
                {skillsList.map((skill: string) => (
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

  if (!scenario || !currentNode) {
    return <div className="text-center py-12 text-[var(--text-secondary)]">Đang tải dữ liệu trò chơi...</div>;
  }

  const stepText = `Step ${currentScenarioIdx + 1}/${scenarios.length}`;

  return (
    <div className="max-w-5xl mx-auto w-full pt-4 pb-12 animate-fade-in-up">
      {/* HEADER -> Like in Mockup */}
      <div className="flex items-end justify-between mb-2">
        <div>
          <span className="inline-block text-xs font-bold px-3 py-1 rounded bg-brand-100 text-brand-700 mb-3 tracking-wide uppercase">
            {stepText}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
            {scenario.title}
          </h1>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Score</div>
          <div className="text-2xl font-black text-[var(--text-primary)] leading-none">{answers.length * 10}</div>
        </div>
      </div>
      
      {/* Horizontal Divider Line */}
      <div className="w-full h-px bg-[var(--border-light)] mb-8 relative">
        <div className="absolute top-0 left-0 h-[3px] -mt-[1px] bg-brand-500 rounded-full" style={{ width: `${((currentScenarioIdx + 1) / scenarios.length) * 100}%`, transition: 'width 0.5s ease-in-out' }} />
      </div>

      {/* QUESTION BOX */}
      <motion.div 
        key={currentNode.id} 
        initial={{ opacity: 0, x: -20 }} 
        animate={{ opacity: 1, x: 0 }}
        className="bg-[var(--bg-elevated)] border-[1.5px] border-[var(--border-light)] rounded-2xl p-6 sm:p-8 mb-8 shadow-sm"
      >
        <p className="text-lg text-[var(--text-primary)] font-medium leading-[1.7] whitespace-pre-wrap mb-4">
          {currentNode.prompt}
        </p>
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] bg-[var(--bg-secondary)] px-3 py-2 leading-none w-fit rounded border border-[var(--border-light)] shadow-xs">
          <Target className="w-4 h-4 text-brand-500" />
          <span>Hệ thống ghi nhận sự lựa chọn của bạn để đánh giá.</span>
        </div>
      </motion.div>

      {/* CHOICES LIST */}
      <div className="space-y-4">
        {currentNode.choices && !currentNode.is_end && currentNode.choices.map((choice, index) => {
          const letterLabel = String.fromCharCode(65 + index); // A, B, C...
          const isSelected = answers.some((a) => a.node_id === currentNode.id && a.answer === choice.id);
          const isProcessing = selectedFeedback !== null;
          
          let impactColor = "text-brand-500";
          if (choice.impact === "positive") impactColor = "text-emerald-600";
          if (choice.impact === "negative") impactColor = "text-rose-600";
          
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
                <div className="flex items-center text-xs text-[var(--text-secondary)] font-medium">
                  <span className={`${impactColor}`}>
                    {choice.impact === "positive" ? "+ Điểm kinh nghiệm" : choice.impact === "negative" ? "- Điểm cảnh báo" : "Trung lập"}
                  </span>
                  <span className="mx-2 text-[var(--border-default)]">|</span>
                  <span>kỹ năng quyết định</span>
                </div>
              </div>
              <div className="relative z-10 w-10 h-10 shrink-0 flex items-center justify-center text-[var(--text-border)] group-hover:text-brand-500 transition-colors">
                {isSelected ? <CheckCircle2 className="w-6 h-6 text-brand-500" /> : <ArrowRight className="w-5 h-5 text-[var(--text-tertiary)]" />}
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
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4"
          >
            <div className="bg-[var(--bg-elevated)] p-5 rounded-2xl shadow-2xl flex items-start gap-4 border border-[var(--border-light)]">
              <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center shrink-0">
                 <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-brand-600 mb-1">Phản hồi hệ thống</h4>
                <p className="text-sm text-[var(--text-primary)] leading-relaxed font-medium">{selectedFeedback}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NEXT MODULE BLOCK IF END */}
      {currentNode.is_end && currentNode.result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-12 text-center pb-20">
           <div className="inline-block bg-brand-50 border-2 border-brand-100 rounded-3xl p-8 max-w-xl mx-auto">
              <h3 className="text-xl font-bold text-brand-900 mb-2">Hoàn thành chặng kịch bản</h3>
              <p className="text-brand-700 mb-6 font-medium">Bạn đã thu thập được khối lượng kiến thức xuất sắc. Hãy tiếp tục chặng đường tiếp theo.</p>
              <Button
                size="lg"
                onClick={handleFinishScenario}
                loading={isSubmitting}
                className="w-full sm:w-auto px-12 h-14 rounded-full text-lg shadow-brand bg-brand-600 hover:bg-brand-700 border-0"
              >
                {currentScenarioIdx < scenarios.length - 1 ? "Tiếp Tục Kịch Bản" : "Hoàn Tất Game"}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
           </div>
        </motion.div>
      )}

    </div>
  );
}
