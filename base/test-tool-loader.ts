/**
 * Test Suite for Tool Loader Template
 * Tests the tool-loader.ts.template for Task 5.2
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

const TEMPLATE_PATH = path.join(__dirname, 'templates', 'tool-loader.ts.template');

function getTemplateContent(): string {
    return fs.readFileSync(TEMPLATE_PATH, 'utf8');
}

// ============================================================================
// Tests
// ============================================================================

console.log('\n📋 Test Suite: Tool Loader Template (Task 5.2)\n');

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

test('Template has TOOL_LIST placeholder', () => {
    const content = getTemplateContent();
    assertContains(content, '{{TOOL_LIST}}', 'Should have TOOL_LIST placeholder');
});

test('Template has proper file header', () => {
    const content = getTemplateContent();
    assertContains(content, 'MCP Tool Loader Template', 'Should have descriptive header');
    assertContains(content, 'EasyMCP', 'Should reference EasyMCP');
});

// ----------------------------------------------------------------------------
// Test Group 2: Tool Interface
// ----------------------------------------------------------------------------

console.log('\n🔧 Tool Interface Tests:');

test('Template has Tool interface', () => {
    const content = getTemplateContent();
    assertContains(content, 'interface Tool', 'Should have Tool interface');
});

test('Tool interface has name property', () => {
    const content = getTemplateContent();
    assertContains(content, 'name: string', 'Tool should have name');
});

test('Tool interface has description property', () => {
    const content = getTemplateContent();
    assertContains(content, 'description: string', 'Tool should have description');
});

test('Tool interface has inputSchema property', () => {
    const content = getTemplateContent();
    assertContains(content, 'inputSchema:', 'Tool should have inputSchema');
});

test('Tool interface has handler property', () => {
    const content = getTemplateContent();
    assertContains(content, 'handler:', 'Tool should have handler');
    assertContains(content, 'Promise<unknown>', 'Handler should return Promise');
});

test('Tool interface has onLoad hook', () => {
    const content = getTemplateContent();
    assertContains(content, 'onLoad?:', 'Tool should have optional onLoad hook');
});

test('Tool interface has onUnload hook', () => {
    const content = getTemplateContent();
    assertContains(content, 'onUnload?:', 'Tool should have optional onUnload hook');
});

// ----------------------------------------------------------------------------
// Test Group 3: ToolRegistry Class
// ----------------------------------------------------------------------------

console.log('\n📚 ToolRegistry Class Tests:');

test('Template has ToolRegistry class', () => {
    const content = getTemplateContent();
    assertContains(content, 'class ToolRegistry', 'Should have ToolRegistry class');
});

test('ToolRegistry has private tools Map', () => {
    const content = getTemplateContent();
    assertContains(content, 'private tools = new Map<string, Tool>()', 'Should have tools Map');
});

test('ToolRegistry has register method', () => {
    const content = getTemplateContent();
    assertContains(content, 'async register(tool: Tool)', 'Should have register method');
});

test('ToolRegistry has get method', () => {
    const content = getTemplateContent();
    assertContains(content, 'get(name: string): Tool | undefined', 'Should have get method');
});

test('ToolRegistry has list method', () => {
    const content = getTemplateContent();
    assertContains(content, 'list(): Tool[]', 'Should have list method');
});

test('ToolRegistry has has method', () => {
    const content = getTemplateContent();
    assertContains(content, 'has(name: string): boolean', 'Should have has method');
});

test('ToolRegistry has unregister method', () => {
    const content = getTemplateContent();
    assertContains(content, 'async unregister(name: string)', 'Should have unregister method');
});

test('ToolRegistry has names method', () => {
    const content = getTemplateContent();
    assertContains(content, 'names(): string[]', 'Should have names method');
});

test('ToolRegistry has count property', () => {
    const content = getTemplateContent();
    assertContains(content, 'get count(): number', 'Should have count getter');
});

// ----------------------------------------------------------------------------
// Test Group 4: Dynamic Loading
// ----------------------------------------------------------------------------

console.log('\n📦 Dynamic Loading Tests:');

test('Template has loadTools function', () => {
    const content = getTemplateContent();
    assertContains(content, 'async function loadTools', 'Should have loadTools function');
});

test('loadTools uses dynamic import', () => {
    const content = getTemplateContent();
    assertContains(content, 'await import(', 'Should use dynamic import');
});

test('Template has ToolDefinition interface', () => {
    const content = getTemplateContent();
    assertContains(content, 'interface ToolDefinition', 'Should have ToolDefinition');
    assertContains(content, 'path: string', 'ToolDefinition should have path');
});

test('loadTools handles required tools', () => {
    const content = getTemplateContent();
    assertContains(content, 'required', 'Should handle required tools');
    assertContains(content, 'Required tool failed to load', 'Should throw for required tool failures');
});

test('loadTools returns loaded and failed lists', () => {
    const content = getTemplateContent();
    assertContains(content, 'loaded: string[]', 'Should return loaded list');
    assertContains(content, 'failed: string[]', 'Should return failed list');
});

test('Template has unloadTools function', () => {
    const content = getTemplateContent();
    assertContains(content, 'async function unloadTools', 'Should have unloadTools function');
});

// ----------------------------------------------------------------------------
// Test Group 5: Tool Invocation
// ----------------------------------------------------------------------------

console.log('\n⚡ Tool Invocation Tests:');

test('Template has invokeTool function', () => {
    const content = getTemplateContent();
    assertContains(content, 'async function invokeTool', 'Should have invokeTool function');
});

test('invokeTool takes name and args', () => {
    const content = getTemplateContent();
    assertContains(content, 'name: string', 'Should take name parameter');
    assertContains(content, 'args: unknown', 'Should take args parameter');
});

test('invokeTool returns ToolResult', () => {
    const content = getTemplateContent();
    assertContains(content, 'Promise<ToolResult>', 'Should return Promise<ToolResult>');
});

test('invokeTool handles tool not found', () => {
    const content = getTemplateContent();
    assertContains(content, 'Tool not found', 'Should handle tool not found');
    assertContains(content, 'TOOL_NOT_FOUND', 'Should have TOOL_NOT_FOUND error code');
});

test('Template has invokeToolsBatch function', () => {
    const content = getTemplateContent();
    assertContains(content, 'async function invokeToolsBatch', 'Should have batch invocation');
});

test('Template has executeWithTimeout function', () => {
    const content = getTemplateContent();
    assertContains(content, 'async function executeWithTimeout', 'Should have timeout execution');
});

// ----------------------------------------------------------------------------
// Test Group 6: Input Validation
// ----------------------------------------------------------------------------

console.log('\n✅ Input Validation Tests:');

test('Template has SchemaValidator class', () => {
    const content = getTemplateContent();
    assertContains(content, 'class SchemaValidator', 'Should have SchemaValidator class');
});

test('Template has JSONSchema interface', () => {
    const content = getTemplateContent();
    assertContains(content, 'interface JSONSchema', 'Should have JSONSchema interface');
});

test('JSONSchema supports common types', () => {
    const content = getTemplateContent();
    assertContains(content, 'type?: string', 'Should support type');
    assertContains(content, 'properties?:', 'Should support properties');
    assertContains(content, 'required?:', 'Should support required');
    assertContains(content, 'enum?:', 'Should support enum');
});

test('SchemaValidator has validate method', () => {
    const content = getTemplateContent();
    assertContains(content, 'validate(schema: JSONSchema', 'Should have validate method');
});

test('Template has ValidationResult interface', () => {
    const content = getTemplateContent();
    assertContains(content, 'interface ValidationResult', 'Should have ValidationResult');
    assertContains(content, 'valid: boolean', 'Should have valid field');
    assertContains(content, 'errors:', 'Should have errors field');
});

test('Template has ValidationError interface', () => {
    const content = getTemplateContent();
    assertContains(content, 'interface ValidationError', 'Should have ValidationError');
    assertContains(content, 'path: string', 'Should have path field');
    assertContains(content, 'message: string', 'Should have message field');
});

test('ToolRegistry has validateInput method', () => {
    const content = getTemplateContent();
    assertContains(content, 'validateInput(toolName: string', 'Should have validateInput method');
});

test('invokeTool performs validation', () => {
    const content = getTemplateContent();
    assertContains(content, 'validateInput', 'invokeTool should validate input');
    assertContains(content, 'VALIDATION_ERROR', 'Should have validation error code');
});

// ----------------------------------------------------------------------------
// Test Group 7: Result Transformation
// ----------------------------------------------------------------------------

console.log('\n📤 Result Transformation Tests:');

test('Template has ToolResult interface', () => {
    const content = getTemplateContent();
    assertContains(content, 'interface ToolResult', 'Should have ToolResult interface');
});

test('ToolResult has success field', () => {
    const content = getTemplateContent();
    assertContains(content, 'success: boolean', 'Should have success field');
});

test('ToolResult has result field', () => {
    const content = getTemplateContent();
    assertContains(content, 'result?: unknown', 'Should have optional result field');
});

test('ToolResult has error field', () => {
    const content = getTemplateContent();
    assertContains(content, 'error?: string', 'Should have optional error field');
});

test('ToolResult has errorCode field', () => {
    const content = getTemplateContent();
    assertContains(content, 'errorCode?: string', 'Should have optional errorCode field');
});

test('ToolResult has executionTime field', () => {
    const content = getTemplateContent();
    assertContains(content, 'executionTime?: number', 'Should have optional executionTime field');
});

// ----------------------------------------------------------------------------
// Test Group 8: Error Handling
// ----------------------------------------------------------------------------

console.log('\n⚠️ Error Handling Tests:');

test('invokeTool has try-catch wrapper', () => {
    const content = getTemplateContent();
    assertContains(content, 'try {', 'Should have try block');
    assertContains(content, 'catch (error)', 'Should have catch block');
});

test('Template handles timeout errors', () => {
    const content = getTemplateContent();
    assertContains(content, 'timed out', 'Should handle timeout');
    assertContains(content, 'TIMEOUT', 'Should have TIMEOUT error code');
});

test('Template logs errors', () => {
    const content = getTemplateContent();
    assertContains(content, 'logger?.error', 'Should log errors');
});

test('Register checks for duplicate tools', () => {
    const content = getTemplateContent();
    assertContains(content, 'Tool already registered', 'Should check for duplicates');
});

test('Register validates tool name', () => {
    const content = getTemplateContent();
    assertContains(content, 'Tool must have a name', 'Should validate tool name');
});

// ----------------------------------------------------------------------------
// Test Group 9: Lifecycle Hooks
// ----------------------------------------------------------------------------

console.log('\n🔄 Lifecycle Hooks Tests:');

test('Register calls onLoad hook', () => {
    const content = getTemplateContent();
    assertContains(content, 'tool.onLoad', 'Should check for onLoad');
    assertContains(content, 'await Promise.resolve(tool.onLoad())', 'Should call onLoad');
});

test('Unregister calls onUnload hook', () => {
    const content = getTemplateContent();
    assertContains(content, 'tool.onUnload', 'Should check for onUnload');
    assertContains(content, 'await Promise.resolve(tool.onUnload())', 'Should call onUnload');
});

test('Template has unregisterAll method', () => {
    const content = getTemplateContent();
    assertContains(content, 'async unregisterAll()', 'Should have unregisterAll');
});

test('unregisterAll unloads in reverse order', () => {
    const content = getTemplateContent();
    assertContains(content, 'loadOrder', 'Should track load order');
    assertContains(content, 'reverse()', 'Should reverse order for unload');
});

// ----------------------------------------------------------------------------
// Test Group 10: Tool Information
// ----------------------------------------------------------------------------

console.log('\n📋 Tool Information Tests:');

test('Template has getToolInfo function', () => {
    const content = getTemplateContent();
    assertContains(content, 'function getToolInfo(name: string)', 'Should have getToolInfo');
});

test('Template has getAllToolsInfo function', () => {
    const content = getTemplateContent();
    assertContains(content, 'function getAllToolsInfo()', 'Should have getAllToolsInfo');
});

test('getAllToolsInfo returns required fields', () => {
    const content = getTemplateContent();
    // Check that it returns name, description, inputSchema
    const infoSection = content.substring(content.indexOf('getAllToolsInfo'));
    assertContains(infoSection, 'name:', 'Should return name');
    assertContains(infoSection, 'description:', 'Should return description');
    assertContains(infoSection, 'inputSchema:', 'Should return inputSchema');
});

// ----------------------------------------------------------------------------
// Test Group 11: Exports
// ----------------------------------------------------------------------------

console.log('\n📦 Export Tests:');

test('Template exports ToolRegistry', () => {
    const content = getTemplateContent();
    assertContains(content, 'export {', 'Should have exports');
    assertContains(content, 'ToolRegistry', 'Should export ToolRegistry');
});

test('Template exports toolRegistry instance', () => {
    const content = getTemplateContent();
    assertContains(content, 'toolRegistry', 'Should export toolRegistry instance');
});

test('Template exports loadTools', () => {
    const content = getTemplateContent();
    assertContains(content, 'loadTools', 'Should export loadTools');
});

test('Template exports invokeTool', () => {
    const content = getTemplateContent();
    assertContains(content, 'invokeTool', 'Should export invokeTool');
});

test('Template exports types', () => {
    const content = getTemplateContent();
    assertContains(content, 'type Tool', 'Should export Tool type');
    assertContains(content, 'type ToolResult', 'Should export ToolResult type');
    assertContains(content, 'type ToolDefinition', 'Should export ToolDefinition type');
});

// ----------------------------------------------------------------------------
// Test Group 12: Placeholder Processing
// ----------------------------------------------------------------------------

console.log('\n🔄 Placeholder Processing Tests:');

test('TOOL_LIST placeholder is on its own line', () => {
    const content = getTemplateContent();
    const lines = content.split('\n');

    const toolListLine = lines.find(l => l.includes('{{TOOL_LIST}}'));
    assert(!!toolListLine, 'TOOL_LIST should be on a line');
    assert(toolListLine!.trim() === '{{TOOL_LIST}}', 'TOOL_LIST should be on its own');
});

test('TOOL_LIST appears before class definitions', () => {
    const content = getTemplateContent();

    const placeholderIndex = content.indexOf('{{TOOL_LIST}}');
    const classIndex = content.indexOf('class ToolRegistry');

    assert(placeholderIndex < classIndex, 'TOOL_LIST should be before ToolRegistry class');
});

// ----------------------------------------------------------------------------
// Test Group 13: TypeScript Validity
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

    assertContains(content, 'async function loadTools', 'loadTools should be async');
    assertContains(content, 'async function invokeTool', 'invokeTool should be async');
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
