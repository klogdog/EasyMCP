/**
 * Main Orchestrator for MCP Generator
 *
 * This module coordinates the entire MCP server generation workflow.
 * It manages loading, validation, manifest generation, config generation,
 * Docker image building, and tagging/pushing operations.
 *
 * @module main
 */

import * as fsp from "fs/promises";
import * as path from "path";
import { loadModules, Module } from "./loader";
import { validateModules } from "./validator";
import { generateManifest, saveManifest, MCPManifest } from "./generator";
import { generateConfig } from "./config-generator";
import {
    generateDockerfile,
    analyzeModules,
    buildMCPImage,
    BuildOptions as DockerBuildOptions,
} from "./dockerizer";
import {
    DockerClient,
    DockerBuildError,
    DockerDaemonNotRunningError,
} from "./docker-client";
import { tagImage, pushImage, PushOptions } from "./registry";
import { promptForCredentials } from "./prompt";
import { discoverCredentialRequirements } from "./credential-discovery";

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Status of a build step
 */
export type BuildStepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

/**
 * Information about a build step
 */
export interface BuildStep {
    /** Step number (1-indexed) */
    number: number;
    /** Total number of steps */
    total: number;
    /** Step name */
    name: string;
    /** Current status */
    status: BuildStepStatus;
    /** Start timestamp */
    startedAt?: Date;
    /** Completion timestamp */
    completedAt?: Date;
    /** Duration in milliseconds */
    duration?: number;
    /** Error message if failed */
    error?: string;
}

/**
 * Progress callback for build steps
 */
export type ProgressCallback = (step: BuildStep, message: string) => void;

/**
 * Options for the MCP server generator
 */
export interface GeneratorOptions {
    /** Base path for finding tools and connectors */
    basePath: string;
    /** Path to configuration file (optional) */
    configPath?: string;
    /** Custom tools directory */
    toolsDir?: string;
    /** Custom connectors directory */
    connectorsDir?: string;
    /** Disable caching for Docker build */
    noCache?: boolean;
    /** Dry run mode - don't execute Docker commands */
    dryRun?: boolean;
    /** Output image name */
    imageName?: string;
    /** Image tag */
    imageTag?: string;
    /** Target platforms for multi-arch build */
    platforms?: string[];
    /** Push to registry after build */
    push?: boolean;
    /** Registry URL for pushing */
    registryUrl?: string;
    /** Skip credential prompts (use environment variables) */
    skipPrompts?: boolean;
    /** Verbosity level (0-3) */
    verbosity?: number;
    /** Progress callback */
    onProgress?: ProgressCallback;
    /** Environment (development or production) */
    environment?: "development" | "production";
}

/**
 * Result of the MCP server build
 */
export interface BuildResult {
    /** Whether the build succeeded */
    success: boolean;
    /** Docker image ID */
    imageId?: string;
    /** Full image name (with registry) */
    imageName?: string;
    /** Tags applied to the image */
    tags?: string[];
    /** Number of tools included */
    toolCount: number;
    /** Number of connectors included */
    connectorCount: number;
    /** Path to generated manifest */
    manifestPath?: string;
    /** Path to generated config */
    configPath?: string;
    /** Path to generated Dockerfile */
    dockerfilePath?: string;
    /** Errors encountered during build */
    errors?: string[];
    /** Warnings from the build */
    warnings?: string[];
    /** Total build duration in milliseconds */
    duration?: number;
    /** Individual step results */
    steps?: BuildStep[];
}

/**
 * Checkpoint data saved between build steps
 */
interface CheckpointData {
    /** Current step number */
    step: number;
    /** Step name */
    stepName: string;
    /** Timestamp */
    timestamp: string;
    /** Path to manifest (if generated) */
    manifestPath?: string;
    /** Path to config (if generated) */
    configPath?: string;
    /** Path to Dockerfile (if generated) */
    dockerfilePath?: string;
    /** Image ID (if built) */
    imageId?: string;
    /** Loaded modules */
    moduleNames?: string[];
}

// ============================================================================
// Build Step Definitions
// ============================================================================

