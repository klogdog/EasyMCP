/**
 * Docker Client Wrapper
 * 
 * Provides an abstraction layer for Docker operations using dockerode.
 * Handles image building, container management, and streaming progress.
 * 
 * @module docker-client
 */

import Docker from 'dockerode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as tar from 'tar-fs';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Configuration options for DockerClient initialization
 */
export interface DockerClientOptions {
    /** Path to Docker socket (default: /var/run/docker.sock) */
    socketPath?: string;
    /** Docker host URL (e.g., tcp://localhost:2375) */
    host?: string;
    /** Docker port (used with host) */
    port?: number;
    /** Connection timeout in milliseconds */
    timeout?: number;
}

/**
 * Information about a Docker image
 */
export interface ImageInfo {
    /** Image ID */
    id: string;
    /** Repository tags (e.g., ['myapp:latest']) */
    tags: string[];
    /** Image size in bytes */
    size: number;
    /** Creation timestamp */
    created: Date;
    /** Parent image ID */
    parentId?: string;
}

/**
 * Configuration for creating a container
 */
export interface ContainerConfig {
    /** Image name or ID to use */
    image: string;
    /** Container name (optional) */
    name?: string;
    /** Command to run */
    cmd?: string[];
    /** Environment variables */
    env?: Record<string, string>;
    /** Port mappings (hostPort: containerPort) */
    ports?: Record<number, number>;
    /** Volume mounts (hostPath: containerPath) */
    volumes?: Record<string, string>;
    /** Working directory inside container */
    workingDir?: string;
    /** Whether to remove container after it exits */
    autoRemove?: boolean;
    /** Network mode */
    networkMode?: string;
}

/**
 * Information about a Docker container
 */
export interface ContainerInfo {
    /** Container ID */
    id: string;
    /** Container name */
    name: string;
    /** Image used */
    image: string;
    /** Current state */
    state: 'created' | 'running' | 'paused' | 'restarting' | 'exited' | 'dead';
    /** Status message */
    status: string;
    /** Port mappings */
    ports: { host: number; container: number; protocol: string }[];
    /** Creation timestamp */
    created: Date;
}

/**
 * Build progress message
 */
export interface BuildProgress {
    /** Stream output text */
    stream?: string;
    /** Progress status */
    status?: string;
    /** Progress percentage (0-100) */
    progress?: number;
    /** Error message if any */
    error?: string;
    /** Error details */
    errorDetail?: { message: string; code?: number };
}

/**
 * Callback for receiving build progress updates
 */
export type ProgressCallback = (progress: BuildProgress) => void;

// ============================================================================
// Custom Errors
// ============================================================================

/**
 * Base class for Docker-related errors
 */
export class DockerError extends Error {
    constructor(
        message: string,
        public readonly code?: string,
        public readonly originalError?: Error
    ) {
        super(message);
        this.name = 'DockerError';
    }
}

/**
 * Error thrown when Docker daemon is not accessible
 */
export class DockerDaemonNotRunningError extends DockerError {
    constructor(message: string = 'Docker daemon is not running or not accessible', originalError?: Error) {
        super(message, 'DAEMON_NOT_RUNNING', originalError);
        this.name = 'DockerDaemonNotRunningError';
    }
}

/**
 * Error thrown when an image operation fails
 */
export class DockerImageError extends DockerError {
    constructor(message: string, public readonly imageId?: string, originalError?: Error) {
        super(message, 'IMAGE_ERROR', originalError);
        this.name = 'DockerImageError';
    }
}

/**
 * Error thrown when a container operation fails
 */
export class DockerContainerError extends DockerError {
    constructor(message: string, public readonly containerId?: string, originalError?: Error) {
        super(message, 'CONTAINER_ERROR', originalError);
        this.name = 'DockerContainerError';
    }
}

/**
 * Error thrown when a build operation fails
 */
export class DockerBuildError extends DockerError {
    constructor(message: string, public readonly buildOutput?: string, originalError?: Error) {
        super(message, 'BUILD_ERROR', originalError);
        this.name = 'DockerBuildError';
    }
}

