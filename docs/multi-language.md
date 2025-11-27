# Multi-Language Support Guide

The MCP Generator supports multiple programming languages for tool development, allowing you to write tools in TypeScript/JavaScript or Python. This guide covers how to create and use multi-language tools.

## Table of Contents

1. [Overview](#overview)
2. [Language Support](#language-support)
3. [Python Tool Development](#python-tool-development)
4. [TypeScript Tool Development](#typescript-tool-development)
5. [Mixed-Language Projects](#mixed-language-projects)
6. [Docker Configuration](#docker-configuration)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## Overview

Multi-language support allows you to:

- Write tools in your preferred language (Python or TypeScript)
- Mix Python and TypeScript tools in the same server
- Automatically detect and load tools based on file extension
- Generate Docker images with appropriate runtime environments
- Maintain consistent MCP protocol compliance across languages

## Language Support

### Supported Languages

| Language   | Extension | Runtime     | Status       |
| ---------- | --------- | ----------- | ------------ |
| TypeScript | `.ts`     | Node.js     | Full Support |
| JavaScript | `.js`     | Node.js     | Full Support |
| Python     | `.py`     | Python 3.8+ | Full Support |

### Language Detection

Tools are automatically detected based on:

1. File extension (`.ts`, `.js`, `.py`)
2. Docstring metadata (Python) or JSDoc comments (TypeScript)
3. Function signatures and type hints

## Python Tool Development

### Basic Structure

Python tools use docstrings with metadata annotations:

```python
def my_tool(input_text: str, count: int = 1) -> dict:
    """
    My Tool Description

    @tool: my_tool
    @description: Processes text and returns results
    @param input_text: str - The text to process
    @param count?: int - Number of iterations (default: 1)
    @returns: Processing results
    @timeout: 30000
    """
    result = input_text * count
    return {
        "result": result,
        "length": len(result),
    }
```

### Metadata Annotations

| Annotation                 | Description                | Required            |
| -------------------------- | -------------------------- | ------------------- |
| `@tool`                    | Tool name (identifier)     | Yes                 |
| `@description`             | Human-readable description | Yes                 |
| `@param name: type - desc` | Parameter definition       | Per param           |
| `@returns`                 | Return value description   | No                  |
| `@timeout`                 | Execution timeout in ms    | No (default: 30000) |

### Parameter Types

Map Python types to JSON Schema:

| Python Type      | JSON Schema Type | Example            |
| ---------------- | ---------------- | ------------------ |
| `str`            | `string`         | `"hello"`          |
| `int`            | `integer`        | `42`               |
| `float`          | `number`         | `3.14`             |
| `bool`           | `boolean`        | `True`             |
| `list`, `array`  | `array`          | `[1, 2, 3]`        |
| `dict`, `object` | `object`         | `{"key": "value"}` |

### Optional Parameters

Mark parameters as optional with `?`:

```python
@param required_param: str - This is required
@param optional_param?: int - This is optional
```

Or use Python defaults:

```python
def my_tool(required: str, optional: int = 10) -> dict:
    ...
```

### Async Tools

Python async functions are fully supported:

```python
import asyncio

async def async_tool(items: list, delay: float = 0.1) -> dict:
    """
    @tool: async_tool
    @description: Process items asynchronously
    @param items: array - Items to process
    @param delay?: float - Delay between items
    """
    results = []
    for item in items:
        await asyncio.sleep(delay)
        results.append(process(item))
    return {"results": results}
```

### Example: Complete Python Tool

```python
"""
Text Analysis Tool

Provides text analysis capabilities for the MCP server.
"""

from typing import Dict, List, Optional
import re


def analyze_text(
    text: str,
    options: Optional[Dict[str, bool]] = None
) -> Dict[str, any]:
    """
    Analyze Text

    Performs comprehensive text analysis including word count,
    character statistics, and pattern detection.

    @tool: analyze_text
    @description: Analyze text and return detailed statistics
    @param text: str - The text to analyze
    @param options?: object - Analysis options (word_freq, patterns)
    @returns: Detailed analysis results
    @timeout: 60000
    """
    options = options or {}

    # Basic statistics
    words = text.split()
    sentences = re.split(r'[.!?]+', text)

    result = {
        "char_count": len(text),
        "word_count": len(words),
        "sentence_count": len([s for s in sentences if s.strip()]),
        "avg_word_length": sum(len(w) for w in words) / max(len(words), 1),
    }

    # Optional word frequency
    if options.get("word_freq"):
        freq = {}
        for word in words:
            word = word.lower()
            freq[word] = freq.get(word, 0) + 1
        result["word_frequency"] = dict(
            sorted(freq.items(), key=lambda x: -x[1])[:10]
        )

    # Optional pattern detection
    if options.get("patterns"):
        result["patterns"] = {
            "emails": len(re.findall(r'\S+@\S+', text)),
            "urls": len(re.findall(r'https?://\S+', text)),
            "numbers": len(re.findall(r'\d+', text)),
        }

    return result
```

## TypeScript Tool Development

TypeScript tools use the standard MCP tool format:

```typescript
import { Tool, ToolResult } from "@modelcontextprotocol/sdk/types.js";

export const analyzeTextTool: Tool = {
  name: "analyze_text",
  description: "Analyze text and return statistics",
  inputSchema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "Text to analyze",
      },
      options: {
        type: "object",
        description: "Analysis options",
        properties: {
          wordFreq: { type: "boolean" },
          patterns: { type: "boolean" },
        },
      },
    },
    required: ["text"],
  },
};

export async function handleAnalyzeText(args: {
  text: string;
  options?: { wordFreq?: boolean; patterns?: boolean };
}): Promise<ToolResult> {
  const { text, options = {} } = args;

  const words = text.split(/\s+/);

  const result = {
    charCount: text.length,
    wordCount: words.length,
  };

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
}
```

## Mixed-Language Projects

### Project Structure

```
my-mcp-server/
├── package.json
├── requirements.txt
├── server.js
├── server.py
├── tools/
│   ├── typescript/
│   │   ├── calculator.ts
│   │   └── formatter.ts
│   └── python/
│       ├── analyzer.py
│       └── ml_tool.py
├── connectors/
│   ├── database.ts
│   └── api_client.py
└── config/
    └── config.yaml
```

### Configuration

Configure language preferences in `config.yaml`:

```yaml
server:
  name: mixed-language-server
  version: 1.0.0

languages:
  python:
    enabled: true
    path: /usr/bin/python3
    timeout: 30000
    env:
      PYTHONPATH: ./tools/python

  typescript:
    enabled: true

tools:
  directories:
    - ./tools/typescript
    - ./tools/python
```

### Tool Loading Order

1. TypeScript/JavaScript tools are loaded first
2. Python tools are discovered and loaded
3. All tools are registered with the MCP server
4. Duplicate tool names are rejected

## Docker Configuration

### Automatic Detection

The generator automatically detects languages and creates appropriate Dockerfiles:

**TypeScript Only:**

```dockerfile
FROM node:20-alpine
# ... Node.js setup
```

**Python Only:**

```dockerfile
FROM python:3.11-slim
# ... Python setup
```

**Mixed (Node.js + Python):**

```dockerfile
# Multi-stage build
FROM node:20-alpine AS node-builder
# ... Node.js dependencies

FROM python:3.11-slim AS python-builder
# ... Python dependencies

FROM node:20-alpine AS runtime
RUN apk add --no-cache python3 py3-pip
# ... Combined setup
```

### Custom Configuration

Override default images in `DockerfileOptions`:

```typescript
const options: DockerfileOptions = {
  nodeBaseImage: "node:20-bullseye",
  pythonBaseImage: "python:3.11-bullseye",
  pythonRequirements: "./requirements.txt",
  additionalPythonPackages: ["numpy", "pandas"],
};
```

### Requirements Management

Automatically scan Python imports:

```typescript
import { scanDirectory, generateRequirementsTxt } from "./requirements-scanner";

const result = scanDirectory("./tools/python");
const requirements = generateRequirementsTxt(result);
// Write to requirements.txt
```

## Best Practices

### 1. Consistent Tool Naming

Use snake_case for tool names across languages:

- ✅ `analyze_text`, `process_data`
- ❌ `analyzeText`, `ProcessData`

### 2. Type Safety

**Python:** Use type hints for all parameters:

```python
def my_tool(text: str, count: int) -> dict:
```

**TypeScript:** Define complete input schemas:

```typescript
inputSchema: {
  type: "object",
  properties: { ... },
  required: ["param1", "param2"],
}
```

### 3. Error Handling

**Python:**

```python
def my_tool(data: dict) -> dict:
    try:
        result = process(data)
        return {"success": True, "result": result}
    except ValueError as e:
        return {"success": False, "error": str(e)}
```

**TypeScript:**

```typescript
try {
  const result = await process(args);
  return { content: [{ type: "text", text: result }] };
} catch (error) {
  return {
    content: [{ type: "text", text: `Error: ${error.message}` }],
    isError: true,
  };
}
```

### 4. Timeout Configuration

Set appropriate timeouts for long-running operations:

```python
@timeout: 120000  # 2 minutes for ML inference
```

### 5. Dependencies

Keep dependencies minimal and well-documented:

- Use `requirements.txt` for Python
- Use `package.json` for Node.js
- Document any system-level dependencies

## Troubleshooting

### Common Issues

#### Python Not Found

```
Error: Python executable not found
```

**Solution:** Ensure Python 3.8+ is installed and in PATH:

```bash
python3 --version
which python3
```

#### Import Errors

```
Error: ModuleNotFoundError: No module named 'mypackage'
```

**Solution:** Install dependencies:

```bash
pip install -r requirements.txt
```

#### Timeout Errors

```
Error: Execution timed out after 30000ms
```

**Solution:** Increase timeout in tool metadata:

```python
@timeout: 60000
```

#### JSON Serialization Errors

```
Error: Object of type 'datetime' is not JSON serializable
```

**Solution:** Convert non-serializable types:

```python
import json
from datetime import datetime

def my_tool():
    return {
        "timestamp": datetime.now().isoformat(),
    }
```

### Debug Mode

Enable debug logging:

```yaml
server:
  logging:
    level: debug
    python_verbose: true
```

### Health Checks

Verify Python tools are loaded:

```bash
curl http://localhost:3000/health
# Response:
# {
#   "status": "healthy",
#   "tools": {
#     "total": 10,
#     "typescript": 6,
#     "python": 4
#   }
# }
```

## API Reference

### PythonToolLoader

```typescript
class PythonToolLoader {
  constructor(options: PythonLoaderOptions);

  loadTool(filePath: string): Promise<LoadedTool>;
  loadToolsFromFile(filePath: string): Promise<LoadedTool[]>;
  executeTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<ExecutionResult>;
  discoverTools(): Promise<LoadedTool[]>;
  getToolDefinitions(): ToolDefinition[];
}
```

### RequirementsScanner

```typescript
function scanFile(filePath: string, options?: ScanOptions): ScanResult;
function scanSource(source: string, options?: ScanOptions): ScanResult;
function scanDirectory(dirPath: string, options?: ScanOptions): ScanResult;
function generateRequirementsTxt(
  result: ScanResult,
  options?: GenerateOptions
): string;
```

## Next Steps

- [Tool Development Guide](./tool-development.md)
- [Connector Development Guide](./connector-development.md)
- [Docker Deployment Guide](./deployment.md)
- [Configuration Reference](./configuration.md)
