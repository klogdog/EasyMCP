# Task 1.4: Create Base Dockerfile

**Goal**: Build the Dockerfile for the MCP generator container that will build other MCP servers.

**Actions**:

- Create `Dockerfile` with base `FROM node:20-alpine`
- Install Docker CLI: `apk add docker-cli` (for DinD operations)
- Create WORKDIR `/app`
- Copy `package*.json` and run `npm ci --only=production`
- Copy source files from `/base` directory
- Create volume mount points: `/app/tools`, `/app/connectors`, `/app/config`
- Set ENV NODE_ENV=production
- Define ENTRYPOINT `["node", "dist/main.js"]` with default CMD `["build"]`

**Success Criteria**: `docker build -t mcp-generator .` succeeds; image contains Node.js, Docker CLI, and source code
