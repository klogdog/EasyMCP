/**
 * CLI Interface for MCP Generator
 *
 * This module provides a user-friendly command-line interface for building,
 * running, and managing MCP servers. It uses commander.js for argument parsing
 * and chalk for colorized output.
 *
 * @module cli
 */

import { Command, Option } from "commander";
import chalk from "chalk";
import ora, { Ora } from "ora";
import * as fs from "fs/promises";
import * as path from "path";
import {
    generateMCPServer,
    GeneratorOptions,
    BuildResult,
    BuildStep,
} from "./main";
import { loadModules } from "./loader";
import { validateModules } from "./validator";
import { DockerClient, ContainerConfig } from "./docker-client";

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Verbosity level for CLI output
 */
export enum Verbosity {
    /** Minimal output - only errors and final result */
    Quiet = 0,
    /** Normal output - progress and key information */
    Normal = 1,
    /** Verbose output - additional details */
    Verbose = 2,
    /** Debug output - all available information */
    Debug = 3,
}

/**
 * Global CLI options available to all commands
 */
export interface GlobalOptions {
    /** Path to configuration file */
    config?: string;
    /** Path to tools directory */
    toolsDir?: string;
    /** Path to connectors directory */
    connectorsDir?: string;
    /** Disable build caching */
    noCache?: boolean;
    /** Verbosity level */
    verbosity: Verbosity;
    /** Output format (text or json) */
    output?: "text" | "json";
}

/**
 * Options for the build command
 */
export interface BuildOptions extends GlobalOptions {
    /** Output image name */
    imageName?: string;
    /** Image tag */
    tag?: string;
    /** Target platforms (e.g., linux/amd64,linux/arm64) */
    platform?: string;
    /** Push to registry after build */
    push?: boolean;
    /** Dry run mode */
    dryRun?: boolean;
}

/**
 * Options for the run command
 */
export interface RunOptions extends GlobalOptions {
    /** Port to expose */
    port?: number;
    /** Host to bind to */
    host?: string;
    /** Run in detached mode */
    detach?: boolean;
    /** Container name */
    name?: string;
    /** Path to environment file */
    envFile?: string;
    /** Remove container after exit */
    rm?: boolean;
}

// ============================================================================
// Output Helpers
// ============================================================================

/** Current verbosity level */
let currentVerbosity: Verbosity = Verbosity.Normal;

/** Current spinner instance */
let spinner: Ora | null = null;

/**
 * Set the current verbosity level
 */
export function setVerbosity(level: Verbosity): void {
    currentVerbosity = level;
}

/**
 * Print a success message
 */
export function success(message: string): void {
    if (currentVerbosity >= Verbosity.Normal) {
        console.log(chalk.green("✓"), message);
    }
}

/**
 * Print an error message
 */
export function error(message: string, details?: string): void {
    console.error(chalk.red("✗"), chalk.red(message));
    if (details && currentVerbosity >= Verbosity.Verbose) {
        console.error(chalk.gray("  " + details));
    }
}

/**
 * Print a warning message
 */
export function warning(message: string): void {
    if (currentVerbosity >= Verbosity.Normal) {
        console.warn(chalk.yellow("⚠"), chalk.yellow(message));
    }
}

/**
 * Print an info message
 */
export function info(message: string): void {
    if (currentVerbosity >= Verbosity.Normal) {
        console.log(chalk.blue("ℹ"), message);
    }
}

/**
 * Print a verbose message
 */
export function verbose(message: string): void {
    if (currentVerbosity >= Verbosity.Verbose) {
        console.log(chalk.gray("  " + message));
    }
}

/**
 * Print a debug message
 */
export function debug(message: string): void {
    if (currentVerbosity >= Verbosity.Debug) {
        console.log(chalk.magenta("[DEBUG]"), chalk.gray(message));
    }
}

/**
 * Start a spinner with a message
 */
export function startSpinner(message: string): Ora {
    if (currentVerbosity >= Verbosity.Normal && currentVerbosity < Verbosity.Debug) {
        spinner = ora({
            text: message,
            color: "blue",
        }).start();
        return spinner;
    }
    // In debug mode, just log the message
    if (currentVerbosity >= Verbosity.Debug) {
        console.log(chalk.blue("→"), message);
    }
    return ora({ text: message, isEnabled: false });
}

