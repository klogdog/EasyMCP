/**
 * Configuration Override System for MCP Server
 * 
 * This module extends the config parser with:
 * - Multiple config source merging with precedence
 * - CLI argument parsing (--config.key=value)
 * - Environment-specific config loading
 * - Config debugging utilities
 * - File watching for development
 */

import * as fs from "fs";
import * as path from "path";
import {
    Config,
    parseConfig,
    parseConfigString,
    validateConfig,
    deepMerge,
    substituteEnvVarsRecursive,
    DEFAULT_CONFIG,
    ConfigParseError,
    ParseOptions,
} from "./config-parser";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Source annotation for config values
 */
export interface ConfigSource {
    source: "default" | "file" | "env-file" | "env-var" | "cli";
    path?: string;
    name?: string;
}

/**
 * Config value with source tracking
 */
export interface AnnotatedValue {
    value: unknown;
    source: ConfigSource;
}

/**
 * Full configuration with source annotations
 */
export type AnnotatedConfig = {
    [K in keyof Config]: Config[K] extends Record<string, unknown>
    ? { [P in keyof Config[K]]: AnnotatedValue }
    : AnnotatedValue;
};

/**
 * Merge strategy options
 */
export interface MergeStrategy {
    /** How to merge arrays: 'replace' | 'concat' | 'unique' */
    arrays: "replace" | "concat" | "unique";
    /** How to merge objects: 'deep' | 'shallow' */
    objects: "deep" | "shallow";
}

/**
 * Options for loading configuration with overrides
 */
export interface LoadConfigOptions extends ParseOptions {
    /** Base config file path */
    configPath?: string;
    /** Environment name (defaults to NODE_ENV) */
    env?: string;
    /** CLI arguments to parse */
    cliArgs?: string[];
    /** Enable debug output */
    debug?: boolean;
    /** Enable config file watching */
    watch?: boolean;
    /** Callback on config change (when watching) */
    onChange?: (config: Config) => void;
    /** Merge strategy */
    mergeStrategy?: Partial<MergeStrategy>;
}

/**
 * Result from config loading with metadata
 */
export interface LoadConfigResult {
    config: Config;
    sources: string[];
    annotated?: AnnotatedConfig;
}

// ============================================================================
// CLI Argument Parsing
// ============================================================================

/**
 * Parse CLI arguments into a partial config object
 * 
 * Supports formats:
 * - --config.server.port=3000
 * - --config.logging.level=debug
 * - --server.port=3000 (without config. prefix)
 * 
 * @param args - Array of CLI arguments
 * @returns Partial config object from CLI args
 */
export function parseCliArgs(args: string[]): Partial<Config> {
    const result: Record<string, unknown> = {};

    for (const arg of args) {
        // Match --config.path.to.value=value or --path.to.value=value
        const match = arg.match(/^--(?:config\.)?([a-zA-Z][a-zA-Z0-9.]*?)=(.*)$/);
        if (!match) continue;

        const [, keyPath, value] = match;
        if (!keyPath) continue;

        const keys = keyPath.split(".");
        let current = result;

        // Build nested object structure
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i]!;
            if (!(key in current)) {
                current[key] = {};
            }
            current = current[key] as Record<string, unknown>;
        }

        // Set the value with type coercion
        const lastKey = keys[keys.length - 1]!;
        current[lastKey] = coerceValue(value ?? "");
    }

    return result as Partial<Config>;
}

/**
 * Coerce string value to appropriate type
 */
function coerceValue(value: string): unknown {
    // Boolean
    if (value === "true") return true;
    if (value === "false") return false;

    // Number
    if (/^-?\d+$/.test(value)) return parseInt(value, 10);
    if (/^-?\d*\.\d+$/.test(value)) return parseFloat(value);

    // Null/undefined
    if (value === "null") return null;
    if (value === "undefined") return undefined;

    // Array (JSON)
    if (value.startsWith("[") && value.endsWith("]")) {
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }

    // Object (JSON)
    if (value.startsWith("{") && value.endsWith("}")) {
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }

    // String
    return value;
}

