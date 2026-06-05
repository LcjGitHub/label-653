import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getArticles, deleteArticle, getAllComments, deleteComment } from '../services/api';

export default function Admin() {
  const navigate = useNavigate();
  const errorRef = useRef(null);
  const [activeTab, setActiveTab] = useState('articles');
  const [articles, setArticles] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteType, setDeleteType] = useState(null);

  useEffect(() => {
    if (activeTab === 'articles') {
      fetchArticles();
    } else {
      fetchComments();
    }
  }, [activeTab]);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [error]);

  async function fetchArticles() {
    try {
      setLoading(true);
      const data = await getArticles();
      setArticles(data);
    } catch (err) {
      setError(err.message || '加载文章列表失败');
    } finally {
      setLoading(false);
    }
  }

  async function fetchComments() {
    try {
      setLoading(true);
      const data = await getAllComments();
      setComments(data);
    } catch (err) {
      setError(err.message || '加载评论列表失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteArticle(id) {
    try {
      await deleteArticle(id);
      setArticles(prev => prev.filter(article => article.id !== id));
      setDeleteId(null);
      setDeleteType(null);
      setError(null);
    } catch (err) {
      setError('删除失败：' + (err.message || '未知错误'));
      setDeleteId(null);
      setDeleteType(null);
    }
  }

  async function handleDeleteComment(id) {
    try {
      await deleteComment(id);
      setComments(prev => prev.filter(comment => comment.id !== id && comment.parent_id !== id));
      setDeleteId(null);
      setDeleteType(null);
      setError(null);
    } catch (err) {
      setError('删除失败：' + (err.message || '未知错误'));
      setDeleteId(null);
      setDeleteType(null);
    }
  }

  function confirmDelete(id, type) {
    setDeleteId(id);
    setDeleteType(type);
  }

  if (loading) {
    return (
      <div className="container">
        <div className="loading">加载中...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="admin-header">
        <div>
          <h1>后台管理</h1>
          <p className="page-subtitle">管理文章和评论</p>
        </div>
        {activeTab === 'articles' && (
          <Link to="/create" className="btn btn-primary">
            + 新建文章
          </Link>
        )}
      </div>

      <div className="admin-tabs">
        <button
          className={`tab-btn ${activeTab === 'articles' ? 'active' : ''}`}
          onClick={() => setActiveTab('articles')}
        >
          文章管理
        </button>
        <button
          className={`tab-btn ${activeTab === 'comments' ? 'active' : ''}`}
          onClick={() => setActiveTab('comments')}
        >
          评论管理
        </button>
      </div>

      {error && (
        <div className="error" ref={errorRef}>
          {error}
        </div>
      )}

      <div className="admin-table-container">
        {activeTab === 'articles' ? (
          articles.length === 0 ? (
            <div className="empty-state">
              <p>暂无文章</p>
              <Link to="/create" className="btn btn-primary">
                创建第一篇文章
              </Link>
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>标题</th>
                  <th>作者</th>
                  <th>发布时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {articles.map(article => (
                  <tr key={article.id}>
                    <td>{article.id}</td>
                    <td className="table-title">
                      <Link to={`/article/${article.id}`}>{article.title}</Link>
                    </td>
                    <td>{article.author}</td>
                    <td>
                      {new Date(article.created_at).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="table-actions">
                      <button
                        className="btn-action btn-edit"
                        onClick={() => navigate(`/edit/${article.id}`)}
                      >
                        编辑
                      </button>
                      <button
                        className="btn-action btn-delete"
                        onClick={() => confirmDelete(article.id, 'article')}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          comments.length === 0 ? (
            <div className="empty-state">
              <p>暂无评论</p>
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>评论者</th>
                  <th>评论内容</th>
                  <th>所属文章</th>
                  <th>类型</th>
                  <th>时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {comments.map(comment => (
                  <tr key={comment.id}>
                    <td>{comment.id}</td>
                    <td>{comment.nickname}</td>
                    <td className="table-content">
                      {comment.parent_nickname && (
                        <span className="reply-mention">@{comment.parent_nickname} </span>
                      )}
                      {comment.content.length > 50 ? comment.content.substring(0, 50) + '...' : comment.content}
                    </td>
                    <td className="table-title">
                      <Link to={`/article/${comment.article_id}`}>
                        {comment.article_title || '文章已删除'}
                      </Link>
                    </td>
                    <td>
                      {comment.parent_id ? (
                        <span className="badge badge-secondary">回复</span>
                      ) : (
                        <span className="badge badge-primary">评论</span>
                      )}
                    </td>
                    <td>
                      {new Date(comment.created_at).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="table-actions">
                      <button
                        className="btn-action btn-delete"
                        onClick={() => confirmDelete(comment.id, 'comment')}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>

      {deleteId && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>确认删除</h3>
            <p>
              确定要删除这条{deleteType === 'article' ? '文章' : '评论'}吗？
              {deleteType === 'comment' && ' 删除后该评论的回复也会被一并删除。'}
              此操作无法撤销。
            </p>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => { setDeleteId(null); setDeleteType(null); }}
              >
                取消
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  if (deleteType === 'article') {
                    handleDeleteArticle(deleteId);
                  } else {
                    handleDeleteComment(deleteId);
                  }
                }}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
