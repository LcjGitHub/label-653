import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as api from '../services/api.js'

const originalFetch = global.fetch

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

afterEach(() => {
  global.fetch = originalFetch
})

function createMockResponse(data, options = {}) {
  const response = {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    json: vi.fn().mockResolvedValue(data),
    blob: vi.fn().mockResolvedValue(new Blob([JSON.stringify(data)]))
  }
  if (options.headers) {
    response.headers = options.headers
  }
  return response
}

function createMockFetch(response) {
  return vi.fn().mockResolvedValue(response)
}

describe('API 服务层 - 用户标识', () => {
  it('首次请求时应创建并存储用户 ID', () => {
    expect(localStorage.getItem('blog_user_identifier')).toBeNull()

    global.fetch = createMockFetch(createMockResponse([]))

    api.getCategories()

    const userId = localStorage.getItem('blog_user_identifier')
    expect(userId).toBeTruthy()
    expect(userId.startsWith('user_')).toBe(true)
  })

  it('后续请求应复用已存在的用户 ID', () => {
    const existingUserId = 'user_existing_test_123'
    localStorage.setItem('blog_user_identifier', existingUserId)

    global.fetch = createMockFetch(createMockResponse([]))

    api.getCategories()
    api.getTags()

    expect(localStorage.getItem('blog_user_identifier')).toBe(existingUserId)
  })
})

describe('API 服务层 - 基础请求', () => {
  it('请求应自动添加 x-user-id 头', async () => {
    const userId = 'user_header_test'
    localStorage.setItem('blog_user_identifier', userId)

    global.fetch = createMockFetch(createMockResponse([]))

    await api.getCategories()

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const callArgs = global.fetch.mock.calls[0]
    expect(callArgs[1].headers).toHaveProperty('x-user-id')
    expect(callArgs[1].headers['x-user-id']).toBe(userId)
  })

  it('请求 URL 应以 /api 开头', async () => {
    global.fetch = createMockFetch(createMockResponse([]))

    await api.getCategories()

    const callArgs = global.fetch.mock.calls[0]
    expect(callArgs[0]).toMatch(/^\/api\//)
  })
})

describe('API 服务层 - 错误处理', () => {
  it('应正确抛出服务端错误消息', async () => {
    const errorMessage = '服务器内部错误'
    const mockResponse = createMockResponse(
      { error: errorMessage },
      { ok: false, status: 500 }
    )
    global.fetch = createMockFetch(mockResponse)

    await expect(api.getCategories()).rejects.toThrow(errorMessage)
  })

  it('响应不是 JSON 格式时应抛出网络错误', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token'))
    }
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    await expect(api.getCategories()).rejects.toThrow('网络请求失败')
  })

  it('网络连接失败应抛出网络错误', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'))

    await expect(api.getCategories()).rejects.toThrow('网络请求失败')
  })
})

describe('API 服务层 - 分类与标签', () => {
  it('getCategories 应正确请求分类接口', async () => {
    const mockCategories = [
      { id: 1, name: '技术', article_count: 10 },
      { id: 2, name: '生活', article_count: 5 }
    ]
    global.fetch = createMockFetch(createMockResponse(mockCategories))

    const result = await api.getCategories()

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/categories',
      expect.objectContaining({
        headers: expect.any(Object)
      })
    )
    expect(result).toEqual(mockCategories)
  })

  it('getTags 应正确请求标签接口', async () => {
    const mockTags = [
      { id: 1, name: 'JavaScript', article_count: 8 }
    ]
    global.fetch = createMockFetch(createMockResponse(mockTags))

    const result = await api.getTags()

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/tags',
      expect.anything()
    )
    expect(result).toEqual(mockTags)
  })
})

