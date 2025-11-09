# Task 8.2: Build Main Orchestrator

**Goal**: Coordinate all generator steps in proper sequence.

**Actions**:

- Create `base/main.ts` with `async function generateMCPServer(options: GeneratorOptions): Promise<BuildResult>`
- Implement workflow orchestration: 1) Load modules 2) Validate 3) Prompt for credentials 4) Generate manifest 5) Generate config 6) Build Docker image 7) Tag and optionally push
- Add step-by-step logging: "Step 1/7: Loading modules...", show progress, time per step
- Implement error recovery: if step fails, log context, offer suggestions, allow retry or skip (if non-critical)
- Add dry-run mode: `--dry-run` flag executes all steps except Docker build, shows what would be created
- Include checkpointing: save intermediate results (manifest.json, config.yaml) even if later steps fail
- Add resume capability: detect partial builds, offer to continue from last successful step
- Implement rollback: if build fails, clean up temp files, partial images, restore previous state

**Success Criteria**: Coordinates all steps; shows clear progress; handles errors gracefully; supports dry-run; can resume
