# Task 4.2: Build Dockerfile Generator

**Goal**: Dynamically generate Dockerfile for the MCP server based on loaded modules.

**Actions**:

- Create `base/dockerizer.ts` with `async function generateDockerfile(manifest: MCPManifest, config: string): Promise<string>`
- Start with base image selection: use `node:20-alpine` if only TypeScript tools, `python:3.11-slim` if Python modules, multi-stage build if both
- Add runtime dependencies: install npm packages from manifest.dependencies, Python packages from requirements
- Generate COPY instructions: copy all tool files from /tools, connector files from /connectors, generated manifest
- Add config setup: `COPY config.yaml /app/config/config.yaml`, make it overridable via volume mount
- Create working directory structure: `/app`, `/app/tools`, `/app/connectors`, `/app/config`
- Set environment variables: NODE_ENV=production, MCP_CONFIG_PATH=/app/config/config.yaml
- Define ENTRYPOINT and CMD: `ENTRYPOINT ["node", "server.js"]` with health check
- Add metadata labels: version, build date, tool list
- Return complete Dockerfile as string

**Success Criteria**: Generates valid Dockerfile; includes all dependencies; supports both Node and Python