/**
 * Parse environment variables with CONFIG_ prefix into config object
 * 
 * Converts CONFIG_SERVER_PORT to server.port
 * 
 * @returns Partial config from environment variables
 */
export function parseEnvVarsToConfig(): Partial<Config> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(process.env)) {
        if (!key.startsWith("CONFIG_") || value === undefined) continue;

        // Convert CONFIG_SERVER_PORT to server.port
        const configPath = key
            .substring(7) // Remove "CONFIG_"
            .toLowerCase()
            .split("_");

        let current = result;
        for (let i = 0; i < configPath.length - 1; i++) {
            const part = configPath[i]!;
            if (!(part in current)) {
                current[part] = {};
            }
            current = current[part] as Record<string, unknown>;
        }

        const lastPart = configPath[configPath.length - 1]!;
        current[lastPart] = coerceValue(value);
    }

    return result as Partial<Config>;
}

// ============================================================================
// Config Merging
// ============================================================================

/**
 * Default merge strategy
 */
const DEFAULT_MERGE_STRATEGY: MergeStrategy = {
    arrays: "replace",
    objects: "deep",
};

/**
 * Merge multiple config objects with strategy
 * 
 * @param base - Base configuration
 * @param overrides - Override configurations (in order of precedence)
 * @param strategy - Merge strategy options
 * @returns Merged configuration
 */
export function mergeConfigs(
    base: Config,
    ...overrides: Array<Partial<Config>>
): Config {
    let result = { ...base };

    for (const override of overrides) {
        if (override && Object.keys(override).length > 0) {
            result = deepMerge(result as unknown as Record<string, unknown>, override as Record<string, unknown>) as unknown as Config;
        }
    }

    return result;
}

/**
 * Merge with custom strategy
 */
export function mergeConfigsWithStrategy(
    base: Config,
    override: Partial<Config>,
    strategy: MergeStrategy = DEFAULT_MERGE_STRATEGY
): Config {
    return mergeWithStrategy(base, override, strategy) as Config;
}

function mergeWithStrategy(
    target: unknown,
    source: unknown,
    strategy: MergeStrategy
): unknown {
    if (source === undefined || source === null) {
        return target;
    }

    if (Array.isArray(source) && Array.isArray(target)) {
        switch (strategy.arrays) {
            case "concat":
                return [...target, ...source];
            case "unique":
                return [...new Set([...target, ...source])];
            case "replace":
            default:
                return source;
        }
    }

    if (isPlainObject(source) && isPlainObject(target)) {
        if (strategy.objects === "shallow") {
            return { ...target, ...source };
        }

        const result: Record<string, unknown> = { ...target };
        for (const key of Object.keys(source)) {
            result[key] = mergeWithStrategy(
                target[key],
                source[key],
                strategy
            );
        }
        return result;
    }

    return source;
}

function isPlainObject(obj: unknown): obj is Record<string, unknown> {
    return obj !== null && typeof obj === "object" && !Array.isArray(obj);
}

// ============================================================================
// Environment-Specific Config Loading
// ============================================================================

/**
 * Find environment-specific config file
 * 
 * @param baseDir - Base directory to search
 * @param env - Environment name
 * @returns Path to env-specific config or undefined
 */
export function findEnvConfig(baseDir: string, env: string): string | undefined {
    const candidates = [
        `config.${env}.yaml`,
        `config.${env}.yml`,
        `${env}.yaml`,
        `${env}.yml`,
        `config/${env}.yaml`,
        `config/${env}.yml`,
    ];

    for (const candidate of candidates) {
        const fullPath = path.resolve(baseDir, candidate);
        if (fs.existsSync(fullPath)) {
            return fullPath;
        }
    }

    return undefined;
}

// ============================================================================
// Debug Utilities
// ============================================================================

/**
 * Create annotated config showing source of each value
 */
