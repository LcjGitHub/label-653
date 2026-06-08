import { useState, useEffect } from 'react';
import {
  getArticleVersions,
  getArticleVersion,
  restoreArticleVersion,
  deleteArticleVersion
} from '../services/api';

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function VersionHistory({ articleId, onRestore }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [viewingVersion, setViewingVersion] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (articleId) {
      loadVersions();
    }
  }, [articleId, page]);

  async function loadVersions() {
    try {
      setLoading(true);
      setError(null);
      const data = await getArticleVersions(articleId, { page, pageSize: 10 });
      setVersions(data.versions || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(err.message || '加载版本历史失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleViewVersion(version) {
    try {
      setViewLoading(true);
      setSelectedVersion(version);
      const data = await getArticleVersion(articleId, version.id);
      setViewingVersion(data);
    } catch (err) {
      setError(err.message || '加载版本详情失败');
    } finally {
      setViewLoading(false);
    }
  }

  function closeVersionView() {
    setViewingVersion(null);
    setSelectedVersion(null);
  }

  async function handleRestore(version) {
    try {
      setActionLoading(true);
      const result = await restoreArticleVersion(articleId, version.id);
      setConfirmRestore(null);
      if (onRestore && result.article) {
        onRestore(result.article);
      }
      await loadVersions();
    } catch (err) {
      setError(err.message || '恢复版本失败');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete(version) {
    try {
      setActionLoading(true);
      await deleteArticleVersion(articleId, version.id);
      setConfirmDelete(null);
      if (viewingVersion && viewingVersion.id === version.id) {
        closeVersionView();
      }
      await loadVersions();
    } catch (err) {
      setError(err.message || '删除版本失败');
    } finally {
      setActionLoading(false);
    }
  }

  function renderPagination() {
    if (totalPages <= 1) return null;

    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= page - 1 && i <= page + 1)
      ) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }

    return (
      <div className="version-pagination">
        <button
          className="pagination-btn"
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          上一页
        </button>
        {pages.map((p, idx) =>
          p === '...' ? (
            <span key={`ellipsis-${idx}`} className="pagination-ellipsis">...</span>
          ) : (
            <button
              key={p}
              className={`pagination-btn ${page === p ? 'active' : ''}`}
              onClick={() => setPage(p)}
            >
              {p}
            </button>
          )
        )}
        <button
          className="pagination-btn"
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
        >
          下一页
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="version-history">
        <div className="version-header">
          <h3>版本历史</h3>
        </div>
        <div className="loading">加载版本历史中...</div>
      </div>
    );
  }

  return (
    <div className="version-history">
      <div className="version-header">
        <h3>版本历史</h3>
        {total > 0 && <span className="version-count">共 {total} 个版本</span>}
      </div>

      {error && <div className="error">{error}</div>}

      {versions.length === 0 ? (
        <div className="version-empty">
          <p>暂无历史版本</p>
          <small>更新文章后将自动保存版本</small>
        </div>
      ) : (
        <>
          <div className="version-list">
            {versions.map(version => (
              <div
                key={version.id}
                className={`version-item ${selectedVersion?.id === version.id ? 'selected' : ''}`}
              >
                <div className="version-info">
                  <div className="version-number">
                    <span className="version-badge">v{version.version_number}</span>
                    <span className="version-date">{formatDateTime(version.created_at)}</span>
                  </div>
                  <div className="version-title">{version.title}</div>
                  <div className="version-meta">
                    {version.user_name && (
                      <span className="version-user">编辑者: {version.user_name}</span>
                    )}
                    {version.status && (
                      <span className={`badge ${version.status === 'draft' ? 'badge-secondary' : 'badge-primary'}`}>
                        {version.status === 'draft' ? '草稿' : '已发布'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="version-actions">
                  <button
                    className="btn-action btn-view"
                    onClick={() => handleViewVersion(version)}
                    disabled={viewLoading}
                  >
                    查看
                  </button>
                  <button
                    className="btn-action btn-restore"
                    onClick={() => setConfirmRestore(version)}
                    disabled={actionLoading}
                  >
                    恢复
                  </button>
                  <button
                    className="btn-action btn-delete"
                    onClick={() => setConfirmDelete(version)}
                    disabled={actionLoading}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
          {renderPagination()}
        </>
      )}

      {viewingVersion && (
        <div className="modal-overlay" onClick={closeVersionView}>
          <div className="modal version-modal" onClick={e => e.stopPropagation()}>
            <div className="version-modal-header">
              <h3>
                版本详情 - v{viewingVersion.version_number}
                <span className="version-date-inline">{formatDateTime(viewingVersion.created_at)}</span>
              </h3>
              <button className="modal-close" onClick={closeVersionView}>×</button>
            </div>
            <div className="version-modal-content">
              <div className="version-detail-item">
                <label>标题:</label>
                <div className="version-detail-value">{viewingVersion.title}</div>
              </div>
              {viewingVersion.author && (
                <div className="version-detail-item">
                  <label>作者:</label>
                  <div className="version-detail-value">{viewingVersion.author}</div>
                </div>
              )}
              {viewingVersion.category_name && (
                <div className="version-detail-item">
                  <label>分类:</label>
                  <div className="version-detail-value">{viewingVersion.category_name}</div>
                </div>
              )}
              {viewingVersion.tags && viewingVersion.tags.length > 0 && (
                <div className="version-detail-item">
                  <label>标签:</label>
                  <div className="version-detail-value">
                    {viewingVersion.tags.map(tag => (
                      <span key={tag.id} className="article-tag-badge" style={{ marginRight: '6px' }}>
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="version-detail-item">
                <label>内容:</label>
                <div className="version-content-preview">
                  <div className="article-body" dangerouslySetInnerHTML={{ __html: viewingVersion.content }} />
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={closeVersionView}>
                关闭
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setConfirmRestore(viewingVersion);
                  closeVersionView();
                }}
                disabled={actionLoading}
              >
                恢复此版本
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmRestore && (
        <div className="modal-overlay" onClick={() => setConfirmRestore(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>确认恢复版本</h3>
            <p>
              确定要恢复到版本 <strong>v{confirmRestore.version_number}</strong> ({formatDateTime(confirmRestore.created_at)}) 吗？
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              当前内容将自动保存为新版本。
            </p>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setConfirmRestore(null)}
                disabled={actionLoading}
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleRestore(confirmRestore)}
                disabled={actionLoading}
              >
                {actionLoading ? '恢复中...' : '确认恢复'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>确认删除版本</h3>
            <p>
              确定要删除版本 <strong>v{confirmDelete.version_number}</strong> ({formatDateTime(confirmDelete.created_at)}) 吗？
            </p>
            <p style={{ color: 'var(--danger-color)', fontSize: '0.9rem' }}>
              此操作不可撤销。
            </p>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setConfirmDelete(null)}
                disabled={actionLoading}
              >
                取消
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleDelete(confirmDelete)}
                disabled={actionLoading}
              >
                {actionLoading ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
