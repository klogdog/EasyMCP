# Task 2.3: Create Manifest Generator

**Goal**: Merge all validated modules into a single MCP server manifest.

**Actions**:

- Create `base/generator.ts` with `async function generateManifest(modules: Module[]): Promise<MCPManifest>`
- Create MCPManifest structure: `{ name: string, version: string, tools: Tool[], connectors: Connector[], capabilities: string[], dependencies: Record<string, string> }`
- Merge all tool modules: collect tool definitions, combine input schemas, aggregate capabilities
- Merge all connector modules: collect connector configs, merge authentication requirements
- Generate server metadata: version from git tag or package.json, timestamp, generator version
- Consolidate dependencies: merge package.json dependencies from all modules, resolve version conflicts (use highest semver)
- Add capabilities array: list unique capabilities like "text-processing", "email-integration", etc.
- Validate final manifest against MCP protocol specification

**Success Criteria**: Produces valid MCP manifest JSON; all tools/connectors included; dependencies resolved
