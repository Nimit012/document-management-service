/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Test file patterns
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.ts',
    'providers/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**',
    '!**/node_modules/**',
    '!**/dist/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Coverage thresholds (optional - enforces minimum coverage)
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Module paths
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Transform files with ts-jest
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  
  // Setup files (we'll create this next)
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  
  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Verbose output
  verbose: true
};