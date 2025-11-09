# Task Checklist for Phase 4: Docker Integration

## Overview

This phase focuses on docker integration.

## Tasks

### Task 4.1: Implement Docker Client Wrapper

- [ ] Create `base/docker-client.ts` with class DockerClient
- [ ] Initialize dockerode: `new Docker({ socketPath: '/var/run/docker.sock' })` or from DOCKER_HOST env
- [ ] Implement `async ping(): Promise<boolean>` to verify Docker daemon connectivity
- [ ] Add `async buildImage(context: string, dockerfile: string, tag: string, onProgress?: (msg) => void): Promise<string>`
- [ ] Implement `async listImages(filter?: string): Promise<ImageInfo[]>` to query local images
- [ ] Add `async removeImage(imageId: string): Promise<void>` for cleanup
- [ ] Implement `async createContainer(config: ContainerConfig): Promise<Container>` and `startContainer(id: string)`
- [ ] Add error handling: wrap Docker errors with descriptive messages, detect "daemon not running" errors
- [ ] Implement streaming: use dockerode streams API for build progress, parse JSON progress messages
- [ ] **Success Criteria**: Connects to Docker; builds images successfully; streams progress; handles errors gracefully


### Task 4.2: Build Dockerfile Generator

- [ ] Create `base/dockerizer.ts` with `async function generateDockerfile(manifest: MCPManifest, config: string): Promise<string>`
- [ ] Start with base image selection: use `node:20-alpine` if only TypeScript tools, `python:3.11-slim` if Python modules, multi-stage build if both
- [ ] Add runtime dependencies: install npm packages from manifest.dependencies, Python packages from requirements
- [ ] Generate COPY instructions: copy all tool files from /tools, connector files from /connectors, generated manifest
- [ ] Add config setup: `COPY config.yaml /app/config/config.yaml`, make it overridable via volume mount
- [ ] Create working directory structure: `/app`, `/app/tools`, `/app/connectors`, `/app/config`
- [ ] Set environment variables: NODE_ENV=production, MCP_CONFIG_PATH=/app/config/config.yaml
- [ ] Define ENTRYPOINT and CMD: `ENTRYPOINT ["node", "server.js"]` with health check
- [ ] Add metadata labels: version, build date, tool list
- [ ] Return complete Dockerfile as string
- [ ] **Success Criteria**: Generates valid Dockerfile; includes all dependencies; supports both Node and Python


### Task 4.3: Create Image Builder

- [ ] Extend `dockerizer.ts` with `async function buildMCPImage(manifest: MCPManifest, config: string, options: BuildOptions): Promise<string>`
- [ ] Create build context directory: temp folder with Dockerfile, all tools/connectors, config file, manifest.json
- [ ] Use `tar` library to create build context tarball (Docker API requires tar stream)
- [ ] Call DockerClient.buildImage() with context stream and generated Dockerfile
- [ ] Stream build progress to console: parse JSON progress messages, show step numbers, time elapsed
- [ ] Capture build logs: store in .build.log for debugging, include timestamps
- [ ] Handle build failures: parse error messages, identify which step failed, suggest fixes (missing dependency, syntax error)
- [ ] Add rollback capability: if build fails, don't tag image, clean up partial images
- [ ] Return imageId on success
- [ ] **Success Criteria**: Successfully builds images; shows real-time progress; captures logs; handles failures gracefully


### Task 4.4: Implement Image Tagging & Registry

- [ ] Create `base/registry.ts` with `async function tagImage(imageId: string, tags: string[]): Promise<void>`
- [ ] Implement tagging strategy: use `mcp-server:latest`, `mcp-server:v{version}`, `mcp-server:{timestamp}`
- [ ] Add `async function pushImage(tag: string, registry: string, auth?: RegistryAuth): Promise<void>` using dockerode
- [ ] Implement registry authentication: support Docker Hub, GitHub Container Registry, private registries via auth config
- [ ] Create `async function listLocalImages(prefix: string): Promise<ImageInfo[]>` to show available MCP images
- [ ] Add cleanup utility: `async function pruneOldImages(keepCount: number): Promise<void>` to remove old builds
- [ ] Implement tag validation: ensure tags follow Docker naming conventions, handle special characters
- [ ] Add dry-run mode for push operations
- [ ] **Success Criteria**: Tags images with version/timestamp; can push to registry; cleans up old images

