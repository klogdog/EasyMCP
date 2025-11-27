# Hot Reload Development Guide

This guide explains how to use the hot reload feature for faster development iterations with MCP servers.

## Overview

Hot reload allows you to make changes to tools and connectors without restarting the server or rebuilding containers. File changes are detected automatically and modules are reloaded in-place.

## Enabling Hot Reload

### Development Mode Flag

Start the server with the `--dev` flag to enable hot reload:

```bash
# Enable all development features
node server.js --dev

# Custom configuration
node server.js --dev --port 3000 --watch ./tools,./connectors
```

### Environment Variable

Set `NODE_ENV` to non-production:

```bash
NODE_ENV=development node server.js
```

### Programmatic Configuration

```typescript
import { HotReloadManager } from './hot-reload';

const manager = new HotReloadManager({
  enabled: true,
  watchDirs: ['./tools', './connectors'],
  debounceMs: 100,
  gracefulFallback: true,
});

manager.start();
```

## Docker Development Setup

For hot reload in Docker containers, mount your source directories:

```dockerfile
# docker-compose.dev.yml
version: '3.8'
services:
  mcp-server:
    build: .
    command: node server.js --dev
    volumes:
      - ./tools:/app/tools:ro
      - ./connectors:/app/connectors:ro
      - ./config:/app/config:ro
    environment:
      - NODE_ENV=development
    ports:
      - "3000:3000"
```

Run with:
```bash
docker-compose -f docker-compose.dev.yml up
```

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `enabled` | Auto-detect | Enable hot reload (false in production) |
| `watchDirs` | `['./tools', './connectors']` | Directories to watch |
| `patterns` | `['**/*.ts', '**/*.js']` | File patterns to watch |
| `debounceMs` | `100` | Delay before triggering reload |
| `configFile` | `undefined` | Config file to watch |
| `drainTimeoutMs` | `5000` | Request drain timeout during reload |
| `gracefulFallback` | `true` | Keep old version on reload error |

## Reload Events

Subscribe to reload events for custom handling:

```typescript
manager.onReload('my-handler', async (event) => {
  switch (event.type) {
    case 'before':
      console.log('About to reload:', event.modules);
      // Cleanup before reload
      break;
    case 'after':
      console.log('Reload complete:', event.result);
      // Re-initialize after reload
      break;
    case 'error':
      console.error('Reload failed:', event.error);
      break;
  }
});
```

## Admin Endpoints

When running in dev mode, admin endpoints are available:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/__dev/status` | GET | Server status and metrics |
| `/__dev/reload` | POST | Trigger manual reload |
| `/__dev/reload/last` | GET | Last reload result |
| `/__dev/tools` | GET | List registered tools |
| `/__dev/connectors` | GET | List registered connectors |
| `/__dev/config` | GET | Current configuration |

### Example: Trigger Manual Reload

```bash
curl -X POST http://localhost:3000/__dev/reload
```

Response:
```json
{
  "success": true,
  "reloadedModules": ["calculator", "translator"],
  "failedModules": [],
  "duration": 42,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Example: Check Status

```bash
curl http://localhost:3000/__dev/status
```

Response:
```json
{
  "uptime": 3600000,
  "requests": 150,
  "reloads": 5,
  "errors": 0,
  "lastReload": "2024-01-15T10:30:00.000Z",
  "hotReloadEnabled": true,
  "watchedDirs": ["./tools", "./connectors"]
}
```

## Zero-Downtime Reloads

During reload, requests are queued and processed after the new modules are loaded:

1. File change detected
2. Request queue starts capturing new requests
3. `beforeReload` event fires
4. Module cache invalidated
5. New modules loaded
6. Registries updated
7. `afterReload` event fires
8. Queued requests processed

If reload takes longer than `drainTimeoutMs`, queued requests timeout.

## Graceful Error Handling

When `gracefulFallback` is enabled (default):

1. If a module fails to reload, the original version is preserved
2. The server continues operating with the old version
3. Error is logged and reported in reload result
4. Other modules still reload successfully

Example error response:
```json
{
  "success": false,
  "reloadedModules": ["calculator"],
  "failedModules": [
    {
      "name": "translator",
      "error": "SyntaxError: Unexpected token (using fallback)"
    }
  ],
  "duration": 25
}
```

## CLI Options

| Option | Description |
|--------|-------------|
| `--dev` | Enable development mode (hot reload, admin endpoints, verbose logging) |
| `--port <port>` | Server port (default: 3000) |
| `--host <host>` | Host to bind (default: 0.0.0.0) |
| `--watch <dirs>` | Comma-separated directories to watch |
| `--config <file>` | Config file path for hot reload |
| `--no-hot-reload` | Disable hot reload even in dev mode |
| `--quiet` | Disable verbose logging |

## Best Practices

### 1. Keep Modules Stateless

Modules that maintain state may behave unexpectedly after reload:

```typescript
// ❌ Bad: Stateful module
let counter = 0;
export const handler = async () => {
  return { count: counter++ };
};

// ✅ Good: Stateless module
export const handler = async (args: { initialCount: number }) => {
  return { count: args.initialCount + 1 };
};
```

### 2. Use Cleanup Hooks

Register cleanup in beforeReload for resources:

```typescript
let connection: Connection | null = null;

manager.onReload('db-cleanup', async (event) => {
  if (event.type === 'before' && connection) {
    await connection.close();
    connection = null;
  }
});
```

### 3. Test Reload Behavior

Include reload tests in your test suite:

```typescript
it('should survive hot reload', async () => {
  // Make initial request
  const result1 = await client.callTool('calculator', { a: 1, b: 2 });
  
  // Trigger reload
  await fetch('http://localhost:3000/__dev/reload', { method: 'POST' });
  
  // Make another request
  const result2 = await client.callTool('calculator', { a: 3, b: 4 });
  
  expect(result1.result).toBe(3);
  expect(result2.result).toBe(7);
});
```

### 4. Monitor in Production

Hot reload should be disabled in production, but you can monitor reload readiness:

```typescript
// Check if server is ready for potential rolling update
const status = await fetch('/health/ready');
if (status.ok) {
  // Safe to proceed with deployment
}
```

## Troubleshooting

### Changes Not Detected

1. Check watch directories are correct
2. Verify file patterns match your files
3. Check if directory is mounted (Docker)
4. Increase debounce time if changes are too fast

### Reload Fails

1. Check for syntax errors in changed files
2. Review error message in reload result
3. Check if fallback preserved old version
4. Verify dependencies are available

### Request Timeouts During Reload

1. Increase `drainTimeoutMs`
2. Check if modules have slow initialization
3. Consider preloading large dependencies

### Memory Leaks After Reload

1. Implement cleanup in beforeReload hook
2. Clear references to old module exports
3. Use profiler to identify leaked objects

## Security Considerations

1. **Disable in Production**: Never enable hot reload in production
2. **Admin Endpoints**: Only available in development mode
3. **File Watching**: Only watches specified directories
4. **Graceful Fallback**: Prevents broken modules from crashing server

## Integration with IDE

### VS Code

Add to your launch configuration:

```json
{
  "type": "node",
  "request": "launch",
  "name": "MCP Server (Dev)",
  "program": "${workspaceFolder}/server.js",
  "args": ["--dev"],
  "env": {
    "NODE_ENV": "development"
  },
  "restart": true
}
```

### File Save Actions

Configure your IDE to trigger formatting/linting on save, and hot reload handles the rest.

## Related Documentation

- [Testing Guide](./testing.md) - How to test MCP servers
- [Monitoring Guide](./monitoring.md) - Health and metrics
- [Deployment Guide](./deployment.md) - Production deployment
