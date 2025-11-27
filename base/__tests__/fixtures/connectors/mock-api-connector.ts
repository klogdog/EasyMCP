/**
 * Sample Mock Connector
 * Used for testing connector loading
 * 
 * @connector mock-api
 * @description A mock API connector for testing
 * @config baseUrl string The base URL of the API
 * @config timeout number Request timeout in milliseconds (default: 5000)
 * @secret API_KEY The API key for authentication
 */

export class MockApiConnector {
    private baseUrl: string;
    private timeout: number;
    private apiKey: string;

    constructor() {
        this.baseUrl = process.env.MOCK_API_URL || 'https://api.example.com';
        this.timeout = parseInt(process.env.MOCK_API_TIMEOUT || '5000', 10);
        this.apiKey = process.env.API_KEY || '';
    }

    async get(endpoint: string): Promise<any> {
        // Mock implementation
        return { endpoint, baseUrl: this.baseUrl, success: true };
    }

    async post(endpoint: string, data: any): Promise<any> {
        // Mock implementation
        return { endpoint, data, success: true };
    }

    isConnected(): boolean {
        return !!this.apiKey;
    }
}

export default MockApiConnector;
