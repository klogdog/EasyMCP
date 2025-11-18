## Create a new git branch for the task from Phase2 and merge back into Phase2 when finished

# Work Notes - Task 2.4: Build Configuration Generator

## Current Status

**Task 2.3 (Create Manifest Generator)** has been **COMPLETED** ✅

### What Was Done in Task 2.3

The previous agent successfully:

1. **Reviewed Task 2.2** and wrote approval in TaskReview2.md
2. **Installed Semver dependency** (v7.7.3 with @types/semver v7.7.1)
3. **Created `base/generator.ts`** with:
   - TypeScript interfaces: MCPManifest, Tool, Connector, ManifestMetadata
   - Main export: `async function generateManifest(modules: Module[]): Promise<MCPManifest>`
   - Dependency resolution with version conflict handling
   - Capability aggregation from tools and connectors
   - Helper functions: `resolveDependencies()`, `resolveVersionConflict()`, `saveManifest()`, `validateManifest()`
4. **Created comprehensive test suite** (`base/test-generator.ts`):
   - 8 test scenarios covering all generation cases
   - All tests pass successfully
   - Tests: loading, validation, generation, details, validation, saving, dependencies, conflict resolution
5. **Generated sample manifest** (`mcp-manifest.json`):
   - 2 tools: calculator, file-reader
   - 2 connectors: database-connector, email-connector
   - 9 unique capabilities
   - Complete metadata with timestamp and version
6. **Updated documentation**:
   - TaskCheckList2.md marked Task 2.3 complete
   - TaskCompleteNote3.md created with comprehensive details
7. **Branch**: Changes merged to Phase2 from `task-2.3`

### Review Required

**IMPORTANT**: Before starting Task 2.4, you must verify the review work completed in Task 2.3:

1. **Check TaskCompleteNote3.md**: Read `/workspace/ActionPlan/Phase2/Task3/TaskCompleteNote3.md` to understand what was completed
2. **Verify generator.ts**: Review `/workspace/base/generator.ts` structure and implementation
3. **Test the generator**: Run `npm run build && node dist/test-generator.js` to verify it works
4. **Check generated manifest**: Review the `mcp-manifest.json` file structure
5. **Document Review**: Write your review findings in `/workspace/ActionPlan/Phase2/Task3/TaskReview3.md`

### Your Review Should Include

In `TaskReview3.md`, document:

- ✅ What was done correctly
- ⚠️ Any issues or concerns found
- 💡 Suggestions for improvement (if any)
- ✔️ Final approval status (APPROVED / NEEDS REVISION)

## Your Task: Task 2.4 - Build Configuration Generator

Once you've completed the review of Task 2.3, proceed with Task 2.4.

### Task 2.4 Objectives

**Goal**: Generate runtime configuration file template for the MCP server that includes connector credentials, service settings, and environment variable substitution.

This task builds on the manifest generator (Task 2.3). You'll create a configuration generator that produces YAML configuration files from the MCP manifest, with support for development and production variants.

**Actions Required**:

1. **Install js-yaml Dependency**
   - Run `npm install js-yaml @types/js-yaml`
   - This library will be used to generate YAML configuration files

2. **Create `base/config-generator.ts` file**
   - Main export: `async function generateConfig(manifest: MCPManifest, env: 'development' | 'production'): Promise<string>`
   - Import MCPManifest from `./generator`

3. **Define Config Schema Interface**

   ```typescript
   export interface ServerConfig {
     server: {
       name: string;
       version: string;
       host: string;
       port: number;
     };
     database?: {
       url: string;
       poolSize: number;
       timeout: number;
     };
     connectors: Record<string, ConnectorConfig>;
     logging: {
       level: string;
       format: string;
       destination: string;
     };
     features: Record<string, boolean>;
   }

   export interface ConnectorConfig {
     type: string;
     enabled: boolean;
     credentials?: Record<string, string>;
     settings?: Record<string, any>;
   }
   ```

