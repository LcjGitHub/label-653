require('dotenv').config();
const express = require('express');
const cors = require('cors');
const TurndownService = require('turndown');
const PDFDocument = require('pdfkit');
const archiver = require('archiver');
const { initDatabase, all, get, run } = require('./database');
const {
  hashPassword,
  comparePassword,
  generateToken,
  authMiddleware,
  requireAuth,
  blacklistToken,
  TOKEN_TYPE
} = require('./auth');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());
app.use(authMiddleware);

function getUserIdentifier(req) {
  if (req.user) {
    return `user_${req.user.id}`;
  }
  const userId = req.headers['x-user-id'];
  if (userId) {
    return userId;
  }
  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || '';
  return `guest_${ip}_${userAgent}`.replace(/[^a-zA-Z0-9_]/g, '_');
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection.remoteAddress || 'unknown';
}

function parseTags(tagIdsStr, tagNamesStr) {
  if (!tagIdsStr || !tagNamesStr) return [];
  const ids = tagIdsStr.split(',');
  const names = tagNamesStr.split(',');
  const tags = [];
  for (let i = 0; i < ids.length && i < names.length; i++) {
    if (ids[i] && names[i]) {
      tags.push({ id: parseInt(ids[i]), name: names[i] });
    }
  }
  return tags;
}

async function getArticleLikeCount(articleId) {
  const result = await get('SELECT COUNT(*) as count FROM likes WHERE article_id = ?', [parseInt(articleId)]);
  return result ? result.count : 0;
}

async function getArticleFavoriteCount(articleId) {
  const result = await get('SELECT COUNT(*) as count FROM favorites WHERE article_id = ?', [parseInt(articleId)]);
  return result ? result.count : 0;
}

async function findUserIdByAuthorName(authorName) {
  if (!authorName) return null;
  const user = await get(
    'SELECT id FROM users WHERE username = ? OR nickname = ? LIMIT 1',
    [authorName, authorName]
  );
  return user ? user.id : null;
}

