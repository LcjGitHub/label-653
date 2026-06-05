import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getArticles, getCategories, getTags } from '../services/api';
import ArticleCard from '../components/ArticleCard';
import Sidebar from '../components/Sidebar';

export default function Home() {
  const [searchParams] = useSearchParams();
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const categoryFilter = searchParams.get('category');
  const tagFilter = searchParams.get('tag');

  useEffect(() => {
    fetchData();
  }, [categoryFilter, tagFilter]);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      
      const filters = {};
      if (categoryFilter) filters.category = categoryFilter;
      if (tagFilter) filters.tag = tagFilter;
      
      const [articlesData, categoriesData, tagsData] = await Promise.all([
        getArticles(filters),
        getCategories(),
        getTags()
      ]);
      
      setArticles(articlesData);
      setCategories(categoriesData);
      setTags(tagsData);
    } catch (err) {
      setError(err.message || '加载文章列表失败');
    } finally {
      setLoading(false);
    }
  }

  function getFilterTitle() {
    if (categoryFilter) {
      const category = categories.find(c => c.id === parseInt(categoryFilter));
      return category ? `分类：${category.name}` : '最新文章';
    }
    if (tagFilter) {
      const tag = tags.find(t => t.id === parseInt(tagFilter));
      return tag ? `标签：${tag.name}` : '最新文章';
    }
    return '最新文章';
  }

  function getFilterSubtitle() {
    if (categoryFilter) {
      const category = categories.find(c => c.id === parseInt(categoryFilter));
      return category ? category.description : '分享技术，记录成长';
    }
    if (tagFilter) {
      const tag = tags.find(t => t.id === parseInt(tagFilter));
      return tag ? `包含标签"${tag.name}"的文章` : '分享技术，记录成长';
    }
    return '分享技术，记录成长';
  }

  if (loading) {
    return (
      <div className="container">
        <div className="home-layout">
          <main className="home-main">
            <div className="loading">加载中...</div>
          </main>
          <Sidebar />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="home-layout">
          <main className="home-main">
            <div className="error">加载失败：{error}</div>
          </main>
          <Sidebar />
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="home-layout">
        <main className="home-main">
          <div className="page-header">
            <h1>{getFilterTitle()}</h1>
            <p className="page-subtitle">{getFilterSubtitle()}</p>
            {(categoryFilter || tagFilter) && (
              <p className="filter-result">共找到 {articles.length} 篇文章</p>
            )}
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
        </main>
        <Sidebar />
      </div>
    </div>
  );
}
