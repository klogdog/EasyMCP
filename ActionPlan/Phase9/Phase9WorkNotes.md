# Work Notes - Phase 9: Testing & Quality

## Current Status

**Phase 8 (CLI & Build)** should be complete before starting this phase.

---

## Phase 9 Overview

**Goal**: Establish a comprehensive testing framework and create tests for all core generator components.

This phase focuses on:

1. Setting up Jest testing framework with TypeScript support
2. Writing unit tests for core modules (Loader, Generator, Config)
3. Creating integration tests for end-to-end workflows
4. Building example E2E tests as templates for custom testing

---

## Prerequisites

Before starting Phase 9, ensure:

- All Phase 1-8 components are complete and stable
- `npm run build` compiles without errors
- Core modules exist: `loader.ts`, `generator.ts`, `config-generator.ts`, `validator.ts`
- Docker-in-Docker environment is functional
- Example tools and connectors from Phase 6 are available

---

## Task 9.1: Set Up Testing Framework

**Branch**: `task-9.1` from `Phase9`  
**Goal**: Configure Jest testing framework with TypeScript support.

### Requirements:

1. **Install Testing Dependencies**:

   ```bash
   npm install --save-dev jest @types/jest ts-jest @jest/globals
   ```

2. **Create `jest.config.js`**:

   ```javascript
   module.exports = {
     preset: "ts-jest",
     testEnvironment: "node",
     roots: ["<rootDir>/base"],
     coverageDirectory: "./coverage",
     coverageThreshold: {
       global: {
         branches: 80,
         functions: 80,
         lines: 80,
         statements: 80,
       },
     },
     collectCoverageFrom: [
       "base/**/*.ts",
       "!base/**/*.d.ts",
       "!base/__tests__/**",
     ],
     coverageReporters: ["text", "lcov", "html"],
     testMatch: ["**/__tests__/**/*.test.ts"],
     moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
   };
   ```

3. **Update `package.json` scripts**:

   ```json
   {
     "scripts": {
       "test": "jest",
       "test:watch": "jest --watch",
       "test:coverage": "jest --coverage",
       "test:ci": "jest --ci --coverage --reporters=default --reporters=jest-junit"
     }
   }
   ```

4. **Create Test Utilities Directory**:
   - `base/__tests__/utils/mockDocker.ts` - Mock Docker client
   - `base/__tests__/utils/mockFs.ts` - Mock file system helpers
   - `base/__tests__/utils/fixtures.ts` - Test fixtures and factory functions

5. **Create Test Fixtures**:
   - `base/__tests__/fixtures/tools/` - Sample tool files for testing
   - `base/__tests__/fixtures/connectors/` - Sample connector files for testing
   - `base/__tests__/fixtures/configs/` - Sample config files for testing

### Success Criteria:

- [ ] `npm test` runs successfully (even with no tests yet)
- [ ] Coverage reports generate to `./coverage` directory
- [ ] Test utilities are importable from test files
- [ ] TypeScript compilation includes test files

---

## Task 9.2: Write Unit Tests - Loader

**Branch**: `task-9.2` from `Phase9`  
**Goal**: Test module loading and discovery functionality.

### Test Cases to Implement:

```typescript
// base/__tests__/loader.test.ts

describe("loadModules", () => {
  describe("module discovery", () => {
    it("should find all .ts files in tools directory");
    it("should find all .py files in tools directory");
    it("should find all files in connectors directory");
    it("should handle nested directories");
  });

  describe("file filtering", () => {
    it("should ignore non-.ts and non-.py files");
    it("should skip hidden files (starting with .)");
    it("should skip files in node_modules");
    it("should handle .d.ts declaration files");
  });

  describe("metadata extraction", () => {
    it("should extract metadata from TypeScript exports");
    it("should extract metadata from Python docstrings");
    it("should parse name, description, and dependencies");
    it("should handle missing metadata gracefully");
  });

  describe("error handling", () => {
    it("should log warning for malformed metadata");
    it("should continue after encountering unreadable file");
    it("should handle empty directories");
    it("should handle permission errors");
  });

  describe("edge cases", () => {
    it("should handle symlinks correctly");
    it("should handle very long file paths");
    it("should handle unicode in filenames");
    it("should handle empty files");
  });
});
```

### Mocking Strategy:

- Use `jest.mock('fs/promises')` for file system operations
- Create in-memory directory structures for tests
- Use `memfs` package for more realistic file system mocking

### Coverage Target: >90%

---

## Task 9.3: Write Unit Tests - Generator

**Branch**: `task-9.3` from `Phase9`  
**Goal**: Test manifest generation and tool/connector merging.