async function createNotification({ userId, type, articleId = null, commentId = null, fromUserId = null, fromUserName = null, content = null }) {
  if (!userId) return null;
  try {
    const result = await run(
      `INSERT INTO notifications (user_id, type, article_id, comment_id, from_user_id, from_user_name, content) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, type, articleId, commentId, fromUserId, fromUserName, content]
    );
    return result.lastID;
  } catch (err) {
    console.error('创建通知失败:', err);
    return null;
  }
}

async function hasUserLiked(articleId, userIdentifier) {
  const result = await get('SELECT 1 FROM likes WHERE article_id = ? AND user_identifier = ?', [parseInt(articleId), userIdentifier]);
  return !!result;
}

async function hasUserFavorited(articleId, userIdentifier) {
  const result = await get('SELECT 1 FROM favorites WHERE article_id = ? AND user_identifier = ?', [parseInt(articleId), userIdentifier]);
  return !!result;
}

async function getArticleWithDetails(articleId) {
  const article = await get(`
    SELECT 
      a.*, 
      c.id as category_id, 
      c.name as category_name,
      COALESCE(l.like_count, 0) as like_count,
      COALESCE(f.favorite_count, 0) as favorite_count,
      (SELECT GROUP_CONCAT(t.id) FROM tags t INNER JOIN article_tags at ON t.id = at.tag_id WHERE at.article_id = a.id ORDER BY t.name) as tag_ids,
      (SELECT GROUP_CONCAT(t.name) FROM tags t INNER JOIN article_tags at ON t.id = at.tag_id WHERE at.article_id = a.id ORDER BY t.name) as tag_names
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    LEFT JOIN (
      SELECT article_id, COUNT(*) as like_count 
      FROM likes 
      GROUP BY article_id
    ) l ON a.id = l.article_id
    LEFT JOIN (
      SELECT article_id, COUNT(*) as favorite_count 
      FROM favorites 
      GROUP BY article_id
    ) f ON a.id = f.article_id
    WHERE a.id = ?
  `, [parseInt(articleId)]);

  if (!article) return null;

  const tags = parseTags(article.tag_ids, article.tag_names);
  delete article.tag_ids;
  delete article.tag_names;

  return {
    ...article,
    tags: tags
  };
}

const SORT_OPTIONS = {
  'created_desc': 'a.is_pinned DESC, a.pinned_at DESC, a.created_at DESC',
  'created_asc': 'a.is_pinned DESC, a.pinned_at DESC, a.created_at ASC',
  'updated_desc': 'a.is_pinned DESC, a.pinned_at DESC, a.updated_at DESC',
  'updated_asc': 'a.is_pinned DESC, a.pinned_at DESC, a.updated_at ASC',
  'likes_desc': 'a.is_pinned DESC, a.pinned_at DESC, like_count DESC',
  'likes_asc': 'a.is_pinned DESC, a.pinned_at DESC, like_count ASC'
};

async function getArticlesWithDetails(whereClause = '', params = [], sort = 'created_desc', page = 1, pageSize = 10) {
  const orderBy = SORT_OPTIONS[sort] || SORT_OPTIONS['created_desc'];

  const countParams = [...params];
  const countSql = `
    SELECT COUNT(DISTINCT a.id) as total
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    ${whereClause}
  `;
  const countResult = await get(countSql, countParams);
  const total = countResult ? countResult.total : 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const validatedPage = Math.min(Math.max(1, page), totalPages);
  const offset = (validatedPage - 1) * pageSize;

  const dataSql = `
    SELECT 
      a.*, 
      c.id as category_id, 
      c.name as category_name,
      COALESCE(l.like_count, 0) as like_count,
      COALESCE(f.favorite_count, 0) as favorite_count,
      (SELECT GROUP_CONCAT(t.id) FROM tags t INNER JOIN article_tags at ON t.id = at.tag_id WHERE at.article_id = a.id ORDER BY t.name) as tag_ids,
      (SELECT GROUP_CONCAT(t.name) FROM tags t INNER JOIN article_tags at ON t.id = at.tag_id WHERE at.article_id = a.id ORDER BY t.name) as tag_names
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    LEFT JOIN (
      SELECT article_id, COUNT(*) as like_count 
      FROM likes 
      GROUP BY article_id
    ) l ON a.id = l.article_id
    LEFT JOIN (
      SELECT article_id, COUNT(*) as favorite_count 
      FROM favorites 
      GROUP BY article_id
    ) f ON a.id = f.article_id
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `;

  const dataParams = [...params, pageSize, offset];
  const articles = await all(dataSql, dataParams);

  for (const article of articles) {
    article.tags = parseTags(article.tag_ids, article.tag_names);
    delete article.tag_ids;
    delete article.tag_names;
  }

  return {
    articles,
    total,
    page: validatedPage,
    pageSize,
    totalPages
  };
}

const BLOCK_ELEMENTS = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'ul', 'ol', 'li', 'table', 'tr', 'br', 'hr'];

function stripHtml(html) {
  if (!html) return '';
  
  let result = html;
  
  BLOCK_ELEMENTS.forEach(tag => {
    const openRegex = new RegExp(`<${tag}[^>]*>`, 'gi');
    const closeRegex = new RegExp(`</${tag}>`, 'gi');
    result = result.replace(openRegex, '\n');
    result = result.replace(closeRegex, '\n');
  });
  
  result = result
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .replace(/\n /g, '\n')
    .replace(/ \n/g, '\n')
    .trim();
  
  return result;
}

function sanitizeHtml(html) {
  if (!html) return '';
  
  let result = html;
  
  result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  result = result.replace(/<script[^>]*>/gi, '');
  result = result.replace(/<\/script>/gi, '');
  
  result = result.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  result = result.replace(/<iframe[^>]*>/gi, '');
  result = result.replace(/<\/iframe>/gi, '');
  
  result = result.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
  result = result.replace(/<embed[^>]*>/gi, '');
  
  result = result.replace(/\son\w+\s*=\s*"[^"]*"/gi, '');
  result = result.replace(/\son\w+\s*=\s*'[^']*'/gi, '');
  result = result.replace(/\son\w+\s*=\s*[^\s>]+/gi, '');
  
  result = result.replace(/\sjavascript\s*:/gi, '');
  result = result.replace(/\sdata\s*:/gi, '');
  result = result.replace(/\svbscript\s*:/gi, '');
  
  result = result.replace(/href\s*=\s*"javascript:[^"]*"/gi, 'href="#"');
  result = result.replace(/href\s*=\s*'javascript:[^']*'/gi, "href='#'");
  
  return result;
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
  const plainText = stripHtml(text);
  if (!plainText) return '';
  
  const lowerText = plainText.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const keywordIndex = lowerText.indexOf(lowerKeyword);
  
  if (keywordIndex === -1) {
    return plainText.length > maxLength 
      ? plainText.substring(0, maxLength) + '...' 
      : plainText;
  }
  
  const halfLength = Math.floor(maxLength / 2);
  let start = Math.max(0, keywordIndex - halfLength);
  let end = Math.min(plainText.length, keywordIndex + keyword.length + halfLength);
  
  if (start > 0 && start < 20) {
    start = 0;
  }
  if (end < plainText.length && plainText.length - end < 20) {
    end = plainText.length;
  }
  
  let fragment = plainText.substring(start, end);
  
  if (start > 0) {
    fragment = '...' + fragment;
  }
  if (end < plainText.length) {
    fragment = fragment + '...';
  }
  
  return fragment;
}

function generateExcerpt(title, content, keyword, maxLength = 150) {
  const plainTitle = title || '';
  const plainContent = stripHtml(content);
  const lowerTitle = plainTitle.toLowerCase();
  const lowerContent = plainContent.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  
  const titleHasKeyword = lowerTitle.includes(lowerKeyword);
  const contentHasKeyword = lowerContent.includes(lowerKeyword);
  
  if (titleHasKeyword && !contentHasKeyword) {
    return extractKeywordFragment(plainTitle, keyword, maxLength);
  }
  
  if (contentHasKeyword) {
    return extractKeywordFragment(plainContent, keyword, maxLength);
  }
  
  if (plainTitle) {
    return plainTitle.length > maxLength 
      ? plainTitle.substring(0, maxLength) + '...' 
      : plainTitle;
  }
  
  return plainContent ? (plainContent.length > maxLength ? plainContent.substring(0, maxLength) + '...' : plainContent) : '';
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, nickname, email } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ error: '用户名不能为空' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: '密码长度至少为 6 位' });
    }

    const existingUser = await get('SELECT id FROM users WHERE username = ?', [username.trim()]);
    if (existingUser) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    const hashedPassword = await hashPassword(password);
    const result = await run(
      'INSERT INTO users (username, password, nickname, email) VALUES (?, ?, ?, ?)',
      [username.trim(), hashedPassword, nickname ? nickname.trim() : null, email ? email.trim() : null]
    );

    const user = await get(
      'SELECT id, username, nickname, email, created_at FROM users WHERE id = ?',
      [result.lastID]
    );
    const token = generateToken(user);

    res.status(201).json({
      message: '注册成功',
      token,
      token_type: TOKEN_TYPE,
      user
    });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({ error: '注册失败' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const user = await get('SELECT * FROM users WHERE username = ?', [username.trim()]);
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const safeUser = {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      email: user.email,
      created_at: user.created_at
    };
    const token = generateToken(safeUser);

    res.json({
      message: '登录成功',
      token,
      token_type: TOKEN_TYPE,
      user: safeUser
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
  try {
    if (req.token) {
      await blacklistToken(req.token, req.user.id);
    }
    res.json({ message: '登出成功' });
  } catch (error) {
    console.error('登出失败:', error);
    res.status(500).json({ error: '登出失败' });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: '未登录' });
    }
    res.json({ user: req.user });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const categories = await all(`
      SELECT c.*, COUNT(a.id) as article_count
      FROM categories c
      LEFT JOIN articles a ON c.id = a.category_id AND a.status = 'published'
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
      LEFT JOIN articles a ON at.article_id = a.id AND a.status = 'published'
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
    const { category, tag, sort, page, pageSize } = req.query;

    let whereClause = 'WHERE a.status = ?';
    let params = ['published'];

    if (category) {
      whereClause = 'WHERE a.status = ? AND c.id = ?';
      params = ['published', parseInt(category)];
    } else if (tag) {
      whereClause = `
        INNER JOIN article_tags at ON a.id = at.article_id
        INNER JOIN tags t ON at.tag_id = t.id
        WHERE a.status = ? AND t.id = ?
      `;
      params = ['published', parseInt(tag)];
    }

    const sortValue = sort || 'created_desc';
    const pageValue = Math.max(1, parseInt(page) || 1);
    const pageSizeValue = Math.min(100, Math.max(1, parseInt(pageSize) || 10));

    const result = await getArticlesWithDetails(whereClause, params, sortValue, pageValue, pageSizeValue);
    res.json(result);
  } catch (error) {
    console.error('获取文章列表失败:', error);
    res.status(500).json({ error: '获取文章列表失败' });
  }
});

