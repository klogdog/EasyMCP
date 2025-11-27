/**
 * End-to-End Example Test for MCP Generator
 * 
 * This test file demonstrates best practices for testing the complete MCP
 * generator workflow. It serves as a template for creating custom tests
 * for specific use cases.
 * 
 * OVERVIEW:
 * ---------
 * This E2E test simulates the complete lifecycle of an MCP server:
 * 1. Setting up a test workspace with sample tools and connectors
 * 2. Loading and validating modules
 * 3. Generating the MCP manifest
 * 4. Creating configuration
 * 5. Generating the Dockerfile
 * 6. Simulating Docker build and container operations
 * 7. Cleaning up test resources
 * 
 * BEST PRACTICES DEMONSTRATED:
 * ----------------------------
 * - Isolation: Each test creates its own temporary workspace
 * - Cleanup: Always clean up resources in afterAll/afterEach
 * - Mocking: Use mocks for external services (Docker, APIs)
 * - Assertions: Validate each step of the workflow
 * - Documentation: Clear comments explaining what each step does
 * - Error Handling: Test both success and failure paths
 * 
 * @module __tests__/integration/e2e-example
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import * as path from 'path';
import * as fs from 'fs/promises';

// ============================================================================
// Import Core Modules
// These are the main components of the MCP generator system
// ============================================================================

import { loadModules } from '../../loader';
import { generateManifest, saveManifest, validateManifest, MCPManifest } from '../../generator';
import { parseConfigString } from '../../config-parser';
import { generateDockerfile, analyzeModules } from '../../dockerizer';

// ============================================================================
// Import Test Utilities
// Mocks and helpers for testing without real Docker/external services
// ============================================================================

import { createMockDockerClient } from '../utils/mock-docker-client';
import { createTestEnv } from '../utils';

// ============================================================================
// Test Configuration
// Extend timeout for E2E tests which may take longer than unit tests
// ============================================================================

jest.setTimeout(60000); // 60 second timeout for E2E tests

/**
 * Complete End-to-End Test Suite
 * 
 * This suite demonstrates a full workflow from tool creation to server deployment.
 * It uses mocked Docker operations to avoid requiring a real Docker daemon.
 */
