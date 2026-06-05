import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getArticle, deleteArticle, getComments, createComment } from '../services/api';

export default function ArticleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [nickname, setNickname] = useState('');
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchArticle();
    fetchComments();
  }, [id]);

  async function fetchArticle() {
    try {
      setLoading(true);
      const data = await getArticle(id);
      setArticle(data);
    } catch (err) {
      setError(err.message || '加载文章失败');
    } finally {
      setLoading(false);
    }
  }

  async function fetchComments() {
    try {
      setCommentsLoading(true);
      const data = await getComments(id);
      setComments(data);
    } catch (err) {
      console.error('加载评论失败:', err);
    } finally {
      setCommentsLoading(false);
    }
  }

  async function handleSubmitComment(e) {
    e.preventDefault();
    if (!nickname.trim() || !content.trim()) {
      return;
    }

    try {
      setSubmitting(true);
      const newComment = await createComment(id, {
        nickname: nickname.trim(),
        content: content.trim(),
        parent_id: replyTo ? replyTo.id : null,
      });

      if (replyTo) {
        setComments(prev => prev.map(comment => {
          if (comment.id === replyTo.id) {
            return {
              ...comment,
              replies: [...(comment.replies || []), newComment],
            };
          }
          return comment;
        }));
      } else {
        setComments(prev => [{ ...newComment, replies: [] }, ...prev]);
      }

      setNickname('');
      setContent('');
      setReplyTo(null);
    } catch (err) {
      setError('发表评论失败：' + (err.message || '未知错误'));
    } finally {
      setSubmitting(false);
    }
  }

  function handleReply(comment) {
    setReplyTo(comment);
    setContent(`@${comment.nickname} `);
  }

  function cancelReply() {
    setReplyTo(null);
    setContent('');
  }

  async function handleDelete() {
    try {
      await deleteArticle(id);
      navigate('/');
    } catch (err) {
      setError('删除失败：' + (err.message || '未知错误'));
      setShowDeleteConfirm(false);
    }
  }

  if (loading) {
    return (
      <div className="container">
        <div className="loading">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error">{error}</div>
        <Link to="/" className="back-link">← 返回列表</Link>
      </div>
    );
  }

  if (!article || !article.id) {
    return (
      <div className="container">
        <div className="error">文章不存在</div>
        <Link to="/" className="back-link">← 返回列表</Link>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="article-detail">
        <Link to="/" className="back-link">← 返回列表</Link>
        
        <article className="article-content">
          <header className="article-header">
            <h1 className="article-title">{article.title}</h1>
            <div className="article-meta">
              <span className="article-author">{article.author}</span>
              <span className="article-date">
                发布于 {new Date(article.created_at).toLocaleString('zh-CN')}
              </span>
              {article.updated_at !== article.created_at && (
                <span className="article-date">
                  更新于 {new Date(article.updated_at).toLocaleString('zh-CN')}
                </span>
              )}
            </div>
          </header>
          
          <div className="article-body">
            {article.content.split('\n').map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          
          <div className="article-actions">
            <Link to={`/edit/${article.id}`} className="btn btn-primary">
              编辑文章
            </Link>
            <button
              className="btn btn-danger"
              onClick={() => setShowDeleteConfirm(true)}
            >
              删除文章
            </button>
          </div>
        </article>

        {showDeleteConfirm && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>确认删除</h3>
              <p>确定要删除这篇文章吗？此操作无法撤销。</p>
              <div className="modal-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  取消
                </button>
                <button
                  className="btn btn-danger"
                  onClick={handleDelete}
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        )}

        <section className="comments-section">
          <h2 className="comments-title">
            评论 ({comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0)})
          </h2>

          <form className="comment-form" onSubmit={handleSubmitComment}>
            {replyTo && (
              <div className="reply-info">
                回复 @{replyTo.nickname}
                <button type="button" className="cancel-reply" onClick={cancelReply}>
                  取消
                </button>
              </div>
            )}
            <div className="form-group">
              <input
                type="text"
                className="form-input"
                placeholder="您的昵称"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
                maxLength={50}
              />
            </div>
            <div className="form-group">
              <textarea
                className="form-textarea"
                placeholder="写下您的评论..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                maxLength={500}
                rows={4}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !nickname.trim() || !content.trim()}
            >
              {submitting ? '发表中...' : '发表评论'}
            </button>
          </form>

          <div className="comments-list">
            {commentsLoading ? (
              <div className="comments-loading">加载评论中...</div>
            ) : comments.length === 0 ? (
              <div className="no-comments">暂无评论，快来抢沙发吧！</div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="comment-item">
                  <div className="comment-header">
                    <span className="comment-author">{comment.nickname}</span>
                    <span className="comment-date">
                      {new Date(comment.created_at).toLocaleString('zh-CN')}
                    </span>
                  </div>
                  <div className="comment-body">{comment.content}</div>
                  <div className="comment-actions">
                    <button
                      className="reply-btn"
                      onClick={() => handleReply(comment)}
                    >
                      回复
                    </button>
                  </div>

                  {comment.replies && comment.replies.length > 0 && (
                    <div className="comment-replies">
                      {comment.replies.map((reply) => (
                        <div key={reply.id} className="comment-item reply-item">
                          <div className="comment-header">
                            <span className="comment-author">{reply.nickname}</span>
                            <span className="comment-date">
                              {new Date(reply.created_at).toLocaleString('zh-CN')}
                            </span>
                          </div>
                          <div className="comment-body">
                            {reply.parent_nickname && (
                              <span className="reply-mention">@{reply.parent_nickname} </span>
                            )}
                            {reply.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
