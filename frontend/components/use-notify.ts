"use client";

import { useCallback } from "react";
import { useNotifications, NotificationType } from "@/components/notification-provider";

/**
 * Hook to easily send notifications from any component.
 * Usage:
 * const { notify } = useNotify();
 * notify.success("Tạo học liệu thành công!");
 * notify.error("Có lỗi xảy ra");
 * notify.info("Đang xử lý...");
 * notify.warning("Cần chú ý");
 */
export function useNotify() {
  const { addNotification } = useNotifications();

  const notify = useCallback(
    (message: string, type: NotificationType = "info", title?: string) => {
      const defaultTitles: Record<NotificationType, string> = {
        success: "Thành công",
        error: "Lỗi",
        info: "Thông báo",
        warning: "Cảnh báo",
      };

      addNotification({
        title: title || defaultTitles[type],
        message,
        type,
      });
    },
    [addNotification]
  );

  return {
    notify,
    success: (message: string, title?: string) => notify(message, "success", title),
    error: (message: string, title?: string) => notify(message, "error", title),
    info: (message: string, title?: string) => notify(message, "info", title),
    warning: (message: string, title?: string) => notify(message, "warning", title),
  };
}
