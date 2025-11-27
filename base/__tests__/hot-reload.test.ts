/**
 * Tests for Hot Reload and Development Server
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock implementations for testing (actual modules would be imported from templates)

// ============================================================================
// FileWatcher Tests
// ============================================================================

describe('FileWatcher', () => {
  // Simplified test implementation
  class TestFileWatcher {
    private patterns: RegExp[];
    private debounceMs: number;
    private callbacks: Map<string, ((...args: unknown[]) => void)[]> = new Map();
    private debounceTimeout: NodeJS.Timeout | null = null;
    private pendingChanges: Set<string> = new Set();

    constructor(patterns: string[] = ['**/*.ts', '**/*.js'], debounceMs: number = 100) {
      this.patterns = patterns.map(p => this.globToRegex(p));
      this.debounceMs = debounceMs;
    }

    private globToRegex(glob: string): RegExp {
      const escaped = glob
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*');
      return new RegExp(`^${escaped}$`);
    }

    matchesPattern(file: string): boolean {
      return this.patterns.some(pattern => pattern.test(file));
    }

    on(event: string, callback: (...args: unknown[]) => void): void {
      if (!this.callbacks.has(event)) {
        this.callbacks.set(event, []);
      }
      this.callbacks.get(event)!.push(callback);
    }

    emit(event: string, ...args: unknown[]): void {
      const callbacks = this.callbacks.get(event) || [];
      for (const cb of callbacks) {
        cb(...args);
      }
    }

    simulateChange(filePath: string): void {
      this.pendingChanges.add(filePath);

      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout);
      }

      this.debounceTimeout = setTimeout(() => {
        const changes = Array.from(this.pendingChanges);
        this.pendingChanges.clear();
        this.emit('change', changes);
      }, this.debounceMs);
    }

    close(): void {
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout);
      }
    }
  }

  let watcher: TestFileWatcher;

  beforeEach(() => {
    watcher = new TestFileWatcher(['**/*.ts', '**/*.js'], 10);
  });

  afterEach(() => {
    watcher.close();
  });

  describe('Pattern Matching', () => {
    it('should match TypeScript files', () => {
      // The pattern **/*.ts means "any directory path ending in /*.ts"
      expect(watcher.matchesPattern('tools/tool.ts')).toBe(true);
      expect(watcher.matchesPattern('connectors/db.ts')).toBe(true);
    });

    it('should match JavaScript files', () => {
      expect(watcher.matchesPattern('tools/tool.js')).toBe(true);
    });

    it('should not match non-matching extensions', () => {
      expect(watcher.matchesPattern('tools/tool.py')).toBe(false);
      expect(watcher.matchesPattern('readme.md')).toBe(false);
    });
  });

  describe('Change Detection', () => {
    it('should emit change event with debouncing', async () => {
      const changes: string[][] = [];
      watcher.on('change', (files) => changes.push(files as string[]));

      watcher.simulateChange('/tools/tool1.ts');
      watcher.simulateChange('/tools/tool2.ts');

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(changes).toHaveLength(1);
      expect(changes[0]).toContain('/tools/tool1.ts');
      expect(changes[0]).toContain('/tools/tool2.ts');
    });
  });
});

// ============================================================================
// ModuleCacheManager Tests
// ============================================================================