4. **Generate Server Configuration**
   - Extract server name and version from manifest
   - Set host and port with environment variable placeholders
   - Development: `host: 'localhost', port: 3000`
   - Production: `host: '0.0.0.0', port: ${PORT:-8080}`

5. **Generate Connector Configurations**
   - Iterate through manifest.connectors
   - For each connector, create ConnectorConfig entry
   - Add authentication placeholders as environment variables
   - Example for email connector: `credentials: { apiKey: '${EMAIL_API_KEY}' }`
   - Example for database connector: `url: '${DATABASE_URL}'`

6. **Generate Logging Configuration**
   - Development environment:
     - level: "debug"
     - format: "pretty"
     - destination: "console"
   - Production environment:
     - level: "info"
     - format: "json"
     - destination: "stdout"

7. **Generate Feature Flags**
   - Convert manifest.capabilities to feature flags
   - Each capability becomes a boolean flag
   - Example: "email-integration" → `features: { emailIntegration: true }`

8. **Add Environment Variable Substitution**
   - Use `${VAR_NAME}` syntax for required secrets
   - Use `${VAR_NAME:-default}` syntax for optional values with defaults
   - Add inline YAML comments explaining each variable
   - Example:
     ```yaml
     database:
       url: ${DATABASE_URL} # Required: Database connection string
       poolSize: ${DB_POOL_SIZE:-10} # Optional: Connection pool size (default: 10)
     ```

9. **Convert to YAML**
   - Use js-yaml library's `dump()` function
   - Configure YAML formatting:
     - indent: 2 spaces
     - lineWidth: 120 characters
     - noRefs: true (no YAML references)
     - sortKeys: false (maintain order)

10. **Implement Config Validation**
    - Create `function validateConfig(configString: string): boolean`
    - Parse YAML using js-yaml's `load()`
    - Check for required fields (server, logging)
    - Verify all connectors have type and enabled fields
    - Return true if valid, false otherwise

11. **Create Helper Functions**
    - `function createConnectorConfig(connector: Connector): ConnectorConfig`
    - `function getEnvVarName(connectorName: string, field: string): string`
      - Example: ("email-connector", "apiKey") → "EMAIL_CONNECTOR_API_KEY"
    - `function camelToSnakeCase(str: string): string`
      - Convert names to environment variable format

12. **Error Handling**
    - Validate manifest input (non-null, has required fields)
    - Handle YAML generation errors
    - Throw descriptive errors for invalid configurations
    - Include manifest details in error messages

### Implementation Guidance

```typescript
import { MCPManifest, Connector } from "./generator";
import * as yaml from "js-yaml";

export interface ServerConfig {
  server: {
    name: string;
    version: string;
    host: string;
    port: number | string;
  };
  database?: {
    url: string;
    poolSize: number | string;
    timeout: number | string;
  };
  connectors: Record<string, ConnectorConfig>;
  logging: {
    level: string;
    format: string;
    destination: string;
  };
  features: Record<string, boolean>;
}

export interface ConnectorConfig {
  type: string;
  enabled: boolean;
  credentials?: Record<string, string>;
  settings?: Record<string, any>;
}

export async function generateConfig(
  manifest: MCPManifest,
  env: "development" | "production"
): Promise<string> {
  // Build config object
  const config: ServerConfig = {
    server: {
      name: manifest.name,
      version: manifest.version,
      host: env === "development" ? "localhost" : "0.0.0.0",
      port: env === "development" ? 3000 : "${PORT:-8080}",
    },
    connectors: {},
    logging: {
      level: env === "development" ? "debug" : "info",
      format: env === "development" ? "pretty" : "json",
      destination: env === "development" ? "console" : "stdout",
    },
    features: {},
  };

  // Add database if needed
  if (manifest.connectors.some((c) => c.type === "database")) {
    config.database = {
      url: "${DATABASE_URL}",
      poolSize: "${DB_POOL_SIZE:-10}",
      timeout: "${DB_TIMEOUT:-5000}",
    };
  }

  // Generate connector configs
  for (const connector of manifest.connectors) {
    config.connectors[connector.name] = createConnectorConfig(connector, env);
  }

  // Generate feature flags from capabilities
  for (const capability of manifest.capabilities) {
    const featureName = capability.replace(/-/g, "");
    config.features[featureName] = true;
  }

  // Convert to YAML with comments
  const yamlString = yaml.dump(config, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
  });

  // Add header comment
  const header = `# MCP Server Configuration
