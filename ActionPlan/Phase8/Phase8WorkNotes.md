# Work Notes - Phase 8: CLI & Main Entry Point

## Current Status

**Phase 7 (Docker Generator)** should be completed before starting Phase 8.

---

## Phase 8 Overview

**Goal**: Build the command-line interface and main orchestrator that ties all previous phases together.

Phase 8 is the **user-facing interface layer** that:

1. Provides CLI commands for building and running MCP servers
2. Orchestrates the entire generation workflow
3. Handles user input, progress display, and error reporting
4. Enables both interactive and automated usage

---

## Dependencies from Previous Phases

Phase 8 requires these components from earlier phases:

| Component            | Phase   | File                           | Purpose                   |
| -------------------- | ------- | ------------------------------ | ------------------------- |
| Module Loader        | Phase 2 | `base/loader.ts`               | Load tools & connectors   |
| Module Validator     | Phase 2 | `base/validator.ts`            | Validate module schemas   |
| Manifest Generator   | Phase 2 | `base/generator.ts`            | Generate MCP manifest     |
| Config Generator     | Phase 2 | `base/config-generator.ts`     | Generate runtime config   |
| Credential Discovery | Phase 3 | `base/credential-discovery.ts` | Discover credential needs |
| Prompt System        | Phase 3 | `base/prompt.ts`               | Interactive prompts       |
| Secret Manager       | Phase 3 | `base/secrets.ts`              | Handle credentials        |
| Docker Client        | Phase 4 | `base/docker-client.ts`        | Docker operations         |
| Dockerizer           | Phase 4 | `base/dockerizer.ts`           | Build Docker images       |
| Registry             | Phase 4 | `base/registry.ts`             | Push to registries        |

---

## Task 8.1: Create CLI Interface

**Branch**: `task-8.1` from `Phase8`  
**Goal**: Build user-friendly command-line interface using commander.js.

### Requirements:

1. **Create `base/cli.ts`**

2. **Set Up Commander Program**:

   ```typescript
   import { Command } from "commander";
   import chalk from "chalk";

   const program = new Command();

   program
     .name("mcp-generator")
     .version(require("../package.json").version)
     .description("Generate MCP servers from tools and connectors");
   ```

3. **Add Global Options**:

   ```typescript
   program
     .option(
       "--config <path>",
       "Path to config file",
       "./config/development.yaml"
     )
     .option("--tools-dir <path>", "Path to tools directory", "./tools")
     .option(
       "--connectors-dir <path>",
       "Path to connectors directory",
       "./connectors"
     )
     .option("--no-cache", "Disable build cache")
     .option("-q, --quiet", "Minimal output")
     .option("-v, --verbose", "Verbose output")
     .option("-vv, --debug", "Debug output");
   ```

4. **Add Commands**:
   - `build` (alias: `b`) - Generate MCP server image
   - `run` (alias: `r`) - Build and start server
   - `list-tools` - Show discovered modules
   - `validate` - Check modules without building

5. **Implement Colorized Output**:

   ```typescript
   const log = {
     success: (msg: string) => console.log(chalk.green("✓ " + msg)),
     error: (msg: string) => console.error(chalk.red("✗ " + msg)),
     warn: (msg: string) => console.log(chalk.yellow("⚠ " + msg)),
     info: (msg: string) => console.log(chalk.blue("ℹ " + msg)),
   };
   ```

6. **Add Help Examples**:
   ```typescript
   program.addHelpText(
     "after",
     `
   Examples:
     $ mcp-generator build                    Build with defaults
     $ mcp-generator build -o my-server:v1    Build with custom tag
     $ mcp-generator run --port 9000          Build and run on port 9000
     $ mcp-generator list-tools               Show all discovered modules
     $ mcp-generator validate                 Validate modules only
   `
   );
   ```

### Files to Create:

- `base/cli.ts` - Main CLI implementation
- `base/test-cli.ts` - Test file for CLI

### Dependencies to Add:

```bash
npm install commander chalk ora
npm install -D @types/chalk
```

### Success Criteria:

- [ ] `npx ts-node base/cli.ts --help` shows usage
- [ ] `npx ts-node base/cli.ts --version` shows package version
- [ ] All commands registered and accessible
- [ ] Colorized output works correctly
- [ ] Global options parsed correctly

---

## Task 8.2: Build Main Orchestrator

