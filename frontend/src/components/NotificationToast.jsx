import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationContext';

function getNotificationIcon(type) {
  switch (type) {
    case 'like':
      return '❤️';
    case 'favorite':
      return '⭐';
    case 'comment':
      return '💬';
    case 'reply':
      return '↩️';
    default:
      return '🔔';
  }
}

export default function NotificationToast() {
  const { toastNotifications, markAsRead, removeToast } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => {
    const timers = [];
    toastNotifications.forEach(notification => {
      const timer = setTimeout(() => {
        removeToast(notification.id);
      }, 5000);
      timers.push(timer);
    });
    return () => timers.forEach(t => clearTimeout(t));
  }, [toastNotifications, removeToast]);

  const handleClick = async (notification) => {
    try {
      if (notification.is_read === 0) {
        await markAsRead(notification.id);
      }
    } catch (err) {
      console.error('标记已读失败:', err);
    }
    removeToast(notification.id);
    if (notification.article_id) {
      navigate(`/article/${notification.article_id}`);
    } else {
      navigate('/notifications');
    }
  };

  const handleClose = (e, id) => {
    e.stopPropagation();
    removeToast(id);
  };

  if (toastNotifications.length === 0) {
    return null;
  }

  return (
    <div className="notification-toast-container">
      {toastNotifications.map((notification) => (
        <div
          key={notification.id}
          className="notification-toast"
          onClick={() => handleClick(notification)}
        >
          <div className="toast-icon">
            {getNotificationIcon(notification.type)}
          </div>
          <div className="toast-content">
            <p className="toast-text">{notification.content}</p>
            <span className="toast-hint">点击查看详情</span>
          </div>
          <button
            className="toast-close"
            onClick={(e) => handleClose(e, notification.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
