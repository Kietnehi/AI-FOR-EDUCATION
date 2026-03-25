"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Trophy, RotateCcw, CheckCircle2, AlertCircle, Zap } from "lucide-react";

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

    // Move to next node after short delay
    setTimeout(() => {
      if (choice.next_node_id) {
        setNodeHistory((prev) => [...prev, choice.next_node_id!]);
      }
      setSelectedFeedback(null);
    }, 2000);
  }

  async function handleFinishScenario() {
    if (currentScenarioIdx < scenarios.length - 1) {
      // Move to next scenario
      setCurrentScenarioIdx(currentScenarioIdx + 1);
      setNodeHistory([]);
      setAnswers([]);
      setSelectedFeedback(null);
    } else {
      // All scenarios done, submit
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
    return <div className="text-center py-8">Đang tải...</div>;
  }

  // Initialize on scenario change
  if (scenario && nodeHistory.length === 0) {
    initScenario();
  }

  if (result) {
    // Result screen
    const skillsList = result.skills_gained || [];
    const tips = result.improvement_tips || [];

    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">{title}</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Hoàn thành {scenarios.length} kịch bản
          </p>
        </div>

        {/* Score Banner */}
        <Card className="relative overflow-hidden !border-emerald-200 !bg-gradient-to-r from-emerald-50 to-brand-50">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-200/30 rounded-full -translate-y-1/2 translate-x-1/4 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h3
                className="text-xl font-bold text-emerald-800"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Điểm số: {Math.round(result.score)}/{Math.round(result.max_score)}
              </h3>
              <p className="text-sm text-emerald-600 mt-1">
                Bạn đã hoàn thành tất cả các kịch bản! 🎉
              </p>
            </div>
          </div>
        </Card>

        {/* Skills Gained */}
        {skillsList.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Kỹ năng học được
            </h4>
            <div className="grid gap-2">
              {skillsList.map((skill: string) => (
                <div
                  key={skill}
                  className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800"
                >
                  ✓ {skill}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Improvement Tips */}
        {tips.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-blue-500" />
              Gợi ý cải thiện
            </h4>
            <div className="grid gap-2">
              {tips.map((tip: string) => (
                <div
                  key={tip}
                  className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800"
                >
                  💡 {tip}
                </div>
              ))}
            </div>
          </div>
        )}

        <Button size="lg" variant="secondary" onClick={handleReset} className="w-full">
          <RotateCcw className="w-4 h-4" />
          Chơi lại
        </Button>
      </motion.div>
    );
  }

  if (!scenario || !currentNode) {
    return <div className="text-center py-8">Đang tải kịch bản...</div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-brand-100 text-brand-700">
            Kịch bản {currentScenarioIdx + 1}/{scenarios.length}
          </span>
        </div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">{scenario.title}</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-2">{scenario.description}</p>
      </div>

      {/* Scenario Prompt */}
      <Card className="!border-brand-300 !bg-gradient-to-br from-brand-50 to-accent-50">
        <p className="text-base text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
          {currentNode.prompt}
        </p>
      </Card>

      {/* Choices */}
      {currentNode.choices && currentNode.choices.length > 0 && !currentNode.is_end && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-[var(--text-secondary)]">Bạn sẽ chọn gì?</p>
          <div className="grid gap-3">
            {currentNode.choices.map((choice) => {
              const isSelected =
                answers.findIndex((a) => a.node_id === currentNode.id && a.answer === choice.id) !== -1;

              return (
                <motion.button
                  key={choice.id}
                  onClick={() => handleChoice(choice)}
                  disabled={selectedFeedback !== null}
                  className={`
                    text-left p-4 rounded-lg border-2 transition-all
                    ${
                      isSelected
                        ? "border-brand-400 bg-brand-50"
                        : "border-[var(--border-light)] bg-[var(--bg-secondary)] hover:border-brand-300"
                    }
                    ${selectedFeedback ? "opacity-60 cursor-not-allowed" : ""}
                  `}
                  whileHover={selectedFeedback ? {} : { scale: 1.02 }}
                  whileTap={selectedFeedback ? {} : { scale: 0.98 }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`
                      w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5
                      ${
                        isSelected
                          ? "border-brand-500 bg-brand-500"
                          : `border-[var(--border-light)] bg-[var(--bg-primary)]`
                      }
                    `}
                    >
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-[var(--text-primary)]">{choice.text}</p>
                      {/* Impact indicator */}
                      <div className="flex items-center gap-1 mt-1">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded
                          ${
                            choice.impact === "positive"
                              ? "bg-emerald-100 text-emerald-700"
                              : choice.impact === "negative"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-amber-100 text-amber-700"
                          }
                        `}
                        >
                          {choice.impact === "positive"
                            ? "👍 Tích cực"
                            : choice.impact === "negative"
                              ? "😟 Tiêu cực"
                              : "😐 Trung lập"}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-[var(--text-tertiary)] flex-shrink-0 mt-1" />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* Feedback */}
      <AnimatePresence>
        {selectedFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="!border-blue-300 !bg-blue-50">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-900">{selectedFeedback}</p>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* End Node Result */}
      {currentNode.is_end && currentNode.result && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="!border-emerald-300 !bg-emerald-50">
            <div className="grid gap-4">
              <div>
                <p className="text-xs text-emerald-600 font-semibold uppercase mb-1">Điểm kịch bản này</p>
                <p className="text-2xl font-bold text-emerald-800">
                  {currentNode.result.score} điểm
                </p>
              </div>
              {currentNode.result.skills_gained.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-emerald-700 mb-2">
                    Kỹ năng học được:
                  </p>
                  <div className="space-y-1">
                    {currentNode.result.skills_gained.map((skill) => (
                      <p key={skill} className="text-sm text-emerald-700">
                        ✓ {skill}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Button
            size="lg"
            onClick={handleFinishScenario}
            loading={isSubmitting}
            className="w-full"
          >
            {currentScenarioIdx < scenarios.length - 1 ? "Tiếp theo" : "Xem kết quả tổng"}
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}
