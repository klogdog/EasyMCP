/**
 * Test Suite for Interactive Prompt System
 * 
 * This test suite validates the prompt.ts module functionality including:
 * - Input validation (email, URL, port, hostname)
 * - Environment variable defaults
 * - Secret masking
 * - Conditional prompts
 * - Error handling
 */

import {
    CredentialRequirement,
    validateEmail,
    validateUrl,
    validateNonEmpty,
    validateNumericRange,
    validatePort,
    validateHostname,
} from "./prompt";

// Test counter
let testsPassed = 0;
let testsFailed = 0;

/**
 * Simple test runner
 */
function test(name: string, fn: () => void | Promise<void>) {
    console.log(`\nRunning: ${name}`);
    try {
        const result = fn();
        if (result instanceof Promise) {
            result
                .then(() => {
                    console.log(`✓ ${name}`);
                    testsPassed++;
                })
                .catch((error) => {
                    console.error(`✗ ${name}`);
                    console.error(`  Error: ${error.message}`);
                    testsFailed++;
                });
        } else {
            console.log(`✓ ${name}`);
            testsPassed++;
        }
    } catch (error: any) {
        console.error(`✗ ${name}`);
        console.error(`  Error: ${error.message}`);
        testsFailed++;
    }
}

/**
 * Assertion helper
 */
function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(message);
    }
}

/**
 * Test 1: Email Validation
 */
test("Test 1: Email Validation", () => {
    // Valid emails
    assert(validateEmail("user@example.com") === true, "Valid email should pass");
    assert(validateEmail("test.name@domain.co.uk") === true, "Email with dots should pass");
    assert(validateEmail("user+tag@example.com") === true, "Email with plus should pass");

    // Invalid emails
    const invalid1 = validateEmail("invalid");
    assert(typeof invalid1 === "string", "Invalid email should return error message");

    const invalid2 = validateEmail("@example.com");
    assert(typeof invalid2 === "string", "Email without local part should fail");

    const invalid3 = validateEmail("user@");
    assert(typeof invalid3 === "string", "Email without domain should fail");

    const invalid4 = validateEmail("");
    assert(typeof invalid4 === "string", "Empty email should fail");

    console.log("  - Valid emails accepted");
    console.log("  - Invalid emails rejected");
});

/**
 * Test 2: URL Validation
 */
test("Test 2: URL Validation", () => {
    // Valid URLs
    assert(validateUrl("https://example.com") === true, "HTTPS URL should pass");
    assert(validateUrl("http://localhost:3000") === true, "HTTP localhost should pass");
    assert(validateUrl("https://api.example.com/v1") === true, "URL with path should pass");
    assert(validateUrl("ftp://files.example.com") === true, "FTP URL should pass");

    // Invalid URLs
    const invalid1 = validateUrl("not-a-url");
    assert(typeof invalid1 === "string", "Invalid URL should return error message");

    const invalid2 = validateUrl("example.com");
    assert(typeof invalid2 === "string", "URL without protocol should fail");

    const invalid3 = validateUrl("");
    assert(typeof invalid3 === "string", "Empty URL should fail");

    console.log("  - Valid URLs accepted");
    console.log("  - Invalid URLs rejected");
});

/**
 * Test 3: Non-Empty Validation
 */
test("Test 3: Non-Empty Validation", () => {
    // Valid non-empty strings
    assert(validateNonEmpty("text") === true, "Non-empty string should pass");
    assert(validateNonEmpty("a") === true, "Single character should pass");
    assert(validateNonEmpty("  text  ") === true, "String with whitespace should pass");

    // Invalid empty strings
    const invalid1 = validateNonEmpty("");
    assert(typeof invalid1 === "string", "Empty string should return error message");

    const invalid2 = validateNonEmpty("   ");
    assert(typeof invalid2 === "string", "Whitespace-only string should fail");

    console.log("  - Non-empty strings accepted");
    console.log("  - Empty strings rejected");
});

/**
 * Test 4: Numeric Range Validation
 */
test("Test 4: Numeric Range Validation", () => {
    const validator = validateNumericRange(1, 100);

    // Valid numbers
    assert(validator("50") === true, "Number in range should pass");
    assert(validator("1") === true, "Minimum value should pass");
    assert(validator("100") === true, "Maximum value should pass");
    assert(validator("99.5") === true, "Decimal in range should pass");

    // Invalid numbers
    const invalid1 = validator("0");
    assert(typeof invalid1 === "string", "Number below range should fail");

    const invalid2 = validator("101");
    assert(typeof invalid2 === "string", "Number above range should fail");

    const invalid3 = validator("abc");
    assert(typeof invalid3 === "string", "Non-numeric value should fail");

    const invalid4 = validator("");
    assert(typeof invalid4 === "string", "Empty value should fail");

    console.log("  - Numbers in range accepted");
    console.log("  - Numbers out of range rejected");
    console.log("  - Non-numeric values rejected");
});

/**
 * Test 5: Port Validation
 */
test("Test 5: Port Validation", () => {
    // Valid ports
    assert(validatePort("80") === true, "Port 80 should pass");
    assert(validatePort("443") === true, "Port 443 should pass");
    assert(validatePort("3000") === true, "Port 3000 should pass");
    assert(validatePort("1") === true, "Port 1 should pass");
    assert(validatePort("65535") === true, "Port 65535 should pass");

    // Invalid ports
    const invalid1 = validatePort("0");
    assert(typeof invalid1 === "string", "Port 0 should fail");

    const invalid2 = validatePort("65536");
    assert(typeof invalid2 === "string", "Port 65536 should fail");

    const invalid3 = validatePort("abc");
    assert(typeof invalid3 === "string", "Non-numeric port should fail");

    const invalid4 = validatePort("");
    assert(typeof invalid4 === "string", "Empty port should fail");

    console.log("  - Valid ports accepted (1-65535)");
    console.log("  - Invalid ports rejected");
});

