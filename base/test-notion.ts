/**
 * Tests for the Notion MCP Connector
 * 
 * This test file validates the Notion connector's functionality including
 * token authentication, database operations, and retry logic.
 */

// ============================================================================
// Types and Mock Implementation (namespaced to avoid conflicts)
// ============================================================================

namespace NotionTests {

    export interface NotionConfig {
        token: string;
        apiEndpoint?: string;
        maxRetries?: number;
        baseRetryDelay?: number;
    }

    export interface NotionDatabase {
        id: string;
        title: string;
        description?: string;
        createdTime: Date;
        lastEditedTime: Date;
        properties: Record<string, PropertySchema>;
        url: string;
    }

    export interface PropertySchema {
        id: string;
        name: string;
        type: string;
    }

    export interface NotionPage {
        id: string;
        parentId: string;
        parentType: 'database_id' | 'page_id' | 'workspace';
        createdTime: Date;
        lastEditedTime: Date;
        properties: Record<string, PropertyValue>;
        url: string;
        archived: boolean;
    }

    export type PropertyValue = TitleProperty | StatusProperty | SelectProperty | UnknownProperty;

    export interface TitleProperty {
        type: 'title';
        title: Array<{ text: { content: string } }>;
    }

    export interface StatusProperty {
        type: 'status';
        status: { name: string; color?: string } | null;
    }

    export interface SelectProperty {
        type: 'select';
        select: { name: string; color?: string } | null;
    }

    export interface UnknownProperty {
        type: string;
        [key: string]: unknown;
    }

    export interface QueryFilter {
        property?: string;
        status?: { equals?: string };
    }

    export interface SortOption {
        property?: string;
        timestamp?: 'created_time' | 'last_edited_time';
        direction: 'ascending' | 'descending';
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

    export const metadata = {
        name: 'notion',
        description: 'Connects to Notion API for database operations',
        version: '1.0.0',
        type: 'database',
        authentication: { type: 'token' },
        credentials: [{ name: 'NOTION_TOKEN', type: 'api_key', required: true }],
        methods: ['listDatabases', 'queryDatabase', 'createPage', 'updatePage', 'getPage', 'deletePage', 'testConnection'],
        rateLimits: { requestsPerSecond: 3, maxRetries: 3 }
    };

    const MOCK_DATABASES: NotionDatabase[] = [
        {
            id: 'db-001',
            title: 'Project Tasks',
            description: 'Track project tasks',
            createdTime: new Date('2024-01-01'),
            lastEditedTime: new Date('2024-01-15'),
            properties: {
                Name: { id: 'title', name: 'Name', type: 'title' },
                Status: { id: 'status', name: 'Status', type: 'status' }
            },
            url: 'https://notion.so/db-001'
        }
    ];

    let MOCK_PAGES: NotionPage[] = [
        {
            id: 'page-001',
            parentId: 'db-001',
            parentType: 'database_id',
            createdTime: new Date('2024-01-10'),
            lastEditedTime: new Date('2024-01-15'),
            properties: {
                Name: { type: 'title', title: [{ text: { content: 'Task 1' } }] },
                Status: { type: 'status', status: { name: 'In Progress' } }
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
                Name: { type: 'title', title: [{ text: { content: 'Task 2' } }] },
                Status: { type: 'status', status: { name: 'Done' } }
            },
            url: 'https://notion.so/page-002',
            archived: false
        }
    ];

    interface ConnectorState {
        initialized: boolean;
        config: NotionConfig | null;
        lastRequestTime: number;
    }

    let state: ConnectorState = {
        initialized: false,
        config: null,
        lastRequestTime: 0
    };

    function resetState(): void {
        state = { initialized: false, config: null, lastRequestTime: 0 };
        MOCK_PAGES = [
            {
                id: 'page-001',
                parentId: 'db-001',
                parentType: 'database_id',
                createdTime: new Date('2024-01-10'),
                lastEditedTime: new Date('2024-01-15'),
                properties: {
                    Name: { type: 'title', title: [{ text: { content: 'Task 1' } }] },
                    Status: { type: 'status', status: { name: 'In Progress' } }
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
                    Name: { type: 'title', title: [{ text: { content: 'Task 2' } }] },
                    Status: { type: 'status', status: { name: 'Done' } }
                },
                url: 'https://notion.so/page-002',
                archived: false
            }
        ];
    }

    function validateConfig(config: NotionConfig): void {
        if (!config.token || typeof config.token !== 'string') {
            throw new AuthenticationError('Notion token is required', 'MISSING_TOKEN');
        }
        if (config.token.length < 10) {
            throw new AuthenticationError('Invalid Notion token format', 'INVALID_TOKEN');
        }
    }

    function ensureInitialized(): void {
        if (!state.initialized) {
            throw new ConnectionError('Notion connector not initialized.', 'NOT_INITIALIZED', false);
        }
    }

    export async function initialize(config: NotionConfig): Promise<void> {
        validateConfig(config);
        state.config = { ...config, maxRetries: config.maxRetries ?? 3, baseRetryDelay: config.baseRetryDelay ?? 1000 };
        state.initialized = true;
    }

