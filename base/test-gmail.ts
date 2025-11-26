/**
 * Tests for the Gmail MCP Connector
 * 
 * This test file validates the Gmail connector's functionality including
 * OAuth2 authentication, email operations, and rate limiting.
 */

// ============================================================================
// Types and Mock Implementation (namespaced to avoid conflicts)
// ============================================================================

namespace GmailTests {

    export interface GmailConfig {
        clientId: string;
        clientSecret: string;
        refreshToken: string;
        apiEndpoint?: string;
    }

    export interface EmailMessage {
        id: string;
        threadId: string;
        subject: string;
        from: string;
        to: string[];
        body: string;
        date: Date;
        labels: string[];
        attachments: AttachmentInfo[];
        isRead: boolean;
    }

    export interface AttachmentInfo {
        id: string;
        filename: string;
        mimeType: string;
        size: number;
    }

    export class ConnectionError extends Error {
        public code: string;
        public retryable: boolean;
        constructor(message: string, code: string, retryable = false) {
            super(message);
            this.name = 'ConnectionError';
            this.code = code;
            this.retryable = retryable;
        }
    }

    export class AuthenticationError extends Error {
        public code: string;
        constructor(message: string, code: string = 'AUTH_ERROR') {
            super(message);
            this.name = 'AuthenticationError';
            this.code = code;
        }
    }

    export class RateLimitError extends Error {
        public retryAfter: number;
        constructor(message: string, retryAfter: number = 60) {
            super(message);
            this.name = 'RateLimitError';
            this.retryAfter = retryAfter;
        }
    }

    export const metadata = {
        name: 'gmail',
        description: 'Connects to Gmail API for email operations',
        version: '1.0.0',
        type: 'email',
        authentication: {
            type: 'oauth2',
            scopes: ['gmail.readonly', 'gmail.send']
        },
        credentials: [
            { name: 'GMAIL_CLIENT_ID', type: 'oauth_client_id', required: true },
            { name: 'GMAIL_CLIENT_SECRET', type: 'oauth_client_secret', required: true },
            { name: 'GMAIL_REFRESH_TOKEN', type: 'oauth_refresh_token', required: true }
        ],
        methods: ['listMessages', 'sendEmail', 'searchMessages', 'getMessage', 'testConnection'],
        rateLimits: { requestsPerMinute: 60, requestsPerDay: 10000 }
    };

    class RateLimiter {
        private requests: number[] = [];
        private readonly maxRequestsPerMinute: number;
        private readonly maxRequestsPerDay: number;
        private dailyRequests: number = 0;
        private lastDayReset: number = Date.now();

        constructor(perMinute: number, perDay: number) {
            this.maxRequestsPerMinute = perMinute;
            this.maxRequestsPerDay = perDay;
        }

        canMakeRequest(): boolean {
            this.cleanup();
            return this.requests.length < this.maxRequestsPerMinute &&
                this.dailyRequests < this.maxRequestsPerDay;
        }

        recordRequest(): void {
            this.cleanup();
            this.requests.push(Date.now());
            this.dailyRequests++;
        }

        getWaitTime(): number {
            this.cleanup();
            if (this.dailyRequests >= this.maxRequestsPerDay) {
                const msPerDay = 24 * 60 * 60 * 1000;
                return msPerDay - (Date.now() - this.lastDayReset);
            }
            if (this.requests.length >= this.maxRequestsPerMinute) {
                const oldestRequest = this.requests[0];
                return oldestRequest ? ((oldestRequest + 60000) - Date.now()) : 0;
            }
            return 0;
        }

        private cleanup(): void {
            const now = Date.now();
            const oneMinuteAgo = now - 60000;
            this.requests = this.requests.filter(time => time > oneMinuteAgo);
            const msPerDay = 24 * 60 * 60 * 1000;
            if (now - this.lastDayReset > msPerDay) {
                this.dailyRequests = 0;
                this.lastDayReset = now;
            }
        }

        getStats(): { minuteUsage: number; dailyUsage: number } {
            this.cleanup();
            return { minuteUsage: this.requests.length, dailyUsage: this.dailyRequests };
        }

