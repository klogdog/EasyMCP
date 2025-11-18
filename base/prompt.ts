/**
 * Interactive Prompt System for MCP Server
 * 
 * This module provides user-friendly CLI prompts for collecting credentials
 * and configuration from users interactively. It supports multiple input types,
 * validation, environment variable defaults, and secure password masking.
 */

import inquirer from "inquirer";

/**
 * Credential requirement specification
 */
export interface CredentialRequirement {
    /** Name of the credential field */
    name: string;
    /** Type of input prompt */
    type: "text" | "password" | "confirm" | "list";
    /** Whether this field is required */
    required: boolean;
    /** Human-readable description shown to user */
    description: string;
    /** Validation function or regex pattern */
    validation?: RegExp | ((value: string) => boolean | string);
    /** Available choices (for list type) */
    choices?: string[];
    /** Default value if not set via environment variable */
    default?: string;
    /** Condition to determine if this prompt should be shown */
    when?: (answers: Record<string, any>) => boolean;
}

/**
 * Prompt user for credentials with validation and environment variable defaults
 * 
 * This function:
 * - Checks environment variables first for defaults
 * - Shows interactive prompts for each requirement
 * - Validates input according to validation rules
 * - Masks passwords during input
 * - Displays confirmation summary with masked secrets
 * - Handles graceful exit on Ctrl+C
 * 
 * @param requirements - Array of credential requirements to collect
 * @returns Promise resolving to collected credential values
 */
export async function promptForCredentials(
    requirements: CredentialRequirement[]
): Promise<Record<string, string>> {
    // Validate input
    if (!requirements || requirements.length === 0) {
        throw new Error("No credential requirements provided");
    }

    try {
        // Build inquirer questions
        const questions = requirements.map((req) => {
            const envVarName = toEnvVarName(req.name);
            const envDefault = process.env[envVarName] || req.default;

            return {
                type: mapPromptType(req.type),
                name: req.name,
                message: req.description,
                default: envDefault,
                choices: req.choices,
                when: req.when,
                validate: (value: string) => {
                    // Check required fields
                    if (req.required && !value) {
                        return "This field is required";
                    }

                    // Skip validation if value is empty and not required
                    if (!req.required && !value) {
                        return true;
                    }

                    // Apply custom validation
                    if (req.validation) {
                        if (req.validation instanceof RegExp) {
                            return req.validation.test(value) || "Invalid format";
                        }
                        return req.validation(value);
                    }

                    return true;
                },
            };
        });

        // Prompt user for credentials
        const answers = await inquirer.prompt(questions);

        // Display confirmation summary
        console.log("\n=== Configuration Summary ===");
        for (const [key, value] of Object.entries(answers)) {
            const req = requirements.find((r) => r.name === key);
            if (req?.type === "password") {
                console.log(`${key}: ${maskSecret(value as string)}`);
            } else {
                console.log(`${key}: ${value}`);
            }
        }
        console.log("");

        // Ask for confirmation
        const { proceed } = await inquirer.prompt([
            {
                type: "confirm",
                name: "proceed",
                message: "Proceed with these settings?",
                default: true,
            },
        ]);

        if (!proceed) {
            console.log("\nConfiguration cancelled by user");
            process.exit(0);
        }

        return answers as Record<string, string>;
    } catch (error: any) {
        // Handle TTY errors
        if (error.isTtyError) {
            console.error("\nError: Prompt couldn't be rendered in the current environment");
            console.error("Interactive prompts require a TTY terminal");
        } else if (error.name === "ExitPromptError") {
            // User cancelled with Ctrl+C
            console.log("\n\nConfiguration cancelled by user");
        } else {
            console.error("\nAn error occurred:", error.message);
        }
        process.exit(0);
    }
}

/**
 * Map credential requirement type to inquirer prompt type
 * 
 * @param type - Credential requirement type
 * @returns Corresponding inquirer prompt type
 */
