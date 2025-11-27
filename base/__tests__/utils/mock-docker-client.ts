/**
 * Mock Docker Client
 * 
 * Provides a mock implementation of the DockerClient for testing.
 * Allows simulating Docker operations without requiring actual Docker.
 * 
 * @module test-utils/mock-docker-client
 */

import { jest } from '@jest/globals';
import type {
    ImageInfo,
    ContainerConfig,
    ContainerInfo,
    BuildProgress,
    ProgressCallback
} from '../../docker-client';

/**
 * Mock build progress events for simulating builds
 */
export const mockBuildProgressEvents: BuildProgress[] = [
    { stream: 'Step 1/5 : FROM node:18-alpine\n' },
    { stream: ' ---> abc123\n' },
    { stream: 'Step 2/5 : WORKDIR /app\n' },
    { stream: ' ---> Running in def456\n' },
    { stream: 'Step 3/5 : COPY . .\n' },
    { stream: ' ---> ghi789\n' },
    { stream: 'Step 4/5 : RUN npm install\n' },
    { status: 'Installing dependencies', progress: 50 },
    { stream: ' ---> jkl012\n' },
    { stream: 'Step 5/5 : CMD ["node", "server.js"]\n' },
    { stream: ' ---> mno345\n' },
    { stream: 'Successfully built pqr678\n' },
    { stream: 'Successfully tagged test-image:latest\n' }
];

/**
 * Mock image information
 */
export const mockImageInfo: ImageInfo = {
    id: 'sha256:abc123def456',
    tags: ['test-image:latest'],
    size: 125000000, // ~125MB
    created: new Date('2024-01-15T10:30:00Z'),
    parentId: 'sha256:parent123'
};

/**
 * Mock container information
 */
export const mockContainerInfo: ContainerInfo = {
    id: 'container123abc',
    name: 'test-container',
    image: 'test-image:latest',
    state: 'running',
    status: 'Up 5 minutes',
    ports: [{ host: 3000, container: 3000, protocol: 'tcp' }],
    created: new Date('2024-01-15T10:35:00Z')
};

/**
 * Creates a mock DockerClient with configurable behavior
 */
export function createMockDockerClient(overrides: Partial<MockDockerClient> = {}): MockDockerClient {
    const defaultMock: MockDockerClient = {
        ping: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),

        getVersion: jest.fn<() => Promise<{ version: string; apiVersion: string; os: string; arch: string }>>()
            .mockResolvedValue({
                version: '24.0.0',
                apiVersion: '1.43',
                os: 'linux',
                arch: 'amd64'
            }),

        buildImage: jest.fn<(contextPath: string, dockerfilePath: string, tag: string, onProgress?: ProgressCallback) => Promise<string>>()
            .mockImplementation(async (_contextPath, _dockerfilePath, tag, onProgress) => {
                // Simulate build progress
                if (onProgress) {
                    for (const event of mockBuildProgressEvents) {
                        onProgress(event);
                    }
                }
                return `sha256:${tag.replace(':', '-')}-abc123`;
            }),

        getImage: jest.fn<(imageId: string) => Promise<ImageInfo | null>>()
            .mockResolvedValue(mockImageInfo),

        listImages: jest.fn<() => Promise<ImageInfo[]>>()
            .mockResolvedValue([mockImageInfo]),

        removeImage: jest.fn<(imageId: string) => Promise<void>>()
            .mockResolvedValue(undefined),

        createContainer: jest.fn<(config: ContainerConfig) => Promise<ContainerInfo>>()
            .mockImplementation(async (config) => ({
                ...mockContainerInfo,
                image: config.image,
                name: config.name || mockContainerInfo.name
            })),

        startContainer: jest.fn<(containerId: string) => Promise<void>>()
            .mockResolvedValue(undefined),

        stopContainer: jest.fn<(containerId: string, timeout?: number) => Promise<void>>()
            .mockResolvedValue(undefined),

        removeContainer: jest.fn<(containerId: string, force?: boolean) => Promise<void>>()
            .mockResolvedValue(undefined),

        getContainer: jest.fn<(containerId: string) => Promise<ContainerInfo | null>>()
            .mockResolvedValue(mockContainerInfo),

        listContainers: jest.fn<(all?: boolean) => Promise<ContainerInfo[]>>()
            .mockResolvedValue([mockContainerInfo]),

        getContainerLogs: jest.fn<(containerId: string, options?: { stdout?: boolean; stderr?: boolean; tail?: number }) => Promise<string>>()
            .mockResolvedValue('Container started successfully\nListening on port 3000'),

        execInContainer: jest.fn<(containerId: string, cmd: string[]) => Promise<{ exitCode: number; output: string }>>()
            .mockResolvedValue({ exitCode: 0, output: 'Command executed successfully' }),

        // Helper to simulate failures
        simulateError: null as ((method: string, error: Error) => void) | null,

        // Reset all mocks
        reset: function () {
            Object.values(this).forEach(value => {
                if (typeof value === 'function' && 'mockReset' in value) {
                    (value as jest.Mock).mockReset();
                }
            });
        }
    };

    return { ...defaultMock, ...overrides };
}

/**
 * Interface for the mock Docker client
 */
export interface MockDockerClient {
    ping: jest.Mock<() => Promise<boolean>>;
    getVersion: jest.Mock<() => Promise<{ version: string; apiVersion: string; os: string; arch: string }>>;
    buildImage: jest.Mock<(contextPath: string, dockerfilePath: string, tag: string, onProgress?: ProgressCallback) => Promise<string>>;
    getImage: jest.Mock<(imageId: string) => Promise<ImageInfo | null>>;
    listImages: jest.Mock<() => Promise<ImageInfo[]>>;
    removeImage: jest.Mock<(imageId: string) => Promise<void>>;
    createContainer: jest.Mock<(config: ContainerConfig) => Promise<ContainerInfo>>;
    startContainer: jest.Mock<(containerId: string) => Promise<void>>;
    stopContainer: jest.Mock<(containerId: string, timeout?: number) => Promise<void>>;
    removeContainer: jest.Mock<(containerId: string, force?: boolean) => Promise<void>>;
    getContainer: jest.Mock<(containerId: string) => Promise<ContainerInfo | null>>;
    listContainers: jest.Mock<(all?: boolean) => Promise<ContainerInfo[]>>;
    getContainerLogs: jest.Mock<(containerId: string, options?: { stdout?: boolean; stderr?: boolean; tail?: number }) => Promise<string>>;
    execInContainer: jest.Mock<(containerId: string, cmd: string[]) => Promise<{ exitCode: number; output: string }>>;
    simulateError: ((method: string, error: Error) => void) | null;
    reset: () => void;
}

/**
 * Creates mock build progress with optional error
 */
export function createMockBuildProgress(options: {
    includeError?: boolean;
    errorMessage?: string;
    steps?: number;
} = {}): BuildProgress[] {
    const { includeError = false, errorMessage = 'Build failed', steps = 5 } = options;

    const events: BuildProgress[] = [];

    for (let i = 1; i <= steps; i++) {
        events.push({ stream: `Step ${i}/${steps} : MOCK STEP\n` });
        events.push({ stream: ` ---> layer${i}\n` });

        if (includeError && i === steps) {
            events.push({ error: errorMessage, errorDetail: { message: errorMessage, code: 1 } });
            return events;
        }
    }

    events.push({ stream: 'Successfully built mock123\n' });
    events.push({ stream: 'Successfully tagged mock:latest\n' });

    return events;
}

export default createMockDockerClient;
