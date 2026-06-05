import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { searchArticles, getHotSearches } from '../services/api';
import { debounce } from '../utils/debounce';

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const keyword = searchParams.get('q') || '';
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchResult, setSearchResult] = useState(null);
  const [hotSearches, setHotSearches] = useState([]);

  useEffect(() => {
    async function fetchHotSearches() {
      try {
        const data = await getHotSearches();
        setHotSearches(data);
      } catch (err) {
        console.error('获取热门搜索失败:', err);
      }
    }
    fetchHotSearches();
  }, []);

  const doSearch = useCallback(async (searchKeyword) => {
    setLoading(true);
    setError(null);
    try {
      const data = await searchArticles(searchKeyword);
      setSearchResult(data);
    } catch (err) {
      setError(err.message || '搜索失败');
      setSearchResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedSearch = useCallback(
    debounce((searchKeyword) => {
      doSearch(searchKeyword);
    }, 300),
    [doSearch]
  );

  useEffect(() => {
    if (!keyword) {
      setSearchResult(null);
      return;
    }

    debouncedSearch(keyword);
  }, [keyword, debouncedSearch]);

  const handleHotSearchClick = (hotKeyword) => {
    navigate(`/search?q=${encodeURIComponent(hotKeyword)}`);
  };

  const renderHighlighted = (html) => {
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <div className="search-results-page">
      <div className="container">
        <div className="search-header">
          <h1 className="search-title">
            {keyword ? `搜索结果: "${keyword}"` : '搜索文章'}
          </h1>
          {searchResult && (
            <p className="search-count">
              共找到 <strong>{searchResult.total}</strong> 篇相关文章
            </p>
          )}
        </div>

        {loading && (
          <div className="search-loading">
            <div className="loading-spinner"></div>
            <p>正在搜索中...</p>
          </div>
        )}

        {error && (
          <div className="search-error">
            <p>搜索出错了: {error}</p>
          </div>
        )}

        {!loading && !error && searchResult && (
          <>
            {searchResult.articles.length > 0 ? (
              <div className="search-results-list">
                {searchResult.articles.map((article) => (
                  <div key={article.id} className="search-result-item">
                    <div className="search-result-header">
                      <span className="article-author">{article.author}</span>
                      <span className="article-date">
                        {new Date(article.created_at).toLocaleDateString('zh-CN')}
                      </span>
                      <span className="match-score">
                        匹配度: {article.match_score}
                      </span>
                    </div>
                    
                    <h2 className="search-result-title">
                      <Link to={`/article/${article.id}`}>
                        {renderHighlighted(article.title_highlighted)}
                      </Link>
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

                    <p className="search-result-excerpt">
                      {renderHighlighted(article.excerpt_highlighted)}
                    </p>

                    <div className="search-result-footer">
                      <Link to={`/article/${article.id}`} className="read-more">
                        阅读全文 →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="search-no-results">
                <div className="no-results-icon">🔍</div>
                <h2>没有找到相关文章</h2>
                <p>尝试使用其他关键词搜索，或者看看热门搜索:</p>
                <div className="hot-searches">
                  <h3>热门搜索</h3>
                  <div className="hot-search-tags">
                    {hotSearches.map((item, index) => (
                      <button
                        key={item.keyword}
                        className="hot-search-tag"
                        onClick={() => handleHotSearchClick(item.keyword)}
                      >
                        <span className="hot-search-rank">{index + 1}</span>
                        {item.keyword}
                        <span className="hot-search-count">{item.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {!keyword && !loading && (
          <div className="search-empty">
            <h2>请输入搜索关键词</h2>
            <p>或者试试这些热门搜索:</p>
            <div className="hot-searches">
              <div className="hot-search-tags">
                {hotSearches.map((item, index) => (
                  <button
                    key={item.keyword}
                    className="hot-search-tag"
                    onClick={() => handleHotSearchClick(item.keyword)}
                  >
                    <span className="hot-search-rank">{index + 1}</span>
                    {item.keyword}
                    <span className="hot-search-count">{item.count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
