/**
 * Tests for Python Loader
 * 
 * Tests for multi-language Python support including
 * parsing, execution, bridging, and tool loading.
 */

import {
    parsePythonMeta,
    extractFunctionName,
    extractPythonImports,
    isStandardLibrary,
    loadPythonTool,
    scanPythonTools,
    generateRequirementsTxt,
    PythonBridge,
    MultiLangToolRegistry,
    hasPythonTools,
    generatePythonDockerfileAdditions,
    PythonToolDefinition,
} from '../python-loader';

// ============================================================================
// Mock Utilities
// ============================================================================

// Mock child_process.spawn
const mockSpawn = jest.fn();
jest.mock('child_process', () => ({
    spawn: (...args: unknown[]) => mockSpawn(...args),
}));

// Mock fs operations
const mockFiles: Record<string, string> = {};
const mockDirs: Record<string, string[]> = {};
jest.mock('fs', () => ({
    readFileSync: (fpath: string) => {
        if (mockFiles[fpath]) return mockFiles[fpath];
        throw new Error(`File not found: ${fpath}`);
    },
    existsSync: (fpath: string) => fpath in mockFiles || fpath in mockDirs,
    readdirSync: (fpath: string) => mockDirs[fpath] || [],
}));

// Create mock process
function createMockProcess(
    stdout: string | string[],
    stderr: string | string[] = [],
    exitCode = 0
) {
    const stdoutData = Array.isArray(stdout) ? stdout : [stdout];
    const stderrData = Array.isArray(stderr) ? stderr : [stderr];

    const proc = {
        stdout: {
            on: jest.fn((event: string, callback: (data: Buffer) => void) => {
                if (event === 'data') {
                    stdoutData.forEach(d => callback(Buffer.from(d)));
                }
            }),
        },
        stderr: {
            on: jest.fn((event: string, callback: (data: Buffer) => void) => {
                if (event === 'data') {
                    stderrData.forEach(d => callback(Buffer.from(d)));
                }
            }),
        },
        on: jest.fn((event: string, callback: (code: number | Error) => void) => {
            if (event === 'close') {
                setTimeout(() => callback(exitCode), 0);
            }
        }),
        kill: jest.fn(),
    };

    return proc;
}

// ============================================================================
// parsePythonMeta Tests
// ============================================================================

describe('parsePythonMeta', () => {
    it('should parse tool metadata from docstring', () => {
        const source = `
"""
MCP Tool: test-tool
Description: A test tool that does testing

Input Schema:
{
  "type": "object",
  "properties": {
    "input": {"type": "string"},
    "count": {"type": "integer"}
  },
  "required": ["input"]
}
"""

def test_tool(input: str, count: int = 1):
    return {"result": input * count}
`;

        const metadata = parsePythonMeta(source);

        expect(metadata).not.toBeNull();
        expect(metadata?.name).toBe('test-tool');
        expect(metadata?.description).toBe('A test tool that does testing');
        expect(metadata?.inputSchema).toEqual({
            type: 'object',
            properties: {
                input: { type: 'string' },
                count: { type: 'integer' },
            },
            required: ['input'],
        });
    });

    it('should return null for source without MCP metadata', () => {
        const source = `
"""
Regular docstring without MCP metadata.
"""

def regular_func():
    pass
`;

        const metadata = parsePythonMeta(source);

        expect(metadata).toBeNull();
    });

    it('should handle missing optional fields', () => {
        const source = `
"""
MCP Tool: minimal-tool
Description: Minimal tool
"""

def minimal():
    pass
`;

        const metadata = parsePythonMeta(source);

        expect(metadata).not.toBeNull();
        expect(metadata?.name).toBe('minimal-tool');
        expect(metadata?.inputSchema).toEqual({ type: 'object' });
    });

    it('should parse Python version requirement', () => {
        const source = `
"""
MCP Tool: versioned-tool
Description: Tool with version requirement
Python Version: 3.9
"""

def versioned():
    pass
`;

        const metadata = parsePythonMeta(source);

        expect(metadata?.pythonVersion).toBe('3.9');
    });

    it('should parse dependencies list', () => {
        const source = `
"""
MCP Tool: deps-tool
Description: Tool with dependencies
Dependencies: numpy, pandas, requests
"""

def with_deps():
    pass
`;

        const metadata = parsePythonMeta(source);

        expect(metadata?.dependencies).toEqual(['numpy', 'pandas', 'requests']);
    });
});

