# Task 2.2: Build Module Validator

**Goal**: Validate loaded modules against MCP schema and check for conflicts.

**Actions**:

- Create `base/validator.ts` with `function validateModules(modules: Module[]): ValidationResult`
- Define Zod schemas for MCP tool spec: must have name, description, inputSchema (JSON Schema), handler function
- Define Zod schemas for connector spec: must have name, type, authentication config, methods
- Check for duplicate names across modules (return error if conflicts found)
- Validate dependencies: ensure referenced npm packages are installable, check version compatibility
- Implement schema versioning: check `metadata.schemaVersion` field, support v1.0 initially
- Return `{ valid: boolean, errors: ValidationError[], warnings: string[] }`

**Success Criteria**: Rejects invalid modules; identifies naming conflicts; accepts valid MCP tool/connector schemas