### Test Cases to Implement:

```typescript
// base/__tests__/generator.test.ts

describe("generateManifest", () => {
  describe("manifest structure", () => {
    it("should create valid MCP manifest structure");
    it("should include all tools in manifest");
    it("should include all connectors in manifest");
    it("should set correct schema version");
  });

  describe("tool merging", () => {
    it("should merge multiple tools into single manifest");
    it("should preserve tool metadata during merge");
    it("should handle tools with different capabilities");
    it("should avoid duplicate tool entries");
  });

  describe("conflict detection", () => {
    it("should throw error for duplicate tool names");
    it("should throw error for duplicate connector names");
    it("should provide clear error message with conflicting names");
  });

  describe("validation", () => {
    it("should reject tools with invalid schema");
    it("should reject tools with missing required fields");
    it("should accept tools with optional fields missing");
  });

  describe("capabilities aggregation", () => {
    it("should list all unique capabilities");
    it("should not duplicate capabilities");
  });

  describe("dependency resolution", () => {
    it("should collect all npm dependencies");
    it("should resolve version conflicts (prefer higher compatible)");
    it("should warn on incompatible version ranges");
  });
});
```

### Mocking Strategy:

- Mock `loader.ts` to return controlled module arrays
- Mock `validator.ts` to control validation results
- Use factory functions for creating test modules

### Coverage Target: >85%

---

## Task 9.4: Write Unit Tests - Config

**Branch**: `task-9.4` from `Phase9`  
**Goal**: Test configuration parsing, validation, and merging.

### Test Cases to Implement:

```typescript
// base/__tests__/config-parser.test.ts

describe("ConfigParser", () => {
  describe("config generation", () => {
    it("should generate valid YAML from manifest");
    it("should include secrets in config");
    it("should set environment-specific values");
  });

  describe("variable substitution", () => {
    it("should replace ${VAR} with environment variable");
    it("should use default in ${VAR:-default} when VAR missing");
    it("should handle nested variable substitution");
    it("should throw for undefined variables without defaults");
  });

  describe("schema validation", () => {
    it("should pass valid configs");
    it("should reject invalid configs with field-level errors");
    it("should validate against JSON Schema");
  });

  describe("override merging", () => {
    it("should merge base config with overrides");
    it("should give precedence to override values");
    it("should perform deep merge for nested objects");
    it("should replace arrays instead of merging");
  });

  describe("parsing errors", () => {
    it("should report line number for YAML syntax errors");
    it("should provide helpful error messages");
    it("should handle empty config files");
  });

  describe("default values", () => {
    it("should apply defaults for missing optional fields");
    it("should not override provided values with defaults");
  });

  describe("edge cases", () => {
    it("should detect circular references");
    it("should handle deeply nested configs");
    it("should handle special YAML types (dates, multiline)");
  });
});
```

### Mocking Strategy:

- Use `process.env` manipulation for environment variables
- Create temporary YAML files for parsing tests
- Mock file system for file-based tests

### Coverage Target: >90%

---

## Task 9.5: Write Integration Tests

**Branch**: `task-9.5` from `Phase9`  
**Goal**: Test complete workflows from module loading to Docker image creation.

### Test Setup:

```typescript
// base/__tests__/integration/setup.ts

// Configure longer timeout for integration tests
jest.setTimeout(60000); // 60 seconds

// Helper to create temp workspace
async function createTestWorkspace(): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "mcp-test-"));
  // Copy sample tools and connectors
  // Return path to workspace
  return tempDir;
}

// Helper to cleanup
async function cleanupTestWorkspace(workspacePath: string): Promise<void> {
  await fs.rm(workspacePath, { recursive: true, force: true });
}
```

### Test Cases to Implement:

```typescript
// base/__tests__/integration/build.test.ts

describe("Integration: Build Pipeline", () => {
  let workspace: string;

  beforeAll(async () => {
    workspace = await createTestWorkspace();
  });

  afterAll(async () => {
    await cleanupTestWorkspace(workspace);
  });

  it("should build complete MCP server from tools directory", async () => {
    // Load modules from workspace
    // Generate manifest
    // Build Docker image
    // Verify image exists
  });

  it("should create valid Dockerfile", async () => {
    // Generate Dockerfile
    // Parse and validate structure
    // Verify required commands present
  });

  it("should start generated server and respond to health check", async () => {
    // Start container
    // Wait for startup
    // Check /health endpoint
    // Cleanup
  });

  it("should execute tool via MCP protocol", async () => {
    // Start container
    // Send JSON-RPC request
    // Verify response format
    // Cleanup
  });
});
```

### Docker Testing:

- Use real Docker operations (not mocked)
- Tag test images with `test-` prefix for easy cleanup
- Implement robust cleanup in afterAll hooks

### Timeout Configuration:

- Integration tests: 60 seconds
- Docker operations: may need even longer

---

## Task 9.6: Create Example End-to-End Test

**Branch**: `task-9.6` from `Phase9`  
**Goal**: Build complete example test demonstrating full MCP server lifecycle.

### Implementation:

```typescript
// base/__tests__/integration/e2e-example.test.ts

/**
 * E2E Example Test
 *
 * This test demonstrates the complete lifecycle of an MCP server:
 * 1. Set up a test workspace with tools and connectors
 * 2. Build the MCP server using the generator
 * 3. Launch the container and verify it's running
 * 4. Execute a tool and verify the response
 * 5. Clean up all resources
 *
 * Use this as a template for creating custom E2E tests.
 */

describe("E2E: Complete MCP Server Lifecycle", () => {
  // Test state
  let workspacePath: string;
  let containerId: string;
  let imageId: string;
  let serverPort: number;

  // 1. Set up test workspace
  beforeAll(async () => {
    console.log("Setting up test workspace...");
    workspacePath = await createTestWorkspace();

    // Copy example tools
    await copyExampleTools(workspacePath);

    // Copy example connectors (mocked)
    await copyExampleConnectors(workspacePath);

    console.log(`Workspace created at: ${workspacePath}`);
  });

  // 2. Build MCP server
  test("should build MCP server from workspace", async () => {
    // Run generator
    const result = await buildMcpServer(workspacePath);

    // Capture artifacts
    imageId = result.imageId;

    // Assertions
    expect(result.manifest).toBeDefined();
    expect(result.manifest.tools).toHaveLength(2); // summarize, translate
    expect(result.imageId).toMatch(/^sha256:/);
  });

  // 3. Launch container
  test("should start container and pass health check", async () => {
    // Start container
    const container = await startContainer(imageId);
    containerId = container.id;
    serverPort = container.port;

    // Wait for health
    await waitForHealth(`http://localhost:${serverPort}/health`);

    // Verify running
    const status = await getContainerStatus(containerId);
    expect(status).toBe("running");
  });

  // 4. Execute tool
  test("should execute summarize tool via MCP", async () => {
    // Prepare request
    const request = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "summarize",
        arguments: {
          text: "This is a long text that needs summarization...",
          maxLength: 50,
        },
      },
    };

    // Send request
    const response = await sendMcpRequest(serverPort, request);

    // Verify response
    expect(response.result).toBeDefined();
    expect(response.result.content).toBeDefined();
    expect(response.error).toBeUndefined();
  });

  // 5. Cleanup
  afterAll(async () => {
    console.log("Cleaning up resources...");

    // Stop and remove container
    if (containerId) {
      await stopContainer(containerId);
      await removeContainer(containerId);
    }

    // Remove image
    if (imageId) {
      await removeImage(imageId);
    }

    // Delete workspace
    if (workspacePath) {
      await cleanupTestWorkspace(workspacePath);
    }

    console.log("Cleanup complete");
  });
});
```

### Documentation Requirements:

- Every step should have detailed comments
- Explain what each assertion validates
- Include troubleshooting tips in comments
- Reference relevant documentation

### Success Criteria:

- [ ] Test runs successfully end-to-end
- [ ] All steps are documented
- [ ] Cleanup removes all resources
- [ ] Can serve as template for custom tests

---

## Quick Start Guide

```bash
# Create Phase9 branch from main
git checkout main
git pull origin main
git checkout -b Phase9

# Task 9.1: Set up testing framework
git checkout -b task-9.1
npm install --save-dev jest @types/jest ts-jest @jest/globals
# Create jest.config.js
# Update package.json scripts
# Create test utilities
git add . && git commit -m "Task 9.1: Set up Jest testing framework"
git checkout Phase9 && git merge --no-ff task-9.1

# Task 9.2: Loader tests
git checkout -b task-9.2
# Create base/__tests__/loader.test.ts
npm test
git add . && git commit -m "Task 9.2: Add loader unit tests"
git checkout Phase9 && git merge --no-ff task-9.2

# Task 9.3: Generator tests
git checkout -b task-9.3
# Create base/__tests__/generator.test.ts
npm test
git add . && git commit -m "Task 9.3: Add generator unit tests"
git checkout Phase9 && git merge --no-ff task-9.3

# Task 9.4: Config tests
git checkout -b task-9.4
# Create base/__tests__/config-parser.test.ts
npm test
git add . && git commit -m "Task 9.4: Add config parser unit tests"
git checkout Phase9 && git merge --no-ff task-9.4

