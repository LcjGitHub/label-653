const API_BASE = '/api';
const USER_ID_KEY = 'blog_user_identifier';

function getOrCreateUserId() {
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    const randomStr = Math.random().toString(36).substring(2, 15) + 
                      Math.random().toString(36).substring(2, 15);
    userId = `user_${Date.now()}_${randomStr}`;
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}

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
    const headers = options.headers || {};
    const userId = getOrCreateUserId();
    headers['x-user-id'] = userId;
    
    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers,
    });
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
  if (filters.sort) params.append('sort', filters.sort);
  if (filters.page) params.append('page', filters.page);
  if (filters.pageSize) params.append('pageSize', filters.pageSize);
  
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

export async function searchArticles(keyword, options = {}) {
  const params = new URLSearchParams();
  params.append('q', keyword);
  return request(`/articles/search?${params.toString()}`, options);
}

export async function getHotSearches() {
  return request('/hot-searches');
}

export async function likeArticle(articleId) {
  return request(`/articles/${articleId}/like`, {
    method: 'POST',
  });
}

export async function unlikeArticle(articleId) {
  return request(`/articles/${articleId}/like`, {
    method: 'DELETE',
  });
}

export async function favoriteArticle(articleId) {
  return request(`/articles/${articleId}/favorite`, {
    method: 'POST',
  });
}

export async function unfavoriteArticle(articleId) {
  return request(`/articles/${articleId}/favorite`, {
    method: 'DELETE',
  });
}

export async function getArticleLikes(articleId) {
  return request(`/articles/${articleId}/likes`);
}

export async function getArticleFavorites(articleId) {
  return request(`/articles/${articleId}/favorites`);
}

export async function getArticleStats() {
  return request('/articles/stats');
}
