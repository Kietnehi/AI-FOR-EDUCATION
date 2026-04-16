"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BellRing, CalendarCheck2, Flame, Goal, Mail, ShieldAlert, Sparkles } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNotify } from "@/components/use-notify";
import {
  checkInDaily,
  getDashboardPersonalization,
  getUserPreferences,
  sendLearningReminderEmail,
  updateUserPreferences,
} from "@/lib/api";
import { DashboardPersonalization } from "@/types";

const toBoundedNumber = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
};

const SETUP_FLAG_KEY = "learning_setup_completed_v1";
const WEEKDAY_OPTIONS = [
  { value: 0, label: "Thứ 2" },
  { value: 1, label: "Thứ 3" },
  { value: 2, label: "Thứ 4" },
  { value: 3, label: "Thứ 5" },
  { value: 4, label: "Thứ 6" },
  { value: 5, label: "Thứ 7" },
  { value: 6, label: "CN" },
];

const normalizeReminderDays = (value: unknown): number[] => {
  const days = Array.isArray(value) ? value : [];
  const cleaned = days
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6) as number[];
  const unique = Array.from(new Set(cleaned)).sort((a, b) => a - b);
  return unique.length > 0 ? unique : [0, 1, 2, 3, 4, 5, 6];
};

const DEFAULT_LEARNING_SETUP = {
  preferredLanguage: "vi",
  learningPace: "moderate" as const,
  studyGoal: "",
  reminderHourLocal: 20,
  reminderDaysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  reminderInAppEnabled: true,
  reminderEmailEnabled: true,
  weeklyGoalActiveDays: 5,
  weeklyGoalMinutes: 180,
  weeklyGoalItems: 6,
};

const parseIsoTime = (value?: string | null): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractApiErrorMessage = (error: unknown, fallback: string): string => {
  if (!(error instanceof Error) || !error.message) {
    return fallback;
  }

  const raw = error.message.trim();
  if (!raw) {
    return fallback;
  }

  if (/failed to fetch/i.test(raw) || /networkerror/i.test(raw)) {
    return "Không thể kết nối tới máy chủ. Hãy kiểm tra backend đang chạy và cấu hình CORS/API URL.";
  }

  try {
    const parsed = JSON.parse(raw) as { detail?: string };
    if (typeof parsed.detail === "string" && parsed.detail.trim()) {
      return parsed.detail.trim();
    }
  } catch {
    // Keep original raw message if it is not JSON.
  }

  return raw.length <= 220 ? raw : fallback;
};

const isFirstSetupCompleted = (prefs: Awaited<ReturnType<typeof getUserPreferences>>): boolean => {
  const localFlag = localStorage.getItem(SETUP_FLAG_KEY);
  if (localFlag === "true") {
    return true;
  }

  const createdAt = parseIsoTime(prefs.created_at);
  const updatedAt = parseIsoTime(prefs.updated_at);
  const serverWasUpdated = createdAt !== null && updatedAt !== null && updatedAt - createdAt >= 1000;
  if (serverWasUpdated) {
    return true;
  }

  return (
    (prefs.preferred_language || DEFAULT_LEARNING_SETUP.preferredLanguage) !== DEFAULT_LEARNING_SETUP.preferredLanguage
    || (prefs.learning_pace || DEFAULT_LEARNING_SETUP.learningPace) !== DEFAULT_LEARNING_SETUP.learningPace
    || Boolean((prefs.study_goal || "").trim())
    || toBoundedNumber(prefs.reminder_hour_local, DEFAULT_LEARNING_SETUP.reminderHourLocal, 0, 23)
      !== DEFAULT_LEARNING_SETUP.reminderHourLocal
    || normalizeReminderDays(prefs.reminder_days_of_week).join(",")
      !== DEFAULT_LEARNING_SETUP.reminderDaysOfWeek.join(",")
    || (prefs.reminder_in_app_enabled !== false) !== DEFAULT_LEARNING_SETUP.reminderInAppEnabled
    || (prefs.reminder_email_enabled !== false) !== DEFAULT_LEARNING_SETUP.reminderEmailEnabled
    || toBoundedNumber(prefs.weekly_goal_active_days, DEFAULT_LEARNING_SETUP.weeklyGoalActiveDays, 1, 7)
      !== DEFAULT_LEARNING_SETUP.weeklyGoalActiveDays
    || toBoundedNumber(prefs.weekly_goal_minutes, DEFAULT_LEARNING_SETUP.weeklyGoalMinutes, 30, 3000)
      !== DEFAULT_LEARNING_SETUP.weeklyGoalMinutes
    || toBoundedNumber(prefs.weekly_goal_items, DEFAULT_LEARNING_SETUP.weeklyGoalItems, 1, 200)
      !== DEFAULT_LEARNING_SETUP.weeklyGoalItems
  );
};

