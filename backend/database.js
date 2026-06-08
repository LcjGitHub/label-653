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
        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          reject(err);
          return;
        }

        db.run(`
          CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) {
            reject(err);
            return;
          }

          db.run(`
            CREATE TABLE IF NOT EXISTS articles (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              title TEXT NOT NULL,
              content TEXT NOT NULL,
              author TEXT DEFAULT '管理员',
              category_id INTEGER,
              status TEXT DEFAULT 'published',
              is_pinned INTEGER DEFAULT 0,
              pinned_at DATETIME,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
            )
          `, (err) => {
            if (err) {
              reject(err);
              return;
            }

            db.run(`PRAGMA foreign_keys = ON`);

            db.run(`
              CREATE TABLE IF NOT EXISTS article_tags (
                article_id INTEGER NOT NULL,
                tag_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (article_id, tag_id),
                FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
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

                db.run(`
                  CREATE TABLE IF NOT EXISTS likes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    article_id INTEGER NOT NULL,
                    user_identifier TEXT NOT NULL,
                    ip_address TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
                    UNIQUE(article_id, user_identifier)
                  )
                `, (err) => {
                  if (err) {
                    reject(err);
                    return;
                  }

                  db.run(`
                    CREATE TABLE IF NOT EXISTS favorites (
                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                      article_id INTEGER NOT NULL,
                      user_identifier TEXT NOT NULL,
                      ip_address TEXT,
                      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
                      UNIQUE(article_id, user_identifier)
                    )
                  `, (err) => {
                    if (err) {
                      reject(err);
                      return;
                    }

                    db.run(`CREATE INDEX IF NOT EXISTS idx_articles_status_created ON articles(status, created_at DESC)`);
                    db.run(`CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id)`);
                    db.run(`CREATE INDEX IF NOT EXISTS idx_articles_pinned ON articles(is_pinned DESC, pinned_at DESC)`);
                    db.run(`CREATE INDEX IF NOT EXISTS idx_likes_article ON likes(article_id)`);
                    db.run(`CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_identifier, article_id)`);
                    db.run(`CREATE INDEX IF NOT EXISTS idx_favorites_article ON favorites(article_id)`);
                    db.run(`CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_identifier, article_id)`);
                    db.run(`CREATE INDEX IF NOT EXISTS idx_comments_article ON comments(article_id, created_at DESC)`);
                    db.run(`CREATE INDEX IF NOT EXISTS idx_article_tags_tag ON article_tags(tag_id, article_id)`);

                db.get('SELECT COUNT(*) as count FROM categories', [], (err, row) => {
                  if (err) {
                    reject(err);
                    return;
                  }
                  
                  if (row.count === 0) {
                    const insertCategories = `
                      INSERT INTO categories (name, description) VALUES 
                      (?, ?),
                      (?, ?),
                      (?, ?),
                      (?, ?)
                    `;
                    const categoryValues = [
                      '技术', '分享技术干货、编程经验和开发技巧',
                      '生活', '记录生活点滴、旅行见闻和日常感悟',
                      '随笔', '随想随写，记录灵感和思考',
                      '教程', '详细的技术教程和学习指南'
                    ];
                    
                    db.run(insertCategories, categoryValues, (err) => {
                      if (err) {
                        reject(err);
                        return;
                      }
                      console.log('默认分类插入成功');

                      const insertTags = `
                        INSERT INTO tags (name) VALUES 
                        ('JavaScript'),
                        ('React'),
                        ('Vue'),
                        ('Node.js'),
                        ('前端'),
                        ('后端'),
                        ('数据库'),
                        ('性能优化'),
                        ('编程思想'),
                        ('工具推荐')
                      `;
                      
                      db.run(insertTags, [], (err) => {
                        if (err) {
                          reject(err);
                          return;
                        }
                        console.log('默认标签插入成功');
                        seedArticlesWithCategories();
                      });
                    });
                  } else {
                    checkAndAddCategoryColumn();
                  }
                });

                function seedArticlesWithCategories() {
                  db.get('SELECT COUNT(*) as count FROM articles', [], (err, row) => {
                    if (err) {
                      reject(err);
                      return;
                    }
                    
                    if (row.count === 0) {
                      db.run(`
                        INSERT INTO articles (title, content, author, category_id, status) VALUES 
                        (?, ?, ?, 1, 'published'),
                        (?, ?, ?, 1, 'published'),
                        (?, ?, ?, 1, 'published')
                      `, [
                        '欢迎使用博客系统', '这是一个基于节点服务框架、界面组件库与嵌入式数据库构建的完整博客系统。您可以在这里发布、编辑和删除文章，记录生活点滴与技术心得。', '系统管理员',
                        '前端开发最佳实践', '在现代前端开发中，代码规范与工程化至关重要。本文将分享项目结构设计、状态管理、性能优化等方面的实战经验，帮助您构建高质量的前端应用。', '技术小编',
                        '深入理解响应式编程', '响应式编程是一种面向数据流和变化传播的编程范式。本文将通过实际案例，深入浅出地介绍响应式编程的核心概念与应用场景。', '前端开发'
                      ], function(err) {
                        if (err) {
                          reject(err);
                          return;
                        }
                        
                        const articleId1 = this.lastID - 2;
                        const articleId2 = this.lastID - 1;
                        const articleId3 = this.lastID;
                        
                        db.run(`
                          INSERT INTO article_tags (article_id, tag_id) VALUES 
                          (?, 5), (?, 1),
                          (?, 5), (?, 2), (?, 8),
                          (?, 9), (?, 1)
                        `, [
                          articleId1, articleId1,
                          articleId2, articleId2, articleId2,
                          articleId3, articleId3
                        ], (err) => {
                          if (err) {
                            reject(err);
                            return;
                          }
                          console.log('示例数据及分类标签关联插入成功');
                          resolve(db);
                        });
                      });
                    } else {
                      resolve(db);
                    }
                  });
                }

                function checkAndAddCategoryColumn() {
                  db.all("PRAGMA table_info(articles)", [], (err, columns) => {
                    if (err) {
                      reject(err);
                      return;
                    }
                    
                    const hasCategoryId = columns.some(col => col.name === 'category_id');
                    const hasStatus = columns.some(col => col.name === 'status');
                    const hasIsPinned = columns.some(col => col.name === 'is_pinned');
                    const hasPinnedAt = columns.some(col => col.name === 'pinned_at');
                    
                    let pendingAlters = 0;
                    
                    function checkDone() {
                      if (pendingAlters === 0) {
                        seedArticlesWithCategories();
                      }
                    }
                    
                    if (!hasCategoryId) {
                      pendingAlters++;
                      db.run(`
                        ALTER TABLE articles ADD COLUMN category_id INTEGER
                      `, (err) => {
                        if (err) {
                          console.warn('添加 category_id 列失败:', err.message);
                        } else {
                          console.log('已为 articles 表添加 category_id 列');
                        }
                        pendingAlters--;
                        checkDone();
                      });
                    }
                    
                    if (!hasStatus) {
                      pendingAlters++;
                      db.run(`
                        ALTER TABLE articles ADD COLUMN status TEXT DEFAULT 'published'
                      `, (err) => {
                        if (err) {
                          console.warn('添加 status 列失败:', err.message);
                        } else {
                          console.log('已为 articles 表添加 status 列');
                        }
                        pendingAlters--;
                        checkDone();
                      });
                    }
                    
                    if (!hasIsPinned) {
                      pendingAlters++;
                      db.run(`
                        ALTER TABLE articles ADD COLUMN is_pinned INTEGER DEFAULT 0
                      `, (err) => {
                        if (err) {
                          console.warn('添加 is_pinned 列失败:', err.message);
                        } else {
                          console.log('已为 articles 表添加 is_pinned 列');
                        }
                        pendingAlters--;
                        checkDone();
                      });
                    }
                    
                    if (!hasPinnedAt) {
                      pendingAlters++;
                      db.run(`
                        ALTER TABLE articles ADD COLUMN pinned_at DATETIME
                      `, (err) => {
                        if (err) {
                          console.warn('添加 pinned_at 列失败:', err.message);
                        } else {
                          console.log('已为 articles 表添加 pinned_at 列');
                        }
                        pendingAlters--;
                        checkDone();
                      });
                    }
                    
                    if (hasCategoryId && hasStatus && hasIsPinned && hasPinnedAt) {
                      seedArticlesWithCategories();
                    }
                  });
                }
                  });
                });
              });
            });
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
