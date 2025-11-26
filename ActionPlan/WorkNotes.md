## Create a new git branch for the task from Phase5 and merge back into Phase5 when finished

# Work Notes - Task 5.3: Create Connector Integration Template

## Current Status

**Task 5.2 (Tool Integration Template)** is now **COMPLETE** ✅

### What Was Completed in Task 5.2

- Created `base/templates/tool-loader.ts.template` (520+ lines)
- ToolRegistry class with Map storage and lifecycle management
- Dynamic import logic for loading tools from manifest
- Tool invocation router with timeout support
- JSON Schema validator (SchemaValidator class)
- Error handling with specific error codes
- onLoad/onUnload lifecycle hooks
- Batch invocation support (invokeToolsBatch)
- 68 passing tests in test-tool-loader.ts

Full details in: `/workspace/ActionPlan/Phase5/Task2/TaskCompleteNote2.md`

---

## Your Task: Task 5.3 - Create Connector Integration Template

**Phase**: Phase 5 - MCP Server Templates  
**Goal**: Template for initializing external service connectors with credentials from config.

### Key Requirements:

1. **Create `base/templates/connector-loader.ts.template`**

2. **Implement ConnectorRegistry Class**:
   - Similar to ToolRegistry but with connection management
   - Track connection state (connected/disconnected)
   - Manage connection pools

3. **Add Connector Initialization**:

   ```typescript
   async function initializeConnector(
     config: ConnectorConfig
   ): Promise<Connector>;
   ```

   - Read credentials from config
   - Create client instance

4. **Implement Credential Injection**:
   - Read from `config.services[connectorName]`
   - Support OAuth, API keys, basic auth

5. **Add Connection Pooling**:
   - Maintain pool of active connections
   - Reuse for multiple requests
   - Handle connection timeouts

6. **Create Health Check System**:

   ```typescript
   async function checkConnectorHealth(name: string): Promise<boolean>;
   ```

   - Ping each service
   - Report health status

7. **Implement Retry Logic**:
   - Exponential backoff for failed connections
   - Configurable max retries

8. **Add Connection Lifecycle**:
   - `connect()`, `disconnect()`, `reconnect()` methods

9. **Include Graceful Degradation**:
   - If connector fails to initialize, log warning but continue
   - Unless marked as required

10. **Add Placeholder**:
    - `{{CONNECTOR_LIST}}` for code generation

### Quick Start:

```bash
git checkout Phase5
git checkout -b task-5.3

# Create connector-loader.ts.template with all features
# Create test-connector-loader.ts with tests
npm run build && node dist/test-connector-loader.js

# Complete documentation and merge
git commit -am "Complete Task 5.3 - Connector Integration Template"
git checkout Phase5 && git merge --no-ff task-5.3
```

### Reference Files:

- Task details: `/workspace/ActionPlan/Phase5/Task3/Task3.md`
- Checklist: `/workspace/ActionPlan/Phase5/TaskCheckList5.md`
- Tool loader template: `/workspace/base/templates/tool-loader.ts.template`

### Expected Template Structure:

```typescript
// {{CONNECTOR_LIST}}

interface Connector {
  name: string;
  type: string;
  isConnected(): boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  reconnect(): Promise<void>;
  health(): Promise<boolean>;
}

interface ConnectorConfig {
  name: string;
  type: string;
  credentials: {
    type: "oauth" | "api_key" | "basic" | "none";
    // credential fields
  };
  poolSize?: number;
  timeout?: number;
  retries?: number;
  required?: boolean;
}

class ConnectorRegistry {
  private connectors = new Map<string, Connector>();

  async register(connector: Connector): Promise<void>;
  get(name: string): Connector | undefined;
  list(): Connector[];
  async connect(name: string): Promise<void>;
  async disconnect(name: string): Promise<void>;
  async checkHealth(name: string): Promise<boolean>;
  async checkAllHealth(): Promise<Record<string, boolean>>;
}

async function initializeConnector(config: ConnectorConfig): Promise<Connector>;
async function initializeAllConnectors(
  configs: ConnectorConfig[]
): Promise<void>;
```

---

## ⚠️ IMPORTANT: After Completing Task 5.3

You MUST complete these steps after finishing the implementation:

1. **Write TaskReview3.md** - Create a review document at `/workspace/ActionPlan/Phase5/Task3/TaskReview3.md`

2. **Update TaskCheckList5.md** - Check off completed items

3. **Write TaskCompleteNote3.md** - Document what was done

4. **Update this WorkNotes.md** - Rewrite with instructions for Task 5.4

---

## Phase 5 Progress

1. **Task 5.1**: Create Base Server Template ✅ COMPLETE
2. **Task 5.2**: Build Tool Integration Template ✅ COMPLETE
3. **Task 5.3**: Create Connector Integration Template ← YOU ARE HERE
4. **Task 5.4**: Build Entrypoint Script

See full details: `/workspace/ActionPlan/Phase5/TaskCheckList5.md`
