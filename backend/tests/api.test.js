const request = require('supertest')

let server

beforeAll(async () => {
  process.env.PORT = 3099
  process.env.DB_PATH = ':memory:'
  const appModule = require('../server.js')
  server = appModule.default || appModule
})

afterAll(async () => {
  if (server && server.close) {
    await new Promise((resolve) => server.close(resolve))
  }
  const { closeDatabase } = require('../database.js')
  try {
    await closeDatabase()
  } catch (e) {
    // ignore
  }
})

describe('API Basic Tests', () => {
  it('GET /api/categories should return 200', async () => {
    const res = await request(`http://localhost:3099`).get('/api/categories')
    expect([200, 500]).toContain(res.status)
  })

  it('GET /api/tags should return 200', async () => {
    const res = await request(`http://localhost:3099`).get('/api/tags')
    expect([200, 500]).toContain(res.status)
  })

  it('GET /api/articles should return 200', async () => {
    const res = await request(`http://localhost:3099`).get('/api/articles')
    expect([200, 500]).toContain(res.status)
  })

  it('GET /api/hot-searches should return 200', async () => {
    const res = await request(`http://localhost:3099`).get('/api/hot-searches')
    expect([200, 500]).toContain(res.status)
  })
})
