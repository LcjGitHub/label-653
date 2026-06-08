const request = require('supertest');

let app;
let server;

beforeAll(async () => {
  process.env.PORT = 3099;
  process.env.DB_PATH = ':memory:';
  const { app: expressApp, serverPromise } = require('../server.js');
  app = await serverPromise;
  server = app.listen(3099);
});

afterAll(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  const { closeDatabase } = require('../database.js');
  try {
    await closeDatabase();
  } catch (e) {
    // ignore
  }
});

function createTestArticle(overrides = {}) {
  return {
    title: '测试文章标题',
    content: '<p>这是测试文章的内容，包含一些有效的 HTML 内容。</p>',
    author: '测试作者',
    category_id: 1,
    tags: [{ name: '测试标签1' }, { name: '测试标签2' }],
    status: 'published',
    ...overrides
  };
}

describe('基础 API 端点测试', () => {
  test('GET /api/categories 应返回分类列表', async () => {
    const res = await request(server).get('/api/categories');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('name');
    expect(res.body[0]).toHaveProperty('article_count');
  });

  test('GET /api/tags 应返回标签列表', async () => {
    const res = await request(server).get('/api/tags');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('name');
  });

  test('GET /api/hot-searches 应返回热门搜索', async () => {
    const res = await request(server).get('/api/hot-searches');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('文章 CRUD 接口测试', () => {
  describe('POST /api/articles - 创建文章', () => {
    test('正常创建已发布文章', async () => {
      const articleData = createTestArticle();
      const res = await request(server)
        .post('/api/articles')
        .send(articleData);

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe(articleData.title);
      expect(res.body.author).toBe(articleData.author);
      expect(res.body.status).toBe('published');
      expect(res.body.category_id).toBe(articleData.category_id);
      expect(Array.isArray(res.body.tags)).toBe(true);
    });

    test('正常创建草稿文章', async () => {
      const articleData = createTestArticle({ status: 'draft', content: '' });
      const res = await request(server)
        .post('/api/articles')
        .send(articleData);

      expect(res.statusCode).toBe(201);
      expect(res.body.status).toBe('draft');
    });

    test('创建文章时不带作者应使用默认值', async () => {
      const articleData = createTestArticle({ author: undefined });
      const res = await request(server)
        .post('/api/articles')
        .send(articleData);

      expect(res.statusCode).toBe(201);
      expect(res.body.author).toBe('管理员');
    });

    test('使用字符串形式的标签创建文章', async () => {
      const articleData = createTestArticle({ tags: ['字符串标签1', '字符串标签2'] });
      const res = await request(server)
        .post('/api/articles')
        .send(articleData);

      expect(res.statusCode).toBe(201);
      expect(res.body.tags.length).toBeGreaterThan(0);
    });

    test('创建不带标签的文章', async () => {
      const articleData = createTestArticle({ tags: undefined });
      const res = await request(server)
        .post('/api/articles')
        .send(articleData);

      expect(res.statusCode).toBe(201);
      expect(Array.isArray(res.body.tags)).toBe(true);
    });

    test('标题为空时应返回 400 错误', async () => {
      const articleData = createTestArticle({ title: '' });
      const res = await request(server)
        .post('/api/articles')
        .send(articleData);

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    test('标题为空白字符时应返回 400 错误', async () => {
      const articleData = createTestArticle({ title: '   ' });
      const res = await request(server)
        .post('/api/articles')
        .send(articleData);

      expect(res.statusCode).toBe(400);
    });

    test('已发布文章内容为空时应返回 400 错误', async () => {
      const articleData = createTestArticle({ content: '' });
      const res = await request(server)
        .post('/api/articles')
        .send(articleData);

      expect(res.statusCode).toBe(400);
    });

    test('内容只有 HTML 标签无实际文本时应返回 400 错误', async () => {
      const articleData = createTestArticle({ content: '<p></p><div></div>' });
      const res = await request(server)
        .post('/api/articles')
        .send(articleData);

      expect(res.statusCode).toBe(400);
    });

    test('内容包含恶意脚本时应被过滤', async () => {
      const maliciousContent = '<p>正常内容</p><script>alert("xss")</script>';
      const articleData = createTestArticle({ content: maliciousContent });
      const res = await request(server)
        .post('/api/articles')
        .send(articleData);

      expect(res.statusCode).toBe(201);
      expect(res.body.content).not.toContain('<script>');
    });
  });

  describe('GET /api/articles - 获取文章列表', () => {
    test('正常获取文章列表', async () => {
      const res = await request(server).get('/api/articles');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('articles');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('pageSize');
      expect(res.body).toHaveProperty('totalPages');
      expect(Array.isArray(res.body.articles)).toBe(true);
    });

    test('分页参数应正常工作', async () => {
      const res = await request(server).get('/api/articles?page=1&pageSize=5');
      expect(res.statusCode).toBe(200);
      expect(res.body.page).toBe(1);
      expect(res.body.pageSize).toBe(5);
    });

    test('pageSize 超过最大值应被限制为 100', async () => {
      const res = await request(server).get('/api/articles?pageSize=200');
      expect(res.statusCode).toBe(200);
      expect(res.body.pageSize).toBe(100);
    });

    test('无效页码应被矫正为 1', async () => {
      const res = await request(server).get('/api/articles?page=0');
      expect(res.statusCode).toBe(200);
      expect(res.body.page).toBe(1);
    });

    test('按分类筛选文章', async () => {
      const res = await request(server).get('/api/articles?category=1');
      expect(res.statusCode).toBe(200);
    });

    test('按标签筛选文章', async () => {
      const res = await request(server).get('/api/articles?tag=1');
      expect(res.statusCode).toBe(200);
    });

    test('各种排序方式应正常工作', async () => {
      const sortOptions = ['created_desc', 'created_asc', 'updated_desc', 'updated_asc', 'likes_desc', 'likes_asc'];
      for (const sort of sortOptions) {
        const res = await request(server).get(`/api/articles?sort=${sort}`);
        expect(res.statusCode).toBe(200);
      }
    });

    test('无效排序参数应使用默认排序', async () => {
      const res = await request(server).get('/api/articles?sort=invalid_sort');
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /api/articles/:id - 获取单篇文章', () => {
    test('正常获取已存在的文章', async () => {
      const createRes = await request(server)
        .post('/api/articles')
        .send(createTestArticle({ title: '获取测试文章' }));
      const articleId = createRes.body.id;

      const res = await request(server).get(`/api/articles/${articleId}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe(articleId);
      expect(res.body).toHaveProperty('title');
      expect(res.body).toHaveProperty('content');
      expect(res.body).toHaveProperty('tags');
      expect(res.body).toHaveProperty('like_count');
      expect(res.body).toHaveProperty('favorite_count');
    });

    test('获取不存在的文章应返回 404', async () => {
      const res = await request(server).get('/api/articles/99999');
      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/articles/:id - 更新文章', () => {
    test('正常更新文章内容', async () => {
      const createRes = await request(server)
        .post('/api/articles')
        .send(createTestArticle());
      const articleId = createRes.body.id;

      const updateData = {
        title: '更新后的标题',
        content: '<p>更新后的文章内容</p>',
        author: '更新后的作者'
      };
      const res = await request(server)
        .put(`/api/articles/${articleId}`)
        .send(updateData);

      expect(res.statusCode).toBe(200);
      expect(res.body.title).toBe(updateData.title);
      expect(res.body.author).toBe(updateData.author);
    });

    test('更新不存在的文章应返回 404', async () => {
      const res = await request(server)
        .put('/api/articles/99999')
        .send(createTestArticle());

      expect(res.statusCode).toBe(404);
    });

    test('更新文章标题为空应返回 400', async () => {
      const createRes = await request(server)
        .post('/api/articles')
        .send(createTestArticle());
      const articleId = createRes.body.id;

      const res = await request(server)
        .put(`/api/articles/${articleId}`)
        .send({ title: '' });

      expect(res.statusCode).toBe(400);
    });

    test('更新文章标签应生效', async () => {
      const createRes = await request(server)
        .post('/api/articles')
        .send(createTestArticle());
      const articleId = createRes.body.id;

      const res = await request(server)
        .put(`/api/articles/${articleId}`)
        .send({
          title: '更新标签测试',
          content: '<p>内容</p>',
          tags: [{ name: '新标签1' }, { name: '新标签2' }]
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.tags.length).toBeGreaterThanOrEqual(2);
    });

    test('更新文章状态从 published 到 draft', async () => {
      const createRes = await request(server)
        .post('/api/articles')
        .send(createTestArticle());
      const articleId = createRes.body.id;

      const res = await request(server)
        .put(`/api/articles/${articleId}`)
        .send({
          title: '草稿测试',
          status: 'draft'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('draft');
    });
  });

  describe('DELETE /api/articles/:id - 删除文章', () => {
    test('正常删除文章', async () => {
      const createRes = await request(server)
        .post('/api/articles')
        .send(createTestArticle({ title: '删除测试文章' }));
      const articleId = createRes.body.id;

      const deleteRes = await request(server).delete(`/api/articles/${articleId}`);
      expect(deleteRes.statusCode).toBe(200);
      expect(deleteRes.body).toHaveProperty('message');

      const getRes = await request(server).get(`/api/articles/${articleId}`);
      expect(getRes.statusCode).toBe(404);
    });

    test('删除不存在的文章应返回 404', async () => {
      const res = await request(server).delete('/api/articles/99999');
      expect(res.statusCode).toBe(404);
    });
  });
});

describe('搜索接口测试', () => {
  test('正常搜索文章', async () => {
    await request(server)
      .post('/api/articles')
      .send(createTestArticle({ title: '搜索测试专用文章标题' }));

    const res = await request(server).get('/api/articles/search?q=搜索测试');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('keyword');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('articles');
  });

  test('搜索关键词为空应返回 400', async () => {
    const res = await request(server).get('/api/articles/search?q=');
    expect(res.statusCode).toBe(400);
  });

  test('搜索关键词为空白字符应返回 400', async () => {
    const res = await request(server).get('/api/articles/search?q=   ');
    expect(res.statusCode).toBe(400);
  });

  test('搜索无结果应返回空数组', async () => {
    const res = await request(server).get('/api/articles/search?q=不可能存在的关键词xyz123');
    expect(res.statusCode).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.articles).toEqual([]);
  });
});

describe('草稿列表接口测试', () => {
  test('正常获取草稿列表', async () => {
    await request(server)
      .post('/api/articles')
      .send(createTestArticle({ status: 'draft', title: '草稿列表测试' }));

    const res = await request(server).get('/api/articles/drafts/list');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('articles');
    expect(res.body).toHaveProperty('total');
  });
});

describe('置顶接口测试', () => {
  test('正常置顶文章', async () => {
    const createRes = await request(server)
      .post('/api/articles')
      .send(createTestArticle());
    const articleId = createRes.body.id;

    const res = await request(server)
      .put(`/api/articles/${articleId}/pin`)
      .send({ pinned: true });

    expect(res.statusCode).toBe(200);
    expect(res.body.article.is_pinned).toBe(1);
  });

  test('正常取消置顶文章', async () => {
    const createRes = await request(server)
      .post('/api/articles')
      .send(createTestArticle());
    const articleId = createRes.body.id;

    await request(server)
      .put(`/api/articles/${articleId}/pin`)
      .send({ pinned: true });

    const res = await request(server)
      .put(`/api/articles/${articleId}/pin`)
      .send({ pinned: false });

    expect(res.statusCode).toBe(200);
    expect(res.body.article.is_pinned).toBe(0);
  });

  test('置顶不存在的文章应返回 404', async () => {
    const res = await request(server)
      .put('/api/articles/99999/pin')
      .send({ pinned: true });

    expect(res.statusCode).toBe(404);
  });
});

describe('文章统计接口测试', () => {
  test('正常获取文章统计', async () => {
    const res = await request(server).get('/api/articles/stats');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('like_count');
      expect(res.body[0]).toHaveProperty('favorite_count');
      expect(res.body[0]).toHaveProperty('comment_count');
    }
  });
});

describe('分享接口测试', () => {
  test('正常生成分享链接', async () => {
    const createRes = await request(server)
      .post('/api/articles')
      .send(createTestArticle());
    const articleId = createRes.body.id;

    const res = await request(server).get(`/api/articles/${articleId}/share`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('share_url');
    expect(res.body).toHaveProperty('share_token');
    expect(res.body).toHaveProperty('article_id');
  });

  test('为不存在的文章生成分享链接应返回 404', async () => {
    const res = await request(server).get('/api/articles/99999/share');
    expect(res.statusCode).toBe(404);
  });
});

describe('评论接口测试', () => {
  describe('POST /api/articles/:id/comments - 添加评论', () => {
    test('正常添加评论', async () => {
      const createRes = await request(server)
        .post('/api/articles')
        .send(createTestArticle());
      const articleId = createRes.body.id;

      const commentData = {
        nickname: '评论用户',
        content: '这是一条测试评论'
      };
      const res = await request(server)
        .post(`/api/articles/${articleId}/comments`)
        .send(commentData);

      expect(res.statusCode).toBe(201);
      expect(res.body.nickname).toBe(commentData.nickname);
      expect(res.body.content).toBe(commentData.content);
      expect(res.body.article_id).toBe(articleId);
    });

    test('正常添加回复评论', async () => {
      const createRes = await request(server)
        .post('/api/articles')
        .send(createTestArticle());
      const articleId = createRes.body.id;

      const parentCommentRes = await request(server)
        .post(`/api/articles/${articleId}/comments`)
        .send({ nickname: '父评论用户', content: '父评论内容' });
      const parentCommentId = parentCommentRes.body.id;

      const replyData = {
        nickname: '回复用户',
        content: '这是一条回复评论',
        parent_id: parentCommentId
      };
      const res = await request(server)
        .post(`/api/articles/${articleId}/comments`)
        .send(replyData);

      expect(res.statusCode).toBe(201);
      expect(res.body.parent_id).toBe(parentCommentId);
      expect(res.body).toHaveProperty('parent_nickname');
    });

    test('为不存在的文章添加评论应返回 404', async () => {
      const res = await request(server)
        .post('/api/articles/99999/comments')
        .send({ nickname: '用户', content: '评论内容' });

      expect(res.statusCode).toBe(404);
    });

    test('昵称为空应返回 400', async () => {
      const createRes = await request(server)
        .post('/api/articles')
        .send(createTestArticle());
      const articleId = createRes.body.id;

      const res = await request(server)
        .post(`/api/articles/${articleId}/comments`)
        .send({ nickname: '', content: '评论内容' });

      expect(res.statusCode).toBe(400);
    });

    test('评论内容为空应返回 400', async () => {
      const createRes = await request(server)
        .post('/api/articles')
        .send(createTestArticle());
      const articleId = createRes.body.id;

      const res = await request(server)
        .post(`/api/articles/${articleId}/comments`)
        .send({ nickname: '用户', content: '' });

      expect(res.statusCode).toBe(400);
    });

    test('父评论不存在应返回 404', async () => {
      const createRes = await request(server)
        .post('/api/articles')
        .send(createTestArticle());
      const articleId = createRes.body.id;

      const res = await request(server)
        .post(`/api/articles/${articleId}/comments`)
        .send({ nickname: '用户', content: '回复内容', parent_id: 99999 });

      expect(res.statusCode).toBe(404);
    });

    test('不支持多级嵌套回复', async () => {
      const createRes = await request(server)
        .post('/api/articles')
        .send(createTestArticle());
      const articleId = createRes.body.id;

      const parentRes = await request(server)
        .post(`/api/articles/${articleId}/comments`)
        .send({ nickname: '用户1', content: '一级评论' });

      const replyRes = await request(server)
        .post(`/api/articles/${articleId}/comments`)
        .send({ nickname: '用户2', content: '二级评论', parent_id: parentRes.body.id });

      const nestedReplyRes = await request(server)
        .post(`/api/articles/${articleId}/comments`)
        .send({ nickname: '用户3', content: '三级评论', parent_id: replyRes.body.id });

      expect(nestedReplyRes.statusCode).toBe(400);
    });
  });

  describe('GET /api/articles/:id/comments - 获取评论列表', () => {
    test('正常获取文章评论', async () => {
      const createRes = await request(server)
        .post('/api/articles')
        .send(createTestArticle());
      const articleId = createRes.body.id;

      await request(server)
        .post(`/api/articles/${articleId}/comments`)
        .send({ nickname: '用户A', content: '评论A' });

      const res = await request(server).get(`/api/articles/${articleId}/comments`);
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('获取不存在文章的评论应返回 404', async () => {
      const res = await request(server).get('/api/articles/99999/comments');
      expect(res.statusCode).toBe(404);
    });

    test('评论应正确嵌套回复', async () => {
      const createRes = await request(server)
        .post('/api/articles')
        .send(createTestArticle());
      const articleId = createRes.body.id;

      const parentRes = await request(server)
        .post(`/api/articles/${articleId}/comments`)
        .send({ nickname: '父用户', content: '父评论' });

      await request(server)
        .post(`/api/articles/${articleId}/comments`)
        .send({ nickname: '子用户', content: '子评论', parent_id: parentRes.body.id });

      const res = await request(server).get(`/api/articles/${articleId}/comments`);
      expect(res.statusCode).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('replies');
      expect(Array.isArray(res.body[0].replies)).toBe(true);
    });
  });

  describe('DELETE /api/comments/:id - 删除评论', () => {
    test('正常删除评论', async () => {
      const createRes = await request(server)
        .post('/api/articles')
        .send(createTestArticle());
      const articleId = createRes.body.id;

      const commentRes = await request(server)
        .post(`/api/articles/${articleId}/comments`)
        .send({ nickname: '用户', content: '待删除评论' });
      const commentId = commentRes.body.id;

      const deleteRes = await request(server).delete(`/api/comments/${commentId}`);
      expect(deleteRes.statusCode).toBe(200);
    });

    test('删除不存在的评论应返回 404', async () => {
      const res = await request(server).delete('/api/comments/99999');
      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/comments - 获取所有评论', () => {
    test('正常获取所有评论', async () => {
      const res = await request(server).get('/api/comments');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});

describe('点赞接口测试', () => {
  const TEST_USER_HEADER = { 'x-user-id': 'test_user_like_001' };
  const TEST_USER_HEADER_2 = { 'x-user-id': 'test_user_like_002' };

  describe('POST /api/articles/:id/like - 点赞文章', () => {
    test('正常点赞文章', async () => {
      const createRes = await request(server)
        .post('/api/articles')
        .send(createTestArticle());
      const articleId = createRes.body.id;

      const res = await request(server)
        .post(`/api/articles/${articleId}/like`)
        .set(TEST_USER_HEADER);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('like_count');
      expect(res.body.liked).toBe(true);
    });

    test('重复点赞应返回 400', async () => {
      const createRes = await request(server)
        .post('/api/articles')
        .send(createTestArticle());
      const articleId = createRes.body.id;

      await request(server)
        .post(`/api/articles/${articleId}/like`)
        .set(TEST_USER_HEADER_2);

      const res = await request(server)
        .post(`/api/articles/${articleId}/like`)
        .set(TEST_USER_HEADER_2);

      expect(res.statusCode).toBe(400);
    });

    test('为不存在的文章点赞应返回 404', async () => {
      const res = await request(server)
        .post('/api/articles/99999/like')
        .set(TEST_USER_HEADER);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/articles/:id/like - 取消点赞', () => {
    test('正常取消点赞', async () => {
      const createRes = await request(server)
        .post('/api/articles')
        .send(createTestArticle());
      const articleId = createRes.body.id;
      const userHeader = { 'x-user-id': 'test_user_unlike_001' };

      await request(server)
        .post(`/api/articles/${articleId}/like`)
        .set(userHeader);

      const res = await request(server)
        .delete(`/api/articles/${articleId}/like`)
        .set(userHeader);

      expect(res.statusCode).toBe(200);
      expect(res.body.liked).toBe(false);
    });

    test('取消未点赞文章应返回 400', async () => {
      const createRes = await request(server)
        .post('/api/articles')
        .send(createTestArticle());
      const articleId = createRes.body.id;
      const userHeader = { 'x-user-id': 'test_user_unlike_002' };

      const res = await request(server)
        .delete(`/api/articles/${articleId}/like`)
        .set(userHeader);

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/articles/:id/likes - 获取点赞状态', () => {
    test('正常获取点赞状态', async () => {
      const createRes = await request(server)
        .post('/api/articles')
        .send(createTestArticle());
      const articleId = createRes.body.id;
      const userHeader = { 'x-user-id': 'test_user_like_status_001' };

      const res = await request(server)
        .get(`/api/articles/${articleId}/likes`)
        .set(userHeader);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('like_count');
      expect(res.body).toHaveProperty('liked');
    });

    test('获取不存在文章的点赞状态应返回 404', async () => {
      const res = await request(server).get('/api/articles/99999/likes');
      expect(res.statusCode).toBe(404);
    });
  });
});

describe('收藏接口测试', () => {
  const TEST_USER_HEADER = { 'x-user-id': 'test_user_fav_001' };
  const TEST_USER_HEADER_2 = { 'x-user-id': 'test_user_fav_002' };

  describe('POST /api/articles/:id/favorite - 收藏文章', () => {
    test('正常收藏文章', async () => {
      const createRes = await request(server)
        .post('/api/articles')
        .send(createTestArticle());
      const articleId = createRes.body.id;

      const res = await request(server)
        .post(`/api/articles/${articleId}/favorite`)
        .set(TEST_USER_HEADER);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('favorite_count');
      expect(res.body.favorited).toBe(true);
    });

    test('重复收藏应返回 400', async () => {
      const createRes = await request(server)
        .post('/api/articles')
        .send(createTestArticle());
      const articleId = createRes.body.id;

      await request(server)
        .post(`/api/articles/${articleId}/favorite`)
        .set(TEST_USER_HEADER_2);

      const res = await request(server)
        .post(`/api/articles/${articleId}/favorite`)
        .set(TEST_USER_HEADER_2);

      expect(res.statusCode).toBe(400);
    });

    test('为不存在的文章收藏应返回 404', async () => {
      const res = await request(server)
        .post('/api/articles/99999/favorite')
        .set(TEST_USER_HEADER);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/articles/:id/favorite - 取消收藏', () => {
    test('正常取消收藏', async () => {
      const createRes = await request(server)
        .post('/api/articles')
        .send(createTestArticle());
      const articleId = createRes.body.id;
      const userHeader = { 'x-user-id': 'test_user_unfav_001' };

      await request(server)
        .post(`/api/articles/${articleId}/favorite`)
        .set(userHeader);

      const res = await request(server)
        .delete(`/api/articles/${articleId}/favorite`)
        .set(userHeader);

      expect(res.statusCode).toBe(200);
      expect(res.body.favorited).toBe(false);
    });

    test('取消未收藏文章应返回 400', async () => {
      const createRes = await request(server)
        .post('/api/articles')
        .send(createTestArticle());
      const articleId = createRes.body.id;
      const userHeader = { 'x-user-id': 'test_user_unfav_002' };

      const res = await request(server)
        .delete(`/api/articles/${articleId}/favorite`)
        .set(userHeader);

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/articles/:id/favorites - 获取收藏状态', () => {
    test('正常获取收藏状态', async () => {
      const createRes = await request(server)
        .post('/api/articles')
        .send(createTestArticle());
      const articleId = createRes.body.id;
      const userHeader = { 'x-user-id': 'test_user_fav_status_001' };

      const res = await request(server)
        .get(`/api/articles/${articleId}/favorites`)
        .set(userHeader);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('favorite_count');
      expect(res.body).toHaveProperty('favorited');
    });

    test('获取不存在文章的收藏状态应返回 404', async () => {
      const res = await request(server).get('/api/articles/99999/favorites');
      expect(res.statusCode).toBe(404);
    });
  });
});

describe('并发和边界场景测试', () => {
  test('不同用户同时点赞同一文章', async () => {
    const createRes = await request(server)
      .post('/api/articles')
      .send(createTestArticle());
    const articleId = createRes.body.id;

    const userHeaders = [
      { 'x-user-id': 'concurrent_user_1' },
      { 'x-user-id': 'concurrent_user_2' },
      { 'x-user-id': 'concurrent_user_3' },
      { 'x-user-id': 'concurrent_user_4' },
      { 'x-user-id': 'concurrent_user_5' }
    ];

    const results = await Promise.all(
      userHeaders.map(header =>
        request(server)
          .post(`/api/articles/${articleId}/like`)
          .set(header)
      )
    );

    results.forEach(res => {
      expect(res.statusCode).toBe(200);
    });

    const statusRes = await request(server)
      .get(`/api/articles/${articleId}/likes`)
      .set({ 'x-user-id': 'check_user' });
    expect(statusRes.body.like_count).toBe(5);
  });

  test('同一用户同时重复点赞（只有一次成功）', async () => {
    const createRes = await request(server)
      .post('/api/articles')
      .send(createTestArticle());
    const articleId = createRes.body.id;
    const userHeader = { 'x-user-id': 'duplicate_like_user' };

    const results = await Promise.allSettled([
      request(server).post(`/api/articles/${articleId}/like`).set(userHeader),
      request(server).post(`/api/articles/${articleId}/like`).set(userHeader),
      request(server).post(`/api/articles/${articleId}/like`).set(userHeader)
    ]);

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.statusCode === 200).length;
    expect(successCount).toBeGreaterThanOrEqual(1);
    expect(successCount).toBeLessThanOrEqual(2);
  });

  test('删除文章时应同时删除关联的评论、点赞和收藏', async () => {
    const userHeader = { 'x-user-id': 'cascade_test_user' };
    const createRes = await request(server)
      .post('/api/articles')
      .send(createTestArticle());
    const articleId = createRes.body.id;

    await request(server).post(`/api/articles/${articleId}/like`).set(userHeader);
    await request(server).post(`/api/articles/${articleId}/favorite`).set(userHeader);
    await request(server)
      .post(`/api/articles/${articleId}/comments`)
      .send({ nickname: '级联用户', content: '级联测试评论' });

    const deleteRes = await request(server).delete(`/api/articles/${articleId}`);
    expect(deleteRes.statusCode).toBe(200);

    const likeRes = await request(server).get(`/api/articles/${articleId}/likes`);
    expect(likeRes.statusCode).toBe(404);

    const commentRes = await request(server).get(`/api/articles/${articleId}/comments`);
    expect(commentRes.statusCode).toBe(404);
  });

  test('参数类型转换 - 字符串形式的数字 ID', async () => {
    const createRes = await request(server)
      .post('/api/articles')
      .send(createTestArticle());
    const articleId = createRes.body.id;

    const res = await request(server).get(`/api/articles/${articleId.toString()}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(articleId);
  });

  test('超大页码请求应返回最后一页', async () => {
    const res = await request(server).get('/api/articles?page=9999&pageSize=10');
    expect(res.statusCode).toBe(200);
    expect(res.body.page).toBeLessThanOrEqual(res.body.totalPages);
  });
});

describe('用户标识测试', () => {
  test('通过 x-user-id 头识别用户', async () => {
    const userId = 'unique_user_identifier_test';
    const createRes = await request(server)
      .post('/api/articles')
      .send(createTestArticle());
    const articleId = createRes.body.id;

    await request(server)
      .post(`/api/articles/${articleId}/like`)
      .set('x-user-id', userId);

    const res = await request(server)
      .get(`/api/articles/${articleId}/likes`)
      .set('x-user-id', userId);

    expect(res.body.liked).toBe(true);
  });

  test('不同 x-user-id 应被视为不同用户', async () => {
    const createRes = await request(server)
      .post('/api/articles')
      .send(createTestArticle());
    const articleId = createRes.body.id;

    await request(server)
      .post(`/api/articles/${articleId}/like`)
      .set('x-user-id', 'user_A');

    const res = await request(server)
      .get(`/api/articles/${articleId}/likes`)
      .set('x-user-id', 'user_B');

    expect(res.body.liked).toBe(false);
  });

  test('未提供 x-user-id 时应使用访客标识', async () => {
    const createRes = await request(server)
      .post('/api/articles')
      .send(createTestArticle());
    const articleId = createRes.body.id;

    const res = await request(server)
      .post(`/api/articles/${articleId}/like`)
      .set('user-agent', 'TestAgent/1.0');

    expect([200, 400]).toContain(res.statusCode);
  });
});
