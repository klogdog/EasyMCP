## Create a new git branch for the task from Phase4 and merge back into Phase4 when finished

# Work Notes - Task 5.1: Create Base Server Template

## Current Status

**Phase 4 (Docker Integration)** is now **COMPLETE** ✅

### What Was Completed in Phase 4

All four tasks successfully implemented:

1. **Task 4.1: Docker Client Wrapper** ✅
   - Created `base/docker-client.ts` with DockerClient class
   - Docker connectivity, image building, container management
   - 572 lines, comprehensive error handling

2. **Task 4.2: Dockerfile Generator** ✅
   - Extended `base/dockerizer.ts` with `generateDockerfile()`
   - Multi-language support (Node.js, Python, hybrid)
   - Environment variables, health checks, metadata labels

3. **Task 4.3: Image Builder** ✅
   - Added `buildMCPImage()` to dockerizer.ts
   - Build context creation, progress streaming, log capture
   - Failure diagnostics and cleanup

4. **Task 4.4: Image Tagging & Registry** ✅
   - Created `base/registry.ts` with Registry class
   - Tag validation, push with auth, dry-run mode
   - Image listing and pruning utilities

Full details in: `/workspace/ActionPlan/Phase4/Task4/TaskCompleteNote4.md`

---

## Your Task: Task 5.1 - Create Base Server Template

**Phase**: Phase 5 - MCP Server Templates  
**Goal**: Create template for the main MCP server entry point that will be generated.

### Key Requirements:

1. **Create `base/templates/server.ts.template`** as a string template with placeholders

2. **Implement MCP Protocol Handler**:
   - HTTP server listening on port from config
   - JSON-RPC 2.0 endpoint `/mcp`

3. **Add Config Loading**:

   ```typescript
   const config = yaml.load(fs.readFileSync(process.env.MCP_CONFIG_PATH));
   ```

   - Validate structure

4. **Initialize Logging**:
   - Use winston or pino
   - Configure level/format from config
   - Add request ID tracking

5. **Implement Graceful Shutdown**:
   - Listen for SIGTERM/SIGINT
   - Close connections
   - Flush logs
   - Exit cleanly

6. **Add Health Endpoint**:
   - `/health` returns 200 with `{ status: 'ok', tools: [...], connectors: [...] }`

7. **Include Error Middleware**:
   - Catch unhandled errors
   - Log with context
   - Return proper JSON-RPC error responses

8. **Add Placeholder Markers**:
   - `{{TOOL_IMPORTS}}`
   - `{{CONNECTOR_IMPORTS}}`
   - `{{TOOL_REGISTRATION}}`
   - For code generation

### Quick Start:

```bash
git checkout Phase4
git checkout -b task-5.1

# Create directory structure
mkdir -p base/templates

# Create server.ts.template with all features
# Create test-server-template.ts with tests
npm run build && node dist/test-server-template.js

# Complete documentation and merge
git commit -am "Complete Task 5.1 - Base Server Template"
git checkout Phase4 && git merge --no-ff task-5.1
```

### Reference Files:

- Task details: `/workspace/ActionPlan/Phase5/Task1/Task1.md`
- Checklist: `/workspace/ActionPlan/Phase5/TaskCheckList5.md`
- Existing templates reference: `/workspace/templates/README.md`

### Expected Template Structure:

```typescript
// {{TOOL_IMPORTS}}
// {{CONNECTOR_IMPORTS}}

import * as http from 'http';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import { createLogger } from 'winston';

// Config loading
const config = yaml.load(fs.readFileSync(process.env.MCP_CONFIG_PATH!, 'utf8'));

// Logger setup
const logger = createLogger({...});

// JSON-RPC handler
async function handleJsonRpc(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    // {{TOOL_REGISTRATION}}
    ...
}

// HTTP server
const server = http.createServer(async (req, res) => {
    if (req.url === '/health') {
        // Health check response
    }
    if (req.url === '/mcp') {
        // JSON-RPC handling
    }
});

// Graceful shutdown
process.on('SIGTERM', () => { ... });
process.on('SIGINT', () => { ... });

server.listen(config.port);
```

---

## ⚠️ IMPORTANT: After Completing Task 5.1

You MUST complete these steps after finishing the implementation:

1. **Write TaskReview1.md** - Create a review document at `/workspace/ActionPlan/Phase5/Task1/TaskReview1.md`
   - Include code review (analyze implementation quality)
   - Include test review (verify all tests pass)
   - Include success criteria verification
   - Mark as APPROVED or note any issues found

2. **Update TaskCheckList5.md** - Check off completed items in `/workspace/ActionPlan/Phase5/TaskCheckList5.md`

3. **Write TaskCompleteNote1.md** - Document what was done at `/workspace/ActionPlan/Phase5/Task1/TaskCompleteNote1.md`

4. **Update this WorkNotes.md** - Rewrite with instructions for Task 5.2

---

## Phase 5 Overview

Phase 5 consists of 4 tasks:

1. **Task 5.1**: Create Base Server Template ← YOU ARE HERE
2. **Task 5.2**: Build Tool Integration Template
3. **Task 5.3**: Create Connector Integration Template
4. **Task 5.4**: Build Entrypoint Script

See full details: `/workspace/ActionPlan/Phase5/TaskCheckList5.md`
