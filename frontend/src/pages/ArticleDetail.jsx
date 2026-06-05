import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getArticle, deleteArticle } from '../services/api';

export default function ArticleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    fetchArticle();
  }, [id]);

  async function fetchArticle() {
    try {
      setLoading(true);
      const data = await getArticle(id);
      setArticle(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    try {
      await deleteArticle(id);
      navigate('/');
    } catch (err) {
      setError('删除失败: ' + err.message);
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
        <div className="error">加载失败: {error}</div>
        <Link to="/" className="back-link">← 返回列表</Link>
      </div>
    );
  }

  if (!article) {
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
      </div>
    </div>
  );
}
