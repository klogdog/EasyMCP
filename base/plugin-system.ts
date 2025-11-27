/**
 * MCP Generator Plugin System
 * 
 * Provides extensibility through a hook-based plugin architecture:
 * - Plugin discovery and loading
 * - Lifecycle hooks for build process
 * - Plugin configuration
 * - Dependency management
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

/**
 * Plugin metadata
 */
export interface PluginMeta {
  /** Unique plugin name */
  name: string;
  /** Semantic version */
  version: string;
  /** Plugin description */
  description?: string;
  /** Plugin author */
  author?: string;
  /** Other plugins this depends on */
  dependencies?: string[];
  /** Plugin configuration schema */
  configSchema?: Record<string, unknown>;
}

/**
 * Build context passed to hooks
 */
export interface BuildContext {
  /** Current manifest being built */
  manifest: Record<string, unknown>;
  /** Build configuration */
  config: Record<string, unknown>;
  /** Output directory */
  outputDir: string;
  /** Loaded tools */
  tools: Array<{ name: string; path: string; type: string }>;
  /** Loaded connectors */
  connectors: Array<{ name: string; path: string; type: string }>;
  /** Build metadata */
  buildMeta: {
    startTime: Date;
    version: string;
    environment: string;
  };
}

/**
 * Deploy context passed to deploy hooks
 */
export interface DeployContext {
  /** Built image name */
  imageName: string;
  /** Image tag */
  imageTag: string;
  /** Container configuration */
  containerConfig: Record<string, unknown>;
  /** Deployment environment */
  environment: string;
}

/**
 * Tool context passed to tool hooks
 */
export interface ToolContext {
  /** Tool name */
  name: string;
  /** Tool file path */
  path: string;
  /** Tool type (TypeScript/Python) */
  type: string;
  /** Tool metadata */
  meta: Record<string, unknown>;
  /** Tool module exports */
  exports: unknown;
}

/**
 * Hook result that can modify context
 */
export interface HookResult<T = unknown> {
  /** Modified context (optional) */
  context?: T;
  /** Continue with other hooks */
  continue?: boolean;
  /** Additional data to pass to next hook */
  data?: Record<string, unknown>;
}

/**
 * Plugin lifecycle hooks
 */
export interface PluginHooks {
  /** Called before build starts */
  beforeBuild?: (context: BuildContext) => Promise<HookResult<BuildContext> | void>;
  /** Called after build completes */
  afterBuild?: (context: BuildContext) => Promise<void>;
  /** Called before deploy */
  beforeDeploy?: (context: DeployContext) => Promise<HookResult<DeployContext> | void>;
  /** Called after deploy */
  afterDeploy?: (context: DeployContext) => Promise<void>;
  /** Called when a tool is loaded */
  onToolLoaded?: (context: ToolContext) => Promise<HookResult<ToolContext> | void>;
  /** Called when a connector is loaded */
  onConnectorLoaded?: (context: ToolContext) => Promise<void>;
  /** Called on plugin initialization */
  onInit?: (config: Record<string, unknown>) => Promise<void>;
  /** Called on plugin shutdown */
  onShutdown?: () => Promise<void>;
  /** Called when manifest is generated */
  onManifestGenerated?: (manifest: Record<string, unknown>) => Promise<Record<string, unknown>>;
  /** Called when Dockerfile is generated */
  onDockerfileGenerated?: (dockerfile: string) => Promise<string>;
}

/**
 * Plugin interface
 */
export interface Plugin {
  /** Plugin metadata */
  meta: PluginMeta;
  /** Plugin hooks */
  hooks: PluginHooks;
}

/**
 * Loaded plugin with runtime info
 */
export interface LoadedPlugin {
  plugin: Plugin;
  path: string;
  enabled: boolean;
  config: Record<string, unknown>;
  loadedAt: Date;
  error?: string;
}

/**
 * Plugin loader configuration
 */
export interface PluginLoaderConfig {
  /** Directory to scan for plugins */
  pluginDir: string;
  /** Plugins configuration from config file */
  pluginConfig: Record<string, Record<string, unknown>>;
  /** List of plugins to disable */
  disabledPlugins?: string[];
}

