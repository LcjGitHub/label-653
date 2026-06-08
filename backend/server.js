const express = require('express');
const cors = require('cors');
const TurndownService = require('turndown');
const PDFDocument = require('pdfkit');
const archiver = require('archiver');
const { initDatabase, all, get, run } = require('./database');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

function getUserIdentifier(req) {
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

async function getArticleLikeCount(articleId) {
  const result = await get('SELECT COUNT(*) as count FROM likes WHERE article_id = ?', [parseInt(articleId)]);
  return result ? result.count : 0;
}

async function getArticleFavoriteCount(articleId) {
  const result = await get('SELECT COUNT(*) as count FROM favorites WHERE article_id = ?', [parseInt(articleId)]);
  return result ? result.count : 0;
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

  const likeCount = await getArticleLikeCount(articleId);
  const favoriteCount = await getArticleFavoriteCount(articleId);

  return {
    ...article,
    tags: tags,
    like_count: likeCount,
    favorite_count: favoriteCount
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

  const needsLikeJoin = sort === 'likes_desc' || sort === 'likes_asc';
  let dataSql;
  if (needsLikeJoin) {
    dataSql = `
      SELECT a.*, c.id as category_id, c.name as category_name,
             COALESCE(l.like_count, 0) as like_count
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN (
        SELECT article_id, COUNT(*) as like_count
        FROM likes
        GROUP BY article_id
      ) l ON a.id = l.article_id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;
  } else {
    dataSql = `
      SELECT a.*, c.id as category_id, c.name as category_name
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;
  }

  const dataParams = [...params, pageSize, offset];
  const articles = await all(dataSql, dataParams);

  for (const article of articles) {
    const tags = await all(`
      SELECT t.id, t.name
      FROM tags t
      INNER JOIN article_tags at ON t.id = at.tag_id
      WHERE at.article_id = ?
      ORDER BY t.name
    `, [article.id]);
    article.tags = tags;
    if (!needsLikeJoin) {
      article.like_count = await getArticleLikeCount(article.id);
    }
    article.favorite_count = await getArticleFavoriteCount(article.id);
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
      WHERE a.status = ? AND (a.title LIKE ? OR a.content LIKE ?)
      ORDER BY a.is_pinned DESC, a.pinned_at DESC, match_score DESC, a.created_at DESC
      LIMIT ? OFFSET ?
    `, [likeKeyword, likeKeyword, 'published', likeKeyword, likeKeyword, pageSizeValue, offset]);
    
    for (const article of articles) {
      const tags = await all(`
        SELECT t.id, t.name
        FROM tags t
        INNER JOIN article_tags at ON t.id = at.tag_id
        WHERE at.article_id = ?
        ORDER BY t.name
      `, [article.id]);
      article.tags = tags;
      
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

function generatePdf(article, res) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 }
  });
  
  doc.pipe(res);
  
  doc.fontSize(24).text(article.title, { align: 'center' });
  doc.moveDown();
  
  doc.fontSize(10).fillColor('#666666');
  doc.text(`作者: ${article.author}`, { align: 'center' });
  doc.text(`发布时间: ${new Date(article.created_at).toLocaleString('zh-CN')}`, { align: 'center' });
  if (article.category_name) {
    doc.text(`分类: ${article.category_name}`, { align: 'center' });
  }
  if (article.tags && article.tags.length > 0) {
    doc.text(`标签: ${article.tags.map(t => t.name).join(', ')}`, { align: 'center' });
  }
  doc.moveDown();
  
  doc.strokeColor('#cccccc').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown();
  
  doc.fillColor('#333333').fontSize(12);
  const plainText = stripHtml(article.content);
  doc.text(plainText, {
    align: 'left',
    lineGap: 5
  });
  
  doc.end();
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
      generatePdf(article, res);
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
        return generatePdf(article, res);
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
    
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    
    for (const article of articles) {
      const safeTitle = (article.title || `article_${article.id}`).replace(/[<>:"/\\|?*]/g, '_');
      
      if (format === 'pdf') {
        const chunks = [];
        const stream = require('stream');
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 50, bottom: 50, left: 50, right: 50 }
        });
        
        const bufferStream = new stream.PassThrough();
        doc.pipe(bufferStream);
        
        doc.fontSize(24).text(article.title, { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).fillColor('#666666');
        doc.text(`作者: ${article.author}`, { align: 'center' });
        doc.text(`发布时间: ${new Date(article.created_at).toLocaleString('zh-CN')}`, { align: 'center' });
        if (article.category_name) doc.text(`分类: ${article.category_name}`, { align: 'center' });
        if (article.tags && article.tags.length > 0) {
          doc.text(`标签: ${article.tags.map(t => t.name).join(', ')}`, { align: 'center' });
        }
        doc.moveDown();
        doc.strokeColor('#cccccc').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown();
        doc.fillColor('#333333').fontSize(12);
        doc.text(stripHtml(article.content), { align: 'left', lineGap: 5 });
        doc.end();
        
        const pdfChunks = [];
        await new Promise((resolve) => {
          bufferStream.on('data', (chunk) => pdfChunks.push(chunk));
          bufferStream.on('end', resolve);
        });
        const pdfBuffer = Buffer.concat(pdfChunks);
        archive.append(pdfBuffer, { name: `${safeTitle}.pdf` });
      } else {
        const markdown = articleToMarkdown(article);
        archive.append(markdown, { name: `${safeTitle}.md` });
      }
    }
    
    archive.finalize();
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

app.post('/api/articles/:id/like', async (req, res) => {
  try {
    const { id } = req.params;
    const userIdentifier = getUserIdentifier(req);
    const ipAddress = getClientIp(req);
    
    const article = await get('SELECT * FROM articles WHERE id = ?', [parseInt(id)]);
    if (!article) {
      return res.status(404).json({ error: '文章不存在' });
    }
    
    const alreadyLiked = await hasUserLiked(id, userIdentifier);
    if (alreadyLiked) {
      return res.status(400).json({ error: '您已经点赞过这篇文章' });
    }
    
    await run(
      'INSERT INTO likes (article_id, user_identifier, ip_address) VALUES (?, ?, ?)',
      [parseInt(id), userIdentifier, ipAddress]
    );
    
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
    
    const article = await get('SELECT * FROM articles WHERE id = ?', [parseInt(id)]);
    if (!article) {
      return res.status(404).json({ error: '文章不存在' });
    }
    
    const alreadyFavorited = await hasUserFavorited(id, userIdentifier);
    if (alreadyFavorited) {
      return res.status(400).json({ error: '您已经收藏过这篇文章' });
    }
    
    await run(
      'INSERT INTO favorites (article_id, user_identifier, ip_address) VALUES (?, ?, ?)',
      [parseInt(id), userIdentifier, ipAddress]
    );
    
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

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`API 接口:`);
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
  });
}).catch(error => {
  console.error('数据库初始化失败:', error);
  process.exit(1);
});
