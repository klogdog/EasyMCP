/**
 * Secret Manager for MCP Server
 * 
 * This module provides secure encryption, storage, and injection of credentials.
 * Uses AES-256-GCM for authenticated encryption with random IVs.
 */

import * as crypto from "crypto";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * SecretManager class for handling credential encryption and storage
 * 
 * Features:
 * - AES-256-GCM authenticated encryption
 * - Random IV generation for each encryption
 * - Environment variable conversion
 * - Config template injection
 * - Secret masking for safe logging
 * - File-based encrypted storage
 */
export class SecretManager {
    private key: Buffer;
    private readonly algorithm = "aes-256-gcm";
    private readonly ivLength = 16;
    private readonly tagLength = 16;

    /**
     * Create a new SecretManager instance
     * 
     * @param keyString - The encryption key string (will be hashed to 32 bytes)
     * @throws Error if key is empty or undefined
     */
    constructor(keyString: string) {
        if (!keyString || keyString.trim().length === 0) {
            throw new Error("Encryption key is required and cannot be empty");
        }

        // Use SHA-256 to derive consistent 32-byte key from any input
        this.key = crypto.createHash("sha256")
            .update(keyString)
            .digest();
    }

    /**
     * Generate a new cryptographically secure encryption key
     * 
     * @returns Hex-encoded 256-bit random key
     */
    static generateKey(): string {
        return crypto.randomBytes(32).toString("hex");
    }

