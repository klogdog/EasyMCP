/**
 * Test Config Override System
 * 
 * Tests for the configuration override module.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
    parseCliArgs,
    parseEnvVarsToConfig,
    mergeConfigs,
    mergeConfigsWithStrategy,
    findEnvConfig,
    loadConfigWithOverrides,
    loadConfig,
    debugConfig,
    annotateConfigSources,
    ConfigWatcher,
    Config,
    DEFAULT_CONFIG,
} from "./config-override";

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

function assertDefined<T>(value: T | undefined | null, message?: string): asserts value is T {
    if (value === undefined || value === null) {
        throw new Error(message || `Expected defined value`);
    }
}

// Create temp directory for test files
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "config-override-test-"));

function createTempFile(name: string, content: string): string {
    const filePath = path.join(tempDir, name);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, "utf-8");
    return filePath;
}

// ============================================================================
// CLI Argument Parsing Tests
// ============================================================================

console.log("\n=== CLI Argument Parsing Tests ===\n");

test("parseCliArgs parses simple key=value", () => {
    const args = ["--config.server.port=3000"];
    const result = parseCliArgs(args);
    assertDefined(result.server);
    assertEqual((result.server as any).port, 3000);
});

test("parseCliArgs parses without config. prefix", () => {
    const args = ["--server.host=0.0.0.0"];
    const result = parseCliArgs(args);
    assertDefined(result.server);
    assertEqual((result.server as any).host, "0.0.0.0");
});

test("parseCliArgs parses multiple args", () => {
    const args = [
        "--config.server.port=8080",
        "--config.server.host=localhost",
        "--config.logging.level=debug",
    ];
    const result = parseCliArgs(args);
    assertDefined(result.server);
    assertDefined(result.logging);
    assertEqual((result.server as any).port, 8080);
    assertEqual((result.server as any).host, "localhost");
    assertEqual((result.logging as any).level, "debug");
});

test("parseCliArgs coerces booleans", () => {
    const args = ["--config.server.cors=true", "--config.features.disabled=false"];
    const result = parseCliArgs(args);
    assertEqual((result.server as any).cors, true);
    assertEqual((result.features as any).disabled, false);
});

test("parseCliArgs coerces numbers", () => {
    const args = ["--config.database.pool.max=50", "--config.database.timeout=5.5"];
    const result = parseCliArgs(args);
    assertDefined(result.database);
    assertEqual((result.database as any).pool.max, 50);
    assertEqual((result.database as any).timeout, 5.5);
});

test("parseCliArgs handles null and undefined", () => {
    const args = ["--config.database.url=null"];
    const result = parseCliArgs(args);
    assertEqual((result.database as any).url, null);
});

test("parseCliArgs parses JSON arrays", () => {
    const args = ['--config.features.list=["a","b","c"]'];
    const result = parseCliArgs(args);
    const list = (result.features as any).list;
    assertTrue(Array.isArray(list));
    assertEqual(list.length, 3);
});

test("parseCliArgs ignores non-matching args", () => {
    const args = ["--help", "-v", "positional"];
    const result = parseCliArgs(args);
    assertEqual(Object.keys(result).length, 0);
});

// ============================================================================
// Environment Variable Config Tests
// ============================================================================

console.log("\n=== Environment Variable Config Tests ===\n");

test("parseEnvVarsToConfig parses CONFIG_ prefixed vars", () => {
    process.env.CONFIG_SERVER_PORT = "9000";
    process.env.CONFIG_LOGGING_LEVEL = "warn";

    const result = parseEnvVarsToConfig();

    assertEqual((result.server as any).port, 9000);
    assertEqual((result.logging as any).level, "warn");

    delete process.env.CONFIG_SERVER_PORT;
    delete process.env.CONFIG_LOGGING_LEVEL;
});

test("parseEnvVarsToConfig handles nested paths", () => {
    process.env.CONFIG_DATABASE_POOL_MAX = "100";

    const result = parseEnvVarsToConfig();

    assertDefined(result.database);
    assertEqual((result.database as any).pool.max, 100);

    delete process.env.CONFIG_DATABASE_POOL_MAX;
});

test("parseEnvVarsToConfig ignores non-CONFIG_ vars", () => {
    process.env.SOME_OTHER_VAR = "value";

    const result = parseEnvVarsToConfig();

    assertTrue(!("some" in result));

    delete process.env.SOME_OTHER_VAR;
});

// ============================================================================
// Config Merging Tests
// ============================================================================

console.log("\n=== Config Merging Tests ===\n");

test("mergeConfigs merges single override", () => {
    const base: Config = {
        server: { name: "base", version: "1.0.0", host: "localhost", port: 8080 },
    };
    const override = { server: { name: "base", version: "1.0.0", host: "0.0.0.0", port: 8080 } };

    const result = mergeConfigs(base, override as Partial<Config>);

    assertEqual(result.server.host, "0.0.0.0");
    assertEqual(result.server.port, 8080);
});

test("mergeConfigs merges multiple overrides in order", () => {
    const base: Config = {
        server: { name: "base", version: "1.0.0", host: "localhost", port: 8080 },
    };
    const override1 = { server: { name: "base", version: "1.0.0", host: "localhost", port: 3000 } };
    const override2 = { server: { name: "base", version: "1.0.0", host: "localhost", port: 4000 } };

    const result = mergeConfigs(base, override1 as Partial<Config>, override2 as Partial<Config>);

    assertEqual(result.server.port, 4000);
});

test("mergeConfigs preserves unmodified values", () => {
    const base: Config = {
        server: { name: "original", version: "1.0.0", host: "localhost", port: 8080 },
        logging: { level: "info", format: "json", destination: "stdout" },
    };
    const override = { logging: { level: "debug", format: "json", destination: "stdout" } };

    const result = mergeConfigs(base, override as Partial<Config>);

    assertEqual(result.server.name, "original");
    assertEqual(result.logging?.level, "debug");
});

test("mergeConfigsWithStrategy replaces arrays by default", () => {
    const base = {
        server: { name: "test", version: "1.0.0", host: "localhost", port: 8080 },
        connectors: { test: { type: "database" as const, enabled: true, settings: { list: ["a", "b"] } } }
    };
    const override = {
        server: { name: "test", version: "1.0.0", host: "localhost", port: 8080 },
        connectors: { test: { type: "database" as const, enabled: true, settings: { list: ["c"] } } }
    };

    const result = mergeConfigsWithStrategy(
        base as Config,
        override as Partial<Config>
    );

    assertEqual((result.connectors as any).test.settings.list.length, 1);
    assertEqual((result.connectors as any).test.settings.list[0], "c");
});

test("mergeConfigsWithStrategy concats arrays when specified", () => {
    const base = {
        server: { name: "test", version: "1.0.0", host: "localhost", port: 8080 },
        connectors: { test: { type: "database" as const, enabled: true, settings: { list: ["a", "b"] } } }
    };
    const override = {
        server: { name: "test", version: "1.0.0", host: "localhost", port: 8080 },
        connectors: { test: { type: "database" as const, enabled: true, settings: { list: ["c"] } } }
    };

    const result = mergeConfigsWithStrategy(
        base as Config,
        override as Partial<Config>,
        { arrays: "concat", objects: "deep" }
    );

    assertEqual((result.connectors as any).test.settings.list.length, 3);
});

test("mergeConfigsWithStrategy unique arrays removes duplicates", () => {
    const base = {
        server: { name: "test", version: "1.0.0", host: "localhost", port: 8080 },
        connectors: { test: { type: "database" as const, enabled: true, settings: { list: ["a", "b"] } } }
    };
    const override = {
        server: { name: "test", version: "1.0.0", host: "localhost", port: 8080 },
        connectors: { test: { type: "database" as const, enabled: true, settings: { list: ["b", "c"] } } }
    };

    const result = mergeConfigsWithStrategy(
        base as Config,
        override as Partial<Config>,
        { arrays: "unique", objects: "deep" }
    );

    assertEqual((result.connectors as any).test.settings.list.length, 3);
    assertTrue((result.connectors as any).test.settings.list.includes("a"));
    assertTrue((result.connectors as any).test.settings.list.includes("b"));
    assertTrue((result.connectors as any).test.settings.list.includes("c"));
});

// ============================================================================
// Environment-Specific Config Tests
// ============================================================================

console.log("\n=== Environment-Specific Config Tests ===\n");

test("findEnvConfig finds config.{env}.yaml", () => {
    createTempFile("config.production.yaml", "server:\n  port: 8080");

    const result = findEnvConfig(tempDir, "production");

    assertDefined(result);
    assertTrue(result.endsWith("config.production.yaml"));
});

test("findEnvConfig finds {env}.yaml", () => {
    createTempFile("staging.yaml", "server:\n  port: 8080");

    const result = findEnvConfig(tempDir, "staging");

    assertDefined(result);
    assertTrue(result.endsWith("staging.yaml"));
});

test("findEnvConfig returns undefined when not found", () => {
    const result = findEnvConfig(tempDir, "nonexistent");

    assertEqual(result, undefined);
});

// ============================================================================
// Debug Utilities Tests
// ============================================================================

console.log("\n=== Debug Utilities Tests ===\n");

test("debugConfig returns formatted string", () => {
    const config: Config = {
        server: { name: "test", version: "1.0.0", host: "localhost", port: 8080 },
    };

    const output = debugConfig(config);

    assertTrue(output.includes("Configuration Debug"));
    assertTrue(output.includes("server"));
    assertTrue(output.includes("localhost"));
});

test("debugConfig masks sensitive values", () => {
    const config: Config = {
        server: { name: "test", version: "1.0.0", host: "localhost", port: 8080 },
        services: {
            openai: { apiKey: "sk-secret-key" }
        }
    };

    const output = debugConfig(config);

    assertTrue(output.includes("********"));
    assertTrue(!output.includes("sk-secret-key"));
});

test("annotateConfigSources tracks value sources", () => {
    const config: Config = {
        server: { name: "test", version: "1.0.0", host: "localhost", port: 8080 },
    };

    const sources = [
        { config: { server: { host: "localhost" } } as Partial<Config>, source: { source: "default" as const } },
        { config: { server: { port: 8080 } } as Partial<Config>, source: { source: "file" as const, path: "config.yaml" } },
    ];

    const annotations = annotateConfigSources(config, sources);

    assertTrue(annotations.size > 0);
});

// ============================================================================
// Load Config With Overrides Tests
// ============================================================================

console.log("\n=== Load Config With Overrides Tests ===\n");

test("loadConfigWithOverrides uses defaults when no config", async () => {
    const { config, sources } = await loadConfigWithOverrides({
        strict: false,
    });

    assertEqual(config.server.name, DEFAULT_CONFIG.server!.name);
    assertTrue(sources.includes("defaults"));
});

test("loadConfigWithOverrides loads base config file", async () => {
    const configPath = createTempFile("base.yaml", `
server:
  name: base-server
  version: 1.0.0
`);

    const { config, sources } = await loadConfigWithOverrides({
        configPath,
    });

    assertEqual(config.server.name, "base-server");
    assertTrue(sources.some(s => s.includes("base.yaml")));
});

test("loadConfigWithOverrides applies CLI args", async () => {
    const configPath = createTempFile("cli-test.yaml", `
server:
  name: cli-server
  version: 1.0.0
  port: 3000
`);

    const { config } = await loadConfigWithOverrides({
        configPath,
        cliArgs: ["--config.server.port=9999"],
    });

    assertEqual(config.server.port, 9999);
});

test("loadConfigWithOverrides applies env vars", async () => {
    // Clean up any leftover env vars from previous tests
    delete process.env.CONFIG_SERVER_PORT;
    
    process.env.CONFIG_SERVER_HOST = "envhost.local";

    const configPath = createTempFile("env-test.yaml", `
server:
  name: env-server
  version: 1.0.0
  host: localhost
`);

    const { config } = await loadConfigWithOverrides({
        configPath,
    });

    assertEqual(config.server.host, "envhost.local");
    
    delete process.env.CONFIG_SERVER_HOST;

    delete process.env.CONFIG_SERVER_PORT;
});

test("loadConfigWithOverrides respects precedence", async () => {
    // Set env var
    process.env.CONFIG_SERVER_PORT = "5000";

    const configPath = createTempFile("precedence.yaml", `
server:
  name: precedence-server
  version: 1.0.0
  port: 3000
`);

    // CLI should override env var
    const { config } = await loadConfigWithOverrides({
        configPath,
        cliArgs: ["--config.server.port=6000"],
    });

    assertEqual(config.server.port, 6000);

    delete process.env.CONFIG_SERVER_PORT;
});

test("loadConfigWithOverrides loads env-specific config", async () => {
    // Create base and env-specific configs
    const configDir = path.join(tempDir, "env-config");
    fs.mkdirSync(configDir, { recursive: true });

    fs.writeFileSync(
        path.join(configDir, "base.yaml"),
        `server:
  name: base
  version: 1.0.0
  port: 3000
`
    );

    fs.writeFileSync(
        path.join(configDir, "config.production.yaml"),
        `server:
  name: base
  version: 1.0.0
  port: 8080
logging:
  level: warn
  format: json
  destination: stdout
`
    );

    const { config, sources } = await loadConfigWithOverrides({
        configPath: path.join(configDir, "base.yaml"),
        env: "production",
    });

    assertEqual(config.server.port, 8080);
    assertEqual(config.logging?.level, "warn");
    assertTrue(sources.some(s => s.includes("production")));
});

test("loadConfig simple function works", async () => {
    const configPath = createTempFile("simple.yaml", `
server:
  name: simple-server
  version: 1.0.0
`);

    const config = await loadConfig(configPath);

    assertEqual(config.server.name, "simple-server");
});

// ============================================================================
// Config Watcher Tests
// ============================================================================

console.log("\n=== Config Watcher Tests ===\n");

test("ConfigWatcher can be created and stopped", () => {
    const watcher = new ConfigWatcher(
        ["/nonexistent/file.yaml"],
        () => { }
    );

    watcher.start();
    watcher.stop();

    assertTrue(true); // If we get here, no errors
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
}, 1500);
