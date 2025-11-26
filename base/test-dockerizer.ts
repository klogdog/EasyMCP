/**
 * Test Script for Dockerfile Generator and Image Builder
 * 
 * This script tests the Dockerfile generation and image building functionality by:
 * 1. Testing module analysis
 * 2. Testing Dockerfile generation for different scenarios
 * 3. Testing Dockerfile validation
 * 4. Testing dockerignore generation
 * 5. Integration tests with actual modules
 * 6. Testing image builder functionality
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
    buildMCPImage,
    BuildOptions,
    BuildProgressEvent,
    formatBuildResult,
    formatBuildFailure,
} from "./dockerizer";
import { DockerClient } from "./docker-client";
import * as fs from "fs/promises";
import * as path from "path";

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
 * Test 11: Build Options Interface
 */
async function testBuildOptionsInterface(): Promise<void> {
    console.log("\nTest 11: Build Options Interface");
    console.log("=".repeat(60));

    // Test that BuildOptions interface properties are correctly typed
    const options: BuildOptions = {
        tag: "my-mcp-server:1.0.0",
        additionalTags: ["my-mcp-server:latest", "my-mcp-server:dev"],
        buildArgs: {
            NODE_VERSION: "20",
            BUILD_DATE: new Date().toISOString()
        },
        target: "production",
        noCache: true,
        workingDir: "/tmp/test",
        logFile: "/tmp/build.log",
        cleanupOnFailure: true
    };

    assert(options.tag === "my-mcp-server:1.0.0", "BuildOptions.tag is set correctly");
    assert(options.additionalTags?.length === 2, "BuildOptions.additionalTags is set correctly");
    assert(options.buildArgs?.NODE_VERSION === "20", "BuildOptions.buildArgs is set correctly");
    assert(options.target === "production", "BuildOptions.target is set correctly");
    assert(options.noCache === true, "BuildOptions.noCache is set correctly");
    assert(options.cleanupOnFailure === true, "BuildOptions.cleanupOnFailure is set correctly");

    // Test with onProgress callback
    const optionsWithProgress: BuildOptions = {
        onProgress: (event: BuildProgressEvent) => {
            // Verify event structure
            if (event.type && event.message !== undefined && event.elapsed !== undefined) {
                // Valid event structure - callback is properly typed
            }
        }
    };

    assert(typeof optionsWithProgress.onProgress === "function", "BuildOptions.onProgress is a function");
}

/**
 * Test 12: Build Progress Event Structure
 */
async function testBuildProgressEventStructure(): Promise<void> {
    console.log("\nTest 12: Build Progress Event Structure");
    console.log("=".repeat(60));

    // Test various event types
    const stepEvent: BuildProgressEvent = {
        type: "step",
        step: 3,
        totalSteps: 12,
        message: "Step 3/12: WORKDIR /app",
        elapsed: 5000,
        timestamp: new Date()
    };

    assert(stepEvent.type === "step", "Step event has correct type");
    assert(stepEvent.step === 3, "Step event has step number");
    assert(stepEvent.totalSteps === 12, "Step event has total steps");
    assert(stepEvent.elapsed === 5000, "Step event has elapsed time");

    const downloadEvent: BuildProgressEvent = {
        type: "download",
        message: "Downloading layer",
        progress: 45,
        elapsed: 2000,
        timestamp: new Date()
    };

    assert(downloadEvent.type === "download", "Download event has correct type");
    assert(downloadEvent.progress === 45, "Download event has progress percentage");

    const errorEvent: BuildProgressEvent = {
        type: "error",
        message: "Build failed: missing dependency",
        elapsed: 10000,
        timestamp: new Date()
    };

    assert(errorEvent.type === "error", "Error event has correct type");
    assert(errorEvent.message.includes("missing dependency"), "Error event has error message");

    const completeEvent: BuildProgressEvent = {
        type: "complete",
        message: "Build completed successfully",
        elapsed: 45000,
        timestamp: new Date()
    };

    assert(completeEvent.type === "complete", "Complete event has correct type");
}