# Generated from manifest: ${manifest.name} v${manifest.version}
# Environment: ${env}
# Generated at: ${new Date().toISOString()}
#
# Environment Variables:
# - Set required variables before starting the server
# - Use format: KEY=value or KEY="value with spaces"
# - Required variables are marked with "Required:" in comments
# - Optional variables have default values: \${VAR:-default}

`;

  return header + yamlString;
}

function createConnectorConfig(
  connector: Connector,
  env: string
): ConnectorConfig {
  const config: ConnectorConfig = {
    type: connector.type,
    enabled: true,
  };

  // Add credentials based on connector type
  if (connector.authentication) {
    config.credentials = {};

    // Generate environment variable names
    const prefix = getEnvVarName(connector.name, "");

    switch (connector.type) {
      case "email":
        config.credentials.apiKey = `\${${prefix}_API_KEY}`;
        config.credentials.fromEmail = `\${${prefix}_FROM_EMAIL}`;
        break;
      case "database":
        config.credentials.url = `\${${prefix}_URL}`;
        config.credentials.username = `\${${prefix}_USERNAME:-}`;
        config.credentials.password = `\${${prefix}_PASSWORD:-}`;
        break;
      case "api":
        config.credentials.apiKey = `\${${prefix}_API_KEY}`;
        config.credentials.baseUrl = `\${${prefix}_BASE_URL}`;
        break;
      // Add more connector types as needed
    }
  }

  // Add connector-specific settings
  if (connector.methods && connector.methods.length > 0) {
    config.settings = {
      availableMethods: connector.methods,
    };
  }

  return config;
}

function getEnvVarName(connectorName: string, field: string): string {
  const baseName = camelToSnakeCase(connectorName).toUpperCase();
  if (field) {
    const fieldName = camelToSnakeCase(field).toUpperCase();
    return `${baseName}_${fieldName}`;
  }
  return baseName;
}

function camelToSnakeCase(str: string): string {
  return str
    .replace(/[A-Z]/g, (letter) => `_${letter}`)
    .replace(/[-\s]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_/, "")
    .toUpperCase();
}

export function validateConfig(configString: string): boolean {
  try {
    const config = yaml.load(configString) as ServerConfig;

    // Check required fields
    if (!config.server || !config.logging) {
      return false;
    }

    // Check server fields
    if (
      !config.server.name ||
      !config.server.version ||
      !config.server.host ||
      !config.server.port
    ) {
      return false;
    }

    // Check connectors
    if (config.connectors) {
      for (const [name, connectorConfig] of Object.entries(config.connectors)) {
        if (!connectorConfig.type || connectorConfig.enabled === undefined) {
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    return false;
  }
}
```

### Testing Strategy

Create `base/test-config-generator.ts`:

1. **Test 1: Generate Development Config**
   - Load manifest from previous test
   - Generate development configuration
   - Verify YAML is valid
   - Check for localhost and debug logging

2. **Test 2: Generate Production Config**
   - Generate production configuration
   - Verify environment variables are present
   - Check for 0.0.0.0 host and info logging

3. **Test 3: Connector Credentials**
   - Verify each connector has credentials section
   - Check environment variable naming convention
   - Ensure required fields are marked

4. **Test 4: Feature Flags**
   - Verify capabilities are converted to features
   - Check feature names are properly formatted
   - Ensure all features are enabled

5. **Test 5: Database Configuration**
   - If database connector exists, verify database section
   - Check for connection pool settings
   - Verify environment variable substitution

6. **Test 6: Config Validation**
   - Validate generated configs return true
   - Test invalid configs return false
   - Test malformed YAML returns false

