/**
 * Python Tool Loader
 * 
 * Provides support for loading and executing Python tools
 * alongside TypeScript tools in MCP servers.
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export interface PythonToolMeta {
    /** Tool name */
    name: string;
    /** Tool description */
    description: string;
    /** Input JSON schema */
    inputSchema: Record<string, unknown>;
    /** Optional output schema */
    outputSchema?: Record<string, unknown>;
    /** Python version requirement */
    pythonVersion?: string;
    /** Required pip packages */
    dependencies?: string[];
}

export interface PythonToolDefinition {
    /** Path to Python file */
    path: string;
    /** Parsed metadata */
    meta: PythonToolMeta;
    /** Function name to call */
    functionName: string;
    /** Raw Python source */
    source: string;
}

export interface PythonExecutionResult {
    success: boolean;
    result?: unknown;
    error?: string;
    stdout?: string;
    stderr?: string;
    duration: number;
}

export interface PythonBridgeConfig {
    /** Python executable path */
    pythonPath: string;
    /** Working directory */
    workDir: string;
    /** Timeout in ms */
    timeout: number;
    /** Enable debug output */
    debug: boolean;
}

// ============================================================================
// Python Metadata Parser
// ============================================================================

/**
 * Parse Python docstring for MCP tool metadata
 */
