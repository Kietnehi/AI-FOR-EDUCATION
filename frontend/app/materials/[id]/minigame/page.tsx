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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  deleteGeneratedContent,
  getGeneratedContent,
  generateMinigame,
  getMinigamePersonalization,
  listGeneratedContents,
  submitGameAttempt,
} from "@/lib/api";
import { GeneratedContent, MinigamePersonalization } from "@/types";
import { QuizMixedPlayer } from "@/components/minigame/QuizMixedPlayer";
import { FlashcardPlayer } from "@/components/minigame/FlashcardPlayer";
import { ShootingQuizPlayer } from "@/components/minigame/ShootingQuizPlayer";

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
    gameType: "quiz_mixed" | "flashcard" | "shooting_quiz"
  ) {
    setGeneratingGame(true);
    try {
      const generated = await generateMinigame(materialId, gameType, difficulty, true);
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
          {personalizationLoading && <CardSkeleton />}

          {!personalizationLoading && personalization && (
            <Card className="border border-[var(--border-light)]">
              <div className="space-y-4">
                <div>
                  <h3 className="m-0 text-base font-semibold text-[var(--text-primary)]">Cá nhân hóa cho bạn</h3>
                  <p className="m-0 mt-1 text-sm text-[var(--text-secondary)]">
                    Gợi ý được tạo từ lịch sử chơi minigame của bạn trên học liệu này.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] p-3">
                    <p className="m-0 text-xs text-[var(--text-tertiary)]">Số lượt chơi</p>
                    <p className="m-0 mt-1 text-lg font-bold text-[var(--text-primary)]">{personalization.total_attempts}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] p-3">
                    <p className="m-0 text-xs text-[var(--text-tertiary)]">Độ chính xác trung bình</p>
                    <p className="m-0 mt-1 text-lg font-bold text-[var(--text-primary)]">{personalization.average_accuracy}%</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] p-3">
                    <p className="m-0 text-xs text-[var(--text-tertiary)]">Số ngày đã học</p>
                    <p className="m-0 mt-1 text-lg font-bold text-[var(--text-primary)]">{personalization.streak_days}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)] p-3 text-sm text-[var(--text-secondary)]">
                  <span className="font-medium text-[var(--text-primary)]">Gợi ý lượt tiếp theo:</span>{" "}
                  {GAME_TYPE_LABELS[personalization.suggested_game_type] || personalization.suggested_game_type}
                  {" • "}
                  {toDifficultyLabel(personalization.recommended_difficulty)}
                </div>

                {personalization.weak_points.length > 0 && (
                  <div>
                    <p className="m-0 text-sm font-medium text-[var(--text-primary)]">Điểm yếu cần ôn lại</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {personalization.weak_points.slice(0, 4).map((point) => (
                        <span
                          key={point}
                          className="rounded-lg border border-[var(--border-light)] bg-[var(--bg-secondary)] px-2 py-1 text-xs text-[var(--text-secondary)]"
                        >
                          {point}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {personalization.next_actions.length > 0 && (
                  <div>
                    <p className="m-0 text-sm font-medium text-[var(--text-primary)]">Hành động đề xuất</p>
                    <ul className="mt-2 space-y-1 pl-4 text-sm text-[var(--text-secondary)]">
                      {personalization.next_actions.slice(0, 2).map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>
          )}

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

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-[var(--text-primary)]">
                  Mức độ khó
                </label>
                <div className="flex bg-[var(--bg-secondary)] rounded-xl p-1 gap-1 max-w-sm">
                  <button
                    onClick={() => setDifficulty("easy")}
                    className={`flex-1 flex flex-col items-center py-2 px-3 rounded-lg text-sm transition-all ${
                      difficulty === "easy"
                        ? "bg-white shadow-sm font-semibold text-brand-600"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium"
                    }`}
                  >
                    <span>Dễ</span>
                  </button>
                  <button
                    onClick={() => setDifficulty("medium")}
                    className={`flex-1 flex flex-col items-center py-2 px-3 rounded-lg text-sm transition-all ${
                      difficulty === "medium"
                        ? "bg-white shadow-sm font-semibold text-brand-600"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium"
                    }`}
                  >
                    <span>Trung bình</span>
                  </button>
                  <button
                    onClick={() => setDifficulty("hard")}
                    className={`flex-1 flex flex-col items-center py-2 px-3 rounded-lg text-sm transition-all ${
                      difficulty === "hard"
                        ? "bg-white shadow-sm font-semibold text-brand-600"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium"
                    }`}
                  >
                    <span>Khó</span>
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
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
                    <Card
                      key={gameType}
                      hover
                      className="group flex flex-col border-[var(--border-light)] hover:border-brand-300"
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
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border-light)] bg-[var(--bg-primary)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="m-0 text-base font-semibold text-[var(--text-primary)]">Danh sách minigame đã tạo</h3>
                  <p className="m-0 mt-1 text-sm text-[var(--text-secondary)]">
                    Chọn game đã tạo để mở lại, hoặc tạo game mới.
                  </p>
                </div>
                <Button onClick={() => setSelectingGameType(true)} icon={<Sparkles className="w-4 h-4" />}>
                  Tạo game mới
                </Button>
              </div>

              {libraryLoading && (
                <div className="space-y-3">
                  <CardSkeleton />
                  <CardSkeleton />
                </div>
              )}

              {!libraryLoading && gameLibrary.length === 0 && (
                <EmptyState
                  icon={<Gamepad2 className="w-10 h-10" />}
                  title="Chưa có minigame"
                  description="Hãy tạo minigame mới để bắt đầu luyện tập."
                  action={
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        onClick={() => setSelectingGameType(true)}
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

              {!libraryLoading && gameLibrary.length > 0 && (
                <div className="space-y-3">
                  {gameLibrary.map((game) => {
                    const gameTitle = GAME_TYPE_LABELS[game.game_type || ""] || "Minigame";

                    return (
                      <Card key={game.id} className="border border-[var(--border-light)]">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h4 className="m-0 text-sm font-semibold text-[var(--text-primary)]">
                              {gameTitle} • {toDifficultyLabel(game.difficulty)}
                            </h4>
                            <div className="mt-1 flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                              <Clock className="h-3.5 w-3.5" />
                              <span>{DATE_FORMATTER.format(new Date(game.created_at))}</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={<Gamepad2 className="w-4 h-4" />}
                              onClick={() => router.push(`/materials/${materialId}/minigame?contentId=${game.id}`)}
                              disabled={deletingId.length > 0 || generatingGame}
                            >
                              Vào game
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
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
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
    </motion.div>
  );
}