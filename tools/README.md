# /tools - Drop-in MCP Tools

## Purpose

This directory contains reusable MCP tools that can be dynamically loaded into generated MCP servers. Each tool is a standalone module that implements the MCP tool specification.

## Expected File Formats

- **TypeScript (.ts)**: TypeScript tool implementations
- **Python (.py)**: Python tool implementations
- **Metadata**: Tools should export metadata describing their schema

## Naming Conventions

- Tool files should use kebab-case: `file-reader.ts`, `api-caller.py`
- Tool names in metadata should be descriptive: `read_file`, `call_api`
- Each tool should be self-contained in a single file

## Tool Structure

Each tool must include:

- **Name**: Unique identifier for the tool
- **Description**: Clear explanation of what the tool does
- **Input Schema**: JSON Schema defining expected parameters
- **Handler**: Implementation function that executes the tool logic

Example metadata:

```typescript
export const metadata = {
  name: "example_tool",
  description: "An example tool",
  schemaVersion: "1.0",
  inputSchema: {
    /* JSON Schema */
  },
};
```
