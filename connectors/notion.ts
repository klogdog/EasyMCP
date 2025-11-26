/**
 * MCP Connector - Notion
 * 
 * A connector for Notion API demonstrating token-based authentication,
 * database operations, and retry logic with exponential backoff.
 * 
 * @connector notion
 * @description Connect to Notion API for database operations
 * @example
 * ```typescript
 * import notion from './notion';
 * 
 * // Initialize the connector
 * await notion.initialize({
 *   token: process.env.NOTION_TOKEN
 * });
 * 
 * // List available databases
 * const databases = await notion.listDatabases();
 * 
 * // Query a database
 * const results = await notion.queryDatabase('database-id', {
 *   property: 'Status',
 *   status: { equals: 'Done' }
 * });
 * 
 * // Create a page
 * await notion.createPage('database-id', {
 *   Name: { title: [{ text: { content: 'New Item' } }] },
 *   Status: { status: { name: 'In Progress' } }
 * });
 * ```
 */

/**
 * Connector metadata for MCP discovery
 */
export const metadata = {
    name: 'notion',
    description: 'Connects to Notion API for database operations',
    version: '1.0.0',
    type: 'database',
    authentication: {
        type: 'token',
        description: 'Notion Integration Token'
    },
    credentials: [
        {
            name: 'NOTION_TOKEN',
            type: 'api_key',
            required: true,
            description: 'Notion Integration Token from your Notion integration settings'
        }
    ],
    methods: [
        'listDatabases',
        'queryDatabase',
        'createPage',
        'updatePage',
        'getPage',
        'deletePage',
        'testConnection'
    ],
    rateLimits: {
        requestsPerSecond: 3,
        maxRetries: 3
    }
};

/**
 * Notion connector configuration
 */
export interface NotionConfig {
    /** Notion Integration Token */
    token: string;
    /** Custom API endpoint (optional, for testing) */
    apiEndpoint?: string;
    /** Maximum retry attempts */
    maxRetries?: number;
    /** Base delay for exponential backoff (ms) */
    baseRetryDelay?: number;
}

/**
 * Database information
 */
export interface NotionDatabase {
    /** Database ID */
    id: string;
    /** Database title */
    title: string;
    /** Database description */
    description?: string;
    /** Created time */
    createdTime: Date;
    /** Last edited time */
    lastEditedTime: Date;
    /** Database properties schema */
    properties: Record<string, PropertySchema>;
    /** Database URL */
    url: string;
}

/**
 * Property schema definition
 */
export interface PropertySchema {
    /** Property ID */
    id: string;
    /** Property name */
    name: string;
    /** Property type */
    type: string;
    /** Type-specific configuration */
    [key: string]: unknown;
}

/**
 * Page object
 */
export interface NotionPage {
    /** Page ID */
    id: string;
    /** Parent database or page ID */
    parentId: string;
    /** Parent type */
    parentType: 'database_id' | 'page_id' | 'workspace';
    /** Created time */
    createdTime: Date;
    /** Last edited time */
    lastEditedTime: Date;
    /** Page properties */
    properties: Record<string, PropertyValue>;
    /** Page URL */
    url: string;
    /** Whether the page is archived */
    archived: boolean;
}

/**
 * Property value types
 */
export type PropertyValue =
    | TitleProperty
    | RichTextProperty
    | NumberProperty
    | SelectProperty
    | MultiSelectProperty
    | DateProperty
    | CheckboxProperty
    | StatusProperty
    | UnknownProperty;

export interface TitleProperty {
    type: 'title';
    title: Array<{ text: { content: string } }>;
}

export interface RichTextProperty {
    type: 'rich_text';
    rich_text: Array<{ text: { content: string } }>;
}

export interface NumberProperty {
    type: 'number';
    number: number | null;
}

export interface SelectProperty {
    type: 'select';
    select: { name: string; color?: string } | null;
}

export interface MultiSelectProperty {
    type: 'multi_select';
    multi_select: Array<{ name: string; color?: string }>;
}

export interface DateProperty {
    type: 'date';
    date: { start: string; end?: string } | null;
}

export interface CheckboxProperty {
    type: 'checkbox';
    checkbox: boolean;
}

export interface StatusProperty {
    type: 'status';
    status: { name: string; color?: string } | null;
}

export interface UnknownProperty {
    type: string;
    [key: string]: unknown;
}

/**
 * Query filter
 */