7. **Test 7: Environment Variable Names**
   - Test `camelToSnakeCase()` conversion
   - Verify naming convention (UPPERCASE_WITH_UNDERSCORES)
   - Check special character handling

8. **Test 8: Save Config Files**
   - Save development config to `config/development.yaml`
   - Save production config to `config/production.yaml`
   - Verify files are readable

### Success Criteria

✅ **Generates valid YAML**: Config parses without errors  
✅ **Includes all connectors**: Every manifest connector has config entry  
✅ **Supports env var substitution**: Uses `${VAR_NAME}` syntax  
✅ **Environment-specific configs**: Different settings for dev/prod  
✅ **Proper credential placeholders**: Each connector has auth variables  
✅ **Feature flags**: Capabilities converted to boolean flags  
✅ **Config validation**: validateConfig() correctly validates structure  
✅ **Comprehensive tests**: All 8 test scenarios pass

### Documentation Requirements

After completing the task:

1. Update `TaskCheckList2.md` - mark Task 2.4 as complete
2. Create `TaskCompleteNote4.md` with:
   - Summary of what was implemented
   - List of interfaces and functions created
   - Test results (all scenarios)
   - Sample configuration outputs (dev and prod)
   - Files created/modified
   - Success criteria verification

### Branch Workflow

1. Create branch `task-2.4` from Phase2
2. Implement all required functionality
3. Run all tests and verify they pass
4. Commit changes with descriptive message
5. Merge back to Phase2 using `git merge --no-ff task-2.4`

## Next Task Preview

After Task 2.4 is complete, Task 3.1 will focus on creating the Dockerfile template generator, which will use the configuration files generated in this task.

### What Was Done in Task 2.2

The previous agent successfully:

1. **Reviewed Task 2.1** and wrote approval in TaskReview1.md
2. **Installed Zod dependency** (v3.25.76) for schema validation
3. **Created `base/validator.ts`** with:
   - TypeScript interfaces: ValidationResult, ValidationError
   - Zod schemas for tool and connector metadata validation
   - Main export: `function validateModules(modules: Module[]): ValidationResult`
   - Duplicate name detection (case-insensitive)
   - Schema versioning support (v1.0)
   - Dependency validation (npm package names and version ranges)
   - Helper function: `formatValidationResults()` for output formatting
4. **Created comprehensive test suite** (`base/test-validator.ts`):
   - 8 test scenarios covering all validation cases
   - All tests pass successfully
   - Validates: duplicates, invalid versions, invalid types, schema versioning, dependencies
5. **Updated documentation**:
   - TaskCheckList2.md marked Task 2.2 complete
   - TaskCompleteNote2.md created with comprehensive details
6. **Branch**: Changes are on `task-2.2` (branched from Phase2)

### Review Required

**IMPORTANT**: Before starting Task 2.3, you must verify the review work completed in Task 2.2:

1. **Check TaskCompleteNote2.md**: Read `/workspace/ActionPlan/Phase2/Task2/TaskCompleteNote2.md` to understand what was completed
2. **Verify validator.ts**: Review `/workspace/base/validator.ts` structure and implementation
3. **Test the validator**: Run `node dist/test-validator.js` to verify it works
4. **Check Zod schemas**: Review the validation schemas for tools and connectors
5. **Document Review**: Write your review findings in `/workspace/ActionPlan/Phase2/Task2/TaskReview2.md`

### Your Review Should Include

In `TaskReview2.md`, document:

- ✅ What was done correctly
- ⚠️ Any issues or concerns found
- 💡 Suggestions for improvement (if any)
- ✔️ Final approval status (APPROVED / NEEDS REVISION)

## Your Task: Task 2.3 - Create Manifest Generator

Once you've completed the review of Task 2.2, proceed with Task 2.3.

### Task 2.3 Objectives

**Goal**: Merge all validated modules into a single MCP server manifest that can be used to generate an actual MCP server.

This task builds on the module loader (Task 2.1) and validator (Task 2.2). You'll create a manifest generator that combines all tools and connectors into a structured MCP manifest.

