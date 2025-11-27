# MCP Server Testing Guide

This guide explains how to use the testing framework for validating generated MCP servers.

## Overview

The testing framework provides:

- **Test Harness**: Container lifecycle management and setup/teardown utilities
- **MCP Protocol Client**: Validate JSON-RPC 2.0 protocol compliance
- **Mock Framework**: Replace tool implementations with mocks
- **Assertion Helpers**: Custom matchers for MCP responses
- **Load Testing**: Scripts for stress testing with k6 and autocannon

## Quick Start

```typescript
import {
  TestHarness,
  MCPTestClient,
  MockToolRegistry,
  expect,
} from './base/testing';

// Create test harness
const harness = new TestHarness();

// Create test context
const context = await harness.createContext(3000);

// Wait for server to be healthy
await harness.waitForAllHealthy();

// Initialize MCP client
await context.mcpClient.initialize();

// List tools
const tools = await context.mcpClient.listTools();
console.log('Available tools:', tools);

// Call a tool
const result = await context.mcpClient.callTool('summarize', { text: 'Hello world' });
console.log('Result:', result);

// Cleanup
await harness.cleanup();
```

## Test Harness

### Creating Test Contexts

```typescript
const harness = new TestHarness();

// Create context for a local server
const context = await harness.createContext(3000);

// Access the MCP client
const client = context.mcpClient;

// Access container info
console.log(context.container?.baseUrl);
```

### Waiting for Server Health

```typescript
// Wait for all servers to be healthy (30s timeout)
const healthy = await harness.waitForAllHealthy(30000);

if (!healthy) {
  throw new Error('Server did not become healthy in time');
}
```

### Port Management

```typescript
import { findAvailablePort, waitForPort } from './base/testing';

// Find an available port
const port = await findAvailablePort(10000);

// Wait for a port to become available
const available = await waitForPort(3000, 'localhost', 5000);
```

## MCP Protocol Client

### Initialization

```typescript
const client = new MCPTestClient('http://localhost:3000');

// Initialize the connection (required before other operations)
const initResult = await client.initialize();
console.log('Protocol version:', initResult.protocolVersion);
console.log('Capabilities:', initResult.capabilities);
```

### Tool Operations

```typescript
// List available tools
const tools = await client.listTools();

for (const tool of tools) {
  console.log(`Tool: ${tool.name}`);
  console.log(`Description: ${tool.description}`);
}

// Call a tool
const result = await client.callTool('summarize', {
  text: 'Long text to summarize...',
});

// Handle errors
try {
  await client.callTool('nonexistent', {});
} catch (error) {
  if (error instanceof MCPError) {
    console.log('Error code:', error.code);
    console.log('Error message:', error.message);
  }
}
```

### Resources and Prompts

```typescript
// List resources
const resources = await client.listResources();

// List prompts
const prompts = await client.listPrompts();
```

### Raw JSON-RPC Requests

```typescript
// Send a custom request
const result = await client.sendRequest('custom/method', {
  customParam: 'value',
});
```

## Mock Framework

### Setting Up Mocks

```typescript
// Create mock registry with your tool registry
const mockRegistry = new MockToolRegistry(toolRegistry);

// Mock a tool with custom handler
mockRegistry.mockTool('summarize', async (args) => {
  return { summary: 'Mocked summary' };
});

// Mock a tool to return a specific value
mockRegistry.mockToolReturn('translate', { translated: 'Hola mundo' });

// Mock a tool to throw an error
mockRegistry.mockToolError('broken-tool', 'This tool is broken');

// Mock a tool for a single invocation
mockRegistry.mockToolOnce('once-tool', async () => ({ result: 'first call only' }));
```

### Verifying Invocations

```typescript
// Check if tool was called
expect(mockRegistry.wasCalled('summarize')).toBe(true);

// Get call count
expect(mockRegistry.getCallCount('summarize')).toBe(3);

// Check if called with specific arguments
expect(mockRegistry.wasCalledWith('summarize', { text: 'hello' })).toBe(true);

// Get all invocations
const invocations = mockRegistry.getInvocationsFor('summarize');
for (const inv of invocations) {
  console.log('Args:', inv.args);
  console.log('Result:', inv.result);
  console.log('Duration:', inv.duration);
}
```

### Cleanup

```typescript
// Restore a single tool
mockRegistry.restoreTool('summarize');

// Restore all tools
mockRegistry.restoreAll();

// Clear invocation history
mockRegistry.clearInvocations();

// Full reset
mockRegistry.reset();
```

## Assertion Helpers

### Tool Response Assertions

```typescript
import {
  assertToolResponse,
  assertContainsText,
  assertNoError,
  expect,
} from './base/testing';

// Assert response structure
const result = assertToolResponse(response, {
  content: [{ type: 'text', text: 'Expected text' }],
  isError: false,
});

if (!result.passed) {
  console.error(result.message);
}

// Assert contains text (exact or regex)
assertContainsText(response, 'summary');
assertContainsText(response, /\d+ words/);

// Assert no error
assertNoError(response);
```

