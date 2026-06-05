import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getArticles, deleteArticle } from '../services/api';

export default function Admin() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    fetchArticles();
  }, []);

  async function fetchArticles() {
    try {
      setLoading(true);
      const data = await getArticles();
      setArticles(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteArticle(id);
      setArticles(prev => prev.filter(article => article.id !== id));
      setDeleteId(null);
    } catch (err) {
      setError('删除失败: ' + err.message);
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

  if (error) {
    return (
      <div className="container">
        <div className="error">加载失败: {error}</div>
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
