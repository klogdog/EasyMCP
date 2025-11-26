## Create a new git branch for the task from Phase4 and merge back into Phase4 when finished

# Work Notes - Task 4.2: Build Dockerfile Generator

## Current Status

**Task 4.1 (Implement Docker Client Wrapper)** has been **COMPLETED** ✅

### What Was Done in Task 4.1

The previous agent successfully completed all requirements for the Docker client wrapper.

**Key accomplishments:**

- ✅ Created `base/docker-client.ts` with `DockerClient` class (945 lines)
- ✅ Implemented `ping()`, `buildImage()`, `listImages()`, `removeImage()`
- ✅ Implemented `createContainer()`, `startContainer()`, `stopContainer()`, `removeContainer()`
- ✅ Added streaming support for build progress with `ProgressCallback`
- ✅ Custom error classes: `DockerError`, `DockerDaemonNotRunningError`, `DockerImageError`, `DockerContainerError`, `DockerBuildError`
- ✅ Installed dependencies: `dockerode`, `@types/dockerode`, `tar-fs`, `@types/tar-fs`
- ✅ Created comprehensive test suite with 29 tests - all passing
- ✅ Merged to Phase4

Full details in: `/workspace/ActionPlan/Phase4/Task1/TaskCompleteNote1.md` (to be created)

---

## Your Task: Task 4.2 - Build Dockerfile Generator

**Phase**: Phase 4 - Docker Integration  
**Goal**: Dynamically generate Dockerfile for the MCP server based on loaded modules.

### Key Requirements:

1. **Create `base/dockerizer.ts`** with main function:

   ```typescript
   async function generateDockerfile(
     manifest: MCPManifest,
     config: string
   ): Promise<string>;
   ```

2. **Base image selection logic**:
   - `node:20-alpine` - if only TypeScript tools
   - `python:3.11-slim` - if Python modules only
   - Multi-stage build - if both Node and Python are needed

3. **Runtime dependencies**:
   - Install npm packages from manifest.dependencies
   - Install Python packages from requirements

4. **Generate COPY instructions**:
   - Copy all tool files from `/tools`
   - Copy connector files from `/connectors`
   - Copy generated manifest

5. **Working directory structure**:
   - `/app` - main application directory
   - `/app/tools` - tool files
   - `/app/connectors` - connector files
   - `/app/config` - configuration files

6. **Config setup**:
   - `COPY config.yaml /app/config/config.yaml`
   - Make config overridable via volume mount

7. **Environment variables**:
   - `NODE_ENV=production`
   - `MCP_CONFIG_PATH=/app/config/config.yaml`

8. **ENTRYPOINT and CMD**:
   - `ENTRYPOINT ["node", "server.js"]`
   - Add health check

9. **Metadata labels**:
   - version
   - build date
   - tool list

10. **Create `base/test-dockerizer.ts`** with comprehensive tests

### Quick Start:

```bash
git checkout Phase4
git checkout -b task-4.2

# Create base/dockerizer.ts with generateDockerfile function
# Create base/test-dockerizer.ts with tests
npm run build && node dist/test-dockerizer.js

# Complete documentation and merge
git commit -am "Complete Task 4.2 - Dockerfile Generator"
git checkout Phase4 && git merge --no-ff task-4.2
```

### Reference Files:

- Task details: `/workspace/ActionPlan/Phase4/Task2/Task2.md`
- Checklist: `/workspace/ActionPlan/Phase4/TaskCheckList4.md`
- Docker client (use for reference): `base/docker-client.ts`

---

## ⚠️ IMPORTANT: After Completing Task 4.2

You MUST complete these steps after finishing the implementation:

1. **Write TaskReview2.md** - Create a review document at `/workspace/ActionPlan/Phase4/Task2/TaskReview2.md`
   - Include code review (analyze implementation quality)
   - Include test review (verify all tests pass)
   - Include success criteria verification
   - Mark as APPROVED or note any issues found

2. **Update TaskCheckList4.md** - Check off completed items in `/workspace/ActionPlan/Phase4/TaskCheckList4.md`

3. **Write TaskCompleteNote2.md** - Document what was done at `/workspace/ActionPlan/Phase4/Task2/TaskCompleteNote2.md`

4. **Update this WorkNotes.md** - Rewrite with instructions for Task 4.3 for the next agent

---

## Next Task Preview: Task 4.3 - Implement Container Runner

After completing Task 4.2, rewrite this file with instructions for Task 4.3.

See full details: `/workspace/ActionPlan/Phase4/Task3/Task3.md`
