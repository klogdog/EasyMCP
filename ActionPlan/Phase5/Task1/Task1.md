# Task 5.1: Create Base Server Template

**Goal**: Create template for the main MCP server entry point that will be generated.

**Actions**:

- Create `base/templates/server.ts.template` as a string template with placeholders
- Implement MCP protocol handler: HTTP server listening on port from config, JSON-RPC 2.0 endpoint `/mcp`
- Add config loading: `const config = yaml.load(fs.readFileSync(process.env.MCP_CONFIG_PATH))`, validate structure
- Initialize logging: use winston or pino, configure level/format from config, add request ID tracking
- Implement graceful shutdown: listen for SIGTERM/SIGINT, close connections, flush logs, exit cleanly
- Add health endpoint: `/health` returns 200 with { status: 'ok', tools: [...], connectors: [...] }
- Include error middleware: catch unhandled errors, log with context, return proper JSON-RPC error responses
- Add placeholder markers: `{{TOOL_IMPORTS}}`, `{{CONNECTOR_IMPORTS}}`, `{{TOOL_REGISTRATION}}` for code generation

**Success Criteria**: Template compiles to valid TypeScript; supports config loading; has health checks; handles shutdown