app.get('/api/articles/drafts/list', async (req, res) => {
  try {
    const { sort, page, pageSize } = req.query;

    const whereClause = 'WHERE a.status = ?';
    const params = ['draft'];

    const sortValue = sort || 'updated_desc';
    const pageValue = Math.max(1, parseInt(page) || 1);
    const pageSizeValue = Math.min(100, Math.max(1, parseInt(pageSize) || 10));

    const result = await getArticlesWithDetails(whereClause, params, sortValue, pageValue, pageSizeValue);
    res.json(result);
  } catch (error) {
    console.error('获取草稿列表失败:', error);
    res.status(500).json({ error: '获取草稿列表失败' });
  }
});

app.get('/api/articles/search', async (req, res) => {
  try {
    const { q, page, pageSize } = req.query;
    
    if (!q || !q.trim()) {
      return res.status(400).json({ error: '搜索关键词不能为空' });
    }
    
    const keyword = q.trim();
    const likeKeyword = `%${keyword}%`;
    const pageValue = Math.max(1, parseInt(page) || 1);
    const pageSizeValue = Math.min(100, Math.max(1, parseInt(pageSize) || 10));

    const countResult = await get(`
      SELECT COUNT(*) as total
      FROM articles a
      WHERE a.status = ? AND (a.title LIKE ? OR a.content LIKE ?)
    `, ['published', likeKeyword, likeKeyword]);
    const total = countResult ? countResult.total : 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSizeValue));
    const validatedPage = Math.min(pageValue, totalPages);
    const offset = (validatedPage - 1) * pageSizeValue;
    
    const articles = await all(`
      SELECT 
        a.*, 
        c.id as category_id, 
        c.name as category_name,
        COALESCE(l.like_count, 0) as like_count,
        COALESCE(f.favorite_count, 0) as favorite_count,
        (SELECT GROUP_CONCAT(t.id) FROM tags t INNER JOIN article_tags at ON t.id = at.tag_id WHERE at.article_id = a.id ORDER BY t.name) as tag_ids,
        (SELECT GROUP_CONCAT(t.name) FROM tags t INNER JOIN article_tags at ON t.id = at.tag_id WHERE at.article_id = a.id ORDER BY t.name) as tag_names,
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
      LEFT JOIN (
        SELECT article_id, COUNT(*) as like_count 
        FROM likes 
        GROUP BY article_id
      ) l ON a.id = l.article_id
      LEFT JOIN (
        SELECT article_id, COUNT(*) as favorite_count 
        FROM favorites 
        GROUP BY article_id
      ) f ON a.id = f.article_id
      WHERE a.status = ? AND (a.title LIKE ? OR a.content LIKE ?)
      ORDER BY a.is_pinned DESC, a.pinned_at DESC, match_score DESC, a.created_at DESC
      LIMIT ? OFFSET ?
    `, [likeKeyword, likeKeyword, 'published', likeKeyword, likeKeyword, pageSizeValue, offset]);
    
    for (const article of articles) {
      article.tags = parseTags(article.tag_ids, article.tag_names);
      delete article.tag_ids;
      delete article.tag_names;
      
      const plainContent = stripHtml(article.content);
      article.title_highlighted = highlightKeyword(article.title, keyword);
      article.content_highlighted = highlightKeyword(plainContent, keyword);
      article.excerpt = generateExcerpt(article.title, article.content, keyword, 150);
      article.excerpt_highlighted = highlightKeyword(article.excerpt, keyword);
    }
    
    res.json({
      keyword,
      total,
      page: validatedPage,
      pageSize: pageSizeValue,
      totalPages,
      articles
    });
  } catch (error) {
    console.error('搜索文章失败:', error);
    res.status(500).json({ error: '搜索文章失败' });
  }
});

const fs = require('fs');
const path = require('path');
const { PassThrough } = require('stream');

const CHINESE_FONT_PATHS = [
  'C:\\Windows\\Fonts\\simhei.ttf',
  'C:\\Windows\\Fonts\\simsun.ttc',
  'C:\\Windows\\Fonts\\msyh.ttc',
  '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
  '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
  '/System/Library/Fonts/PingFang.ttc',
  '/System/Library/Fonts/STHeiti Medium.ttc'
];

let CHINESE_FONT_PATH = null;
for (const fontPath of CHINESE_FONT_PATHS) {
  try {
    if (fs.existsSync(fontPath)) {
      CHINESE_FONT_PATH = fontPath;
      break;
    }
  } catch (e) {
    continue;
  }
}

function htmlToMarkdown(html) {
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-'
  });
  return turndownService.turndown(html || '');
}

function articleToMarkdown(article) {
  const tags = (article.tags || []).map(t => `#${t.name}`).join(' ');
  const createdAt = new Date(article.created_at).toLocaleString('zh-CN');
  const updatedAt = new Date(article.updated_at).toLocaleString('zh-CN');
  
  let md = `# ${article.title}\n\n`;
  md += `> 作者: ${article.author}\n`;
  md += `> 发布时间: ${createdAt}\n`;
  if (article.updated_at !== article.created_at) {
    md += `> 更新时间: ${updatedAt}\n`;
  }
  if (article.category_name) {
    md += `> 分类: ${article.category_name}\n`;
  }
  if (tags) {
    md += `> 标签: ${tags}\n`;
  }
  md += '\n---\n\n';
  md += htmlToMarkdown(article.content);
  return md;
}

function htmlToTextWithFormatting(html) {
  if (!html) return '';
  
  let text = html;
  
  text = text.replace(/<\/(h[1-6]|p|div|li|tr|blockquote)>/gi, '\n\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '• ');
  text = text.replace(/<(h[1-6])[^>]*>(.*?)<\/\1>/gi, function(match, tag, content) {
    const level = parseInt(tag.charAt(1));
    const prefix = '#'.repeat(level) + ' ';
    return '\n\n' + prefix + stripHtml(content) + '\n\n';
  });
  text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, function(match, content) {
    return '`' + stripHtml(content) + '`';
  });
  text = text.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, function(match, content) {
    return '\n\n' + stripHtml(content).split('\n').map(l => '    ' + l).join('\n') + '\n\n';
  });
  text = text.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, function(match, content) {
    return '【' + stripHtml(content) + '】';
  });
  text = text.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, function(match, content) {
    return '【' + stripHtml(content) + '】';
  });
  text = text.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, function(match, content) {
    return '《' + stripHtml(content) + '》';
  });
  text = text.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, function(match, content) {
    return '《' + stripHtml(content) + '》';
  });
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/&amp;/gi, '&');
  text = text.replace(/&lt;/gi, '<');
  text = text.replace(/&gt;/gi, '>');
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#39;/gi, "'");
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/[ \t]+/g, ' ');
  text = text.trim();
  
  return text;
}

