const express = require('express');
const cors = require('cors');
const { initDatabase, all, get, run } = require('./database');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

async function getArticleWithDetails(articleId) {
  const article = await get(`
    SELECT a.*, c.id as category_id, c.name as category_name
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.id = ?
  `, [parseInt(articleId)]);

  if (!article) return null;

  const tags = await all(`
    SELECT t.id, t.name
    FROM tags t
    INNER JOIN article_tags at ON t.id = at.tag_id
    WHERE at.article_id = ?
    ORDER BY t.name
  `, [parseInt(articleId)]);

  return {
    ...article,
    tags: tags
  };
}

async function getArticlesWithDetails(whereClause = '', params = []) {
  const articles = await all(`
    SELECT a.*, c.id as category_id, c.name as category_name
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    ${whereClause}
    ORDER BY a.created_at DESC
  `, params);

  for (const article of articles) {
    const tags = await all(`
      SELECT t.id, t.name
      FROM tags t
      INNER JOIN article_tags at ON t.id = at.tag_id
      WHERE at.article_id = ?
      ORDER BY t.name
    `, [article.id]);
    article.tags = tags;
  }

  return articles;
}

function highlightKeyword(text, keyword) {
  if (!text || !keyword) return text;
  
  const regex = new RegExp(`(${escapeRegExp(keyword)})`, 'gi');
  return text.replace(regex, '<mark class="search-highlight">$1</mark>');
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractKeywordFragment(text, keyword, maxLength = 150) {
  if (!text) return '';
  
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const keywordIndex = lowerText.indexOf(lowerKeyword);
  
  if (keywordIndex === -1) {
    return text.length > maxLength 
      ? text.substring(0, maxLength) + '...' 
      : text;
  }
  
  const halfLength = Math.floor(maxLength / 2);
  let start = Math.max(0, keywordIndex - halfLength);
  let end = Math.min(text.length, keywordIndex + keyword.length + halfLength);
  
  if (start > 0 && start < 20) {
    start = 0;
  }
  if (end < text.length && text.length - end < 20) {
    end = text.length;
  }
  
  let fragment = text.substring(start, end);
  
  if (start > 0) {
    fragment = '...' + fragment;
  }
  if (end < text.length) {
    fragment = fragment + '...';
  }
  
  return fragment;
}

function generateExcerpt(title, content, keyword, maxLength = 150) {
  const lowerTitle = title ? title.toLowerCase() : '';
  const lowerContent = content ? content.toLowerCase() : '';
  const lowerKeyword = keyword.toLowerCase();
  
  const titleHasKeyword = lowerTitle.includes(lowerKeyword);
  const contentHasKeyword = lowerContent.includes(lowerKeyword);
  
  if (titleHasKeyword && !contentHasKeyword) {
    return extractKeywordFragment(title, keyword, maxLength);
  }
  
  if (contentHasKeyword) {
    return extractKeywordFragment(content, keyword, maxLength);
  }
  
  if (title) {
    return title.length > maxLength 
      ? title.substring(0, maxLength) + '...' 
      : title;
  }
  
  return content ? (content.length > maxLength ? content.substring(0, maxLength) + '...' : content) : '';
}

app.get('/api/categories', async (req, res) => {
  try {
    const categories = await all(`
      SELECT c.*, COUNT(a.id) as article_count
      FROM categories c
      LEFT JOIN articles a ON c.id = a.category_id
      GROUP BY c.id
      ORDER BY c.name
    `);
    res.json(categories);
  } catch (error) {
    console.error('获取分类列表失败:', error);
    res.status(500).json({ error: '获取分类列表失败' });
  }
});

app.get('/api/tags', async (req, res) => {
  try {
    const tags = await all(`
      SELECT t.*, COUNT(at.article_id) as article_count
      FROM tags t
      LEFT JOIN article_tags at ON t.id = at.tag_id
      GROUP BY t.id
      ORDER BY t.name
    `);
    res.json(tags);
  } catch (error) {
    console.error('获取标签列表失败:', error);
    res.status(500).json({ error: '获取标签列表失败' });
  }
});

app.get('/api/articles', async (req, res) => {
  try {
    const { category, tag } = req.query;
    let whereClause = '';
    let params = [];

    if (category) {
      whereClause = 'WHERE c.id = ?';
      params = [parseInt(category)];
    } else if (tag) {
      whereClause = `
        INNER JOIN article_tags at ON a.id = at.article_id
        INNER JOIN tags t ON at.tag_id = t.id
        WHERE t.id = ?
      `;
      params = [parseInt(tag)];
    }

    const articles = await getArticlesWithDetails(whereClause, params);
    res.json(articles);
  } catch (error) {
    console.error('获取文章列表失败:', error);
    res.status(500).json({ error: '获取文章列表失败' });
  }
});

app.get('/api/articles/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || !q.trim()) {
      return res.status(400).json({ error: '搜索关键词不能为空' });
    }
    
    const keyword = q.trim();
    const likeKeyword = `%${keyword}%`;
    
    const articles = await all(`
      SELECT 
        a.*, 
        c.id as category_id, 
        c.name as category_name,
        (CASE 
          WHEN a.title LIKE ? THEN 3
          ELSE 0
        END +
        CASE 
          WHEN a.content LIKE ? THEN 1
          ELSE 0
        END) as match_score
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.title LIKE ? OR a.content LIKE ?
      ORDER BY match_score DESC, a.created_at DESC
    `, [likeKeyword, likeKeyword, likeKeyword, likeKeyword]);
    
    for (const article of articles) {
      const tags = await all(`
        SELECT t.id, t.name
        FROM tags t
        INNER JOIN article_tags at ON t.id = at.tag_id
        WHERE at.article_id = ?
        ORDER BY t.name
      `, [article.id]);
      article.tags = tags;
      
      article.title_highlighted = highlightKeyword(article.title, keyword);
      article.content_highlighted = highlightKeyword(article.content, keyword);
      article.excerpt = generateExcerpt(article.title, article.content, keyword, 150);
      article.excerpt_highlighted = highlightKeyword(article.excerpt, keyword);
    }
    
    res.json({
      keyword,
      total: articles.length,
      articles
    });
  } catch (error) {
    console.error('搜索文章失败:', error);
    res.status(500).json({ error: '搜索文章失败' });
  }
});