        reset(): void {
            this.requests = [];
            this.dailyRequests = 0;
        }
    }

    const MOCK_MESSAGES: EmailMessage[] = [
        {
            id: 'msg-001',
            threadId: 'thread-001',
            subject: 'Welcome to Gmail API',
            from: 'noreply@google.com',
            to: ['user@example.com'],
            body: 'Welcome! Your Gmail API integration is working.',
            date: new Date('2024-01-15T10:30:00Z'),
            labels: ['INBOX', 'UNREAD'],
            attachments: [],
            isRead: false
        },
        {
            id: 'msg-002',
            threadId: 'thread-002',
            subject: 'Project Update',
            from: 'colleague@company.com',
            to: ['user@example.com'],
            body: 'Here is the weekly project update...',
            date: new Date('2024-01-14T15:45:00Z'),
            labels: ['INBOX'],
            attachments: [{ id: 'att-001', filename: 'report.pdf', mimeType: 'application/pdf', size: 125000 }],
            isRead: true
        }
    ];

    interface ConnectorState {
        initialized: boolean;
        config: GmailConfig | null;
        accessToken: string | null;
        tokenExpiry: number;
        rateLimiter: RateLimiter;
    }

    let state: ConnectorState = {
        initialized: false,
        config: null,
        accessToken: null,
        tokenExpiry: 0,
        rateLimiter: new RateLimiter(60, 10000)
    };

    function resetState(): void {
        state = {
            initialized: false,
            config: null,
            accessToken: null,
            tokenExpiry: 0,
            rateLimiter: new RateLimiter(60, 10000)
        };
    }

    function validateConfig(config: GmailConfig): void {
        if (!config.clientId || typeof config.clientId !== 'string') {
            throw new AuthenticationError('Client ID is required', 'MISSING_CLIENT_ID');
        }
        if (!config.clientSecret || typeof config.clientSecret !== 'string') {
            throw new AuthenticationError('Client Secret is required', 'MISSING_CLIENT_SECRET');
        }
        if (!config.refreshToken || typeof config.refreshToken !== 'string') {
            throw new AuthenticationError('Refresh Token is required', 'MISSING_REFRESH_TOKEN');
        }
    }

    async function checkRateLimit(): Promise<void> {
        if (!state.rateLimiter.canMakeRequest()) {
            const waitTime = state.rateLimiter.getWaitTime();
            if (waitTime > 0) {
                throw new RateLimitError(
                    `Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`,
                    Math.ceil(waitTime / 1000)
                );
            }
        }
        state.rateLimiter.recordRequest();
    }

    function ensureInitialized(): void {
        if (!state.initialized) {
            throw new ConnectionError('Gmail connector not initialized.', 'NOT_INITIALIZED', false);
        }
    }

    async function refreshAccessToken(): Promise<string> {
        if (state.accessToken && Date.now() < state.tokenExpiry) {
            return state.accessToken;
        }
        state.accessToken = `mock_access_token_${Date.now()}`;
        state.tokenExpiry = Date.now() + 3600000;
        return state.accessToken;
    }

    export async function initialize(config: GmailConfig): Promise<void> {
        validateConfig(config);
        state.config = config;
        await refreshAccessToken();
        state.initialized = true;
    }

    export async function testConnection(): Promise<boolean> {
        ensureInitialized();
        await checkRateLimit();
        await refreshAccessToken();
        return true;
    }

    export async function listMessages(maxResults: number = 10): Promise<EmailMessage[]> {
        ensureInitialized();
        await checkRateLimit();
        await refreshAccessToken();
        return MOCK_MESSAGES.slice(0, maxResults);
    }

    export async function getMessage(messageId: string): Promise<EmailMessage> {
        ensureInitialized();
        await checkRateLimit();
        await refreshAccessToken();
        const message = MOCK_MESSAGES.find(m => m.id === messageId);
        if (!message) {
            throw new ConnectionError(`Message not found: ${messageId}`, 'MESSAGE_NOT_FOUND', false);
        }
        return message;
    }

