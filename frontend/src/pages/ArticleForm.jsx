import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getArticle, createArticle, updateArticle } from '../services/api';

export default function ArticleForm({ isEdit = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const errorRef = useRef(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    author: '管理员',
  });
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(isEdit);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isEdit && id) {
      fetchArticle();
    }
  }, [isEdit, id]);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [error]);

  async function fetchArticle() {
    try {
      setFetchLoading(true);
      setFetchFailed(false);
      const data = await getArticle(id);
      setFormData({
        title: data.title,
        content: data.content,
        author: data.author,
      });
    } catch (err) {
      setError(err.message || '加载文章失败');
      setFetchFailed(true);
    } finally {
      setFetchLoading(false);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      setError('文章标题不能为空');
      return;
    }
    
    if (!formData.content.trim()) {
      setError('文章内容不能为空');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      if (isEdit) {
        await updateArticle(id, formData);
      } else {
        await createArticle(formData);
      }
      
      navigate('/');
    } catch (err) {
      setError(err.message || '保存失败');
    } finally {
      setLoading(false);
    }
  }

  if (fetchLoading) {
    return (
      <div className="container">
        <div className="loading">加载中...</div>
      </div>
    );
  }

  if (isEdit && fetchFailed) {
    return (
      <div className="container">
        <div className="error" ref={errorRef}>
          {error || '加载文章失败'}
        </div>
        <Link to="/" className="back-link">← 返回列表</Link>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="form-container">
        <div className="form-header">
          <h1>{isEdit ? '编辑文章' : '创建新文章'}</h1>
          <Link to="/" className="back-link">← 返回列表</Link>
        </div>

        {error && (
          <div className="error" ref={errorRef}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="article-form">
          <div className="form-group">
            <label htmlFor="title">文章标题</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="请输入文章标题"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="author">作者</label>
            <input
              type="text"
              id="author"
              name="author"
              value={formData.author}
              onChange={handleChange}
              placeholder="请输入作者名称"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="content">文章内容</label>
            <textarea
              id="content"
              name="content"
              value={formData.content}
              onChange={handleChange}
              placeholder="请输入文章内容..."
              className="form-textarea"
              rows="15"
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/')}
              disabled={loading}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? '保存中...' : (isEdit ? '更新文章' : '发布文章')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
