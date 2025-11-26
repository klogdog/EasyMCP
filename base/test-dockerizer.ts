/**
 * Test Script for Dockerfile Generator
 * 
 * This script tests the Dockerfile generation functionality by:
 * 1. Testing module analysis
 * 2. Testing Dockerfile generation for different scenarios
 * 3. Testing Dockerfile validation
 * 4. Testing dockerignore generation
 * 5. Integration tests with actual modules
 */

import { loadModules, Module } from "./loader";
import { generateManifest, MCPManifest } from "./generator";
import {
    generateDockerfile,
    analyzeModules,
    validateDockerfile,
    generateDockerignore,
    saveDockerfile,
    DockerfileOptions,
} from "./dockerizer";
import * as fs from "fs/promises";

// Test counters
let passed = 0;
let failed = 0;

/**
 * Simple test assertion helper
 */
function assert(condition: boolean, message: string): void {
    if (condition) {
        console.log(`  ✅ ${message}`);
        passed++;
    } else {
        console.log(`  ❌ ${message}`);
        failed++;
    }
}

/**
 * Create a mock module for testing
 */
function createMockModule(
    name: string,
    type: "tool" | "connector",
    language: "typescript" | "python",
    basePath: string = "/workspace"
): Module {
    const dir = type === "tool" ? "tools" : "connectors";
    const ext = language === "typescript" ? ".ts" : ".py";

    return {
        name,
        path: `${basePath}/${dir}/${name}${ext}`,
        type,
        language,
        metadata: {
            name,
            description: `Test ${type}: ${name}`,
            version: "1.0.0",
            ...(type === "connector" ? { type: "test", methods: ["test"] } : {}),
        },
    };
}

/**
 * Create a mock manifest for testing
 */
function createMockManifest(
    tools: string[] = ["test-tool"],
    connectors: string[] = ["test-connector"]
): MCPManifest {
    return {
        name: "test-mcp-server",
        version: "1.0.0",
        tools: tools.map((name) => ({
            name,
            description: `Test tool: ${name}`,
            version: "1.0.0",
        })),
        connectors: connectors.map((name) => ({
            name,
            description: `Test connector: ${name}`,
            version: "1.0.0",
            type: "test",
            methods: ["test"],
        })),
        capabilities: ["test-capability"],
        dependencies: {
            express: "^4.18.0",
            cors: "^2.8.5",
        },
        metadata: {
            generatedAt: new Date().toISOString(),
            generatorVersion: "0.1.0",
            moduleCount: tools.length + connectors.length,
        },
    };
}

/**
 * Test 1: Module Analysis
 */
async function testModuleAnalysis(): Promise<void> {
    console.log("\nTest 1: Module Analysis");
    console.log("=".repeat(60));

    // Test TypeScript-only modules
    const tsModules: Module[] = [
        createMockModule("file-reader", "tool", "typescript"),
        createMockModule("email-connector", "connector", "typescript"),
    ];

    const tsAnalysis = analyzeModules(tsModules);
    assert(tsAnalysis.hasTypeScript === true, "Detects TypeScript modules");
    assert(tsAnalysis.hasPython === false, "No Python modules detected");
    assert(tsAnalysis.typescriptTools.length === 1, "Counts TypeScript tools correctly");
    assert(tsAnalysis.typescriptConnectors.length === 1, "Counts TypeScript connectors correctly");

    // Test Python-only modules
    const pyModules: Module[] = [
        createMockModule("calculator", "tool", "python"),
        createMockModule("database-connector", "connector", "python"),
    ];

    const pyAnalysis = analyzeModules(pyModules);
    assert(pyAnalysis.hasPython === true, "Detects Python modules");
    assert(pyAnalysis.hasTypeScript === false, "No TypeScript modules detected");
    assert(pyAnalysis.pythonTools.length === 1, "Counts Python tools correctly");
    assert(pyAnalysis.pythonConnectors.length === 1, "Counts Python connectors correctly");

    // Test mixed modules
    const mixedModules: Module[] = [
        createMockModule("file-reader", "tool", "typescript"),
        createMockModule("calculator", "tool", "python"),
        createMockModule("email-connector", "connector", "typescript"),
        createMockModule("database-connector", "connector", "python"),
    ];

    const mixedAnalysis = analyzeModules(mixedModules);
    assert(mixedAnalysis.hasTypeScript === true, "Mixed: Detects TypeScript");
    assert(mixedAnalysis.hasPython === true, "Mixed: Detects Python");
    assert(mixedAnalysis.typescriptTools.length === 1, "Mixed: TypeScript tools count");
    assert(mixedAnalysis.pythonTools.length === 1, "Mixed: Python tools count");

    // Test empty modules
    const emptyAnalysis = analyzeModules([]);
    assert(emptyAnalysis.hasTypeScript === false, "Empty: No TypeScript");
    assert(emptyAnalysis.hasPython === false, "Empty: No Python");
}