app.get('/api/articles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const article = await getArticleWithDetails(id);
    
    if (!article) {
      return res.status(404).json({ error: '文章不存在' });
    }
    
    res.json(article);
  } catch (error) {
    console.error('获取文章失败:', error);
    res.status(500).json({ error: '获取文章失败' });
  }
});

async function updateArticleTags(articleId, tagIds) {
  await run('DELETE FROM article_tags WHERE article_id = ?', [parseInt(articleId)]);
  
  if (tagIds && tagIds.length > 0) {
    const placeholders = tagIds.map(() => '(?, ?)').join(', ');
    const values = tagIds.flatMap(tagId => [parseInt(articleId), parseInt(tagId)]);
    await run(`INSERT INTO article_tags (article_id, tag_id) VALUES ${placeholders}`, values);
  }
}

async function getOrCreateTag(tagName) {
  const existingTag = await get('SELECT * FROM tags WHERE name = ?', [tagName.trim()]);
  if (existingTag) {
    return existingTag;
  }
  
  const result = await run('INSERT INTO tags (name) VALUES (?)', [tagName.trim()]);
  return await get('SELECT * FROM tags WHERE id = ?', [result.lastID]);
}

app.post('/api/articles', async (req, res) => {
  try {
    const { title, content, author, category_id, tags } = req.body;
    
    if (!title || !title.trim()) {
      return res.status(400).json({ error: '文章标题不能为空' });
    }
    
    if (!content || !content.trim()) {
      return res.status(400).json({ error: '文章内容不能为空' });
    }
    
    const result = await run(
      'INSERT INTO articles (title, content, author, category_id) VALUES (?, ?, ?, ?)',
      [
        title.trim(), 
        content.trim(), 
        author || '管理员',
        category_id ? parseInt(category_id) : null
      ]
    );

    const articleId = result.lastID;

    if (tags && tags.length > 0) {
      const tagIds = [];
      for (const tagItem of tags) {
        if (typeof tagItem === 'object' && tagItem.name) {
          const tag = await getOrCreateTag(tagItem.name);
          tagIds.push(tag.id);
        } else if (typeof tagItem === 'number') {
          tagIds.push(tagItem);
        } else if (typeof tagItem === 'string') {
          const tag = await getOrCreateTag(tagItem);
          tagIds.push(tag.id);
        }
      }
      await updateArticleTags(articleId, tagIds);
    }
    
    const newArticle = await getArticleWithDetails(articleId);
    res.status(201).json(newArticle);
  } catch (error) {
    console.error('创建文章失败:', error);
    res.status(500).json({ error: '创建文章失败' });
  }
});