**Actions Required**:

1. **Create `base/generator.ts` file**
   - Main export: `async function generateManifest(modules: Module[]): Promise<MCPManifest>`
   - Import Module type from `./loader`

2. **Define MCPManifest Interface**

   ```typescript
   export interface MCPManifest {
     name: string;
     version: string;
     tools: Tool[];
     connectors: Connector[];
     capabilities: string[];
     dependencies: Record<string, string>;
   }

   export interface Tool {
     name: string;
     description: string;
     version: string;
     inputSchema?: object;
   }

   export interface Connector {
     name: string;
     description: string;
     version: string;
     type: string;
     authentication?: object;
     methods?: string[];
   }
   ```

3. **Merge Tool Modules**
   - Iterate through modules where type === "tool"
   - Extract tool metadata (name, description, version, inputSchema)
   - Create Tool objects for the manifest
   - Collect capabilities from tool metadata

4. **Merge Connector Modules**
   - Iterate through modules where type === "connector"
   - Extract connector metadata (name, description, version, type, authentication, methods)
   - Create Connector objects for the manifest
   - Collect capabilities from connector types

5. **Consolidate Dependencies**
   - Collect all dependencies from module metadata
   - Merge into single dependencies object
   - Resolve version conflicts using highest semver version
   - Use `semver` library for version comparison (npm install semver)

6. **Generate Server Metadata**
   - Set manifest name (e.g., "generated-mcp-server")
   - Read version from package.json or use "0.1.0" as default
   - Add timestamp or git commit hash if available

7. **Aggregate Capabilities**
   - Collect unique capabilities from tools and connectors
   - Extract from metadata.capabilities arrays
   - Infer from connector types (e.g., "email" → "email-integration")
   - Return array of unique capability strings

8. **Implement Dependency Resolution**
   - Parse semver version strings (e.g., "^1.0.0", "~2.1.0", ">=3.0.0")
   - Compare versions using semver.maxSatisfying() or similar
   - Handle conflicts by selecting highest compatible version
   - Log warnings if incompatible versions detected

9. **Error Handling**
   - Wrap generation in try-catch
   - Validate inputs (non-empty modules array)
   - Throw descriptive errors for invalid data
   - Include module names in error messages

10. **Validate Output**
    - Ensure all required MCPManifest fields are present
    - Verify tools and connectors arrays are properly formatted
    - Check dependencies are valid npm package format
    - Return properly structured MCPManifest object

### Implementation Guidance

