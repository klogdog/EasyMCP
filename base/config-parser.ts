/**
 * Configuration Parser for MCP Server
 * 
 * This module provides robust configuration file parsing with:
 * - YAML and JSON file support
 * - Environment variable substitution (${VAR} and ${VAR:-default})
 * - Schema validation using Zod
 * - Detailed error messages with line numbers
 * - Default value merging
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { z } from "zod";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Server configuration section
 */
export interface ServerConfig {
    name: string;
    version: string;
    host: string;
    port: number | string;
    cors?: boolean;
    maxRequestSize?: string;
}

/**
 * Database pool configuration
 */
export interface PoolConfig {
    min: number;
    max: number;
    idleTimeout: number;
}

/**
 * Database configuration section
 */
export interface DatabaseConfig {
    type?: "postgres" | "sqlite" | "mysql";
    url?: string;
    pool?: PoolConfig;
    poolSize?: number | string;
    timeout?: number | string;
}

/**
 * Logging configuration section
 */
export interface LoggingConfig {
    level: "debug" | "info" | "warn" | "error";
    format: "json" | "text" | "pretty";
    destination: "stdout" | "stderr" | "file" | "console";
    filePath?: string;
    rotation?: {
        maxSize?: string;
        maxFiles?: number;
        compress?: boolean;
    };
}

/**
 * Service configuration
 */
export interface ServiceConfig {
    apiKey?: string;
    endpoint?: string;
    timeout?: number;
    rateLimit?: {
        requestsPerMinute?: number;
        retryAfter?: number;
    };
}

/**
 * Connector configuration
 */
export interface ConnectorConfig {
    type: "database" | "email" | "api" | "file" | "custom";
    enabled: boolean;
    credentials?: Record<string, string>;
    settings?: Record<string, unknown>;
}

/**
 * Security configuration section
 */
export interface SecurityConfig {
    authentication?: {
        enabled: boolean;
        type?: "api-key" | "jwt" | "oauth2";
        apiKey?: string;
    };
    tls?: {
        enabled: boolean;
        certFile?: string;
        keyFile?: string;
    };
    rateLimit?: {
        enabled: boolean;
        windowMs?: number;
        maxRequests?: number;
    };
}

/**
 * Metrics configuration section
 */
export interface MetricsConfig {
    enabled: boolean;
    path?: string;
    includeDefaults?: boolean;
}

/**
 * Tool configuration
 */
export interface ToolConfig {
    enabled?: boolean;
    timeout?: number;
    settings?: Record<string, unknown>;
}

/**
 * Complete server configuration
 */
export interface Config {
    server: ServerConfig;
    database?: DatabaseConfig;
    logging?: LoggingConfig;
    services?: Record<string, ServiceConfig>;
    connectors?: Record<string, ConnectorConfig>;
    features?: Record<string, boolean>;
    security?: SecurityConfig;
    metrics?: MetricsConfig;
    tools?: Record<string, ToolConfig>;
}

/**
 * Options for parsing configuration
 */
export interface ParseOptions {
    /** Whether to throw on missing file (default: true) */
    strict?: boolean;
    /** Whether to substitute environment variables (default: true) */
    substituteEnv?: boolean;
    /** Whether to merge with defaults (default: true) */
    mergeDefaults?: boolean;
    /** Whether to validate against schema (default: true) */
    validate?: boolean;
}

/**
 * Configuration parse error with detailed information
 */
export class ConfigParseError extends Error {
    constructor(
        message: string,
        public filePath?: string,
        public line?: number,
        public column?: number,
        public fieldPath?: string
    ) {
        super(message);
        this.name = "ConfigParseError";
    }

    toString(): string {
        let result = this.message;
        if (this.filePath) {
            result += ` in ${this.filePath}`;
        }
        if (this.line !== undefined) {
            result += ` at line ${this.line}`;
            if (this.column !== undefined) {
                result += `:${this.column}`;
            }
        }
        if (this.fieldPath) {
            result += ` (field: ${this.fieldPath})`;
        }
        return result;
    }
}

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

const PoolSchema = z.object({
    min: z.number().min(1).default(2),
    max: z.number().min(1).default(10),
    idleTimeout: z.number().min(0).default(30000),
}).partial();

const DatabaseSchema = z.object({
    type: z.enum(["postgres", "sqlite", "mysql"]).optional(),
    url: z.string().optional(),
    pool: PoolSchema.optional(),
    poolSize: z.union([z.number(), z.string()]).optional(),
    timeout: z.union([z.number(), z.string()]).optional(),
}).optional();

