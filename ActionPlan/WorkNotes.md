## Create a new git branch for the task from main and write into main when finished

# Work Notes - Task 2.1: Implement Module Loader

## Current Status

**Phase 1 (Project Foundation & Structure)** has been **COMPLETED** ✅

All tasks in Phase 1 are complete:
- ✅ Task 1.1: Initialize Project Structure
- ✅ Task 1.2: Configure Package Management
- ✅ Task 1.3: Set Up Development Container
- ✅ Task 1.4: Create Base Dockerfile

### What Was Done in Task 1.4

The previous agent successfully:

1. **Reviewed Task 1.3** and documented findings in TaskReview3.md with APPROVED status
2. **Created production Dockerfile** at `/workspace/Dockerfile` with:
   - Node.js 20 Alpine base image (219MB final size)
   - Docker CLI installation for DinD operations
   - Optimized layer caching (package.json copied before source)
   - Production-only dependencies
   - Volume mount points for tools, connectors, config, templates
   - Proper ENTRYPOINT and CMD configuration
3. **Tested Docker build** successfully:
   - Image builds without errors
   - Container runs correctly
   - Docker CLI v28.3.3 available in container
   - Node.js v20.19.5 confirmed
4. **Updated documentation**:
   - TaskCheckList1.md marked complete
   - TaskCompleteNote4.md created with comprehensive details
5. **Branch**: Changes are on `task-1.4-base-dockerfile`

### Review Required

**IMPORTANT**: Before starting Task 2.1, you must review the work completed in Task 1.4:

1. **Check TaskCompleteNote4.md**: Read `/workspace/ActionPlan/Phase1/Task4/TaskCompleteNote4.md` to understand what was completed
2. **Verify Dockerfile**: Review `/workspace/Dockerfile` structure and contents
3. **Test Docker Build**: Ensure `docker build -t mcp-generator .` still works
4. **Document Review**: Write your review findings in `/workspace/ActionPlan/Phase1/Task4/TaskReview4.md`

### Your Review Should Include

In `TaskReview4.md`, document:

- ✅ What was done correctly
- ⚠️ Any issues or concerns found
- 💡 Suggestions for improvement (if any)
- ✔️ Final approval status (APPROVED / NEEDS REVISION)

## Your Task: Task 2.1 - Implement Module Loader

Once you've completed the review of Task 1.4, proceed with Task 2.1.

### Task 2.1 Objectives

**Goal**: Create a module discovery system that finds and loads all tools and connectors from their directories.

This is the first task in Phase 2: Core Generator Components. The module loader is the foundation for discovering user-provided MCP tools and connector modules.

**Actions Required**:

1. **Create `base/loader.ts` file**
   - Main export: `async function loadModules(basePath: string): Promise<Module[]>`
   - This function will be the entry point for discovering all modules

2. **Implement Directory Scanning**
   - Use `fs.promises.readdir` with recursive option to scan `/tools` and `/connectors` directories
   - The scanner should walk through all subdirectories to find module files

3. **Filter Module Files**
   - Use `path.extname()` to filter files matching `*.ts` and `*.py` extensions
   - Only these file types should be considered as potential modules

4. **Extract Module Metadata**
   - Parse JSDoc comments (for TypeScript) or docstring comments (for Python)
   - Look for `export const metadata = {...}` patterns in TypeScript files
   - Extract: name, description, version, dependencies, capabilities

5. **Build Module Objects**
   - Return array of Module objects with structure:
     ```typescript
     {
       name: string,
       path: string,
       type: 'tool' | 'connector',
       language: 'typescript' | 'python',
       metadata: ToolMetadata | ConnectorMetadata
     }
     ```

6. **Error Handling**
   - Wrap file operations in try-catch blocks
   - Log warnings for malformed modules but continue processing
   - Don't fail the entire scan if one module has issues
   - Return only valid modules in the final array

7. **Define TypeScript Interfaces**
   - Export `interface Module`
   - Export `interface ToolMetadata`
   - Export `interface ConnectorMetadata`
   - These types will be used by other components in Phase 2

### Implementation Guidance

