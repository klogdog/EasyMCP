/**
 * Tool Mocking Framework for MCP Testing
 * 
 * Provides utilities to mock tool implementations for testing:
 * - Replace real implementations with mocks
 * - Record tool invocations
 * - Return predefined responses
 */

// ============================================================================
// Types
// ============================================================================

export interface MockToolConfig {
    /** The mock function to call */
    handler: MockHandler;
    /** Number of times this mock can be called (-1 for unlimited) */
    maxCalls?: number;
    /** Delay before responding (ms) */
    delay?: number;
    /** Whether to throw an error */
    shouldError?: boolean;
    /** Error message if shouldError is true */
    errorMessage?: string;
}

export interface ToolInvocation {
    name: string;
    args: unknown;
    timestamp: number;
    duration?: number;
    result?: unknown;
    error?: Error;
}

export type MockHandler = (args: unknown) => unknown | Promise<unknown>;

// ============================================================================
// Mock Tool Registry
// ============================================================================

export class MockToolRegistry {
    private mocks: Map<string, MockToolConfig> = new Map();
    private originalHandlers: Map<string, MockHandler> = new Map();
    private invocations: ToolInvocation[] = [];
    private toolRegistry: Map<string, { handler: MockHandler }>;

    constructor(toolRegistry: Map<string, { handler: MockHandler }>) {
        this.toolRegistry = toolRegistry;
    }

    /**
     * Mock a tool with a custom implementation
     */
    mockTool(name: string, handler: MockHandler, config: Partial<MockToolConfig> = {}): void {
        // Save original handler if not already saved
        const originalTool = this.toolRegistry.get(name);
        if (originalTool && !this.originalHandlers.has(name)) {
            this.originalHandlers.set(name, originalTool.handler);
        }

        const mockConfig: MockToolConfig = {
            handler,
            maxCalls: config.maxCalls ?? -1,
            delay: config.delay ?? 0,
            shouldError: config.shouldError ?? false,
            errorMessage: config.errorMessage,
        };

        this.mocks.set(name, mockConfig);

        // Replace the tool handler
        if (originalTool) {
            originalTool.handler = this.createMockHandler(name, mockConfig);
        }
    }

    /**
     * Mock a tool to return a specific value
     */
    mockToolReturn(name: string, returnValue: unknown): void {
        this.mockTool(name, () => returnValue);
    }

    /**
     * Mock a tool to throw an error
     */
    mockToolError(name: string, errorMessage: string): void {
        this.mockTool(name, () => {
            throw new Error(errorMessage);
        }, { shouldError: true, errorMessage });
    }

    /**
     * Mock a tool to be called once
     */
    mockToolOnce(name: string, handler: MockHandler): void {
        this.mockTool(name, handler, { maxCalls: 1 });
    }

    /**
     * Restore a mocked tool to its original implementation
     */
    restoreTool(name: string): boolean {
        const originalHandler = this.originalHandlers.get(name);
        if (!originalHandler) {
            return false;
        }

        const tool = this.toolRegistry.get(name);
        if (tool) {
            tool.handler = originalHandler;
        }

        this.mocks.delete(name);
        this.originalHandlers.delete(name);
        return true;
    }

    /**
     * Restore all mocked tools
     */
    restoreAll(): void {
        for (const [name, handler] of this.originalHandlers) {
            const tool = this.toolRegistry.get(name);
            if (tool) {
                tool.handler = handler;
            }
        }

        this.mocks.clear();
        this.originalHandlers.clear();
    }

    /**
     * Get all recorded invocations
     */
    getInvocations(): ToolInvocation[] {
        return [...this.invocations];
    }

    /**
     * Get invocations for a specific tool
     */
    getInvocationsFor(toolName: string): ToolInvocation[] {
        return this.invocations.filter(i => i.name === toolName);
    }

    /**
     * Get the number of times a tool was called
     */
    getCallCount(toolName: string): number {
        return this.invocations.filter(i => i.name === toolName).length;
    }

