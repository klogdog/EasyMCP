# Task 8.3: Create Build Command

**Goal**: Implement the main 'build' command for generating MCP servers.

**Actions**:

- Add to `cli.ts`: `program.command('build').description('Build MCP server image from tools and connectors')`
- Add options: `--output <name>` (image name), `--tag <tag>` (version tag), `--platform <platforms>` (multi-arch), `--no-cache` (force rebuild), `--push` (push to registry)
- Implement source validation: check tools/ and connectors/ directories exist, contain valid files, warn if empty
- Add build options processing: parse platform string (linux/amd64,linux/arm64), validate image name format
- Include progress indicators: use ora spinner or progress bar, show current step, estimated time remaining
- Implement build summary: on completion, show image ID, size, tag, list included tools/connectors, build duration
- Add output options: `--quiet` for minimal output, `--json` for machine-readable output
- Handle interruption: Ctrl+C during build cleans up gracefully, doesn't leave partial images

**Success Criteria**: Builds MCP server images; validates sources; shows progress; produces detailed summary; handles interruption
