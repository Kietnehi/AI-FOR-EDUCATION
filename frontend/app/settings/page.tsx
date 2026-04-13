"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Settings, User, Bell, Shield, Palette, Database, Moon, Sun, Bot } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Card } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";
import { useTheme } from "@/components/theme-provider";
import { getUserPreferences, updateUserPreferences } from "@/lib/api";

type CustomModelOption = {
  id: string;
  name: string;
};

export default function SettingsPage() {
  const { theme, toggle } = useTheme();
  const { user } = useAuth();
  const [chatModelId, setChatModelId] = useState<string>("openai/gpt-4o-mini");
  const [chatModelName, setChatModelName] = useState<string>("GPT-4o Mini");
  const [showAddModelForm, setShowAddModelForm] = useState<boolean>(false);
  const [customModels, setCustomModels] = useState<CustomModelOption[]>([]);
  const [newCustomModelId, setNewCustomModelId] = useState("");
  const [newCustomModelName, setNewCustomModelName] = useState("");
  const [deleteTargetModelId, setDeleteTargetModelId] = useState("");
  const [modelSupportsReasoning, setModelSupportsReasoning] = useState<boolean>(false);
  const [useGeminiRotation, setUseGeminiRotation] = useState<boolean>(true);
  const [preferredLanguage, setPreferredLanguage] = useState<string>("vi");
  const [learningPace, setLearningPace] = useState<"light" | "moderate" | "intensive">("moderate");
  const [studyGoal, setStudyGoal] = useState<string>("");
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState<"success" | "error" | "info">("info");
  const [noticeKey, setNoticeKey] = useState(0);

  const presetModels = [
    { id: "openai/gpt-4o-mini", name: "GPT-4o Mini (Mặc định)" },
    { id: "qwen/qwen3.6-plus:free", name: "Qwen 3.6 Plus (Miễn phí)" },
    { id: "deepseek/deepseek-v3.2", name: "DeepSeek V3.2" },
    { id: "minimax/minimax-m2.7", name: "MiniMax M2.7" },
  ];

  const applyStoredSettings = useCallback(() => {
    const legacyModel = localStorage.getItem("chat_model");
    const savedModelId = localStorage.getItem("chat_model_id");
    const savedModelName = localStorage.getItem("chat_model_name");
    const savedSupportsReasoning = localStorage.getItem("chat_model_supports_reasoning");
    const savedUseGeminiRotation = localStorage.getItem("chat_use_gemini_rotation");
    const savedCustomModels = localStorage.getItem("chat_custom_models");
    const savedPreferredLanguage = localStorage.getItem("learning_pref_language");
    const savedLearningPace = localStorage.getItem("learning_pref_pace");
    const savedStudyGoal = localStorage.getItem("learning_pref_goal");

    let parsedCustomModels: CustomModelOption[] = [];
    if (savedCustomModels) {
      try {
        const parsed = JSON.parse(savedCustomModels);
        if (Array.isArray(parsed)) {
          parsedCustomModels = parsed
            .filter((item) => item && typeof item.id === "string")
            .map((item) => ({
              id: String(item.id).trim(),
              name: String(item.name || item.id).trim(),
            }))
            .filter((item) => item.id.length > 0);
        }
      } catch {
        parsedCustomModels = [];
      }
    }

    const normalizedModelId = (savedModelId || legacyModel || "openai/gpt-4o-mini").trim();
    setChatModelId(normalizedModelId);
    setChatModelName((savedModelName || "GPT-4o Mini").trim() || "GPT-4o Mini");
    setCustomModels(parsedCustomModels);
    setDeleteTargetModelId(parsedCustomModels[0]?.id || "");
    setModelSupportsReasoning(savedSupportsReasoning === "true");
    setUseGeminiRotation(savedUseGeminiRotation !== "false");
    setPreferredLanguage((savedPreferredLanguage || "vi").trim() || "vi");
    if (savedLearningPace === "light" || savedLearningPace === "intensive") {
      setLearningPace(savedLearningPace);
    } else {
      setLearningPace("moderate");
    }
    setStudyGoal(savedStudyGoal || "");
  }, []);

  useEffect(() => {
    applyStoredSettings();
  }, [applyStoredSettings]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    getUserPreferences()
      .then((prefs) => {
        if (cancelled) return;
        setChatModelId(prefs.chat_model_id || "openai/gpt-4o-mini");
        setChatModelName((prefs.chat_model_name || prefs.chat_model_id || "GPT-4o Mini").trim());
        setModelSupportsReasoning(Boolean(prefs.chat_model_supports_reasoning));
        setUseGeminiRotation(prefs.chat_use_gemini_rotation !== false);
        setPreferredLanguage((prefs.preferred_language || "vi").trim() || "vi");
        if (prefs.learning_pace === "light" || prefs.learning_pace === "intensive") {
          setLearningPace(prefs.learning_pace);
        } else {
          setLearningPace("moderate");
        }
        setStudyGoal(prefs.study_goal || "");

        const serverCustomModels = Array.isArray(prefs.chat_custom_models)
          ? prefs.chat_custom_models
              .filter((item) => item && typeof item.id === "string")
              .map((item) => ({
                id: String(item.id).trim(),
                name: String(item.name || item.id).trim(),
              }))
              .filter((item) => item.id.length > 0)
          : [];
        setCustomModels(serverCustomModels);
        setDeleteTargetModelId(serverCustomModels[0]?.id || "");
      })
      .catch(() => {
        // Keep local settings as fallback if API is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleSaveAiSettings = async () => {
    const normalizedModelId = chatModelId.trim();
    const normalizedModelName = chatModelName.trim();

    if (!normalizedModelId) {
      setNoticeType("error");
      setNotice("Vui lòng nhập model ID. Ví dụ: qwen/qwen3.6-plus:free");
      setNoticeKey((prev) => prev + 1);
      return;
    }

    try {
      localStorage.setItem("chat_model", normalizedModelId);
      localStorage.setItem("chat_model_id", normalizedModelId);
      localStorage.setItem("chat_model_name", normalizedModelName || normalizedModelId);
      localStorage.setItem("chat_custom_models", JSON.stringify(customModels));
      localStorage.setItem("chat_model_supports_reasoning", String(modelSupportsReasoning));
      localStorage.removeItem("chat_show_reasoning_toggle");
      localStorage.setItem("chat_use_gemini_rotation", String(useGeminiRotation));
      localStorage.setItem("learning_pref_language", preferredLanguage.trim() || "vi");
      localStorage.setItem("learning_pref_pace", learningPace);
      localStorage.setItem("learning_pref_goal", studyGoal.trim());

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("chat-settings-updated"));
      }

      if (user) {
        try {
          await updateUserPreferences({
            theme,
            chat_model_id: normalizedModelId,
            chat_model_name: normalizedModelName || normalizedModelId,
            chat_custom_models: customModels,
            chat_model_supports_reasoning: modelSupportsReasoning,
            chat_use_gemini_rotation: useGeminiRotation,
            preferred_language: preferredLanguage.trim() || "vi",
            learning_pace: learningPace,
            study_goal: studyGoal.trim() ? studyGoal.trim() : null,
          });
        } catch {
          setNoticeType("info");
          setNotice("Đã lưu trên thiết bị. Chưa đồng bộ lên tài khoản, vui lòng thử lại sau.");
          setNoticeKey((prev) => prev + 1);
          return;
        }
      }

      setNoticeType("success");
      setNotice("Đã lưu cấu hình model AI");
      setNoticeKey((prev) => prev + 1);
    } catch {
      setNoticeType("error");
      setNotice("Không thể lưu cấu hình. Hãy kiểm tra quyền localStorage của trình duyệt.");
      setNoticeKey((prev) => prev + 1);
    }
  };

  const persistCustomModels = (models: CustomModelOption[]) => {
    try {
      localStorage.setItem("chat_custom_models", JSON.stringify(models));
      return true;
    } catch {
      setNoticeType("error");
      setNotice("Không thể lưu danh sách model tùy chỉnh.");
      setNoticeKey((prev) => prev + 1);
      return false;
    }
  };

  const handlePresetModelChange = (value: string) => {
    setChatModelId(value);
    const matched = presetModels.find((item) => item.id === value);
    if (matched) {
      setChatModelName(matched.name.replace(" (Mặc định)", "").replace(" (Miễn phí)", ""));
      return;
    }

    const matchedCustom = customModels.find((item) => item.id === value);
    if (matchedCustom) {
      setChatModelName(matchedCustom.name);
    }
  };

  const handleAddCustomModel = () => {
    const modelId = newCustomModelId.trim();
    const modelName = newCustomModelName.trim();

    if (!modelId) {
      setNoticeType("error");
      setNotice("Vui lòng nhập Model ID trước khi thêm.");
      setNoticeKey((prev) => prev + 1);
      return;
    }

    const alreadyExists = presetModels.some((item) => item.id === modelId) || customModels.some((item) => item.id === modelId);
    if (alreadyExists) {
      setNoticeType("error");
      setNotice("Model này đã có trong danh sách.");
      setNoticeKey((prev) => prev + 1);
      return;
    }

    const nextModel: CustomModelOption = {
      id: modelId,
      name: modelName || modelId,
    };

    const nextCustomModels = [...customModels, nextModel];
    setCustomModels(nextCustomModels);
    persistCustomModels(nextCustomModels);
    setDeleteTargetModelId(modelId);
    setChatModelId(modelId);
    setChatModelName(nextModel.name);
    setNewCustomModelId("");
    setNewCustomModelName("");

    setNoticeType("success");
    setNotice("Đã thêm model vào danh sách.");
    setNoticeKey((prev) => prev + 1);
  };

  const handleDeleteCustomModel = () => {
    if (!deleteTargetModelId) {
      setNoticeType("error");
      setNotice("Vui lòng chọn model cần xóa.");
      setNoticeKey((prev) => prev + 1);
      return;
    }

    const nextCustomModels = customModels.filter((item) => item.id !== deleteTargetModelId);
    setCustomModels(nextCustomModels);
    persistCustomModels(nextCustomModels);
    setDeleteTargetModelId(nextCustomModels[0]?.id || "");

    if (chatModelId === deleteTargetModelId) {
      setChatModelId("openai/gpt-4o-mini");
      setChatModelName("GPT-4o Mini");
    }

    setNoticeType("info");
    setNotice("Đã xóa model tùy chỉnh khỏi danh sách.");
    setNoticeKey((prev) => prev + 1);
  };

  const isCustomModel = !!chatModelId && customModels.some((model) => model.id === chatModelId);

  const sections = [
    { title: "Tài khoản", icon: User, desc: "Quản lý thông tin cá nhân và bảo mật" },
    { title: "Thông báo", icon: Bell, desc: "Cấu hình nhận thông báo hệ thống" },
    {
      title: "Giao diện",
      icon: Palette,
      desc: "Tùy chỉnh màu sắc và chế độ tối/sáng",
      action: (
        <button
          type="button"
          onClick={toggle}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)]"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"}
        </button>
      ),
    },
    {
      title: "Mô hình AI",
      icon: Bot,
      desc: "Cấu hình model, reasoning và chiến lược chạy",
      action: (
        <div className="w-full max-w-[460px] flex flex-col gap-4 mt-4 lg:mt-0 p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-sm">
          {/* Chọn Model */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[var(--text-primary)]">
              Model đang sử dụng
            </label>
            <div className="flex gap-2">
              <select
                value={chatModelId}
                onChange={(e) => handlePresetModelChange(e.target.value)}
                className="flex-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm font-medium text-[var(--text-primary)] cursor-pointer outline-none focus:ring-2 focus:ring-brand-500 transition-shadow"
              >
                {presetModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
                {!presetModels.some((model) => model.id === chatModelId) && chatModelId && (
                  <option value={chatModelId}>{chatModelName || chatModelId} (Tùy chỉnh)</option>
                )}
                {customModels
                  .filter((model) => model.id !== chatModelId)
                  .map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} (Tùy chỉnh)
                    </option>
                  ))}
              </select>

              <button
                type="button"
                onClick={() => setShowAddModelForm((prev) => !prev)}
                className="shrink-0 flex items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)]"
                title={showAddModelForm ? "Đóng form" : "Quản lý model"}
              >
                {showAddModelForm ? "Đóng" : "Quản lý"}
              </button>
            </div>
          </div>

          {/* Thêm / Xóa Custom Model */}
          {showAddModelForm && (
            <div className="space-y-4 p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)]">
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                    Model ID
                  </label>
                  <input
                    type="text"
                    value={newCustomModelId}
                    onChange={(e) => setNewCustomModelId(e.target.value)}
                    placeholder="Ví dụ: qwen/qwen3.6-plus:free"
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:ring-2 focus:ring-brand-500 transition-shadow"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                    Tên hiển thị
                  </label>
                  <input
                    type="text"
                    value={newCustomModelName}
                    onChange={(e) => setNewCustomModelName(e.target.value)}
                    placeholder="Ví dụ: Qwen 3.6 Plus"
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:ring-2 focus:ring-brand-500 transition-shadow"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddCustomModel}
                  className="w-full inline-flex justify-center items-center rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-700"
                >
                  Thêm vào danh sách
                </button>
              </div>

              {customModels.length > 0 && (
                <div className="pt-4 mt-4 border-t border-[var(--border-default)] space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                      Xóa model tùy chỉnh
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={deleteTargetModelId}
                        onChange={(e) => setDeleteTargetModelId(e.target.value)}
                        className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        {customModels.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleDeleteCustomModel}
                        className="shrink-0 inline-flex items-center justify-center rounded-lg border border-red-500/20 bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-600 dark:text-red-400 transition-colors hover:bg-red-100 dark:hover:bg-red-500/20"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reasoning & Rotation Options */}
          <div className="space-y-3">
            <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] cursor-pointer hover:border-brand-500/30 transition-colors">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                Model có hỗ trợ Reasoning
              </span>
              <input
                type="checkbox"
                checked={modelSupportsReasoning}
                onChange={(e) => setModelSupportsReasoning(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border-default)] text-brand-600 focus:ring-brand-500 cursor-pointer"
              />
            </label>

            <div className="p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)]">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Chiến lược Gọi API
              </p>
              <div className="space-y-2">
                <label className="flex items-start gap-3 group cursor-pointer relative">
                  <div className="flex h-5 items-center">
                    <input
                      type="radio"
                      name="rotation-mode"
                      checked={useGeminiRotation}
                      onChange={() => setUseGeminiRotation(true)}
                      className="h-4 w-4 border-[var(--border-default)] text-brand-600 focus:ring-brand-500 cursor-pointer mt-0.5"
                    />
                  </div>
                  <div className="text-sm">
                    <p className="font-medium text-[var(--text-primary)]">Gemini Rotation</p>
                    <p className="text-xs text-[var(--text-secondary)]">Gọi Google Gemini trước, nếu lỗi sẽ tự động fallback.</p>
                  </div>
                </label>
                
                <label className="flex items-start gap-3 group cursor-pointer relative">
                  <div className="flex h-5 items-center">
                    <input
                      type="radio"
                      name="rotation-mode"
                      checked={!useGeminiRotation}
                      onChange={() => setUseGeminiRotation(false)}
                      className="h-4 w-4 border-[var(--border-default)] text-brand-600 focus:ring-brand-500 cursor-pointer mt-0.5"
                    />
                  </div>
                  <div className="text-sm">
                    <p className="font-medium text-[var(--text-primary)]">Trực tiếp</p>
                    <p className="text-xs text-[var(--text-secondary)]">Chạy thẳng model đã chọn, bỏ qua Gemini.</p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Cá nhân hóa học tập
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="block text-xs font-semibold text-[var(--text-secondary)]">Ngôn ngữ ưu tiên</span>
                <select
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm font-medium text-[var(--text-primary)] cursor-pointer outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="vi">Tiếng Việt</option>
                  <option value="en">English</option>
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="block text-xs font-semibold text-[var(--text-secondary)]">Nhịp học mong muốn</span>
                <select
                  value={learningPace}
                  onChange={(e) => setLearningPace(e.target.value as "light" | "moderate" | "intensive")}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm font-medium text-[var(--text-primary)] cursor-pointer outline-none focus:ring-2 focus:ring-brand-500"
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
                onChange={(e) => setStudyGoal(e.target.value)}
                placeholder="Ví dụ: Nắm chắc xác suất trong 4 tuần"
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm font-medium text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:ring-2 focus:ring-brand-500"
              />
            </label>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleSaveAiSettings}
              className="w-full inline-flex justify-center items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-700 active:scale-[0.98]"
            >
              Lưu cấu hình AI
            </button>
            {notice && (
              <p
                className={`mt-3 text-center text-xs font-semibold ${
                  noticeType === "error"
                    ? "text-red-500 dark:text-red-400"
                    : noticeType === "success"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-[var(--text-secondary)]"
                }`}
              >
                {notice}
              </p>
            )}
          </div>
        </div>
      ),
    },
    { title: "Dữ liệu", icon: Database, desc: "Quản lý dữ liệu và bộ nhớ tạm" },
    { title: "Bảo mật", icon: Shield, desc: "Bảo vệ tài khoản và quyền riêng tư" },
  ];

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center text-brand-600">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">Cài đặt</h1>
          <p className="text-[var(--text-secondary)] mt-1">Quản lý cấu hình hệ thống và tài khoản của bạn</p>
        </div>
      </div>

      <div className="grid gap-4">
        {sections.map((section, index) => {
          const Icon = section.icon;
          return (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card hover className="flex items-center gap-6 p-6 cursor-pointer group">
                <div className="w-12 h-12 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-tertiary)] group-hover:text-brand-600 group-hover:bg-brand-50 transition-colors">
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">{section.title}</h3>
                  <p className="text-sm text-[var(--text-secondary)]">{section.desc}</p>
                </div>
                {section.action ? (
                  <div onClick={(event) => event.stopPropagation()}>{section.action}</div>
                ) : (
                  <div className="text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                    Thiết lập
                  </div>
                )}
              </Card>
            </motion.div>
          );
        })}
      </div>
      
      <div className="mt-12 p-6 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-default)] text-center">
        <p className="text-sm text-[var(--text-secondary)] font-medium">Phiên bản: 0.1.0 Beta</p>
      </div>

      <Toast key={noticeKey} message={notice} type={noticeType} onClose={() => setNotice("")} />
    </div>
  );
}
