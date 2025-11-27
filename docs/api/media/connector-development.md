# Connector Development Guide

A comprehensive guide to developing MCP connectors for the EasyMCP framework.

## Table of Contents

1. [Introduction](#introduction)
2. [Connector Interface](#connector-interface)
3. [Authentication Patterns](#authentication-patterns)
4. [Connection Management](#connection-management)
5. [Complete Example: Slack Connector](#complete-example-slack-connector)
6. [Error Handling](#error-handling)
7. [Credential Declaration](#credential-declaration)
8. [Testing Connectors](#testing-connectors)
9. [Security Considerations](#security-considerations)

---

## Introduction

Connectors are the bridge between your MCP server and external services. They handle authentication, connection management, and provide a consistent interface for interacting with APIs, databases, and other external systems.

### What is a Connector?

A connector is a module that:
- Manages connections to external services
- Handles authentication and credential management
- Provides health checks and connection monitoring
- Implements retry logic and rate limiting
- Exposes service-specific operations

### Connectors vs Tools

| Aspect | Tools | Connectors |
|--------|-------|------------|
| Purpose | Perform operations | Manage connections |
| Lifecycle | Stateless (mostly) | Stateful (connection state) |
| Authentication | Per-request | Persistent session |
| Examples | Text analysis, calculations | Database, Email, APIs |

---

## Connector Interface

### Required Methods

Every connector must implement these core methods:

```typescript
interface Connector {
    // Lifecycle methods
    initialize(config: ConnectorConfig): Promise<void>;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    
    // Health check
    healthCheck(): Promise<HealthCheckResult>;
    testConnection(): Promise<boolean>;
}
```

### File Location

Connectors must be placed in the `/connectors` directory:

```
/workspace
├── connectors/
│   ├── gmail.ts           # Gmail connector
│   ├── notion.ts          # Notion connector
│   ├── database-connector.py  # Database connector
│   └── slack.ts           # Slack connector
```

### Connector Structure

```typescript
// connectors/my-connector.ts

/**
 * Connector metadata for MCP discovery
 */
export const metadata = {
    name: 'my-connector',
    description: 'Connects to MyService API',
    version: '1.0.0',
    type: 'api',
    authentication: {
        type: 'api_key',
        description: 'API key authentication'
    },
    credentials: [
        {
            name: 'MY_SERVICE_API_KEY',
            type: 'api_key',
            required: true,
            description: 'API key from MyService dashboard'
        }
    ],
    methods: ['connect', 'disconnect', 'healthCheck', 'getData', 'sendData'],
    rateLimits: {
        requestsPerMinute: 100,
        requestsPerDay: 10000
    }
};

/**
 * Connector state
 */
interface ConnectorState {
    initialized: boolean;
    connected: boolean;
    config: MyServiceConfig | null;
    lastHealthCheck: Date | null;
}

const state: ConnectorState = {
    initialized: false,
    connected: false,
    config: null,
    lastHealthCheck: null
};

/**
 * Initialize the connector with configuration
 */
export async function initialize(config: MyServiceConfig): Promise<void> {
    validateConfig(config);
    state.config = config;
    state.initialized = true;
}

/**
 * Establish connection to the service
 */
export async function connect(): Promise<void> {
    if (!state.initialized) {
        throw new Error('Connector not initialized. Call initialize() first.');
    }
    // Connection logic here
    state.connected = true;
}

/**
 * Close connection and cleanup resources
 */
export async function disconnect(): Promise<void> {
    state.connected = false;
    state.config = null;
    state.initialized = false;
}

/**
 * Check connector health
 */
export async function healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
        const isConnected = await testConnection();
        state.lastHealthCheck = new Date();
        
        return {
            healthy: isConnected,
            latency: Date.now() - start,
            message: isConnected ? 'Connection healthy' : 'Connection failed',
            timestamp: state.lastHealthCheck
        };
    } catch (error) {
        return {
            healthy: false,
            latency: Date.now() - start,
            message: `Health check failed: ${error.message}`,
            timestamp: new Date()
        };
    }
}

/**
 * Test if the connection is working
 */
export async function testConnection(): Promise<boolean> {
    // Implement connection test
    return state.connected;
}
```

---

## Authentication Patterns

### API Key Authentication

The simplest authentication method using a static API key:

```typescript
export const metadata = {
    name: 'simple-api-connector',
    authentication: {
        type: 'api_key',
        headerName: 'X-API-Key'  // Optional: custom header name
    },
    credentials: [
        {
            name: 'SERVICE_API_KEY',
            type: 'api_key',
            required: true,
            description: 'API key for the service'
        }
    ]
};

interface ApiKeyConfig {
    apiKey: string;
    baseUrl?: string;
}

const state = {
    apiKey: null as string | null,
    baseUrl: 'https://api.example.com'
};

export async function initialize(config: ApiKeyConfig): Promise<void> {
    if (!config.apiKey) {
        throw new Error('API key is required');
    }
    state.apiKey = config.apiKey;
    state.baseUrl = config.baseUrl || state.baseUrl;
}

async function makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    if (!state.apiKey) {
        throw new Error('Connector not initialized');
    }
    
    const response = await fetch(`${state.baseUrl}${endpoint}`, {
        ...options,
        headers: {
            'X-API-Key': state.apiKey,
            'Content-Type': 'application/json',
            ...options.headers
        }
    });
    
    if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    return response;
}

export async function getData(id: string): Promise<any> {
    const response = await makeRequest(`/data/${id}`);
    return response.json();
}
```

### OAuth2 Authentication

Full OAuth2 flow with token refresh:

```typescript
export const metadata = {
    name: 'oauth2-connector',
    authentication: {
        type: 'oauth2',
        scopes: ['read', 'write'],
        authUrl: 'https://service.com/oauth/authorize',
        tokenUrl: 'https://service.com/oauth/token'
    },
    credentials: [
        {
            name: 'CLIENT_ID',
            type: 'oauth_client_id',
            required: true,
            description: 'OAuth2 Client ID'
        },
        {
            name: 'CLIENT_SECRET',
            type: 'oauth_client_secret',
            required: true,
            description: 'OAuth2 Client Secret'
        },
        {
            name: 'REFRESH_TOKEN',
            type: 'oauth_refresh_token',
            required: true,
            description: 'OAuth2 Refresh Token'
        }
    ]
};

interface OAuth2Config {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
}

interface TokenState {
    accessToken: string | null;
    expiresAt: number;
    refreshToken: string | null;
}

const state: {
    config: OAuth2Config | null;
    tokens: TokenState;
} = {
    config: null,
    tokens: {
        accessToken: null,
        expiresAt: 0,
        refreshToken: null
    }
};

export async function initialize(config: OAuth2Config): Promise<void> {
    state.config = config;
    state.tokens.refreshToken = config.refreshToken;
    
    // Get initial access token
    await refreshAccessToken();
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(): Promise<void> {
    if (!state.config || !state.tokens.refreshToken) {
        throw new AuthenticationError('Missing refresh token');
    }
    
    const response = await fetch('https://service.com/oauth/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: state.config.clientId,
            client_secret: state.config.clientSecret,
            refresh_token: state.tokens.refreshToken
        })
    });
    
    if (!response.ok) {
        throw new AuthenticationError(`Token refresh failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    state.tokens.accessToken = data.access_token;
    state.tokens.expiresAt = Date.now() + (data.expires_in * 1000);
    
    if (data.refresh_token) {
        state.tokens.refreshToken = data.refresh_token;
    }
}

/**
 * Get a valid access token, refreshing if necessary
 */
async function getAccessToken(): Promise<string> {
    // Refresh if token expires in less than 5 minutes
    if (Date.now() > state.tokens.expiresAt - 300000) {
        await refreshAccessToken();
    }
    
    if (!state.tokens.accessToken) {
        throw new AuthenticationError('No access token available');
    }
    
    return state.tokens.accessToken;
}

async function makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const token = await getAccessToken();
    
    const response = await fetch(`https://api.service.com${endpoint}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    });
    
    // Handle token expiration
    if (response.status === 401) {
        await refreshAccessToken();
        const newToken = await getAccessToken();
        
        return fetch(`https://api.service.com${endpoint}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${newToken}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
    }
    
    return response;
}
```

### Basic Authentication

Username and password authentication:

```typescript
export const metadata = {
    name: 'basic-auth-connector',
    authentication: {
        type: 'basic',
        description: 'HTTP Basic Authentication'
    },
    credentials: [
        {
            name: 'SERVICE_USERNAME',
            type: 'username',
            required: true,
            description: 'Service username'
        },
        {
            name: 'SERVICE_PASSWORD',
            type: 'password',
            required: true,
            description: 'Service password'
        }
    ]
};

interface BasicAuthConfig {
    username: string;
    password: string;
    baseUrl: string;
}

const state: {
    authHeader: string | null;
    baseUrl: string;
} = {
    authHeader: null,
    baseUrl: ''
};

export async function initialize(config: BasicAuthConfig): Promise<void> {
    const credentials = Buffer.from(`${config.username}:${config.password}`).toString('base64');
    state.authHeader = `Basic ${credentials}`;
    state.baseUrl = config.baseUrl;
}

async function makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    if (!state.authHeader) {
        throw new Error('Connector not initialized');
    }
    
    return fetch(`${state.baseUrl}${endpoint}`, {
        ...options,
        headers: {
            'Authorization': state.authHeader,
            ...options.headers
        }
    });
}
```

### Custom Authentication

For services with custom authentication schemes:

```typescript
export const metadata = {
    name: 'custom-auth-connector',
    authentication: {
        type: 'custom',
        description: 'Custom HMAC signature authentication'
    },
    credentials: [
        {
            name: 'API_KEY',
            type: 'api_key',
            required: true
        },
        {
            name: 'API_SECRET',
            type: 'api_secret',
            required: true
        }
    ]
};

interface CustomAuthConfig {
    apiKey: string;
    apiSecret: string;
}

const state: {
    apiKey: string | null;
    apiSecret: string | null;
} = {
    apiKey: null,
    apiSecret: null
};

export async function initialize(config: CustomAuthConfig): Promise<void> {
    state.apiKey = config.apiKey;
    state.apiSecret = config.apiSecret;
}

/**
 * Generate HMAC signature for request
 */
function generateSignature(method: string, path: string, timestamp: number, body: string): string {
    const crypto = require('crypto');
    const message = `${method}${path}${timestamp}${body}`;
    return crypto
        .createHmac('sha256', state.apiSecret!)
        .update(message)
        .digest('hex');
}

async function makeRequest(
    method: string,
    path: string,
    body?: object
): Promise<Response> {
    if (!state.apiKey || !state.apiSecret) {
        throw new Error('Connector not initialized');
    }
    
    const timestamp = Date.now();
    const bodyString = body ? JSON.stringify(body) : '';
    const signature = generateSignature(method, path, timestamp, bodyString);
    
    return fetch(`https://api.service.com${path}`, {
        method,
        headers: {
            'X-API-Key': state.apiKey,
            'X-Timestamp': timestamp.toString(),
            'X-Signature': signature,
            'Content-Type': 'application/json'
        },
        body: bodyString || undefined
    });
}
```

---

## Connection Management

### Connection Pooling

For database connectors, implement connection pooling:

```typescript
interface PoolConfig {
    minConnections: number;
    maxConnections: number;
    idleTimeout: number;
    acquireTimeout: number;
}

class ConnectionPool<T> {
    private available: T[] = [];
    private inUse: Set<T> = new Set();
    private waitQueue: Array<{
        resolve: (conn: T) => void;
        reject: (error: Error) => void;
    }> = [];
    
    constructor(
        private config: PoolConfig,
        private createConnection: () => Promise<T>,
        private destroyConnection: (conn: T) => Promise<void>
    ) {}
    
    async acquire(): Promise<T> {
        // Try to get an available connection
        if (this.available.length > 0) {
            const conn = this.available.pop()!;
            this.inUse.add(conn);
            return conn;
        }
        
        // Create new connection if under limit
        if (this.inUse.size < this.config.maxConnections) {
            const conn = await this.createConnection();
            this.inUse.add(conn);
            return conn;
        }
        
        // Wait for a connection to become available
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                const index = this.waitQueue.findIndex(w => w.resolve === resolve);
                if (index !== -1) {
                    this.waitQueue.splice(index, 1);
                }
                reject(new Error('Connection acquire timeout'));
            }, this.config.acquireTimeout);
            
            this.waitQueue.push({
                resolve: (conn: T) => {
                    clearTimeout(timeout);
                    resolve(conn);
                },
                reject
            });
        });
    }
    
    release(conn: T): void {
        this.inUse.delete(conn);
        
        // Give to waiting request
        if (this.waitQueue.length > 0) {
            const waiter = this.waitQueue.shift()!;
            this.inUse.add(conn);
            waiter.resolve(conn);
            return;
        }
        
        // Return to pool
        this.available.push(conn);
    }
    
    async drain(): Promise<void> {
        // Close all connections
        for (const conn of this.available) {
            await this.destroyConnection(conn);
        }
        for (const conn of this.inUse) {
            await this.destroyConnection(conn);
        }
        this.available = [];
        this.inUse.clear();
    }
    
    getStats(): { available: number; inUse: number; waiting: number } {
        return {
            available: this.available.length,
            inUse: this.inUse.size,
            waiting: this.waitQueue.length
        };
    }
}
```

### Retry Logic with Exponential Backoff

```typescript
interface RetryConfig {
    maxRetries: number;
    baseDelay: number;  // in ms
    maxDelay: number;   // in ms
    backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2
};

/**
 * Execute a function with retry logic
 */
async function withRetry<T>(
    fn: () => Promise<T>,
    config: RetryConfig = DEFAULT_RETRY_CONFIG,
    shouldRetry: (error: Error) => boolean = () => true
): Promise<T> {
    let lastError: Error;
    let delay = config.baseDelay;
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;
            
            // Don't retry on last attempt or if error is not retryable
            if (attempt === config.maxRetries || !shouldRetry(lastError)) {
                throw lastError;
            }
            
            // Add jitter to prevent thundering herd
            const jitter = Math.random() * 0.3 * delay;
            await sleep(delay + jitter);
            
            // Increase delay for next attempt
            delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
        }
    }
    
    throw lastError!;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Usage in connector
export async function fetchData(id: string): Promise<any> {
    return withRetry(
        async () => {
            const response = await makeRequest(`/data/${id}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
        },
        { maxRetries: 3, baseDelay: 1000, maxDelay: 10000, backoffMultiplier: 2 },
        (error) => {
            // Only retry on network errors or 5xx responses
            return error.message.includes('network') ||
                   error.message.includes('HTTP 5');
        }
    );
}
```

### Timeout Handling

```typescript
/**
 * Execute a function with timeout
 */
async function withTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    message = 'Operation timed out'
): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
        const result = await Promise.race([
            fn(),
            new Promise<never>((_, reject) => {
                controller.signal.addEventListener('abort', () => {
                    reject(new TimeoutError(message, timeoutMs));
                });
            })
        ]);
        return result;
    } finally {
        clearTimeout(timeout);
    }
}

class TimeoutError extends Error {
    constructor(message: string, public timeoutMs: number) {
        super(message);
        this.name = 'TimeoutError';
    }
}

// Usage
export async function connect(): Promise<void> {
    await withTimeout(
        async () => {
            // Connection logic
            await establishConnection();
        },
        30000,
        'Connection timeout after 30 seconds'
    );
}
```

### Reconnection Strategies

```typescript
interface ReconnectionConfig {
    enabled: boolean;
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
}

class ReconnectionManager {
    private attempts = 0;
    private reconnecting = false;
    private listeners: Array<(connected: boolean) => void> = [];
    
    constructor(
        private config: ReconnectionConfig,
        private connectFn: () => Promise<void>,
        private isConnectedFn: () => boolean
    ) {}
    
    async start(): Promise<void> {
        if (this.reconnecting) return;
        
        this.reconnecting = true;
        this.attempts = 0;
        
        while (this.attempts < this.config.maxAttempts) {
            try {
                await this.connectFn();
                this.reconnecting = false;
                this.attempts = 0;
                this.notifyListeners(true);
                return;
            } catch (error) {
                this.attempts++;
                console.warn(`Reconnection attempt ${this.attempts} failed:`, error);
                
                if (this.attempts >= this.config.maxAttempts) {
                    this.reconnecting = false;
                    this.notifyListeners(false);
                    throw new Error(`Failed to reconnect after ${this.attempts} attempts`);
                }
                
                const delay = Math.min(
                    this.config.initialDelay * Math.pow(2, this.attempts - 1),
                    this.config.maxDelay
                );
                await sleep(delay);
            }
        }
    }
    
    onReconnect(listener: (connected: boolean) => void): void {
        this.listeners.push(listener);
    }
    
    private notifyListeners(connected: boolean): void {
        for (const listener of this.listeners) {
            listener(connected);
        }
    }
}
```

---

## Complete Example: Slack Connector

Here's a complete Slack connector implementation:

```typescript
// connectors/slack.ts

/**
 * MCP Connector - Slack
 * 
 * A connector for Slack Web API demonstrating token-based authentication,
 * message operations, and comprehensive error handling.
 * 
 * @connector slack
 * @description Connect to Slack for messaging and channel operations
 * @example
 * ```typescript
 * import slack from './slack';
 * 
 * await slack.initialize({
 *   token: process.env.SLACK_BOT_TOKEN
 * });
 * 
 * await slack.sendMessage('#general', 'Hello from MCP!');
 * const channels = await slack.listChannels();
 * ```
 */

// ============================================
// METADATA
// ============================================

export const metadata = {
    name: 'slack',
    description: 'Connects to Slack Web API for messaging operations',
    version: '1.0.0',
    type: 'messaging',
    authentication: {
        type: 'token',
        description: 'Slack Bot Token (xoxb-...)'
    },
    credentials: [
        {
            name: 'SLACK_BOT_TOKEN',
            type: 'api_key',
            required: true,
            description: 'Slack Bot User OAuth Token (starts with xoxb-)'
        }
    ],
    methods: [
        'initialize',
        'connect',
        'disconnect',
        'healthCheck',
        'testConnection',
        'sendMessage',
        'listChannels',
        'getChannelInfo',
        'postReaction',
        'getMessages'
    ],
    rateLimits: {
        tier1: { requestsPerMinute: 1 },    // Rare operations
        tier2: { requestsPerMinute: 20 },   // Common operations
        tier3: { requestsPerMinute: 50 },   // Very common operations
        tier4: { requestsPerMinute: 100 }   // Frequent operations
    }
};

// ============================================
// TYPES
// ============================================

export interface SlackConfig {
    token: string;
    defaultChannel?: string;
    retryConfig?: {
        maxRetries: number;
        baseDelay: number;
    };
}

export interface Channel {
    id: string;
    name: string;
    isPrivate: boolean;
    memberCount: number;
    topic?: string;
    purpose?: string;
}

export interface Message {
    ts: string;
    text: string;
    user: string;
    channel: string;
    threadTs?: string;
    reactions?: Array<{ name: string; count: number }>;
}

export interface HealthCheckResult {
    healthy: boolean;
    latency: number;
    message: string;
    timestamp: Date;
    details?: {
        team?: string;
        user?: string;
    };
}

// ============================================
// ERROR CLASSES
// ============================================

export class SlackError extends Error {
    constructor(
        message: string,
        public code: string,
        public retryable: boolean = false
    ) {
        super(message);
        this.name = 'SlackError';
    }
}

export class RateLimitError extends SlackError {
    constructor(public retryAfter: number) {
        super(
            `Rate limited. Retry after ${retryAfter} seconds`,
            'rate_limited',
            true
        );
        this.name = 'RateLimitError';
    }
}

export class AuthenticationError extends SlackError {
    constructor(message: string) {
        super(message, 'invalid_auth', false);
        this.name = 'AuthenticationError';
    }
}

// ============================================
// STATE
// ============================================

interface ConnectorState {
    initialized: boolean;
    connected: boolean;
    config: SlackConfig | null;
    teamInfo: { id: string; name: string } | null;
    botInfo: { id: string; name: string } | null;
    lastHealthCheck: Date | null;
}

const state: ConnectorState = {
    initialized: false,
    connected: false,
    config: null,
    teamInfo: null,
    botInfo: null,
    lastHealthCheck: null
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const API_BASE = 'https://slack.com/api';

async function slackRequest<T>(
    method: string,
    params: Record<string, any> = {}
): Promise<T> {
    if (!state.config?.token) {
        throw new AuthenticationError('Connector not initialized');
    }
    
    const url = `${API_BASE}/${method}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${state.config.token}`,
            'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify(params)
    });
    
    // Handle rate limiting
    if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
        throw new RateLimitError(retryAfter);
    }
    
    const data = await response.json();
    
    if (!data.ok) {
        const errorCode = data.error || 'unknown_error';
        
        // Handle specific errors
        switch (errorCode) {
            case 'invalid_auth':
            case 'not_authed':
            case 'token_expired':
                throw new AuthenticationError(`Authentication failed: ${errorCode}`);
            case 'ratelimited':
                throw new RateLimitError(60);
            default:
                throw new SlackError(
                    `Slack API error: ${errorCode}`,
                    errorCode,
                    ['timeout', 'service_unavailable'].includes(errorCode)
                );
        }
    }
    
    return data;
}

async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;
            
            if (error instanceof RateLimitError) {
                // Wait for rate limit to clear
                await sleep(error.retryAfter * 1000);
                continue;
            }
            
            if (error instanceof SlackError && !error.retryable) {
                throw error;
            }
            
            if (attempt < maxRetries) {
                await sleep(baseDelay * Math.pow(2, attempt));
            }
        }
    }
    
    throw lastError!;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// LIFECYCLE METHODS
// ============================================

/**
 * Initialize the Slack connector
 */
export async function initialize(config: SlackConfig): Promise<void> {
    if (!config.token) {
        throw new AuthenticationError('Slack token is required');
    }
    
    if (!config.token.startsWith('xoxb-')) {
        throw new AuthenticationError('Invalid token format. Expected Bot token (xoxb-...)');
    }
    
    state.config = config;
    state.initialized = true;
    
    // Verify token and get team info
    await connect();
}

/**
 * Connect and verify credentials
 */
export async function connect(): Promise<void> {
    if (!state.initialized) {
        throw new Error('Connector not initialized. Call initialize() first.');
    }
    
    const authTest = await slackRequest<{
        ok: boolean;
        team_id: string;
        team: string;
        user_id: string;
        user: string;
    }>('auth.test');
    
    state.teamInfo = {
        id: authTest.team_id,
        name: authTest.team
    };
    
    state.botInfo = {
        id: authTest.user_id,
        name: authTest.user
    };
    
    state.connected = true;
}

/**
 * Disconnect and cleanup
 */
export async function disconnect(): Promise<void> {
    state.connected = false;
    state.teamInfo = null;
    state.botInfo = null;
    state.lastHealthCheck = null;
    // Keep config for potential reconnection
}

/**
 * Health check
 */
export async function healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    
    try {
        const authTest = await slackRequest<{
            ok: boolean;
            team: string;
            user: string;
        }>('auth.test');
        
        state.lastHealthCheck = new Date();
        
        return {
            healthy: true,
            latency: Date.now() - start,
            message: 'Slack connection healthy',
            timestamp: state.lastHealthCheck,
            details: {
                team: authTest.team,
                user: authTest.user
            }
        };
    } catch (error) {
        return {
            healthy: false,
            latency: Date.now() - start,
            message: `Health check failed: ${(error as Error).message}`,
            timestamp: new Date()
        };
    }
}

/**
 * Test connection
 */
export async function testConnection(): Promise<boolean> {
    try {
        const result = await healthCheck();
        return result.healthy;
    } catch {
        return false;
    }
}

// ============================================
// MESSAGING METHODS
// ============================================

/**
 * Send a message to a channel
 */
export async function sendMessage(
    channel: string,
    text: string,
    options: {
        threadTs?: string;
        blocks?: any[];
        attachments?: any[];
    } = {}
): Promise<Message> {
    const response = await withRetry(() => slackRequest<{
        ok: boolean;
        ts: string;
        channel: string;
        message: any;
    }>('chat.postMessage', {
        channel,
        text,
        thread_ts: options.threadTs,
        blocks: options.blocks,
        attachments: options.attachments
    }));
    
    return {
        ts: response.ts,
        text,
        user: state.botInfo?.id || '',
        channel: response.channel,
        threadTs: options.threadTs
    };
}

/**
 * List available channels
 */
export async function listChannels(options: {
    excludeArchived?: boolean;
    types?: string;
    limit?: number;
} = {}): Promise<Channel[]> {
    const response = await withRetry(() => slackRequest<{
        ok: boolean;
        channels: any[];
    }>('conversations.list', {
        exclude_archived: options.excludeArchived ?? true,
        types: options.types ?? 'public_channel,private_channel',
        limit: options.limit ?? 100
    }));
    
    return response.channels.map((ch: any) => ({
        id: ch.id,
        name: ch.name,
        isPrivate: ch.is_private,
        memberCount: ch.num_members,
        topic: ch.topic?.value,
        purpose: ch.purpose?.value
    }));
}

/**
 * Get channel information
 */
export async function getChannelInfo(channelId: string): Promise<Channel> {
    const response = await withRetry(() => slackRequest<{
        ok: boolean;
        channel: any;
    }>('conversations.info', { channel: channelId }));
    
    const ch = response.channel;
    return {
        id: ch.id,
        name: ch.name,
        isPrivate: ch.is_private,
        memberCount: ch.num_members,
        topic: ch.topic?.value,
        purpose: ch.purpose?.value
    };
}

/**
 * Get messages from a channel
 */
export async function getMessages(
    channel: string,
    options: { limit?: number; oldest?: string; latest?: string } = {}
): Promise<Message[]> {
    const response = await withRetry(() => slackRequest<{
        ok: boolean;
        messages: any[];
    }>('conversations.history', {
        channel,
        limit: options.limit ?? 20,
        oldest: options.oldest,
        latest: options.latest
    }));
    
    return response.messages.map((msg: any) => ({
        ts: msg.ts,
        text: msg.text,
        user: msg.user,
        channel,
        threadTs: msg.thread_ts,
        reactions: msg.reactions?.map((r: any) => ({
            name: r.name,
            count: r.count
        }))
    }));
}

/**
 * Add a reaction to a message
 */
export async function postReaction(
    channel: string,
    timestamp: string,
    emoji: string
): Promise<void> {
    await withRetry(() => slackRequest('reactions.add', {
        channel,
        timestamp,
        name: emoji.replace(/:/g, '')
    }));
}

// ============================================
// DEFAULT EXPORT
// ============================================

export default {
    metadata,
    initialize,
    connect,
    disconnect,
    healthCheck,
    testConnection,
    sendMessage,
    listChannels,
    getChannelInfo,
    getMessages,
    postReaction
};
```

---

## Error Handling

### Error Classes

Define specific error classes for different failure types:

```typescript
/**
 * Base connector error
 */
export class ConnectorError extends Error {
    constructor(
        message: string,
        public code: string,
        public retryable: boolean = false,
        public details?: Record<string, any>
    ) {
        super(message);
        this.name = 'ConnectorError';
    }
}

/**
 * Network-related errors
 */
export class NetworkError extends ConnectorError {
    constructor(message: string, details?: Record<string, any>) {
        super(message, 'NETWORK_ERROR', true, details);
        this.name = 'NetworkError';
    }
}

/**
 * Authentication failures
 */
export class AuthenticationError extends ConnectorError {
    constructor(message: string, code = 'AUTH_FAILED') {
        super(message, code, false);
        this.name = 'AuthenticationError';
    }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends ConnectorError {
    constructor(
        message: string,
        public retryAfter: number,
        public limit?: number,
        public remaining?: number
    ) {
        super(message, 'RATE_LIMITED', true, { retryAfter, limit, remaining });
        this.name = 'RateLimitError';
    }
}

/**
 * API-specific errors
 */
export class ApiError extends ConnectorError {
    constructor(
        message: string,
        public statusCode: number,
        public response?: any
    ) {
        super(
            message,
            `API_ERROR_${statusCode}`,
            statusCode >= 500  // 5xx errors are retryable
        );
        this.name = 'ApiError';
    }
}

/**
 * Timeout errors
 */
export class TimeoutError extends ConnectorError {
    constructor(message: string, public timeoutMs: number) {
        super(message, 'TIMEOUT', true, { timeoutMs });
        this.name = 'TimeoutError';
    }
}
```

### Error Handling Patterns

```typescript
/**
 * Handle errors from API responses
 */
function handleApiError(response: Response, body?: any): never {
    switch (response.status) {
        case 400:
            throw new ApiError('Bad request', 400, body);
        case 401:
            throw new AuthenticationError('Invalid or expired credentials');
        case 403:
            throw new AuthenticationError('Access forbidden');
        case 404:
            throw new ApiError('Resource not found', 404, body);
        case 429:
            const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
            throw new RateLimitError('Too many requests', retryAfter);
        case 500:
        case 502:
        case 503:
        case 504:
            throw new ApiError(`Server error: ${response.status}`, response.status, body);
        default:
            throw new ApiError(`Unexpected error: ${response.status}`, response.status, body);
    }
}

/**
 * Wrap async operations with error handling
 */
async function safeExecute<T>(
    operation: () => Promise<T>,
    context: string
): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        if (error instanceof ConnectorError) {
            throw error;  // Re-throw known errors
        }
        
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new NetworkError(`Network error during ${context}: ${error.message}`);
        }
        
        throw new ConnectorError(
            `Unknown error during ${context}: ${(error as Error).message}`,
            'UNKNOWN_ERROR',
            false
        );
    }
}
```

---

## Credential Declaration

### Metadata Credential Specification

```typescript
export const metadata = {
    name: 'my-connector',
    credentials: [
        {
            name: 'API_KEY',
            type: 'api_key',
            required: true,
            description: 'Primary API key',
            validation: {
                pattern: '^[A-Za-z0-9]{32}$',
                message: 'API key must be 32 alphanumeric characters'
            }
        },
        {
            name: 'API_SECRET',
            type: 'api_secret',
            required: true,
            description: 'API secret for signing requests'
        },
        {
            name: 'WEBHOOK_URL',
            type: 'url',
            required: false,
            description: 'Optional webhook URL for notifications',
            validation: {
                pattern: '^https://',
                message: 'Webhook URL must use HTTPS'
            }
        }
    ]
};
```

### Credential Validation

```typescript
interface CredentialSpec {
    name: string;
    type: string;
    required: boolean;
    description?: string;
    validation?: {
        pattern?: string;
        message?: string;
    };
}

function validateCredentials(
    config: Record<string, any>,
    specs: CredentialSpec[]
): void {
    for (const spec of specs) {
        const value = config[spec.name] || process.env[spec.name];
        
        if (spec.required && !value) {
            throw new AuthenticationError(
                `Missing required credential: ${spec.name}. ${spec.description || ''}`
            );
        }
        
        if (value && spec.validation?.pattern) {
            const regex = new RegExp(spec.validation.pattern);
            if (!regex.test(value)) {
                throw new AuthenticationError(
                    spec.validation.message || 
                    `Invalid format for ${spec.name}`
                );
            }
        }
    }
}

export async function initialize(config: ConnectorConfig): Promise<void> {
    validateCredentials(config, metadata.credentials);
    // ... rest of initialization
}
```

---

## Testing Connectors

### Mocking External Services

```typescript
// __tests__/slack.test.ts
import * as slack from '../slack';

// Mock fetch
global.fetch = jest.fn();

describe('Slack Connector', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    
    describe('initialize', () => {
        it('should initialize with valid token', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    ok: true,
                    team_id: 'T123',
                    team: 'Test Team',
                    user_id: 'U123',
                    user: 'bot'
                })
            });
            
            await expect(slack.initialize({
                token: 'xoxb-test-token'
            })).resolves.not.toThrow();
        });
        
        it('should reject invalid token format', async () => {
            await expect(slack.initialize({
                token: 'invalid-token'
            })).rejects.toThrow('Invalid token format');
        });
    });
    
    describe('sendMessage', () => {
        beforeEach(async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    ok: true,
                    team_id: 'T123',
                    team: 'Test Team',
                    user_id: 'U123',
                    user: 'bot'
                })
            });
            await slack.initialize({ token: 'xoxb-test-token' });
        });
        
        it('should send message successfully', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    ok: true,
                    ts: '1234567890.123456',
                    channel: 'C123'
                })
            });
            
            const result = await slack.sendMessage('#general', 'Hello!');
            
            expect(result.ts).toBe('1234567890.123456');
            expect(result.text).toBe('Hello!');
        });
        
        it('should handle rate limiting', async () => {
            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: false,
                    status: 429,
                    headers: new Map([['Retry-After', '1']])
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({
                        ok: true,
                        ts: '1234567890.123456',
                        channel: 'C123'
                    })
                });
            
            const result = await slack.sendMessage('#general', 'Hello!');
            
            expect(result.ts).toBe('1234567890.123456');
            expect(global.fetch).toHaveBeenCalledTimes(3); // auth + 2 attempts
        });
    });
});
```

### Testing in Isolation

```typescript
// Create a test harness
class ConnectorTestHarness {
    private mockResponses: Map<string, any> = new Map();
    
    mockEndpoint(endpoint: string, response: any): void {
        this.mockResponses.set(endpoint, response);
    }
    
    async executeRequest(endpoint: string): Promise<any> {
        if (this.mockResponses.has(endpoint)) {
            return this.mockResponses.get(endpoint);
        }
        throw new Error(`No mock for endpoint: ${endpoint}`);
    }
}

// Usage in tests
describe('Connector Integration', () => {
    let harness: ConnectorTestHarness;
    
    beforeEach(() => {
        harness = new ConnectorTestHarness();
    });
    
    it('should handle paginated responses', async () => {
        harness.mockEndpoint('users.list?cursor=', {
            ok: true,
            members: [{ id: 'U1' }, { id: 'U2' }],
            response_metadata: { next_cursor: 'cursor123' }
        });
        
        harness.mockEndpoint('users.list?cursor=cursor123', {
            ok: true,
            members: [{ id: 'U3' }],
            response_metadata: { next_cursor: '' }
        });
        
        // Test pagination handling
    });
});
```

---

## Security Considerations

### Secure Credential Storage

```typescript
/**
 * NEVER log credentials
 */
function logConfig(config: ConnectorConfig): void {
    const sanitized = { ...config };
    
    // Remove sensitive fields
    const sensitiveKeys = ['token', 'apiKey', 'password', 'secret', 'credential'];
    for (const key of Object.keys(sanitized)) {
        if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
            sanitized[key] = '[REDACTED]';
        }
    }
    
    console.log('Connector config:', sanitized);
}

/**
 * Clear credentials from memory when done
 */
export async function disconnect(): Promise<void> {
    // Clear sensitive data
    if (state.config) {
        Object.keys(state.config).forEach(key => {
            (state.config as any)[key] = null;
        });
    }
    state.config = null;
}
```

### HTTPS Requirements

```typescript
export async function initialize(config: ConnectorConfig): Promise<void> {
    // Validate endpoint uses HTTPS
    if (config.apiEndpoint && !config.apiEndpoint.startsWith('https://')) {
        throw new Error('API endpoint must use HTTPS');
    }
    
    // Default to HTTPS
    state.apiEndpoint = config.apiEndpoint || 'https://api.service.com';
}
```

### Token Refresh

```typescript
/**
 * Implement automatic token refresh
 */
class TokenManager {
    private token: string | null = null;
    private expiresAt: number = 0;
    private refreshing: Promise<void> | null = null;
    
    constructor(
        private refreshFn: () => Promise<{ token: string; expiresIn: number }>
    ) {}
    
    async getToken(): Promise<string> {
        // Check if refresh is needed
        const bufferTime = 5 * 60 * 1000; // 5 minutes
        
        if (Date.now() > this.expiresAt - bufferTime) {
            // Ensure only one refresh at a time
            if (!this.refreshing) {
                this.refreshing = this.refresh();
            }
            await this.refreshing;
        }
        
        if (!this.token) {
            throw new Error('No token available');
        }
        
        return this.token;
    }
    
    private async refresh(): Promise<void> {
        try {
            const { token, expiresIn } = await this.refreshFn();
            this.token = token;
            this.expiresAt = Date.now() + (expiresIn * 1000);
        } finally {
            this.refreshing = null;
        }
    }
    
    invalidate(): void {
        this.token = null;
        this.expiresAt = 0;
    }
}
```

### Rate Limiting

```typescript
/**
 * Implement rate limiting to avoid abuse
 */
class RateLimiter {
    private requests: number[] = [];
    
    constructor(
        private maxRequests: number,
        private windowMs: number
    ) {}
    
    async acquire(): Promise<void> {
        this.cleanup();
        
        if (this.requests.length >= this.maxRequests) {
            const oldestRequest = this.requests[0];
            const waitTime = oldestRequest + this.windowMs - Date.now();
            
            if (waitTime > 0) {
                await sleep(waitTime);
                this.cleanup();
            }
        }
        
        this.requests.push(Date.now());
    }
    
    private cleanup(): void {
        const cutoff = Date.now() - this.windowMs;
        this.requests = this.requests.filter(t => t > cutoff);
    }
}

// Usage
const rateLimiter = new RateLimiter(100, 60000); // 100 req/min

async function makeRequest(endpoint: string): Promise<Response> {
    await rateLimiter.acquire();
    return fetch(endpoint);
}
```

---

## Next Steps

- [Tool Development Guide](./tool-development.md) - Create tools that use connectors
- [Configuration Guide](./configuration.md) - Configure connector credentials
- [Deployment Guide](./deployment.md) - Deploy connectors securely
- [API Documentation](./api/index.html) - Full connector API reference
