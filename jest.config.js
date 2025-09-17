module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'json'
  ],
  testMatch: [
    '**/__tests__/**/*.js',
    '**/*.test.js'
  ]
};
