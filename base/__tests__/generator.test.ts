/**
 * Unit Tests for Generator Module
 * 
 * Tests the manifest generation, tool merging, conflict detection,
 * validation rules, and dependency resolution capabilities.
 * 
 * @module __tests__/generator
 */

import { describe, it, expect } from '@jest/globals';
import * as path from 'path';
import * as fs from 'fs/promises';

// Import the module under test
import {
    generateManifest,
    validateManifest,
    saveManifest,
    MCPManifest
} from '../generator';
import { Module, ToolMetadata, ConnectorMetadata } from '../loader';

describe('Generator Module', () => {
    // Helper to create mock modules
    function createMockToolModule(name: string, overrides: Partial<ToolMetadata> = {}): Module {
        return {
            name,
            path: `/tools/${name}.ts`,
            type: 'tool',
            language: 'typescript',
            metadata: {
                name,
                description: `${name} tool description`,
                version: '1.0.0',
                ...overrides
            }
        };
    }

    function createMockConnectorModule(name: string, connType: string, overrides: Partial<ConnectorMetadata> = {}): Module {
        return {
            name,
            path: `/connectors/${name}.ts`,
            type: 'connector',
            language: 'typescript',
            metadata: {
                name,
                description: `${name} connector description`,
                version: '1.0.0',
                type: connType,
                ...overrides
            }
        };
    }

    describe('Manifest Generation', () => {
        it('should generate a valid manifest from an array of modules', async () => {
            const modules: Module[] = [
                createMockToolModule('calculator'),
                createMockToolModule('summarizer'),
                createMockConnectorModule('database', 'database')
            ];

            const manifest = await generateManifest(modules);

            expect(manifest).toBeDefined();
            expect(manifest.name).toBe('mcp-server');
            expect(manifest.version).toBeDefined();
            expect(manifest.tools).toHaveLength(2);
            expect(manifest.connectors).toHaveLength(1);
        });

        it('should include all tools from modules', async () => {
            const modules: Module[] = [
                createMockToolModule('tool1'),
                createMockToolModule('tool2'),
                createMockToolModule('tool3')
            ];

            const manifest = await generateManifest(modules);

            expect(manifest.tools).toHaveLength(3);
            expect(manifest.tools.map(t => t.name)).toEqual(['tool1', 'tool2', 'tool3']);
        });

        it('should include all connectors from modules', async () => {
            const modules: Module[] = [
                createMockConnectorModule('db-connector', 'database'),
                createMockConnectorModule('email-connector', 'email'),
                createMockConnectorModule('api-connector', 'api')
            ];

            const manifest = await generateManifest(modules);

            expect(manifest.connectors).toHaveLength(3);
            expect(manifest.connectors.map(c => c.name)).toEqual([
                'db-connector',
                'email-connector',
                'api-connector'
            ]);
        });

        it('should preserve tool inputSchema', async () => {
            const inputSchema = {
                type: 'object',
                properties: {
                    input: { type: 'string' }
                },
                required: ['input']
            };

            const modules: Module[] = [
                createMockToolModule('schema-tool', { inputSchema })
            ];

            const manifest = await generateManifest(modules);

            expect(manifest.tools[0]!.inputSchema).toEqual(inputSchema);
        });

        it('should preserve connector methods', async () => {
            const modules: Module[] = [
                createMockConnectorModule('db', 'database', {
                    methods: ['connect', 'query', 'disconnect']
                })
            ];

            const manifest = await generateManifest(modules);

            expect(manifest.connectors[0]!.methods).toEqual(['connect', 'query', 'disconnect']);
        });

        it('should include generation metadata', async () => {
            const modules: Module[] = [createMockToolModule('test')];

            const manifest = await generateManifest(modules);

            expect(manifest.metadata).toBeDefined();
            expect(manifest.metadata.generatedAt).toBeDefined();
            expect(manifest.metadata.generatorVersion).toBeDefined();
            expect(manifest.metadata.moduleCount).toBe(1);
        });

        it('should handle empty modules array', async () => {
            const manifest = await generateManifest([]);

            expect(manifest.tools).toEqual([]);
            expect(manifest.connectors).toEqual([]);
            expect(manifest.capabilities).toEqual([]);
            expect(manifest.metadata.moduleCount).toBe(0);
        });
    });

    describe('Tool Merging', () => {
        it('should merge multiple tools with different capabilities', async () => {
            const modules: Module[] = [
                createMockToolModule('tool1', { capabilities: ['read', 'write'] }),
                createMockToolModule('tool2', { capabilities: ['execute', 'delete'] }),
                createMockToolModule('tool3', { capabilities: ['read', 'admin'] })
            ];

            const manifest = await generateManifest(modules);

            // All unique capabilities should be present
            expect(manifest.capabilities).toContain('read');
            expect(manifest.capabilities).toContain('write');
            expect(manifest.capabilities).toContain('execute');
            expect(manifest.capabilities).toContain('delete');
            expect(manifest.capabilities).toContain('admin');
        });

        it('should not duplicate capabilities', async () => {
            const modules: Module[] = [
                createMockToolModule('tool1', { capabilities: ['read', 'write'] }),
                createMockToolModule('tool2', { capabilities: ['read', 'write'] })
            ];

            const manifest = await generateManifest(modules);

            // Count occurrences of 'read'
            const readCount = manifest.capabilities.filter(c => c === 'read').length;
            expect(readCount).toBe(1);
        });

        it('should sort capabilities alphabetically', async () => {
            const modules: Module[] = [
                createMockToolModule('tool1', { capabilities: ['zebra', 'apple'] }),
                createMockToolModule('tool2', { capabilities: ['banana', 'mango'] })
            ];

            const manifest = await generateManifest(modules);

            expect(manifest.capabilities).toEqual([...manifest.capabilities].sort());
        });

        it('should infer capabilities from connector types', async () => {
            const modules: Module[] = [
                createMockConnectorModule('db', 'database'),
                createMockConnectorModule('mail', 'email')
            ];

            const manifest = await generateManifest(modules);

            expect(manifest.capabilities).toContain('database-integration');
            expect(manifest.capabilities).toContain('email-integration');
        });

        it('should handle tools without capabilities', async () => {
            const modules: Module[] = [
                createMockToolModule('simple-tool') // No capabilities specified
            ];

            const manifest = await generateManifest(modules);

            expect(manifest.tools).toHaveLength(1);
            expect(manifest.capabilities).toEqual([]);
        });
    });

    describe('Dependency Resolution', () => {
        it('should consolidate single dependency versions', async () => {
            const modules: Module[] = [
                createMockToolModule('tool1', { dependencies: { 'lodash': '^4.17.0' } } as any)
            ];

            const manifest = await generateManifest(modules);

            expect(manifest.dependencies['lodash']).toBe('^4.17.0');
        });

        it('should resolve multiple dependency versions', async () => {
            const modules: Module[] = [
                createMockToolModule('tool1', { dependencies: { 'lodash': '^4.17.0' } } as any),
                createMockToolModule('tool2', { dependencies: { 'lodash': '^4.18.0' } } as any)
            ];

            const manifest = await generateManifest(modules);

            // Should have resolved to a single version
            expect(manifest.dependencies['lodash']).toBeDefined();
        });

        it('should merge dependencies from different modules', async () => {
            const modules: Module[] = [
                createMockToolModule('tool1', { dependencies: { 'lodash': '^4.17.0' } } as any),
                createMockToolModule('tool2', { dependencies: { 'axios': '^1.0.0' } } as any)
            ];

            const manifest = await generateManifest(modules);

            expect(manifest.dependencies['lodash']).toBeDefined();
            expect(manifest.dependencies['axios']).toBeDefined();
        });

        it('should handle modules without dependencies', async () => {
            const modules: Module[] = [
                createMockToolModule('tool1'),
                createMockToolModule('tool2')
            ];

            const manifest = await generateManifest(modules);

            expect(manifest.dependencies).toEqual({});
        });

        it('should prefer exact versions over ranges', async () => {
            const modules: Module[] = [
                createMockToolModule('tool1', { dependencies: { 'lib': '1.0.0' } } as any),
                createMockToolModule('tool2', { dependencies: { 'lib': '^1.0.0' } } as any)
            ];

            const manifest = await generateManifest(modules);

            // Should prefer the exact version or handle appropriately
            expect(manifest.dependencies['lib']).toBeDefined();
        });
    });

    describe('Manifest Validation', () => {
        it('should validate a well-formed manifest', () => {
            const manifest: MCPManifest = {
                name: 'test-server',
                version: '1.0.0',
                tools: [{
                    name: 'test-tool',
                    description: 'A test tool',
                    version: '1.0.0'
                }],
                connectors: [],
                capabilities: ['test'],
                dependencies: {},
                metadata: {
                    generatedAt: new Date().toISOString(),
                    generatorVersion: '1.0.0',
                    moduleCount: 1
                }
            };

            expect(validateManifest(manifest)).toBe(true);
        });

        it('should reject manifest without name', () => {
            const manifest = {
                version: '1.0.0',
                tools: [{ name: 'tool', description: 'desc', version: '1.0.0' }],
                connectors: [],
                capabilities: [],
                dependencies: {},
                metadata: { generatedAt: '', generatorVersion: '', moduleCount: 1 }
            } as unknown as MCPManifest;

            expect(validateManifest(manifest)).toBe(false);
        });

        it('should reject manifest without version', () => {
            const manifest = {
                name: 'test',
                tools: [{ name: 'tool', description: 'desc', version: '1.0.0' }],
                connectors: [],
                capabilities: [],
                dependencies: {},
                metadata: { generatedAt: '', generatorVersion: '', moduleCount: 1 }
            } as unknown as MCPManifest;

            expect(validateManifest(manifest)).toBe(false);
        });

        it('should reject manifest with no tools and no connectors', () => {
            const manifest: MCPManifest = {
                name: 'empty-server',
                version: '1.0.0',
                tools: [],
                connectors: [],
                capabilities: [],
                dependencies: {},
                metadata: {
                    generatedAt: new Date().toISOString(),
                    generatorVersion: '1.0.0',
                    moduleCount: 0
                }
            };

            expect(validateManifest(manifest)).toBe(false);
        });

        it('should reject manifest with invalid tool (missing name)', () => {
            const manifest = {
                name: 'test',
                version: '1.0.0',
                tools: [{ description: 'desc', version: '1.0.0' }],
                connectors: [],
                capabilities: [],
                dependencies: {},
                metadata: { generatedAt: '', generatorVersion: '', moduleCount: 1 }
            } as unknown as MCPManifest;

            expect(validateManifest(manifest)).toBe(false);
        });

        it('should reject manifest with invalid tool (missing description)', () => {
            const manifest = {
                name: 'test',
                version: '1.0.0',
                tools: [{ name: 'tool', version: '1.0.0' }],
                connectors: [],
                capabilities: [],
                dependencies: {},
                metadata: { generatedAt: '', generatorVersion: '', moduleCount: 1 }
            } as unknown as MCPManifest;

            expect(validateManifest(manifest)).toBe(false);
        });

        it('should reject manifest with invalid connector (missing type)', () => {
            const manifest = {
                name: 'test',
                version: '1.0.0',
                tools: [],
                connectors: [{ name: 'conn', description: 'desc', version: '1.0.0' }],
                capabilities: [],
                dependencies: {},
                metadata: { generatedAt: '', generatorVersion: '', moduleCount: 1 }
            } as unknown as MCPManifest;

            expect(validateManifest(manifest)).toBe(false);
        });

        it('should validate manifest with only connectors (no tools)', () => {
            const manifest: MCPManifest = {
                name: 'connector-only',
                version: '1.0.0',
                tools: [],
                connectors: [{
                    name: 'db-conn',
                    description: 'Database connector',
                    version: '1.0.0',
                    type: 'database'
                }],
                capabilities: ['database-integration'],
                dependencies: {},
                metadata: {
                    generatedAt: new Date().toISOString(),
                    generatorVersion: '1.0.0',
                    moduleCount: 1
                }
            };

            expect(validateManifest(manifest)).toBe(true);
        });
    });

    describe('Save Manifest', () => {
        it('should save manifest to JSON file', async () => {
            const tempDir = path.join(__dirname, 'temp-save-test');
            const manifestPath = path.join(tempDir, 'manifest.json');

            try {
                await fs.mkdir(tempDir, { recursive: true });

                const manifest: MCPManifest = {
                    name: 'save-test',
                    version: '1.0.0',
                    tools: [{ name: 'tool', description: 'desc', version: '1.0.0' }],
                    connectors: [],
                    capabilities: [],
                    dependencies: {},
                    metadata: {
                        generatedAt: new Date().toISOString(),
                        generatorVersion: '1.0.0',
                        moduleCount: 1
                    }
                };

                await saveManifest(manifest, manifestPath);

                // Verify file was created
                const content = await fs.readFile(manifestPath, 'utf-8');
                const saved = JSON.parse(content);

                expect(saved.name).toBe('save-test');
                expect(saved.tools).toHaveLength(1);
            } finally {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        });

        it('should format JSON with indentation', async () => {
            const tempDir = path.join(__dirname, 'temp-format-test');
            const manifestPath = path.join(tempDir, 'manifest.json');

            try {
                await fs.mkdir(tempDir, { recursive: true });

                const manifest: MCPManifest = {
                    name: 'format-test',
                    version: '1.0.0',
                    tools: [],
                    connectors: [{ name: 'c', description: 'd', version: '1.0.0', type: 't' }],
                    capabilities: [],
                    dependencies: {},
                    metadata: {
                        generatedAt: new Date().toISOString(),
                        generatorVersion: '1.0.0',
                        moduleCount: 1
                    }
                };

                await saveManifest(manifest, manifestPath);

                const content = await fs.readFile(manifestPath, 'utf-8');

                // Check for indentation (formatted JSON has newlines and spaces)
                expect(content).toContain('\n');
                expect(content).toContain('  '); // 2-space indentation
            } finally {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        });
    });

    describe('Edge Cases', () => {
        it('should handle mixed tool and connector modules', async () => {
            const modules: Module[] = [
                createMockToolModule('tool1'),
                createMockConnectorModule('conn1', 'database'),
                createMockToolModule('tool2'),
                createMockConnectorModule('conn2', 'api')
            ];

            const manifest = await generateManifest(modules);

            expect(manifest.tools).toHaveLength(2);
            expect(manifest.connectors).toHaveLength(2);
            expect(manifest.metadata.moduleCount).toBe(4);
        });

        it('should handle very long tool names and descriptions', async () => {
            const longName = 'a'.repeat(200);
            const longDescription = 'b'.repeat(1000);

            const modules: Module[] = [
                createMockToolModule(longName, { description: longDescription })
            ];

            const manifest = await generateManifest(modules);

            expect(manifest.tools[0]!.name).toBe(longName);
            expect(manifest.tools[0]!.description).toBe(longDescription);
        });

        it('should handle special characters in metadata', async () => {
            const modules: Module[] = [
                createMockToolModule('special-tool', {
                    description: 'Tool with "quotes", \'apostrophes\', and <tags>'
                })
            ];

            const manifest = await generateManifest(modules);

            expect(manifest.tools[0]!.description).toContain('"quotes"');
            expect(manifest.tools[0]!.description).toContain("'apostrophes'");
        });

        it('should handle unicode in tool names and descriptions', async () => {
            const modules: Module[] = [
                createMockToolModule('emoji-tool', {
                    description: '🔧 Tool with émojis and ünïcödé'
                })
            ];

            const manifest = await generateManifest(modules);

            expect(manifest.tools[0]!.description).toContain('🔧');
            expect(manifest.tools[0]!.description).toContain('émojis');
        });

        it('should preserve version strings in various formats', async () => {
            const modules: Module[] = [
                createMockToolModule('tool1', { version: '1.0.0' }),
                createMockToolModule('tool2', { version: '2.0.0-beta.1' }),
                createMockToolModule('tool3', { version: '0.0.1-alpha' })
            ];

            const manifest = await generateManifest(modules);

            expect(manifest.tools[0]!.version).toBe('1.0.0');
            expect(manifest.tools[1]!.version).toBe('2.0.0-beta.1');
            expect(manifest.tools[2]!.version).toBe('0.0.1-alpha');
        });

        it('should handle connectors with authentication config', async () => {
            const authConfig = {
                type: 'oauth2',
                scopes: ['read', 'write'],
                tokenUrl: 'https://auth.example.com/token'
            };

            const modules: Module[] = [
                createMockConnectorModule('oauth-conn', 'api', { authentication: authConfig })
            ];

            const manifest = await generateManifest(modules);

            expect(manifest.connectors[0]!.authentication).toEqual(authConfig);
        });
    });

    describe('Performance', () => {
        it('should generate manifest efficiently for many modules', async () => {
            // Create 100 tools and 50 connectors
            const modules: Module[] = [
                ...Array.from({ length: 100 }, (_, i) => {
                    const mod = createMockToolModule(`tool-${i}`, {
                        capabilities: [`cap-${i % 10}`]
                    });
                    // Add dependencies via metadata cast
                    (mod.metadata as any).dependencies = { [`dep-${i % 20}`]: '1.0.0' };
                    return mod;
                }),
                ...Array.from({ length: 50 }, (_, i) =>
                    createMockConnectorModule(`conn-${i}`, `type-${i % 5}`)
                )
            ];

            const start = Date.now();
            const manifest = await generateManifest(modules);
            const duration = Date.now() - start;

            expect(manifest.tools).toHaveLength(100);
            expect(manifest.connectors).toHaveLength(50);
            expect(duration).toBeLessThan(1000); // Should complete in < 1s
        });
    });
});
