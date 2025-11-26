/**
 * MCP Tool - Text Summarizer
 * 
 * A tool that summarizes text to a specified length using sentence extraction.
 * Demonstrates basic MCP tool structure with validation and documentation.
 * 
 * @tool summarize
 * @description Summarize text to specified length
 * @example
 * ```typescript
 * import summarize from './summarize';
 * 
 * // Basic usage
 * const result = await summarize.handler({
 *   text: "Long text to summarize...",
 *   maxLength: 100
 * });
 * 
 * // With bullet style
 * const bullets = await summarize.handler({
 *   text: "Long text...",
 *   style: 'bullet'
 * });
 * ```
 */

/**
 * Tool metadata for MCP discovery
 */
export const metadata = {
    name: 'summarize',
    description: 'Summarize text to specified length',
    schemaVersion: '1.0',
    version: '1.0.0',
    capabilities: ['summarize', 'extract']
};

/**
 * Input schema for the summarize tool
 */
export interface SummarizeInput {
    /** The text to summarize (required) */
    text: string;
    /** Maximum length of the summary in characters (default: 100) */
    maxLength?: number;
    /** Output format style (default: 'paragraph') */
    style?: 'bullet' | 'paragraph';
}

/**
 * Validation error class for input validation
 */
export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

/**
 * Validates the input parameters for the summarize function
 * 
 * @param input - The input to validate
 * @throws ValidationError if input is invalid
 */
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

/**
 * Splits text into sentences using common sentence terminators
 * 
 * @param text - The text to split into sentences
 * @returns Array of sentences
 */
function splitIntoSentences(text: string): string[] {
    // Split on sentence terminators, keeping the terminator
    const sentences = text
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);

    return sentences;
}

/**
 * Scores a sentence based on its importance
 * Uses word count, position, and keyword presence
 * 
 * @param sentence - The sentence to score
 * @param index - Position in the original text
 * @param totalSentences - Total number of sentences
 * @returns Score between 0 and 1
 */
function scoreSentence(sentence: string, index: number, totalSentences: number): number {
    let score = 0;

    // Position scoring: first and last sentences are often important
    if (index === 0) score += 0.3;
    if (index === totalSentences - 1) score += 0.1;

    // Length scoring: medium-length sentences are often more informative
    const wordCount = sentence.split(/\s+/).length;
    if (wordCount >= 5 && wordCount <= 20) {
        score += 0.2;
    } else if (wordCount > 20) {
        score += 0.1;
    }

    // Keyword scoring: sentences with key indicators
    const importantPatterns = [
        /\b(important|key|main|significant|essential|primary|critical)\b/i,
        /\b(therefore|thus|consequently|hence|as a result)\b/i,
        /\b(in conclusion|to summarize|overall|in summary)\b/i,
        /\b(first|second|third|finally|lastly)\b/i
    ];

    for (const pattern of importantPatterns) {
        if (pattern.test(sentence)) {
            score += 0.15;
            break;
        }
    }

    // Presence of numbers often indicates factual content
    if (/\d+/.test(sentence)) {
        score += 0.1;
    }

    // Normalize score to 0-1 range
    return Math.min(1, score);
}

/**
 * Extracts the most important sentences up to the specified length
 * 
 * @param sentences - Array of sentences with scores
 * @param maxLength - Maximum length of output
 * @returns Array of selected sentences in original order
 */
function extractKeySentences(
    sentences: Array<{ text: string; score: number; index: number }>,
    maxLength: number
): string[] {
    // Sort by score descending
    const sorted = [...sentences].sort((a, b) => b.score - a.score);

    const selected: Array<{ text: string; index: number }> = [];
    let currentLength = 0;

    for (const sentence of sorted) {
        const sentenceLength = sentence.text.length;

        // Always include at least one sentence
        if (selected.length === 0) {
            selected.push({ text: sentence.text, index: sentence.index });
            currentLength += sentenceLength;
            continue;
        }

        // Check if adding this sentence would exceed maxLength
        if (currentLength + sentenceLength + 1 <= maxLength) {
            selected.push({ text: sentence.text, index: sentence.index });
            currentLength += sentenceLength + 1; // +1 for space
        }
    }

    // Sort by original index to maintain text flow
    selected.sort((a, b) => a.index - b.index);

    return selected.map(s => s.text);
}

/**
 * Formats sentences in bullet style
 * 
 * @param sentences - Array of sentences to format
 * @returns Bullet-formatted string
 */
function formatAsBullets(sentences: string[]): string {
    return sentences.map(s => `• ${s}`).join('\n');
}

/**
 * Formats sentences as a paragraph
 * 
 * @param sentences - Array of sentences to format
 * @returns Paragraph-formatted string
 */
function formatAsParagraph(sentences: string[]): string {
    return sentences.join(' ');
}

/**
 * Summarizes text to a specified length
 * 
 * This function analyzes the input text, scores sentences by importance,
 * and extracts the most relevant sentences up to the specified length.
 * 
 * @tool summarize
 * @param input - The summarization parameters
 * @param input.text - The text to summarize (required)
 * @param input.maxLength - Maximum length of summary in characters (default: 100)
 * @param input.style - Output format: 'bullet' or 'paragraph' (default: 'paragraph')
 * @returns The summarized text
 * @throws ValidationError if input is invalid
 * 
 * @example
 * ```typescript
 * // Summarize to 100 characters
 * const summary = await summarize({
 *   text: "Long article text here...",
 *   maxLength: 100
 * });
 * 
 * // Get bullet points
 * const bullets = await summarize({
 *   text: "Long article text here...",
 *   style: 'bullet',
 *   maxLength: 200
 * });
 * ```
 */
export async function summarize(input: SummarizeInput): Promise<string> {
    // Validate input
    validateInput(input);

    // Set defaults
    const maxLength = input.maxLength ?? 100;
    const style = input.style ?? 'paragraph';

    // Split text into sentences
    const sentences = splitIntoSentences(input.text);

    // If text is already short enough, return it
    if (input.text.length <= maxLength) {
        if (style === 'bullet' && sentences.length > 1) {
            return formatAsBullets(sentences);
        }
        return input.text;
    }

    // Score each sentence
    const scoredSentences = sentences.map((text, index) => ({
        text,
        score: scoreSentence(text, index, sentences.length),
        index
    }));

    // Extract key sentences
    const keySentences = extractKeySentences(scoredSentences, maxLength);

    // Format output
    if (style === 'bullet') {
        return formatAsBullets(keySentences);
    }

    return formatAsParagraph(keySentences);
}

/**
 * Default export for MCP tool discovery
 */
export default {
    metadata,
    handler: summarize
};
