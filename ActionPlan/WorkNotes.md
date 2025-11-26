## Create a new git branch for the task from Phase5 and merge back into Phase5 when finished

# Work Notes - Task 5.4: Build Entrypoint Script

## Current Status

**Task 5.3 (Connector Integration Template)** is now **COMPLETE** ✅

### What Was Completed in Task 5.3

- Created `base/templates/connector-loader.ts.template` (~963 lines)
- ConnectorRegistry class with Map storage and health tracking
- Connection pooling with ConnectionPool<T> class
- Credential injection (OAuth, API key, basic, bearer, none)
- Health check system with HealthCheckResult interface
- Retry logic with exponential backoff and jitter
- Connection lifecycle (connect, disconnect, reconnect)
- Graceful degradation for optional connectors
- 84 passing tests in test-connector-loader.ts

Full details in: `/workspace/ActionPlan/Phase5/Task3/TaskCompleteNote3.md`

---

## Your Task: Task 5.4 - Build Entrypoint Script

**Phase**: Phase 5 - MCP Server Templates  
**Goal**: Create a bash script template for container/server startup.

### Key Requirements:

1. **Create `base/templates/entrypoint.sh.template`**

2. **Add Shebang and Error Handling**:

   ```bash
   #!/bin/bash
   set -e  # Exit on error
   ```

3. **Implement Config File Validation**:
   - Check if MCP_CONFIG_PATH exists
   - Validate YAML syntax with Node script

   ```bash
   if [ -f "$MCP_CONFIG_PATH" ]; then
     node -e "require('yaml').parse(fs.readFileSync('$MCP_CONFIG_PATH', 'utf8'))"
   fi
   ```

4. **Add Environment Variable Override**:
   - Load .env file if exists

   ```bash
   if [ -f .env ]; then
     export $(grep -v '^#' .env | xargs)
   fi
   ```

5. **Check Required Variables**:
   - Verify critical env vars are set
   - Exit with clear error message if missing

   ```bash
   : "${MCP_CONFIG_PATH:?MCP_CONFIG_PATH is required}"
   ```

6. **Implement Startup Logging**:
   - Echo "Starting MCP Server..."
   - Log config location
   - List loaded tools/connectors

7. **Add Process Management**:
   - Handle SIGTERM to gracefully stop server
   - Forward signals to Node.js process

   ```bash
   trap 'kill -TERM $PID; wait $PID' TERM INT
   ```

8. **Support Different Run Modes**:
   - Accept command line arg (dev/prod)
   - Adjust logging verbosity accordingly

   ```bash
   MODE="${1:-prod}"
   if [ "$MODE" = "dev" ]; then
     export LOG_LEVEL=debug
   fi
   ```

9. **Execute Main Server**:
   - Replace shell process with Node

   ```bash
   exec node server.js "$@"
   ```

10. **Create Test File**:
    - Template structure validation
    - Script syntax check (bash -n)
    - Feature verification

### Quick Start:

```bash
git checkout Phase5
git checkout -b task-5.4

# Create entrypoint.sh.template with all features
# Create test-entrypoint-template.ts with tests
npm run build && node dist/test-entrypoint-template.js

# Complete documentation and merge
git commit -am "Complete Task 5.4 - Entrypoint Script Template"
git checkout Phase5 && git merge --no-ff task-5.4
```

### Reference Files:

- Task details: `/workspace/ActionPlan/Phase5/Task4/Task4.md`
- Checklist: `/workspace/ActionPlan/Phase5/TaskCheckList5.md`
- Server template: `base/templates/server.ts.template`
- Tool loader: `base/templates/tool-loader.ts.template`
- Connector loader: `base/templates/connector-loader.ts.template`
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
