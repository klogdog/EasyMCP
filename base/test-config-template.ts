/**
 * Test Config Templates
 * 
 * Validates the configuration template files.
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => void): void {
    try {
        fn();
        results.push({ name, passed: true });
        console.log(`✓ ${name}`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ name, passed: false, error: message });
        console.log(`✗ ${name}`);
        console.log(`  Error: ${message}`);
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

const configDir = path.join(__dirname, "../config");

// ============================================================================
// Template File Tests
// ============================================================================

console.log("\n=== Config Template Tests ===\n");

// Test: Template file exists
test("config.yaml.template exists", () => {
    const filePath = path.join(configDir, "config.yaml.template");
    assertTrue(fs.existsSync(filePath), "config.yaml.template should exist");
});

// Test: Dev config exists
test("config.dev.yaml exists", () => {
    const filePath = path.join(configDir, "config.dev.yaml");
    assertTrue(fs.existsSync(filePath), "config.dev.yaml should exist");
});

// Test: Prod config exists
test("config.prod.yaml exists", () => {
    const filePath = path.join(configDir, "config.prod.yaml");
    assertTrue(fs.existsSync(filePath), "config.prod.yaml should exist");
});

// Test: Template is valid YAML
test("config.yaml.template is valid YAML", () => {
    const filePath = path.join(configDir, "config.yaml.template");
    const content = fs.readFileSync(filePath, "utf-8");
    const config = yaml.load(content);
    assertDefined(config, "Template should parse");
    assertTrue(typeof config === "object", "Template should be an object");
});

// Test: Dev config is valid YAML
test("config.dev.yaml is valid YAML", () => {
    const filePath = path.join(configDir, "config.dev.yaml");
    const content = fs.readFileSync(filePath, "utf-8");
    const config = yaml.load(content);
    assertDefined(config, "Dev config should parse");
    assertTrue(typeof config === "object", "Dev config should be an object");
});

// Test: Prod config is valid YAML
test("config.prod.yaml is valid YAML", () => {
    const filePath = path.join(configDir, "config.prod.yaml");
    const content = fs.readFileSync(filePath, "utf-8");
    const config = yaml.load(content);
    assertDefined(config, "Prod config should parse");
    assertTrue(typeof config === "object", "Prod config should be an object");
});

// Test: Template has all required sections
test("Template has all required sections", () => {
    const filePath = path.join(configDir, "config.yaml.template");
    const content = fs.readFileSync(filePath, "utf-8");

    assertTrue(content.includes("server:"), "Should have server section");
    assertTrue(content.includes("database:"), "Should have database section");
    assertTrue(content.includes("logging:"), "Should have logging section");
    assertTrue(content.includes("services:"), "Should have services section");
    assertTrue(content.includes("connectors:"), "Should have connectors section");
    assertTrue(content.includes("features:"), "Should have features section");
    assertTrue(content.includes("security:"), "Should have security section");
    assertTrue(content.includes("metrics:"), "Should have metrics section");
    assertTrue(content.includes("tools:"), "Should have tools section");
});

// Test: Template has inline documentation
test("Template has inline documentation", () => {
    const filePath = path.join(configDir, "config.yaml.template");
    const content = fs.readFileSync(filePath, "utf-8");

    // Check for section headers
    assertTrue(content.includes("# Server Configuration"), "Should have server docs");
    assertTrue(content.includes("# Database Configuration"), "Should have database docs");
    assertTrue(content.includes("# Logging Configuration"), "Should have logging docs");
    assertTrue(content.includes("# Security Configuration"), "Should have security docs");

    // Check for examples
    assertTrue(content.includes("# Examples:") || content.includes("# Options:"),
        "Should have examples or options");
});

// Test: Template has security warnings
test("Template has security warnings", () => {
    const filePath = path.join(configDir, "config.yaml.template");
    const content = fs.readFileSync(filePath, "utf-8");

    assertTrue(content.includes("SECURITY WARNING"), "Should have security warnings");
    assertTrue(content.includes("environment variable"), "Should mention environment variables");
});

// Test: Template has environment variable reference
test("Template has environment variable reference", () => {
    const filePath = path.join(configDir, "config.yaml.template");
    const content = fs.readFileSync(filePath, "utf-8");

    assertTrue(content.includes("Environment Variable Reference") ||
        content.includes("Environment Variables"),
        "Should have env var reference");
    assertTrue(content.includes("DATABASE_URL"), "Should document DATABASE_URL");
});

// Test: Dev config has debug settings
test("Dev config has debug settings", () => {
    const filePath = path.join(configDir, "config.dev.yaml");
    const content = fs.readFileSync(filePath, "utf-8");
    const config = yaml.load(content) as any;

    assertTrue(config.logging?.level === "debug", "Dev should use debug log level");
    assertTrue(config.logging?.format === "pretty", "Dev should use pretty log format");
    assertTrue(config.server?.host === "localhost", "Dev should use localhost");
});

// Test: Dev config has permissive CORS
test("Dev config has permissive CORS", () => {
    const filePath = path.join(configDir, "config.dev.yaml");
    const content = fs.readFileSync(filePath, "utf-8");
    const config = yaml.load(content) as any;

    assertTrue(config.server?.cors === true, "Dev should enable CORS");
});

// Test: Dev config disables authentication
test("Dev config disables authentication", () => {
    const filePath = path.join(configDir, "config.dev.yaml");
    const content = fs.readFileSync(filePath, "utf-8");
    const config = yaml.load(content) as any;

    assertTrue(config.security?.authentication?.enabled === false,
        "Dev should disable authentication");
});

// Test: Prod config has structured logging
test("Prod config has structured logging", () => {
    const filePath = path.join(configDir, "config.prod.yaml");
    const content = fs.readFileSync(filePath, "utf-8");
    const config = yaml.load(content) as any;

    assertTrue(config.logging?.level === "info", "Prod should use info log level");
    assertTrue(config.logging?.format === "json", "Prod should use JSON log format");
    assertTrue(config.logging?.destination === "stdout", "Prod should log to stdout");
});

// Test: Prod config enables authentication
test("Prod config enables authentication", () => {
    const filePath = path.join(configDir, "config.prod.yaml");
    const content = fs.readFileSync(filePath, "utf-8");
    const config = yaml.load(content) as any;

    assertTrue(config.security?.authentication?.enabled === true,
        "Prod should enable authentication");
});

// Test: Prod config disables experimental features
test("Prod config disables experimental features", () => {
    const filePath = path.join(configDir, "config.prod.yaml");
    const content = fs.readFileSync(filePath, "utf-8");
    const config = yaml.load(content) as any;

    assertTrue(config.features?.experimentalFeatures === false,
        "Prod should disable experimental features");
});

// Test: Prod config has security checklist
test("Prod config has security checklist", () => {
    const filePath = path.join(configDir, "config.prod.yaml");
    const content = fs.readFileSync(filePath, "utf-8");

    assertTrue(content.includes("SECURITY CHECKLIST") || content.includes("Security Best Practices"),
        "Prod should have security checklist");
});

// Test: Prod config has deployment checklist
test("Prod config has deployment checklist", () => {
    const filePath = path.join(configDir, "config.prod.yaml");
    const content = fs.readFileSync(filePath, "utf-8");

    assertTrue(content.includes("Production Deployment Checklist") ||
        content.includes("Environment Variables (REQUIRED)"),
        "Prod should have deployment checklist");
});

// Test: Dev config uses SQLite
test("Dev config uses SQLite", () => {
    const filePath = path.join(configDir, "config.dev.yaml");
    const content = fs.readFileSync(filePath, "utf-8");
    const config = yaml.load(content) as any;

    assertTrue(config.database?.type === "sqlite", "Dev should use SQLite");
});

// Test: Prod config uses PostgreSQL
test("Prod config uses PostgreSQL", () => {
    const filePath = path.join(configDir, "config.prod.yaml");
    const content = fs.readFileSync(filePath, "utf-8");
    const config = yaml.load(content) as any;

    assertTrue(config.database?.type === "postgres", "Prod should use PostgreSQL");
});

// Test: Prod config has rate limiting
test("Prod config has rate limiting", () => {
    const filePath = path.join(configDir, "config.prod.yaml");
    const content = fs.readFileSync(filePath, "utf-8");
    const config = yaml.load(content) as any;

    assertTrue(config.security?.rateLimit?.enabled === true,
        "Prod should enable rate limiting");
    assertDefined(config.security?.rateLimit?.maxRequests,
        "Prod should define max requests");
});

// Test: Configs use environment variable placeholders
test("Configs use environment variable placeholders", () => {
    const devPath = path.join(configDir, "config.dev.yaml");
    const prodPath = path.join(configDir, "config.prod.yaml");

    const devContent = fs.readFileSync(devPath, "utf-8");
    const prodContent = fs.readFileSync(prodPath, "utf-8");

    assertTrue(devContent.includes("${") || prodContent.includes("${"),
        "Should use env var placeholders");
    assertTrue(prodContent.includes("${DATABASE_URL}") ||
        prodContent.includes("${OPENAI_API_KEY}"),
        "Should use standard env var names");
});

// ============================================================================
// Summary
// ============================================================================

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
