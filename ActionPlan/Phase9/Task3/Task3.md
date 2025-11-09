# Task 9.3: Write Unit Tests - Generator

**Goal**: Test manifest generation and tool/connector merging.

**Actions**:

- Create `base/__tests__/generator.test.ts`
- Test manifest generation: provide array of modules, verify output manifest has correct structure
- Test tool merging: multiple tools with different capabilities, verify all included, no duplicates
- Test conflict detection: tools with same name, verify error thrown with clear message
- Test validation rules: invalid tool schema, missing required fields, verify rejected with reason
- Test schema versioning: different schema versions, verify handled correctly or error if unsupported
- Mock validator and loader dependencies
- Verify capabilities aggregation: ensure unique capabilities listed
- Test dependency resolution: conflicting versions, verify highest compatible chosen

**Success Criteria**: All generator logic tested; >85% coverage; validates error cases; fast execution
