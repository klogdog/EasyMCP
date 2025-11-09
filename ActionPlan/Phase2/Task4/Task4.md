# Task 2.4: Build Configuration Generator

**Goal**: Generate runtime configuration file template for the MCP server.

**Actions**:

- Create `base/config-generator.ts` with `async function generateConfig(manifest: MCPManifest, secrets: Record<string, string>): Promise<string>`
- Define config schema: database (url, pool settings), services (API keys by service name), logging (level, format), features (flags), server (port, host)
- Create YAML template using js-yaml library: iterate through manifest connectors, add placeholder for each required credential
- Insert environment variable references: use `${VAR_NAME}` syntax for secrets, `${PORT:-8080}` for defaults
- Add inline comments explaining each section and how to override via env vars
- Generate different variants: development (verbose logging, localhost), production (structured logs, external DB)
- Return formatted YAML string
- Include validation function: `validateConfig(configString: string): boolean`

**Success Criteria**: Generates valid YAML; includes all connector credentials; supports env var substitution
