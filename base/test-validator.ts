/**
 * Test script for Module Validator
 * 
 * Tests various validation scenarios:
 * 1. Valid modules (should pass)
 * 2. Duplicate names (should fail)
 * 3. Invalid version format (should fail)
 * 4. Invalid connector type (should fail)
 * 5. Missing schemaVersion (should warn)
 * 6. Unsupported schemaVersion (should fail)
 * 7. Invalid dependencies (should warn)
 */

import { loadModules } from "./loader";
import { validateModules, formatValidationResults } from "./validator";
import { Module } from "./loader";

console.log("Testing Module Validator...\n");

/**
 * Test 1: Valid modules from existing sample files
 */
async function testValidModules() {
    console.log("Test 1: Validating existing modules");
    console.log("=".repeat(50));

    const modules = await loadModules("/workspace");
    const result = validateModules(modules);

    console.log(formatValidationResults(result));
    console.log("");

    return result.valid;
}

/**
 * Test 2: Duplicate module names (case-insensitive)
 */
function testDuplicateNames() {
    console.log("Test 2: Duplicate module names (case-insensitive)");
    console.log("=".repeat(50));

    const modules: Module[] = [
        {
            name: "email-connector",
            path: "/workspace/connectors/email-connector.ts",
            type: "connector",
            language: "typescript",
            metadata: {
                name: "email-connector",
                description: "First email connector",
                version: "1.0.0",
                type: "email",
            },
        },
        {
            name: "Email-Connector",  // Same name, different case
            path: "/workspace/connectors/email-connector-v2.ts",
            type: "connector",
            language: "typescript",
            metadata: {
                name: "Email-Connector",
                description: "Second email connector",
                version: "1.0.0",
                type: "email",
            },
        },
    ];

    const result = validateModules(modules);
    console.log(formatValidationResults(result));

    const hasDuplicateError = result.errors.some(
        e => e.field === "name" && e.message.includes("Duplicate")
    );

    if (!result.valid && hasDuplicateError) {
        console.log("✅ Test passed: Duplicate names detected\n");
        return true;
    } else {
        console.log("❌ Test failed: Duplicate names not detected\n");
        return false;
    }
}

/**
 * Test 3: Invalid version format
 */
function testInvalidVersion() {
    console.log("Test 3: Invalid version format");
    console.log("=".repeat(50));

    const modules: Module[] = [
        {
            name: "bad-version-tool",
            path: "/workspace/tools/bad-version.ts",
            type: "tool",
            language: "typescript",
            metadata: {
                name: "bad-version-tool",
                description: "Tool with invalid version",
                version: "v1.0",  // Invalid format
            },
        },
    ];

    const result = validateModules(modules);
    console.log(formatValidationResults(result));

    const hasVersionError = result.errors.some(
        e => e.field === "version"
    );

    if (!result.valid && hasVersionError) {
        console.log("✅ Test passed: Invalid version format detected\n");
        return true;
    } else {
        console.log("❌ Test failed: Invalid version not detected\n");
        return false;
    }
}

/**
 * Test 4: Invalid connector type
 */
function testInvalidConnectorType() {
    console.log("Test 4: Invalid connector type");
    console.log("=".repeat(50));

    const modules: Module[] = [
        {
            name: "invalid-connector",
            path: "/workspace/connectors/invalid.ts",
            type: "connector",
            language: "typescript",
            metadata: {
                name: "invalid-connector",
                description: "Connector with invalid type",
                version: "1.0.0",
                type: "invalid-type",  // Not in allowed enum
            },
        },
    ];

    const result = validateModules(modules);
    console.log(formatValidationResults(result));

    const hasTypeError = result.errors.some(
        e => e.field === "type"
    );

    if (!result.valid && hasTypeError) {
        console.log("✅ Test passed: Invalid connector type detected\n");
        return true;
    } else {
        console.log("❌ Test failed: Invalid connector type not detected\n");
        return false;
    }
}

/**
 * Test 5: Missing schemaVersion (should warn)
 */