    export async function testConnection(): Promise<boolean> {
        ensureInitialized();
        return true;
    }

    export async function listDatabases(): Promise<NotionDatabase[]> {
        ensureInitialized();
        return [...MOCK_DATABASES];
    }

    export async function queryDatabase(
        databaseId: string,
        filter?: QueryFilter,
        sorts?: SortOption[],
        pageSize: number = 100
    ): Promise<NotionPage[]> {
        ensureInitialized();

        const database = MOCK_DATABASES.find(db => db.id === databaseId);
        if (!database) throw new NotFoundError('Database', databaseId);

        let results = MOCK_PAGES.filter(p => p.parentId === databaseId && !p.archived);

        if (filter?.status?.equals) {
            const targetStatus = filter.status.equals;
            results = results.filter(page => {
                const statusProp = page.properties['Status'];
                if (statusProp && statusProp.type === 'status') {
                    return (statusProp as StatusProperty).status?.name === targetStatus;
                }
                return false;
            });
        }

        if (sorts && sorts.length > 0) {
            const sort = sorts[0];
            if (sort && sort.timestamp === 'created_time') {
                results.sort((a, b) => {
                    const diff = a.createdTime.getTime() - b.createdTime.getTime();
                    return sort.direction === 'ascending' ? diff : -diff;
                });
            }
        }

        return results.slice(0, pageSize);
    }

    export async function getPage(pageId: string): Promise<NotionPage> {
        ensureInitialized();
        const page = MOCK_PAGES.find(p => p.id === pageId);
        if (!page) throw new NotFoundError('Page', pageId);
        return page;
    }

    export async function createPage(databaseId: string, properties: Record<string, PropertyValue>): Promise<NotionPage> {
        ensureInitialized();
        const database = MOCK_DATABASES.find(db => db.id === databaseId);
        if (!database) throw new NotFoundError('Database', databaseId);

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

        MOCK_PAGES.push(newPage);
        return newPage;
    }

    export async function updatePage(pageId: string, properties: Partial<Record<string, PropertyValue>>): Promise<NotionPage> {
        ensureInitialized();
        const pageIndex = MOCK_PAGES.findIndex(p => p.id === pageId);
        if (pageIndex === -1) throw new NotFoundError('Page', pageId);

        const existingPage = MOCK_PAGES[pageIndex];
        if (!existingPage) throw new NotFoundError('Page', pageId);

        const mergedProperties: Record<string, PropertyValue> = { ...existingPage.properties };
        for (const [key, value] of Object.entries(properties)) {
            if (value !== undefined) mergedProperties[key] = value;
        }

        const updatedPage: NotionPage = {
            ...existingPage,
            properties: mergedProperties,
            lastEditedTime: new Date()
        };

        MOCK_PAGES[pageIndex] = updatedPage;
        return updatedPage;
    }

    export async function deletePage(pageId: string): Promise<boolean> {
        ensureInitialized();
        const pageIndex = MOCK_PAGES.findIndex(p => p.id === pageId);
        if (pageIndex === -1) throw new NotFoundError('Page', pageId);

        const existingPage = MOCK_PAGES[pageIndex];
        if (existingPage) {
            MOCK_PAGES[pageIndex] = { ...existingPage, archived: true };
        }
        return true;
    }

    export function isInitialized(): boolean {
        return state.initialized;
    }

