/**
 * Dockerfile Generator for MCP Server
 * 
 * This module dynamically generates a Dockerfile for the MCP server based on
 * loaded modules. It handles base image selection, dependency installation,
 * and proper configuration of the containerized MCP server.
 * 
 * Also provides image building functionality to execute Docker builds
 * with proper progress streaming, logging, and error handling.
 */

import { MCPManifest } from "./generator";
import { Module } from "./loader";
import { DockerClient, DockerBuildError, ProgressCallback, BuildProgress } from "./docker-client";
import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import * as os from "os";

/**
 * Options for Dockerfile generation
 */
export interface DockerfileOptions {
    /** Custom base image override for Node.js (default: node:20-alpine) */
    nodeBaseImage?: string;
    /** Custom base image override for Python (default: python:3.11-slim) */
    pythonBaseImage?: string;
    /** Additional environment variables to set */
    environmentVariables?: Record<string, string>;
    /** Additional labels to add to the image */
    labels?: Record<string, string>;
    /** Working directory in container (default: /app) */
    workDir?: string;
    /** Whether to include health check (default: true) */
    includeHealthCheck?: boolean;
    /** Python requirements file content */
    pythonRequirements?: string;
    /** Additional npm packages to install */
    additionalNpmPackages?: string[];
    /** Additional Python packages to install */
    additionalPythonPackages?: string[];
}

/**
 * Result of analyzing modules for Dockerfile generation
 */
export interface ModuleAnalysis {
    /** Whether TypeScript/JavaScript modules are present */
    hasTypeScript: boolean;
    /** Whether Python modules are present */
    hasPython: boolean;
    /** List of TypeScript tool files */
    typescriptTools: string[];
    /** List of Python tool files */
    pythonTools: string[];
    /** List of TypeScript connector files */
    typescriptConnectors: string[];
    /** List of Python connector files */
    pythonConnectors: string[];
    /** Detected npm dependencies */
    npmDependencies: string[];
    /** Detected Python dependencies */
    pythonDependencies: string[];
}

/**
 * Analyze modules to determine what languages and dependencies are needed
 * 
 * @param modules - Array of loaded modules to analyze
 * @returns Analysis of module languages and files
 */
export function analyzeModules(modules: Module[]): ModuleAnalysis {
    const analysis: ModuleAnalysis = {
        hasTypeScript: false,
        hasPython: false,
        typescriptTools: [],
        pythonTools: [],
        typescriptConnectors: [],
        pythonConnectors: [],
        npmDependencies: [],
        pythonDependencies: [],
    };

    for (const module of modules) {
        // Extract relative path from absolute path
        const relativePath = extractRelativePath(module.path);

        if (module.language === "typescript") {
            analysis.hasTypeScript = true;
            if (module.type === "tool") {
                analysis.typescriptTools.push(relativePath);
            } else {
                analysis.typescriptConnectors.push(relativePath);
            }
        } else if (module.language === "python") {
            analysis.hasPython = true;
            if (module.type === "tool") {
                analysis.pythonTools.push(relativePath);
            } else {
                analysis.pythonConnectors.push(relativePath);
            }
        }
    }

    return analysis;
}

/**
 * Extract relative path from absolute path
 * 
 * @param absolutePath - Absolute path to file
 * @returns Relative path suitable for Docker COPY
 */
function extractRelativePath(absolutePath: string): string {
    // Extract path relative to workspace root
    // Look for /tools/ or /connectors/ in the path
    const toolsMatch = absolutePath.match(/\/tools\/(.+)$/);
    if (toolsMatch) {
        return `tools/${toolsMatch[1]}`;
    }

    const connectorsMatch = absolutePath.match(/\/connectors\/(.+)$/);
    if (connectorsMatch) {
        return `connectors/${connectorsMatch[1]}`;
    }

    // Fallback: return basename
    return absolutePath.split("/").pop() || absolutePath;
}

/**
 * Generate a Dockerfile for Node.js-only MCP server
 * 
 * @param manifest - MCP manifest with tool/connector info
 * @param config - Configuration file name/path
 * @param options - Dockerfile generation options
 * @returns Dockerfile content as string
 */
