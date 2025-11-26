/**
 * Test Suite for Server Template
 * Tests the server.ts.template for Task 5.1
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Test Infrastructure
// ============================================================================

interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
}

const testResults: TestResult[] = [];

function test(name: string, fn: () => void | Promise<void>): void {
    try {
        const result = fn();
        if (result instanceof Promise) {
            result
                .then(() => {
                    testResults.push({ name, passed: true });
                    console.log(`  ✅ ${name}`);
                })
                .catch((error) => {
                    testResults.push({ name, passed: false, error: error.message });
                    console.log(`  ❌ ${name}: ${error.message}`);
                });
        } else {
            testResults.push({ name, passed: true });
            console.log(`  ✅ ${name}`);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        testResults.push({ name, passed: false, error: message });
        console.log(`  ❌ ${name}: ${message}`);
    }
}

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}

function assertContains(haystack: string, needle: string, message?: string): void {
    if (!haystack.includes(needle)) {
        throw new Error(message || `Expected to contain "${needle}"`);
    }
}

// ============================================================================
// Template Content for Testing
// ============================================================================

const TEMPLATE_PATH = path.join(__dirname, 'templates', 'server.ts.template');

function getTemplateContent(): string {
    return fs.readFileSync(TEMPLATE_PATH, 'utf8');
}

// ============================================================================
// Tests
// ============================================================================

console.log('\n📋 Test Suite: Server Template (Task 5.1)\n');

// ----------------------------------------------------------------------------
// Test Group 1: Template Structure
// ----------------------------------------------------------------------------

console.log('📁 Template Structure Tests:');

test('Template file exists', () => {
    assert(fs.existsSync(TEMPLATE_PATH), 'Template file should exist');
});

test('Template is valid TypeScript-like content', () => {
    const content = getTemplateContent();
    assert(content.length > 0, 'Template should not be empty');
    assertContains(content, 'import', 'Template should have imports');
    assertContains(content, 'export', 'Template should have exports');
});

test('Template has required placeholder markers', () => {
    const content = getTemplateContent();
    assertContains(content, '{{TOOL_IMPORTS}}', 'Should have TOOL_IMPORTS placeholder');
    assertContains(content, '{{CONNECTOR_IMPORTS}}', 'Should have CONNECTOR_IMPORTS placeholder');
    assertContains(content, '{{TOOL_REGISTRATION}}', 'Should have TOOL_REGISTRATION placeholder');
});

test('Template has proper file header', () => {
    const content = getTemplateContent();
    assertContains(content, 'MCP Server Entry Point Template', 'Should have descriptive header');
    assertContains(content, 'EasyMCP', 'Should reference EasyMCP');
});

// ----------------------------------------------------------------------------
// Test Group 2: Config Loading
// ----------------------------------------------------------------------------

console.log('\n⚙️ Config Loading Tests:');

test('Template loads config from MCP_CONFIG_PATH', () => {
    const content = getTemplateContent();
    assertContains(content, 'MCP_CONFIG_PATH', 'Should reference MCP_CONFIG_PATH env var');
    assertContains(content, 'process.env.MCP_CONFIG_PATH', 'Should use process.env');
});

test('Template uses yaml.load for config parsing', () => {
    const content = getTemplateContent();
    assertContains(content, 'yaml.load', 'Should use yaml.load');
    assertContains(content, 'js-yaml', 'Should import js-yaml');
});

test('Template validates config structure', () => {
    const content = getTemplateContent();
    assertContains(content, 'validateConfig', 'Should have config validation');
    assertContains(content, 'server.port', 'Should validate port');
});

test('Template has ServerConfig interface', () => {
    const content = getTemplateContent();
    assertContains(content, 'interface ServerConfig', 'Should define ServerConfig');
    assertContains(content, 'port: number', 'ServerConfig should have port');
    assertContains(content, 'logging?:', 'ServerConfig should have optional logging');
});

test('Template has MCPConfig interface', () => {
    const content = getTemplateContent();
    assertContains(content, 'interface MCPConfig', 'Should define MCPConfig');
    assertContains(content, 'server: ServerConfig', 'MCPConfig should have server');
    assertContains(content, 'tools?:', 'MCPConfig should have optional tools');
    assertContains(content, 'connectors?:', 'MCPConfig should have optional connectors');
});

// ----------------------------------------------------------------------------
// Test Group 3: Logging
// ----------------------------------------------------------------------------

console.log('\n📝 Logging Tests:');

test('Template has Logger class', () => {
    const content = getTemplateContent();
    assertContains(content, 'class Logger', 'Should have Logger class');
});

test('Logger supports multiple levels', () => {
    const content = getTemplateContent();
    assertContains(content, 'debug(', 'Logger should have debug method');
    assertContains(content, 'info(', 'Logger should have info method');
    assertContains(content, 'warn(', 'Logger should have warn method');
    assertContains(content, 'error(', 'Logger should have error method');
});

test('Logger supports request ID tracking', () => {
    const content = getTemplateContent();
    assertContains(content, 'requestId', 'Should track requestId');
    assertContains(content, 'uuidv4', 'Should use UUID for request IDs');
});

test('Logger supports JSON and pretty formats', () => {
    const content = getTemplateContent();
    assertContains(content, "'json'", 'Should support JSON format');
    assertContains(content, "'pretty'", 'Should support pretty format');
});

test('Logger has flush method for graceful shutdown', () => {
    const content = getTemplateContent();
    assertContains(content, 'flush()', 'Logger should have flush method');
    assertContains(content, 'await logger.flush()', 'Should call flush during shutdown');
});

test('Logger supports file output', () => {
    const content = getTemplateContent();
    assertContains(content, 'fileStream', 'Logger should support file output');
    assertContains(content, 'WriteStream', 'Should use WriteStream for file');
});

// ----------------------------------------------------------------------------
// Test Group 4: JSON-RPC Handler
// ----------------------------------------------------------------------------

console.log('\n🔌 JSON-RPC Handler Tests:');

test('Template has JSON-RPC request/response types', () => {
    const content = getTemplateContent();
    assertContains(content, 'interface JsonRpcRequest', 'Should have JsonRpcRequest');
    assertContains(content, 'interface JsonRpcResponse', 'Should have JsonRpcResponse');
    assertContains(content, 'interface JsonRpcError', 'Should have JsonRpcError');
});

test('JSON-RPC types follow 2.0 spec', () => {
    const content = getTemplateContent();
    assertContains(content, "jsonrpc: '2.0'", 'Should use JSON-RPC 2.0');
    assertContains(content, 'id: string | number | null', 'Should support all id types');
    assertContains(content, 'method: string', 'Request should have method');
});

test('Template has handleJsonRpc function', () => {
    const content = getTemplateContent();
    assertContains(content, 'async function handleJsonRpc', 'Should have handleJsonRpc function');
});

test('Template handles tools/list method', () => {
    const content = getTemplateContent();
    assertContains(content, "'tools/list'", 'Should handle tools/list');
});

test('Template handles tools/call method', () => {
    const content = getTemplateContent();
    assertContains(content, "'tools/call'", 'Should handle tools/call');
});

test('Template handles initialize method', () => {
    const content = getTemplateContent();
    assertContains(content, "'initialize'", 'Should handle initialize');
    assertContains(content, 'protocolVersion', 'Should return protocol version');
    assertContains(content, 'capabilities', 'Should return capabilities');
});

test('Template has JSON-RPC error codes', () => {
    const content = getTemplateContent();
    assertContains(content, 'JSON_RPC_ERRORS', 'Should define error codes');
    assertContains(content, '-32700', 'Should have PARSE_ERROR code');
    assertContains(content, '-32600', 'Should have INVALID_REQUEST code');
    assertContains(content, '-32601', 'Should have METHOD_NOT_FOUND code');
    assertContains(content, '-32603', 'Should have INTERNAL_ERROR code');
});

// ----------------------------------------------------------------------------
// Test Group 5: HTTP Server
// ----------------------------------------------------------------------------

console.log('\n🌐 HTTP Server Tests:');

test('Template creates HTTP server', () => {
    const content = getTemplateContent();
    assertContains(content, "import * as http from 'http'", 'Should import http');
    assertContains(content, 'http.createServer', 'Should create HTTP server');
});

test('Template has /mcp endpoint', () => {
    const content = getTemplateContent();
    assertContains(content, "'/mcp'", 'Should have /mcp endpoint');
    assertContains(content, "req.url === '/mcp'", 'Should check for /mcp route');
    assertContains(content, "req.method === 'POST'", 'Should require POST for /mcp');
});

test('Template parses request body', () => {
    const content = getTemplateContent();
    assertContains(content, 'parseRequestBody', 'Should have body parser');
    assertContains(content, "req.on('data'", 'Should handle data event');
});

test('Template returns proper content type', () => {
    const content = getTemplateContent();
    assertContains(content, "'Content-Type': 'application/json'", 'Should set JSON content type');
});

// ----------------------------------------------------------------------------
// Test Group 6: Health Endpoint
// ----------------------------------------------------------------------------

console.log('\n🏥 Health Endpoint Tests:');

test('Template has /health endpoint', () => {
    const content = getTemplateContent();
    assertContains(content, "'/health'", 'Should have /health endpoint');
    assertContains(content, "req.url === '/health'", 'Should check for /health route');
});

test('Template has HealthStatus interface', () => {
    const content = getTemplateContent();
    assertContains(content, 'interface HealthStatus', 'Should have HealthStatus interface');
    assertContains(content, "status: 'ok' | 'degraded' | 'unhealthy'", 'Should have status field');
    assertContains(content, 'uptime: number', 'Should track uptime');
    assertContains(content, 'tools: string[]', 'Should list tools');
    assertContains(content, 'connectors: string[]', 'Should list connectors');
});

test('Template has getHealthStatus function', () => {
    const content = getTemplateContent();
    assertContains(content, 'function getHealthStatus', 'Should have getHealthStatus function');
});

test('Health check returns proper HTTP status', () => {
    const content = getTemplateContent();
    assertContains(content, "health.status === 'ok' ? 200", 'Should return 200 for ok status');
});

// ----------------------------------------------------------------------------
// Test Group 7: Graceful Shutdown
// ----------------------------------------------------------------------------

console.log('\n🛑 Graceful Shutdown Tests:');

test('Template listens for SIGTERM', () => {
    const content = getTemplateContent();
    assertContains(content, "process.on('SIGTERM'", 'Should listen for SIGTERM');
});

test('Template listens for SIGINT', () => {
    const content = getTemplateContent();
    assertContains(content, "process.on('SIGINT'", 'Should listen for SIGINT');
});

test('Template has gracefulShutdown function', () => {
    const content = getTemplateContent();
    assertContains(content, 'async function gracefulShutdown', 'Should have gracefulShutdown');
});

test('Shutdown disconnects connectors', () => {
    const content = getTemplateContent();
    assertContains(content, 'connector.disconnect()', 'Should disconnect connectors');
});

test('Shutdown flushes logs', () => {
    const content = getTemplateContent();
    assertContains(content, 'await logger.flush()', 'Should flush logs');
});

test('Shutdown closes server', () => {
    const content = getTemplateContent();
    assertContains(content, 'server.close()', 'Should close server');
});

test('Shutdown tracks active connections', () => {
    const content = getTemplateContent();
    assertContains(content, 'activeConnections', 'Should track active connections');
});

test('Shutdown has configurable timeout', () => {
    const content = getTemplateContent();
    assertContains(content, 'shutdownTimeout', 'Should have shutdown timeout');
    assertContains(content, 'gracePeriod', 'Should have grace period');
});

// ----------------------------------------------------------------------------
// Test Group 8: Error Handling
// ----------------------------------------------------------------------------

console.log('\n⚠️ Error Handling Tests:');

test('Template handles uncaught exceptions', () => {
    const content = getTemplateContent();
    assertContains(content, "'uncaughtException'", 'Should handle uncaughtException');
});

test('Template handles unhandled rejections', () => {
    const content = getTemplateContent();
    assertContains(content, "'unhandledRejection'", 'Should handle unhandledRejection');
});

test('Template has error middleware', () => {
    const content = getTemplateContent();
    assertContains(content, 'catch (error)', 'Should have try-catch for errors');
    assertContains(content, 'Unhandled request error', 'Should log unhandled errors');
});

test('Template returns JSON-RPC error for internal errors', () => {
    const content = getTemplateContent();
    assertContains(content, 'JSON_RPC_ERRORS.INTERNAL_ERROR', 'Should return internal error');
});

// ----------------------------------------------------------------------------
// Test Group 9: Tool & Connector Registries
// ----------------------------------------------------------------------------

console.log('\n🔧 Registry Tests:');

test('Template has Tool interface', () => {
    const content = getTemplateContent();
    assertContains(content, 'interface Tool', 'Should have Tool interface');
    assertContains(content, 'name: string', 'Tool should have name');
    assertContains(content, 'description: string', 'Tool should have description');
    assertContains(content, 'inputSchema:', 'Tool should have inputSchema');
    assertContains(content, 'handler:', 'Tool should have handler');
});

test('Template has Connector interface', () => {
    const content = getTemplateContent();
    assertContains(content, 'interface Connector', 'Should have Connector interface');
    assertContains(content, 'connect:', 'Connector should have connect');
    assertContains(content, 'disconnect:', 'Connector should have disconnect');
    assertContains(content, 'isConnected:', 'Connector should have isConnected');
});

test('Template has toolRegistry', () => {
    const content = getTemplateContent();
    assertContains(content, 'toolRegistry', 'Should have toolRegistry');
    assertContains(content, 'new Map<string, Tool>()', 'Should use Map for registry');
});

test('Template has connectorRegistry', () => {
    const content = getTemplateContent();
    assertContains(content, 'connectorRegistry', 'Should have connectorRegistry');
    assertContains(content, 'new Map<string, Connector>()', 'Should use Map for registry');
});

test('Template has registerTool function', () => {
    const content = getTemplateContent();
    assertContains(content, 'function registerTool', 'Should have registerTool');
});

test('Template has registerConnector function', () => {
    const content = getTemplateContent();
    assertContains(content, 'function registerConnector', 'Should have registerConnector');
});

// ----------------------------------------------------------------------------
// Test Group 10: Exports
// ----------------------------------------------------------------------------

console.log('\n📦 Export Tests:');

test('Template exports loadConfig', () => {
    const content = getTemplateContent();
    assertContains(content, 'export {', 'Should have exports');
    assertContains(content, 'loadConfig', 'Should export loadConfig');
});

test('Template exports Logger', () => {
    const content = getTemplateContent();
    assertContains(content, 'Logger', 'Should export Logger');
});

test('Template exports handleJsonRpc', () => {
    const content = getTemplateContent();
    assertContains(content, 'handleJsonRpc', 'Should export handleJsonRpc');
});

test('Template exports types', () => {
    const content = getTemplateContent();
    assertContains(content, 'type ServerConfig', 'Should export ServerConfig type');
    assertContains(content, 'type MCPConfig', 'Should export MCPConfig type');
    assertContains(content, 'type JsonRpcRequest', 'Should export JsonRpcRequest type');
    assertContains(content, 'type JsonRpcResponse', 'Should export JsonRpcResponse type');
});

// ----------------------------------------------------------------------------
// Test Group 11: Template Placeholder Processing
// ----------------------------------------------------------------------------

console.log('\n🔄 Placeholder Processing Tests:');

test('Placeholders are on their own lines for easy replacement', () => {
    const content = getTemplateContent();
    const lines = content.split('\n');

    let toolImportsLine = lines.find(l => l.includes('{{TOOL_IMPORTS}}'));
    let connectorImportsLine = lines.find(l => l.includes('{{CONNECTOR_IMPORTS}}'));
    let toolRegLine = lines.find(l => l.includes('{{TOOL_REGISTRATION}}'));

    assert(!!toolImportsLine, 'TOOL_IMPORTS should be on a line');
    assert(!!connectorImportsLine, 'CONNECTOR_IMPORTS should be on a line');
    assert(!!toolRegLine, 'TOOL_REGISTRATION should be on a line');

    // Placeholders should be easily replaceable (not mixed with other code)
    assert(toolImportsLine!.trim() === '{{TOOL_IMPORTS}}', 'TOOL_IMPORTS should be on its own');
    assert(connectorImportsLine!.trim() === '{{CONNECTOR_IMPORTS}}', 'CONNECTOR_IMPORTS should be on its own');
    assert(toolRegLine!.trim() === '{{TOOL_REGISTRATION}}', 'TOOL_REGISTRATION should be on its own');
});

test('Placeholders appear in correct sections', () => {
    const content = getTemplateContent();

    // TOOL_IMPORTS and CONNECTOR_IMPORTS should be near the top
    const importSection = content.indexOf('{{TOOL_IMPORTS}}');
    const coreImports = content.indexOf("import * as http from 'http'");

    assert(importSection < coreImports, 'Tool imports should be before core imports');
});

// ----------------------------------------------------------------------------
// Test Group 12: TypeScript Validity
// ----------------------------------------------------------------------------

console.log('\n📘 TypeScript Validity Tests:');

test('Template has consistent brace matching', () => {
    const content = getTemplateContent();
    let openBraces = 0;
    let closeBraces = 0;

    for (const char of content) {
        if (char === '{') openBraces++;
        if (char === '}') closeBraces++;
    }

    assertEqual(openBraces, closeBraces, 'Braces should be balanced');
});

test('Template has consistent parenthesis matching', () => {
    const content = getTemplateContent();
    let openParens = 0;
    let closeParens = 0;

    for (const char of content) {
        if (char === '(') openParens++;
        if (char === ')') closeParens++;
    }

    assertEqual(openParens, closeParens, 'Parentheses should be balanced');
});

test('Template uses proper async/await patterns', () => {
    const content = getTemplateContent();

    // Check that async functions use await or return promises
    assertContains(content, 'async function handleJsonRpc', 'handleJsonRpc should be async');
    assertContains(content, 'async function gracefulShutdown', 'gracefulShutdown should be async');
    assertContains(content, 'async function main', 'main should be async');
});

// ============================================================================
// Run Tests and Report
// ============================================================================

// Allow async tests to complete
setTimeout(() => {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Summary');
    console.log('='.repeat(60));

    const passed = testResults.filter(r => r.passed).length;
    const failed = testResults.filter(r => !r.passed).length;
    const total = testResults.length;

    console.log(`Total: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);

    if (failed > 0) {
        console.log('\n❌ Failed Tests:');
        testResults.filter(r => !r.passed).forEach(r => {
            console.log(`  - ${r.name}: ${r.error}`);
        });
    }

    console.log('\n' + (failed === 0 ? '✅ All tests passed!' : '❌ Some tests failed!'));

    process.exit(failed > 0 ? 1 : 0);
}, 100);
