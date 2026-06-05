const API_BASE = '/api';

export async function getArticles() {
  const response = await fetch(`${API_BASE}/articles`);
  if (!response.ok) {
    throw new Error('Failed to fetch articles');
  }
  return response.json();
}

export async function getArticle(id) {
  const response = await fetch(`${API_BASE}/articles/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch article');
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
    throw new Error('Failed to create article');
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
    throw new Error('Failed to update article');
  }
  return response.json();
}

export async function deleteArticle(id) {
  const response = await fetch(`${API_BASE}/articles/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete article');
  }
  return response.json();
}