/**
 * Stop the current spinner with success
 */
export function stopSpinner(message?: string): void {
    if (spinner) {
        spinner.succeed(message);
        spinner = null;
    }
}

/**
 * Stop the current spinner with failure
 */
export function failSpinner(message?: string): void {
    if (spinner) {
        spinner.fail(message);
        spinner = null;
    }
}

/**
 * Output JSON data
 */
export function outputJson(data: any): void {
    console.log(JSON.stringify(data, null, 2));
}

// ============================================================================
// Package Version Helper
// ============================================================================

/**
 * Read version from package.json
 */
async function getVersion(): Promise<string> {
    try {
        const packagePath = path.join(__dirname, "..", "package.json");
        const content = await fs.readFile(packagePath, "utf-8");
        const pkg = JSON.parse(content);
        return pkg.version || "0.1.0";
    } catch {
        return "0.1.0";
    }
}

// ============================================================================
// Command Handlers
// ============================================================================

/**
 * Handle the build command
 */
async function handleBuild(options: BuildOptions): Promise<void> {
    const startTime = Date.now();
    debug(`Build options: ${JSON.stringify(options, null, 2)}`);

    // Validate source directories
    const basePath = process.cwd();
    const toolsDir = options.toolsDir || path.join(basePath, "tools");
    const connectorsDir =
        options.connectorsDir || path.join(basePath, "connectors");

    // Check directories exist
    const toolsExists = await checkDirectoryExists(toolsDir);
    const connectorsExists = await checkDirectoryExists(connectorsDir);

    if (!toolsExists && !connectorsExists) {
        error(
            "No tools or connectors found",
            `Looked in:\n  - ${toolsDir}\n  - ${connectorsDir}`
        );
        process.exit(1);
    }

    if (!toolsExists) {
        warning(`Tools directory not found: ${toolsDir}`);
    }
    if (!connectorsExists) {
        warning(`Connectors directory not found: ${connectorsDir}`);
    }

    // Validate platform format
    if (options.platform) {
        const platforms = options.platform.split(",");
        const validPlatforms = [
            "linux/amd64",
            "linux/arm64",
            "linux/arm/v7",
            "linux/arm/v6",
        ];
        for (const platform of platforms) {
            if (!validPlatforms.includes(platform.trim())) {
                warning(
                    `Unknown platform: ${platform}. Valid platforms: ${validPlatforms.join(", ")}`
                );
            }
        }
    }

    // Validate image name format
    if (options.imageName && !isValidImageName(options.imageName)) {
        error("Invalid image name format", "Use: [registry/]name[:tag]");
        process.exit(1);
    }

    // Build the MCP server
    const generatorOptions: GeneratorOptions = {
        basePath,
        configPath: options.config,
        toolsDir: options.toolsDir,
        connectorsDir: options.connectorsDir,
        noCache: options.noCache,
        dryRun: options.dryRun,
        imageName: options.imageName,
        imageTag: options.tag,
        platforms: options.platform?.split(",").map((p) => p.trim()),
        push: options.push,
        verbosity: options.verbosity,
        onProgress: (step: BuildStep, message: string) => {
            if (options.output === "json") {
                return;
            }
            if (step.status === "running") {
                startSpinner(`Step ${step.number}/${step.total}: ${message}`);
            } else if (step.status === "completed") {
                stopSpinner(`Step ${step.number}/${step.total}: ${message}`);
            } else if (step.status === "failed") {
                failSpinner(`Step ${step.number}/${step.total}: ${message}`);
            }
        },
    };

    try {
        const result = await generateMCPServer(generatorOptions);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        if (options.output === "json") {
            outputJson({
                success: result.success,
                imageId: result.imageId,
                imageName: result.imageName,
                tags: result.tags,
                toolCount: result.toolCount,
                connectorCount: result.connectorCount,
                duration: `${duration}s`,
            });
        } else {
            console.log("");
            console.log(chalk.bold("Build Summary"));
            console.log(chalk.gray("─".repeat(50)));
            console.log(`  ${chalk.blue("Image ID:")}      ${result.imageId}`);
            console.log(`  ${chalk.blue("Image Name:")}    ${result.imageName}`);
            console.log(`  ${chalk.blue("Tags:")}          ${result.tags?.join(", ") || "none"}`);
            console.log(`  ${chalk.blue("Tools:")}         ${result.toolCount}`);
            console.log(`  ${chalk.blue("Connectors:")}    ${result.connectorCount}`);
            console.log(`  ${chalk.blue("Duration:")}      ${duration}s`);
            console.log(chalk.gray("─".repeat(50)));
            success("Build completed successfully");
        }
    } catch (err) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        if (options.output === "json") {
            outputJson({
                success: false,
                error: err instanceof Error ? err.message : String(err),
                duration: `${duration}s`,
            });
        } else {
            error("Build failed", err instanceof Error ? err.message : String(err));
        }
        process.exit(1);
    }
}

