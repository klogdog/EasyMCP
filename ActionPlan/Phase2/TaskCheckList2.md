# Task Checklist for Phase 2: Core Generator Components

## Overview

This phase focuses on core generator components.

## Tasks

### Task 2.1: Implement Module Loader

- [x] Create `base/loader.ts` with main export `async function loadModules(basePath: string): Promise<Module[]>`
- [x] Use `fs.promises.readdir` with recursive option to scan `/tools` and `/connectors`
- [x] Filter files matching `*.ts` and `*.py` extensions using path.extname()
- [x] For each file, extract metadata by parsing JSDoc/docstring comments or looking for export const metadata = {...}
- [x] Return array of Module objects: `{ name: string, path: string, type: 'tool'|'connector', language: 'typescript'|'python', metadata: {...} }`
- [x] Add try-catch error handling for each file; log warnings for malformed modules but continue
- [x] Export types: `interface Module`, `interface ToolMetadata`, `interface ConnectorMetadata`
- [x] **Success Criteria**: Function returns all valid modules; handles missing metadata gracefully; logs clear error messages

### Task 2.2: Build Module Validator

- [ ] Create `base/validator.ts` with `function validateModules(modules: Module[]): ValidationResult`
- [ ] Define Zod schemas for MCP tool spec: must have name, description, inputSchema (JSON Schema), handler function
- [ ] Define Zod schemas for connector spec: must have name, type, authentication config, methods
- [ ] Check for duplicate names across modules (return error if conflicts found)
- [ ] Validate dependencies: ensure referenced npm packages are installable, check version compatibility
- [ ] Implement schema versioning: check `metadata.schemaVersion` field, support v1.0 initially
- [ ] Return `{ valid: boolean, errors: ValidationError[], warnings: string[] }`
- [ ] **Success Criteria**: Rejects invalid modules; identifies naming conflicts; accepts valid MCP tool/connector schemas

### Task 2.3: Create Manifest Generator

- [ ] Create `base/generator.ts` with `async function generateManifest(modules: Module[]): Promise<MCPManifest>`
- [ ] Create MCPManifest structure: `{ name: string, version: string, tools: Tool[], connectors: Connector[], capabilities: string[], dependencies: Record<string, string> }`
- [ ] Merge all tool modules: collect tool definitions, combine input schemas, aggregate capabilities
- [ ] Merge all connector modules: collect connector configs, merge authentication requirements
- [ ] Generate server metadata: version from git tag or package.json, timestamp, generator version
- [ ] Consolidate dependencies: merge package.json dependencies from all modules, resolve version conflicts (use highest semver)
- [ ] Add capabilities array: list unique capabilities like "text-processing", "email-integration", etc.
- [ ] Validate final manifest against MCP protocol specification
- [ ] **Success Criteria**: Produces valid MCP manifest JSON; all tools/connectors included; dependencies resolved

### Task 2.4: Build Configuration Generator

- [ ] Create `base/config-generator.ts` with `async function generateConfig(manifest: MCPManifest, secrets: Record<string, string>): Promise<string>`
- [ ] Define config schema: database (url, pool settings), services (API keys by service name), logging (level, format), features (flags), server (port, host)
- [ ] Create YAML template using js-yaml library: iterate through manifest connectors, add placeholder for each required credential
- [ ] Insert environment variable references: use `${VAR_NAME}` syntax for secrets, `${PORT:-8080}` for defaults
- [ ] Add inline comments explaining each section and how to override via env vars
- [ ] Generate different variants: development (verbose logging, localhost), production (structured logs, external DB)
- [ ] Return formatted YAML string
- [ ] Include validation function: `validateConfig(configString: string): boolean`
- [ ] **Success Criteria**: Generates valid YAML; includes all connector credentials; supports env var substitution
