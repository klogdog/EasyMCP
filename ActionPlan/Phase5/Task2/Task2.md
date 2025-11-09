# Task 5.2: Build Tool Integration Template

**Goal**: Template for dynamically loading and registering MCP tools at runtime.

**Actions**:

- Create `base/templates/tool-loader.ts.template`
- Implement `class ToolRegistry { private tools = new Map<string, Tool>(); register(tool: Tool); get(name: string); list(); }`
- Add dynamic import logic: iterate through manifest.tools, `await import(toolPath)`, extract default export
- Create tool invocation router: `async function invokeTool(name: string, args: any): Promise<any>` that looks up tool and calls its handler
- Implement error handling wrapper: try-catch around each tool invocation, log errors, return structured error response
- Add tool lifecycle: `onLoad()` hook when tool is registered, `onUnload()` for cleanup
- Implement input validation: validate args against tool.inputSchema using JSON Schema validator (ajv)
- Add result transformation: wrap tool output in standard format `{ success: boolean, result?: any, error?: string }`
- Include placeholder: `{{TOOL_LIST}}` for injecting tool definitions during code generation

**Success Criteria**: Dynamically loads tools; validates inputs; handles errors; provides consistent response format