**Branch**: `task-8.2` from `Phase8`  
**Goal**: Coordinate all generator steps in proper sequence.

### Requirements:

1. **Update `base/main.ts`**:

   ```typescript
   export interface GeneratorOptions {
     toolsDir: string;
     connectorsDir: string;
     configPath: string;
     outputName: string;
     outputTag: string;
     dryRun: boolean;
     noCache: boolean;
     push: boolean;
     platforms: string[];
   }

   export interface BuildResult {
     success: boolean;
     imageId?: string;
     imageName?: string;
     manifest?: MCPManifest;
     duration: number;
     errors: string[];
   }
   ```

2. **Implement Workflow Orchestration**:

   ```typescript
   export async function generateMCPServer(
     options: GeneratorOptions
   ): Promise<BuildResult> {
     const steps = [
       { name: "Loading modules", fn: loadModules },
       { name: "Validating modules", fn: validateModules },
       { name: "Discovering credentials", fn: discoverCredentials },
       { name: "Prompting for credentials", fn: promptCredentials },
       { name: "Generating manifest", fn: generateManifest },
       { name: "Generating config", fn: generateConfig },
       { name: "Building Docker image", fn: buildImage },
     ];

     for (let i = 0; i < steps.length; i++) {
       console.log(`Step ${i + 1}/${steps.length}: ${steps[i].name}...`);
       // Execute step with timing
     }
   }
   ```

3. **Add Step-by-Step Logging**:
   - Show current step: "Step 1/7: Loading modules..."
   - Show timing per step: "✓ Completed in 1.2s"
   - Show summary at end

4. **Implement Error Recovery**:

   ```typescript
   interface StepResult {
     success: boolean;
     data?: any;
     error?: Error;
     canContinue: boolean;
   }
   ```

   - If step fails, log context and error details
   - Offer suggestions for common issues
   - Allow skip for non-critical steps

5. **Add Dry-Run Mode**:
   - Execute all steps except Docker build
   - Show what would be created
   - Validate everything without side effects

6. **Implement Checkpointing**:

   ```typescript
   interface Checkpoint {
     step: number;
     timestamp: Date;
     manifest?: MCPManifest;
     config?: string;
   }
   ```

   - Save intermediate results to `.mcp-checkpoint.json`
   - Allow resume from last successful step

7. **Implement Rollback**:
   - If build fails, clean up temp files
   - Remove partial Docker images
   - Restore previous state

### Files to Modify/Create:

- `base/main.ts` - Main orchestrator (update existing placeholder)
- `base/test-main.ts` - Test file

### Success Criteria:

- [ ] All 7 steps execute in sequence
- [ ] Progress shown for each step with timing
- [ ] Dry-run works without Docker operations
- [ ] Checkpoint file created during build
- [ ] Resume capability works
- [ ] Errors handled gracefully with suggestions

---

## Task 8.3: Create Build Command

**Branch**: `task-8.3` from `Phase8`  
**Goal**: Implement the main 'build' command for generating MCP servers.

### Requirements:

1. **Add Build Command to CLI**:

   ```typescript
   program
     .command("build")
     .alias("b")
     .description("Build MCP server image from tools and connectors")
     .option("-o, --output <name>", "Output image name", "mcp-server")
     .option("-t, --tag <tag>", "Image tag", "latest")
     .option("--platform <platforms>", "Target platforms", "linux/amd64")
     .option("--no-cache", "Force rebuild without cache")
     .option("--push", "Push to registry after build")
     .option("--quiet", "Minimal output")
     .option("--json", "JSON output format")
     .action(buildCommand);
   ```

2. **Implement Source Validation**:

   ```typescript
   async function validateSources(toolsDir: string, connectorsDir: string) {
     // Check directories exist
     // Check for valid files
     // Warn if empty
     // Return validation result
   }
   ```

3. **Add Progress Indicators**:

   ```typescript
   import ora from "ora";

   const spinner = ora("Building MCP server...").start();
   // Update spinner.text for each step
   spinner.succeed("Build complete!");
   ```