/**
 * Test 2: Node.js-only Dockerfile Generation
 */
async function testNodeOnlyDockerfile(): Promise<void> {
    console.log("\nTest 2: Node.js-only Dockerfile Generation");
    console.log("=".repeat(60));

    const modules: Module[] = [
        createMockModule("file-reader", "tool", "typescript"),
        createMockModule("email-connector", "connector", "typescript"),
    ];

    const manifest = createMockManifest(["file-reader"], ["email-connector"]);

    const dockerfile = await generateDockerfile(
        manifest,
        "config/development.yaml",
        modules
    );

    // Check for Node.js base image
    assert(dockerfile.includes("node:20-alpine"), "Uses node:20-alpine base image");

    // Check for working directory
    assert(dockerfile.includes("WORKDIR /app"), "Sets /app as working directory");

    // Check for directory structure
    assert(dockerfile.includes("mkdir -p /app/tools /app/connectors /app/config"), "Creates directory structure");

    // Check for npm install
    assert(dockerfile.includes("npm install"), "Includes npm install");

    // Check for COPY instructions
    assert(dockerfile.includes("COPY tools/"), "Copies tools directory");
    assert(dockerfile.includes("COPY connectors/"), "Copies connectors directory");
    assert(dockerfile.includes("COPY mcp-manifest.json"), "Copies manifest");
    assert(dockerfile.includes("COPY config/development.yaml"), "Copies config file");

    // Check for environment variables
    assert(dockerfile.includes('ENV NODE_ENV="production"'), "Sets NODE_ENV");
    assert(dockerfile.includes("MCP_CONFIG_PATH"), "Sets MCP_CONFIG_PATH");

    // Check for entrypoint
    assert(dockerfile.includes('ENTRYPOINT ["node", "server.js"]'), "Sets correct entrypoint");

    // Check for health check
    assert(dockerfile.includes("HEALTHCHECK"), "Includes health check");

    // Check for labels
    assert(dockerfile.includes("org.opencontainers.image.title"), "Includes OCI labels");
    assert(dockerfile.includes("mcp.server.tools"), "Includes MCP tool labels");

    // Check header
    assert(dockerfile.includes("# MCP Server Dockerfile - Node.js Only"), "Has correct header");
}

/**
 * Test 3: Python-only Dockerfile Generation
 */
async function testPythonOnlyDockerfile(): Promise<void> {
    console.log("\nTest 3: Python-only Dockerfile Generation");
    console.log("=".repeat(60));

    const modules: Module[] = [
        createMockModule("calculator", "tool", "python"),
        createMockModule("database-connector", "connector", "python"),
    ];

    const manifest = createMockManifest(["calculator"], ["database-connector"]);
    manifest.dependencies = {}; // No npm dependencies for Python-only

    const dockerfile = await generateDockerfile(
        manifest,
        "config/production.yaml",
        modules
    );

    // Check for Python base image
    assert(dockerfile.includes("python:3.11-slim"), "Uses python:3.11-slim base image");

    // Check for working directory
    assert(dockerfile.includes("WORKDIR /app"), "Sets /app as working directory");

    // Check for Python environment variables
    assert(dockerfile.includes("PYTHONUNBUFFERED"), "Sets PYTHONUNBUFFERED");
    assert(dockerfile.includes("PYTHONDONTWRITEBYTECODE"), "Sets PYTHONDONTWRITEBYTECODE");

    // Check for Python entrypoint
    assert(dockerfile.includes('ENTRYPOINT ["python", "server.py"]'), "Sets Python entrypoint");

    // Check for pip install (or no pip if no deps)
    const hasPipOrNoDeps = dockerfile.includes("pip install") || !dockerfile.includes("requirements.txt");
    assert(hasPipOrNoDeps, "Handles Python dependencies");

    // Check header
    assert(dockerfile.includes("# MCP Server Dockerfile - Python Only"), "Has correct header");
}

