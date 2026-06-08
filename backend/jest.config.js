module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!**/tests/**',
    '!**/coverage/**',
    '!jest.config.js',
  ],
  coverageReporters: ['text', 'json', 'html'],
  testTimeout: 15000,
  transformIgnorePatterns: [
    'node_modules/(?!(archiver|@louislam/sqlite3)/)'
  ],
  moduleNameMapper: {
    '^archiver$': '<rootDir>/tests/__mocks__/archiver.js',
    '^pdfkit$': '<rootDir>/tests/__mocks__/pdfkit.js',
    '^turndown$': '<rootDir>/tests/__mocks__/turndown.js'
  }
}