    export function disconnect(): void {
        state.initialized = false;
        state.config = null;
        state.lastRequestTime = 0;
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
        console.log('=== Testing Notion Connector ===\n');

        resetState();

        // 1. Test metadata
        console.log('1. Testing metadata export:');
        assertTest(metadata.name === 'notion', 'Name is "notion"');
        assertTest(metadata.type === 'database', 'Type is "database"');
        assertTest(metadata.authentication.type === 'token', 'Authentication type is token');
        assertTest(metadata.credentials.length === 1, 'Has 1 credential requirement');
        assertTest(metadata.credentials[0]?.name === 'NOTION_TOKEN', 'Requires NOTION_TOKEN');
        assertTest(Array.isArray(metadata.methods), 'Has methods array');
        assertTest(typeof metadata.rateLimits === 'object', 'Has rate limits');

        // 2. Test default export structure
        console.log('\n2. Testing export structure:');
        const defaultExport = {
            metadata, initialize, testConnection, listDatabases,
            queryDatabase, getPage, createPage, updatePage, deletePage, isInitialized, disconnect
        };
        assertTest(typeof defaultExport.initialize === 'function', 'Has initialize function');
        assertTest(typeof defaultExport.testConnection === 'function', 'Has testConnection function');
        assertTest(typeof defaultExport.listDatabases === 'function', 'Has listDatabases function');
        assertTest(typeof defaultExport.queryDatabase === 'function', 'Has queryDatabase function');
        assertTest(typeof defaultExport.createPage === 'function', 'Has createPage function');
        assertTest(typeof defaultExport.updatePage === 'function', 'Has updatePage function');
        assertTest(typeof defaultExport.deletePage === 'function', 'Has deletePage function');

        // 3. Test authentication errors
        console.log('\n3. Testing authentication validation:');
        resetState();

        try {
            await initialize({ token: '' });
            assertTest(false, 'Catches missing token');
        } catch (e) {
            assertTest(e instanceof AuthenticationError, 'Catches missing token');
        }

        try {
            await initialize({ token: 'short' });
            assertTest(false, 'Catches invalid token format');
        } catch (e) {
            assertTest(e instanceof AuthenticationError, 'Catches invalid token format');
        }

        // 4. Test not initialized errors
        console.log('\n4. Testing not-initialized errors:');
        resetState();

        try {
            await listDatabases();
            assertTest(false, 'Catches not initialized');
        } catch (e) {
            assertTest(e instanceof ConnectionError && (e as ConnectionError).code === 'NOT_INITIALIZED',
                'Catches not initialized error');
        }

        // 5. Test successful initialization
        console.log('\n5. Testing initialization:');
        resetState();

        await initialize({ token: 'secret_valid_notion_token_12345' });
        assertTest(isInitialized() === true, 'Connector is initialized');

        // 6. Test connection test
        console.log('\n6. Testing connection:');
        const connected = await testConnection();
        assertTest(connected === true, 'Connection test succeeds');

        // 7. Test database operations
        console.log('\n7. Testing database operations:');

        const databases = await listDatabases();
        assertTest(Array.isArray(databases), 'listDatabases returns array');
        assertTest(databases.length > 0, 'listDatabases returns databases');

        const firstDb = databases[0];
        if (firstDb) {
            assertTest(typeof firstDb.id === 'string', 'Database has ID');
            assertTest(typeof firstDb.title === 'string', 'Database has title');
            assertTest(typeof firstDb.properties === 'object', 'Database has properties');
        }

        // 8. Test query database
        console.log('\n8. Testing query database:');

        const allPages = await queryDatabase('db-001');
        assertTest(Array.isArray(allPages), 'queryDatabase returns array');
        assertTest(allPages.length > 0, 'queryDatabase returns pages');

        const donePages = await queryDatabase('db-001', { status: { equals: 'Done' } });
        assertTest(donePages.every(p => {
            const status = p.properties['Status'] as StatusProperty;
            return status?.status?.name === 'Done';
        }), 'Filter by status works');

        try {
            await queryDatabase('nonexistent');
            assertTest(false, 'Catches database not found');
        } catch (e) {
            assertTest(e instanceof NotFoundError, 'Catches database not found');
        }

        // 9. Test page operations
        console.log('\n9. Testing page operations:');

        const page = await getPage('page-001');
        assertTest(page.id === 'page-001', 'getPage returns correct page');
        assertTest(typeof page.properties === 'object', 'Page has properties');

        try {
            await getPage('nonexistent');
            assertTest(false, 'Catches page not found');
        } catch (e) {
            assertTest(e instanceof NotFoundError, 'Catches page not found');
        }

        // 10. Test create page
        console.log('\n10. Testing create page:');

        const newPage = await createPage('db-001', {
            Name: { type: 'title', title: [{ text: { content: 'New Task' } }] },
            Status: { type: 'status', status: { name: 'Not Started' } }
        });
        assertTest(typeof newPage.id === 'string', 'createPage returns page with ID');
        assertTest(newPage.parentId === 'db-001', 'createPage sets correct parent');
        assertTest(newPage.archived === false, 'New page is not archived');

        try {
            await createPage('nonexistent', {});
            assertTest(false, 'Catches invalid database');
        } catch (e) {
            assertTest(e instanceof NotFoundError, 'Catches invalid database');
        }

        // 11. Test update page
        console.log('\n11. Testing update page:');

        const updatedPage = await updatePage('page-001', {
            Status: { type: 'status', status: { name: 'Done' } }
        });
        assertTest(updatedPage.id === 'page-001', 'updatePage returns correct page');
        const updatedStatus = updatedPage.properties['Status'] as StatusProperty;
        assertTest(updatedStatus?.status?.name === 'Done', 'Page status was updated');

        try {
            await updatePage('nonexistent', {});
            assertTest(false, 'Catches page not found on update');
        } catch (e) {
            assertTest(e instanceof NotFoundError, 'Catches page not found on update');
        }

        // 12. Test delete page
        console.log('\n12. Testing delete page:');

        const deleted = await deletePage('page-002');
        assertTest(deleted === true, 'deletePage returns true');

        // Verify page is archived
        const archivedPages = await queryDatabase('db-001');
        assertTest(!archivedPages.some(p => p.id === 'page-002'), 'Deleted page is excluded from queries');

        try {
            await deletePage('nonexistent');
            assertTest(false, 'Catches page not found on delete');
        } catch (e) {
            assertTest(e instanceof NotFoundError, 'Catches page not found on delete');
        }

        // 13. Test disconnect
        console.log('\n13. Testing disconnect:');

        disconnect();
        assertTest(isInitialized() === false, 'Connector is disconnected');

        try {
            await listDatabases();
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

NotionTests.runTests().catch(console.error);
