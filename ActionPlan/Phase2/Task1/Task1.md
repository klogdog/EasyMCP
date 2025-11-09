# Task 2.1: Implement Module Loader

**Goal**: Create a module discovery system that finds and loads all tools and connectors from their directories.

**Actions**:

- Create `base/loader.ts` with main export `async function loadModules(basePath: string): Promise<Module[]>`
- Use `fs.promises.readdir` with recursive option to scan `/tools` and `/connectors`
- Filter files matching `*.ts` and `*.py` extensions using path.extname()
- For each file, extract metadata by parsing JSDoc/docstring comments or looking for export const metadata = {...}
- Return array of Module objects: `{ name: string, path: string, type: 'tool'|'connector', language: 'typescript'|'python', metadata: {...} }`
- Add try-catch error handling for each file; log warnings for malformed modules but continue
- Export types: `interface Module`, `interface ToolMetadata`, `interface ConnectorMetadata`

**Success Criteria**: Function returns all valid modules; handles missing metadata gracefully; logs clear error messages
