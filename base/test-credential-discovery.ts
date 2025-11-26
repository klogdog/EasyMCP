/**
 * Test script for Credential Discovery
 * 
 * Tests credential extraction from:
 * - TypeScript metadata.credentials arrays
 * - TypeScript JSDoc @requires-credential tags
 * - Python metadata credentials arrays
 * - Python docstring :credential directives
 * - Aggregation and merging of duplicates
 */

import {
    discoverCredentialRequirements,
    extractPythonCredentials,
    extractMetadataCredentials,
    extractJSDocCredentials,
    extractPythonDocstringCredentials,
    getRequiredCredentials,
    getOptionalCredentials,
    groupByService,
    toPromptFormat,
    CredentialRequirement,
} from "./credential-discovery";
import { Module } from "./loader";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string): void {
    if (condition) {
        console.log(`  ✅ ${message}`);
        testsPassed++;
    } else {
        console.log(`  ❌ ${message}`);
        testsFailed++;
    }
}

async function test1_extractMetadataCredentials(): Promise<void> {
    console.log("\nTest 1: Extract credentials from TypeScript metadata");

    const content = `
export const metadata = {
    "name": "test-tool",
    "description": "A test tool",
    "version": "1.0.0",
    "credentials": [
        {
            "name": "API_KEY",
            "type": "api_key",
            "required": true,
            "description": "API key for authentication",
            "service": "test-service"
        },
        {
            "name": "SECRET_TOKEN",
            "type": "token",
            "required": false,
            "description": "Optional secret token"
        }
    ]
};
`;

    const credentials = extractMetadataCredentials(content);

    assert(credentials.length === 2, "Should extract 2 credentials from metadata");
    assert(credentials[0]?.name === "API_KEY", "First credential should be API_KEY");
    assert(credentials[0]?.type === "api_key", "API_KEY type should be api_key");
    assert(credentials[0]?.required === true, "API_KEY should be required");
    assert(credentials[0]?.service === "test-service", "API_KEY service should be test-service");
    assert(credentials[1]?.name === "SECRET_TOKEN", "Second credential should be SECRET_TOKEN");
    assert(credentials[1]?.required === false, "SECRET_TOKEN should be optional");
}

async function test2_extractJSDocCredentials(): Promise<void> {
    console.log("\nTest 2: Extract credentials from JSDoc @requires-credential tags");

    const content = `
/**
 * This is a sample tool
 * 
 * @requires-credential OPENAI_API_KEY api_key required - OpenAI API key for chat completion
 * @requires-credential GITHUB_TOKEN token optional - GitHub token for repository access
 */
export function doSomething() {
    // ...
}

/**
 * Another function
 * @requires-credential DATABASE_PASSWORD password required - Database password
 */
export function anotherFunction() {
    // ...
}
`;

    const credentials = extractJSDocCredentials(content);

    assert(credentials.length === 3, "Should extract 3 credentials from JSDoc");
    assert(credentials[0]?.name === "OPENAI_API_KEY", "First credential should be OPENAI_API_KEY");
    assert(credentials[0]?.type === "api_key", "OPENAI_API_KEY type should be api_key");
    assert(credentials[0]?.required === true, "OPENAI_API_KEY should be required");
    assert(credentials[0]?.description?.includes("OpenAI") === true, "Description should mention OpenAI");
    assert(credentials[1]?.name === "GITHUB_TOKEN", "Second credential should be GITHUB_TOKEN");
    assert(credentials[1]?.required === false, "GITHUB_TOKEN should be optional");
    assert(credentials[2]?.name === "DATABASE_PASSWORD", "Third credential should be DATABASE_PASSWORD");
    assert(credentials[2]?.type === "password", "DATABASE_PASSWORD type should be password");
}