// ============================================================================
// extractFunctionName Tests
// ============================================================================

describe('extractFunctionName', () => {
    it('should extract function name from def statement', () => {
        const source = `
def my_function(arg1, arg2):
    return arg1 + arg2
`;

        const name = extractFunctionName(source);

        expect(name).toBe('my_function');
    });

    it('should extract async function name', () => {
        const source = `
async def async_handler(data):
    await process(data)
`;

        const name = extractFunctionName(source);

        expect(name).toBe('async_handler');
    });

    it('should return null if no function found', () => {
        const source = `
# Just a comment
import os
`;

        const name = extractFunctionName(source);

        expect(name).toBeNull();
    });
});

// ============================================================================
// extractPythonImports Tests
// ============================================================================

describe('extractPythonImports', () => {
    it('should extract simple imports', () => {
        const source = `
import os
import json
import requests
`;

        const imports = extractPythonImports(source);

        expect(imports).toContain('os');
        expect(imports).toContain('json');
        expect(imports).toContain('requests');
    });

    it('should extract from imports', () => {
        const source = `
from flask import Flask, request
from datetime import datetime
from pandas import DataFrame
`;

        const imports = extractPythonImports(source);

        expect(imports).toContain('flask');
        expect(imports).toContain('datetime');
        expect(imports).toContain('pandas');
    });

    it('should extract top-level module from nested imports', () => {
        const source = `
from sklearn.model_selection import train_test_split
from tensorflow.keras.layers import Dense
`;

        const imports = extractPythonImports(source);

        expect(imports).toContain('sklearn');
        expect(imports).toContain('tensorflow');
    });

    it('should not duplicate imports', () => {
        const source = `
import requests
from requests import get
from requests.auth import HTTPBasicAuth
`;

        const imports = extractPythonImports(source);

        expect(imports.filter(i => i === 'requests')).toHaveLength(1);
    });
});

// ============================================================================
// isStandardLibrary Tests
// ============================================================================

describe('isStandardLibrary', () => {
    it('should identify standard library modules', () => {
        expect(isStandardLibrary('os')).toBe(true);
        expect(isStandardLibrary('sys')).toBe(true);
        expect(isStandardLibrary('json')).toBe(true);
        expect(isStandardLibrary('datetime')).toBe(true);
        expect(isStandardLibrary('collections')).toBe(true);
        expect(isStandardLibrary('asyncio')).toBe(true);
        expect(isStandardLibrary('pathlib')).toBe(true);
        expect(isStandardLibrary('typing')).toBe(true);
    });

    it('should identify third-party modules', () => {
        expect(isStandardLibrary('requests')).toBe(false);
        expect(isStandardLibrary('numpy')).toBe(false);
        expect(isStandardLibrary('pandas')).toBe(false);
        expect(isStandardLibrary('flask')).toBe(false);
    });
});

// ============================================================================
// loadPythonTool Tests
// ============================================================================

describe('loadPythonTool', () => {
    beforeEach(() => {
        Object.keys(mockFiles).forEach(key => delete mockFiles[key]);
        Object.keys(mockDirs).forEach(key => delete mockDirs[key]);
    });

    it('should load a Python tool from file', () => {
        mockFiles['/test/tool.py'] = `
"""
MCP Tool: test-tool
Description: A test tool

Input Schema:
{
  "type": "object",
  "properties": {
    "message": {"type": "string"}
  }
}
"""

def test_tool(message: str) -> dict:
    return {"echo": message}
`;

        const tool = loadPythonTool('/test/tool.py');

        expect(tool).not.toBeNull();
        expect(tool?.meta.name).toBe('test-tool');
        expect(tool?.meta.description).toBe('A test tool');
        expect(tool?.functionName).toBe('test_tool');
        expect(tool?.path).toBe('/test/tool.py');
    });

    it('should return null for non-existent file', () => {
        const tool = loadPythonTool('/nonexistent.py');

        expect(tool).toBeNull();
    });

    it('should return null for file without MCP metadata', () => {
        mockFiles['/test/regular.py'] = `
"""Regular Python file."""

def regular_func():
    pass
`;

        const tool = loadPythonTool('/test/regular.py');

        expect(tool).toBeNull();
    });
});