/**
 * Handle the run command
 */
async function handleRun(options: RunOptions): Promise<void> {
    debug(`Run options: ${JSON.stringify(options, null, 2)}`);

    const port = options.port || 8080;
    const host = options.host || "localhost";

    // Check if port is in use
    if (await isPortInUse(port)) {
        error(`Port ${port} is already in use`, "Try a different port with --port");
        process.exit(1);
    }

    // First, build the image
    info("Building MCP server...");

    const basePath = process.cwd();
    const generatorOptions: GeneratorOptions = {
        basePath,
        configPath: options.config,
        toolsDir: options.toolsDir,
        connectorsDir: options.connectorsDir,
        noCache: options.noCache,
        dryRun: false,
        verbosity: options.verbosity,
        onProgress: (step: BuildStep, message: string) => {
            if (options.output === "json") {
                return;
            }
            if (step.status === "running") {
                startSpinner(`Step ${step.number}/${step.total}: ${message}`);
            } else if (step.status === "completed") {
                stopSpinner(`Step ${step.number}/${step.total}: ${message}`);
            } else if (step.status === "failed") {
                failSpinner(`Step ${step.number}/${step.total}: ${message}`);
            }
        },
    };

    let buildResult: BuildResult;
    try {
        buildResult = await generateMCPServer(generatorOptions);
    } catch (err) {
        error("Build failed", err instanceof Error ? err.message : String(err));
        process.exit(1);
    }

    // Create and start container
    info(`Starting container on ${host}:${port}...`);

    const dockerClient = new DockerClient();

    // Load environment variables from file if specified
    let envVars: Record<string, string> = {};
    if (options.envFile) {
        try {
            envVars = await loadEnvFile(options.envFile);
            verbose(`Loaded ${Object.keys(envVars).length} environment variables`);
        } catch (err) {
            error(
                "Failed to load environment file",
                err instanceof Error ? err.message : String(err)
            );
            process.exit(1);
        }
    }

    const containerConfig: ContainerConfig = {
        image: buildResult.imageName || "mcp-server:latest",
        name: options.name,
        ports: { [port]: 3000 },
        env: envVars,
        autoRemove: options.rm,
    };

    // Add volume mounts for config
    if (options.config) {
        const configPath = path.resolve(options.config);
        containerConfig.volumes = {
            [configPath]: "/app/config/config.yaml",
        };
    }

    try {
        const container = await dockerClient.createContainer(containerConfig);
        await dockerClient.startContainer(container.id);

        if (options.detach) {
            // Detached mode
            if (options.output === "json") {
                outputJson({
                    containerId: container.id,
                    port,
                    host,
                    status: "running",
                });
            } else {
                console.log("");
                success("Container started in detached mode");
                console.log("");
                console.log(`  ${chalk.blue("Container ID:")}  ${container.id.substring(0, 12)}`);
                console.log(`  ${chalk.blue("Address:")}       http://${host}:${port}`);
                console.log("");
                console.log(chalk.gray("To view logs:"));
                console.log(chalk.cyan(`  docker logs -f ${container.id.substring(0, 12)}`));
                console.log("");
                console.log(chalk.gray("To stop:"));
                console.log(chalk.cyan(`  docker stop ${container.id.substring(0, 12)}`));
            }
        } else {
            // Attached mode - stream logs and wait for health check
            info("Waiting for server to be ready...");

            const healthTimeout = 30000;
            const healthStartTime = Date.now();
            let isHealthy = false;

            while (Date.now() - healthStartTime < healthTimeout) {
                try {
                    const response = await fetch(`http://${host}:${port}/health`);
                    if (response.ok) {
                        isHealthy = true;
                        break;
                    }
                } catch {
                    // Not ready yet
                }
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }

            if (!isHealthy) {
                warning("Health check timed out, but container may still be starting");
            } else {
                success(`Server is ready at http://${host}:${port}`);
            }

            console.log("");
            console.log(chalk.gray("Streaming logs (Ctrl+C to stop)..."));
            console.log("");

            // Set up graceful shutdown
            const cleanup = async () => {
                console.log("");
                info("Stopping container...");
                try {
                    await dockerClient.stopContainer(container.id);
                    if (!options.rm) {
                        await dockerClient.removeContainer(container.id);
                    }
                    success("Container stopped");
                } catch {
                    // Container may already be stopped
                }
                process.exit(0);
            };

            process.on("SIGINT", cleanup);
            process.on("SIGTERM", cleanup);

            // Poll logs periodically (since streamLogs doesn't exist)
            let lastLogLength = 0;
            const logInterval = setInterval(async () => {
                try {
                    const logs = await dockerClient.getContainerLogs(container.id, 100);
                    if (logs.length > lastLogLength) {
                        process.stdout.write(logs.substring(lastLogLength));
                        lastLogLength = logs.length;
                    }
                } catch {
                    // Container may have stopped
                    clearInterval(logInterval);
                }
            }, 1000);

            // Wait forever (until Ctrl+C)
            await new Promise(() => { });
        }
    } catch (err) {
        error(
            "Failed to start container",
            err instanceof Error ? err.message : String(err)
        );
        process.exit(1);
    }
}

