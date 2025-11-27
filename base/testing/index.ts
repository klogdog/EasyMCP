/**
 * MCP Testing Framework
 * 
 * This module provides utilities for testing generated MCP servers:
 * - Test harness with container lifecycle management
 * - MCP protocol client for validation
 * - Tool mocking framework
 * - Assertion helpers
 */

// Re-export all testing utilities
export * from './test-harness';
export * from './mock-framework';
export * from './assertions';

// Default export
export { TestHarness as default } from './test-harness';
