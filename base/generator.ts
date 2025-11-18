/**
 * Manifest Generator for MCP Server
 * 
 * This module merges validated modules into a single MCP server manifest.
 * It combines tools and connectors, resolves dependencies, and generates
 * a structured manifest that can be used to build an actual MCP server.
 */

import { Module, ToolMetadata, ConnectorMetadata } from "./loader";
import * as semver from "semver";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Complete MCP server manifest structure
 */
export interface MCPManifest {
    /** Server name */
    name: string;
    /** Server version */
    version: string;
    /** List of all tools in the server */
    tools: Tool[];
    /** List of all connectors in the server */
    connectors: Connector[];
    /** Unique capabilities provided by this server */
    capabilities: string[];
    /** Consolidated npm dependencies with resolved versions */
    dependencies: Record<string, string>;
    /** Metadata about manifest generation */
    metadata: ManifestMetadata;
}

/**
 * Tool definition for the manifest
 */
export interface Tool {
    /** Tool name */
    name: string;
    /** Description of what the tool does */
    description: string;
    /** Tool version */
    version: string;
    /** Optional JSON Schema for input validation */
    inputSchema?: object;
}

/**
 * Connector definition for the manifest
 */
export interface Connector {
    /** Connector name */
    name: string;
    /** Description of the connector */
    description: string;
    /** Connector version */
    version: string;
    /** Type of connector */
    type: string;
    /** Authentication requirements */
    authentication?: object;
    /** Available methods/operations */
    methods?: string[];
}

/**
 * Metadata about the manifest generation
 */
export interface ManifestMetadata {
    /** Timestamp when manifest was generated */
    generatedAt: string;
    /** Generator version used */
    generatorVersion: string;
    /** Number of modules included */
    moduleCount: number;
}

/**
 * Generate an MCP server manifest from validated modules
 * 
 * This function takes an array of validated modules and combines them
 * into a single manifest structure. It:
 * - Extracts tools and connectors
 * - Collects unique capabilities
 * - Consolidates and resolves dependency versions
 * - Adds generation metadata
 * 
 * @param modules - Array of validated modules to include in the manifest
 * @returns Complete MCP manifest ready for server generation
 */
export async function generateManifest(modules: Module[]): Promise<MCPManifest> {
    // Initialize manifest structure
    const tools: Tool[] = [];
    const connectors: Connector[] = [];
    const capabilitiesSet = new Set<string>();
    const dependenciesMap = new Map<string, string[]>();

    // Process each module
    for (const module of modules) {
        if (module.type === "tool") {
            // Extract tool metadata
            const toolMeta = module.metadata as ToolMetadata;
            tools.push({
                name: toolMeta.name,
                description: toolMeta.description,
                version: toolMeta.version,
                inputSchema: toolMeta.inputSchema,
            });

            // Collect capabilities
            if (toolMeta.capabilities) {
                toolMeta.capabilities.forEach((cap) => capabilitiesSet.add(cap));
            }
        } else if (module.type === "connector") {
            // Extract connector metadata
            const connectorMeta = module.metadata as ConnectorMetadata;
            connectors.push({
                name: connectorMeta.name,
                description: connectorMeta.description,
                version: connectorMeta.version,
                type: connectorMeta.type,
                authentication: connectorMeta.authentication,
                methods: connectorMeta.methods,
            });

            // Infer capability from connector type
            capabilitiesSet.add(`${connectorMeta.type}-integration`);
        }

        // Collect dependencies from module metadata
        const metadata = module.metadata as any;
        if (metadata.dependencies) {
            for (const [packageName, versionRange] of Object.entries(
                metadata.dependencies
            )) {
                if (!dependenciesMap.has(packageName)) {
                    dependenciesMap.set(packageName, []);
                }
                dependenciesMap.get(packageName)!.push(versionRange as string);
            }
        }
    }

    // Resolve dependency versions
    const dependencies = resolveDependencies(dependenciesMap);

    // Read version from package.json
    const packageJsonPath = path.join(process.cwd(), "package.json");
    let version = "0.1.0";
    try {
        const packageJson = JSON.parse(
            await fs.readFile(packageJsonPath, "utf-8")
        );
        version = packageJson.version || version;
    } catch (error) {
        // Use default version if package.json not found
    }

    // Generate manifest
    const manifest: MCPManifest = {
        name: "mcp-server",
        version,
        tools,
        connectors,
        capabilities: Array.from(capabilitiesSet).sort(),
        dependencies,
        metadata: {
            generatedAt: new Date().toISOString(),
            generatorVersion: version,
            moduleCount: modules.length,
        },
    };

    return manifest;
}