export function annotateConfigSources(
    _config: Config,
    sources: Array<{ config: Partial<Config>; source: ConfigSource }>
): Map<string, ConfigSource> {
    const annotations = new Map<string, ConfigSource>();

    function annotate(
        obj: unknown,
        source: ConfigSource,
        path: string[] = []
    ): void {
        if (obj === null || obj === undefined) return;

        if (Array.isArray(obj)) {
            annotations.set(path.join("."), source);
            obj.forEach((item, index) => {
                annotate(item, source, [...path, String(index)]);
            });
        } else if (typeof obj === "object") {
            for (const [key, value] of Object.entries(obj)) {
                annotate(value, source, [...path, key]);
            }
        } else {
            annotations.set(path.join("."), source);
        }
    }

    // Annotate from lowest to highest priority
    for (const { config: sourceConfig, source } of sources) {
        annotate(sourceConfig, source);
    }

    return annotations;
}

/**
 * Print debug information about config
 */
export function debugConfig(
    config: Config,
    annotations?: Map<string, ConfigSource>
): string {
    const lines: string[] = [];
    lines.push("=== Configuration Debug ===\n");

    function printValue(
        key: string,
        value: unknown,
        indent: number = 0
    ): void {
        const prefix = "  ".repeat(indent);
        const annotation = annotations?.get(key);
        const sourceInfo = annotation
            ? ` [${annotation.source}${annotation.path ? `: ${annotation.path}` : ""}]`
            : "";

        if (value === null || value === undefined) {
            lines.push(`${prefix}${key}: ${value}${sourceInfo}`);
        } else if (Array.isArray(value)) {
            lines.push(`${prefix}${key}:${sourceInfo}`);
            value.forEach((item, index) => {
                printValue(`${key}.${index}`, item, indent + 1);
            });
        } else if (typeof value === "object") {
            lines.push(`${prefix}${key}:${sourceInfo}`);
            for (const [k, v] of Object.entries(value)) {
                printValue(`${key}.${k}`, v, indent + 1);
            }
        } else {
            // Mask sensitive values
            const displayValue =
                key.toLowerCase().includes("key") ||
                    key.toLowerCase().includes("secret") ||
                    key.toLowerCase().includes("password")
                    ? "********"
                    : String(value);
            lines.push(`${prefix}${key}: ${displayValue}${sourceInfo}`);
        }
    }

    for (const [key, value] of Object.entries(config)) {
        printValue(key, value);
    }

    lines.push("\n=== End Configuration ===");
    return lines.join("\n");
}

// ============================================================================
// File Watching
// ============================================================================

/**
 * Watch config files for changes
 */
export class ConfigWatcher {
    private watchers: fs.FSWatcher[] = [];
    private debounceTimer: NodeJS.Timeout | null = null;
    private isWatching = false;

    constructor(
        private files: string[],
        private onChange: (changedFile: string) => void,
        private debounceMs: number = 500
    ) { }

    start(): void {
        if (this.isWatching) return;
        this.isWatching = true;

        for (const file of this.files) {
            if (!fs.existsSync(file)) continue;

            try {
                const watcher = fs.watch(file, (eventType) => {
                    if (eventType === "change") {
                        this.handleChange(file);
                    }
                });
                this.watchers.push(watcher);
            } catch {
                // Ignore watch errors
            }
        }
    }

    stop(): void {
        this.isWatching = false;
        for (const watcher of this.watchers) {
            watcher.close();
        }
        this.watchers = [];
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
    }

    private handleChange(file: string): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.onChange(file);
        }, this.debounceMs);
    }
}

// ============================================================================
// Main Load Function with Overrides
// ============================================================================

/**
 * Load configuration with full override system
 * 
 * Precedence order (lowest to highest):
 * 1. Built-in defaults
 * 2. Base config file
 * 3. Environment-specific config file
 * 4. CONFIG_* environment variables
 * 5. CLI arguments (--config.key=value)
 * 
 * @param options - Loading options
 * @returns Configuration with metadata
 * 
 * @example
 * ```typescript
 * const { config, sources } = await loadConfigWithOverrides({
 *   configPath: './config/base.yaml',
 *   env: 'production',
 *   cliArgs: process.argv.slice(2),
 *   debug: true,
 * });
 * ```
 */
