## Create a new git branch for the task from Phase6 and merge back into Phase6 when finished

# Work Notes - Phase 6: Example Tools & Connectors

## Current Status

**Phase 5 (MCP Server Templates)** is now **COMPLETE** ✅

### What Was Completed in Phase 5

- Task 5.1: Base Server Template (server.ts.template) - 57 tests
- Task 5.2: Tool Integration Template (tool-loader.ts.template) - 68 tests
- Task 5.3: Connector Integration Template (connector-loader.ts.template) - 84 tests
- Task 5.4: Entrypoint Script Template (entrypoint.sh.template) - 88 tests
- **Total: 297 tests passing**

Full details in: `/workspace/ActionPlan/Phase5/PhaseFinalApproval.md`

---

## Phase 6 Overview

**Goal**: Create example tools and connectors that demonstrate MCP patterns.

These examples serve as:
1. Working reference implementations
2. Templates for users to copy/modify
3. Integration tests for the template system

---

## Task 6.1: Create Example Tool - Summarize

**Branch**: `task-6.1` from `Phase6`  
**Goal**: Text summarization tool demonstrating basic MCP tool structure.

### Requirements:

1. **Create `tools/summarize.ts`**

2. **Export Metadata**:
   ```typescript
   export const metadata = {
     name: 'summarize',
     description: 'Summarize text to specified length',
     schemaVersion: '1.0'
   };
   ```

3. **Define Input Schema**:
   ```typescript
   interface SummarizeInput {
     text: string;           // Required - text to summarize
     maxLength?: number;     // Optional - default 100
     style?: 'bullet' | 'paragraph';  // Output format
   }
   ```

4. **Implement Handler**:
   ```typescript
   export async function summarize(input: SummarizeInput): Promise<string>
   ```
   - Split text into sentences
   - Extract key sentences
   - Join up to maxLength

5. **Add Validation**:
   - Check text is non-empty
   - Validate maxLength is positive

6. **Add JSDoc Documentation**:
   - `@tool` tag
   - `@param` descriptions
   - `@returns` description
   - `@example` usage

7. **Export Default**:
   ```typescript
   export default { metadata, handler: summarize };
   ```

### Success Criteria:
- Tool is discovered by loader
- Validates inputs correctly
- Produces reasonable summaries
- Has clear documentation

---

## Task 6.2: Create Example Tool - Translate

**Branch**: `task-6.2` from `Phase6`  
**Goal**: Translation tool demonstrating credential requirements.

### Requirements:

1. **Create `tools/translate.ts`**

2. **Declare Credential Requirement**:
   ```typescript
   credentials: [{
     name: 'TRANSLATION_API_KEY',
     type: 'api_key',
     required: false  // Falls back to mock
   }]
   ```

3. **Define Input Schema**:
   ```typescript
   interface TranslateInput {
     text: string;
     targetLanguage: string;
     sourceLanguage?: string;  // Auto-detect if missing
   }
   ```

4. **Implement Handler**:
   - If API key present → call external API
   - If no API key → use mock/fallback

5. **Add Language Detection**:
   - Auto-detect source language

6. **Include Error Handling**:
   - Catch API errors
   - Return user-friendly messages

### Success Criteria:
- Declares credential requirement
- Works with/without API key
- Handles errors gracefully
- Detects source language

---

## Task 6.3: Create Example Tool - Classify

**Branch**: `task-6.3` from `Phase6`  
**Goal**: Classification tool demonstrating configurable behavior.

### Requirements:

1. **Create `tools/classify.ts`**

2. **Declare Configuration**:
   ```typescript
   config: {
     categories: string[],
     confidenceThreshold: number
   }
   ```

3. **Define Input Schema**:
   ```typescript
   interface ClassifyInput {
     text: string;
     categories?: string[];  // Override defaults
   }
   ```

4. **Implement Classification**:
   - Keyword matching
   - Regex patterns
   - Basic scoring

5. **Return Results**:
   ```typescript
   interface ClassifyResult {
     category: string;
     confidence: number;  // 0-1
     matches: string[];
   }
   ```

### Success Criteria:
- Classifies text into categories
- Returns confidence scores
- Supports custom categories
- Configurable thresholds

---

## Task 6.4: Create Example Connector - Gmail

**Branch**: `task-6.4` from `Phase6`  
**Goal**: Gmail connector demonstrating OAuth2 authentication.

### Requirements:

1. **Create `connectors/gmail.ts`**

2. **Declare Authentication**:
   ```typescript
   authentication: {
     type: 'oauth2',
     scopes: ['gmail.readonly', 'gmail.send']
   }
   ```

3. **Declare Credentials**:
   - GMAIL_CLIENT_ID (required)
   - GMAIL_CLIENT_SECRET (required)
   - GMAIL_REFRESH_TOKEN (required)

4. **Implement Operations**:
   - `listMessages(maxResults)`
   - `sendEmail(to, subject, body)`
   - `searchMessages(query)`

5. **Add Rate Limiting**:
   - Track requests per minute
   - Respect API limits

6. **Implement Connection Test**:
   - `testConnection(): Promise<boolean>`

### Success Criteria:
- Connects to Gmail API
- Performs email operations
- Handles OAuth2
- Respects rate limits

---

## Task 6.5: Create Example Connector - Notion

**Branch**: `task-6.5` from `Phase6`  
**Goal**: Notion connector demonstrating database operations.

### Requirements:

1. **Create `connectors/notion.ts`**

2. **Declare Authentication**:
   ```typescript
   authentication: { type: 'token' }
   ```

3. **Declare Credentials**:
   - NOTION_TOKEN (required)

4. **Implement Operations**:
   - `queryDatabase(databaseId, filter?)`
   - `createPage(databaseId, properties)`
   - `updatePage(pageId, properties)`
   - `getPage(pageId)`
   - `listDatabases()`

5. **Add Retry Logic**:
   - Exponential backoff
   - Handle rate limits

### Success Criteria:
- Connects to Notion
- Queries databases
- Creates/updates pages
- Handles authentication
- Respects rate limits

---

## Quick Start (Task 6.1)

```bash
# Create Phase6 branch from main
git checkout main
git checkout -b Phase6

# Create task branch
git checkout -b task-6.1

# Create the summarize tool
# Create test file
npm run build && node dist/test-summarize.js

# Complete documentation
# Commit and merge to Phase6
git commit -am "Complete Task 6.1 - Summarize Tool"
git checkout Phase6 && git merge --no-ff task-6.1
```

---

## Reference Files

- Task details: `/workspace/ActionPlan/Phase6/Task1/Task1.md`
- Checklist: `/workspace/ActionPlan/Phase6/TaskCheckList6.md`
- Tool loader template: `base/templates/tool-loader.ts.template`
- Connector loader template: `base/templates/connector-loader.ts.template`
- Existing tools directory: `tools/`
- Existing connectors directory: `connectors/`

---

## Phase 6 Progress

1. **Task 6.1**: Create Example Tool - Summarize ← START HERE
2. **Task 6.2**: Create Example Tool - Translate
3. **Task 6.3**: Create Example Tool - Classify
4. **Task 6.4**: Create Example Connector - Gmail
5. **Task 6.5**: Create Example Connector - Notion

See full details: `/workspace/ActionPlan/Phase6/TaskCheckList6.md`
