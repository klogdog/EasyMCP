# Task Checklist for Phase 9: Testing & Quality

## Overview

This phase focuses on testing & quality.

## Tasks

### Task 9.1: Set Up Testing Framework

- [x] Run `npm install --save-dev jest @types/jest ts-jest @jest/globals`
- [x] Create `jest.config.js`: preset "ts-jest", testEnvironment "node", roots ["<rootDir>/base"], coverage enabled
- [x] Add test scripts to package.json: `"test": "jest"`, `"test:watch": "jest --watch"`, `"test:coverage": "jest --coverage"`
- [x] Set up coverage reporting: coverageDirectory "./coverage", coverageThreshold 80%, reporters text and lcov
- [x] Create test utilities in `base/__tests__/utils/`: mock Docker client, mock file system, test fixtures
- [x] Add test fixtures directory: sample tools, connectors, configs for testing
- [x] Configure CI-friendly output: `--ci` flag for test script in CI environments
- [x] **Success Criteria**: Jest configured; can run tests with `npm test`; coverage reports generated; test utilities available


### Task 9.2: Write Unit Tests - Loader

- [ ] Create `base/__tests__/loader.test.ts`
- [ ] Test module discovery: mock fs with sample tools, verify loadModules finds all .ts/.py files
- [ ] Test file filtering: verify non-matching extensions ignored, hidden files skipped
- [ ] Test metadata extraction: verify name, description, dependencies correctly parsed from different formats
- [ ] Test error handling: malformed metadata, missing files, unreadable files - should log warning and continue
- [ ] Test edge cases: empty directories, symlinks, nested directories, very long paths
- [ ] Mock file system: use memfs or mock fs.promises for fast, isolated tests
- [ ] Aim for >90% coverage of loader.ts
- [ ] **Success Criteria**: Comprehensive test coverage; tests pass; edge cases covered; runs fast (<1s)


### Task 9.3: Write Unit Tests - Generator

- [ ] Create `base/__tests__/generator.test.ts`
- [ ] Test manifest generation: provide array of modules, verify output manifest has correct structure
- [ ] Test tool merging: multiple tools with different capabilities, verify all included, no duplicates
- [ ] Test conflict detection: tools with same name, verify error thrown with clear message
- [ ] Test validation rules: invalid tool schema, missing required fields, verify rejected with reason
- [ ] Test schema versioning: different schema versions, verify handled correctly or error if unsupported
- [ ] Mock validator and loader dependencies
- [ ] Verify capabilities aggregation: ensure unique capabilities listed
- [ ] Test dependency resolution: conflicting versions, verify highest compatible chosen
- [ ] **Success Criteria**: All generator logic tested; >85% coverage; validates error cases; fast execution


### Task 9.4: Write Unit Tests - Config

- [ ] Create `base/__tests__/config-parser.test.ts`
- [ ] Test config generation: given manifest and secrets, verify valid YAML produced
- [ ] Test variable substitution: ${VAR}, ${VAR:-default}, nested vars, verify all replaced correctly
- [ ] Test schema validation: valid config passes, invalid configs rejected with field-level errors
- [ ] Test override merging: base + overrides, verify correct precedence, deep merge behavior
- [ ] Test parsing errors: invalid YAML syntax, verify error has line number and helpful message
- [ ] Mock environment variables using process.env manipulation
- [ ] Test default values: missing optional fields get defaults from schema
- [ ] Test circular references: ensure doesn't cause infinite loops
- [ ] **Success Criteria**: Config parser thoroughly tested; >90% coverage; validates all merge scenarios; clear error messages


### Task 9.5: Write Integration Tests

- [ ] Create `base/__tests__/integration/` directory for integration tests
- [ ] Test end-to-end build: real tools/connectors dirs, run full generator, verify image created (use testcontainers or actual Docker)
- [ ] Test Docker image creation: verify generated Dockerfile valid, builds successfully, contains expected files
- [ ] Test generated server startup: start container, verify listens on port, /health returns 200
- [ ] Test tool invocation: make MCP protocol request to generated server, verify tool executes and returns result
- [ ] Test connector integration: if connector requires external service, mock with nock or use test credentials
- [ ] Use temporary directories: create fresh test workspace for each test, cleanup after
- [ ] Add longer timeout: integration tests may take 30-60s, configure Jest timeout
- [ ] Tag tests: use describe.skip or test.only for conditional execution
- [ ] **Success Criteria**: End-to-end workflows tested; real Docker operations; verifies generated server works; isolated tests


### Task 9.6: Create Example End-to-End Test

- [ ] Create `base/__tests__/integration/e2e-example.test.ts` with detailed comments
- [ ] Set up test workspace: create temp dir, copy example tools (summarize, translate), example connector (notion-mock)
- [ ] Build MCP server: run generator programmatically, capture manifest, config, image ID
- [ ] Launch container: start generated server, wait for health check, map to random port
- [ ] Execute tool via MCP: send JSON-RPC request to summarize tool, verify response format and result
- [ ] Test connector (mocked): verify connector initialized, mock external API call, verify success
- [ ] Validate configuration: verify config file used, environment variables respected
- [ ] Cleanup: stop and remove container, remove image, delete temp workspace
- [ ] Add assertions at each step: verify intermediate outputs, check error conditions
- [ ] Document expected behavior: comments explaining what each step validates
- [ ] **Success Criteria**: Complete example test; well-documented; demonstrates best practices; serves as template for custom tests