// ============================================================================
// scanPythonTools Tests
// ============================================================================

describe('scanPythonTools', () => {
    beforeEach(() => {
        Object.keys(mockFiles).forEach(key => delete mockFiles[key]);
        Object.keys(mockDirs).forEach(key => delete mockDirs[key]);
    });

    it('should scan directory for Python tools', () => {
        mockDirs['/tools'] = ['tool1.py', 'tool2.py', 'helper.js'];

        mockFiles['/tools/tool1.py'] = `
"""
MCP Tool: tool-1
Description: First tool
"""
def tool_1():
    pass
`;
        mockFiles['/tools/tool2.py'] = `
"""
MCP Tool: tool-2
Description: Second tool
"""
def tool_2():
    pass
`;

        const tools = scanPythonTools('/tools');

        expect(tools).toHaveLength(2);
        expect(tools.map(t => t.meta.name)).toContain('tool-1');
        expect(tools.map(t => t.meta.name)).toContain('tool-2');
    });

    it('should return empty array for non-existent directory', () => {
        const tools = scanPythonTools('/nonexistent');

        expect(tools).toHaveLength(0);
    });

    it('should skip files without MCP metadata', () => {
        mockDirs['/tools'] = ['mcp_tool.py', 'regular.py'];

        mockFiles['/tools/mcp_tool.py'] = `
"""
MCP Tool: mcp-tool
Description: MCP tool
"""
def mcp_tool():
    pass
`;
        mockFiles['/tools/regular.py'] = `
"""Regular file."""
def regular():
    pass
`;

        const tools = scanPythonTools('/tools');

        expect(tools).toHaveLength(1);
        expect(tools[0]?.meta.name).toBe('mcp-tool');
    });
});

// ============================================================================
// generateRequirementsTxt Tests
// ============================================================================

describe('generateRequirementsTxt', () => {
    it('should generate requirements from tool dependencies', () => {
        const tools: PythonToolDefinition[] = [
            {
                path: '/test/tool1.py',
                meta: {
                    name: 'tool-1',
                    description: 'Tool 1',
                    inputSchema: {},
                    dependencies: ['numpy', 'pandas'],
                },
                functionName: 'tool_1',
                source: 'def tool_1(): pass',
            },
            {
                path: '/test/tool2.py',
                meta: {
                    name: 'tool-2',
                    description: 'Tool 2',
                    inputSchema: {},
                    dependencies: ['requests'],
                },
                functionName: 'tool_2',
                source: 'def tool_2(): pass',
            },
        ];

        const requirements = generateRequirementsTxt(tools);

        expect(requirements).toContain('numpy');
        expect(requirements).toContain('pandas');
        expect(requirements).toContain('requests');
    });

    it('should extract imports from source code', () => {
        const tools: PythonToolDefinition[] = [
            {
                path: '/test/tool.py',
                meta: {
                    name: 'tool',
                    description: 'Tool',
                    inputSchema: {},
                },
                functionName: 'tool',
                source: `
import flask
from sklearn.model_selection import train_test_split
import json
`,
            },
        ];

        const requirements = generateRequirementsTxt(tools);

        expect(requirements).toContain('flask');
        expect(requirements).toContain('sklearn');
        // Should not include stdlib
        expect(requirements).not.toContain('json');
    });

    it('should deduplicate dependencies', () => {
        const tools: PythonToolDefinition[] = [
            {
                path: '/test/tool.py',
                meta: {
                    name: 'tool',
                    description: 'Tool',
                    inputSchema: {},
                    dependencies: ['numpy'],
                },
                functionName: 'tool',
                source: 'import numpy\ndef tool(): pass',
            },
        ];

        const requirements = generateRequirementsTxt(tools);
        const lines = requirements.split('\n').filter(l => l);

        expect(lines.filter(l => l === 'numpy')).toHaveLength(1);
    });
});