function mapPromptType(type: string): string {
    const mapping: Record<string, string> = {
        text: "input",
        password: "password",
        confirm: "confirm",
        list: "list",
    };
    return mapping[type] || "input";
}

/**
 * Convert credential name to environment variable name format
 * 
 * Converts camelCase, kebab-case, or spaces to SCREAMING_SNAKE_CASE.
 * Examples:
 * - "apiKey" → "API_KEY"
 * - "database-url" → "DATABASE_URL"
 * - "email address" → "EMAIL_ADDRESS"
 * 
 * @param name - Credential field name
 * @returns Environment variable name in SCREAMING_SNAKE_CASE
 */
function toEnvVarName(name: string): string {
    return name
        .replace(/[A-Z]/g, (letter) => `_${letter}`)
        .replace(/[-\s]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_/, "")
        .toUpperCase();
}

/**
 * Mask secret value for display
 * 
 * Shows only first 2 and last 2 characters, replaces rest with asterisks.
 * For values 4 characters or shorter, shows only asterisks.
 * 
 * @param value - Secret value to mask
 * @returns Masked string
 */
function maskSecret(value: string): string {
    if (!value) return "****";
    if (value.length <= 4) return "****";
    return value.substring(0, 2) + "****" + value.substring(value.length - 2);
}

/**
 * Validate email address format
 * 
 * @param value - Email address to validate
 * @returns True if valid, error message if invalid
 */
export function validateEmail(value: string): boolean | string {
    if (!value) return "Email is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) || "Invalid email format (example: user@example.com)";
}

/**
 * Validate URL format
 * 
 * @param value - URL to validate
 * @returns True if valid, error message if invalid
 */
export function validateUrl(value: string): boolean | string {
    if (!value) return "URL is required";
    try {
        new URL(value);
        return true;
    } catch {
        return "Invalid URL format (example: https://example.com)";
    }
}

/**
 * Validate non-empty string
 * 
 * @param value - String to validate
 * @returns True if non-empty, error message if empty
 */
export function validateNonEmpty(value: string): boolean | string {
    return (value && value.trim().length > 0) || "This field cannot be empty";
}

/**
 * Create numeric range validator factory
 * 
 * Returns a validator function that checks if value is a number
 * within the specified range.
 * 
 * @param min - Minimum allowed value (inclusive)
 * @param max - Maximum allowed value (inclusive)
 * @returns Validator function
 */
export function validateNumericRange(
    min: number,
    max: number
): (value: string) => boolean | string {
    return (value: string) => {
        if (!value) return "Value is required";
        const num = parseFloat(value);
        if (isNaN(num)) return "Must be a number";
        if (num < min || num > max) return `Must be between ${min} and ${max}`;
        return true;
    };
}

/**
 * Validate port number (1-65535)
 * 
 * @param value - Port number to validate
 * @returns True if valid, error message if invalid
 */
export function validatePort(value: string): boolean | string {
    if (!value) return "Port is required";
    const port = parseInt(value, 10);
    if (isNaN(port)) return "Port must be a number";
    if (port < 1 || port > 65535) return "Port must be between 1 and 65535";
    return true;
}

/**
 * Validate hostname format
 * 
 * @param value - Hostname to validate
 * @returns True if valid, error message if invalid
 */
export function validateHostname(value: string): boolean | string {
    if (!value) return "Hostname is required";

    // Check for invalid patterns
    if (value.includes("..")) return "Invalid hostname format";
    if (value.startsWith("-") || value.endsWith("-")) return "Invalid hostname format";
    if (value.startsWith(".") || value.endsWith(".")) return "Invalid hostname format";

    // Allow localhost
    if (value === "localhost") return true;

    // Allow IP addresses
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipRegex.test(value)) {
        // Validate IP range (0-255 for each octet)
        const octets = value.split(".").map(Number);
        if (octets.every(n => n >= 0 && n <= 255)) {
            return true;
        }
    }

    // Allow domain names
    const hostnameRegex = /^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/;
    return hostnameRegex.test(value) || "Invalid hostname format";
}
