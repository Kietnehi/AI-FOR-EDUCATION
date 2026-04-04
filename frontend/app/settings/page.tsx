"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Settings, User, Bell, Shield, Palette, Database, Moon, Sun, Bot } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useTheme } from "@/components/theme-provider";

export default function SettingsPage() {
  const { theme, toggle } = useTheme();
  const [chatModel, setChatModel] = useState<string>("openai/gpt-4o-mini");

  useEffect(() => {
    const saved = localStorage.getItem("chat_model");
    if (saved) setChatModel(saved);
  }, []);

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setChatModel(e.target.value);
    localStorage.setItem("chat_model", e.target.value);
  };

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
      desc: "Lựa chọn mô hình cho Chatbot",
      action: (
        <select
          value={chatModel}
          onChange={handleModelChange}
          className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] cursor-pointer outline-none focus:ring-2 focus:ring-brand-500 min-w-[150px]"
        >
          <option value="openai/gpt-4o-mini">GPT-4o Mini (Mặc định)</option>
          <option value="qwen/qwen3.6-plus:free">Qwen 3.6 Plus (Miễn phí)</option>
          <option value="deepseek/deepseek-v3.2">DeepSeek V3.2</option>
          <option value="minimax/minimax-m2.7">MiniMax M2.7</option>
        </select>
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
    </div>
  );
}