describe('API 服务层 - 文章接口', () => {
  describe('getArticles', () => {
    it('无筛选参数时应正确请求', async () => {
      const mockData = {
        articles: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 1
      }
      global.fetch = createMockFetch(createMockResponse(mockData))

      const result = await api.getArticles()

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/articles',
        expect.anything()
      )
      expect(result).toEqual(mockData)
    })

    it('带分类筛选参数应正确拼接 URL', async () => {
      global.fetch = createMockFetch(createMockResponse({ articles: [] }))

      await api.getArticles({ category: 2 })

      const callUrl = global.fetch.mock.calls[0][0]
      expect(callUrl).toContain('category=2')
    })

    it('带标签筛选参数应正确拼接 URL', async () => {
      global.fetch = createMockFetch(createMockResponse({ articles: [] }))

      await api.getArticles({ tag: 3 })

      const callUrl = global.fetch.mock.calls[0][0]
      expect(callUrl).toContain('tag=3')
    })

    it('带分页参数应正确拼接 URL', async () => {
      global.fetch = createMockFetch(createMockResponse({ articles: [] }))

      await api.getArticles({ page: 2, pageSize: 20 })

      const callUrl = global.fetch.mock.calls[0][0]
      expect(callUrl).toContain('page=2')
      expect(callUrl).toContain('pageSize=20')
    })

    it('带排序参数应正确拼接 URL', async () => {
      global.fetch = createMockFetch(createMockResponse({ articles: [] }))

      await api.getArticles({ sort: 'likes_desc' })

      const callUrl = global.fetch.mock.calls[0][0]
      expect(callUrl).toContain('sort=likes_desc')
    })

    it('多个筛选参数应全部正确拼接', async () => {
      global.fetch = createMockFetch(createMockResponse({ articles: [] }))

      await api.getArticles({ category: 1, page: 2, pageSize: 15, sort: 'created_desc' })

      const callUrl = global.fetch.mock.calls[0][0]
      expect(callUrl).toContain('category=1')
      expect(callUrl).toContain('page=2')
      expect(callUrl).toContain('pageSize=15')
      expect(callUrl).toContain('sort=created_desc')
    })
  })

  describe('getDrafts', () => {
    it('应请求草稿列表接口', async () => {
      const mockData = { articles: [], total: 0, page: 1, pageSize: 10, totalPages: 1 }
      global.fetch = createMockFetch(createMockResponse(mockData))

      const result = await api.getDrafts()

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/articles/drafts/list'),
        expect.anything()
      )
      expect(result).toEqual(mockData)
    })

    it('带分页参数', async () => {
      global.fetch = createMockFetch(createMockResponse({ articles: [] }))

      await api.getDrafts({ page: 1, pageSize: 5 })

      const callUrl = global.fetch.mock.calls[0][0]
      expect(callUrl).toContain('page=1')
      expect(callUrl).toContain('pageSize=5')
    })
  })

  describe('getArticle', () => {
    it('应请求单篇文章详情', async () => {
      const mockArticle = { id: 1, title: '测试文章' }
      global.fetch = createMockFetch(createMockResponse(mockArticle))

      const result = await api.getArticle(1)

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/articles/1',
        expect.anything()
      )
      expect(result).toEqual(mockArticle)
    })
  })

  describe('createArticle', () => {
    it('应使用 POST 方法并发送 JSON 数据', async () => {
      const articleData = {
        title: '新文章',
        content: '<p>内容</p>'
      }
      const mockResponse = { id: 1, ...articleData }
      global.fetch = createMockFetch(createMockResponse(mockResponse, { status: 201 }))

      const result = await api.createArticle(articleData)

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/articles',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(articleData)
        })
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('updateArticle', () => {
    it('应使用 PUT 方法更新文章', async () => {
      const updateData = { title: '更新标题', content: '<p>更新内容</p>' }
      const mockResponse = { id: 1, ...updateData }
      global.fetch = createMockFetch(createMockResponse(mockResponse))

      const result = await api.updateArticle(1, updateData)

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/articles/1',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(updateData)
        })
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('deleteArticle', () => {
    it('应使用 DELETE 方法删除文章', async () => {
      global.fetch = createMockFetch(createMockResponse({ message: '删除成功' }))

      const result = await api.deleteArticle(1)

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/articles/1',
        expect.objectContaining({
          method: 'DELETE'
        })
      )
      expect(result).toEqual({ message: '删除成功' })
    })
  })
})

describe('API 服务层 - 评论接口', () => {
  describe('getComments', () => {
    it('应获取文章评论列表', async () => {
      const mockComments = [
        { id: 1, nickname: '用户', content: '评论内容', replies: [] }
      ]
      global.fetch = createMockFetch(createMockResponse(mockComments))

      const result = await api.getComments(1)

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/articles/1/comments',
        expect.anything()
      )
      expect(result).toEqual(mockComments)
    })
  })

  describe('createComment', () => {
    it('应使用 POST 方法添加评论', async () => {
      const commentData = { nickname: '用户', content: '评论内容' }
      const mockResponse = { id: 1, ...commentData }
      global.fetch = createMockFetch(createMockResponse(mockResponse, { status: 201 }))

      const result = await api.createComment(1, commentData)

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/articles/1/comments',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(commentData)
        })
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('deleteComment', () => {
    it('应使用 DELETE 方法删除评论', async () => {
      global.fetch = createMockFetch(createMockResponse({ message: '评论删除成功' }))

      const result = await api.deleteComment(1)

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/comments/1',
        expect.objectContaining({
          method: 'DELETE'
        })
      )
      expect(result).toEqual({ message: '评论删除成功' })
    })
  })

  describe('getAllComments', () => {
    it('应获取所有评论', async () => {
      const mockComments = []
      global.fetch = createMockFetch(createMockResponse(mockComments))

      const result = await api.getAllComments()

      expect(global.fetch).toHaveBeenCalledWith('/api/comments', expect.anything())
      expect(result).toEqual(mockComments)
    })
  })
})

describe('API 服务层 - 搜索接口', () => {
  it('searchArticles 应正确拼接搜索参数', async () => {
    const mockResult = { keyword: '测试', articles: [], total: 0 }
    global.fetch = createMockFetch(createMockResponse(mockResult))

    const result = await api.searchArticles('测试')

    const callUrl = global.fetch.mock.calls[0][0]
    expect(callUrl).toContain('/api/articles/search')
    expect(callUrl).toContain('q=%E6%B5%8B%E8%AF%95')
    expect(result).toEqual(mockResult)
  })

  it('searchArticles 应支持分页参数', async () => {
    global.fetch = createMockFetch(createMockResponse({ articles: [] }))

    await api.searchArticles('关键词', { page: 2, pageSize: 20 })

    const callUrl = global.fetch.mock.calls[0][0]
    expect(callUrl).toContain('page=2')
    expect(callUrl).toContain('pageSize=20')
  })

  it('getHotSearches 应获取热门搜索', async () => {
    const mockHot = [{ keyword: 'JavaScript', count: 10 }]
    global.fetch = createMockFetch(createMockResponse(mockHot))

    const result = await api.getHotSearches()

    expect(global.fetch).toHaveBeenCalledWith('/api/hot-searches', expect.anything())
    expect(result).toEqual(mockHot)
  })
})

describe('API 服务层 - 点赞接口', () => {
  describe('likeArticle', () => {
    it('应使用 POST 方法点赞', async () => {
      global.fetch = createMockFetch(createMockResponse({ like_count: 10, liked: true }))

      const result = await api.likeArticle(1)

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/articles/1/like',
        expect.objectContaining({
          method: 'POST'
        })
      )
      expect(result).toEqual({ like_count: 10, liked: true })
    })
  })

  describe('unlikeArticle', () => {
    it('应使用 DELETE 方法取消点赞', async () => {
      global.fetch = createMockFetch(createMockResponse({ like_count: 9, liked: false }))

      const result = await api.unlikeArticle(1)

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/articles/1/like',
        expect.objectContaining({
          method: 'DELETE'
        })
      )
      expect(result).toEqual({ like_count: 9, liked: false })
    })
  })

  describe('getArticleLikes', () => {
    it('应获取点赞状态', async () => {
      global.fetch = createMockFetch(createMockResponse({ like_count: 5, liked: false }))

      const result = await api.getArticleLikes(1)

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/articles/1/likes',
        expect.anything()
      )
      expect(result).toEqual({ like_count: 5, liked: false })
    })
  })
})

