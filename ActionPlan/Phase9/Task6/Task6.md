# Task 9.6: Create Example End-to-End Test

**Goal**: Build complete example test demonstrating full MCP server lifecycle.

**Actions**:

- Create `base/__tests__/integration/e2e-example.test.ts` with detailed comments
- Set up test workspace: create temp dir, copy example tools (summarize, translate), example connector (notion-mock)
- Build MCP server: run generator programmatically, capture manifest, config, image ID
- Launch container: start generated server, wait for health check, map to random port
- Execute tool via MCP: send JSON-RPC request to summarize tool, verify response format and result
- Test connector (mocked): verify connector initialized, mock external API call, verify success
- Validate configuration: verify config file used, environment variables respected
- Cleanup: stop and remove container, remove image, delete temp workspace
- Add assertions at each step: verify intermediate outputs, check error conditions
- Document expected behavior: comments explaining what each step validates

**Success Criteria**: Complete example test; well-documented; demonstrates best practices; serves as template for custom tests