### Error Assertions

```typescript
import { assertErrorCode, MCPError } from './base/testing';

try {
  await client.callTool('invalid', {});
} catch (error) {
  // Assert specific error code
  const result = assertErrorCode(error, -32601); // METHOD_NOT_FOUND
  expect(result.passed).toBe(true);
}
```

### Connector Assertions

```typescript
import { assertConnected, assertDisconnected } from './base/testing';

// Assert connector is connected
assertConnected(databaseConnector);

// Assert connector is disconnected
assertDisconnected(emailConnector);
```

### Jest-style Matchers

```typescript
import { expect } from './base/testing';

// Match tool response
expect(response).toMatchToolResponse({
  content: [{ type: 'text' }],
});

// Contains text
expect(response).toContainText('expected text');

// Error code
expect(error).toHaveErrorCode(-32600);

// Connector state
expect(connector).toBeConnected();
expect(connector).not.toBeDisconnected();
```

### Schema Validation

```typescript
import { assertMatchesSchema } from './base/testing';

const schema = {
  type: 'object',
  required: ['name', 'version'],
  properties: {
    name: { type: 'string' },
    version: { type: 'string' },
  },
};

const result = assertMatchesSchema(serverInfo, schema);
expect(result.passed).toBe(true);
```

## Load Testing

### Using k6

```bash
# Install k6
brew install k6  # macOS
# or
apt install k6   # Linux

# Run load test
k6 run --vus 10 --duration 30s base/testing/load-test-scripts/load-test-k6.js

# With custom URL
MCP_SERVER_URL=http://my-server:3000 k6 run load-test-k6.js
```

### Using autocannon

```bash
# Install autocannon
npm install -g autocannon

# Run load test (requires autocannon to be installed in the project)
node base/testing/load-test-scripts/load-test-autocannon.js http://localhost:3000

# With options
node load-test-autocannon.js --connections=20 --duration=60
```

### Load Test Output

The load tests measure:

- **Requests/sec**: Throughput
- **Latency**: Average, p50, p95, p99
- **Error rate**: Percentage of failed requests
- **Timeouts**: Number of timed out requests

### Thresholds

Default k6 thresholds:
- P95 latency < 500ms
- Error rate < 5%
- HTTP failure rate < 1%

## Example Test Suite

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  TestHarness,
  MCPTestClient,
  MockToolRegistry,
  expect as mcpExpect,
} from './base/testing';

describe('MCP Server Integration Tests', () => {
  let harness: TestHarness;
  let client: MCPTestClient;

  beforeAll(async () => {
    harness = new TestHarness();
    const context = await harness.createContext(3000);
    client = context.mcpClient!;
    
    await harness.waitForAllHealthy(30000);
    await client.initialize();
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  describe('Tool Discovery', () => {
    it('should list available tools', async () => {
      const tools = await client.listTools();
      
      expect(tools).toBeInstanceOf(Array);
      expect(tools.length).toBeGreaterThan(0);
      
      for (const tool of tools) {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
      }
    });
  });

  describe('Tool Execution', () => {
    it('should execute summarize tool', async () => {
      const result = await client.callTool('summarize', {
        text: 'This is a long text that needs to be summarized.',
      });

      mcpExpect(result).not.toHaveErrorCode(-32000);
      mcpExpect(result).toContainText(/summary/i);
    });

    it('should handle invalid tool name', async () => {
      try {
        await client.callTool('nonexistent', {});
        fail('Should have thrown an error');
      } catch (error) {
        mcpExpect(error).toHaveErrorCode(-32601);
      }
    });
  });

  describe('Error Handling', () => {
    it('should return proper error for invalid params', async () => {
      try {
        await client.callTool('summarize', {});
        fail('Should have thrown an error');
      } catch (error) {
        mcpExpect(error).toHaveErrorCode(-32602);
      }
    });
  });
});
```

## Best Practices

### Test Isolation

- Use fresh test contexts for each test suite
- Clean up containers after tests
- Reset mocks between tests

### Mocking Strategy

- Mock external services (APIs, databases)
- Use real implementations for critical paths
- Record and replay for regression tests

### Performance Testing

- Run load tests regularly in CI
- Set appropriate thresholds for your SLAs
- Test under realistic conditions

### Error Testing

- Test all error paths
- Verify error codes and messages
- Test timeout handling

## Troubleshooting

### Server Not Responding

1. Check if server is running: `curl http://localhost:3000/health`
2. Verify port is correct
3. Check for firewall issues

### Timeout Errors

1. Increase timeout values
2. Check server performance
3. Reduce concurrent connections

### Mock Not Working

1. Ensure tool name matches exactly
2. Check if mock was set up before test
3. Verify mock wasn't restored prematurely

### Load Test Failures

1. Start with lower load
2. Check server resources (CPU, memory)
3. Monitor for connection limits
