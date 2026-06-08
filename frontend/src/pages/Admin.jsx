import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getArticles, deleteArticle, getAllComments, deleteComment, getArticleStats } from '../services/api';
import Pagination from '../components/Pagination';

const SORT_OPTIONS = [
  { value: 'created_desc', label: '最新发布' },
  { value: 'created_asc', label: '最早发布' },
  { value: 'updated_desc', label: '最近更新' },
  { value: 'updated_asc', label: '最早更新' },
  { value: 'likes_desc', label: '点赞最多' },
  { value: 'likes_asc', label: '点赞最少' }
];

export default function Admin() {
  const navigate = useNavigate();
  const errorRef = useRef(null);
  const [activeTab, setActiveTab] = useState('articles');
  const [articles, setArticles] = useState([]);
  const [comments, setComments] = useState([]);
  const [stats, setStats] = useState([]);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteType, setDeleteType] = useState(null);

  const [articlesPage, setArticlesPage] = useState(1);
  const [articlesTotalPages, setArticlesTotalPages] = useState(1);
  const [articlesTotal, setArticlesTotal] = useState(0);
  const [articlesSort, setArticlesSort] = useState('created_desc');
  const articlesPageSize = 10;

  useEffect(() => {
    if (activeTab === 'articles') {
      fetchArticles();
    } else if (activeTab === 'comments') {
      fetchComments();
    } else {
      fetchStats();
    }
  }, [activeTab, articlesPage, articlesSort]);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [error]);

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
      if (articles.length === 1 && articlesPage > 1) {
        setArticlesPage(articlesPage - 1);
      } else {
        fetchArticles();
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

  function confirmDelete(id, type) {
    setDeleteId(id);
    setDeleteType(type);
  }

  function handleArticlesPageChange(page) {
    setArticlesPage(page);
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
            if (articlesLoading) return <div className="loading">加载中...</div>;
            if (articles.length === 0) {
              return (
                <div className="empty-state">
                  <p>暂无文章</p>
                  <Link to="/create" className="btn btn-primary">
                    创建第一篇文章
                  </Link>
                </div>
              );
            }
            return (
              <>
                <div className="list-toolbar admin-toolbar">
                  <div className="list-info">
                    <span>共 {articlesTotal} 篇文章</span>
                  </div>
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
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>标题</th>
                      <th>分类</th>
                      <th>作者</th>
                      <th>点赞数</th>
                      <th>收藏数</th>
                      <th>发布时间</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {articles.map(article => (
                      <tr key={article.id}>
                        <td>{article.id}</td>
                        <td className="table-title">
                          <Link to={`/article/${article.id}`}>{article.title}</Link>
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
                        <td className="table-actions">
                          <button
                            className="btn-action btn-edit"
                            onClick={() => navigate(`/edit/${article.id}`)}
                          >
                            编辑
                          </button>
                          <button
                            className="btn-action btn-delete"
                            onClick={() => confirmDelete(article.id, 'article')}
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
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
