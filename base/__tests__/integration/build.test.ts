/**
 * Integration Tests for MCP Generator
 * 
 * These tests verify end-to-end workflows including module discovery,
 * manifest generation, Dockerfile creation, and Docker image building.
 * 
 * Note: Some tests require Docker to be available and may take longer to run.
 * Use the --testTimeout flag to allow for longer test runs.
 * 
 * @module __tests__/integration/build
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import * as path from 'path';
import * as fs from 'fs/promises';

// Import modules under test
import { loadModules } from '../../loader';
import { generateManifest, saveManifest, validateManifest, MCPManifest } from '../../generator';
import { parseConfig, parseConfigString } from '../../config-parser';
import { generateDockerfile, analyzeModules } from '../../dockerizer';

// Test utilities
import { createMockDockerClient } from '../utils/mock-docker-client';

// Test timeout for integration tests (30 seconds)
jest.setTimeout(30000);

describe('Integration Tests', () => {
    let tempDir: string;
    let toolsDir: string;
    let connectorsDir: string;

    /**
     * Create a temporary test workspace with tools and connectors
     */
    beforeAll(async () => {
        tempDir = path.join(__dirname, 'temp-integration-test');
        toolsDir = path.join(tempDir, 'tools');
        connectorsDir = path.join(tempDir, 'connectors');

        await fs.mkdir(toolsDir, { recursive: true });
        await fs.mkdir(connectorsDir, { recursive: true });
    });

    /**
     * Clean up temporary workspace after all tests
     */
    afterAll(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    describe('Full Build Pipeline', () => {
        it('should complete the full pipeline: load → generate → validate', async () => {
            // Step 1: Create sample tools
            const calculatorContent = `
export const metadata = {
    "name": "calculator",
    "description": "Performs arithmetic operations",
    "version": "1.0.0",
    "capabilities": ["math", "computation"]
};

export function calculate(op: string, a: number, b: number): number {
    switch (op) {
        case 'add': return a + b;
        case 'sub': return a - b;
        case 'mul': return a * b;
        case 'div': return a / b;
        default: throw new Error('Unknown operation');
    }
}
`;
            await fs.writeFile(path.join(toolsDir, 'calculator.ts'), calculatorContent);

            // Step 2: Create sample connector
            const connectorContent = `
export const metadata = {
    "name": "api-connector",
    "description": "Generic API connector",
    "version": "1.0.0",
    "type": "api",
    "methods": ["get", "post", "put", "delete"]
};

export class ApiConnector {
    async request(method: string, url: string): Promise<any> {
        return { method, url, success: true };
    }
}
`;
            await fs.writeFile(path.join(connectorsDir, 'api-connector.ts'), connectorContent);

            // Step 3: Load modules
            const modules = await loadModules(tempDir);

            expect(modules).toHaveLength(2);
            expect(modules.some(m => m.name === 'calculator')).toBe(true);
            expect(modules.some(m => m.name === 'api-connector')).toBe(true);

            // Step 4: Generate manifest
            const manifest = await generateManifest(modules);

            expect(manifest.name).toBe('mcp-server');
            expect(manifest.tools).toHaveLength(1);
            expect(manifest.connectors).toHaveLength(1);
            expect(manifest.capabilities).toContain('math');
            expect(manifest.capabilities).toContain('api-integration');

            // Step 5: Validate manifest
            const isValid = validateManifest(manifest);
            expect(isValid).toBe(true);

            // Step 6: Save manifest
            const manifestPath = path.join(tempDir, 'manifest.json');
            await saveManifest(manifest, manifestPath);

            // Verify manifest was saved correctly
            const savedContent = await fs.readFile(manifestPath, 'utf-8');
            const savedManifest = JSON.parse(savedContent) as MCPManifest;
            expect(savedManifest.name).toBe(manifest.name);
            expect(savedManifest.tools).toHaveLength(1);
        });

        it('should handle mixed Python and TypeScript modules', async () => {
            // Create a Python tool
            const pythonToolContent = `
"""Python summarization tool."""

metadata = {
    "name": "py-summarizer",
    "description": "Summarizes text using Python",
    "version": "1.0.0",
    "capabilities": ["text-processing"]
}

def summarize(text: str, max_length: int = 100) -> str:
    if len(text) <= max_length:
        return text
    return text[:max_length-3] + "..."
`;
            await fs.writeFile(path.join(toolsDir, 'py-summarizer.py'), pythonToolContent);

            // Load all modules (including previous TypeScript ones)
            const modules = await loadModules(tempDir);

            // Should have both TS and Python modules
            const tsModules = modules.filter(m => m.language === 'typescript');
            const pyModules = modules.filter(m => m.language === 'python');

            expect(tsModules.length).toBeGreaterThan(0);
            expect(pyModules.length).toBeGreaterThan(0);

            // Analyze modules
            const analysis = analyzeModules(modules);

            expect(analysis.hasTypeScript).toBe(true);
            expect(analysis.hasPython).toBe(true);

            // Generate manifest with mixed modules
            const manifest = await generateManifest(modules);

            expect(manifest.tools.length).toBeGreaterThanOrEqual(2);
            expect(manifest.capabilities).toContain('text-processing');
        });
    });

    describe('Dockerfile Generation', () => {
        it('should generate a valid Dockerfile from modules', async () => {
            const modules = await loadModules(tempDir);
            const manifest = await generateManifest(modules);

            // Create a minimal config string
            const configContent = `
server:
  name: test
  version: "1.0.0"
  host: localhost
  port: 8080
`;
            const dockerfile = await generateDockerfile(manifest, configContent, modules, {
                nodeBaseImage: 'node:20-alpine',
                workDir: '/app',
                includeHealthCheck: true
            });

            expect(dockerfile).toBeDefined();
            expect(dockerfile).toContain('FROM');
            expect(dockerfile).toContain('WORKDIR');
            expect(dockerfile).toContain('EXPOSE');
        });

        it('should include Python runtime when Python modules exist', async () => {
            const modules = await loadModules(tempDir);
            const manifest = await generateManifest(modules);
            const analysis = analyzeModules(modules);

            const configContent = `
server:
  name: test
  version: "1.0.0"
  host: localhost
  port: 8080
`;
            // Should have Python modules from previous test
            if (analysis.hasPython) {
                const dockerfile = await generateDockerfile(manifest, configContent, modules, {});

                expect(dockerfile).toContain('python');
            }
        });

        it('should generate Dockerfile with health check', async () => {
            const modules = await loadModules(tempDir);
            const manifest = await generateManifest(modules);

            const configContent = `
server:
  name: test
  version: "1.0.0"
  host: localhost
  port: 8080
`;
            const dockerfile = await generateDockerfile(manifest, configContent, modules, {
                includeHealthCheck: true
            });

            expect(dockerfile).toContain('HEALTHCHECK');
        });

        it('should generate Dockerfile with custom labels', async () => {
            const modules = await loadModules(tempDir);
            const manifest = await generateManifest(modules);

            const configContent = `
server:
  name: test
  version: "1.0.0"
  host: localhost
  port: 8080
`;
            const dockerfile = await generateDockerfile(manifest, configContent, modules, {
                labels: {
                    'maintainer': 'test@example.com',
                    'version': '1.0.0'
                }
            });

            expect(dockerfile).toContain('LABEL');
            expect(dockerfile).toContain('maintainer');
        });
    });

    describe('Configuration Integration', () => {
        it('should integrate config with manifest generation', async () => {
            // Create a config file
            const configContent = `
server:
  name: integrated-server
  version: "1.0.0"
  host: localhost
  port: 8080

logging:
  level: info
  format: json
  destination: stdout

tools:
  calculator:
    enabled: true
    timeout: 5000
`;
            const configPath = path.join(tempDir, 'config.yaml');
            await fs.writeFile(configPath, configContent);

            // Parse config
            const config = await parseConfig(configPath);

            expect(config.server.name).toBe('integrated-server');
            expect(config.server.port).toBe(8080);
            expect(config.tools!['calculator']!.enabled).toBe(true);

            // Load modules and generate manifest
            const modules = await loadModules(tempDir);
            const manifest = await generateManifest(modules);

            // Verify configuration can be used alongside manifest
            expect(manifest.name).toBe('mcp-server');
            expect(config.server.port).toBe(8080);
        });

        it('should handle environment variable substitution in integration', async () => {
            process.env.INTEGRATION_TEST_PORT = '9000';
            process.env.INTEGRATION_TEST_HOST = 'integration.test.local';

            const configContent = `
server:
  name: env-integrated-server
  version: "1.0.0"
  host: \${INTEGRATION_TEST_HOST}
  port: \${INTEGRATION_TEST_PORT:-8080}
`;
            const config = await parseConfigString(configContent, 'yaml');

            expect(config.server.host).toBe('integration.test.local');
            expect(config.server.port).toBe('9000');

            delete process.env.INTEGRATION_TEST_PORT;
            delete process.env.INTEGRATION_TEST_HOST;
        });
    });

    describe('Docker Client Integration (Mocked)', () => {
        it('should simulate image build with progress events', async () => {
            const mockDocker = createMockDockerClient();
            const progressEvents: any[] = [];

            // Simulate build
            const imageId = await mockDocker.buildImage(
                tempDir,
                'Dockerfile',
                'integration-test:latest',
                (progress) => progressEvents.push(progress)
            );

            expect(imageId).toContain('sha256:');
            expect(progressEvents.length).toBeGreaterThan(0);
            expect(mockDocker.buildImage).toHaveBeenCalledTimes(1);
        });

        it('should simulate container creation and startup', async () => {
            const mockDocker = createMockDockerClient();

            // Create container - ports format is {hostPort: containerPort}
            const container = await mockDocker.createContainer({
                image: 'integration-test:latest',
                name: 'test-container',
                ports: { 8080: 8080 }
            });

            expect(container).toBeDefined();
            expect(container.name).toBe('test-container');

            // Start container
            await mockDocker.startContainer(container.id);
            expect(mockDocker.startContainer).toHaveBeenCalledWith(container.id);

            // Get container info
            const containerInfo = await mockDocker.getContainer(container.id);
            expect(containerInfo).toBeDefined();

            // Stop container
            await mockDocker.stopContainer(container.id);
            expect(mockDocker.stopContainer).toHaveBeenCalled();

            // Remove container
            await mockDocker.removeContainer(container.id);
            expect(mockDocker.removeContainer).toHaveBeenCalled();
        });

        it('should simulate container health check via logs', async () => {
            const mockDocker = createMockDockerClient();

            // Get container logs
            const logs = await mockDocker.getContainerLogs('test-container');

            expect(logs).toContain('started successfully');
            expect(logs).toContain('port');
        });
    });

    describe('Error Handling in Integration', () => {
        it('should handle missing tools directory gracefully', async () => {
            const emptyDir = path.join(tempDir, 'empty-workspace');
            await fs.mkdir(emptyDir, { recursive: true });

            const modules = await loadModules(emptyDir);

            expect(modules).toEqual([]);

            // Should still be able to generate empty manifest
            const manifest = await generateManifest(modules);
            expect(manifest.tools).toEqual([]);
            expect(manifest.connectors).toEqual([]);

            await fs.rm(emptyDir, { recursive: true, force: true });
        });

        it('should handle invalid module files gracefully', async () => {
            const invalidDir = path.join(tempDir, 'invalid-tools');
            const invalidToolsDir = path.join(invalidDir, 'tools');
            await fs.mkdir(invalidToolsDir, { recursive: true });

            // Create file without metadata
            await fs.writeFile(
                path.join(invalidToolsDir, 'no-meta.ts'),
                'export function foo() { return "bar"; }'
            );

            // Create file with partial metadata
            await fs.writeFile(
                path.join(invalidToolsDir, 'partial-meta.ts'),
                `export const metadata = { "name": "partial" };`
            );

            const modules = await loadModules(invalidDir);

            // Should skip invalid files
            expect(modules.filter(m => m.name === 'no-meta')).toHaveLength(0);
            expect(modules.filter(m => m.name === 'partial')).toHaveLength(0);

            await fs.rm(invalidDir, { recursive: true, force: true });
        });

        it('should validate manifest before saving', async () => {
            // Create minimal valid manifest
            const validManifest: MCPManifest = {
                name: 'valid-test',
                version: '1.0.0',
                tools: [{ name: 't', description: 'd', version: '1.0.0' }],
                connectors: [],
                capabilities: [],
                dependencies: {},
                metadata: {
                    generatedAt: new Date().toISOString(),
                    generatorVersion: '1.0.0',
                    moduleCount: 1
                }
            };

            expect(validateManifest(validManifest)).toBe(true);

            // Create invalid manifest (empty)
            const invalidManifest = {
                name: '',
                version: '1.0.0',
                tools: [],
                connectors: [],
                capabilities: [],
                dependencies: {},
                metadata: {
                    generatedAt: new Date().toISOString(),
                    generatorVersion: '1.0.0',
                    moduleCount: 0
                }
            } as MCPManifest;

            expect(validateManifest(invalidManifest)).toBe(false);
        });
    });

    describe('Module Analysis', () => {
        it('should correctly analyze module languages', async () => {
            const modules = await loadModules(tempDir);
            const analysis = analyzeModules(modules);

            expect(analysis.hasTypeScript).toBe(true);
            expect(analysis.typescriptTools.length + analysis.typescriptConnectors.length)
                .toBeGreaterThan(0);
        });

        it('should extract relative paths from module analysis', async () => {
            const modules = await loadModules(tempDir);
            const analysis = analyzeModules(modules);

            // All paths should be relative, not absolute
            [...analysis.typescriptTools, ...analysis.pythonTools].forEach(p => {
                expect(path.isAbsolute(p)).toBe(false);
            });
        });
    });

    describe('Performance Integration Tests', () => {
        it('should handle large number of modules efficiently', async () => {
            const perfDir = path.join(tempDir, 'perf-test');
            const perfToolsDir = path.join(perfDir, 'tools');
            await fs.mkdir(perfToolsDir, { recursive: true });

            // Create 50 tool files
            const createPromises = Array.from({ length: 50 }, (_, i) => {
                const content = `
export const metadata = {
    "name": "perf-tool-${i}",
    "description": "Performance test tool ${i}",
    "version": "1.0.0",
    "capabilities": ["perf-${i % 5}"]
};
`;
                return fs.writeFile(path.join(perfToolsDir, `perf-tool-${i}.ts`), content);
            });

            await Promise.all(createPromises);

            // Measure time for full pipeline
            const start = Date.now();

            const modules = await loadModules(perfDir);
            expect(modules).toHaveLength(50);

            const manifest = await generateManifest(modules);
            expect(manifest.tools).toHaveLength(50);

            const isValid = validateManifest(manifest);
            expect(isValid).toBe(true);

            const duration = Date.now() - start;

            // Should complete in under 5 seconds
            expect(duration).toBeLessThan(5000);

            await fs.rm(perfDir, { recursive: true, force: true });
        });
    });
});