const LoggingSchema = z.object({
    level: z.enum(["debug", "info", "warn", "error"]).default("info"),
    format: z.enum(["json", "text", "pretty"]).default("json"),
    destination: z.enum(["stdout", "stderr", "file", "console"]).default("stdout"),
    filePath: z.string().optional(),
    rotation: z.object({
        maxSize: z.string().optional(),
        maxFiles: z.number().optional(),
        compress: z.boolean().optional(),
    }).optional(),
}).optional();

const ServiceSchema = z.object({
    apiKey: z.string().optional(),
    endpoint: z.string().optional(),
    timeout: z.number().optional(),
    rateLimit: z.object({
        requestsPerMinute: z.number().optional(),
        retryAfter: z.number().optional(),
    }).optional(),
});

const ConnectorSchema = z.object({
    type: z.enum(["database", "email", "api", "file", "custom"]),
    enabled: z.boolean().default(true),
    credentials: z.record(z.string()).optional(),
    settings: z.record(z.unknown()).optional(),
});

const SecuritySchema = z.object({
    authentication: z.object({
        enabled: z.boolean().default(false),
        type: z.enum(["api-key", "jwt", "oauth2"]).optional(),
        apiKey: z.string().optional(),
    }).optional(),
    tls: z.object({
        enabled: z.boolean().default(false),
        certFile: z.string().optional(),
        keyFile: z.string().optional(),
    }).optional(),
    rateLimit: z.object({
        enabled: z.boolean().default(true),
        windowMs: z.number().optional(),
        maxRequests: z.number().optional(),
    }).optional(),
}).optional();

const MetricsSchema = z.object({
    enabled: z.boolean().default(true),
    path: z.string().default("/metrics"),
    includeDefaults: z.boolean().default(true),
}).optional();

const ToolSchema = z.object({
    enabled: z.boolean().default(true),
    timeout: z.number().optional(),
    settings: z.record(z.unknown()).optional(),
});

const ServerSchema = z.object({
    name: z.string().min(1),
    version: z.string().regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$/),
    host: z.string().default("localhost"),
    port: z.union([z.number(), z.string()]).default(8080),
    cors: z.boolean().optional(),
    maxRequestSize: z.string().optional(),
});

const ConfigSchema = z.object({
    server: ServerSchema,
    database: DatabaseSchema,
    logging: LoggingSchema,
    services: z.record(ServiceSchema).optional(),
    connectors: z.record(ConnectorSchema).optional(),
    features: z.record(z.boolean()).optional(),
    security: SecuritySchema,
    metrics: MetricsSchema,
    tools: z.record(ToolSchema).optional(),
});

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Partial<Config> = {
    server: {
        name: "mcp-server",
        version: "0.1.0",
        host: "localhost",
        port: 8080,
        cors: false,
        maxRequestSize: "10mb",
    },
    database: {
        type: "sqlite",
        pool: {
            min: 2,
            max: 10,
            idleTimeout: 30000,
        },
        timeout: 5000,
    },
    logging: {
        level: "info",
        format: "json",
        destination: "stdout",
    },
    features: {},
    security: {
        authentication: {
            enabled: false,
        },
        tls: {
            enabled: false,
        },
        rateLimit: {
            enabled: true,
            windowMs: 60000,
            maxRequests: 100,
        },
    },
    metrics: {
        enabled: true,
        path: "/metrics",
        includeDefaults: true,
    },
};

// ============================================================================
// Environment Variable Substitution
// ============================================================================

/**
 * Pattern for environment variable substitution
 * Matches: ${VAR_NAME} or ${VAR_NAME:-default_value}
 */
const ENV_VAR_PATTERN = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g;

/**
 * Substitute environment variables in a string
 * 
 * @param value - String potentially containing ${VAR} or ${VAR:-default}
 * @returns String with environment variables substituted
 */
export function substituteEnvVars(value: string): string {
    return value.replace(ENV_VAR_PATTERN, (match, varName, defaultValue) => {
        const envValue = process.env[varName];
        if (envValue !== undefined) {
            return envValue;
        }
        if (defaultValue !== undefined) {
            return defaultValue;
        }
        // Return original if no env var and no default
        return match;
    });
}

/**
 * Recursively substitute environment variables in an object
 * 
 * @param obj - Object with potential env var references
 * @returns Object with all env vars substituted
 */
