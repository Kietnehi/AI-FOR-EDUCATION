"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Gamepad2,
  ArrowLeft,
  BookOpen,
  Sparkles,
  Zap,
  Brain,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { getGeneratedContent, generateMinigame, submitGameAttempt } from "@/lib/api";
import { GeneratedContent } from "@/types";
import { QuizMixedPlayer } from "@/components/minigame/QuizMixedPlayer";
import { FlashcardPlayer } from "@/components/minigame/FlashcardPlayer";
import { ScenarioPlayer } from "@/components/minigame/ScenarioPlayer";

type LegacyScenarioChoice = {
  id: string;
  text: string;
  feedback: string;
  impact: "positive" | "negative" | "neutral";
  next_node_id?: string;
};

type LegacyScenarioNode = {
  id: string;
  prompt: string;
  choices?: LegacyScenarioChoice[];
  is_end?: boolean;
  result?: {
    score: number;
    skills_gained: string[];
    improvement_tips: string[];
  };
};

type LegacyScenario = {
  id: string;
  title: string;
  description: string;
  root_node_id: string;
  nodes: LegacyScenarioNode[];
};

function normalizeImpact(score: number): "positive" | "negative" | "neutral" {
  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

function mapStrictScenarioToLegacy(jsonContent: Record<string, any>): LegacyScenario[] {
  const game = jsonContent?.game;
  if (!game || !Array.isArray(game.steps)) return [];

  const endingsById = new Map<string, any>();
  const endings = Array.isArray(game.endings) ? game.endings : [];
  endings.forEach((ending: any) => {
    if (ending?.id) endingsById.set(`ending_${ending.id}`, ending);
  });

  const nodes: LegacyScenarioNode[] = game.steps.map((step: any) => ({
    id: step.id,
    prompt: `${step.scenario || ""}${step.knowledge_point ? `\n\nKien thuc trong tam: ${step.knowledge_point}` : ""}`,
    choices: Array.isArray(step.choices)
      ? step.choices.map((choice: any) => {
          const scoreDelta = Number(choice?.effects?.score || 0);
          return {
            id: choice.id,
            text: choice.text || "",
            feedback: `${choice.feedback || ""}${choice.learning_explanation ? `\n\nBai hoc: ${choice.learning_explanation}` : ""}`,
            impact: normalizeImpact(scoreDelta),
            next_node_id: choice.next_step,
          };
        })
      : [],
  }));

  // Build end nodes so existing ScenarioPlayer can render completion screens.
  endingsById.forEach((ending, endingNodeId) => {
    nodes.push({
      id: endingNodeId,
      prompt: ending.summary || "Ket thuc kich ban",
      is_end: true,
      result: {
        score: 0,
        skills_gained: (game.initial_state?.skills && Object.keys(game.initial_state.skills)) || [],
        improvement_tips: ending.suggestion ? [ending.suggestion] : [],
      },
    });
  });

  return [
    {
      id: "scenario_main",
      title: game.title || "Kich ban hoc tap",
      description: "Mo phong ra quyet dinh theo tinh huong tu hoc lieu",
      root_node_id: (game.steps[0] && game.steps[0].id) || "step1",
      nodes,
    },
  ];
}

export default function MinigamePage() {
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const contentId = searchParams.get("contentId") || "";
  const materialId = params.id;

  const [content, setContent] = useState<GeneratedContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectingGameType, setSelectingGameType] = useState(false);
  const [generatingGame, setGeneratingGame] = useState(false);

  useEffect(() => {
    if (!contentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getGeneratedContent(contentId)
      .then(setContent)
      .catch((error) => {
        console.error('Error fetching game content:', error);
        setContent(null);
      })
      .finally(() => setLoading(false));
  }, [contentId]);

  async function handleSelectGameType(
    gameType: "quiz_mixed" | "flashcard" | "scenario_branching"
  ) {
    setGeneratingGame(true);
    try {
      const generated = await generateMinigame(materialId, gameType);
      router.push(`/materials/${materialId}/minigame?contentId=${generated.id}`);
    } catch (error) {
      console.error(error);
      setGeneratingGame(false);
    }
  }

  async function handleSubmitAttempt(answers: Array<{ id?: string; node_id?: string; answer: string }>) {
    return await submitGameAttempt(contentId, answers);
  }

  const gameTypeConfig = {
    quiz_mixed: {
      title: "Trắc nghiệm hỗn hợp",
      description: "Mix 4 dạng: trắc nghiệm, đúng/sai, chọn nhiều, điền từ",
      icon: BookOpen,
      color: "from-brand-500 to-brand-600",
    },
    flashcard: {
      title: "Flashcard",
      description: "Lật thẻ để học & nhớ siêu mạnh",
      icon: Brain,
      color: "from-amber-500 to-amber-600",
    },
    scenario_branching: {
      title: "Game nhập vai",
      description: "Kịch bản giả lập với rẽ nhánh quyết định",
      icon: Sparkles,
      color: "from-accent-500 to-accent-600",
    },
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
          <Link
            href={`/materials/${materialId}`}
            className="hover:text-brand-600 transition-colors no-underline text-[var(--text-tertiary)]"
          >
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
      </div>

      {loading && <CardSkeleton />}

      {!loading && !contentId && (
        <>
          {selectingGameType ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                  Chọn loại minigame
                </h2>
                <p className="text-sm text-[var(--text-secondary)] mt-2">
                  Lựa chọn cách học tập phù hợp với bạn
                </p>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                {(
                  Object.entries(gameTypeConfig) as Array<
                    [
                      "quiz_mixed" | "flashcard" | "scenario_branching",
                      typeof gameTypeConfig.quiz_mixed,
                    ]
                  >
                ).map(([gameType, config]) => {
                  const Icon = config.icon;
                  return (
                    <Card
                      key={gameType}
                      hover
                      className="group flex flex-col"
                    >
                      <div
                        className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${config.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
                      >
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">
                        {config.title}
                      </h3>
                      <p className="text-sm text-[var(--text-secondary)] mb-6 flex-1">
                        {config.description}
                      </p>
                      <Button
                        size="sm"
                        onClick={() => handleSelectGameType(gameType)}
                        loading={generatingGame}
                        disabled={generatingGame}
                      >
                        Chọn
                      </Button>
                    </Card>
                  );
                })}
              </div>

              <Button
                variant="secondary"
                onClick={() => setSelectingGameType(false)}
              >
                Quay lại
              </Button>
            </div>
          ) : (
            <EmptyState
              icon={<Gamepad2 className="w-10 h-10" />}
              title="Chưa có minigame"
              description="Hãy tạo minigame từ trang chi tiết học liệu."
              action={
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={() => setSelectingGameType(true)}
                    icon={<Sparkles className="w-4 h-4" />}
                  >
                    Tạo minigame mới
                  </Button>
                  <Link href={`/materials/${materialId}`}>
                    <Button variant="secondary">Quay lại tạo</Button>
                  </Link>
                </div>
              }
            />
          )}
        </>
      )}

      {!loading && contentId && content && (
        <div className="pt-4">
          {content.game_type === "quiz_mixed" && (
            <QuizMixedPlayer
              title={content.json_content?.title || "Quiz hỗn hợp"}
              items={content.json_content?.items || []}
              onSubmit={handleSubmitAttempt}
            />
          )}

          {content.game_type === "flashcard" && (
            <FlashcardPlayer
              title={content.json_content?.title || "Flashcard"}
              items={content.json_content?.items || []}
              onSubmit={handleSubmitAttempt}
            />
          )}

          {content.game_type === "scenario_branching" && (
            <ScenarioPlayer
              title={content.json_content?.game?.title || content.json_content?.title || "Kịch bản học tập"}
              scenarios={
                Array.isArray(content.json_content?.scenarios)
                  ? content.json_content.scenarios
                  : mapStrictScenarioToLegacy(content.json_content || {})
              }
              onSubmit={handleSubmitAttempt}
            />
          )}
        </div>
      )}

      {loading && contentId && (
        <div className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {!loading && contentId && !content && (
        <EmptyState
          icon={<Gamepad2 className="w-10 h-10" />}
          title="Không thể tải minigame"
          description="Vui lòng thử lại hoặc tạo minigame mới."
          action={
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => router.push(`/materials/${materialId}/minigame`)}
                icon={<Sparkles className="w-4 h-4" />}
              >
                Tạo minigame mới
              </Button>
              <Link href={`/materials/${materialId}`}>
                <Button variant="secondary">Quay lại</Button>
              </Link>
            </div>
          }
        />
      )}
    </motion.div>
  );
}
