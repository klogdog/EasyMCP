/**
 * Test Config Schema
 * 
 * Validates the configuration schema definitions.
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

// ============================================================================
// Schema File Tests
// ============================================================================

console.log("\n=== Config Schema Tests ===\n");

// Test: YAML schema file exists
test("YAML schema file exists", () => {
    const schemaPath = path.join(__dirname, "../config/schema.yaml");
    assertTrue(fs.existsSync(schemaPath), "schema.yaml should exist");
});

// Test: JSON schema file exists
test("JSON schema file exists", () => {
    const schemaPath = path.join(__dirname, "../config/schema.json");
    assertTrue(fs.existsSync(schemaPath), "schema.json should exist");
});

// Test: YAML schema is valid YAML
test("YAML schema is valid YAML", () => {
    const schemaPath = path.join(__dirname, "../config/schema.yaml");
    const content = fs.readFileSync(schemaPath, "utf-8");
    const schema = yaml.load(content);
    assertDefined(schema, "Schema should parse");
    assertTrue(typeof schema === "object", "Schema should be an object");
});

// Test: JSON schema is valid JSON
test("JSON schema is valid JSON", () => {
    const schemaPath = path.join(__dirname, "../config/schema.json");
    const content = fs.readFileSync(schemaPath, "utf-8");
    const schema = JSON.parse(content);
    assertDefined(schema, "Schema should parse");
    assertTrue(typeof schema === "object", "Schema should be an object");
});

// Test: JSON schema has required metadata
test("JSON schema has required metadata", () => {
    const schemaPath = path.join(__dirname, "../config/schema.json");
    const content = fs.readFileSync(schemaPath, "utf-8");
    const schema = JSON.parse(content);

    assertDefined(schema.$schema, "Should have $schema");
    assertDefined(schema.$id, "Should have $id");
    assertDefined(schema.title, "Should have title");
    assertDefined(schema.type, "Should have type");
    assertEqual(schema.type, "object", "Root type should be object");
});

// Test: JSON schema defines server section
test("JSON schema defines server section", () => {
    const schemaPath = path.join(__dirname, "../config/schema.json");
    const content = fs.readFileSync(schemaPath, "utf-8");
    const schema = JSON.parse(content);

    assertDefined(schema.properties.server, "Should have server property");
    assertDefined(schema.properties.server.properties.name, "Server should have name");
    assertDefined(schema.properties.server.properties.version, "Server should have version");
    assertDefined(schema.properties.server.properties.host, "Server should have host");
    assertDefined(schema.properties.server.properties.port, "Server should have port");
});

// Test: JSON schema defines database section
test("JSON schema defines database section", () => {
    const schemaPath = path.join(__dirname, "../config/schema.json");
    const content = fs.readFileSync(schemaPath, "utf-8");
    const schema = JSON.parse(content);

    assertDefined(schema.properties.database, "Should have database property");
    assertDefined(schema.properties.database.properties.type, "Database should have type");
    assertDefined(schema.properties.database.properties.url, "Database should have url");
    assertDefined(schema.properties.database.properties.pool, "Database should have pool");
});

// Test: JSON schema defines logging section
test("JSON schema defines logging section", () => {
    const schemaPath = path.join(__dirname, "../config/schema.json");
    const content = fs.readFileSync(schemaPath, "utf-8");
    const schema = JSON.parse(content);

    assertDefined(schema.properties.logging, "Should have logging property");
    assertDefined(schema.properties.logging.properties.level, "Logging should have level");
    assertDefined(schema.properties.logging.properties.format, "Logging should have format");
    assertDefined(schema.properties.logging.properties.destination, "Logging should have destination");
});

// Test: JSON schema defines features section
test("JSON schema defines features section", () => {
    const schemaPath = path.join(__dirname, "../config/schema.json");
    const content = fs.readFileSync(schemaPath, "utf-8");
    const schema = JSON.parse(content);

    assertDefined(schema.properties.features, "Should have features property");
    assertEqual(schema.properties.features.type, "object", "Features should be object");
    assertDefined(schema.properties.features.additionalProperties, "Features should allow additional properties");
});

// Test: JSON schema defines connectors section
test("JSON schema defines connectors section", () => {
    const schemaPath = path.join(__dirname, "../config/schema.json");
    const content = fs.readFileSync(schemaPath, "utf-8");
    const schema = JSON.parse(content);

    assertDefined(schema.properties.connectors, "Should have connectors property");
    assertEqual(schema.properties.connectors.type, "object", "Connectors should be object");
});

// Test: JSON schema defines services section
test("JSON schema defines services section", () => {
    const schemaPath = path.join(__dirname, "../config/schema.json");
    const content = fs.readFileSync(schemaPath, "utf-8");
    const schema = JSON.parse(content);

    assertDefined(schema.properties.services, "Should have services property");
    assertEqual(schema.properties.services.type, "object", "Services should be object");
});

// Test: JSON schema defines security section
test("JSON schema defines security section", () => {
    const schemaPath = path.join(__dirname, "../config/schema.json");
    const content = fs.readFileSync(schemaPath, "utf-8");
    const schema = JSON.parse(content);

    assertDefined(schema.properties.security, "Should have security property");
    assertDefined(schema.properties.security.properties.authentication, "Security should have authentication");
    assertDefined(schema.properties.security.properties.tls, "Security should have tls");
    assertDefined(schema.properties.security.properties.rateLimit, "Security should have rateLimit");
});

// Test: JSON schema defines metrics section
test("JSON schema defines metrics section", () => {
    const schemaPath = path.join(__dirname, "../config/schema.json");
    const content = fs.readFileSync(schemaPath, "utf-8");
    const schema = JSON.parse(content);

    assertDefined(schema.properties.metrics, "Should have metrics property");
    assertDefined(schema.properties.metrics.properties.enabled, "Metrics should have enabled");
    assertDefined(schema.properties.metrics.properties.path, "Metrics should have path");
});

// Test: JSON schema defines tools section
test("JSON schema defines tools section", () => {
    const schemaPath = path.join(__dirname, "../config/schema.json");
    const content = fs.readFileSync(schemaPath, "utf-8");
    const schema = JSON.parse(content);

    assertDefined(schema.properties.tools, "Should have tools property");
    assertEqual(schema.properties.tools.type, "object", "Tools should be object");
});

// Test: Database type enum is correct
test("Database type enum is correct", () => {
    const schemaPath = path.join(__dirname, "../config/schema.json");
    const content = fs.readFileSync(schemaPath, "utf-8");
    const schema = JSON.parse(content);

    const dbType = schema.properties.database.properties.type;
    assertDefined(dbType.enum, "Database type should have enum");
    assertTrue(dbType.enum.includes("postgres"), "Should include postgres");
    assertTrue(dbType.enum.includes("sqlite"), "Should include sqlite");
    assertTrue(dbType.enum.includes("mysql"), "Should include mysql");
});

// Test: Logging level enum is correct
test("Logging level enum is correct", () => {
    const schemaPath = path.join(__dirname, "../config/schema.json");
    const content = fs.readFileSync(schemaPath, "utf-8");
    const schema = JSON.parse(content);

    const level = schema.properties.logging.properties.level;
    assertDefined(level.enum, "Logging level should have enum");
    assertTrue(level.enum.includes("debug"), "Should include debug");
    assertTrue(level.enum.includes("info"), "Should include info");
    assertTrue(level.enum.includes("warn"), "Should include warn");
    assertTrue(level.enum.includes("error"), "Should include error");
});

// Test: Logging format enum is correct
test("Logging format enum is correct", () => {
    const schemaPath = path.join(__dirname, "../config/schema.json");
    const content = fs.readFileSync(schemaPath, "utf-8");
    const schema = JSON.parse(content);

    const format = schema.properties.logging.properties.format;
    assertDefined(format.enum, "Logging format should have enum");
    assertTrue(format.enum.includes("json"), "Should include json");
    assertTrue(format.enum.includes("text"), "Should include text");
});

// Test: Server is required
test("Server section is required", () => {
    const schemaPath = path.join(__dirname, "../config/schema.json");
    const content = fs.readFileSync(schemaPath, "utf-8");
    const schema = JSON.parse(content);

    assertDefined(schema.required, "Schema should have required array");
    assertTrue(schema.required.includes("server"), "Server should be required");
});

// Test: YAML schema has all sections
test("YAML schema has all sections documented", () => {
    const schemaPath = path.join(__dirname, "../config/schema.yaml");
    const content = fs.readFileSync(schemaPath, "utf-8");

    assertTrue(content.includes("SERVER CONFIGURATION"), "Should document server");
    assertTrue(content.includes("DATABASE CONFIGURATION"), "Should document database");
    assertTrue(content.includes("LOGGING CONFIGURATION"), "Should document logging");
    assertTrue(content.includes("FEATURE FLAGS"), "Should document features");
    assertTrue(content.includes("SERVICES CONFIGURATION"), "Should document services");
    assertTrue(content.includes("CONNECTORS CONFIGURATION"), "Should document connectors");
    assertTrue(content.includes("SECURITY CONFIGURATION"), "Should document security");
    assertTrue(content.includes("METRICS CONFIGURATION"), "Should document metrics");
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
