import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';

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

function getNotificationTypeLabel(type) {
  switch (type) {
    case 'like':
      return '点赞';
    case 'favorite':
      return '收藏';
    case 'comment':
      return '评论';
    case 'reply':
      return '回复';
    default:
      return '通知';
  }
}

function formatTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return date.toLocaleDateString('zh-CN');
}

export default function Notifications() {
  const { isAuthenticated } = useAuth();
  const {
    notifications,
    loading,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotifications();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const options = { page, pageSize: 20 };
      if (filter === 'unread') {
        options.unread_only = 'true';
      }
      const data = await fetchNotifications(options);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('加载通知失败:', err);
    }
  }, [isAuthenticated, page, filter, fetchNotifications]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleNotificationClick = async (notification) => {
    if (notification.is_read === 0) {
      try {
        await markAsRead(notification.id);
      } catch (err) {
        console.error('标记已读失败:', err);
      }
    }
    if (notification.article_id) {
      navigate(`/article/${notification.article_id}`);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      loadNotifications();
    } catch (err) {
      console.error('全部标记已读失败:', err);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (window.confirm('确定要删除这条通知吗？')) {
      try {
        await deleteNotification(id);
        loadNotifications();
      } catch (err) {
        console.error('删除通知失败:', err);
      }
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return n.is_read === 0;
    return true;
  });

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="notifications-page">
      <div className="container">
        <div className="notifications-header">
          <h1>消息通知</h1>
          <div className="notifications-stats">
            {unreadCount > 0 && (
              <span className="unread-badge">{unreadCount} 条未读</span>
            )}
            <span>共 {total} 条通知</span>
          </div>
        </div>

        <div className="notifications-toolbar">
          <div className="notification-filters">
            <button
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => { setFilter('all'); setPage(1); }}
            >
              全部
            </button>
            <button
              className={`filter-btn ${filter === 'unread' ? 'active' : ''}`}
              onClick={() => { setFilter('unread'); setPage(1); }}
            >
              未读
            </button>
          </div>
          {unreadCount > 0 && (
            <button className="mark-all-btn" onClick={handleMarkAllRead}>
              全部标记已读
            </button>
          )}
        </div>

        {loading ? (
          <div className="loading">加载中...</div>
        ) : filteredNotifications.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔔</div>
            <p>{filter === 'unread' ? '暂无未读通知' : '暂无通知'}</p>
            <Link to="/" className="btn btn-primary">返回首页</Link>
          </div>
        ) : (
          <>
            <div className="notification-list">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${notification.is_read === 0 ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-icon">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="notification-content">
                    <div className="notification-header">
                      <span className="notification-type">
                        {getNotificationTypeLabel(notification.type)}
                      </span>
                      {notification.is_read === 0 && (
                        <span className="notification-dot"></span>
                      )}
                      <span className="notification-time">
                        {formatTime(notification.created_at)}
                      </span>
                    </div>
                    <p className="notification-text">{notification.content}</p>
                    {notification.article_title && (
                      <div className="notification-article">
                        📄 {notification.article_title}
                      </div>
                    )}
                  </div>
                  <button
                    className="notification-delete"
                    onClick={(e) => handleDelete(e, notification.id)}
                    title="删除通知"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="page-btn"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  上一页
                </button>
                <span className="page-info">第 {page} / {totalPages} 页</span>
                <button
                  className="page-btn"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
