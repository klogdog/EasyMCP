# Task 6.2: Create Example Tool - Translate

**Goal**: Build MCP tool demonstrating external API integration (translation service).

**Actions**:

- Create `tools/translate.ts` following MCP tool pattern
- Export metadata with credentials requirement: `credentials: [{ name: 'TRANSLATION_API_KEY', type: 'api_key', required: false }]`
- Define input schema: `{ text: string, targetLanguage: string, sourceLanguage?: string }`
- Implement handler: if API key present, call external API (e.g., Google Translate), else use simple mock/fallback
- Add language detection: auto-detect source language using language detection library
- Include API key from config: `const apiKey = config.services.translation`
- Add error handling: catch API errors, return user-friendly messages
- Include example usage in JSDoc with different language pairs

**Success Criteria**: Tool declares credential requirement; works with/without API key; handles errors; detects language