const BUILD_STEPS = [
    "Loading modules",
    "Validating modules",
    "Collecting credentials",
    "Generating manifest",
    "Generating configuration",
    "Generating Dockerfile",
    "Building Docker image",
    "Tagging and pushing",
] as const;

const TOTAL_STEPS = BUILD_STEPS.length;

// ============================================================================
// Checkpoint Management
// ============================================================================

const CHECKPOINT_FILE = ".mcp-build-checkpoint.json";

/**
 * Save a checkpoint to disk
 */
async function saveCheckpoint(
    basePath: string,
    data: CheckpointData
): Promise<void> {
    const checkpointPath = path.join(basePath, CHECKPOINT_FILE);
    await fsp.writeFile(checkpointPath, JSON.stringify(data, null, 2));
}

/**
 * Load a checkpoint from disk
 */
async function loadCheckpoint(basePath: string): Promise<CheckpointData | null> {
    try {
        const checkpointPath = path.join(basePath, CHECKPOINT_FILE);
        const content = await fsp.readFile(checkpointPath, "utf-8");
        return JSON.parse(content);
    } catch {
        return null;
    }
}

/**
 * Clear the checkpoint file
 */
async function clearCheckpoint(basePath: string): Promise<void> {
    try {
        const checkpointPath = path.join(basePath, CHECKPOINT_FILE);
        await fsp.unlink(checkpointPath);
    } catch {
        // File may not exist
    }
}

/**
 * Check if a previous build can be resumed
 */
export async function canResumeBuild(basePath: string): Promise<{
    canResume: boolean;
    checkpoint?: CheckpointData;
    message?: string;
}> {
    const checkpoint = await loadCheckpoint(basePath);

    if (!checkpoint) {
        return { canResume: false };
    }

    // Check if checkpoint is too old (more than 1 hour)
    const checkpointTime = new Date(checkpoint.timestamp);
    const now = new Date();
    const hoursDiff =
        (now.getTime() - checkpointTime.getTime()) / (1000 * 60 * 60);

    if (hoursDiff > 1) {
        return {
            canResume: false,
            message: "Previous build checkpoint is too old (> 1 hour)",
        };
    }

    return {
        canResume: true,
        checkpoint,
        message: `Can resume from step ${checkpoint.step}: ${checkpoint.stepName}`,
    };
}

// ============================================================================
// Rollback Functions
// ============================================================================

/**
 * Clean up generated files on failure
 */
async function rollback(
    basePath: string,
    generatedFiles: string[],
    imageId?: string
): Promise<void> {
    // Remove generated files
    for (const file of generatedFiles) {
        try {
            await fsp.unlink(file);
        } catch {
            // File may not exist
        }
    }

    // Remove partial Docker image if it exists
    if (imageId) {
        try {
            const docker = new DockerClient();
            await docker.removeImage(imageId, true);
        } catch {
            // Image may not exist or be in use
        }
    }

    // Clear checkpoint
    await clearCheckpoint(basePath);
}

// ============================================================================
// Main Generator Function
// ============================================================================

/**
 * Generate an MCP server from tools and connectors
 *
 * This function orchestrates the entire build process:
 * 1. Load modules from tools/ and connectors/ directories
 * 2. Validate modules against MCP specification
 * 3. Prompt for required credentials (or use env vars)
 * 4. Generate MCP manifest (mcp-manifest.json)
 * 5. Generate runtime configuration (config.yaml)
 * 6. Generate Dockerfile
 * 7. Build Docker image
 * 8. Tag and optionally push to registry
 *
 * @param options - Generator options
 * @returns Build result with image details and any errors
 */
