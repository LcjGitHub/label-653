const sqlite3 = require('@louislam/sqlite3').verbose();
const path = require('path');

const DB_FILE = path.join(__dirname, 'blog.db');
let db;

function initDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_FILE, (err) => {
      if (err) {
        console.error('数据库连接失败:', err.message);
        reject(err);
        return;
      }
      console.log('数据库连接成功');
      
      db.run(`
        CREATE TABLE IF NOT EXISTS articles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          author TEXT DEFAULT '管理员',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        db.get('SELECT COUNT(*) as count FROM articles', [], (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (row.count === 0) {
            const insertStmt = `
              INSERT INTO articles (title, content, author) VALUES 
              (?, ?, ?),
              (?, ?, ?),
              (?, ?, ?)
            `;
            const values = [
              '欢迎来到博客系统', '这是一个使用 Node.js、Express、React 和 SQLite 构建的完整博客系统。您可以在这里发布、编辑和删除文章。', '系统管理员',
              'JavaScript 基础入门', 'JavaScript 是一种轻量级的脚本语言，广泛用于 Web 开发。本文将介绍 JavaScript 的基础知识，包括变量、函数、对象等核心概念。', '技术小编',
              'React 组件开发指南', 'React 是一个用于构建用户界面的 JavaScript 库。组件是 React 应用的基本构建块，本文将详细介绍如何开发高质量的 React 组件。', '前端开发'
            ];
            
            db.run(insertStmt, values, (err) => {
              if (err) {
                reject(err);
                return;
              }
              console.log('示例数据插入成功');
              resolve(db);
            });
          } else {
            resolve(db);
          }
        });
      });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('数据库连接已关闭');
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  initDatabase,
  all,
  get,
  run,
  closeDatabase
};
