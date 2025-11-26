/**
 * Registry Module
 * 
 * Provides Docker image tagging, registry push operations, and image management.
 * Supports Docker Hub, GitHub Container Registry (ghcr.io), and private registries.
 * 
 * @module registry
 */

import Docker from 'dockerode';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Authentication credentials for Docker registries
 */
export interface RegistryAuth {
    /** Registry username */
    username: string;
    /** Registry password or token */
    password: string;
    /** Registry server address (e.g., 'ghcr.io', 'docker.io') */
    serveraddress?: string;
    /** Email (required by some registries) */
    email?: string;
}

/**
 * Options for tagging images
 */
export interface TagOptions {
    /** Use manifest version for tag (e.g., v1.0.0) */
    version?: string;
    /** Add timestamp tag (e.g., 20251126-143022) */
    timestamp?: boolean;
    /** Add :latest tag */
    latest?: boolean;
    /** Custom prefix for tags (e.g., 'my-app' -> 'my-app:latest') */
    prefix?: string;
}

/**
 * Options for push operations
 */
export interface PushOptions {
    /** Preview only, don't actually push */
    dryRun?: boolean;
    /** Callback for progress updates */
    onProgress?: (event: PushProgressEvent) => void;
}

/**
 * Progress event during push operation
 */
export interface PushProgressEvent {
    /** Status message */
    status: string;
    /** Progress percentage (0-100) */
    progress?: number;
    /** Layer ID being pushed */
    layer?: string;
    /** Error message if any */
    error?: string;
}

/**
 * Information about a local Docker image
 */
export interface ImageInfo {
    /** Image ID (short form) */
    id: string;
    /** Full image ID (sha256:...) */
    fullId: string;
    /** Repository tags */
    tags: string[];
    /** Image size in bytes */
    size: number;
    /** Size in human-readable format */
    sizeFormatted: string;
    /** Creation timestamp */
    created: Date;
    /** Creation timestamp formatted */
    createdFormatted: string;
}

/**
 * Result of a tag operation
 */
export interface TagResult {
    /** Original image ID */
    imageId: string;
    /** Tags that were applied */
    appliedTags: string[];
    /** Tags that failed to apply */
    failedTags: { tag: string; error: string }[];
}

/**
 * Result of a prune operation
 */
export interface PruneResult {
    /** Images that were removed */
    removed: string[];
    /** Images that were kept */
    kept: string[];
    /** Space reclaimed in bytes */
    spaceReclaimed: number;
    /** Space reclaimed in human-readable format */
    spaceReclaimedFormatted: string;
}

// ============================================================================
// Custom Errors
// ============================================================================

/**
 * Base class for registry-related errors
 */
export class RegistryError extends Error {
    constructor(
        message: string,
        public readonly code?: string,
        public readonly originalError?: Error
    ) {
        super(message);
        this.name = 'RegistryError';
    }
}

/**
 * Error thrown when tagging fails
 */
export class TagError extends RegistryError {
    constructor(
        message: string,
        public readonly imageId?: string,
        public readonly tag?: string,
        originalError?: Error
    ) {
        super(message, 'TAG_ERROR', originalError);
        this.name = 'TagError';
    }
}

/**
 * Error thrown when push fails
 */
export class PushError extends RegistryError {
    constructor(
        message: string,
        public readonly tag?: string,
        public readonly registry?: string,
        originalError?: Error
    ) {
        super(message, 'PUSH_ERROR', originalError);
        this.name = 'PushError';
    }
}

/**
 * Error thrown when authentication fails
 */
export class AuthenticationError extends RegistryError {
    constructor(
        message: string,
        public readonly registry?: string,
        originalError?: Error
    ) {
        super(message, 'AUTH_ERROR', originalError);
        this.name = 'AuthenticationError';
    }
}

/**
 * Error thrown when tag validation fails
 */
export class TagValidationError extends RegistryError {
    constructor(
        message: string,
        public readonly invalidTag?: string,
        originalError?: Error
    ) {
        super(message, 'VALIDATION_ERROR', originalError);
        this.name = 'TagValidationError';
    }
}

// ============================================================================
// Tag Validation
// ============================================================================

