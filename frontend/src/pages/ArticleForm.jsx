import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getArticle, createArticle, updateArticle, getCategories, getTags } from '../services/api';
import RichTextEditor from '../components/RichTextEditor';
import VersionHistory from '../components/VersionHistory';

function stripHtml(html) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

export default function ArticleForm({ isEdit = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const errorRef = useRef(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    author: '管理员',
    category_id: '',
    tags: [],
    status: 'published',
  });
  const [categories, setCategories] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadFormData();
  }, [isEdit, id]);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [error]);

  async function loadFormData() {
    try {
      setFetchLoading(true);
      const [categoriesData, tagsData] = await Promise.all([
        getCategories(),
        getTags()
      ]);
      setCategories(categoriesData);
      setAllTags(tagsData);
      setDataLoaded(true);

      if (isEdit && id) {
        setFetchFailed(false);
        const data = await getArticle(id);
        setFormData({
          title: data.title,
          content: data.content,
          author: data.author,
          category_id: data.category_id || '',
          tags: data.tags || [],
          status: data.status || 'published',
        });
      }
    } catch (err) {
      setError(err.message || '加载数据失败');
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

  function handleContentChange(value) {
    setFormData(prev => ({
      ...prev,
      content: value,
    }));
  }

  function handleTagInputChange(e) {
    const value = e.target.value;
    setNewTagInput(value);
    
    if (value.trim()) {
      const filtered = allTags.filter(
        tag => 
          tag.name.toLowerCase().includes(value.toLowerCase()) &&
          !formData.tags.some(t => t.id === tag.id)
      );
      setTagSuggestions(filtered);
      setShowTagSuggestions(true);
    } else {
      setTagSuggestions([]);
      setShowTagSuggestions(false);
    }
  }

  function addTag(tag) {
    if (!formData.tags.some(t => t.id === tag.id)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
    }
    setNewTagInput('');
    setTagSuggestions([]);
    setShowTagSuggestions(false);
  }

  function removeTag(tagId) {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t.id !== tagId)
    }));
  }

  function createNewTag() {
    const tagName = newTagInput.trim();
    if (!tagName) return;
    
    const existingTag = allTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
    if (existingTag) {
      addTag(existingTag);
      return;
    }
    
    const newTag = { id: Date.now(), name: tagName, isNew: true };
    if (!formData.tags.some(t => t.name.toLowerCase() === tagName.toLowerCase())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag]
      }));
    }
    setNewTagInput('');
    setTagSuggestions([]);
    setShowTagSuggestions(false);
  }

  function handleTagKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      createNewTag();
    }
  }

  function handleTagInputBlur() {
    setTimeout(() => {
      setShowTagSuggestions(false);
    }, 200);
  }

  async function handleSave(status) {
    if (!formData.title.trim()) {
      setError('文章标题不能为空');
      return;
    }
    
    if (status === 'published') {
      const plainContent = stripHtml(formData.content);
      if (!plainContent.trim()) {
        setError('文章内容不能为空');
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);
      
      const submitData = {
        title: formData.title,
        content: formData.content,
        author: formData.author,
        category_id: formData.category_id || null,
        tags: formData.tags.map(tag => tag.isNew ? { name: tag.name } : tag.id),
        status: status
      };
      
      let result;
      if (isEdit) {
        result = await updateArticle(id, submitData);
      } else {
        result = await createArticle(submitData);
      }
      
      if (status === 'published') {
        navigate('/admin');
      } else {
        if (!isEdit && result && result.id) {
          navigate(`/edit/${result.id}`);
        } else {
          setFormData(prev => ({ ...prev, status: 'draft' }));
        }
      }
    } catch (err) {
      setError(err.message || '保存失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await handleSave('published');
  }

  async function handleSaveDraft() {
    await handleSave('draft');
  }

  function handleRestoreVersion(restoredArticle) {
    if (restoredArticle) {
      setFormData({
        title: restoredArticle.title,
        content: restoredArticle.content,
        author: restoredArticle.author,
        category_id: restoredArticle.category_id || '',
        tags: restoredArticle.tags || [],
        status: restoredArticle.status || 'published',
      });
    }
  }

  if (fetchLoading) {
    return (
      <div className="container">
        <div className="loading">加载中...</div>
      </div>
    );
  }

  if (fetchFailed && !dataLoaded) {
    return (
      <div className="container">
        <div className="error" ref={errorRef}>
          {error || '加载数据失败'}
        </div>
        <Link to="/admin" className="back-link">← 返回管理</Link>
      </div>
    );
  }

  if (!dataLoaded) {
    return null;
  }

  return (
    <div className="container">
      <div className="form-container">
        <div className="form-header">
          <h1>
            {isEdit ? (formData.status === 'draft' ? '编辑草稿' : '编辑文章') : '创建新文章'}
            {formData.status === 'draft' && <span className="badge badge-secondary" style={{ marginLeft: '10px' }}>草稿</span>}
          </h1>
          <Link to="/admin" className="back-link">← 返回管理</Link>
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

          <div className="form-row">
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
              <label htmlFor="category_id">文章分类</label>
              <select
                id="category_id"
                name="category_id"
                value={formData.category_id}
                onChange={handleChange}
                className="form-input"
              >
                <option value="">请选择分类</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>文章标签</label>
            <div className="tags-input-container">
              <div className="selected-tags">
                {formData.tags.map(tag => (
                  <span key={tag.id} className="selected-tag">
                    {tag.name}
                    <button
                      type="button"
                      className="remove-tag"
                      onClick={() => removeTag(tag.id)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="tag-input-wrapper">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={handleTagInputChange}
                  onKeyDown={handleTagKeyDown}
                  onBlur={handleTagInputBlur}
                  onFocus={() => newTagInput && setShowTagSuggestions(true)}
                  placeholder="输入标签，按回车添加"
                  className="form-input tag-input"
                />
                {showTagSuggestions && tagSuggestions.length > 0 && (
                  <div className="tag-suggestions">
                    {tagSuggestions.map(tag => (
                      <div
                        key={tag.id}
                        className="tag-suggestion-item"
                        onClick={() => addTag(tag)}
                      >
                        {tag.name}
                        <span className="tag-count">({tag.article_count})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <small className="form-hint">
              点击下拉选择已有标签，或输入新标签后按回车创建
            </small>
          </div>

          <div className="form-group">
            <label>文章内容</label>
            <RichTextEditor
              value={formData.content}
              onChange={handleContentChange}
              placeholder="请输入文章内容..."
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/admin')}
              disabled={loading}
            >
              取消
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleSaveDraft}
              disabled={loading}
            >
              {loading ? '保存中...' : '保存草稿'}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? '保存中...' : (isEdit && formData.status === 'draft' ? '发布文章' : (isEdit ? '更新并发布' : '发布文章'))}
            </button>
          </div>
        </form>

        {isEdit && id && (
          <VersionHistory
            articleId={id}
            onRestore={handleRestoreVersion}
          />
        )}
      </div>
    </div>
  );
}