export interface QueryFilter {
    property?: string;
    title?: { contains?: string; equals?: string };
    rich_text?: { contains?: string; equals?: string };
    number?: { equals?: number; greater_than?: number; less_than?: number };
    checkbox?: { equals?: boolean };
    select?: { equals?: string };
    status?: { equals?: string };
    date?: { equals?: string; before?: string; after?: string };
    or?: QueryFilter[];
    and?: QueryFilter[];
}

/**
 * Sort option
 */
export interface SortOption {
    property?: string;
    timestamp?: 'created_time' | 'last_edited_time';
    direction: 'ascending' | 'descending';
}

/**
 * Connection error class
 */
export class ConnectionError extends Error {
    public code: string;
    public retryable: boolean;
    public statusCode?: number;

    constructor(message: string, code: string, retryable = false, statusCode?: number) {
        super(message);
        this.name = 'ConnectionError';
        this.code = code;
        this.retryable = retryable;
        this.statusCode = statusCode;
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

    constructor(message: string, retryAfter: number = 1) {
        super(message);
        this.name = 'RateLimitError';
        this.retryAfter = retryAfter;
    }
}

/**
 * Not found error class
 */
export class NotFoundError extends Error {
    public resourceType: string;
    public resourceId: string;

    constructor(resourceType: string, resourceId: string) {
        super(`${resourceType} not found: ${resourceId}`);
        this.name = 'NotFoundError';
        this.resourceType = resourceType;
        this.resourceId = resourceId;
    }
}

/**
 * Retry logic with exponential backoff
 */
async function withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    baseDelay: number
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error as Error;

            // Check if error is retryable
            if (error instanceof ConnectionError && !error.retryable) {
                throw error;
            }
            if (error instanceof AuthenticationError) {
                throw error;
            }
            if (error instanceof NotFoundError) {
                throw error;
            }

            // If we've exhausted retries, throw
            if (attempt === maxRetries) {
                throw lastError;
            }

            // Calculate delay with exponential backoff and jitter
            const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 100;

            // For rate limit errors, use the retry-after value
            if (error instanceof RateLimitError) {
                await sleep(error.retryAfter * 1000);
            } else {
                await sleep(delay);
            }
        }
    }

    throw lastError;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock data for demonstration
 */
const MOCK_DATABASES: NotionDatabase[] = [
    {
        id: 'db-001',
        title: 'Project Tasks',
        description: 'Track project tasks and milestones',
        createdTime: new Date('2024-01-01'),
        lastEditedTime: new Date('2024-01-15'),
        properties: {
            Name: { id: 'title', name: 'Name', type: 'title' },
            Status: { id: 'status', name: 'Status', type: 'status' },
            Priority: { id: 'priority', name: 'Priority', type: 'select' },
            DueDate: { id: 'due', name: 'Due Date', type: 'date' }
        },
        url: 'https://notion.so/db-001'
    },
    {
        id: 'db-002',
        title: 'Meeting Notes',
        description: 'Weekly meeting notes and action items',
        createdTime: new Date('2024-01-05'),
        lastEditedTime: new Date('2024-01-14'),
        properties: {
            Title: { id: 'title', name: 'Title', type: 'title' },
            Date: { id: 'date', name: 'Date', type: 'date' },
            Attendees: { id: 'attendees', name: 'Attendees', type: 'multi_select' }
        },
        url: 'https://notion.so/db-002'
    }
];

const MOCK_PAGES: NotionPage[] = [
    {
        id: 'page-001',
        parentId: 'db-001',
        parentType: 'database_id',
        createdTime: new Date('2024-01-10'),
        lastEditedTime: new Date('2024-01-15'),
        properties: {
            Name: { type: 'title', title: [{ text: { content: 'Implement feature X' } }] },
            Status: { type: 'status', status: { name: 'In Progress', color: 'blue' } },
            Priority: { type: 'select', select: { name: 'High', color: 'red' } }
        },
        url: 'https://notion.so/page-001',
        archived: false
    },
    {
        id: 'page-002',
        parentId: 'db-001',
        parentType: 'database_id',
        createdTime: new Date('2024-01-08'),
        lastEditedTime: new Date('2024-01-12'),
        properties: {
            Name: { type: 'title', title: [{ text: { content: 'Fix bug Y' } }] },
            Status: { type: 'status', status: { name: 'Done', color: 'green' } },
            Priority: { type: 'select', select: { name: 'Medium', color: 'yellow' } }
        },
        url: 'https://notion.so/page-002',
        archived: false
    },
    {
        id: 'page-003',
        parentId: 'db-001',
        parentType: 'database_id',
        createdTime: new Date('2024-01-12'),
        lastEditedTime: new Date('2024-01-14'),
        properties: {
            Name: { type: 'title', title: [{ text: { content: 'Review PR' } }] },
            Status: { type: 'status', status: { name: 'Not Started', color: 'gray' } },
            Priority: { type: 'select', select: { name: 'Low', color: 'default' } }
        },
        url: 'https://notion.so/page-003',
        archived: false
    }
];

