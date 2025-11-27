# Tool Development Guide

A comprehensive guide to developing MCP tools for the EasyMCP framework.

## Table of Contents

1. [Introduction](#introduction)
2. [Tool Structure Requirements](#tool-structure-requirements)
3. [Metadata Specification](#metadata-specification)
4. [Input Validation](#input-validation)
5. [Complete Example: Spell Checker Tool](#complete-example-spell-checker-tool)
6. [Tool Examples](#tool-examples)
7. [Best Practices](#best-practices)
8. [Credential Requirements](#credential-requirements)
9. [Troubleshooting](#troubleshooting)

---

## Introduction

MCP (Model Context Protocol) tools are modular components that extend the functionality of your MCP server. Tools can perform various operations like text processing, API calls, data transformations, and more. This guide will walk you through creating robust, well-documented tools.

### What is a Tool?

A tool is a self-contained module that:
- Exposes a specific capability to the MCP server
- Has well-defined inputs and outputs
- Can be discovered and invoked dynamically
- Follows a consistent structure for interoperability

---

## Tool Structure Requirements

### File Location

All tools must be placed in the `/tools` directory:

```
/workspace
├── tools/
│   ├── my-tool.ts        # TypeScript tool
│   ├── calculator.py     # Python tool
│   └── summarize.ts      # Another TypeScript tool
```

### Naming Conventions

| Convention | Rule | Example |
|------------|------|---------|
| File name | lowercase, hyphen-separated | `spell-checker.ts` |
| Metadata name | lowercase, hyphen-separated | `spell-checker` |
| Export name | camelCase | `spellChecker` |
| Class name | PascalCase | `SpellChecker` |

### Required Exports

Every tool must export:

1. **`metadata`** - Tool discovery and configuration information
2. **`handler`** - The main function that executes the tool's logic

#### TypeScript Example

```typescript
// Required exports
export const metadata = {
    name: 'my-tool',
    description: 'Description of what the tool does',
    schemaVersion: '1.0',
    version: '1.0.0'
};

export async function handler(input: MyToolInput): Promise<MyToolOutput> {
    // Tool logic here
}
```

#### Python Example

```python
# Required exports
metadata = {
    "name": "my-tool",
    "description": "Description of what the tool does",
    "schema_version": "1.0",
    "version": "1.0.0"
}

def handler(input: dict) -> dict:
    """Main tool handler"""
    # Tool logic here
    pass
```

---

## Metadata Specification

The `metadata` object defines how the tool is discovered and configured.

### All Metadata Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Unique identifier for the tool |
| `description` | string | ✅ | Human-readable description |
| `schemaVersion` | string | ✅ | Version of the tool schema (e.g., "1.0") |
| `version` | string | ✅ | Tool version (semver format) |
| `inputSchema` | object | ❌ | JSON Schema for input validation |
| `outputSchema` | object | ❌ | JSON Schema for output format |
| `capabilities` | string[] | ❌ | List of capabilities the tool provides |
| `credentials` | object[] | ❌ | Required API keys or secrets |
| `config` | object | ❌ | Default configuration values |

### Complete Metadata Example

```typescript
export const metadata = {
    name: 'text-analyzer',
    description: 'Analyzes text for sentiment, keywords, and readability',
    schemaVersion: '1.0',
    version: '2.1.0',
    
    capabilities: ['sentiment', 'keywords', 'readability', 'language-detection'],
    
    inputSchema: {
        type: 'object',
        properties: {
            text: {
                type: 'string',
                description: 'The text to analyze',
                minLength: 1,
                maxLength: 100000
            },
            options: {
                type: 'object',
                properties: {
                    analyzeSentiment: { type: 'boolean', default: true },
                    extractKeywords: { type: 'boolean', default: true },
                    maxKeywords: { type: 'integer', minimum: 1, maximum: 50, default: 10 }
                }
            }
        },
        required: ['text']
    },
    
    outputSchema: {
        type: 'object',
        properties: {
            sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
            sentimentScore: { type: 'number', minimum: -1, maximum: 1 },
            keywords: { type: 'array', items: { type: 'string' } },
            readabilityScore: { type: 'number' }
        }
    },
    
    credentials: [
        {
            name: 'ANALYZER_API_KEY',
            type: 'api_key',
            required: false,
            description: 'Optional API key for enhanced analysis'
        }
    ],
    
    config: {
        defaultLanguage: 'en',
        maxCacheSize: 1000,
        timeout: 30000
    }
};
```

---

## Input Validation

### Using JSON Schema

Define input validation in the `inputSchema` field:

```typescript
export const metadata = {
    name: 'email-validator',
    description: 'Validates email addresses',
    schemaVersion: '1.0',
    version: '1.0.0',
    
    inputSchema: {
        type: 'object',
        properties: {
            email: {
                type: 'string',
                format: 'email',
                description: 'Email address to validate'
            },
            checkMx: {
                type: 'boolean',
                default: false,
                description: 'Whether to check MX records'
            },
            timeout: {
                type: 'integer',
                minimum: 1000,
                maximum: 30000,
                default: 5000,
                description: 'Timeout in milliseconds'
            }
        },
        required: ['email'],
        additionalProperties: false
    }
};
```

### Common Validation Patterns

#### String Validation

```typescript
{
    type: 'string',
    minLength: 1,
    maxLength: 1000,
    pattern: '^[a-zA-Z0-9_-]+$'  // Regex pattern
}
```

#### Number Validation

```typescript
{
    type: 'number',
    minimum: 0,
    maximum: 100,
    exclusiveMinimum: 0,
    multipleOf: 0.01  // Two decimal places
}
```

#### Array Validation

```typescript
{
    type: 'array',
    items: { type: 'string' },
    minItems: 1,
    maxItems: 100,
    uniqueItems: true
}
```

#### Enum Validation

```typescript
{
    type: 'string',
    enum: ['option1', 'option2', 'option3']
}
```

### Programmatic Validation

For complex validation logic, implement it in your handler:

```typescript
export class ValidationError extends Error {
    constructor(message: string, public field?: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

function validateInput(input: MyToolInput): void {
    // Required field check
    if (!input.text) {
        throw new ValidationError('Text is required', 'text');
    }
    
    // Type check
    if (typeof input.text !== 'string') {
        throw new ValidationError('Text must be a string', 'text');
    }
    
    // Business logic validation
    if (input.text.length > 10000) {
        throw new ValidationError('Text exceeds maximum length of 10000 characters', 'text');
    }
    
    // Cross-field validation
    if (input.startDate && input.endDate && input.startDate > input.endDate) {
        throw new ValidationError('Start date must be before end date');
    }
}

export async function handler(input: MyToolInput): Promise<MyToolOutput> {
    validateInput(input);
    // ... rest of handler
}
```

---

## Complete Example: Spell Checker Tool

Let's build a complete spell checker tool from scratch.

### Step 1: Create the File

Create `/tools/spell-checker.ts`:

```typescript
/**
 * MCP Tool - Spell Checker
 * 
 * A tool that checks text for spelling errors and suggests corrections.
 * Demonstrates complete MCP tool structure with validation and documentation.
 * 
 * @tool spell-checker
 * @description Check text for spelling errors and get suggestions
 * @example
 * ```typescript
 * import spellChecker from './spell-checker';
 * 
 * const result = await spellChecker.handler({
 *   text: "Ths is a tset",
 *   language: "en"
 * });
 * // Result: { errors: [{ word: "Ths", suggestions: ["This", "The"] }, ...] }
 * ```
 */

// ============================================
// METADATA
// ============================================

export const metadata = {
    name: 'spell-checker',
    description: 'Check text for spelling errors and suggest corrections',
    schemaVersion: '1.0',
    version: '1.0.0',
    capabilities: ['spell-check', 'suggestions', 'multi-language'],
    
    inputSchema: {
        type: 'object',
        properties: {
            text: {
                type: 'string',
                description: 'The text to check for spelling errors',
                minLength: 1,
                maxLength: 50000
            },
            language: {
                type: 'string',
                description: 'Language code (e.g., "en", "es", "fr")',
                default: 'en',
                enum: ['en', 'es', 'fr', 'de', 'it']
            },
            maxSuggestions: {
                type: 'integer',
                description: 'Maximum suggestions per error',
                minimum: 1,
                maximum: 10,
                default: 5
            },
            ignoreWords: {
                type: 'array',
                items: { type: 'string' },
                description: 'Words to ignore during checking',
                default: []
            }
        },
        required: ['text']
    },
    
    outputSchema: {
        type: 'object',
        properties: {
            errors: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        word: { type: 'string' },
                        position: { type: 'integer' },
                        suggestions: { type: 'array', items: { type: 'string' } }
                    }
                }
            },
            errorCount: { type: 'integer' },
            checkedWordCount: { type: 'integer' }
        }
    },
    
    config: {
        defaultLanguage: 'en',
        cacheEnabled: true,
        caseSensitive: false
    }
};

// ============================================
// TYPES
// ============================================

export interface SpellCheckInput {
    text: string;
    language?: string;
    maxSuggestions?: number;
    ignoreWords?: string[];
}

export interface SpellingError {
    word: string;
    position: number;
    suggestions: string[];
}

export interface SpellCheckOutput {
    errors: SpellingError[];
    errorCount: number;
    checkedWordCount: number;
}

// ============================================
// VALIDATION
// ============================================

export class ValidationError extends Error {
    constructor(message: string, public field?: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

function validateInput(input: SpellCheckInput): void {
    if (!input.text || typeof input.text !== 'string') {
        throw new ValidationError('Text is required and must be a string', 'text');
    }
    
    if (input.text.trim().length === 0) {
        throw new ValidationError('Text cannot be empty', 'text');
    }
    
    if (input.text.length > 50000) {
        throw new ValidationError('Text exceeds maximum length of 50000 characters', 'text');
    }
    
    const validLanguages = ['en', 'es', 'fr', 'de', 'it'];
    if (input.language && !validLanguages.includes(input.language)) {
        throw new ValidationError(
            `Invalid language. Must be one of: ${validLanguages.join(', ')}`,
            'language'
        );
    }
    
    if (input.maxSuggestions !== undefined) {
        if (typeof input.maxSuggestions !== 'number' || 
            input.maxSuggestions < 1 || 
            input.maxSuggestions > 10) {
            throw new ValidationError('maxSuggestions must be between 1 and 10', 'maxSuggestions');
        }
    }
}

// ============================================
// DICTIONARY (Simplified for example)
// ============================================

const DICTIONARIES: Record<string, Set<string>> = {
    en: new Set([
        'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
        'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
        'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
        'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
        'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
        'is', 'are', 'was', 'were', 'been', 'being', 'test', 'text', 'hello', 'world',
        'spell', 'check', 'checker', 'error', 'word', 'language', 'english'
    ]),
    es: new Set(['hola', 'mundo', 'el', 'la', 'de', 'que', 'y', 'en', 'un', 'es']),
    fr: new Set(['bonjour', 'monde', 'le', 'la', 'de', 'et', 'un', 'une', 'est', 'que']),
    de: new Set(['hallo', 'welt', 'der', 'die', 'das', 'und', 'ein', 'eine', 'ist', 'zu']),
    it: new Set(['ciao', 'mondo', 'il', 'la', 'di', 'e', 'un', 'una', 'che', 'è'])
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[b.length][a.length];
}

/**
 * Find suggestions for a misspelled word
 */
function findSuggestions(
    word: string,
    dictionary: Set<string>,
    maxSuggestions: number
): string[] {
    const suggestions: Array<{ word: string; distance: number }> = [];
    
    for (const dictWord of dictionary) {
        const distance = levenshteinDistance(word.toLowerCase(), dictWord);
        if (distance <= 3) { // Only consider words within 3 edits
            suggestions.push({ word: dictWord, distance });
        }
    }
    
    return suggestions
        .sort((a, b) => a.distance - b.distance)
        .slice(0, maxSuggestions)
        .map(s => s.word);
}

/**
 * Extract words from text with their positions
 */
function extractWords(text: string): Array<{ word: string; position: number }> {
    const words: Array<{ word: string; position: number }> = [];
    const regex = /\b[a-zA-Z]+\b/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
        words.push({
            word: match[0],
            position: match.index
        });
    }
    
    return words;
}

// ============================================
// MAIN HANDLER
// ============================================

/**
 * Main spell check handler
 * 
 * @param input - The input parameters
 * @returns Spell check results with errors and suggestions
 */
export async function handler(input: SpellCheckInput): Promise<SpellCheckOutput> {
    // Validate input
    validateInput(input);
    
    // Set defaults
    const language = input.language || 'en';
    const maxSuggestions = input.maxSuggestions || 5;
    const ignoreWords = new Set((input.ignoreWords || []).map(w => w.toLowerCase()));
    
    // Get dictionary
    const dictionary = DICTIONARIES[language];
    if (!dictionary) {
        throw new Error(`Dictionary not available for language: ${language}`);
    }
    
    // Extract and check words
    const words = extractWords(input.text);
    const errors: SpellingError[] = [];
    
    for (const { word, position } of words) {
        const lowerWord = word.toLowerCase();
        
        // Skip if in ignore list
        if (ignoreWords.has(lowerWord)) {
            continue;
        }
        
        // Check if word is in dictionary
        if (!dictionary.has(lowerWord)) {
            errors.push({
                word,
                position,
                suggestions: findSuggestions(lowerWord, dictionary, maxSuggestions)
            });
        }
    }
    
    return {
        errors,
        errorCount: errors.length,
        checkedWordCount: words.length
    };
}

// ============================================
// DEFAULT EXPORT
// ============================================

export default { metadata, handler };
```

### Step 2: Test the Tool

Create a test file `/tools/__tests__/spell-checker.test.ts`:

```typescript
import { handler, metadata, ValidationError } from '../spell-checker';

describe('Spell Checker Tool', () => {
    describe('metadata', () => {
        it('should have required fields', () => {
            expect(metadata.name).toBe('spell-checker');
            expect(metadata.description).toBeDefined();
            expect(metadata.schemaVersion).toBe('1.0');
            expect(metadata.version).toBeDefined();
        });
    });
    
    describe('handler', () => {
        it('should detect spelling errors', async () => {
            const result = await handler({
                text: 'Ths is a tset'
            });
            
            expect(result.errorCount).toBeGreaterThan(0);
            expect(result.errors.some(e => e.word === 'Ths')).toBe(true);
            expect(result.errors.some(e => e.word === 'tset')).toBe(true);
        });
        
        it('should provide suggestions', async () => {
            const result = await handler({
                text: 'teh quick',
                maxSuggestions: 3
            });
            
            const tehError = result.errors.find(e => e.word === 'teh');
            expect(tehError).toBeDefined();
            expect(tehError!.suggestions).toContain('the');
        });
        
        it('should respect ignore list', async () => {
            const result = await handler({
                text: 'MyCustomWord is here',
                ignoreWords: ['mycustomword']
            });
            
            expect(result.errors.some(e => e.word.toLowerCase() === 'mycustomword')).toBe(false);
        });
        
        it('should throw on empty text', async () => {
            await expect(handler({ text: '' })).rejects.toThrow(ValidationError);
        });
    });
});
```

---

## Tool Examples

### Simple Tool (No Dependencies)

A minimal tool that performs a simple operation:

```typescript
// tools/word-counter.ts
export const metadata = {
    name: 'word-counter',
    description: 'Count words in text',
    schemaVersion: '1.0',
    version: '1.0.0'
};

export interface WordCountInput {
    text: string;
}

export interface WordCountOutput {
    wordCount: number;
    characterCount: number;
    lineCount: number;
}

export async function handler(input: WordCountInput): Promise<WordCountOutput> {
    const text = input.text || '';
    
    return {
        wordCount: text.split(/\s+/).filter(w => w.length > 0).length,
        characterCount: text.length,
        lineCount: text.split('\n').length
    };
}
```

### API-Dependent Tool

A tool that calls an external API:

```typescript
// tools/weather-lookup.ts
export const metadata = {
    name: 'weather-lookup',
    description: 'Get weather for a location',
    schemaVersion: '1.0',
    version: '1.0.0',
    credentials: [
        {
            name: 'WEATHER_API_KEY',
            type: 'api_key',
            required: true,
            description: 'API key from OpenWeatherMap'
        }
    ]
};

export interface WeatherInput {
    city: string;
    units?: 'metric' | 'imperial';
}

export interface WeatherOutput {
    temperature: number;
    description: string;
    humidity: number;
}

export async function handler(input: WeatherInput): Promise<WeatherOutput> {
    const apiKey = process.env.WEATHER_API_KEY;
    if (!apiKey) {
        throw new Error('WEATHER_API_KEY environment variable is required');
    }
    
    const units = input.units || 'metric';
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(input.city)}&units=${units}&appid=${apiKey}`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Weather API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return {
        temperature: data.main.temp,
        description: data.weather[0].description,
        humidity: data.main.humidity
    };
}
```

### Stateful Tool

A tool that maintains state between calls:

```typescript
// tools/session-counter.ts
export const metadata = {
    name: 'session-counter',
    description: 'Count events in a session',
    schemaVersion: '1.0',
    version: '1.0.0',
    capabilities: ['increment', 'decrement', 'reset', 'get']
};

// State storage
const sessions: Map<string, number> = new Map();

export interface CounterInput {
    sessionId: string;
    action: 'increment' | 'decrement' | 'reset' | 'get';
    amount?: number;
}

export interface CounterOutput {
    sessionId: string;
    count: number;
    action: string;
}

export async function handler(input: CounterInput): Promise<CounterOutput> {
    const { sessionId, action, amount = 1 } = input;
    
    let count = sessions.get(sessionId) || 0;
    
    switch (action) {
        case 'increment':
            count += amount;
            break;
        case 'decrement':
            count -= amount;
            break;
        case 'reset':
            count = 0;
            break;
        case 'get':
            // Just return current count
            break;
    }
    
    sessions.set(sessionId, count);
    
    return { sessionId, count, action };
}
```

### Multi-Step Tool

A tool that performs multiple operations:

```typescript
// tools/document-processor.ts
export const metadata = {
    name: 'document-processor',
    description: 'Process documents through multiple steps',
    schemaVersion: '1.0',
    version: '1.0.0',
    capabilities: ['parse', 'transform', 'validate', 'export']
};

export interface ProcessInput {
    document: string;
    steps: Array<'parse' | 'clean' | 'validate' | 'format'>;
    options?: {
        format?: 'json' | 'xml' | 'yaml';
        strict?: boolean;
    };
}

export interface StepResult {
    step: string;
    success: boolean;
    duration: number;
    output?: any;
    error?: string;
}

export interface ProcessOutput {
    success: boolean;
    steps: StepResult[];
    finalOutput: any;
    totalDuration: number;
}

async function parseStep(doc: string): Promise<any> {
    return JSON.parse(doc);
}

async function cleanStep(data: any): Promise<any> {
    // Remove null values
    return JSON.parse(JSON.stringify(data, (k, v) => v === null ? undefined : v));
}

async function validateStep(data: any): Promise<any> {
    if (typeof data !== 'object') {
        throw new Error('Document must be an object');
    }
    return data;
}

async function formatStep(data: any, format: string): Promise<any> {
    switch (format) {
        case 'json':
            return JSON.stringify(data, null, 2);
        case 'yaml':
            // Simplified YAML output
            return Object.entries(data)
                .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                .join('\n');
        default:
            return data;
    }
}

export async function handler(input: ProcessInput): Promise<ProcessOutput> {
    const results: StepResult[] = [];
    let currentData: any = input.document;
    const startTime = Date.now();
    
    for (const step of input.steps) {
        const stepStart = Date.now();
        
        try {
            switch (step) {
                case 'parse':
                    currentData = await parseStep(currentData);
                    break;
                case 'clean':
                    currentData = await cleanStep(currentData);
                    break;
                case 'validate':
                    currentData = await validateStep(currentData);
                    break;
                case 'format':
                    currentData = await formatStep(currentData, input.options?.format || 'json');
                    break;
            }
            
            results.push({
                step,
                success: true,
                duration: Date.now() - stepStart,
                output: typeof currentData === 'string' ? currentData.substring(0, 100) : currentData
            });
        } catch (error) {
            results.push({
                step,
                success: false,
                duration: Date.now() - stepStart,
                error: error instanceof Error ? error.message : String(error)
            });
            
            if (input.options?.strict) {
                return {
                    success: false,
                    steps: results,
                    finalOutput: null,
                    totalDuration: Date.now() - startTime
                };
            }
        }
    }
    
    return {
        success: results.every(r => r.success),
        steps: results,
        finalOutput: currentData,
        totalDuration: Date.now() - startTime
    };
}
```

---

## Best Practices

### Async/Await Patterns

```typescript
// ✅ Good: Proper async/await
export async function handler(input: MyInput): Promise<MyOutput> {
    try {
        const result = await someAsyncOperation();
        return { success: true, data: result };
    } catch (error) {
        throw new Error(`Operation failed: ${error.message}`);
    }
}

// ✅ Good: Parallel operations
export async function handler(input: MyInput): Promise<MyOutput> {
    const [users, posts, comments] = await Promise.all([
        fetchUsers(),
        fetchPosts(),
        fetchComments()
    ]);
    return { users, posts, comments };
}

// ❌ Bad: Blocking with unnecessary await
export async function handler(input: MyInput): Promise<MyOutput> {
    const user1 = await fetchUser(1);  // Waits here
    const user2 = await fetchUser(2);  // Then waits here
    const user3 = await fetchUser(3);  // Then waits here
    return { users: [user1, user2, user3] };
}
```

### Error Messages

```typescript
// ✅ Good: Descriptive error messages
throw new Error('Failed to parse JSON: unexpected token at position 42');
throw new ValidationError('Email format is invalid. Expected format: user@domain.com');
throw new Error(`API rate limit exceeded. Retry after ${retryAfter} seconds`);

// ❌ Bad: Vague error messages
throw new Error('Error');
throw new Error('Invalid input');
throw new Error('Something went wrong');
```

### Logging

```typescript
// Use structured logging
const log = {
    debug: (msg: string, data?: any) => console.debug(JSON.stringify({ level: 'debug', msg, ...data })),
    info: (msg: string, data?: any) => console.info(JSON.stringify({ level: 'info', msg, ...data })),
    warn: (msg: string, data?: any) => console.warn(JSON.stringify({ level: 'warn', msg, ...data })),
    error: (msg: string, data?: any) => console.error(JSON.stringify({ level: 'error', msg, ...data }))
};

export async function handler(input: MyInput): Promise<MyOutput> {
    log.info('Starting operation', { inputSize: input.data.length });
    
    try {
        const result = await process(input);
        log.info('Operation completed', { resultSize: result.length });
        return result;
    } catch (error) {
        log.error('Operation failed', { error: error.message, stack: error.stack });
        throw error;
    }
}
```

### Testing

```typescript
describe('MyTool', () => {
    // Test valid inputs
    describe('valid inputs', () => {
        it('should handle basic input', async () => { ... });
        it('should handle edge cases', async () => { ... });
        it('should use default values', async () => { ... });
    });
    
    // Test invalid inputs
    describe('invalid inputs', () => {
        it('should reject empty input', async () => { ... });
        it('should reject invalid types', async () => { ... });
        it('should reject out-of-range values', async () => { ... });
    });
    
    // Test error handling
    describe('error handling', () => {
        it('should handle network errors', async () => { ... });
        it('should handle timeout', async () => { ... });
    });
});
```

### Documentation

```typescript
/**
 * Processes the input text and returns analysis results.
 * 
 * @param input - The input parameters
 * @param input.text - The text to analyze (1-10000 characters)
 * @param input.options - Optional configuration
 * @returns Analysis results including sentiment and keywords
 * @throws {ValidationError} If input text is empty or too long
 * @throws {Error} If analysis service is unavailable
 * 
 * @example
 * ```typescript
 * const result = await handler({
 *   text: "This is great!",
 *   options: { detailed: true }
 * });
 * console.log(result.sentiment); // 'positive'
 * ```
 */
export async function handler(input: AnalyzeInput): Promise<AnalyzeOutput> {
    // Implementation
}
```

---

## Credential Requirements

### Declaring Credentials

Specify required credentials in metadata:

```typescript
export const metadata = {
    name: 'my-api-tool',
    // ...
    credentials: [
        {
            name: 'MY_API_KEY',
            type: 'api_key',
            required: true,
            description: 'API key for MyService (get it at https://myservice.com/api-keys)'
        },
        {
            name: 'MY_API_SECRET',
            type: 'api_secret',
            required: true,
            description: 'API secret for MyService'
        },
        {
            name: 'MY_OPTIONAL_TOKEN',
            type: 'token',
            required: false,
            description: 'Optional token for enhanced features'
        }
    ]
};
```

### Credential Types

| Type | Description | Example |
|------|-------------|---------|
| `api_key` | API key for service authentication | `sk-abc123...` |
| `api_secret` | API secret (pair with api_key) | `secret_xyz...` |
| `token` | Bearer token or access token | `eyJhbG...` |
| `oauth_client_id` | OAuth2 client ID | `123456.apps.googleusercontent.com` |
| `oauth_client_secret` | OAuth2 client secret | `GOCSPX-abc...` |
| `oauth_refresh_token` | OAuth2 refresh token | `1//0abc...` |
| `password` | Password or passphrase | `*****` |
| `certificate` | PEM certificate content | `-----BEGIN CERT-----` |

### Accessing Credentials

```typescript
export async function handler(input: MyInput): Promise<MyOutput> {
    // Access from environment variables
    const apiKey = process.env.MY_API_KEY;
    const apiSecret = process.env.MY_API_SECRET;
    
    // Validate credentials exist
    if (!apiKey || !apiSecret) {
        throw new Error('Missing required credentials: MY_API_KEY and MY_API_SECRET');
    }
    
    // Use credentials
    const response = await fetch('https://api.example.com/data', {
        headers: {
            'X-API-Key': apiKey,
            'X-API-Secret': apiSecret
        }
    });
    
    // ...
}
```

---

## Troubleshooting

### Common Errors and Solutions

#### Error: "Module not found"

**Cause**: Tool file is not in the correct location or has wrong extension.

**Solution**:
```bash
# Verify tool location
ls -la /tools/

# Check file extension (must be .ts or .py)
mv tools/my-tool.js tools/my-tool.ts
```

#### Error: "metadata is not defined"

**Cause**: Tool doesn't export metadata correctly.

**Solution**:
```typescript
// ❌ Wrong
const metadata = { ... };

// ✅ Correct
export const metadata = { ... };
```

#### Error: "handler is not a function"

**Cause**: Handler not exported or exported incorrectly.

**Solution**:
```typescript
// ❌ Wrong
function handler(input) { ... }

// ✅ Correct
export async function handler(input: MyInput): Promise<MyOutput> { ... }
```

#### Error: "ValidationError: Text is required"

**Cause**: Required input parameter is missing.

**Solution**:
```typescript
// Ensure all required fields are provided
const result = await handler({
    text: "Required text here",  // Don't forget required fields
    // optional fields...
});
```

#### Error: "API key not found"

**Cause**: Environment variable not set.

**Solution**:
```bash
# Set environment variable
export MY_API_KEY="your-api-key-here"

# Or add to .env file
echo "MY_API_KEY=your-api-key-here" >> .env
```

#### Error: "Timeout exceeded"

**Cause**: External API call or operation took too long.

**Solution**:
```typescript
// Add timeout handling
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000);

try {
    const response = await fetch(url, { signal: controller.signal });
    // ...
} finally {
    clearTimeout(timeout);
}
```

#### Error: "Rate limit exceeded"

**Cause**: Too many API calls in a short period.

**Solution**:
```typescript
// Implement rate limiting
import { RateLimiter } from 'limiter';

const limiter = new RateLimiter({ tokensPerInterval: 10, interval: 'minute' });

export async function handler(input: MyInput): Promise<MyOutput> {
    await limiter.removeTokens(1);
    // Make API call...
}
```

### Debugging Tips

1. **Enable verbose logging**:
   ```typescript
   console.debug('Input received:', JSON.stringify(input, null, 2));
   ```

2. **Check environment variables**:
   ```bash
   env | grep MY_API
   ```

3. **Test handler in isolation**:
   ```typescript
   import { handler } from './my-tool';
   const result = await handler({ text: 'test' });
   console.log(result);
   ```

4. **Use TypeScript strict mode**:
   ```json
   {
     "compilerOptions": {
       "strict": true
     }
   }
   ```

---

## Next Steps

- [Connector Development Guide](./connector-development.md) - Learn to build connectors
- [Configuration Guide](./configuration.md) - Configure your tools
- [Deployment Guide](./deployment.md) - Deploy to production
- [API Documentation](./api/index.html) - Full API reference