// ============================================================================
// DockerClient Class
// ============================================================================

/**
 * Docker client wrapper providing high-level Docker operations
 * 
 * @example
 * ```typescript
 * const client = new DockerClient();
 * 
 * // Check connectivity
 * const connected = await client.ping();
 * 
 * // Build an image
 * await client.buildImage('./app', 'Dockerfile', 'myapp:latest', (progress) => {
 *   console.log(progress.stream);
 * });
 * 
 * // Create and start a container
 * const container = await client.createContainer({
 *   image: 'myapp:latest',
 *   name: 'my-container',
 *   ports: { 3000: 3000 }
 * });
 * await client.startContainer(container.id);
 * ```
 */
export class DockerClient {
    private docker: Docker;
    private timeout: number;

    /**
     * Creates a new DockerClient instance
     * 
     * @param options - Configuration options
     */
    constructor(options: DockerClientOptions = {}) {
        this.timeout = options.timeout ?? 30000;

        // Determine connection method
        const dockerHost = process.env.DOCKER_HOST;

        if (options.host) {
            // Use explicit host/port
            this.docker = new Docker({
                host: options.host,
                port: options.port ?? 2375,
                timeout: this.timeout
            });
        } else if (dockerHost) {
            // Parse DOCKER_HOST environment variable
            if (dockerHost.startsWith('unix://')) {
                this.docker = new Docker({
                    socketPath: dockerHost.replace('unix://', ''),
                    timeout: this.timeout
                });
            } else if (dockerHost.startsWith('tcp://')) {
                const url = new URL(dockerHost);
                this.docker = new Docker({
                    host: url.hostname,
                    port: parseInt(url.port) || 2375,
                    timeout: this.timeout
                });
            } else {
                this.docker = new Docker({
                    socketPath: options.socketPath ?? '/var/run/docker.sock',
                    timeout: this.timeout
                });
            }
        } else {
            // Default to socket
            this.docker = new Docker({
                socketPath: options.socketPath ?? '/var/run/docker.sock',
                timeout: this.timeout
            });
        }
    }