/**
 * Docker tag naming conventions:
 * - Repository name: lowercase letters, digits, separators (., -, _)
 * - Tag: max 128 characters, letters, digits, underscores, periods, hyphens
 * - Cannot start with period or hyphen
 */

/**
 * Validates a Docker image tag
 * 
 * @param tag - The tag to validate
 * @returns true if valid, throws TagValidationError if invalid
 */
export function validateTag(tag: string): boolean {
    // Check for empty tag
    if (!tag || tag.trim() === '') {
        throw new TagValidationError('Tag cannot be empty', tag);
    }

    // Split into repository and tag parts
    const parts = tag.split(':');
    if (parts.length > 2) {
        throw new TagValidationError(
            'Tag cannot contain more than one colon',
            tag
        );
    }

    const [repository, tagPart] = parts;

    // Validate repository name
    if (!repository) {
        throw new TagValidationError('Repository name cannot be empty', tag);
    }

    // Repository pattern: lowercase alphanumeric, with separators
    // Can include registry prefix like ghcr.io/user/repo
    const repoPattern = /^[a-z0-9]([a-z0-9._\/-]*[a-z0-9])?$/;
    if (!repoPattern.test(repository)) {
        throw new TagValidationError(
            `Invalid repository name: ${repository}. Repository names must be lowercase and can contain letters, digits, and separators (. - _ /)`,
            tag
        );
    }

    // Validate tag part if present
    if (tagPart !== undefined) {
        if (tagPart === '') {
            throw new TagValidationError('Tag part cannot be empty after colon', tag);
        }

        // Tag max length is 128 characters
        if (tagPart.length > 128) {
            throw new TagValidationError(
                `Tag exceeds maximum length of 128 characters: ${tagPart.length}`,
                tag
            );
        }

        // Tag pattern: alphanumeric, underscores, periods, hyphens
        // Cannot start with period or hyphen
        const tagPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
        if (!tagPattern.test(tagPart)) {
            throw new TagValidationError(
                `Invalid tag format: ${tagPart}. Tags must start with alphanumeric and can contain letters, digits, underscores, periods, and hyphens`,
                tag
            );
        }
    }

    return true;
}

/**
 * Sanitizes a string for use in a Docker tag
 * 
 * @param input - The string to sanitize
 * @returns Sanitized string safe for Docker tag
 */
