/**
 * Jest Test Setup File
 * 
 * This file runs before each test file and sets up the testing environment.
 * It configures global mocks, extends Jest matchers, and sets up cleanup.
 */

import { jest } from '@jest/globals';

// Increase timeout for all tests (can be overridden per-test)
jest.setTimeout(30000);

// Global test cleanup
afterEach(() => {
    // Clear all mocks after each test
    jest.clearAllMocks();

    // Restore environment variables if modified
    if ((global as any).__originalEnv) {
        process.env = (global as any).__originalEnv;
        delete (global as any).__originalEnv;
    }
});

// Global error handler for unhandled rejections in tests
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Custom matchers can be added here
// expect.extend({
//   toBeValidManifest(received) {
//     // Custom matcher implementation
//   }
// });

// Export for potential use in test files
export { };
