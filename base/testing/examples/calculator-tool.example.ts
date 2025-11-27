/**
 * Example: Calculator Tool Tests
 * 
 * This file demonstrates how to use the MCP testing framework
 * to test MCP tools and servers.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  findAvailablePort,
} from '../test-harness';
import {
  MockToolRegistry,
  createSpy,
} from '../mock-framework';
import {
  assertContainsText,
  assertNoError,
  expect as mcpExpect,
} from '../assertions';

// Example tool implementation (would normally be imported)
interface CalculatorInput {
  operation: 'add' | 'subtract' | 'multiply' | 'divide';
  a: number;
  b: number;
}

interface CalculatorResult {
  result: number;
  expression: string;
}

const calculatorTool = {
  name: 'calculator',
  description: 'Perform basic math operations',
  inputSchema: {
    type: 'object',
    required: ['operation', 'a', 'b'],
    properties: {
      operation: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] },
      a: { type: 'number' },
      b: { type: 'number' },
    },
  },
  handler: async (input: CalculatorInput): Promise<CalculatorResult> => {
    let result: number;
    let expression: string;
    
    switch (input.operation) {
      case 'add':
        result = input.a + input.b;
        expression = `${input.a} + ${input.b} = ${result}`;
        break;
      case 'subtract':
        result = input.a - input.b;
        expression = `${input.a} - ${input.b} = ${result}`;
        break;
      case 'multiply':
        result = input.a * input.b;
        expression = `${input.a} × ${input.b} = ${result}`;
        break;
      case 'divide':
        if (input.b === 0) {
          throw new Error('Division by zero');
        }
        result = input.a / input.b;
        expression = `${input.a} ÷ ${input.b} = ${result}`;
        break;
    }
    
    return { result, expression };
  },
};

// ============================================================================
// Unit Tests (Fast, No Container)
// ============================================================================

describe('Calculator Tool - Unit Tests', () => {
  describe('Addition', () => {
    it('should add two positive numbers', async () => {
      const result = await calculatorTool.handler({
        operation: 'add',
        a: 5,
        b: 3,
      });
      
      expect(result.result).toBe(8);
      expect(result.expression).toBe('5 + 3 = 8');
    });
    
    it('should handle negative numbers', async () => {
      const result = await calculatorTool.handler({
        operation: 'add',
        a: -5,
        b: 3,
      });
      
      expect(result.result).toBe(-2);
    });
  });
  
  describe('Subtraction', () => {
    it('should subtract two numbers', async () => {
      const result = await calculatorTool.handler({
        operation: 'subtract',
        a: 10,
        b: 4,
      });
      
      expect(result.result).toBe(6);
    });
  });
  
  describe('Multiplication', () => {
    it('should multiply two numbers', async () => {
      const result = await calculatorTool.handler({
        operation: 'multiply',
        a: 6,
        b: 7,
      });
      
      expect(result.result).toBe(42);
    });
  });
  
  describe('Division', () => {
    it('should divide two numbers', async () => {
      const result = await calculatorTool.handler({
        operation: 'divide',
        a: 20,
        b: 4,
      });
      
      expect(result.result).toBe(5);
    });
    
    it('should throw on division by zero', async () => {
      await expect(
        calculatorTool.handler({
          operation: 'divide',
          a: 10,
          b: 0,
        })
      ).rejects.toThrow('Division by zero');
    });
  });
});

// ============================================================================
// Mock Tests (Testing with Mocked Dependencies)
// ============================================================================

describe('Calculator Tool - Mock Tests', () => {
  let toolRegistry: Map<string, { handler: (args: unknown) => Promise<unknown> }>;
  let mockRegistry: MockToolRegistry;
  
  beforeEach(() => {
    // Create a tool registry to mock
    toolRegistry = new Map();
    toolRegistry.set('calculator', {
      handler: calculatorTool.handler as (args: unknown) => Promise<unknown>,
    });
    mockRegistry = new MockToolRegistry(toolRegistry);
  });
  
  afterEach(() => {
    mockRegistry.restoreAll();
  });
  
  it('should be able to mock calculator responses', async () => {
    // Mock the calculator to always return 42
    mockRegistry.mockTool('calculator', async () => ({
      result: 42,
      expression: 'The answer to everything',
    }));
    
    const tool = toolRegistry.get('calculator');
    const result = await tool?.handler({ operation: 'add', a: 1, b: 1 });
    
    expect(result).toEqual({
      result: 42,
      expression: 'The answer to everything',
    });
  });
  
  it('should track tool invocations', async () => {
    mockRegistry.mockTool('calculator', async () => ({ result: 0 }));
    
    const tool = toolRegistry.get('calculator');
    await tool?.handler({ operation: 'add', a: 1, b: 2 });
    await tool?.handler({ operation: 'add', a: 3, b: 4 });
    
    expect(mockRegistry.getCallCount('calculator')).toBe(2);
    expect(mockRegistry.wasCalled('calculator')).toBe(true);
  });
  
  it('should verify specific arguments were passed', async () => {
    mockRegistry.mockTool('calculator', async () => ({ result: 0 }));
    
    const tool = toolRegistry.get('calculator');
    await tool?.handler({ operation: 'multiply', a: 6, b: 7 });
    
    expect(mockRegistry.wasCalledWith('calculator', {
      operation: 'multiply',
      a: 6,
      b: 7,
    })).toBe(true);
  });
});

// ============================================================================
// Spy Tests (Observing Real Implementations)
// ============================================================================

describe('Calculator Tool - Spy Tests', () => {
  it('should track calls while preserving behavior', async () => {
    const spy = createSpy(
      calculatorTool.handler as (...args: unknown[]) => unknown,
      { callThrough: true }
    );
    
    const result = await spy({ operation: 'add', a: 2, b: 3 });
    
    expect(spy.callCount).toBe(1);
    expect(result).toEqual({ result: 5, expression: '2 + 3 = 5' });
  });
  
  it('should record all call arguments', () => {
    const spy = createSpy((..._args: unknown[]) => Promise.resolve({ result: 0 }));
    
    spy({ operation: 'add', a: 1, b: 2 });
    spy({ operation: 'multiply', a: 3, b: 4 });
    
    expect(spy.calls).toHaveLength(2);
    expect(spy.calls[0]).toEqual([{ operation: 'add', a: 1, b: 2 }]);
    expect(spy.calls[1]).toEqual([{ operation: 'multiply', a: 3, b: 4 }]);
  });
});

// ============================================================================
// MCP Response Assertion Tests
// ============================================================================

describe('Calculator Tool - MCP Response Assertions', () => {
  it('should validate MCP-style responses', () => {
    const mcpResponse = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ result: 42, expression: '6 × 7 = 42' }),
        },
      ],
      isError: false,
    };
    
    const result = assertNoError(mcpResponse);
    expect(result.passed).toBe(true);
  });
  
  it('should check response text content', () => {
    const mcpResponse = {
      content: [
        {
          type: 'text',
          text: 'The result is 42',
        },
      ],
    };
    
    const result = assertContainsText(mcpResponse, '42');
    expect(result.passed).toBe(true);
  });
  
  it('should use expect-style assertions', () => {
    const mcpResponse = {
      content: [{ type: 'text', text: 'Result: 100' }],
      isError: false,
    };
    
    // These won't throw if assertions pass
    mcpExpect(mcpResponse).toContainText('100');
    mcpExpect(mcpResponse).not.toContainText('error');
  });
});

// ============================================================================
// Integration Test Example (Would Use TestHarness in Real Scenario)
// ============================================================================

describe('Calculator Tool - Integration Test Pattern', () => {
  // This demonstrates the pattern for container-based integration tests
  // In a real scenario, you would:
  // 1. Build and start a container with TestHarness
  // 2. Connect with MCPTestClient
  // 3. Make actual MCP protocol calls
  // 4. Verify responses
  
  it('demonstrates integration test setup', async () => {
    // Find available port
    const port = await findAvailablePort(12000);
    expect(port).toBeGreaterThanOrEqual(12000);
    
    // In a real test, you would:
    // const harness = new TestHarness({
    //   imageName: 'calculator-mcp-server',
    //   port,
    //   env: { LOG_LEVEL: 'debug' },
    // });
    // await harness.start();
    // 
    // const client = harness.getClient();
    // const response = await client.callTool('calculator', {
    //   operation: 'add',
    //   a: 5,
    //   b: 3,
    // });
    // 
    // assertToolResponse(response, {
    //   content: [{ type: 'text', text: /result.*8/ }],
    // });
    // 
    // await harness.cleanup();
  });
});

// Export tools for use in other tests
export { calculatorTool };