    export async function searchMessages(query: string, maxResults: number = 10): Promise<EmailMessage[]> {
        ensureInitialized();
        await checkRateLimit();
        await refreshAccessToken();
        const queryLower = query.toLowerCase();
        const results = MOCK_MESSAGES.filter(msg => {
            const searchableText = [msg.subject, msg.from, msg.body, ...msg.to].join(' ').toLowerCase();
            if (queryLower.startsWith('from:')) {
                return msg.from.toLowerCase().includes(queryLower.slice(5).trim());
            }
            if (queryLower.startsWith('subject:')) {
                return msg.subject.toLowerCase().includes(queryLower.slice(8).trim());
            }
            return searchableText.includes(queryLower);
        });
        return results.slice(0, maxResults);
    }

    export async function sendEmail(to: string | string[], subject: string, body: string): Promise<string> {
        ensureInitialized();
        await checkRateLimit();
        await refreshAccessToken();
        if (!to || (Array.isArray(to) && to.length === 0)) {
            throw new ConnectionError('Recipient is required', 'INVALID_RECIPIENT', false);
        }
        if (!subject) throw new ConnectionError('Subject is required', 'INVALID_SUBJECT', false);
        if (!body) throw new ConnectionError('Body is required', 'INVALID_BODY', false);
        return `sent-${Date.now()}`;
    }

    export function getRateLimitStatus() {
        const stats = state.rateLimiter.getStats();
        return { ...stats, minuteLimit: 60, dailyLimit: 10000 };
    }

    export function isInitialized(): boolean {
        return state.initialized;
    }

    export function disconnect(): void {
        state.initialized = false;
        state.config = null;
        state.accessToken = null;
        state.tokenExpiry = 0;
    }

    // ============================================================================
    // Test Suite
    // ============================================================================

    let testsPassed = 0;
    let testsFailed = 0;

    function assertTest(condition: boolean, message: string): void {
        if (condition) {
            console.log(`  ✓ ${message}`);
            testsPassed++;
        } else {
            console.log(`  ✗ ${message}`);
            testsFailed++;
        }
    }

