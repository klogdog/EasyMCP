# Task 6.3: Create Example Tool - Classify

**Goal**: Build MCP tool for text classification demonstrating configurable categories.

**Actions**:

- Create `tools/classify.ts` with MCP tool structure
- Export metadata with configuration: `config: { categories: string[], confidenceThreshold: number }`
- Define input schema: `{ text: string, categories?: string[] }` (override default categories)
- Implement simple classification: keyword matching, regex patterns, or basic sentiment analysis
- Add confidence scoring: return score 0-1 for each category
- Format results: `{ category: string, confidence: number, matches: string[] }[]` sorted by confidence
- Read categories from config: support both tool-level and runtime config
- Include examples of different use cases: sentiment, topic classification, intent detection

**Success Criteria**: Classifies text into categories; returns confidence scores; supports custom categories; configurable
