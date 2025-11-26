# Task Checklist for Phase 6: Example Tools & Connectors

## Overview

This phase focuses on example tools & connectors.

## Phase Status: ✅ COMPLETE

## Tasks

### Task 6.1: Create Example Tool - Summarize ✅ COMPLETE (21 tests passing)

- [x] Create `tools/summarize.ts` with proper MCP tool structure
- [x] Export metadata: `export const metadata = { name: 'summarize', description: 'Summarize text to specified length', schemaVersion: '1.0' }`
- [x] Define input schema: `{ text: string (required), maxLength?: number (default 100), style?: 'bullet'|'paragraph' }`
- [x] Implement handler function: `export async function summarize(input: SummarizeInput): Promise<string>`
- [x] Add basic algorithm: split into sentences, extract key sentences, join up to maxLength
- [x] Include input validation: check text is non-empty, maxLength is positive number
- [x] Add JSDoc comments: `@tool`, `@param`, `@returns`, `@example`
- [x] Export default: `export default { metadata, handler: summarize }`
- [x] **Success Criteria**: Tool is discovered by loader; validates inputs; produces summaries; has clear documentation

### Task 6.2: Create Example Tool - Translate ✅ COMPLETE (28 tests passing)

- [x] Create `tools/translate.ts` following MCP tool pattern
- [x] Export metadata with credentials requirement: `credentials: [{ name: 'TRANSLATION_API_KEY', type: 'api_key', required: false }]`
- [x] Define input schema: `{ text: string, targetLanguage: string, sourceLanguage?: string }`
- [x] Implement handler: if API key present, call external API (e.g., Google Translate), else use simple mock/fallback
- [x] Add language detection: auto-detect source language using language detection library
- [x] Include API key from config: `const apiKey = config.services.translation`
- [x] Add error handling: catch API errors, return user-friendly messages
- [x] Include example usage in JSDoc with different language pairs
- [x] **Success Criteria**: Tool declares credential requirement; works with/without API key; handles errors; detects language

### Task 6.3: Create Example Tool - Classify ✅ COMPLETE (31 tests passing)

- [x] Create `tools/classify.ts` with MCP tool structure
- [x] Export metadata with configuration: `config: { categories: string[], confidenceThreshold: number }`
- [x] Define input schema: `{ text: string, categories?: string[] }` (override default categories)
- [x] Implement simple classification: keyword matching, regex patterns, or basic sentiment analysis
- [x] Add confidence scoring: return score 0-1 for each category
- [x] Format results: `{ category: string, confidence: number, matches: string[] }[]` sorted by confidence
- [x] Read categories from config: support both tool-level and runtime config
- [x] Include examples of different use cases: sentiment, topic classification, intent detection
- [x] **Success Criteria**: Classifies text into categories; returns confidence scores; supports custom categories; configurable

### Task 6.4: Create Example Connector - Gmail ✅ COMPLETE (39 tests passing)

- [x] Create `connectors/gmail.ts` following connector pattern
- [x] Export metadata: `{ name: 'gmail', type: 'email', authentication: { type: 'oauth2', scopes: ['gmail.readonly', 'gmail.send'] } }`
- [x] Declare credentials: `credentials: [{ name: 'GMAIL_CLIENT_ID', required: true }, { name: 'GMAIL_CLIENT_SECRET', required: true }, { name: 'GMAIL_REFRESH_TOKEN', required: true }]`
- [x] Implement initialization: create Gmail API client using googleapis npm package, set up OAuth2 client
- [x] Add basic operations: `async listMessages(maxResults: number)`, `async sendEmail(to, subject, body)`, `async searchMessages(query)`
- [x] Implement rate limiting: track requests per minute, delay if exceeding quota, respect API limits
- [x] Add connection test: `async testConnection(): Promise<boolean>` that verifies credentials
- [x] Include error handling: handle token expiration, quota exceeded, network errors
- [x] **Success Criteria**: Connects to Gmail API; performs email operations; handles OAuth2; respects rate limits

### Task 6.5: Create Example Connector - Notion ✅ COMPLETE (43 tests passing)

- [x] Create `connectors/notion.ts` with connector structure
- [x] Export metadata: `{ name: 'notion', type: 'database', authentication: { type: 'token' } }`
- [x] Declare credentials: `credentials: [{ name: 'NOTION_TOKEN', type: 'api_key', required: true }]`
- [x] Implement initialization: create Notion client using @notionhq/client, authenticate with integration token
- [x] Add database operations: `async queryDatabase(databaseId, filter?)`, `async createPage(databaseId, properties)`, `async updatePage(pageId, properties)`, `async getPage(pageId)`
- [x] Implement error handling: handle invalid database IDs, permission errors, network issues
- [x] Add retry logic: Notion has rate limits, implement exponential backoff
- [x] Include helper methods: `async listDatabases()` to discover available databases
- [x] **Success Criteria**: Connects to Notion; queries databases; creates/updates pages; handles authentication; respects rate limits

## Summary

| Task      | Description      | Tests   |
| --------- | ---------------- | ------- |
| 6.1       | Summarize Tool   | 21      |
| 6.2       | Translate Tool   | 28      |
| 6.3       | Classify Tool    | 31      |
| 6.4       | Gmail Connector  | 39      |
| 6.5       | Notion Connector | 43      |
| **Total** |                  | **162** |