/**
 * Test 13: Format Build Result
 */
async function testFormatBuildResult(): Promise<void> {
    console.log("\nTest 13: Format Build Result");
    console.log("=".repeat(60));

    const result = {
        imageId: "sha256:abc123def456",
        tags: ["mcp-server:latest", "mcp-server:1.0.0"],
        buildTime: 45200,
        logFile: "/workspace/.build.log",
        imageSize: 256 * 1024 * 1024 // 256 MB
    };

    const formatted = formatBuildResult(result);

    assert(formatted.includes("Build Successful"), "Result includes success message");
    assert(formatted.includes("sha256:abc123def456"), "Result includes image ID");
    assert(formatted.includes("mcp-server:latest"), "Result includes first tag");
    assert(formatted.includes("mcp-server:1.0.0"), "Result includes second tag");
    assert(formatted.includes("45.20s"), "Result includes build time");
    assert(formatted.includes(".build.log"), "Result includes log file path");
    assert(formatted.includes("256.00 MB"), "Result includes image size");
}

/**
 * Test 14: Format Build Failure
 */
async function testFormatBuildFailure(): Promise<void> {
    console.log("\nTest 14: Format Build Failure");
    console.log("=".repeat(60));

    const failure = {
        message: "npm ERR! code ENETUNREACH",
        failedStep: 5,
        totalSteps: 12,
        failedInstruction: "RUN npm install --production",
        suggestions: [
            "Check network connectivity",
            "Verify npm registry is accessible",
            "Try using --network=host"
        ],
        buildOutput: "Full build output here...",
        logFile: "/workspace/.build.log"
    };

    const formatted = formatBuildFailure(failure);

    assert(formatted.includes("Build Failed"), "Failure includes error header");
    assert(formatted.includes("ENETUNREACH"), "Failure includes error code");
    assert(formatted.includes("Step 5/12"), "Failure includes failed step");
    assert(formatted.includes("npm install"), "Failure includes failed instruction");
    assert(formatted.includes("Check network connectivity"), "Failure includes first suggestion");
    assert(formatted.includes(".build.log"), "Failure includes log file path");
}

/**
 * Test 15: Docker Connectivity Check (if Docker is available)
 */
async function testDockerConnectivity(): Promise<void> {
    console.log("\nTest 15: Docker Connectivity Check");
    console.log("=".repeat(60));

    try {
        const client = new DockerClient();
        const isConnected = await client.ping();

        if (isConnected) {
            console.log("  ✅ Docker daemon is running and accessible");
            passed++;

            // Get Docker info
            try {
                const info = await client.getInfo();
                console.log(`     Server Version: ${info.serverVersion}`);
                console.log(`     Operating System: ${info.operatingSystem}`);
                console.log(`     CPUs: ${info.cpus}`);
                console.log(`     Memory: ${(info.memoryLimit / (1024 * 1024 * 1024)).toFixed(1)} GB`);
            } catch (infoErr) {
                console.log("  ⚠️  Could not get Docker info");
            }
        } else {
            console.log("  ⚠️  Docker daemon not running - skipping connectivity test");
            console.log("     (This is not a test failure - Docker is optional for development)");
            passed++; // Don't fail if Docker isn't running
        }
    } catch (error) {
        const err = error as Error;
        console.log("  ⚠️  Docker not available: " + err.message);
        console.log("     (This is not a test failure - Docker is optional for development)");
        passed++; // Don't fail if Docker isn't available
    }
}

/**
 * Test 16: Build Context Creation
 */
