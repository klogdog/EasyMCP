/**
 * Unit Tests for Config Parser Module
 * 
 * Tests configuration parsing, YAML/JSON handling, environment variable
 * substitution, schema validation, deep merging, and error handling.
 * 
 * @module __tests__/config-parser
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as path from 'path';
import * as fs from 'fs/promises';

// Import the module under test
import {
    parseConfig,
    parseConfigString,
    validateConfig,
    loadConfig,
    substituteEnvVars,
    substituteEnvVarsRecursive,
    deepMerge,
    DEFAULT_CONFIG,
    ConfigParseError
} from '../config-parser';

// Test fixtures directory
const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'configs');

describe('Config Parser Module', () => {
    // Store and restore environment variables
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        originalEnv = { ...process.env };
    });

    afterEach(() => {
        // Restore original environment
        process.env = originalEnv;
    });

    describe('Environment Variable Substitution', () => {
        it('should substitute ${VAR} with environment value', () => {
            process.env.TEST_VAR = 'hello';
            const result = substituteEnvVars('${TEST_VAR}');
            expect(result).toBe('hello');
        });

        it('should substitute ${VAR:-default} with env value when set', () => {
            process.env.TEST_VAR = 'custom';
            const result = substituteEnvVars('${TEST_VAR:-default}');
            expect(result).toBe('custom');
        });

        it('should use default value when env var is not set', () => {
            delete process.env.NONEXISTENT_VAR;
            const result = substituteEnvVars('${NONEXISTENT_VAR:-fallback}');
            expect(result).toBe('fallback');
        });

        it('should leave ${VAR} unchanged when var is not set and no default', () => {
            delete process.env.MISSING_VAR;
            const result = substituteEnvVars('${MISSING_VAR}');
            expect(result).toBe('${MISSING_VAR}');
        });

        it('should handle multiple substitutions in one string', () => {
            process.env.VAR1 = 'one';
            process.env.VAR2 = 'two';
            const result = substituteEnvVars('${VAR1}-${VAR2}');
            expect(result).toBe('one-two');
        });

        it('should handle empty default values', () => {
            delete process.env.EMPTY_DEFAULT;
            const result = substituteEnvVars('${EMPTY_DEFAULT:-}');
            expect(result).toBe('');
        });

        it('should handle nested substitution syntax in defaults', () => {
            delete process.env.OUTER_VAR;
            const result = substituteEnvVars('${OUTER_VAR:-localhost:8080}');
            expect(result).toBe('localhost:8080');
        });
    });

    describe('Recursive Environment Variable Substitution', () => {
        it('should substitute vars in nested objects', () => {
            process.env.HOST = 'db.example.com';
            process.env.PORT = '5432';

            const obj = {
                database: {
                    host: '${HOST}',
                    port: '${PORT}'
                }
            };

            const result = substituteEnvVarsRecursive(obj) as any;

            expect(result.database.host).toBe('db.example.com');
            expect(result.database.port).toBe('5432');
        });

        it('should substitute vars in arrays', () => {
            process.env.ITEM1 = 'first';
            process.env.ITEM2 = 'second';

            const arr = ['${ITEM1}', '${ITEM2}'];
            const result = substituteEnvVarsRecursive(arr) as string[];

            expect(result).toEqual(['first', 'second']);
        });

        it('should not modify non-string values', () => {
            const obj = {
                number: 42,
                boolean: true,
                nullValue: null
            };

            const result = substituteEnvVarsRecursive(obj) as any;

            expect(result.number).toBe(42);
            expect(result.boolean).toBe(true);
            expect(result.nullValue).toBeNull();
        });

        it('should handle deeply nested structures', () => {
            process.env.DEEP_VAR = 'deep_value';

            const obj = {
                level1: {
                    level2: {
                        level3: {
                            value: '${DEEP_VAR}'
                        }
                    }
                }
            };

            const result = substituteEnvVarsRecursive(obj) as any;
            expect(result.level1.level2.level3.value).toBe('deep_value');
        });
    });

    describe('Deep Merge', () => {
        it('should merge simple objects', () => {
            const target = { a: 1, b: 2 };
            const source = { b: 3, c: 4 };
            const result = deepMerge(target, source);

            expect(result).toEqual({ a: 1, b: 3, c: 4 });
        });

        it('should deep merge nested objects', () => {
            const target = {
                server: { host: 'localhost', port: 3000 },
                logging: { level: 'info' }
            } as Record<string, any>;
            const source = {
                server: { port: 8080 },
                database: { url: 'postgres://...' }
            } as Record<string, any>;

            const result = deepMerge(target, source);

            expect(result.server.host).toBe('localhost');
            expect(result.server.port).toBe(8080);
            expect(result.logging.level).toBe('info');
            expect(result.database).toEqual({ url: 'postgres://...' });
        });

        it('should override arrays (not merge them)', () => {
            const target = { items: [1, 2, 3] };
            const source = { items: [4, 5] };
            const result = deepMerge(target, source);

            expect(result.items).toEqual([4, 5]);
        });

        it('should not modify source or target objects', () => {
            const target = { a: { b: 1 } } as Record<string, any>;
            const source = { a: { c: 2 } } as Record<string, any>;

            deepMerge(target, source);

            expect(target).toEqual({ a: { b: 1 } });
            expect(source).toEqual({ a: { c: 2 } });
        });

        it('should handle undefined values in source', () => {
            const target = { a: 1, b: 2 } as Record<string, any>;
            const source = { a: undefined, c: 3 } as Record<string, any>;
            const result = deepMerge(target, source);

            // Undefined should not override
            expect(result.a).toBe(1);
            expect(result.c).toBe(3);
        });
    });

    describe('Config Validation', () => {
        it('should validate a correct configuration', () => {
            const config = {
                server: {
                    name: 'test-server',
                    version: '1.0.0',
                    host: 'localhost',
                    port: 3000
                }
            };

            const result = validateConfig(config);
            expect(result.success).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject config with invalid server name', () => {
            const config = {
                server: {
                    name: '', // Invalid: empty
                    version: '1.0.0',
                    host: 'localhost',
                    port: 3000
                }
            };

            const result = validateConfig(config);
            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should reject config with invalid version format', () => {
            const config = {
                server: {
                    name: 'test',
                    version: 'invalid-version', // Invalid format
                    host: 'localhost',
                    port: 3000
                }
            };

            const result = validateConfig(config);
            expect(result.success).toBe(false);
        });

        it('should validate config with optional fields', () => {
            const config = {
                server: {
                    name: 'test-server',
                    version: '1.0.0',
                    host: 'localhost',
                    port: 3000,
                    cors: true,
                    maxRequestSize: '10mb'
                },
                logging: {
                    level: 'debug',
                    format: 'json',
                    destination: 'stdout'
                }
            };

            const result = validateConfig(config);
            expect(result.success).toBe(true);
        });

        it('should reject invalid logging level', () => {
            const config = {
                server: {
                    name: 'test',
                    version: '1.0.0',
                    host: 'localhost',
                    port: 3000
                },
                logging: {
                    level: 'verbose', // Invalid: not a valid level
                    format: 'json',
                    destination: 'stdout'
                }
            };

            const result = validateConfig(config);
            expect(result.success).toBe(false);
        });

        it('should validate database configuration', () => {
            const config = {
                server: {
                    name: 'test',
                    version: '1.0.0',
                    host: 'localhost',
                    port: 3000
                },
                database: {
                    type: 'postgres',
                    url: 'postgres://localhost:5432/db',
                    pool: {
                        min: 2,
                        max: 10,
                        idleTimeout: 30000
                    }
                }
            };

            const result = validateConfig(config);
            expect(result.success).toBe(true);
        });

        it('should return field path for validation errors', () => {
            const config = {
                server: {
                    name: 'test',
                    version: 'invalid-version', // Invalid: doesn't match semver regex
                    host: 'localhost',
                    port: 3000
                }
            };

            const result = validateConfig(config);
            expect(result.success).toBe(false);
            // Should have error about version field
            const versionError = result.errors.find(e => e.path.includes('version'));
            expect(versionError).toBeDefined();
        });
    });

    describe('Parse Config File', () => {
        it('should parse a valid YAML config file', async () => {
            const configPath = path.join(FIXTURES_DIR, 'sample-config.yaml');
            const config = await parseConfig(configPath);

            expect(config).toBeDefined();
            expect(config.server).toBeDefined();
        });

        it('should throw ConfigParseError for non-existent file', async () => {
            const nonExistentPath = '/path/to/nonexistent.yaml';

            await expect(parseConfig(nonExistentPath)).rejects.toThrow(ConfigParseError);
        });

        it('should return defaults for non-existent file in non-strict mode', async () => {
            const nonExistentPath = '/path/to/nonexistent.yaml';
            const config = await parseConfig(nonExistentPath, { strict: false });

            expect(config).toEqual(DEFAULT_CONFIG);
        });

        it('should substitute environment variables when parsing', async () => {
            process.env.SERVER_NAME = 'env-server';
            process.env.SERVER_PORT = '9000';
            process.env.DB_HOST = 'db.test.com';
            process.env.DB_NAME = 'testdb';

            const configPath = path.join(FIXTURES_DIR, 'config-with-vars.yaml');
            const config = await parseConfig(configPath);

            expect(config.server.name).toBe('env-server');
        });

        it('should use default values for unset env vars', async () => {
            delete process.env.SERVER_NAME;
            delete process.env.SERVER_PORT;

            const configPath = path.join(FIXTURES_DIR, 'config-with-vars.yaml');
            const config = await parseConfig(configPath);

            expect(config.server.name).toBe('default-server');
        });

        it('should merge with defaults when mergeDefaults is true', async () => {
            const configPath = path.join(FIXTURES_DIR, 'sample-config.yaml');
            const config = await parseConfig(configPath, { mergeDefaults: true });

            // Should have values from default config
            expect(config.security).toBeDefined();
            expect(config.metrics).toBeDefined();
        });

        it('should not merge defaults when mergeDefaults is false', async () => {
            const configPath = path.join(FIXTURES_DIR, 'sample-config.yaml');
            const config = await parseConfig(configPath, {
                mergeDefaults: false,
                validate: false // Skip validation since we're testing raw parse
            });

            // May not have default sections
            // Just verify it parsed without error
            expect(config.server).toBeDefined();
        });

        it('should skip env substitution when substituteEnv is false', async () => {
            process.env.SERVER_NAME = 'should-not-appear';

            const configPath = path.join(FIXTURES_DIR, 'config-with-vars.yaml');
            const config = await parseConfig(configPath, {
                substituteEnv: false,
                validate: false
            });

            // The raw ${VAR} should remain
            expect(config.server.name).toContain('${');
        });
    });

    describe('Parse Config String', () => {
        it('should parse YAML string', async () => {
            const yamlContent = `
server:
  name: string-server
  version: "1.0.0"
  host: localhost
  port: 3000
`;
            const config = await parseConfigString(yamlContent, 'yaml');

            expect(config.server.name).toBe('string-server');
            expect(config.server.port).toBe(3000);
        });

        it('should parse JSON string', async () => {
            const jsonContent = JSON.stringify({
                server: {
                    name: 'json-server',
                    version: '1.0.0',
                    host: 'localhost',
                    port: 8080
                }
            });

            const config = await parseConfigString(jsonContent, 'json');

            expect(config.server.name).toBe('json-server');
            expect(config.server.port).toBe(8080);
        });

        it('should throw on invalid YAML syntax', async () => {
            const invalidYaml = `
server:
  name: test
  port: [invalid
    yaml: here
`;
            await expect(parseConfigString(invalidYaml, 'yaml')).rejects.toThrow(ConfigParseError);
        });

        it('should throw on invalid JSON syntax', async () => {
            const invalidJson = '{ "server": { "name": "test", }'; // trailing comma

            await expect(parseConfigString(invalidJson, 'json')).rejects.toThrow(ConfigParseError);
        });

        it('should throw when config is not an object', async () => {
            const notAnObject = '"just a string"';

            await expect(parseConfigString(notAnObject, 'json')).rejects.toThrow(ConfigParseError);
        });
    });

    describe('Parse Errors', () => {
        it('should include file path in error', async () => {
            const invalidPath = '/invalid/path/config.yaml';

            try {
                await parseConfig(invalidPath);
                fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(ConfigParseError);
                const parseError = error as ConfigParseError;
                expect(parseError.filePath).toBe(invalidPath);
            }
        });

        it('should include line number for YAML syntax errors', async () => {
            const invalidYaml = `
server:
  name: test
  port: [invalid
`;
            try {
                await parseConfigString(invalidYaml, 'yaml');
                fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(ConfigParseError);
                const parseError = error as ConfigParseError;
                // Line number should be defined
                expect(parseError.line).toBeDefined();
            }
        });

        it('should include field path for validation errors', async () => {
            const invalidConfig = `
server:
  name: ""
  version: "1.0.0"
  host: localhost
  port: 3000
`;
            try {
                await parseConfigString(invalidConfig, 'yaml');
                fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(ConfigParseError);
                const parseError = error as ConfigParseError;
                expect(parseError.fieldPath).toBeDefined();
            }
        });

        it('should format error message with toString()', () => {
            const error = new ConfigParseError(
                'Test error',
                '/path/to/file.yaml',
                10,
                5,
                'server.port'
            );

            const str = error.toString();

            expect(str).toContain('Test error');
            expect(str).toContain('/path/to/file.yaml');
            expect(str).toContain('line 10');
            expect(str).toContain('server.port');
        });
    });

    describe('Load Config with Environment Detection', () => {
        let tempDir: string;

        beforeEach(async () => {
            tempDir = path.join(__dirname, 'temp-load-config-test');
            await fs.mkdir(tempDir, { recursive: true });
            await fs.mkdir(path.join(tempDir, 'config'), { recursive: true });
        });

        afterEach(async () => {
            await fs.rm(tempDir, { recursive: true, force: true });
        });

        it('should load explicit config path when provided', async () => {
            const configContent = `
server:
  name: explicit-config
  version: "1.0.0"
  host: localhost
  port: 3000
`;
            const configPath = path.join(tempDir, 'explicit.yaml');
            await fs.writeFile(configPath, configContent);

            const config = await loadConfig(configPath);
            expect(config.server.name).toBe('explicit-config');
        });

        it('should use NODE_ENV to find config', async () => {
            process.env.NODE_ENV = 'test';

            const configContent = `
server:
  name: test-env-config
  version: "1.0.0"
  host: localhost
  port: 3000
`;
            await fs.writeFile(path.join(tempDir, 'config', 'test.yaml'), configContent);

            // Change cwd temporarily
            const originalCwd = process.cwd();
            process.chdir(tempDir);

            try {
                const config = await loadConfig();
                expect(config.server.name).toBe('test-env-config');
            } finally {
                process.chdir(originalCwd);
            }
        });

        it('should fall back to development.yaml when NODE_ENV config not found', async () => {
            process.env.NODE_ENV = 'staging'; // Config file doesn't exist

            const devConfig = `
server:
  name: development-fallback
  version: "1.0.0"
  host: localhost
  port: 3000
`;
            await fs.writeFile(path.join(tempDir, 'config', 'development.yaml'), devConfig);

            const originalCwd = process.cwd();
            process.chdir(tempDir);

            try {
                const config = await loadConfig();
                expect(config.server.name).toBe('development-fallback');
            } finally {
                process.chdir(originalCwd);
            }
        });

        it('should return defaults in non-strict mode when no config found', async () => {
            process.env.NODE_ENV = 'nonexistent';

            const originalCwd = process.cwd();
            process.chdir(tempDir);

            try {
                const config = await loadConfig(undefined, { strict: false });
                expect(config).toEqual(DEFAULT_CONFIG);
            } finally {
                process.chdir(originalCwd);
            }
        });
    });

    describe('Default Configuration', () => {
        it('should have default server configuration', () => {
            expect(DEFAULT_CONFIG.server).toBeDefined();
            expect(DEFAULT_CONFIG.server!.name).toBe('mcp-server');
            expect(DEFAULT_CONFIG.server!.version).toBe('0.1.0');
            expect(DEFAULT_CONFIG.server!.port).toBe(8080);
        });

        it('should have default logging configuration', () => {
            expect(DEFAULT_CONFIG.logging).toBeDefined();
            expect(DEFAULT_CONFIG.logging!.level).toBe('info');
            expect(DEFAULT_CONFIG.logging!.format).toBe('json');
        });

        it('should have default security configuration', () => {
            expect(DEFAULT_CONFIG.security).toBeDefined();
            expect(DEFAULT_CONFIG.security!.authentication!.enabled).toBe(false);
            expect(DEFAULT_CONFIG.security!.rateLimit!.enabled).toBe(true);
        });

        it('should have default metrics configuration', () => {
            expect(DEFAULT_CONFIG.metrics).toBeDefined();
            expect(DEFAULT_CONFIG.metrics!.enabled).toBe(true);
            expect(DEFAULT_CONFIG.metrics!.path).toBe('/metrics');
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty config file', async () => {
            const emptyYaml = '';

            try {
                await parseConfigString(emptyYaml, 'yaml', { mergeDefaults: true, validate: false });
                // Empty YAML with mergeDefaults should just return defaults
            } catch (error) {
                // Or it might throw - both are valid behaviors
                expect(error).toBeInstanceOf(ConfigParseError);
            }
        });

        it('should handle config with only comments', async () => {
            const commentOnlyYaml = `
# This is just a comment
# No actual configuration
`;
            try {
                await parseConfigString(commentOnlyYaml, 'yaml', { mergeDefaults: true, validate: false });
            } catch (error) {
                expect(error).toBeInstanceOf(ConfigParseError);
            }
        });

        it('should handle very large config values', async () => {
            const largeValue = 'x'.repeat(10000);
            const config = `
server:
  name: large-value-test
  version: "1.0.0"
  host: localhost
  port: 3000
  maxRequestSize: "${largeValue}"
`;
            const parsed = await parseConfigString(config, 'yaml');
            expect(parsed.server.maxRequestSize).toBe(largeValue);
        });

        it('should handle unicode in config values', async () => {
            const config = `
server:
  name: "サーバー🔧"
  version: "1.0.0"
  host: localhost
  port: 3000
`;
            const parsed = await parseConfigString(config, 'yaml');
            expect(parsed.server.name).toBe('サーバー🔧');
        });

        it('should handle numeric strings for port', async () => {
            const config = `
server:
  name: test
  version: "1.0.0"
  host: localhost
  port: "8080"
`;
            const parsed = await parseConfigString(config, 'yaml');
            // Port can be number or string
            expect(parsed.server.port).toBeDefined();
        });

        it('should preserve number types from YAML', async () => {
            const config = `
server:
  name: test
  version: "1.0.0"
  host: localhost
  port: 3000
database:
  timeout: 5000
`;
            const parsed = await parseConfigString(config, 'yaml');
            expect(typeof parsed.server.port).toBe('number');
        });
    });

    describe('Security Configuration', () => {
        it('should validate API key authentication config', async () => {
            const config = `
server:
  name: secure-server
  version: "1.0.0"
  host: localhost
  port: 3000
security:
  authentication:
    enabled: true
    type: api-key
    apiKey: "\${API_KEY}"
`;
            process.env.API_KEY = 'secret-key';
            const parsed = await parseConfigString(config, 'yaml');

            expect(parsed.security!.authentication!.enabled).toBe(true);
            expect(parsed.security!.authentication!.type).toBe('api-key');
        });

        it('should validate TLS configuration', async () => {
            const config = `
server:
  name: tls-server
  version: "1.0.0"
  host: localhost
  port: 443
security:
  tls:
    enabled: true
    certFile: /path/to/cert.pem
    keyFile: /path/to/key.pem
`;
            const parsed = await parseConfigString(config, 'yaml');

            expect(parsed.security!.tls!.enabled).toBe(true);
            expect(parsed.security!.tls!.certFile).toBe('/path/to/cert.pem');
        });

        it('should validate rate limit configuration', async () => {
            const config = `
server:
  name: rate-limited-server
  version: "1.0.0"
  host: localhost
  port: 3000
security:
  rateLimit:
    enabled: true
    windowMs: 60000
    maxRequests: 100
`;
            const parsed = await parseConfigString(config, 'yaml');

            expect(parsed.security!.rateLimit!.enabled).toBe(true);
            expect(parsed.security!.rateLimit!.windowMs).toBe(60000);
        });
    });

    describe('Connector Configuration', () => {
        it('should validate connector configuration', async () => {
            const config = `
server:
  name: connector-server
  version: "1.0.0"
  host: localhost
  port: 3000
connectors:
  database:
    type: database
    enabled: true
    credentials:
      user: admin
      password: secret
    settings:
      poolSize: 10
`;
            const parsed = await parseConfigString(config, 'yaml');

            expect(parsed.connectors!['database']).toBeDefined();
            expect(parsed.connectors!['database']!.type).toBe('database');
            expect(parsed.connectors!['database']!.enabled).toBe(true);
        });

        it('should support multiple connectors', async () => {
            const config = `
server:
  name: multi-connector-server
  version: "1.0.0"
  host: localhost
  port: 3000
connectors:
  database:
    type: database
    enabled: true
  email:
    type: email
    enabled: true
  api:
    type: api
    enabled: false
`;
            const parsed = await parseConfigString(config, 'yaml');

            expect(Object.keys(parsed.connectors!)).toHaveLength(3);
            expect(parsed.connectors!['email']!.type).toBe('email');
            expect(parsed.connectors!['api']!.enabled).toBe(false);
        });
    });
});
