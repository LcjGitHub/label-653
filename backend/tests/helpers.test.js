describe('Helper Functions', () => {
  it('should run basic assertions', () => {
    expect(1 + 1).toBe(2)
    expect(true).toBe(true)
    expect(typeof console.log).toBe('function')
  })

  it('should handle string operations', () => {
    const str = 'Hello World'
    expect(str.toUpperCase()).toBe('HELLO WORLD')
    expect(str.split(' ')).toHaveLength(2)
  })
})