export function parsePythonMeta(source: string): PythonToolMeta | null {
    // Look for MCP metadata in docstring
    // Format:
    // """
    // MCP Tool: tool-name
    // Description: Tool description
    // 
    // Input Schema:
    // {
    //   "type": "object",
    //   "properties": { ... }
    // }
    // """

    const docstringMatch = source.match(/^["']{3}([\s\S]*?)["']{3}/m);
    if (!docstringMatch || !docstringMatch[1]) {
        return null;
    }

    const docstring = docstringMatch[1];

    // Parse name
    const nameMatch = docstring.match(/MCP Tool:\s*(.+)/i);
    const name = nameMatch?.[1]?.trim() ?? '';

    if (!name) {
        return null;
    }

    // Parse description
    const descMatch = docstring.match(/Description:\s*(.+)/i);
    const description = descMatch?.[1]?.trim() ?? '';

    // Parse input schema (JSON block after "Input Schema:")
    let inputSchema: Record<string, unknown> = { type: 'object' };
    // Match from "Input Schema:" to the closing brace, allowing multi-line
    const schemaMatch = docstring.match(/Input Schema:\s*([\s\S]*)/i);
    if (schemaMatch && schemaMatch[1]) {
        // Find the JSON object within the remainder
        const jsonContent = schemaMatch[1].trim();
        // Try to extract a complete JSON object
        let braceCount = 0;
        let jsonEnd = -1;
        for (let i = 0; i < jsonContent.length; i++) {
            if (jsonContent[i] === '{') braceCount++;
            else if (jsonContent[i] === '}') {
                braceCount--;
                if (braceCount === 0) {
                    jsonEnd = i + 1;
                    break;
                }
            }
        }
        if (jsonEnd > 0) {
            try {
                inputSchema = JSON.parse(jsonContent.substring(0, jsonEnd));
            } catch {
                // Invalid JSON, use default
            }
        }
    }

    // Parse Python version
    const pythonMatch = docstring.match(/Python Version:\s*(.+)/i);
    const pythonVersion = pythonMatch?.[1]?.trim();

    // Parse dependencies
    const depsMatch = docstring.match(/Dependencies:\s*(.+)/i);
    const dependencies = depsMatch?.[1]?.split(',').map(d => d.trim()).filter(Boolean);

    return {
        name,
        description,
        inputSchema,
        pythonVersion,
        dependencies,
    };
}

/**
 * Extract function name from Python source
 */
export function extractFunctionName(source: string): string | null {
    // Look for async def or def followed by function name
    const funcMatch = source.match(/(?:async\s+)?def\s+(\w+)\s*\(/);
    return funcMatch?.[1] ?? null;
}

/**
 * Extract imports from Python source
 */
export function extractPythonImports(source: string): string[] {
    const imports: string[] = [];

    // Match "import x" and "from x import y"
    const importRegex = /^(?:from\s+(\S+)|import\s+(\S+))/gm;
    let match;

    while ((match = importRegex.exec(source)) !== null) {
        const module = match[1] || match[2];
        if (!module) continue;
        // Get top-level module name
        const topLevel = module.split('.')[0];
        if (topLevel && !imports.includes(topLevel)) {
            imports.push(topLevel);
        }
    }

    return imports;
}

/**
 * Check if import is from standard library
 */
export function isStandardLibrary(module: string): boolean {
    const stdLibModules = new Set([
        'abc', 'aifc', 'argparse', 'array', 'ast', 'asynchat', 'asyncio',
        'asyncore', 'atexit', 'audioop', 'base64', 'bdb', 'binascii', 'binhex',
        'bisect', 'builtins', 'bz2', 'calendar', 'cgi', 'cgitb', 'chunk',
        'cmath', 'cmd', 'code', 'codecs', 'codeop', 'collections', 'colorsys',
        'compileall', 'concurrent', 'configparser', 'contextlib', 'contextvars',
        'copy', 'copyreg', 'cProfile', 'crypt', 'csv', 'ctypes', 'curses',
        'dataclasses', 'datetime', 'dbm', 'decimal', 'difflib', 'dis', 'distutils',
        'doctest', 'email', 'encodings', 'enum', 'errno', 'faulthandler', 'fcntl',
        'filecmp', 'fileinput', 'fnmatch', 'fractions', 'ftplib', 'functools',
        'gc', 'getopt', 'getpass', 'gettext', 'glob', 'graphlib', 'grp', 'gzip',
        'hashlib', 'heapq', 'hmac', 'html', 'http', 'idlelib', 'imaplib', 'imghdr',
        'imp', 'importlib', 'inspect', 'io', 'ipaddress', 'itertools', 'json',
        'keyword', 'lib2to3', 'linecache', 'locale', 'logging', 'lzma', 'mailbox',
        'mailcap', 'marshal', 'math', 'mimetypes', 'mmap', 'modulefinder', 'multiprocessing',
        'netrc', 'nis', 'nntplib', 'numbers', 'operator', 'optparse', 'os', 'ossaudiodev',
        'pathlib', 'pdb', 'pickle', 'pickletools', 'pipes', 'pkgutil', 'platform',
        'plistlib', 'poplib', 'posix', 'posixpath', 'pprint', 'profile', 'pstats',
        'pty', 'pwd', 'py_compile', 'pyclbr', 'pydoc', 'queue', 'quopri', 'random',
        're', 'readline', 'reprlib', 'resource', 'rlcompleter', 'runpy', 'sched',
        'secrets', 'select', 'selectors', 'shelve', 'shlex', 'shutil', 'signal',
        'site', 'smtpd', 'smtplib', 'sndhdr', 'socket', 'socketserver', 'spwd',
        'sqlite3', 'ssl', 'stat', 'statistics', 'string', 'stringprep', 'struct',
        'subprocess', 'sunau', 'symtable', 'sys', 'sysconfig', 'syslog', 'tabnanny',
        'tarfile', 'telnetlib', 'tempfile', 'termios', 'test', 'textwrap', 'threading',
        'time', 'timeit', 'tkinter', 'token', 'tokenize', 'trace', 'traceback',
        'tracemalloc', 'tty', 'turtle', 'turtledemo', 'types', 'typing', 'unicodedata',
        'unittest', 'urllib', 'uu', 'uuid', 'venv', 'warnings', 'wave', 'weakref',
        'webbrowser', 'winreg', 'winsound', 'wsgiref', 'xdrlib', 'xml', 'xmlrpc',
        'zipapp', 'zipfile', 'zipimport', 'zlib', 'zoneinfo',
    ]);

    return stdLibModules.has(module);
}

// ============================================================================
// Python Tool Loader
// ============================================================================

/**
 * Load Python tool definition from file
 */
export function loadPythonTool(filePath: string): PythonToolDefinition | null {
    if (!fs.existsSync(filePath)) {
        return null;
    }

    const source = fs.readFileSync(filePath, 'utf-8');
    const meta = parsePythonMeta(source);

    if (!meta) {
        return null;
    }

    const functionName = extractFunctionName(source) || meta.name.replace(/-/g, '_');

    return {
        path: filePath,
        meta,
        functionName,
        source,
    };
}

/**
 * Scan directory for Python tools
 */
export function scanPythonTools(dir: string): PythonToolDefinition[] {
    const tools: PythonToolDefinition[] = [];

    if (!fs.existsSync(dir)) {
        return tools;
    }

    const files = fs.readdirSync(dir);

    for (const file of files) {
        if (!file.endsWith('.py')) continue;

        const filePath = path.join(dir, file);
        const tool = loadPythonTool(filePath);

        if (tool) {
            tools.push(tool);
        }
    }

    return tools;
}

// ============================================================================
// Requirements Generator
// ============================================================================

/**
 * Generate requirements.txt from Python tools
 */
export function generateRequirementsTxt(tools: PythonToolDefinition[]): string {
    const allDependencies = new Set<string>();

    for (const tool of tools) {
        // Add declared dependencies
        if (tool.meta.dependencies) {
            for (const dep of tool.meta.dependencies) {
                allDependencies.add(dep);
            }
        }

        // Scan source for imports
        const imports = extractPythonImports(tool.source);
        for (const imp of imports) {
            if (!isStandardLibrary(imp)) {
                allDependencies.add(imp);
            }
        }
    }

    return Array.from(allDependencies).sort().join('\n') + '\n';
}

// ============================================================================
// Python Bridge
// ============================================================================

/**
 * Bridge for executing Python code from Node.js
 */
export class PythonBridge extends EventEmitter {
    private config: PythonBridgeConfig;
    // Reserved for future use - persistent process mode
    private _process: ChildProcess | null = null;
    private _ready: boolean = false;

    constructor(config: Partial<PythonBridgeConfig> = {}) {
        super();
        this.config = {
            pythonPath: config.pythonPath ?? 'python3',
            workDir: config.workDir ?? process.cwd(),
            timeout: config.timeout ?? 30000,
            debug: config.debug ?? false,
        };
        // Suppress unused variable warnings for future use
        void this._process;
        void this._ready;
    }

    /**
     * Execute a Python tool
     */
    async executeTool(
        tool: PythonToolDefinition,
        args: unknown
    ): Promise<PythonExecutionResult> {
        const startTime = Date.now();

        // Generate execution script
        const script = this.generateExecutionScript(tool, args);

        return this.executeScript(script, startTime);
    }

    /**
     * Generate Python script for tool execution
     */
    private generateExecutionScript(tool: PythonToolDefinition, args: unknown): string {
        const argsJson = JSON.stringify(args);

        return `
import sys
import json

# Tool source
${tool.source}

# Execute tool
if __name__ == '__main__':
    try:
        args = json.loads('''${argsJson}''')
        result = ${tool.functionName}(**args) if isinstance(args, dict) else ${tool.functionName}(args)
        
        # Handle async functions
        import asyncio
        if asyncio.iscoroutine(result):
            result = asyncio.get_event_loop().run_until_complete(result)
        
        print(json.dumps({"success": True, "result": result}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
`;
    }

    /**
     * Execute a Python script
     */
    private executeScript(script: string, startTime: number): Promise<PythonExecutionResult> {
        return new Promise((resolve) => {
            let stdout = '';
            let stderr = '';
            let timedOut = false;

            const proc = spawn(this.config.pythonPath, ['-c', script], {
                cwd: this.config.workDir,
                env: { ...process.env, PYTHONUNBUFFERED: '1' },
            });

            const timeout = setTimeout(() => {
                timedOut = true;
                proc.kill('SIGTERM');
            }, this.config.timeout);

            proc.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            proc.stderr.on('data', (data) => {
                stderr += data.toString();
                if (this.config.debug) {
                    console.error('[PythonBridge stderr]', data.toString());
                }
            });

            proc.on('close', (code) => {
                clearTimeout(timeout);
                const duration = Date.now() - startTime;

                if (timedOut) {
                    resolve({
                        success: false,
                        error: `Python execution timed out after ${this.config.timeout}ms`,
                        stdout,
                        stderr,
                        duration,
                    });
                    return;
                }

                if (code !== 0) {
                    resolve({
                        success: false,
                        error: stderr || `Python process exited with code ${code}`,
                        stdout,
                        stderr,
                        duration,
                    });
                    return;
                }

                try {
                    // Parse JSON output from Python
                    const output = stdout.trim().split('\n').pop() || '{}';
                    const result = JSON.parse(output);

                    resolve({
                        success: result.success,
                        result: result.result,
                        error: result.error,
                        stdout,
                        stderr,
                        duration,
                    });
                } catch {
                    resolve({
                        success: false,
                        error: 'Failed to parse Python output',
                        stdout,
                        stderr,
                        duration,
                    });
                }
            });

            proc.on('error', (error) => {
                clearTimeout(timeout);
                resolve({
                    success: false,
                    error: `Failed to spawn Python process: ${error.message}`,
                    duration: Date.now() - startTime,
                });
            });
        });
    }

    /**
     * Check if Python is available
     */
    async checkPython(): Promise<{ available: boolean; version?: string; error?: string }> {
        return new Promise((resolve) => {
            const proc = spawn(this.config.pythonPath, ['--version']);
            let output = '';

            proc.stdout.on('data', (data) => {
                output += data.toString();
            });

            proc.stderr.on('data', (data) => {
                output += data.toString();
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    const version = output.trim().replace('Python ', '');
                    resolve({ available: true, version });
                } else {
                    resolve({ available: false, error: 'Python not available' });
                }
            });

            proc.on('error', (error) => {
                resolve({ available: false, error: error.message });
            });
        });
    }
}

// ============================================================================
// Multi-Language Tool Registry
// ============================================================================

export interface MultiLangTool {
    name: string;
    language: 'typescript' | 'python';
    path: string;
    meta: Record<string, unknown>;
    handler: (args: unknown) => Promise<unknown>;
}

/**
 * Registry that handles both TypeScript and Python tools
 */
export class MultiLangToolRegistry {
    private tools: Map<string, MultiLangTool> = new Map();
    private pythonBridge: PythonBridge;

    constructor(pythonConfig: Partial<PythonBridgeConfig> = {}) {
        this.pythonBridge = new PythonBridge(pythonConfig);
    }

    /**
     * Register a TypeScript tool
     */
    registerTypescriptTool(
        name: string,
        path: string,
        meta: Record<string, unknown>,
        handler: (args: unknown) => Promise<unknown>
    ): void {
        this.tools.set(name, {
            name,
            language: 'typescript',
            path,
            meta,
            handler,
        });
    }

    /**
     * Register a Python tool
     */
    registerPythonTool(tool: PythonToolDefinition): void {
        const handler = async (args: unknown) => {
            const result = await this.pythonBridge.executeTool(tool, args);
            if (!result.success) {
                throw new Error(result.error || 'Python tool execution failed');
            }
            return result.result;
        };

        this.tools.set(tool.meta.name, {
            name: tool.meta.name,
            language: 'python',
            path: tool.path,
            meta: tool.meta as unknown as Record<string, unknown>,
            handler,
        });
    }

    /**
     * Get a tool by name
     */
    getTool(name: string): MultiLangTool | undefined {
        return this.tools.get(name);
    }

    /**
     * List all tools
     */
    listTools(): MultiLangTool[] {
        return Array.from(this.tools.values());
    }

    /**
     * Execute a tool by name
     */
    async executeTool(name: string, args: unknown): Promise<unknown> {
        const tool = this.tools.get(name);
        if (!tool) {
            throw new Error(`Tool not found: ${name}`);
        }
        return tool.handler(args);
    }

    /**
     * Get tool statistics
     */
    getStats(): { total: number; typescript: number; python: number } {
        const tools = this.listTools();
        return {
            total: tools.length,
            typescript: tools.filter(t => t.language === 'typescript').length,
            python: tools.filter(t => t.language === 'python').length,
        };
    }

    /**
     * Check Python availability
     */
    async checkPython(): Promise<{ available: boolean; version?: string }> {
        return this.pythonBridge.checkPython();
    }
}

// ============================================================================
// Dockerfile Generator Utilities
// ============================================================================

/**
 * Generate Dockerfile additions for Python support
 */
export function generatePythonDockerfileAdditions(tools: PythonToolDefinition[]): string {
    if (tools.length === 0) {
        return '';
    }

    // Generate requirements.txt content for later use
    const _requirements = generateRequirementsTxt(tools);
    void _requirements; // Will be used when writing requirements.txt file

    return `
# Python runtime for polyglot tools
RUN apt-get update && apt-get install -y python3 python3-pip && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt /app/requirements.txt
RUN pip3 install --no-cache-dir -r /app/requirements.txt

# Copy Python tools
COPY tools/*.py /app/tools/
`;
}

/**
 * Check if project has Python tools
 */
export function hasPythonTools(toolsDir: string): boolean {
    if (!fs.existsSync(toolsDir)) {
        return false;
    }

    const files = fs.readdirSync(toolsDir);
    return files.some(f => f.endsWith('.py'));
}
