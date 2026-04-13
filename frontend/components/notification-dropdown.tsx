"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, Trash2, Inbox } from "lucide-react";
import { useNotifications, Notification, iconMap } from "@/components/notification-provider";

function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "Vừa xong";
  if (diffMin < 60) return `${diffMin}p trước`;
  if (diffHour < 24) return `${diffHour}h trước`;
  if (diffDay < 7) return `${diffDay} ngày trước`;
  return date.toLocaleDateString("vi-VN", { day: 'numeric', month: 'numeric' });
}

const typeStyles = {
  success: {
    bg: "bg-emerald-500/10",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  error: {
    bg: "bg-rose-500/10",
    icon: "text-rose-600 dark:text-rose-400",
  },
  info: {
    bg: "bg-sky-500/10",
    icon: "text-sky-600 dark:text-sky-400",
  },
  warning: {
    bg: "bg-amber-500/10",
    icon: "text-amber-600 dark:text-amber-400",
  },
};

function NotificationItem({
  notification,
  onMarkAsRead,
  onRemove,
}: {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const Icon = iconMap[notification.type] || iconMap.info;
  const styles = typeStyles[notification.type] || typeStyles.info;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className={`
        relative p-3 rounded-xl border transition-all duration-200 cursor-pointer
        ${notification.read 
          ? "bg-transparent border-transparent opacity-60" 
          : "bg-white dark:bg-slate-800/40 border-slate-100 dark:border-slate-700/50 shadow-sm"}
        hover:bg-slate-50 dark:hover:bg-slate-800 hover:opacity-100 group
      `}
      onClick={() => !notification.read && onMarkAsRead(notification.id)}
    >
      {!notification.read && (
        <div className="absolute left-1 top-3 bottom-3 w-0.5 bg-brand-500 rounded-full" />
      )}
      
      <div className="flex items-start gap-2.5">
        <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${styles.bg} ${styles.icon}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1.5 mb-0.5">
            <p className={`text-[13px] font-bold truncate ${notification.read ? "text-slate-500 dark:text-slate-400" : "text-slate-900 dark:text-white"}`}>
              {notification.title}
            </p>
            {!notification.read && <span className="h-1.5 w-1.5 rounded-full bg-brand-500 flex-shrink-0" />}
          </div>
          
          <p className={`text-[12px] leading-snug mb-1.5 line-clamp-2 ${notification.read ? "text-slate-400 dark:text-slate-500" : "text-slate-600 dark:text-slate-200"}`}>
            {notification.message}
          </p>
          
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
              {formatTimeAgo(notification.timestamp)}
            </span>
            
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {!notification.read && (
                <button
                  onClick={(e) => { e.stopPropagation(); onMarkAsRead(notification.id); }}
                  className="p-1 rounded-md hover:bg-white dark:hover:bg-slate-700 text-slate-400 hover:text-brand-600 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-600"
                >
                  <Check className="h-3 w-3" />
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(notification.id); }}
                className="p-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-500/20 text-slate-400 hover:text-rose-600 transition-colors border border-transparent hover:border-rose-100 dark:hover:border-rose-900/40"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function NotificationDropdown({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
  } = useNotifications();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[80] sm:hidden" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="
              absolute right-0 mt-2 w-[320px] sm:w-[360px] max-h-[480px] rounded-2xl
              bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700
              shadow-xl overflow-hidden z-[90] flex flex-col
            "
          >
            <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">Thông báo</h3>
                </div>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-brand-600 text-white">
                    {unreadCount} MỚI
                  </span>
                )}
              </div>
              
              {notifications.length > 0 && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={markAllAsRead}
                    className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 transition-colors"
                  >
                    Đọc tất cả
                  </button>
                  <div className="h-2.5 w-px bg-slate-200 dark:bg-slate-700" />
                  <button
                    onClick={clearAll}
                    className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    Xóa hết
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Inbox className="h-8 w-8 text-slate-200 dark:text-slate-700 mb-2" />
                  <p className="text-[13px] font-bold text-slate-900 dark:text-white">Hộp thư trống</p>
                </div>
              ) : (
                <div className="flex flex-col">
                  {notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={markAsRead}
                      onRemove={removeNotification}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
