import { useSearchParams, Link } from 'react-router-dom';

export default function Sidebar({ categories = [], tags = [] }) {
  const [searchParams] = useSearchParams();

  const activeCategory = searchParams.get('category');
  const activeTag = searchParams.get('tag');

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
          {tags.map(tag => (
            <Link
              key={tag.id}
              to={`/?tag=${tag.id}`}
              className={`tag-cloud-item ${getTagSize(tag.article_count)} ${activeTag === String(tag.id) ? 'active' : ''} ${tag.article_count === 0 ? 'tag-empty' : ''}`}
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
