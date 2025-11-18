/**
 * Test Suite for Configuration Generator
 * 
 * Comprehensive tests for YAML configuration generation from MCP manifests
 */

import { generateConfig, validateConfig } from "./config-generator";
import { generateManifest } from "./generator";
import { loadModules } from "./loader";
import * as fs from "fs/promises";
import * as path from "path";

// ANSI color codes for output formatting
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const RESET = "\x1b[0m";

/**
 * Test result interface
 */
interface TestResult {
    name: string;
    passed: boolean;
    message: string;
}

/**
 * Main test runner
 */
async function runTests(): Promise<void> {
    console.log(`${BLUE}==================================${RESET}`);
    console.log(`${BLUE}Configuration Generator Test Suite${RESET}`);
    console.log(`${BLUE}==================================${RESET}\n`);

    const results: TestResult[] = [];

    // Load modules for testing
    const basePath = path.join(__dirname, "..");
    const modules = await loadModules(basePath);

    // Generate manifest for testing
    const manifest = await generateManifest(modules);

    // Run all tests
    results.push(await testGenerateDevelopmentConfig(manifest));
    results.push(await testGenerateProductionConfig(manifest));
    results.push(await testConnectorCredentials(manifest));
    results.push(await testFeatureFlags(manifest));
    results.push(await testDatabaseConfiguration(manifest));
    results.push(await testConfigValidation(manifest));
    results.push(await testEnvironmentVariableNames());
    results.push(await testSaveConfigFiles(manifest));

    // Print summary
    console.log(`\n${BLUE}==================================${RESET}`);
    console.log(`${BLUE}Test Summary${RESET}`);
    console.log(`${BLUE}==================================${RESET}\n`);

    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;

    console.log(`Total Tests: ${results.length}`);
    console.log(`${GREEN}Passed: ${passed}${RESET}`);
    if (failed > 0) {
        console.log(`${RED}Failed: ${failed}${RESET}`);
    }

    // Exit with appropriate code
    process.exit(failed > 0 ? 1 : 0);
}

/**
 * Test 1: Generate Development Config
 */
async function testGenerateDevelopmentConfig(manifest: any): Promise<TestResult> {
    const testName = "Test 1: Generate Development Config";
    console.log(`${YELLOW}Running: ${testName}${RESET}`);

    try {
        const config = await generateConfig(manifest, "development");

        // Verify YAML is generated
        if (!config || config.length === 0) {
            throw new Error("No config generated");
        }

        // Check for development-specific settings
        if (!config.includes("localhost")) {
            throw new Error("Missing localhost in development config");
        }

        if (!config.includes("port: 3000")) {
            throw new Error("Missing port 3000 in development config");
        }

        if (!config.includes('level: debug')) {
            throw new Error("Missing debug logging level");
        }

        if (!config.includes('format: pretty')) {
            throw new Error("Missing pretty log format");
        }

        console.log(`${GREEN}✓ ${testName}${RESET}`);
        return {
            name: testName,
            passed: true,
            message: "Development config generated with correct settings",
        };
    } catch (error) {
        console.log(`${RED}✗ ${testName}: ${error}${RESET}`);
        return {
            name: testName,
            passed: false,
            message: String(error),
        };
    }
}

/**
 * Test 2: Generate Production Config
 */
async function testGenerateProductionConfig(manifest: any): Promise<TestResult> {
    const testName = "Test 2: Generate Production Config";
    console.log(`${YELLOW}Running: ${testName}${RESET}`);

    try {
        const config = await generateConfig(manifest, "production");

        // Check for production-specific settings
        if (!config.includes("0.0.0.0")) {
            throw new Error("Missing 0.0.0.0 host in production config");
        }

        if (!config.includes("${PORT:-8080}")) {
            throw new Error("Missing environment variable for port");
        }

        if (!config.includes('level: info')) {
            throw new Error("Missing info logging level");
        }

        if (!config.includes('format: json')) {
            throw new Error("Missing json log format");
        }

        console.log(`${GREEN}✓ ${testName}${RESET}`);
        return {
            name: testName,
            passed: true,
            message: "Production config generated with correct settings",
        };
    } catch (error) {
        console.log(`${RED}✗ ${testName}: ${error}${RESET}`);
        return {
            name: testName,
            passed: false,
            message: String(error),
        };
    }
}

/**
 * Test 3: Connector Credentials
 */
