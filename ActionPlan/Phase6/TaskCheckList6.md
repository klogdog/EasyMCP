# Task Checklist for Phase 6: Example Tools & Connectors

## Overview

This phase focuses on example tools & connectors.

## Tasks

### Task 6.1: Create Example Tool - Summarize

- [ ] Create `tools/summarize.ts` with proper MCP tool structure
- [ ] Export metadata: `export const metadata = { name: 'summarize', description: 'Summarize text to specified length', schemaVersion: '1.0' }`
- [ ] Define input schema: `{ text: string (required), maxLength?: number (default 100), style?: 'bullet'|'paragraph' }`
- [ ] Implement handler function: `export async function summarize(input: SummarizeInput): Promise<string>`
- [ ] Add basic algorithm: split into sentences, extract key sentences, join up to maxLength
- [ ] Include input validation: check text is non-empty, maxLength is positive number
- [ ] Add JSDoc comments: `@tool`, `@param`, `@returns`, `@example`
- [ ] Export default: `export default { metadata, handler: summarize }`
- [ ] **Success Criteria**: Tool is discovered by loader; validates inputs; produces summaries; has clear documentation


### Task 6.2: Create Example Tool - Translate

- [ ] Create `tools/translate.ts` following MCP tool pattern
- [ ] Export metadata with credentials requirement: `credentials: [{ name: 'TRANSLATION_API_KEY', type: 'api_key', required: false }]`
- [ ] Define input schema: `{ text: string, targetLanguage: string, sourceLanguage?: string }`
- [ ] Implement handler: if API key present, call external API (e.g., Google Translate), else use simple mock/fallback
- [ ] Add language detection: auto-detect source language using language detection library
- [ ] Include API key from config: `const apiKey = config.services.translation`
- [ ] Add error handling: catch API errors, return user-friendly messages
- [ ] Include example usage in JSDoc with different language pairs
- [ ] **Success Criteria**: Tool declares credential requirement; works with/without API key; handles errors; detects language


### Task 6.3: Create Example Tool - Classify

- [ ] Create `tools/classify.ts` with MCP tool structure
- [ ] Export metadata with configuration: `config: { categories: string[], confidenceThreshold: number }`
- [ ] Define input schema: `{ text: string, categories?: string[] }` (override default categories)
- [ ] Implement simple classification: keyword matching, regex patterns, or basic sentiment analysis
- [ ] Add confidence scoring: return score 0-1 for each category
- [ ] Format results: `{ category: string, confidence: number, matches: string[] }[]` sorted by confidence
- [ ] Read categories from config: support both tool-level and runtime config
- [ ] Include examples of different use cases: sentiment, topic classification, intent detection
- [ ] **Success Criteria**: Classifies text into categories; returns confidence scores; supports custom categories; configurable


### Task 6.4: Create Example Connector - Gmail

- [ ] Create `connectors/gmail.ts` following connector pattern
- [ ] Export metadata: `{ name: 'gmail', type: 'email', authentication: { type: 'oauth2', scopes: ['gmail.readonly', 'gmail.send'] } }`
- [ ] Declare credentials: `credentials: [{ name: 'GMAIL_CLIENT_ID', required: true }, { name: 'GMAIL_CLIENT_SECRET', required: true }, { name: 'GMAIL_REFRESH_TOKEN', required: true }]`
- [ ] Implement initialization: create Gmail API client using googleapis npm package, set up OAuth2 client
- [ ] Add basic operations: `async listMessages(maxResults: number)`, `async sendEmail(to, subject, body)`, `async searchMessages(query)`
- [ ] Implement rate limiting: track requests per minute, delay if exceeding quota, respect API limits
- [ ] Add connection test: `async testConnection(): Promise<boolean>` that verifies credentials
- [ ] Include error handling: handle token expiration, quota exceeded, network errors
- [ ] **Success Criteria**: Connects to Gmail API; performs email operations; handles OAuth2; respects rate limits


### Task 6.5: Create Example Connector - Notion

- [ ] Create `connectors/notion.ts` with connector structure
- [ ] Export metadata: `{ name: 'notion', type: 'database', authentication: { type: 'token' } }`
- [ ] Declare credentials: `credentials: [{ name: 'NOTION_TOKEN', type: 'api_key', required: true }]`
- [ ] Implement initialization: create Notion client using @notionhq/client, authenticate with integration token
- [ ] Add database operations: `async queryDatabase(databaseId, filter?)`, `async createPage(databaseId, properties)`, `async updatePage(pageId, properties)`, `async getPage(pageId)`
- [ ] Implement error handling: handle invalid database IDs, permission errors, network issues
- [ ] Add retry logic: Notion has rate limits, implement exponential backoff
- [ ] Include helper methods: `async listDatabases()` to discover available databases
- [ ] **Success Criteria**: Connects to Notion; queries databases; creates/updates pages; handles authentication; respects rate limits