async function test3_extractPythonMetadataCredentials(): Promise<void> {
    console.log("\nTest 3: Extract credentials from Python metadata dict");

    const content = `
"""
Sample Python module with credentials
"""

metadata = {
    "name": "python-tool",
    "description": "A Python tool",
    "version": "1.0.0",
    "credentials": [
        {
            "name": "AWS_ACCESS_KEY",
            "type": "api_key",
            "required": true,
            "description": "AWS access key ID",
            "service": "aws"
        },
        {
            "name": "AWS_SECRET_KEY",
            "type": "password",
            "required": true,
            "description": "AWS secret access key",
            "service": "aws"
        }
    ]
}
`;

    const credentials = extractPythonCredentials(content, "python-tool");

    assert(credentials.length === 2, "Should extract 2 credentials from Python metadata");
    assert(credentials[0]?.name === "AWS_ACCESS_KEY", "First credential should be AWS_ACCESS_KEY");
    assert(credentials[0]?.service === "aws", "AWS_ACCESS_KEY service should be aws");
    assert(credentials[1]?.name === "AWS_SECRET_KEY", "Second credential should be AWS_SECRET_KEY");
    assert(credentials[1]?.type === "password", "AWS_SECRET_KEY type should be password");
}

async function test4_extractPythonDocstringCredentials(): Promise<void> {
    console.log("\nTest 4: Extract credentials from Python docstring :credential directives");

    const content = `
"""
Sample Python module

:credential SMTP_PASSWORD password required: SMTP server password for email
:credential SMTP_USERNAME api_key optional: SMTP username
"""

class EmailSender:
    """
    Email sender class
    
    :credential EMAIL_API_KEY api_key required: Email service API key
    """
    
    def send(self, to: str, subject: str, body: str):
        pass
`;

    const credentials = extractPythonDocstringCredentials(content);

    assert(credentials.length === 3, "Should extract 3 credentials from docstrings");
    assert(credentials[0]?.name === "SMTP_PASSWORD", "First credential should be SMTP_PASSWORD");
    assert(credentials[0]?.type === "password", "SMTP_PASSWORD type should be password");
    assert(credentials[0]?.required === true, "SMTP_PASSWORD should be required");
    assert(credentials[1]?.name === "SMTP_USERNAME", "Second credential should be SMTP_USERNAME");
    assert(credentials[1]?.required === false, "SMTP_USERNAME should be optional");
    assert(credentials[2]?.name === "EMAIL_API_KEY", "Third credential should be EMAIL_API_KEY");
}

async function test5_mergesDuplicateCredentials(): Promise<void> {
    console.log("\nTest 5: Merge duplicate credentials across modules");

    // Create temporary test files
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cred-test-"));

    const toolContent = `
export const metadata = {
    "name": "tool-a",
    "description": "Tool A",
    "version": "1.0.0",
    "credentials": [
        { "name": "SHARED_API_KEY", "type": "api_key", "required": false, "description": "Shared key" }
    ]
};
`;

    const connectorContent = `
/**
 * Connector B
 * @requires-credential SHARED_API_KEY api_key required - Shared API key for service
 */
export const metadata = {
    "name": "connector-b",
    "description": "Connector B",
    "version": "1.0.0"
};
`;

    const toolPath = path.join(tempDir, "tool.ts");
    const connectorPath = path.join(tempDir, "connector.ts");

    await fs.writeFile(toolPath, toolContent);
    await fs.writeFile(connectorPath, connectorContent);

    const modules: Module[] = [
        {
            name: "tool-a",
            path: toolPath,
            type: "tool",
            language: "typescript",
            metadata: { name: "tool-a", description: "Tool A", version: "1.0.0" },
        },
        {
            name: "connector-b",
            path: connectorPath,
            type: "connector",
            language: "typescript",
            metadata: { name: "connector-b", description: "Connector B", version: "1.0.0" },
        },
    ];

    const requirements = await discoverCredentialRequirements(modules);

    // Clean up
    await fs.rm(tempDir, { recursive: true });

    assert(requirements.length === 1, "Should merge into 1 credential requirement");
    assert(requirements[0]?.name === "SHARED_API_KEY", "Merged credential should be SHARED_API_KEY");
    assert(requirements[0]?.required === true, "Merged credential should be required (any module requires it)");
    assert(requirements[0]?.usedBy.length === 2, "Should track 2 modules using this credential");
    assert(requirements[0]?.usedBy.includes("tool-a") === true, "usedBy should include tool-a");
    assert(requirements[0]?.usedBy.includes("connector-b") === true, "usedBy should include connector-b");
}

