# Task Checklist for Phase 1: Project Foundation & Structure

## Overview

This phase focuses on project foundation & structure.

## Tasks

### Task 1.1: Initialize Project Structure ✅ COMPLETE

- [x] Create directories: `/base` (generator code), `/tools` (drop-in MCP tools), `/connectors` (API integrations), `/config` (runtime configs), `/templates` (code generation templates)
- [x] Add README.md in each directory: explain purpose, expected file formats, and naming conventions
- [x] Create `.gitignore`: exclude `node_modules/`, `dist/`, `*.log`, `.env`, `*.img`, Docker build artifacts
- [x] **Success Criteria**: All directories exist with descriptive READMEs; git ignores build artifacts

### Task 1.2: Configure Package Management ✅ COMPLETE

- [x] Create `package.json`: name="mcp-generator", version="0.1.0", main="dist/main.js", scripts for build/test
- [x] Add dependencies: `typescript`, `@types/node`, `dockerode` (Docker SDK), `inquirer` (interactive prompts), `js-yaml` (YAML parsing), `zod` (schema validation)
- [x] Add devDependencies: `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `prettier`, `@types/inquirer`, `@types/js-yaml`
- [x] Create `tsconfig.json`: target ES2020, module commonjs, outDir "./dist", strict mode enabled, esModuleInterop true
- [x] **Success Criteria**: `npm install` runs successfully; TypeScript compiles without errors

### Task 1.3: Set Up Development Container ✅ COMPLETE

- [x] Create `.devcontainer/devcontainer.json`
- [x] Set `image: "mcr.microsoft.com/devcontainers/typescript-node:20"` or similar
- [x] Add features: `"ghcr.io/devcontainers/features/docker-in-docker:2"` for DinD capability
- [x] Configure mounts: bind `/tools`, `/connectors`, `/config` to container
- [x] Set `remoteEnv` for forwarding HOST_PROJECT_PATH, DOCKER_HOST
- [x] Add `postCreateCommand: "npm install"` for automatic setup
- [x] Configure VS Code extensions: Docker, ESLint, Prettier
- [x] **Success Criteria**: Opening in VS Code starts container; `docker ps` works inside container; npm packages installed

### Task 1.4: Create Base Dockerfile ✅ COMPLETE

- [x] Create `Dockerfile` with base `FROM node:20-alpine`
- [x] Install Docker CLI: `apk add docker-cli` (for DinD operations)
- [x] Create WORKDIR `/app`
- [x] Copy `package*.json` and run `npm ci --only=production`
- [x] Copy source files from `/base` directory
- [x] Create volume mount points: `/app/tools`, `/app/connectors`, `/app/config`
- [x] Set ENV NODE_ENV=production
- [x] Define ENTRYPOINT `["node", "dist/main.js"]` with default CMD `["build"]`
- [x] **Success Criteria**: `docker build -t mcp-generator .` succeeds; image contains Node.js, Docker CLI, and source code
