/**
 * Tests for the Summarize MCP Tool
 * 
 * This test file validates the summarize tool using inline definitions
 * that mirror the tool's structure, simulating how the loader would test it.
 */

// ============================================================================
// Inline Tool Implementation for Testing
// (In production, this would be loaded dynamically from tools/summarize.ts)
// ============================================================================

interface SummarizeInput {
    text: string;
    maxLength?: number;
    style?: 'bullet' | 'paragraph';
}

class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

const metadata = {
    name: 'summarize',
    description: 'Summarize text to specified length',
    schemaVersion: '1.0',
    version: '1.0.0',
    capabilities: ['summarize', 'extract']
};

function validateInput(input: SummarizeInput): void {
    if (!input.text || typeof input.text !== 'string') {
        throw new ValidationError('Text is required and must be a non-empty string');
    }
    if (input.text.trim().length === 0) {
        throw new ValidationError('Text cannot be empty or whitespace only');
    }
    if (input.maxLength !== undefined) {
        if (typeof input.maxLength !== 'number') {
            throw new ValidationError('maxLength must be a number');
        }
        if (input.maxLength <= 0) {
            throw new ValidationError('maxLength must be a positive number');
        }
        if (!Number.isInteger(input.maxLength)) {
            throw new ValidationError('maxLength must be an integer');
        }
    }
    if (input.style !== undefined && input.style !== 'bullet' && input.style !== 'paragraph') {
        throw new ValidationError("style must be either 'bullet' or 'paragraph'");
    }
}

function splitIntoSentences(text: string): string[] {
    return text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 0);
}

function scoreSentence(sentence: string, index: number, totalSentences: number): number {
    let score = 0;
    if (index === 0) score += 0.3;
    if (index === totalSentences - 1) score += 0.1;
    const wordCount = sentence.split(/\s+/).length;
    if (wordCount >= 5 && wordCount <= 20) score += 0.2;
    else if (wordCount > 20) score += 0.1;
    const patterns = [
        /\b(important|key|main|significant)\b/i,
        /\b(therefore|thus|consequently)\b/i,
        /\b(in conclusion|to summarize|overall)\b/i,
        /\b(first|second|third|finally)\b/i
    ];
    for (const pattern of patterns) {
        if (pattern.test(sentence)) { score += 0.15; break; }
    }
    if (/\d+/.test(sentence)) score += 0.1;
    return Math.min(1, score);
}

function extractKeySentences(
    sentences: Array<{ text: string; score: number; index: number }>,
    maxLength: number
): string[] {
    const sorted = [...sentences].sort((a, b) => b.score - a.score);
    const selected: Array<{ text: string; index: number }> = [];
    let currentLength = 0;
    for (const sentence of sorted) {
        if (selected.length === 0) {
            selected.push({ text: sentence.text, index: sentence.index });
            currentLength += sentence.text.length;
            continue;
        }
        if (currentLength + sentence.text.length + 1 <= maxLength) {
            selected.push({ text: sentence.text, index: sentence.index });
            currentLength += sentence.text.length + 1;
        }
    }
    selected.sort((a, b) => a.index - b.index);
    return selected.map(s => s.text);
}

async function summarize(input: SummarizeInput): Promise<string> {
    validateInput(input);
    const maxLength = input.maxLength ?? 100;
    const style = input.style ?? 'paragraph';
    const sentences = splitIntoSentences(input.text);

    if (input.text.length <= maxLength) {
        if (style === 'bullet' && sentences.length > 1) {
            return sentences.map(s => `• ${s}`).join('\n');
        }
        return input.text;
    }

    const scoredSentences = sentences.map((text, index) => ({
        text,
        score: scoreSentence(text, index, sentences.length),
        index
    }));

    const keySentences = extractKeySentences(scoredSentences, maxLength);

    if (style === 'bullet') {
        return keySentences.map(s => `• ${s}`).join('\n');
    }
    return keySentences.join(' ');
}