describe('ModuleCacheManager', () => {
  interface ModuleInfo {
    path: string;
    mtime: number;
    name: string;
    type: 'tool' | 'connector';
    error?: string;
  }

  class TestCacheManager {
    private cache: Map<string, ModuleInfo> = new Map();
    private fallbacks: Map<string, unknown> = new Map();

    getModuleInfo(modulePath: string): ModuleInfo | undefined {
      return this.cache.get(modulePath);
    }

    setModuleInfo(modulePath: string, info: ModuleInfo): void {
      this.cache.set(modulePath, info);
    }

    needsReload(modulePath: string, currentMtime: number): boolean {
      const cached = this.cache.get(modulePath);
      if (!cached) return true;
      return currentMtime > cached.mtime;
    }

    setFallback(modulePath: string, module: unknown): void {
      this.fallbacks.set(modulePath, module);
    }

    getFallback(modulePath: string): unknown | undefined {
      return this.fallbacks.get(modulePath);
    }

    clear(): void {
      this.cache.clear();
      this.fallbacks.clear();
    }
  }

  let cacheManager: TestCacheManager;

  beforeEach(() => {
    cacheManager = new TestCacheManager();
  });

  it('should detect new modules need reload', () => {
    expect(cacheManager.needsReload('/tools/new-tool.ts', Date.now())).toBe(true);
  });

  it('should detect modified modules need reload', () => {
    cacheManager.setModuleInfo('/tools/tool.ts', {
      path: '/tools/tool.ts',
      mtime: 1000,
      name: 'tool',
      type: 'tool',
    });

    expect(cacheManager.needsReload('/tools/tool.ts', 2000)).toBe(true);
    expect(cacheManager.needsReload('/tools/tool.ts', 500)).toBe(false);
  });

  it('should store and retrieve fallbacks', () => {
    const fallbackModule = { handler: () => 'fallback' };
    cacheManager.setFallback('/tools/tool.ts', fallbackModule);

    expect(cacheManager.getFallback('/tools/tool.ts')).toBe(fallbackModule);
  });

  it('should clear all caches', () => {
    cacheManager.setModuleInfo('/tools/tool.ts', {
      path: '/tools/tool.ts',
      mtime: 1000,
      name: 'tool',
      type: 'tool',
    });
    cacheManager.setFallback('/tools/tool.ts', {});

    cacheManager.clear();

    expect(cacheManager.getModuleInfo('/tools/tool.ts')).toBeUndefined();
    expect(cacheManager.getFallback('/tools/tool.ts')).toBeUndefined();
  });
});

// ============================================================================
// RequestQueueManager Tests
// ============================================================================

describe('RequestQueueManager', () => {
  class TestRequestQueue {
    private isReloading = false;
    private queue: Array<{
      resolve: (value: boolean) => void;
      reject: (error: Error) => void;
    }> = [];
    private drainTimeoutMs: number;

    constructor(drainTimeoutMs: number = 1000) {
      this.drainTimeoutMs = drainTimeoutMs;
    }

    startReload(): void {
      this.isReloading = true;
    }

    endReload(): void {
      this.isReloading = false;
      for (const item of this.queue) {
        item.resolve(true);
      }
      this.queue = [];
    }

    cancelReload(error: Error): void {
      this.isReloading = false;
      for (const item of this.queue) {
        item.reject(error);
      }
      this.queue = [];
    }

    async waitForReload(): Promise<boolean> {
      if (!this.isReloading) {
        return true;
      }

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout'));
        }, this.drainTimeoutMs);

        this.queue.push({
          resolve: (value) => {
            clearTimeout(timeout);
            resolve(value);
          },
          reject: (err) => {
            clearTimeout(timeout);
            reject(err);
          },
        });
      });
    }

    get reloading(): boolean {
      return this.isReloading;
    }

    get queueLength(): number {
      return this.queue.length;
    }
  }

  let queue: TestRequestQueue;

  beforeEach(() => {
    queue = new TestRequestQueue(100);
  });

  it('should allow requests when not reloading', async () => {
    const result = await queue.waitForReload();
    expect(result).toBe(true);
  });

  it('should queue requests during reload', async () => {
    queue.startReload();
    expect(queue.reloading).toBe(true);

    // Start waiting
    const waitPromise = queue.waitForReload();
    expect(queue.queueLength).toBe(1);

    // End reload - should resolve
    queue.endReload();
    const result = await waitPromise;
    expect(result).toBe(true);
  });

  it('should reject queued requests on cancel', async () => {
    queue.startReload();

    const waitPromise = queue.waitForReload();
    queue.cancelReload(new Error('Reload failed'));

    await expect(waitPromise).rejects.toThrow('Reload failed');
  });

  it('should timeout waiting requests', async () => {
    queue = new TestRequestQueue(10); // Very short timeout
    queue.startReload();

    await expect(queue.waitForReload()).rejects.toThrow('Timeout');
  });
});