    /**
     * Encrypt a value using AES-256-GCM
     * 
     * Each encryption generates a new random IV for security.
     * Output format: iv:encryptedData:authTag (all hex-encoded)
     * 
     * @param value - The plaintext value to encrypt
     * @returns Encrypted string in format "iv:encrypted:authTag"
     * @throws Error if encryption fails
     */
    encrypt(value: string): string {
        if (value === undefined || value === null) {
            throw new Error("Cannot encrypt undefined or null value");
        }

        try {
            // Generate random IV for this encryption
            const iv = crypto.randomBytes(this.ivLength);

            // Create cipher with algorithm, key, and IV
            const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

            // Encrypt the value
            let encrypted = cipher.update(value, "utf8", "hex");
            encrypted += cipher.final("hex");

            // Get authentication tag
            const authTag = cipher.getAuthTag();

            // Return format: iv:encrypted:authTag (all hex)
            return `${iv.toString("hex")}:${encrypted}:${authTag.toString("hex")}`;
        } catch (error: any) {
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }

    /**
     * Decrypt a value encrypted with encrypt()
     * 
     * Parses the iv:encrypted:authTag format and decrypts using AES-256-GCM.
     * Verifies the authentication tag to ensure data integrity.
     * 
     * @param encrypted - The encrypted string in format "iv:encrypted:authTag"
     * @returns Decrypted plaintext value
     * @throws Error if format is invalid or decryption/verification fails
     */
    decrypt(encrypted: string): string {
        if (!encrypted || typeof encrypted !== "string") {
            throw new Error("Invalid encrypted data: must be a non-empty string");
        }

        const parts = encrypted.split(":");
        if (parts.length !== 3) {
            throw new Error("Invalid encrypted data format: expected 'iv:encrypted:authTag'");
        }

        try {
            const [ivHex, encryptedData, authTagHex] = parts;

            if (ivHex === undefined || encryptedData === undefined || authTagHex === undefined) {
                throw new Error("Invalid encrypted data format: missing components");
            }

            const iv = Buffer.from(ivHex, "hex");
            const authTag = Buffer.from(authTagHex, "hex");            // Validate IV length
            if (iv.length !== this.ivLength) {
                throw new Error(`Invalid IV length: expected ${this.ivLength}, got ${iv.length}`);
            }

            // Validate auth tag length
            if (authTag.length !== this.tagLength) {
                throw new Error(`Invalid auth tag length: expected ${this.tagLength}, got ${authTag.length}`);
            }

            // Create decipher
            const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
            decipher.setAuthTag(authTag);

            // Decrypt
            let decrypted = decipher.update(encryptedData, "hex", "utf8");
            decrypted = decrypted + decipher.final("utf8");

            return decrypted;
        } catch (error: any) {
            if (error.message.includes("Unsupported state or unable to authenticate")) {
                throw new Error("Decryption failed: authentication tag verification failed (wrong key or corrupted data)");
            }
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }

    /**
     * Convert secrets to environment variable format
     * 
     * Converts secret key-value pairs to an array of "KEY=value" strings.
     * Keys are converted to SCREAMING_SNAKE_CASE format.
     * 
     * @param secrets - Object containing secret key-value pairs
     * @returns Array of "KEY=value" strings
     */
    toEnvironmentVariables(secrets: Record<string, string>): string[] {
        if (!secrets || typeof secrets !== "object") {
            return [];
        }

        const envVars: string[] = [];

        for (const [key, value] of Object.entries(secrets)) {
            const envKey = this.toEnvVarName(key);
            envVars.push(`${envKey}=${value}`);
        }

        return envVars;
    }

    /**
     * Inject secrets into a configuration template
     * 
     * Replaces placeholders in the format ${VAR_NAME} or ${VAR_NAME:-default}
     * with actual values from the secrets object.
     * 
     * @param config - Configuration template string with placeholders
     * @param secrets - Object containing secret key-value pairs
     * @returns Configuration string with placeholders replaced
     */
    injectIntoConfig(config: string, secrets: Record<string, string>): string {
        if (!config || typeof config !== "string") {
            return config;
        }

        if (!secrets || typeof secrets !== "object") {
            return config;
        }

        let result = config;

        for (const [key, value] of Object.entries(secrets)) {
            const envKey = this.toEnvVarName(key);

            // Replace ${VAR_NAME} format
            const pattern1 = new RegExp(`\\$\\{${envKey}\\}`, "g");
            result = result.replace(pattern1, value);

            // Replace ${VAR_NAME:-default} format (with default value)
            const pattern2 = new RegExp(`\\$\\{${envKey}:-[^}]*\\}`, "g");
            result = result.replace(pattern2, value);
        }

        return result;
    }

    /**
     * Mask secrets for safe logging
     * 
     * Creates a copy of the secrets object with values masked.
     * Shows only first 2 and last 2 characters (or **** for short values).
     * 
     * @param secrets - Object containing secret key-value pairs
     * @returns New object with masked values (original unchanged)
     */
    maskSecrets(secrets: Record<string, string>): Record<string, string> {
        if (!secrets || typeof secrets !== "object") {
            return {};
        }

        const masked: Record<string, string> = {};

        for (const [key, value] of Object.entries(secrets)) {
            masked[key] = this.maskValue(value);
        }

        return masked;
    }

    /**
     * Save encrypted secrets to a file
     * 
     * Encrypts all secret values and saves to JSON file.
     * Creates directories if they don't exist.
     * 
     * @param secrets - Object containing secret key-value pairs
     * @param filepath - Path to save the encrypted file (default: .secrets.encrypted)
     */
    async saveEncrypted(
        secrets: Record<string, string>,
        filepath: string = ".secrets.encrypted"
    ): Promise<void> {
        if (!secrets || typeof secrets !== "object") {
            throw new Error("Secrets must be a valid object");
        }

        const encrypted: Record<string, string> = {};

        for (const [key, value] of Object.entries(secrets)) {
            encrypted[key] = this.encrypt(value);
        }

        // Create directory if it doesn't exist
        const dir = path.dirname(filepath);
        if (dir && dir !== ".") {
            await fs.mkdir(dir, { recursive: true });
        }

        await fs.writeFile(filepath, JSON.stringify(encrypted, null, 2), "utf8");
    }

    /**
     * Load and decrypt secrets from a file
     * 
     * Reads encrypted JSON file and decrypts all values.
     * 
     * @param filepath - Path to the encrypted file (default: .secrets.encrypted)
     * @returns Object containing decrypted secret key-value pairs
     * @throws Error if file doesn't exist or decryption fails
     */
    async loadEncrypted(
        filepath: string = ".secrets.encrypted"
    ): Promise<Record<string, string>> {
        try {
            const content = await fs.readFile(filepath, "utf8");
            const encrypted = JSON.parse(content);

            if (!encrypted || typeof encrypted !== "object") {
                throw new Error("Invalid encrypted file format");
            }

            const secrets: Record<string, string> = {};

            for (const [key, value] of Object.entries(encrypted)) {
                if (typeof value !== "string") {
                    throw new Error(`Invalid encrypted value for key '${key}'`);
                }
                secrets[key] = this.decrypt(value);
            }

            return secrets;
        } catch (error: any) {
            if (error.code === "ENOENT") {
                throw new Error(`Encrypted secrets file not found: ${filepath}`);
            }
            throw error;
        }
    }

    /**
     * Convert a name to environment variable format (SCREAMING_SNAKE_CASE)
     * 
     * @param name - Original name in any format
     * @returns Name in SCREAMING_SNAKE_CASE
     */
    private toEnvVarName(name: string): string {
        return name
            .replace(/[A-Z]/g, (letter) => `_${letter}`)
            .replace(/[-\s]/g, "_")
            .replace(/_+/g, "_")
            .replace(/^_/, "")
            .toUpperCase();
    }

    /**
     * Mask a single value for safe display
     * 
     * @param value - Value to mask
     * @returns Masked value (first 2 + **** + last 2, or **** for short values)
     */
    private maskValue(value: string): string {
        if (!value || value.length <= 4) {
            return "****";
        }
        return value.substring(0, 2) + "****" + value.substring(value.length - 2);
    }
}
