/**
 * Test Harness for MCP Servers
 * 
 * Provides utilities for testing generated MCP servers including:
 * - Container lifecycle management
 * - Port allocation
 * - Setup/teardown helpers
 */

import * as http from 'http';
import * as net from 'net';

// ============================================================================
// Types
// ============================================================================

export interface TestServerConfig {
    /** Docker image name */
    image: string;
    /** Container name (optional) */
    name?: string;
    /** Port mapping (host:container) */
    port?: number;
    /** Environment variables */
    env?: Record<string, string>;
    /** Volume mounts */
    volumes?: string[];
    /** Startup timeout in ms */
    startupTimeout?: number;
    /** Health check path */
    healthCheckPath?: string;
}

export interface ContainerInfo {
    id: string;
    name: string;
    port: number;
    baseUrl: string;
    status: 'running' | 'stopped' | 'error';
}

export interface TestContext {
    container?: ContainerInfo;
    mcpClient?: MCPTestClient;
    cleanup: () => Promise<void>;
}

// ============================================================================
// Port Management
// ============================================================================

/**
 * Find an available port on the host
 */
export async function findAvailablePort(startPort: number = 10000): Promise<number> {
    return new Promise((resolve, _reject) => {
        const server = net.createServer();
        server.unref();
        server.on('error', () => {
            // Port is in use, try next one
            resolve(findAvailablePort(startPort + 1));
        });
        server.listen(startPort, () => {
            const address = server.address();
            const port = typeof address === 'object' && address ? address.port : startPort;
            server.close(() => {
                resolve(port);
            });
        });
    });
}

/**
 * Wait for a port to become available
 */
export async function waitForPort(
    port: number,
    host: string = 'localhost',
    timeout: number = 30000
): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        try {
            await new Promise<void>((resolve, reject) => {
                const socket = new net.Socket();
                socket.setTimeout(1000);
                socket.on('connect', () => {
                    socket.destroy();
                    resolve();
                });
                socket.on('timeout', () => {
                    socket.destroy();
                    reject(new Error('Connection timeout'));
                });
                socket.on('error', (err) => {
                    socket.destroy();
                    reject(err);
                });
                socket.connect(port, host);
            });
            return true;
        } catch {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    return false;
}

// ============================================================================
// Health Check Utilities
// ============================================================================

/**
 * Wait for server health check to pass
 */
export async function waitForHealthy(
    baseUrl: string,
    healthPath: string = '/health',
    timeout: number = 30000
): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        try {
            const response = await httpGet(`${baseUrl}${healthPath}`);
            if (response.statusCode === 200) {
                return true;
            }
        } catch {
            // Ignore errors, keep trying
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    return false;
}

/**
 * Simple HTTP GET request
 */