// ============================================================================
// PythonBridge Tests
// ============================================================================

describe('PythonBridge', () => {
    let bridge: PythonBridge;

    beforeEach(() => {
        bridge = new PythonBridge({
            pythonPath: '/usr/bin/python3',
            timeout: 5000,
        });
        mockSpawn.mockReset();
    });

    describe('executeTool', () => {
        it('should execute a Python tool successfully', async () => {
            const mockProc = createMockProcess(
                '{"success": true, "result": {"count": 42}}'
            );
            mockSpawn.mockReturnValue(mockProc);

            const tool: PythonToolDefinition = {
                path: '/test/tool.py',
                meta: {
                    name: 'counter',
                    description: 'Counter tool',
                    inputSchema: {},
                },
                functionName: 'count',
                source: 'def count(value): return {"count": value * 2}',
            };

            const result = await bridge.executeTool(tool, { value: 21 });

            expect(result.success).toBe(true);
            expect(result.result).toEqual({ count: 42 });
        });

        it('should handle execution errors', async () => {
            const mockProc = createMockProcess(
                '',
                'ValueError: invalid input',
                1
            );
            mockSpawn.mockReturnValue(mockProc);

            const tool: PythonToolDefinition = {
                path: '/test/tool.py',
                meta: {
                    name: 'broken',
                    description: 'Broken tool',
                    inputSchema: {},
                },
                functionName: 'broken',
                source: 'def broken(): raise ValueError("invalid")',
            };

            const result = await bridge.executeTool(tool, {});

            expect(result.success).toBe(false);
            expect(result.error).toContain('invalid input');
        });

        it('should handle timeout', async () => {
            jest.useFakeTimers();

            const mockProc = {
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn(),
                kill: jest.fn(),
            };
            mockSpawn.mockReturnValue(mockProc);

            const tool: PythonToolDefinition = {
                path: '/test/tool.py',
                meta: { name: 'slow', description: 'Slow tool', inputSchema: {} },
                functionName: 'slow',
                source: 'import time\ndef slow(): time.sleep(100)',
            };

            const resultPromise = bridge.executeTool(tool, {});

            // Advance timers to trigger timeout
            jest.advanceTimersByTime(6000);

            // Trigger the close event after kill
            const closeCallback = mockProc.on.mock.calls.find(
                (call: [string, () => void]) => call[0] === 'close'
            )?.[1];
            if (closeCallback) closeCallback(null);

            const result = await resultPromise;

            expect(mockProc.kill).toHaveBeenCalled();
            expect(result.success).toBe(false);
            expect(result.error).toContain('timed out');

            jest.useRealTimers();
        });
    });

    describe('checkPython', () => {
        it('should verify Python installation', async () => {
            const mockProc = createMockProcess('Python 3.11.0');
            mockSpawn.mockReturnValue(mockProc);

            const result = await bridge.checkPython();

            expect(result.available).toBe(true);
            expect(result.version).toBe('3.11.0');
        });

        it('should handle missing Python', async () => {
            const mockProc = {
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn((event: string, callback: (err: Error) => void) => {
                    if (event === 'error') {
                        setTimeout(() => callback(new Error('ENOENT')), 0);
                    }
                }),
                kill: jest.fn(),
            };
            mockSpawn.mockReturnValue(mockProc);

            const result = await bridge.checkPython();

            expect(result.available).toBe(false);
        });
    });
});

// ============================================================================
// MultiLangToolRegistry Tests
// ============================================================================