function generateArticlePdfBuffer(article) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });
      
      if (CHINESE_FONT_PATH) {
        try {
          doc.registerFont('chinese', CHINESE_FONT_PATH);
          doc.font('chinese');
        } catch (e) {
          console.warn('注册中文字体失败，使用默认字体:', e.message);
        }
      }
      
      const chunks = [];
      const bufferStream = new PassThrough();
      bufferStream.on('data', (chunk) => chunks.push(chunk));
      bufferStream.on('end', () => resolve(Buffer.concat(chunks)));
      bufferStream.on('error', reject);
      
      doc.pipe(bufferStream);
      
      doc.fontSize(24).text(article.title || '无标题', { align: 'center' });
      doc.moveDown(1);
      
      doc.fontSize(10).fillColor('#666666');
      doc.text(`作者: ${article.author || '匿名'}`, { align: 'center' });
      doc.text(`发布时间: ${new Date(article.created_at).toLocaleString('zh-CN')}`, { align: 'center' });
      if (article.category_name) {
        doc.text(`分类: ${article.category_name}`, { align: 'center' });
      }
      if (article.tags && article.tags.length > 0) {
        doc.text(`标签: ${article.tags.map(t => t.name).join(', ')}`, { align: 'center' });
      }
      doc.moveDown(1);
      
      doc.strokeColor('#cccccc').lineWidth(1);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);
      
      doc.fillColor('#333333').fontSize(12);
      const formattedText = htmlToTextWithFormatting(article.content);
      
      const paragraphs = formattedText.split(/\n\n+/);
      paragraphs.forEach((para, index) => {
        if (para.trim()) {
          if (para.startsWith('#')) {
            const match = para.match(/^(#{1,6})\s+(.*)$/);
            if (match) {
              const level = match[1].length;
              const headingSize = Math.max(14, 22 - level * 2);
              doc.fontSize(headingSize).fillColor('#1a1a1a').text(match[2]);
              doc.moveDown(0.5);
              doc.fontSize(12).fillColor('#333333');
            } else {
              doc.text(para, { lineGap: 5 });
              doc.moveDown(0.3);
            }
          } else if (para.startsWith('    ')) {
            doc.fillColor('#1a1a1a');
            doc.fontSize(10);
            doc.text(para.replace(/^    /gm, '  '), { lineGap: 2 });
            doc.fontSize(12);
            doc.fillColor('#333333');
            doc.moveDown(0.3);
          } else {
            doc.text(para, { lineGap: 5 });
            doc.moveDown(0.3);
          }
        }
      });
      
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

async function generatePdf(article, res) {
  try {
    const buffer = await generateArticlePdfBuffer(article);
    res.send(buffer);
  } catch (err) {
    console.error('生成 PDF 失败:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: '生成 PDF 失败' });
    }
  }
}

app.get('/api/articles/:id/export', async (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'markdown' } = req.query;
    
    const article = await getArticleWithDetails(id);
    if (!article) {
      return res.status(404).json({ error: '文章不存在' });
    }
    
    const safeTitle = (article.title || 'article').replace(/[<>:"/\\|?*]/g, '_');
    
    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeTitle)}.pdf"`);
      await generatePdf(article, res);
    } else {
      const markdown = articleToMarkdown(article);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeTitle)}.md"`);
      res.send(markdown);
    }
  } catch (error) {
    console.error('导出文章失败:', error);
    res.status(500).json({ error: '导出文章失败' });
  }
});

app.post('/api/articles/export/batch', async (req, res) => {
  try {
    const { ids, format = 'markdown' } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: '请选择要导出的文章' });
    }
    
    const articles = [];
    for (const id of ids) {
      const article = await getArticleWithDetails(id);
      if (article) {
        articles.push(article);
      }
    }
    
    if (articles.length === 0) {
      return res.status(404).json({ error: '没有找到可导出的文章' });
    }
    
    if (articles.length === 1) {
      const article = articles[0];
      const safeTitle = (article.title || 'article').replace(/[<>:"/\\|?*]/g, '_');
      
      if (format === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeTitle)}.pdf"`);
        return await generatePdf(article, res);
      } else {
        const markdown = articleToMarkdown(article);
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeTitle)}.md"`);
        return res.send(markdown);
      }
    }
    
    res.setHeader('Content-Type', 'application/zip');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Disposition', `attachment; filename="articles_export_${timestamp}.zip"`);
    
    const archive = archiver.create('zip', { zlib: { level: 9 } });
    
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: '压缩文件生成失败' });
      }
    });
    
    archive.pipe(res);
    
    for (const article of articles) {
      const safeTitle = (article.title || `article_${article.id}`).replace(/[<>:"/\\|?*]/g, '_');
      
      if (format === 'pdf') {
        const pdfBuffer = await generateArticlePdfBuffer(article);
        archive.append(pdfBuffer, { name: `${safeTitle}.pdf` });
      } else {
        const markdown = articleToMarkdown(article);
        archive.append(Buffer.from(markdown, 'utf8'), { name: `${safeTitle}.md` });
      }
    }
    
    await archive.finalize();
  } catch (error) {
    console.error('批量导出文章失败:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: '批量导出文章失败' });
    }
  }
});

app.get('/api/articles/:id/share', async (req, res) => {
  try {
    const { id } = req.params;
    
    const article = await get('SELECT * FROM articles WHERE id = ?', [parseInt(id)]);
    if (!article) {
      return res.status(404).json({ error: '文章不存在' });
    }
    
    const shareToken = Buffer.from(`article_${id}_${Date.now()}`).toString('base64').replace(/=/g, '');
    
    res.json({
      share_url: `/article/${id}?share=${shareToken}`,
      share_token: shareToken,
      article_id: id,
      title: article.title,
      author: article.author
    });
  } catch (error) {
    console.error('生成分享链接失败:', error);
    res.status(500).json({ error: '生成分享链接失败' });
  }
});

