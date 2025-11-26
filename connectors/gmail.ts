/**
 * MCP Connector - Gmail
 * 
 * A connector for Gmail API demonstrating OAuth2 authentication,
 * email operations, and rate limiting in MCP connectors.
 * 
 * @connector gmail
 * @description Connect to Gmail API for email operations
 * @example
 * ```typescript
 * import gmail from './gmail';
 * 
 * // Initialize the connector
 * await gmail.initialize({
 *   clientId: process.env.GMAIL_CLIENT_ID,
 *   clientSecret: process.env.GMAIL_CLIENT_SECRET,
 *   refreshToken: process.env.GMAIL_REFRESH_TOKEN
 * });
 * 
 * // List recent messages
 * const messages = await gmail.listMessages(10);
 * 
 * // Send an email
 * await gmail.sendEmail('recipient@example.com', 'Subject', 'Body text');
 * 
 * // Search messages
 * const results = await gmail.searchMessages('from:sender@example.com');
 * ```
 */

/**
 * Connector metadata for MCP discovery
 */
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
        {
            name: 'GMAIL_CLIENT_ID',
            type: 'oauth_client_id',
            required: true,
            description: 'OAuth2 Client ID from Google Cloud Console'
        },
        {
            name: 'GMAIL_CLIENT_SECRET',
            type: 'oauth_client_secret',
            required: true,
            description: 'OAuth2 Client Secret from Google Cloud Console'
        },
        {
            name: 'GMAIL_REFRESH_TOKEN',
            type: 'oauth_refresh_token',
            required: true,
            description: 'OAuth2 Refresh Token for the Gmail account'
        }
    ],
    methods: ['listMessages', 'sendEmail', 'searchMessages', 'getMessage', 'testConnection'],
    rateLimits: {
        requestsPerMinute: 60,
        requestsPerDay: 10000
    }
};

/**
 * Gmail connector configuration
 */
export interface GmailConfig {
    /** OAuth2 Client ID */
    clientId: string;
    /** OAuth2 Client Secret */
    clientSecret: string;
    /** OAuth2 Refresh Token */
    refreshToken: string;
    /** Custom API endpoint (optional, for testing) */
    apiEndpoint?: string;
}

/**
 * Email message structure
 */
export interface EmailMessage {
    /** Unique message ID */
    id: string;
    /** Thread ID */
    threadId: string;
    /** Message subject */
    subject: string;
    /** Sender email address */
    from: string;
    /** Recipient email addresses */
    to: string[];
    /** Message body (plain text) */
    body: string;
    /** HTML body (if available) */
    htmlBody?: string;
    /** Message date */
    date: Date;
    /** Message labels */
    labels: string[];
    /** Attachments info */
    attachments: AttachmentInfo[];
    /** Whether the message is read */
    isRead: boolean;
}

/**
 * Attachment information
 */
export interface AttachmentInfo {
    /** Attachment ID */
    id: string;
    /** Filename */
    filename: string;
    /** MIME type */
    mimeType: string;
    /** Size in bytes */
    size: number;
}

/**
 * Email composition structure
 */
export interface ComposeEmail {
    /** Recipient email address(es) */
    to: string | string[];
    /** CC recipients */
    cc?: string | string[];
    /** BCC recipients */
    bcc?: string | string[];
    /** Email subject */
    subject: string;
    /** Plain text body */
    body: string;
    /** HTML body (optional) */
    htmlBody?: string;
}

/**
 * Search filter options
 */
export interface SearchFilter {
    /** Search query (Gmail search syntax) */
    query: string;
    /** Maximum results to return */
    maxResults?: number;
    /** Include spam and trash */
    includeSpamTrash?: boolean;
    /** Label IDs to filter by */
    labelIds?: string[];
}

/**
 * Connection error class
 */
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

/**
 * Authentication error class
 */
export class AuthenticationError extends Error {
    public code: string;

    constructor(message: string, code: string = 'AUTH_ERROR') {
        super(message);
        this.name = 'AuthenticationError';
        this.code = code;
    }
}

/**
 * Rate limit error class
 */
export class RateLimitError extends Error {
    public retryAfter: number;

    constructor(message: string, retryAfter: number = 60) {
        super(message);
        this.name = 'RateLimitError';
        this.retryAfter = retryAfter;
    }
}

