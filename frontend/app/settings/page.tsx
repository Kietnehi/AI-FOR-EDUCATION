"use client";

import { motion } from "framer-motion";
import { Settings, User, Bell, Shield, Palette, Database } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function SettingsPage() {
  const sections = [
    { title: "Tài khoản", icon: User, desc: "Quản lý thông tin cá nhân và bảo mật" },
    { title: "Thông báo", icon: Bell, desc: "Cấu hình nhận thông báo hệ thống" },
    { title: "Giao diện", icon: Palette, desc: "Tùy chỉnh màu sắc và chế độ tối/sáng" },
    { title: "Dữ liệu", icon: Database, desc: "Quản lý dữ liệu và bộ nhớ tạm" },
    { title: "Bảo mật", icon: Shield, desc: "Bảo vệ tài khoản và quyền riêng tư" },
  ];

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600">
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
                <div className="w-12 h-12 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-tertiary)] group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-colors">
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">{section.title}</h3>
                  <p className="text-sm text-[var(--text-secondary)]">{section.desc}</p>
                </div>
                <div className="text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                  Thiết lập
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
      
      <div className="mt-12 p-6 rounded-2xl bg-indigo-50/50 border border-indigo-100 text-center">
        <p className="text-sm text-indigo-600 font-medium">Phiên bản: 0.1.0 Beta</p>
      </div>
    </div>
  );
}
