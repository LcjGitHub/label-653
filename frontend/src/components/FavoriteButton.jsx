import { useState, useEffect } from 'react';
import { favoriteArticle, unfavoriteArticle, getArticleFavorites } from '../services/api';

export default function FavoriteButton({ articleId, initialCount = 0, initialFavorited = false, showCount = true, showStatus = true, size = 'medium' }) {
  const [count, setCount] = useState(initialCount);
  const [favorited, setFavorited] = useState(initialFavorited);
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    if (articleId && showStatus) {
      fetchFavoriteStatus();
    }
  }, [articleId, showStatus]);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    setFavorited(initialFavorited);
  }, [initialFavorited]);

  async function fetchFavoriteStatus() {
    try {
      const data = await getArticleFavorites(articleId);
      setCount(data.favorite_count);
      setFavorited(data.favorited);
    } catch (err) {
      console.error('获取收藏状态失败:', err);
    }
  }

  function showNotification(message) {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  }

  async function handleClick() {
    if (loading || !articleId) return;

    try {
      setLoading(true);
      
      if (favorited) {
        const data = await unfavoriteArticle(articleId);
        setCount(data.favorite_count);
        setFavorited(false);
        showNotification('已取消收藏');
      } else {
        const data = await favoriteArticle(articleId);
        setCount(data.favorite_count);
        setFavorited(true);
        showNotification('收藏成功');
      }
    } catch (err) {
      console.error('操作失败:', err);
      showNotification(err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  }

  const sizeClasses = {
    small: 'favorite-btn-small',
    medium: 'favorite-btn-medium',
    large: 'favorite-btn-large'
  };

  const ariaLabel = favorited 
    ? `取消收藏，已收藏 ${count} 次` 
    : `收藏，当前共 ${count} 次收藏`;

  return (
    <div className="favorite-wrapper">
      <button
        className={`favorite-btn ${sizeClasses[size]} ${favorited ? 'favorited' : ''}`}
        onClick={handleClick}
        disabled={loading}
        title={favorited ? '取消收藏' : '收藏'}
        aria-label={ariaLabel}
      >
        <svg className="favorite-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
        </svg>
        {showCount && (
          <span className="favorite-count" aria-hidden="true">{count}</span>
        )}
      </button>
      
      {showToast && (
        <div className="favorite-toast show" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
