import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getArticle, deleteArticle, getComments, createComment, getCategories, getTags } from '../services/api';
import LikeButton from '../components/LikeButton';
import FavoriteButton from '../components/FavoriteButton';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';

export default function ArticleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const articleBodyRef = useRef(null);
  const [article, setArticle] = useState(null);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState(null);
  const [commentSubmitError, setCommentSubmitError] = useState(null);
  const [nickname, setNickname] = useState('');
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchArticle();
    fetchComments();
  }, [id]);

  useEffect(() => {
    if (article && articleBodyRef.current) {
      const codeBlocks = articleBodyRef.current.querySelectorAll('pre code');
      codeBlocks.forEach((block) => {
        hljs.highlightElement(block);
      });
    }
  }, [article]);

  async function fetchArticle() {
    try {
      setLoading(true);
      const [articleData, categoriesData, tagsData] = await Promise.all([
        getArticle(id),
        getCategories(),
        getTags()
      ]);
      setArticle(articleData);
      setCategories(categoriesData);
      setTags(tagsData);
    } catch (err) {
      setError(err.message || '加载文章失败');
    } finally {
      setLoading(false);
    }
  }

  async function fetchComments() {
    try {
      setCommentsLoading(true);
      setCommentsError(null);
      const data = await getComments(id);
      setComments(data);
    } catch (err) {
      setCommentsError(err.message || '加载评论失败');
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
      setCommentSubmitError(null);
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
      setCommentSubmitError('发表评论失败：' + (err.message || '未知错误'));
    } finally {
      setSubmitting(false);
    }
  }

  function handleReply(comment) {
    setReplyTo(comment);
    setContent('');
  }

  function cancelReply() {
    setReplyTo(null);
    setContent('');
    setCommentSubmitError(null);
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
            
            {(article.category_name || (article.tags && article.tags.length > 0)) && (
              <div className="article-taxonomy">
                {article.category_name && (
                  <div className="article-taxonomy-item">
                    <span className="taxonomy-label">分类：</span>
                    <Link 
                      to={`/?category=${article.category_id}`} 
                      className="article-category-badge"
                    >
                      {article.category_name}
                    </Link>
                  </div>
                )}
                {article.tags && article.tags.length > 0 && (
                  <div className="article-taxonomy-item">
                    <span className="taxonomy-label">标签：</span>
                    <div className="article-tags-detail">
                      {article.tags.map(tag => (
                        <Link 
                          key={tag.id} 
                          to={`/?tag=${tag.id}`} 
                          className="article-tag-badge"
                        >
                          #{tag.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </header>
          
          <div 
            className="article-body" 
            ref={articleBodyRef}
            dangerouslySetInnerHTML={{ __html: article.content }}
          />
          
          <div className="article-interactions">
            <div className="interaction-buttons">
              <LikeButton 
                articleId={article.id} 
                initialCount={article.like_count || 0}
                size="large"
              />
              <FavoriteButton 
                articleId={article.id} 
                initialCount={article.favorite_count || 0}
                size="large"
              />
            </div>
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
            评论 (
            {commentsLoading ? (
              <span className="loading-text">加载中...</span>
            ) : (
              comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0)
            )}
            )
          </h2>

          {commentSubmitError && (
            <div className="error comment-error">
              {commentSubmitError}
            </div>
          )}

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
                placeholder={replyTo ? '写下您的回复...' : '写下您的评论...'}
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
              {submitting ? '发表中...' : (replyTo ? '发表回复' : '发表评论')}
            </button>
          </form>

          <div className="comments-list">
            {commentsLoading ? (
              <div className="comments-loading">加载评论中...</div>
            ) : commentsError ? (
              <div className="error comments-error">
                {commentsError}
                <button className="retry-btn" onClick={fetchComments}>
                  重试
                </button>
              </div>
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
