# Task 9.4: Write Unit Tests - Config

**Goal**: Test configuration parsing, validation, and merging.

**Actions**:

- Create `base/__tests__/config-parser.test.ts`
- Test config generation: given manifest and secrets, verify valid YAML produced
- Test variable substitution: ${VAR}, ${VAR:-default}, nested vars, verify all replaced correctly
- Test schema validation: valid config passes, invalid configs rejected with field-level errors
- Test override merging: base + overrides, verify correct precedence, deep merge behavior
- Test parsing errors: invalid YAML syntax, verify error has line number and helpful message
- Mock environment variables using process.env manipulation
- Test default values: missing optional fields get defaults from schema
- Test circular references: ensure doesn't cause infinite loops

**Success Criteria**: Config parser thoroughly tested; >90% coverage; validates all merge scenarios; clear error messages
