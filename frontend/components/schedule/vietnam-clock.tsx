"use client";

import { useState, useEffect } from "react";
import { Clock, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface VietnamClockProps {
  compact?: boolean;
}

export function VietnamClock({ compact = false }: VietnamClockProps) {
  const [time, setTime] = useState<string>("");
  const [date, setDate] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      
      const timeOptions: Intl.DateTimeFormatOptions = {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      };
      
      const dateOptions: Intl.DateTimeFormatOptions = {
        timeZone: "Asia/Ho_Chi_Minh",
        weekday: "long",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      };

      setTime(new Intl.DateTimeFormat("vi-VN", timeOptions).format(now));
      setDate(new Intl.DateTimeFormat("vi-VN", dateOptions).format(now));
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!time) return null;

  if (compact) {
    return (
      <div className="flex items-center h-10 px-4 bg-[var(--bg-secondary)] dark:bg-slate-900/80 rounded-xl border-2 border-[var(--border-structural)] dark:border-slate-700 shadow-sm transition-all overflow-hidden backdrop-blur-sm">
        <div className="flex items-center gap-2.5 h-full border-r border-[var(--border-structural)] dark:border-slate-700 pr-3 md:pr-4">
          <Clock className="w-4 h-4 text-indigo-500 dark:text-[#A1E8AF] animate-pulse" />
          <span className="text-base md:text-lg font-bold font-mono tabular-nums tracking-tight text-[var(--text-primary)]">
            {time}
          </span>
        </div>
        <div className="flex flex-col justify-center pl-3 md:pl-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] md:text-xs font-bold text-[var(--text-primary)] uppercase leading-none whitespace-nowrap">
              {date.split(",")[0]}
            </span>
          </div>
          <div className="text-[9px] md:text-[10px] font-medium text-[var(--text-muted)] leading-none mt-1 whitespace-nowrap">
            {date.split(",")[1]?.trim()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 py-2">
      <div className="flex items-center gap-3 px-5 py-3 bg-indigo-600 text-white rounded-2xl border-2 border-indigo-700 font-mono font-black shadow-[4px_4px_0px_rgba(79,70,229,0.2)]">
        <Clock className="w-6 h-6 animate-pulse" />
        <span className="text-2xl md:text-3xl tracking-tighter">{time}</span>
        <div className="flex flex-col border-l border-white/30 pl-3 ml-1">
            <span className="text-[10px] uppercase tracking-widest opacity-80 leading-none">Giờ</span>
            <span className="text-[12px] font-black leading-none mt-0.5">VN</span>
        </div>
      </div>
      <div className="flex flex-col justify-center gap-1">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-lg px-1">
            <Calendar className="w-5 h-5" />
            <span className="capitalize">{date.split(",")[0]}</span>
        </div>
        <div className="text-[var(--text-secondary)] font-medium text-sm px-1 pl-8">
            {date.split(",")[1]?.trim()}
        </div>
      </div>
    </div>
  );
}
