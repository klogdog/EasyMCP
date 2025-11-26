/**
 * Credential Schema Discovery for MCP Generator
 * 
 * This module automatically detects what credentials each module needs by:
 * - Parsing metadata.credentials fields in module files
 * - Extracting @requires-credential JSDoc tags from TypeScript files
 * - Parsing :credential directives from Python docstrings
 * - Aggregating requirements across modules and merging duplicates
 */

import * as fs from "fs/promises";
import { Module } from "./loader";

/**
 * Type of credential authentication
 */
export type CredentialType = "api_key" | "oauth" | "password" | "token" | "certificate";

/**
 * Credential definition as found in module metadata
 */
export interface CredentialDefinition {
    /** Name of the credential (e.g., "OPENAI_API_KEY") */
    name: string;
    /** Type of credential */
    type: CredentialType;
    /** Whether this credential is required */
    required: boolean;
    /** Human-readable description */
    description: string;
    /** Optional validation regex pattern */
    validation?: string;
    /** Service this credential is for (e.g., "openai", "github") */
    service?: string;
}

/**
 * Discovered credential requirement with source tracking
 */
export interface CredentialRequirement {
    /** Name of the credential */
    name: string;
    /** Type of credential */
    type: CredentialType;
    /** Whether this credential is required (true if any module requires it) */
    required: boolean;
    /** Human-readable description */
    description: string;
    /** Optional validation regex pattern */
    validation?: RegExp;
    /** Service this credential is for */
    service?: string;
    /** Modules that require this credential */
    usedBy: string[];
}

/**
 * Extended metadata interface that includes credentials
 */
export interface ModuleWithCredentials extends Module {
    credentials?: CredentialDefinition[];
}

/**
 * Discover all credential requirements from a list of modules
 * 
 * This function:
 * 1. Reads each module file and extracts credentials from:
 *    - metadata.credentials field
 *    - TypeScript JSDoc @requires-credential tags
 *    - Python docstring :credential directives
 * 2. Aggregates all requirements across modules
 * 3. Merges duplicates (same credential name from multiple modules)
 * 4. Returns a unified list of CredentialRequirement objects
 * 
 * @param modules - Array of discovered modules
 * @returns Promise resolving to array of credential requirements
 */