4. **Implement Build Summary**:

   ```typescript
   interface BuildSummary {
     imageId: string;
     imageName: string;
     imageSize: string;
     tools: string[];
     connectors: string[];
     duration: string;
   }

   function printBuildSummary(summary: BuildSummary) {
     console.log("\n📦 Build Summary");
     console.log("─".repeat(40));
     console.log(`Image: ${summary.imageName}`);
     console.log(`ID: ${summary.imageId}`);
     console.log(`Size: ${summary.imageSize}`);
     console.log(`Tools: ${summary.tools.join(", ")}`);
     console.log(`Connectors: ${summary.connectors.join(", ")}`);
     console.log(`Duration: ${summary.duration}`);
   }
   ```

5. **Handle Interruption**:
   ```typescript
   process.on("SIGINT", async () => {
     console.log("\n\nBuild interrupted. Cleaning up...");
     await cleanup();
     process.exit(1);
   });
   ```

### Files to Modify:

- `base/cli.ts` - Add build command

### Success Criteria:

- [ ] `mcp-generator build` works with defaults
- [ ] Custom output name and tag work
- [ ] Progress spinner shows during build
- [ ] Summary printed on completion
- [ ] JSON output mode works
- [ ] Ctrl+C cleans up gracefully

---

## Task 8.4: Create Run Command

**Branch**: `task-8.4` from `Phase8`  
**Goal**: Build and immediately run the generated MCP server.

### Requirements:

1. **Add Run Command to CLI**:

   ```typescript
   program
     .command("run")
     .alias("r")
     .description("Build and start MCP server")
     .option("-p, --port <port>", "Port to expose", "8080")
     .option("-H, --host <host>", "Host to bind", "localhost")
     .option("-d, --detach", "Run in background")
     .option("-n, --name <name>", "Container name")
     .option("--env-file <path>", "Load environment variables from file")
     .option("--rm", "Remove container when stopped")
     .action(runCommand);
   ```

2. **Implement Build-then-Run**:

   ```typescript
   async function runCommand(options: RunOptions) {
     // First build the image
     const buildResult = await buildCommand({ ...options, quiet: true });

     if (!buildResult.success) {
       throw new Error("Build failed");
     }

     // Then run the container
     await runContainer(buildResult.imageId, options);
   }
   ```

3. **Add Port Mapping**:

   ```typescript
   async function checkPortAvailable(port: number): Promise<boolean> {
     // Check if port is in use
   }

   // Docker port mapping
   const containerConfig = {
     ExposedPorts: { [`${containerPort}/tcp`]: {} },
     HostConfig: {
       PortBindings: {
         [`${containerPort}/tcp`]: [{ HostPort: String(hostPort) }],
       },
     },
   };
   ```

4. **Implement Log Streaming**:

   ```typescript
   async function streamLogs(containerId: string) {
     const container = docker.getContainer(containerId);
     const stream = await container.logs({
       follow: true,
       stdout: true,
       stderr: true,
       timestamps: true,
     });

     stream.on("data", (chunk) => {
       console.log(formatLogLine(chunk.toString()));
     });
   }
   ```

5. **Add Health Checking**:

   ```typescript
   async function waitForHealth(
     containerId: string,
     timeout = 30000
   ): Promise<boolean> {
     const startTime = Date.now();
     while (Date.now() - startTime < timeout) {
       try {
         const response = await fetch(`http://localhost:${port}/health`);
         if (response.ok) return true;
       } catch (e) {
         // Not ready yet
       }
       await sleep(1000);
     }
     return false;
   }
   ```

6. **Support Detached Mode**:
   ```typescript
   if (options.detach) {
     console.log(`Container started: ${containerId}`);
     console.log(`View logs: docker logs -f ${containerId}`);
     console.log(`Stop: docker stop ${containerId}`);
   } else {
     await streamLogs(containerId);
   }
   ```

### Files to Modify:

- `base/cli.ts` - Add run command

### Success Criteria:

- [ ] `mcp-generator run` builds and starts server
- [ ] Port mapping works correctly
- [ ] Logs stream to console
- [ ] Health check waits for server ready
- [ ] Detached mode works with helpful output
- [ ] --rm flag removes container on exit

---

## Quick Start Workflow

```bash
# Create Phase8 branch from main (after Phase7 is complete)
git checkout main
git checkout -b Phase8

# Install new dependencies
npm install commander chalk ora

# Task 8.1 - CLI Interface
git checkout -b task-8.1
# Create base/cli.ts
# Test: npx ts-node base/cli.ts --help
git commit -am "Complete Task 8.1 - CLI Interface"
git checkout Phase8 && git merge --no-ff task-8.1

