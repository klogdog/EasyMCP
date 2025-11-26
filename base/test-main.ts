/**
 * Tests for Main Orchestrator
 * 
 * This file contains tests for the main MCP server generator orchestration.
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import {
    generateMCPServer,
    GeneratorOptions,
    BuildStep,
    canResumeBuild,
} from './main';
import * as loader from './loader';
import * as validator from './validator';
import * as generator from './generator';
import * as configGenerator from './config-generator';
import * as dockerizer from './dockerizer';
import * as credentialDiscovery from './credential-discovery';
import * as fs from 'fs/promises';

// Mock all dependencies
vi.mock('./loader', () => ({
    loadModules: vi.fn(),
}));

vi.mock('./validator', () => ({
    validateModules: vi.fn(),
}));

vi.mock('./generator', () => ({
    generateManifest: vi.fn(),
    saveManifest: vi.fn(),
}));

vi.mock('./config-generator', () => ({
    generateConfig: vi.fn(),
}));

vi.mock('./dockerizer', () => ({
    generateDockerfile: vi.fn(),
    analyzeModules: vi.fn(),
    buildMCPImage: vi.fn(),
}));

vi.mock('./credential-discovery', () => ({
    discoverCredentialRequirements: vi.fn(),
}));

vi.mock('./prompt', () => ({
    promptForCredentials: vi.fn(),
}));

vi.mock('./registry', () => ({
    tagImage: vi.fn(),
    pushImage: vi.fn(),
}));

vi.mock('./docker-client', () => ({
    DockerClient: vi.fn().mockImplementation(() => ({
        ping: vi.fn().mockResolvedValue(true),
        removeImage: vi.fn().mockResolvedValue(undefined),
    })),
    DockerBuildError: class DockerBuildError extends Error { },
    DockerDaemonNotRunningError: class DockerDaemonNotRunningError extends Error { },
}));

vi.mock('fs/promises', () => ({
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('{}'),
    mkdir: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined),
}));

describe('Main Orchestrator', () => {
    const mockModules = [
        {
            name: 'test-tool',
            path: '/workspace/tools/test-tool.ts',
            type: 'tool' as const,
            language: 'typescript' as const,
            metadata: {
                name: 'test-tool',
                description: 'A test tool',
                version: '1.0.0',
            },
        },
        {
            name: 'test-connector',
            path: '/workspace/connectors/test-connector.ts',
            type: 'connector' as const,
            language: 'typescript' as const,
            metadata: {
                name: 'test-connector',
                description: 'A test connector',
                version: '1.0.0',
                type: 'api',
            },
        },
    ];

    const mockManifest = {
        name: 'mcp-server',
        version: '1.0.0',
        tools: [
            { name: 'test-tool', description: 'A test tool', version: '1.0.0' },
        ],
        connectors: [
            {
                name: 'test-connector',
                description: 'A test connector',
                version: '1.0.0',
                type: 'api',
            },
        ],
        capabilities: ['api-integration'],
        dependencies: {},
        metadata: {
            generatedAt: '2025-01-01T00:00:00.000Z',
            generatorVersion: '1.0.0',
            moduleCount: 2,
        },
    };

    const mockValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Set up default mocks
        (loader.loadModules as Mock).mockResolvedValue(mockModules);
        (validator.validateModules as Mock).mockReturnValue(mockValidationResult);
        (generator.generateManifest as Mock).mockResolvedValue(mockManifest);
        (generator.saveManifest as Mock).mockResolvedValue(undefined);
        (configGenerator.generateConfig as Mock).mockResolvedValue('# Config');
        (dockerizer.generateDockerfile as Mock).mockResolvedValue('FROM node:20-alpine');
        (dockerizer.analyzeModules as Mock).mockReturnValue({
            hasTypeScript: true,
            hasPython: false,
            typescriptTools: ['tools/test-tool.ts'],
            pythonTools: [],
            typescriptConnectors: ['connectors/test-connector.ts'],
            pythonConnectors: [],
            npmDependencies: [],
            pythonDependencies: [],
        });
        (credentialDiscovery.discoverCredentialRequirements as Mock).mockResolvedValue([]);
    });

    describe('generateMCPServer', () => {
        const baseOptions: GeneratorOptions = {
            basePath: '/workspace',
            dryRun: true, // Default to dry-run to avoid Docker operations
        };

        it('should successfully complete all steps in dry-run mode', async () => {
            const result = await generateMCPServer(baseOptions);

            expect(result.success).toBe(true);
            expect(result.toolCount).toBe(1);
            expect(result.connectorCount).toBe(1);
            expect(result.steps).toBeDefined();
            expect(result.steps?.length).toBe(8);
        });

        it('should call loadModules with correct base path', async () => {
            await generateMCPServer(baseOptions);

            expect(loader.loadModules).toHaveBeenCalledWith('/workspace');
        });

        it('should call validateModules with loaded modules', async () => {
            await generateMCPServer(baseOptions);

            expect(validator.validateModules).toHaveBeenCalledWith(mockModules);
        });

        it('should call generateManifest with validated modules', async () => {
            await generateMCPServer(baseOptions);

            expect(generator.generateManifest).toHaveBeenCalledWith(mockModules);
        });

        it('should call generateConfig with manifest and environment', async () => {
            await generateMCPServer({ ...baseOptions, environment: 'development' });

            expect(configGenerator.generateConfig).toHaveBeenCalledWith(
                mockManifest,
                'development'
            );
        });

        it('should default to production environment', async () => {
            await generateMCPServer(baseOptions);

            expect(configGenerator.generateConfig).toHaveBeenCalledWith(
                mockManifest,
                'production'
            );
        });

        it('should report validation failures', async () => {
            (validator.validateModules as Mock).mockReturnValue({
                valid: false,
                errors: [
                    {
                        moduleName: 'test-tool',
                        field: 'version',
                        message: 'Invalid version format',
                        severity: 'error',
                    },
                ],
                warnings: [],
            });

            const result = await generateMCPServer(baseOptions);

            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors?.length).toBeGreaterThan(0);
        });

        it('should report when no modules found', async () => {
            (loader.loadModules as Mock).mockResolvedValue([]);

            const result = await generateMCPServer(baseOptions);

            expect(result.success).toBe(false);
            expect(result.errors?.some(e => e.includes('No modules found'))).toBe(true);
        });

        it('should collect warnings from validation', async () => {
            (validator.validateModules as Mock).mockReturnValue({
                valid: true,
                errors: [],
                warnings: ['Missing optional field: capabilities'],
            });

            const result = await generateMCPServer(baseOptions);

            expect(result.success).toBe(true);
            expect(result.warnings).toBeDefined();
            expect(result.warnings).toContain('Missing optional field: capabilities');
        });

        it('should call progress callback for each step', async () => {
            const progressCallback = vi.fn();
            const optionsWithProgress: GeneratorOptions = {
                ...baseOptions,
                onProgress: progressCallback,
            };

            await generateMCPServer(optionsWithProgress);

            // Should be called at least for each step (start and complete)
            expect(progressCallback).toHaveBeenCalled();

            // Check that we got progress for step 1
            const step1Calls = progressCallback.mock.calls.filter(
                (call: [BuildStep, string]) => call[0].number === 1
            );
            expect(step1Calls.length).toBeGreaterThan(0);
        });

        it('should skip Docker build in dry-run mode', async () => {
            const result = await generateMCPServer(baseOptions);

            expect(dockerizer.buildMCPImage).not.toHaveBeenCalled();

            // Step 7 should be skipped
            const step7 = result.steps?.find(s => s.number === 7);
            expect(step7?.status).toBe('skipped');
        });

        it('should return correct duration', async () => {
            const result = await generateMCPServer(baseOptions);

            expect(result.duration).toBeDefined();
            expect(typeof result.duration).toBe('number');
            expect(result.duration).toBeGreaterThanOrEqual(0);
        });
    });

    describe('BuildStep tracking', () => {
        const baseOptions: GeneratorOptions = {
            basePath: '/workspace',
            dryRun: true,
        };

        it('should track 8 steps', async () => {
            const result = await generateMCPServer(baseOptions);

            expect(result.steps?.length).toBe(8);
        });

        it('should have correct step names', async () => {
            const result = await generateMCPServer(baseOptions);
            const stepNames = result.steps?.map(s => s.name);

            expect(stepNames).toContain('Loading modules');
            expect(stepNames).toContain('Validating modules');
            expect(stepNames).toContain('Collecting credentials');
            expect(stepNames).toContain('Generating manifest');
            expect(stepNames).toContain('Generating configuration');
            expect(stepNames).toContain('Generating Dockerfile');
            expect(stepNames).toContain('Building Docker image');
            expect(stepNames).toContain('Tagging and pushing');
        });

        it('should have completed status for successful steps', async () => {
            const result = await generateMCPServer(baseOptions);

            // First 6 steps should be completed
            for (let i = 0; i < 6; i++) {
                const step = result.steps?.[i];
                if (step) {
                    expect(step.status).toBe('completed');
                }
            }
        });

        it('should include timestamps for completed steps', async () => {
            const result = await generateMCPServer(baseOptions);

            const completedSteps = result.steps?.filter(s => s.status === 'completed');
            for (const step of completedSteps || []) {
                expect(step.startedAt).toBeInstanceOf(Date);
                expect(step.completedAt).toBeInstanceOf(Date);
                expect(step.duration).toBeGreaterThanOrEqual(0);
            }
        });
    });

    describe('Credential Discovery', () => {
        const baseOptions: GeneratorOptions = {
            basePath: '/workspace',
            dryRun: true,
        };

        it('should discover credentials from modules', async () => {
            await generateMCPServer(baseOptions);

            expect(credentialDiscovery.discoverCredentialRequirements).toHaveBeenCalledWith(
                mockModules
            );
        });

        it('should warn about missing env vars when skipPrompts is true', async () => {
            (credentialDiscovery.discoverCredentialRequirements as Mock).mockResolvedValue([
                {
                    name: 'API_KEY',
                    type: 'api_key',
                    required: true,
                    description: 'API key',
                    usedBy: ['test-connector'],
                },
            ]);

            const result = await generateMCPServer({
                ...baseOptions,
                skipPrompts: true,
            });

            expect(result.warnings?.some(w => w.includes('API_KEY'))).toBe(true);
        });
    });
});

describe('canResumeBuild', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return false when no checkpoint exists', async () => {
        (fs.readFile as Mock).mockRejectedValue(new Error('File not found'));

        const result = await canResumeBuild('/workspace');

        expect(result.canResume).toBe(false);
    });

    it('should return checkpoint data when valid checkpoint exists', async () => {
        const checkpoint = {
            step: 3,
            stepName: 'Collecting credentials',
            timestamp: new Date().toISOString(),
            moduleNames: ['test-tool'],
        };

        (fs.readFile as Mock).mockResolvedValue(JSON.stringify(checkpoint));

        const result = await canResumeBuild('/workspace');

        expect(result.canResume).toBe(true);
        expect(result.checkpoint).toBeDefined();
        expect(result.checkpoint?.step).toBe(3);
    });

    it('should return false for old checkpoints', async () => {
        const oldDate = new Date();
        oldDate.setHours(oldDate.getHours() - 2); // 2 hours ago

        const checkpoint = {
            step: 3,
            stepName: 'Collecting credentials',
            timestamp: oldDate.toISOString(),
            moduleNames: ['test-tool'],
        };

        (fs.readFile as Mock).mockResolvedValue(JSON.stringify(checkpoint));

        const result = await canResumeBuild('/workspace');

        expect(result.canResume).toBe(false);
        expect(result.message).toContain('too old');
    });
});
