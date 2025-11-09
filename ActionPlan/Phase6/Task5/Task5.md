# Task 6.5: Create Example Connector - Notion

**Goal**: Build connector for Notion API demonstrating database operations.

**Actions**:

- Create `connectors/notion.ts` with connector structure
- Export metadata: `{ name: 'notion', type: 'database', authentication: { type: 'token' } }`
- Declare credentials: `credentials: [{ name: 'NOTION_TOKEN', type: 'api_key', required: true }]`
- Implement initialization: create Notion client using @notionhq/client, authenticate with integration token
- Add database operations: `async queryDatabase(databaseId, filter?)`, `async createPage(databaseId, properties)`, `async updatePage(pageId, properties)`, `async getPage(pageId)`
- Implement error handling: handle invalid database IDs, permission errors, network issues
- Add retry logic: Notion has rate limits, implement exponential backoff
- Include helper methods: `async listDatabases()` to discover available databases

**Success Criteria**: Connects to Notion; queries databases; creates/updates pages; handles authentication; respects rate limits