export async function discoverCredentialRequirements(
    modules: Module[]
): Promise<CredentialRequirement[]> {
    const credentialMap = new Map<string, CredentialRequirement>();

    for (const module of modules) {
        try {
            // Read module file contents
            const content = await fs.readFile(module.path, "utf-8");

            // Extract credentials based on language
            const credentials =
                module.language === "typescript"
                    ? extractTypeScriptCredentials(content, module.name)
                    : extractPythonCredentials(content, module.name);

            // Merge into credential map
            for (const cred of credentials) {
                mergeCredential(credentialMap, cred, module.name);
            }
        } catch (error) {
            console.warn(`Warning: Could not read module ${module.path} for credential discovery`);
        }
    }

    // Convert map to array and sort by name
    return Array.from(credentialMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Extract credentials from TypeScript module content
 * 
 * Looks for:
 * - metadata.credentials array in export const metadata = {...}
 * - @requires-credential JSDoc tags
 * 
 * @param content - File content
 * @param _moduleName - Name of the module for error reporting (reserved for future use)
 * @returns Array of credential definitions
 */
export function extractTypeScriptCredentials(
    content: string,
    _moduleName: string
): CredentialDefinition[] {
    const credentials: CredentialDefinition[] = [];

    // Extract from metadata.credentials field
    const metadataCredentials = extractMetadataCredentials(content);
    credentials.push(...metadataCredentials);

    // Extract from JSDoc @requires-credential tags
    const jsdocCredentials = extractJSDocCredentials(content);
    credentials.push(...jsdocCredentials);

    return credentials;
}

/**
 * Extract credentials from Python module content
 * 
 * Looks for:
 * - metadata["credentials"] or metadata['credentials'] in Python dict
 * - :credential: directives in docstrings
 * 
 * @param content - File content
 * @param _moduleName - Name of the module for error reporting (reserved for future use)
 * @returns Array of credential definitions
 */
export function extractPythonCredentials(
    content: string,
    _moduleName: string
): CredentialDefinition[] {
    const credentials: CredentialDefinition[] = [];

    // Extract from metadata credentials field
    const metadataCredentials = extractPythonMetadataCredentials(content);
    credentials.push(...metadataCredentials);

    // Extract from docstring :credential: directives
    const docstringCredentials = extractPythonDocstringCredentials(content);
    credentials.push(...docstringCredentials);

    return credentials;
}

/**
 * Extract credentials from TypeScript/JavaScript metadata object
 * 
 * Looks for pattern: "credentials": [...] or 'credentials': [...]
 * 
 * @param content - File content
 * @returns Array of credential definitions
 */
export function extractMetadataCredentials(content: string): CredentialDefinition[] {
    const credentials: CredentialDefinition[] = [];

    // Match credentials array in metadata
    // Pattern: "credentials": [ ... ] or 'credentials': [ ... ]
    const credentialsRegex = /["']credentials["']\s*:\s*\[([\s\S]*?)\]/;
    const match = content.match(credentialsRegex);

    if (!match || !match[1]) {
        return credentials;
    }

    const arrayContent = match[1];

    // Match individual credential objects: { name: "...", type: "...", ... }
    const objectRegex = /\{([^{}]+)\}/g;
    let objMatch: RegExpExecArray | null;

    while ((objMatch = objectRegex.exec(arrayContent)) !== null) {
        const objContent = objMatch[1];
        if (objContent) {
            const cred = parseCredentialObject(objContent);
            if (cred) {
                credentials.push(cred);
            }
        }
    }

    return credentials;
}

/**
 * Extract @requires-credential tags from JSDoc comments
 * 
 * Format: @requires-credential {name} {type} {required|optional} - description
 * Example: @requires-credential OPENAI_API_KEY api_key required - OpenAI API key for chat completion
 * 
 * @param content - File content
 * @returns Array of credential definitions
 */
export function extractJSDocCredentials(content: string): CredentialDefinition[] {
    const credentials: CredentialDefinition[] = [];

    // Match @requires-credential tags
    // Format: @requires-credential {name} {type} {required|optional} - {description}
    const jsdocRegex = /@requires-credential\s+(\S+)\s+(\S+)\s+(required|optional)(?:\s*-\s*(.+))?/g;

    let match: RegExpExecArray | null;
    while ((match = jsdocRegex.exec(content)) !== null) {
        const [, name, type, requiredStr, description] = match;

        if (name && type && isValidCredentialType(type)) {
            credentials.push({
                name,
                type: type as CredentialType,
                required: requiredStr === "required",
                description: description?.trim() || `${name} credential`,
            });
        }
    }

    return credentials;
}

/**
 * Extract credentials from Python metadata dictionary
 * 
 * Looks for: "credentials": [...] in metadata = {...}
 * 
 * @param content - File content
 * @returns Array of credential definitions
 */
export function extractPythonMetadataCredentials(content: string): CredentialDefinition[] {
    const credentials: CredentialDefinition[] = [];

    // Match credentials array in Python dict
    // Pattern: "credentials": [ ... ] or 'credentials': [ ... ]
    const credentialsRegex = /["']credentials["']\s*:\s*\[([\s\S]*?)\]/;
    const match = content.match(credentialsRegex);

    if (!match || !match[1]) {
        return credentials;
    }

    const arrayContent = match[1];

    // Match individual credential dicts: { "name": "...", "type": "...", ... }
    const objectRegex = /\{([^{}]+)\}/g;
    let objMatch: RegExpExecArray | null;

    while ((objMatch = objectRegex.exec(arrayContent)) !== null) {
        const objContent = objMatch[1];
        if (objContent) {
            const cred = parseCredentialObject(objContent);
            if (cred) {
                credentials.push(cred);
            }
        }
    }

    return credentials;
}

/**
 * Extract :credential: directives from Python docstrings
 * 
 * Format: :credential name type required|optional: description
 * Example: :credential OPENAI_API_KEY api_key required: OpenAI API key
 * 
 * @param content - File content
 * @returns Array of credential definitions
 */
export function extractPythonDocstringCredentials(content: string): CredentialDefinition[] {
    const credentials: CredentialDefinition[] = [];

    // Match :credential directives
    // Format: :credential {name} {type} {required|optional}: {description}
    const docstringRegex = /:credential\s+(\S+)\s+(\S+)\s+(required|optional)(?:\s*:\s*(.+))?/g;

    let match: RegExpExecArray | null;
    while ((match = docstringRegex.exec(content)) !== null) {
        const [, name, type, requiredStr, description] = match;

        if (name && type && isValidCredentialType(type)) {
            credentials.push({
                name,
                type: type as CredentialType,
                required: requiredStr === "required",
                description: description?.trim() || `${name} credential`,
            });
        }
    }

    return credentials;
}

/**
 * Parse a credential object from string content
 * 
 * @param objContent - Content between { and } of a credential object
 * @returns CredentialDefinition or null if invalid
 */
function parseCredentialObject(objContent: string): CredentialDefinition | null {
    const name = extractStringField(objContent, "name");
    const type = extractStringField(objContent, "type");
    const requiredStr = extractStringField(objContent, "required");
    const description = extractStringField(objContent, "description");

    // Handle boolean required field (may be true/false without quotes)
    let required = false;
    if (requiredStr !== null) {
        required = requiredStr === "true";
    } else {
        // Check for unquoted boolean
        const boolMatch = objContent.match(/["']required["']\s*:\s*(true|false)/);
        if (boolMatch) {
            required = boolMatch[1] === "true";
        }
    }

    if (!name || !type || !isValidCredentialType(type)) {
        return null;
    }

    const cred: CredentialDefinition = {
        name,
        type: type as CredentialType,
        required,
        description: description || `${name} credential`,
    };

    // Extract optional fields
    const validation = extractStringField(objContent, "validation");
    if (validation) {
        cred.validation = validation;
    }

    const service = extractStringField(objContent, "service");
    if (service) {
        cred.service = service;
    }

    return cred;
}

/**
 * Extract a string field value from object content
 * 
 * @param objContent - Object content string
 * @param fieldName - Field name to extract
 * @returns Field value or null
 */
function extractStringField(objContent: string, fieldName: string): string | null {
    // Match "fieldName": "value" or 'fieldName': 'value'
    const regex = new RegExp(`["']${fieldName}["']\\s*:\\s*["']([^"']+)["']`);
    const match = objContent.match(regex);
    return match && match[1] ? match[1] : null;
}

/**
 * Check if a string is a valid CredentialType
 * 
 * @param type - String to check
 * @returns True if valid credential type
 */
function isValidCredentialType(type: string): type is CredentialType {
    return ["api_key", "oauth", "password", "token", "certificate"].includes(type);
}

/**
 * Merge a credential definition into the credential map
 * 
 * If the credential already exists:
 * - Add the module to usedBy list
 * - If either instance is required, mark as required
 * - Keep the longer description
 * - Merge validation patterns
 * 
 * @param map - Map of credentials by name
 * @param cred - Credential definition to merge
 * @param moduleName - Name of module providing this credential
 */
function mergeCredential(
    map: Map<string, CredentialRequirement>,
    cred: CredentialDefinition,
    moduleName: string
): void {
    const existing = map.get(cred.name);

    if (existing) {
        // Merge with existing
        existing.usedBy.push(moduleName);

        // If any module requires it, it's required
        if (cred.required) {
            existing.required = true;
        }

        // Keep the longer description
        if (cred.description.length > existing.description.length) {
            existing.description = cred.description;
        }

        // Merge service if not set
        if (!existing.service && cred.service) {
            existing.service = cred.service;
        }

        // Don't override validation if already set
    } else {
        // Create new requirement
        const requirement: CredentialRequirement = {
            name: cred.name,
            type: cred.type,
            required: cred.required,
            description: cred.description,
            usedBy: [moduleName],
        };

        if (cred.validation) {
            try {
                requirement.validation = new RegExp(cred.validation);
            } catch (e) {
                console.warn(`Invalid validation regex for ${cred.name}: ${cred.validation}`);
            }
        }

        if (cred.service) {
            requirement.service = cred.service;
        }

        map.set(cred.name, requirement);
    }
}

/**
 * Get required credentials only
 * 
 * @param requirements - All credential requirements
 * @returns Only required credentials
 */
export function getRequiredCredentials(
    requirements: CredentialRequirement[]
): CredentialRequirement[] {
    return requirements.filter((req) => req.required);
}

/**
 * Get optional credentials only
 * 
 * @param requirements - All credential requirements
 * @returns Only optional credentials
 */
export function getOptionalCredentials(
    requirements: CredentialRequirement[]
): CredentialRequirement[] {
    return requirements.filter((req) => !req.required);
}

/**
 * Group credentials by service
 * 
 * @param requirements - All credential requirements
 * @returns Map of service name to credentials
 */
export function groupByService(
    requirements: CredentialRequirement[]
): Map<string, CredentialRequirement[]> {
    const groups = new Map<string, CredentialRequirement[]>();

    for (const req of requirements) {
        const service = req.service || "other";
        const existing = groups.get(service) || [];
        existing.push(req);
        groups.set(service, existing);
    }

    return groups;
}

/**
 * Convert credential requirements to prompt format
 * 
 * This converts CredentialRequirement objects to the format expected
 * by the interactive prompt system (prompt.ts).
 * 
 * @param requirements - Credential requirements
 * @returns Prompt-compatible requirement objects
 */
export function toPromptFormat(
    requirements: CredentialRequirement[]
): Array<{
    name: string;
    type: "text" | "password";
    required: boolean;
    description: string;
    validation?: RegExp;
}> {
    return requirements.map((req) => ({
        name: req.name,
        type: req.type === "password" || req.type === "api_key" || req.type === "token"
            ? "password" as const
            : "text" as const,
        required: req.required,
        description: `${req.description}${req.required ? "" : " (optional)"}`,
        validation: req.validation,
    }));
}
