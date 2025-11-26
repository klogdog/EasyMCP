/**
 * Test Suite for Secret Manager
 * 
 * This test suite validates the SecretManager class functionality including:
 * - AES-256-GCM encryption and decryption
 * - Key generation
 * - Environment variable conversion
 * - Config template injection
 * - Secret masking
 * - File-based storage
 * - Error handling
 */

import { SecretManager } from "./secrets";
import * as fs from "fs/promises";

// Test counter
let testsPassed = 0;
let testsFailed = 0;

/**
 * Simple test runner
 */
async function test(name: string, fn: () => void | Promise<void>) {
    console.log(`\nRunning: ${name}`);
    try {
        await fn();
        console.log(`✓ ${name}`);
        testsPassed++;
    } catch (error: any) {
        console.error(`✗ ${name}`);
        console.error(`  Error: ${error.message}`);
        testsFailed++;
    }
}

/**
 * Assertion helper
 */
function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(message);
    }
}

/**
 * Run all tests
 */
async function runTests() {
    console.log("==================================");
    console.log("Secret Manager Test Suite");
    console.log("==================================");

    // Test 1: Encryption and Decryption
    await test("Test 1: Encryption and Decryption", async () => {
        const manager = new SecretManager("test-encryption-key");

        // Test with various strings
        const testValues = [
            "simple-password",
            "complex!@#$%^&*()_+password",
            "unicode-日本語-emoji-😀",
            "a", // Single character
            "very-long-password-that-goes-on-and-on-for-a-while-to-test-longer-values",
        ];

        for (const original of testValues) {
            const encrypted = manager.encrypt(original);
            const decrypted = manager.decrypt(encrypted);
            assert(decrypted === original, `Failed for value: "${original}"`);
        }

        // Test empty string separately (special case)
        const encryptedEmpty = manager.encrypt("");
        const decryptedEmpty = manager.decrypt(encryptedEmpty);
        assert(decryptedEmpty === "", "Empty string should encrypt and decrypt");

        // Verify encrypted format is iv:encrypted:authTag
        const encrypted = manager.encrypt("test");
        const parts = encrypted.split(":");
        assert(parts.length === 3, "Encrypted format should be iv:encrypted:authTag");
        assert(parts[0] !== undefined && parts[0].length === 32, "IV should be 32 hex chars (16 bytes)");
        assert(parts[2] !== undefined && parts[2].length === 32, "Auth tag should be 32 hex chars (16 bytes)");

        console.log("  - Various strings encrypt and decrypt correctly");
        console.log("  - Format is iv:encrypted:authTag");
    });

    // Test 2: Key Generation
    await test("Test 2: Key Generation", async () => {
        const key1 = SecretManager.generateKey();
        const key2 = SecretManager.generateKey();
        const key3 = SecretManager.generateKey();

        // Keys should be 64 hex characters (32 bytes)
        assert(key1.length === 64, "Key should be 64 hex characters");
        assert(key2.length === 64, "Key should be 64 hex characters");
        assert(key3.length === 64, "Key should be 64 hex characters");

        // Keys should be different (randomness)
        assert(key1 !== key2, "Keys should be different");
        assert(key2 !== key3, "Keys should be different");
        assert(key1 !== key3, "Keys should be different");

        // Keys should be valid hex
        assert(/^[0-9a-f]+$/.test(key1), "Key should be valid hex");

        console.log("  - Generated keys are 64 hex characters (256 bits)");
        console.log("  - Generated keys are unique (random)");
    });

    // Test 3: Random IV per Encryption
    await test("Test 3: Random IV per Encryption", async () => {
        const manager = new SecretManager("test-iv-key");
        const value = "same-value-to-encrypt";

        // Encrypt same value multiple times
        const encrypted1 = manager.encrypt(value);
        const encrypted2 = manager.encrypt(value);
        const encrypted3 = manager.encrypt(value);

        // All encryptions should be different (different IVs)
        assert(encrypted1 !== encrypted2, "Encryptions should differ (different IVs)");
        assert(encrypted2 !== encrypted3, "Encryptions should differ (different IVs)");
        assert(encrypted1 !== encrypted3, "Encryptions should differ (different IVs)");

        // But all should decrypt to same value
        assert(manager.decrypt(encrypted1) === value, "Decrypt should return original");
        assert(manager.decrypt(encrypted2) === value, "Decrypt should return original");
        assert(manager.decrypt(encrypted3) === value, "Decrypt should return original");

        console.log("  - Same value produces different ciphertexts (random IVs)");
        console.log("  - All ciphertexts decrypt to original value");
    });

    // Test 4: Environment Variable Conversion
    await test("Test 4: Environment Variable Conversion", async () => {
        const manager = new SecretManager("test-env-key");

        const secrets = {
            apiKey: "secret-api-key",
            databaseUrl: "postgres://localhost/db",
            "email-password": "email-secret",
            simpleKey: "simple-value",
        };

        const envVars = manager.toEnvironmentVariables(secrets);

        assert(envVars.length === 4, "Should return 4 environment variables");
        assert(envVars.includes("API_KEY=secret-api-key"), "Should convert apiKey to API_KEY");
        assert(envVars.includes("DATABASE_URL=postgres://localhost/db"), "Should convert databaseUrl");
        assert(envVars.includes("EMAIL_PASSWORD=email-secret"), "Should convert kebab-case");
        assert(envVars.includes("SIMPLE_KEY=simple-value"), "Should convert camelCase");

        // Test empty object
        const emptyEnv = manager.toEnvironmentVariables({});
        assert(emptyEnv.length === 0, "Empty object should return empty array");

        console.log("  - Converts camelCase to SCREAMING_SNAKE_CASE");
        console.log("  - Converts kebab-case to SCREAMING_SNAKE_CASE");
        console.log("  - Formats as KEY=value");
    });

    // Test 5: Config Template Injection
    await test("Test 5: Config Template Injection", async () => {
        const manager = new SecretManager("test-inject-key");

        const configTemplate = `
server:
  host: localhost
  port: 3000
database:
  url: \${DATABASE_URL}
  password: \${DB_PASSWORD:-default_pass}
api:
  key: \${API_KEY}
  secret: \${API_SECRET:-default_secret}
`;

        const secrets = {
            databaseUrl: "postgres://prod-server/mydb",
            dbPassword: "super-secret-password",
            apiKey: "my-api-key-123",
            // Note: apiSecret not provided, should keep default
        };

        const result = manager.injectIntoConfig(configTemplate, secrets);

        assert(result.includes("url: postgres://prod-server/mydb"), "Should inject DATABASE_URL");
        assert(result.includes("password: super-secret-password"), "Should inject DB_PASSWORD");
        assert(result.includes("key: my-api-key-123"), "Should inject API_KEY");
        assert(result.includes("secret: ${API_SECRET:-default_secret}"), "Should keep unmatched placeholder");

        // Test with empty secrets
        const unchanged = manager.injectIntoConfig(configTemplate, {});
        assert(unchanged === configTemplate, "Empty secrets should not change config");

        console.log("  - Injects secrets into ${VAR} placeholders");
        console.log("  - Injects secrets into ${VAR:-default} placeholders");
        console.log("  - Preserves unmatched placeholders");
    });

    // Test 6: Secret Masking
    await test("Test 6: Secret Masking", async () => {
        const manager = new SecretManager("test-mask-key");

        const secrets = {
            longSecret: "super-secret-password-123",
            shortSecret: "abc",
            fourChar: "abcd",
            fiveChar: "abcde",
            empty: "",
        };

        const masked = manager.maskSecrets(secrets);

        // Long secret should show first 2 and last 2 chars
        assert(masked.longSecret === "su****23", "Long secret should be masked as su****23");

        // Short secrets (<=4) should be ****
        assert(masked.shortSecret === "****", "3-char secret should be ****");
        assert(masked.fourChar === "****", "4-char secret should be ****");
        assert(masked.empty === "****", "Empty secret should be ****");

        // 5+ chars should show first 2 and last 2
        assert(masked.fiveChar === "ab****de", "5-char secret should show first/last 2");

        // Original should be unchanged
        assert(secrets.longSecret === "super-secret-password-123", "Original should be unchanged");

        console.log("  - Masks long secrets as ab****xy");
        console.log("  - Masks short secrets (<=4) as ****");
        console.log("  - Does not modify original object");
    });

    // Test 7: File Storage (Save and Load)
    await test("Test 7: File Storage (Save and Load)", async () => {
        const manager = new SecretManager("test-file-key");
        const testFile = "/tmp/test-secrets.encrypted";

        const secrets = {
            apiKey: "test-api-key-123",
            password: "super-secret-password",
            token: "jwt-token-xyz",
        };

        // Save encrypted secrets
        await manager.saveEncrypted(secrets, testFile);

        // Verify file exists
        const stat = await fs.stat(testFile);
        assert(stat.isFile(), "File should exist");

        // Read raw file content to verify it's encrypted
        const rawContent = await fs.readFile(testFile, "utf8");
        const parsed = JSON.parse(rawContent);

        assert(!rawContent.includes("test-api-key-123"), "Raw file should not contain plaintext");
        assert(parsed.apiKey.includes(":"), "Values should be encrypted (contain colons)");

        // Load and decrypt secrets
        const loaded = await manager.loadEncrypted(testFile);

        assert(loaded.apiKey === secrets.apiKey, "Loaded apiKey should match");
        assert(loaded.password === secrets.password, "Loaded password should match");
        assert(loaded.token === secrets.token, "Loaded token should match");

        // Cleanup
        await fs.unlink(testFile);

        console.log("  - Saves encrypted secrets to file");
        console.log("  - File contains encrypted values (not plaintext)");
        console.log("  - Loads and decrypts secrets correctly");
    });

    // Test 8: Error Handling
    await test("Test 8: Error Handling", async () => {
        // Test empty key
        let errorThrown = false;
        try {
            new SecretManager("");
        } catch (e) {
            errorThrown = true;
        }
        assert(errorThrown, "Should throw on empty key");

        // Test invalid encrypted data format
        const manager = new SecretManager("test-error-key");

        errorThrown = false;
        try {
            manager.decrypt("invalid-format");
        } catch (e) {
            errorThrown = true;
        }
        assert(errorThrown, "Should throw on invalid format");

        // Test wrong key for decryption
        const manager1 = new SecretManager("key-one");
        const manager2 = new SecretManager("key-two");

        const encrypted = manager1.encrypt("secret-value");

        errorThrown = false;
        try {
            manager2.decrypt(encrypted);
        } catch (e) {
            errorThrown = true;
        }
        assert(errorThrown, "Should throw on wrong decryption key");

        // Test loading non-existent file
        errorThrown = false;
        try {
            await manager.loadEncrypted("/tmp/nonexistent-file-12345.encrypted");
        } catch (e) {
            errorThrown = true;
        }
        assert(errorThrown, "Should throw on non-existent file");

        console.log("  - Throws on empty encryption key");
        console.log("  - Throws on invalid encrypted format");
        console.log("  - Throws on wrong decryption key");
        console.log("  - Throws on non-existent file");
    });

    // Print summary
    console.log("\n==================================");
    console.log("Test Summary");
    console.log("==================================");
    console.log("");
    console.log(`Total Tests: ${testsPassed + testsFailed}`);
    console.log(`Passed: ${testsPassed}`);
    if (testsFailed > 0) {
        console.log(`Failed: ${testsFailed}`);
        process.exit(1);
    }
}

// Run tests
runTests().catch((error) => {
    console.error("Test suite failed:", error);
    process.exit(1);
});