/**
 * Resolve dependency version conflicts by selecting the highest compatible version
 * 
 * When multiple modules require different versions of the same package,
 * this function attempts to find the highest version that satisfies all requirements.
 * If no common version can be found, it uses the highest version specified.
 * 
 * @param dependenciesMap - Map of package names to arrays of version ranges
 * @returns Resolved dependencies with single version per package
 */
function resolveDependencies(
    dependenciesMap: Map<string, string[]>
): Record<string, string> {
    const resolved: Record<string, string> = {};

    for (const [packageName, versionRanges] of dependenciesMap.entries()) {
        if (versionRanges.length === 1) {
            // Only one version requirement, use it directly
            resolved[packageName] = versionRanges[0] || "*";
        } else {
            // Multiple version requirements, try to resolve
            const resolvedVersion = resolveVersionConflict(versionRanges);
            resolved[packageName] = resolvedVersion;
        }
    }

    return resolved;
}

/**
 * Resolve version conflict by finding the highest compatible version
 * 
 * Strategy:
 * 1. If all ranges are compatible, use the most restrictive range
 * 2. If ranges conflict, use the highest version range
 * 
 * @param versionRanges - Array of semver version ranges
 * @returns Single resolved version range
 */
function resolveVersionConflict(versionRanges: string[]): string {
    // Sort version ranges to prioritize specific versions over ranges
    const sorted = [...versionRanges].sort((a, b) => {
        // Exact versions (e.g., "1.0.0") come before ranges (e.g., "^1.0.0")
        const aIsExact = semver.valid(a) !== null;
        const bIsExact = semver.valid(b) !== null;

        if (aIsExact && !bIsExact) return -1;
        if (!aIsExact && bIsExact) return 1;

        // Both are ranges or both are exact, compare by max satisfying version
        try {
            const aMax = semver.maxSatisfying(["999.999.999"], a);
            const bMax = semver.maxSatisfying(["999.999.999"], b);
            if (aMax && bMax) {
                return semver.compare(bMax, aMax); // Descending order (highest first)
            }
        } catch (error) {
            // If comparison fails, maintain original order
        }

        return 0;
    });

    // Return the highest/most specific version
    return sorted[0] || "*";
}

/**
 * Save manifest to a JSON file
 * 
 * @param manifest - The manifest to save
 * @param outputPath - Path where the manifest file should be written
 */
export async function saveManifest(
    manifest: MCPManifest,
    outputPath: string
): Promise<void> {
    const json = JSON.stringify(manifest, null, 2);
    await fs.writeFile(outputPath, json, "utf-8");
}

/**
 * Validate manifest structure
 * 
 * Performs basic validation to ensure the manifest is well-formed:
 * - Has a name and version
 * - Contains at least one tool or connector
 * - All tools/connectors have required fields
 * 
 * @param manifest - Manifest to validate
 * @returns True if valid, false otherwise
 */
export function validateManifest(manifest: MCPManifest): boolean {
    // Check required fields
    if (!manifest.name || !manifest.version) {
        return false;
    }

    // Must have at least one tool or connector
    if (manifest.tools.length === 0 && manifest.connectors.length === 0) {
        return false;
    }

    // Validate all tools
    for (const tool of manifest.tools) {
        if (!tool.name || !tool.description || !tool.version) {
            return false;
        }
    }

    // Validate all connectors
    for (const connector of manifest.connectors) {
        if (
            !connector.name ||
            !connector.description ||
            !connector.version ||
            !connector.type
        ) {
            return false;
        }
    }

    return true;
}
