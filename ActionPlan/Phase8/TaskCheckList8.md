# Task Checklist for Phase 8: CLI & Main Entry Point

## Overview

This phase focuses on cli & main entry point.

## Tasks

### Task 8.1: Create CLI Interface

- [ ] Create `base/cli.ts` using commander.js: `const program = new Command()`
- [ ] Add version flag: `-v, --version` reads from package.json
- [ ] Add help documentation: `-h, --help` with examples and common usage patterns
- [ ] Implement verbosity control: `-q` (quiet), default, `-v` (verbose), `-vv` (debug)
- [ ] Add commands: `build` (generate MCP server), `run` (build and start), `list-tools` (show discovered modules), `validate` (check modules)
- [ ] Include global options: `--config <path>`, `--tools-dir <path>`, `--connectors-dir <path>`, `--no-cache`
- [ ] Add colorized output: use chalk for success (green), errors (red), warnings (yellow), info (blue)
- [ ] Implement command aliases: `b` for build, `r` for run
- [ ] **Success Criteria**: User-friendly CLI; clear help text; colorized output; supports common patterns; good error messages


### Task 8.2: Build Main Orchestrator

- [ ] Create `base/main.ts` with `async function generateMCPServer(options: GeneratorOptions): Promise<BuildResult>`
- [ ] Implement workflow orchestration: 1) Load modules 2) Validate 3) Prompt for credentials 4) Generate manifest 5) Generate config 6) Build Docker image 7) Tag and optionally push
- [ ] Add step-by-step logging: "Step 1/7: Loading modules...", show progress, time per step
- [ ] Implement error recovery: if step fails, log context, offer suggestions, allow retry or skip (if non-critical)
- [ ] Add dry-run mode: `--dry-run` flag executes all steps except Docker build, shows what would be created
- [ ] Include checkpointing: save intermediate results (manifest.json, config.yaml) even if later steps fail
- [ ] Add resume capability: detect partial builds, offer to continue from last successful step
- [ ] Implement rollback: if build fails, clean up temp files, partial images, restore previous state
- [ ] **Success Criteria**: Coordinates all steps; shows clear progress; handles errors gracefully; supports dry-run; can resume


### Task 8.3: Create Build Command

- [ ] Add to `cli.ts`: `program.command('build').description('Build MCP server image from tools and connectors')`
- [ ] Add options: `--output <name>` (image name), `--tag <tag>` (version tag), `--platform <platforms>` (multi-arch), `--no-cache` (force rebuild), `--push` (push to registry)
- [ ] Implement source validation: check tools/ and connectors/ directories exist, contain valid files, warn if empty
- [ ] Add build options processing: parse platform string (linux/amd64,linux/arm64), validate image name format
- [ ] Include progress indicators: use ora spinner or progress bar, show current step, estimated time remaining
- [ ] Implement build summary: on completion, show image ID, size, tag, list included tools/connectors, build duration
- [ ] Add output options: `--quiet` for minimal output, `--json` for machine-readable output
- [ ] Handle interruption: Ctrl+C during build cleans up gracefully, doesn't leave partial images
- [ ] **Success Criteria**: Builds MCP server images; validates sources; shows progress; produces detailed summary; handles interruption


### Task 8.4: Create Run Command

- [ ] Add to `cli.ts`: `program.command('run').description('Build and start MCP server')`
- [ ] Add options: `--port <port>` (default 8080), `--host <host>` (default localhost), `--detach` (background mode), `--name <name>` (container name), `--env-file <path>` (load env vars)
- [ ] Implement build then run: call build command internally, on success start container
- [ ] Add port mapping configuration: map specified port to container's internal port, check if port already in use
- [ ] Implement volume mounting: mount config file, optionally mount tools/connectors for development hot-reload
- [ ] Include log streaming: attach to container logs, stream to console with timestamps, colors
- [ ] Add container lifecycle: on exit, optionally remove container (--rm flag), offer to restart on failure
- [ ] Implement health checking: wait for /health endpoint to return 200 before declaring success, timeout after 30s
- [ ] Support detached mode: in --detach, show container ID and how to view logs, how to stop
- [ ] **Success Criteria**: Builds and runs server; maps ports correctly; streams logs; checks health; supports detached mode

