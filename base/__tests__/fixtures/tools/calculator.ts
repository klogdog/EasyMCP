/**
 * Sample Calculator Tool
 * Used for testing tool loading and execution
 * 
 * @tool calculator
 * @description Performs basic arithmetic operations
 * @param operation string The operation (add, subtract, multiply, divide)
 * @param a number First number
 * @param b number Second number
 * @returns number The result
 */

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
