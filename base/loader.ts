/**
 * Module Loader for MCP Generator
 * 
 * This module discovers and loads MCP tools and connectors from their directories.
 * It scans the /tools and /connectors directories, extracts metadata from module files,
 * and returns structured module information for use by the generator.
 */

import * as fs from "fs/promises";
import * as path from "path";

/**
 * Represents a loaded module (tool or connector)
 */
export interface Module {
    /** Unique name of the module */
    name: string;
    /** Absolute path to the module file */
    path: string;
    /** Type of module: tool or connector */
    type: "tool" | "connector";
    /** Programming language of the module */
    language: "typescript" | "python";
    /** Metadata extracted from the module */
    metadata: ToolMetadata | ConnectorMetadata;
}

/**
 * Metadata for an MCP tool
 */
export interface ToolMetadata {
    /** Tool name */
    name: string;
    /** Description of what the tool does */
    description: string;
    /** Version string (semver format) */
    version: string;
    /** Optional JSON Schema for tool input validation */
    inputSchema?: object;
    /** List of capabilities this tool provides */
    capabilities?: string[];
}

/**
 * Metadata for an MCP connector
 */
export interface ConnectorMetadata {
    /** Connector name */
    name: string;
    /** Description of the connector */
    description: string;
    /** Version string (semver format) */
    version: string;
    /** Type of connector (e.g., "email", "database", "api") */
    type: string;
    /** Authentication configuration required */
    authentication?: object;
    /** List of methods/operations this connector supports */
    methods?: string[];
}

/**
 * Load all modules from the specified base path
 * 
 * Scans the /tools and /connectors directories under basePath,
 * extracts metadata from TypeScript and Python files,
 * and returns an array of Module objects.
 * 
 * @param basePath - Base directory containing tools/ and connectors/ subdirectories
 * @returns Promise resolving to array of discovered modules
 */
export async function loadModules(basePath: string): Promise<Module[]> {
    const modules: Module[] = [];

    // Define directories to scan
    const directories: Array<{ path: string; type: "tool" | "connector" }> = [
        { path: path.join(basePath, "tools"), type: "tool" },
        { path: path.join(basePath, "connectors"), type: "connector" },
    ];

    // Scan each directory
    for (const dir of directories) {
        try {
            // Check if directory exists
            await fs.access(dir.path);

            // Scan the directory recursively
            const foundModules = await scanDirectory(dir.path, dir.type);
            modules.push(...foundModules);
        } catch (error) {
            // Directory doesn't exist or is not accessible
            console.warn(`Warning: Could not access directory ${dir.path}`);
            continue;
        }
    }

    return modules;
}

/**
 * Recursively scan a directory for module files
 * 
 * @param dirPath - Directory to scan
 * @param moduleType - Type of modules in this directory (tool or connector)
 * @returns Promise resolving to array of modules found
 */
async function scanDirectory(
    dirPath: string,
    moduleType: "tool" | "connector"
): Promise<Module[]> {
    const modules: Module[] = [];

    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            if (entry.isDirectory()) {
                // Recursively scan subdirectories
                const subModules = await scanDirectory(fullPath, moduleType);
                modules.push(...subModules);
            } else if (entry.isFile()) {
                // Check if this is a module file
                const ext = path.extname(entry.name);
                if (ext === ".ts" || ext === ".py") {
                    // Try to load the module
                    const module = await loadModule(fullPath, moduleType, ext);
                    if (module) {
                        modules.push(module);
                    }
                }
            }
        }
    } catch (error) {
        console.warn(`Warning: Error scanning directory ${dirPath}:`, error);
    }

    return modules;
}

/**
 * Load a single module file and extract its metadata
 * 
 * @param filePath - Path to the module file
 * @param moduleType - Type of module (tool or connector)
 * @param extension - File extension (.ts or .py)
 * @returns Promise resolving to Module object, or null if invalid
 */
async function loadModule(
    filePath: string,
    moduleType: "tool" | "connector",
    extension: string
): Promise<Module | null> {
    try {
        // Read the file contents
        const content = await fs.readFile(filePath, "utf-8");

        // Determine language
        const language = extension === ".ts" ? "typescript" : "python";

        // Extract metadata based on language
        const metadata =
            language === "typescript"
                ? extractTypeScriptMetadata(content)
                : extractPythonMetadata(content);

        if (!metadata) {
            console.warn(`Warning: Could not extract metadata from ${filePath}`);
            return null;
        }

        // Create module object
        const module: Module = {
            name: metadata.name,
            path: filePath,
            type: moduleType,
            language,
            metadata,
        };

        return module;
    } catch (error) {
        console.warn(`Warning: Error loading module ${filePath}:`, error);
        return null;
    }
}