async function testConnectorCredentials(manifest: any): Promise<TestResult> {
    const testName = "Test 3: Connector Credentials";
    console.log(`${YELLOW}Running: ${testName}${RESET}`);

    try {
        const config = await generateConfig(manifest, "production");

        // Check for environment variable placeholders
        const hasEnvVars = config.includes("${");
        if (!hasEnvVars) {
            throw new Error("No environment variables found");
        }

        // Check for connector-specific credentials
        if (config.includes("email")) {
            if (!config.includes("_API_KEY") && !config.includes("_FROM_EMAIL")) {
                throw new Error("Missing email connector credentials");
            }
        }

        if (config.includes("database")) {
            if (!config.includes("_URL") && !config.includes("_USERNAME")) {
                throw new Error("Missing database connector credentials");
            }
        }

        // Verify uppercase environment variable format
        const envVarRegex = /\$\{[A-Z_]+/g;
        const matches = config.match(envVarRegex);
        if (!matches || matches.length === 0) {
            throw new Error("Environment variables not in UPPERCASE_SNAKE_CASE format");
        }

        console.log(`${GREEN}✓ ${testName}${RESET}`);
        return {
            name: testName,
            passed: true,
            message: `Found ${matches.length} environment variable placeholders`,
        };
    } catch (error) {
        console.log(`${RED}✗ ${testName}: ${error}${RESET}`);
        return {
            name: testName,
            passed: false,
            message: String(error),
        };
    }
}

/**
 * Test 4: Feature Flags
 */
async function testFeatureFlags(manifest: any): Promise<TestResult> {
    const testName = "Test 4: Feature Flags";
    console.log(`${YELLOW}Running: ${testName}${RESET}`);

    try {
        const config = await generateConfig(manifest, "development");

        // Check for features section
        if (!config.includes("features:")) {
            throw new Error("Missing features section");
        }

        // Check that capabilities are converted to feature flags
        const capabilityCount = manifest.capabilities.length;
        if (capabilityCount === 0) {
            throw new Error("No capabilities in manifest");
        }

        // Count feature flags in config (look for "true" values in features section)
        const featuresSection = config.split("features:")[1]?.split("\n\n")[0];
        if (!featuresSection) {
            throw new Error("Features section is empty");
        }

        const featureCount = (featuresSection.match(/: true/g) || []).length;
        if (featureCount !== capabilityCount) {
            throw new Error(
                `Feature flag count (${featureCount}) doesn't match capability count (${capabilityCount})`
            );
        }

        console.log(`${GREEN}✓ ${testName}${RESET}`);
        return {
            name: testName,
            passed: true,
            message: `All ${capabilityCount} capabilities converted to feature flags`,
        };
    } catch (error) {
        console.log(`${RED}✗ ${testName}: ${error}${RESET}`);
        return {
            name: testName,
            passed: false,
            message: String(error),
        };
    }
}

/**
 * Test 5: Database Configuration
 */
async function testDatabaseConfiguration(manifest: any): Promise<TestResult> {
    const testName = "Test 5: Database Configuration";
    console.log(`${YELLOW}Running: ${testName}${RESET}`);

    try {
        const config = await generateConfig(manifest, "production");

        // Check if database connector exists
        const hasDatabaseConnector = manifest.connectors.some(
            (c: any) => c.type === "database"
        );

        if (hasDatabaseConnector) {
            // Verify database section exists
            if (!config.includes("database:")) {
                throw new Error("Database connector exists but no database section in config");
            }

            // Check for database connection settings
            if (!config.includes("${DATABASE_URL}")) {
                throw new Error("Missing DATABASE_URL environment variable");
            }

            if (!config.includes("poolSize:")) {
                throw new Error("Missing poolSize setting");
            }

            if (!config.includes("timeout:")) {
                throw new Error("Missing timeout setting");
            }

            console.log(`${GREEN}✓ ${testName}${RESET}`);
            return {
                name: testName,
                passed: true,
                message: "Database configuration properly generated",
            };
        } else {
            // No database connector, verify no database section
            if (config.includes("database:")) {
                throw new Error("Database section exists without database connector");
            }

            console.log(`${GREEN}✓ ${testName}${RESET}`);
            return {
                name: testName,
                passed: true,
                message: "No database connector, no database section (correct)",
            };
        }
    } catch (error) {
        console.log(`${RED}✗ ${testName}: ${error}${RESET}`);
        return {
            name: testName,
            passed: false,
            message: String(error),
        };
    }
}

/**
 * Test 6: Config Validation
 */
async function testConfigValidation(manifest: any): Promise<TestResult> {
    const testName = "Test 6: Config Validation";
    console.log(`${YELLOW}Running: ${testName}${RESET}`);

    try {
        // Test valid configs
        const devConfig = await generateConfig(manifest, "development");
        const prodConfig = await generateConfig(manifest, "production");

        if (!validateConfig(devConfig)) {
            throw new Error("Development config failed validation");
        }

        if (!validateConfig(prodConfig)) {
            throw new Error("Production config failed validation");
        }

        // Test invalid configs
        const invalidConfig1 = "invalid: yaml: structure";
        if (validateConfig(invalidConfig1)) {
            throw new Error("Invalid YAML should not validate");
        }

        const invalidConfig2 = "server:\n  name: test\nlogging: missing";
        if (validateConfig(invalidConfig2)) {
            throw new Error("Incomplete config should not validate");
        }

        console.log(`${GREEN}✓ ${testName}${RESET}`);
        return {
            name: testName,
            passed: true,
            message: "Config validation works correctly",
        };
    } catch (error) {
        console.log(`${RED}✗ ${testName}: ${error}${RESET}`);
        return {
            name: testName,
            passed: false,
            message: String(error),
        };
    }
}

/**
 * Test 7: Environment Variable Names
 */
async function testEnvironmentVariableNames(): Promise<TestResult> {
    const testName = "Test 7: Environment Variable Names";
    console.log(`${YELLOW}Running: ${testName}${RESET}`);

    try {
        // Test naming convention indirectly through config generation
        // since camelToSnakeCase is not exported
        const manifest = {
            name: "test-server",
            version: "1.0.0",
            tools: [],
            connectors: [
                {
                    name: "email-connector",
                    type: "email",
                    description: "Test",
                    version: "1.0.0",
                },
            ],
            capabilities: [],
            dependencies: {},
            metadata: {
                generatedAt: new Date().toISOString(),
                generatorVersion: "1.0.0",
                moduleCount: 1,
            },
        };

        const config = await generateConfig(manifest, "production");

        // Check that environment variables are in correct format
        if (!config.includes("EMAIL_CONNECTOR_API_KEY")) {
            throw new Error("Environment variable not in correct format");
        }

        console.log(`${GREEN}✓ ${testName}${RESET}`);
        return {
            name: testName,
            passed: true,
            message: "Environment variable naming convention correct",
        };
    } catch (error) {
        console.log(`${RED}✗ ${testName}: ${error}${RESET}`);
        return {
            name: testName,
            passed: false,
            message: String(error),
        };
    }
}

/**
 * Test 8: Save Config Files
 */
async function testSaveConfigFiles(manifest: any): Promise<TestResult> {
    const testName = "Test 8: Save Config Files";
    console.log(`${YELLOW}Running: ${testName}${RESET}`);

    try {
        // Generate configs
        const devConfig = await generateConfig(manifest, "development");
        const prodConfig = await generateConfig(manifest, "production");

        // Ensure config directory exists
        const configDir = path.join(__dirname, "../config");
        await fs.mkdir(configDir, { recursive: true });

        // Save development config
        const devPath = path.join(configDir, "development.yaml");
        await fs.writeFile(devPath, devConfig, "utf-8");

        // Save production config
        const prodPath = path.join(configDir, "production.yaml");
        await fs.writeFile(prodPath, prodConfig, "utf-8");

        // Verify files exist and are readable
        const devContent = await fs.readFile(devPath, "utf-8");
        const prodContent = await fs.readFile(prodPath, "utf-8");

        if (devContent.length === 0) {
            throw new Error("Development config file is empty");
        }

        if (prodContent.length === 0) {
            throw new Error("Production config file is empty");
        }

        console.log(`${GREEN}✓ ${testName}${RESET}`);
        console.log(`  - Saved: ${devPath}`);
        console.log(`  - Saved: ${prodPath}`);

        return {
            name: testName,
            passed: true,
            message: `Config files saved to ${configDir}`,
        };
    } catch (error) {
        console.log(`${RED}✗ ${testName}: ${error}${RESET}`);
        return {
            name: testName,
            passed: false,
            message: String(error),
        };
    }
}

// Run tests
runTests().catch((error) => {
    console.error(`${RED}Test suite error: ${error}${RESET}`);
    process.exit(1);
});
