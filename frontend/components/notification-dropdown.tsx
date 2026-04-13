"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, Trash2, ExternalLink } from "lucide-react";
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
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffHour < 24) return `${diffHour} giờ trước`;
  if (diffDay < 7) return `${diffDay} ngày trước`;
  return date.toLocaleDateString("vi-VN");
}

const typeStyles = {
  success: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800",
    icon: "text-emerald-600 dark:text-emerald-400",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  },
  error: {
    bg: "bg-rose-50 dark:bg-rose-950/30",
    border: "border-rose-200 dark:border-rose-800",
    icon: "text-rose-600 dark:text-rose-400",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
  },
  info: {
    bg: "bg-sky-50 dark:bg-sky-950/30",
    border: "border-sky-200 dark:border-sky-800",
    icon: "text-sky-600 dark:text-sky-400",
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
  },
  warning: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
    icon: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
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
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.2 }}
      className={`
        p-3 rounded-xl border transition-all duration-200 cursor-pointer
        ${notification.read ? "bg-[var(--bg-section)] border-transparent" : `${styles.bg} ${styles.border}`}
        hover:shadow-md
      `}
      onClick={() => !notification.read && onMarkAsRead(notification.id)}
    >
      <div className="flex items-start gap-3">
        <div
          className={`
            mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg
            ${notification.read ? "bg-[var(--bg-elevated)]" : styles.bg}
            ${styles.icon}
          `}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
              {notification.title}
            </p>
            {!notification.read && (
              <span className="h-2 w-2 rounded-full bg-brand-500 flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-1.5">
            {notification.message}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-muted)]">
              {formatTimeAgo(notification.timestamp)}
            </span>
            <div className="flex items-center gap-1">
              {!notification.read && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkAsRead(notification.id);
                  }}
                  className="p-1 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  title="Đánh dấu đã đọc"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(notification.id);
                }}
                className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/40 text-[var(--text-muted)] hover:text-rose-600 transition-colors"
                title="Xóa thông báo"
              >
                <Trash2 className="h-3.5 w-3.5" />
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
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="
            absolute right-0 mt-2 w-[420px] max-h-[600px] rounded-2xl
            bg-[var(--bg-surface)] border-2 border-[var(--border-structural)]
            shadow-[var(--shadow-soft)] overflow-hidden z-[90]
          "
        >
          {/* Header */}
          <div className="p-4 border-b-2 border-[var(--border-structural)]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-[var(--text-primary)]" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">Thông báo</h3>
              </div>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                  {unreadCount} mới
                </span>
              )}
            </div>
            {notifications.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={markAllAsRead}
                  className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Đánh dấu tất cả đã đọc
                </button>
                <span className="text-[var(--border-light)]">•</span>
                <button
                  onClick={clearAll}
                  className="text-xs font-medium text-rose-600 hover:text-rose-700 transition-colors"
                >
                  Xóa tất cả
                </button>
              </div>
            )}
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto max-h-[500px] p-3 space-y-2">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bell className="h-12 w-12 text-[var(--text-muted)] mb-3" />
                <p className="text-sm font-medium text-[var(--text-secondary)]">
                  Không có thông báo nào
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Các thông báo sẽ xuất hiện ở đây
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onRemove={removeNotification}
                />
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