    /**
     * Verifies Docker daemon connectivity
     * 
     * @returns true if daemon is accessible, false otherwise
     */
    async ping(): Promise<boolean> {
        try {
            await this.docker.ping();
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Ensures Docker daemon is running, throws if not
     * 
     * @throws {DockerDaemonNotRunningError} If daemon is not accessible
     */
    async ensureConnected(): Promise<void> {
        try {
            await this.docker.ping();
        } catch (error) {
            const err = error as Error;
            if (this.isDaemonNotRunningError(err)) {
                throw new DockerDaemonNotRunningError(
                    'Docker daemon is not running. Please start Docker and try again.',
                    err
                );
            }
            throw new DockerError(
                `Failed to connect to Docker: ${err.message}`,
                'CONNECTION_ERROR',
                err
            );
        }
    }

    /**
     * Builds a Docker image from a context directory
     * 
     * @param contextPath - Path to the build context directory
     * @param dockerfile - Name of the Dockerfile (relative to context)
     * @param tag - Image tag (e.g., 'myapp:latest')
     * @param onProgress - Optional callback for progress updates
     * @returns The built image ID
     * @throws {DockerBuildError} If build fails
     */
    async buildImage(
        contextPath: string,
        dockerfile: string,
        tag: string,
        onProgress?: ProgressCallback
    ): Promise<string> {
        await this.ensureConnected();

        // Resolve absolute path
        const absoluteContextPath = path.resolve(contextPath);

        // Verify context exists
        if (!fs.existsSync(absoluteContextPath)) {
            throw new DockerBuildError(`Build context not found: ${absoluteContextPath}`);
        }

        // Verify Dockerfile exists
        const dockerfilePath = path.join(absoluteContextPath, dockerfile);
        if (!fs.existsSync(dockerfilePath)) {
            throw new DockerBuildError(`Dockerfile not found: ${dockerfilePath}`);
        }

        try {
            // Create tar stream of context
            const tarStream = tar.pack(absoluteContextPath);

            // Build image
            const stream = await this.docker.buildImage(tarStream, {
                t: tag,
                dockerfile: dockerfile
            });

            // Process build stream
            const imageId = await this.processBuildStream(stream, onProgress);

            if (!imageId) {
                throw new DockerBuildError('Build completed but no image ID was returned');
            }

            return imageId;
        } catch (error) {
            if (error instanceof DockerBuildError) {
                throw error;
            }
            const err = error as Error;
            throw new DockerBuildError(
                `Failed to build image: ${err.message}`,
                undefined,
                err
            );
        }
    }

    /**
     * Builds a Docker image from a Dockerfile string
     * 
     * @param dockerfileContent - The Dockerfile content as a string
     * @param tag - Image tag (e.g., 'myapp:latest')
     * @param files - Additional files to include in context (path -> content)
     * @param onProgress - Optional callback for progress updates
     * @returns The built image ID
     */
    async buildImageFromString(
        dockerfileContent: string,
        tag: string,
        files: Record<string, string> = {},
        onProgress?: ProgressCallback
    ): Promise<string> {
        await this.ensureConnected();

        try {
            // For simplicity, use a temp directory approach
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docker-build-'));

            try {
                // Write Dockerfile
                fs.writeFileSync(path.join(tempDir, 'Dockerfile'), dockerfileContent);

                // Write additional files
                for (const [filePath, content] of Object.entries(files)) {
                    const fullPath = path.join(tempDir, filePath);
                    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                    fs.writeFileSync(fullPath, content);
                }

                // Build using the temp directory
                return await this.buildImage(tempDir, 'Dockerfile', tag, onProgress);
            } finally {
                // Cleanup temp directory
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        } catch (error) {
            if (error instanceof DockerBuildError) {
                throw error;
            }
            const err = error as Error;
            throw new DockerBuildError(
                `Failed to build image from string: ${err.message}`,
                undefined,
                err
            );
        }
    }

    /**
     * Lists Docker images
     * 
     * @param filter - Optional filter (e.g., 'myapp' to match 'myapp:*')
     * @returns Array of image information
     */
    async listImages(filter?: string): Promise<ImageInfo[]> {
        await this.ensureConnected();

        try {
            const options: Docker.ListImagesOptions = { all: false };

            if (filter) {
                options.filters = {
                    reference: [filter.includes(':') ? filter : `${filter}:*`]
                };
            }

            const images = await this.docker.listImages(options);

            return images.map((img): ImageInfo => ({
                id: img.Id.replace('sha256:', '').substring(0, 12),
                tags: img.RepoTags?.filter(t => t !== '<none>:<none>') ?? [],
                size: img.Size,
                created: new Date(img.Created * 1000),
                parentId: img.ParentId ? img.ParentId.replace('sha256:', '').substring(0, 12) : undefined
            }));
        } catch (error) {
            const err = error as Error;
            throw new DockerImageError(
                `Failed to list images: ${err.message}`,
                undefined,
                err
            );
        }
    }

    /**
     * Removes a Docker image
     * 
     * @param imageId - Image ID or tag to remove
     * @param force - Force removal even if in use
     * @throws {DockerImageError} If removal fails
     */
    async removeImage(imageId: string, force: boolean = false): Promise<void> {
        await this.ensureConnected();

        try {
            const image = this.docker.getImage(imageId);
            await image.remove({ force });
        } catch (error) {
            const err = error as Error;
            if (err.message.includes('No such image')) {
                throw new DockerImageError(`Image not found: ${imageId}`, imageId, err);
            }
            if (err.message.includes('image is being used')) {
                throw new DockerImageError(
                    `Cannot remove image ${imageId}: it is in use by a container. Use force=true to override.`,
                    imageId,
                    err
                );
            }
            throw new DockerImageError(
                `Failed to remove image ${imageId}: ${err.message}`,
                imageId,
                err
            );
        }
    }

    /**
     * Creates a new container
     * 
     * @param config - Container configuration
     * @returns Container information
     * @throws {DockerContainerError} If creation fails
     */
    async createContainer(config: ContainerConfig): Promise<ContainerInfo> {
        await this.ensureConnected();

        try {
            // Build Docker API container config
            const containerConfig: Docker.ContainerCreateOptions = {
                Image: config.image,
                name: config.name,
                Cmd: config.cmd,
                WorkingDir: config.workingDir,
                Env: config.env
                    ? Object.entries(config.env).map(([k, v]) => `${k}=${v}`)
                    : undefined,
                HostConfig: {
                    AutoRemove: config.autoRemove ?? false,
                    NetworkMode: config.networkMode,
                    PortBindings: {},
                    Binds: []
                },
                ExposedPorts: {}
            };

            // Configure port mappings
            if (config.ports) {
                for (const [hostPort, containerPort] of Object.entries(config.ports)) {
                    const portKey = `${containerPort}/tcp`;
                    containerConfig.ExposedPorts![portKey] = {};
                    containerConfig.HostConfig!.PortBindings![portKey] = [
                        { HostPort: String(hostPort) }
                    ];
                }
            }

            // Configure volume mounts
            if (config.volumes) {
                containerConfig.HostConfig!.Binds = Object.entries(config.volumes)
                    .map(([hostPath, containerPath]) => `${hostPath}:${containerPath}`);
            }

            const container = await this.docker.createContainer(containerConfig);
            const info = await container.inspect();

            return this.parseContainerInfo(info);
        } catch (error) {
            const err = error as Error;
            if (err.message.includes('No such image')) {
                throw new DockerContainerError(
                    `Image not found: ${config.image}. Please pull or build the image first.`,
                    undefined,
                    err
                );
            }
            if (err.message.includes('name is already in use')) {
                throw new DockerContainerError(
                    `Container name "${config.name}" is already in use. Choose a different name or remove the existing container.`,
                    undefined,
                    err
                );
            }
            throw new DockerContainerError(
                `Failed to create container: ${err.message}`,
                undefined,
                err
            );
        }
    }

    /**
     * Starts a container
     * 
     * @param containerId - Container ID or name
     * @throws {DockerContainerError} If start fails
     */
    async startContainer(containerId: string): Promise<void> {
        await this.ensureConnected();

        try {
            const container = this.docker.getContainer(containerId);
            await container.start();
        } catch (error) {
            const err = error as Error;
            if (err.message.includes('No such container')) {
                throw new DockerContainerError(
                    `Container not found: ${containerId}`,
                    containerId,
                    err
                );
            }
            if (err.message.includes('already started')) {
                // Container is already running, not an error
                return;
            }
            throw new DockerContainerError(
                `Failed to start container ${containerId}: ${err.message}`,
                containerId,
                err
            );
        }
    }

    /**
     * Stops a container
     * 
     * @param containerId - Container ID or name
     * @param timeout - Seconds to wait before killing (default: 10)
     * @throws {DockerContainerError} If stop fails
     */
    async stopContainer(containerId: string, timeout: number = 10): Promise<void> {
        await this.ensureConnected();

        try {
            const container = this.docker.getContainer(containerId);
            await container.stop({ t: timeout });
        } catch (error) {
            const err = error as Error;
            if (err.message.includes('No such container')) {
                throw new DockerContainerError(
                    `Container not found: ${containerId}`,
                    containerId,
                    err
                );
            }
            if (err.message.includes('already stopped') || err.message.includes('not running')) {
                // Container is already stopped, not an error
                return;
            }
            throw new DockerContainerError(
                `Failed to stop container ${containerId}: ${err.message}`,
                containerId,
                err
            );
        }
    }

    /**
     * Removes a container
     * 
     * @param containerId - Container ID or name
     * @param force - Force removal of running container
     * @param removeVolumes - Remove associated volumes
     * @throws {DockerContainerError} If removal fails
     */
    async removeContainer(
        containerId: string,
        force: boolean = false,
        removeVolumes: boolean = false
    ): Promise<void> {
        await this.ensureConnected();

        try {
            const container = this.docker.getContainer(containerId);
            await container.remove({ force, v: removeVolumes });
        } catch (error) {
            const err = error as Error;
            if (err.message.includes('No such container')) {
                throw new DockerContainerError(
                    `Container not found: ${containerId}`,
                    containerId,
                    err
                );
            }
            if (err.message.includes('running')) {
                throw new DockerContainerError(
                    `Container ${containerId} is running. Stop it first or use force=true.`,
                    containerId,
                    err
                );
            }
            throw new DockerContainerError(
                `Failed to remove container ${containerId}: ${err.message}`,
                containerId,
                err
            );
        }
    }

    /**
     * Lists containers
     * 
     * @param all - Include stopped containers
     * @returns Array of container information
     */
    async listContainers(all: boolean = false): Promise<ContainerInfo[]> {
        await this.ensureConnected();

        try {
            const containers = await this.docker.listContainers({ all });

            return containers.map((c): ContainerInfo => ({
                id: c.Id.substring(0, 12),
                name: c.Names[0]?.replace(/^\//, '') ?? '',
                image: c.Image,
                state: c.State as ContainerInfo['state'],
                status: c.Status,
                ports: c.Ports.map(p => ({
                    host: p.PublicPort ?? 0,
                    container: p.PrivatePort,
                    protocol: p.Type
                })),
                created: new Date(c.Created * 1000)
            }));
        } catch (error) {
            const err = error as Error;
            throw new DockerContainerError(
                `Failed to list containers: ${err.message}`,
                undefined,
                err
            );
        }
    }

    /**
     * Gets container logs
     * 
     * @param containerId - Container ID or name
     * @param tail - Number of lines to return (default: all)
     * @returns Container logs as string
     */
    async getContainerLogs(containerId: string, tail?: number): Promise<string> {
        await this.ensureConnected();

        try {
            const container = this.docker.getContainer(containerId);
            const logsOptions: { stdout: boolean; stderr: boolean; tail?: number; follow: false } = {
                stdout: true,
                stderr: true,
                follow: false as const
            };
            if (tail !== undefined) {
                logsOptions.tail = tail;
            }
            const logs = await container.logs(logsOptions);

            // Dockerode returns a Buffer or string
            if (Buffer.isBuffer(logs)) {
                return this.demuxDockerStream(logs);
            }
            return String(logs);
        } catch (error) {
            const err = error as Error;
            if (err.message.includes('No such container')) {
                throw new DockerContainerError(
                    `Container not found: ${containerId}`,
                    containerId,
                    err
                );
            }
            throw new DockerContainerError(
                `Failed to get logs for container ${containerId}: ${err.message}`,
                containerId,
                err
            );
        }
    }

    /**
     * Gets Docker system information
     */
    async getInfo(): Promise<{
        containers: number;
        images: number;
        serverVersion: string;
        operatingSystem: string;
        architecture: string;
        memoryLimit: number;
        cpus: number;
    }> {
        await this.ensureConnected();

        const info = await this.docker.info();

        return {
            containers: info.Containers,
            images: info.Images,
            serverVersion: info.ServerVersion,
            operatingSystem: info.OperatingSystem,
            architecture: info.Architecture,
            memoryLimit: info.MemTotal,
            cpus: info.NCPU
        };
    }

    // ============================================================================
    // Private Helper Methods
    // ============================================================================

    /**
     * Processes the build stream and extracts progress/image ID
     */
    private async processBuildStream(
        stream: NodeJS.ReadableStream,
        onProgress?: ProgressCallback
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            let imageId: string | undefined;
            let buildOutput = '';
            let errorMessage: string | undefined;

            this.docker.modem.followProgress(
                stream,
                (err: Error | null, output: BuildProgress[]) => {
                    if (err) {
                        reject(new DockerBuildError(
                            `Build failed: ${err.message}`,
                            buildOutput,
                            err
                        ));
                        return;
                    }

                    if (errorMessage) {
                        reject(new DockerBuildError(errorMessage, buildOutput));
                        return;
                    }

                    if (!imageId) {
                        // Try to extract image ID from output
                        for (const item of output) {
                            if (item.stream?.includes('Successfully built')) {
                                const match = item.stream.match(/Successfully built ([a-f0-9]+)/);
                                if (match) {
                                    imageId = match[1];
                                }
                            }
                            // Also check aux field for image ID
                            if ((item as any).aux?.ID) {
                                imageId = (item as any).aux.ID.replace('sha256:', '').substring(0, 12);
                            }
                        }
                    }

                    resolve(imageId || '');
                },
                (progress: BuildProgress) => {
                    // Accumulate output
                    if (progress.stream) {
                        buildOutput += progress.stream;
                    }

                    // Check for errors
                    if (progress.error || progress.errorDetail) {
                        errorMessage = progress.error || progress.errorDetail?.message || 'Unknown build error';
                    }

                    // Extract image ID from stream
                    if (progress.stream?.includes('Successfully built')) {
                        const match = progress.stream.match(/Successfully built ([a-f0-9]+)/);
                        if (match) {
                            imageId = match[1];
                        }
                    }

                    // Check aux for image ID
                    if ((progress as any).aux?.ID) {
                        imageId = (progress as any).aux.ID.replace('sha256:', '').substring(0, 12);
                    }

                    // Call progress callback
                    if (onProgress) {
                        onProgress(progress);
                    }
                }
            );
        });
    }

    /**
     * Parses container inspect data to ContainerInfo
     */
    private parseContainerInfo(info: Docker.ContainerInspectInfo): ContainerInfo {
        const ports: ContainerInfo['ports'] = [];

        if (info.NetworkSettings?.Ports) {
            for (const [containerPort, bindings] of Object.entries(info.NetworkSettings.Ports)) {
                const [portStr, protocolStr] = containerPort.split('/');
                const port = portStr || '0';
                const protocol = protocolStr || 'tcp';
                if (bindings) {
                    for (const binding of bindings) {
                        ports.push({
                            host: parseInt(binding.HostPort),
                            container: parseInt(port),
                            protocol
                        });
                    }
                }
            }
        }

        return {
            id: info.Id.substring(0, 12),
            name: info.Name.replace(/^\//, ''),
            image: info.Config.Image,
            state: info.State.Status as ContainerInfo['state'],
            status: info.State.Status,
            ports,
            created: new Date(info.Created)
        };
    }

    /**
     * Demultiplexes Docker stream output (separates stdout/stderr)
     */
    private demuxDockerStream(buffer: Buffer): string {
        const output: string[] = [];
        let offset = 0;

        while (offset < buffer.length) {
            // Docker stream format: 8-byte header + payload
            // Header: [stream type (1), 0, 0, 0, size (4 bytes BE)]
            if (offset + 8 > buffer.length) break;

            const size = buffer.readUInt32BE(offset + 4);
            offset += 8;

            if (offset + size > buffer.length) break;

            const chunk = buffer.slice(offset, offset + size).toString('utf8');
            output.push(chunk);
            offset += size;
        }

        // If demux failed, return raw string
        if (output.length === 0) {
            return buffer.toString('utf8');
        }

        return output.join('');
    }

    /**
     * Checks if an error indicates Docker daemon is not running
     */
    private isDaemonNotRunningError(error: Error): boolean {
        const message = error.message.toLowerCase();
        return (
            message.includes('enoent') ||
            message.includes('econnrefused') ||
            message.includes('cannot connect') ||
            message.includes('is the docker daemon running') ||
            message.includes('connection refused') ||
            message.includes('socket hang up') ||
            message.includes('eperm')
        );
    }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Creates a DockerClient with default options
 */
export function createDockerClient(options?: DockerClientOptions): DockerClient {
    return new DockerClient(options);
}

/**
 * Quick check if Docker is available
 */
export async function isDockerAvailable(): Promise<boolean> {
    const client = new DockerClient();
    return client.ping();
}