/**
 * Connector state
 */
interface ConnectorState {
    initialized: boolean;
    config: NotionConfig | null;
    lastRequestTime: number;
}

const state: ConnectorState = {
    initialized: false,
    config: null,
    lastRequestTime: 0
};

/**
 * Validates the connector configuration
 */
function validateConfig(config: NotionConfig): void {
    if (!config.token || typeof config.token !== 'string') {
        throw new AuthenticationError('Notion token is required', 'MISSING_TOKEN');
    }
    if (config.token.length < 10) {
        throw new AuthenticationError('Invalid Notion token format', 'INVALID_TOKEN');
    }
}

/**
 * Rate limiting for requests
 */
async function rateLimit(): Promise<void> {
    const now = Date.now();
    const minInterval = 1000 / metadata.rateLimits.requestsPerSecond;
    const timeSinceLastRequest = now - state.lastRequestTime;

    if (timeSinceLastRequest < minInterval) {
        await sleep(minInterval - timeSinceLastRequest);
    }

    state.lastRequestTime = Date.now();
}

/**
 * Ensures the connector is initialized
 */
function ensureInitialized(): void {
    if (!state.initialized) {
        throw new ConnectionError(
            'Notion connector not initialized. Call initialize() first.',
            'NOT_INITIALIZED',
            false
        );
    }
}

/**
 * Initialize the Notion connector
 * 
 * @param config - The connector configuration
 * @throws AuthenticationError if token is invalid
 */
export async function initialize(config: NotionConfig): Promise<void> {
    validateConfig(config);

    state.config = {
        ...config,
        maxRetries: config.maxRetries ?? metadata.rateLimits.maxRetries,
        baseRetryDelay: config.baseRetryDelay ?? 1000
    };

    // Verify token with a test request
    state.initialized = true;

    try {
        await testConnection();
    } catch (error) {
        state.initialized = false;
        throw error;
    }
}

/**
 * Test the connection to Notion API
 * 
 * @returns true if connection is successful
 * @throws ConnectionError if connection fails
 */
export async function testConnection(): Promise<boolean> {
    ensureInitialized();
    await rateLimit();

    // In a real implementation, this would call the Notion API
    // For demonstration, we verify the token format
    if (!state.config?.token) {
        throw new AuthenticationError('No token configured', 'NO_TOKEN');
    }

    return true;
}

/**
 * List available databases
 * 
 * @returns Array of database objects
 */
export async function listDatabases(): Promise<NotionDatabase[]> {
    ensureInitialized();

    return withRetry(
        async () => {
            await rateLimit();
            // In a real implementation, this would call the Notion API
            return [...MOCK_DATABASES];
        },
        state.config?.maxRetries ?? 3,
        state.config?.baseRetryDelay ?? 1000
    );
}

/**
 * Query a database
 * 
 * @param databaseId - The database ID
 * @param filter - Optional filter
 * @param sorts - Optional sort options
 * @param pageSize - Number of results per page
 * @returns Array of pages matching the query
 */
export async function queryDatabase(
    databaseId: string,
    filter?: QueryFilter,
    sorts?: SortOption[],
    pageSize: number = 100
): Promise<NotionPage[]> {
    ensureInitialized();

    return withRetry(
        async () => {
            await rateLimit();

            // Verify database exists
            const database = MOCK_DATABASES.find(db => db.id === databaseId);
            if (!database) {
                throw new NotFoundError('Database', databaseId);
            }

            // Filter pages by parent database
            let results = MOCK_PAGES.filter(p => p.parentId === databaseId && !p.archived);

            // Apply filter (simplified implementation)
            if (filter?.status?.equals) {
                const targetStatus = filter.status.equals;
                results = results.filter(page => {
                    const statusProp = page.properties['Status'];
                    if (statusProp && statusProp.type === 'status') {
                        const statusValue = (statusProp as StatusProperty).status;
                        return statusValue && statusValue.name === targetStatus;
                    }
                    return false;
                });
            }

            // Apply sorts (simplified)
            if (sorts && sorts.length > 0) {
                const sort = sorts[0];
                if (sort.timestamp === 'created_time') {
                    results.sort((a, b) => {
                        const diff = a.createdTime.getTime() - b.createdTime.getTime();
                        return sort.direction === 'ascending' ? diff : -diff;
                    });
                }
            }

            return results.slice(0, pageSize);
        },
        state.config?.maxRetries ?? 3,
        state.config?.baseRetryDelay ?? 1000
    );
}

