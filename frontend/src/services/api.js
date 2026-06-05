const API_BASE = '/api';

async function handleError(response) {
  try {
    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }
    throw new Error('请求失败');
  } catch (e) {
    if (e instanceof SyntaxError || !e.message) {
      throw new Error('网络请求失败');
    }
    throw e;
  }
}

async function request(url, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${url}`, options);
    if (!response.ok) {
      await handleError(response);
    }
    return response.json();
  } catch (e) {
    if (e.message === 'Failed to fetch' || e.message.includes('Network')) {
      throw new Error('网络请求失败');
    }
    throw e;
  }
}

export async function getCategories() {
  return request('/categories');
}

export async function getTags() {
  return request('/tags');
}

export async function getArticles(filters = {}) {
  const params = new URLSearchParams();
  if (filters.category) params.append('category', filters.category);
  if (filters.tag) params.append('tag', filters.tag);
  
  const queryString = params.toString();
  return request(`/articles${queryString ? `?${queryString}` : ''}`);
}

export async function getArticle(id) {
  return request(`/articles/${id}`);
}

export async function createArticle(article) {
  return request('/articles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(article),
  });
}

export async function updateArticle(id, article) {
  return request(`/articles/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(article),
  });
}

export async function deleteArticle(id) {
  return request(`/articles/${id}`, {
    method: 'DELETE',
  });
}

export async function getComments(articleId) {
  return request(`/articles/${articleId}/comments`);
}

export async function createComment(articleId, comment) {
  return request(`/articles/${articleId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(comment),
  });
}

export async function deleteComment(id) {
  return request(`/comments/${id}`, {
    method: 'DELETE',
  });
}

export async function getAllComments() {
  return request('/comments');
}

export async function searchArticles(keyword) {
  const params = new URLSearchParams();
  params.append('q', keyword);
  return request(`/articles/search?${params.toString()}`);
}

export async function getHotSearches() {
  return request('/hot-searches');
}
