/**
 * Tests for Plugin System
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  Plugin,
  BuildContext,
  DeployContext,
  ToolContext,
  PluginLoader,
  HookRunner,
} from '../plugin-system';

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestPlugin(overrides: Partial<Plugin> = {}): Plugin {
  return {
    meta: {
      name: overrides.meta?.name ?? 'test-plugin',
      version: overrides.meta?.version ?? '1.0.0',
      description: overrides.meta?.description ?? 'Test plugin',
      ...overrides.meta,
    },
    hooks: overrides.hooks ?? {},
  };
}

function createBuildContext(overrides: Partial<BuildContext> = {}): BuildContext {
  return {
    manifest: {},
    config: {},
    outputDir: '/output',
    tools: [],
    connectors: [],
    buildMeta: {
      startTime: new Date(),
      version: '1.0.0',
      environment: 'test',
    },
    ...overrides,
  };
}

function createDeployContext(overrides: Partial<DeployContext> = {}): DeployContext {
  return {
    imageName: 'test-image',
    imageTag: 'latest',
    containerConfig: {},
    environment: 'test',
    ...overrides,
  };
}

function createToolContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    name: 'test-tool',
    path: '/tools/test-tool.ts',
    type: 'typescript',
    meta: {},
    exports: {},
    ...overrides,
  };
}

// ============================================================================
// Plugin Validation Tests
// ============================================================================

describe('Plugin Validation', () => {
  it('should accept valid plugin structure', () => {
    const plugin = createTestPlugin();
    expect(plugin.meta.name).toBe('test-plugin');
    expect(plugin.meta.version).toBe('1.0.0');
  });

  it('should have required meta fields', () => {
    const plugin = createTestPlugin({
      meta: {
        name: 'my-plugin',
        version: '2.0.0',
        description: 'My awesome plugin',
        author: 'Test Author',
      },
    });

    expect(plugin.meta.name).toBe('my-plugin');
    expect(plugin.meta.version).toBe('2.0.0');
    expect(plugin.meta.description).toBe('My awesome plugin');
    expect(plugin.meta.author).toBe('Test Author');
  });

  it('should support dependencies', () => {
    const plugin = createTestPlugin({
      meta: {
        name: 'dependent-plugin',
        version: '1.0.0',
        dependencies: ['base-plugin', 'logger-plugin'],
      },
    });

    expect(plugin.meta.dependencies).toContain('base-plugin');
    expect(plugin.meta.dependencies).toContain('logger-plugin');
  });
});

// ============================================================================
// Hook Execution Tests
// ============================================================================

describe('Hook Execution', () => {
  describe('beforeBuild hook', () => {
    it('should call beforeBuild with context', async () => {
      const hookCalled = jest.fn();
      const plugin = createTestPlugin({
        hooks: {
          beforeBuild: async (context) => {
            hookCalled(context);
          },
        },
      });

      const context = createBuildContext({ outputDir: '/test/output' });
      await plugin.hooks.beforeBuild?.(context);

      expect(hookCalled).toHaveBeenCalledWith(context);
    });

    it('should allow modifying context', async () => {
      const plugin = createTestPlugin({
        hooks: {
          beforeBuild: async (context) => {
            return {
              context: {
                ...context,
                outputDir: '/modified/output',
              },
            };
          },
        },
      });

      const context = createBuildContext();
      const result = await plugin.hooks.beforeBuild?.(context);

      expect(result?.context?.outputDir).toBe('/modified/output');
    });
  });

  describe('afterBuild hook', () => {
    it('should call afterBuild with final context', async () => {
      const hookCalled = jest.fn();
      const plugin = createTestPlugin({
        hooks: {
          afterBuild: async (context) => {
            hookCalled(context);
          },
        },
      });

      const context = createBuildContext({ tools: [{ name: 'tool1', path: '/tools/tool1.ts', type: 'ts' }] });
      await plugin.hooks.afterBuild?.(context);

      expect(hookCalled).toHaveBeenCalledWith(context);
    });
  });

  describe('beforeDeploy hook', () => {
    it('should call beforeDeploy with deploy context', async () => {
      const hookCalled = jest.fn();
      const plugin = createTestPlugin({
        hooks: {
          beforeDeploy: async (context) => {
            hookCalled(context);
          },
        },
      });

      const context = createDeployContext({ imageName: 'my-image' });
      await plugin.hooks.beforeDeploy?.(context);

      expect(hookCalled).toHaveBeenCalledWith(context);
    });
  });

  describe('onToolLoaded hook', () => {
    it('should call onToolLoaded for each tool', async () => {
      const hookCalled = jest.fn();
      const plugin = createTestPlugin({
        hooks: {
          onToolLoaded: async (context) => {
            hookCalled(context);
          },
        },
      });

      const context = createToolContext({ name: 'calculator' });
      await plugin.hooks.onToolLoaded?.(context);

      expect(hookCalled).toHaveBeenCalledWith(context);
    });

    it('should allow modifying tool context', async () => {
      const plugin = createTestPlugin({
        hooks: {
          onToolLoaded: async (context) => {
            return {
              context: {
                ...context,
                meta: { ...context.meta, validated: true },
              },
            };
          },
        },
      });

      const context = createToolContext();
      const result = await plugin.hooks.onToolLoaded?.(context);

      expect((result?.context?.meta as Record<string, unknown>)?.validated).toBe(true);
    });
  });

  describe('onInit and onShutdown hooks', () => {
    it('should call onInit with config', async () => {
      const hookCalled = jest.fn();
      const plugin = createTestPlugin({
        hooks: {
          onInit: async (config) => {
            hookCalled(config);
          },
        },
      });

      await plugin.hooks.onInit?.({ setting: 'value' });
      expect(hookCalled).toHaveBeenCalledWith({ setting: 'value' });
    });

    it('should call onShutdown', async () => {
      const hookCalled = jest.fn();
      const plugin = createTestPlugin({
        hooks: {
          onShutdown: async () => {
            hookCalled();
          },
        },
      });

      await plugin.hooks.onShutdown?.();
      expect(hookCalled).toHaveBeenCalled();
    });
  });

  describe('onManifestGenerated hook', () => {
    it('should allow modifying manifest', async () => {
      const plugin = createTestPlugin({
        hooks: {
          onManifestGenerated: async (manifest) => {
            return { ...manifest, customField: 'added' };
          },
        },
      });

      const manifest = { name: 'test-server' };
      const result = await plugin.hooks.onManifestGenerated?.(manifest);

      expect(result).toEqual({ name: 'test-server', customField: 'added' });
    });
  });

  describe('onDockerfileGenerated hook', () => {
    it('should allow modifying Dockerfile', async () => {
      const plugin = createTestPlugin({
        hooks: {
          onDockerfileGenerated: async (dockerfile) => {
            return dockerfile + '\nLABEL plugin=applied';
          },
        },
      });

      const dockerfile = 'FROM node:18';
      const result = await plugin.hooks.onDockerfileGenerated?.(dockerfile);

      expect(result).toContain('LABEL plugin=applied');
    });
  });
});

// ============================================================================
// Plugin Loader Tests
// ============================================================================

describe('PluginLoader', () => {
  let tempDir: string;
  let loader: PluginLoader;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should handle missing plugin directory', async () => {
    loader = new PluginLoader({
      pluginDir: '/nonexistent/path',
      pluginConfig: {},
    });

    const warnings: string[] = [];
    loader.on('warn', (msg) => warnings.push(msg));

    await loader.loadAll();

    expect(warnings.length).toBeGreaterThan(0);
    expect(loader.getAllPlugins()).toHaveLength(0);
  });

  it('should get enabled plugins', () => {
    // Create a mock loader with plugins
    const mockLoader = {
      plugins: new Map<string, { plugin: Plugin; enabled: boolean }>(),
      loadOrder: ['plugin-a', 'plugin-b'],
      
      getAllPlugins() {
        return Array.from(this.plugins.values());
      },
      
      getEnabledPlugins() {
        return this.loadOrder
          .map(name => this.plugins.get(name))
          .filter(p => p !== undefined && p.enabled);
      },
    };

    mockLoader.plugins.set('plugin-a', {
      plugin: createTestPlugin({ meta: { name: 'plugin-a', version: '1.0.0' } }),
      enabled: true,
    });
    mockLoader.plugins.set('plugin-b', {
      plugin: createTestPlugin({ meta: { name: 'plugin-b', version: '1.0.0' } }),
      enabled: false,
    });

    const enabled = mockLoader.getEnabledPlugins();
    expect(enabled).toHaveLength(1);
    expect(enabled[0]?.plugin.meta.name).toBe('plugin-a');
  });

  it('should enable and disable plugins', () => {
    const mockLoader = {
      plugins: new Map<string, { enabled: boolean }>(),
      
      enablePlugin(name: string): boolean {
        const plugin = this.plugins.get(name);
        if (plugin) {
          plugin.enabled = true;
          return true;
        }
        return false;
      },
      
      disablePlugin(name: string): boolean {
        const plugin = this.plugins.get(name);
        if (plugin) {
          plugin.enabled = false;
          return true;
        }
        return false;
      },
    };

    mockLoader.plugins.set('test-plugin', { enabled: true });

    expect(mockLoader.disablePlugin('test-plugin')).toBe(true);
    expect(mockLoader.plugins.get('test-plugin')?.enabled).toBe(false);

    expect(mockLoader.enablePlugin('test-plugin')).toBe(true);
    expect(mockLoader.plugins.get('test-plugin')?.enabled).toBe(true);

    expect(mockLoader.enablePlugin('nonexistent')).toBe(false);
  });
});

// ============================================================================
// Dependency Resolution Tests
// ============================================================================

describe('Dependency Resolution', () => {
  it('should detect circular dependencies', () => {
    const plugins = new Map([
      ['a', { meta: { name: 'a', version: '1.0.0', dependencies: ['b'] } }],
      ['b', { meta: { name: 'b', version: '1.0.0', dependencies: ['c'] } }],
      ['c', { meta: { name: 'c', version: '1.0.0', dependencies: ['a'] } }],
    ]);

    const resolveDependencies = () => {
      const resolved = new Set<string>();
      const unresolved = new Set<string>();

      const resolve = (name: string): void => {
        if (resolved.has(name)) return;
        if (unresolved.has(name)) {
          throw new Error(`Circular dependency: ${name}`);
        }

        unresolved.add(name);
        const plugin = plugins.get(name);
        for (const dep of plugin?.meta.dependencies ?? []) {
          resolve(dep);
        }
        unresolved.delete(name);
        resolved.add(name);
      };

      for (const name of plugins.keys()) {
        resolve(name);
      }
    };

    expect(resolveDependencies).toThrow('Circular dependency');
  });

  it('should resolve dependencies in correct order', () => {
    const plugins = new Map([
      ['c', { meta: { name: 'c', version: '1.0.0', dependencies: [] } }],
      ['b', { meta: { name: 'b', version: '1.0.0', dependencies: ['c'] } }],
      ['a', { meta: { name: 'a', version: '1.0.0', dependencies: ['b', 'c'] } }],
    ]);

    const order: string[] = [];
    const resolved = new Set<string>();

    const resolve = (name: string): void => {
      if (resolved.has(name)) return;
      
      const plugin = plugins.get(name);
      for (const dep of plugin?.meta.dependencies ?? []) {
        resolve(dep);
      }
      resolved.add(name);
      order.push(name);
    };

    for (const name of plugins.keys()) {
      resolve(name);
    }

    expect(order.indexOf('c')).toBeLessThan(order.indexOf('b'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('a'));
  });

  it('should detect missing dependencies', () => {
    const plugins = new Map([
      ['a', { meta: { name: 'a', version: '1.0.0', dependencies: ['nonexistent'] } }],
    ]);

    const checkDependencies = () => {
      for (const [name, plugin] of plugins) {
        for (const dep of plugin.meta.dependencies ?? []) {
          if (!plugins.has(dep)) {
            throw new Error(`Missing dependency: ${name} requires ${dep}`);
          }
        }
      }
    };

    expect(checkDependencies).toThrow('Missing dependency: a requires nonexistent');
  });
});

// ============================================================================
// HookRunner Tests
// ============================================================================

describe('HookRunner', () => {
  it('should run hooks in plugin order', async () => {
    const callOrder: string[] = [];

    const mockLoader = {
      getEnabledPlugins: () => [
        {
          plugin: createTestPlugin({
            meta: { name: 'plugin-1', version: '1.0.0' },
            hooks: {
              beforeBuild: async () => {
                callOrder.push('plugin-1');
              },
            },
          }),
          enabled: true,
        },
        {
          plugin: createTestPlugin({
            meta: { name: 'plugin-2', version: '1.0.0' },
            hooks: {
              beforeBuild: async () => {
                callOrder.push('plugin-2');
              },
            },
          }),
          enabled: true,
        },
      ],
    };

    const runner = new HookRunner(mockLoader as unknown as PluginLoader);
    await runner.runBeforeBuild(createBuildContext());

    expect(callOrder).toEqual(['plugin-1', 'plugin-2']);
  });

  it('should pass context modifications between hooks', async () => {
    const mockLoader = {
      getEnabledPlugins: () => [
        {
          plugin: createTestPlugin({
            meta: { name: 'plugin-1', version: '1.0.0' },
            hooks: {
              beforeBuild: async (context) => ({
                context: { ...context, outputDir: '/modified-1' },
              }),
            },
          }),
          enabled: true,
        },
        {
          plugin: createTestPlugin({
            meta: { name: 'plugin-2', version: '1.0.0' },
            hooks: {
              beforeBuild: async (context) => ({
                context: { ...context, outputDir: context.outputDir + '-2' },
              }),
            },
          }),
          enabled: true,
        },
      ],
    };

    const runner = new HookRunner(mockLoader as unknown as PluginLoader);
    const result = await runner.runBeforeBuild(createBuildContext());

    expect(result.outputDir).toBe('/modified-1-2');
  });

  it('should stop chain when continue is false', async () => {
    const callOrder: string[] = [];

    const mockLoader = {
      getEnabledPlugins: () => [
        {
          plugin: createTestPlugin({
            meta: { name: 'plugin-1', version: '1.0.0' },
            hooks: {
              beforeBuild: async () => {
                callOrder.push('plugin-1');
                return { continue: false };
              },
            },
          }),
          enabled: true,
        },
        {
          plugin: createTestPlugin({
            meta: { name: 'plugin-2', version: '1.0.0' },
            hooks: {
              beforeBuild: async () => {
                callOrder.push('plugin-2');
              },
            },
          }),
          enabled: true,
        },
      ],
    };

    const runner = new HookRunner(mockLoader as unknown as PluginLoader);
    await runner.runBeforeBuild(createBuildContext());

    expect(callOrder).toEqual(['plugin-1']);
  });

  it('should propagate errors from hooks', async () => {
    const mockLoader = {
      getEnabledPlugins: () => [
        {
          plugin: createTestPlugin({
            meta: { name: 'failing-plugin', version: '1.0.0' },
            hooks: {
              beforeBuild: async () => {
                throw new Error('Hook failed');
              },
            },
          }),
          enabled: true,
        },
      ],
    };

    const runner = new HookRunner(mockLoader as unknown as PluginLoader);

    await expect(runner.runBeforeBuild(createBuildContext()))
      .rejects.toThrow('failing-plugin beforeBuild failed');
  });
});

// ============================================================================
// PluginRegistry Tests
// ============================================================================

describe('PluginRegistry', () => {
  it('should list plugins with status', () => {
    const mockRegistry = {
      loader: {
        getAllPlugins: () => [
          {
            plugin: createTestPlugin({ meta: { name: 'plugin-a', version: '1.0.0' } }),
            enabled: true,
          },
          {
            plugin: createTestPlugin({ meta: { name: 'plugin-b', version: '2.0.0' } }),
            enabled: false,
            error: 'Init failed',
          },
        ],
      },

      listPlugins() {
        return this.loader.getAllPlugins().map(p => ({
          name: p.plugin.meta.name,
          version: p.plugin.meta.version,
          enabled: p.enabled,
          error: p.error,
        }));
      },
    };

    const list = mockRegistry.listPlugins();
    expect(list).toHaveLength(2);
    expect(list[0]).toEqual({ name: 'plugin-a', version: '1.0.0', enabled: true, error: undefined });
    expect(list[1]).toEqual({ name: 'plugin-b', version: '2.0.0', enabled: false, error: 'Init failed' });
  });
});

// ============================================================================
// Example Plugins Integration Tests
// ============================================================================

describe('Example Plugins', () => {
  describe('Logger Plugin Pattern', () => {
    it('should log build events', async () => {
      const logs: string[] = [];
      const loggerPlugin = createTestPlugin({
        meta: { name: 'logger', version: '1.0.0' },
        hooks: {
          beforeBuild: async (context) => {
            logs.push(`Build starting with ${context.tools.length} tools`);
          },
          afterBuild: async () => {
            logs.push('Build completed');
          },
        },
      });

      const context = createBuildContext({ tools: [{ name: 't1', path: '', type: '' }] });
      await loggerPlugin.hooks.beforeBuild?.(context);
      await loggerPlugin.hooks.afterBuild?.(context);

      expect(logs).toEqual([
        'Build starting with 1 tools',
        'Build completed',
      ]);
    });
  });

  describe('Validator Plugin Pattern', () => {
    it('should validate tools', async () => {
      const validatedTools: string[] = [];
      const validatorPlugin = createTestPlugin({
        meta: { name: 'validator', version: '1.0.0' },
        hooks: {
          onToolLoaded: async (context) => {
            if (!context.name) {
              throw new Error('Tool must have a name');
            }
            validatedTools.push(context.name);
            return { context };
          },
        },
      });

      await validatorPlugin.hooks.onToolLoaded?.(createToolContext({ name: 'valid-tool' }));
      expect(validatedTools).toContain('valid-tool');

      await expect(
        validatorPlugin.hooks.onToolLoaded?.(createToolContext({ name: '' }))
      ).rejects.toThrow('Tool must have a name');
    });
  });

  describe('Notifier Plugin Pattern', () => {
    it('should send notifications on events', async () => {
      const notifications: string[] = [];
      const notifierPlugin = createTestPlugin({
        meta: { name: 'notifier', version: '1.0.0' },
        hooks: {
          afterBuild: async () => {
            notifications.push('Build successful');
          },
          afterDeploy: async (context) => {
            notifications.push(`Deployed ${context.imageName}`);
          },
        },
      });

      await notifierPlugin.hooks.afterBuild?.(createBuildContext());
      await notifierPlugin.hooks.afterDeploy?.(createDeployContext({ imageName: 'my-app' }));

      expect(notifications).toEqual(['Build successful', 'Deployed my-app']);
    });
  });
});