export function substituteEnvVarsRecursive(obj: unknown): unknown {
    if (typeof obj === "string") {
        return substituteEnvVars(obj);
    }

    if (Array.isArray(obj)) {
        return obj.map(item => substituteEnvVarsRecursive(item));
    }

    if (obj !== null && typeof obj === "object") {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = substituteEnvVarsRecursive(value);
        }
        return result;
    }

    return obj;
}

// ============================================================================
// Deep Merge Utility
// ============================================================================

/**
 * Check if value is a plain object
 */
function isPlainObject(obj: unknown): obj is Record<string, unknown> {
    return obj !== null && typeof obj === "object" && !Array.isArray(obj);
}

/**
 * Deep merge two objects
 * 
 * @param target - Base object
 * @param source - Object to merge in (takes precedence)
 * @returns Merged object
 */
export function deepMerge<T extends Record<string, unknown>>(
    target: T,
    source: Partial<T>
): T {
    const result = { ...target };

    for (const key of Object.keys(source) as Array<keyof T>) {
        const sourceValue = source[key];
        const targetValue = target[key];

        if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
            result[key] = deepMerge(
                targetValue as Record<string, unknown>,
                sourceValue as Record<string, unknown>
            ) as T[keyof T];
        } else if (sourceValue !== undefined) {
            result[key] = sourceValue as T[keyof T];
        }
    }

    return result;
}

// ============================================================================
// Main Parse Function
// ============================================================================

/**
 * Parse a configuration file (YAML or JSON)
 * 
 * @param filePath - Path to the configuration file
 * @param options - Parsing options
 * @returns Parsed and validated configuration
 * @throws ConfigParseError on parse or validation errors
 * 
 * @example
 * ```typescript
 * const config = await parseConfig('./config/development.yaml');
 * console.log(config.server.port);
 * ```
 */
export async function parseConfig(
    filePath: string,
    options: ParseOptions = {}
): Promise<Config> {
    const {
        strict = true,
        substituteEnv = true,
        mergeDefaults = true,
        validate = true,
    } = options;

    // Resolve absolute path
    const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);

    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
        if (strict) {
            throw new ConfigParseError(
                `Configuration file not found: ${absolutePath}`,
                absolutePath
            );
        }
        // Return defaults in non-strict mode
        return DEFAULT_CONFIG as Config;
    }

    // Read file content
    let content: string;
    try {
        content = fs.readFileSync(absolutePath, "utf-8");
    } catch (error) {
        throw new ConfigParseError(
            `Failed to read configuration file: ${error instanceof Error ? error.message : String(error)}`,
            absolutePath
        );
    }

    // Parse file content
    let parsed: unknown;
    const ext = path.extname(absolutePath).toLowerCase();

    if (ext === ".yaml" || ext === ".yml") {
        try {
            parsed = yaml.load(content);
        } catch (error) {
            if (error instanceof yaml.YAMLException) {
                throw new ConfigParseError(
                    `YAML parse error: ${error.reason}`,
                    absolutePath,
                    error.mark?.line !== undefined ? error.mark.line + 1 : undefined,
                    error.mark?.column
                );
            }
            throw new ConfigParseError(
                `Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`,
                absolutePath
            );
        }
    } else if (ext === ".json") {
        try {
            parsed = JSON.parse(content);
        } catch (error) {
            // Try to extract line number from JSON parse error
            const match = String(error).match(/position (\d+)/);
            let line: number | undefined;
            if (match && match[1]) {
                const position = parseInt(match[1], 10);
                line = content.substring(0, position).split("\n").length;
            }
            throw new ConfigParseError(
                `JSON parse error: ${error instanceof Error ? error.message : String(error)}`,
                absolutePath,
                line
            );
        }
    } else {
        // Try YAML first, then JSON
        try {
            parsed = yaml.load(content);
        } catch {
            try {
                parsed = JSON.parse(content);
            } catch {
                throw new ConfigParseError(
                    `Unable to parse file as YAML or JSON`,
                    absolutePath
                );
            }
        }
    }

    if (!isPlainObject(parsed)) {
        throw new ConfigParseError(
            "Configuration must be an object",
            absolutePath
        );
    }

    // Substitute environment variables
    let config = parsed as Record<string, unknown>;
    if (substituteEnv) {
        config = substituteEnvVarsRecursive(config) as Record<string, unknown>;
    }

    // Merge with defaults
    if (mergeDefaults) {
        config = deepMerge(DEFAULT_CONFIG as Record<string, unknown>, config);
    }

    // Validate against schema
    if (validate) {
        const result = ConfigSchema.safeParse(config);
        if (!result.success) {
            const firstError = result.error.errors[0];
            if (firstError) {
                const fieldPath = firstError.path.join(".");
                throw new ConfigParseError(
                    `Validation error: ${firstError.message}`,
                    absolutePath,
                    undefined,
                    undefined,
                    fieldPath
                );
            }
            throw new ConfigParseError("Validation failed", absolutePath);
        }
        return result.data as Config;
    }

    return config as unknown as Config;
}

