/**
 * Test Utilities Index
 * 
 * Central export point for all test utilities, mocks, and fixtures.
 * 
 * @module test-utils
 */

// Mock Docker client
export {
    createMockDockerClient,
    mockBuildProgressEvents,
    mockImageInfo,
    mockContainerInfo,
    createMockBuildProgress,
    type MockDockerClient
} from './mock-docker-client';

// Mock file system
export {
    createMockFileSystem,
    setupFsMocks,
    clearFsMocks,
    createMockFsPromises,
    type VirtualFileSystem,
    type MockFileStat,
    type MockFileSystemInstance
} from './mock-fs';

// Test fixtures
export {
    sampleTools,
    sampleConnectors,
    sampleConfig,
    sampleManifest,
    sampleDockerfile,
    errorScenarios
} from './fixtures';

/**
 * Helper to create a temporary test environment
 */
export function createTestEnv(envVars: Record<string, string>): () => void {
    const originalEnv = { ...process.env };

    // Apply test environment variables
    Object.assign(process.env, envVars);

    // Return cleanup function
    return () => {
        // Restore original environment
        Object.keys(envVars).forEach(key => {
            if (originalEnv[key] === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = originalEnv[key];
            }
        });
    };
}

/**
 * Wait for a specified duration (useful for async tests)
 */
export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a mock logger for testing
 */
export function createMockLogger() {
    return {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        log: jest.fn()
    };
}

// Import jest for the mock logger
import { jest } from '@jest/globals';
