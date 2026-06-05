import { useState, useEffect } from 'react';
import { likeArticle, unlikeArticle, getArticleLikes } from '../services/api';

export default function LikeButton({ articleId, initialCount = 0, initialLiked = false, showCount = true, showStatus = true, size = 'medium' }) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initialLiked);
  const [loading, setLoading] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');

  useEffect(() => {
    if (articleId && showStatus) {
      fetchLikeStatus();
    }
  }, [articleId, showStatus]);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    setLiked(initialLiked);
  }, [initialLiked]);

  async function fetchLikeStatus() {
    try {
      const data = await getArticleLikes(articleId);
      setCount(data.like_count);
      setLiked(data.liked);
    } catch (err) {
      console.error('获取点赞状态失败:', err);
    }
  }

  function showNotification(message, type = 'success') {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  }

  async function handleClick() {
    if (loading || !articleId) return;

    try {
      setLoading(true);
      
      if (liked) {
        const data = await unlikeArticle(articleId);
        setCount(data.like_count);
        setLiked(false);
      } else {
        const data = await likeArticle(articleId);
        setCount(data.like_count);
        setLiked(true);
        setAnimating(true);
        setTimeout(() => setAnimating(false), 600);
      }
    } catch (err) {
      console.error('操作失败:', err);
      showNotification(err.message || '操作失败', 'error');
    } finally {
      setLoading(false);
    }
  }

  const sizeClasses = {
    small: 'like-btn-small',
    medium: 'like-btn-medium',
    large: 'like-btn-large'
  };

  const ariaLabel = liked 
    ? `取消点赞，已点赞 ${count} 次` 
    : `点赞，当前共 ${count} 次点赞`;

  return (
    <div className="like-wrapper">
      <button
        className={`like-btn ${sizeClasses[size]} ${liked ? 'liked' : ''} ${animating ? 'animating' : ''}`}
        onClick={handleClick}
        disabled={loading}
        title={liked ? '取消点赞' : '点赞'}
        aria-label={ariaLabel}
      >
        <svg className="like-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        {showCount && (
          <span className="like-count" aria-hidden="true">{count}</span>
        )}
        {animating && (
          <span className="like-particles" aria-hidden="true">
            {[...Array(6)].map((_, i) => (
              <span key={i} className="particle" style={{ '--i': i }}></span>
            ))}
          </span>
        )}
      </button>
      
      {showToast && (
        <div className={`like-toast show ${toastType}`} role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
