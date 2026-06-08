import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { searchArticles, getHotSearches } from '../services/api';
import { debounce } from '../utils/debounce';
import Pagination from '../components/Pagination';

export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const keyword = searchParams.get('q') || '';
  const pageParam = parseInt(searchParams.get('page')) || 1;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchResult, setSearchResult] = useState(null);
  const [hotSearches, setHotSearches] = useState([]);
  const [currentPage, setCurrentPage] = useState(pageParam);
  const pageSize = 10;

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

  const doSearch = useCallback(async (searchKeyword, page) => {
    setLoading(true);
    setError(null);
    try {
      const data = await searchArticles(searchKeyword, { page, pageSize });
      setSearchResult(data);
      if (data.page !== page) {
        const newParams = new URLSearchParams(searchParams);
        newParams.set('page', data.page.toString());
        setSearchParams(newParams);
        setCurrentPage(data.page);
      }
    } catch (err) {
      setError(err.message || '搜索失败');
      setSearchResult(null);
    } finally {
      setLoading(false);
    }
  }, [searchParams, setSearchParams]);

  const debouncedSearch = useCallback(
    debounce((searchKeyword, page) => {
      doSearch(searchKeyword, page);
    }, 300),
    [doSearch]
  );

  useEffect(() => {
    const page = parseInt(searchParams.get('page')) || 1;
    setCurrentPage(page);
    if (!keyword) {
      setSearchResult(null);
      return;
    }
    debouncedSearch(keyword, page);
  }, [keyword, currentPage, searchParams, debouncedSearch]);

  const handleHotSearchClick = (hotKeyword) => {
    navigate(`/search?q=${encodeURIComponent(hotKeyword)}`);
  };

  const handlePageChange = (page) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', page.toString());
    setSearchParams(newParams);
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderHighlighted = (html) => {
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const showPagination = searchResult && searchResult.totalPages > 1;

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
              <>
                <div className="search-results-list">
                  {searchResult.articles.map((article) => {
                    const isPinned = article.is_pinned === 1 || article.is_pinned === true;
                    return (
                    <div key={article.id} className={`search-result-item ${isPinned ? 'article-card-pinned' : ''}`}>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {isPinned && (
                            <span className="pin-badge">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ verticalAlign: 'middle', marginRight: '4px' }}>
                                <path d="M16 12V4H13L14 2H10L11 4H8V12L6 14V16H11.5V22H12.5V16H18V14L16 12Z" fill="currentColor" />
                              </svg>
                              置顶
                            </span>
                          )}
                          <Link to={`/article/${article.id}`}>
                            {renderHighlighted(article.title_highlighted)}
                          </Link>
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

                      <p className="search-result-excerpt">
                        {renderHighlighted(article.excerpt_highlighted)}
                      </p>

                      <div className="search-result-footer">
                        <Link to={`/article/${article.id}`} className="read-more">
                          阅读全文 →
                        </Link>
                      </div>
                    </div>
                    );
                  })}
                </div>
                {showPagination && (
                  <div className="pagination-wrapper">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={searchResult.totalPages}
                      onPageChange={handlePageChange}
                    />
                  </div>
                )}
              </>
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