    /**
     * Check if a tool was called
     */
    wasCalled(toolName: string): boolean {
        return this.getCallCount(toolName) > 0;
    }

    /**
     * Check if a tool was called with specific arguments
     */
    wasCalledWith(toolName: string, expectedArgs: unknown): boolean {
        return this.invocations.some(
            i => i.name === toolName && JSON.stringify(i.args) === JSON.stringify(expectedArgs)
        );
    }

    /**
     * Get the last invocation for a tool
     */
    getLastInvocation(toolName: string): ToolInvocation | undefined {
        const invocations = this.getInvocationsFor(toolName);
        return invocations[invocations.length - 1];
    }

    /**
     * Clear all recorded invocations
     */
    clearInvocations(): void {
        this.invocations = [];
    }

    /**
     * Reset everything (mocks and invocations)
     */
    reset(): void {
        this.restoreAll();
        this.clearInvocations();
    }

    /**
     * Create a mock handler that records invocations
     */
    private createMockHandler(name: string, config: MockToolConfig): MockHandler {
        let callCount = 0;
        const maxCalls = config.maxCalls ?? -1;

        return async (args: unknown): Promise<unknown> => {
            const startTime = Date.now();

            // Check call limit
            if (maxCalls !== -1 && callCount >= maxCalls) {
                // Restore original handler if available
                const originalHandler = this.originalHandlers.get(name);
                if (originalHandler) {
                    return originalHandler(args);
                }
                throw new Error(`Mock for ${name} exceeded max calls (${maxCalls})`);
            }

            callCount++;

            // Add delay if specified
            if (config.delay && config.delay > 0) {
                await new Promise(resolve => setTimeout(resolve, config.delay));
            }

            const invocation: ToolInvocation = {
                name,
                args,
                timestamp: startTime,
            };

            try {
                const result = await config.handler(args);
                invocation.result = result;
                invocation.duration = Date.now() - startTime;
                this.invocations.push(invocation);
                return result;
            } catch (error) {
                invocation.error = error instanceof Error ? error : new Error(String(error));
                invocation.duration = Date.now() - startTime;
                this.invocations.push(invocation);
                throw error;
            }
        };
    }
}

// ============================================================================
// Spy Utilities
// ============================================================================

export interface SpyConfig {
    /** Call through to original implementation */
    callThrough?: boolean;
    /** Record arguments */
    recordArgs?: boolean;
}

/**
 * Create a spy function that records calls
 */
export function createSpy<T extends (...args: unknown[]) => unknown>(
    fn: T,
    config: SpyConfig = {}
): T & { calls: unknown[][]; callCount: number; reset: () => void } {
    const calls: unknown[][] = [];

    const spy = ((...args: unknown[]) => {
        calls.push(args);
        if (config.callThrough) {
            return fn(...args);
        }
        return undefined;
    }) as T & { calls: unknown[][]; callCount: number; reset: () => void };

    Object.defineProperty(spy, 'calls', {
        get: () => calls,
    });

    Object.defineProperty(spy, 'callCount', {
        get: () => calls.length,
    });

    spy.reset = () => {
        calls.length = 0;
    };

    return spy;
}

// ============================================================================
// Fixture Utilities
// ============================================================================

export interface ToolFixture {
    name: string;
    args: unknown;
    expectedResult: unknown;
}

/**
 * Create a fixture-based mock
 */
export function createFixtureMock(fixtures: ToolFixture[]): MockHandler {
    const fixtureMap = new Map<string, unknown>();

    for (const fixture of fixtures) {
        const key = JSON.stringify({ name: fixture.name, args: fixture.args });
        fixtureMap.set(key, fixture.expectedResult);
    }

    return (args: unknown): unknown => {
        // Find matching fixture
        for (const fixture of fixtures) {
            if (JSON.stringify(args) === JSON.stringify(fixture.args)) {
                return fixture.expectedResult;
            }
        }
        throw new Error(`No fixture found for args: ${JSON.stringify(args)}`);
    };
}

// ============================================================================
// Exports
// ============================================================================
export default MockToolRegistry;
