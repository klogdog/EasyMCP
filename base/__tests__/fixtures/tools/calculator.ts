/**
 * Sample Calculator Tool
 * Used for testing tool loading and execution
 */

export const metadata = {
    "name": "calculator",
    "description": "Performs basic arithmetic operations",
    "version": "1.0.0",
    "capabilities": ["math", "arithmetic"]
};

export function calculator(operation: string, a: number, b: number): number {
    switch (operation) {
        case 'add':
            return a + b;
        case 'subtract':
            return a - b;
        case 'multiply':
            return a * b;
        case 'divide':
            if (b === 0) throw new Error('Division by zero');
            return a / b;
        default:
            throw new Error(`Unknown operation: ${operation}`);
    }
}

export default calculator;