/**
 * Get a specific page by ID
 * 
 * @param pageId - The page ID
 * @returns The page object
 * @throws NotFoundError if page not found
 */
export async function getPage(pageId: string): Promise<NotionPage> {
    ensureInitialized();

    return withRetry(
        async () => {
            await rateLimit();

            const page = MOCK_PAGES.find(p => p.id === pageId);
            if (!page) {
                throw new NotFoundError('Page', pageId);
            }

            return page;
        },
        state.config?.maxRetries ?? 3,
        state.config?.baseRetryDelay ?? 1000
    );
}

/**
 * Create a new page in a database
 * 
 * @param databaseId - The parent database ID
 * @param properties - Page properties
 * @returns The created page
 */
export async function createPage(
    databaseId: string,
    properties: Record<string, PropertyValue>
): Promise<NotionPage> {
    ensureInitialized();

    return withRetry(
        async () => {
            await rateLimit();

            // Verify database exists
            const database = MOCK_DATABASES.find(db => db.id === databaseId);
            if (!database) {
                throw new NotFoundError('Database', databaseId);
            }

            // Create new page
            const newPage: NotionPage = {
                id: `page-${Date.now()}`,
                parentId: databaseId,
                parentType: 'database_id',
                createdTime: new Date(),
                lastEditedTime: new Date(),
                properties,
                url: `https://notion.so/page-${Date.now()}`,
                archived: false
            };

            // In a real implementation, this would call the Notion API
            MOCK_PAGES.push(newPage);

            return newPage;
        },
        state.config?.maxRetries ?? 3,
        state.config?.baseRetryDelay ?? 1000
    );
}

/**
 * Update an existing page
 * 
 * @param pageId - The page ID
 * @param properties - Properties to update
 * @returns The updated page
 */
export async function updatePage(
    pageId: string,
    properties: Partial<Record<string, PropertyValue>>
): Promise<NotionPage> {
    ensureInitialized();

    return withRetry(
        async () => {
            await rateLimit();

            const pageIndex = MOCK_PAGES.findIndex(p => p.id === pageId);
            if (pageIndex === -1) {
                throw new NotFoundError('Page', pageId);
            }

            const existingPage = MOCK_PAGES[pageIndex];
            if (!existingPage) {
                throw new NotFoundError('Page', pageId);
            }

            // Update page
            const mergedProperties: Record<string, PropertyValue> = { ...existingPage.properties };
            for (const [key, value] of Object.entries(properties)) {
                if (value !== undefined) {
                    mergedProperties[key] = value;
                }
            }

            const updatedPage: NotionPage = {
                ...existingPage,
                properties: mergedProperties,
                lastEditedTime: new Date()
            };

            MOCK_PAGES[pageIndex] = updatedPage;

            return updatedPage;
        },
        state.config?.maxRetries ?? 3,
        state.config?.baseRetryDelay ?? 1000
    );
}

/**
 * Delete (archive) a page
 * 
 * @param pageId - The page ID
 * @returns true if successful
 */
export async function deletePage(pageId: string): Promise<boolean> {
    ensureInitialized();

    return withRetry(
        async () => {
            await rateLimit();

            const pageIndex = MOCK_PAGES.findIndex(p => p.id === pageId);
            if (pageIndex === -1) {
                throw new NotFoundError('Page', pageId);
            }

            const existingPage = MOCK_PAGES[pageIndex];
            if (existingPage) {
                // Archive the page (Notion doesn't truly delete)
                MOCK_PAGES[pageIndex] = { ...existingPage, archived: true };
            }

            return true;
        },
        state.config?.maxRetries ?? 3,
        state.config?.baseRetryDelay ?? 1000
    );
}

/**
 * Check if connector is initialized
 */
export function isInitialized(): boolean {
    return state.initialized;
}

/**
 * Get connector status
 */
export function getStatus(): {
    initialized: boolean;
    lastRequestTime: number;
} {
    return {
        initialized: state.initialized,
        lastRequestTime: state.lastRequestTime
    };
}

/**
 * Disconnect and cleanup
 */
export function disconnect(): void {
    state.initialized = false;
    state.config = null;
    state.lastRequestTime = 0;
}

/**
 * Default export for MCP connector discovery
 */
export default {
    metadata,
    initialize,
    testConnection,
    listDatabases,
    queryDatabase,
    getPage,
    createPage,
    updatePage,
    deletePage,
    isInitialized,
    getStatus,
    disconnect
};