function httpGet(url: string): Promise<http.IncomingMessage> {
    return new Promise((resolve, reject) => {
        const request = http.get(url, (response) => {
            resolve(response);
        });
        request.on('error', reject);
        request.setTimeout(5000, () => {
            request.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

// ============================================================================
// MCP Test Client
// ============================================================================

export interface MCPToolInfo {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
}

export interface MCPToolResult {
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
}

export interface MCPCapabilities {
    tools?: { listChanged?: boolean };
    resources?: { subscribe?: boolean; listChanged?: boolean };
    prompts?: { listChanged?: boolean };
}

export interface MCPServerInfo {
    name: string;
    version: string;
}

export interface MCPInitializeResult {
    protocolVersion: string;
    capabilities: MCPCapabilities;
    serverInfo: MCPServerInfo;
}

/**
 * MCP Protocol Test Client
 */
export class MCPTestClient {
    private baseUrl: string;
    private mcpPath: string;
    private requestId: number = 0;
    private initialized: boolean = false;

    constructor(baseUrl: string, mcpPath: string = '/mcp') {
        this.baseUrl = baseUrl;
        this.mcpPath = mcpPath;
    }

    /**
     * Initialize the MCP connection
     */
    async initialize(): Promise<MCPInitializeResult> {
        const response = await this.sendRequest('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
                name: 'mcp-test-client',
                version: '1.0.0',
            },
        });

        // Send initialized notification
        await this.sendRequest('notifications/initialized', {});

        this.initialized = true;
        return response as MCPInitializeResult;
    }

    /**
     * List available tools
     */
    async listTools(): Promise<MCPToolInfo[]> {
        this.ensureInitialized();
        const response = await this.sendRequest('tools/list', {});
        return (response as { tools: MCPToolInfo[] }).tools;
    }

    /**
     * Call a tool
     */
    async callTool(name: string, args: unknown = {}): Promise<MCPToolResult> {
        this.ensureInitialized();
        const response = await this.sendRequest('tools/call', {
            name,
            arguments: args,
        });
        return response as MCPToolResult;
    }

    /**
     * List available resources
     */
    async listResources(): Promise<unknown[]> {
        this.ensureInitialized();
        const response = await this.sendRequest('resources/list', {});
        return (response as { resources: unknown[] }).resources;
    }

    /**
     * List available prompts
     */
    async listPrompts(): Promise<unknown[]> {
        this.ensureInitialized();
        const response = await this.sendRequest('prompts/list', {});
        return (response as { prompts: unknown[] }).prompts;
    }

    /**
     * Send a raw JSON-RPC request
     */
    async sendRequest(method: string, params: unknown): Promise<unknown> {
        const requestId = ++this.requestId;

        const body = JSON.stringify({
            jsonrpc: '2.0',
            id: requestId,
            method,
            params,
        });

        const response = await this.httpPost(`${this.baseUrl}${this.mcpPath}`, body);

        if (response.error) {
            throw new MCPError(response.error.code, response.error.message, response.error.data);
        }

        return response.result;
    }

    /**
     * HTTP POST request
     */
    private httpPost(url: string, body: string): Promise<{ result?: unknown; error?: { code: number; message: string; data?: unknown } }> {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);

            const options: http.RequestOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port || 80,
                path: urlObj.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                },
            };

            const request = http.request(options, (response) => {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch {
                        reject(new Error(`Invalid JSON response: ${data}`));
                    }
                });
            });

            request.on('error', reject);
            request.setTimeout(30000, () => {
                request.destroy();
                reject(new Error('Request timeout'));
            });

            request.write(body);
            request.end();
        });
    }

    private ensureInitialized(): void {
        if (!this.initialized) {
            throw new Error('Client not initialized. Call initialize() first.');
        }
    }
}

/**
 * MCP Error class
 */
export class MCPError extends Error {
    code: number;
    data?: unknown;

    constructor(code: number, message: string, data?: unknown) {
        super(message);
        this.name = 'MCPError';
        this.code = code;
        this.data = data;
    }
}

// ============================================================================
// Test Harness Class
// ============================================================================

export class TestHarness {
    private contexts: TestContext[] = [];

    /**
     * Create a test context for a server (without Docker dependency)
     */
    async createContext(port: number): Promise<TestContext> {
        const baseUrl = `http://localhost:${port}`;
        const mcpClient = new MCPTestClient(baseUrl);

        const context: TestContext = {
            container: {
                id: 'local',
                name: 'local-server',
                port,
                baseUrl,
                status: 'running',
            },
            mcpClient,
            cleanup: async () => {
                // No cleanup needed for local server context
            },
        };

        this.contexts.push(context);
        return context;
    }

    /**
     * Wait for all servers to be healthy
     */
    async waitForAllHealthy(timeout: number = 30000): Promise<boolean> {
        const promises = this.contexts.map(async (ctx) => {
            if (ctx.container) {
                return waitForHealthy(ctx.container.baseUrl, '/health', timeout);
            }
            return true;
        });

        const results = await Promise.all(promises);
        return results.every(r => r);
    }

    /**
     * Clean up all test contexts
     */
    async cleanup(): Promise<void> {
        for (const context of this.contexts) {
            try {
                await context.cleanup();
            } catch (error) {
                console.error('Cleanup error:', error);
            }
        }
        this.contexts = [];
    }
}

// ============================================================================
// Exports
// ============================================================================
export default TestHarness;
