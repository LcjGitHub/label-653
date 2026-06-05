const express = require('express');
const cors = require('cors');
const { initDatabase, getDb, saveDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

function rowToObject(columns, values) {
  const obj = {};
  columns.forEach((col, index) => {
    obj[col] = values[index];
  });
  return obj;
}

app.get('/api/articles', (req, res) => {
  try {
    const db = getDb();
    const result = db.exec('SELECT * FROM articles ORDER BY created_at DESC');
    
    let articles = [];
    if (result.length > 0) {
      const columns = result[0].columns;
      articles = result[0].values.map(values => rowToObject(columns, values));
    }
    
    res.json(articles);
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

app.get('/api/articles/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM articles WHERE id = ?');
    const result = stmt.getAsObject([parseInt(id)]);
    
    if (!result || Object.keys(result).length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

app.post('/api/articles', (req, res) => {
  try {
    const { title, content, author } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    
    const db = getDb();
    const stmt = db.prepare('INSERT INTO articles (title, content, author) VALUES (?, ?, ?)');
    stmt.run([title, content, author || 'Admin']);
    saveDatabase();
    
    const newId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
    const getStmt = db.prepare('SELECT * FROM articles WHERE id = ?');
    const newArticle = getStmt.getAsObject([newId]);
    
    res.status(201).json(newArticle);
  } catch (error) {
    console.error('Error creating article:', error);
    res.status(500).json({ error: 'Failed to create article' });
  }
});

app.put('/api/articles/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, author } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    
    const db = getDb();
    const checkStmt = db.prepare('SELECT * FROM articles WHERE id = ?');
    const exists = checkStmt.getAsObject([parseInt(id)]);
    
    if (!exists || Object.keys(exists).length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    const stmt = db.prepare('UPDATE articles SET title = ?, content = ?, author = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run([title, content, author || exists.author, parseInt(id)]);
    saveDatabase();
    
    const getStmt = db.prepare('SELECT * FROM articles WHERE id = ?');
    const updatedArticle = getStmt.getAsObject([parseInt(id)]);
    
    res.json(updatedArticle);
  } catch (error) {
    console.error('Error updating article:', error);
    res.status(500).json({ error: 'Failed to update article' });
  }
});

app.delete('/api/articles/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    
    const checkStmt = db.prepare('SELECT * FROM articles WHERE id = ?');
    const exists = checkStmt.getAsObject([parseInt(id)]);
    
    if (!exists || Object.keys(exists).length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    const stmt = db.prepare('DELETE FROM articles WHERE id = ?');
    stmt.run([parseInt(id)]);
    saveDatabase();
    
    res.json({ message: 'Article deleted successfully' });
  } catch (error) {
    console.error('Error deleting article:', error);
    res.status(500).json({ error: 'Failed to delete article' });
  }
});

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`API Endpoints:`);
    console.log(`  GET    /api/articles      - 获取文章列表`);
    console.log(`  GET    /api/articles/:id  - 获取单篇文章`);
    console.log(`  POST   /api/articles      - 创建文章`);
    console.log(`  PUT    /api/articles/:id  - 更新文章`);
    console.log(`  DELETE /api/articles/:id  - 删除文章`);
  });
}).catch(error => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});