/**
 * Rate limiter implementation
 */
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

    /**
     * Check if a request can be made
     */
    canMakeRequest(): boolean {
        this.cleanup();
        return this.requests.length < this.maxRequestsPerMinute &&
            this.dailyRequests < this.maxRequestsPerDay;
    }

    /**
     * Record a request
     */
    recordRequest(): void {
        this.cleanup();
        this.requests.push(Date.now());
        this.dailyRequests++;
    }

    /**
     * Get wait time until next request is allowed
     */
    getWaitTime(): number {
        this.cleanup();

        if (this.dailyRequests >= this.maxRequestsPerDay) {
            // Wait until next day
            const msPerDay = 24 * 60 * 60 * 1000;
            return msPerDay - (Date.now() - this.lastDayReset);
        }

        if (this.requests.length >= this.maxRequestsPerMinute) {
            // Wait until oldest request expires (60 seconds)
            const oldestRequest = this.requests[0];
            return (oldestRequest + 60000) - Date.now();
        }

        return 0;
    }

    /**
     * Cleanup old requests
     */
    private cleanup(): void {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;

        // Remove requests older than 1 minute
        this.requests = this.requests.filter(time => time > oneMinuteAgo);

        // Reset daily counter if new day
        const msPerDay = 24 * 60 * 60 * 1000;
        if (now - this.lastDayReset > msPerDay) {
            this.dailyRequests = 0;
            this.lastDayReset = now;
        }
    }

    /**
     * Get current usage stats
     */
    getStats(): { minuteUsage: number; dailyUsage: number } {
        this.cleanup();
        return {
            minuteUsage: this.requests.length,
            dailyUsage: this.dailyRequests
        };
    }
}

/**
 * Gmail connector state
 */
interface ConnectorState {
    initialized: boolean;
    config: GmailConfig | null;
    accessToken: string | null;
    tokenExpiry: number;
    rateLimiter: RateLimiter;
}

/**
 * Connector state
 */
const state: ConnectorState = {
    initialized: false,
    config: null,
    accessToken: null,
    tokenExpiry: 0,
    rateLimiter: new RateLimiter(
        metadata.rateLimits.requestsPerMinute,
        metadata.rateLimits.requestsPerDay
    )
};

/**
 * Mock data for demonstration
 */
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
        attachments: [
            { id: 'att-001', filename: 'report.pdf', mimeType: 'application/pdf', size: 125000 }
        ],
        isRead: true
    },
    {
        id: 'msg-003',
        threadId: 'thread-003',
        subject: 'Meeting Tomorrow',
        from: 'manager@company.com',
        to: ['user@example.com', 'team@company.com'],
        body: 'Reminder: Team meeting tomorrow at 10 AM.',
        date: new Date('2024-01-13T09:00:00Z'),
        labels: ['INBOX', 'IMPORTANT'],
        attachments: [],
        isRead: true
    }
];

/**
 * Validates the connector configuration
 */
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

/**
 * Checks rate limit and waits if necessary
 */
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

/**
 * Ensures the connector is initialized
 */
function ensureInitialized(): void {
    if (!state.initialized) {
        throw new ConnectionError(
            'Gmail connector not initialized. Call initialize() first.',
            'NOT_INITIALIZED',
            false
        );
    }
}

/**
 * Refreshes the access token if expired
 */
async function refreshAccessToken(): Promise<string> {
    // In a real implementation, this would call the OAuth2 token endpoint
    // For demonstration, we simulate a token refresh

    if (state.accessToken && Date.now() < state.tokenExpiry) {
        return state.accessToken;
    }

    // Simulate token refresh
    state.accessToken = `mock_access_token_${Date.now()}`;
    state.tokenExpiry = Date.now() + 3600000; // 1 hour

    return state.accessToken;
}

/**
 * Initialize the Gmail connector
 * 
 * @param config - The connector configuration
 * @throws AuthenticationError if credentials are invalid
 */
export async function initialize(config: GmailConfig): Promise<void> {
    validateConfig(config);

    state.config = config;

    // Attempt to get initial access token
    try {
        await refreshAccessToken();
        state.initialized = true;
    } catch (error) {
        throw new AuthenticationError(
            'Failed to authenticate with Gmail API',
            'AUTH_FAILED'
        );
    }
}

/**
 * Test the connection to Gmail API
 * 
 * @returns true if connection is successful
 * @throws ConnectionError if connection fails
 */
export async function testConnection(): Promise<boolean> {
    ensureInitialized();
    await checkRateLimit();

    try {
        // In a real implementation, this would make an API call
        // For demonstration, we verify the token is valid
        await refreshAccessToken();
        return true;
    } catch (error) {
        throw new ConnectionError(
            'Failed to connect to Gmail API',
            'CONNECTION_FAILED',
            true
        );
    }
}

/**
 * List recent email messages
 * 
 * @param maxResults - Maximum number of messages to return (default: 10)
 * @returns Array of email messages
 */