describe('API 服务层 - 收藏接口', () => {
  describe('favoriteArticle', () => {
    it('应使用 POST 方法收藏', async () => {
      global.fetch = createMockFetch(createMockResponse({ favorite_count: 10, favorited: true }))

      const result = await api.favoriteArticle(1)

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/articles/1/favorite',
        expect.objectContaining({
          method: 'POST'
        })
      )
      expect(result).toEqual({ favorite_count: 10, favorited: true })
    })
  })

  describe('unfavoriteArticle', () => {
    it('应使用 DELETE 方法取消收藏', async () => {
      global.fetch = createMockFetch(createMockResponse({ favorite_count: 9, favorited: false }))

      const result = await api.unfavoriteArticle(1)

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/articles/1/favorite',
        expect.objectContaining({
          method: 'DELETE'
        })
      )
      expect(result).toEqual({ favorite_count: 9, favorited: false })
    })
  })

  describe('getArticleFavorites', () => {
    it('应获取收藏状态', async () => {
      global.fetch = createMockFetch(createMockResponse({ favorite_count: 3, favorited: true }))

      const result = await api.getArticleFavorites(1)

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/articles/1/favorites',
        expect.anything()
      )
      expect(result).toEqual({ favorite_count: 3, favorited: true })
    })
  })
})