```typescript
import { Module } from "./loader";
import * as semver from "semver";

export interface MCPManifest {
  name: string;
  version: string;
  tools: Tool[];
  connectors: Connector[];
  capabilities: string[];
  dependencies: Record<string, string>;
}

export interface Tool {
  name: string;
  description: string;
  version: string;
  inputSchema?: object;
}

export interface Connector {
  name: string;
  description: string;
  version: string;
  type: string;
  authentication?: object;
  methods?: string[];
}

export async function generateManifest(
  modules: Module[]
): Promise<MCPManifest> {
  const tools: Tool[] = [];
  const connectors: Connector[] = [];
  const capabilitiesSet = new Set<string>();
  const allDependencies: Record<string, string[]> = {};

  // Process tools
  for (const module of modules) {
    if (module.type === "tool") {
      const metadata = module.metadata as any;
      tools.push({
        name: metadata.name,
        description: metadata.description,
        version: metadata.version,
        inputSchema: metadata.inputSchema,
      });

      // Collect capabilities
      if (metadata.capabilities) {
        metadata.capabilities.forEach((cap: string) =>
          capabilitiesSet.add(cap)
        );
      }

      // Collect dependencies
      if (metadata.dependencies) {
        for (const [pkg, ver] of Object.entries(metadata.dependencies)) {
          if (!allDependencies[pkg]) {
            allDependencies[pkg] = [];
          }
          allDependencies[pkg].push(ver as string);
        }
      }
    }
  }

  // Process connectors
  for (const module of modules) {
    if (module.type === "connector") {
      const metadata = module.metadata as any;
      connectors.push({
        name: metadata.name,
        description: metadata.description,
        version: metadata.version,
        type: metadata.type,
        authentication: metadata.authentication,
        methods: metadata.methods,
      });

      // Add connector type as capability
      capabilitiesSet.add(`${metadata.type}-integration`);

      // Collect dependencies
      if (metadata.dependencies) {
        for (const [pkg, ver] of Object.entries(metadata.dependencies)) {
          if (!allDependencies[pkg]) {
            allDependencies[pkg] = [];
          }
          allDependencies[pkg].push(ver as string);
        }
      }
    }
  }

  // Resolve dependency versions
  const dependencies: Record<string, string> = {};
  for (const [pkg, versions] of Object.entries(allDependencies)) {
    // Use highest version that satisfies all requirements
    dependencies[pkg] = resolveVersionConflict(versions);
  }

  return {
    name: "generated-mcp-server",
    version: "0.1.0",
    tools,
    connectors,
    capabilities: Array.from(capabilitiesSet),
    dependencies,
  };
}

function resolveVersionConflict(versions: string[]): string {
  // Simple strategy: return the version with highest major.minor.patch
  // In production, would use semver.maxSatisfying with ranges
  return versions.sort((a, b) => {
    try {
      return semver.compare(
        semver.coerce(b) || "0.0.0",
        semver.coerce(a) || "0.0.0"
      );
    } catch {
      return 0;
    }
  })[0];
}
```

### Success Criteria

- ✅ `base/generator.ts` file exists with all required exports
- ✅ MCPManifest interface properly defined with all fields
- ✅ Tool and Connector interfaces defined
- ✅ generateManifest() function creates valid manifest from modules
- ✅ All tools from modules are included in manifest
- ✅ All connectors from modules are included in manifest
- ✅ Capabilities are aggregated and deduplicated
- ✅ Dependencies are consolidated and version conflicts resolved
- ✅ Server metadata (name, version) is included
- ✅ Code compiles without errors (`npm run build` succeeds)
- ✅ Generated manifest is valid JSON structure

### Testing Strategy

After implementing the generator:

1. Test with modules from Task 2.1 (should generate manifest with 2 tools, 2 connectors)
2. Test capability aggregation (should include tool capabilities + connector integrations)
3. Test dependency consolidation (add dependencies to sample modules first)
4. Test version conflict resolution (create modules with different versions of same package)
5. Create a test script to verify manifest structure
6. Validate output against expected format

### Documentation Requirements

When complete:

1. Update `ActionPlan/Phase2/TaskCheckList2.md` to mark Task 2.3 as complete
2. Create completion note in `ActionPlan/Phase2/Task3/TaskCompleteNote3.md`
3. Rewrite this WorkNotes.md file with instructions for the next agent (Task 2.4)

## Reference Files

- Task details: `/workspace/ActionPlan/Phase2/Task3/Task3.md`
- Checklist: `/workspace/ActionPlan/Phase2/TaskCheckList2.md`
- Previous task: `/workspace/ActionPlan/Phase2/Task2/TaskCompleteNote2.md`
- Loader implementation: `/workspace/base/loader.ts`
- Validator implementation: `/workspace/base/validator.ts`

## Getting Started

1. First, review Task 2.2 (see "Review Required" section above)
2. Write your review in TaskReview2.md
3. Install semver: `npm install semver @types/semver`
4. Create the `base/generator.ts` file with required interfaces
5. Implement tool and connector merging logic
6. Implement dependency consolidation and version resolution
7. Test with existing sample modules
8. Create test script to verify manifest generation
9. Compile and verify no errors
10. Document completion and update checklist
11. Rewrite this file for the next agent (Task 2.4)

## Branch Management

- **Current Branch**: You should be on `task-2.2`
- **Action**: Create branch `task-2.3` from `Phase2` for your work
- **Merge Target**: Merge back into `Phase2` when complete
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