/**
 * Handle the list-tools command
 */
async function handleListTools(options: GlobalOptions): Promise<void> {
    debug(`List tools options: ${JSON.stringify(options, null, 2)}`);

    const basePath = process.cwd();
    const toolsDir = options.toolsDir || path.join(basePath, "tools");
    const connectorsDir =
        options.connectorsDir || path.join(basePath, "connectors");

    startSpinner("Discovering modules...");

    try {
        const modules = await loadModules(basePath);
        stopSpinner("Modules discovered");

        if (modules.length === 0) {
            if (options.output === "json") {
                outputJson({ tools: [], connectors: [] });
            } else {
                warning("No modules found");
                console.log("");
                console.log(chalk.gray("Place tool files in:"), chalk.cyan(toolsDir));
                console.log(
                    chalk.gray("Place connector files in:"),
                    chalk.cyan(connectorsDir)
                );
            }
            return;
        }

        const tools = modules.filter((m) => m.type === "tool");
        const connectors = modules.filter((m) => m.type === "connector");

        if (options.output === "json") {
            outputJson({
                tools: tools.map((t) => ({
                    name: t.name,
                    language: t.language,
                    path: t.path,
                    metadata: t.metadata,
                })),
                connectors: connectors.map((c) => ({
                    name: c.name,
                    language: c.language,
                    path: c.path,
                    metadata: c.metadata,
                })),
            });
        } else {
            console.log("");
            console.log(chalk.bold(`Tools (${tools.length})`));
            console.log(chalk.gray("─".repeat(50)));
            for (const tool of tools) {
                console.log(
                    `  ${chalk.green("•")} ${chalk.bold(tool.name)} ${chalk.gray(`(${tool.language})`)}`
                );
                console.log(
                    `    ${chalk.gray(tool.metadata.description || "No description")}`
                );
            }

            console.log("");
            console.log(chalk.bold(`Connectors (${connectors.length})`));
            console.log(chalk.gray("─".repeat(50)));
            for (const connector of connectors) {
                console.log(
                    `  ${chalk.blue("•")} ${chalk.bold(connector.name)} ${chalk.gray(`(${connector.language})`)}`
                );
                console.log(
                    `    ${chalk.gray(connector.metadata.description || "No description")}`
                );
            }
            console.log("");
        }
    } catch (err) {
        failSpinner("Failed to discover modules");
        error("Discovery failed", err instanceof Error ? err.message : String(err));
        process.exit(1);
    }
}

/**
 * Handle the validate command
 */