export function sanitizeTagComponent(input: string): string {
    // Handle empty input
    if (!input || input.trim() === '') {
        return 'latest';
    }

    // Convert to lowercase
    let sanitized = input.toLowerCase();

    // Replace invalid characters with hyphens
    sanitized = sanitized.replace(/[^a-z0-9._-]/g, '-');

    // Remove leading/trailing hyphens and periods
    sanitized = sanitized.replace(/^[.-]+|[.-]+$/g, '');

    // Replace multiple consecutive hyphens with single hyphen
    sanitized = sanitized.replace(/-+/g, '-');

    // If nothing left after sanitization, return default
    if (!sanitized) {
        return 'latest';
    }

    // Ensure it starts with alphanumeric
    if (!/^[a-z0-9]/.test(sanitized)) {
        sanitized = 'x' + sanitized;
    }

    // Truncate to 128 characters
    if (sanitized.length > 128) {
        sanitized = sanitized.substring(0, 128);
    }

    return sanitized;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generates a timestamp tag in format YYYYMMDD-HHMMSS
 */
export function generateTimestampTag(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

/**
 * Formats bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Formats a date relative to now
 */
export function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'just now';
}

/**
 * Gets the default registry based on the image name
 */
export function getDefaultRegistry(imageName: string): string {
    if (imageName.startsWith('ghcr.io/')) return 'ghcr.io';
    if (imageName.startsWith('gcr.io/')) return 'gcr.io';
    if (imageName.startsWith('quay.io/')) return 'quay.io';
    if (imageName.includes('.')) {
        // Extract registry from image name
        const parts = imageName.split('/');
        const firstPart = parts[0];
        if (parts.length > 1 && firstPart && firstPart.includes('.')) {
            return firstPart;
        }
    }
    return 'docker.io';
}

// ============================================================================
// Registry Operations
// ============================================================================

/**
 * Registry class for Docker image operations
 */
export class Registry {
    private docker: Docker;

    /**
     * Creates a new Registry instance
     * 
     * @param socketPath - Optional Docker socket path
     */
    constructor(socketPath?: string) {
        this.docker = new Docker({
            socketPath: socketPath ?? '/var/run/docker.sock'
        });
    }

    /**
     * Tags a Docker image with one or more tags
     * 
     * @param imageId - The image ID or existing tag to tag
     * @param tags - Array of tags to apply (e.g., ['myapp:latest', 'myapp:v1.0.0'])
     * @returns Result object with applied and failed tags
     */
    async tagImage(imageId: string, tags: string[]): Promise<TagResult> {
        const result: TagResult = {
            imageId,
            appliedTags: [],
            failedTags: []
        };

        if (!tags || tags.length === 0) {
            throw new TagError('At least one tag must be provided', imageId);
        }

        // Validate all tags first
        for (const tag of tags) {
            try {
                validateTag(tag);
            } catch (error) {
                if (error instanceof TagValidationError) {
                    result.failedTags.push({ tag, error: error.message });
                } else {
                    throw error;
                }
            }
        }

        // Get the image
        const image = this.docker.getImage(imageId);

        // Apply valid tags
        for (const tag of tags) {
            // Skip tags that failed validation
            if (result.failedTags.some(f => f.tag === tag)) {
                continue;
            }

            try {
                // Parse tag into repo and tag parts
                const parts = tag.includes(':') ? tag.split(':') : [tag, 'latest'];
                const repo = parts[0] ?? tag;
                const tagPart = parts[1] ?? 'latest';

                await image.tag({ repo, tag: tagPart });
                result.appliedTags.push(tag);
            } catch (error) {
                const err = error as Error;
                result.failedTags.push({
                    tag,
                    error: err.message || 'Unknown error'
                });
            }
        }

        return result;
    }

    /**
     * Creates standard tags for an MCP server image
     * 
     * @param imageId - The image ID to tag
     * @param options - Tagging options
     * @returns Array of created tags
     */
    async createStandardTags(imageId: string, options: TagOptions = {}): Promise<string[]> {
        const prefix = options.prefix ?? 'mcp-server';
        const tags: string[] = [];

        // Add :latest tag
        if (options.latest !== false) {
            tags.push(`${prefix}:latest`);
        }

        // Add version tag (e.g., v1.0.0)
        if (options.version) {
            const versionTag = options.version.startsWith('v')
                ? options.version
                : `v${options.version}`;
            tags.push(`${prefix}:${versionTag}`);
        }

        // Add timestamp tag
        if (options.timestamp !== false) {
            tags.push(`${prefix}:${generateTimestampTag()}`);
        }

        // Apply all tags
        const result = await this.tagImage(imageId, tags);

        if (result.failedTags.length > 0) {
            const failures = result.failedTags.map(f => `${f.tag}: ${f.error}`).join(', ');
            throw new TagError(
                `Some tags failed to apply: ${failures}`,
                imageId
            );
        }

        return result.appliedTags;
    }

    /**
     * Pushes an image to a registry
     * 
     * @param tag - The image tag to push (e.g., 'ghcr.io/user/myapp:latest')
     * @param registry - The registry to push to
     * @param auth - Optional authentication credentials
     * @param options - Push options
     */
    async pushImage(
        tag: string,
        registry: string,
        auth?: RegistryAuth,
        options: PushOptions = {}
    ): Promise<void> {
        // Validate tag
        validateTag(tag);

        // Dry run mode
        if (options.dryRun) {
            if (options.onProgress) {
                options.onProgress({
                    status: `[DRY RUN] Would push ${tag} to ${registry}`
                });
            }
            return;
        }

        try {
            const image = this.docker.getImage(tag);

            // Prepare auth config if provided
            const authconfig = auth ? {
                username: auth.username,
                password: auth.password,
                serveraddress: auth.serveraddress ?? registry,
                email: auth.email
            } : undefined;

            // Push the image
            const stream = await image.push({ authconfig });

            // Process the push stream
            await this.processPushStream(stream, options.onProgress);
        } catch (error) {
            const err = error as Error;

            // Check for authentication errors
            if (err.message.includes('unauthorized') ||
                err.message.includes('authentication required') ||
                err.message.includes('denied')) {
                throw new AuthenticationError(
                    `Authentication failed for registry ${registry}: ${err.message}`,
                    registry,
                    err
                );
            }

            throw new PushError(
                `Failed to push ${tag} to ${registry}: ${err.message}`,
                tag,
                registry,
                err
            );
        }
    }

    /**
     * Processes the push stream and reports progress
     */
    private processPushStream(
        stream: NodeJS.ReadableStream,
        onProgress?: (event: PushProgressEvent) => void
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            this.docker.modem.followProgress(
                stream,
                (err: Error | null) => {
                    if (err) {
                        reject(new PushError(`Push failed: ${err.message}`));
                    } else {
                        resolve();
                    }
                },
                (event: any) => {
                    if (onProgress) {
                        const progressEvent: PushProgressEvent = {
                            status: event.status || '',
                            layer: event.id,
                            error: event.error
                        };

                        // Parse progress if available
                        if (event.progressDetail?.current && event.progressDetail?.total) {
                            progressEvent.progress = Math.round(
                                (event.progressDetail.current / event.progressDetail.total) * 100
                            );
                        }

                        onProgress(progressEvent);
                    }

                    // Check for errors in the stream
                    if (event.error) {
                        reject(new PushError(event.error));
                    }
                }
            );
        });
    }

    /**
     * Lists local Docker images with optional prefix filter
     * 
     * @param prefix - Optional prefix to filter images (e.g., 'mcp-server')
     * @returns Array of image information
     */
    async listLocalImages(prefix?: string): Promise<ImageInfo[]> {
        try {
            const options: Docker.ListImagesOptions = { all: false };

            if (prefix) {
                options.filters = {
                    reference: [`${prefix}:*`, prefix]
                };
            }

            const images = await this.docker.listImages(options);

            return images
                .filter(img => img.RepoTags && img.RepoTags.length > 0 && img.RepoTags[0] !== '<none>:<none>')
                .map((img): ImageInfo => {
                    const created = new Date(img.Created * 1000);
                    return {
                        id: img.Id.replace('sha256:', '').substring(0, 12),
                        fullId: img.Id,
                        tags: img.RepoTags?.filter(t => t !== '<none>:<none>') ?? [],
                        size: img.Size,
                        sizeFormatted: formatBytes(img.Size),
                        created,
                        createdFormatted: formatRelativeTime(created)
                    };
                })
                .sort((a, b) => b.created.getTime() - a.created.getTime());
        } catch (error) {
            const err = error as Error;
            throw new RegistryError(
                `Failed to list images: ${err.message}`,
                'LIST_ERROR',
                err
            );
        }
    }

    /**
     * Prunes old images, keeping the specified number of most recent images
     * 
     * @param keepCount - Number of most recent images to keep
     * @param prefix - Optional prefix to filter which images to prune
     * @returns Prune result with removed images and space reclaimed
     */
    async pruneOldImages(keepCount: number, prefix?: string): Promise<PruneResult> {
        if (keepCount < 0) {
            throw new RegistryError('keepCount must be non-negative', 'INVALID_ARGUMENT');
        }

        const result: PruneResult = {
            removed: [],
            kept: [],
            spaceReclaimed: 0,
            spaceReclaimedFormatted: '0 B'
        };

        try {
            // Get all images with the prefix
            const images = await this.listLocalImages(prefix);

            // Sort by creation date (newest first) - already sorted
            // Keep the first 'keepCount' images
            const toKeep = images.slice(0, keepCount);
            const toRemove = images.slice(keepCount);

            result.kept = toKeep.flatMap(img => img.tags);

            // Remove old images
            for (const image of toRemove) {
                try {
                    const dockerImage = this.docker.getImage(image.fullId);
                    await dockerImage.remove({ force: false });
                    result.removed.push(...image.tags);
                    result.spaceReclaimed += image.size;
                } catch (error) {
                    // Image might be in use, skip it
                    const err = error as Error;
                    if (!err.message.includes('image is being used')) {
                        // If it's not "in use" error, add to kept
                        result.kept.push(...image.tags);
                    }
                }
            }

            result.spaceReclaimedFormatted = formatBytes(result.spaceReclaimed);
            return result;
        } catch (error) {
            if (error instanceof RegistryError) {
                throw error;
            }
            const err = error as Error;
            throw new RegistryError(
                `Failed to prune images: ${err.message}`,
                'PRUNE_ERROR',
                err
            );
        }
    }

    /**
     * Removes a specific image tag
     * 
     * @param tag - The image tag to remove
     * @param force - Force removal even if in use
     */
    async removeImage(tag: string, force: boolean = false): Promise<void> {
        try {
            const image = this.docker.getImage(tag);
            await image.remove({ force });
        } catch (error) {
            const err = error as Error;
            if (err.message.includes('No such image')) {
                throw new RegistryError(`Image not found: ${tag}`, 'NOT_FOUND', err);
            }
            if (err.message.includes('image is being used')) {
                throw new RegistryError(
                    `Image ${tag} is in use. Use force=true to remove anyway.`,
                    'IN_USE',
                    err
                );
            }
            throw new RegistryError(
                `Failed to remove image ${tag}: ${err.message}`,
                'REMOVE_ERROR',
                err
            );
        }
    }

    /**
     * Checks if Docker daemon is available
     */
    async isAvailable(): Promise<boolean> {
        try {
            await this.docker.ping();
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Gets registry authentication for common registries
     * 
     * @param registry - The registry name
     * @returns Authentication config or undefined
     */
    static getAuthFromEnv(registry: string): RegistryAuth | undefined {
        // Check for registry-specific env vars
        const normalizedRegistry = registry.toLowerCase().replace(/[^a-z]/g, '_').toUpperCase();

        // Check common patterns
        const patterns: [string, string][] = [
            // DOCKER_HUB_USERNAME, DOCKER_HUB_PASSWORD
            [`${normalizedRegistry}_USERNAME`, `${normalizedRegistry}_PASSWORD`],
            // REGISTRY_USERNAME, REGISTRY_PASSWORD
            ['REGISTRY_USERNAME', 'REGISTRY_PASSWORD'],
            // DOCKER_USERNAME, DOCKER_PASSWORD
            ['DOCKER_USERNAME', 'DOCKER_PASSWORD']
        ];

        for (const pattern of patterns) {
            const userVar = pattern[0];
            const passVar = pattern[1];
            const username = process.env[userVar];
            const password = process.env[passVar];
            if (username && password) {
                return {
                    username,
                    password,
                    serveraddress: registry
                };
            }
        }

        // Check for GitHub Container Registry
        if (registry === 'ghcr.io') {
            const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
            const username = process.env.GITHUB_ACTOR || process.env.GITHUB_USER;
            if (token && username) {
                return {
                    username,
                    password: token,
                    serveraddress: 'ghcr.io'
                };
            }
        }

        return undefined;
    }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Creates a new Registry instance with default options
 */
export function createRegistry(socketPath?: string): Registry {
    return new Registry(socketPath);
}

/**
 * Tags an image with standard MCP server tags
 */
export async function tagImage(imageId: string, tags: string[]): Promise<TagResult> {
    const registry = new Registry();
    return registry.tagImage(imageId, tags);
}

/**
 * Pushes an image to a registry
 */
export async function pushImage(
    tag: string,
    registry: string,
    auth?: RegistryAuth,
    options?: PushOptions
): Promise<void> {
    const reg = new Registry();
    return reg.pushImage(tag, registry, auth, options);
}

/**
 * Lists local images with optional prefix filter
 */
export async function listLocalImages(prefix?: string): Promise<ImageInfo[]> {
    const registry = new Registry();
    return registry.listLocalImages(prefix);
}

/**
 * Prunes old images, keeping the specified count
 */
export async function pruneOldImages(keepCount: number, prefix?: string): Promise<PruneResult> {
    const registry = new Registry();
    return registry.pruneOldImages(keepCount, prefix);
}