// ============================================================================
// Plugin Loader
// ============================================================================

/**
 * Loads and manages plugins
 */
export class PluginLoader extends EventEmitter {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private config: PluginLoaderConfig;
  private loadOrder: string[] = [];

  constructor(config: PluginLoaderConfig) {
    super();
    this.config = config;
  }

  /**
   * Discover and load all plugins
   */
  async loadAll(): Promise<void> {
    const pluginDir = this.config.pluginDir;

    if (!fs.existsSync(pluginDir)) {
      this.emit('warn', `Plugin directory not found: ${pluginDir}`);
      return;
    }

    const entries = fs.readdirSync(pluginDir, { withFileTypes: true });
    const pluginPaths: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Look for index.ts or index.js
        const indexPath = path.join(pluginDir, entry.name, 'index.ts');
        const jsPath = path.join(pluginDir, entry.name, 'index.js');
        
        if (fs.existsSync(indexPath)) {
          pluginPaths.push(indexPath);
        } else if (fs.existsSync(jsPath)) {
          pluginPaths.push(jsPath);
        }
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) {
        pluginPaths.push(path.join(pluginDir, entry.name));
      }
    }

    // Load plugins
    for (const pluginPath of pluginPaths) {
      await this.loadPlugin(pluginPath);
    }

    // Resolve dependencies and determine load order
    this.resolveDependencies();

    // Initialize plugins in order
    await this.initializePlugins();
  }

  /**
   * Load a single plugin from path
   */
  async loadPlugin(pluginPath: string): Promise<LoadedPlugin | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const module = require(pluginPath);
      const plugin: Plugin = module.default || module;

      if (!this.validatePlugin(plugin)) {
        throw new Error('Invalid plugin structure');
      }

      const name = plugin.meta.name;
      const isDisabled = this.config.disabledPlugins?.includes(name) ?? false;
      const config = this.config.pluginConfig[name] ?? {};

      const loadedPlugin: LoadedPlugin = {
        plugin,
        path: pluginPath,
        enabled: !isDisabled,
        config,
        loadedAt: new Date(),
      };

      this.plugins.set(name, loadedPlugin);
      this.emit('loaded', { name, path: pluginPath });

      return loadedPlugin;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit('error', { path: pluginPath, error: errorMessage });
      return null;
    }
  }

  /**
   * Validate plugin structure
   */
  private validatePlugin(plugin: unknown): plugin is Plugin {
    if (!plugin || typeof plugin !== 'object') {
      return false;
    }

    const p = plugin as Record<string, unknown>;
    
    if (!p.meta || typeof p.meta !== 'object') {
      return false;
    }

    const meta = p.meta as Record<string, unknown>;
    if (typeof meta.name !== 'string' || typeof meta.version !== 'string') {
      return false;
    }

    if (!p.hooks || typeof p.hooks !== 'object') {
      return false;
    }

    return true;
  }

  /**
   * Resolve plugin dependencies and determine load order
   */
  private resolveDependencies(): void {
    const resolved: Set<string> = new Set();
    const unresolved: Set<string> = new Set();
    const order: string[] = [];

    const resolve = (name: string): void => {
      if (resolved.has(name)) {
        return;
      }

      if (unresolved.has(name)) {
        throw new Error(`Circular dependency detected: ${name}`);
      }

      const loadedPlugin = this.plugins.get(name);
      if (!loadedPlugin) {
        throw new Error(`Plugin not found: ${name}`);
      }

      unresolved.add(name);

      const deps = loadedPlugin.plugin.meta.dependencies ?? [];
      for (const dep of deps) {
        if (!this.plugins.has(dep)) {
          throw new Error(`Missing dependency: ${name} requires ${dep}`);
        }
        resolve(dep);
      }

      unresolved.delete(name);
      resolved.add(name);
      order.push(name);
    };

    for (const name of this.plugins.keys()) {
      resolve(name);
    }

    this.loadOrder = order;
  }

  /**
   * Initialize plugins in dependency order
   */
  private async initializePlugins(): Promise<void> {
    for (const name of this.loadOrder) {
      const loadedPlugin = this.plugins.get(name);
      if (!loadedPlugin || !loadedPlugin.enabled) {
        continue;
      }

      try {
        const onInit = loadedPlugin.plugin.hooks.onInit;
        if (onInit) {
          await onInit(loadedPlugin.config);
        }
        this.emit('initialized', { name });
      } catch (error) {
        loadedPlugin.error = error instanceof Error ? error.message : String(error);
        this.emit('initError', { name, error: loadedPlugin.error });
      }
    }
  }

  /**
   * Get loaded plugin by name
   */
  getPlugin(name: string): LoadedPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Get all loaded plugins
   */
  getAllPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get enabled plugins in load order
   */
  getEnabledPlugins(): LoadedPlugin[] {
    return this.loadOrder
      .map(name => this.plugins.get(name))
      .filter((p): p is LoadedPlugin => p !== undefined && p.enabled);
  }

  /**
   * Enable a plugin
   */
  enablePlugin(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (plugin) {
      plugin.enabled = true;
      return true;
    }
    return false;
  }

  /**
   * Disable a plugin
   */
  disablePlugin(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (plugin) {
      plugin.enabled = false;
      return true;
    }
    return false;
  }

  /**
   * Shutdown all plugins
   */
  async shutdown(): Promise<void> {
    // Shutdown in reverse order
    for (const name of [...this.loadOrder].reverse()) {
      const loadedPlugin = this.plugins.get(name);
      if (!loadedPlugin || !loadedPlugin.enabled) {
        continue;
      }

      try {
        const onShutdown = loadedPlugin.plugin.hooks.onShutdown;
        if (onShutdown) {
          await onShutdown();
        }
      } catch (error) {
        this.emit('shutdownError', { name, error });
      }
    }
  }
}

