# Plugin Development Guide

This guide explains how to create plugins for the MCP Generator to extend its functionality.

## Overview

The plugin system allows you to:
- Hook into the build lifecycle (before/after build, deploy)
- Modify tool and connector loading
- Transform generated manifests and Dockerfiles
- Add custom validation and logging
- Integrate with external services

## Plugin Structure

### Basic Plugin

```typescript
import { Plugin } from '../plugin-system';

const myPlugin: Plugin = {
  meta: {
    name: 'my-plugin',
    version: '1.0.0',
    description: 'My custom plugin',
    author: 'Your Name',
  },
  hooks: {
    async beforeBuild(context) {
      console.log('Build starting...');
    },
    async afterBuild(context) {
      console.log('Build completed!');
    },
  },
};

export default myPlugin;
```

### Plugin Metadata

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✓ | Unique plugin identifier |
| `version` | string | ✓ | Semantic version (e.g., "1.0.0") |
| `description` | string | | Plugin description |
| `author` | string | | Plugin author |
| `dependencies` | string[] | | Other plugins this depends on |
| `configSchema` | object | | JSON Schema for plugin config |

## Lifecycle Hooks

### Build Hooks

#### `beforeBuild(context: BuildContext)`

Called before the build starts. Can modify the build context.

```typescript
hooks: {
  async beforeBuild(context) {
    // Access build information
    console.log('Tools:', context.tools.length);
    console.log('Output:', context.outputDir);
    
    // Modify context (optional)
    return {
      context: {
        ...context,
        outputDir: '/custom/output',
      },
    };
  },
}
```

#### `afterBuild(context: BuildContext)`

Called after build completes successfully.

```typescript
hooks: {
  async afterBuild(context) {
    // Report build completion
    await notifyTeam({
      message: `Built ${context.tools.length} tools`,
      version: context.buildMeta.version,
    });
  },
}
```

### Deploy Hooks

#### `beforeDeploy(context: DeployContext)`

Called before deployment starts.

```typescript
hooks: {
  async beforeDeploy(context) {
    console.log(`Deploying ${context.imageName}:${context.imageTag}`);
    console.log(`Environment: ${context.environment}`);
    
    // Can modify deployment config
    return {
      context: {
        ...context,
        containerConfig: {
          ...context.containerConfig,
          labels: { deployed_by: 'my-plugin' },
        },
      },
    };
  },
}
```

#### `afterDeploy(context: DeployContext)`

Called after successful deployment.

```typescript
hooks: {
  async afterDeploy(context) {
    await sendSlackMessage(`Deployed ${context.imageName} to ${context.environment}`);
  },
}
```

### Loading Hooks

#### `onToolLoaded(context: ToolContext)`

Called when each tool is loaded. Can modify tool configuration.

```typescript
hooks: {
  async onToolLoaded(context) {
    console.log(`Loaded tool: ${context.name}`);
    
    // Validate tool
    if (!context.meta.description) {
      console.warn(`Tool ${context.name} has no description`);
    }
    
    // Enhance tool metadata
    return {
      context: {
        ...context,
        meta: {
          ...context.meta,
          loadedAt: new Date().toISOString(),
        },
      },
    };
  },
}
```

#### `onConnectorLoaded(context: ToolContext)`

Called when each connector is loaded.

```typescript
hooks: {
  async onConnectorLoaded(context) {
    console.log(`Loaded connector: ${context.name} (${context.type})`);
  },
}
```

### Generation Hooks

#### `onManifestGenerated(manifest: object)`

Called when the MCP manifest is generated. Must return modified manifest.

```typescript
hooks: {
  async onManifestGenerated(manifest) {
    return {
      ...manifest,
      // Add custom metadata
      x_plugin_metadata: {
        generated_by: 'my-plugin',
        timestamp: new Date().toISOString(),
      },
    };
  },
}
```

#### `onDockerfileGenerated(dockerfile: string)`

Called when Dockerfile is generated. Must return modified Dockerfile.

```typescript
hooks: {
  async onDockerfileGenerated(dockerfile) {
    // Add custom labels
    const customLabels = `
