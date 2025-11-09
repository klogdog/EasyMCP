# Task 6.1: Create Example Tool - Summarize

**Goal**: Build reference implementation of an MCP tool for text summarization.

**Actions**:

- Create `tools/summarize.ts` with proper MCP tool structure
- Export metadata: `export const metadata = { name: 'summarize', description: 'Summarize text to specified length', schemaVersion: '1.0' }`
- Define input schema: `{ text: string (required), maxLength?: number (default 100), style?: 'bullet'|'paragraph' }`
- Implement handler function: `export async function summarize(input: SummarizeInput): Promise<string>`
- Add basic algorithm: split into sentences, extract key sentences, join up to maxLength
- Include input validation: check text is non-empty, maxLength is positive number
- Add JSDoc comments: `@tool`, `@param`, `@returns`, `@example`
- Export default: `export default { metadata, handler: summarize }`

**Success Criteria**: Tool is discovered by loader; validates inputs; produces summaries; has clear documentation