async function handleValidate(options: GlobalOptions): Promise<void> {
    debug(`Validate options: ${JSON.stringify(options, null, 2)}`);

    const basePath = process.cwd();
    startSpinner("Loading modules...");

    try {
        const modules = await loadModules(basePath);
        stopSpinner(`Loaded ${modules.length} modules`);

        if (modules.length === 0) {
            if (options.output === "json") {
                outputJson({
                    valid: false,
                    error: "No modules found",
                    modules: 0,
                    errors: [],
                    warnings: [],
                });
            } else {
                warning("No modules found to validate");
            }
            return;
        }

        startSpinner("Validating modules...");
        const result = validateModules(modules);
        stopSpinner("Validation complete");

        if (options.output === "json") {
            outputJson({
                valid: result.valid,
                modules: modules.length,
                errors: result.errors,
                warnings: result.warnings,
            });
        } else {
            console.log("");

            if (result.errors.length > 0) {
                console.log(chalk.bold.red(`Errors (${result.errors.length})`));
                console.log(chalk.gray("─".repeat(50)));
                for (const err of result.errors) {
                    console.log(
                        `  ${chalk.red("✗")} ${chalk.bold(err.moduleName)}: ${err.message}`
                    );
                    if (err.field) {
                        console.log(chalk.gray(`    Field: ${err.field}`));
                    }
                }
                console.log("");
            }

            if (result.warnings.length > 0) {
                console.log(chalk.bold.yellow(`Warnings (${result.warnings.length})`));
                console.log(chalk.gray("─".repeat(50)));
                for (const warn of result.warnings) {
                    console.log(`  ${chalk.yellow("⚠")} ${warn}`);
                }
                console.log("");
            }

            if (result.valid) {
                success(`All ${modules.length} modules are valid`);
            } else {
                error(
                    `Validation failed with ${result.errors.length} error(s)`,
                    "Fix the errors above and try again"
                );
                process.exit(1);
            }
        }
    } catch (err) {
        failSpinner("Validation failed");
        error("Validation error", err instanceof Error ? err.message : String(err));
        process.exit(1);
    }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a directory exists
 */
async function checkDirectoryExists(dirPath: string): Promise<boolean> {
    try {
        const stat = await fs.stat(dirPath);
        return stat.isDirectory();
    } catch {
        return false;
    }
}

/**
 * Validate Docker image name format
 */
function isValidImageName(name: string): boolean {
    // Simple validation: allow alphanumeric, dashes, underscores, slashes, colons, dots
    const pattern = /^[a-z0-9][a-z0-9._\-/:]*$/i;
    return pattern.test(name);
}

/**
 * Check if a port is in use
 */
async function isPortInUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const net = require("net");
        const server = net.createServer();
        server.once("error", () => resolve(true));
        server.once("listening", () => {
            server.close();
            resolve(false);
        });
        server.listen(port);
    });
}

/**
 * Load environment variables from a file
 */
async function loadEnvFile(filePath: string): Promise<Record<string, string>> {
    const content = await fs.readFile(filePath, "utf-8");
    const env: Record<string, string> = {};

    for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const eqIndex = trimmed.indexOf("=");
        if (eqIndex === -1) continue;

        const key = trimmed.substring(0, eqIndex).trim();
        let value = trimmed.substring(eqIndex + 1).trim();

        // Remove quotes if present
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        env[key] = value;
    }

    return env;
}

// ============================================================================
// CLI Setup
// ============================================================================

/**
 * Create and configure the CLI program
 */
