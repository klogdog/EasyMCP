/**
 * Configuration Generator for MCP Server
 * 
 * This module generates runtime configuration files (YAML) from MCP manifests.
 * It creates environment-specific configs with environment variable substitution
 * for credentials and secrets.
 */

import { MCPManifest, Connector } from "./generator";
import * as yaml from "js-yaml";

/**
 * Complete server configuration structure
 */
export interface ServerConfig {
    /** Server configuration */
    server: {
        name: string;
        version: string;
        host: string;
        port: number | string;
    };
    /** Database configuration (optional) */
    database?: {
        url: string;
        poolSize: number | string;
        timeout: number | string;
    };
    /** Connector configurations */
    connectors: Record<string, ConnectorConfig>;
    /** Logging configuration */
    logging: {
        level: string;
        format: string;
        destination: string;
    };
    /** Feature flags */
    features: Record<string, boolean>;
}

/**
 * Configuration for a single connector
 */
export interface ConnectorConfig {
    /** Connector type */
    type: string;
    /** Whether connector is enabled */
    enabled: boolean;
    /** Authentication credentials (with env var placeholders) */
    credentials?: Record<string, string>;
    /** Connector-specific settings */
    settings?: Record<string, any>;
}

/**
 * Generate runtime configuration YAML from an MCP manifest
 * 
 * Creates environment-specific configuration with:
 * - Server settings (host, port)
 * - Connector credentials (as environment variables)
 * - Logging configuration
 * - Feature flags from capabilities
 * 
 * @param manifest - The MCP manifest to generate config from
 * @param env - Target environment ('development' or 'production')
 * @returns YAML configuration string with environment variable placeholders
 */
export async function generateConfig(
    manifest: MCPManifest,
    env: "development" | "production"
): Promise<string> {
    // Validate manifest
    if (!manifest || !manifest.name || !manifest.version) {
        throw new Error("Invalid manifest: missing required fields (name, version)");
    }

    // Build config object
    const config: ServerConfig = {
        server: {
            name: manifest.name,
            version: manifest.version,
            host: env === "development" ? "localhost" : "0.0.0.0",
            port: env === "development" ? 3000 : "${PORT:-8080}",
        },
        connectors: {},
        logging: {
            level: env === "development" ? "debug" : "info",
            format: env === "development" ? "pretty" : "json",
            destination: env === "development" ? "console" : "stdout",
        },
        features: {},
    };

    // Add database configuration if database connector exists
    const hasDatabaseConnector = manifest.connectors.some(
        (c) => c.type === "database"
    );
    if (hasDatabaseConnector) {
        config.database = {
            url: "${DATABASE_URL}",
            poolSize: "${DB_POOL_SIZE:-10}",
            timeout: "${DB_TIMEOUT:-5000}",
        };
    }

    // Generate connector configurations
    for (const connector of manifest.connectors) {
        config.connectors[connector.name] = createConnectorConfig(connector);
    }

    // Generate feature flags from capabilities
    for (const capability of manifest.capabilities) {
        // Convert capability name to camelCase feature name
        const featureName = capability
            .split("-")
            .map((word, index) =>
                index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
            )
            .join("");
        config.features[featureName] = true;
    }

    // Convert to YAML with formatting options
    const yamlString = yaml.dump(config, {
        indent: 2,
        lineWidth: 120,
        noRefs: true,
        sortKeys: false,
    });

    // Add header comment with metadata
    const header = `# MCP Server Configuration
# Generated from manifest: ${manifest.name} v${manifest.version}
# Environment: ${env}
# Generated at: ${new Date().toISOString()}
#
# Environment Variables:
# - Set required variables before starting the server
# - Use format: KEY=value or KEY="value with spaces"
# - Required variables are marked with "Required:" in comments
# - Optional variables have default values: \${VAR:-default}
#

`;

    return header + yamlString;
}

/**
 * Create configuration for a single connector
 * 
 * @param connector - Connector metadata from manifest
 * @returns Connector configuration with credentials and settings
 */
