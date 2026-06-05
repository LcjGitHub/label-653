const express = require('express');
const cors = require('cors');
const { initDatabase, all, get, run } = require('./database');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

app.get('/api/articles', async (req, res) => {
  try {
    const articles = await all('SELECT * FROM articles ORDER BY created_at DESC');
    res.json(articles);
  } catch (error) {
    console.error('获取文章列表失败:', error);
    res.status(500).json({ error: '获取文章列表失败' });
  }
});

app.get('/api/articles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const article = await get('SELECT * FROM articles WHERE id = ?', [parseInt(id)]);
    
    if (!article) {
      return res.status(404).json({ error: '文章不存在' });
    }
    
    res.json(article);
  } catch (error) {
    console.error('获取文章失败:', error);
    res.status(500).json({ error: '获取文章失败' });
  }
});

app.post('/api/articles', async (req, res) => {
  try {
    const { title, content, author } = req.body;
    
    if (!title || !title.trim()) {
      return res.status(400).json({ error: '文章标题不能为空' });
    }
    
    if (!content || !content.trim()) {
      return res.status(400).json({ error: '文章内容不能为空' });
    }
    
    const result = await run(
      'INSERT INTO articles (title, content, author) VALUES (?, ?, ?)',
      [title.trim(), content.trim(), author || '管理员']
    );
    
    const newArticle = await get('SELECT * FROM articles WHERE id = ?', [result.lastID]);
    res.status(201).json(newArticle);
  } catch (error) {
    console.error('创建文章失败:', error);
    res.status(500).json({ error: '创建文章失败' });
  }
});

app.put('/api/articles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, author } = req.body;
    
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
      'UPDATE articles SET title = ?, content = ?, author = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [title.trim(), content.trim(), author || exists.author, parseInt(id)]
    );
    
    const updatedArticle = await get('SELECT * FROM articles WHERE id = ?', [parseInt(id)]);
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

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`API 接口:`);
    console.log(`  GET    /api/articles      - 获取文章列表`);
    console.log(`  GET    /api/articles/:id  - 获取单篇文章`);
    console.log(`  POST   /api/articles      - 创建文章`);
    console.log(`  PUT    /api/articles/:id  - 更新文章`);
    console.log(`  DELETE /api/articles/:id  - 删除文章`);
  });
}).catch(error => {
  console.error('数据库初始化失败:', error);
  process.exit(1);
});