export async function loadConfigWithOverrides(
    options: LoadConfigOptions = {}
): Promise<LoadConfigResult> {
    const {
        configPath,
        env = process.env.NODE_ENV || "development",
        cliArgs = [],
        debug = false,
        watch = false,
        onChange,
        substituteEnv = true,
        validate = true,
    } = options;

    const sources: string[] = [];
    const configSources: Array<{ config: Partial<Config>; source: ConfigSource }> = [];

    // 1. Start with defaults
    let config: Config = { ...DEFAULT_CONFIG } as Config;
    sources.push("defaults");
    configSources.push({
        config: DEFAULT_CONFIG as Partial<Config>,
        source: { source: "default" },
    });

    // 2. Load base config file
    let baseDir = process.cwd();
    if (configPath) {
        try {
            const baseConfig = await parseConfig(configPath, {
                strict: false,
                mergeDefaults: false,
                substituteEnv: false,
                validate: false,
            });
            config = mergeConfigs(config, baseConfig);
            sources.push(`file: ${configPath}`);
            baseDir = path.dirname(path.resolve(configPath));
            configSources.push({
                config: baseConfig,
                source: { source: "file", path: configPath },
            });
        } catch (error) {
            if (options.strict) {
                throw error;
            }
        }
    }

    // 3. Load environment-specific config
    const envConfigPath = findEnvConfig(baseDir, env);
    if (envConfigPath) {
        try {
            const envConfig = await parseConfig(envConfigPath, {
                strict: false,
                mergeDefaults: false,
                substituteEnv: false,
                validate: false,
            });
            config = mergeConfigs(config, envConfig);
            sources.push(`env-file: ${envConfigPath}`);
            configSources.push({
                config: envConfig,
                source: { source: "env-file", path: envConfigPath },
            });
        } catch {
            // Ignore env config errors
        }
    }

    // 4. Apply CONFIG_* environment variables
    const envVarConfig = parseEnvVarsToConfig();
    if (Object.keys(envVarConfig).length > 0) {
        config = mergeConfigs(config, envVarConfig);
        sources.push("environment variables");
        configSources.push({
            config: envVarConfig,
            source: { source: "env-var" },
        });
    }

    // 5. Apply CLI arguments
    const cliConfig = parseCliArgs(cliArgs);
    if (Object.keys(cliConfig).length > 0) {
        config = mergeConfigs(config, cliConfig);
        sources.push("CLI arguments");
        configSources.push({
            config: cliConfig,
            source: { source: "cli" },
        });
    }

    // Substitute environment variables
    if (substituteEnv) {
        config = substituteEnvVarsRecursive(config) as Config;
    }

    // Validate final config
    if (validate) {
        const result = validateConfig(config);
        if (!result.success) {
            const firstError = result.errors[0];
            throw new ConfigParseError(
                `Validation error: ${firstError?.message || "Unknown error"}`,
                undefined,
                undefined,
                undefined,
                firstError?.path
            );
        }
    }

    // Debug output
    if (debug) {
        const annotations = annotateConfigSources(config, configSources);
        console.log(debugConfig(config, annotations));
        console.log("\nConfig sources:", sources.join(" → "));
    }

    // Set up file watching
    if (watch && onChange) {
        const watchFiles = [configPath, envConfigPath].filter(Boolean) as string[];
        const watcher = new ConfigWatcher(watchFiles, async (changedFile) => {
            console.log(`Config file changed: ${changedFile}`);
            try {
                const { config: newConfig } = await loadConfigWithOverrides({
                    ...options,
                    watch: false, // Don't re-enable watching
                });
                onChange(newConfig);
            } catch (error) {
                console.error("Error reloading config:", error);
            }
        });
        watcher.start();
    }

    return {
        config,
        sources,
        annotated: debug ? undefined : undefined, // TODO: Full annotation support
    };
}

/**
 * Simple load function with common defaults
 */
export async function loadConfig(
    configPath?: string,
    options: Omit<LoadConfigOptions, "configPath"> = {}
): Promise<Config> {
    const { config } = await loadConfigWithOverrides({
        ...options,
        configPath,
    });
    return config;
}

// ============================================================================
// Exports
// ============================================================================

export {
    Config,
    ParseOptions,
    parseConfig,
    parseConfigString,
    validateConfig,
    deepMerge,
    substituteEnvVarsRecursive,
    DEFAULT_CONFIG,
    ConfigParseError,
};