describe('API 服务层 - 其他接口', () => {
  describe('getArticleStats', () => {
    it('应获取文章统计数据', async () => {
      const mockStats = [
        { id: 1, title: '文章1', like_count: 5, favorite_count: 2, comment_count: 3 }
      ]
      global.fetch = createMockFetch(createMockResponse(mockStats))

      const result = await api.getArticleStats()

      expect(global.fetch).toHaveBeenCalledWith('/api/articles/stats', expect.anything())
      expect(result).toEqual(mockStats)
    })
  })

  describe('pinArticle', () => {
    it('应使用 PUT 方法切换置顶状态', async () => {
      global.fetch = createMockFetch(createMockResponse({ message: '置顶成功' }))

      const result = await api.pinArticle(1, true)

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/articles/1/pin',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({ pinned: true })
        })
      )
      expect(result).toEqual({ message: '置顶成功' })
    })
  })

  describe('getShareLink', () => {
    it('应获取分享链接', async () => {
      const mockShare = {
        share_url: '/article/1?share=xxx',
        share_token: 'xxx',
        article_id: 1
      }
      global.fetch = createMockFetch(createMockResponse(mockShare))

      const result = await api.getShareLink(1)

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/articles/1/share',
        expect.anything()
      )
      expect(result).toEqual(mockShare)
    })
  })

  describe('exportArticle', () => {
    it('应导出文章并返回原始响应', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('attachment; filename="test.md"')
        },
        blob: vi.fn().mockResolvedValue(new Blob(['# 测试内容']))
      }
      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      const result = await api.exportArticle(1, 'markdown')

      expect(global.fetch).toHaveBeenCalled()
      const callArgs = global.fetch.mock.calls[0]
      expect(callArgs[0]).toContain('/api/articles/1/export')
      expect(callArgs[0]).toContain('format=markdown')
      expect(result).toBe(mockResponse)
    })

    it('导出失败时应抛出错误', async () => {
      const errorMessage = '导出失败'
      const mockResponse = createMockResponse(
        { error: errorMessage },
        { ok: false, status: 500 }
      )
      global.fetch = createMockFetch(mockResponse)

      await expect(api.exportArticle(999)).rejects.toThrow(errorMessage)
    })
  })

  describe('exportArticlesBatch', () => {
    it('应批量导出文章', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        blob: vi.fn().mockResolvedValue(new Blob(['zip data']))
      }
      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      const result = await api.exportArticlesBatch([1, 2, 3], 'markdown')

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/articles/export/batch',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({ ids: [1, 2, 3], format: 'markdown' })
        })
      )
      expect(result).toBe(mockResponse)
    })

    it('批量导出失败时应抛出错误', async () => {
      const errorMessage = '批量导出失败'
      const mockResponse = createMockResponse(
        { error: errorMessage },
        { ok: false, status: 500 }
      )
      global.fetch = createMockFetch(mockResponse)

      await expect(api.exportArticlesBatch([])).rejects.toThrow(errorMessage)
    })
  })

  describe('downloadFromResponse', () => {
    it('应从响应中下载文件', async () => {
      const mockBlob = new Blob(['test content'], { type: 'text/plain' })
      const mockResponse = {
        blob: vi.fn().mockResolvedValue(mockBlob),
        headers: {
          get: vi.fn().mockReturnValue('attachment; filename="test.txt"')
        }
      }

      const mockCreateObjectURL = vi.fn().mockReturnValue('blob:test-url')
      window.URL.createObjectURL = mockCreateObjectURL
      window.URL.revokeObjectURL = vi.fn()

      const mockAnchor = document.createElement('a')
      mockAnchor.click = vi.fn()
      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor)
      vi.spyOn(document.body, 'appendChild')
      vi.spyOn(document.body, 'removeChild')

      await api.downloadFromResponse(mockResponse, 'custom.txt')

      expect(mockResponse.blob).toHaveBeenCalled()
      expect(document.createElement).toHaveBeenCalledWith('a')
      expect(mockAnchor.download).toBe('custom.txt')
      expect(mockAnchor.click).toHaveBeenCalled()
      expect(document.body.appendChild).toHaveBeenCalled()
      expect(document.body.removeChild).toHaveBeenCalled()
      expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url')
    })

    it('未指定文件名时应从响应头获取文件名', async () => {
      const mockBlob = new Blob(['content'])
      const mockResponse = {
        blob: vi.fn().mockResolvedValue(mockBlob),
        headers: {
          get: vi.fn().mockReturnValue('attachment; filename="from-header.txt"')
        }
      }

      window.URL.createObjectURL = vi.fn().mockReturnValue('blob:url')
      window.URL.revokeObjectURL = vi.fn()

      const mockAnchor = document.createElement('a')
      mockAnchor.click = vi.fn()
      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor)
      vi.spyOn(document.body, 'appendChild')
      vi.spyOn(document.body, 'removeChild')

      await api.downloadFromResponse(mockResponse)

      expect(mockAnchor.download).toBe('from-header.txt')
    })
  })
})
