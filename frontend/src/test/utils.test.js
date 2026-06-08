import { describe, it, expect } from 'vitest'
import { debounce } from '../utils/debounce.js'

describe('debounce utility', () => {
  it('should be a function', () => {
    expect(typeof debounce).toBe('function')
  })

  it('should return a function', () => {
    const debounced = debounce(() => {}, 100)
    expect(typeof debounced).toBe('function')
  })
})
