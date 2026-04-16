"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  Trash2, 
  Save, 
  Upload, 
  Calendar as CalendarIcon, 
  MapPin, 
  Clock, 
  FileText,
  Loader2,
  Sparkles,
  LayoutDashboard,
  Timer,
  Target,
  Bell,
  RefreshCw,
  LayoutGrid,
  CalendarDays,
  Mail,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useNotify } from "@/components/use-notify";
import { getSchedule, saveSchedule, uploadScheduleFile, getMe } from "@/lib/api";
import { addMinutesToInputValue, formatVietnamInputDateTime, formatVietnamTime, getVietnamDay, getVietnamNowInputValue, parseVietnamDateTime } from "@/lib/datetime";
import { ScheduleEvent } from "@/types";
import { cn } from "@/lib/utils";
import { VietnamClock } from "./vietnam-clock";
import { Dialog } from "@/components/ui/dialog";

const DAYS = [
  { label: "Thứ 2", short: "T2", value: 1, color: "bg-orange-500" },
  { label: "Thứ 3", short: "T3", value: 2, color: "bg-yellow-500" },
  { label: "Thứ 4", short: "T4", value: 3, color: "bg-emerald-500" },
  { label: "Thứ 5", short: "T5", value: 4, color: "bg-sky-500" },
  { label: "Thứ 6", short: "T6", value: 5, color: "bg-blue-500" },
  { label: "Thứ 7", short: "T7", value: 6, color: "bg-purple-500" },
  { label: "Chủ Nhật", short: "CN", value: 0, color: "bg-rose-500" },
];