```typescript
// Example structure for base/loader.ts

import * as fs from 'fs/promises';
import * as path from 'path';

export interface Module {
  name: string;
  path: string;
  type: 'tool' | 'connector';
  language: 'typescript' | 'python';
  metadata: ToolMetadata | ConnectorMetadata;
}

export interface ToolMetadata {
  name: string;
  description: string;
  version: string;
  inputSchema?: object;  // JSON Schema
  capabilities?: string[];
}

export interface ConnectorMetadata {
  name: string;
  description: string;
  version: string;
  type: string;  // e.g., "email", "database", "api"
  authentication?: object;
  methods?: string[];
}

export async function loadModules(basePath: string): Promise<Module[]> {
  // Implement scanning logic here
  // 1. Scan tools/ and connectors/ directories
  // 2. Filter by .ts and .py extensions
  // 3. Extract metadata from each file
  // 4. Build Module objects
  // 5. Return array of valid modules
}
```

### Success Criteria

- ✅ `base/loader.ts` file exists with all required exports
- ✅ `loadModules()` function successfully scans directories
- ✅ Function returns all valid modules with correct metadata
- ✅ Handles missing or malformed metadata gracefully (logs warnings, continues)
- ✅ Error messages are clear and helpful for debugging
- ✅ TypeScript types are properly defined and exported
- ✅ Code compiles without errors (`npm run build` succeeds)
- ✅ No runtime errors when calling the function

### Testing Strategy

After implementing the loader:

1. Create sample tool files in `/tools` directory
2. Create sample connector files in `/connectors` directory
3. Call `loadModules()` and verify it finds all files
4. Test with malformed modules to verify error handling
5. Check that metadata is correctly extracted

### Documentation Requirements

When complete:

1. Update `ActionPlan/Phase2/TaskCheckList2.md` to mark Task 2.1 as complete
2. Create completion note in `ActionPlan/Phase2/Task1/TaskCompleteNote1.md`
3. Rewrite this WorkNotes.md file with instructions for the next agent (Task 2.2)

## Reference Files

- Task details: `/workspace/ActionPlan/Phase2/Task1/Task1.md`
- Checklist: `/workspace/ActionPlan/Phase2/TaskCheckList2.md`
- Phase overview: `/workspace/ActionPlan/ActionPlan.md`
- Previous phase checklist: `/workspace/ActionPlan/Phase1/TaskCheckList1.md`

## Getting Started

1. First, review Task 1.4 (see "Review Required" section above)
2. Write your review in TaskReview4.md
3. Verify the development environment is working:
   - Run `npm install` to ensure dependencies are installed
   - Run `npm run build` to verify TypeScript compilation works
4. Create the `base/loader.ts` file with required interfaces
5. Implement the `loadModules()` function with proper error handling
6. Test with sample modules in tools/ and connectors/ directories
7. Compile and verify no errors
8. Document completion and update checklist
9. Rewrite this file for the next agent (Task 2.2)

# Work Notes - Task 1.4: Create Base Dockerfile

## Current Status

**Task 1.3 (Set Up Development Container)** has been **COMPLETED** ✅

### What Was Done in Task 1.3

The previous agent successfully:

1. Reviewed Task 1.2 and documented findings in `TaskReview2.md` - approved ✅
2. Updated `.devcontainer/devcontainer.json` with TypeScript-Node base image
3. Configured Docker-in-Docker (DinD) feature for container Docker operations
4. Set up directory mounts for `/tools`, `/connectors`, and `/config` folders
5. Configured remote environment variables (HOST_PROJECT_PATH, DOCKER_HOST)
6. Added automatic `npm install` via postCreateCommand
7. Configured VS Code extensions (Docker, ESLint, Prettier, TypeScript)
8. Removed old Dockerfile approach in favor of pre-built image
9. Created completion documentation in `TaskCompleteNote3.md`

### Review Required

**IMPORTANT**: Before starting Task 1.4, you must review the work completed in Task 1.3:

