/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',
  
  // Node.js test environment
  testEnvironment: 'node',
  
  // Root directories for tests
  roots: ['<rootDir>/base'],
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.spec.ts'
  ],
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Coverage configuration
  collectCoverage: false, // Enable via --coverage flag
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'base/**/*.ts',
    '!base/**/*.d.ts',
    '!base/__tests__/**',
    '!base/test-*.ts'
  ],
  
  // Coverage thresholds - start with lower thresholds, increase as tests are added
  // Target: 80% for all metrics after Phase 9 is complete
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0
    }
  },
  
  // Transform TypeScript files
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  },
  
  // Module path aliases (if needed)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/base/$1'
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/base/__tests__/setup.ts'],
  
  // Test timeout (30 seconds for integration tests)
  testTimeout: 30000,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Verbose output
  verbose: true,
  
  // CI-friendly configuration
  ...(process.env.CI && {
    ci: true,
    reporters: ['default', 'jest-junit'],
    coverageReporters: ['text', 'lcov']
  })
};
