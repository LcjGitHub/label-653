import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification as apiDeleteNotification
} from '../services/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toastNotifications, setToastNotifications] = useState([]);
  const lastNotificationIdRef = useRef(null);
  const pollTimerRef = useRef(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }
    try {
      const data = await getUnreadNotificationCount();
      setUnreadCount(data.unread_count || 0);
    } catch (err) {
      console.error('获取未读通知数量失败:', err);
    }
  }, [isAuthenticated]);

  const fetchNotifications = useCallback(async (options = {}) => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const data = await getNotifications(options);
      setNotifications(data.notifications || []);
      return data;
    } catch (err) {
      console.error('获取通知列表失败:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const checkNewNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await getNotifications({ page: 1, pageSize: 5 });
      const latest = data.notifications || [];
      
      if (latest.length > 0 && lastNotificationIdRef.current !== null) {
        const newOnes = latest.filter(n => n.id > lastNotificationIdRef.current && n.is_read === 0);
        if (newOnes.length > 0) {
          setToastNotifications(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const toAdd = newOnes.filter(n => !existingIds.has(n.id));
            return [...toAdd, ...prev].slice(0, 5);
          });
          await fetchUnreadCount();
        }
      }
      
      if (latest.length > 0) {
        lastNotificationIdRef.current = latest[0].id;
      }
    } catch (err) {
      console.error('检查新通知失败:', err);
    }
  }, [isAuthenticated, fetchUnreadCount]);

  const markAsRead = useCallback(async (id) => {
    try {
      await markNotificationRead(id);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: 1 } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      setToastNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error('标记已读失败:', err);
      throw err;
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: 1 }))
      );
      setUnreadCount(0);
      setToastNotifications([]);
    } catch (err) {
      console.error('全部标记已读失败:', err);
      throw err;
    }
  }, []);

  const deleteNotificationItem = useCallback(async (id) => {
    try {
      await apiDeleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setToastNotifications(prev => prev.filter(n => n.id !== id));
      const notification = notifications.find(n => n.id === id);
      if (notification && notification.is_read === 0) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('删除通知失败:', err);
      throw err;
    }
  }, [notifications]);

  const removeToast = useCallback((id) => {
    setToastNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      setNotifications([]);
      setToastNotifications([]);
      lastNotificationIdRef.current = null;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    fetchUnreadCount();
    checkNewNotifications();

    pollTimerRef.current = setInterval(() => {
      fetchUnreadCount();
      checkNewNotifications();
    }, 15000);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isAuthenticated, fetchUnreadCount, checkNewNotifications]);

  const value = {
    unreadCount,
    notifications,
    loading,
    toastNotifications,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification: deleteNotificationItem,
    removeToast
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