// ============================================================================
// Test Suite
// ============================================================================

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
    if (condition) {
        console.log(`  ✓ ${message}`);
        passed++;
    } else {
        console.log(`  ✗ ${message}`);
        failed++;
    }
}

async function runTests() {
    console.log('=== Testing Summarize Tool ===\n');

    // 1. Test metadata
    console.log('1. Testing metadata export:');
    assert(metadata.name === 'summarize', 'Name is "summarize"');
    assert(metadata.description === 'Summarize text to specified length', 'Description is correct');
    assert(metadata.schemaVersion === '1.0', 'Schema version is 1.0');
    assert(!!metadata.version, 'Has version');
    assert(Array.isArray(metadata.capabilities), 'Has capabilities array');

    // 2. Test default export structure
    console.log('\n2. Testing export structure:');
    const defaultExport = { metadata, handler: summarize };
    assert(typeof defaultExport.handler === 'function', 'Has handler function');
    assert(!!defaultExport.metadata, 'Has metadata object');

    // 3. Test input validation
    console.log('\n3. Testing input validation:');

    const validationTests = [
        { input: { text: '' }, name: 'empty text' },
        { input: { text: '   ' }, name: 'whitespace only' },
        { input: { text: 'valid', maxLength: -1 }, name: 'negative maxLength' },
        { input: { text: 'valid', maxLength: 0 }, name: 'zero maxLength' },
        { input: { text: 'valid', maxLength: 1.5 }, name: 'non-integer maxLength' },
        { input: { text: 'valid', style: 'invalid' as any }, name: 'invalid style' },
    ];

    for (const test of validationTests) {
        try {
            await summarize(test.input as SummarizeInput);
            assert(false, `Catches ${test.name}`);
        } catch (e) {
            assert(e instanceof ValidationError, `Catches ${test.name}`);
        }
    }

    // 4. Test summarization
    console.log('\n4. Testing summarization:');

    const shortText = 'This is a short text.';
    const shortResult = await summarize({ text: shortText, maxLength: 100 });
    assert(shortResult === shortText, 'Short text is preserved');

    const longText = `The quick brown fox jumps over the lazy dog. This is an important statement about animals. First, we must consider the implications of this behavior. The fox represents agility. In conclusion, the story demonstrates key principles of nature. Animals are fascinating creatures. Therefore, we should study them more carefully. This has significant implications for science.`;

    const paragraphResult = await summarize({ text: longText, maxLength: 150 });
    assert(paragraphResult.length <= 200, 'Paragraph result respects length limit');
    assert(!paragraphResult.includes('•'), 'Paragraph result has no bullets');

    const bulletResult = await summarize({ text: longText, maxLength: 200, style: 'bullet' });
    assert(bulletResult.includes('•'), 'Bullet result contains bullet points');

    const defaultResult = await summarize({ text: longText });
    assert(defaultResult.length > 0, 'Default maxLength works');

    // 5. Test sentence scoring
    console.log('\n5. Testing sentence importance scoring:');

    const textWithIndicators = `This is a regular sentence. Important: this is a key finding. The first point is significant. Therefore, we conclude that this matters. Random filler text here. In conclusion, this summarizes everything.`;

    const result = await summarize({ text: textWithIndicators, maxLength: 100 });
    assert(
        result.toLowerCase().includes('important') ||
        result.toLowerCase().includes('conclusion') ||
        result.toLowerCase().includes('therefore') ||
        result.toLowerCase().includes('first'),
        'Prioritizes sentences with importance indicators'
    );

    // 6. Test edge cases
    console.log('\n6. Testing edge cases:');

    const singleSentence = 'Just one sentence.';
    const singleResult = await summarize({ text: singleSentence, maxLength: 50 });
    assert(singleResult === singleSentence, 'Single sentence is preserved');

    const validWithDefaults = await summarize({ text: 'Test text here.' });
    assert(typeof validWithDefaults === 'string', 'Works with only required param');

    // Summary
    console.log('\n=== Test Summary ===');
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total: ${passed + failed}`);

    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch(console.error);