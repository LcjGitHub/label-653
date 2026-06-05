import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getArticles, deleteArticle } from '../services/api';

export default function Admin() {
  const navigate = useNavigate();
  const errorRef = useRef(null);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    fetchArticles();
  }, []);

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

  async function handleDelete(id) {
    try {
      await deleteArticle(id);
      setArticles(prev => prev.filter(article => article.id !== id));
      setDeleteId(null);
      setError(null);
    } catch (err) {
      setError('删除失败：' + (err.message || '未知错误'));
      setDeleteId(null);
    }
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
          <h1>文章管理</h1>
          <p className="page-subtitle">管理所有文章</p>
        </div>
        <Link to="/create" className="btn btn-primary">
          + 新建文章
        </Link>
      </div>

      {error && (
        <div className="error" ref={errorRef}>
          {error}
        </div>
      )}

      <div className="admin-table-container">
        {articles.length === 0 ? (
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
                      onClick={() => setDeleteId(article.id)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {deleteId && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>确认删除</h3>
            <p>确定要删除这篇文章吗？此操作无法撤销。</p>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setDeleteId(null)}
              >
                取消
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleDelete(deleteId)}
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