/**
 * Test 4: Multi-stage Dockerfile Generation
 */
async function testMultiStageDockerfile(): Promise<void> {
    console.log("\nTest 4: Multi-stage Dockerfile Generation");
    console.log("=".repeat(60));

    const modules: Module[] = [
        createMockModule("file-reader", "tool", "typescript"),
        createMockModule("calculator", "tool", "python"),
        createMockModule("email-connector", "connector", "typescript"),
        createMockModule("database-connector", "connector", "python"),
    ];

    const manifest = createMockManifest(
        ["file-reader", "calculator"],
        ["email-connector", "database-connector"]
    );

    const dockerfile = await generateDockerfile(
        manifest,
        "config/development.yaml",
        modules
    );

    // Check for multi-stage header
    assert(dockerfile.includes("# MCP Server Dockerfile - Multi-stage"), "Has multi-stage header");

    // Check for Node.js builder stage
    assert(dockerfile.includes("AS node-builder"), "Has node-builder stage");
    assert(dockerfile.includes("node:20-alpine AS node-builder"), "Uses node:20-alpine for node builder");

    // Check for Python builder stage
    assert(dockerfile.includes("AS python-builder"), "Has python-builder stage");
    assert(dockerfile.includes("python:3.11-slim AS python-builder"), "Uses python:3.11-slim for python builder");

    // Check for runtime stage
    assert(dockerfile.includes("AS runtime"), "Has runtime stage");

    // Check for cross-stage copies
    assert(dockerfile.includes("COPY --from=node-builder"), "Copies from node-builder stage");
    assert(dockerfile.includes("COPY --from=python-builder"), "Copies from python-builder stage");

    // Check for Python installation in Node image
    assert(dockerfile.includes("apk add --no-cache python3"), "Installs Python in runtime");

    // Check for both language env vars
    assert(dockerfile.includes("NODE_ENV"), "Sets NODE_ENV in multi-stage");
    assert(dockerfile.includes("PYTHONPATH"), "Sets PYTHONPATH in multi-stage");
}

/**
 * Test 5: Custom Options
 */
async function testCustomOptions(): Promise<void> {
    console.log("\nTest 5: Custom Options");
    console.log("=".repeat(60));

    const modules: Module[] = [
        createMockModule("test-tool", "tool", "typescript"),
    ];

    const manifest = createMockManifest(["test-tool"], []);

    const options: DockerfileOptions = {
        nodeBaseImage: "node:18-bullseye",
        workDir: "/custom/app",
        environmentVariables: {
            CUSTOM_VAR: "custom_value",
            API_KEY: "secret",
        },
        labels: {
            "custom.label": "custom-value",
            "maintainer": "test@example.com",
        },
        includeHealthCheck: false,
        additionalNpmPackages: ["lodash", "axios@1.0.0"],
    };

    const dockerfile = await generateDockerfile(
        manifest,
        "config/custom.yaml",
        modules,
        options
    );

    // Check custom base image
    assert(dockerfile.includes("node:18-bullseye"), "Uses custom base image");

    // Check custom working directory
    assert(dockerfile.includes("WORKDIR /custom/app"), "Uses custom working directory");

    // Check custom environment variables
    assert(dockerfile.includes('CUSTOM_VAR="custom_value"'), "Includes custom env var");
    assert(dockerfile.includes('API_KEY="secret"'), "Includes API_KEY env var");

    // Check custom labels
    assert(dockerfile.includes('custom.label="custom-value"'), "Includes custom label");
    assert(dockerfile.includes('maintainer="test@example.com"'), "Includes maintainer label");

    // Check health check is disabled
    assert(!dockerfile.includes("HEALTHCHECK"), "Health check is disabled");

    // Check additional npm packages
    assert(dockerfile.includes("lodash"), "Includes additional npm package lodash");
    assert(dockerfile.includes("axios@1.0.0"), "Includes additional npm package with version");
}

/**
 * Test 6: Dockerfile Validation
 */
