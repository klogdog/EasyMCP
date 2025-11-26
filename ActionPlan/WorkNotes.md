## Create a new git branch for the task from Phase5 and merge back into Phase5 when finished

# Work Notes - Task 5.2: Build Tool Integration Template

## Current Status

**Task 5.1 (Base Server Template)** is now **COMPLETE** ✅

### What Was Completed in Task 5.1

- Created `base/templates/server.ts.template` (590+ lines)
- MCP protocol handler with JSON-RPC 2.0 on /mcp endpoint
- Config loading from MCP_CONFIG_PATH with YAML parsing
- Logger class with debug/info/warn/error levels and request ID tracking
- Graceful shutdown handling SIGTERM/SIGINT signals
- Health endpoint at /health with status, tools, and connectors
- Error middleware with proper JSON-RPC error responses
- Placeholder markers: `{{TOOL_IMPORTS}}`, `{{CONNECTOR_IMPORTS}}`, `{{TOOL_REGISTRATION}}`
- 57 passing tests in test-server-template.ts

Full details in: `/workspace/ActionPlan/Phase5/Task1/TaskCompleteNote1.md`

---

## Your Task: Task 5.2 - Build Tool Integration Template

**Phase**: Phase 5 - MCP Server Templates  
**Goal**: Template for dynamically loading and registering MCP tools at runtime.

### Key Requirements:

1. **Create `base/templates/tool-loader.ts.template`**

2. **Implement ToolRegistry Class**:
   ```typescript
   class ToolRegistry {
     private tools = new Map<string, Tool>();
     register(tool: Tool): void;
     get(name: string): Tool | undefined;
     list(): Tool[];
   }
   ```

3. **Add Dynamic Import Logic**:
   - Iterate through manifest.tools
   - `await import(toolPath)` for each tool
   - Extract default export

4. **Create Tool Invocation Router**:
   ```typescript
   async function invokeTool(name: string, args: any): Promise<any>
   ```
   - Look up tool by name
   - Call its handler

5. **Implement Error Handling Wrapper**:
   - try-catch around each tool invocation
   - Log errors
   - Return structured error response

6. **Add Tool Lifecycle Hooks**:
   - `onLoad()` hook when tool is registered
   - `onUnload()` hook for cleanup

7. **Implement Input Validation**:
   - Validate args against tool.inputSchema
   - Use JSON Schema validator (ajv)

8. **Add Result Transformation**:
   - Wrap tool output in standard format:
   ```typescript
   { success: boolean, result?: any, error?: string }
   ```

9. **Include Placeholder**:
   - `{{TOOL_LIST}}` for injecting tool definitions

### Quick Start:

```bash
git checkout Phase5
git checkout -b task-5.2

# Create tool-loader.ts.template with all features
# Create test-tool-loader.ts with tests
npm run build && node dist/test-tool-loader.js

# Complete documentation and merge
git commit -am "Complete Task 5.2 - Tool Integration Template"
git checkout Phase5 && git merge --no-ff task-5.2
```

### Reference Files:

- Task details: `/workspace/ActionPlan/Phase5/Task2/Task2.md`
- Checklist: `/workspace/ActionPlan/Phase5/TaskCheckList5.md`
- Server template: `/workspace/base/templates/server.ts.template`

### Expected Template Structure:

```typescript
// {{TOOL_LIST}}

import Ajv from 'ajv';

interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: unknown) => Promise<unknown>;
  onLoad?: () => void;
  onUnload?: () => void;
}

interface ToolResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

class ToolRegistry {
  private tools = new Map<string, Tool>();
  private ajv = new Ajv();
  
  register(tool: Tool): void { ... }
  get(name: string): Tool | undefined { ... }
  list(): Tool[] { ... }
  unregister(name: string): void { ... }
}

async function loadTools(manifest: { tools: ToolDefinition[] }): Promise<void> {
  for (const toolDef of manifest.tools) {
    const module = await import(toolDef.path);
    registry.register(module.default);
  }
}

async function invokeTool(name: string, args: unknown): Promise<ToolResult> {
  // Validate input, call handler, transform result
}
```

---

## ⚠️ IMPORTANT: After Completing Task 5.2

You MUST complete these steps after finishing the implementation:

1. **Write TaskReview2.md** - Create a review document at `/workspace/ActionPlan/Phase5/Task2/TaskReview2.md`

2. **Update TaskCheckList5.md** - Check off completed items

3. **Write TaskCompleteNote2.md** - Document what was done

4. **Update this WorkNotes.md** - Rewrite with instructions for Task 5.3

---

## Phase 5 Progress

1. **Task 5.1**: Create Base Server Template ✅ COMPLETE
2. **Task 5.2**: Build Tool Integration Template ← YOU ARE HERE
3. **Task 5.3**: Create Connector Integration Template
4. **Task 5.4**: Build Entrypoint Script

See full details: `/workspace/ActionPlan/Phase5/TaskCheckList5.md`