LABEL plugin.name="my-plugin"
LABEL plugin.version="1.0.0"
`;
    return dockerfile + customLabels;
  },
}
```

### Lifecycle Hooks

#### `onInit(config: object)`

Called when plugin is initialized with its configuration.

```typescript
hooks: {
  async onInit(config) {
    console.log('Plugin initialized with config:', config);
    // Set up resources, connections, etc.
  },
}
```

#### `onShutdown()`

Called when plugin is shutting down.

```typescript
hooks: {
  async onShutdown() {
    // Clean up resources
    await closeConnections();
    console.log('Plugin shutdown complete');
  },
}
```

## Hook Results

### Modifying Context

Return a `HookResult` to modify the context:

```typescript
return {
  context: modifiedContext,  // New context for subsequent hooks
  continue: true,            // Continue to next plugin (default)
  data: { custom: 'data' },  // Pass data to next hook
};
```

### Stopping the Chain

Return `continue: false` to stop processing:

```typescript
hooks: {
  async beforeBuild(context) {
    if (context.config.skipPlugins) {
      return { continue: false };  // Stop other plugins
    }
  },
}
```

## Plugin Configuration

### Define Config Schema

```typescript
const myPlugin: Plugin = {
  meta: {
    name: 'my-plugin',
    version: '1.0.0',
    configSchema: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', default: true },
        apiKey: { type: 'string' },
        options: {
          type: 'object',
          properties: {
            verbose: { type: 'boolean' },
          },
        },
      },
      required: ['apiKey'],
    },
  },
  // ...
};
```

### Configuration in config.yaml

```yaml
plugins:
  my-plugin:
    apiKey: ${MY_API_KEY}
    options:
      verbose: true
```

### Access Configuration

```typescript
hooks: {
  async onInit(config) {
    this.apiKey = config.apiKey;
    this.verbose = config.options?.verbose ?? false;
  },
}
```

## Plugin Dependencies

### Declare Dependencies

```typescript
meta: {
  name: 'enhanced-logger',
  version: '1.0.0',
  dependencies: ['base-logger'],  // Requires base-logger to load first
}
```

### Dependency Resolution

- Plugins load in dependency order
- Circular dependencies throw an error
- Missing dependencies throw an error

## Example Plugins

### Logger Plugin

```typescript
import { Plugin } from '../plugin-system';

let startTime: number;

const loggerPlugin: Plugin = {
  meta: {
    name: 'logger',
    version: '1.0.0',
  },
  hooks: {
    async beforeBuild(context) {
      startTime = Date.now();
      console.log(`[BUILD] Starting with ${context.tools.length} tools`);
    },
    
    async afterBuild(context) {
      const duration = Date.now() - startTime;
      console.log(`[BUILD] Completed in ${duration}ms`);
    },
    
    async onToolLoaded(context) {
      console.log(`[TOOL] Loaded: ${context.name}`);
    },
  },
};

export default loggerPlugin;
```

### Validator Plugin

```typescript
import { Plugin } from '../plugin-system';

const validatorPlugin: Plugin = {
  meta: {
    name: 'validator',
    version: '1.0.0',
  },
  hooks: {
    async onToolLoaded(context) {
      // Validate tool name format
      if (!/^[a-z][a-z0-9-]*$/.test(context.name)) {
        throw new Error(`Invalid tool name: ${context.name}`);
      }
      
      // Check for required metadata
      if (!context.meta.description) {
        console.warn(`Tool ${context.name} should have a description`);
      }
      
      return { context };
    },
    
    async onManifestGenerated(manifest) {
      // Validate manifest structure
      if (!manifest.name) {
        throw new Error('Manifest must have a name');
      }
      return manifest;
    },
  },
};

export default validatorPlugin;
```

### Notifier Plugin

