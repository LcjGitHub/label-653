const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'blog.db');

let db;

async function initDatabase() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(fileBuffer);
    console.log('Database loaded from file');
  } else {
    db = new SQL.Database();
    console.log('New database created');
  }
  
  db.run(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author TEXT DEFAULT 'Admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  const result = db.exec('SELECT COUNT(*) as count FROM articles');
  if (result[0].values[0][0] === 0) {
    db.run(`
      INSERT INTO articles (title, content, author) VALUES 
      ('欢迎来到博客系统', '这是一个使用 Node.js、Express、React 和 SQLite 构建的完整博客系统。您可以在这里发布、编辑和删除文章。', '系统管理员'),
      ('JavaScript 基础入门', 'JavaScript 是一种轻量级的脚本语言，广泛用于 Web 开发。本文将介绍 JavaScript 的基础知识，包括变量、函数、对象等核心概念。', '技术小编'),
      ('React 组件开发指南', 'React 是一个用于构建用户界面的 JavaScript 库。组件是 React 应用的基本构建块，本文将详细介绍如何开发高质量的 React 组件。', '前端开发')
    `);
    console.log('Sample data inserted');
  }
  
  saveDatabase();
  return db;
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_FILE, buffer);
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

module.exports = {
  initDatabase,
  saveDatabase,
  getDb
};
