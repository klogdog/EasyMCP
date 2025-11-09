# Task 9.5: Write Integration Tests

**Goal**: Test complete workflows from module loading to Docker image creation.

**Actions**:

- Create `base/__tests__/integration/` directory for integration tests
- Test end-to-end build: real tools/connectors dirs, run full generator, verify image created (use testcontainers or actual Docker)
- Test Docker image creation: verify generated Dockerfile valid, builds successfully, contains expected files
- Test generated server startup: start container, verify listens on port, /health returns 200
- Test tool invocation: make MCP protocol request to generated server, verify tool executes and returns result
- Test connector integration: if connector requires external service, mock with nock or use test credentials
- Use temporary directories: create fresh test workspace for each test, cleanup after
- Add longer timeout: integration tests may take 30-60s, configure Jest timeout
- Tag tests: use describe.skip or test.only for conditional execution

**Success Criteria**: End-to-end workflows tested; real Docker operations; verifies generated server works; isolated tests