describe('E2E Example: Complete MCP Server Workflow', () => {
    // ========================================================================
    // Test Workspace Setup
    // We create a temporary directory structure that mimics a real project
    // ========================================================================

    let testWorkspace: string;
    let toolsDir: string;
    let connectorsDir: string;
    let outputDir: string;

    /**
     * Create the test workspace before all tests run
     * 
     * This sets up the directory structure and sample files that the
     * MCP generator will process. In a real project, these would be
     * the actual tool and connector implementations.
     */
    beforeAll(async () => {
        // Create unique temporary directory for this test run
        testWorkspace = path.join(
            __dirname,
            'temp-e2e-test-' + Date.now()
        );

        toolsDir = path.join(testWorkspace, 'tools');
        connectorsDir = path.join(testWorkspace, 'connectors');
        outputDir = path.join(testWorkspace, 'output');

        await fs.mkdir(toolsDir, { recursive: true });
        await fs.mkdir(connectorsDir, { recursive: true });
        await fs.mkdir(outputDir, { recursive: true });

        // ====================================================================
        // Create Sample Tools
        // These represent the tools that would be part of the MCP server
        // ====================================================================

        // Summarize Tool - A text processing tool
        const summarizeTool = `
/**
 * Summarize Tool
 * 
 * Takes text input and produces a shorter summary.
 * This is a sample tool demonstrating the metadata format.
 */

export const metadata = {
    "name": "summarize",
    "description": "Summarizes text content to a specified length",
    "version": "1.0.0",
    "capabilities": ["text-processing", "summarization"],
    "inputSchema": {
        "type": "object",
        "properties": {
            "text": { "type": "string", "description": "Text to summarize" },
            "maxLength": { "type": "number", "description": "Maximum summary length" }
        },
        "required": ["text"]
    }
};

/**
 * Main tool function
 */
export async function summarize(text: string, maxLength: number = 100): Promise<string> {
    if (text.length <= maxLength) {
        return text;
    }
    // Simple summarization - in real implementation, use NLP
    return text.substring(0, maxLength - 3) + '...';
}

export default summarize;
`;
        await fs.writeFile(path.join(toolsDir, 'summarize.ts'), summarizeTool);

        // Translate Tool - A language translation tool
        const translateTool = `
/**
 * Translate Tool
 * 
 * Translates text between languages.
 */

export const metadata = {
    "name": "translate",
    "description": "Translates text from one language to another",
    "version": "1.0.0",
    "capabilities": ["text-processing", "translation", "i18n"],
    "inputSchema": {
        "type": "object",
        "properties": {
            "text": { "type": "string" },
            "targetLang": { "type": "string" },
            "sourceLang": { "type": "string" }
        },
        "required": ["text", "targetLang"]
    }
};

export async function translate(
    text: string,
    targetLang: string,
    sourceLang: string = 'auto'
): Promise<string> {
    // Mock translation for demo purposes
    return \`[Translated to \${targetLang}]: \${text}\`;
}

export default translate;
`;
        await fs.writeFile(path.join(toolsDir, 'translate.ts'), translateTool);

        // ====================================================================
        // Create Sample Connector
        // Connectors provide integration with external services
        // ====================================================================

        // Mock Notion Connector - Demonstrates connector metadata format
        const notionConnector = `
/**
 * Notion Connector (Mock)
 * 
 * Provides integration with Notion API for workspace management.
 * This is a mock implementation for testing purposes.
 */

export const metadata = {
    "name": "notion-connector",
    "description": "Connects to Notion API for reading and writing pages",
    "version": "1.0.0",
    "type": "api",
    "methods": ["getPage", "createPage", "updatePage", "search"]
};

/**
 * Notion API Client mock
 */
export class NotionConnector {
    private apiKey: string;
    
    constructor() {
        this.apiKey = process.env.NOTION_API_KEY || '';
    }
    
    async getPage(pageId: string) {
        return { id: pageId, title: 'Mock Page', content: '...' };
    }
    
    async createPage(title: string, content: string) {
        return { id: 'new-page-id', title, content };
    }
    
    async search(query: string) {
        return [{ id: 'result-1', title: \`Result for: \${query}\` }];
    }
}

export default NotionConnector;
`;
        await fs.writeFile(
            path.join(connectorsDir, 'notion-connector.ts'),
            notionConnector
        );
    });

    /**
     * Clean up the test workspace after all tests complete
     * 
     * IMPORTANT: Always clean up temporary resources to avoid
     * disk space issues and test pollution.
     */
    afterAll(async () => {
        await fs.rm(testWorkspace, { recursive: true, force: true });
    });

    // ========================================================================
    // Test Cases
    // ========================================================================

    describe('Step 1: Module Discovery', () => {
        /**
         * Verify that the loader correctly discovers all modules
         * in the workspace's tools and connectors directories.
         */
        it('should discover all tools and connectors in the workspace', async () => {
            // ARRANGE: Workspace is already set up in beforeAll

            // ACT: Load all modules from the workspace
            const modules = await loadModules(testWorkspace);

            // ASSERT: Verify all expected modules were found
            expect(modules).toHaveLength(3);

            // Check for each expected tool
            const toolNames = modules
                .filter(m => m.type === 'tool')
                .map(m => m.name);
            expect(toolNames).toContain('summarize');
            expect(toolNames).toContain('translate');

            // Check for connectors
            const connectorNames = modules
                .filter(m => m.type === 'connector')
                .map(m => m.name);
            expect(connectorNames).toContain('notion-connector');

            // Verify all modules are TypeScript
            modules.forEach(m => {
                expect(m.language).toBe('typescript');
            });
        });

        /**
         * Verify that module metadata is correctly extracted
         */
        it('should extract correct metadata from modules', async () => {
            const modules = await loadModules(testWorkspace);

            // Find the summarize tool
            const summarizeTool = modules.find(m => m.name === 'summarize');
            expect(summarizeTool).toBeDefined();

            // Verify metadata fields
            expect(summarizeTool!.metadata.description).toContain('Summarizes');
            expect(summarizeTool!.metadata.version).toBe('1.0.0');
        });
    });

    describe('Step 2: Manifest Generation', () => {
        /**
         * Generate and validate the MCP server manifest
         */
        it('should generate a valid manifest from discovered modules', async () => {
            // ARRANGE: Load modules
            const modules = await loadModules(testWorkspace);

            // ACT: Generate manifest
            const manifest = await generateManifest(modules);

            // ASSERT: Verify manifest structure
            expect(manifest.name).toBe('mcp-server');
            expect(manifest.tools).toHaveLength(2);
            expect(manifest.connectors).toHaveLength(1);

            // Verify capabilities were aggregated from tools
            // Note: The generator adds capabilities from tools and 
            // infers capability from connector type (e.g., "api-integration" for type="api")
            expect(manifest.capabilities.length).toBeGreaterThan(0);
            // The connector has type="api", so generator adds "api-integration"
            expect(manifest.capabilities).toContain('api-integration');            // Verify metadata
            expect(manifest.metadata.moduleCount).toBe(3);
            expect(manifest.metadata.generatedAt).toBeDefined();
        });

        /**
         * Verify manifest validation works correctly
         */
        it('should pass validation for generated manifest', async () => {
            const modules = await loadModules(testWorkspace);
            const manifest = await generateManifest(modules);

            // ACT: Validate the manifest
            const isValid = validateManifest(manifest);

            // ASSERT: Manifest should be valid
            expect(isValid).toBe(true);
        });

        /**
         * Save and verify the manifest can be serialized correctly
         */
        it('should save manifest to file in valid JSON format', async () => {
            const modules = await loadModules(testWorkspace);
            const manifest = await generateManifest(modules);
            const manifestPath = path.join(outputDir, 'mcp-manifest.json');

            // ACT: Save manifest
            await saveManifest(manifest, manifestPath);

            // ASSERT: File exists and contains valid JSON
            const content = await fs.readFile(manifestPath, 'utf-8');
            const parsed = JSON.parse(content) as MCPManifest;

            expect(parsed.name).toBe(manifest.name);
            expect(parsed.tools).toHaveLength(2);
        });
    });

    describe('Step 3: Configuration', () => {
        /**
         * Create and parse server configuration
         */
        it('should parse server configuration with environment variables', async () => {
            // ARRANGE: Set up environment variables
            const cleanup = createTestEnv({
                'MCP_SERVER_PORT': '3000',
                'MCP_LOG_LEVEL': 'debug',
                'NOTION_API_KEY': 'secret-key-123'
            });

            const configYaml = `
server:
  name: e2e-test-server
  version: "1.0.0"
  host: localhost
  port: \${MCP_SERVER_PORT:-8080}

logging:
  level: \${MCP_LOG_LEVEL:-info}
  format: json
  destination: stdout

connectors:
  notion:
    type: api
    enabled: true
    settings:
      apiKey: \${NOTION_API_KEY}
`;

            try {
                // ACT: Parse configuration
                const config = await parseConfigString(configYaml, 'yaml');

                // ASSERT: Verify configuration was parsed correctly
                expect(config.server.name).toBe('e2e-test-server');
                expect(config.server.port).toBe('3000'); // From env var
                expect(config.logging!.level).toBe('debug'); // From env var
                const notionConnector = config.connectors!['notion'];
                expect(notionConnector?.settings?.['apiKey']).toBe('secret-key-123');
            } finally {
                // CLEANUP: Restore environment
                cleanup();
            }
        });
    });

    describe('Step 4: Dockerfile Generation', () => {
        /**
         * Generate Dockerfile for the MCP server
         */
        it('should generate Dockerfile with correct configuration', async () => {
            const modules = await loadModules(testWorkspace);
            const manifest = await generateManifest(modules);
            const analysis = analyzeModules(modules);

            const configContent = `
server:
  name: e2e-test
  version: "1.0.0"
  host: localhost
  port: 8080
`;

            // ACT: Generate Dockerfile
            const dockerfile = await generateDockerfile(
                manifest,
                configContent,
                modules,
                {
                    nodeBaseImage: 'node:20-alpine',
                    includeHealthCheck: true,
                    labels: {
                        'maintainer': 'e2e-test@example.com',
                        'version': '1.0.0'
                    }
                }
            );

            // ASSERT: Verify Dockerfile content
            expect(dockerfile).toContain('FROM');
            expect(dockerfile).toContain('EXPOSE');
            expect(dockerfile).toContain('HEALTHCHECK');
            expect(dockerfile).toContain('LABEL');

            // Verify modules are TypeScript only (no Python)
            expect(analysis.hasTypeScript).toBe(true);
            expect(analysis.hasPython).toBe(false);
        });

        /**
         * Save Dockerfile to output directory
         */
        it('should save Dockerfile to output directory', async () => {
            const modules = await loadModules(testWorkspace);
            const manifest = await generateManifest(modules);
            const dockerfilePath = path.join(outputDir, 'Dockerfile');

            const configContent = `
server:
  name: e2e-test
  version: "1.0.0"
  host: localhost
  port: 8080
`;

            const dockerfile = await generateDockerfile(
                manifest,
                configContent,
                modules,
                {}
            );

            // ACT: Save Dockerfile
            await fs.writeFile(dockerfilePath, dockerfile);

            // ASSERT: File exists
            const savedContent = await fs.readFile(dockerfilePath, 'utf-8');
            expect(savedContent).toBe(dockerfile);
        });
    });

    describe('Step 5: Docker Build Simulation', () => {
        /**
         * Simulate building the Docker image
         * 
         * NOTE: This uses a mock Docker client to avoid requiring
         * an actual Docker daemon. In CI/CD, you might use a real
         * Docker daemon with appropriate timeouts.
         */
        it('should simulate Docker image build with progress', async () => {
            // ARRANGE: Create mock Docker client
            const mockDocker = createMockDockerClient();
            const progressEvents: any[] = [];

            // ACT: Build image (simulated)
            const imageId = await mockDocker.buildImage(
                testWorkspace,
                'Dockerfile',
                'e2e-test-server:latest',
                (progress) => {
                    progressEvents.push(progress);
                }
            );

            // ASSERT: Build completed successfully
            expect(imageId).toContain('sha256:');
            expect(progressEvents.length).toBeGreaterThan(0);

            // Verify progress events were streamed
            const streamEvents = progressEvents.filter(p => p.stream);
            expect(streamEvents.length).toBeGreaterThan(0);
        });
    });

    describe('Step 6: Container Lifecycle Simulation', () => {
        /**
         * Simulate the full container lifecycle:
         * create → start → health check → stop → remove
         */
        it('should simulate complete container lifecycle', async () => {
            // ARRANGE
            const mockDocker = createMockDockerClient();
            const containerName = 'e2e-test-container';

            // ACT & ASSERT: Create container
            const container = await mockDocker.createContainer({
                image: 'e2e-test-server:latest',
                name: containerName,
                env: {
                    'NODE_ENV': 'production',
                    'MCP_PORT': '8080'
                },
                ports: { 8080: 8080 }
            });
            expect(container.name).toBe(containerName);

            // ACT & ASSERT: Start container
            await mockDocker.startContainer(container.id);
            expect(mockDocker.startContainer).toHaveBeenCalledWith(container.id);

            // ACT & ASSERT: Check container status
            const containerInfo = await mockDocker.getContainer(container.id);
            expect(containerInfo).toBeDefined();
            expect(containerInfo!.state).toBe('running');

            // ACT & ASSERT: Get container logs (simulate health check)
            const logs = await mockDocker.getContainerLogs(container.id);
            expect(logs).toContain('started successfully');

            // ACT & ASSERT: Stop container
            await mockDocker.stopContainer(container.id, 10); // 10 second timeout
            expect(mockDocker.stopContainer).toHaveBeenCalled();

            // ACT & ASSERT: Remove container
            await mockDocker.removeContainer(container.id, true); // force=true
            expect(mockDocker.removeContainer).toHaveBeenCalled();
        });
    });

    describe('Step 7: Complete Workflow Integration', () => {
        /**
         * Run the complete workflow from start to finish
         * 
         * This test demonstrates the full end-to-end flow that would
         * occur in a real MCP server build process.
         */
        it('should complete full workflow: discover → generate → build → deploy', async () => {
            // ================================================================
            // STEP 1: Discover Modules
            // ================================================================
            const modules = await loadModules(testWorkspace);
            expect(modules.length).toBeGreaterThan(0);
            console.log(`✓ Discovered ${modules.length} modules`);

            // ================================================================
            // STEP 2: Generate and Validate Manifest
            // ================================================================
            const manifest = await generateManifest(modules);
            expect(validateManifest(manifest)).toBe(true);
            console.log(`✓ Generated manifest with ${manifest.tools.length} tools`);

            // ================================================================
            // STEP 3: Save Manifest
            // ================================================================
            const manifestPath = path.join(outputDir, 'final-manifest.json');
            await saveManifest(manifest, manifestPath);
            console.log(`✓ Saved manifest to ${manifestPath}`);

            // ================================================================
            // STEP 4: Generate Dockerfile
            // ================================================================
            const configContent = `
server:
  name: complete-workflow-test
  version: "1.0.0"
  host: localhost
  port: 8080
`;
            const dockerfile = await generateDockerfile(
                manifest,
                configContent,
                modules,
                { includeHealthCheck: true }
            );
            expect(dockerfile.length).toBeGreaterThan(100);
            console.log('✓ Generated Dockerfile');

            // ================================================================
            // STEP 5: Simulate Build
            // ================================================================
            const mockDocker = createMockDockerClient();
            const imageId = await mockDocker.buildImage(
                testWorkspace,
                'Dockerfile',
                'complete-workflow:latest',
                () => { } // No-op progress callback
            );
            expect(imageId).toBeDefined();
            console.log(`✓ Built image: ${imageId.substring(0, 20)}...`);

            // ================================================================
            // STEP 6: Simulate Container Start
            // ================================================================
            const container = await mockDocker.createContainer({
                image: 'complete-workflow:latest',
                name: 'complete-workflow-container',
                ports: { 8080: 8080 }
            });
            await mockDocker.startContainer(container.id);
            console.log(`✓ Started container: ${container.name}`);

            // ================================================================
            // STEP 7: Verify Running State
            // ================================================================
            const info = await mockDocker.getContainer(container.id);
            expect(info!.state).toBe('running');
            console.log('✓ Container is running');

            // ================================================================
            // STEP 8: Cleanup
            // ================================================================
            await mockDocker.stopContainer(container.id);
            await mockDocker.removeContainer(container.id);
            console.log('✓ Cleaned up container');

            console.log('\n🎉 Complete workflow executed successfully!');
        });
    });

    describe('Error Scenarios', () => {
        /**
         * Demonstrate handling of error conditions
         * 
         * Good E2E tests should also verify error handling paths.
         */
        it('should handle empty workspace gracefully', async () => {
            const emptyDir = path.join(testWorkspace, 'empty-subdir');
            await fs.mkdir(emptyDir, { recursive: true });

            // ACT: Try to load from empty directory
            const modules = await loadModules(emptyDir);

            // ASSERT: Should return empty array, not throw
            expect(modules).toEqual([]);

            // Should still generate empty manifest
            const manifest = await generateManifest(modules);
            expect(manifest.tools).toEqual([]);

            // But validation should fail for empty manifest
            expect(validateManifest(manifest)).toBe(false);

            await fs.rm(emptyDir, { recursive: true, force: true });
        });

        /**
         * Verify handling of invalid modules
         */
        it('should skip modules with missing metadata', async () => {
            const invalidDir = path.join(testWorkspace, 'invalid-modules');
            await fs.mkdir(path.join(invalidDir, 'tools'), { recursive: true });

            // Create module without metadata
            await fs.writeFile(
                path.join(invalidDir, 'tools', 'no-meta.ts'),
                'export function foo() { return 42; }'
            );

            // ACT: Load modules
            const modules = await loadModules(invalidDir);

            // ASSERT: Invalid module should be skipped
            expect(modules).toHaveLength(0);

            await fs.rm(invalidDir, { recursive: true, force: true });
        });
    });
});