```typescript
import { Plugin } from '../plugin-system';

interface SlackConfig {
  webhookUrl: string;
  channel: string;
}

let config: SlackConfig;

const notifierPlugin: Plugin = {
  meta: {
    name: 'slack-notifier',
    version: '1.0.0',
    configSchema: {
      type: 'object',
      properties: {
        webhookUrl: { type: 'string' },
        channel: { type: 'string' },
      },
      required: ['webhookUrl'],
    },
  },
  hooks: {
    async onInit(cfg) {
      config = cfg as SlackConfig;
    },
    
    async afterBuild(context) {
      await fetch(config.webhookUrl, {
        method: 'POST',
        body: JSON.stringify({
          channel: config.channel,
          text: `Build completed: ${context.tools.length} tools`,
        }),
      });
    },
    
    async afterDeploy(context) {
      await fetch(config.webhookUrl, {
        method: 'POST',
        body: JSON.stringify({
          channel: config.channel,
          text: `Deployed ${context.imageName}:${context.imageTag}`,
        }),
      });
    },
  },
};

export default notifierPlugin;
```

## Plugin Registry API

### List Plugins

```typescript
const registry = new PluginRegistry(config);
await registry.initialize();

const plugins = registry.listPlugins();
// [{ name: 'logger', version: '1.0.0', enabled: true }, ...]
```

### Enable/Disable Plugins

```typescript
const loader = registry.getLoader();
loader.disablePlugin('my-plugin');
loader.enablePlugin('my-plugin');
```

### Get Hook Runner

```typescript
const runner = registry.getHookRunner();
const context = await runner.runBeforeBuild(buildContext);
```

## Directory Structure

```
plugins/
├── logger-plugin.ts
├── validator-plugin.ts
├── notifier-plugin/
│   ├── index.ts
│   └── slack-client.ts
└── custom-plugin/
    ├── index.ts
    ├── config.ts
    └── utils.ts
```

## Best Practices

### 1. Keep Plugins Focused

Each plugin should do one thing well:

```typescript
// ✅ Good: Single responsibility
const loggerPlugin = { /* logging only */ };
const validatorPlugin = { /* validation only */ };

// ❌ Bad: Too many responsibilities
const everythingPlugin = { /* logging, validation, notification, ... */ };
```

### 2. Handle Errors Gracefully

```typescript
hooks: {
  async afterBuild(context) {
    try {
      await sendNotification(context);
    } catch (error) {
      console.error('Notification failed:', error);
      // Don't throw - allow build to complete
    }
  },
}
```

### 3. Use Async/Await

All hooks should be async:

```typescript
// ✅ Good
async beforeBuild(context) { ... }

// ❌ Bad
beforeBuild(context) { return new Promise(...); }
```

### 4. Document Configuration

```typescript
meta: {
  configSchema: {
    type: 'object',
    description: 'Configuration for my-plugin',
    properties: {
      apiKey: {
        type: 'string',
        description: 'API key for external service',
      },
    },
  },
}
```

### 5. Version Your Plugins

Follow semantic versioning:
- Major: Breaking changes
- Minor: New features
- Patch: Bug fixes

## Testing Plugins

### Unit Testing

```typescript
import { describe, it, expect } from '@jest/globals';
import myPlugin from './my-plugin';

describe('My Plugin', () => {
  it('should log on build start', async () => {
    const logs: string[] = [];
    console.log = (msg) => logs.push(msg);
    
    await myPlugin.hooks.beforeBuild?.({ tools: [] });
    
    expect(logs).toContain('Build starting...');
  });
});
```

### Integration Testing

```typescript
const registry = new PluginRegistry({
  pluginDir: './test-plugins',
  pluginConfig: {
    'my-plugin': { setting: 'value' },
  },
});

await registry.initialize();
const runner = registry.getHookRunner();

const result = await runner.runBeforeBuild(testContext);
expect(result.modified).toBe(true);
```

## Security Considerations

1. **Validate Plugin Sources**: Only load plugins from trusted sources
2. **Sandbox Sensitive Operations**: Limit file system and network access
3. **Review Plugin Code**: Audit plugins before deploying
4. **Use Config Secrets**: Store API keys in environment variables

## Troubleshooting

### Plugin Not Loading

1. Check plugin file exists in plugins directory
2. Verify plugin exports default or named export
3. Check for syntax errors in plugin code
4. Verify dependencies are available

### Hook Not Called

1. Check hook name matches exactly
2. Verify plugin is enabled
3. Check if earlier plugin stopped chain

### Config Not Applied

1. Verify config key matches plugin name
2. Check config.yaml syntax
3. Validate against configSchema
