## Create a new git branch for the task from Phase2 and merge back into Phase2 when finished

# Work Notes - Task 2.2: Build Module Validator

## Current Status

**Task 2.1 (Implement Module Loader)** has been **COMPLETED** ✅

### What Was Done in Task 2.1

The previous agent successfully:

1. **Reviewed Task 1.4** and confirmed Phase 1 completion
2. **Verified development environment** with npm install and build
3. **Created `base/loader.ts`** with:
   - TypeScript interfaces: Module, ToolMetadata, ConnectorMetadata
   - Main export: `async function loadModules(basePath: string): Promise<Module[]>`
   - Directory scanning with recursive support
   - Metadata extraction for TypeScript (export const metadata) and Python (metadata dict)
   - Comprehensive error handling (warnings but continues processing)
4. **Created sample modules** for testing:
   - Tools: file-reader.ts, calculator.py
   - Connectors: email-connector.ts, database-connector.py
5. **Created and ran test script** (`base/test-loader.ts`):
   - Successfully loaded 4 modules (2 tools, 2 connectors)
   - Verified TypeScript and Python parsing
   - Confirmed metadata extraction works correctly
6. **Updated documentation**:
   - TaskCheckList2.md marked Task 2.1 complete
   - TaskCompleteNote1.md created with comprehensive details
7. **Branch**: Changes are on `task-2.1` (branched from Phase2)

### Review Required

**IMPORTANT**: Before starting Task 2.2, you must verify the review work completed in Task 2.1:

1. **Check TaskCompleteNote1.md**: Read `/workspace/ActionPlan/Phase2/Task1/TaskCompleteNote1.md` to understand what was completed
2. **Verify loader.ts**: Review `/workspace/base/loader.ts` structure and implementation
3. **Test the loader**: Run `node dist/test-loader.js` to verify it still works
4. **Check sample modules**: Review `/workspace/tools` and `/workspace/connectors` directories
5. **Document Review**: Write your review findings in `/workspace/ActionPlan/Phase2/Task1/TaskReview1.md`

### Your Review Should Include

In `TaskReview1.md`, document:

- ✅ What was done correctly
- ⚠️ Any issues or concerns found
- 💡 Suggestions for improvement (if any)
- ✔️ Final approval status (APPROVED / NEEDS REVISION)

## Your Task: Task 2.2 - Build Module Validator

Once you've completed the review of Task 2.1, proceed with Task 2.2.

### Task 2.2 Objectives

**Goal**: Create a validation system that checks loaded modules against MCP specifications and identifies conflicts.

This task builds on the module loader from Task 2.1. You'll use Zod for schema validation to ensure modules conform to MCP standards.

**Actions Required**:

1. **Install Zod Dependency**
   - Run `npm install zod`
   - Zod provides TypeScript-first schema validation

2. **Create `base/validator.ts` file**
   - Main export: `function validateModules(modules: Module[]): ValidationResult`
   - Import the Module types from `./loader`

3. **Define ValidationResult Interface**

   ```typescript
   export interface ValidationResult {
     valid: boolean;
     errors: ValidationError[];
     warnings: string[];
   }

   export interface ValidationError {
     moduleName: string;
     field: string;
     message: string;
     severity: "error" | "warning";
   }
   ```

4. **Define Zod Schema for Tools**
   - Required fields: name (string), description (string), version (semver string)
   - Optional fields: inputSchema (object), capabilities (array of strings)
   - Validate version format using regex: `/^\d+\.\d+\.\d+$/`

5. **Define Zod Schema for Connectors**
   - Required fields: name (string), description (string), version (semver string), type (string)
   - Optional fields: authentication (object), methods (array of strings)
   - Validate type is one of: "email", "database", "api", "storage", "messaging"

6. **Implement Duplicate Name Detection**
   - Build a Set of module names as you iterate
   - If name already exists, add error to ValidationResult
   - Check for case-insensitive duplicates (e.g., "Email" vs "email")

7. **Implement Dependency Validation**
   - Look for `dependencies` field in metadata
   - Check if package names are valid npm package format
   - Validate version strings are valid semver or ranges
   - Add warnings for missing or invalid dependencies

8. **Implement Schema Versioning**
   - Check for optional `schemaVersion` field in metadata
   - Support v1.0 (current version)
   - Add warning if schemaVersion is missing (assume v1.0)
   - Add error if schemaVersion is unsupported (e.g., v2.0)

9. **Validate All Modules**
   - Iterate through all modules from loader
   - Apply appropriate schema (tool vs connector)
   - Collect all errors and warnings
   - Return ValidationResult with aggregated results

