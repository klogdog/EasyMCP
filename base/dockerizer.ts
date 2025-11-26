/**
 * Dockerfile Generator for MCP Server
 * 
 * This module dynamically generates a Dockerfile for the MCP server based on
 * loaded modules. It handles base image selection, dependency installation,
 * and proper configuration of the containerized MCP server.
 */

import { MCPManifest } from "./generator";
import { Module } from "./loader";

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
