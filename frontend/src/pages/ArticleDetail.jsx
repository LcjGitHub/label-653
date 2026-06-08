import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getArticle, deleteArticle, getComments, createComment, exportArticle, getShareLink, downloadFromResponse } from '../services/api';
import LikeButton from '../components/LikeButton';
import FavoriteButton from '../components/FavoriteButton';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';

export default function ArticleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const articleBodyRef = useRef(null);
  const [article, setArticle] = useState(null);
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
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareData, setShareData] = useState(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const exportMenuRef = useRef(null);

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

  useEffect(() => {
    function handleClickOutside(event) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setShowExportMenu(false);
      }
    }
    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportMenu]);

  async function handleExport(format) {
    try {
      setExporting(true);
      setShowExportMenu(false);
      const response = await exportArticle(id, format);
      await downloadFromResponse(response);
    } catch (err) {
      setError('导出失败：' + (err.message || '未知错误'));
    } finally {
      setExporting(false);
    }
  }

  async function handleShare() {
    try {
      setShareLoading(true);
      setShowShareModal(true);
      const data = await getShareLink(id);
      const fullUrl = window.location.origin + data.share_url;
      setShareData({ ...data, full_url: fullUrl });
    } catch (err) {
      setError('生成分享链接失败：' + (err.message || '未知错误'));
      setShowShareModal(false);
    } finally {
      setShareLoading(false);
    }
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch {
        setError('复制失败，请手动复制');
      }
      document.body.removeChild(textarea);
    }
  }

  async function fetchArticle() {
    try {
      setLoading(true);
      const articleData = await getArticle(id);
      setArticle(articleData);
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

  if (!article || !article.id || article.status === 'draft') {
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
            <div className="action-buttons-group">
              <div className="export-dropdown" ref={exportMenuRef}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={exporting}
                >
                  {exporting ? '导出中...' : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
                        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor"/>
                      </svg>
                      导出文章
                    </>
                  )}
                </button>
                {showExportMenu && (
                  <div className="export-menu">
                    <button
                      className="export-menu-item"
                      onClick={() => handleExport('markdown')}
                      disabled={exporting}
                    >
                      <span>📝</span>
                      <span>导出为 Markdown</span>
                    </button>
                    <button
                      className="export-menu-item"
                      onClick={() => handleExport('pdf')}
                      disabled={exporting}
                    >
                      <span>📄</span>
                      <span>导出为 PDF</span>
                    </button>
                  </div>
                )}
              </div>
              <button
                className="btn btn-secondary"
                onClick={handleShare}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
                  <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" fill="currentColor"/>
                </svg>
                分享文章
              </button>
            </div>
            <div className="action-buttons-group">
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

        {showShareModal && (
          <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
            <div className="modal share-modal" onClick={(e) => e.stopPropagation()}>
              <h3>分享文章</h3>
              {shareLoading ? (
                <div className="loading" style={{ padding: '30px 0' }}>生成分享链接中...</div>
              ) : shareData ? (
                <>
                  <div className="share-info">
                    <p className="share-title">《{shareData.title}》</p>
                    <p className="share-author">作者：{shareData.author}</p>
                  </div>
                  <div className="share-link-section">
                    <label>分享链接：</label>
                    <div className="share-link-input">
                      <input
                        type="text"
                        value={shareData.full_url}
                        readOnly
                      />
                      <button
                        className={`btn ${copySuccess ? 'btn-success' : 'btn-primary'}`}
                        onClick={() => copyToClipboard(shareData.full_url)}
                      >
                        {copySuccess ? '已复制!' : '复制链接'}
                      </button>
                    </div>
                  </div>
                  <div className="share-tips">
                    <p>💡 提示：将链接分享给朋友后，他们可以直接点击访问此文章。</p>
                  </div>
                </>
              ) : null}
              <div className="modal-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => { setShowShareModal(false); setShareData(null); setCopySuccess(false); }}
                >
                  关闭
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