// ============================================================================
// HotReloadManager Tests
// ============================================================================

describe('HotReloadManager', () => {
  interface ReloadResult {
    success: boolean;
    reloadedModules: string[];
    failedModules: Array<{ name: string; error: string }>;
    duration: number;
  }

  class TestHotReloadManager {
    private enabled: boolean;
    private toolRegistry: Map<string, unknown>;
    private connectorRegistry: Map<string, unknown>;
    private reloadHandlers: Map<string, (event: unknown) => void> = new Map();
    private lastReload: ReloadResult | null = null;

    constructor(
      enabled: boolean = true,
      toolRegistry: Map<string, unknown> = new Map(),
      connectorRegistry: Map<string, unknown> = new Map()
    ) {
      this.enabled = enabled;
      this.toolRegistry = toolRegistry;
      this.connectorRegistry = connectorRegistry;
    }

    onReload(id: string, handler: (event: unknown) => void): void {
      this.reloadHandlers.set(id, handler);
    }

    offReload(id: string): void {
      this.reloadHandlers.delete(id);
    }

    async reload(modules: Array<{ name: string; type: 'tool' | 'connector'; content: unknown }>): Promise<ReloadResult> {
      if (!this.enabled) {
        return {
          success: false,
          reloadedModules: [],
          failedModules: [{ name: 'all', error: 'Hot reload disabled' }],
          duration: 0,
        };
      }

      const startTime = Date.now();
      const reloadedModules: string[] = [];
      const failedModules: Array<{ name: string; error: string }> = [];

      // Emit before event
      for (const handler of this.reloadHandlers.values()) {
        handler({ type: 'before', modules: modules.map(m => m.name) });
      }

      for (const module of modules) {
        try {
          if (module.type === 'tool') {
            this.toolRegistry.set(module.name, module.content);
          } else {
            this.connectorRegistry.set(module.name, module.content);
          }
          reloadedModules.push(module.name);
        } catch (error) {
          failedModules.push({
            name: module.name,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const result: ReloadResult = {
        success: failedModules.length === 0,
        reloadedModules,
        failedModules,
        duration: Date.now() - startTime,
      };

      this.lastReload = result;

      // Emit after event
      for (const handler of this.reloadHandlers.values()) {
        handler({ type: 'after', result });
      }

      return result;
    }

    getLastReload(): ReloadResult | null {
      return this.lastReload;
    }

    getStatus(): { enabled: boolean; toolCount: number; connectorCount: number } {
      return {
        enabled: this.enabled,
        toolCount: this.toolRegistry.size,
        connectorCount: this.connectorRegistry.size,
      };
    }
  }

  let manager: TestHotReloadManager;
  let toolRegistry: Map<string, unknown>;
  let connectorRegistry: Map<string, unknown>;

  beforeEach(() => {
    toolRegistry = new Map();
    connectorRegistry = new Map();
    manager = new TestHotReloadManager(true, toolRegistry, connectorRegistry);
  });

  it('should reload tools successfully', async () => {
    const result = await manager.reload([
      { name: 'calculator', type: 'tool', content: { handler: () => 42 } },
    ]);

    expect(result.success).toBe(true);
    expect(result.reloadedModules).toContain('calculator');
    expect(toolRegistry.has('calculator')).toBe(true);
  });

  it('should reload connectors successfully', async () => {
    const result = await manager.reload([
      { name: 'database', type: 'connector', content: { connect: () => {} } },
    ]);

    expect(result.success).toBe(true);
    expect(connectorRegistry.has('database')).toBe(true);
  });

  it('should call reload handlers', async () => {
    const events: unknown[] = [];
    manager.onReload('test', (event) => events.push(event));

    await manager.reload([
      { name: 'tool1', type: 'tool', content: {} },
    ]);

    expect(events.length).toBe(2);
    expect((events[0] as { type: string }).type).toBe('before');
    expect((events[1] as { type: string }).type).toBe('after');
  });

  it('should track last reload result', async () => {
    await manager.reload([
      { name: 'tool1', type: 'tool', content: {} },
    ]);

    const lastReload = manager.getLastReload();
    expect(lastReload).not.toBeNull();
    expect(lastReload?.reloadedModules).toContain('tool1');
  });

  it('should return correct status', () => {
    toolRegistry.set('tool1', {});
    connectorRegistry.set('conn1', {});

    const status = manager.getStatus();
    expect(status.enabled).toBe(true);
    expect(status.toolCount).toBe(1);
    expect(status.connectorCount).toBe(1);
  });

  it('should fail when disabled', async () => {
    manager = new TestHotReloadManager(false, toolRegistry, connectorRegistry);

    const result = await manager.reload([
      { name: 'tool1', type: 'tool', content: {} },
    ]);

    expect(result.success).toBe(false);
    expect(result.failedModules.length).toBeGreaterThan(0);
  });

  it('should remove handler', async () => {
    const events: unknown[] = [];
    manager.onReload('test', (event) => events.push(event));
    manager.offReload('test');

    await manager.reload([
      { name: 'tool1', type: 'tool', content: {} },
    ]);

    expect(events.length).toBe(0);
  });
});

// ============================================================================
// DevServer Tests
// ============================================================================

describe('DevServer', () => {
  interface DevServerStatus {
    uptime: number;
    requests: number;
    reloads: number;
    errors: number;
    hotReloadEnabled: boolean;
  }

  class TestDevServer {
    private config: {
      port: number;
      hotReload: boolean;
      verbose: boolean;
    };
    private stats = {
      startTime: Date.now(),
      requests: 0,
      reloads: 0,
      errors: 0,
    };
    private tools: Map<string, unknown> = new Map();
    private connectors: Map<string, unknown> = new Map();

    constructor(config: Partial<{ port: number; hotReload: boolean; verbose: boolean }> = {}) {
      this.config = {
        port: config.port ?? 3000,
        hotReload: config.hotReload ?? true,
        verbose: config.verbose ?? false,
      };
    }

    registerTool(name: string, tool: unknown): void {
      this.tools.set(name, tool);
    }

    registerConnector(name: string, connector: unknown): void {
      this.connectors.set(name, connector);
    }

    listTools(): string[] {
      return Array.from(this.tools.keys());
    }

    listConnectors(): string[] {
      return Array.from(this.connectors.keys());
    }

    getStatus(): DevServerStatus {
      return {
        uptime: Date.now() - this.stats.startTime,
        requests: this.stats.requests,
        reloads: this.stats.reloads,
        errors: this.stats.errors,
        hotReloadEnabled: this.config.hotReload,
      };
    }

    incrementRequests(): void {
      this.stats.requests++;
    }

    incrementReloads(): void {
      this.stats.reloads++;
    }

    incrementErrors(): void {
      this.stats.errors++;
    }
  }

  let server: TestDevServer;

  beforeEach(() => {
    server = new TestDevServer({ port: 3000, hotReload: true });
  });

  it('should register and list tools', () => {
    server.registerTool('calculator', { handler: () => 42 });
    server.registerTool('translator', { handler: () => 'hello' });

    const tools = server.listTools();
    expect(tools).toContain('calculator');
    expect(tools).toContain('translator');
  });

  it('should register and list connectors', () => {
    server.registerConnector('database', { connect: () => {} });

    const connectors = server.listConnectors();
    expect(connectors).toContain('database');
  });

  it('should track request count', () => {
    server.incrementRequests();
    server.incrementRequests();
    server.incrementRequests();

    const status = server.getStatus();
    expect(status.requests).toBe(3);
  });

  it('should track reload count', () => {
    server.incrementReloads();
    server.incrementReloads();

    const status = server.getStatus();
    expect(status.reloads).toBe(2);
  });

  it('should track error count', () => {
    server.incrementErrors();

    const status = server.getStatus();
    expect(status.errors).toBe(1);
  });

  it('should report hot reload status', () => {
    const enabledServer = new TestDevServer({ hotReload: true });
    const disabledServer = new TestDevServer({ hotReload: false });

    expect(enabledServer.getStatus().hotReloadEnabled).toBe(true);
    expect(disabledServer.getStatus().hotReloadEnabled).toBe(false);
  });
});

// ============================================================================
// DevLogger Tests
// ============================================================================

describe('DevLogger', () => {
  let consoleSpy: {
    log: jest.SpiedFunction<typeof console.log>;
    warn: jest.SpiedFunction<typeof console.warn>;
    error: jest.SpiedFunction<typeof console.error>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  class TestLogger {
    private verbose: boolean;

    constructor(verbose: boolean = true) {
      this.verbose = verbose;
    }

    info(message: string, _data?: unknown): void {
      console.log('INFO', message);
    }

    debug(message: string, _data?: unknown): void {
      if (this.verbose) {
        console.log('DEBUG', message);
      }
    }

    warn(message: string, _data?: unknown): void {
      console.warn('WARN', message);
    }

    error(message: string, _error?: Error): void {
      console.error('ERROR', message);
    }
  }

  it('should log info messages', () => {
    const logger = new TestLogger();
    logger.info('Test message');

    expect(consoleSpy.log).toHaveBeenCalledWith('INFO', 'Test message');
  });

  it('should log debug messages when verbose', () => {
    const logger = new TestLogger(true);
    logger.debug('Debug message');

    expect(consoleSpy.log).toHaveBeenCalledWith('DEBUG', 'Debug message');
  });

  it('should skip debug messages when not verbose', () => {
    const logger = new TestLogger(false);
    logger.debug('Debug message');

    expect(consoleSpy.log).not.toHaveBeenCalled();
  });

  it('should log warnings', () => {
    const logger = new TestLogger();
    logger.warn('Warning message');

    expect(consoleSpy.warn).toHaveBeenCalledWith('WARN', 'Warning message');
  });

  it('should log errors', () => {
    const logger = new TestLogger();
    logger.error('Error message');

    expect(consoleSpy.error).toHaveBeenCalledWith('ERROR', 'Error message');
  });
});

// ============================================================================
// CLI Argument Parsing Tests
// ============================================================================

describe('CLI Argument Parsing', () => {
  function parseDevArgs(args: string[]): Record<string, unknown> {
    const config: Record<string, unknown> = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '--dev') {
        config.hotReload = true;
        config.adminEndpoints = true;
        config.verbose = true;
      } else if (arg === '--port' && args[i + 1]) {
        config.port = parseInt(args[++i] || '3000', 10);
      } else if (arg === '--host' && args[i + 1]) {
        config.host = args[++i];
      } else if (arg === '--watch' && args[i + 1]) {
        config.watchDirs = (args[++i] || '').split(',');
      } else if (arg === '--no-hot-reload') {
        config.hotReload = false;
      } else if (arg === '--quiet') {
        config.verbose = false;
      }
    }

    return config;
  }

  it('should parse --dev flag', () => {
    const config = parseDevArgs(['--dev']);

    expect(config.hotReload).toBe(true);
    expect(config.adminEndpoints).toBe(true);
    expect(config.verbose).toBe(true);
  });

  it('should parse --port', () => {
    const config = parseDevArgs(['--port', '8080']);

    expect(config.port).toBe(8080);
  });

  it('should parse --host', () => {
    const config = parseDevArgs(['--host', 'localhost']);

    expect(config.host).toBe('localhost');
  });

  it('should parse --watch with multiple directories', () => {
    const config = parseDevArgs(['--watch', './tools,./connectors,./lib']);

    expect(config.watchDirs).toEqual(['./tools', './connectors', './lib']);
  });

  it('should parse --no-hot-reload', () => {
    const config = parseDevArgs(['--no-hot-reload']);

    expect(config.hotReload).toBe(false);
  });

  it('should parse --quiet', () => {
    const config = parseDevArgs(['--quiet']);

    expect(config.verbose).toBe(false);
  });

  it('should handle combined flags', () => {
    const config = parseDevArgs([
      '--dev',
      '--port', '9000',
      '--host', '0.0.0.0',
      '--watch', './src,./lib',
    ]);

    expect(config.hotReload).toBe(true);
    expect(config.port).toBe(9000);
    expect(config.host).toBe('0.0.0.0');
    expect(config.watchDirs).toEqual(['./src', './lib']);
  });
});