app.put('/api/articles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, author, category_id, tags } = req.body;
    
    if (!title || !title.trim()) {
      return res.status(400).json({ error: '文章标题不能为空' });
    }
    
    if (!content || !content.trim()) {
      return res.status(400).json({ error: '文章内容不能为空' });
    }
    
    const exists = await get('SELECT * FROM articles WHERE id = ?', [parseInt(id)]);
    if (!exists) {
      return res.status(404).json({ error: '文章不存在' });
    }
    
    await run(
      'UPDATE articles SET title = ?, content = ?, author = ?, category_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [
        title.trim(), 
        content.trim(), 
        author || exists.author,
        category_id !== undefined ? (category_id ? parseInt(category_id) : null) : exists.category_id,
        parseInt(id)
      ]
    );

    if (tags !== undefined) {
      const tagIds = [];
      for (const tagItem of tags) {
        if (typeof tagItem === 'object' && tagItem.name) {
          const tag = await getOrCreateTag(tagItem.name);
          tagIds.push(tag.id);
        } else if (typeof tagItem === 'number') {
          tagIds.push(tagItem);
        } else if (typeof tagItem === 'string') {
          const tag = await getOrCreateTag(tagItem);
          tagIds.push(tag.id);
        }
      }
      await updateArticleTags(parseInt(id), tagIds);
    }
    
    const updatedArticle = await getArticleWithDetails(id);
    res.json(updatedArticle);
  } catch (error) {
    console.error('更新文章失败:', error);
    res.status(500).json({ error: '更新文章失败' });
  }
});

app.delete('/api/articles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const exists = await get('SELECT * FROM articles WHERE id = ?', [parseInt(id)]);
    if (!exists) {
      return res.status(404).json({ error: '文章不存在' });
    }
    
    await run('DELETE FROM articles WHERE id = ?', [parseInt(id)]);
    res.json({ message: '文章删除成功' });
  } catch (error) {
    console.error('删除文章失败:', error);
    res.status(500).json({ error: '删除文章失败' });
  }
});

app.get('/api/articles/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    
    const article = await get('SELECT * FROM articles WHERE id = ?', [parseInt(id)]);
    if (!article) {
      return res.status(404).json({ error: '文章不存在' });
    }
    
    const comments = await all(
      `SELECT c.*, p.nickname as parent_nickname 
       FROM comments c 
       LEFT JOIN comments p ON c.parent_id = p.id 
       WHERE c.article_id = ? 
       ORDER BY c.created_at DESC`,
      [parseInt(id)]
    );
    
    const parentComments = comments.filter(c => !c.parent_id);
    const childComments = comments.filter(c => c.parent_id);
    
    const nestedComments = parentComments.map(parent => ({
      ...parent,
      replies: childComments.filter(child => child.parent_id === parent.id)
    }));
    
    res.json(nestedComments);
  } catch (error) {
    console.error('获取评论列表失败:', error);
    res.status(500).json({ error: '获取评论列表失败' });
  }
});

app.post('/api/articles/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { nickname, content, parent_id } = req.body;
    
    const article = await get('SELECT * FROM articles WHERE id = ?', [parseInt(id)]);
    if (!article) {
      return res.status(404).json({ error: '文章不存在' });
    }
    
    if (!nickname || !nickname.trim()) {
      return res.status(400).json({ error: '昵称不能为空' });
    }
    
    if (!content || !content.trim()) {
      return res.status(400).json({ error: '评论内容不能为空' });
    }
    
    if (parent_id) {
      const parentComment = await get('SELECT * FROM comments WHERE id = ?', [parseInt(parent_id)]);
      if (!parentComment) {
        return res.status(404).json({ error: '父评论不存在' });
      }
      if (parentComment.parent_id) {
        return res.status(400).json({ error: '不支持多级嵌套回复' });
      }
    }
    
    const result = await run(
      'INSERT INTO comments (article_id, nickname, content, parent_id) VALUES (?, ?, ?, ?)',
      [parseInt(id), nickname.trim(), content.trim(), parent_id ? parseInt(parent_id) : null]
    );
    
    const newComment = await get(
      `SELECT c.*, p.nickname as parent_nickname 
       FROM comments c 
       LEFT JOIN comments p ON c.parent_id = p.id 
       WHERE c.id = ?`,
      [result.lastID]
    );
    
    res.status(201).json(newComment);
  } catch (error) {
    console.error('添加评论失败:', error);
    res.status(500).json({ error: '添加评论失败' });
  }
});

app.delete('/api/comments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const exists = await get('SELECT * FROM comments WHERE id = ?', [parseInt(id)]);
    if (!exists) {
      return res.status(404).json({ error: '评论不存在' });
    }
    
    await run('DELETE FROM comments WHERE id = ? OR parent_id = ?', [parseInt(id), parseInt(id)]);
    res.json({ message: '评论删除成功' });
  } catch (error) {
    console.error('删除评论失败:', error);
    res.status(500).json({ error: '删除评论失败' });
  }
});

