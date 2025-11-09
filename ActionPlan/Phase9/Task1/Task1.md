# Task 9.1: Set Up Testing Framework

**Goal**: Configure Jest testing framework with TypeScript support.

**Actions**:

- Run `npm install --save-dev jest @types/jest ts-jest @jest/globals`
- Create `jest.config.js`: preset "ts-jest", testEnvironment "node", roots ["<rootDir>/base"], coverage enabled
- Add test scripts to package.json: `"test": "jest"`, `"test:watch": "jest --watch"`, `"test:coverage": "jest --coverage"`
- Set up coverage reporting: coverageDirectory "./coverage", coverageThreshold 80%, reporters text and lcov
- Create test utilities in `base/__tests__/utils/`: mock Docker client, mock file system, test fixtures
- Add test fixtures directory: sample tools, connectors, configs for testing
- Configure CI-friendly output: `--ci` flag for test script in CI environments

**Success Criteria**: Jest configured; can run tests with `npm test`; coverage reports generated; test utilities available