1. **Check TaskCompleteNote3.md**: Read `/workspace/ActionPlan/Phase1/Task3/TaskCompleteNote3.md` to understand what was completed
2. **Review devcontainer.json**: Verify the configuration at `/workspace/.devcontainer/devcontainer.json`
3. **Understand the Setup**: Note that the devcontainer is for **development** (editing code), while Task 1.4 creates the **production Dockerfile** (for the built application)
4. **Document Review**: Write your review findings in `/workspace/ActionPlan/Phase1/Task3/TaskReview3.md`

### Your Review Should Include

In `TaskReview3.md`, document:

- ✅ What was done correctly
- ⚠️ Any issues or concerns found
- 💡 Suggestions for improvement (if any)
- ✔️ Final approval status (APPROVED / NEEDS REVISION)

## Your Task: Task 1.4 - Create Base Dockerfile

Once you've completed the review of Task 1.3, proceed with Task 1.4.

### Task 1.4 Objectives

**Goal**: Build the Dockerfile for the MCP generator container that will build other MCP servers.

**Actions Required**:

1. **Create `Dockerfile` in project root**
   - Base image: `FROM node:20-alpine`
   - Use Alpine for minimal container size

2. **Install Docker CLI**
   - Run `apk add --no-cache docker-cli`
   - Required for Docker-in-Docker operations

3. **Set Up Working Directory**
   - Create and set `WORKDIR /app`

4. **Install Dependencies**
   - Copy `package.json` and `package-lock.json`
   - Run `npm ci --only=production` for clean install
   - Optimize for production (no dev dependencies)

5. **Copy Source Files**
   - Copy compiled files from `/base` directory
   - Ensure TypeScript is already compiled before Docker build

6. **Create Volume Mount Points**
   - Create directories: `/app/tools`, `/app/connectors`, `/app/config`
   - These will be mounted at runtime

7. **Set Environment Variables**
   - Set `ENV NODE_ENV=production`

8. **Configure Entry Point**
   - Set `ENTRYPOINT ["node", "dist/main.js"]`
   - Set default `CMD ["build"]`
   - Allows overriding command at runtime

### Success Criteria

- ✅ `docker build -t mcp-generator .` succeeds without errors
- ✅ Image contains Node.js runtime
- ✅ Image contains Docker CLI
- ✅ Image contains compiled source code
- ✅ Image size is reasonable (Alpine keeps it small)
- ✅ Volume mount points exist
- ✅ Entry point is correctly configured

### Documentation Requirements

When complete:

1. Update `ActionPlan/Phase1/TaskCheckList1.md` to mark Task 1.3 as complete and Task 1.4 as complete
2. Create completion note in `ActionPlan/Phase1/Task4/TaskCompleteNote4.md`
3. Rewrite this WorkNotes.md file with instructions for the next agent (Phase 2, Task 1)

### Testing the Dockerfile

After creating the Dockerfile, verify it works:

```bash
# Build the image
docker build -t mcp-generator .

# Check image size
docker images mcp-generator

# Verify Docker CLI is available
docker run --rm mcp-generator which docker

# Test entry point (will fail until main.js is implemented, but should run)
docker run --rm mcp-generator --help
```

## Reference Files

- Task details: `/workspace/ActionPlan/Phase1/Task4/Task4.md`
- Checklist: `/workspace/ActionPlan/Phase1/TaskCheckList1.md`
- Action plan: `/workspace/ActionPlan/ActionPlan.md`

## Getting Started

1. First, review Task 1.3 (see "Review Required" section above)
2. Write your review in `TaskReview3.md`
3. Check previous completion notes to understand context
4. Verify current state of the project (devcontainer setup)
5. Then proceed with creating the production Dockerfile
6. Test the Docker build to ensure it works
7. Document your completion
8. Rewrite this file for the next agent

## Important Notes

- **Development vs Production**: 
  - `.devcontainer/` is for **development** (VS Code workspace)
  - `Dockerfile` (root) is for **production** (deployed application)
  - These serve different purposes - don't confuse them!

- **Build Order**: 
  - TypeScript must be compiled (`npm run build`) before Docker build
  - The Dockerfile copies the compiled `dist/` output

- **Docker-in-Docker**:
  - The production container will need Docker CLI to build other containers
  - It will connect to Docker daemon via volume mount at runtime

