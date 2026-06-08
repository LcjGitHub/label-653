import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getArticles, getCategories, getTags } from '../services/api';
import ArticleCard from '../components/ArticleCard';
import Sidebar from '../components/Sidebar';
import Pagination from '../components/Pagination';

const SORT_OPTIONS = [
  { value: 'created_desc', label: '最新发布' },
  { value: 'created_asc', label: '最早发布' },
  { value: 'updated_desc', label: '最近更新' },
  { value: 'updated_asc', label: '最早更新' },
  { value: 'likes_desc', label: '点赞最多' },
  { value: 'likes_asc', label: '点赞最少' }
];

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sidebarReady, setSidebarReady] = useState(false);

  const categoryFilter = searchParams.get('category');
  const tagFilter = searchParams.get('tag');
  const sortParam = searchParams.get('sort');
  const pageParam = parseInt(searchParams.get('page')) || 1;

  const [currentPage, setCurrentPage] = useState(pageParam);
  const [totalPages, setTotalPages] = useState(1);
  const [totalArticles, setTotalArticles] = useState(0);
  const [sortBy, setSortBy] = useState(sortParam || 'created_desc');
  const pageSize = 10;

  const isFirstLoad = useRef(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (sidebarReady) {
      loadArticles();
    }
  }, [categoryFilter, tagFilter, currentPage, sortBy, sidebarReady]);

  useEffect(() => {
    const page = parseInt(searchParams.get('page')) || 1;
    const sort = searchParams.get('sort') || 'created_desc';
    setCurrentPage(page);
    setSortBy(sort);
  }, [searchParams]);

  async function loadInitialData() {
    try {
      setInitialLoading(true);
      setError(null);
      const [categoriesData, tagsData] = await Promise.all([
        getCategories(),
        getTags()
      ]);
      setCategories(categoriesData);
      setTags(tagsData);
      setSidebarReady(true);
    } catch (err) {
      setError(err.message || '加载分类和标签失败');
      setInitialLoading(false);
    }
  }

  async function loadArticles() {
    try {
      setFilterLoading(true);
      setError(null);
      
      const filters = {};
      if (categoryFilter) filters.category = categoryFilter;
      if (tagFilter) filters.tag = tagFilter;
      filters.sort = sortBy;
      filters.page = currentPage;
      filters.pageSize = pageSize;
      
      const result = await getArticles(filters);
      
      if (result.page !== currentPage) {
        const newParams = new URLSearchParams(searchParams);
        newParams.set('page', result.page.toString());
        setSearchParams(newParams);
        setCurrentPage(result.page);
      }
      
      setArticles(result.articles || []);
      setTotalPages(result.totalPages || 1);
      setTotalArticles(result.total || 0);
      isFirstLoad.current = false;
    } catch (err) {
      setError(err.message || '加载文章列表失败');
    } finally {
      setFilterLoading(false);
      setInitialLoading(false);
    }
  }

  function handlePageChange(page) {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', page.toString());
    setSearchParams(newParams);
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleSortChange(e) {
    const newSort = e.target.value;
    setSortBy(newSort);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('sort', newSort);
    newParams.set('page', '1');
    setSearchParams(newParams);
    setCurrentPage(1);
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

  if (initialLoading) {
    return (
      <div className="container">
        <div className="home-layout">
          <main className="home-main">
            <div className="loading">加载中...</div>
          </main>
        </div>
      </div>
    );
  }

  if (error && !sidebarReady) {
    return (
      <div className="container">
        <div className="home-layout">
          <main className="home-main">
            <div className="error">加载失败：{error}</div>
          </main>
        </div>
      </div>
    );
  }

  const showPagination = totalPages > 1;

  return (
    <div className="container">
      <div className="home-layout">
        <main className="home-main">
          <div className="page-header">
            <h1>{filterLoading ? '加载中...' : getFilterTitle()}</h1>
            {!filterLoading && (
              <>
                <p className="page-subtitle">{getFilterSubtitle()}</p>
                {(categoryFilter || tagFilter) && (
                  <p className="filter-result">共找到 {totalArticles} 篇文章</p>
                )}
              </>
            )}
          </div>

          <div className="list-toolbar">
            <div className="list-info">
              {totalArticles > 0 && (
                <span>共 {totalArticles} 篇文章</span>
              )}
            </div>
            <div className="sort-wrapper">
              <label htmlFor="sort-select" className="sort-label">排序：</label>
              <select
                id="sort-select"
                className="sort-select"
                value={sortBy}
                onChange={handleSortChange}
              >
                {SORT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filterLoading && isFirstLoad.current ? (
            <div className="loading">加载中...</div>
          ) : (
            <>
              <div className={`articles-grid ${filterLoading ? 'articles-loading' : ''}`}>
                {articles.length === 0 && !filterLoading ? (
                  <div className="empty-state">
                    <p>暂无文章</p>
                  </div>
                ) : (
                  articles.map(article => (
                    <ArticleCard key={article.id} article={article} />
                  ))
                )}
              </div>
              {showPagination && (
                <div className="pagination-wrapper">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
            </>
          )}
        </main>
        {sidebarReady && <Sidebar categories={categories} tags={tags} />}
      </div>
    </div>
  );
}