export async function generateMCPServer(
    options: GeneratorOptions
): Promise<BuildResult> {
    const startTime = Date.now();
    const generatedFiles: string[] = [];
    const steps: BuildStep[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    // Initialize step tracking
    const createStep = (number: number): BuildStep => ({
        number,
        total: TOTAL_STEPS,
        name: BUILD_STEPS[number - 1] || "Unknown step",
        status: "pending",
    });

    const updateStep = (
        step: BuildStep,
        status: BuildStepStatus,
        message?: string
    ): void => {
        step.status = status;
        if (status === "running") {
            step.startedAt = new Date();
        } else if (status === "completed" || status === "failed") {
            step.completedAt = new Date();
            if (step.startedAt) {
                step.duration = step.completedAt.getTime() - step.startedAt.getTime();
            }
        }
        if (status === "failed" && message) {
            step.error = message;
        }
        if (options.onProgress) {
            options.onProgress(step, message || step.name);
        }
    };

    // Initialize all steps
    for (let i = 1; i <= TOTAL_STEPS; i++) {
        steps.push(createStep(i));
    }

    // Helper function to get step with type assertion
    const getStep = (index: number): BuildStep => {
        const step = steps[index];
        if (!step) {
            throw new Error(`Step ${index + 1} not initialized`);
        }
        return step;
    };

    let modules: Module[] = [];
    let manifest: MCPManifest | null = null;
    let imageId: string | undefined;
    let imageName: string | undefined;
    let tags: string[] = [];

    try {
        // ============================================================
        // Step 1: Load Modules
        // ============================================================
        const step1 = getStep(0);
        updateStep(step1, "running", "Loading modules from tools/ and connectors/...");

        try {
            modules = await loadModules(options.basePath);

            if (modules.length === 0) {
                throw new Error(
                    "No modules found. Place tool or connector files in tools/ and connectors/ directories."
                );
            }

            updateStep(
                step1,
                "completed",
                `Loaded ${modules.length} module(s)`
            );

            // Save checkpoint
            await saveCheckpoint(options.basePath, {
                step: 1,
                stepName: "Loading modules",
                timestamp: new Date().toISOString(),
                moduleNames: modules.map((m) => m.name),
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            updateStep(step1, "failed", message);
            errors.push(message);
            throw err;
        }

        // ============================================================
        // Step 2: Validate Modules
        // ============================================================
        const step2 = getStep(1);
        updateStep(step2, "running", "Validating module definitions...");

        try {
            const validationResult = validateModules(modules);

            if (!validationResult.valid) {
                const errorMessages = validationResult.errors.map(
                    (e) => `${e.moduleName}: ${e.message}`
                );
                throw new Error(
                    `Validation failed:\n  - ${errorMessages.join("\n  - ")}`
                );
            }

            // Collect warnings
            warnings.push(...validationResult.warnings);

            updateStep(
                step2,
                "completed",
                `Validated ${modules.length} module(s)` +
                (warnings.length > 0 ? ` with ${warnings.length} warning(s)` : "")
            );
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            updateStep(step2, "failed", message);
            errors.push(message);
            throw err;
        }

        // ============================================================
        // Step 3: Collect Credentials
        // ============================================================
        const step3 = getStep(2);
        updateStep(step3, "running", "Collecting required credentials...");

        try {
            // Discover required credentials from modules
            const credentialRequirements = await discoverCredentialRequirements(modules);

            if (credentialRequirements.length > 0) {
                if (options.skipPrompts) {
                    // Check environment variables
                    const missing: string[] = [];
                    for (const req of credentialRequirements) {
                        if (req.required) {
                            const envName = req.name
                                .toUpperCase()
                                .replace(/[^A-Z0-9]/g, "_");
                            if (!process.env[envName]) {
                                missing.push(envName);
                            }
                        }
                    }
                    if (missing.length > 0) {
                        warnings.push(
                            `Missing environment variables: ${missing.join(", ")}`
                        );
                    }
                } else if (!options.dryRun) {
                    // Convert credential requirements to prompt format
                    const promptRequirements = credentialRequirements.map((req) => ({
                        name: req.name,
                        type: req.type === "password" || req.type === "api_key" || req.type === "token" || req.type === "certificate"
                            ? "password" as const
                            : "text" as const,
                        required: req.required,
                        description: req.description,
                        validation: req.validation,
                    }));
                    await promptForCredentials(promptRequirements);
                }
            }

            updateStep(
                step3,
                "completed",
                `Collected ${credentialRequirements.length} credential(s)`
            );
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            updateStep(step3, "failed", message);
            errors.push(message);
            throw err;
        }

        // ============================================================
        // Step 4: Generate Manifest
        // ============================================================
        const step4 = getStep(3);
        updateStep(step4, "running", "Generating MCP manifest...");

        try {
            manifest = await generateManifest(modules);

            // Save manifest
            const manifestPath = path.join(options.basePath, "mcp-manifest.json");
            await saveManifest(manifest, manifestPath);
            generatedFiles.push(manifestPath);

            updateStep(
                step4,
                "completed",
                `Generated manifest with ${manifest.tools.length} tools, ${manifest.connectors.length} connectors`
            );

            // Save checkpoint
            await saveCheckpoint(options.basePath, {
                step: 4,
                stepName: "Generating manifest",
                timestamp: new Date().toISOString(),
                moduleNames: modules.map((m) => m.name),
                manifestPath,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            updateStep(step4, "failed", message);
            errors.push(message);
            throw err;
        }

        // ============================================================
        // Step 5: Generate Configuration
        // ============================================================
        const step5 = getStep(4);
        updateStep(step5, "running", "Generating runtime configuration...");

        try {
            const environment = options.environment || "production";
            const configContent = await generateConfig(manifest, environment);

            // Save config
            const configPath = path.join(options.basePath, "config", "config.yaml");
            await fsp.mkdir(path.dirname(configPath), { recursive: true });
            await fsp.writeFile(configPath, configContent);
            generatedFiles.push(configPath);

            updateStep(step5, "completed", `Generated ${environment} configuration`);

            // Save checkpoint
            await saveCheckpoint(options.basePath, {
                step: 5,
                stepName: "Generating configuration",
                timestamp: new Date().toISOString(),
                moduleNames: modules.map((m) => m.name),
                manifestPath: path.join(options.basePath, "mcp-manifest.json"),
                configPath,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            updateStep(step5, "failed", message);
            errors.push(message);
            throw err;
        }

        // ============================================================
        // Step 6: Generate Dockerfile
        // ============================================================
        const step6 = getStep(5);
        updateStep(step6, "running", "Generating Dockerfile...");

        try {
            const analysis = analyzeModules(modules);
            const dockerfileContent = await generateDockerfile(manifest, "config/config.yaml", modules, {
                includeHealthCheck: true,
            });

            // Save Dockerfile
            const dockerfilePath = path.join(options.basePath, "Dockerfile.generated");
            await fsp.writeFile(dockerfilePath, dockerfileContent);
            generatedFiles.push(dockerfilePath);

            const languages = [];
            if (analysis.hasTypeScript) languages.push("TypeScript");
            if (analysis.hasPython) languages.push("Python");

            updateStep(
                step6,
                "completed",
                `Generated Dockerfile for ${languages.join(" + ") || "empty"} project`
            );

            // Save checkpoint
            await saveCheckpoint(options.basePath, {
                step: 6,
                stepName: "Generating Dockerfile",
                timestamp: new Date().toISOString(),
                moduleNames: modules.map((m) => m.name),
                manifestPath: path.join(options.basePath, "mcp-manifest.json"),
                configPath: path.join(options.basePath, "config", "config.yaml"),
                dockerfilePath,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            updateStep(step6, "failed", message);
            errors.push(message);
            throw err;
        }

        // ============================================================
        // Step 7: Build Docker Image
        // ============================================================
        const step7 = getStep(6);

        if (options.dryRun) {
            updateStep(step7, "skipped", "Dry run mode - skipping Docker build");
        } else {
            updateStep(step7, "running", "Building Docker image...");

            try {
                const dockerBuildOptions: DockerBuildOptions = {
                    tag: `${options.imageName || "mcp-server"}:${options.imageTag || "latest"}`,
                    noCache: options.noCache,
                    workingDir: options.basePath,
                    onProgress: (event) => {
                        if (options.verbosity && options.verbosity >= 3) {
                            console.log(event.message);
                        }
                    },
                };

                const buildResultImageId = await buildMCPImage(manifest, "config/config.yaml", dockerBuildOptions);
                imageId = buildResultImageId;
                imageName = `${options.imageName || "mcp-server"}:${options.imageTag || "latest"}`;

                updateStep(step7, "completed", `Built image: ${imageName}`);

                // Save checkpoint
                await saveCheckpoint(options.basePath, {
                    step: 7,
                    stepName: "Building Docker image",
                    timestamp: new Date().toISOString(),
                    moduleNames: modules.map((m) => m.name),
                    manifestPath: path.join(options.basePath, "mcp-manifest.json"),
                    configPath: path.join(options.basePath, "config", "config.yaml"),
                    dockerfilePath: path.join(options.basePath, "Dockerfile.generated"),
                    imageId,
                });
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);

                // Provide helpful error messages for common issues
                if (err instanceof DockerDaemonNotRunningError) {
                    updateStep(
                        step7,
                        "failed",
                        "Docker daemon is not running. Please start Docker and try again."
                    );
                } else if (err instanceof DockerBuildError) {
                    updateStep(step7, "failed", `Build failed: ${message}`);
                } else {
                    updateStep(step7, "failed", message);
                }

                errors.push(message);
                throw err;
            }
        }

        // ============================================================
        // Step 8: Tag and Push
        // ============================================================
        const step8 = getStep(7);

        if (options.dryRun || !imageId) {
            updateStep(
                step8,
                "skipped",
                options.dryRun ? "Dry run mode - skipping tagging" : "No image to tag"
            );
        } else {
            updateStep(step8, "running", "Tagging image...");

            try {
                // Build tag list
                const tagsToApply: string[] = [imageName!];

                // Add version tag
                if (manifest?.version) {
                    tagsToApply.push(`${options.imageName || "mcp-server"}:v${manifest.version}`);
                }

                // Add timestamp tag
                const timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
                tagsToApply.push(`${options.imageName || "mcp-server"}:${timestamp}`);

                const tagResult = await tagImage(imageId, tagsToApply);
                tags = tagResult.appliedTags;

                if (tagResult.failedTags.length > 0) {
                    for (const failed of tagResult.failedTags) {
                        warnings.push(`Failed to apply tag ${failed.tag}: ${failed.error}`);
                    }
                }

                // Push if requested
                if (options.push && options.registryUrl) {
                    updateStep(step8, "running", "Pushing to registry...");

                    const pushProgressOptions: PushOptions = {
                        onProgress: (event) => {
                            if (options.verbosity && options.verbosity >= 2) {
                                if (event.status) {
                                    console.log(`  ${event.status}`);
                                }
                            }
                        },
                    };

                    await pushImage(imageName!, options.registryUrl, undefined, pushProgressOptions);
                }

                updateStep(
                    step8,
                    "completed",
                    `Applied ${tags.length} tag(s)` +
                    (options.push ? " and pushed to registry" : "")
                );
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                updateStep(step8, "failed", message);
                // Tagging failure is not critical, log as warning
                warnings.push(message);
            }
        }

        // ============================================================
        // Build Complete
        // ============================================================

        // Clear checkpoint on success
        await clearCheckpoint(options.basePath);

        const duration = Date.now() - startTime;

        return {
            success: true,
            imageId,
            imageName,
            tags,
            toolCount: manifest?.tools.length || 0,
            connectorCount: manifest?.connectors.length || 0,
            manifestPath: path.join(options.basePath, "mcp-manifest.json"),
            configPath: path.join(options.basePath, "config", "config.yaml"),
            dockerfilePath: path.join(options.basePath, "Dockerfile.generated"),
            warnings: warnings.length > 0 ? warnings : undefined,
            duration,
            steps,
        };
    } catch (err) {
        // Rollback on failure
        await rollback(options.basePath, generatedFiles, imageId);

        const duration = Date.now() - startTime;

        return {
            success: false,
            toolCount: modules.length > 0 ? modules.filter((m) => m.type === "tool").length : 0,
            connectorCount:
                modules.length > 0 ? modules.filter((m) => m.type === "connector").length : 0,
            errors,
            warnings: warnings.length > 0 ? warnings : undefined,
            duration,
            steps,
        };
    }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

/**
 * Main entry point for the MCP Generator
 */
export function main(): void {
    // Import and run CLI
    require("./cli").run();
}

// Entry point when run directly
if (require.main === module) {
    main();
}
