"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Pause, Play, RotateCcw, Target, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type QuizAnswer = {
  id: string;
  text: string;
  is_correct: boolean;
};

type QuizQuestion = {
  id: string;
  question: string;
  answers: QuizAnswer[];
  explanation?: string;
};

type ShootingPayload = {
  game_type?: string;
  metadata?: {
    topic?: string;
    difficulty?: "easy" | "medium" | "hard" | string;
  };
  game?: {
    total_rounds?: number;
    questions?: QuizQuestion[];
  };
  tracking?: {
    score_per_correct?: number;
    max_score?: number;
    skills?: string[];
  };
};

type EnemyChicken = {
  answerId: string;
  text: string;
  isCorrect: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
};

type Bullet = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
};

type UserShotAnswer = { id: string; answer: string };

type Props = {
  payload: ShootingPayload;
  difficulty?: string;
  onSubmit: (answers: UserShotAnswer[]) => Promise<any>;
  sessionKey?: string;
};

type ShootingSessionSnapshot = {
  screen: "playing";
  roundIndex: number;
  score: number;
  correctCount: number;
  roundTimeLeft: number;
  answersLog: UserShotAnswer[];
  savedAt: number;
};

const ARENA_WIDTH = 980;
const ARENA_HEIGHT = 640;
const CHICKEN_WIDTH = 220;
const CHICKEN_HEIGHT = 92;
const PLAYER_SAFE_ZONE = 88;
const ROUND_TIME_MS = 20000;
const PLAYER_AVATAR_SIZE = 96;
const PLAYER_AVATAR_BOTTOM = 12;
// Fine-tune these offsets if you want the shooting origin to move slightly.
const PLAYER_ANCHOR_X_OFFSET = 0;
const PLAYER_ANCHOR_Y_OFFSET = 0;
const PLAYER_X = ARENA_WIDTH / 2 + PLAYER_ANCHOR_X_OFFSET;
const PLAYER_Y = ARENA_HEIGHT - PLAYER_AVATAR_BOTTOM - PLAYER_AVATAR_SIZE / 2 + PLAYER_ANCHOR_Y_OFFSET;
const BULLET_SPEED = 16;
const CHICKEN_HIT_RADIUS = 75;
const PHYSICS_SUBSTEPS = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function xToPercent(x: number): string {
  return `${(x / ARENA_WIDTH) * 100}%`;
}

function yToPercent(y: number): string {
  return `${(y / ARENA_HEIGHT) * 100}%`;
}

function didBulletHitEnemy(prevX: number, prevY: number, nextX: number, nextY: number, enemy: EnemyChicken): boolean {
  const dx = nextX - prevX;
  const dy = nextY - prevY;
  const segmentLengthSq = dx * dx + dy * dy;

  if (!segmentLengthSq) {
    const distX = prevX - enemy.x;
    const distY = prevY - enemy.y;
    return distX * distX + distY * distY <= CHICKEN_HIT_RADIUS * CHICKEN_HIT_RADIUS;
  }

  const t = clamp(((enemy.x - prevX) * dx + (enemy.y - prevY) * dy) / segmentLengthSq, 0, 1);
  const closestX = prevX + dx * t;
  const closestY = prevY + dy * t;
  const distToCenterX = closestX - enemy.x;
  const distToCenterY = closestY - enemy.y;

  if (distToCenterX * distToCenterX + distToCenterY * distToCenterY <= CHICKEN_HIT_RADIUS * CHICKEN_HIT_RADIUS) {
    return true;
  }

  return false;
}

function isPointInsideEnemy(pointX: number, pointY: number, enemy: EnemyChicken): boolean {
  const halfW = CHICKEN_WIDTH / 2;
  const halfH = CHICKEN_HEIGHT / 2;
  return (
    pointX >= enemy.x - halfW &&
    pointX <= enemy.x + halfW &&
    pointY >= enemy.y - halfH &&
    pointY <= enemy.y + halfH
  );
}

