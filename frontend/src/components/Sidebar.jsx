import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getCategories, getTags } from '../services/api';

export default function Sidebar() {
  const [searchParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const activeCategory = searchParams.get('category');
  const activeTag = searchParams.get('tag');

  useEffect(() => {
    fetchSidebarData();
  }, []);

  async function fetchSidebarData() {
    try {
      setLoading(true);
      setError(null);
      const [categoriesData, tagsData] = await Promise.all([
        getCategories(),
        getTags()
      ]);
      setCategories(categoriesData);
      setTags(tagsData);
    } catch (err) {
      setError(err.message || '加载分类和标签失败');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <aside className="sidebar">
        <div className="sidebar-section">
          <div className="sidebar-loading">加载中...</div>
        </div>
      </aside>
    );
  }

  if (error) {
    return (
      <aside className="sidebar">
        <div className="sidebar-section">
          <div className="sidebar-error">{error}</div>
        </div>
      </aside>
    );
  }

  const maxTagCount = Math.max(...tags.map(t => t.article_count), 1);

  function getTagSize(articleCount) {
    const ratio = articleCount / maxTagCount;
    if (ratio > 0.7) return 'tag-large';
    if (ratio > 0.3) return 'tag-medium';
    return 'tag-small';
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <h3 className="sidebar-title">
          <Link to="/" className={`sidebar-all-link ${!activeCategory && !activeTag ? 'active' : ''}`}>
            全部文章
          </Link>
        </h3>
      </div>

      <div className="sidebar-section">
        <h3 className="sidebar-title">文章分类</h3>
        <ul className="category-list">
          {categories.map(category => (
            <li key={category.id} className="category-item">
              <Link
                to={`/?category=${category.id}`}
                className={`category-link ${activeCategory === String(category.id) ? 'active' : ''}`}
              >
                <span className="category-name">{category.name}</span>
                <span className="category-count">{category.article_count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="sidebar-section">
        <h3 className="sidebar-title">标签云</h3>
        <div className="tag-cloud">
          {tags.filter(t => t.article_count > 0).map(tag => (
            <Link
              key={tag.id}
              to={`/?tag=${tag.id}`}
              className={`tag-cloud-item ${getTagSize(tag.article_count)} ${activeTag === String(tag.id) ? 'active' : ''}`}
              title={`${tag.name} (${tag.article_count}篇)`}
            >
              {tag.name}
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}
