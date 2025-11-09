# Task 11.5: Add Testing Framework for Generated Servers

**Goal**: Provide testing utilities for validating generated MCP servers.

**Actions**:

- Create `base/testing/test-harness.ts` with utilities for testing generated servers
- Build MCP protocol tester: class MCPClient with methods `callTool(name, args)`, `listTools()`, verifies JSON-RPC 2.0 protocol compliance
- Implement tool mocking framework: allow replacing real tool implementations with mocks for testing, `mockTool(name, mockFn)`
- Add load testing tools: use autocannon or k6, create scripts for stress testing MCP endpoints, configurable concurrency/duration
- Create regression test generator: capture actual tool invocations, save as test cases, replay to detect behavior changes
- Include assertion helpers: `expectToolResponse(expected)`, `expectError(errorCode)`, `expectConnectorState(state)`
- Add Docker test helpers: start/stop test containers, cleanup, port management
- Create example test suite: demonstrate testing custom MCP server with multiple tools
- Document testing best practices: unit vs integration, mocking strategies, performance testing

**Success Criteria**: Test harness works; MCP client validates protocol; mocking system functional; load tests run; documented