/**
 * Parse configuration from a string (YAML or JSON)
 * 
 * @param content - Configuration content string
 * @param format - Format hint ('yaml' or 'json')
 * @param options - Parsing options
 * @returns Parsed and validated configuration
 */
export async function parseConfigString(
    content: string,
    format: "yaml" | "json" = "yaml",
    options: ParseOptions = {}
): Promise<Config> {
    const {
        substituteEnv = true,
        mergeDefaults = true,
        validate = true,
    } = options;

    // Parse content
    let parsed: unknown;
    if (format === "yaml") {
        try {
            parsed = yaml.load(content);
        } catch (error) {
            if (error instanceof yaml.YAMLException) {
                throw new ConfigParseError(
                    `YAML parse error: ${error.reason}`,
                    undefined,
                    error.mark?.line !== undefined ? error.mark.line + 1 : undefined,
                    error.mark?.column
                );
            }
            throw new ConfigParseError(
                `Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    } else {
        try {
            parsed = JSON.parse(content);
        } catch (error) {
            throw new ConfigParseError(
                `JSON parse error: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    if (!isPlainObject(parsed)) {
        throw new ConfigParseError("Configuration must be an object");
    }

    // Substitute environment variables
    let config = parsed as Record<string, unknown>;
    if (substituteEnv) {
        config = substituteEnvVarsRecursive(config) as Record<string, unknown>;
    }

    // Merge with defaults
    if (mergeDefaults) {
        config = deepMerge(DEFAULT_CONFIG as Record<string, unknown>, config);
    }

    // Validate against schema
    if (validate) {
        const result = ConfigSchema.safeParse(config);
        if (!result.success) {
            const firstError = result.error.errors[0];
            if (firstError) {
                const fieldPath = firstError.path.join(".");
                throw new ConfigParseError(
                    `Validation error: ${firstError.message}`,
                    undefined,
                    undefined,
                    undefined,
                    fieldPath
                );
            }
            throw new ConfigParseError("Validation failed");
        }
        return result.data as Config;
    }

    return config as unknown as Config;
}

/**
 * Validate a configuration object against the schema
 * 
 * @param config - Configuration object to validate
 * @returns Validation result with success flag and errors
 */
export function validateConfig(config: unknown): {
    success: boolean;
    errors: Array<{ path: string; message: string }>;
    data?: Config;
} {
    const result = ConfigSchema.safeParse(config);

    if (result.success) {
        return {
            success: true,
            errors: [],
            data: result.data as Config,
        };
    }

    return {
        success: false,
        errors: result.error.errors.map(err => ({
            path: err.path.join("."),
            message: err.message,
        })),
    };
}

/**
 * Load configuration with automatic environment detection
 * 
 * Looks for configuration in this order:
 * 1. Explicit path if provided
 * 2. config/{NODE_ENV}.yaml
 * 3. config/development.yaml
 * 4. config.yaml
 * 
 * @param configPath - Optional explicit config path
 * @param options - Parsing options
 * @returns Parsed configuration
 */
export async function loadConfig(
    configPath?: string,
    options: ParseOptions = {}
): Promise<Config> {
    if (configPath) {
        return parseConfig(configPath, options);
    }

    const env = process.env.NODE_ENV || "development";
    const searchPaths = [
        `config/${env}.yaml`,
        `config/${env}.yml`,
        "config/development.yaml",
        "config/development.yml",
        "config.yaml",
        "config.yml",
    ];

    for (const searchPath of searchPaths) {
        const absolutePath = path.resolve(process.cwd(), searchPath);
        if (fs.existsSync(absolutePath)) {
            return parseConfig(absolutePath, options);
        }
    }

    // No config file found, return defaults if not strict
    if (!options.strict) {
        return DEFAULT_CONFIG as Config;
    }

    throw new ConfigParseError(
        `No configuration file found. Searched: ${searchPaths.join(", ")}`
    );
}

// Export the schema for external use
export { ConfigSchema };
