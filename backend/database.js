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

        db.run(`
          CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            article_id INTEGER NOT NULL,
            parent_id INTEGER,
            nickname TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
            FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
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
                  '欢迎使用博客系统', '这是一个基于节点服务框架、界面组件库与嵌入式数据库构建的完整博客系统。您可以在这里发布、编辑和删除文章，记录生活点滴与技术心得。', '系统管理员',
                  '前端开发最佳实践', '在现代前端开发中，代码规范与工程化至关重要。本文将分享项目结构设计、状态管理、性能优化等方面的实战经验，帮助您构建高质量的前端应用。', '技术小编',
                  '深入理解响应式编程', '响应式编程是一种面向数据流和变化传播的编程范式。本文将通过实际案例，深入浅出地介绍响应式编程的核心概念与应用场景。', '前端开发'
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
