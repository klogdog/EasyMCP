/**
 * Module Validator for MCP Generator
 * 
 * This module validates loaded modules against MCP specifications using Zod schemas.
 * It checks for required fields, valid formats, duplicate names, and schema versioning.
 */

import { z } from "zod";
import { Module } from "./loader";

/**
 * Result of module validation
 */
export interface ValidationResult {
    /** Whether all modules passed validation (no errors) */
    valid: boolean;
    /** List of validation errors found */
    errors: ValidationError[];
    /** List of validation warnings (non-critical issues) */
    warnings: string[];
}

/**
 * A single validation error for a module
 */
export interface ValidationError {
    /** Name of the module with the error */
    moduleName: string;
    /** Field that failed validation */
    field: string;
    /** Human-readable error message */
    message: string;
    /** Severity level of the issue */
    severity: "error" | "warning";
}

/**
 * Zod schema for semver version validation
 * Matches format: major.minor.patch (e.g., 1.0.0)
 */
const versionSchema = z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, "Must be valid semver (e.g., 1.0.0)");

/**
 * Zod schema for tool metadata validation
 * Validates that tool modules have all required fields with correct types
 */
const toolMetadataSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().min(1, "Description is required"),
    version: versionSchema,
    inputSchema: z.object({}).passthrough().optional(),
    capabilities: z.array(z.string()).optional(),
    schemaVersion: z.string().optional(),
    dependencies: z.record(z.string()).optional(),
});

/**
 * Zod schema for connector metadata validation
 * Validates that connector modules have all required fields with correct types
 */
const connectorMetadataSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().min(1, "Description is required"),
    version: versionSchema,
    type: z.enum(["email", "database", "api", "storage", "messaging"], {
        errorMap: () => ({ message: "Type must be one of: email, database, api, storage, messaging" }),
    }),
    authentication: z.object({}).passthrough().optional(),
    methods: z.array(z.string()).optional(),
    schemaVersion: z.string().optional(),
    dependencies: z.record(z.string()).optional(),
});

/**
 * Regex pattern for npm package name validation
 * Allows scoped packages (@scope/package) and standard packages
 */
const npmPackagePattern = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

/**
 * Regex pattern for semver version or version range validation
 * Matches: 1.0.0, ^1.0.0, ~1.2.3, >=2.0.0, 1.x, * etc.
 */
const semverRangePattern = /^[\^~>=<*]?[\d.*x]+\.?[\d.*x]*\.?[\d.*x]*(-[a-z0-9.-]+)?$/i;

/**
 * Validate an array of loaded modules
 * 
 * Performs comprehensive validation including:
 * - Schema validation (required fields, types, formats)
 * - Duplicate name detection (case-insensitive)
 * - Schema version checking
 * - Dependency validation
 * 
 * @param modules - Array of modules to validate
 * @returns ValidationResult with errors, warnings, and overall validity
 */
export function validateModules(modules: Module[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    const moduleNames = new Set<string>();

    for (const module of modules) {
        // 1. Check for duplicate names (case-insensitive)
        const lowerName = module.name.toLowerCase();
        if (moduleNames.has(lowerName)) {
            errors.push({
                moduleName: module.name,
                field: "name",
                message: `Duplicate module name: ${module.name}`,
                severity: "error",
            });
        } else {
            moduleNames.add(lowerName);
        }

        // 2. Validate metadata schema based on module type
        try {
            if (module.type === "tool") {
                toolMetadataSchema.parse(module.metadata);
            } else if (module.type === "connector") {
                connectorMetadataSchema.parse(module.metadata);
            }
        } catch (error) {
            if (error instanceof z.ZodError) {
                for (const issue of error.issues) {
                    errors.push({
                        moduleName: module.name,
                        field: issue.path.join("."),
                        message: issue.message,
                        severity: "error",
                    });
                }
            }
        }

        // 3. Check for schema version
        const metadata = module.metadata as any;
        if (!metadata.schemaVersion) {
            warnings.push(`${module.name}: Missing schemaVersion, assuming v1.0`);
        } else if (metadata.schemaVersion !== "1.0") {
            errors.push({
                moduleName: module.name,
                field: "schemaVersion",
                message: `Unsupported schema version: ${metadata.schemaVersion}`,
                severity: "error",
            });
        }

        // 4. Validate dependencies if present
        if (metadata.dependencies) {
            const deps = metadata.dependencies;

            // Check if dependencies is an object
            if (typeof deps !== "object" || Array.isArray(deps)) {
                errors.push({
                    moduleName: module.name,
                    field: "dependencies",
                    message: "Dependencies must be an object with package names as keys",
                    severity: "error",
                });
            } else {
                // Validate each dependency
                for (const [packageName, versionRange] of Object.entries(deps)) {
                    // Validate package name format
                    if (!npmPackagePattern.test(packageName)) {
                        warnings.push(
                            `${module.name}: Invalid npm package name '${packageName}' in dependencies`
                        );
                    }

                    // Validate version string format
                    if (typeof versionRange !== "string" || !semverRangePattern.test(versionRange)) {
                        warnings.push(
                            `${module.name}: Invalid version range '${versionRange}' for package '${packageName}'`
                        );
                    }
                }
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * Format validation results as a human-readable string
 * Useful for logging or displaying validation output
 * 
 * @param result - ValidationResult to format
 * @returns Formatted string representation of the validation results
 */
export function formatValidationResults(result: ValidationResult): string {
    let output = "";

    if (result.valid) {
        output += "✅ All modules passed validation\n";
    } else {
        output += `❌ Validation failed with ${result.errors.length} error(s)\n`;
    }

    if (result.errors.length > 0) {
        output += "\nErrors:\n";
        for (const error of result.errors) {
            output += `  - ${error.moduleName}.${error.field}: ${error.message}\n`;
        }
    }

    if (result.warnings.length > 0) {
        output += "\nWarnings:\n";
        for (const warning of result.warnings) {
            output += `  ⚠️  ${warning}\n`;
        }
    }

    if (result.valid && result.warnings.length === 0) {
        output += "\nNo errors or warnings found.\n";
    }

    return output;
}
