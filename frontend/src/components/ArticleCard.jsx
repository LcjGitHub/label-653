import { Link } from 'react-router-dom';
import LikeButton from './LikeButton';

const BLOCK_ELEMENTS = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'ul', 'ol', 'li', 'table', 'tr', 'br', 'hr'];

function stripHtml(html) {
  if (!html) return '';
  
  let result = html;
  
  BLOCK_ELEMENTS.forEach(tag => {
    const openRegex = new RegExp(`<${tag}[^>]*>`, 'gi');
    const closeRegex = new RegExp(`</${tag}>`, 'gi');
    result = result.replace(openRegex, ' ');
    result = result.replace(closeRegex, ' ');
  });
  
  const tmp = document.createElement('div');
  tmp.innerHTML = result;
  let text = tmp.textContent || tmp.innerText || '';
  
  text = text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .replace(/\n /g, '\n')
    .replace(/ \n/g, '\n')
    .trim();
  
  return text;
}

export default function ArticleCard({ article }) {
  const plainContent = stripHtml(article.content);
  const excerpt = plainContent.length > 150
    ? plainContent.substring(0, 150) + '...'
    : plainContent;

  const isPinned = article.is_pinned === 1 || article.is_pinned === true;

  return (
    <div className={`article-card ${isPinned ? 'article-card-pinned' : ''}`}>
      <div className="article-card-header">
        <span className="article-author">{article.author}</span>
        <span className="article-date">
          {new Date(article.created_at).toLocaleDateString('zh-CN')}
        </span>
      </div>
      <h2 className="article-card-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isPinned && (
            <span className="pin-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ verticalAlign: 'middle', marginRight: '4px' }}>
                <path d="M16 12V4H13L14 2H10L11 4H8V12L6 14V16H11.5V22H12.5V16H18V14L16 12Z" fill="currentColor" />
              </svg>
              置顶
            </span>
          )}
          <Link to={`/article/${article.id}`}>{article.title}</Link>
        </div>
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
        <div className="card-stats">
          <LikeButton 
            articleId={article.id} 
            initialCount={article.like_count || 0}
            showStatus={false}
            size="small"
          />
        </div>
        <Link to={`/article/${article.id}`} className="read-more">
          阅读全文 →
        </Link>
      </div>
    </div>
  );
}