# Task 8.2 - Main Orchestrator
git checkout -b task-8.2
# Update base/main.ts
# Test: npx ts-node base/test-main.ts
git commit -am "Complete Task 8.2 - Main Orchestrator"
git checkout Phase8 && git merge --no-ff task-8.2

# Task 8.3 - Build Command
git checkout -b task-8.3
# Add build command to cli.ts
# Test: npx ts-node base/cli.ts build --dry-run
git commit -am "Complete Task 8.3 - Build Command"
git checkout Phase8 && git merge --no-ff task-8.3

# Task 8.4 - Run Command
git checkout -b task-8.4
# Add run command to cli.ts
# Test: npx ts-node base/cli.ts run --help
git commit -am "Complete Task 8.4 - Run Command"
git checkout Phase8 && git merge --no-ff task-8.4

# Final merge to main
git checkout main
git merge --no-ff Phase8 -m "Complete Phase 8 - CLI & Main Entry Point"
```

---

## Key Architecture Decisions

### 1. CLI Framework: Commander.js

- Industry standard for Node.js CLIs
- Built-in help generation
- Command/subcommand support
- Option parsing with validation

### 2. Output Formatting: Chalk + Ora

- Chalk for colorized text
- Ora for spinners and progress
- Consistent visual feedback

### 3. Workflow Orchestration

- Step-by-step execution with logging
- Checkpointing for resume capability
- Clean rollback on failure

### 4. Container Management

- Build then run pattern
- Health checking before "ready"
- Log streaming for debugging

---

## Error Handling Patterns

### CLI Errors

```typescript
try {
  await command(options);
} catch (error) {
  console.error(chalk.red(`Error: ${error.message}`));
  if (options.verbose) {
    console.error(error.stack);
  }
  process.exit(1);
}
```

### Build Step Failures

```typescript
// Step failed - show recovery options
console.error(chalk.red(`Step "${step.name}" failed: ${error.message}`));
console.log(chalk.yellow("\nSuggestions:"));
console.log("  • Check Docker daemon is running: docker ps");
console.log("  • Validate modules: mcp-generator validate");
console.log("  • Check credential requirements");
```

### Container Failures

```typescript
// Container exited unexpectedly
console.error(chalk.red("Container exited unexpectedly"));
console.log("Fetching container logs...");
const logs = await container.logs({ tail: 50 });
console.log(logs);
```

---

## Testing Strategy

### Unit Tests

- Test command option parsing
- Test workflow step execution
- Test progress formatting

### Integration Tests

- Full build command with mock Docker
- Run command with container lifecycle
- Interrupt handling

### Manual Testing

```bash
# Test help
npx ts-node base/cli.ts --help
npx ts-node base/cli.ts build --help
npx ts-node base/cli.ts run --help

# Test list-tools
npx ts-node base/cli.ts list-tools

# Test validate
npx ts-node base/cli.ts validate

# Test build (dry-run)
npx ts-node base/cli.ts build --dry-run

# Test full build
npx ts-node base/cli.ts build -o test-server:v1

# Test run
npx ts-node base/cli.ts run --port 9000
```

---

## Reference Files

- Task details: `/workspace/ActionPlan/Phase8/Task1-4/`
- Checklist: `/workspace/ActionPlan/Phase8/TaskCheckList8.md`
- Current main.ts: `base/main.ts` (placeholder)
- Package.json: `package.json` (for version, dependencies)
- Docker client: `base/docker-client.ts`
- Dockerizer: `base/dockerizer.ts`

---

## Phase 8 Progress Tracker

| Task | Description             | Status         | Branch   |
| ---- | ----------------------- | -------------- | -------- |
| 8.1  | Create CLI Interface    | ⬜ Not Started | task-8.1 |
| 8.2  | Build Main Orchestrator | ⬜ Not Started | task-8.2 |
| 8.3  | Create Build Command    | ⬜ Not Started | task-8.3 |
| 8.4  | Create Run Command      | ⬜ Not Started | task-8.4 |

---

## Notes

- Phase 8 is the "glue" that brings all previous components together
- The CLI becomes the primary user interface for the generator
- Main orchestrator should be well-tested as it coordinates everything
- Consider adding a `--watch` mode for development in future phases
- Error messages should be actionable with clear recovery steps
