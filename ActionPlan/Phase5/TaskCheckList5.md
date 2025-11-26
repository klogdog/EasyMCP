# Task Checklist for Phase 5: MCP Server Templates

## Overview

This phase focuses on mcp server templates.

## Tasks

### Task 5.1: Create Base Server Template

- [x] Create `base/templates/server.ts.template` as a string template with placeholders
- [x] Implement MCP protocol handler: HTTP server listening on port from config, JSON-RPC 2.0 endpoint `/mcp`
- [x] Add config loading: `const config = yaml.load(fs.readFileSync(process.env.MCP_CONFIG_PATH))`, validate structure
- [x] Initialize logging: use winston or pino, configure level/format from config, add request ID tracking
- [x] Implement graceful shutdown: listen for SIGTERM/SIGINT, close connections, flush logs, exit cleanly
- [x] Add health endpoint: `/health` returns 200 with { status: 'ok', tools: [...], connectors: [...] }
- [x] Include error middleware: catch unhandled errors, log with context, return proper JSON-RPC error responses
- [x] Add placeholder markers: `{{TOOL_IMPORTS}}`, `{{CONNECTOR_IMPORTS}}`, `{{TOOL_REGISTRATION}}` for code generation
- [x] **Success Criteria**: Template compiles to valid TypeScript; supports config loading; has health checks; handles shutdown

### Task 5.2: Build Tool Integration Template

- [x] Create `base/templates/tool-loader.ts.template`
- [x] Implement `class ToolRegistry { private tools = new Map<string, Tool>(); register(tool: Tool); get(name: string); list(); }`
- [x] Add dynamic import logic: iterate through manifest.tools, `await import(toolPath)`, extract default export
- [x] Create tool invocation router: `async function invokeTool(name: string, args: any): Promise<any>` that looks up tool and calls its handler
- [x] Implement error handling wrapper: try-catch around each tool invocation, log errors, return structured error response
- [x] Add tool lifecycle: `onLoad()` hook when tool is registered, `onUnload()` for cleanup
- [x] Implement input validation: validate args against tool.inputSchema using JSON Schema validator (ajv)
- [x] Add result transformation: wrap tool output in standard format `{ success: boolean, result?: any, error?: string }`
- [x] Include placeholder: `{{TOOL_LIST}}` for injecting tool definitions during code generation
- [x] **Success Criteria**: Dynamically loads tools; validates inputs; handles errors; provides consistent response format

### Task 5.3: Create Connector Integration Template ✅

- [x] Create `base/templates/connector-loader.ts.template`
- [x] Implement `class ConnectorRegistry` similar to ToolRegistry but with connection management
- [x] Add connector initialization: `async function initializeConnector(config: ConnectorConfig): Promise<Connector>` that reads credentials from config, creates client instance
- [x] Implement credential injection: read from config.services[connectorName], support OAuth, API keys, basic auth
- [x] Add connection pooling: maintain pool of active connections, reuse for multiple requests, handle connection timeouts
- [x] Create health check system: `async function checkConnectorHealth(name: string): Promise<boolean>` that pings each service
- [x] Implement retry logic: exponential backoff for failed connections, configurable max retries
- [x] Add connection lifecycle: `connect()`, `disconnect()`, `reconnect()` methods
- [x] Include graceful degradation: if connector fails to initialize, log warning but continue (unless marked as required)
- [x] **Success Criteria**: Initializes connectors with credentials; manages connection pools; has health checks; handles failures

### Task 5.4: Build Entrypoint Script

- [ ] Create `base/templates/entrypoint.sh.template` as bash script
- [ ] Add shebang: `#!/bin/bash` and `set -e` for exit on error
- [ ] Implement config file validation: check if MCP_CONFIG_PATH exists, validate YAML syntax with `yamllint` or Node script
- [ ] Add environment variable override: `export $(grep -v '^#' .env | xargs)` if .env file exists
- [ ] Check required variables: verify critical env vars are set (DATABASE_URL, etc), exit with error message if missing
- [ ] Implement startup logging: echo "Starting MCP Server...", log config location, list loaded tools/connectors
- [ ] Add process management: handle SIGTERM to gracefully stop server, forward signals to Node.js process
- [ ] Support different run modes: accept command line arg (dev/prod), adjust logging verbosity accordingly
- [ ] Execute main server: `exec node server.js "$@"` to replace shell process with Node
- [ ] **Success Criteria**: Validates config before starting; sets up environment; logs startup info; handles signals properly
