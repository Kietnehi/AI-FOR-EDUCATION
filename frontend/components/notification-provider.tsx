"use client";

import { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from "react";
import { useAuth } from "@/components/auth-provider";
import { Bell, CheckCircle2, XCircle, AlertCircle, Info } from "lucide-react";
import { Toast } from "@/components/ui/toast";


export type NotificationType = "success" | "error" | "info" | "warning";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  timestamp: string; // ISO string để serialize localStorage
  read: boolean;
  icon?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, "id" | "timestamp" | "read">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const iconMap = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertCircle,
};

const STORAGE_KEY_PREFIX = "notifications_";

function getStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

function loadNotifications(userId: string): Notification[] {
  try {
    const stored = localStorage.getItem(getStorageKey(userId));
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    // Chỉ lấy tối đa 50 thông báo gần nhất
    return parsed.slice(0, 50);
  } catch {
    return [];
  }
}

function saveNotifications(userId: string, notifications: Notification[]): void {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(notifications));
  } catch {
    // Ignore localStorage errors
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeToast, setActiveToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);


  // Load notifications khi user thay đổi
  useEffect(() => {
    if (!loading && user) {
      setNotifications(loadNotifications(user.id));
      setIsLoaded(true);
    } else if (!loading && !user) {
      // Clear notifications khi logout
      setNotifications([]);
      setIsLoaded(false);
    }
  }, [user, loading]);

  // Save notifications khi có thay đổi
  useEffect(() => {
    if (user && isLoaded) {
      saveNotifications(user.id, notifications);
    }
  }, [notifications, user, isLoaded]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const addNotification = useCallback(
    (notification: Omit<Notification, "id" | "timestamp" | "read">) => {
      const newNotification: Notification = {
        ...notification,
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        timestamp: new Date().toISOString(),
        read: false,
      };
      setNotifications((prev) => [newNotification, ...prev]);
      
      // Also show as a floating toast
      if (notification.type !== "warning") {
         setActiveToast({
           message: notification.message,
           type: notification.type as "success" | "error" | "info"
         });
      }
    },
    []
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        removeNotification,
        clearAll,
      }}
    >
      {children}
      {activeToast && (
        <Toast 
          message={activeToast.message} 
          type={activeToast.type} 
          onClose={() => setActiveToast(null)} 
        />
      )}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}

export { iconMap };