10. **Error Handling**
    - Wrap validation in try-catch
    - Include module name in error messages
    - Don't fail on first error - validate all modules
    - Separate errors (invalid) from warnings (suggestions)

### Implementation Guidance

```typescript
import { z } from "zod";
import { Module, ToolMetadata, ConnectorMetadata } from "./loader";

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

export interface ValidationError {
  moduleName: string;
  field: string;
  message: string;
  severity: "error" | "warning";
}

// Zod schema for semver version
const versionSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, "Must be valid semver (e.g., 1.0.0)");

// Zod schema for tool metadata
const toolMetadataSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  version: versionSchema,
  inputSchema: z.object({}).optional(),
  capabilities: z.array(z.string()).optional(),
});

// Zod schema for connector metadata
const connectorMetadataSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  version: versionSchema,
  type: z.enum(["email", "database", "api", "storage", "messaging"]),
  authentication: z.object({}).optional(),
  methods: z.array(z.string()).optional(),
});

export function validateModules(modules: Module[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];
  const moduleNames = new Set<string>();

  for (const module of modules) {
    // Check for duplicate names
    const lowerName = module.name.toLowerCase();
    if (moduleNames.has(lowerName)) {
      errors.push({
        moduleName: module.name,
        field: "name",
        message: `Duplicate module name: ${module.name}`,
        severity: "error",
      });
    } else {
      moduleNames.add(lowerName);
    }

    // Validate metadata based on module type
    try {
      if (module.type === "tool") {
        toolMetadataSchema.parse(module.metadata);
      } else {
        connectorMetadataSchema.parse(module.metadata);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        for (const issue of error.issues) {
          errors.push({
            moduleName: module.name,
            field: issue.path.join("."),
            message: issue.message,
            severity: "error",
          });
        }
      }
    }

    // Check for schema version
    const metadata = module.metadata as any;
    if (!metadata.schemaVersion) {
      warnings.push(`${module.name}: Missing schemaVersion, assuming v1.0`);
    } else if (metadata.schemaVersion !== "1.0") {
      errors.push({
        moduleName: module.name,
        field: "schemaVersion",
        message: `Unsupported schema version: ${metadata.schemaVersion}`,
        severity: "error",
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
```

### Success Criteria

- ✅ `base/validator.ts` file exists with all required exports
- ✅ Zod dependency installed and imported
- ✅ ValidationResult interface properly defined
- ✅ Tool schema validates: name, description, version (semver)
- ✅ Connector schema validates: name, description, version, type, methods
- ✅ Duplicate name detection works (case-insensitive)
- ✅ Schema versioning check implemented (supports v1.0)
- ✅ Returns errors for invalid modules
- ✅ Returns warnings for missing optional fields
- ✅ Code compiles without errors (`npm run build` succeeds)
- ✅ All validation tests pass

### Testing Strategy

After implementing the validator:

1. Test with valid modules (should pass validation)
2. Test with duplicate names (should return error)
3. Test with invalid version format (should return error)
4. Test with invalid connector type (should return error)
5. Test with missing schemaVersion (should return warning)
6. Create a test script to verify all scenarios

### Documentation Requirements

When complete:

1. Update `ActionPlan/Phase2/TaskCheckList2.md` to mark Task 2.2 as complete
2. Create completion note in `ActionPlan/Phase2/Task2/TaskCompleteNote2.md`
3. Rewrite this WorkNotes.md file with instructions for the next agent (Task 2.3)

## Reference Files

- Task details: `/workspace/ActionPlan/Phase2/Task2/Task2.md`
- Checklist: `/workspace/ActionPlan/Phase2/TaskCheckList2.md`
- Previous task: `/workspace/ActionPlan/Phase2/Task1/TaskCompleteNote1.md`
- Loader implementation: `/workspace/base/loader.ts`

## Getting Started

1. First, review Task 2.1 (see "Review Required" section above)
2. Write your review in TaskReview1.md
3. Install Zod: `npm install zod`
4. Create the `base/validator.ts` file with required interfaces
5. Implement Zod schemas for tools and connectors
6. Implement the `validateModules()` function
7. Test with existing sample modules and edge cases
8. Compile and verify no errors
9. Document completion and update checklist
10. Rewrite this file for the next agent (Task 2.3)

## Branch Management

- **Current Branch**: You should be on `task-2.1`
- **Action**: Create branch `task-2.2` from `Phase2` for your work
- **Merge Target**: Merge back into `Phase2` when complete