app.get('/api/hot-searches', async (req, res) => {
  try {
    const articles = await all(`
      SELECT a.title, a.content, GROUP_CONCAT(t.name) as tags
      FROM articles a
      LEFT JOIN article_tags at ON a.id = at.article_id
      LEFT JOIN tags t ON at.tag_id = t.id
      GROUP BY a.id
    `);
    
    const keywordCounts = {};
    
    const techKeywords = [
      'JavaScript', 'React', 'Vue', 'Node.js', 'TypeScript', 'Python',
      'Java', '前端', '后端', '全栈', '数据库', 'MySQL', 'MongoDB',
      'Redis', 'Docker', 'Kubernetes', '微服务', 'API', 'REST',
      'GraphQL', '性能优化', '响应式', '编程', '算法', '数据结构',
      '设计模式', '测试', '敏捷开发', 'DevOps', 'CI/CD', 'Git',
      'Linux', 'Nginx', 'Webpack', 'Vite', 'ES6', 'CSS', 'HTML',
      '人工智能', '机器学习', '深度学习', '云计算', '大数据',
      '安全', '网络', '操作系统', '计算机原理', '软件工程'
    ];
    
    articles.forEach(article => {
      const content = `${article.title} ${article.content}`.toLowerCase();
      const tags = article.tags ? article.tags.split(',') : [];
      
      tags.forEach(tag => {
        const trimmedTag = tag.trim();
        if (trimmedTag) {
          keywordCounts[trimmedTag] = (keywordCounts[trimmedTag] || 0) + 3;
        }
      });
      
      techKeywords.forEach(keyword => {
        if (content.includes(keyword.toLowerCase())) {
          const count = keywordCounts[keyword] || 0;
          if (count === 0) {
            keywordCounts[keyword] = 1;
          }
        }
      });
    });
    
    const validKeywords = [];
    for (const [keyword, count] of Object.entries(keywordCounts)) {
      const likeKeyword = `%${keyword}%`;
      const result = await get(`
        SELECT COUNT(*) as cnt FROM articles 
        WHERE title LIKE ? OR content LIKE ?
      `, [likeKeyword, likeKeyword]);
      
      if (result && result.cnt > 0) {
        validKeywords.push({
          keyword,
          count: count + result.cnt * 2
        });
      }
    }
    
    validKeywords.sort((a, b) => b.count - a.count);
    const hotKeywords = validKeywords.slice(0, 8);
    
    if (hotKeywords.length === 0) {
      hotKeywords.push(
        { keyword: '博客', count: articles.length },
        { keyword: '技术', count: articles.length },
        { keyword: '文章', count: articles.length }
      );
    }
    
    res.json(hotKeywords);
  } catch (error) {
    console.error('获取热门搜索失败:', error);
    res.status(500).json({ error: '获取热门搜索失败' });
  }
});

app.get('/api/comments', async (req, res) => {
  try {
    const comments = await all(
      `SELECT c.*, a.title as article_title, p.nickname as parent_nickname 
       FROM comments c 
       LEFT JOIN articles a ON c.article_id = a.id 
       LEFT JOIN comments p ON c.parent_id = p.id 
       ORDER BY c.created_at DESC`
    );
    res.json(comments);
  } catch (error) {
    console.error('获取所有评论失败:', error);
    res.status(500).json({ error: '获取所有评论失败' });
  }
});

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`API 接口:`);
    console.log(`  GET    /api/categories            - 获取所有分类`);
    console.log(`  GET    /api/tags                  - 获取所有标签`);
    console.log(`  GET    /api/articles              - 获取文章列表(支持?category=id或?tag=id筛选)`);
    console.log(`  GET    /api/articles/search       - 搜索文章(支持?q=关键词)`);
    console.log(`  GET    /api/hot-searches          - 获取热门搜索词`);
    console.log(`  GET    /api/articles/:id          - 获取单篇文章(含分类和标签)`);
    console.log(`  POST   /api/articles              - 创建文章(支持category_id和tags)`);
    console.log(`  PUT    /api/articles/:id          - 更新文章(支持category_id和tags)`);
    console.log(`  DELETE /api/articles/:id          - 删除文章`);
    console.log(`  GET    /api/articles/:id/comments - 获取文章评论列表`);
    console.log(`  POST   /api/articles/:id/comments - 添加评论`);
    console.log(`  DELETE /api/comments/:id          - 删除评论`);
    console.log(`  GET    /api/comments              - 获取所有评论(管理)`);
  });
}).catch(error => {
  console.error('数据库初始化失败:', error);
  process.exit(1);
});