// ============================================================================
// Hook Runner
// ============================================================================

/**
 * Runs plugin hooks in order
 */
export class HookRunner {
  private loader: PluginLoader;

  constructor(loader: PluginLoader) {
    this.loader = loader;
  }

  /**
   * Run beforeBuild hooks
   */
  async runBeforeBuild(context: BuildContext): Promise<BuildContext> {
    let currentContext = { ...context };

    for (const loadedPlugin of this.loader.getEnabledPlugins()) {
      const hook = loadedPlugin.plugin.hooks.beforeBuild;
      if (!hook) continue;

      try {
        const result = await hook(currentContext);
        if (result?.context) {
          currentContext = result.context;
        }
        if (result?.continue === false) {
          break;
        }
      } catch (error) {
        throw new Error(
          `Plugin ${loadedPlugin.plugin.meta.name} beforeBuild failed: ${error}`
        );
      }
    }

    return currentContext;
  }

  /**
   * Run afterBuild hooks
   */
  async runAfterBuild(context: BuildContext): Promise<void> {
    for (const loadedPlugin of this.loader.getEnabledPlugins()) {
      const hook = loadedPlugin.plugin.hooks.afterBuild;
      if (!hook) continue;

      try {
        await hook(context);
      } catch (error) {
        throw new Error(
          `Plugin ${loadedPlugin.plugin.meta.name} afterBuild failed: ${error}`
        );
      }
    }
  }

  /**
   * Run beforeDeploy hooks
   */
  async runBeforeDeploy(context: DeployContext): Promise<DeployContext> {
    let currentContext = { ...context };

    for (const loadedPlugin of this.loader.getEnabledPlugins()) {
      const hook = loadedPlugin.plugin.hooks.beforeDeploy;
      if (!hook) continue;

      try {
        const result = await hook(currentContext);
        if (result?.context) {
          currentContext = result.context;
        }
        if (result?.continue === false) {
          break;
        }
      } catch (error) {
        throw new Error(
          `Plugin ${loadedPlugin.plugin.meta.name} beforeDeploy failed: ${error}`
        );
      }
    }

    return currentContext;
  }

