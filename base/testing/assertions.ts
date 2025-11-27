/**
 * Assertion Helpers for MCP Testing
 * 
 * Custom assertion utilities for validating MCP responses:
 * - Tool response matching
 * - Error code validation
 * - Connector state assertions
 */

// ============================================================================
// Types
// ============================================================================

export interface MCPToolResponse {
    content?: Array<{ type: string; text?: string;[key: string]: unknown }>;
    isError?: boolean;
    [key: string]: unknown;
}

export interface MCPError {
    code: number;
    message: string;
    data?: unknown;
}

export interface ExpectedContent {
    type?: string;
    text?: string | RegExp;
    [key: string]: unknown;
}

export interface AssertionResult {
    passed: boolean;
    message: string;
    expected?: unknown;
    actual?: unknown;
}

// ============================================================================
// Assertion Utilities
// ============================================================================

/**
 * Assert that a value is defined (not null or undefined)
 */
export function assertDefined<T>(value: T | null | undefined, message?: string): asserts value is T {
    if (value === null || value === undefined) {
        throw new AssertionError(message || 'Expected value to be defined');
    }
}

/**
 * Assert that two values are equal (deep comparison)
 */
export function assertEqual<T>(actual: T, expected: T, message?: string): void {
    if (!deepEqual(actual, expected)) {
        throw new AssertionError(
            message || 'Values are not equal',
            { expected, actual }
        );
    }
}

/**
 * Assert that a condition is true
 */
export function assertTrue(condition: boolean, message?: string): asserts condition {
    if (!condition) {
        throw new AssertionError(message || 'Expected condition to be true');
    }
}

/**
 * Assert that a condition is false
 */
export function assertFalse(condition: boolean, message?: string): void {
    if (condition) {
        throw new AssertionError(message || 'Expected condition to be false');
    }
}

// ============================================================================
// MCP-Specific Assertions
// ============================================================================

/**
 * Assert that a tool response matches expected structure
 */
export function assertToolResponse(
    response: MCPToolResponse,
    expected: Partial<MCPToolResponse>
): AssertionResult {
    const errors: string[] = [];

    // Check isError flag
    if (expected.isError !== undefined && response.isError !== expected.isError) {
        errors.push(`Expected isError to be ${expected.isError}, got ${response.isError}`);
    }

    // Check content if expected
    if (expected.content) {
        if (!response.content) {
            errors.push('Expected content to be present');
        } else if (expected.content.length !== response.content.length) {
            errors.push(
                `Expected ${expected.content.length} content items, got ${response.content.length}`
            );
        } else {
            for (let i = 0; i < expected.content.length; i++) {
                const exp = expected.content[i];
                const act = response.content[i];

                if (!exp || !act) {
                    errors.push(`Content[${i}]: missing expected or actual content`);
                    continue;
                }

                if (exp.type && exp.type !== act.type) {
                    errors.push(`Content[${i}]: expected type '${exp.type}', got '${act.type}'`);
                }

                if (exp.text !== undefined) {
                    const expText: string | RegExp | undefined = exp.text as string | RegExp | undefined;
                    if (expText && typeof expText !== 'string' && 'test' in expText) {
                        if (!expText.test(act.text || '')) {
                            errors.push(`Content[${i}]: text does not match pattern ${expText}`);
                        }
                    } else if (typeof expText === 'string' && expText !== act.text) {
                        errors.push(`Content[${i}]: expected text '${expText}', got '${act.text}'`);
                    }
                }
            }
        }
    }

    return {
        passed: errors.length === 0,
        message: errors.length > 0 ? errors.join('; ') : 'Response matches expected',
        expected,
        actual: response,
    };
}

/**
 * Assert that a response contains expected text
 */
export function assertContainsText(
    response: MCPToolResponse,
    expectedText: string | RegExp
): AssertionResult {
    const content = response.content || [];

    for (const item of content) {
        if (item.text) {
            if (typeof expectedText === 'string') {
                if (item.text.includes(expectedText)) {
                    return { passed: true, message: `Found expected text: ${expectedText}` };
                }
            } else {
                if (expectedText.test(item.text)) {
                    return { passed: true, message: `Text matches pattern: ${expectedText}` };
                }
            }
        }
    }

    return {
        passed: false,
        message: `Expected text not found: ${expectedText}`,
        expected: expectedText,
        actual: content,
    };
}

/**
 * Assert that a response is an error with specific code
 */
export function assertErrorCode(
    error: MCPError | unknown,
    expectedCode: number
): AssertionResult {
    if (!error || typeof error !== 'object' || !('code' in error)) {
        return {
            passed: false,
            message: 'Expected an error object with code property',
            expected: expectedCode,
            actual: error,
        };
    }

    const actualCode = (error as MCPError).code;

    return {
        passed: actualCode === expectedCode,
        message: actualCode === expectedCode
            ? `Error code matches: ${expectedCode}`
            : `Expected error code ${expectedCode}, got ${actualCode}`,
        expected: expectedCode,
        actual: actualCode,
    };
}

/**
 * Assert that a response is not an error
 */
