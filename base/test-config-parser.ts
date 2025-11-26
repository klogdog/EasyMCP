/**
 * Test Config Parser
 * 
 * Tests for the configuration parser module.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
    parseConfig,
    parseConfigString,
    validateConfig,
    loadConfig,
    substituteEnvVars,
    substituteEnvVarsRecursive,
    deepMerge,
    ConfigParseError,
    DEFAULT_CONFIG,
} from "./config-parser";

interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => void | Promise<void>): void {
    const run = async () => {
        try {
            await fn();
            results.push({ name, passed: true });
            console.log(`✓ ${name}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            results.push({ name, passed: false, error: message });
            console.log(`✗ ${name}`);
            console.log(`  Error: ${message}`);
        }
    };
    run();
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}

function assertTrue(value: boolean, message?: string): void {
    if (!value) {
        throw new Error(message || `Expected true, got ${value}`);
    }
}

function assertFalse(value: boolean, message?: string): void {
    if (value) {
        throw new Error(message || `Expected false, got ${value}`);
    }
}

function assertDefined<T>(value: T | undefined | null, message?: string): asserts value is T {
    if (value === undefined || value === null) {
        throw new Error(message || `Expected defined value`);
    }
}

async function assertThrowsAsync(fn: () => Promise<unknown>, expectedMessage?: string): Promise<void> {
    try {
        await fn();
        throw new Error("Expected function to throw");
    } catch (error) {
        if (expectedMessage && error instanceof Error) {
            if (!error.message.includes(expectedMessage)) {
                throw new Error(`Expected error message to contain "${expectedMessage}", got "${error.message}"`);
            }
        }
    }
}

// Create temp directory for test files
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "config-parser-test-"));

function createTempFile(name: string, content: string): string {
    const filePath = path.join(tempDir, name);
    fs.writeFileSync(filePath, content, "utf-8");
    return filePath;
}

// ============================================================================
// Environment Variable Substitution Tests
// ============================================================================

console.log("\n=== Environment Variable Substitution Tests ===\n");

test("substituteEnvVars replaces single env var", () => {
    process.env.TEST_VAR = "test_value";
    const result = substituteEnvVars("prefix_${TEST_VAR}_suffix");
    assertEqual(result, "prefix_test_value_suffix");
    delete process.env.TEST_VAR;
});

test("substituteEnvVars replaces multiple env vars", () => {
    process.env.VAR1 = "one";
    process.env.VAR2 = "two";
    const result = substituteEnvVars("${VAR1} and ${VAR2}");
    assertEqual(result, "one and two");
    delete process.env.VAR1;
    delete process.env.VAR2;
});

test("substituteEnvVars uses default when env var not set", () => {
    delete process.env.MISSING_VAR;
    const result = substituteEnvVars("${MISSING_VAR:-default_value}");
    assertEqual(result, "default_value");
});

test("substituteEnvVars prefers env var over default", () => {
    process.env.SET_VAR = "actual_value";
    const result = substituteEnvVars("${SET_VAR:-default}");
    assertEqual(result, "actual_value");
    delete process.env.SET_VAR;
});

test("substituteEnvVars keeps unresolved vars without default", () => {
    delete process.env.UNSET_VAR;
    const result = substituteEnvVars("${UNSET_VAR}");
    assertEqual(result, "${UNSET_VAR}");
});

test("substituteEnvVars handles empty default", () => {
    delete process.env.EMPTY_DEFAULT;
    const result = substituteEnvVars("${EMPTY_DEFAULT:-}");
    assertEqual(result, "");
});

test("substituteEnvVarsRecursive handles nested objects", () => {
    process.env.NESTED_VAR = "nested_value";
    const input = {
        level1: {
            level2: {
                value: "${NESTED_VAR}"
            }
        }
    };
    const result = substituteEnvVarsRecursive(input) as any;
    assertEqual(result.level1.level2.value, "nested_value");
    delete process.env.NESTED_VAR;
});

test("substituteEnvVarsRecursive handles arrays", () => {
    process.env.ARRAY_VAR = "array_value";
    const input = ["${ARRAY_VAR}", "static"];
    const result = substituteEnvVarsRecursive(input) as string[];
    assertEqual(result[0], "array_value");
    assertEqual(result[1], "static");
    delete process.env.ARRAY_VAR;
});

// ============================================================================
// Deep Merge Tests
// ============================================================================

console.log("\n=== Deep Merge Tests ===\n");

test("deepMerge merges flat objects", () => {
    const target = { a: 1, b: 2, c: 0 };
    const source = { b: 3, c: 4 };
    const result = deepMerge(target, source);
    assertEqual(result.a, 1);
    assertEqual(result.b, 3);
    assertEqual(result.c, 4);
});

test("deepMerge handles nested objects", () => {
    const target = { nested: { a: 1, b: 2 } };
    const source = { nested: { a: 1, b: 3 } };
    const result = deepMerge(target, source);
    assertEqual(result.nested.a, 1);
    assertEqual(result.nested.b, 3);
});

test("deepMerge replaces arrays", () => {
    const target = { arr: [1, 2, 3] };
    const source = { arr: [4, 5] };
    const result = deepMerge(target, source);
    assertEqual(result.arr.length, 2);
    assertEqual(result.arr[0], 4);
});

test("deepMerge preserves unmodified properties", () => {
    const target = { a: 1, b: { c: 2, d: 3 } };
    const source = { a: 1, b: { c: 4, d: 3 } };
    const result = deepMerge(target, source);
    assertEqual(result.a, 1);
    assertEqual(result.b.c, 4);
    assertEqual(result.b.d, 3);
});

// ============================================================================
// Parse Config String Tests
// ============================================================================

console.log("\n=== Parse Config String Tests ===\n");

test("parseConfigString parses valid YAML", async () => {
    const yamlContent = `
server:
  name: test-server
  version: 1.0.0
  host: localhost
  port: 3000
`;
    const config = await parseConfigString(yamlContent, "yaml");
    assertEqual(config.server.name, "test-server");
    assertEqual(config.server.version, "1.0.0");
    assertEqual(config.server.port, 3000);
});

test("parseConfigString parses valid JSON", async () => {
    const jsonContent = JSON.stringify({
        server: {
            name: "json-server",
            version: "2.0.0",
            host: "0.0.0.0",
            port: 8080
        }
    });
    const config = await parseConfigString(jsonContent, "json");
    assertEqual(config.server.name, "json-server");
    assertEqual(config.server.version, "2.0.0");
});

test("parseConfigString substitutes env vars in YAML", async () => {
    process.env.TEST_PORT = "9000";
    const yamlContent = `
server:
  name: env-server
  version: 1.0.0
  port: \${TEST_PORT}
`;
    const config = await parseConfigString(yamlContent, "yaml");
    assertEqual(config.server.port, "9000");
    delete process.env.TEST_PORT;
});

test("parseConfigString merges with defaults", async () => {
    const yamlContent = `
server:
  name: minimal-server
  version: 1.0.0
`;
    const config = await parseConfigString(yamlContent, "yaml", { mergeDefaults: true });
    assertEqual(config.server.host, "localhost");
    assertDefined(config.logging);
    assertEqual(config.logging.level, "info");
});

test("parseConfigString skips defaults when disabled", async () => {
    const yamlContent = `
server:
  name: no-defaults
  version: 1.0.0
  host: custom-host
  port: 5000
`;
    const config = await parseConfigString(yamlContent, "yaml", {
        mergeDefaults: false,
        validate: false
    });
    assertEqual(config.server.host, "custom-host");
});

test("parseConfigString throws on invalid YAML", async () => {
    const invalidYaml = `
server:
  name: bad yaml
    indentation: wrong
`;
    await assertThrowsAsync(
        () => parseConfigString(invalidYaml, "yaml"),
        "YAML parse error"
    );
});

test("parseConfigString throws on invalid JSON", async () => {
    const invalidJson = "{ invalid json }";
    await assertThrowsAsync(
        () => parseConfigString(invalidJson, "json"),
        "JSON parse error"
    );
});

// ============================================================================
// Parse Config File Tests
// ============================================================================

console.log("\n=== Parse Config File Tests ===\n");

test("parseConfig parses YAML file", async () => {
    const filePath = createTempFile("test.yaml", `
server:
  name: file-server
  version: 1.0.0
  port: 4000
`);
    const config = await parseConfig(filePath);
    assertEqual(config.server.name, "file-server");
    assertEqual(config.server.port, 4000);
});

test("parseConfig parses JSON file", async () => {
    const filePath = createTempFile("test.json", JSON.stringify({
        server: {
            name: "json-file-server",
            version: "1.0.0",
            port: 5000
        }
    }));
    const config = await parseConfig(filePath);
    assertEqual(config.server.name, "json-file-server");
    assertEqual(config.server.port, 5000);
});

test("parseConfig throws on missing file in strict mode", async () => {
    await assertThrowsAsync(
        () => parseConfig("/nonexistent/file.yaml", { strict: true }),
        "not found"
    );
});

test("parseConfig returns defaults on missing file in non-strict mode", async () => {
    const config = await parseConfig("/nonexistent/file.yaml", { strict: false });
    assertEqual(config.server.name, DEFAULT_CONFIG.server!.name);
});

test("parseConfig handles relative paths", async () => {
    createTempFile("relative.yaml", `
server:
  name: relative-server
  version: 1.0.0
`);
    // Change to temp directory and use relative path
    const originalCwd = process.cwd();
    process.chdir(tempDir);
    try {
        const config = await parseConfig("relative.yaml");
        assertEqual(config.server.name, "relative-server");
    } finally {
        process.chdir(originalCwd);
    }
});

// ============================================================================
// Validation Tests
// ============================================================================

console.log("\n=== Validation Tests ===\n");

test("validateConfig accepts valid config", () => {
    const config = {
        server: {
            name: "valid-server",
            version: "1.0.0",
            host: "localhost",
            port: 8080
        }
    };
    const result = validateConfig(config);
    assertTrue(result.success);
    assertEqual(result.errors.length, 0);
});

test("validateConfig rejects missing server", () => {
    const config = {};
    const result = validateConfig(config);
    assertFalse(result.success);
    assertTrue(result.errors.length > 0);
});

test("validateConfig rejects invalid version format", () => {
    const config = {
        server: {
            name: "bad-version",
            version: "not-semver",
            host: "localhost",
            port: 8080
        }
    };
    const result = validateConfig(config);
    assertFalse(result.success);
});

test("validateConfig rejects invalid log level", async () => {
    const yamlContent = `
server:
  name: bad-logging
  version: 1.0.0
logging:
  level: invalid-level
`;
    await assertThrowsAsync(
        () => parseConfigString(yamlContent, "yaml"),
        "Validation error"
    );
});

test("validateConfig accepts valid database config", () => {
    const config = {
        server: {
            name: "db-server",
            version: "1.0.0",
        },
        database: {
            type: "postgres",
            url: "postgres://localhost:5432/db",
            pool: {
                min: 2,
                max: 20,
                idleTimeout: 30000
            }
        }
    };
    const result = validateConfig(config);
    assertTrue(result.success);
});

test("validateConfig rejects invalid database type", () => {
    const config = {
        server: {
            name: "bad-db",
            version: "1.0.0",
        },
        database: {
            type: "oracle"
        }
    };
    const result = validateConfig(config);
    assertFalse(result.success);
});

test("validateConfig accepts connectors config", () => {
    const config = {
        server: {
            name: "connector-server",
            version: "1.0.0",
        },
        connectors: {
            myConnector: {
                type: "database",
                enabled: true,
                credentials: {
                    url: "${DB_URL}"
                }
            }
        }
    };
    const result = validateConfig(config);
    assertTrue(result.success);
});

test("validateConfig accepts features flags", () => {
    const config = {
        server: {
            name: "feature-server",
            version: "1.0.0",
        },
        features: {
            featureA: true,
            featureB: false,
            experimentalC: true
        }
    };
    const result = validateConfig(config);
    assertTrue(result.success);
});

// ============================================================================
// ConfigParseError Tests
// ============================================================================

console.log("\n=== ConfigParseError Tests ===\n");

test("ConfigParseError includes file path", () => {
    const error = new ConfigParseError("Test error", "/path/to/config.yaml");
    assertTrue(error.toString().includes("/path/to/config.yaml"));
});

test("ConfigParseError includes line number", () => {
    const error = new ConfigParseError("Test error", "/config.yaml", 42);
    assertTrue(error.toString().includes("line 42"));
});

test("ConfigParseError includes field path", () => {
    const error = new ConfigParseError("Test error", undefined, undefined, undefined, "server.port");
    assertTrue(error.toString().includes("server.port"));
});

test("ConfigParseError includes column", () => {
    const error = new ConfigParseError("Test error", "/config.yaml", 42, 15);
    assertTrue(error.toString().includes("42:15"));
});

// ============================================================================
// Load Config Tests
// ============================================================================

console.log("\n=== Load Config Tests ===\n");

test("loadConfig uses explicit path when provided", async () => {
    const filePath = createTempFile("explicit.yaml", `
server:
  name: explicit-server
  version: 1.0.0
`);
    const config = await loadConfig(filePath);
    assertEqual(config.server.name, "explicit-server");
});

test("loadConfig returns defaults when no config found in non-strict mode", async () => {
    const originalCwd = process.cwd();
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "empty-config-"));
    process.chdir(emptyDir);
    try {
        const config = await loadConfig(undefined, { strict: false });
        assertEqual(config.server.name, DEFAULT_CONFIG.server!.name);
    } finally {
        process.chdir(originalCwd);
        fs.rmdirSync(emptyDir);
    }
});

// ============================================================================
// Integration Tests
// ============================================================================

console.log("\n=== Integration Tests ===\n");

test("Full config with all sections parses correctly", async () => {
    const fullConfig = `
server:
  name: full-server
  version: 1.0.0
  host: 0.0.0.0
  port: 8080
  cors: true
  maxRequestSize: 50mb

database:
  type: postgres
  url: postgres://localhost:5432/mydb
  pool:
    min: 5
    max: 50
    idleTimeout: 60000

logging:
  level: debug
  format: pretty
  destination: console

services:
  openai:
    apiKey: \${OPENAI_API_KEY:-sk-test}
    endpoint: https://api.openai.com/v1
    timeout: 30000

connectors:
  maindb:
    type: database
    enabled: true
    credentials:
      url: \${DB_URL:-postgres://localhost/db}

features:
  featureX: true
  featureY: false

security:
  authentication:
    enabled: true
    type: api-key
  rateLimit:
    enabled: true
    maxRequests: 1000

metrics:
  enabled: true
  path: /health/metrics

tools:
  summarize:
    enabled: true
    timeout: 60000
`;
    const config = await parseConfigString(fullConfig, "yaml");

    // Verify all sections
    assertEqual(config.server.name, "full-server");
    assertEqual(config.server.cors, true);
    assertEqual(config.database?.type, "postgres");
    assertEqual(config.database?.pool?.max, 50);
    assertEqual(config.logging?.level, "debug");
    assertEqual(config.services?.openai?.endpoint, "https://api.openai.com/v1");
    assertEqual(config.connectors?.maindb?.type, "database");
    assertEqual(config.features?.featureX, true);
    assertEqual(config.features?.featureY, false);
    assertEqual(config.security?.authentication?.enabled, true);
    assertEqual(config.metrics?.path, "/health/metrics");
    assertEqual(config.tools?.summarize?.timeout, 60000);
});

test("Existing development.yaml parses correctly", async () => {
    const config = await parseConfig(path.join(__dirname, "../config/development.yaml"));
    assertEqual(config.server.name, "mcp-server");
    assertEqual(config.logging?.level, "debug");
});

test("Existing production.yaml parses correctly", async () => {
    const config = await parseConfig(path.join(__dirname, "../config/production.yaml"));
    assertEqual(config.server.name, "mcp-server");
    assertEqual(config.logging?.level, "info");
    assertEqual(config.logging?.format, "json");
});

// ============================================================================
// Cleanup & Summary
// ============================================================================

// Wait for all async tests
setTimeout(() => {
    // Cleanup temp directory
    try {
        fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
        // Ignore cleanup errors
    }

    console.log("\n=== Test Summary ===\n");

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    console.log(`Total: ${results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    if (failed > 0) {
        console.log("\nFailed tests:");
        results.filter(r => !r.passed).forEach(r => {
            console.log(`  - ${r.name}: ${r.error}`);
        });
        process.exit(1);
    }

    console.log("\n✅ All tests passed!");
}, 1000);