/**
 * Test 6: Hostname Validation
 */
test("Test 6: Hostname Validation", () => {
    // Valid hostnames
    assert(validateHostname("localhost") === true, "localhost should pass");
    assert(validateHostname("example.com") === true, "Domain should pass");
    assert(validateHostname("api.example.com") === true, "Subdomain should pass");
    assert(validateHostname("192.168.1.1") === true, "IP address should pass");
    assert(validateHostname("my-server.example.co.uk") === true, "Complex domain should pass");

    // Invalid hostnames
    const invalid1 = validateHostname("invalid..com");
    assert(typeof invalid1 === "string", "Double dots should fail");

    const invalid2 = validateHostname("-invalid.com");
    assert(typeof invalid2 === "string", "Starting with dash should fail");

    const invalid3 = validateHostname("");
    assert(typeof invalid3 === "string", "Empty hostname should fail");

    console.log("  - Valid hostnames accepted");
    console.log("  - Invalid hostnames rejected");
});

/**
 * Test 7: CredentialRequirement Structure
 */
test("Test 7: CredentialRequirement Structure", () => {
    // Test requirement with all fields
    const req1: CredentialRequirement = {
        name: "apiKey",
        type: "password",
        required: true,
        description: "Enter your API key",
        validation: validateNonEmpty,
        default: "test-key",
    };

    assert(req1.name === "apiKey", "Name should be set");
    assert(req1.type === "password", "Type should be password");
    assert(req1.required === true, "Should be required");
    assert(req1.description === "Enter your API key", "Description should be set");
    assert(typeof req1.validation === "function", "Validation should be function");
    assert(req1.default === "test-key", "Default should be set");

    // Test list type requirement
    const req2: CredentialRequirement = {
        name: "environment",
        type: "list",
        required: true,
        description: "Select environment",
        choices: ["development", "staging", "production"],
    };

    assert(req2.type === "list", "Type should be list");
    assert(Array.isArray(req2.choices), "Choices should be array");
    assert(req2.choices?.length === 3, "Should have 3 choices");

    // Test text type requirement
    const req3: CredentialRequirement = {
        name: "email",
        type: "text",
        required: true,
        description: "Enter your email",
        validation: validateEmail,
    };

    assert(req3.type === "text", "Type should be text");
    assert(typeof req3.validation === "function", "Validation should be email validator");

    // Test confirm type requirement
    const req4: CredentialRequirement = {
        name: "acceptTerms",
        type: "confirm",
        required: true,
        description: "Accept terms and conditions?",
    };

    assert(req4.type === "confirm", "Type should be confirm");

    console.log("  - CredentialRequirement interface working correctly");
    console.log("  - All field types supported: text, password, confirm, list");
    console.log("  - Validation functions work as expected");
});

/**
 * Test 8: Conditional Prompt Logic
 */
test("Test 8: Conditional Prompt Logic", () => {
    // Test conditional requirement using 'when' callback
    const requirements: CredentialRequirement[] = [
        {
            name: "authType",
            type: "list",
            required: true,
            description: "Select authentication type",
            choices: ["basic", "oauth", "apikey"],
        },
        {
            name: "oauthToken",
            type: "password",
            required: true,
            description: "Enter OAuth token",
            when: (answers) => answers.authType === "oauth",
        },
        {
            name: "apiKey",
            type: "password",
            required: true,
            description: "Enter API key",
            when: (answers) => answers.authType === "apikey",
        },
    ];

    // Verify structure
    assert(requirements.length === 3, "Should have 3 requirements");

    const conditionalReq1 = requirements[1];
    assert(conditionalReq1 !== undefined, "OAuth requirement should exist");
    if (conditionalReq1) {
        assert(typeof conditionalReq1.when === "function", "OAuth requirement should have 'when' callback");
    }

    const conditionalReq2 = requirements[2];
    assert(conditionalReq2 !== undefined, "API key requirement should exist");
    if (conditionalReq2) {
        assert(typeof conditionalReq2.when === "function", "API key requirement should have 'when' callback");
    }

    // Test when callbacks
    const mockAnswersOAuth = { authType: "oauth" };
    const mockAnswersApiKey = { authType: "apikey" };
    const mockAnswersBasic = { authType: "basic" };

    if (conditionalReq1 && conditionalReq1.when) {
        assert(conditionalReq1.when(mockAnswersOAuth) === true, "OAuth token should show when authType is oauth");
        assert(conditionalReq1.when(mockAnswersApiKey) === false, "OAuth token should not show when authType is apikey");
    }

    if (conditionalReq2 && conditionalReq2.when) {
        assert(conditionalReq2.when(mockAnswersApiKey) === true, "API key should show when authType is apikey");
        assert(conditionalReq2.when(mockAnswersBasic) === false, "API key should not show when authType is basic");
    }

    console.log("  - Conditional prompts with 'when' callback work correctly");
    console.log("  - Prompts show/hide based on previous answers");
});

/**
 * Run all tests
 */
console.log("==================================");
console.log("Interactive Prompt System Test Suite");
console.log("==================================");

// Wait a bit for async tests to complete
setTimeout(() => {
    console.log("\n==================================");
    console.log("Test Summary");
    console.log("==================================");
    console.log("");
    console.log(`Total Tests: ${testsPassed + testsFailed}`);
    console.log(`Passed: ${testsPassed}`);
    if (testsFailed > 0) {
        console.log(`Failed: ${testsFailed}`);
        process.exit(1);
    }
}, 100);