function generateNodeOnlyDockerfile(
    manifest: MCPManifest,
    config: string,
    options: DockerfileOptions,
    analysis: ModuleAnalysis
): string {
    const baseImage = options.nodeBaseImage || "node:20-alpine";
    const workDir = options.workDir || "/app";
    const envVars = {
        NODE_ENV: "production",
        MCP_CONFIG_PATH: `${workDir}/config/config.yaml`,
        ...options.environmentVariables,
    };

    const lines: string[] = [];

    // Header comment
    lines.push("# MCP Server Dockerfile - Node.js Only");
    lines.push(`# Generated at: ${new Date().toISOString()}`);
    lines.push(`# Server: ${manifest.name} v${manifest.version}`);
    lines.push("");

    // Base image
    lines.push(`FROM ${baseImage}`);
    lines.push("");

    // Metadata labels
    lines.push("# Metadata labels");
    const labels = generateLabels(manifest, options);
    for (const [key, value] of Object.entries(labels)) {
        lines.push(`LABEL ${key}="${value}"`);
    }
    lines.push("");

    // Working directory
    lines.push("# Set up working directory");
    lines.push(`WORKDIR ${workDir}`);
    lines.push("");

    // Create directory structure
    lines.push("# Create directory structure");
    lines.push(`RUN mkdir -p ${workDir}/tools ${workDir}/connectors ${workDir}/config`);
    lines.push("");

    // Copy package files and install dependencies
    lines.push("# Install npm dependencies");
    lines.push("COPY package*.json ./");

    const npmDeps = collectNpmDependencies(manifest, options);
    if (npmDeps.length > 0) {
        lines.push(`RUN npm install --production ${npmDeps.join(" ")}`);
    } else {
        lines.push("RUN npm install --production");
    }
    lines.push("");

    // Copy tool files
    lines.push("# Copy tool files");
    if (analysis.typescriptTools.length > 0) {
        for (const tool of analysis.typescriptTools) {
            lines.push(`COPY ${tool} ${workDir}/tools/`);
        }
    } else {
        lines.push(`COPY tools/ ${workDir}/tools/`);
    }
    lines.push("");

    // Copy connector files
    lines.push("# Copy connector files");
    if (analysis.typescriptConnectors.length > 0) {
        for (const connector of analysis.typescriptConnectors) {
            lines.push(`COPY ${connector} ${workDir}/connectors/`);
        }
    } else {
        lines.push(`COPY connectors/ ${workDir}/connectors/`);
    }
    lines.push("");

    // Copy manifest
    lines.push("# Copy MCP manifest");
    lines.push(`COPY mcp-manifest.json ${workDir}/`);
    lines.push("");

    // Copy config
    lines.push("# Copy configuration (can be overridden via volume mount)");
    lines.push(`COPY ${config} ${workDir}/config/config.yaml`);
    lines.push("");

    // Copy server entry point
    lines.push("# Copy server entry point");
    lines.push(`COPY server.js ${workDir}/`);
    lines.push("");

    // Environment variables
    lines.push("# Set environment variables");
    for (const [key, value] of Object.entries(envVars)) {
        lines.push(`ENV ${key}="${value}"`);
    }
    lines.push("");

    // Expose port (if applicable)
    lines.push("# Expose port for MCP server");
    lines.push("EXPOSE 3000");
    lines.push("");

    // Health check
    if (options.includeHealthCheck !== false) {
        lines.push("# Health check");
        lines.push('HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\');
        lines.push('    CMD node -e "require(\'http\').get(\'http://localhost:3000/health\', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1');
        lines.push("");
    }

    // Entrypoint and CMD
    lines.push("# Start the MCP server");
    lines.push('ENTRYPOINT ["node", "server.js"]');
    lines.push('CMD []');
    lines.push("");

    return lines.join("\n");
}

/**
 * Generate a Dockerfile for Python-only MCP server
 * 
 * @param manifest - MCP manifest with tool/connector info
 * @param config - Configuration file name/path
 * @param options - Dockerfile generation options
 * @returns Dockerfile content as string
 */
function generatePythonOnlyDockerfile(
    manifest: MCPManifest,
    config: string,
    options: DockerfileOptions,
    analysis: ModuleAnalysis
): string {
    const baseImage = options.pythonBaseImage || "python:3.11-slim";
    const workDir = options.workDir || "/app";
    const envVars = {
        PYTHONUNBUFFERED: "1",
        PYTHONDONTWRITEBYTECODE: "1",
        MCP_CONFIG_PATH: `${workDir}/config/config.yaml`,
        ...options.environmentVariables,
    };

    const lines: string[] = [];

    // Header comment
    lines.push("# MCP Server Dockerfile - Python Only");
    lines.push(`# Generated at: ${new Date().toISOString()}`);
    lines.push(`# Server: ${manifest.name} v${manifest.version}`);
    lines.push("");

    // Base image
    lines.push(`FROM ${baseImage}`);
    lines.push("");

    // Metadata labels
    lines.push("# Metadata labels");
    const labels = generateLabels(manifest, options);
    for (const [key, value] of Object.entries(labels)) {
        lines.push(`LABEL ${key}="${value}"`);
    }
    lines.push("");

    // Working directory
    lines.push("# Set up working directory");
    lines.push(`WORKDIR ${workDir}`);
    lines.push("");

    // Create directory structure
    lines.push("# Create directory structure");
    lines.push(`RUN mkdir -p ${workDir}/tools ${workDir}/connectors ${workDir}/config`);
    lines.push("");

    // Copy requirements and install Python dependencies
    lines.push("# Install Python dependencies");
    if (options.pythonRequirements) {
        lines.push("COPY requirements.txt ./");
        lines.push("RUN pip install --no-cache-dir -r requirements.txt");
    } else {
        const pythonDeps = collectPythonDependencies(options);
        if (pythonDeps.length > 0) {
            lines.push(`RUN pip install --no-cache-dir ${pythonDeps.join(" ")}`);
        }
    }
    lines.push("");

    // Copy tool files
    lines.push("# Copy tool files");
    if (analysis.pythonTools.length > 0) {
        for (const tool of analysis.pythonTools) {
            lines.push(`COPY ${tool} ${workDir}/tools/`);
        }
    } else {
        lines.push(`COPY tools/ ${workDir}/tools/`);
    }
    lines.push("");

    // Copy connector files
    lines.push("# Copy connector files");
    if (analysis.pythonConnectors.length > 0) {
        for (const connector of analysis.pythonConnectors) {
            lines.push(`COPY ${connector} ${workDir}/connectors/`);
        }
    } else {
        lines.push(`COPY connectors/ ${workDir}/connectors/`);
    }
    lines.push("");

    // Copy manifest
    lines.push("# Copy MCP manifest");
    lines.push(`COPY mcp-manifest.json ${workDir}/`);
    lines.push("");

    // Copy config
    lines.push("# Copy configuration (can be overridden via volume mount)");
    lines.push(`COPY ${config} ${workDir}/config/config.yaml`);
    lines.push("");

    // Copy server entry point
    lines.push("# Copy server entry point");
    lines.push(`COPY server.py ${workDir}/`);
    lines.push("");

    // Environment variables
    lines.push("# Set environment variables");
    for (const [key, value] of Object.entries(envVars)) {
        lines.push(`ENV ${key}="${value}"`);
    }
    lines.push("");

    // Expose port
    lines.push("# Expose port for MCP server");
    lines.push("EXPOSE 3000");
    lines.push("");

    // Health check
    if (options.includeHealthCheck !== false) {
        lines.push("# Health check");
        lines.push('HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\');
        lines.push('    CMD python -c "import urllib.request; urllib.request.urlopen(\'http://localhost:3000/health\')" || exit 1');
        lines.push("");
    }

    // Entrypoint and CMD
    lines.push("# Start the MCP server");
    lines.push('ENTRYPOINT ["python", "server.py"]');
    lines.push('CMD []');
    lines.push("");

    return lines.join("\n");
}

/**
 * Generate a multi-stage Dockerfile for mixed Node.js and Python MCP server
 * 
 * @param manifest - MCP manifest with tool/connector info
 * @param config - Configuration file name/path
 * @param options - Dockerfile generation options
 * @returns Dockerfile content as string
 */
function generateMultiStageDockerfile(
    manifest: MCPManifest,
    config: string,
    options: DockerfileOptions,
    _analysis: ModuleAnalysis
): string {
    const nodeBaseImage = options.nodeBaseImage || "node:20-alpine";
    const pythonBaseImage = options.pythonBaseImage || "python:3.11-slim";
    const workDir = options.workDir || "/app";
    const envVars = {
        NODE_ENV: "production",
        PYTHONUNBUFFERED: "1",
        PYTHONDONTWRITEBYTECODE: "1",
        MCP_CONFIG_PATH: `${workDir}/config/config.yaml`,
        ...options.environmentVariables,
    };

    const lines: string[] = [];

    // Header comment
    lines.push("# MCP Server Dockerfile - Multi-stage (Node.js + Python)");
    lines.push(`# Generated at: ${new Date().toISOString()}`);
    lines.push(`# Server: ${manifest.name} v${manifest.version}`);
    lines.push("");

    // Stage 1: Node.js build stage
    lines.push("#############################");
    lines.push("# Stage 1: Node.js dependencies");
    lines.push("#############################");
    lines.push(`FROM ${nodeBaseImage} AS node-builder`);
    lines.push("");
    lines.push("WORKDIR /build");
    lines.push("");
    lines.push("# Copy package files and install Node.js dependencies");
    lines.push("COPY package*.json ./");
    const npmDeps = collectNpmDependencies(manifest, options);
    if (npmDeps.length > 0) {
        lines.push(`RUN npm install --production ${npmDeps.join(" ")}`);
    } else {
        lines.push("RUN npm install --production");
    }
    lines.push("");

    // Stage 2: Python build stage
    lines.push("#############################");
    lines.push("# Stage 2: Python dependencies");
    lines.push("#############################");
    lines.push(`FROM ${pythonBaseImage} AS python-builder`);
    lines.push("");
    lines.push("WORKDIR /build");
    lines.push("");
    lines.push("# Install Python dependencies");
    if (options.pythonRequirements) {
        lines.push("COPY requirements.txt ./");
        lines.push("RUN pip install --no-cache-dir --target=/build/python-deps -r requirements.txt");
    } else {
        const pythonDeps = collectPythonDependencies(options);
        if (pythonDeps.length > 0) {
            lines.push(`RUN pip install --no-cache-dir --target=/build/python-deps ${pythonDeps.join(" ")}`);
        } else {
            lines.push("RUN mkdir -p /build/python-deps");
        }
    }
    lines.push("");

    // Stage 3: Final runtime image
    lines.push("#############################");
    lines.push("# Stage 3: Runtime image");
    lines.push("#############################");
    lines.push("# Using Node.js as base and adding Python");
    lines.push(`FROM ${nodeBaseImage} AS runtime`);
    lines.push("");

    // Install Python in the Node image
    lines.push("# Install Python runtime");
    lines.push("RUN apk add --no-cache python3 py3-pip");
    lines.push("");

    // Metadata labels
    lines.push("# Metadata labels");
    const labels = generateLabels(manifest, options);
    for (const [key, value] of Object.entries(labels)) {
        lines.push(`LABEL ${key}="${value}"`);
    }
    lines.push("");

    // Working directory
    lines.push("# Set up working directory");
    lines.push(`WORKDIR ${workDir}`);
    lines.push("");

    // Create directory structure
    lines.push("# Create directory structure");
    lines.push(`RUN mkdir -p ${workDir}/tools ${workDir}/connectors ${workDir}/config`);
    lines.push("");

    // Copy Node.js dependencies from builder
    lines.push("# Copy Node.js dependencies from builder");
    lines.push(`COPY --from=node-builder /build/node_modules ${workDir}/node_modules`);
    lines.push("");

    // Copy Python dependencies from builder
    lines.push("# Copy Python dependencies from builder");
    lines.push("COPY --from=python-builder /build/python-deps /usr/local/lib/python3.11/site-packages/");
    lines.push("");

    // Copy all tool files
    lines.push("# Copy tool files");
    lines.push(`COPY tools/ ${workDir}/tools/`);
    lines.push("");

    // Copy all connector files
    lines.push("# Copy connector files");
    lines.push(`COPY connectors/ ${workDir}/connectors/`);
    lines.push("");

    // Copy manifest
    lines.push("# Copy MCP manifest");
    lines.push(`COPY mcp-manifest.json ${workDir}/`);
    lines.push("");

    // Copy config
    lines.push("# Copy configuration (can be overridden via volume mount)");
    lines.push(`COPY ${config} ${workDir}/config/config.yaml`);
    lines.push("");

    // Copy server entry points
    lines.push("# Copy server entry points");
    lines.push(`COPY server.js ${workDir}/`);
    lines.push(`COPY server.py ${workDir}/`);
    lines.push("");

    // Environment variables
    lines.push("# Set environment variables");
    for (const [key, value] of Object.entries(envVars)) {
        lines.push(`ENV ${key}="${value}"`);
    }
    lines.push(`ENV PYTHONPATH="${workDir}/tools:${workDir}/connectors"`);
    lines.push("");

    // Expose port
    lines.push("# Expose port for MCP server");
    lines.push("EXPOSE 3000");
    lines.push("");

    // Health check
    if (options.includeHealthCheck !== false) {
        lines.push("# Health check");
        lines.push('HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\');
        lines.push('    CMD node -e "require(\'http\').get(\'http://localhost:3000/health\', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1');
        lines.push("");
    }

    // Entrypoint and CMD
    lines.push("# Start the MCP server");
    lines.push('ENTRYPOINT ["node", "server.js"]');
    lines.push('CMD []');
    lines.push("");

    return lines.join("\n");
}

/**
 * Generate metadata labels for the Docker image
 * 
 * @param manifest - MCP manifest
 * @param options - Dockerfile options with custom labels
 * @returns Record of label key-value pairs
 */
function generateLabels(
    manifest: MCPManifest,
    options: DockerfileOptions,
    _analysis?: ModuleAnalysis
): Record<string, string> {
    const toolList = manifest.tools.map((t) => t.name).join(",");
    const connectorList = manifest.connectors.map((c) => c.name).join(",");

    const labels: Record<string, string> = {
        "org.opencontainers.image.title": manifest.name,
        "org.opencontainers.image.version": manifest.version,
        "org.opencontainers.image.created": new Date().toISOString(),
        "org.opencontainers.image.description": "MCP Server Container",
        "mcp.server.tools": toolList || "none",
        "mcp.server.connectors": connectorList || "none",
        "mcp.server.capabilities": manifest.capabilities.join(",") || "none",
        "mcp.generator.version": manifest.metadata.generatorVersion,
        ...options.labels,
    };

    return labels;
}

/**
 * Collect npm dependencies from manifest and options
 * 
 * @param manifest - MCP manifest with dependencies
 * @param options - Options with additional packages
 * @returns Array of npm package specifications
 */
function collectNpmDependencies(
    manifest: MCPManifest,
    options: DockerfileOptions
): string[] {
    const deps: string[] = [];

    // Add manifest dependencies
    for (const [pkg, version] of Object.entries(manifest.dependencies)) {
        deps.push(`${pkg}@${version}`);
    }

    // Add additional packages from options
    if (options.additionalNpmPackages) {
        deps.push(...options.additionalNpmPackages);
    }

    return deps;
}

/**
 * Collect Python dependencies from options
 * 
 * @param options - Options with Python packages
 * @returns Array of Python package specifications
 */
function collectPythonDependencies(options: DockerfileOptions): string[] {
    const deps: string[] = [];

    if (options.additionalPythonPackages) {
        deps.push(...options.additionalPythonPackages);
    }

    return deps;
}

/**
 * Generate a Dockerfile for the MCP server based on loaded modules
 * 
 * This is the main entry point for Dockerfile generation. It analyzes
 * the manifest to determine what languages are used and generates
 * an appropriate Dockerfile.
 * 
 * @param manifest - MCP manifest containing tool/connector/dependency info
 * @param config - Configuration file path (e.g., "config/development.yaml")
 * @param modules - Optional array of loaded modules for detailed analysis
 * @param options - Optional generation options
 * @returns Generated Dockerfile content as string
 */
export async function generateDockerfile(
    manifest: MCPManifest,
    config: string,
    modules?: Module[],
    options: DockerfileOptions = {}
): Promise<string> {
    // Analyze modules if provided, otherwise infer from manifest
    let analysis: ModuleAnalysis;

    if (modules && modules.length > 0) {
        analysis = analyzeModules(modules);
    } else {
        // Infer language from tool/connector names or default to mixed
        analysis = inferModuleAnalysis(manifest);
    }

    // Determine which Dockerfile template to use
    if (analysis.hasTypeScript && analysis.hasPython) {
        // Multi-stage build for both languages
        return generateMultiStageDockerfile(manifest, config, options, analysis);
    } else if (analysis.hasPython) {
        // Python-only Dockerfile
        return generatePythonOnlyDockerfile(manifest, config, options, analysis);
    } else {
        // Default to Node.js-only (even if no modules detected)
        return generateNodeOnlyDockerfile(manifest, config, options, analysis);
    }
}

/**
 * Infer module analysis from manifest when modules aren't directly available
 * 
 * @param manifest - MCP manifest
 * @returns Inferred module analysis
 */
function inferModuleAnalysis(manifest: MCPManifest): ModuleAnalysis {
    const analysis: ModuleAnalysis = {
        hasTypeScript: false,
        hasPython: false,
        typescriptTools: [],
        pythonTools: [],
        typescriptConnectors: [],
        pythonConnectors: [],
        npmDependencies: [],
        pythonDependencies: [],
    };

    // Check for npm dependencies as indicator of TypeScript
    if (Object.keys(manifest.dependencies).length > 0) {
        analysis.hasTypeScript = true;
    }

    // For now, assume mixed environment if we can't determine
    // In practice, this would be determined by scanning the actual files
    analysis.hasTypeScript = true;
    analysis.hasPython = true;

    return analysis;
}

/**
 * Validate a generated Dockerfile for basic syntax and required sections
 * 
 * @param dockerfile - Dockerfile content to validate
 * @returns Object with valid flag and any error messages
 */
export function validateDockerfile(dockerfile: string): {
    valid: boolean;
    errors: string[];
    warnings: string[];
} {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for required directives
    if (!dockerfile.includes("FROM ")) {
        errors.push("Missing FROM directive - base image not specified");
    }

    if (!dockerfile.includes("WORKDIR ")) {
        warnings.push("Missing WORKDIR directive - working directory not set");
    }

    if (!dockerfile.includes("ENTRYPOINT ") && !dockerfile.includes("CMD ")) {
        errors.push("Missing ENTRYPOINT or CMD directive - container won't know what to run");
    }

    // Check for common issues
    const lines = dockerfile.split("\n");
    for (let i = 0; i < lines.length; i++) {

        // Check for potentially problematic patterns
        const line = lines[i];
        if (!line) continue;
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith("RUN ") && trimmedLine.includes("apt-get install") && !trimmedLine.includes("-y")) {
            warnings.push(`Line ${i + 1}: apt-get install without -y flag may hang waiting for input`);
        }

        if (trimmedLine.startsWith("COPY") && trimmedLine.includes("..")) {
            errors.push(`Line ${i + 1}: COPY with '..' may try to access files outside build context`);
        }
    }

    // Check for proper structure
    const fromIndex = dockerfile.indexOf("FROM ");
    if (fromIndex > 0) {
        const beforeFrom = dockerfile.substring(0, fromIndex).trim();
        // Only comments and ARG are allowed before FROM
        const beforeLines = beforeFrom.split("\n").filter(l => l.trim() && !l.trim().startsWith("#"));
        for (const line of beforeLines) {
            if (!line.trim().startsWith("ARG ")) {
                warnings.push("Non-comment, non-ARG content before FROM directive");
                break;
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * Save a generated Dockerfile to disk
 * 
 * @param dockerfile - Dockerfile content
 * @param outputPath - Path to save the Dockerfile
 */
export async function saveDockerfile(
    dockerfile: string,
    outputPath: string
): Promise<void> {
    const fs = await import("fs/promises");
    await fs.writeFile(outputPath, dockerfile, "utf-8");
}

/**
 * Generate a .dockerignore file for the MCP server
 * 
 * @returns .dockerignore content
 */
export function generateDockerignore(): string {
    const lines = [
        "# Git",
        ".git",
        ".gitignore",
        "",
        "# Node.js",
        "node_modules",
        "npm-debug.log",
        "yarn-error.log",
        "",
        "# Python",
        "__pycache__",
        "*.pyc",
        "*.pyo",
        ".pytest_cache",
        ".venv",
        "venv",
        "",
        "# IDE",
        ".vscode",
        ".idea",
        "*.swp",
        "*.swo",
        "",
        "# Build artifacts",
        "dist",
        "build",
        "*.log",
        "",
        "# Docker",
        "Dockerfile*",
        ".dockerignore",
        "",
        "# Documentation",
        "*.md",
        "docs",
        "ActionPlan",
        "",
        "# Tests",
        "test-*.ts",
        "test-*.js",
        "*.test.ts",
        "*.test.js",
        "*.spec.ts",
        "*.spec.js",
        "",
    ];

    return lines.join("\n");
}

// ============================================================================
// Image Builder Types and Interfaces
// ============================================================================

/**
 * Options for building an MCP Docker image
 */
export interface BuildOptions {
    /** Custom image tag (default: mcp-server:latest) */
    tag?: string;
    /** Additional tags for the image */
    additionalTags?: string[];
    /** Build arguments to pass to Docker */
    buildArgs?: Record<string, string>;
    /** Multi-stage build target */
    target?: string;
    /** Skip Docker cache */
    noCache?: boolean;
    /** Working directory for the build (default: process.cwd()) */
    workingDir?: string;
    /** Path to write build logs (default: .build.log) */
    logFile?: string;
    /** Dockerfile generation options */
    dockerfileOptions?: DockerfileOptions;
    /** Callback for progress updates */
    onProgress?: (event: BuildProgressEvent) => void;
    /** Whether to clean up on failure (default: true) */
    cleanupOnFailure?: boolean;
    /** Custom DockerClient instance */
    dockerClient?: DockerClient;
}

/**
 * Build progress event with parsed information
 */
export interface BuildProgressEvent {
    /** Event type */
    type: 'step' | 'download' | 'extract' | 'output' | 'error' | 'complete';
    /** Current step number (if applicable) */
    step?: number;
    /** Total steps (if applicable) */
    totalSteps?: number;
    /** Progress message */
    message: string;
    /** Raw stream output */
    raw?: string;
    /** Progress percentage (0-100, if applicable) */
    progress?: number;
    /** Time elapsed since build start (ms) */
    elapsed: number;
    /** Timestamp */
    timestamp: Date;
}

/**
 * Result of a successful build
 */
export interface BuildResult {
    /** The built image ID */
    imageId: string;
    /** Tags applied to the image */
    tags: string[];
    /** Total build time in milliseconds */
    buildTime: number;
    /** Path to the build log file */
    logFile: string;
    /** Size of the built image (if available) */
    imageSize?: number;
}

/**
 * Represents a build failure with diagnostic information
 */
export interface BuildFailure {
    /** Error message */
    message: string;
    /** Step number where failure occurred */
    failedStep?: number;
    /** Total steps attempted */
    totalSteps?: number;
    /** The Dockerfile instruction that failed */
    failedInstruction?: string;
    /** Suggested fixes for the failure */
    suggestions: string[];
    /** Full build output for debugging */
    buildOutput: string;
    /** Path to the build log file */
    logFile: string;
}

/**
 * Build log entry with timestamp
 */
interface BuildLogEntry {
    timestamp: Date;
    type: 'info' | 'step' | 'error' | 'warning';
    message: string;
}

// ============================================================================
// Image Builder Implementation
// ============================================================================

/**
 * Build an MCP Docker image from a manifest
 * 
 * This function handles the complete build process:
 * 1. Creates a temporary build context with all required files
 * 2. Generates a Dockerfile based on the manifest
 * 3. Executes the Docker build with progress streaming
 * 4. Captures logs and handles errors
 * 5. Cleans up on failure
 * 
 * @param manifest - MCP manifest describing the server
 * @param config - Configuration file path
 * @param options - Build options
 * @returns The built image ID on success
 * @throws {DockerBuildError} If the build fails
 * 
 * @example
 * ```typescript
 * const imageId = await buildMCPImage(manifest, 'config/production.yaml', {
 *   tag: 'my-mcp-server:1.0.0',
 *   onProgress: (event) => console.log(event.message)
 * });
 * ```
 */
export async function buildMCPImage(
    manifest: MCPManifest,
    config: string,
    options: BuildOptions = {}
): Promise<string> {
    const startTime = Date.now();
    const workingDir = options.workingDir || process.cwd();
    const logFile = options.logFile || path.join(workingDir, '.build.log');
    const tag = options.tag || `mcp-server:latest`;
    const cleanupOnFailure = options.cleanupOnFailure !== false;

    const logs: BuildLogEntry[] = [];
    let buildContextDir: string | null = null;
    let buildOutput = '';

    // Helper to log and optionally notify progress
    const log = (type: BuildLogEntry['type'], message: string) => {
        const entry: BuildLogEntry = {
            timestamp: new Date(),
            type,
            message
        };
        logs.push(entry);
        buildOutput += `[${entry.timestamp.toISOString()}] [${type.toUpperCase()}] ${message}\n`;
    };

    // Helper to send progress events
    const sendProgress = (event: Partial<BuildProgressEvent>) => {
        const fullEvent: BuildProgressEvent = {
            type: event.type || 'output',
            message: event.message || '',
            elapsed: Date.now() - startTime,
            timestamp: new Date(),
            ...event
        };

        if (options.onProgress) {
            options.onProgress(fullEvent);
        }
    };

    try {
        log('info', `Starting MCP image build for ${manifest.name} v${manifest.version}`);
        sendProgress({ type: 'output', message: `Building MCP image: ${tag}` });

        // 1. Create Docker client
        const dockerClient = options.dockerClient || new DockerClient();

        // Verify Docker is available
        const isConnected = await dockerClient.ping();
        if (!isConnected) {
            throw new DockerBuildError('Docker daemon is not running or not accessible');
        }
        log('info', 'Docker daemon connected');

        // 2. Create build context directory
        buildContextDir = await createBuildContext(manifest, config, workingDir, options.dockerfileOptions);
        log('info', `Build context created at: ${buildContextDir}`);
        sendProgress({ type: 'output', message: 'Build context prepared' });

        // 3. Track current step for progress
        let currentStep = 0;
        let totalSteps = 0;

        // 4. Build the image with progress streaming
        const progressCallback: ProgressCallback = (progress: BuildProgress) => {
            // Parse step information from stream
            if (progress.stream) {
                const stepMatch = progress.stream.match(/Step (\d+)\/(\d+)/);
                if (stepMatch && stepMatch[1] && stepMatch[2]) {
                    currentStep = parseInt(stepMatch[1], 10);
                    totalSteps = parseInt(stepMatch[2], 10);

                    log('step', progress.stream.trim());
                    sendProgress({
                        type: 'step',
                        step: currentStep,
                        totalSteps,
                        message: progress.stream.trim(),
                        raw: progress.stream
                    });
                } else if (progress.stream.trim()) {
                    // Other output
                    buildOutput += progress.stream;
                    sendProgress({
                        type: 'output',
                        message: progress.stream.trim(),
                        raw: progress.stream,
                        step: currentStep,
                        totalSteps
                    });
                }
            }

            // Handle download progress
            if (progress.status && progress.progress !== undefined) {
                sendProgress({
                    type: 'download',
                    message: progress.status,
                    progress: progress.progress
                });
            }

            // Handle errors in stream
            if (progress.error || progress.errorDetail) {
                const errorMsg = progress.error || progress.errorDetail?.message || 'Unknown error';
                log('error', errorMsg);
                sendProgress({
                    type: 'error',
                    message: errorMsg
                });
            }
        };

        log('info', `Building image with tag: ${tag}`);

        const imageId = await dockerClient.buildImage(
            buildContextDir,
            'Dockerfile',
            tag,
            progressCallback
        );

        if (!imageId) {
            throw new DockerBuildError('Build completed but no image ID returned');
        }

        log('info', `Image built successfully: ${imageId}`);

        // 5. Apply additional tags
        if (options.additionalTags && options.additionalTags.length > 0) {
            // Additional tagging would be done through DockerClient
            // For now, we just track the primary tag
            log('info', `Additional tags requested: ${options.additionalTags.join(', ')}`);
        }

        // 6. Write build log to file
        await writeBuildLog(logFile, logs, buildOutput);
        log('info', `Build log written to: ${logFile}`);

        // 7. Calculate build time
        const buildTime = Date.now() - startTime;
        log('info', `Build completed in ${(buildTime / 1000).toFixed(2)}s`);

        sendProgress({
            type: 'complete',
            message: `✅ Build completed in ${(buildTime / 1000).toFixed(1)}s\nImage ID: ${imageId}`
        });

        // 8. Cleanup build context
        if (buildContextDir) {
            await cleanupBuildContext(buildContextDir);
        }

        return imageId;

    } catch (error) {
        const err = error as Error;
        log('error', `Build failed: ${err.message}`);

        // Parse failure information
        const failure = parseBuildFailure(err, buildOutput, logFile);

        // Write error log
        await writeBuildLog(logFile, logs, buildOutput);

        sendProgress({
            type: 'error',
            message: `❌ Build failed: ${failure.message}`
        });

        // Cleanup on failure
        if (cleanupOnFailure && buildContextDir) {
            try {
                await cleanupBuildContext(buildContextDir);
                log('info', 'Build context cleaned up after failure');
            } catch (cleanupError) {
                // Ignore cleanup errors
            }
        }

        // Re-throw with enhanced error information
        const buildError = new DockerBuildError(
            `Build failed: ${failure.message}${failure.suggestions.length > 0 ? '\n\nSuggestions:\n' + failure.suggestions.map(s => `  - ${s}`).join('\n') : ''}`,
            buildOutput,
            err instanceof Error ? err : undefined
        );

        throw buildError;
    }
}

/**
 * Create a build context directory with all required files
 */
async function createBuildContext(
    manifest: MCPManifest,
    config: string,
    workingDir: string,
    dockerfileOptions?: DockerfileOptions
): Promise<string> {
    // Create temp directory
    const contextDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mcp-build-'));

    try {
        // Create subdirectories
        await fsp.mkdir(path.join(contextDir, 'tools'), { recursive: true });
        await fsp.mkdir(path.join(contextDir, 'connectors'), { recursive: true });
        await fsp.mkdir(path.join(contextDir, 'config'), { recursive: true });

        // Generate and write Dockerfile
        const dockerfile = await generateDockerfile(manifest, config, undefined, dockerfileOptions);
        await fsp.writeFile(path.join(contextDir, 'Dockerfile'), dockerfile);

        // Generate and write .dockerignore
        const dockerignore = generateDockerignore();
        await fsp.writeFile(path.join(contextDir, '.dockerignore'), dockerignore);

        // Write manifest
        await fsp.writeFile(
            path.join(contextDir, 'mcp-manifest.json'),
            JSON.stringify(manifest, null, 2)
        );

        // Copy tools directory
        const toolsDir = path.join(workingDir, 'tools');
        if (fs.existsSync(toolsDir)) {
            await copyDirectory(toolsDir, path.join(contextDir, 'tools'));
        }

        // Copy connectors directory  
        const connectorsDir = path.join(workingDir, 'connectors');
        if (fs.existsSync(connectorsDir)) {
            await copyDirectory(connectorsDir, path.join(contextDir, 'connectors'));
        }

        // Copy config file
        const configPath = path.join(workingDir, config);
        if (fs.existsSync(configPath)) {
            const configDest = path.join(contextDir, config);
            await fsp.mkdir(path.dirname(configDest), { recursive: true });
            await fsp.copyFile(configPath, configDest);
        }

        // Copy package.json if exists
        const packageJsonPath = path.join(workingDir, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            await fsp.copyFile(packageJsonPath, path.join(contextDir, 'package.json'));
        }

        // Copy package-lock.json if exists
        const packageLockPath = path.join(workingDir, 'package-lock.json');
        if (fs.existsSync(packageLockPath)) {
            await fsp.copyFile(packageLockPath, path.join(contextDir, 'package-lock.json'));
        }

        // Create placeholder server.js if it doesn't exist
        const serverJsPath = path.join(workingDir, 'server.js');
        if (fs.existsSync(serverJsPath)) {
            await fsp.copyFile(serverJsPath, path.join(contextDir, 'server.js'));
        } else {
            // Create a minimal server.js placeholder
            await fsp.writeFile(
                path.join(contextDir, 'server.js'),
                `// MCP Server Entry Point\n// Generated by MCP Generator\nconsole.log('MCP Server starting...');\n`
            );
        }

        // Create placeholder server.py if Python is involved
        const serverPyPath = path.join(workingDir, 'server.py');
        if (fs.existsSync(serverPyPath)) {
            await fsp.copyFile(serverPyPath, path.join(contextDir, 'server.py'));
        }

        // Copy requirements.txt if exists
        const requirementsPath = path.join(workingDir, 'requirements.txt');
        if (fs.existsSync(requirementsPath)) {
            await fsp.copyFile(requirementsPath, path.join(contextDir, 'requirements.txt'));
        }

        return contextDir;
    } catch (error) {
        // Cleanup on error
        try {
            await fsp.rm(contextDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
        throw error;
    }
}

/**
 * Copy a directory recursively
 */
async function copyDirectory(src: string, dest: string): Promise<void> {
    await fsp.mkdir(dest, { recursive: true });

    const entries = await fsp.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        // Skip test files and hidden files
        if (entry.name.startsWith('.') ||
            entry.name.startsWith('test-') ||
            entry.name.endsWith('.test.ts') ||
            entry.name.endsWith('.spec.ts')) {
            continue;
        }

        if (entry.isDirectory()) {
            await copyDirectory(srcPath, destPath);
        } else {
            await fsp.copyFile(srcPath, destPath);
        }
    }
}

/**
 * Clean up the build context directory
 */
async function cleanupBuildContext(contextDir: string): Promise<void> {
    try {
        await fsp.rm(contextDir, { recursive: true, force: true });
    } catch (error) {
        // Ignore cleanup errors
        console.warn(`Warning: Failed to cleanup build context: ${contextDir}`);
    }
}

/**
 * Write build logs to file
 */
async function writeBuildLog(
    logFile: string,
    logs: BuildLogEntry[],
    rawOutput: string
): Promise<void> {
    const logContent = [
        '='.repeat(60),
        'MCP Image Build Log',
        `Generated: ${new Date().toISOString()}`,
        '='.repeat(60),
        '',
        '--- Structured Log ---',
        ...logs.map(l => `[${l.timestamp.toISOString()}] [${l.type.toUpperCase()}] ${l.message}`),
        '',
        '--- Raw Build Output ---',
        rawOutput
    ].join('\n');

    await fsp.writeFile(logFile, logContent, 'utf-8');
}

/**
 * Parse build failure to extract useful diagnostic information
 */
function parseBuildFailure(
    error: Error,
    buildOutput: string,
    logFile: string
): BuildFailure {
    const failure: BuildFailure = {
        message: error.message,
        suggestions: [],
        buildOutput,
        logFile
    };

    // Extract step information from output
    const stepMatches = buildOutput.matchAll(/Step (\d+)\/(\d+)/g);
    let lastStep = 0;
    let totalSteps = 0;

    for (const match of stepMatches) {
        if (match[1] && match[2]) {
            lastStep = parseInt(match[1], 10);
            totalSteps = parseInt(match[2], 10);
        }
    }

    if (lastStep > 0) {
        failure.failedStep = lastStep;
        failure.totalSteps = totalSteps;
    }

    // Try to extract the failed instruction
    const lines = buildOutput.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (line && (line.includes('RUN ') || line.includes('COPY ') || line.includes('FROM '))) {
            const instructionMatch = line.match(/(RUN|COPY|FROM|ADD|WORKDIR|ENV|EXPOSE|CMD|ENTRYPOINT)\s+.*/);
            if (instructionMatch) {
                failure.failedInstruction = instructionMatch[0];
                break;
            }
        }
    }

    // Generate suggestions based on error patterns
    const errorLower = error.message.toLowerCase();
    const outputLower = buildOutput.toLowerCase();

    // Missing dependency errors
    if (outputLower.includes('no such file or directory') ||
        outputLower.includes('not found')) {
        failure.suggestions.push('Check that all required files exist in the build context');
        failure.suggestions.push('Verify the COPY instructions reference correct paths');
    }

    // Package installation errors
    if (outputLower.includes('npm err') || outputLower.includes('npm error')) {
        failure.suggestions.push('Check package.json for invalid dependencies');
        failure.suggestions.push('Try clearing npm cache and rebuilding');
        failure.suggestions.push('Verify network connectivity for downloading packages');
    }

    if (outputLower.includes('pip') && (outputLower.includes('error') || outputLower.includes('failed'))) {
        failure.suggestions.push('Check requirements.txt for invalid Python packages');
        failure.suggestions.push('Verify Python package versions are compatible');
    }

    // Permission errors
    if (outputLower.includes('permission denied') || outputLower.includes('eacces')) {
        failure.suggestions.push('Check file permissions in the source directory');
        failure.suggestions.push('Ensure Docker has permission to access the build context');
    }

    // Network errors
    if (outputLower.includes('network') ||
        outputLower.includes('connection refused') ||
        outputLower.includes('timeout')) {
        failure.suggestions.push('Check network connectivity');
        failure.suggestions.push('Verify Docker can access package registries');
        failure.suggestions.push('Try using --network=host if behind a proxy');
    }

    // Disk space errors
    if (outputLower.includes('no space left') || outputLower.includes('disk full')) {
        failure.suggestions.push('Free up disk space and try again');
        failure.suggestions.push('Run "docker system prune" to clean up unused resources');
    }

    // Syntax errors
    if (outputLower.includes('syntax error') || outputLower.includes('unexpected')) {
        failure.suggestions.push('Check the Dockerfile syntax');
        failure.suggestions.push('Verify shell commands in RUN instructions');
    }

    // Base image errors
    if (outputLower.includes('manifest unknown') ||
        outputLower.includes('pull access denied') ||
        errorLower.includes('not found')) {
        failure.suggestions.push('Verify the base image name and tag are correct');
        failure.suggestions.push('Check if the image exists in the registry');
        failure.suggestions.push('Try pulling the base image manually first');
    }

    // If no specific suggestions, add generic ones
    if (failure.suggestions.length === 0) {
        failure.suggestions.push('Review the build log for detailed error information');
        failure.suggestions.push('Try building with --no-cache to start fresh');
        failure.suggestions.push(`Check the build log at: ${logFile}`);
    }

    return failure;
}

/**
 * Get a summary of a build result for display
 */
export function formatBuildResult(result: BuildResult): string {
    const lines = [
        '✅ Build Successful!',
        '',
        `Image ID: ${result.imageId}`,
        `Tags: ${result.tags.join(', ')}`,
        `Build Time: ${(result.buildTime / 1000).toFixed(2)}s`,
        `Log File: ${result.logFile}`,
    ];

    if (result.imageSize) {
        const sizeMB = (result.imageSize / (1024 * 1024)).toFixed(2);
        lines.push(`Image Size: ${sizeMB} MB`);
    }

    return lines.join('\n');
}

/**
 * Get a summary of a build failure for display
 */
export function formatBuildFailure(failure: BuildFailure): string {
    const lines = [
        '❌ Build Failed!',
        '',
        `Error: ${failure.message}`,
    ];

    if (failure.failedStep && failure.totalSteps) {
        lines.push(`Failed at: Step ${failure.failedStep}/${failure.totalSteps}`);
    }

    if (failure.failedInstruction) {
        lines.push(`Instruction: ${failure.failedInstruction}`);
    }

    if (failure.suggestions.length > 0) {
        lines.push('');
        lines.push('Suggestions:');
        failure.suggestions.forEach(s => lines.push(`  - ${s}`));
    }

    lines.push('');
    lines.push(`Log File: ${failure.logFile}`);

    return lines.join('\n');
}