export function ScheduleView() {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const [activeDay, setActiveDay] = useState<number>(getVietnamDay(getVietnamNowInputValue()));
  const [userEmail, setUserEmail] = useState<string>("");
  const [editingEventIndex, setEditingEventIndex] = useState<number | null>(null);
  const [tempEvent, setTempEvent] = useState<ScheduleEvent | null>(null);
  const { success, error, info } = useNotify();

  const fetchSchedule = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      
      const data = await getSchedule();
      setEvents(data.events || []);
      if (isRefresh) success("Đã làm mới lịch trình!");
    } catch (err) {
      console.error(err);
      error("Không thể tải lịch.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [success, error]);

  useEffect(() => {
    fetchSchedule();
    getMe().then(user => setUserEmail(user.email)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      await saveSchedule(events);
      success("Đã đồng bộ hóa lịch trình!");
    } catch (err) {
      console.error(err);
      error("Lỗi đồng bộ.");
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const result = await uploadScheduleFile(file);
      
      if (!result.is_valid_schedule) {
        error(result.message || "Tài liệu này không có vẻ gì là lịch trình hợp lệ.");
        if (result.events && result.events.length > 0) {
          setEvents([...events, ...result.events]);
        }
      } else {
        setEvents([...events, ...result.events]);
        success(result.message || `AI đã bóc tách ${result.events.length} sự kiện!`);
      }
    } catch (err: any) {
      console.error(err);
      error("Lỗi trích xuất (có thể do tệp tin quá lớn hoặc không đọc được).");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const addEvent = (dayValue?: number) => {
    const targetDayValue = dayValue ?? activeDay;
    const nowInput = getVietnamNowInputValue();
    const nowInVietnam = parseVietnamDateTime(nowInput);
    const currentVietnamDay = getVietnamDay(nowInput);
    const dayDiff = (targetDayValue - currentVietnamDay + 7) % 7;
    const targetDate = new Date(nowInVietnam.getTime() + dayDiff * 24 * 60 * 60 * 1000);
    targetDate.setUTCMinutes(0, 0, 0);
    targetDate.setUTCHours(targetDate.getUTCHours() + 1);
    const startTime = formatVietnamInputDateTime(targetDate.toISOString());

    const newEvent: ScheduleEvent = {
        title: "Sự kiện mới",
        start_time: startTime,
        end_time: addMinutesToInputValue(startTime, 60),
        location: "Văn phòng / Online",
        notes: ""
    };
    setEvents([...events, newEvent]);
  };

  const removeEvent = (idx: number) => {
    setEvents(events.filter((_, i) => i !== idx));
  };

  const updateEvent = (index: number, field: keyof ScheduleEvent, value: any) => {
    const newEvents = [...events];
    newEvents[index] = { ...newEvents[index], [field]: value };
    setEvents(newEvents);
  };

  const startEditing = (idx: number) => {
    setEditingEventIndex(idx);
    setTempEvent({ ...events[idx] });
  };

  const saveEditedEvent = async () => {
    if (editingEventIndex === null || !tempEvent) return;
    
    try {
      setSaving(true);
      const newEvents = [...events];
      newEvents[editingEventIndex] = tempEvent;
      
      // Sync to server
      await saveSchedule(newEvents);
      
      // Update local state and UI
      setEvents(newEvents);
      success("Cập nhật sự kiện thành công!");
      setEditingEventIndex(null);
      setTempEvent(null);
    } catch (err) {
      console.error(err);
      error("Lỗi khi lưu sự kiện.");
    } finally {
      setSaving(false);
    }
  };

  const formatForInput = (dateStr: string) => {
    return formatVietnamInputDateTime(dateStr);
  };

  const formatToVNTime = (dateStr: string) => {
    return formatVietnamTime(dateStr);
  };

  const formatToVNDate = (dateStr: string, short: boolean = false) => {
    try {
        const date = parseVietnamDateTime(dateStr);
        if (short) return date.toLocaleDateString("vi-VN", { day: '2-digit', month: '2-digit' });
        return date.toLocaleDateString("vi-VN");
    } catch { return ""; }
  };

  const groupedEvents = useMemo(() => {
    const groups: Record<number, { event: ScheduleEvent, originalIndex: number }[]> = {};
    DAYS.forEach(d => groups[d.value] = []);
    
    events.forEach((event, idx) => {
      if (!event.start_time) return;
      try {
        const date = parseVietnamDateTime(event.start_time);
        if (isNaN(date.getTime())) return;
        const vnDayIdx = getVietnamDay(event.start_time);
        if (vnDayIdx !== undefined && groups[vnDayIdx] !== undefined) groups[vnDayIdx].push({ event, originalIndex: idx });
      } catch (e) {}
    });
    
    Object.keys(groups).forEach(day => {
      groups[Number(day)].sort((a,b) => parseVietnamDateTime(a.event.start_time).getTime() - parseVietnamDateTime(b.event.start_time).getTime());
    });
    return groups;
  }, [events]);

  const activeEvents = groupedEvents[activeDay] || [];
  const activeDayInfo = DAYS.find(d => d.value === activeDay) || { label: "Tất cả", value: -1, short: "Tất cả", color: "bg-slate-900" };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
        <p className="text-slate-500 dark:text-slate-400 font-medium">Đang tải lịch trình...</p>
      </div>
    );
  }

  return (
    <div className={cn("container mx-auto px-4 py-8", viewMode === 'daily' ? "max-w-6xl" : "max-w-full")}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] flex items-center gap-3 tracking-tight">
            <div className="p-2 bg-indigo-600 dark:bg-indigo-500 rounded-xl shadow-[4px_4px_0px_rgba(79,70,229,0.2)]">
               <LayoutDashboard className="w-8 h-8 text-white" />
            </div>
            Lịch học & làm việc
          </h1>
          <p className="text-[var(--text-secondary)] font-medium">
            Quản lý kế hoạch với AI • <span className="text-indigo-600 dark:text-indigo-400 font-bold">{events.length} sự kiện tổng cộng</span>
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-[var(--bg-secondary)] p-1.5 rounded-2xl flex items-center mr-2 border-2 border-[var(--border-structural)] sb-shadow">
            <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setViewMode('daily')}
                className={cn("rounded-xl h-9 px-4 gap-2 font-bold transition-all", viewMode === 'daily' ? "bg-[var(--bg-surface)] text-indigo-600 dark:text-indigo-400 sb-shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]")}
            >
                <CalendarDays className="w-4 h-4" />
                <span>Ngày</span>
            </Button>
            <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setViewMode('weekly')}
                className={cn("rounded-xl h-9 px-4 gap-2 font-bold transition-all", viewMode === 'weekly' ? "bg-[var(--bg-surface)] text-indigo-600 dark:text-indigo-400 sb-shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]")}
            >
                <LayoutGrid className="w-4 h-4" />
                <span>Tuần</span>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button 
                variant="outline" 
                size="icon" 
                onClick={() => setShowRefreshConfirm(true)} 
                disabled={refreshing}
                title="Làm mới lịch trình"
                className="rounded-xl border-2 border-[var(--border-structural)] h-11 w-11 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all bg-[var(--bg-surface)] sb-shadow-hover active:translate-y-0.5"
            >
                <RefreshCw className={cn("w-5 h-5", refreshing && "animate-spin")} />
            </Button>

            <Button 
                variant="outline" 
                size="icon" 
                onClick={() => setShowClearConfirm(true)} 
                title="Xóa trắng lịch trình"
                className="rounded-xl border-2 border-[var(--border-structural)] h-11 w-11 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600 dark:hover:text-rose-400 transition-all bg-[var(--bg-surface)] sb-shadow-hover active:translate-y-0.5"
            >
                <Trash2 className="w-5 h-5" />
            </Button>
          </div>

          <input type="file" id="upload-schedule" className="hidden" onChange={handleFileUpload} accept=".pdf,.xlsx,.xls,.png,.jpg,.jpeg" />
          <Button 
            variant="outline" 
            onClick={() => document.getElementById("upload-schedule")?.click()} 
            disabled={uploading} 
            className="rounded-xl border-2 border-[var(--border-structural)] hover:bg-[var(--bg-secondary)] gap-2 h-11 bg-[var(--bg-surface)] px-5 font-bold sb-shadow-hover active:translate-y-0.5 transition-all"
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
            {uploading ? "Đang quét..." : "Quét bằng AI"}
          </Button>
          
          <Button 
            onClick={handleSave} 
            disabled={saving} 
            className="rounded-xl bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-700 text-white gap-2 h-11 px-6 font-bold shadow-[4px_4px_0px_rgba(0,0,0,0.2)] dark:shadow-[4px_4px_0px_rgba(79,70,229,0.3)] transition-all active:scale-95 active:shadow-none translate-y-0"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Lưu thay đổi
          </Button>
        </div>
      </div>

      {viewMode === 'daily' ? (
        /* DAILY VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-3 space-y-6">
            <Card className="p-6 rounded-3xl bg-indigo-600 text-white border-2 border-indigo-700 shadow-[8px_8px_0px_rgba(79,70,229,0.2)] dark:shadow-[8px_8px_0px_rgba(0,0,0,0.3)] overflow-hidden relative group">
                <div className="relative z-10 space-y-6">
                <div className="flex items-center justify-between">
                    <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                        <Target className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-[10px] font-black bg-white/20 px-3 py-1 rounded-full uppercase tracking-widest border border-white/10">Mục tiêu ngày</span>
                </div>
                <div>
                    <h3 className="text-4xl font-black tracking-tighter">75%</h3>
                    <p className="text-indigo-100 text-sm font-medium mt-1">Hoàn thành kế hoạch</p>
                </div>
                <div className="h-3 bg-white/10 rounded-full border border-white/5 overflow-hidden">
                    <motion.div 
                        initial={{ width: 0 }} 
                        animate={{ width: "75%" }} 
                        className="h-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.5)]" 
                    />
                </div>
                </div>
                <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-700" />
            </Card>

            <div className="bg-[var(--bg-surface)] rounded-3xl border-2 border-[var(--border-structural)] p-6 space-y-5 sb-shadow relative overflow-hidden group/settings">
                <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">Thông báo nhắc lịch</h4>
                    <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 opacity-50" />
                    </div>
                </div>
                
                <div className="space-y-4">
                    <div className="p-4 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-structural)] space-y-3">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                <Mail className="w-5 h-5" />
                            </div>
                            <div className="space-y-0.5 overflow-hidden">
                                <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-wider">Email nhận tin</p>
                                <p className="text-sm font-bold text-[var(--text-primary)] truncate" title={userEmail || "Chưa cập nhật"}>
                                    {userEmail || "Đang tải..."}
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-between pt-2 border-t border-[var(--border-structural)]/50">
                            <span className="text-[10px] font-bold text-[var(--text-secondary)]">Trạng thái: <span className="text-green-600 dark:text-green-400">ĐANG BẬT</span></span>
                            <span className="text-[10px] font-bold text-[var(--text-secondary)]">Báo trước: 10 phút</span>
                        </div>
                    </div>

                    <p className="text-[10px] text-[var(--text-muted)] leading-relaxed italic text-center px-2">
                        * Trợ lý AI sẽ tự động gửi thông báo qua Gmail khi sắp đến giờ diễn ra sự kiện.
                    </p>
                </div>
                
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -translate-y-12 translate-x-12 blur-2xl pointer-events-none group-hover/settings:bg-indigo-500/10 transition-colors" />
            </div>
            </div>

            <div className="lg:col-span-9 space-y-8">
            <div className="bg-[var(--bg-surface)] p-2 rounded-3xl border-2 border-[var(--border-structural)] flex items-center gap-2 overflow-x-auto no-scrollbar sb-shadow">
                <button 
                    onClick={() => setActiveDay(-1)} 
                    className={cn(
                        "flex-1 min-w-[70px] py-4 rounded-2xl flex flex-col items-center transition-all duration-300 relative", 
                        activeDay === -1 
                            ? "bg-slate-900 text-white shadow-[4px_4px_0px_rgba(0,0,0,0.2)]" 
                            : "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
                    )}
                >
                    <span className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-50">Tất cả</span>
                    <span className="text-sm font-black">{events.length}</span>
                </button>

                {DAYS.map((day) => (
                <button 
                    key={day.value} 
                    onClick={() => setActiveDay(day.value)} 
                    className={cn(
                        "flex-1 min-w-[90px] py-4 rounded-2xl flex flex-col items-center transition-all duration-300 relative overflow-hidden", 
                        activeDay === day.value 
                            ? "bg-indigo-600 text-white shadow-[4px_4px_0px_rgba(79,70,229,0.3)] translate-y-[-2px]" 
                            : "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
                    )}
                >
                    <span className={cn("text-[10px] font-black uppercase tracking-widest mb-1", activeDay === day.value ? "text-indigo-100" : "opacity-50")}>{day.short}</span>
                    <span className="text-sm font-black">{day.label}</span>
                    {groupedEvents[day.value]?.length > 0 && (
                        <div className={cn("w-1.5 h-1.5 rounded-full mt-2 ring-2 ring-white/20", activeDay === day.value ? "bg-white" : day.color)} />
                    )}
                </button>
                ))}
            </div>

            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-4">
                    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg border-2 border-white/20 dark:border-slate-800", activeDay === -1 ? "bg-slate-900" : activeDayInfo.color)}>
                        {activeDay === -1 ? <Bell className="w-7 h-7" /> : <CalendarIcon className="w-7 h-7" />}
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
                            {activeDay === -1 ? "Toàn bộ lịch trình" : activeDayInfo.label}
                        </h2>
                        <span className="text-sm font-bold text-[var(--text-muted)] tracking-wide uppercase">
                            {activeDay === -1 ? events.length : activeEvents.length} sự kiện được tìm thấy
                        </span>
                    </div>
                </div>
                <Button 
                    onClick={() => addEvent()} 
                    size="lg" 
                    className="rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white gap-3 px-6 font-bold shadow-[6px_6px_0px_rgba(79,70,229,0.2)] transition-all active:scale-95 active:shadow-none"
                >
                    <Plus className="w-5 h-5" /> Thêm sự kiện
                </Button>
            </div>

            <div className="space-y-6 max-h-[800px] overflow-y-auto pr-4 custom-scrollbar pb-10">
                <AnimatePresence mode="popLayout">
                {(activeDay === -1 ? events : activeEvents.map(ge => ge.event)).length === 0 ? (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-20 border-2 border-dashed border-[var(--border-structural)] rounded-[3rem] flex flex-col items-center justify-center text-center bg-[var(--bg-secondary)]/30 backdrop-blur-sm">
                        <div className="w-20 h-20 bg-[var(--bg-surface)] rounded-3xl sb-shadow border-2 border-[var(--border-structural)] flex items-center justify-center mb-6">
                            <Sparkles className="w-10 h-10 text-[var(--text-muted)]" />
                        </div>
                        <h3 className="text-xl font-black text-[var(--text-primary)]">Lịch trình đang trống</h3>
                        <p className="text-[var(--text-secondary)] font-medium max-w-[280px] mt-2 italic">Hôm nay là ngày tuyệt vời để bắt đầu những kế hoạch mới!</p>
                    </motion.div>
                ) : (
                    (activeDay === -1 
                        ? events.map((event, idx) => ({ event, originalIndex: idx })) 
                        : activeEvents
                    ).map(({ event, originalIndex }) => (
                    <motion.div key={originalIndex} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="group">
                        <Card className="p-0 border-2 border-[var(--border-structural)] hover:border-indigo-500/50 dark:hover:border-indigo-400 shadow-[6px_6px_0px_rgba(0,0,0,0.05)] dark:shadow-[6px_6px_0px_rgba(0,0,0,0.2)] hover:shadow-[10px_10px_0px_rgba(79,70,229,0.1)] transition-all duration-500 rounded-3xl overflow-hidden bg-[var(--bg-surface)]">
                        <div className="flex flex-col md:flex-row">
                            <div className="md:w-64 bg-[var(--bg-secondary)]/50 p-6 space-y-6 border-b md:border-b-0 md:border-r-2 border-[var(--border-structural)]">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                                    <Timer className="w-4 h-4" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Bắt đầu</span>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-base font-black text-[var(--text-primary)]">{formatToVNTime(event.start_time)}</div>
                                    <div className="text-[10px] font-bold text-[var(--text-muted)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded-md border border-[var(--border-structural)] inline-block">
                                        Ngày: {formatToVNDate(event.start_time)}
                                    </div>
                                </div>
                                <div className="relative group/input">
                                    <input 
                                        type="datetime-local" 
                                        value={formatForInput(event.start_time)} 
                                        onChange={(e) => updateEvent(originalIndex, 'start_time', e.target.value)} 
                                        className="w-full bg-[var(--bg-surface)] border-2 border-[var(--border-structural)] rounded-xl px-3 py-2.5 text-xs font-black text-[var(--text-primary)] outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer sb-shadow-sm hover:bg-[var(--bg-secondary)] appearance-none" 
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-500/50">
                                        <CalendarIcon className="w-3.5 h-3.5" />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-[var(--text-muted)]">
                                    <Clock className="w-4 h-4" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Kết thúc</span>
                                </div>
                                <div className="text-base font-black text-[var(--text-primary)]">{formatToVNTime(event.end_time || "")}</div>
                                <div className="relative group/input">
                                    <input 
                                        type="datetime-local" 
                                        value={formatForInput(event.end_time || "")} 
                                        onChange={(e) => updateEvent(originalIndex, 'end_time', e.target.value)} 
                                        className="w-full bg-[var(--bg-surface)] border-2 border-[var(--border-structural)] rounded-xl px-3 py-2.5 text-xs font-black text-[var(--text-primary)] outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer sb-shadow-sm hover:bg-[var(--bg-secondary)] appearance-none" 
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]">
                                        <Clock className="w-3.5 h-3.5" />
                                    </div>
                                </div>
                            </div>
                            </div>
                            <div className="flex-1 p-6 space-y-6">
                            <input 
                                type="text" 
                                value={event.title} 
                                onChange={(e) => updateEvent(originalIndex, 'title', e.target.value)} 
                                className="w-full text-2xl font-black text-[var(--text-primary)] bg-transparent border-none focus:ring-0 p-0 placeholder:text-[var(--text-muted)]/30 tracking-tight" 
                                placeholder="Tên sự kiện của bạn..." 
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="flex items-center gap-3 text-[var(--text-secondary)] bg-[var(--bg-secondary)]/50 px-4 py-3 rounded-2xl border-2 border-[var(--border-structural)] focus-within:border-indigo-500/40 transition-all">
                                    <MapPin className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                                    <input type="text" value={event.location || ""} onChange={(e) => updateEvent(originalIndex, 'location', e.target.value)} className="text-sm font-bold bg-transparent border-none focus:ring-0 p-0 w-full placeholder:text-[var(--text-muted)]" placeholder="Địa điểm?" />
                                </div>
                                <div className="flex items-center gap-3 text-[var(--text-secondary)] bg-[var(--bg-secondary)]/50 px-4 py-3 rounded-2xl border-2 border-[var(--border-structural)] focus-within:border-indigo-500/40 transition-all">
                                    <FileText className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                                    <input type="text" value={event.notes || ""} onChange={(e) => updateEvent(originalIndex, 'notes', e.target.value)} className="text-sm font-bold bg-transparent border-none focus:ring-0 p-0 w-full placeholder:text-[var(--text-muted)]" placeholder="Ghi chú thêm..." />
                                </div>
                            </div>
                            </div>
                            <div className="p-6 flex items-center justify-center bg-[var(--bg-secondary)]/30 md:bg-transparent border-t-2 md:border-t-0 md:border-l-2 border-[var(--border-structural)]">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => removeEvent(originalIndex)} 
                                    className="w-12 h-12 rounded-2xl text-[var(--text-muted)] hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-all sb-shadow-hover"
                                >
                                    <Trash2 className="w-6 h-6" />
                                </Button>
                            </div>
                        </div>
                        </Card>
                    </motion.div>
                    ))
                )}
                </AnimatePresence>
            </div>
            </div>
        </div>
      ) : (
        /* WEEKLY GRID VIEW */
        <div className="overflow-x-auto pb-10 custom-scrollbar scroll-smooth">
            <div className="flex flex-nowrap gap-8 min-w-max pb-6 px-2">
                {DAYS.map((day) => (
                    <div key={day.value} className="w-[340px] flex-shrink-0 space-y-6">
                        <div className="flex items-center justify-between px-3">
                           <div className="flex items-center gap-3">
                              <div className={cn("w-3 h-8 rounded-full shadow-[2px_2px_0px_rgba(0,0,0,0.1)]", day.color)} />
                              <h3 className="text-xl font-black text-[var(--text-primary)] tracking-tight">{day.label}</h3>
                           </div>
                           <Button 
                             size="icon" 
                             variant="outline" 
                             onClick={() => addEvent(day.value)} 
                             className="h-10 w-10 rounded-xl border-2 border-[var(--border-structural)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-500 transition-all sb-shadow-sm"
                           >
                             <Plus className="w-5 h-5" />
                           </Button>
                        </div>

                        <div className="space-y-4 bg-[var(--bg-secondary)]/50 p-4 rounded-[2.5rem] border-2 border-[var(--border-structural)] min-h-[600px] shadow-inner">
                            {groupedEvents[day.value].length === 0 ? (
                                <div className="h-40 flex flex-col items-center justify-center text-center px-4">
                                    <div className="w-12 h-12 rounded-2xl border-2 border-dashed border-[var(--border-structural)] mb-3 flex items-center justify-center">
                                        <Sparkles className="w-5 h-5 text-[var(--text-muted)]/40" />
                                    </div>
                                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest italic">Chưa có kế hoạch</p>
                                </div>
                            ) : (
                                groupedEvents[day.value].map(({ event, originalIndex }) => (
                                    <Card 
                                        key={originalIndex} 
                                        onClick={() => startEditing(originalIndex)}
                                        className="p-5 border-2 border-[var(--border-structural)] hover:border-indigo-500/50 dark:hover:border-indigo-400 shadow-[4px_4px_0px_rgba(0,0,0,0.05)] dark:shadow-[4px_4px_0px_rgba(0,0,0,0.2)] hover:shadow-[8px_8px_0px_rgba(79,70,229,0.1)] transition-all cursor-pointer bg-[var(--bg-surface)] group active:scale-[0.98] rounded-[1.75rem]"
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                           <div className="flex flex-col items-start gap-1">
                                               <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-full ring-1 ring-inset ring-indigo-500/20 uppercase tracking-wider">
                                                  {formatToVNTime(event.start_time)}
                                               </span>
                                               <span className="text-[9px] font-bold text-[var(--text-muted)]">
                                                  {formatToVNDate(event.start_time, true)}
                                               </span>
                                           </div>
                                           <Button 
                                             variant="ghost" 
                                             size="icon" 
                                             onClick={(e) => { e.stopPropagation(); removeEvent(originalIndex); }}
                                             className="h-7 w-7 opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-rose-500 transition-all"
                                           >
                                              <X className="w-4 h-4" />
                                           </Button>
                                        </div>
                                        <h4 className="text-sm font-black text-[var(--text-primary)] line-clamp-2 mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-tight">
                                           {event.title}
                                        </h4>
                                        {event.location && (
                                            <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)] font-bold truncate bg-[var(--bg-secondary)]/50 p-2 rounded-lg border border-[var(--border-structural)]">
                                               <MapPin className="w-3.5 h-3.5 text-indigo-400" /> {event.location}
                                            </div>
                                        )}
                                    </Card>
                                ))
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        open={showRefreshConfirm}
        title="Làm mới lịch trình?"
        description="Mọi thay đổi chưa lưu của bạn sẽ bị mất và dữ liệu sẽ được tải lại từ server."
        confirmLabel="Làm mới"
        cancelLabel="Hủy"
        onConfirm={() => {
          setShowRefreshConfirm(false);
          fetchSchedule(true);
        }}
        onClose={() => setShowRefreshConfirm(false)}
      />

      <ConfirmDialog
        open={showClearConfirm}
        title="Xóa trắng lịch trình?"
        description="Hành động này sẽ xóa tất cả sự kiện hiện tại trong danh sách. Bạn không thể hoàn tác."
        tone="danger"
        confirmLabel="Xóa sạch"
        cancelLabel="Hủy"
        onConfirm={() => {
          setEvents([]);
          setShowClearConfirm(false);
          success("Đã xóa sạch lịch trình!");
        }}
        onClose={() => setShowClearConfirm(false)}
      />

      {/* Edit Event Dialog */}
      <Dialog 
        open={editingEventIndex !== null} 
        onClose={() => { setEditingEventIndex(null); setTempEvent(null); }}
        title="Chỉnh sửa sự kiện"
        maxWidth="lg"
      >
        {tempEvent && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Tên sự kiện</label>
              <input 
                type="text" 
                value={tempEvent.title} 
                onChange={(e) => setTempEvent({ ...tempEvent, title: e.target.value })} 
                className="w-full text-xl font-black text-[var(--text-primary)] bg-[var(--bg-secondary)] border-2 border-[var(--border-structural)] rounded-2xl px-5 py-4 outline-none focus:border-indigo-500 transition-all sb-shadow-sm" 
                placeholder="Nhập tên sự kiện..." 
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Bắt đầu</label>
                <div className="relative">
                  <input 
                    type="datetime-local" 
                    value={formatForInput(tempEvent.start_time)} 
                    onChange={(e) => setTempEvent({ ...tempEvent, start_time: e.target.value })} 
                    className="w-full bg-[var(--bg-secondary)] border-2 border-[var(--border-structural)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-indigo-500 transition-all cursor-pointer" 
                  />
                  <CalendarIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500/50 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Kết thúc</label>
                <div className="relative">
                  <input 
                    type="datetime-local" 
                    value={formatForInput(tempEvent.end_time || "")} 
                    onChange={(e) => setTempEvent({ ...tempEvent, end_time: e.target.value })} 
                    className="w-full bg-[var(--bg-secondary)] border-2 border-[var(--border-structural)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-indigo-500 transition-all cursor-pointer" 
                  />
                  <Clock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Địa điểm</label>
                <div className="flex items-center gap-3 bg-[var(--bg-secondary)] px-4 py-3.5 rounded-xl border-2 border-[var(--border-structural)] focus-within:border-indigo-500/40 transition-all">
                  <MapPin className="w-5 h-5 text-indigo-500" />
                  <input 
                    type="text" 
                    value={tempEvent.location || ""} 
                    onChange={(e) => setTempEvent({ ...tempEvent, location: e.target.value })} 
                    className="text-sm font-bold bg-transparent border-none focus:ring-0 p-0 w-full" 
                    placeholder="Văn phòng / Online..." 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Ghi chú</label>
                <div className="flex items-center gap-3 bg-[var(--bg-secondary)] px-4 py-3.5 rounded-xl border-2 border-[var(--border-structural)] focus-within:border-indigo-500/40 transition-all">
                  <FileText className="w-5 h-5 text-indigo-500" />
                  <input 
                    type="text" 
                    value={tempEvent.notes || ""} 
                    onChange={(e) => setTempEvent({ ...tempEvent, notes: e.target.value })} 
                    className="text-sm font-bold bg-transparent border-none focus:ring-0 p-0 w-full" 
                    placeholder="Ghi chú thêm..." 
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-structural)]">
              <Button 
                variant="outline" 
                onClick={() => { setEditingEventIndex(null); setTempEvent(null); }}
                className="rounded-xl px-6 font-bold"
              >
                Hủy
              </Button>
              <Button 
                onClick={saveEditedEvent} 
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-8 font-bold sb-shadow"
                disabled={saving}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Lưu thay đổi
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

// Re-using X icon from lucide-react if needed, otherwise import it
import { X } from "lucide-react";