  /**
   * Run afterDeploy hooks
   */
  async runAfterDeploy(context: DeployContext): Promise<void> {
    for (const loadedPlugin of this.loader.getEnabledPlugins()) {
      const hook = loadedPlugin.plugin.hooks.afterDeploy;
      if (!hook) continue;

      try {
        await hook(context);
      } catch (error) {
        throw new Error(
          `Plugin ${loadedPlugin.plugin.meta.name} afterDeploy failed: ${error}`
        );
      }
    }
  }

  /**
   * Run onToolLoaded hooks
   */
  async runOnToolLoaded(context: ToolContext): Promise<ToolContext> {
    let currentContext = { ...context };

    for (const loadedPlugin of this.loader.getEnabledPlugins()) {
      const hook = loadedPlugin.plugin.hooks.onToolLoaded;
      if (!hook) continue;

      try {
        const result = await hook(currentContext);
        if (result?.context) {
          currentContext = result.context;
        }
      } catch (error) {
        throw new Error(
          `Plugin ${loadedPlugin.plugin.meta.name} onToolLoaded failed: ${error}`
        );
      }
    }

    return currentContext;
  }

  /**
   * Run onConnectorLoaded hooks
   */
  async runOnConnectorLoaded(context: ToolContext): Promise<void> {
    for (const loadedPlugin of this.loader.getEnabledPlugins()) {
      const hook = loadedPlugin.plugin.hooks.onConnectorLoaded;
      if (!hook) continue;

      try {
        await hook(context);
      } catch (error) {
        throw new Error(
          `Plugin ${loadedPlugin.plugin.meta.name} onConnectorLoaded failed: ${error}`
        );
      }
    }
  }

  /**
   * Run onManifestGenerated hooks
   */
  async runOnManifestGenerated(manifest: Record<string, unknown>): Promise<Record<string, unknown>> {
    let currentManifest = { ...manifest };

    for (const loadedPlugin of this.loader.getEnabledPlugins()) {
      const hook = loadedPlugin.plugin.hooks.onManifestGenerated;
      if (!hook) continue;

      try {
        currentManifest = await hook(currentManifest);
      } catch (error) {
        throw new Error(
          `Plugin ${loadedPlugin.plugin.meta.name} onManifestGenerated failed: ${error}`
        );
      }
    }

    return currentManifest;
  }

  /**
   * Run onDockerfileGenerated hooks
   */
  async runOnDockerfileGenerated(dockerfile: string): Promise<string> {
    let currentDockerfile = dockerfile;

    for (const loadedPlugin of this.loader.getEnabledPlugins()) {
      const hook = loadedPlugin.plugin.hooks.onDockerfileGenerated;
      if (!hook) continue;

      try {
        currentDockerfile = await hook(currentDockerfile);
      } catch (error) {
        throw new Error(
          `Plugin ${loadedPlugin.plugin.meta.name} onDockerfileGenerated failed: ${error}`
        );
      }
    }

    return currentDockerfile;
  }
}

// ============================================================================
// Plugin Registry
// ============================================================================

/**
 * Central registry for plugins
 */
export class PluginRegistry {
  private loader: PluginLoader;
  private hookRunner: HookRunner;

  constructor(config: PluginLoaderConfig) {
    this.loader = new PluginLoader(config);
    this.hookRunner = new HookRunner(this.loader);
  }

  /**
   * Initialize registry and load plugins
   */
  async initialize(): Promise<void> {
    await this.loader.loadAll();
  }

  /**
   * Get the hook runner
   */
  getHookRunner(): HookRunner {
    return this.hookRunner;
  }

  /**
   * Get the plugin loader
   */
  getLoader(): PluginLoader {
    return this.loader;
  }

  /**
   * List all plugins with status
   */
  listPlugins(): Array<{
    name: string;
    version: string;
    enabled: boolean;
    error?: string;
  }> {
    return this.loader.getAllPlugins().map(p => ({
      name: p.plugin.meta.name,
      version: p.plugin.meta.version,
      enabled: p.enabled,
      error: p.error,
    }));
  }

  /**
   * Shutdown registry
   */
  async shutdown(): Promise<void> {
    await this.loader.shutdown();
  }
}
