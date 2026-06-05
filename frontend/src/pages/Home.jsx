import { useState, useEffect } from 'react';
import { getArticles } from '../services/api';
import ArticleCard from '../components/ArticleCard';

export default function Home() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchArticles();
  }, []);

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
        <div className="error">加载失败：{error}</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1>最新文章</h1>
        <p className="page-subtitle">分享技术，记录成长</p>
      </div>
      <div className="articles-grid">
        {articles.length === 0 ? (
          <div className="empty-state">
            <p>暂无文章</p>
          </div>
        ) : (
          articles.map(article => (
            <ArticleCard key={article.id} article={article} />
          ))
        )}
      </div>
    </div>
  );
}
