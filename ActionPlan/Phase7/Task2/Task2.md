# Task 7.2: Build Config Parser

**Goal**: Create robust configuration file parser with environment variable substitution.

**Actions**:

- Create `base/config-parser.ts` with `async function parseConfig(filePath: string): Promise<Config>`
- Implement YAML parsing: use js-yaml, handle syntax errors gracefully with line numbers
- Add JSON support as fallback: try parsing as JSON if YAML fails
- Implement env var substitution: replace `${VAR_NAME}` with `process.env.VAR_NAME`, support defaults `${VAR:-default}`
- Add recursive substitution: handle nested objects, arrays
- Implement default values: merge with defaults from schema, only override what's specified
- Add validation: use Zod schema based on config/schema.json, return detailed error messages with field paths
- Include type generation: export TypeScript types matching config structure
- Handle missing files: return sensible defaults or throw descriptive error based on strict mode

**Success Criteria**: Parses YAML/JSON; substitutes env vars with defaults; validates against schema; handles errors clearly