# Task 9.5: Integration tests
git checkout -b task-9.5
# Create base/__tests__/integration/
npm run test:coverage
git add . && git commit -m "Task 9.5: Add integration tests"
git checkout Phase9 && git merge --no-ff task-9.5

# Task 9.6: E2E example
git checkout -b task-9.6
# Create base/__tests__/integration/e2e-example.test.ts
npm test
git add . && git commit -m "Task 9.6: Add E2E example test"
git checkout Phase9 && git merge --no-ff task-9.6

# Merge Phase9 to main
git checkout main && git merge --no-ff Phase9
git push origin main
```

---

## File Structure After Phase 9

```
base/
├── __tests__/
│   ├── utils/
│   │   ├── mockDocker.ts
│   │   ├── mockFs.ts
│   │   └── fixtures.ts
│   ├── fixtures/
│   │   ├── tools/
│   │   │   ├── sample-tool.ts
│   │   │   └── invalid-tool.ts
│   │   ├── connectors/
│   │   │   └── sample-connector.ts
│   │   └── configs/
│   │       ├── valid.yaml
│   │       └── invalid.yaml
│   ├── integration/
│   │   ├── setup.ts
│   │   ├── build.test.ts
│   │   └── e2e-example.test.ts
│   ├── loader.test.ts
│   ├── generator.test.ts
│   └── config-parser.test.ts
├── loader.ts
├── generator.ts
├── config-generator.ts
├── validator.ts
└── ...
jest.config.js
coverage/
├── lcov-report/
└── lcov.info
```

---

## Reference Files

- Task details: `/workspace/ActionPlan/Phase9/Task[1-6]/Task[1-6].md`
- Checklist: `/workspace/ActionPlan/Phase9/TaskCheckList9.md`
- Core modules: `base/loader.ts`, `base/generator.ts`, `base/config-generator.ts`
- Example tools: `tools/summarize.ts`, `tools/translate.ts`, `tools/classify.ts`
- Example connectors: `connectors/gmail.ts`, `connectors/notion.ts`

---

## Phase 9 Progress

| Task | Description                  | Status      |
| ---- | ---------------------------- | ----------- |
| 9.1  | Set Up Testing Framework     | ✅ Complete |
| 9.2  | Write Unit Tests - Loader    | ✅ Complete |
| 9.3  | Write Unit Tests - Generator | ✅ Complete |
| 9.4  | Write Unit Tests - Config    | ✅ Complete |
| 9.5  | Write Integration Tests      | ✅ Complete |
| 9.6  | Create Example E2E Test      | ✅ Complete |

---

## Dependencies on Previous Phases

| Phase   | Required Components                         |
| ------- | ------------------------------------------- |
| Phase 2 | `loader.ts`, `validator.ts`, `generator.ts` |
| Phase 3 | `config-generator.ts`                       |
| Phase 4 | Docker client, Dockerizer                   |
| Phase 5 | Server templates                            |
| Phase 6 | Example tools and connectors                |
| Phase 8 | CLI interface (for integration tests)       |

---

## Notes & Considerations

### Testing Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Always clean up resources (files, containers, images) in afterAll
3. **Determinism**: Avoid flaky tests by controlling all inputs
4. **Speed**: Unit tests should run in <1s; integration tests may take longer
5. **Coverage**: Aim for 80%+ coverage overall, 90%+ for critical modules

### Docker Testing Considerations

1. **Test Containers**: Consider using `testcontainers` library for Docker tests
2. **Cleanup**: Use unique prefixes (e.g., `mcp-test-`) for easy cleanup
3. **Timeouts**: Docker operations may take 30-60s; configure appropriate timeouts
4. **CI/CD**: Ensure Docker-in-Docker works in CI environment

### Common Issues & Solutions

| Issue                    | Solution                                        |
| ------------------------ | ----------------------------------------------- |
| Tests timeout            | Increase jest timeout: `jest.setTimeout(60000)` |
| Docker permission denied | Ensure Docker socket is accessible              |
| Flaky integration tests  | Add proper wait conditions and retries          |
| Coverage not updating    | Clear jest cache: `jest --clearCache`           |

---

## Completion Criteria

Phase 9 is complete when:

- [ ] Jest is configured and `npm test` runs successfully
- [ ] Unit tests exist for loader, generator, and config modules
- [ ] Unit test coverage is >85% for all core modules
- [ ] Integration tests verify end-to-end build pipeline
- [ ] E2E example test demonstrates complete server lifecycle
- [ ] All tests pass consistently (no flaky tests)
- [ ] Coverage reports are generated and meet thresholds
- [ ] Documentation explains test patterns and conventions
