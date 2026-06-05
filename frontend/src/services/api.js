const API_BASE = '/api';

async function handleError(response) {
  try {
    const data = await response.json();
    throw new Error(data.error || '请求失败');
  } catch (e) {
    if (e.message === '请求失败') {
      throw e;
    }
    throw new Error('网络请求失败');
  }
}

export async function getArticles() {
  const response = await fetch(`${API_BASE}/articles`);
  if (!response.ok) {
    await handleError(response);
  }
  return response.json();
}

export async function getArticle(id) {
  const response = await fetch(`${API_BASE}/articles/${id}`);
  if (!response.ok) {
    await handleError(response);
  }
  return response.json();
}

export async function createArticle(article) {
  const response = await fetch(`${API_BASE}/articles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(article),
  });
  if (!response.ok) {
    await handleError(response);
  }
  return response.json();
}

export async function updateArticle(id, article) {
  const response = await fetch(`${API_BASE}/articles/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(article),
  });
  if (!response.ok) {
    await handleError(response);
  }
  return response.json();
}

export async function deleteArticle(id) {
  const response = await fetch(`${API_BASE}/articles/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    await handleError(response);
  }
  return response.json();
}