app.get('/api/articles/stats', async (req, res) => {
  try {
    const stats = await all(`
      SELECT 
        a.id,
        a.title,
        COALESCE(l.like_count, 0) as like_count,
        COALESCE(f.favorite_count, 0) as favorite_count,
        COALESCE(c.comment_count, 0) as comment_count
      FROM articles a
      LEFT JOIN (
        SELECT article_id, COUNT(*) as like_count 
        FROM likes 
        GROUP BY article_id
      ) l ON a.id = l.article_id
      LEFT JOIN (
        SELECT article_id, COUNT(*) as favorite_count 
        FROM favorites 
        GROUP BY article_id
      ) f ON a.id = f.article_id
      LEFT JOIN (
        SELECT article_id, COUNT(*) as comment_count 
        FROM comments 
        GROUP BY article_id
      ) c ON a.id = c.article_id
      WHERE a.status = 'published'
      ORDER BY a.created_at DESC
    `);
    
    res.json(stats);
  } catch (error) {
    console.error('获取文章统计失败:', error);
    res.status(500).json({ error: '获取文章统计失败' });
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

async function createArticleVersion(articleId, userId = null) {
  const article = await get('SELECT * FROM articles WHERE id = ?', [parseInt(articleId)]);
  if (!article) return null;

  const tagRows = await all('SELECT tag_id FROM article_tags WHERE article_id = ? ORDER BY tag_id', [parseInt(articleId)]);
  const tagIds = tagRows.map(t => t.tag_id).join(',');

  const maxVersion = await get(
    'SELECT COALESCE(MAX(version_number), 0) as max_version FROM article_versions WHERE article_id = ?',
    [parseInt(articleId)]
  );
  const nextVersion = (maxVersion ? maxVersion.max_version : 0) + 1;

  const result = await run(
    `INSERT INTO article_versions 
     (article_id, title, content, author, category_id, status, tag_ids, version_number, user_id) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      parseInt(articleId),
      article.title,
      article.content,
      article.author,
      article.category_id,
      article.status,
      tagIds,
      nextVersion,
      userId
    ]
  );

  return await get(
    `SELECT av.*, u.username as user_name 
     FROM article_versions av 
     LEFT JOIN users u ON av.user_id = u.id 
     WHERE av.id = ?`,
    [result.lastID]
  );
}

async function getArticleVersionWithDetails(versionId) {
  const version = await get(
    `SELECT av.*, u.username as user_name, c.name as category_name
     FROM article_versions av 
     LEFT JOIN users u ON av.user_id = u.id 
     LEFT JOIN categories c ON av.category_id = c.id
     WHERE av.id = ?`,
    [parseInt(versionId)]
  );

  if (!version) return null;

  let tags = [];
  if (version.tag_ids) {
    const tagIdList = version.tag_ids.split(',').filter(Boolean).map(Number);
    if (tagIdList.length > 0) {
      const placeholders = tagIdList.map(() => '?').join(',');
      tags = await all(`SELECT id, name FROM tags WHERE id IN (${placeholders}) ORDER BY name`, tagIdList);
    }
  }

  return {
    ...version,
    tags
  };
}

app.post('/api/articles', async (req, res) => {
  try {
    const { title, content, author, category_id, tags, status } = req.body;
    const articleStatus = status === 'draft' ? 'draft' : 'published';
    
    if (!title || !title.trim()) {
      return res.status(400).json({ error: '文章标题不能为空' });
    }
    
    let sanitizedContent = '';
    if (articleStatus === 'published') {
      if (!content) {
        return res.status(400).json({ error: '文章内容不能为空' });
      }
      sanitizedContent = sanitizeHtml(content);
      const plainContent = stripHtml(sanitizedContent);
      if (!plainContent || !plainContent.trim()) {
        return res.status(400).json({ error: '文章内容不能为空' });
      }
    } else {
      sanitizedContent = content ? sanitizeHtml(content) : '';
    }
    
    const result = await run(
      'INSERT INTO articles (title, content, author, category_id, status) VALUES (?, ?, ?, ?, ?)',
      [
        title.trim(), 
        sanitizedContent, 
        author || '管理员',
        category_id ? parseInt(category_id) : null,
        articleStatus
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
    const { title, content, author, category_id, tags, status } = req.body;
    
    const exists = await get('SELECT * FROM articles WHERE id = ?', [parseInt(id)]);
    if (!exists) {
      return res.status(404).json({ error: '文章不存在' });
    }
    
    const articleStatus = status === 'draft' ? 'draft' : (status === 'published' ? 'published' : exists.status);
    
    if (!title || !title.trim()) {
      return res.status(400).json({ error: '文章标题不能为空' });
    }
    
    let sanitizedContent;
    if (articleStatus === 'published') {
      if (!content) {
        return res.status(400).json({ error: '文章内容不能为空' });
      }
      sanitizedContent = sanitizeHtml(content);
      const plainContent = stripHtml(sanitizedContent);
      if (!plainContent || !plainContent.trim()) {
        return res.status(400).json({ error: '文章内容不能为空' });
      }
    } else {
      sanitizedContent = content !== undefined ? sanitizeHtml(content) : exists.content;
    }
    
    const userId = req.user ? req.user.id : null;
    await createArticleVersion(parseInt(id), userId);
    
    await run(
      'UPDATE articles SET title = ?, content = ?, author = ?, category_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [
        title.trim(), 
        sanitizedContent, 
        author || exists.author,
        category_id !== undefined ? (category_id ? parseInt(category_id) : null) : exists.category_id,
        articleStatus,
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

app.put('/api/articles/:id/pin', async (req, res) => {
  try {
    const { id } = req.params;
    const { pinned } = req.body;
    
    const exists = await get('SELECT * FROM articles WHERE id = ?', [parseInt(id)]);
    if (!exists) {
      return res.status(404).json({ error: '文章不存在' });
    }
    
    const isPinned = pinned ? 1 : 0;
    const pinnedAt = pinned ? new Date().toISOString() : null;
    
    await run(
      'UPDATE articles SET is_pinned = ?, pinned_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [isPinned, pinnedAt, parseInt(id)]
    );
    
    const updatedArticle = await getArticleWithDetails(id);
    res.json({
      message: pinned ? '文章置顶成功' : '取消置顶成功',
      article: updatedArticle
    });
  } catch (error) {
    console.error('切换置顶状态失败:', error);
    res.status(500).json({ error: '切换置顶状态失败' });
  }
});

app.get('/api/articles/:id/versions', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, pageSize = 20 } = req.query;

    const article = await get('SELECT id FROM articles WHERE id = ?', [parseInt(id)]);
    if (!article) {
      return res.status(404).json({ error: '文章不存在' });
    }

    const pageValue = Math.max(1, parseInt(page));
    const pageSizeValue = Math.min(100, Math.max(1, parseInt(pageSize)));
    const offset = (pageValue - 1) * pageSizeValue;

    const countResult = await get(
      'SELECT COUNT(*) as total FROM article_versions WHERE article_id = ?',
      [parseInt(id)]
    );
    const total = countResult ? countResult.total : 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSizeValue));

    const versions = await all(
      `SELECT av.*, u.username as user_name 
       FROM article_versions av 
       LEFT JOIN users u ON av.user_id = u.id 
       WHERE av.article_id = ? 
       ORDER BY av.version_number DESC 
       LIMIT ? OFFSET ?`,
      [parseInt(id), pageSizeValue, offset]
    );

    res.json({
      versions,
      total,
      page: pageValue,
      pageSize: pageSizeValue,
      totalPages
    });
  } catch (error) {
    console.error('获取版本列表失败:', error);
    res.status(500).json({ error: '获取版本列表失败' });
  }
});

app.get('/api/articles/:id/versions/:versionId', async (req, res) => {
  try {
    const { id, versionId } = req.params;

    const article = await get('SELECT id FROM articles WHERE id = ?', [parseInt(id)]);
    if (!article) {
      return res.status(404).json({ error: '文章不存在' });
    }

    const version = await getArticleVersionWithDetails(versionId);
    if (!version) {
      return res.status(404).json({ error: '版本不存在' });
    }

    if (version.article_id !== parseInt(id)) {
      return res.status(400).json({ error: '版本不属于该文章' });
    }

    res.json(version);
  } catch (error) {
    console.error('获取版本详情失败:', error);
    res.status(500).json({ error: '获取版本详情失败' });
  }
});

app.post('/api/articles/:id/versions/:versionId/restore', async (req, res) => {
  try {
    const { id, versionId } = req.params;

    const article = await get('SELECT * FROM articles WHERE id = ?', [parseInt(id)]);
    if (!article) {
      return res.status(404).json({ error: '文章不存在' });
    }

    const version = await getArticleVersionWithDetails(versionId);
    if (!version) {
      return res.status(404).json({ error: '版本不存在' });
    }

    if (version.article_id !== parseInt(id)) {
      return res.status(400).json({ error: '版本不属于该文章' });
    }

    const userId = req.user ? req.user.id : null;
    await createArticleVersion(parseInt(id), userId);

    await run(
      'UPDATE articles SET title = ?, content = ?, author = ?, category_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [
        version.title,
        version.content,
        version.author || article.author,
        version.category_id,
        version.status || article.status,
        parseInt(id)
      ]
    );

    if (version.tags && version.tags.length > 0) {
      const tagIds = version.tags.map(t => t.id);
      await updateArticleTags(parseInt(id), tagIds);
    }

    const restoredArticle = await getArticleWithDetails(id);
    res.json({
      message: '恢复成功',
      article: restoredArticle
    });
  } catch (error) {
    console.error('恢复版本失败:', error);
    res.status(500).json({ error: '恢复版本失败' });
  }
});

app.delete('/api/articles/:id/versions/:versionId', async (req, res) => {
  try {
    const { id, versionId } = req.params;

    const article = await get('SELECT id FROM articles WHERE id = ?', [parseInt(id)]);
    if (!article) {
      return res.status(404).json({ error: '文章不存在' });
    }

    const version = await get('SELECT * FROM article_versions WHERE id = ? AND article_id = ?', [parseInt(versionId), parseInt(id)]);
    if (!version) {
      return res.status(404).json({ error: '版本不存在' });
    }

    await run('DELETE FROM article_versions WHERE id = ?', [parseInt(versionId)]);
    res.json({ message: '版本删除成功' });
  } catch (error) {
    console.error('删除版本失败:', error);
    res.status(500).json({ error: '删除版本失败' });
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
    const userId = req.user ? req.user.id : null;
    const displayNickname = req.user ? (req.user.nickname || req.user.username) : nickname;
    
    const article = await get('SELECT * FROM articles WHERE id = ?', [parseInt(id)]);
    if (!article) {
      return res.status(404).json({ error: '文章不存在' });
    }
    
    if (!displayNickname || !displayNickname.trim()) {
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
      'INSERT INTO comments (article_id, nickname, content, parent_id, user_id) VALUES (?, ?, ?, ?, ?)',
      [parseInt(id), displayNickname.trim(), content.trim(), parent_id ? parseInt(parent_id) : null, userId]
    );
    
    const newComment = await get(
      `SELECT c.*, p.nickname as parent_nickname 
       FROM comments c 
       LEFT JOIN comments p ON c.parent_id = p.id 
       WHERE c.id = ?`,
      [result.lastID]
    );
    
    const authorUserId = await findUserIdByAuthorName(article.author);
    if (authorUserId && authorUserId !== userId) {
      await createNotification({
        userId: authorUserId,
        type: parent_id ? 'reply' : 'comment',
        articleId: parseInt(id),
        commentId: result.lastID,
        fromUserId: userId,
        fromUserName: displayNickname.trim(),
        content: parent_id 
          ? `${displayNickname.trim()} 回复了你的评论，在文章《${article.title}》中`
          : `${displayNickname.trim()} 评论了你的文章《${article.title}》：${content.trim().substring(0, 50)}${content.trim().length > 50 ? '...' : ''}`
      });
    }
    
    if (parent_id) {
      const parentComment = await get('SELECT * FROM comments WHERE id = ?', [parseInt(parent_id)]);
      if (parentComment && parentComment.user_id && parentComment.user_id !== userId && parentComment.user_id !== authorUserId) {
        await createNotification({
          userId: parentComment.user_id,
          type: 'reply',
          articleId: parseInt(id),
          commentId: result.lastID,
          fromUserId: userId,
          fromUserName: displayNickname.trim(),
          content: `${displayNickname.trim()} 回复了你的评论，在文章《${article.title}》中`
        });
      }
    }
    
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

app.post('/api/articles/:id/like', async (req, res) => {
  try {
    const { id } = req.params;
    const userIdentifier = getUserIdentifier(req);
    const ipAddress = getClientIp(req);
    const userId = req.user ? req.user.id : null;
    const fromUserName = req.user ? (req.user.nickname || req.user.username) : '匿名用户';
    
    const article = await get('SELECT * FROM articles WHERE id = ?', [parseInt(id)]);
    if (!article) {
      return res.status(404).json({ error: '文章不存在' });
    }
    
    const alreadyLiked = await hasUserLiked(id, userIdentifier);
    if (alreadyLiked) {
      return res.status(400).json({ error: '您已经点赞过这篇文章' });
    }
    
    await run(
      'INSERT INTO likes (article_id, user_identifier, ip_address, user_id) VALUES (?, ?, ?, ?)',
      [parseInt(id), userIdentifier, ipAddress, userId]
    );
    
    const authorUserId = await findUserIdByAuthorName(article.author);
    if (authorUserId && authorUserId !== userId) {
      await createNotification({
        userId: authorUserId,
        type: 'like',
        articleId: parseInt(id),
        fromUserId: userId,
        fromUserName: fromUserName,
        content: `${fromUserName} 赞了你的文章《${article.title}》`
      });
    }
    
    const likeCount = await getArticleLikeCount(id);
    res.json({ 
      message: '点赞成功', 
      like_count: likeCount,
      liked: true 
    });
  } catch (error) {
    console.error('点赞失败:', error);
    res.status(500).json({ error: '点赞失败' });
  }
});

app.delete('/api/articles/:id/like', async (req, res) => {
  try {
    const { id } = req.params;
    const userIdentifier = getUserIdentifier(req);
    
    const article = await get('SELECT * FROM articles WHERE id = ?', [parseInt(id)]);
    if (!article) {
      return res.status(404).json({ error: '文章不存在' });
    }
    
    const alreadyLiked = await hasUserLiked(id, userIdentifier);
    if (!alreadyLiked) {
      return res.status(400).json({ error: '您还没有点赞这篇文章' });
    }
    
    await run(
      'DELETE FROM likes WHERE article_id = ? AND user_identifier = ?',
      [parseInt(id), userIdentifier]
    );
    
    const likeCount = await getArticleLikeCount(id);
    res.json({ 
      message: '取消点赞成功', 
      like_count: likeCount,
      liked: false 
    });
  } catch (error) {
    console.error('取消点赞失败:', error);
    res.status(500).json({ error: '取消点赞失败' });
  }
});

app.post('/api/articles/:id/favorite', async (req, res) => {
  try {
    const { id } = req.params;
    const userIdentifier = getUserIdentifier(req);
    const ipAddress = getClientIp(req);
    const userId = req.user ? req.user.id : null;
    const fromUserName = req.user ? (req.user.nickname || req.user.username) : '匿名用户';
    
    const article = await get('SELECT * FROM articles WHERE id = ?', [parseInt(id)]);
    if (!article) {
      return res.status(404).json({ error: '文章不存在' });
    }
    
    const alreadyFavorited = await hasUserFavorited(id, userIdentifier);
    if (alreadyFavorited) {
      return res.status(400).json({ error: '您已经收藏过这篇文章' });
    }
    
    await run(
      'INSERT INTO favorites (article_id, user_identifier, ip_address, user_id) VALUES (?, ?, ?, ?)',
      [parseInt(id), userIdentifier, ipAddress, userId]
    );
    
    const authorUserId = await findUserIdByAuthorName(article.author);
    if (authorUserId && authorUserId !== userId) {
      await createNotification({
        userId: authorUserId,
        type: 'favorite',
        articleId: parseInt(id),
        fromUserId: userId,
        fromUserName: fromUserName,
        content: `${fromUserName} 收藏了你的文章《${article.title}》`
      });
    }
    
    const favoriteCount = await getArticleFavoriteCount(id);
    res.json({ 
      message: '收藏成功', 
      favorite_count: favoriteCount,
      favorited: true 
    });
  } catch (error) {
    console.error('收藏失败:', error);
    res.status(500).json({ error: '收藏失败' });
  }
});

app.delete('/api/articles/:id/favorite', async (req, res) => {
  try {
    const { id } = req.params;
    const userIdentifier = getUserIdentifier(req);
    
    const article = await get('SELECT * FROM articles WHERE id = ?', [parseInt(id)]);
    if (!article) {
      return res.status(404).json({ error: '文章不存在' });
    }
    
    const alreadyFavorited = await hasUserFavorited(id, userIdentifier);
    if (!alreadyFavorited) {
      return res.status(400).json({ error: '您还没有收藏这篇文章' });
    }
    
    await run(
      'DELETE FROM favorites WHERE article_id = ? AND user_identifier = ?',
      [parseInt(id), userIdentifier]
    );
    
    const favoriteCount = await getArticleFavoriteCount(id);
    res.json({ 
      message: '取消收藏成功', 
      favorite_count: favoriteCount,
      favorited: false 
    });
  } catch (error) {
    console.error('取消收藏失败:', error);
    res.status(500).json({ error: '取消收藏失败' });
  }
});

app.get('/api/articles/:id/likes', async (req, res) => {
  try {
    const { id } = req.params;
    const userIdentifier = getUserIdentifier(req);
    
    const article = await get('SELECT * FROM articles WHERE id = ?', [parseInt(id)]);
    if (!article) {
      return res.status(404).json({ error: '文章不存在' });
    }
    
    const likeCount = await getArticleLikeCount(id);
    const liked = await hasUserLiked(id, userIdentifier);
    
    res.json({ 
      like_count: likeCount,
      liked: liked
    });
  } catch (error) {
    console.error('获取点赞状态失败:', error);
    res.status(500).json({ error: '获取点赞状态失败' });
  }
});

app.get('/api/articles/:id/favorites', async (req, res) => {
  try {
    const { id } = req.params;
    const userIdentifier = getUserIdentifier(req);
    
    const article = await get('SELECT * FROM articles WHERE id = ?', [parseInt(id)]);
    if (!article) {
      return res.status(404).json({ error: '文章不存在' });
    }
    
    const favoriteCount = await getArticleFavoriteCount(id);
    const favorited = await hasUserFavorited(id, userIdentifier);
    
    res.json({ 
      favorite_count: favoriteCount,
      favorited: favorited
    });
  } catch (error) {
    console.error('获取收藏状态失败:', error);
    res.status(500).json({ error: '获取收藏状态失败' });
  }
});

app.get('/api/hot-searches', async (req, res) => {
  try {
    const articles = await all(`
      SELECT a.title, a.content, GROUP_CONCAT(t.name) as tags
      FROM articles a
      LEFT JOIN article_tags at ON a.id = at.article_id
      LEFT JOIN tags t ON at.tag_id = t.id
      WHERE a.status = 'published'
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
        WHERE status = ? AND (title LIKE ? OR content LIKE ?)
      `, ['published', likeKeyword, likeKeyword]);
      
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

app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, unread_only = 'false' } = req.query;
    const userId = req.user.id;
    
    const pageValue = Math.max(1, parseInt(page));
    const pageSizeValue = Math.min(100, Math.max(1, parseInt(pageSize)));
    const offset = (pageValue - 1) * pageSizeValue;
    
    let whereClause = 'WHERE n.user_id = ?';
    const countParams = [userId];
    const dataParams = [userId];
    
    if (unread_only === 'true') {
      whereClause += ' AND n.is_read = 0';
    }
    
    const countResult = await get(
      `SELECT COUNT(*) as total FROM notifications n ${whereClause}`,
      countParams
    );
    const total = countResult ? countResult.total : 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSizeValue));
    
    const notifications = await all(
      `SELECT n.*, a.title as article_title 
       FROM notifications n 
       LEFT JOIN articles a ON n.article_id = a.id 
       ${whereClause}
       ORDER BY n.created_at DESC 
       LIMIT ? OFFSET ?`,
      [...dataParams, pageSizeValue, offset]
    );
    
    res.json({
      notifications,
      total,
      page: pageValue,
      pageSize: pageSizeValue,
      totalPages
    });
  } catch (error) {
    console.error('获取通知列表失败:', error);
    res.status(500).json({ error: '获取通知列表失败' });
  }
});

app.get('/api/notifications/unread-count', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await get(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    res.json({ unread_count: result ? result.count : 0 });
  } catch (error) {
    console.error('获取未读通知数量失败:', error);
    res.status(500).json({ error: '获取未读通知数量失败' });
  }
});

app.put('/api/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const notification = await get(
      'SELECT * FROM notifications WHERE id = ? AND user_id = ?',
      [parseInt(id), userId]
    );
    if (!notification) {
      return res.status(404).json({ error: '通知不存在' });
    }
    
    await run(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [parseInt(id), userId]
    );
    
    res.json({ message: '标记已读成功' });
  } catch (error) {
    console.error('标记通知已读失败:', error);
    res.status(500).json({ error: '标记通知已读失败' });
  }
});

app.put('/api/notifications/read-all', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    await run(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    
    res.json({ message: '全部标记已读成功' });
  } catch (error) {
    console.error('全部标记已读失败:', error);
    res.status(500).json({ error: '全部标记已读失败' });
  }
});

app.delete('/api/notifications/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const notification = await get(
      'SELECT * FROM notifications WHERE id = ? AND user_id = ?',
      [parseInt(id), userId]
    );
    if (!notification) {
      return res.status(404).json({ error: '通知不存在' });
    }
    
    await run(
      'DELETE FROM notifications WHERE id = ? AND user_id = ?',
      [parseInt(id), userId]
    );
    
    res.json({ message: '删除通知成功' });
  } catch (error) {
    console.error('删除通知失败:', error);
    res.status(500).json({ error: '删除通知失败' });
  }
});

const serverPromise = initDatabase().then(() => {
  if (require.main === module) {
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log(`API 接口:`);
      console.log(`  POST   /api/auth/register             - 用户注册`);
      console.log(`  POST   /api/auth/login                - 用户登录`);
      console.log(`  POST   /api/auth/logout               - 用户登出(需登录)`);
      console.log(`  GET    /api/auth/me                   - 获取当前登录用户信息`);
      console.log(`  GET    /api/categories                - 获取所有分类`);
      console.log(`  GET    /api/tags                      - 获取所有标签`);
      console.log(`  GET    /api/articles                  - 获取已发布文章列表(支持?category=id或?tag=id筛选)`);
      console.log(`  GET    /api/articles/drafts/list      - 获取草稿列表`);
      console.log(`  GET    /api/articles/search           - 搜索文章(支持?q=关键词)`);
      console.log(`  GET    /api/hot-searches              - 获取热门搜索词`);
      console.log(`  GET    /api/articles/:id              - 获取单篇文章(含分类和标签)`);
      console.log(`  POST   /api/articles                  - 创建文章(支持status:draft/published, category_id和tags)`);
      console.log(`  PUT    /api/articles/:id              - 更新文章(支持status, category_id和tags)`);
      console.log(`  DELETE /api/articles/:id              - 删除文章`);
      console.log(`  PUT    /api/articles/:id/pin          - 切换文章置顶状态`);
      console.log(`  GET    /api/articles/:id/comments     - 获取文章评论列表`);
      console.log(`  POST   /api/articles/:id/comments     - 添加评论`);
      console.log(`  DELETE /api/comments/:id              - 删除评论`);
      console.log(`  GET    /api/comments                  - 获取所有评论(管理)`);
      console.log(`  POST   /api/articles/:id/like         - 点赞文章`);
      console.log(`  DELETE /api/articles/:id/like         - 取消点赞`);
      console.log(`  POST   /api/articles/:id/favorite     - 收藏文章`);
      console.log(`  DELETE /api/articles/:id/favorite     - 取消收藏`);
      console.log(`  GET    /api/articles/:id/likes        - 获取文章点赞状态`);
      console.log(`  GET    /api/articles/:id/favorites    - 获取文章收藏状态`);
      console.log(`  GET    /api/articles/stats            - 获取所有文章统计数据`);
      console.log(`  GET    /api/articles/:id/export       - 导出文章(?format=markdown/pdf)`);
      console.log(`  POST   /api/articles/export/batch     - 批量导出文章(ids:[], format:markdown/pdf)`);
      console.log(`  GET    /api/articles/:id/share        - 生成文章分享链接`);
      console.log(`  GET    /api/articles/:id/versions     - 获取文章版本历史列表`);
      console.log(`  GET    /api/articles/:id/versions/:versionId - 获取版本详情`);
      console.log(`  POST   /api/articles/:id/versions/:versionId/restore - 恢复到指定版本`);
      console.log(`  DELETE /api/articles/:id/versions/:versionId - 删除指定版本`);
      console.log(`  GET    /api/notifications             - 获取通知列表(需登录)`);
      console.log(`  GET    /api/notifications/unread-count - 获取未读通知数量(需登录)`);
      console.log(`  PUT    /api/notifications/:id/read    - 标记单条通知为已读(需登录)`);
      console.log(`  PUT    /api/notifications/read-all    - 标记所有通知为已读(需登录)`);
      console.log(`  DELETE /api/notifications/:id         - 删除通知(需登录)`);
    });
  }
  return app;
}).catch(error => {
  console.error('数据库初始化失败:', error);
  if (require.main === module) {
    process.exit(1);
  }
  throw error;
});

module.exports = { app, serverPromise };