export async function createProgram(): Promise<Command> {
    const version = await getVersion();
    const program = new Command();

    program
        .name("mcp-generator")
        .description(
            "MCP Server Generator - Build and run MCP servers from tools and connectors"
        )
        .version(version, "-v, --version", "Display version number")
        .helpOption("-h, --help", "Display help information")
        .addHelpText(
            "after",
            `
Examples:
  $ mcp-generator build                     Build MCP server with default settings
  $ mcp-generator build -o myserver -t v1.0 Build with custom name and tag
  $ mcp-generator run --port 3000           Build and run on port 3000
  $ mcp-generator list-tools                Show discovered tools and connectors
  $ mcp-generator validate                  Validate module definitions

For more information, visit: https://github.com/klogdog/EasyMCP
`
        );

    // Global options
    program
        .option("-c, --config <path>", "Path to configuration file")
        .option("--tools-dir <path>", "Path to tools directory")
        .option("--connectors-dir <path>", "Path to connectors directory")
        .option("--no-cache", "Disable build caching")
        .addOption(
            new Option("-q, --quiet", "Minimal output").conflicts("verbose")
        )
        .addOption(
            new Option("--verbose", "Verbose output").conflicts("quiet")
        )
        .addOption(new Option("--debug", "Debug output"))
        .option("--json", "Output in JSON format");

    // Build command
    program
        .command("build")
        .alias("b")
        .description("Build MCP server image from tools and connectors")
        .option("-o, --output <name>", "Output image name", "mcp-server")
        .option("-t, --tag <tag>", "Image version tag", "latest")
        .option(
            "--platform <platforms>",
            "Target platforms (e.g., linux/amd64,linux/arm64)"
        )
        .option("--push", "Push to registry after build")
        .option("--dry-run", "Preview build without executing Docker commands")
        .action(async (cmdOptions, cmd) => {
            const globalOpts = cmd.parent?.opts() || {};
            const options = mergeOptions(globalOpts, cmdOptions) as BuildOptions;
            options.imageName = cmdOptions.output;
            options.tag = cmdOptions.tag;
            options.platform = cmdOptions.platform;
            options.push = cmdOptions.push;
            options.dryRun = cmdOptions.dryRun;
            await handleBuild(options);
        });

    // Run command
    program
        .command("run")
        .alias("r")
        .description("Build and start MCP server")
        .option("-p, --port <port>", "Port to expose", "8080")
        .option("-H, --host <host>", "Host to bind to", "localhost")
        .option("-d, --detach", "Run in background")
        .option("-n, --name <name>", "Container name")
        .option("--env-file <path>", "Path to environment file")
        .option("--rm", "Remove container after exit")
        .action(async (cmdOptions, cmd) => {
            const globalOpts = cmd.parent?.opts() || {};
            const options = mergeOptions(globalOpts, cmdOptions) as RunOptions;
            options.port = parseInt(cmdOptions.port, 10);
            options.host = cmdOptions.host;
            options.detach = cmdOptions.detach;
            options.name = cmdOptions.name;
            options.envFile = cmdOptions.envFile;
            options.rm = cmdOptions.rm;
            await handleRun(options);
        });

    // List tools command
    program
        .command("list-tools")
        .alias("ls")
        .description("Show discovered tools and connectors")
        .action(async (cmdOptions, cmd) => {
            const globalOpts = cmd.parent?.opts() || {};
            const options = mergeOptions(globalOpts, cmdOptions) as GlobalOptions;
            await handleListTools(options);
        });

    // Validate command
    program
        .command("validate")
        .alias("check")
        .description("Validate module definitions")
        .action(async (cmdOptions, cmd) => {
            const globalOpts = cmd.parent?.opts() || {};
            const options = mergeOptions(globalOpts, cmdOptions) as GlobalOptions;
            await handleValidate(options);
        });

    return program;
}

/**
 * Merge global and command-specific options
 */
function mergeOptions(
    globalOpts: Record<string, any>,
    cmdOpts: Record<string, any>
): GlobalOptions {
    // Determine verbosity level
    let verbosity = Verbosity.Normal;
    if (globalOpts.quiet) {
        verbosity = Verbosity.Quiet;
    } else if (globalOpts.debug) {
        verbosity = Verbosity.Debug;
    } else if (globalOpts.verbose) {
        verbosity = Verbosity.Verbose;
    }

    setVerbosity(verbosity);

    return {
        config: globalOpts.config,
        toolsDir: globalOpts.toolsDir,
        connectorsDir: globalOpts.connectorsDir,
        noCache: globalOpts.cache === false, // --no-cache sets cache to false
        verbosity,
        output: globalOpts.json ? "json" : "text",
        ...cmdOpts,
    };
}

/**
 * Run the CLI
 */
export async function run(args?: string[]): Promise<void> {
    try {
        const program = await createProgram();
        await program.parseAsync(args || process.argv);
    } catch (err) {
        error(
            "Command failed",
            err instanceof Error ? err.message : String(err)
        );
        process.exit(1);
    }
}

// Entry point when run directly
if (require.main === module) {
    run();
}
