/**
 * Tests for MCP Testing Framework
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// Import types and utilities from the testing modules
import {
  findAvailablePort,
  MCPError,
} from '../testing/test-harness';

import {
  MockToolRegistry,
  createSpy,
  createFixtureMock,
} from '../testing/mock-framework';

import {
  assertToolResponse,
  assertContainsText,
  assertErrorCode,
  assertNoError,
  assertConnected,
  assertMatchesSchema,
  assertEqual,
  assertTrue,
  assertFalse,
  AssertionError,
  expect as mcpExpect,
} from '../testing/assertions';

describe('Port Management', () => {
  it('should find an available port', async () => {
    const port = await findAvailablePort(30000);
    expect(port).toBeGreaterThanOrEqual(30000);
    expect(port).toBeLessThan(65536);
  });
});

describe('MCPError', () => {
  it('should create error with code and message', () => {
    const error = new MCPError(-32600, 'Invalid Request', { detail: 'test' });
    
    expect(error.name).toBe('MCPError');
    expect(error.code).toBe(-32600);
    expect(error.message).toBe('Invalid Request');
    expect(error.data).toEqual({ detail: 'test' });
  });
});

describe('MockToolRegistry', () => {
  let mockRegistry: MockToolRegistry;
  let toolRegistry: Map<string, { handler: (args: unknown) => Promise<unknown> }>;
  
  beforeEach(() => {
    toolRegistry = new Map();
    toolRegistry.set('original-tool', {
      handler: async (args: unknown) => ({ original: true, args }),
    });
    mockRegistry = new MockToolRegistry(toolRegistry);
  });
  
  describe('mockTool', () => {
    it('should replace tool handler with mock', async () => {
      mockRegistry.mockTool('original-tool', async () => ({ mocked: true }));
      
      const tool = toolRegistry.get('original-tool');
      const result = await tool?.handler({});
      
      expect(result).toEqual({ mocked: true });
    });
    
    it('should record invocations', async () => {
      mockRegistry.mockTool('original-tool', async (args) => ({ result: args }));
      
      const tool = toolRegistry.get('original-tool');
      await tool?.handler({ input: 'test' });
      
      expect(mockRegistry.wasCalled('original-tool')).toBe(true);
      expect(mockRegistry.getCallCount('original-tool')).toBe(1);
      expect(mockRegistry.wasCalledWith('original-tool', { input: 'test' })).toBe(true);
    });
  });
  
  describe('mockToolOnce', () => {
    it('should only mock first call', async () => {
      mockRegistry.mockToolOnce('original-tool', async () => ({ first: true }));
      
      const tool = toolRegistry.get('original-tool');
      const firstResult = await tool?.handler({});
      
      expect(firstResult).toEqual({ first: true });
      
      // After max calls, should fall back to original if we restore
      mockRegistry.restoreTool('original-tool');
      const restoredTool = toolRegistry.get('original-tool');
      const thirdResult = await restoredTool?.handler({ test: 1 });
      expect(thirdResult).toEqual({ original: true, args: { test: 1 } });
    });
  });
  
  describe('restoreTool', () => {
    it('should restore original handler', async () => {
      mockRegistry.mockTool('original-tool', async () => ({ mocked: true }));
      mockRegistry.restoreTool('original-tool');
      
      const tool = toolRegistry.get('original-tool');
      const result = await tool?.handler({ test: 'data' });
      
      expect(result).toEqual({ original: true, args: { test: 'data' } });
    });
    
    it('should return false for non-mocked tool', () => {
      const result = mockRegistry.restoreTool('nonexistent');
      expect(result).toBe(false);
    });
  });
  
  describe('invocation tracking', () => {
    it('should track all invocations', async () => {
      mockRegistry.mockTool('original-tool', async () => ({}));
      
      const tool = toolRegistry.get('original-tool');
      await tool?.handler({ call: 1 });
      await tool?.handler({ call: 2 });
      await tool?.handler({ call: 3 });
      
      const invocations = mockRegistry.getInvocationsFor('original-tool');
      expect(invocations).toHaveLength(3);
    });
    
    it('should get last invocation', async () => {
      mockRegistry.mockTool('original-tool', async () => ({}));
      
      const tool = toolRegistry.get('original-tool');
      await tool?.handler({ first: true });
      await tool?.handler({ last: true });
      
      const last = mockRegistry.getLastInvocation('original-tool');
      expect(last?.args).toEqual({ last: true });
    });
  });
});

describe('Spy Utilities', () => {
  it('should create spy that records calls', () => {
    const original = (...args: unknown[]) => (args[0] as number) * 2;
    const spy = createSpy(original);
    
    spy(5);
    spy(10);
    
    expect(spy.callCount).toBe(2);
    expect(spy.calls).toEqual([[5], [10]]);
  });
  
  it('should call through when configured', () => {
    const original = (...args: unknown[]) => (args[0] as number) * 2;
    const spy = createSpy(original, { callThrough: true });
    
    const result = spy(5);
    
    expect(result).toBe(10);
    expect(spy.callCount).toBe(1);
  });
  
  it('should reset call history', () => {
    const spy = createSpy(() => {});
    
    spy();
    spy();
    expect(spy.callCount).toBe(2);
    
    spy.reset();
    expect(spy.callCount).toBe(0);
  });
});

describe('Fixture Mock', () => {
  it('should return matching fixture result', () => {
    const fixtures = [
      { name: 'test', args: { input: 'a' }, expectedResult: { output: 'A' } },
      { name: 'test', args: { input: 'b' }, expectedResult: { output: 'B' } },
    ];
    
    const mock = createFixtureMock(fixtures);
    
    expect(mock({ input: 'a' })).toEqual({ output: 'A' });
    expect(mock({ input: 'b' })).toEqual({ output: 'B' });
  });
  
  it('should throw when no fixture matches', () => {
    const fixtures = [
      { name: 'test', args: { input: 'a' }, expectedResult: { output: 'A' } },
    ];
    
    const mock = createFixtureMock(fixtures);
    
    expect(() => mock({ input: 'unknown' })).toThrow('No fixture found');
  });
});

describe('Assertion Helpers', () => {
  describe('assertToolResponse', () => {
    it('should pass for matching response', () => {
      const response = {
        content: [{ type: 'text', text: 'Hello' }],
        isError: false,
      };
      
      const result = assertToolResponse(response, {
        content: [{ type: 'text', text: 'Hello' }],
        isError: false,
      });
      
      expect(result.passed).toBe(true);
    });
    
    it('should fail for mismatched content', () => {
      const response = {
        content: [{ type: 'text', text: 'Hello' }],
      };
      
      const result = assertToolResponse(response, {
        content: [{ type: 'text', text: 'Goodbye' }],
      });
      
      expect(result.passed).toBe(false);
      expect(result.message).toContain('expected text');
    });
  });
  
  describe('assertContainsText', () => {
    it('should pass when text is found', () => {
      const response = {
        content: [{ type: 'text', text: 'Hello World' }],
      };
      
      const result = assertContainsText(response, 'World');
      expect(result.passed).toBe(true);
    });
    
    it('should pass with regex match', () => {
      const response = {
        content: [{ type: 'text', text: 'Count: 42 items' }],
      };
      
      const result = assertContainsText(response, /\d+ items/);
      expect(result.passed).toBe(true);
    });
    
    it('should fail when text not found', () => {
      const response = {
        content: [{ type: 'text', text: 'Hello' }],
      };
      
      const result = assertContainsText(response, 'Goodbye');
      expect(result.passed).toBe(false);
    });
  });
  
  describe('assertErrorCode', () => {
    it('should pass for matching error code', () => {
      const error = { code: -32600, message: 'Invalid Request' };
      
      const result = assertErrorCode(error, -32600);
      expect(result.passed).toBe(true);
    });
    
    it('should fail for wrong error code', () => {
      const error = { code: -32601, message: 'Method not found' };
      
      const result = assertErrorCode(error, -32600);
      expect(result.passed).toBe(false);
    });
  });
  
  describe('assertNoError', () => {
    it('should pass when isError is false', () => {
      const response = { isError: false };
      
      const result = assertNoError(response);
      expect(result.passed).toBe(true);
    });
    
    it('should fail when isError is true', () => {
      const response = { isError: true };
      
      const result = assertNoError(response);
      expect(result.passed).toBe(false);
    });
  });
  
  describe('assertConnected', () => {
    it('should pass when connector is connected', () => {
      const connector = { isConnected: () => true };
      
      const result = assertConnected(connector);
      expect(result.passed).toBe(true);
    });
    
    it('should fail when connector is disconnected', () => {
      const connector = { isConnected: () => false };
      
      const result = assertConnected(connector);
      expect(result.passed).toBe(false);
    });
  });
  
  describe('assertMatchesSchema', () => {
    it('should pass for valid object', () => {
      const value = { name: 'test', version: '1.0.0' };
      const schema = {
        type: 'object',
        required: ['name', 'version'],
        properties: {
          name: { type: 'string' },
          version: { type: 'string' },
        },
      };
      
      const result = assertMatchesSchema(value, schema);
      expect(result.passed).toBe(true);
    });
    
    it('should fail for missing required field', () => {
      const value = { name: 'test' };
      const schema = {
        type: 'object',
        required: ['name', 'version'],
      };
      
      const result = assertMatchesSchema(value, schema);
      expect(result.passed).toBe(false);
    });
  });
});

describe('Basic Assertions', () => {
  describe('assertEqual', () => {
    it('should pass for equal values', () => {
      expect(() => assertEqual({ a: 1 }, { a: 1 })).not.toThrow();
    });
    
    it('should throw for unequal values', () => {
      expect(() => assertEqual({ a: 1 }, { a: 2 })).toThrow(AssertionError);
    });
  });
  
  describe('assertTrue', () => {
    it('should pass for true', () => {
      expect(() => assertTrue(true)).not.toThrow();
    });
    
    it('should throw for false', () => {
      expect(() => assertTrue(false)).toThrow(AssertionError);
    });
  });
  
  describe('assertFalse', () => {
    it('should pass for false', () => {
      expect(() => assertFalse(false)).not.toThrow();
    });
    
    it('should throw for true', () => {
      expect(() => assertFalse(true)).toThrow(AssertionError);
    });
  });
});

describe('Expect-style Matchers', () => {
  it('should support toMatchToolResponse', () => {
    const response = {
      content: [{ type: 'text', text: 'Hello' }],
    };
    
    expect(() => {
      mcpExpect(response).toMatchToolResponse({
        content: [{ type: 'text' }],
      });
    }).not.toThrow();
  });
  
  it('should support toContainText', () => {
    const response = {
      content: [{ type: 'text', text: 'Hello World' }],
    };
    
    expect(() => {
      mcpExpect(response).toContainText('World');
    }).not.toThrow();
  });
  
  it('should support negation with not', () => {
    const response = {
      content: [{ type: 'text', text: 'Hello' }],
    };
    
    expect(() => {
      mcpExpect(response).not.toContainText('Goodbye');
    }).not.toThrow();
  });
  
  it('should support toBeConnected', () => {
    const connector = { isConnected: () => true };
    
    expect(() => {
      mcpExpect(connector).toBeConnected();
    }).not.toThrow();
  });
});