export async function listMessages(maxResults: number = 10): Promise<EmailMessage[]> {
    ensureInitialized();
    await checkRateLimit();
    await refreshAccessToken();

    // In a real implementation, this would call the Gmail API
    // For demonstration, return mock data
    return MOCK_MESSAGES.slice(0, maxResults);
}

/**
 * Get a specific message by ID
 * 
 * @param messageId - The message ID
 * @returns The email message
 * @throws ConnectionError if message not found
 */
export async function getMessage(messageId: string): Promise<EmailMessage> {
    ensureInitialized();
    await checkRateLimit();
    await refreshAccessToken();

    const message = MOCK_MESSAGES.find(m => m.id === messageId);
    if (!message) {
        throw new ConnectionError(
            `Message not found: ${messageId}`,
            'MESSAGE_NOT_FOUND',
            false
        );
    }

    return message;
}

/**
 * Search for messages using Gmail search syntax
 * 
 * @param query - Search query (Gmail search syntax)
 * @param maxResults - Maximum results to return
 * @returns Array of matching messages
 */
export async function searchMessages(
    query: string,
    maxResults: number = 10
): Promise<EmailMessage[]> {
    ensureInitialized();
    await checkRateLimit();
    await refreshAccessToken();

    // In a real implementation, this would use Gmail's search API
    // For demonstration, do basic string matching
    const queryLower = query.toLowerCase();

    const results = MOCK_MESSAGES.filter(msg => {
        const searchableText = [
            msg.subject,
            msg.from,
            msg.body,
            ...msg.to
        ].join(' ').toLowerCase();

        // Basic query parsing
        if (queryLower.startsWith('from:')) {
            const fromEmail = queryLower.slice(5).trim();
            return msg.from.toLowerCase().includes(fromEmail);
        }
        if (queryLower.startsWith('to:')) {
            const toEmail = queryLower.slice(3).trim();
            return msg.to.some(t => t.toLowerCase().includes(toEmail));
        }
        if (queryLower.startsWith('subject:')) {
            const subjectQuery = queryLower.slice(8).trim();
            return msg.subject.toLowerCase().includes(subjectQuery);
        }

        return searchableText.includes(queryLower);
    });

    return results.slice(0, maxResults);
}

/**
 * Send an email
 * 
 * @param to - Recipient email address(es)
 * @param subject - Email subject
 * @param body - Email body (plain text)
 * @param options - Additional options (cc, bcc, htmlBody)
 * @returns Message ID of the sent email
 */
export async function sendEmail(
    to: string | string[],
    subject: string,
    body: string,
    options?: { cc?: string | string[]; bcc?: string | string[]; htmlBody?: string }
): Promise<string> {
    ensureInitialized();
    await checkRateLimit();
    await refreshAccessToken();

    // Validate inputs
    if (!to || (Array.isArray(to) && to.length === 0)) {
        throw new ConnectionError('Recipient is required', 'INVALID_RECIPIENT', false);
    }
    if (!subject || typeof subject !== 'string') {
        throw new ConnectionError('Subject is required', 'INVALID_SUBJECT', false);
    }
    if (!body || typeof body !== 'string') {
        throw new ConnectionError('Body is required', 'INVALID_BODY', false);
    }

    // In a real implementation, this would call the Gmail API
    // For demonstration, return a mock message ID
    const messageId = `sent-${Date.now()}`;

    console.log(`[Gmail] Email sent to: ${Array.isArray(to) ? to.join(', ') : to}`);
    console.log(`[Gmail] Subject: ${subject}`);
    console.log(`[Gmail] Message ID: ${messageId}`);

    return messageId;
}

/**
 * Get rate limit status
 * 
 * @returns Current rate limit usage
 */
export function getRateLimitStatus(): {
    minuteUsage: number;
    dailyUsage: number;
    minuteLimit: number;
    dailyLimit: number;
} {
    const stats = state.rateLimiter.getStats();
    return {
        ...stats,
        minuteLimit: metadata.rateLimits.requestsPerMinute,
        dailyLimit: metadata.rateLimits.requestsPerDay
    };
}

/**
 * Check if connector is initialized
 */
export function isInitialized(): boolean {
    return state.initialized;
}

/**
 * Disconnect and cleanup
 */
export function disconnect(): void {
    state.initialized = false;
    state.config = null;
    state.accessToken = null;
    state.tokenExpiry = 0;
}

/**
 * Default export for MCP connector discovery
 */
export default {
    metadata,
    initialize,
    testConnection,
    listMessages,
    getMessage,
    searchMessages,
    sendEmail,
    getRateLimitStatus,
    isInitialized,
    disconnect
};