describe('MultiLangToolRegistry', () => {
    let registry: MultiLangToolRegistry;

    beforeEach(() => {
        registry = new MultiLangToolRegistry({
            pythonPath: '/usr/bin/python3',
            timeout: 5000,
        });
        mockSpawn.mockReset();
    });

    it('should register TypeScript tool', () => {
        registry.registerTypescriptTool(
            'ts-tool',
            '/test/tool.ts',
            { description: 'TypeScript tool' },
            async (args) => ({ processed: args })
        );

        const tool = registry.getTool('ts-tool');

        expect(tool).toBeDefined();
        expect(tool?.language).toBe('typescript');
        expect(tool?.name).toBe('ts-tool');
    });

    it('should register Python tool', () => {
        const pythonTool: PythonToolDefinition = {
            path: '/test/tool.py',
            meta: {
                name: 'py-tool',
                description: 'Python tool',
                inputSchema: {},
            },
            functionName: 'py_tool',
            source: 'def py_tool(): pass',
        };

        registry.registerPythonTool(pythonTool);

        const tool = registry.getTool('py-tool');

        expect(tool).toBeDefined();
        expect(tool?.language).toBe('python');
        expect(tool?.name).toBe('py-tool');
    });

    it('should list all tools', () => {
        registry.registerTypescriptTool(
            'ts-tool',
            '/test/ts.ts',
            {},
            async () => ({})
        );

        const pythonTool: PythonToolDefinition = {
            path: '/test/py.py',
            meta: { name: 'py-tool', description: '', inputSchema: {} },
            functionName: 'py',
            source: 'def py(): pass',
        };
        registry.registerPythonTool(pythonTool);

        const tools = registry.listTools();

        expect(tools).toHaveLength(2);
    });

    it('should get correct stats', () => {
        registry.registerTypescriptTool('ts1', '', {}, async () => ({}));
        registry.registerTypescriptTool('ts2', '', {}, async () => ({}));

        const pyTool: PythonToolDefinition = {
            path: '',
            meta: { name: 'py1', description: '', inputSchema: {} },
            functionName: 'py',
            source: '',
        };
        registry.registerPythonTool(pyTool);

        const stats = registry.getStats();

        expect(stats.total).toBe(3);
        expect(stats.typescript).toBe(2);
        expect(stats.python).toBe(1);
    });

    it('should execute TypeScript tool', async () => {
        registry.registerTypescriptTool(
            'echo',
            '/test/echo.ts',
            {},
            async (args) => ({ echo: args })
        );

        const result = await registry.executeTool('echo', { message: 'hello' });

        expect(result).toEqual({ echo: { message: 'hello' } });
    });

    it('should throw for unknown tool', async () => {
        await expect(
            registry.executeTool('nonexistent', {})
        ).rejects.toThrow('Tool not found: nonexistent');
    });
});

// ============================================================================
// hasPythonTools Tests
// ============================================================================

describe('hasPythonTools', () => {
    beforeEach(() => {
        Object.keys(mockFiles).forEach(key => delete mockFiles[key]);
        Object.keys(mockDirs).forEach(key => delete mockDirs[key]);
    });

    it('should return true if Python files exist', () => {
        mockDirs['/tools'] = ['tool.py', 'helper.ts'];

        expect(hasPythonTools('/tools')).toBe(true);
    });

    it('should return false if no Python files', () => {
        mockDirs['/tools'] = ['tool.ts', 'helper.js'];

        expect(hasPythonTools('/tools')).toBe(false);
    });

    it('should return false for non-existent directory', () => {
        expect(hasPythonTools('/nonexistent')).toBe(false);
    });
});

// ============================================================================
// generatePythonDockerfileAdditions Tests
// ============================================================================

describe('generatePythonDockerfileAdditions', () => {
    it('should generate Dockerfile additions for Python tools', () => {
        const tools: PythonToolDefinition[] = [
            {
                path: '/test/tool.py',
                meta: {
                    name: 'tool',
                    description: 'Tool',
                    inputSchema: {},
                    dependencies: ['numpy'],
                },
                functionName: 'tool',
                source: 'import requests\ndef tool(): pass',
            },
        ];

        const additions = generatePythonDockerfileAdditions(tools);

        expect(additions).toContain('python3');
        expect(additions).toContain('pip3');
        expect(additions).toContain('requirements.txt');
        expect(additions).toContain('COPY tools/*.py');
    });

    it('should return empty string for no tools', () => {
        const additions = generatePythonDockerfileAdditions([]);

        expect(additions).toBe('');
    });
});