/**
 * Extract metadata from TypeScript module
 * 
 * Looks for export const metadata = {...} pattern
 * 
 * @param content - File contents
 * @returns Extracted metadata or null
 */
function extractTypeScriptMetadata(
    content: string
): ToolMetadata | ConnectorMetadata | null {
    try {
        // Look for: export const metadata = { ... }
        const metadataRegex =
            /export\s+const\s+metadata\s*=\s*({[\s\S]*?});/;
        const match = content.match(metadataRegex);

        if (!match || !match[1]) {
            return null;
        }

        // Try to parse the metadata object
        // Note: This is a simplified parser. In production, you'd want a proper TypeScript parser
        const metadataStr = match[1];

        // For now, look for basic field patterns
        const name = extractField(metadataStr, "name");
        const description = extractField(metadataStr, "description");
        const version = extractField(metadataStr, "version");

        if (!name || !description || !version) {
            return null;
        }

        // Check if it's a connector (has 'type' field) or tool
        const type = extractField(metadataStr, "type");

        if (type) {
            // It's a connector
            const connector: ConnectorMetadata = {
                name,
                description,
                version,
                type,
            };

            // Extract optional fields
            const methods = extractArrayField(metadataStr, "methods");
            if (methods) {
                connector.methods = methods;
            }

            return connector;
        } else {
            // It's a tool
            const tool: ToolMetadata = {
                name,
                description,
                version,
            };

            // Extract optional fields
            const capabilities = extractArrayField(metadataStr, "capabilities");
            if (capabilities) {
                tool.capabilities = capabilities;
            }

            return tool;
        }
    } catch (error) {
        console.warn("Error parsing TypeScript metadata:", error);
        return null;
    }
}

/**
 * Extract metadata from Python module
 * 
 * Looks for docstring or metadata dictionary patterns
 * 
 * @param content - File contents
 * @returns Extracted metadata or null
 */
function extractPythonMetadata(
    content: string
): ToolMetadata | ConnectorMetadata | null {
    try {
        // Look for: metadata = { ... } or METADATA = { ... }
        const metadataRegex =
            /(?:metadata|METADATA)\s*=\s*({[\s\S]*?})/;
        const match = content.match(metadataRegex);

        if (!match || !match[1]) {
            return null;
        }

        // Try to parse the metadata object
        const metadataStr = match[1];

        // Extract basic fields
        const name = extractField(metadataStr, "name");
        const description = extractField(metadataStr, "description");
        const version = extractField(metadataStr, "version");

        if (!name || !description || !version) {
            return null;
        }

        // Check if it's a connector (has 'type' field) or tool
        const type = extractField(metadataStr, "type");

        if (type) {
            // It's a connector
            const connector: ConnectorMetadata = {
                name,
                description,
                version,
                type,
            };

            // Extract optional fields
            const methods = extractArrayField(metadataStr, "methods");
            if (methods) {
                connector.methods = methods;
            }

            return connector;
        } else {
            // It's a tool
            const tool: ToolMetadata = {
                name,
                description,
                version,
            };

            // Extract optional fields
            const capabilities = extractArrayField(metadataStr, "capabilities");
            if (capabilities) {
                tool.capabilities = capabilities;
            }

            return tool;
        }
    } catch (error) {
        console.warn("Error parsing Python metadata:", error);
        return null;
    }
}

/**
 * Extract a string field from metadata object string
 * 
 * @param metadataStr - String representation of metadata object
 * @param fieldName - Field name to extract
 * @returns Field value or null
 */
function extractField(metadataStr: string, fieldName: string): string | null {
    // Look for: fieldName: "value" or fieldName: 'value'
    const regex = new RegExp(
        `["']${fieldName}["']\\s*:\\s*["']([^"']+)["']`
    );
    const match = metadataStr.match(regex);
    return match && match[1] ? match[1] : null;
}

/**
 * Extract an array field from metadata object string
 * 
 * @param metadataStr - String representation of metadata object
 * @param fieldName - Field name to extract
 * @returns Array of values or null
 */
function extractArrayField(
    metadataStr: string,
    fieldName: string
): string[] | null {
    // Look for: fieldName: ["value1", "value2"] or fieldName: ['value1', 'value2']
    const regex = new RegExp(
        `["']${fieldName}["']\\s*:\\s*\\[([^\\]]+)\\]`
    );
    const match = metadataStr.match(regex);

    if (!match || !match[1]) {
        return null;
    }

    // Extract array items
    const arrayContent = match[1];
    const items = arrayContent
        .split(",")
        .map((item) => item.trim().replace(/["']/g, ""))
        .filter((item) => item.length > 0);

    return items.length > 0 ? items : null;
}