/**
 * ============================================================================
 * USAGE NOTES
 * ============================================================================
 * 
 * To run this test file:
 *   npm test -- e2e-example.test.ts
 * 
 * To run with verbose output:
 *   npm test -- e2e-example.test.ts --verbose
 * 
 * To run with coverage:
 *   npm test -- e2e-example.test.ts --coverage
 * 
 * To run with longer timeout:
 *   npm test -- e2e-example.test.ts --testTimeout=120000
 * 
 * ============================================================================
 * CUSTOMIZATION GUIDE
 * ============================================================================
 * 
 * When creating your own E2E tests based on this template:
 * 
 * 1. WORKSPACE SETUP
 *    - Modify beforeAll() to create your specific tool/connector structure
 *    - Add any additional directories or files needed for your use case
 * 
 * 2. CONFIGURATION
 *    - Update the configuration YAML to match your server requirements
 *    - Add environment variables specific to your connectors
 * 
 * 3. ASSERTIONS
 *    - Add assertions specific to your tools' capabilities
 *    - Verify connector-specific behavior
 * 
 * 4. REAL DOCKER (optional)
 *    - Replace createMockDockerClient() with real DockerClient
 *    - Add appropriate timeouts and cleanup
 *    - Consider using Docker-in-Docker for CI/CD
 * 
 * 5. EXTERNAL SERVICES
 *    - Add mocks for any external APIs your connectors use
 *    - Consider using nock or similar for HTTP mocking
 * 
 * ============================================================================
 */