async function testDockerfileValidation(): Promise<void> {
    console.log("\nTest 6: Dockerfile Validation");
    console.log("=".repeat(60));

    // Valid Dockerfile
    const validDockerfile = `
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
ENTRYPOINT ["node", "server.js"]
`;

    const validResult = validateDockerfile(validDockerfile);
    assert(validResult.valid === true, "Valid Dockerfile passes validation");
    assert(validResult.errors.length === 0, "No errors in valid Dockerfile");

    // Missing FROM
    const noFromDockerfile = `
WORKDIR /app
COPY package.json ./
ENTRYPOINT ["node", "server.js"]
`;

    const noFromResult = validateDockerfile(noFromDockerfile);
    assert(noFromResult.valid === false, "Missing FROM is invalid");
    assert(noFromResult.errors.some(e => e.includes("FROM")), "Error mentions missing FROM");

    // Missing ENTRYPOINT/CMD
    const noEntrypointDockerfile = `
FROM node:20-alpine
WORKDIR /app
COPY . .
`;

    const noEntrypointResult = validateDockerfile(noEntrypointDockerfile);
    assert(noEntrypointResult.valid === false, "Missing ENTRYPOINT/CMD is invalid");
    assert(
        noEntrypointResult.errors.some(e => e.includes("ENTRYPOINT") || e.includes("CMD")),
        "Error mentions missing ENTRYPOINT or CMD"
    );

    // Warning for apt-get without -y
    const aptWarningDockerfile = `
FROM ubuntu:22.04
WORKDIR /app
RUN apt-get install python3
ENTRYPOINT ["python3", "app.py"]
`;

    const aptWarningResult = validateDockerfile(aptWarningDockerfile);
    assert(
        aptWarningResult.warnings.some(w => w.includes("apt-get") || w.includes("-y")),
        "Warning for apt-get without -y"
    );
}

/**
 * Test 7: Dockerignore Generation
 */
async function testDockerignore(): Promise<void> {
    console.log("\nTest 7: Dockerignore Generation");
    console.log("=".repeat(60));

    const dockerignore = generateDockerignore();

    // Check common patterns
    assert(dockerignore.includes("node_modules"), "Ignores node_modules");
    assert(dockerignore.includes(".git"), "Ignores .git");
    assert(dockerignore.includes("__pycache__"), "Ignores __pycache__");
    assert(dockerignore.includes(".venv"), "Ignores .venv");
    assert(dockerignore.includes(".vscode"), "Ignores .vscode");
    assert(dockerignore.includes("dist"), "Ignores dist");
    assert(dockerignore.includes("test-*.ts"), "Ignores test files");
    assert(dockerignore.includes("ActionPlan"), "Ignores ActionPlan");
    assert(dockerignore.includes("Dockerfile*"), "Ignores Dockerfile");
    assert(dockerignore.includes("*.md"), "Ignores markdown files");
}

/**
 * Test 8: Integration Test with Real Modules
 */
async function testIntegration(): Promise<void> {
    console.log("\nTest 8: Integration Test with Real Modules");
    console.log("=".repeat(60));

    try {
        // Load actual modules from the workspace
        const modules = await loadModules(process.cwd());
        assert(modules.length > 0, "Loaded modules from workspace");

        // Generate manifest
        const manifest = await generateManifest(modules);
        assert(manifest.tools.length > 0, "Manifest has tools");

        // Generate Dockerfile
        const dockerfile = await generateDockerfile(
            manifest,
            "config/development.yaml",
            modules
        );

        // Validate generated Dockerfile
        const validation = validateDockerfile(dockerfile);
        assert(validation.valid, "Generated Dockerfile is valid");

        if (validation.warnings.length > 0) {
            console.log(`  ⚠️  ${validation.warnings.length} warning(s) in generated Dockerfile`);
        }

        // Analyze modules
        const analysis = analyzeModules(modules);
        console.log(`  📊 Module Analysis:`);
        console.log(`     - TypeScript: ${analysis.hasTypeScript}`);
        console.log(`     - Python: ${analysis.hasPython}`);
        console.log(`     - TS Tools: ${analysis.typescriptTools.length}`);
        console.log(`     - PY Tools: ${analysis.pythonTools.length}`);
        console.log(`     - TS Connectors: ${analysis.typescriptConnectors.length}`);
        console.log(`     - PY Connectors: ${analysis.pythonConnectors.length}`);

        // Determine expected Dockerfile type
        if (analysis.hasTypeScript && analysis.hasPython) {
            assert(dockerfile.includes("Multi-stage"), "Integration uses multi-stage for mixed modules");
        } else if (analysis.hasPython) {
            assert(dockerfile.includes("Python Only"), "Integration uses Python-only for Python modules");
        } else {
            assert(dockerfile.includes("Node.js Only"), "Integration uses Node.js-only for TS modules");
        }

    } catch (error) {
        console.log(`  ❌ Integration test failed: ${error}`);
        failed++;
    }
}