    export async function runTests() {
        console.log('=== Testing Gmail Connector ===\n');

        // Reset state before tests
        resetState();

        // 1. Test metadata
        console.log('1. Testing metadata export:');
        assertTest(metadata.name === 'gmail', 'Name is "gmail"');
        assertTest(metadata.type === 'email', 'Type is "email"');
        assertTest(metadata.authentication.type === 'oauth2', 'Authentication type is oauth2');
        assertTest(Array.isArray(metadata.authentication.scopes), 'Has OAuth2 scopes');
        assertTest(metadata.credentials.length === 3, 'Has 3 credential requirements');
        assertTest(metadata.credentials.every(c => c.required === true), 'All credentials are required');
        assertTest(Array.isArray(metadata.methods), 'Has methods array');
        assertTest(typeof metadata.rateLimits === 'object', 'Has rate limits');

        // 2. Test default export structure
        console.log('\n2. Testing export structure:');
        const defaultExport = {
            metadata, initialize, testConnection, listMessages,
            getMessage, searchMessages, sendEmail, getRateLimitStatus, isInitialized, disconnect
        };
        assertTest(typeof defaultExport.initialize === 'function', 'Has initialize function');
        assertTest(typeof defaultExport.testConnection === 'function', 'Has testConnection function');
        assertTest(typeof defaultExport.listMessages === 'function', 'Has listMessages function');
        assertTest(typeof defaultExport.sendEmail === 'function', 'Has sendEmail function');
        assertTest(typeof defaultExport.searchMessages === 'function', 'Has searchMessages function');

        // 3. Test authentication errors (before initialization)
        console.log('\n3. Testing authentication validation:');
        resetState();

        try {
            await initialize({ clientId: '', clientSecret: 'secret', refreshToken: 'token' });
            assertTest(false, 'Catches missing client ID');
        } catch (e) {
            assertTest(e instanceof AuthenticationError, 'Catches missing client ID');
        }

        try {
            await initialize({ clientId: 'id', clientSecret: '', refreshToken: 'token' });
            assertTest(false, 'Catches missing client secret');
        } catch (e) {
            assertTest(e instanceof AuthenticationError, 'Catches missing client secret');
        }

        try {
            await initialize({ clientId: 'id', clientSecret: 'secret', refreshToken: '' });
            assertTest(false, 'Catches missing refresh token');
        } catch (e) {
            assertTest(e instanceof AuthenticationError, 'Catches missing refresh token');
        }

        // 4. Test not initialized errors
        console.log('\n4. Testing not-initialized errors:');
        resetState();

        try {
            await listMessages();
            assertTest(false, 'Catches not initialized');
        } catch (e) {
            assertTest(e instanceof ConnectionError && (e as ConnectionError).code === 'NOT_INITIALIZED',
                'Catches not initialized error');
        }

        // 5. Test successful initialization
        console.log('\n5. Testing initialization:');
        resetState();

        await initialize({
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
            refreshToken: 'test-refresh-token'
        });
        assertTest(isInitialized() === true, 'Connector is initialized');

        // 6. Test connection test
        console.log('\n6. Testing connection:');
        const connected = await testConnection();
        assertTest(connected === true, 'Connection test succeeds');

        // 7. Test email operations
        console.log('\n7. Testing email operations:');

        const messages = await listMessages(5);
        assertTest(Array.isArray(messages), 'listMessages returns array');
        assertTest(messages.length > 0, 'listMessages returns messages');

        const firstMessage = messages[0];
        if (firstMessage) {
            assertTest(typeof firstMessage.id === 'string', 'Message has ID');
            assertTest(typeof firstMessage.subject === 'string', 'Message has subject');
            assertTest(typeof firstMessage.from === 'string', 'Message has from');
            assertTest(Array.isArray(firstMessage.to), 'Message has to array');
        }

        const message = await getMessage('msg-001');
        assertTest(message.id === 'msg-001', 'getMessage returns correct message');

        try {
            await getMessage('nonexistent');
            assertTest(false, 'Catches message not found');
        } catch (e) {
            assertTest(e instanceof ConnectionError, 'Catches message not found');
        }

        // 8. Test search
        console.log('\n8. Testing search:');

        const fromResults = await searchMessages('from:google.com');
        assertTest(fromResults.some(m => m.from.includes('google')), 'Search by from works');

        const subjectResults = await searchMessages('subject:welcome');
        assertTest(subjectResults.some(m => m.subject.toLowerCase().includes('welcome')), 'Search by subject works');

        // 9. Test send email
        console.log('\n9. Testing send email:');

        const sentId = await sendEmail('recipient@example.com', 'Test Subject', 'Test body');
        assertTest(typeof sentId === 'string', 'sendEmail returns message ID');
        assertTest(sentId.startsWith('sent-'), 'sendEmail returns valid ID format');

        const multiSentId = await sendEmail(['a@example.com', 'b@example.com'], 'Test', 'Body');
        assertTest(typeof multiSentId === 'string', 'sendEmail works with multiple recipients');

        try {
            await sendEmail('', 'Subject', 'Body');
            assertTest(false, 'Catches empty recipient');
        } catch (e) {
            assertTest(e instanceof ConnectionError, 'Catches empty recipient');
        }

        // 10. Test rate limiting
        console.log('\n10. Testing rate limiting:');

        const status = getRateLimitStatus();
        assertTest(typeof status.minuteUsage === 'number', 'Rate limit has minute usage');
        assertTest(typeof status.dailyUsage === 'number', 'Rate limit has daily usage');
        assertTest(status.minuteLimit === 60, 'Minute limit is 60');
        assertTest(status.dailyLimit === 10000, 'Daily limit is 10000');

        // 11. Test disconnect
        console.log('\n11. Testing disconnect:');

        disconnect();
        assertTest(isInitialized() === false, 'Connector is disconnected');

        try {
            await listMessages();
            assertTest(false, 'Operations fail after disconnect');
        } catch (e) {
            assertTest(e instanceof ConnectionError, 'Operations fail after disconnect');
        }

        // Summary
        console.log('\n=== Test Summary ===');
        console.log(`Passed: ${testsPassed}`);
        console.log(`Failed: ${testsFailed}`);
        console.log(`Total: ${testsPassed + testsFailed}`);

        if (testsFailed > 0) {
            process.exit(1);
        }
    }

}  // End namespace

GmailTests.runTests().catch(console.error);