# Work Notes - Task 1.4: Create Base Dockerfile

## Current Status

**Task 1.3 (Set Up Development Container)** has been **COMPLETED** ✅

### What Was Done in Task 1.3

The previous agent successfully:

1. Reviewed Task 1.2 completion and wrote approval in TaskReview2.md
2. Updated `.devcontainer/devcontainer.json` with all required features
3. Added explicit bind mounts for tools, connectors, config, and templates directories
4. Configured Docker-in-Docker feature v2 for container-within-container capability
5. Updated postCreateCommand to `npm install` for automatic dependency installation
6. Verified VS Code extensions are configured (Docker, ESLint, Prettier, Python)
7. Added HOST_PROJECT_PATH to remoteEnv for environment forwarding
8. Committed changes to branch `task-1.3-devcontainer`

### Review Required

**IMPORTANT**: Before starting Task 1.4, you must review the work completed in Task 1.3:

1. **Check TaskCompleteNote3.md**: Read `/workspace/ActionPlan/Phase1/Task3/TaskCompleteNote3.md` to understand what was completed
2. **Verify devcontainer.json**: Confirm the configuration includes Docker-in-Docker, proper mounts, and postCreateCommand
3. **Check Dockerfile**: Review `.devcontainer/Dockerfile` structure
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

**IMPORTANT**: This Dockerfile is SEPARATE from `.devcontainer/Dockerfile`. This is the production Dockerfile for the application itself.

**Actions Required**:

1. **Create `Dockerfile` in workspace root**
   - Start with `FROM node:20-alpine` as base image
   - Use Alpine Linux for minimal image size

2. **Install Docker CLI**
   - Run `apk add --no-cache docker-cli`
   - Needed for Docker-in-Docker operations when running the generator

3. **Set Up Application Directory**
   - Create `WORKDIR /app`
   - This is where the application code will live

4. **Install Dependencies**
   - Copy `package*.json` files first (for layer caching)
   - Run `npm ci --only=production` for production dependencies only
   - This ensures reproducible builds and smaller image size

5. **Copy Application Code**
   - Copy compiled source files from `/dist` directory (after build)
   - Note: The TypeScript should be compiled before building the Docker image

6. **Configure Volume Mount Points**
   - Create directories for volume mounts:
     - `/app/tools` - for drop-in MCP tools
     - `/app/connectors` - for API integrations
     - `/app/config` - for runtime configurations
   - Use `VOLUME` instruction or `RUN mkdir -p`

7. **Set Environment Variables**
   - Set `ENV NODE_ENV=production`

8. **Define Container Entry Point**
   - Set `ENTRYPOINT ["node", "dist/main.js"]`
   - Set default `CMD ["build"]`
   - This allows running `docker run mcp-generator` (defaults to build) or `docker run mcp-generator serve`

### Build Optimization Tips

- Order Dockerfile instructions from least to most frequently changing
- Copy package.json before source code for better layer caching
- Use `--no-cache` flag with apk to reduce image size
- Consider multi-stage builds if the image is too large

### Success Criteria

- ✅ Dockerfile exists in workspace root
- ✅ `docker build -t mcp-generator .` succeeds without errors
- ✅ Image contains Node.js runtime (node:20-alpine)
- ✅ Image contains Docker CLI for DinD operations
- ✅ Application source code is present in /app
- ✅ Volume mount points are configured
- ✅ ENTRYPOINT and CMD are properly set

### Documentation Requirements

When complete:

1. Update `ActionPlan/Phase1/TaskCheckList1.md` to mark Task 1.3 as complete and Task 1.4 as complete
2. Create completion note in `ActionPlan/Phase1/Task4/TaskCompleteNote4.md`
3. Rewrite this WorkNotes.md file with instructions for the next agent (Phase 2, Task 2.1)

## Reference Files

- Task details: `/workspace/ActionPlan/Phase1/Task4/Task4.md`
- Checklist: `/workspace/ActionPlan/Phase1/TaskCheckList1.md`
- Action plan: `/workspace/ActionPlan/ActionPlan.md`

## Getting Started

1. First, review Task 1.3 (see "Review Required" section above)
2. Write your review in TaskReview3.md
3. Check that TypeScript is compiled (run `npm run build` if needed)
4. Create the production Dockerfile (NOT in .devcontainer directory)
5. Test building the Docker image
6. Document completion and update checklist
7. Test that everything works (`npm install`, `tsc` compilation)
8. Document your completion
9. Rewrite this file for the next agent
