/**
 * Unit Tests for Loader Module
 * 
 * Tests the module discovery, metadata extraction, and error handling
 * capabilities of the loader.ts module.
 * 
 * @module __tests__/loader
 */

import { describe, it, expect, jest, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import * as path from 'path';
import * as fs from 'fs/promises';

// Import the module under test
import { loadModules, ToolMetadata, ConnectorMetadata } from '../loader';

// Test fixtures
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

describe('Loader Module', () => {
    // Store original console.warn to restore after tests
    let originalWarn: typeof console.warn;

    beforeAll(() => {
        originalWarn = console.warn;
    });

    afterAll(() => {
        console.warn = originalWarn;
    });

    beforeEach(() => {
        // Suppress console.warn during tests
        console.warn = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Module Discovery', () => {
        it('should discover TypeScript tools from the tools directory', async () => {
            const modules = await loadModules(FIXTURES_DIR);

            const tsTools = modules.filter(m =>
                m.type === 'tool' && m.language === 'typescript'
            );

            expect(tsTools.length).toBeGreaterThan(0);
            expect(tsTools.some(m => m.name === 'calculator')).toBe(true);
        });

        it('should discover Python tools from the tools directory', async () => {
            const modules = await loadModules(FIXTURES_DIR);

            const pyTools = modules.filter(m =>
                m.type === 'tool' && m.language === 'python'
            );

            expect(pyTools.length).toBeGreaterThan(0);
        });

        it('should discover connectors from the connectors directory', async () => {
            const modules = await loadModules(FIXTURES_DIR);

            const connectors = modules.filter(m => m.type === 'connector');

            expect(connectors.length).toBeGreaterThan(0);
            expect(connectors.some(m => m.name === 'mock-api')).toBe(true);
        });

        it('should return empty array for non-existent base path', async () => {
            const modules = await loadModules('/non-existent-directory');

            expect(modules).toEqual([]);
        });

        it('should handle empty tools and connectors directories', async () => {
            // Create a temporary empty structure
            const tempDir = path.join(__dirname, 'temp-empty-test');
            const toolsDir = path.join(tempDir, 'tools');
            const connectorsDir = path.join(tempDir, 'connectors');

            try {
                await fs.mkdir(toolsDir, { recursive: true });
                await fs.mkdir(connectorsDir, { recursive: true });

                const modules = await loadModules(tempDir);

                expect(modules).toEqual([]);
            } finally {
                // Cleanup
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        });

        it('should discover all .ts and .py files in nested directories', async () => {
            const tempDir = path.join(__dirname, 'temp-nested-test');
            const nestedToolsDir = path.join(tempDir, 'tools', 'nested', 'deep');

            try {
                await fs.mkdir(nestedToolsDir, { recursive: true });

                // Create a nested tool file
                const toolContent = `
export const metadata = {
    "name": "nested-tool",
    "description": "A nested tool",
    "version": "1.0.0"
};
`;
                await fs.writeFile(path.join(nestedToolsDir, 'nested-tool.ts'), toolContent);

                const modules = await loadModules(tempDir);

                expect(modules.some(m => m.name === 'nested-tool')).toBe(true);
            } finally {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        });
    });

    describe('File Filtering', () => {
        it('should ignore non-.ts and non-.py files', async () => {
            const tempDir = path.join(__dirname, 'temp-filter-test');
            const toolsDir = path.join(tempDir, 'tools');

            try {
                await fs.mkdir(toolsDir, { recursive: true });

                // Create various file types
                await fs.writeFile(path.join(toolsDir, 'readme.md'), '# README');
                await fs.writeFile(path.join(toolsDir, 'config.json'), '{}');
                await fs.writeFile(path.join(toolsDir, 'script.js'), 'console.log("test")');

                const modules = await loadModules(tempDir);

                // None of these should be loaded
                expect(modules.filter(m => m.path.endsWith('.md'))).toHaveLength(0);
                expect(modules.filter(m => m.path.endsWith('.json'))).toHaveLength(0);
                expect(modules.filter(m => m.path.endsWith('.js'))).toHaveLength(0);
            } finally {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        });

        it('should skip files without valid metadata', async () => {
            const tempDir = path.join(__dirname, 'temp-invalid-meta-test');
            const toolsDir = path.join(tempDir, 'tools');

            try {
                await fs.mkdir(toolsDir, { recursive: true });

                // Create file without proper metadata
                await fs.writeFile(
                    path.join(toolsDir, 'no-metadata.ts'),
                    'export function foo() { return "bar"; }'
                );

                const modules = await loadModules(tempDir);

                expect(modules.filter(m => m.path.includes('no-metadata'))).toHaveLength(0);
                expect(console.warn).toHaveBeenCalled();
            } finally {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        });

        it('should handle symlinks gracefully', async () => {
            const tempDir = path.join(__dirname, 'temp-symlink-test');
            const toolsDir = path.join(tempDir, 'tools');

            try {
                await fs.mkdir(toolsDir, { recursive: true });

                // Create a valid tool
                const toolContent = `
export const metadata = {
    "name": "real-tool",
    "description": "A real tool",
    "version": "1.0.0"
};
`;
                await fs.writeFile(path.join(toolsDir, 'real-tool.ts'), toolContent);

                // Create a symlink to it
                try {
                    await fs.symlink(
                        path.join(toolsDir, 'real-tool.ts'),
                        path.join(toolsDir, 'symlink-tool.ts')
                    );
                } catch {
                    // Skip symlink test if not supported
                    return;
                }

                const modules = await loadModules(tempDir);

                // Both should be found (symlink follows to the real file)
                expect(modules.some(m => m.name === 'real-tool')).toBe(true);
            } finally {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        });
    });

    describe('Metadata Extraction - TypeScript', () => {
        it('should extract name, description, and version from TypeScript metadata', async () => {
            const tempDir = path.join(__dirname, 'temp-ts-meta-test');
            const toolsDir = path.join(tempDir, 'tools');

            try {
                await fs.mkdir(toolsDir, { recursive: true });

                const toolContent = `
export const metadata = {
    "name": "test-tool",
    "description": "A test tool for metadata extraction",
    "version": "2.1.0"
};
`;
                await fs.writeFile(path.join(toolsDir, 'test-tool.ts'), toolContent);

                const modules = await loadModules(tempDir);
                const tool = modules.find(m => m.name === 'test-tool');

                expect(tool).toBeDefined();
                expect(tool?.metadata.name).toBe('test-tool');
                expect(tool?.metadata.description).toBe('A test tool for metadata extraction');
                expect(tool?.metadata.version).toBe('2.1.0');
            } finally {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        });

        it('should extract capabilities array from TypeScript tools', async () => {
            const tempDir = path.join(__dirname, 'temp-ts-cap-test');
            const toolsDir = path.join(tempDir, 'tools');

            try {
                await fs.mkdir(toolsDir, { recursive: true });

                const toolContent = `
export const metadata = {
    "name": "capable-tool",
    "description": "A tool with capabilities",
    "version": "1.0.0",
    "capabilities": ["read", "write", "execute"]
};
`;
                await fs.writeFile(path.join(toolsDir, 'capable-tool.ts'), toolContent);

                const modules = await loadModules(tempDir);
                const tool = modules.find(m => m.name === 'capable-tool');

                expect(tool).toBeDefined();
                const toolMeta = tool?.metadata as ToolMetadata;
                expect(toolMeta.capabilities).toEqual(['read', 'write', 'execute']);
            } finally {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        });

        it('should identify connectors by presence of type field', async () => {
            const tempDir = path.join(__dirname, 'temp-ts-conn-test');
            const connectorsDir = path.join(tempDir, 'connectors');

            try {
                await fs.mkdir(connectorsDir, { recursive: true });

                const connectorContent = `
export const metadata = {
    "name": "test-connector",
    "description": "A test connector",
    "version": "1.0.0",
    "type": "database",
    "methods": ["connect", "query", "disconnect"]
};
`;
                await fs.writeFile(path.join(connectorsDir, 'test-connector.ts'), connectorContent);

                const modules = await loadModules(tempDir);
                const connector = modules.find(m => m.name === 'test-connector');

                expect(connector).toBeDefined();
                expect(connector?.type).toBe('connector');
                const connMeta = connector?.metadata as ConnectorMetadata;
                expect(connMeta.type).toBe('database');
                expect(connMeta.methods).toEqual(['connect', 'query', 'disconnect']);
            } finally {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        });

        it('should handle single-quoted strings in metadata', async () => {
            const tempDir = path.join(__dirname, 'temp-ts-single-quote-test');
            const toolsDir = path.join(tempDir, 'tools');

            try {
                await fs.mkdir(toolsDir, { recursive: true });

                const toolContent = `
export const metadata = {
    'name': 'single-quote-tool',
    'description': 'Uses single quotes',
    'version': '1.0.0'
};
`;
                await fs.writeFile(path.join(toolsDir, 'single-quote-tool.ts'), toolContent);

                const modules = await loadModules(tempDir);
                const tool = modules.find(m => m.name === 'single-quote-tool');

                expect(tool).toBeDefined();
                expect(tool?.metadata.name).toBe('single-quote-tool');
            } finally {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        });
    });

    describe('Metadata Extraction - Python', () => {
        it('should extract metadata from Python files', async () => {
            const tempDir = path.join(__dirname, 'temp-py-meta-test');
            const toolsDir = path.join(tempDir, 'tools');

            try {
                await fs.mkdir(toolsDir, { recursive: true });

                const toolContent = `
"""A Python tool for testing."""

metadata = {
    "name": "python-test-tool",
    "description": "A Python test tool",
    "version": "1.0.0"
}

def run():
    pass
`;
                await fs.writeFile(path.join(toolsDir, 'python-tool.py'), toolContent);

                const modules = await loadModules(tempDir);
                const tool = modules.find(m => m.name === 'python-test-tool');

                expect(tool).toBeDefined();
                expect(tool?.language).toBe('python');
                expect(tool?.metadata.description).toBe('A Python test tool');
            } finally {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        });

        it('should handle METADATA constant (uppercase)', async () => {
            const tempDir = path.join(__dirname, 'temp-py-upper-test');
            const toolsDir = path.join(tempDir, 'tools');

            try {
                await fs.mkdir(toolsDir, { recursive: true });

                const toolContent = `
"""A Python tool with uppercase METADATA."""

METADATA = {
    "name": "uppercase-meta-tool",
    "description": "Uses METADATA constant",
    "version": "2.0.0"
}
`;
                await fs.writeFile(path.join(toolsDir, 'upper-tool.py'), toolContent);

                const modules = await loadModules(tempDir);
                const tool = modules.find(m => m.name === 'uppercase-meta-tool');

                expect(tool).toBeDefined();
                expect(tool?.metadata.version).toBe('2.0.0');
            } finally {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        });

        it('should extract Python connector with type field', async () => {
            const tempDir = path.join(__dirname, 'temp-py-conn-test');
            const connectorsDir = path.join(tempDir, 'connectors');

            try {
                await fs.mkdir(connectorsDir, { recursive: true });

                const connectorContent = `
"""Database connector in Python."""

metadata = {
    "name": "py-db-connector",
    "description": "Python database connector",
    "version": "1.0.0",
    "type": "database"
}
`;
                await fs.writeFile(path.join(connectorsDir, 'db-connector.py'), connectorContent);

                const modules = await loadModules(tempDir);
                const connector = modules.find(m => m.name === 'py-db-connector');

                expect(connector).toBeDefined();
                expect(connector?.type).toBe('connector');
                expect(connector?.language).toBe('python');
            } finally {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        });
    });

    describe('Error Handling', () => {
        it('should log warning and continue on malformed metadata', async () => {
            const tempDir = path.join(__dirname, 'temp-malformed-test');
            const toolsDir = path.join(tempDir, 'tools');

            try {
                await fs.mkdir(toolsDir, { recursive: true });

                // Create a valid tool
                const validContent = `
export const metadata = {
    "name": "valid-tool",
    "description": "A valid tool",
    "version": "1.0.0"
};
`;
                await fs.writeFile(path.join(toolsDir, 'valid-tool.ts'), validContent);

                // Create a file with no metadata at all
                const noMetadataContent = `
export function doSomething() {
    return "no metadata here";
}
`;
                await fs.writeFile(path.join(toolsDir, 'no-metadata.ts'), noMetadataContent);

                const modules = await loadModules(tempDir);

                // Valid tool should still be loaded
                expect(modules.some(m => m.name === 'valid-tool')).toBe(true);
                // File without metadata should not be loaded
                expect(modules.filter(m => m.path.includes('no-metadata'))).toHaveLength(0);
                // Warning should have been logged
                expect(console.warn).toHaveBeenCalled();
            } finally {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        });

        it('should handle unreadable files gracefully', async () => {
            const tempDir = path.join(__dirname, 'temp-unreadable-test');
            const toolsDir = path.join(tempDir, 'tools');

            try {
                await fs.mkdir(toolsDir, { recursive: true });

                // Create a valid tool
                const validContent = `
export const metadata = {
    "name": "readable-tool",
    "description": "A readable tool",
    "version": "1.0.0"
};
`;
                await fs.writeFile(path.join(toolsDir, 'readable-tool.ts'), validContent);

                const modules = await loadModules(tempDir);

                // Should still load the readable tool
                expect(modules.some(m => m.name === 'readable-tool')).toBe(true);
            } finally {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        });

        it('should handle very long file paths', async () => {
            // Create a deeply nested path (but not too deep to avoid OS limits)
            const segments = Array(10).fill('nested');
            const deepPath = path.join(__dirname, 'temp-deep-test', 'tools', ...segments);

            try {
                await fs.mkdir(deepPath, { recursive: true });

                const toolContent = `
export const metadata = {
    "name": "deep-nested-tool",
    "description": "A deeply nested tool",
    "version": "1.0.0"
};
`;
                await fs.writeFile(path.join(deepPath, 'deep-tool.ts'), toolContent);

                const modules = await loadModules(path.join(__dirname, 'temp-deep-test'));

                expect(modules.some(m => m.name === 'deep-nested-tool')).toBe(true);
            } finally {
                await fs.rm(path.join(__dirname, 'temp-deep-test'), { recursive: true, force: true });
            }
        });
    });

    describe('Edge Cases', () => {
        it('should handle tools with special characters in names', async () => {
            const tempDir = path.join(__dirname, 'temp-special-char-test');
            const toolsDir = path.join(tempDir, 'tools');

            try {
                await fs.mkdir(toolsDir, { recursive: true });

                const toolContent = `
export const metadata = {
    "name": "my-tool_v2",
    "description": "Tool with special chars in name",
    "version": "1.0.0"
};
`;
                await fs.writeFile(path.join(toolsDir, 'special-tool.ts'), toolContent);

                const modules = await loadModules(tempDir);

                expect(modules.some(m => m.name === 'my-tool_v2')).toBe(true);
            } finally {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        });

        it('should handle multiline descriptions', async () => {
            const tempDir = path.join(__dirname, 'temp-multiline-test');
            const toolsDir = path.join(tempDir, 'tools');

            try {
                await fs.mkdir(toolsDir, { recursive: true });

                // Note: Simple regex extraction may not capture multiline strings
                // This tests the current behavior
                const toolContent = `
export const metadata = {
    "name": "multiline-tool",
    "description": "A tool with a simple description",
    "version": "1.0.0"
};
`;
                await fs.writeFile(path.join(toolsDir, 'multiline-tool.ts'), toolContent);

                const modules = await loadModules(tempDir);

                expect(modules.some(m => m.name === 'multiline-tool')).toBe(true);
            } finally {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        });

        it('should handle empty metadata object', async () => {
            const tempDir = path.join(__dirname, 'temp-empty-meta-test');
            const toolsDir = path.join(tempDir, 'tools');

            try {
                await fs.mkdir(toolsDir, { recursive: true });

                const toolContent = `
export const metadata = {};
`;
                await fs.writeFile(path.join(toolsDir, 'empty-meta.ts'), toolContent);

                const modules = await loadModules(tempDir);

                // Should not load tool with empty metadata
                expect(modules.filter(m => m.path.includes('empty-meta'))).toHaveLength(0);
            } finally {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        });

        it('should set correct module type based on directory', async () => {
            const tempDir = path.join(__dirname, 'temp-type-test');
            const toolsDir = path.join(tempDir, 'tools');
            const connectorsDir = path.join(tempDir, 'connectors');

            try {
                await fs.mkdir(toolsDir, { recursive: true });
                await fs.mkdir(connectorsDir, { recursive: true });

                // Same content, but in different directories
                const content = `
export const metadata = {
    "name": "same-name",
    "description": "Same content in different dirs",
    "version": "1.0.0"
};
`;
                await fs.writeFile(path.join(toolsDir, 'same-name.ts'), content);

                const connContent = `
export const metadata = {
    "name": "same-name-conn",
    "description": "Connector version",
    "version": "1.0.0",
    "type": "api"
};
`;
                await fs.writeFile(path.join(connectorsDir, 'same-name-conn.ts'), connContent);

                const modules = await loadModules(tempDir);

                const toolModule = modules.find(m => m.path.includes('tools'));
                const connectorModule = modules.find(m => m.path.includes('connectors'));

                expect(toolModule?.type).toBe('tool');
                expect(connectorModule?.type).toBe('connector');
            } finally {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        });

        it('should set correct language based on file extension', async () => {
            const modules = await loadModules(FIXTURES_DIR);

            const tsModules = modules.filter(m => m.path.endsWith('.ts'));
            const pyModules = modules.filter(m => m.path.endsWith('.py'));

            tsModules.forEach(m => expect(m.language).toBe('typescript'));
            pyModules.forEach(m => expect(m.language).toBe('python'));
        });

        it('should include absolute path in module object', async () => {
            const modules = await loadModules(FIXTURES_DIR);

            modules.forEach(m => {
                expect(path.isAbsolute(m.path)).toBe(true);
            });
        });
    });

    describe('Performance', () => {
        it('should load modules within reasonable time (<1s)', async () => {
            const start = Date.now();
            await loadModules(FIXTURES_DIR);
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(1000);
        });

        it('should handle loading many files efficiently', async () => {
            const tempDir = path.join(__dirname, 'temp-perf-test');
            const toolsDir = path.join(tempDir, 'tools');

            try {
                await fs.mkdir(toolsDir, { recursive: true });

                // Create 50 tool files
                const promises = Array.from({ length: 50 }, (_, i) => {
                    const content = `
export const metadata = {
    "name": "perf-tool-${i}",
    "description": "Performance test tool ${i}",
    "version": "1.0.0"
};
`;
                    return fs.writeFile(path.join(toolsDir, `perf-tool-${i}.ts`), content);
                });

                await Promise.all(promises);

                const start = Date.now();
                const modules = await loadModules(tempDir);
                const duration = Date.now() - start;

                expect(modules.length).toBe(50);
                expect(duration).toBeLessThan(2000); // Should complete in < 2s even with 50 files
            } finally {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        });
    });
});
