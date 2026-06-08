import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getArticles, getDrafts, deleteArticle, getAllComments, deleteComment, getArticleStats, pinArticle, exportArticlesBatch, exportArticle, downloadFromResponse } from '../services/api';
import Pagination from '../components/Pagination';

const SORT_OPTIONS = [
  { value: 'created_desc', label: '最新发布' },
  { value: 'created_asc', label: '最早发布' },
  { value: 'updated_desc', label: '最近更新' },
  { value: 'updated_asc', label: '最早更新' },
  { value: 'likes_desc', label: '点赞最多' },
  { value: 'likes_asc', label: '点赞最少' }
];

const DRAFT_SORT_OPTIONS = [
  { value: 'updated_desc', label: '最近更新' },
  { value: 'updated_asc', label: '最早更新' },
  { value: 'created_desc', label: '最新创建' },
  { value: 'created_asc', label: '最早创建' }
];

export default function Admin() {
  const navigate = useNavigate();
  const errorRef = useRef(null);
  const [activeTab, setActiveTab] = useState('articles');
  const [articleSubTab, setArticleSubTab] = useState('published');
  const [articles, setArticles] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [comments, setComments] = useState([]);
  const [stats, setStats] = useState([]);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteType, setDeleteType] = useState(null);
  const [pinningIds, setPinningIds] = useState(new Set());
  const [selectedArticleIds, setSelectedArticleIds] = useState(new Set());
  const [selectedDraftIds, setSelectedDraftIds] = useState(new Set());
  const [exporting, setExporting] = useState(false);
  const [showBatchExportMenu, setShowBatchExportMenu] = useState(false);
  const batchExportMenuRef = useRef(null);
  const [showRowExportMenu, setShowRowExportMenu] = useState(null);
  const [rowExporting, setRowExporting] = useState(null);
  const rowExportMenuRefs = useRef({});

  const [articlesPage, setArticlesPage] = useState(1);
  const [articlesTotalPages, setArticlesTotalPages] = useState(1);
  const [articlesTotal, setArticlesTotal] = useState(0);
  const [articlesSort, setArticlesSort] = useState('created_desc');
  const articlesPageSize = 10;

  const [draftsPage, setDraftsPage] = useState(1);
  const [draftsTotalPages, setDraftsTotalPages] = useState(1);
  const [draftsTotal, setDraftsTotal] = useState(0);
  const [draftsSort, setDraftsSort] = useState('updated_desc');
  const draftsPageSize = 10;

  useEffect(() => {
    if (activeTab === 'articles') {
      if (articleSubTab === 'published') {
        fetchArticles();
      } else {
        fetchDrafts();
      }
    } else if (activeTab === 'comments') {
      fetchComments();
    } else {
      fetchStats();
    }
  }, [activeTab, articleSubTab, articlesPage, articlesSort, draftsPage, draftsSort]);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [error]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (batchExportMenuRef.current && !batchExportMenuRef.current.contains(event.target)) {
        setShowBatchExportMenu(false);
      }
      if (showRowExportMenu) {
        const ref = rowExportMenuRefs.current[showRowExportMenu];
        if (ref && !ref.contains(event.target)) {
          setShowRowExportMenu(null);
        }
      }
    }
    if (showBatchExportMenu || showRowExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showBatchExportMenu, showRowExportMenu]);

  async function handleRowExport(articleId, format) {
    try {
      setRowExporting(articleId);
      setShowRowExportMenu(null);
      const response = await exportArticle(articleId, format);
      await downloadFromResponse(response);
    } catch (err) {
      setError('导出失败：' + (err.message || '未知错误'));
    } finally {
      setRowExporting(null);
    }
  }

  function toggleSelectArticle(id, isDraft = false) {
    const setSelected = isDraft ? setSelectedDraftIds : setSelectedArticleIds;
    const selected = isDraft ? selectedDraftIds : selectedArticleIds;
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
  }

  function toggleSelectAll(isDraft = false) {
    const list = isDraft ? drafts : articles;
    const setSelected = isDraft ? setSelectedDraftIds : setSelectedArticleIds;
    const selected = isDraft ? selectedDraftIds : selectedArticleIds;
    
    if (selected.size === list.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(list.map(item => item.id)));
    }
  }

  async function handleBatchExport(format, isDraft = false) {
    try {
      const selected = isDraft ? selectedDraftIds : selectedArticleIds;
      if (selected.size === 0) {
        setError('请先选择要导出的文章');
        return;
      }
      setExporting(true);
      setShowBatchExportMenu(false);
      const ids = Array.from(selected);
      const response = await exportArticlesBatch(ids, format);
      await downloadFromResponse(response);
      if (!isDraft) {
        setSelectedArticleIds(new Set());
      } else {
        setSelectedDraftIds(new Set());
      }
    } catch (err) {
      setError('批量导出失败：' + (err.message || '未知错误'));
    } finally {
      setExporting(false);
    }
  }

  async function fetchArticles() {
    try {
      setArticlesLoading(true);
      setError(null);
      const result = await getArticles({
        page: articlesPage,
        pageSize: articlesPageSize,
        sort: articlesSort
      });
      if (result.page !== articlesPage) {
        setArticlesPage(result.page);
      }
      setArticles(result.articles || []);
      setArticlesTotalPages(result.totalPages || 1);
      setArticlesTotal(result.total || 0);
    } catch (err) {
      setError(err.message || '加载文章列表失败');
    } finally {
      setArticlesLoading(false);
    }
  }

  function handleSortChange(e) {
    setArticlesSort(e.target.value);
    setArticlesPage(1);
  }

  async function fetchDrafts() {
    try {
      setDraftsLoading(true);
      setError(null);
      const result = await getDrafts({
        page: draftsPage,
        pageSize: draftsPageSize,
        sort: draftsSort
      });
      if (result.page !== draftsPage) {
        setDraftsPage(result.page);
      }
      setDrafts(result.articles || []);
      setDraftsTotalPages(result.totalPages || 1);
      setDraftsTotal(result.total || 0);
    } catch (err) {
      setError(err.message || '加载草稿列表失败');
    } finally {
      setDraftsLoading(false);
    }
  }

  function handleDraftsSortChange(e) {
    setDraftsSort(e.target.value);
    setDraftsPage(1);
  }

  async function fetchComments() {
    try {
      setCommentsLoading(true);
      setError(null);
      const data = await getAllComments();
      setComments(data);
    } catch (err) {
      setError(err.message || '加载评论列表失败');
    } finally {
      setCommentsLoading(false);
    }
  }

  async function fetchStats() {
    try {
      setStatsLoading(true);
      setError(null);
      const data = await getArticleStats();
      setStats(data);
    } catch (err) {
      setError(err.message || '加载统计数据失败');
    } finally {
      setStatsLoading(false);
    }
  }

  async function handleDeleteArticle(id) {
    try {
      await deleteArticle(id);
      if (articleSubTab === 'published') {
        if (articles.length === 1 && articlesPage > 1) {
          setArticlesPage(articlesPage - 1);
        } else {
          fetchArticles();
        }
      } else {
        if (drafts.length === 1 && draftsPage > 1) {
          setDraftsPage(draftsPage - 1);
        } else {
          fetchDrafts();
        }
      }
      setDeleteId(null);
      setDeleteType(null);
      setError(null);
    } catch (err) {
      setError('删除失败：' + (err.message || '未知错误'));
      setDeleteId(null);
      setDeleteType(null);
    }
  }

  async function handleDeleteComment(id) {
    try {
      await deleteComment(id);
      setComments(prev => prev.filter(comment => comment.id !== id && comment.parent_id !== id));
      setDeleteId(null);
      setDeleteType(null);
      setError(null);
    } catch (err) {
      setError('删除失败：' + (err.message || '未知错误'));
      setDeleteId(null);
      setDeleteType(null);
    }
  }

  async function handleTogglePin(articleId, currentPinned) {
    if (pinningIds.has(articleId)) {
      return;
    }
    try {
      setPinningIds(prev => new Set(prev).add(articleId));
      const newPinned = !currentPinned;
      await pinArticle(articleId, newPinned);
      if (articleSubTab === 'published') {
        fetchArticles();
      } else {
        fetchDrafts();
      }
    } catch (err) {
      setError('切换置顶状态失败：' + (err.message || '未知错误'));
    } finally {
      setPinningIds(prev => {
        const next = new Set(prev);
        next.delete(articleId);
        return next;
      });
    }
  }

  function confirmDelete(id, type) {
    setDeleteId(id);
    setDeleteType(type);
  }

  function handleArticlesPageChange(page) {
    setArticlesPage(page);
  }

  function handleDraftsPageChange(page) {
    setDraftsPage(page);
  }

  function handleArticleSubTabChange(tab) {
    if (tab === 'drafts') {
      setDraftsLoading(true);
    }
    setArticleSubTab(tab);
  }

  return (
    <div className="container">
      <div className="admin-header">
        <div>
          <h1>后台管理</h1>
          <p className="page-subtitle">管理文章、评论和数据统计</p>
        </div>
        {activeTab === 'articles' && (
          <Link to="/create" className="btn btn-primary">
            + 新建文章
          </Link>
        )}
      </div>

      <div className="admin-tabs">
        <button
          className={`tab-btn ${activeTab === 'articles' ? 'active' : ''}`}
          onClick={() => setActiveTab('articles')}
        >
          文章管理
        </button>
        <button
          className={`tab-btn ${activeTab === 'comments' ? 'active' : ''}`}
          onClick={() => setActiveTab('comments')}
        >
          评论管理
        </button>
        <button
          className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          数据统计
        </button>
      </div>

      {error && (
        <div className="error" ref={errorRef}>
          {error}
        </div>
      )}

      <div className="admin-table-container">
        {(() => {
          if (activeTab === 'articles') {
            return (
              <>
                <div className="admin-sub-tabs">
                  <button
                    className={`tab-btn ${articleSubTab === 'published' ? 'active' : ''}`}
                    onClick={() => handleArticleSubTabChange('published')}
                  >
                    已发布
                  </button>
                  <button
                    className={`tab-btn ${articleSubTab === 'drafts' ? 'active' : ''}`}
                    onClick={() => handleArticleSubTabChange('drafts')}
                  >
                    草稿箱
                  </button>
                </div>

                {articleSubTab === 'published' ? (
                  <>
                    {articlesLoading ? (
                      <div className="loading">加载中...</div>
                    ) : articles.length === 0 ? (
                      <div className="empty-state">
                        <p>暂无已发布文章</p>
                        <Link to="/create" className="btn btn-primary">
                          创建第一篇文章
                        </Link>
                      </div>
                    ) : (
                      <>
                        <div className="list-toolbar admin-toolbar">
                          <div className="list-info">
                            <span>共 {articlesTotal} 篇已发布文章</span>
                            {selectedArticleIds.size > 0 && (
                              <span className="selected-count">已选择 {selectedArticleIds.size} 篇</span>
                            )}
                          </div>
                          <div className="toolbar-actions">
                            {selectedArticleIds.size > 0 && (
                              <div className="batch-export-dropdown" ref={batchExportMenuRef}>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setShowBatchExportMenu(!showBatchExportMenu)}
                                  disabled={exporting}
                                >
                                  {exporting ? '导出中...' : (
                                    <>
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '4px', verticalAlign: 'middle' }}>
                                        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor"/>
                                      </svg>
                                      批量导出
                                    </>
                                  )}
                                </button>
                                {showBatchExportMenu && (
                                  <div className="export-menu">
                                    <button
                                      className="export-menu-item"
                                      onClick={() => handleBatchExport('markdown', false)}
                                      disabled={exporting}
                                    >
                                      <span>📝</span>
                                      <span>导出为 Markdown</span>
                                    </button>
                                    <button
                                      className="export-menu-item"
                                      onClick={() => handleBatchExport('pdf', false)}
                                      disabled={exporting}
                                    >
                                      <span>📄</span>
                                      <span>导出为 PDF</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="sort-wrapper">
                              <label htmlFor="admin-sort-select" className="sort-label">排序：</label>
                              <select
                                id="admin-sort-select"
                                className="sort-select"
                                value={articlesSort}
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
                        </div>
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th style={{ width: '40px' }}>
                                <input
                                  type="checkbox"
                                  checked={selectedArticleIds.size === articles.length && articles.length > 0}
                                  onChange={() => toggleSelectAll(false)}
                                  disabled={articles.length === 0}
                                />
                              </th>
                              <th>ID</th>
                              <th>标题</th>
                              <th>分类</th>
                              <th>作者</th>
                              <th>点赞数</th>
                              <th>收藏数</th>
                              <th>发布时间</th>
                              <th>置顶</th>
                              <th>操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {articles.map(article => {
                              const isPinned = article.is_pinned === 1 || article.is_pinned === true;
                              return (
                              <tr key={article.id}>
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={selectedArticleIds.has(article.id)}
                                    onChange={() => toggleSelectArticle(article.id, false)}
                                  />
                                </td>
                                <td>{article.id}</td>
                                <td className="table-title">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {isPinned && (
                                    <span className="pin-icon" title="已置顶">
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M16 12V4H13L14 2H10L11 4H8V12L6 14V16H11.5V22H12.5V16H18V14L16 12Z" fill="currentColor" />
                                      </svg>
                                    </span>
                                  )}
                                  <Link to={`/article/${article.id}`}>{article.title}</Link>
                                </div>
                              </td>
                                <td>
                                  {article.category_name ? (
                                    <span className="badge badge-primary">
                                      {article.category_name}
                                    </span>
                                  ) : (
                                    <span className="text-muted">未分类</span>
                                  )}
                                </td>
                                <td>{article.author}</td>
                                <td>
                                  <span className="badge badge-like">
                                    {article.like_count || 0}
                                  </span>
                                </td>
                                <td>
                                  <span className="badge badge-favorite">
                                    {article.favorite_count || 0}
                                  </span>
                                </td>
                                <td>
                                  {new Date(article.created_at).toLocaleString('zh-CN')}
                                </td>
                                <td>
                                  <button
                                    className={`btn-pin ${isPinned ? 'active' : ''}`}
                                    onClick={() => handleTogglePin(article.id, isPinned)}
                                    title={isPinned ? '取消置顶' : '置顶'}
                                    disabled={pinningIds.has(article.id)}
                                  >
                                    {pinningIds.has(article.id) ? (
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ animation: 'spin 1s linear infinite' }}>
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="currentColor" opacity="0.3"/>
                                        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8z" fill="currentColor"/>
                                      </svg>
                                    ) : (
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M16 12V4H13L14 2H10L11 4H8V12L6 14V16H11.5V22H12.5V16H18V14L16 12Z" fill="currentColor" />
                                      </svg>
                                    )}
                                    <span>{pinningIds.has(article.id) ? '处理中...' : (isPinned ? '取消' : '置顶')}</span>
                                  </button>
                                </td>
                                <td className="table-actions">
                                  <button
                                    className="btn-action btn-edit"
                                    onClick={() => navigate(`/edit/${article.id}`)}
                                  >
                                    编辑
                                  </button>
                                  <div
                                    className="row-export-dropdown"
                                    ref={(el) => { rowExportMenuRefs.current[`article-${article.id}`] = el; }}
                                  >
                                    <button
                                      className="btn-action"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowRowExportMenu(showRowExportMenu === `article-${article.id}` ? null : `article-${article.id}`);
                                      }}
                                      disabled={rowExporting === article.id}
                                    >
                                      {rowExporting === article.id ? '导出中...' : '导出'}
                                    </button>
                                    {showRowExportMenu === `article-${article.id}` && (
                                      <div className="export-menu export-menu-sm">
                                        <button
                                          className="export-menu-item"
                                          onClick={() => handleRowExport(article.id, 'markdown')}
                                          disabled={rowExporting === article.id}
                                        >
                                          <span>📝</span>
                                          <span>导出为 Markdown</span>
                                        </button>
                                        <button
                                          className="export-menu-item"
                                          onClick={() => handleRowExport(article.id, 'pdf')}
                                          disabled={rowExporting === article.id}
                                        >
                                          <span>📄</span>
                                          <span>导出为 PDF</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    className="btn-action btn-delete"
                                    onClick={() => confirmDelete(article.id, 'article')}
                                  >
                                    删除
                                  </button>
                                </td>
                              </tr>
                            ); })}
                          </tbody>
                        </table>
                        <div className="pagination-wrapper admin-pagination">
                          <Pagination
                            currentPage={articlesPage}
                            totalPages={articlesTotalPages}
                            onPageChange={handleArticlesPageChange}
                          />
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {draftsLoading ? (
                      <div className="loading">加载中...</div>
                    ) : drafts.length === 0 ? (
                      <div className="empty-state">
                        <p>暂无草稿</p>
                        <Link to="/create" className="btn btn-primary">
                          创建新草稿
                        </Link>
                      </div>
                    ) : (
                      <>
                        <div className="list-toolbar admin-toolbar">
                          <div className="list-info">
                            <span>共 {draftsTotal} 篇草稿</span>
                            {selectedDraftIds.size > 0 && (
                              <span className="selected-count">已选择 {selectedDraftIds.size} 篇</span>
                            )}
                          </div>
                          <div className="toolbar-actions">
                            {selectedDraftIds.size > 0 && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  if (selectedDraftIds.size > 0) {
                                    setError('请先选择要导出的文章');
                                    return;
                                  }
                                }}
                                disabled={exporting}
                                style={{ display: 'none' }}
                              >
                                占位
                              </button>
                            )}
                            {selectedDraftIds.size > 0 && (
                              <div className="batch-export-dropdown">
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setShowBatchExportMenu(!showBatchExportMenu)}
                                  disabled={exporting}
                                >
                                  {exporting ? '导出中...' : (
                                    <>
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '4px', verticalAlign: 'middle' }}>
                                        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor"/>
                                      </svg>
                                      批量导出
                                    </>
                                  )}
                                </button>
                                {showBatchExportMenu && (
                                  <div className="export-menu">
                                    <button
                                      className="export-menu-item"
                                      onClick={() => handleBatchExport('markdown', true)}
                                      disabled={exporting}
                                    >
                                      <span>📝</span>
                                      <span>导出为 Markdown</span>
                                    </button>
                                    <button
                                      className="export-menu-item"
                                      onClick={() => handleBatchExport('pdf', true)}
                                      disabled={exporting}
                                    >
                                      <span>📄</span>
                                      <span>导出为 PDF</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="sort-wrapper">
                              <label htmlFor="draft-sort-select" className="sort-label">排序：</label>
                              <select
                                id="draft-sort-select"
                                className="sort-select"
                                value={draftsSort}
                                onChange={handleDraftsSortChange}
                              >
                                {DRAFT_SORT_OPTIONS.map(option => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th style={{ width: '40px' }}>
                                <input
                                  type="checkbox"
                                  checked={selectedDraftIds.size === drafts.length && drafts.length > 0}
                                  onChange={() => toggleSelectAll(true)}
                                  disabled={drafts.length === 0}
                                />
                              </th>
                              <th>ID</th>
                              <th>标题</th>
                              <th>分类</th>
                              <th>作者</th>
                              <th>更新时间</th>
                              <th>置顶</th>
                              <th>操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {drafts.map(draft => {
                              const isPinned = draft.is_pinned === 1 || draft.is_pinned === true;
                              return (
                              <tr key={draft.id}>
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={selectedDraftIds.has(draft.id)}
                                    onChange={() => toggleSelectArticle(draft.id, true)}
                                  />
                                </td>
                                <td>{draft.id}</td>
                                <td className="table-title">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {isPinned && (
                                      <span className="pin-icon" title="已置顶">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                          <path d="M16 12V4H13L14 2H10L11 4H8V12L6 14V16H11.5V22H12.5V16H18V14L16 12Z" fill="currentColor" />
                                        </svg>
                                      </span>
                                    )}
                                    {draft.title}
                                    <span className="badge badge-secondary" style={{ marginLeft: '8px' }}>草稿</span>
                                  </div>
                                </td>
                                <td>
                                  {draft.category_name ? (
                                    <span className="badge badge-primary">
                                      {draft.category_name}
                                    </span>
                                  ) : (
                                    <span className="text-muted">未分类</span>
                                  )}
                                </td>
                                <td>{draft.author}</td>
                                <td>
                                  {new Date(draft.updated_at).toLocaleString('zh-CN')}
                                </td>
                                <td>
                                  <button
                                    className={`btn-pin ${isPinned ? 'active' : ''}`}
                                    onClick={() => handleTogglePin(draft.id, isPinned)}
                                    title={isPinned ? '取消置顶' : '置顶'}
                                    disabled={pinningIds.has(draft.id)}
                                  >
                                    {pinningIds.has(draft.id) ? (
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ animation: 'spin 1s linear infinite' }}>
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="currentColor" opacity="0.3"/>
                                        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8z" fill="currentColor"/>
                                      </svg>
                                    ) : (
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M16 12V4H13L14 2H10L11 4H8V12L6 14V16H11.5V22H12.5V16H18V14L16 12Z" fill="currentColor" />
                                      </svg>
                                    )}
                                    <span>{pinningIds.has(draft.id) ? '处理中...' : (isPinned ? '取消' : '置顶')}</span>
                                  </button>
                                </td>
                                <td className="table-actions">
                                  <button
                                    className="btn-action btn-edit"
                                    onClick={() => navigate(`/edit/${draft.id}`)}
                                  >
                                    编辑
                                  </button>
                                  <div
                                    className="row-export-dropdown"
                                    ref={(el) => { rowExportMenuRefs.current[`draft-${draft.id}`] = el; }}
                                  >
                                    <button
                                      className="btn-action"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowRowExportMenu(showRowExportMenu === `draft-${draft.id}` ? null : `draft-${draft.id}`);
                                      }}
                                      disabled={rowExporting === draft.id}
                                    >
                                      {rowExporting === draft.id ? '导出中...' : '导出'}
                                    </button>
                                    {showRowExportMenu === `draft-${draft.id}` && (
                                      <div className="export-menu export-menu-sm">
                                        <button
                                          className="export-menu-item"
                                          onClick={() => handleRowExport(draft.id, 'markdown')}
                                          disabled={rowExporting === draft.id}
                                        >
                                          <span>📝</span>
                                          <span>导出为 Markdown</span>
                                        </button>
                                        <button
                                          className="export-menu-item"
                                          onClick={() => handleRowExport(draft.id, 'pdf')}
                                          disabled={rowExporting === draft.id}
                                        >
                                          <span>📄</span>
                                          <span>导出为 PDF</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    className="btn-action btn-delete"
                                    onClick={() => confirmDelete(draft.id, 'article')}
                                  >
                                    删除
                                  </button>
                                </td>
                              </tr>
                            ); })}
                          </tbody>
                        </table>
                        <div className="pagination-wrapper admin-pagination">
                          <Pagination
                            currentPage={draftsPage}
                            totalPages={draftsTotalPages}
                            onPageChange={handleDraftsPageChange}
                          />
                        </div>
                      </>
                    )}
                  </>
                )}
              </>
            );
          }
          
          if (activeTab === 'comments') {
            if (commentsLoading) return <div className="loading">加载中...</div>;
            if (comments.length === 0) {
              return (
                <div className="empty-state">
                  <p>暂无评论</p>
                </div>
              );
            }
            return (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>评论者</th>
                    <th>评论内容</th>
                    <th>所属文章</th>
                    <th>类型</th>
                    <th>时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {comments.map(comment => (
                    <tr key={comment.id}>
                      <td>{comment.id}</td>
                      <td>{comment.nickname}</td>
                      <td className="table-content">
                        {comment.parent_nickname && (
                          <span className="reply-mention">@{comment.parent_nickname} </span>
                        )}
                        {comment.content.length > 50 ? comment.content.substring(0, 50) + '...' : comment.content}
                      </td>
                      <td className="table-title">
                        <Link to={`/article/${comment.article_id}`}>
                          {comment.article_title || '文章已删除'}
                        </Link>
                      </td>
                      <td>
                        {comment.parent_id ? (
                          <span className="badge badge-secondary">回复</span>
                        ) : (
                          <span className="badge badge-primary">评论</span>
                        )}
                      </td>
                      <td>
                        {new Date(comment.created_at).toLocaleString('zh-CN')}
                      </td>
                      <td className="table-actions">
                        <button
                          className="btn-action btn-delete"
                          onClick={() => confirmDelete(comment.id, 'comment')}
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          }
          
          if (statsLoading) return <div className="loading">加载中...</div>;
          if (stats.length === 0) {
            return (
              <div className="empty-state">
                <p>暂无统计数据</p>
              </div>
            );
          }
          return (
            <div>
              <div className="stats-summary">
                <div className="stat-card">
                  <div className="stat-label">总点赞数</div>
                  <div className="stat-value">
                    {stats.reduce((sum, s) => sum + s.like_count, 0)}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">总收藏数</div>
                  <div className="stat-value">
                    {stats.reduce((sum, s) => sum + s.favorite_count, 0)}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">总评论数</div>
                  <div className="stat-value">
                    {stats.reduce((sum, s) => sum + s.comment_count, 0)}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">文章总数</div>
                  <div className="stat-value">{stats.length}</div>
                </div>
              </div>
              
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>文章标题</th>
                    <th>点赞数</th>
                    <th>收藏数</th>
                    <th>评论数</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map(stat => (
                    <tr key={stat.id}>
                      <td>{stat.id}</td>
                      <td className="table-title">
                        <Link to={`/article/${stat.id}`}>{stat.title}</Link>
                      </td>
                      <td>
                        <span className="badge badge-like">{stat.like_count}</span>
                      </td>
                      <td>
                        <span className="badge badge-favorite">{stat.favorite_count}</span>
                      </td>
                      <td>
                        <span className="badge badge-comment">{stat.comment_count}</span>
                      </td>
                      <td className="table-actions">
                        <button
                          className="btn-action btn-edit"
                          onClick={() => navigate(`/edit/${stat.id}`)}
                        >
                          编辑
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

      {deleteId && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>确认删除</h3>
            <p>
              确定要删除这条{deleteType === 'article' ? '文章' : '评论'}吗？
              {deleteType === 'comment' && ' 删除后该评论的回复也会被一并删除。'}
              此操作无法撤销。
            </p>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => { setDeleteId(null); setDeleteType(null); }}
              >
                取消
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  if (deleteType === 'article') {
                    handleDeleteArticle(deleteId);
                  } else {
                    handleDeleteComment(deleteId);
                  }
                }}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