export function assertNoError(response: MCPToolResponse): AssertionResult {
    if (response.isError) {
        return {
            passed: false,
            message: 'Expected no error, but response indicates error',
            actual: response,
        };
    }

    return {
        passed: true,
        message: 'Response is not an error',
    };
}

/**
 * Assert connector is in expected state
 */
export function assertConnectorState(
    connector: { isConnected: () => boolean },
    expectedConnected: boolean
): AssertionResult {
    const isConnected = connector.isConnected();

    return {
        passed: isConnected === expectedConnected,
        message: isConnected === expectedConnected
            ? `Connector state matches: ${expectedConnected ? 'connected' : 'disconnected'}`
            : `Expected connector to be ${expectedConnected ? 'connected' : 'disconnected'}`,
        expected: expectedConnected,
        actual: isConnected,
    };
}

/**
 * Assert connector is connected
 */
export function assertConnected(connector: { isConnected: () => boolean }): AssertionResult {
    return assertConnectorState(connector, true);
}

/**
 * Assert connector is disconnected
 */
export function assertDisconnected(connector: { isConnected: () => boolean }): AssertionResult {
    return assertConnectorState(connector, false);
}

// ============================================================================
// Schema Validation
// ============================================================================

/**
 * Assert that a value matches a JSON schema (simplified)
 */
export function assertMatchesSchema(
    value: unknown,
    schema: Record<string, unknown>
): AssertionResult {
    const errors = validateSchema(value, schema);

    return {
        passed: errors.length === 0,
        message: errors.length > 0 ? errors.join('; ') : 'Value matches schema',
        expected: schema,
        actual: value,
    };
}

function validateSchema(value: unknown, schema: Record<string, unknown>, path: string = ''): string[] {
    const errors: string[] = [];

    // Check type
    if (schema.type) {
        const expectedType = schema.type as string;
        const actualType = Array.isArray(value) ? 'array' : typeof value;

        if (actualType !== expectedType) {
            errors.push(`${path || 'root'}: expected type ${expectedType}, got ${actualType}`);
            return errors;
        }
    }

    // Check required properties for objects
    if (schema.required && Array.isArray(schema.required) && typeof value === 'object' && value !== null) {
        for (const required of schema.required as string[]) {
            if (!(required in value)) {
                errors.push(`${path || 'root'}: missing required property '${required}'`);
            }
        }
    }

    // Check properties for objects
    if (schema.properties && typeof value === 'object' && value !== null) {
        const properties = schema.properties as Record<string, Record<string, unknown>>;
        for (const [key, propSchema] of Object.entries(properties)) {
            if (key in value) {
                errors.push(...validateSchema((value as Record<string, unknown>)[key], propSchema, `${path}.${key}`));
            }
        }
    }

    return errors;
}

// ============================================================================
// Assertion Error
// ============================================================================

export class AssertionError extends Error {
    expected?: unknown;
    actual?: unknown;

    constructor(message: string, details?: { expected?: unknown; actual?: unknown }) {
        super(message);
        this.name = 'AssertionError';
        this.expected = details?.expected;
        this.actual = details?.actual;
    }
}

// ============================================================================
// Utilities
// ============================================================================

function deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== typeof b) return false;

    if (typeof a === 'object') {
        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) return false;
            return a.every((item, index) => deepEqual(item, b[index]));
        }

        if (Array.isArray(a) || Array.isArray(b)) return false;

        const aObj = a as Record<string, unknown>;
        const bObj = b as Record<string, unknown>;

        const aKeys = Object.keys(aObj);
        const bKeys = Object.keys(bObj);

        if (aKeys.length !== bKeys.length) return false;

        return aKeys.every(key => deepEqual(aObj[key], bObj[key]));
    }

    return false;
}

// ============================================================================
// Jest-style Matchers (for compatibility)
// ============================================================================

export interface Expect {
    toMatchToolResponse(expected: Partial<MCPToolResponse>): void;
    toContainText(text: string | RegExp): void;
    toHaveErrorCode(code: number): void;
    toBeConnected(): void;
    toBeDisconnected(): void;
    not: Expect;
}

/**
 * Create an expect-style assertion helper
 */
export function expect(actual: unknown): Expect {
    let negated = false;

    const check = (result: AssertionResult): void => {
        const passed = negated ? !result.passed : result.passed;
        if (!passed) {
            throw new AssertionError(result.message, {
                expected: result.expected,
                actual: result.actual,
            });
        }
    };

    const expectObj: Expect = {
        toMatchToolResponse(expected: Partial<MCPToolResponse>): void {
            check(assertToolResponse(actual as MCPToolResponse, expected));
        },

        toContainText(text: string | RegExp): void {
            check(assertContainsText(actual as MCPToolResponse, text));
        },

        toHaveErrorCode(code: number): void {
            check(assertErrorCode(actual, code));
        },

        toBeConnected(): void {
            check(assertConnected(actual as { isConnected: () => boolean }));
        },

        toBeDisconnected(): void {
            check(assertDisconnected(actual as { isConnected: () => boolean }));
        },

        get not(): Expect {
            negated = !negated;
            return expectObj;
        },
    };

    return expectObj;
}

// ============================================================================
// Exports
// ============================================================================
export {
    deepEqual,
};