async function test6_requiredVsOptionalFiltering(): Promise<void> {
    console.log("\nTest 6: Filter required vs optional credentials");

    const requirements: CredentialRequirement[] = [
        {
            name: "REQUIRED_KEY",
            type: "api_key",
            required: true,
            description: "Required API key",
            usedBy: ["tool-a"],
        },
        {
            name: "OPTIONAL_TOKEN",
            type: "token",
            required: false,
            description: "Optional token",
            usedBy: ["tool-b"],
        },
        {
            name: "ANOTHER_REQUIRED",
            type: "password",
            required: true,
            description: "Another required credential",
            usedBy: ["tool-c"],
        },
    ];

    const required = getRequiredCredentials(requirements);
    const optional = getOptionalCredentials(requirements);

    assert(required.length === 2, "Should have 2 required credentials");
    assert(optional.length === 1, "Should have 1 optional credential");
    assert(required.every((r) => r.required), "All required credentials should be marked required");
    assert(optional.every((r) => !r.required), "All optional credentials should not be marked required");
}

async function test7_groupByService(): Promise<void> {
    console.log("\nTest 7: Group credentials by service");

    const requirements: CredentialRequirement[] = [
        {
            name: "AWS_KEY",
            type: "api_key",
            required: true,
            description: "AWS key",
            service: "aws",
            usedBy: ["tool-a"],
        },
        {
            name: "AWS_SECRET",
            type: "password",
            required: true,
            description: "AWS secret",
            service: "aws",
            usedBy: ["tool-a"],
        },
        {
            name: "GITHUB_TOKEN",
            type: "token",
            required: false,
            description: "GitHub token",
            service: "github",
            usedBy: ["tool-b"],
        },
        {
            name: "DATABASE_PASSWORD",
            type: "password",
            required: true,
            description: "DB password",
            usedBy: ["tool-c"], // No service
        },
    ];

    const groups = groupByService(requirements);

    assert(groups.size === 3, "Should have 3 groups (aws, github, other)");
    assert(groups.get("aws")?.length === 2, "AWS group should have 2 credentials");
    assert(groups.get("github")?.length === 1, "GitHub group should have 1 credential");
    assert(groups.get("other")?.length === 1, "Other group should have 1 credential");
}

async function test8_toPromptFormat(): Promise<void> {
    console.log("\nTest 8: Convert to prompt format");

    const requirements: CredentialRequirement[] = [
        {
            name: "API_KEY",
            type: "api_key",
            required: true,
            description: "API key",
            validation: /^[A-Za-z0-9]{32}$/,
            usedBy: ["tool-a"],
        },
        {
            name: "USERNAME",
            type: "oauth",
            required: false,
            description: "Username",
            usedBy: ["tool-b"],
        },
        {
            name: "SECRET",
            type: "password",
            required: true,
            description: "Secret password",
            usedBy: ["tool-c"],
        },
    ];

    const promptReqs = toPromptFormat(requirements);

    assert(promptReqs.length === 3, "Should convert all 3 requirements");
    assert(promptReqs[0]?.type === "password", "API key should become password type for masking");
    assert(promptReqs[1]?.type === "text", "OAuth should become text type");
    assert(promptReqs[2]?.type === "password", "Password should remain password type");
    assert(promptReqs[0]?.validation instanceof RegExp, "Validation should be preserved as RegExp");
    assert(promptReqs[1]?.description.includes("(optional)") === true, "Optional credentials should note that in description");
}

async function runAllTests(): Promise<void> {
    console.log("=".repeat(60));
    console.log("Testing Credential Discovery System");
    console.log("=".repeat(60));

    await test1_extractMetadataCredentials();
    await test2_extractJSDocCredentials();
    await test3_extractPythonMetadataCredentials();
    await test4_extractPythonDocstringCredentials();
    await test5_mergesDuplicateCredentials();
    await test6_requiredVsOptionalFiltering();
    await test7_groupByService();
    await test8_toPromptFormat();

    console.log("\n" + "=".repeat(60));
    console.log(`Tests completed: ${testsPassed} passed, ${testsFailed} failed`);
    console.log("=".repeat(60));

    if (testsFailed > 0) {
        process.exit(1);
    }
}

runAllTests().catch((error) => {
    console.error("Test suite failed:", error);
    process.exit(1);
});
