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
  Trash2,
  Clock,
  Target,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  deleteGeneratedContent,
  getGeneratedContent,
  generateMinigame,
  generateRemediationQuickStart,
  getMinigamePersonalization,
  listGeneratedContents,
  submitGameAttempt,
} from "@/lib/api";
import {
  GeneratedContent,
  MinigamePersonalization,
  RemediationQuickStart,
  RemediationQuickStartItem,
} from "@/types";
import { QuizMixedPlayer } from "@/components/minigame/QuizMixedPlayer";
import { FlashcardPlayer } from "@/components/minigame/FlashcardPlayer";
import { ShootingQuizPlayer } from "@/components/minigame/ShootingQuizPlayer";
import { RemediationQuickStartModal } from "@/components/minigame/RemediationQuickStartModal";

const DATE_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
});

const GAME_TYPE_LABELS: Record<string, string> = {
  quiz_mixed: "Trắc nghiệm hỗn hợp",
  flashcard: "Flashcard",
  shooting_quiz: "Bắn gà ôn tập",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Dễ",
  medium: "Trung bình",
  hard: "Khó",
};

type DifficultyLevel = "easy" | "medium" | "hard";
type GameType = "quiz_mixed" | "flashcard" | "shooting_quiz";

function normalizeDifficulty(input?: string): DifficultyLevel {
  const normalized = (input || "").toLowerCase();
  if (normalized === "easy" || normalized === "medium" || normalized === "hard") {
    return normalized;
  }
  return "medium";
}

function normalizeGameType(input?: string): GameType {
  if (input === "flashcard" || input === "shooting_quiz") {
    return input;
  }
  return "quiz_mixed";
}

function toDifficultyKey(input?: string): DifficultyLevel {
  return normalizeDifficulty(input);
}

function toDifficultyLabel(difficulty?: string): string {
  if (!difficulty) return "Trung bình";
  return DIFFICULTY_LABELS[difficulty.toLowerCase()] || difficulty;
}

