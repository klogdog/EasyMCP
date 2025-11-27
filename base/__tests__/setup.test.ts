/**
 * Example Test - Verifies Jest Setup
 * 
 * This test file demonstrates the testing framework is properly configured
 * and all utilities are working correctly.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
    createMockDockerClient,
    createMockFileSystem,
    sampleTools,
    sampleConfig,
    createTestEnv
} from './utils';

describe('Jest Setup Verification', () => {
    describe('Basic Jest Functionality', () => {
        it('should run a simple test', () => {
            expect(1 + 1).toBe(2);
        });

        it('should support async tests', async () => {
            const result = await Promise.resolve('async works');
            expect(result).toBe('async works');
        });

        it('should support mocking', () => {
            const mockFn = jest.fn().mockReturnValue(42);
            expect(mockFn()).toBe(42);
            expect(mockFn).toHaveBeenCalled();
        });
    });

    describe('Mock Docker Client', () => {
        it('should create a mock Docker client', () => {
            const client = createMockDockerClient();
            expect(client.ping).toBeDefined();
            expect(client.buildImage).toBeDefined();
            expect(client.createContainer).toBeDefined();
        });

        it('should mock Docker ping', async () => {
            const client = createMockDockerClient();
            const result = await client.ping();
            expect(result).toBe(true);
            expect(client.ping).toHaveBeenCalled();
        });

        it('should mock Docker build', async () => {
            const client = createMockDockerClient();
            const progressEvents: any[] = [];

            const imageId = await client.buildImage(
                '/app',
                'Dockerfile',
                'test:latest',
                (progress) => progressEvents.push(progress)
            );

            expect(imageId).toContain('sha256:');
            expect(progressEvents.length).toBeGreaterThan(0);
        });
    });

    describe('Mock File System', () => {
        it('should create a virtual file system', () => {
            const mockFs = createMockFileSystem({
                '/app': {
                    'src': {
                        'index.ts': 'export const main = () => {};'
                    },
                    'package.json': '{"name": "test"}'
                }
            });

            expect(mockFs.exists('/app/src/index.ts')).toBe(true);
            expect(mockFs.exists('/app/package.json')).toBe(true);
            expect(mockFs.exists('/app/nonexistent.ts')).toBe(false);
        });

        it('should read files from virtual file system', () => {
            const mockFs = createMockFileSystem({
                '/app': {
                    'config.json': '{"key": "value"}'
                }
            });

            const content = mockFs.readFile('/app/config.json');
            expect(content).toBe('{"key": "value"}');
        });

        it('should list directory contents', () => {
            const mockFs = createMockFileSystem({
                '/app': {
                    'file1.ts': 'content1',
                    'file2.ts': 'content2',
                    'subdir': {
                        'file3.ts': 'content3'
                    }
                }
            });

            const entries = mockFs.readdir('/app');
            expect(entries).toContain('file1.ts');
            expect(entries).toContain('file2.ts');
            expect(entries).toContain('subdir');
        });
    });

    describe('Test Fixtures', () => {
        it('should have sample tools available', () => {
            expect(sampleTools.calculator).toBeDefined();
            expect(sampleTools.calculator.name).toBe('calculator');
            expect(sampleTools.calculator.metadata).toBeDefined();
        });

        it('should have sample config available', () => {
            expect(sampleConfig.basic).toBeDefined();
            expect(sampleConfig.basic.yaml).toContain('server:');
            expect(sampleConfig.basic.parsed.server.name).toBe('test-mcp-server');
        });
    });

    describe('Environment Variable Helpers', () => {
        let cleanup: () => void;

        beforeEach(() => {
            // Clear any previous cleanup
            cleanup = () => { };
        });

        afterEach(() => {
            cleanup();
        });

        it('should set and restore environment variables', () => {
            const originalValue = process.env.TEST_VAR;

            cleanup = createTestEnv({
                TEST_VAR: 'test-value',
                ANOTHER_VAR: 'another-value'
            });

            expect(process.env.TEST_VAR).toBe('test-value');
            expect(process.env.ANOTHER_VAR).toBe('another-value');

            cleanup();

            expect(process.env.TEST_VAR).toBe(originalValue);
            expect(process.env.ANOTHER_VAR).toBeUndefined();
        });
    });
});

describe('TypeScript Support', () => {
    interface TestInterface {
        id: number;
        name: string;
    }

    it('should support TypeScript interfaces', () => {
        const obj: TestInterface = { id: 1, name: 'test' };
        expect(obj.id).toBe(1);
        expect(obj.name).toBe('test');
    });

    it('should support TypeScript generics', () => {
        function identity<T>(value: T): T {
            return value;
        }

        expect(identity<number>(42)).toBe(42);
        expect(identity<string>('hello')).toBe('hello');
    });
});