function testMissingSchemaVersion() {
    console.log("Test 5: Missing schemaVersion (should warn)");
    console.log("=".repeat(50));

    const modules: Module[] = [
        {
            name: "no-schema-version",
            path: "/workspace/tools/no-schema.ts",
            type: "tool",
            language: "typescript",
            metadata: {
                name: "no-schema-version",
                description: "Tool without schemaVersion",
                version: "1.0.0",
            },
        },
    ];

    const result = validateModules(modules);
    console.log(formatValidationResults(result));

    const hasSchemaWarning = result.warnings.some(
        w => w.includes("Missing schemaVersion")
    );

    if (result.valid && hasSchemaWarning) {
        console.log("✅ Test passed: Missing schemaVersion warning generated\n");
        return true;
    } else {
        console.log("❌ Test failed: Missing schemaVersion warning not generated\n");
        return false;
    }
}

/**
 * Test 6: Unsupported schemaVersion (should error)
 */
function testUnsupportedSchemaVersion() {
    console.log("Test 6: Unsupported schemaVersion");
    console.log("=".repeat(50));

    const modules: Module[] = [
        {
            name: "future-schema",
            path: "/workspace/tools/future.ts",
            type: "tool",
            language: "typescript",
            metadata: {
                name: "future-schema",
                description: "Tool with unsupported schema version",
                version: "1.0.0",
                schemaVersion: "2.0",  // Not supported
            } as any,
        },
    ];

    const result = validateModules(modules);
    console.log(formatValidationResults(result));

    const hasSchemaError = result.errors.some(
        e => e.field === "schemaVersion" && e.message.includes("Unsupported")
    );

    if (!result.valid && hasSchemaError) {
        console.log("✅ Test passed: Unsupported schemaVersion detected\n");
        return true;
    } else {
        console.log("❌ Test failed: Unsupported schemaVersion not detected\n");
        return false;
    }
}

/**
 * Test 7: Invalid dependencies
 */
function testInvalidDependencies() {
    console.log("Test 7: Invalid dependencies");
    console.log("=".repeat(50));

    const modules: Module[] = [
        {
            name: "bad-deps",
            path: "/workspace/tools/bad-deps.ts",
            type: "tool",
            language: "typescript",
            metadata: {
                name: "bad-deps",
                description: "Tool with invalid dependencies",
                version: "1.0.0",
                dependencies: {
                    "Invalid Package Name!": "1.0.0",  // Invalid package name
                    "valid-package": "not-a-version",  // Invalid version
                },
            } as any,
        },
    ];

    const result = validateModules(modules);
    console.log(formatValidationResults(result));

    const hasDependencyWarnings = result.warnings.some(
        w => w.includes("Invalid npm package name") || w.includes("Invalid version range")
    );

    if (hasDependencyWarnings) {
        console.log("✅ Test passed: Invalid dependencies detected\n");
        return true;
    } else {
        console.log("❌ Test failed: Invalid dependencies not detected\n");
        return false;
    }
}

/**
 * Test 8: Valid module with all optional fields
 */
function testCompleteValidModule() {
    console.log("Test 8: Valid module with all optional fields");
    console.log("=".repeat(50));

    const modules: Module[] = [
        {
            name: "complete-tool",
            path: "/workspace/tools/complete.ts",
            type: "tool",
            language: "typescript",
            metadata: {
                name: "complete-tool",
                description: "Complete tool with all fields",
                version: "1.2.3",
                schemaVersion: "1.0",
                inputSchema: {
                    type: "object",
                    properties: {
                        input: { type: "string" },
                    },
                },
                capabilities: ["read", "write", "execute"],
                dependencies: {
                    "lodash": "^4.17.21",
                    "@types/node": "~20.0.0",
                },
            } as any,
        },
    ];

    const result = validateModules(modules);
    console.log(formatValidationResults(result));

    if (result.valid) {
        console.log("✅ Test passed: Complete valid module accepted\n");
        return true;
    } else {
        console.log("❌ Test failed: Valid module rejected\n");
        return false;
    }
}

// Run all tests
async function runAllTests() {
    const results = [
        await testValidModules(),
        testDuplicateNames(),
        testInvalidVersion(),
        testInvalidConnectorType(),
        testMissingSchemaVersion(),
        testUnsupportedSchemaVersion(),
        testInvalidDependencies(),
        testCompleteValidModule(),
    ];

    const passedTests = results.filter(r => r).length;
    const totalTests = results.length;

    console.log("=".repeat(50));
    console.log(`Test Summary: ${passedTests}/${totalTests} tests passed`);

    if (passedTests === totalTests) {
        console.log("✅ All tests passed!");
    } else {
        console.log(`❌ ${totalTests - passedTests} test(s) failed`);
    }
}

runAllTests().catch(console.error);