export default function MinigamePage() {
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const contentId = searchParams.get("contentId") || "";
  const mode = searchParams.get("mode") || "";
  const materialId = params.id;
  const backHref = contentId ? `/materials/${materialId}/minigame` : `/materials/${materialId}`;

  const [content, setContent] = useState<GeneratedContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [selectingGameType, setSelectingGameType] = useState(mode === "create");
  const [generatingGame, setGeneratingGame] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [gameLibrary, setGameLibrary] = useState<GeneratedContent[]>([]);
  const [personalization, setPersonalization] = useState<MinigamePersonalization | null>(null);
  const [personalizationLoading, setPersonalizationLoading] = useState(true);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [remediationLoading, setRemediationLoading] = useState(false);
  const [remediationModalOpen, setRemediationModalOpen] = useState(false);
  const [remediationData, setRemediationData] = useState<RemediationQuickStart | null>(null);
  const hasAttemptHistory = (personalization?.total_attempts || 0) > 0;
  const isFirstTimeAutoMode = Boolean(personalization?.is_first_time_user);
  const hasTriedAllDifficulties = Boolean(personalization?.has_tried_all_difficulties);
  const selectedKnowledgeNote = personalization?.knowledge_notes?.[toDifficultyKey(difficulty)] || "";

  useEffect(() => {
    if (!personalization) return;
    if (personalization.is_first_time_user && personalization.auto_assigned_difficulty) {
      setDifficulty(normalizeDifficulty(personalization.auto_assigned_difficulty));
    }
  }, [personalization]);

  useEffect(() => {
    setSelectingGameType(mode === "create");
  }, [mode]);

  useEffect(() => {
    let mounted = true;

    async function fetchLibrary() {
      setLibraryLoading(true);
      setPersonalizationLoading(true);
      try {
        const [items, summary] = await Promise.all([
          listGeneratedContents(materialId, "minigame"),
          getMinigamePersonalization(materialId).catch(() => null),
        ]);
        if (mounted) {
          setGameLibrary(items.sort((a, b) => Number(b.version || 0) - Number(a.version || 0)));
          setPersonalization(summary);
        }
      } catch (error) {
        console.error("Error fetching minigame library:", error);
      } finally {
        if (mounted) {
          setLibraryLoading(false);
          setPersonalizationLoading(false);
        }
      }
    }

    fetchLibrary();

    return () => {
      mounted = false;
    };
  }, [materialId, contentId]);

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
    gameType: GameType,
    overrideDifficulty?: DifficultyLevel,
  ) {
    setGeneratingGame(true);
    try {
      const autoDifficulty =
        isFirstTimeAutoMode && personalization?.auto_assigned_difficulty
          ? normalizeDifficulty(personalization.auto_assigned_difficulty)
          : undefined;
      const selectedDifficulty = autoDifficulty || overrideDifficulty || difficulty;
      const generated = await generateMinigame(materialId, gameType, selectedDifficulty, true);
      router.push(`/materials/${materialId}/minigame?contentId=${generated.id}`);
    } catch (error) {
      console.error(error);
      setGeneratingGame(false);
    }
  }

  async function handleDeleteGame(content: GeneratedContent) {
    const label = content.game_type === "shooting_quiz"
      ? "Bắn gà"
      : content.game_type === "flashcard"
        ? "Flashcard"
        : "Quiz hỗn hợp";
    const confirmed = window.confirm(`Bạn có chắc muốn xóa ${label} (${toDifficultyLabel(content.difficulty)})?`);
    if (!confirmed) return;

    setDeletingId(content.id);
    try {
      await deleteGeneratedContent(content.id);
      setGameLibrary((prev) => prev.filter((item) => item.id !== content.id));
      if (contentId === content.id) {
        router.push(`/materials/${materialId}/minigame`);
      }
    } catch (error) {
      console.error("Error deleting minigame:", error);
    } finally {
      setDeletingId("");
    }
  }

  async function handleSubmitAttempt(answers: Array<{ id?: string; node_id?: string; answer: string }>) {
    return await submitGameAttempt(contentId, answers);
  }

  async function handleCreateRemediationSet() {
    if (remediationLoading || !hasAttemptHistory) return;

    setRemediationLoading(true);
    try {
      const recommended = normalizeDifficulty(personalization?.recommended_difficulty);
      const result = await generateRemediationQuickStart(materialId, {
        difficulty: recommended,
        top_k_wrong_questions: 10,
      });
      setRemediationData(result);
      setRemediationModalOpen(true);

      const refreshedLibrary = await listGeneratedContents(materialId, "minigame");
      setGameLibrary(refreshedLibrary.sort((a, b) => Number(b.version || 0) - Number(a.version || 0)));
    } catch (error) {
      console.error("Error creating remediation set:", error);
    } finally {
      setRemediationLoading(false);
    }
  }

  function handleStartRemediationGame(item: RemediationQuickStartItem) {
    setRemediationModalOpen(false);
    router.push(`/materials/${materialId}/minigame?contentId=${item.generated_content_id}`);
  }

  function handleApplyAiSuggestion() {
    const recommendedDifficulty = normalizeDifficulty(personalization?.recommended_difficulty);
    setDifficulty(recommendedDifficulty);
    setSelectingGameType(true);
  }

  async function handleCreateSuggestedGame() {
    const suggestedGameType = normalizeGameType(personalization?.suggested_game_type);
    const recommendedDifficulty = normalizeDifficulty(personalization?.recommended_difficulty);
    await handleSelectGameType(suggestedGameType, recommendedDifficulty);
  }

  const gameTypeConfig = {
    quiz_mixed: {
      title: GAME_TYPE_LABELS.quiz_mixed,
      description: "Mix 4 dạng: trắc nghiệm, đúng/sai, chọn nhiều, điền từ",
      icon: BookOpen,
      color: "from-brand-500 to-brand-600",
    },
    flashcard: {
      title: GAME_TYPE_LABELS.flashcard,
      description: "Lật thẻ để học & nhớ siêu mạnh",
      icon: Brain,
      color: "from-amber-500 to-amber-600",
    },
    shooting_quiz: {
      title: GAME_TYPE_LABELS.shooting_quiz,
      description: "Aim + bắn đáp án đúng theo từng round",
      icon: Zap,
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
            href={backHref}
            className="no-underline text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
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
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border-light)] bg-[var(--bg-elevated)] p-5 sm:flex-row sm:items-center sm:justify-between shadow-sm">
            <div>
              <h3 className="m-0 text-lg font-bold text-[var(--text-primary)]">Khu vực minigame</h3>
              <p className="m-0 mt-1 text-sm text-[var(--text-secondary)]">
                Chuyển nhanh giữa tạo game mới và thư viện game đã tạo.
              </p>
            </div>
            <div className="inline-flex rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] p-1">
              <button
                type="button"
                onClick={() => setSelectingGameType(true)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  selectingGameType
                    ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Tạo game mới
              </button>
              <button
                type="button"
                onClick={() => setSelectingGameType(false)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  !selectingGameType
                    ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Thư viện ({gameLibrary.length})
              </button>
            </div>
          </div>

          {personalizationLoading && <CardSkeleton />}

          {!personalizationLoading && personalization && (
            <Card className="border border-[var(--border-light)] bg-[var(--bg-elevated)] p-6">
              <div className="space-y-5">
                <div>
                  <h3 className="m-0 text-xl font-bold text-[var(--text-primary)]">Cá nhân hóa cho bạn</h3>
                  <p className="m-0 mt-1.5 text-sm text-[var(--text-secondary)]">
                    Gợi ý được tạo từ lịch sử chơi minigame của bạn trên học liệu này.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] p-4">
                    <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Số lượt chơi</p>
                    <p className="m-0 mt-2 text-3xl font-black text-[var(--text-primary)]">{personalization.total_attempts}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] p-4">
                    <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Độ chính xác trung bình</p>
                    <p className="m-0 mt-2 text-3xl font-black text-[var(--text-primary)]">{personalization.average_accuracy}%</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] p-4">
                    <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Số ngày đã học</p>
                    <p className="m-0 mt-2 text-3xl font-black text-[var(--text-primary)]">{personalization.streak_days}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] p-4 text-sm text-[var(--text-secondary)]">
                  <span className="font-semibold text-[var(--text-primary)]">Gợi ý lượt tiếp theo:</span>{" "}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {GAME_TYPE_LABELS[personalization.suggested_game_type] || personalization.suggested_game_type}
                    {" • "}
                    {toDifficultyLabel(personalization.recommended_difficulty)}
                  </span>
                </div>

                {personalization.weak_points.length > 0 && (
                  <div>
                    <h4 className="m-0 mb-3 text-sm font-semibold text-[var(--text-primary)]">Điểm yếu cần ôn lại</h4>
                    <div className="flex flex-wrap gap-2">
                      {personalization.weak_points.slice(0, 4).map((point) => (
                        <span
                          key={point}
                          className="rounded-lg border border-[var(--border-light)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)]"
                        >
                          {point}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {personalization.next_actions.length > 0 && (
                  <div className="space-y-4 border-t border-[var(--border-light)] pt-5">
                    <h4 className="m-0 text-sm font-semibold text-[var(--text-primary)]">Hành động đề xuất</h4>
                    <ul className="m-0 space-y-1.5 pl-5 text-sm text-[var(--text-secondary)]">
                      {personalization.next_actions.slice(0, 2).map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>

                    {isFirstTimeAutoMode && personalization.first_time_level_plan.length > 0 && (
                      <div className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] p-4">
                        <p className="m-0 text-sm font-semibold text-[var(--text-primary)]">Phân bổ level tự động cho lần đầu</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          {personalization.first_time_level_plan.map((level, idx) => (
                            <span
                              key={`${level}-${idx}`}
                              className="rounded-lg border border-[var(--border-light)] bg-[var(--bg-elevated)] px-2 py-1 text-[var(--text-secondary)]"
                            >
                              {idx + 1}. {toDifficultyLabel(level)}
                            </span>
                          ))}
                        </div>
                        {personalization.first_time_allocation_reason && (
                          <p className="m-0 mt-2 text-xs text-[var(--text-secondary)]">
                            {personalization.first_time_allocation_reason}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-secondary)] p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                            <Zap className="h-5 w-5" />
                          </div>
                          <div>
                            <h5 className="m-0 text-base font-semibold text-[var(--text-primary)]">
                              Ôn tập khuyết điểm tự động với AI
                            </h5>
                            <p className="m-0 mt-1 text-sm text-[var(--text-secondary)]">
                              Tạo nhanh 1 quiz cá nhân hóa từ top 10 câu bạn làm sai nhiều nhất để ôn tập ngay.
                            </p>
                            {!hasAttemptHistory && (
                              <p className="m-0 mt-1 text-xs text-[var(--text-tertiary)]">
                                Chưa có dữ liệu chơi. Hãy hoàn thành ít nhất 1 lượt minigame để mở tính năng này.
                              </p>
                            )}
                          </div>
                        </div>

                        <Button
                          size="md"
                          icon={<Zap className="h-4 w-4" />}
                          loading={remediationLoading}
                          disabled={remediationLoading || generatingGame || deletingId.length > 0 || !hasAttemptHistory}
                          onClick={handleCreateRemediationSet}
                        >
                          Ôn tập ngay
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {selectingGameType ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="border-b border-[var(--border-light)] pb-5">
                <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
                  Chọn loại minigame
                </h2>
                <p className="text-sm text-[var(--text-secondary)] mt-2">
                  Lựa chọn định dạng học tập hoặc trò chơi giải trí phù hợp với bạn
                </p>
              </div>

              {personalization && (
                <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-secondary)] p-5 shadow-sm">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-light)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Gợi ý thông minh từ AI</p>
                        <h4 className="m-0 mt-1.5 text-lg font-bold text-[var(--text-primary)] flex items-center gap-2.5">
                          {GAME_TYPE_LABELS[normalizeGameType(personalization.suggested_game_type)] || "Quiz hỗn hợp"}
                          <span className="inline-block rounded border border-[var(--border-light)] bg-[var(--bg-elevated)] px-2 py-0.5 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                            {toDifficultyLabel(personalization.recommended_difficulty)}
                          </span>
                        </h4>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        size="md"
                        variant="secondary"
                        onClick={handleApplyAiSuggestion}
                        disabled={generatingGame}
                      >
                        Áp dụng đề xuất
                      </Button>
                      <Button
                        size="md"
                        icon={<Sparkles className="h-4 w-4" />}
                        onClick={handleCreateSuggestedGame}
                        loading={generatingGame}
                        disabled={generatingGame}
                      >
                        Tạo game gợi ý
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                  <Target className="w-4 h-4 text-[var(--text-secondary)]" />
                  Mức độ khó
                </label>
                {isFirstTimeAutoMode && (
                  <p className="m-0 text-xs text-[var(--text-secondary)]">
                    AI đang tự động phân bổ level cho lần đầu chơi. Bạn sẽ bắt đầu ở mức {toDifficultyLabel(personalization?.auto_assigned_difficulty || undefined)}.
                  </p>
                )}
                <div className="flex w-full max-w-sm gap-1 rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] p-1">
                  {[
                    { id: "easy", label: "Dễ" },
                    { id: "medium", label: "Trung bình" },
                    { id: "hard", label: "Khó" },
                  ].map((lvl) => (
                    <button
                      key={lvl.id}
                      onClick={() => {
                        if (isFirstTimeAutoMode) return;
                        setDifficulty(lvl.id as "easy" | "medium" | "hard");
                      }}
                      disabled={isFirstTimeAutoMode}
                      className={`flex-1 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                        difficulty === lvl.id
                          ? "border border-[var(--border-light)] bg-[var(--bg-elevated)] font-semibold text-[var(--text-primary)] shadow-sm"
                          : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      <span>{lvl.label}</span>
                    </button>
                  ))}
                </div>

                {hasTriedAllDifficulties && selectedKnowledgeNote && (
                  <div className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] p-3 text-sm text-[var(--text-secondary)]">
                    <span className="font-semibold text-[var(--text-primary)]">Lưu ý kiến thức cho mức {toDifficultyLabel(difficulty)}:</span>{" "}
                    {selectedKnowledgeNote}
                  </div>
                )}
              </div>

              <div className="grid sm:grid-cols-3 gap-5">
                {(
                  Object.entries(gameTypeConfig) as Array<
                    [
                      "quiz_mixed" | "flashcard" | "shooting_quiz",
                      typeof gameTypeConfig.quiz_mixed,
                    ]
                  >
                ).map(([gameType, config]) => {
                  const Icon = config.icon;
                  return (
                    <div
                      key={gameType}
                      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[var(--border-light)] bg-[var(--bg-elevated)] p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[var(--border-medium)] hover:shadow-md"
                    >
                      <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-full bg-gradient-to-bl ${config.color} opacity-[0.06] transition-opacity duration-300 group-hover:opacity-20`} />
                      
                      <div className="relative z-10 space-y-5">
                        <div
                          className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${config.color} flex items-center justify-center shadow-md transition-transform duration-500 ease-out group-hover:scale-110 group-hover:rotate-6`}
                        >
                          <Icon className="w-7 h-7 text-white drop-shadow-sm" />
                        </div>
                        <div>
                          <h3 className="mb-2 text-lg font-bold text-[var(--text-primary)]">
                            {config.title}
                          </h3>
                          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                            {config.description}
                          </p>
                        </div>
                      </div>
                      
                      <div className="relative z-10 mt-8 border-t border-[var(--border-light)] pt-5">
                        <Button
                          className="w-full"
                          onClick={() => handleSelectGameType(gameType)}
                          loading={generatingGame}
                          disabled={generatingGame}
                        >
                          Chọn
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-start sm:justify-center pt-4">
                <Button
                  variant="secondary"
                  size="lg"
                  className="px-8"
                  onClick={() => setSelectingGameType(false)}
                >
                  Xem thư viện game
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border-light)] bg-[var(--bg-elevated)] p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="m-0 text-xl font-bold text-[var(--text-primary)]">Danh sách minigame đã tạo</h3>
                  <p className="m-0 mt-1.5 text-sm text-[var(--text-secondary)]">
                    Chọn game đã tạo để tiếp tục chơi. Tổng cộng {gameLibrary.length} game.
                  </p>
                </div>
                <Button onClick={() => setSelectingGameType(true)} icon={<Sparkles className="w-4 h-4" />}>
                  Tạo game mới
                </Button>
              </div>

              {libraryLoading && (
                <div className="space-y-4">
                  <CardSkeleton />
                  <CardSkeleton />
                </div>
              )}

              {!libraryLoading && gameLibrary.length === 0 && (
                <EmptyState
                  icon={<Gamepad2 className="w-12 h-12 text-[var(--text-tertiary)]" />}
                  title="Chưa có minigame"
                  description="Hãy tạo minigame mới để bắt đầu luyện tập và nâng cao kiến thức."
                  action={
                    <div className="flex flex-col sm:flex-row gap-3 mt-2">
                      <Button
                        size="lg"
                        className="shadow-sm"
                        onClick={() => setSelectingGameType(true)}
                        icon={<Sparkles className="w-4 h-4" />}
                      >
                        Tạo minigame mới
                      </Button>
                      <Link href={`/materials/${materialId}`}>
                        <Button variant="secondary" size="lg">Quay lại material</Button>
                      </Link>
                    </div>
                  }
                />
              )}

              {!libraryLoading && gameLibrary.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {gameLibrary.map((game) => {
                    const gameTitle = GAME_TYPE_LABELS[game.game_type || ""] || "Minigame";

                    return (
                      <div 
                        key={game.id} 
                        className="group relative flex flex-col justify-between rounded-2xl border border-[var(--border-light)] bg-[var(--bg-elevated)] p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--border-medium)] hover:shadow-md"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="space-y-1">
                            <h4 className="m-0 text-base font-bold text-[var(--text-primary)]">
                              {gameTitle}
                            </h4>
                            <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                              <Clock className="h-3.5 w-3.5" />
                              <span>{DATE_FORMATTER.format(new Date(game.created_at))}</span>
                            </div>
                          </div>
                          <span className="inline-flex rounded border border-[var(--border-light)] bg-[var(--bg-secondary)] px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                            {toDifficultyLabel(game.difficulty)}
                          </span>
                        </div>
                        
                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--border-light)] pt-4">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="flex-1"
                            icon={<Gamepad2 className="w-4 h-4" />}
                            onClick={() => router.push(`/materials/${materialId}/minigame?contentId=${game.id}`)}
                            disabled={deletingId.length > 0 || generatingGame}
                          >
                            Vào chơi
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            icon={<Trash2 className="w-4 h-4" />}
                            onClick={() => handleDeleteGame(game)}
                            loading={deletingId === game.id}
                            disabled={generatingGame}
                          >
                            Xóa
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!loading && contentId && content && (
        <div className="pt-4">
          {content.game_type === "quiz_mixed" && (
            <QuizMixedPlayer
              title={content.json_content?.title || "Quiz hỗn hợp"}
              difficulty={content.difficulty || "medium"}
              items={content.json_content?.items || []}
              onSubmit={handleSubmitAttempt}
            />
          )}

          {content.game_type === "flashcard" && (
            <FlashcardPlayer
              title={content.json_content?.title || "Flashcard"}
              difficulty={content.difficulty || "medium"}
              items={content.json_content?.items || []}
              onSubmit={handleSubmitAttempt}
            />
          )}

          {content.game_type === "shooting_quiz" && (
            <ShootingQuizPlayer
              payload={content.json_content || {}}
              difficulty={content.difficulty || "medium"}
              onSubmit={handleSubmitAttempt}
              sessionKey={content.id}
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

      <RemediationQuickStartModal
        open={remediationModalOpen}
        onClose={() => setRemediationModalOpen(false)}
        data={remediationData}
        onStartGame={handleStartRemediationGame}
      />
    </motion.div>
  );
}