function createConnectorConfig(
    connector: Connector
): ConnectorConfig {
    const config: ConnectorConfig = {
        type: connector.type,
        enabled: true,
    };

    // Add credentials with environment variable placeholders
    // Generate based on connector type
    const prefix = getEnvVarName(connector.name, "");

    // Add type-specific credentials
    switch (connector.type) {
        case "email":
            config.credentials = {
                apiKey: `\${${prefix}_API_KEY}`,
                fromEmail: `\${${prefix}_FROM_EMAIL:-noreply@example.com}`,
            };
            break;

        case "database":
            config.credentials = {
                url: `\${${prefix}_URL}`,
                username: `\${${prefix}_USERNAME:-}`,
                password: `\${${prefix}_PASSWORD:-}`,
            };
            break;

        case "api":
            config.credentials = {
                apiKey: `\${${prefix}_API_KEY}`,
                baseUrl: `\${${prefix}_BASE_URL}`,
            };
            break;

        case "storage":
            config.credentials = {
                accessKey: `\${${prefix}_ACCESS_KEY}`,
                secretKey: `\${${prefix}_SECRET_KEY}`,
                bucket: `\${${prefix}_BUCKET}`,
            };
            break;

        case "messaging":
            config.credentials = {
                apiKey: `\${${prefix}_API_KEY}`,
                region: `\${${prefix}_REGION:-us-east-1}`,
            };
            break;

        default:
            // Generic credentials for unknown types
            config.credentials = {
                apiKey: `\${${prefix}_API_KEY}`,
            };
    }

    // Add connector-specific settings
    if (connector.methods && connector.methods.length > 0) {
        config.settings = {
            availableMethods: connector.methods,
        };
    }

    return config;
}

/**
 * Generate environment variable name from connector name and field
 * 
 * @param connectorName - Name of the connector (e.g., "email-connector")
 * @param field - Field name (e.g., "apiKey")
 * @returns Environment variable name (e.g., "EMAIL_CONNECTOR_API_KEY")
 */
function getEnvVarName(connectorName: string, field: string): string {
    const baseName = camelToSnakeCase(connectorName);
    if (field) {
        const fieldName = camelToSnakeCase(field);
        return `${baseName}_${fieldName}`;
    }
    return baseName;
}

/**
 * Convert camelCase or kebab-case string to SCREAMING_SNAKE_CASE
 * 
 * @param str - Input string
 * @returns SCREAMING_SNAKE_CASE string
 */
function camelToSnakeCase(str: string): string {
    return str
        // Handle camelCase: insert underscore before capital letters
        .replace(/[A-Z]/g, (letter) => `_${letter}`)
        // Replace hyphens and spaces with underscores
        .replace(/[-\s]/g, "_")
        // Remove consecutive underscores
        .replace(/_+/g, "_")
        // Remove leading underscore
        .replace(/^_/, "")
        // Convert to uppercase
        .toUpperCase();
}

/**
 * Validate configuration YAML string
 * 
 * Parses YAML and verifies required fields are present
 * 
 * @param configString - YAML configuration string
 * @returns true if valid, false otherwise
 */
export function validateConfig(configString: string): boolean {
    try {
        const config = yaml.load(configString) as ServerConfig;

        // Check required top-level fields
        if (!config.server || !config.logging) {
            return false;
        }

        // Check server fields
        if (
            !config.server.name ||
            !config.server.version ||
            !config.server.host ||
            !config.server.port
        ) {
            return false;
        }

        // Check logging fields
        if (
            !config.logging.level ||
            !config.logging.format ||
            !config.logging.destination
        ) {
            return false;
        }

        // Check connectors if present
        if (config.connectors) {
            for (const connectorConfig of Object.values(config.connectors)) {
                if (!connectorConfig.type || connectorConfig.enabled === undefined) {
                    return false;
                }
            }
        }

        return true;
    } catch (error) {
        // YAML parsing error or validation error
        return false;
    }
}
