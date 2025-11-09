# Task 7.1: Create Config Schema Definition

**Goal**: Define formal schema for MCP server configuration file.

**Actions**:

- Create `config/schema.yaml` with complete config structure documentation
- Define database section: `database: { type: 'postgres'|'sqlite'|'mysql', url: string, pool: { min: number, max: number, idleTimeout: number } }`
- Define services section: `services: { [serviceName: string]: { apiKey?: string, endpoint?: string, timeout?: number } }`
- Add logging section: `logging: { level: 'debug'|'info'|'warn'|'error', format: 'json'|'text', destination: 'stdout'|'file', filePath?: string }`
- Include feature flags: `features: { [featureName: string]: boolean }` for toggling functionality
- Add server section: `server: { port: number, host: string, cors: boolean, maxRequestSize: string }`
- Include JSON Schema version of same structure in `config/schema.json` for validation
- Add examples for each field with comments

**Success Criteria**: Complete schema covering all config options; both YAML and JSON Schema versions; well-documented