function createRoundEnemies(answers: QuizAnswer[]): EnemyChicken[] {
  return answers.map((answer, idx) => {
    const laneWidth = ARENA_WIDTH / answers.length;
    const laneCenter = laneWidth * idx + laneWidth / 2;
    const startX = laneCenter + (Math.random() * 12 - 6);
    return {
      answerId: answer.id,
      text: answer.text,
      isCorrect: !!answer.is_correct,
      x: clamp(startX, CHICKEN_WIDTH / 2, ARENA_WIDTH - CHICKEN_WIDTH / 2),
      // Spawn above the top edge then fall down before bouncing around the arena.
      y: -40 - Math.random() * 160,
      vx: (Math.random() * 1.7 + 0.9) * (Math.random() > 0.5 ? 1 : -1),
      vy: Math.random() * 1.6 + 1.8,
    };
  });
}

export function ShootingQuizPlayer({ payload, difficulty, onSubmit, sessionKey }: Props) {
  const questions = useMemo(() => {
    const source = Array.isArray(payload?.game?.questions) ? payload.game?.questions || [] : [];
    return source.slice(0, 10).map((question, qIndex) => {
      const answers = Array.isArray(question.answers) ? question.answers.slice(0, 4) : [];
      return {
        ...question,
        id: question.id || `q${qIndex + 1}`,
        answers,
      };
    });
  }, [payload]);

  const scorePerCorrect = Number(payload?.tracking?.score_per_correct || 10);
  const maxScore = Number(payload?.tracking?.max_score || 100);

  const [screen, setScreen] = useState<"start" | "playing" | "end">("start");
  const [roundIndex, setRoundIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [enemies, setEnemies] = useState<EnemyChicken[]>([]);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [aim, setAim] = useState({ x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2 });
  const [feedback, setFeedback] = useState<"Đúng!" | "Sai rồi!" | "Hết thời gian!" | null>(null);
  const [lockedRound, setLockedRound] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [awaitingTimeoutContinue, setAwaitingTimeoutContinue] = useState(false);
  const [roundTimeLeft, setRoundTimeLeft] = useState(ROUND_TIME_MS);
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null);
  const [answersLog, setAnswersLog] = useState<UserShotAnswer[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);
  const [resumeSnapshot, setResumeSnapshot] = useState<ShootingSessionSnapshot | null>(null);

  const arenaRef = useRef<HTMLDivElement | null>(null);
  const enemiesRef = useRef<EnemyChicken[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);

  const currentQuestion = questions[roundIndex];
  const totalRounds = questions.length || 10;

  function getSessionStorageKey() {
    if (!sessionKey) return "";
    return `shooting-quiz-session:${sessionKey}`;
  }

  function clearSessionSnapshot() {
    if (typeof window === "undefined") return;
    const key = getSessionStorageKey();
    if (!key) return;
    window.localStorage.removeItem(key);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = getSessionStorageKey();
    if (!key) return;

    const raw = window.localStorage.getItem(key);
    if (!raw) {
      setResumeSnapshot(null);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as ShootingSessionSnapshot;
      if (parsed?.screen === "playing" && Number.isFinite(parsed.roundIndex) && parsed.roundIndex < totalRounds) {
        setResumeSnapshot(parsed);
      } else {
        setResumeSnapshot(null);
      }
    } catch {
      setResumeSnapshot(null);
    }
  }, [sessionKey, totalRounds]);

  useEffect(() => {
    if (screen !== "playing" || !currentQuestion) return;
    setEnemies(createRoundEnemies(currentQuestion.answers));
    setBullets([]);
    setFeedback(null);
    setSelectedAnswerId(null);
    setLockedRound(false);
    setIsPaused(false);
    setAwaitingTimeoutContinue(false);
    setRoundTimeLeft(ROUND_TIME_MS);
  }, [screen, roundIndex, currentQuestion]);

  useEffect(() => {
    enemiesRef.current = enemies;
  }, [enemies]);

  useEffect(() => {
    bulletsRef.current = bullets;
  }, [bullets]);

  useEffect(() => {
    if (screen !== "playing" || lockedRound || isPaused) return;

    const tick = () => {
      const minX = CHICKEN_WIDTH / 2;
      const maxX = ARENA_WIDTH - CHICKEN_WIDTH / 2;
      const minY = CHICKEN_HEIGHT / 2;
      const maxY = ARENA_HEIGHT - CHICKEN_HEIGHT / 2 - PLAYER_SAFE_ZONE;

      let simulatedEnemies = enemiesRef.current;
      let simulatedBullets = bulletsRef.current;
      let hitEnemy: EnemyChicken | null = null;

      for (let step = 0; step < PHYSICS_SUBSTEPS; step += 1) {
        simulatedEnemies = simulatedEnemies.map((enemy) => {
          const stepVX = enemy.vx / PHYSICS_SUBSTEPS;
          const stepVY = enemy.vy / PHYSICS_SUBSTEPS;
          const nextX = enemy.x + stepVX;
          const nextY = enemy.y + stepVY;
          const bouncedX = nextX <= minX || nextX >= maxX;
          const bouncedY = nextY <= minY || nextY >= maxY;

          return {
            ...enemy,
            x: bouncedX ? clamp(nextX, minX, maxX) : nextX,
            y: bouncedY ? clamp(nextY, minY, maxY) : nextY,
            vx: bouncedX ? enemy.vx * -1 : enemy.vx,
            vy: bouncedY ? enemy.vy * -1 : enemy.vy,
          };
        });

        simulatedBullets = simulatedBullets
          .map((bullet) => ({
            ...bullet,
            prevX: bullet.x,
            prevY: bullet.y,
            x: bullet.x + bullet.vx / PHYSICS_SUBSTEPS,
            y: bullet.y + bullet.vy / PHYSICS_SUBSTEPS,
          }))
          .filter((bullet) => {
            if (hitEnemy) return false;

            const enemy = simulatedEnemies
              .filter((candidate) => didBulletHitEnemy(bullet.prevX, bullet.prevY, bullet.x, bullet.y, candidate))
              .sort((a, b) => {
                const distA = (a.x - bullet.prevX) * (a.x - bullet.prevX) + (a.y - bullet.prevY) * (a.y - bullet.prevY);
                const distB = (b.x - bullet.prevX) * (b.x - bullet.prevX) + (b.y - bullet.prevY) * (b.y - bullet.prevY);
                return distA - distB;
              })[0];

            if (enemy) {
              hitEnemy = enemy;
              return false;
            }

            return true;
          })
          .filter(
            (bullet) => bullet.x >= -20 && bullet.x <= ARENA_WIDTH + 20 && bullet.y >= -20 && bullet.y <= ARENA_HEIGHT + 20
          );

        if (hitEnemy) {
          break;
        }
      }

      setEnemies(simulatedEnemies);
      setBullets(hitEnemy ? [] : simulatedBullets);

      if (hitEnemy) {
        resolveRound(hitEnemy);
      }
    };

    const timer = window.setInterval(tick, 16);
    return () => window.clearInterval(timer);
  }, [screen, lockedRound, isPaused]);

  useEffect(() => {
    if (screen !== "playing" || lockedRound || isPaused) return;

    const timer = window.setInterval(() => {
      setRoundTimeLeft((prev) => {
        const next = Math.max(prev - 100, 0);
        if (next === 0) {
          handleRoundTimeout();
        }
        return next;
      });
    }, 100);

    return () => window.clearInterval(timer);
  }, [screen, lockedRound, isPaused]);

  useEffect(() => {
    if (screen !== "end" || submitting || submitResult || answersLog.length === 0) return;

    const submit = async () => {
      setSubmitting(true);
      try {
        const result = await onSubmit(answersLog);
        setSubmitResult(result);
      } catch (error) {
        console.error(error);
      } finally {
        setSubmitting(false);
      }
    };

    submit();
  }, [screen, answersLog, onSubmit, submitting, submitResult]);

  function beginGame() {
    setScreen("playing");
    setRoundIndex(0);
    setScore(0);
    setCorrectCount(0);
    setAnswersLog([]);
    setSubmitResult(null);
    setFeedback(null);
    setSelectedAnswerId(null);
    setLockedRound(false);
    setIsPaused(false);
    setAwaitingTimeoutContinue(false);
    setRoundTimeLeft(ROUND_TIME_MS);
    setBullets([]);
    clearSessionSnapshot();
  }

  function resumeGame() {
    if (!resumeSnapshot) {
      beginGame();
      return;
    }

    setScreen("playing");
    setRoundIndex(clamp(resumeSnapshot.roundIndex, 0, Math.max(totalRounds - 1, 0)));
    setScore(resumeSnapshot.score || 0);
    setCorrectCount(resumeSnapshot.correctCount || 0);
    setAnswersLog(Array.isArray(resumeSnapshot.answersLog) ? resumeSnapshot.answersLog : []);
    setSubmitResult(null);
    setFeedback(null);
    setSelectedAnswerId(null);
    setLockedRound(false);
    setIsPaused(false);
    setAwaitingTimeoutContinue(false);
    setRoundTimeLeft(clamp(resumeSnapshot.roundTimeLeft || ROUND_TIME_MS, 0, ROUND_TIME_MS));
    setBullets([]);
  }

  function handleRoundTimeout() {
    if (lockedRound) return;

    // On the final round, timeout ends the game immediately.
    if (roundIndex >= totalRounds - 1) {
      resolveRound(null);
      return;
    }

    // For non-final rounds, pause and wait for user to continue.
    setLockedRound(true);
    setIsPaused(true);
    setAwaitingTimeoutContinue(true);
    setFeedback("Hết thời gian!");
    setAnswersLog((prev) => [...prev, { id: currentQuestion?.id || `q${roundIndex + 1}`, answer: "" }]);
    setBullets([]);
  }

  function handlePauseButton() {
    if (lockedRound && !awaitingTimeoutContinue) return;

    if (awaitingTimeoutContinue) {
      setAwaitingTimeoutContinue(false);
      setFeedback(null);
      setSelectedAnswerId(null);
      setRoundTimeLeft(ROUND_TIME_MS);
      setLockedRound(false);
      setIsPaused(false);
      nextRound();
      return;
    }

    setIsPaused((prev) => !prev);
  }

  function finishGame() {
    setScreen("end");
    clearSessionSnapshot();
  }

  function nextRound() {
    if (roundIndex >= totalRounds - 1) {
      finishGame();
      return;
    }
    setRoundIndex((prev) => prev + 1);
  }

  function resolveRound(hitEnemy: EnemyChicken | null) {
    if (!currentQuestion || lockedRound) return;

    setLockedRound(true);

    const correctEnemy = enemies.find((enemy) => enemy.isCorrect) || null;
    const chosen = hitEnemy;

    if (!chosen) {
      setFeedback("Hết thời gian!");
      setAnswersLog((prev) => [...prev, { id: currentQuestion.id, answer: "" }]);
    } else if (chosen.isCorrect) {
      setFeedback("Đúng!");
      setScore((prev) => prev + scorePerCorrect);
      setCorrectCount((prev) => prev + 1);
      setAnswersLog((prev) => [...prev, { id: currentQuestion.id, answer: chosen.answerId }]);
    } else {
      setFeedback("Sai rồi!");
      setAnswersLog((prev) => [...prev, { id: currentQuestion.id, answer: chosen.answerId }]);
    }

    setSelectedAnswerId(chosen?.answerId || null);
    if (!chosen && correctEnemy) {
      setSelectedAnswerId(correctEnemy.answerId);
    }

    window.setTimeout(() => {
      setFeedback(null);
      setSelectedAnswerId(null);
      setRoundTimeLeft(ROUND_TIME_MS);
      nextRound();
    }, 1450);
  }

  function handleArenaMouseMove(event: MouseEvent<HTMLDivElement>) {
    if (!arenaRef.current) return;
    const rect = arenaRef.current.getBoundingClientRect();
    const nextX = ((event.clientX - rect.left) / rect.width) * ARENA_WIDTH;
    const nextY = ((event.clientY - rect.top) / rect.height) * ARENA_HEIGHT;
    setAim({
      x: clamp(nextX, 0, ARENA_WIDTH),
      y: clamp(nextY, 0, ARENA_HEIGHT),
    });
  }

  function findEnemyAtPoint(pointX: number, pointY: number): EnemyChicken | null {
    const candidates = enemiesRef.current.filter((enemy) => isPointInsideEnemy(pointX, pointY, enemy));
    if (candidates.length === 0) return null;

    candidates.sort((a, b) => {
      const distA = (a.x - pointX) * (a.x - pointX) + (a.y - pointY) * (a.y - pointY);
      const distB = (b.x - pointX) * (b.x - pointX) + (b.y - pointY) * (b.y - pointY);
      return distA - distB;
    });

    return candidates[0] || null;
  }

  function handleShoot(targetPoint?: { x: number; y: number }) {
    if (screen !== "playing" || lockedRound || isPaused) return;

    const targetX = targetPoint?.x ?? aim.x;
    const targetY = targetPoint?.y ?? aim.y;

    // Convert mouse target into a normalized direction vector from player.
    const dx = targetX - PLAYER_X;
    const dy = targetY - PLAYER_Y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (!length) return;

    const bullet: Bullet = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      x: PLAYER_X,
      y: PLAYER_Y,
      vx: (dx / length) * BULLET_SPEED,
      vy: (dy / length) * BULLET_SPEED,
    };

    setBullets((prev) => [...prev.slice(-8), bullet]);
  }

  const aimAngle = useMemo(() => {
    const dx = aim.x - PLAYER_X;
    const dy = aim.y - PLAYER_Y;
    return Math.atan2(dy, dx);
  }, [aim]);

  function formatAccuracy(currentRound: number): number {
    const divisor = Math.max(currentRound - (lockedRound ? 0 : 1), 1);
    return Math.round((correctCount / divisor) * 100) || 0;
  }

  function renderBullets() {
    return bullets.map((bullet) => (
      <div
        key={bullet.id}
        className="absolute w-3 h-3 rounded-full bg-cyan-100 border border-cyan-700 shadow-[0_0_10px_rgba(34,211,238,0.95)] pointer-events-none"
        style={{ left: `calc(${xToPercent(bullet.x)} - 6px)`, top: `calc(${yToPercent(bullet.y)} - 6px)` }}
      />
    ));
  }

  function renderAimArrow() {
    return (
      <div
        className="absolute pointer-events-none z-20"
        style={{
          left: xToPercent(PLAYER_X),
          top: yToPercent(PLAYER_Y),
          transform: `translate(0, -50%) rotate(${aimAngle}rad)`,
          transformOrigin: "0 50%",
        }}
      >
        <div className="relative w-20 h-[3px] bg-white/90 rounded-full">
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[6px] w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[10px] border-l-white/95" />
        </div>
      </div>
    );
  }

  function renderCrosshair() {
    return (
      <div
        className="absolute w-8 h-8 rounded-full border-2 border-white pointer-events-none"
        style={{ left: `calc(${(aim.x / ARENA_WIDTH) * 100}% - 16px)`, top: `calc(${(aim.y / ARENA_HEIGHT) * 100}% - 16px)` }}
      />
    );
  }

  function renderShooterAvatar() {
    return (
      <div
        className="absolute rounded-full border-2 border-white/80 shadow-2xl overflow-hidden bg-slate-100"
        style={{
          left: `calc(${xToPercent(PLAYER_X)} - ${PLAYER_AVATAR_SIZE / 2}px)`,
          top: `calc(${yToPercent(PLAYER_Y)} - ${PLAYER_AVATAR_SIZE / 2}px)`,
          width: `${PLAYER_AVATAR_SIZE}px`,
          height: `${PLAYER_AVATAR_SIZE}px`,
        }}
      >
        <Image src="/nanananaa.png" alt="Shooter" fill sizes="96px" className="object-cover" priority />
      </div>
    );
  }

  function renderArenaHint() {
    return (
      <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
        Click để bắn đạn theo hướng mũi tên. Đạn bay thẳng theo vector ngắm, không dùng line target.
      </p>
    );
  }

  function renderPauseOverlay() {
    return (
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center z-20">
        <div className="px-6 py-3 rounded-2xl bg-white/90 text-slate-900 font-bold">
          {awaitingTimeoutContinue ? "Hết thời gian - bấm Tiếp tục câu sau" : "Đang tạm dừng"}
        </div>
      </div>
    );
  }

  function renderScoreCards(roundNo: number) {
    return (
      <div className="flex items-center gap-3">
        <Card className="!py-3 !px-4 !rounded-2xl !border-cyan-200 !bg-cyan-50">
          <div className="text-xs uppercase font-bold text-cyan-700">Score</div>
          <div className="text-2xl font-black text-cyan-900 leading-none">{score}</div>
        </Card>
        <Card className="!py-3 !px-4 !rounded-2xl !border-emerald-200 !bg-emerald-50">
          <div className="text-xs uppercase font-bold text-emerald-700">Accuracy</div>
          <div className="text-2xl font-black text-emerald-900 leading-none">{formatAccuracy(roundNo)}%</div>
        </Card>
        <Button
          variant="secondary"
          size="sm"
          onClick={handlePauseButton}
          disabled={lockedRound && !awaitingTimeoutContinue}
        >
          {isPaused || awaitingTimeoutContinue ? <Play className="w-4 h-4 mr-1" /> : <Pause className="w-4 h-4 mr-1" />}
          {awaitingTimeoutContinue ? "Tiếp tục câu sau" : isPaused ? "Tiếp tục" : "Tạm dừng"}
        </Button>
      </div>
    );
  }

  function renderEnemyCard(enemy: EnemyChicken) {
    const isCorrect = enemy.isCorrect;
    const isSelected = selectedAnswerId === enemy.answerId;
    const showCorrect = lockedRound && isCorrect;
    const showWrong = lockedRound && isSelected && !isCorrect;

    return (
      <motion.div
        key={enemy.answerId}
        className="absolute"
        style={{ left: enemy.x - CHICKEN_WIDTH / 2, top: enemy.y - CHICKEN_HEIGHT / 2 }}
        animate={{ rotate: [0, -4, 4, 0] }}
        transition={{ duration: 0.9, repeat: Infinity }}
      >
        <div
          className={[
            "h-[92px] w-[220px] rounded-2xl border-2 shadow-xl flex items-center px-4 py-2",
            showCorrect ? "bg-emerald-300 border-emerald-700" : "bg-amber-100/95 border-amber-400",
            showWrong ? "bg-rose-300 border-rose-700" : "",
          ].join(" ")}
        >
          <span className="text-xs sm:text-sm font-semibold text-slate-800 leading-tight text-left break-words">
            {enemy.answerId}. {enemy.text}
          </span>
        </div>
      </motion.div>
    );
  }

  function getEvaluationLabel(accuracyPercent: number): "Giỏi" | "Khá" | "Cần cải thiện" {
    if (accuracyPercent >= 80) return "Giỏi";
    if (accuracyPercent >= 50) return "Khá";
    return "Cần cải thiện";
  }

  function getSuggestion(accuracyPercent: number): string {
    if (accuracyPercent >= 80) {
      return "Bạn nắm tốt kiến thức. Hãy thử tài liệu khó hơn để nâng cấp tốc độ phản xạ và độ chính xác.";
    }
    if (accuracyPercent >= 50) {
      return "Ôn lại các câu đã sai và tập trung từ khóa chính trong câu hỏi trước khi bắn.";
    }
    return "Hãy đọc lại tài liệu, ghi chú ý chính, rồi chơi lại để củng cố kiến thức theo từng round.";
  }

  const accuracyPercent = totalRounds > 0 ? Math.round((correctCount / totalRounds) * 100) : 0;
  const evaluation = getEvaluationLabel(accuracyPercent);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = getSessionStorageKey();
    if (!key) return;

    if (screen !== "playing") {
      return;
    }

    const snapshot: ShootingSessionSnapshot = {
      screen: "playing",
      roundIndex,
      score,
      correctCount,
      roundTimeLeft,
      answersLog,
      savedAt: Date.now(),
    };

    window.localStorage.setItem(key, JSON.stringify(snapshot));
  }, [
    answersLog,
    correctCount,
    roundIndex,
    roundTimeLeft,
    score,
    screen,
    sessionKey,
  ]);

  const renderStartScreen = () => (
    <Card className="relative overflow-hidden !border-0 bg-[radial-gradient(circle_at_15%_15%,rgba(251,191,36,0.22),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(34,197,94,0.18),transparent_35%),linear-gradient(140deg,#101827,#1f2937_45%,#0f172a_90%)] text-slate-100">
      <div className="absolute inset-0 opacity-40 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:28px_28px]" />
      <div className="relative p-8 sm:p-12 text-center space-y-5">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm">
          <Target className="w-4 h-4 text-amber-300" />
          Arcade Learning Mode
        </div>
        <div className="flex justify-center items-center gap-3">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            Bắn Gà Ôn Tập
          </h2>
          {difficulty && (
            <div className="px-3 py-1 rounded-lg text-sm font-bold bg-white/20 border border-white/30 capitalize">
              Độ khó: {difficulty === "easy" ? "Dễ" : difficulty === "hard" ? "Khó" : "Trung bình"}
            </div>
          )}
        </div>
        <p className="text-sm sm:text-base text-slate-200 max-w-2xl mx-auto">
          Mỗi round có 1 câu hỏi và 4 con gà là 4 đáp án. Di chuyển chuột để aim, click để bắn đáp án đúng.
        </p>
        <div className="grid grid-cols-3 gap-3 text-xs sm:text-sm max-w-xl mx-auto">
          <div className="rounded-xl bg-white/10 border border-white/20 p-3">10 round</div>
          <div className="rounded-xl bg-white/10 border border-white/20 p-3">+10 điểm / đúng</div>
          <div className="rounded-xl bg-white/10 border border-white/20 p-3">Không trừ điểm</div>
        </div>
        <Button size="lg" onClick={beginGame} className="bg-amber-500 hover:bg-amber-600 text-slate-900 border-0">
          <Play className="w-5 h-5 mr-2" />
          Bắt đầu chơi
        </Button>
        {resumeSnapshot ? (
          <Button size="lg" variant="secondary" onClick={resumeGame}>
            <Play className="w-5 h-5 mr-2" />
            Tiếp tục phiên tạm dừng
          </Button>
        ) : null}
      </div>
    </Card>
  );

  const renderInGameScreen = () => {
    if (!currentQuestion) return null;
    const roundNo = roundIndex + 1;
    const progress = Math.round((roundNo / totalRounds) * 100);
    const timePercent = Math.round((roundTimeLeft / ROUND_TIME_MS) * 100);

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-tertiary)]">
              Round {roundNo}/{totalRounds}
            </span>
            <h3 className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">{currentQuestion.question}</h3>
            <div className="w-full sm:w-96 h-2 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="w-full sm:w-96 h-2 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-rose-500"
                style={{ width: `${Math.max(timePercent, 0)}%` }}
              />
            </div>
          </div>

          {renderScoreCards(roundNo)}
        </div>

        <div
          ref={arenaRef}
          role="button"
          tabIndex={0}
          onMouseMove={handleArenaMouseMove}
          onClick={(event) => {
            if (!arenaRef.current) return;
            const rect = arenaRef.current.getBoundingClientRect();
            const targetX = ((event.clientX - rect.left) / rect.width) * ARENA_WIDTH;
            const targetY = ((event.clientY - rect.top) / rect.height) * ARENA_HEIGHT;
            const clampedTarget = {
              x: clamp(targetX, 0, ARENA_WIDTH),
              y: clamp(targetY, 0, ARENA_HEIGHT),
            };
            setAim(clampedTarget);

            // Always shoot, don't insta-resolve so bullets always fly to target
            handleShoot(clampedTarget);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleShoot();
            }
          }}
          className="relative overflow-hidden rounded-3xl border border-slate-300 bg-[radial-gradient(circle_at_50%_-20%,#fef08a,#86efac_35%,#38bdf8_65%,#0ea5e9_100%)] h-[640px] cursor-crosshair select-none"
        >
          <div className="absolute inset-0 opacity-30 bg-[linear-gradient(to_right,rgba(255,255,255,0.25)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.25)_1px,transparent_1px)] bg-[size:24px_24px]" />

          {enemies.map((enemy) => renderEnemyCard(enemy))}

          {isPaused && !lockedRound && (
            renderPauseOverlay()
          )}

          <AnimatePresence>
            {feedback && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className={[
                  "absolute top-4 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full text-sm font-black shadow-lg",
                  feedback === "Đúng!" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white",
                  feedback === "Hết thời gian!" ? "bg-amber-500 text-slate-900" : "",
                ].join(" ")}
              >
                {feedback}
              </motion.div>
            )}
          </AnimatePresence>

          {renderBullets()}
          {renderAimArrow()}
          {renderShooterAvatar()}
          {renderCrosshair()}
        </div>

        {renderArenaHint()}
      </div>
    );
  };

  const renderEndScreen = () => {
    const finalScore = Number(submitResult?.score ?? score);
    const finalMaxScore = Number(submitResult?.max_score ?? maxScore);
    const finalAccuracy = finalMaxScore > 0 ? Math.round((finalScore / finalMaxScore) * 100) : accuracyPercent;
    const finalLabel = getEvaluationLabel(finalAccuracy);
    const skills = Array.isArray(submitResult?.skills_gained)
      ? submitResult.skills_gained
      : payload?.tracking?.skills || ["rag_knowledge", "critical_thinking"];

    return (
      <Card className="space-y-6 !p-8 sm:!p-10 !rounded-3xl !border-0 bg-[linear-gradient(135deg,#ecfeff_0%,#f0fdf4_45%,#fef9c3_100%)]">
        <div className="text-center">
          <div className="inline-flex w-16 h-16 rounded-full bg-emerald-500 text-white items-center justify-center mb-3">
            <Trophy className="w-8 h-8" />
          </div>
          <h3 className="text-3xl font-black text-emerald-900" style={{ fontFamily: "var(--font-display)" }}>
            Hoàn Thành 10 Round
          </h3>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 text-center">
          <div className="rounded-2xl bg-white/80 border border-emerald-200 p-4">
            <div className="text-xs uppercase font-bold text-emerald-700">Tổng điểm</div>
            <div className="text-3xl font-black text-emerald-900">{finalScore}</div>
          </div>
          <div className="rounded-2xl bg-white/80 border border-cyan-200 p-4">
            <div className="text-xs uppercase font-bold text-cyan-700">Độ chính xác</div>
            <div className="text-3xl font-black text-cyan-900">{finalAccuracy}%</div>
          </div>
          <div className="rounded-2xl bg-white/80 border border-amber-200 p-4">
            <div className="text-xs uppercase font-bold text-amber-700">Đánh giá</div>
            <div className="text-2xl font-black text-amber-900">{finalLabel}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 space-y-2">
          <div className="text-sm font-bold text-[var(--text-primary)]">Gợi ý cải thiện</div>
          <p className="text-sm text-[var(--text-secondary)]">{getSuggestion(finalAccuracy)}</p>
          <div className="text-xs text-[var(--text-tertiary)]">
            Skills tracking: {skills.join(", ")}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={beginGame} size="lg" className="bg-emerald-600 hover:bg-emerald-700 border-0">
            <RotateCcw className="w-4 h-4 mr-2" />
            Chơi lại
          </Button>
          <Button variant="secondary" size="lg" onClick={() => setScreen("start")}>
            Thoát
          </Button>
        </div>

        {submitting && <p className="text-center text-sm text-[var(--text-secondary)]">Đang gửi kết quả...</p>}
      </Card>
    );
  };

  if (!questions.length) {
    return (
      <Card className="text-center !p-8">
        <p className="text-sm text-[var(--text-secondary)]">Không có dữ liệu câu hỏi để chơi minigame bắn gà.</p>
      </Card>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {screen === "start" && renderStartScreen()}
      {screen === "playing" && renderInGameScreen()}
      {screen === "end" && renderEndScreen()}
    </motion.div>
  );
}
