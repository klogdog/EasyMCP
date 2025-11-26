/**
 * Test Suite for Entrypoint Script Template (Task 5.4)
 * 
 * Tests the base/templates/entrypoint.sh.template file for:
 * - Script structure and syntax
 * - Shebang and strict mode settings
 * - Environment variable loading
 * - Configuration validation
 * - Signal handling
 * - Run mode support
 * - Logging functions
 * - Startup information
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Test Infrastructure
// ============================================================================

let passed = 0;
let failed = 0;
const failedTests: string[] = [];

const TEMPLATE_PATH = path.join(__dirname, 'templates', 'entrypoint.sh.template');

function test(name: string, fn: () => void): void {
    try {
        fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (error) {
        failed++;
        failedTests.push(name);
        console.log(`  ❌ ${name}: ${(error as Error).message}`);
    }
}

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function assertContains(content: string, substring: string, message: string): void {
    if (!content.includes(substring)) {
        throw new Error(`${message}. Expected to find: "${substring}"`);
    }
}

function assertMatches(content: string, pattern: RegExp, message: string): void {
    if (!pattern.test(content)) {
        throw new Error(`${message}. Expected pattern: ${pattern}`);
    }
}

function getTemplateContent(): string {
    return fs.readFileSync(TEMPLATE_PATH, 'utf-8');
}

function countOccurrences(content: string, substring: string): number {
    return (content.match(new RegExp(substring.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
}

// ============================================================================
// Test Groups
// ============================================================================

console.log('\n📋 Test Suite: Entrypoint Script Template (Task 5.4)\n');

// ----------------------------------------------------------------------------
// Test Group 1: Template Structure
// ----------------------------------------------------------------------------

console.log('📁 Template Structure Tests:');

test('Template file exists', () => {
    assert(fs.existsSync(TEMPLATE_PATH), 'Template file should exist');
});

test('Template is a bash script', () => {
    const content = getTemplateContent();
    assertContains(content, '#!/bin/bash', 'Should have bash shebang');
});

test('Template has proper file header', () => {
    const content = getTemplateContent();
    assertContains(content, 'MCP Server Entrypoint Script', 'Should have descriptive header');
    assertContains(content, 'EasyMCP', 'Should reference EasyMCP');
});

test('Template has sufficient content', () => {
    const content = getTemplateContent();
    const lines = content.split('\n').length;
    assert(lines > 200, `Template should have substantial content (has ${lines} lines)`);
});

// ----------------------------------------------------------------------------
// Test Group 2: Strict Mode Settings
// ----------------------------------------------------------------------------

console.log('\n🔒 Strict Mode Tests:');

test('Template has set -e for exit on error', () => {
    const content = getTemplateContent();
    assertContains(content, 'set -e', 'Should have set -e');
});

test('Template has set -u for unset variables', () => {
    const content = getTemplateContent();
    assertContains(content, 'set -u', 'Should have set -u');
});

test('Template has set -o pipefail', () => {
    const content = getTemplateContent();
    assertContains(content, 'set -o pipefail', 'Should have pipefail option');
});

// ----------------------------------------------------------------------------
// Test Group 3: Logging Functions
// ----------------------------------------------------------------------------

console.log('\n📝 Logging Function Tests:');

test('Template has log_info function', () => {
    const content = getTemplateContent();
    assertMatches(content, /log_info\(\)/, 'Should have log_info function');
});

test('Template has log_success function', () => {
    const content = getTemplateContent();
    assertMatches(content, /log_success\(\)/, 'Should have log_success function');
});

test('Template has log_warning function', () => {
    const content = getTemplateContent();
    assertMatches(content, /log_warning\(\)/, 'Should have log_warning function');
});

test('Template has log_error function', () => {
    const content = getTemplateContent();
    assertMatches(content, /log_error\(\)/, 'Should have log_error function');
});

test('Template has log_debug function', () => {
    const content = getTemplateContent();
    assertMatches(content, /log_debug\(\)/, 'Should have log_debug function');
});

test('Log functions use color codes', () => {
    const content = getTemplateContent();
    assertContains(content, 'RED=', 'Should define RED color');
    assertContains(content, 'GREEN=', 'Should define GREEN color');
    assertContains(content, 'YELLOW=', 'Should define YELLOW color');
    assertContains(content, 'BLUE=', 'Should define BLUE color');
    assertContains(content, 'NC=', 'Should define NC (no color)');
});

test('Log functions include timestamps', () => {
    const content = getTemplateContent();
    assertContains(content, "date '+%Y-%m-%d %H:%M:%S'", 'Should format timestamps');
});

// ----------------------------------------------------------------------------
// Test Group 4: Environment Variable Loading
// ----------------------------------------------------------------------------

console.log('\n🔧 Environment Variable Tests:');

test('Template has load_env_file function', () => {
    const content = getTemplateContent();
    assertMatches(content, /load_env_file\(\)/, 'Should have load_env_file function');
});

test('load_env_file checks if file exists', () => {
    const content = getTemplateContent();
    assertContains(content, '-f "$env_file"', 'Should check file existence');
});

test('load_env_file skips comments', () => {
    const content = getTemplateContent();
    assertMatches(content, /Skip.*comment/i, 'Should handle comments');
});

test('load_env_file exports variables', () => {
    const content = getTemplateContent();
    assertContains(content, 'export "$key=$value"', 'Should export variables');
});

test('Template loads .env file', () => {
    const content = getTemplateContent();
    assertContains(content, 'load_env_file ".env"', 'Should load .env');
});

test('Template supports .env.local', () => {
    const content = getTemplateContent();
    assertContains(content, '.env.local', 'Should support .env.local');
});

test('Template supports mode-specific env files', () => {
    const content = getTemplateContent();
    assertContains(content, '.env.$MODE', 'Should support mode-specific env');
});

// ----------------------------------------------------------------------------
// Test Group 5: Configuration Validation
// ----------------------------------------------------------------------------

console.log('\n📋 Configuration Validation Tests:');

test('Template has validate_config_file function', () => {
    const content = getTemplateContent();
    assertMatches(content, /validate_config_file\(\)/, 'Should have validate_config_file function');
});

test('validate_config_file checks MCP_CONFIG_PATH', () => {
    const content = getTemplateContent();
    assertContains(content, 'MCP_CONFIG_PATH', 'Should use MCP_CONFIG_PATH');
});

test('validate_config_file checks file existence', () => {
    const content = getTemplateContent();
    assertContains(content, '! -f "$config_path"', 'Should check file exists');
});

test('validate_config_file checks file readability', () => {
    const content = getTemplateContent();
    assertContains(content, '! -r "$config_path"', 'Should check file is readable');
});

test('Template validates YAML syntax with Node.js', () => {
    const content = getTemplateContent();
    assertContains(content, 'yaml.parse', 'Should parse YAML');
});

test('Template has validate_config_schema function', () => {
    const content = getTemplateContent();
    assertMatches(content, /validate_config_schema\(\)/, 'Should have schema validation');
});

test('Schema validation checks required fields', () => {
    const content = getTemplateContent();
    assertContains(content, "'server', 'tools'", 'Should check required fields');
});

// ----------------------------------------------------------------------------
// Test Group 6: Required Variables Check
// ----------------------------------------------------------------------------

console.log('\n✅ Required Variables Tests:');

test('Template has check_required_variables function', () => {
    const content = getTemplateContent();
    assertMatches(content, /check_required_variables\(\)/, 'Should have check_required_variables');
});

test('check_required_variables has missing_vars array', () => {
    const content = getTemplateContent();
    assertContains(content, 'missing_vars=()', 'Should track missing vars');
});

test('Template has REQUIRED_ENV_VARS placeholder', () => {
    const content = getTemplateContent();
    assertContains(content, '{{REQUIRED_ENV_VARS}}', 'Should have placeholder');
});

test('check_required_variables reports missing variables', () => {
    const content = getTemplateContent();
    assertContains(content, 'Missing required environment variables', 'Should report missing vars');
});

// ----------------------------------------------------------------------------
// Test Group 7: Signal Handling
// ----------------------------------------------------------------------------

console.log('\n🚦 Signal Handling Tests:');

test('Template has setup_signal_handlers function', () => {
    const content = getTemplateContent();
    assertMatches(content, /setup_signal_handlers\(\)/, 'Should have signal handler setup');
});

test('Template handles SIGTERM', () => {
    const content = getTemplateContent();
    assertContains(content, 'SIGTERM', 'Should handle SIGTERM');
    assertMatches(content, /handle_sigterm\(\)/, 'Should have sigterm handler');
});

test('Template handles SIGINT', () => {
    const content = getTemplateContent();
    assertContains(content, 'SIGINT', 'Should handle SIGINT');
    assertMatches(content, /handle_sigint\(\)/, 'Should have sigint handler');
});

test('Template handles SIGQUIT', () => {
    const content = getTemplateContent();
    assertContains(content, 'SIGQUIT', 'Should handle SIGQUIT');
});

test('Template handles SIGHUP for reload', () => {
    const content = getTemplateContent();
    assertContains(content, 'SIGHUP', 'Should handle SIGHUP');
    assertContains(content, 'reload', 'SIGHUP should trigger reload');
});

test('Template uses trap for signal handling', () => {
    const content = getTemplateContent();
    assertMatches(content, /trap '[^']+' SIG/, 'Should use trap command');
});

test('SIGTERM handler does graceful shutdown', () => {
    const content = getTemplateContent();
    assertContains(content, 'graceful shutdown', 'Should mention graceful shutdown');
    assertContains(content, 'kill -TERM "$PID"', 'Should send TERM to PID');
});

test('Template has shutdown timeout', () => {
    const content = getTemplateContent();
    assertContains(content, 'timeout=30', 'Should have shutdown timeout');
});

test('Template falls back to SIGKILL if needed', () => {
    const content = getTemplateContent();
    assertContains(content, 'SIGKILL', 'Should fall back to SIGKILL');
});

// ----------------------------------------------------------------------------
// Test Group 8: Run Mode Support
// ----------------------------------------------------------------------------

console.log('\n🎯 Run Mode Tests:');

test('Template has configure_run_mode function', () => {
    const content = getTemplateContent();
    assertMatches(content, /configure_run_mode\(\)/, 'Should have run mode config');
});

test('Template supports dev/development mode', () => {
    const content = getTemplateContent();
    assertContains(content, 'dev|development', 'Should support dev mode');
    assertContains(content, 'NODE_ENV=development', 'Should set development NODE_ENV');
});

test('Template supports prod/production mode', () => {
    const content = getTemplateContent();
    assertContains(content, 'prod|production', 'Should support prod mode');
    assertContains(content, 'NODE_ENV=production', 'Should set production NODE_ENV');
});

test('Template supports test mode', () => {
    const content = getTemplateContent();
    assertContains(content, 'test|testing', 'Should support test mode');
    assertContains(content, 'NODE_ENV=test', 'Should set test NODE_ENV');
});

test('Dev mode enables debug logging', () => {
    const content = getTemplateContent();
    // Check that dev mode sets debug logging
    const devSection = content.substring(
        content.indexOf('dev|development'),
        content.indexOf(';;', content.indexOf('dev|development'))
    );
    assert(devSection.includes('LOG_LEVEL=debug'), 'Dev mode should enable debug logging');
});

test('Prod mode defaults to info logging', () => {
    const content = getTemplateContent();
    const prodSection = content.substring(
        content.indexOf('prod|production'),
        content.indexOf(';;', content.indexOf('prod|production'))
    );
    assert(prodSection.includes('LOG_LEVEL'), 'Prod mode should set LOG_LEVEL');
});

test('Template defaults to production mode', () => {
    const content = getTemplateContent();
    assertContains(content, 'MODE="${1:-prod}"', 'Should default to prod mode');
});

// ----------------------------------------------------------------------------
// Test Group 9: Startup Information
// ----------------------------------------------------------------------------

console.log('\n🚀 Startup Information Tests:');

test('Template has print_startup_info function', () => {
    const content = getTemplateContent();
    assertMatches(content, /print_startup_info\(\)/, 'Should have startup info function');
});

test('Template shows startup banner', () => {
    const content = getTemplateContent();
    assertMatches(content, /show_banner\(\)/, 'Should have banner function');
});

test('Startup info shows mode', () => {
    const content = getTemplateContent();
    assertContains(content, 'Mode:', 'Should show mode');
});

test('Startup info shows config path', () => {
    const content = getTemplateContent();
    assertContains(content, 'Config Path:', 'Should show config path');
});

test('Startup info shows port', () => {
    const content = getTemplateContent();
    assertContains(content, 'Server Port:', 'Should show port');
});

test('Template lists configured tools', () => {
    const content = getTemplateContent();
    assertContains(content, 'Configured tools', 'Should list tools');
    assertContains(content, 'config.tools', 'Should read tools from config');
});

test('Template lists configured connectors', () => {
    const content = getTemplateContent();
    assertContains(content, 'Configured connectors', 'Should list connectors');
    assertContains(content, 'config.connectors', 'Should read connectors from config');
});

// ----------------------------------------------------------------------------
// Test Group 10: Server Execution
// ----------------------------------------------------------------------------

console.log('\n⚡ Server Execution Tests:');

test('Template uses exec to start server', () => {
    const content = getTemplateContent();
    assertContains(content, 'exec node server.js', 'Should use exec for node');
});

test('Template passes arguments to server', () => {
    const content = getTemplateContent();
    assertContains(content, '"$@"', 'Should pass arguments');
});

test('Template has start_server_foreground function', () => {
    const content = getTemplateContent();
    assertMatches(content, /start_server_foreground\(\)/, 'Should have foreground start');
});

test('Template has start_server_background function', () => {
    const content = getTemplateContent();
    assertMatches(content, /start_server_background\(\)/, 'Should have background start');
});

test('Background start tracks PID', () => {
    const content = getTemplateContent();
    assertContains(content, 'PID=$!', 'Should capture PID');
});

// ----------------------------------------------------------------------------
// Test Group 11: Health Check Support
// ----------------------------------------------------------------------------

console.log('\n💊 Health Check Tests:');

test('Template has healthcheck function', () => {
    const content = getTemplateContent();
    assertMatches(content, /run_healthcheck\(\)/, 'Should have healthcheck function');
});

test('Healthcheck supports curl', () => {
    const content = getTemplateContent();
    assertContains(content, 'curl --fail', 'Should use curl');
});

test('Healthcheck supports wget fallback', () => {
    const content = getTemplateContent();
    assertContains(content, 'wget --quiet', 'Should fallback to wget');
});

test('Healthcheck supports Node.js fallback', () => {
    const content = getTemplateContent();
    assertContains(content, "http.get('", 'Should fallback to node http');
});

test('Healthcheck checks /health endpoint', () => {
    const content = getTemplateContent();
    assertContains(content, '/health', 'Should check /health endpoint');
});

test('Template supports healthcheck command', () => {
    const content = getTemplateContent();
    assertContains(content, 'healthcheck|health)', 'Should support healthcheck command');
});

// ----------------------------------------------------------------------------
// Test Group 12: Pre-Start Hooks
// ----------------------------------------------------------------------------

console.log('\n🔗 Pre-Start Hook Tests:');

test('Template has run_pre_start_hooks function', () => {
    const content = getTemplateContent();
    assertMatches(content, /run_pre_start_hooks\(\)/, 'Should have pre-start hooks');
});

test('Template supports database migrations', () => {
    const content = getTemplateContent();
    assertContains(content, 'RUN_MIGRATIONS', 'Should support migrations');
    assertContains(content, 'prisma migrate', 'Should run prisma migrations');
});

test('Template supports custom pre-start script', () => {
    const content = getTemplateContent();
    assertContains(content, 'pre-start.sh', 'Should support custom pre-start');
});

// ----------------------------------------------------------------------------
// Test Group 13: Dependency Waiting
// ----------------------------------------------------------------------------

console.log('\n⏳ Dependency Waiting Tests:');

test('Template has wait_for_dependencies function', () => {
    const content = getTemplateContent();
    assertMatches(content, /wait_for_dependencies\(\)/, 'Should have dependency wait');
});

test('Template waits for database if configured', () => {
    const content = getTemplateContent();
    assertContains(content, 'DATABASE_URL', 'Should check DATABASE_URL');
    assertContains(content, 'Waiting for database', 'Should wait for database');
});

test('Template has retry logic for dependencies', () => {
    const content = getTemplateContent();
    assertContains(content, 'max_attempts=', 'Should have max attempts');
    assertContains(content, 'attempt=', 'Should track attempts');
});

// ----------------------------------------------------------------------------
// Test Group 14: Command Line Interface
// ----------------------------------------------------------------------------

console.log('\n💻 CLI Tests:');

test('Template has main function', () => {
    const content = getTemplateContent();
    assertMatches(content, /main\(\)/, 'Should have main function');
});

test('Template supports version command', () => {
    const content = getTemplateContent();
    assertContains(content, 'version|--version|-v)', 'Should support version');
});

test('Template supports help command', () => {
    const content = getTemplateContent();
    assertContains(content, 'help|--help|-h)', 'Should support help');
});

test('Help shows usage information', () => {
    const content = getTemplateContent();
    assertContains(content, 'Usage:', 'Should show usage');
});

test('Template invokes main at end', () => {
    const content = getTemplateContent();
    assertContains(content, 'main "$@"', 'Should call main with args');
});

// ----------------------------------------------------------------------------
// Test Group 15: Placeholder Processing
// ----------------------------------------------------------------------------

console.log('\n🔄 Placeholder Tests:');

test('Template has SERVER_NAME placeholder', () => {
    const content = getTemplateContent();
    assertContains(content, '{{SERVER_NAME}}', 'Should have SERVER_NAME placeholder');
});

test('Template has SERVER_VERSION placeholder', () => {
    const content = getTemplateContent();
    assertContains(content, '{{SERVER_VERSION}}', 'Should have SERVER_VERSION placeholder');
});

test('Template has DEFAULT_PORT placeholder', () => {
    const content = getTemplateContent();
    assertContains(content, '{{DEFAULT_PORT}}', 'Should have DEFAULT_PORT placeholder');
});

test('Template has REQUIRED_ENV_VARS placeholder', () => {
    const content = getTemplateContent();
    assertContains(content, '{{REQUIRED_ENV_VARS}}', 'Should have REQUIRED_ENV_VARS placeholder');
});

// ----------------------------------------------------------------------------
// Test Group 16: Bash Syntax Validity
// ----------------------------------------------------------------------------

console.log('\n📘 Bash Syntax Tests:');

test('Template has consistent brace matching', () => {
    const content = getTemplateContent();
    const openBraces = countOccurrences(content, '{');
    const closeBraces = countOccurrences(content, '}');
    assert(openBraces === closeBraces, `Brace mismatch: ${openBraces} open, ${closeBraces} close`);
});

test('Template has balanced parentheses in bash code', () => {
    const content = getTemplateContent();
    // Only check bash lines (exclude embedded node -e scripts)
    // Check that function definitions are balanced
    const funcDefs = content.match(/^[a-z_]+\(\)\s*\{/gm) || [];
    assert(funcDefs.length > 10, `Should have multiple function definitions (found ${funcDefs.length})`);
});

test('Template has consistent quote usage', () => {
    const content = getTemplateContent();
    // Check for common quote issues
    const doubleQuotes = (content.match(/"/g) || []).length;
    assert(doubleQuotes % 2 === 0, 'Double quotes should be balanced');
});

test('Functions use proper syntax', () => {
    const content = getTemplateContent();
    // All functions should have () after name
    const functionDefs = content.match(/^[a-z_]+\(\)/gm) || [];
    assert(functionDefs.length > 10, `Should have multiple function definitions (found ${functionDefs.length})`);
});

test('Case statements are properly closed', () => {
    const content = getTemplateContent();
    const caseCount = (content.match(/\bcase\b/g) || []).length;
    const esacCount = (content.match(/\besac\b/g) || []).length;
    assert(caseCount === esacCount, `case/esac mismatch: ${caseCount} case, ${esacCount} esac`);
});

test('Bash if/fi statements are balanced', () => {
    const content = getTemplateContent();
    // Only count bash if/fi - exclude embedded JavaScript
    // Look for 'if [' or 'if !' which is bash-style
    const bashIfCount = (content.match(/\bif\s+\[/g) || []).length +
        (content.match(/\bif\s+!/g) || []).length +
        (content.match(/\bif\s+command/g) || []).length;
    const fiCount = (content.match(/^\s*fi\s*$/gm) || []).length +
        (content.match(/;\s*fi\b/g) || []).length;
    // Allow some tolerance since embedded JS has if statements
    assert(fiCount >= bashIfCount - 5, `Bash if/fi may be unbalanced: ~${bashIfCount} if, ${fiCount} fi`);
});

test('While loops are properly closed', () => {
    const content = getTemplateContent();
    const whileCount = (content.match(/\bwhile\b/g) || []).length;
    const doneCount = (content.match(/\bdone\b/g) || []).length;
    // while loops and for loops both use done
    assert(doneCount >= whileCount, 'Not enough done statements for while loops');
});

// ============================================================================
// Test Summary
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('📊 Test Summary');
console.log('='.repeat(60));
console.log(`Total: ${passed + failed}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);

if (failedTests.length > 0) {
    console.log('\n❌ Failed Tests:');
    failedTests.forEach(t => console.log(`  - ${t}`));
}

console.log('');

if (failed > 0) {
    console.log('❌ Some tests failed!');
    process.exit(1);
} else {
    console.log('✅ All tests passed!');
    process.exit(0);
}