export default function LearningProgressPage() {
  const { user, loading: authLoading } = useAuth();
  const { success, warning, error: notifyError } = useNotify();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardPersonalization | null>(null);
  const [setupCompleted, setSetupCompleted] = useState(false);
  const [editingSetup, setEditingSetup] = useState(true);
  const [setupNotice, setSetupNotice] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [progressNotice, setProgressNotice] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const [preferredLanguage, setPreferredLanguage] = useState<string>("vi");
  const [learningPace, setLearningPace] = useState<"light" | "moderate" | "intensive">("moderate");
  const [studyGoal, setStudyGoal] = useState<string>("");
  const [reminderHourLocal, setReminderHourLocal] = useState<number>(20);
  const [reminderDaysOfWeek, setReminderDaysOfWeek] = useState<number[]>(DEFAULT_LEARNING_SETUP.reminderDaysOfWeek);
  const [reminderInAppEnabled, setReminderInAppEnabled] = useState<boolean>(true);
  const [reminderEmailEnabled, setReminderEmailEnabled] = useState<boolean>(true);
  const [weeklyGoalActiveDays, setWeeklyGoalActiveDays] = useState<number>(5);
  const [weeklyGoalMinutes, setWeeklyGoalMinutes] = useState<number>(180);
  const [weeklyGoalItems, setWeeklyGoalItems] = useState<number>(6);

  const applyPreferenceData = (prefs: Awaited<ReturnType<typeof getUserPreferences>>) => {
    setPreferredLanguage((prefs.preferred_language || DEFAULT_LEARNING_SETUP.preferredLanguage).trim() || DEFAULT_LEARNING_SETUP.preferredLanguage);
    if (prefs.learning_pace === "light" || prefs.learning_pace === "intensive") {
      setLearningPace(prefs.learning_pace);
    } else {
      setLearningPace(DEFAULT_LEARNING_SETUP.learningPace);
    }
    setStudyGoal(prefs.study_goal || "");
    setReminderHourLocal(toBoundedNumber(prefs.reminder_hour_local, DEFAULT_LEARNING_SETUP.reminderHourLocal, 0, 23));
    setReminderDaysOfWeek(normalizeReminderDays(prefs.reminder_days_of_week));
    setReminderInAppEnabled(prefs.reminder_in_app_enabled !== false);
    setReminderEmailEnabled(prefs.reminder_email_enabled !== false);
    setWeeklyGoalActiveDays(toBoundedNumber(prefs.weekly_goal_active_days, DEFAULT_LEARNING_SETUP.weeklyGoalActiveDays, 1, 7));
    setWeeklyGoalMinutes(toBoundedNumber(prefs.weekly_goal_minutes, DEFAULT_LEARNING_SETUP.weeklyGoalMinutes, 30, 3000));
    setWeeklyGoalItems(toBoundedNumber(prefs.weekly_goal_items, DEFAULT_LEARNING_SETUP.weeklyGoalItems, 1, 200));
  };

  const refreshData = async ({ preserveEditMode = true }: { preserveEditMode?: boolean } = {}) => {
    if (!user) return;

    const prefs = await getUserPreferences();
    const dashboardPayload = await getDashboardPersonalization().catch(() => null);

    applyPreferenceData(prefs);
    const completed = isFirstSetupCompleted(prefs);
    setSetupCompleted(completed);
    if (completed) {
      localStorage.setItem(SETUP_FLAG_KEY, "true");
      if (!preserveEditMode) {
        setEditingSetup(false);
      }
    } else {
      localStorage.removeItem(SETUP_FLAG_KEY);
      setEditingSetup(true);
    }
    setDashboard(dashboardPayload);

    if (!dashboardPayload) {
      setProgressNotice({
        type: "info",
        message: "Không tải được tổng quan tiến độ lúc này, nhưng bạn vẫn có thể lưu cấu hình.",
      });
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setDashboard(null);
      setSetupCompleted(false);
      setEditingSetup(true);
      return;
    }

    let cancelled = false;

    refreshData({ preserveEditMode: false })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = extractApiErrorMessage(error, "Không thể tải dữ liệu tiến độ học tập.");
          setProgressNotice({ type: "error", message });
          notifyError(message, "Tiến độ học tập");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const handleSavePreferences = async () => {
    if (!user || saving) return;
    setSaving(true);
    setSetupNotice(null);

    try {
      const updatedPrefs = await updateUserPreferences({
        preferred_language: preferredLanguage.trim() || "vi",
        learning_pace: learningPace,
        study_goal: studyGoal.trim() ? studyGoal.trim() : null,
        reminder_timezone: "Asia/Ho_Chi_Minh",
        reminder_hour_local: reminderHourLocal,
        reminder_days_of_week: reminderDaysOfWeek,
        reminder_in_app_enabled: reminderInAppEnabled,
        reminder_email_enabled: reminderEmailEnabled,
        weekly_goal_active_days: weeklyGoalActiveDays,
        weekly_goal_minutes: weeklyGoalMinutes,
        weekly_goal_items: weeklyGoalItems,
      });

      applyPreferenceData(updatedPrefs);
      setSetupCompleted(true);
      setEditingSetup(false);
      setSetupNotice({
        type: "success",
        message: "Đã lưu thiết lập học tập. Bạn có thể bấm Chỉnh sửa để cập nhật lại bất kỳ lúc nào.",
      });
      localStorage.setItem(SETUP_FLAG_KEY, "true");

      localStorage.setItem("learning_pref_language", preferredLanguage.trim() || "vi");
      localStorage.setItem("learning_pref_pace", learningPace);
      localStorage.setItem("learning_pref_goal", studyGoal.trim());
      localStorage.setItem("learning_reminder_hour", String(reminderHourLocal));
      localStorage.setItem("learning_reminder_days", JSON.stringify(reminderDaysOfWeek));
      localStorage.setItem("learning_reminder_in_app", String(reminderInAppEnabled));
      localStorage.setItem("learning_reminder_email", String(reminderEmailEnabled));
      localStorage.setItem("learning_goal_days", String(weeklyGoalActiveDays));
      localStorage.setItem("learning_goal_minutes", String(weeklyGoalMinutes));
      localStorage.setItem("learning_goal_items", String(weeklyGoalItems));

      success("Đã lưu cá nhân hóa học tập.", "Tiến độ học tập");
      await refreshData({ preserveEditMode: true });
    } catch (error: unknown) {
      const message = extractApiErrorMessage(error, "Không thể lưu cá nhân hóa học tập.");
      setSetupNotice({ type: "error", message });
      notifyError(message, "Tiến độ học tập");
    } finally {
      setSaving(false);
    }
  };

  const handleResetSetup = async () => {
    if (!user || resetting) return;
    setResetting(true);
    setSetupNotice(null);

    try {
      const updatedPrefs = await updateUserPreferences({
        preferred_language: DEFAULT_LEARNING_SETUP.preferredLanguage,
        learning_pace: DEFAULT_LEARNING_SETUP.learningPace,
        study_goal: null,
        reminder_timezone: "Asia/Ho_Chi_Minh",
        reminder_hour_local: DEFAULT_LEARNING_SETUP.reminderHourLocal,
        reminder_days_of_week: DEFAULT_LEARNING_SETUP.reminderDaysOfWeek,
        reminder_in_app_enabled: DEFAULT_LEARNING_SETUP.reminderInAppEnabled,
        reminder_email_enabled: DEFAULT_LEARNING_SETUP.reminderEmailEnabled,
        weekly_goal_active_days: DEFAULT_LEARNING_SETUP.weeklyGoalActiveDays,
        weekly_goal_minutes: DEFAULT_LEARNING_SETUP.weeklyGoalMinutes,
        weekly_goal_items: DEFAULT_LEARNING_SETUP.weeklyGoalItems,
      });

      applyPreferenceData(updatedPrefs);
      setSetupCompleted(false);
      setEditingSetup(true);
      setSetupNotice({
        type: "info",
        message: "Đã đưa cấu hình về mặc định. Bạn có thể thiết lập lại từ đầu.",
      });

      localStorage.removeItem(SETUP_FLAG_KEY);
      localStorage.removeItem("learning_pref_language");
      localStorage.removeItem("learning_pref_pace");
      localStorage.removeItem("learning_pref_goal");
      localStorage.removeItem("learning_reminder_hour");
      localStorage.removeItem("learning_reminder_days");
      localStorage.removeItem("learning_reminder_in_app");
      localStorage.removeItem("learning_reminder_email");
      localStorage.removeItem("learning_goal_days");
      localStorage.removeItem("learning_goal_minutes");
      localStorage.removeItem("learning_goal_items");

      await refreshData({ preserveEditMode: true });
    } catch (error: unknown) {
      const message = extractApiErrorMessage(error, "Không thể reset cấu hình học tập lúc này.");
      setSetupNotice({ type: "error", message });
      notifyError(message, "Tiến độ học tập");
    } finally {
      setResetting(false);
    }
  };

  const handleCheckIn = async (useStreakFreeze: boolean) => {
    if (!user || checkingIn) return;
    setCheckingIn(true);
    setProgressNotice(null);

    try {
      const result = await checkInDaily(useStreakFreeze);
      setDashboard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          habit_overview: result.habit_overview,
        };
      });
      setProgressNotice({ type: "success", message: result.message });
      success(result.message, "Điểm danh");
      await refreshData({ preserveEditMode: true });
    } catch (error: unknown) {
      const message = extractApiErrorMessage(error, "Không thể điểm danh lúc này. Vui lòng thử lại sau.");
      setProgressNotice({ type: "error", message });
      notifyError(message, "Điểm danh");
    } finally {
      setCheckingIn(false);
    }
  };

  const handleSendReminderEmail = async () => {
    if (!user || sendingReminder) return;
    setSendingReminder(true);
    setProgressNotice(null);

    try {
      const result = await sendLearningReminderEmail(false);
      if (result.sent) {
        setProgressNotice({ type: "success", message: result.message || "Đã gửi email nhắc học." });
        success(result.message || "Đã gửi email nhắc học.", "Nhắc học");
      } else {
        setProgressNotice({ type: "info", message: result.message || "Hiện chưa gửi được email nhắc học." });
        warning(result.message || "Hiện chưa gửi được email nhắc học.", "Nhắc học");
      }
      await refreshData({ preserveEditMode: true });
    } catch (error: unknown) {
      const message = extractApiErrorMessage(error, "Không thể gửi email nhắc học lúc này.");
      setProgressNotice({ type: "error", message });
      notifyError(message, "Nhắc học");
    } finally {
      setSendingReminder(false);
    }
  };

  const habit = dashboard?.habit_overview;
  const risk = dashboard?.risk_alert;
  const inAppReminder = dashboard?.reminders.find((item) => item.channel === "in_app");
  const emailReminder = dashboard?.reminders.find((item) => item.channel === "email");

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-8">
      <div className="space-y-2">
        <p className="inline-flex items-center gap-2 rounded-full border border-brand-200/80 dark:border-brand-500/30 bg-brand-50 dark:bg-brand-900/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
          <Sparkles className="h-3.5 w-3.5" />
          Overview
        </p>
        <h1 className="text-3xl font-black text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
          Tiến độ học tập
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Quản lý cá nhân hóa học tập, mục tiêu tuần, streak và nhắc học ở cùng một nơi.
        </p>
      </div>

      {!user && !authLoading ? (
        <Card className="!p-6">
          <p className="text-sm text-[var(--text-secondary)]">Bạn cần đăng nhập để sử dụng mục Tiến độ học tập.</p>
          <div className="mt-4">
            <Link href="/auth/login" className="no-underline">
              <Button size="sm">Đăng nhập</Button>
            </Link>
          </div>
        </Card>
      ) : null}

      {user ? (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="!p-6">
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Cá nhân hóa học tập</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Thiết lập thói quen học, nhắc học và mục tiêu tuần.</p>

                {setupNotice ? (
                  <p
                    className={`mt-4 rounded-lg border px-3 py-2 text-xs font-medium ${
                      setupNotice.type === "error"
                        ? "border-red-300/60 bg-red-50 text-red-700"
                        : setupNotice.type === "success"
                          ? "border-emerald-300/60 bg-emerald-50 text-emerald-700"
                          : "border-brand-300/60 bg-brand-50 text-brand-700"
                    }`}
                  >
                    {setupNotice.message}
                  </p>
                ) : null}

                {editingSetup ? (
                  <>
                    <div className="mt-5 space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-1.5">
                          <span className="block text-xs font-semibold text-[var(--text-secondary)]">Ngôn ngữ ưu tiên</span>
                          <select
                            value={preferredLanguage}
                            onChange={(event) => setPreferredLanguage(event.target.value)}
                            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm font-medium text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-brand-500"
                          >
                            <option value="vi">Tiếng Việt</option>
                            <option value="en">English</option>
                          </select>
                        </label>

                        <label className="space-y-1.5">
                          <span className="block text-xs font-semibold text-[var(--text-secondary)]">Nhịp học mong muốn</span>
                          <select
                            value={learningPace}
                            onChange={(event) => setLearningPace(event.target.value as "light" | "moderate" | "intensive")}
                            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm font-medium text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-brand-500"
                          >
                            <option value="light">Nhẹ</option>
                            <option value="moderate">Vừa</option>
                            <option value="intensive">Chuyên sâu</option>
                          </select>
                        </label>
                      </div>

                      <label className="space-y-1.5">
                        <span className="block text-xs font-semibold text-[var(--text-secondary)]">Mục tiêu học tập</span>
                        <input
                          type="text"
                          value={studyGoal}
                          onChange={(event) => setStudyGoal(event.target.value)}
                          placeholder="Ví dụ: Nắm chắc xác suất trong 4 tuần"
                          className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm font-medium text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </label>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-1.5">
                          <span className="block text-xs font-semibold text-[var(--text-secondary)]">Giờ nhắc học (mặc định VN)</span>
                          <select
                            value={String(reminderHourLocal)}
                            onChange={(event) => setReminderHourLocal(Math.min(23, Math.max(0, Number(event.target.value) || 20)))}
                            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm font-medium text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-brand-500"
                          >
                            {Array.from({ length: 24 }).map((_, hour) => (
                              <option key={hour} value={hour}>{hour.toString().padStart(2, "0")}:00</option>
                            ))}
                          </select>
                        </label>

                        <div className="space-y-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5">
                          <p className="text-xs font-semibold text-[var(--text-secondary)]">Kênh nhắc học</p>
                          <label className="flex items-center justify-between text-sm text-[var(--text-primary)]">
                            In-app
                            <input
                              type="checkbox"
                              checked={reminderInAppEnabled}
                              onChange={(event) => setReminderInAppEnabled(event.target.checked)}
                              className="h-4 w-4 rounded border-[var(--border-default)] text-brand-600"
                            />
                          </label>
                          <label className="flex items-center justify-between text-sm text-[var(--text-primary)]">
                            Email
                            <input
                              type="checkbox"
                              checked={reminderEmailEnabled}
                              onChange={(event) => setReminderEmailEnabled(event.target.checked)}
                              className="h-4 w-4 rounded border-[var(--border-default)] text-brand-600"
                            />
                          </label>
                        </div>
                      </div>

                      <div className="space-y-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5">
                        <p className="text-xs font-semibold text-[var(--text-secondary)]">Ngày gửi nhắc học qua email</p>
                        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                          {WEEKDAY_OPTIONS.map((day) => {
                            const checked = reminderDaysOfWeek.includes(day.value);
                            return (
                              <button
                                key={day.value}
                                type="button"
                                onClick={() => {
                                  setReminderDaysOfWeek((prev) => {
                                    const has = prev.includes(day.value);
                                    if (has) {
                                      const next = prev.filter((item) => item !== day.value);
                                      return next.length > 0 ? next : prev;
                                    }
                                    return [...prev, day.value].sort((a, b) => a - b);
                                  });
                                }}
                                className={`rounded-md border px-2 py-1 text-xs font-semibold transition ${checked ? "border-brand-500 bg-brand-50 text-brand-700" : "border-[var(--border-default)] bg-transparent text-[var(--text-secondary)] hover:border-brand-300"}`}
                              >
                                {day.label}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[11px] text-[var(--text-tertiary)]">Cần chọn ít nhất 1 ngày trong tuần.</p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <label className="space-y-1.5">
                          <span className="block text-xs font-semibold text-[var(--text-secondary)]">Mục tiêu ngày/tuần</span>
                          <input
                            type="number"
                            min={1}
                            max={7}
                            value={weeklyGoalActiveDays}
                            onChange={(event) => setWeeklyGoalActiveDays(Math.min(7, Math.max(1, Number(event.target.value) || 5)))}
                            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm font-medium text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-brand-500"
                          />
                        </label>

                        <label className="space-y-1.5">
                          <span className="block text-xs font-semibold text-[var(--text-secondary)]">Mục tiêu phút/tuần</span>
                          <input
                            type="number"
                            min={30}
                            max={3000}
                            value={weeklyGoalMinutes}
                            onChange={(event) => setWeeklyGoalMinutes(Math.min(3000, Math.max(30, Number(event.target.value) || 180)))}
                            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm font-medium text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-brand-500"
                          />
                        </label>

                        <label className="space-y-1.5">
                          <span className="block text-xs font-semibold text-[var(--text-secondary)]">Mục tiêu tác vụ/tuần</span>
                          <input
                            type="number"
                            min={1}
                            max={200}
                            value={weeklyGoalItems}
                            onChange={(event) => setWeeklyGoalItems(Math.min(200, Math.max(1, Number(event.target.value) || 6)))}
                            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm font-medium text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-brand-500"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button loading={saving} onClick={handleSavePreferences} fullWidth={!setupCompleted}>
                        {setupCompleted ? "Lưu cập nhật" : "Lưu cá nhân hóa học tập"}
                      </Button>
                      {setupCompleted ? (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setEditingSetup(false);
                            setSetupNotice(null);
                            refreshData({ preserveEditMode: false }).catch(() => undefined);
                          }}
                        >
                          Hủy chỉnh sửa
                        </Button>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="mt-5 space-y-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                      Cấu hình đã lưu
                    </p>
                    <div className="grid gap-2 text-sm text-[var(--text-primary)] sm:grid-cols-2">
                      <p>Ngôn ngữ: <strong>{preferredLanguage === "en" ? "English" : "Tiếng Việt"}</strong></p>
                      <p>Nhịp học: <strong>{learningPace === "light" ? "Nhẹ" : learningPace === "intensive" ? "Chuyên sâu" : "Vừa"}</strong></p>
                      <p>Giờ nhắc: <strong>{String(reminderHourLocal).padStart(2, "0")}:00</strong> (VN)</p>
                      <p>Ngày nhắc: <strong>{reminderDaysOfWeek.map((day) => WEEKDAY_OPTIONS.find((item) => item.value === day)?.label || day).join(", ")}</strong></p>
                      <p>Kênh nhắc: <strong>{reminderInAppEnabled ? "In-app" : "Tắt in-app"} / {reminderEmailEnabled ? "Email" : "Tắt email"}</strong></p>
                      <p>Mục tiêu ngày/tuần: <strong>{weeklyGoalActiveDays}</strong></p>
                      <p>Mục tiêu phút/tuần: <strong>{weeklyGoalMinutes}</strong></p>
                      <p>Mục tiêu tác vụ/tuần: <strong>{weeklyGoalItems}</strong></p>
                      <p>Mục tiêu học tập: <strong>{studyGoal.trim() || "Chưa đặt"}</strong></p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setEditingSetup(true);
                          setSetupNotice(null);
                        }}
                      >
                        Chỉnh sửa
                      </Button>
                      <Button
                        variant="ghost"
                        loading={resetting}
                        onClick={handleResetSetup}
                      >
                        Reset về mặc định
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
              <Card className="!p-6">
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Tiến độ hiện tại</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Theo dõi streak, mục tiêu tuần và hành động gợi ý.</p>

                {loading ? (
                  <p className="mt-4 text-sm text-[var(--text-secondary)]">Đang tải dữ liệu tiến độ...</p>
                ) : (
                  <div className="mt-5 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
                        <p className="text-xs text-[var(--text-secondary)]">Streak hiện tại</p>
                        <p className="mt-1 flex items-center gap-1 text-lg font-bold text-[var(--text-primary)]">
                          <Flame className="h-4 w-4 text-amber-500" />
                          {habit?.current_streak_days ?? 0} ngày
                        </p>
                      </div>
                      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
                        <p className="text-xs text-[var(--text-secondary)]">Streak cao nhất</p>
                        <p className="mt-1 flex items-center gap-1 text-lg font-bold text-[var(--text-primary)]">
                          <CalendarCheck2 className="h-4 w-4 text-emerald-500" />
                          {habit?.longest_streak_days ?? 0} ngày
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-semibold text-[var(--text-primary)]">Tiến độ mục tiêu tuần</span>
                        <span className="text-[var(--text-tertiary)]">{habit?.weekly_goal.completion_rate ?? 0}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-primary)]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500"
                          style={{ width: `${Math.max(4, Math.min(habit?.weekly_goal.completion_rate ?? 0, 100))}%` }}
                        />
                      </div>
                      <div className="mt-2 grid gap-1 text-xs text-[var(--text-secondary)] sm:grid-cols-3">
                        <p>Ngày: {habit?.weekly_goal.active_days ?? 0}/{habit?.weekly_goal.active_days_goal ?? weeklyGoalActiveDays}</p>
                        <p>Phút: {habit?.weekly_goal.minutes ?? 0}/{habit?.weekly_goal.minutes_goal ?? weeklyGoalMinutes}</p>
                        <p>Tác vụ: {habit?.weekly_goal.completed_items ?? 0}/{habit?.weekly_goal.completed_items_goal ?? weeklyGoalItems}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        loading={checkingIn}
                        onClick={() => handleCheckIn(false)}
                        disabled={Boolean(habit?.checkin_today)}
                        icon={<Goal className="h-4 w-4" />}
                      >
                        {habit?.checkin_today ? "Đã điểm danh hôm nay" : "Điểm danh hôm nay"}
                      </Button>

                      {!habit?.checkin_today
                      && habit?.days_since_last_checkin === 2
                      && (habit?.freeze_remaining_this_week ?? 0) > 0 ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={checkingIn}
                          onClick={() => handleCheckIn(true)}
                        >
                          Dùng đóng băng streak
                        </Button>
                      ) : null}

                      <Button
                        size="sm"
                        variant="ghost"
                        loading={sendingReminder}
                        onClick={handleSendReminderEmail}
                        disabled={!reminderEmailEnabled}
                        icon={<Mail className="h-4 w-4" />}
                      >
                        Gửi email nhắc học
                      </Button>
                    </div>

                    {progressNotice ? (
                      <p
                        className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                          progressNotice.type === "error"
                            ? "border-red-300/60 bg-red-50 text-red-700"
                            : progressNotice.type === "success"
                              ? "border-emerald-300/60 bg-emerald-50 text-emerald-700"
                              : "border-brand-300/60 bg-brand-50 text-brand-700"
                        }`}
                      >
                        {progressNotice.message}
                      </p>
                    ) : null}
                  </div>
                )}
              </Card>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <Card className="!p-6">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Tín hiệu duy trì học tập</h2>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 lg:col-span-2">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Cảnh báo rủi ro</p>
                  {risk?.status && risk.status !== "stable" ? (
                    <>
                      <p className="inline-flex items-center gap-2 rounded-full border border-amber-300/70 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        {risk.status === "high_risk" ? "Nguy cơ cao" : "Cảnh báo"}
                      </p>
                      <div className="mt-3 space-y-1.5 text-sm text-[var(--text-primary)]">
                        {(risk.reasons || []).map((reason) => (
                          <p key={reason}>• {reason}</p>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="rounded-lg border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                      Nhịp học đang ổn định. Bạn đang duy trì rất tốt.
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Nhắc học</p>
                  <div className="space-y-2 text-sm text-[var(--text-primary)]">
                    <p className="flex items-start gap-2">
                      <BellRing className="mt-0.5 h-4 w-4 text-brand-600" />
                      <span>{inAppReminder?.message || "Nhắc học trong app đang hoạt động."}</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <Mail className="mt-0.5 h-4 w-4 text-brand-600" />
                      <span>{emailReminder?.message || "Email nhắc học đang hoạt động."}</span>
                    </p>
                  </div>
                </div>
              </div>

              {(dashboard?.next_actions?.length || 0) > 0 ? (
                <div className="mt-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Gợi ý hành động tiếp theo</p>
                  <div className="space-y-1.5 text-sm text-[var(--text-primary)]">
                    {dashboard?.next_actions.slice(0, 4).map((action) => (
                      <p key={action}>• {action}</p>
                    ))}
                  </div>
                </div>
              ) : null}
            </Card>
          </motion.div>
        </>
      ) : null}
    </div>
  );
}