/**
 * Test 9: Save Dockerfile
 */
async function testSaveDockerfile(): Promise<void> {
    console.log("\nTest 9: Save Dockerfile");
    console.log("=".repeat(60));

    const testDockerfile = `FROM node:20-alpine
WORKDIR /app
ENTRYPOINT ["node", "server.js"]
`;

    const testPath = "/tmp/test-dockerfile";

    try {
        await saveDockerfile(testDockerfile, testPath);

        // Verify file was created
        const content = await fs.readFile(testPath, "utf-8");
        assert(content === testDockerfile, "Dockerfile saved correctly");

        // Cleanup
        await fs.unlink(testPath);
        assert(true, "Cleanup successful");
    } catch (error) {
        console.log(`  ❌ Save test failed: ${error}`);
        failed++;
    }
}

/**
 * Test 10: Edge Cases
 */
async function testEdgeCases(): Promise<void> {
    console.log("\nTest 10: Edge Cases");
    console.log("=".repeat(60));

    // Empty modules array
    const emptyManifest = createMockManifest([], []);
    const dockerfileEmpty = await generateDockerfile(
        emptyManifest,
        "config/default.yaml",
        []
    );

    const emptyValidation = validateDockerfile(dockerfileEmpty);
    assert(emptyValidation.valid, "Empty modules generates valid Dockerfile");

    // Manifest with special characters in names
    const specialManifest: MCPManifest = {
        name: "mcp-server-with-special_chars.v2",
        version: "1.0.0-beta.1",
        tools: [{
            name: "tool-with-dashes_and_underscores",
            description: "Tool with \"quotes\" and 'apostrophes'",
            version: "1.0.0",
        }],
        connectors: [],
        capabilities: ["cap-1", "cap_2"],
        dependencies: {
            "@scope/package": "^1.0.0",
        },
        metadata: {
            generatedAt: new Date().toISOString(),
            generatorVersion: "0.1.0",
            moduleCount: 1,
        },
    };

    const specialDockerfile = await generateDockerfile(
        specialManifest,
        "config/test.yaml"
    );

    assert(
        specialDockerfile.includes("@scope/package"),
        "Handles scoped npm packages"
    );

    // Config with subdirectory path
    const subdirDockerfile = await generateDockerfile(
        createMockManifest(),
        "deep/nested/config/app.yaml"
    );

    assert(
        subdirDockerfile.includes("deep/nested/config/app.yaml"),
        "Handles nested config paths"
    );
}

/**
 * Run all tests
 */
async function runTests(): Promise<void> {
    console.log("Testing Dockerfile Generator (dockerizer.ts)");
    console.log("=".repeat(60));
    console.log();

    try {
        await testModuleAnalysis();
        await testNodeOnlyDockerfile();
        await testPythonOnlyDockerfile();
        await testMultiStageDockerfile();
        await testCustomOptions();
        await testDockerfileValidation();
        await testDockerignore();
        await testIntegration();
        await testSaveDockerfile();
        await testEdgeCases();

        // Summary
        console.log("\n" + "=".repeat(60));
        console.log("Test Summary");
        console.log("=".repeat(60));
        console.log(`  Total: ${passed + failed}`);
        console.log(`  ✅ Passed: ${passed}`);
        console.log(`  ❌ Failed: ${failed}`);
        console.log();

        if (failed > 0) {
            console.log("❌ Some tests failed!");
            process.exit(1);
        } else {
            console.log("✅ All tests passed!");
        }

    } catch (error) {
        console.error("Fatal error running tests:", error);
        process.exit(1);
    }
}

// Run tests
runTests();
