const API_BASE = '/api';
const TOKEN_KEY = 'blog_token';
const USER_KEY = 'blog_user';
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

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getCurrentUser() {
  const userStr = localStorage.getItem(USER_KEY);
  return userStr ? JSON.parse(userStr) : null;
}

export function setCurrentUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function removeCurrentUser() {
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated() {
  return !!getToken();
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
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      const userId = getOrCreateUserId();
      headers['x-user-id'] = userId;
    }
    
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

export async function register(data) {
  return request('/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

export async function login(data) {
  return request('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

export async function logout() {
  return request('/auth/logout', {
    method: 'POST',
  });
}

export async function getMe() {
  return request('/auth/me');
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

export async function getDrafts(filters = {}) {
  const params = new URLSearchParams();
  if (filters.sort) params.append('sort', filters.sort);
  if (filters.page) params.append('page', filters.page);
  if (filters.pageSize) params.append('pageSize', filters.pageSize);
  
  const queryString = params.toString();
  return request(`/articles/drafts/list${queryString ? `?${queryString}` : ''}`);
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
  if (options.page) params.append('page', options.page);
  if (options.pageSize) params.append('pageSize', options.pageSize);
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

export async function pinArticle(articleId, pinned) {
  return request(`/articles/${articleId}/pin`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pinned }),
  });
}

export async function exportArticle(articleId, format = 'markdown') {
  const token = getToken();
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    const userId = getOrCreateUserId();
    headers['x-user-id'] = userId;
  }
  const response = await fetch(`${API_BASE}/articles/${articleId}/export?format=${format}`, {
    headers
  });
  if (!response.ok) {
    await handleError(response);
  }
  return response;
}

export async function exportArticlesBatch(ids, format = 'markdown') {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    const userId = getOrCreateUserId();
    headers['x-user-id'] = userId;
  }
  const response = await fetch(`${API_BASE}/articles/export/batch`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ids, format })
  });
  if (!response.ok) {
    await handleError(response);
  }
  return response;
}

export async function getShareLink(articleId) {
  return request(`/articles/${articleId}/share`);
}

export function downloadFromResponse(response, filename) {
  return response.blob().then(blob => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    if (filename) {
      a.download = filename;
    } else {
      const contentDisposition = response.headers.get('Content-Disposition');
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          a.download = decodeURIComponent(match[1]);
        }
      }
    }
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  });
}

export async function getArticleVersions(articleId, options = {}) {
  const params = new URLSearchParams();
  if (options.page) params.append('page', options.page);
  if (options.pageSize) params.append('pageSize', options.pageSize);
  const queryString = params.toString();
  return request(`/articles/${articleId}/versions${queryString ? `?${queryString}` : ''}`);
}

export async function getArticleVersion(articleId, versionId) {
  return request(`/articles/${articleId}/versions/${versionId}`);
}

export async function restoreArticleVersion(articleId, versionId) {
  return request(`/articles/${articleId}/versions/${versionId}/restore`, {
    method: 'POST',
  });
}

export async function deleteArticleVersion(articleId, versionId) {
  return request(`/articles/${articleId}/versions/${versionId}`, {
    method: 'DELETE',
  });
}

export async function getNotifications(options = {}) {
  const params = new URLSearchParams();
  if (options.page) params.append('page', options.page);
  if (options.pageSize) params.append('pageSize', options.pageSize);
  if (options.unread_only) params.append('unread_only', options.unread_only);
  const queryString = params.toString();
  return request(`/notifications${queryString ? `?${queryString}` : ''}`);
}

export async function getUnreadNotificationCount() {
  return request('/notifications/unread-count');
}

export async function markNotificationRead(id) {
  return request(`/notifications/${id}/read`, {
    method: 'PUT',
  });
}

export async function markAllNotificationsRead() {
  return request('/notifications/read-all', {
    method: 'PUT',
  });
}

export async function deleteNotification(id) {
  return request(`/notifications/${id}`, {
    method: 'DELETE',
  });
}
