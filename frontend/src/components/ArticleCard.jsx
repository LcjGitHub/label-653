import { Link } from 'react-router-dom';

export default function ArticleCard({ article }) {
  const excerpt = article.content.length > 150
    ? article.content.substring(0, 150) + '...'
    : article.content;

  return (
    <div className="article-card">
      <div className="article-card-header">
        <span className="article-author">{article.author}</span>
        <span className="article-date">
          {new Date(article.created_at).toLocaleDateString('zh-CN')}
        </span>
      </div>
      <h2 className="article-card-title">
        <Link to={`/article/${article.id}`}>{article.title}</Link>
      </h2>
      
      {(article.category_name || (article.tags && article.tags.length > 0)) && (
        <div className="article-card-meta">
          {article.category_name && (
            <Link to={`/?category=${article.category_id}`} className="article-category">
              {article.category_name}
            </Link>
          )}
          {article.tags && article.tags.length > 0 && (
            <div className="article-tags">
              {article.tags.slice(0, 3).map(tag => (
                <Link 
                  key={tag.id} 
                  to={`/?tag=${tag.id}`} 
                  className="article-tag"
                >
                  #{tag.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
      
      <p className="article-card-excerpt">{excerpt}</p>
      <div className="article-card-footer">
        <Link to={`/article/${article.id}`} className="read-more">
          阅读全文 →
        </Link>
      </div>
    </div>
  );
}
