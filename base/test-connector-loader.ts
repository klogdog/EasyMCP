/**
 * Test Suite for Connector Loader Template
 * Tests the connector-loader.ts.template for Task 5.3
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

const TEMPLATE_PATH = path.join(__dirname, 'templates', 'connector-loader.ts.template');

function getTemplateContent(): string {
    return fs.readFileSync(TEMPLATE_PATH, 'utf8');
}

// ============================================================================
// Tests
// ============================================================================

console.log('\n📋 Test Suite: Connector Loader Template (Task 5.3)\n');

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
    // Note: This template is self-contained and defines types inline
    assertContains(content, 'interface', 'Template should define interfaces');
    assertContains(content, 'export', 'Template should have exports');
});

test('Template has CONNECTOR_LIST placeholder', () => {
    const content = getTemplateContent();
    assertContains(content, '{{CONNECTOR_LIST}}', 'Should have CONNECTOR_LIST placeholder');
});

test('Template has proper file header', () => {
    const content = getTemplateContent();
    assertContains(content, 'MCP Connector Loader Template', 'Should have descriptive header');
    assertContains(content, 'EasyMCP', 'Should reference EasyMCP');
});

// ----------------------------------------------------------------------------
// Test Group 2: Connector Interface
// ----------------------------------------------------------------------------

console.log('\n🔌 Connector Interface Tests:');

test('Template has Connector interface', () => {
    const content = getTemplateContent();
    assertContains(content, 'interface Connector', 'Should have Connector interface');
});

test('Connector interface has name property', () => {
    const content = getTemplateContent();
    assertContains(content, 'name: string', 'Connector should have name');
});

test('Connector interface has type property', () => {
    const content = getTemplateContent();
    assertContains(content, 'type: string', 'Connector should have type');
});

test('Connector interface has isConnected method', () => {
    const content = getTemplateContent();
    assertContains(content, 'isConnected()', 'Connector should have isConnected');
});

test('Connector interface has connect method', () => {
    const content = getTemplateContent();
    assertContains(content, 'connect(): Promise<void>', 'Connector should have connect');
});

test('Connector interface has disconnect method', () => {
    const content = getTemplateContent();
    assertContains(content, 'disconnect(): Promise<void>', 'Connector should have disconnect');
});

test('Connector interface has reconnect method', () => {
    const content = getTemplateContent();
    assertContains(content, 'reconnect(): Promise<void>', 'Connector should have reconnect');
});

test('Connector interface has health method', () => {
    const content = getTemplateContent();
    assertContains(content, 'health(): Promise<boolean>', 'Connector should have health');
});

test('Connector interface has getClient method', () => {
    const content = getTemplateContent();
    assertContains(content, 'getClient<T>()', 'Connector should have getClient');
});

// ----------------------------------------------------------------------------
// Test Group 3: ConnectorRegistry Class
// ----------------------------------------------------------------------------

console.log('\n📚 ConnectorRegistry Class Tests:');

test('Template has ConnectorRegistry class', () => {
    const content = getTemplateContent();
    assertContains(content, 'class ConnectorRegistry', 'Should have ConnectorRegistry class');
});

test('ConnectorRegistry has private connectors Map', () => {
    const content = getTemplateContent();
    assertContains(content, 'private connectors = new Map<string, Connector>()', 'Should have connectors Map');
});

test('ConnectorRegistry has register method', () => {
    const content = getTemplateContent();
    assertContains(content, 'async register(connector: Connector', 'Should have register method');
});

test('ConnectorRegistry has get method', () => {
    const content = getTemplateContent();
    assertContains(content, 'get(name: string): Connector | undefined', 'Should have get method');
});

test('ConnectorRegistry has list method', () => {
    const content = getTemplateContent();
    assertContains(content, 'list(): Connector[]', 'Should have list method');
});

test('ConnectorRegistry has connect method', () => {
    const content = getTemplateContent();
    assertContains(content, 'async connect(name: string)', 'Should have connect method');
});

test('ConnectorRegistry has disconnect method', () => {
    const content = getTemplateContent();
    assertContains(content, 'async disconnect(name: string)', 'Should have disconnect method');
});

test('ConnectorRegistry has connectAll method', () => {
    const content = getTemplateContent();
    assertContains(content, 'async connectAll()', 'Should have connectAll method');
});

test('ConnectorRegistry has disconnectAll method', () => {
    const content = getTemplateContent();
    assertContains(content, 'async disconnectAll()', 'Should have disconnectAll method');
});

test('ConnectorRegistry has checkHealth method', () => {
    const content = getTemplateContent();
    assertContains(content, 'async checkHealth(name: string)', 'Should have checkHealth method');
});

test('ConnectorRegistry has checkAllHealth method', () => {
    const content = getTemplateContent();
    assertContains(content, 'async checkAllHealth()', 'Should have checkAllHealth method');
});

// ----------------------------------------------------------------------------
// Test Group 4: ConnectorConfig Interface
// ----------------------------------------------------------------------------

console.log('\n⚙️ ConnectorConfig Interface Tests:');

test('Template has ConnectorConfig interface', () => {
    const content = getTemplateContent();
    assertContains(content, 'interface ConnectorConfig', 'Should have ConnectorConfig');
});

test('ConnectorConfig has name field', () => {
    const content = getTemplateContent();
    // Find the ConnectorConfig interface and check for name
    const configSection = content.substring(
        content.indexOf('interface ConnectorConfig'),
        content.indexOf('interface ConnectorConfig') + 500
    );
    assertContains(configSection, 'name: string', 'ConnectorConfig should have name');
});

test('ConnectorConfig has credentials field', () => {
    const content = getTemplateContent();
    assertContains(content, 'credentials: Credentials', 'ConnectorConfig should have credentials');
});

test('ConnectorConfig has poolSize field', () => {
    const content = getTemplateContent();
    assertContains(content, 'poolSize?:', 'ConnectorConfig should have optional poolSize');
});

test('ConnectorConfig has timeout field', () => {
    const content = getTemplateContent();
    assertContains(content, 'timeout?:', 'ConnectorConfig should have optional timeout');
});

test('ConnectorConfig has maxRetries field', () => {
    const content = getTemplateContent();
    assertContains(content, 'maxRetries?:', 'ConnectorConfig should have optional maxRetries');
});

test('ConnectorConfig has required field', () => {
    const content = getTemplateContent();
    assertContains(content, 'required?: boolean', 'ConnectorConfig should have optional required');
});

// ----------------------------------------------------------------------------
// Test Group 5: Credential Types
// ----------------------------------------------------------------------------

console.log('\n🔐 Credential Types Tests:');

test('Template has CredentialType type', () => {
    const content = getTemplateContent();
    assertContains(content, "type CredentialType = 'oauth'", 'Should have CredentialType');
});

test('Template supports OAuth credentials', () => {
    const content = getTemplateContent();
    assertContains(content, 'interface OAuthCredentials', 'Should have OAuthCredentials');
    assertContains(content, 'clientId:', 'OAuthCredentials should have clientId');
    assertContains(content, 'clientSecret:', 'OAuthCredentials should have clientSecret');
    assertContains(content, 'accessToken?:', 'OAuthCredentials should have accessToken');
    assertContains(content, 'refreshToken?:', 'OAuthCredentials should have refreshToken');
});

test('Template supports API Key credentials', () => {
    const content = getTemplateContent();
    assertContains(content, 'interface ApiKeyCredentials', 'Should have ApiKeyCredentials');
    assertContains(content, 'key: string', 'ApiKeyCredentials should have key');
});

test('Template supports Basic auth credentials', () => {
    const content = getTemplateContent();
    assertContains(content, 'interface BasicCredentials', 'Should have BasicCredentials');
    assertContains(content, 'username:', 'BasicCredentials should have username');
    assertContains(content, 'password:', 'BasicCredentials should have password');
});

test('Template supports Bearer token credentials', () => {
    const content = getTemplateContent();
    assertContains(content, 'interface BearerCredentials', 'Should have BearerCredentials');
    assertContains(content, 'token: string', 'BearerCredentials should have token');
});

test('Template supports No credentials', () => {
    const content = getTemplateContent();
    assertContains(content, 'interface NoCredentials', 'Should have NoCredentials');
    assertContains(content, "type: 'none'", 'NoCredentials should have type none');
});

test('Template has Credentials union type', () => {
    const content = getTemplateContent();
    assertContains(content, 'type Credentials =', 'Should have Credentials union type');
});

// ----------------------------------------------------------------------------
// Test Group 6: Connection Pooling
// ----------------------------------------------------------------------------

console.log('\n🏊 Connection Pooling Tests:');

test('Template has ConnectionPool class', () => {
    const content = getTemplateContent();
    assertContains(content, 'class ConnectionPool<T>', 'Should have ConnectionPool class');
});

test('ConnectionPool has initialize method', () => {
    const content = getTemplateContent();
    assertContains(content, 'async initialize()', 'Should have initialize method');
});

test('ConnectionPool has acquire method', () => {
    const content = getTemplateContent();
    assertContains(content, 'async acquire()', 'Should have acquire method');
});

test('ConnectionPool has release method', () => {
    const content = getTemplateContent();
    assertContains(content, 'release(client: T)', 'Should have release method');
});

test('ConnectionPool has drain method', () => {
    const content = getTemplateContent();
    assertContains(content, 'async drain()', 'Should have drain method');
});

test('ConnectionPool has stats method', () => {
    const content = getTemplateContent();
    assertContains(content, 'stats()', 'Should have stats method');
});

test('Template has PoolEntry interface', () => {
    const content = getTemplateContent();
    assertContains(content, 'interface PoolEntry<T>', 'Should have PoolEntry interface');
});

// ----------------------------------------------------------------------------
// Test Group 7: Health Checks
// ----------------------------------------------------------------------------

console.log('\n🏥 Health Check Tests:');

test('Template has HealthCheckResult interface', () => {
    const content = getTemplateContent();
    assertContains(content, 'interface HealthCheckResult', 'Should have HealthCheckResult');
});

test('HealthCheckResult has healthy field', () => {
    const content = getTemplateContent();
    assertContains(content, 'healthy: boolean', 'Should have healthy field');
});

test('HealthCheckResult has responseTime field', () => {
    const content = getTemplateContent();
    assertContains(content, 'responseTime?:', 'Should have responseTime field');
});

test('HealthCheckResult has error field', () => {
    const content = getTemplateContent();
    assertContains(content, 'error?: string', 'Should have error field');
});

test('ConnectorRegistry tracks health results', () => {
    const content = getTemplateContent();
    assertContains(content, 'healthResults', 'Should track health results');
    assertContains(content, 'getHealthResults()', 'Should have getHealthResults method');
});

// ----------------------------------------------------------------------------
// Test Group 8: Retry Logic
// ----------------------------------------------------------------------------

console.log('\n🔄 Retry Logic Tests:');

test('Template has withRetry function', () => {
    const content = getTemplateContent();
    assertContains(content, 'async function withRetry<T>', 'Should have withRetry function');
});

test('Template has RetryOptions interface', () => {
    const content = getTemplateContent();
    assertContains(content, 'interface RetryOptions', 'Should have RetryOptions');
});

test('RetryOptions has maxRetries field', () => {
    const content = getTemplateContent();
    assertContains(content, 'maxRetries: number', 'Should have maxRetries');
});

test('Template has calculateBackoffDelay function', () => {
    const content = getTemplateContent();
    assertContains(content, 'function calculateBackoffDelay', 'Should have calculateBackoffDelay');
});

test('Template supports exponential backoff', () => {
    const content = getTemplateContent();
    assertContains(content, 'multiplier', 'Should have multiplier for backoff');
    assertContains(content, 'Math.pow', 'Should use exponential calculation');
});

test('Template supports jitter', () => {
    const content = getTemplateContent();
    assertContains(content, 'jitter', 'Should support jitter');
    assertContains(content, 'Math.random', 'Should use random for jitter');
});

test('Template has DEFAULT_RETRY_OPTIONS', () => {
    const content = getTemplateContent();
    assertContains(content, 'DEFAULT_RETRY_OPTIONS', 'Should have default retry options');
});

// ----------------------------------------------------------------------------
// Test Group 9: Connection Lifecycle
// ----------------------------------------------------------------------------

console.log('\n🔄 Connection Lifecycle Tests:');

test('Template has ConnectionState type', () => {
    const content = getTemplateContent();
    assertContains(content, 'type ConnectionState =', 'Should have ConnectionState type');
    assertContains(content, "'disconnected'", 'Should have disconnected state');
    assertContains(content, "'connecting'", 'Should have connecting state');
    assertContains(content, "'connected'", 'Should have connected state');
    assertContains(content, "'error'", 'Should have error state');
    assertContains(content, "'reconnecting'", 'Should have reconnecting state');
});

test('Connector has getState method', () => {
    const content = getTemplateContent();
    assertContains(content, 'getState(): ConnectionState', 'Connector should have getState');
});

test('Connector has onInit hook', () => {
    const content = getTemplateContent();
    assertContains(content, 'onInit?:', 'Connector should have optional onInit');
});

test('Connector has onDestroy hook', () => {
    const content = getTemplateContent();
    assertContains(content, 'onDestroy?:', 'Connector should have optional onDestroy');
});

// ----------------------------------------------------------------------------
// Test Group 10: Graceful Degradation
// ----------------------------------------------------------------------------

console.log('\n⚡ Graceful Degradation Tests:');

test('ConnectorRegistry handles required connectors', () => {
    const content = getTemplateContent();
    assertContains(content, 'config?.required', 'Should check required flag');
    assertContains(content, 'Required connector failed', 'Should throw for required failures');
});

test('ConnectorRegistry logs warnings for optional failures', () => {
    const content = getTemplateContent();
    assertContains(content, 'console.warn', 'Should warn for optional failures');
});

test('initializeAllConnectors returns failed list', () => {
    const content = getTemplateContent();
    assertContains(content, 'failed: string[]', 'Should return failed list');
});

// ----------------------------------------------------------------------------
// Test Group 11: Credential Helpers
// ----------------------------------------------------------------------------

console.log('\n🔑 Credential Helpers Tests:');

test('Template has buildAuthHeader function', () => {
    const content = getTemplateContent();
    assertContains(content, 'function buildAuthHeader', 'Should have buildAuthHeader');
});

test('buildAuthHeader handles Basic auth', () => {
    const content = getTemplateContent();
    assertContains(content, "'basic'", 'Should handle basic auth');
    assertContains(content, 'Buffer.from', 'Should encode basic auth');
});

test('buildAuthHeader handles Bearer tokens', () => {
    const content = getTemplateContent();
    assertContains(content, "'bearer'", 'Should handle bearer tokens');
    assertContains(content, 'Bearer ${', 'Should format bearer token');
});

test('Template has getAuthHeaderName function', () => {
    const content = getTemplateContent();
    assertContains(content, 'function getAuthHeaderName', 'Should have getAuthHeaderName');
});

test('Template has isTokenExpired function', () => {
    const content = getTemplateContent();
    assertContains(content, 'function isTokenExpired', 'Should have isTokenExpired');
});

// ----------------------------------------------------------------------------
// Test Group 12: Initialization
// ----------------------------------------------------------------------------

console.log('\n🚀 Initialization Tests:');

test('Template has initializeConnector function', () => {
    const content = getTemplateContent();
    assertContains(content, 'async function initializeConnector', 'Should have initializeConnector');
});

test('Template has initializeAllConnectors function', () => {
    const content = getTemplateContent();
    assertContains(content, 'async function initializeAllConnectors', 'Should have initializeAllConnectors');
});

test('Template has shutdownConnectors function', () => {
    const content = getTemplateContent();
    assertContains(content, 'async function shutdownConnectors', 'Should have shutdownConnectors');
});

test('Template has createBaseConnector function', () => {
    const content = getTemplateContent();
    assertContains(content, 'function createBaseConnector', 'Should have createBaseConnector');
});

test('initializeConnector uses retry logic', () => {
    const content = getTemplateContent();
    const initSection = content.substring(content.indexOf('async function initializeConnector'));
    assertContains(initSection, 'withRetry', 'Should use withRetry');
});

// ----------------------------------------------------------------------------
// Test Group 13: Exports
// ----------------------------------------------------------------------------

console.log('\n📦 Export Tests:');

test('Template exports ConnectorRegistry', () => {
    const content = getTemplateContent();
    assertContains(content, 'export {', 'Should have exports');
    assertContains(content, 'ConnectorRegistry', 'Should export ConnectorRegistry');
});

test('Template exports connectorRegistry instance', () => {
    const content = getTemplateContent();
    assertContains(content, 'connectorRegistry', 'Should export connectorRegistry instance');
});

test('Template exports initializeConnector', () => {
    const content = getTemplateContent();
    assertContains(content, 'initializeConnector', 'Should export initializeConnector');
});

test('Template exports ConnectionPool', () => {
    const content = getTemplateContent();
    assertContains(content, 'ConnectionPool', 'Should export ConnectionPool');
});

test('Template exports types', () => {
    const content = getTemplateContent();
    assertContains(content, 'type Connector', 'Should export Connector type');
    assertContains(content, 'type ConnectorConfig', 'Should export ConnectorConfig type');
    assertContains(content, 'type Credentials', 'Should export Credentials type');
});

// ----------------------------------------------------------------------------
// Test Group 14: Placeholder Processing
// ----------------------------------------------------------------------------

console.log('\n🔄 Placeholder Processing Tests:');

test('CONNECTOR_LIST placeholder is on its own line', () => {
    const content = getTemplateContent();
    const lines = content.split('\n');

    const connectorListLine = lines.find(l => l.includes('{{CONNECTOR_LIST}}'));
    assert(!!connectorListLine, 'CONNECTOR_LIST should be on a line');
    assert(connectorListLine!.trim() === '{{CONNECTOR_LIST}}', 'CONNECTOR_LIST should be on its own');
});

test('CONNECTOR_LIST appears before class definitions', () => {
    const content = getTemplateContent();

    const placeholderIndex = content.indexOf('{{CONNECTOR_LIST}}');
    const classIndex = content.indexOf('class ConnectorRegistry');

    assert(placeholderIndex < classIndex, 'CONNECTOR_LIST should be before ConnectorRegistry class');
});

// ----------------------------------------------------------------------------
// Test Group 15: TypeScript Validity
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

    assertContains(content, 'async function initializeConnector', 'initializeConnector should be async');
    assertContains(content, 'async function initializeAllConnectors', 'initializeAllConnectors should be async');
    assertContains(content, 'async register(', 'register should be async');
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