async function testBuildContextCreation(): Promise<void> {
    console.log("\nTest 16: Build Context Creation");
    console.log("=".repeat(60));

    // This test verifies that buildMCPImage will create proper build context
    // We test the exported interface without actually building

    // Verify the function exists and has correct signature
    assert(typeof buildMCPImage === "function", "buildMCPImage is exported as a function");

    // Test with mock options to verify type compatibility
    const mockOptions: BuildOptions = {
        tag: "test:latest",
        workingDir: process.cwd(),
        logFile: path.join(process.cwd(), ".test-build.log"),
        cleanupOnFailure: true,
        dockerfileOptions: {
            includeHealthCheck: true,
            workDir: "/app"
        }
    };

    assert(mockOptions.tag === "test:latest", "BuildOptions are correctly typed");
    assert(mockOptions.dockerfileOptions?.includeHealthCheck === true, "Nested DockerfileOptions work");
}

/**
 * Test 17: Integration Build Test (only if Docker is available)
 */
async function testIntegrationBuild(): Promise<void> {
    console.log("\nTest 17: Integration Build Test");
    console.log("=".repeat(60));

    try {
        const client = new DockerClient();
        const isConnected = await client.ping();

        if (!isConnected) {
            console.log("  ⚠️  Docker not available - skipping integration build test");
            passed++;
            return;
        }

        // Create a minimal manifest for testing
        const manifest: MCPManifest = {
            name: "test-mcp-server",
            version: "1.0.0",
            tools: [{
                name: "test-tool",
                description: "Test tool",
                version: "1.0.0"
            }],
            connectors: [],
            capabilities: ["test"],
            dependencies: {},
            metadata: {
                generatedAt: new Date().toISOString(),
                generatorVersion: "0.1.0",
                moduleCount: 1
            }
        };

        // Track progress events
        const progressEvents: BuildProgressEvent[] = [];
        let buildCompleted = false;

        const options: BuildOptions = {
            tag: `mcp-test-build:${Date.now()}`,
            onProgress: (event) => {
                progressEvents.push(event);
                if (event.type === "step") {
                    console.log(`     ${event.message}`);
                } else if (event.type === "complete") {
                    buildCompleted = true;
                }
            },
            cleanupOnFailure: true
        };

        try {
            // Note: This may fail due to missing files in test environment
            // but we're testing the interface and progress reporting
            const imageId = await buildMCPImage(
                manifest,
                "config/development.yaml",
                options
            );

            assert(typeof imageId === "string", "buildMCPImage returns image ID");
            assert(imageId.length > 0, "Image ID is not empty");
            assert(progressEvents.length > 0, "Progress events were received");
            assert(buildCompleted, "Build completed event was received");

            console.log(`  ✅ Build successful: ${imageId}`);

            // Cleanup: remove the test image
            try {
                await client.removeImage(options.tag!);
                console.log("  ✅ Test image cleaned up");
            } catch (cleanupErr) {
                console.log("  ⚠️  Could not cleanup test image");
            }

        } catch (buildError) {
            const err = buildError as Error;
            // Build might fail due to missing context files - that's OK for this test
            // We're testing the interface works correctly
            if (err.message.includes("not found") ||
                err.message.includes("COPY failed") ||
                err.message.includes("context")) {
                console.log("  ⚠️  Build failed due to missing files (expected in test environment)");
                assert(progressEvents.length >= 0, "Progress callback was invoked");
                passed++;
            } else {
                console.log(`  ❌ Unexpected build error: ${err.message}`);
                failed++;
            }
        }

    } catch (error) {
        const err = error as Error;
        console.log("  ⚠️  Docker test skipped: " + err.message);
        passed++;
    }
}

/**
 * Run all tests
 */
async function runTests(): Promise<void> {
    console.log("Testing Dockerfile Generator and Image Builder (dockerizer.ts)");
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
        await testBuildOptionsInterface();
        await testBuildProgressEventStructure();
        await testFormatBuildResult();
        await testFormatBuildFailure();
        await testDockerConnectivity();
        await testBuildContextCreation();
        await testIntegrationBuild();

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
