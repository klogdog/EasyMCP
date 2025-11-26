/**
 * MCP Tool - Text Classifier
 * 
 * A tool that classifies text into categories using keyword matching
 * and pattern analysis. Demonstrates configurable behavior in MCP tools.
 * 
 * @tool classify
 * @description Classify text into categories with confidence scores
 * @example
 * ```typescript
 * import classify from './classify';
 * 
 * // Basic classification with default categories
 * const result = await classify.handler({
 *   text: "I love this product! It's amazing!"
 * });
 * // Result: [{ category: 'positive', confidence: 0.85, matches: ['love', 'amazing'] }]
 * 
 * // With custom categories
 * const custom = await classify.handler({
 *   text: "Please fix this bug ASAP",
 *   categories: ['bug', 'feature', 'question']
 * });
 * ```
 */

/**
 * Tool metadata for MCP discovery
 */
export const metadata = {
    name: 'classify',
    description: 'Classify text into categories with confidence scores',
    schemaVersion: '1.0',
    version: '1.0.0',
    capabilities: ['classify', 'sentiment', 'topic'],
    config: {
        categories: ['positive', 'negative', 'neutral', 'question', 'urgent'],
        confidenceThreshold: 0.3
    }
};

/**
 * Input schema for the classify tool
 */
export interface ClassifyInput {
    /** The text to classify (required) */
    text: string;
    /** Custom categories to use instead of defaults */
    categories?: string[];
    /** Minimum confidence threshold for results (0-1) */
    confidenceThreshold?: number;
}

/**
 * Result for a single category classification
 */
export interface ClassifyResult {
    /** The category name */
    category: string;
    /** Confidence score (0-1) */
    confidence: number;
    /** Keywords/patterns that matched */
    matches: string[];
}

/**
 * Output schema for the classify tool
 */
export interface ClassifyOutput {
    /** Array of classification results, sorted by confidence */
    results: ClassifyResult[];
    /** The highest confidence classification */
    topCategory: string | null;
    /** Total number of categories evaluated */
    categoriesEvaluated: number;
    /** Whether custom categories were used */
    usedCustomCategories: boolean;
}

/**
 * Configuration for the classify tool
 */
export interface ClassifyConfig {
    /** Default categories */
    categories?: string[];
    /** Default confidence threshold */
    confidenceThreshold?: number;
    /** Custom category patterns */
    customPatterns?: Record<string, CategoryPattern>;
}

/**
 * Pattern definition for a category
 */
export interface CategoryPattern {
    /** Keywords that indicate this category */
    keywords: string[];
    /** Regex patterns for advanced matching */
    patterns?: RegExp[];
    /** Weight multiplier for this category */
    weight?: number;
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
 * Default category patterns for classification
 */
const DEFAULT_PATTERNS: Record<string, CategoryPattern> = {
    positive: {
        keywords: [
            'love', 'great', 'amazing', 'excellent', 'wonderful', 'fantastic',
            'awesome', 'good', 'best', 'happy', 'pleased', 'satisfied',
            'perfect', 'brilliant', 'outstanding', 'superb', 'delightful',
            'thank', 'thanks', 'appreciate', 'glad', 'excited', 'enjoy'
        ],
        patterns: [
            /\b(really|very|so|absolutely)\s+(good|great|happy|pleased)\b/i,
            /\blove\s+it\b/i,
            /\bwell\s+done\b/i,
            /\bkeep\s+up\b/i
        ],
        weight: 1.0
    },
    negative: {
        keywords: [
            'hate', 'bad', 'terrible', 'awful', 'horrible', 'worst',
            'disappointed', 'frustrating', 'annoying', 'angry', 'upset',
            'poor', 'fail', 'failed', 'broken', 'useless', 'waste',
            'problem', 'issue', 'wrong', 'error', 'bug', 'crash'
        ],
        patterns: [
            /\b(really|very|so|absolutely)\s+(bad|terrible|awful|disappointed)\b/i,
            /\bdoes(n't|nt|n't)\s+work\b/i,
            /\bnot\s+(working|good|happy|satisfied)\b/i,
            /\bwaste\s+of\s+(time|money)\b/i
        ],
        weight: 1.0
    },
    neutral: {
        keywords: [
            'okay', 'ok', 'fine', 'average', 'normal', 'standard',
            'regular', 'typical', 'moderate', 'acceptable', 'adequate'
        ],
        patterns: [
            /\bit'?s\s+ok(ay)?\b/i,
            /\bnot\s+bad\b/i,
            /\bcould\s+be\s+(better|worse)\b/i
        ],
        weight: 0.8
    },
    question: {
        keywords: [
            'how', 'what', 'when', 'where', 'why', 'who', 'which',
            'can', 'could', 'would', 'should', 'does', 'is', 'are',
            'help', 'please', 'explain', 'wondering', 'curious'
        ],
        patterns: [
            /\?$/,
            /\bcan\s+(you|i|we)\b/i,
            /\bhow\s+(do|does|can|to)\b/i,
            /\bwhat\s+(is|are|does|do)\b/i,
            /\bis\s+(there|this|it)\b/i
        ],
        weight: 1.0
    },
    urgent: {
        keywords: [
            'urgent', 'asap', 'immediately', 'emergency', 'critical',
            'now', 'quickly', 'fast', 'hurry', 'priority', 'important',
            'deadline', 'rush', 'time-sensitive', 'pressing'
        ],
        patterns: [
            /\basap\b/i,
            /\bright\s+now\b/i,
            /\bas\s+soon\s+as\s+possible\b/i,
            /\bimmediately\b/i,
            /!{2,}/
        ],
        weight: 1.2
    },
    // Additional categories for common use cases
    bug: {
        keywords: [
            'bug', 'error', 'crash', 'broken', 'fix', 'issue',
            'problem', 'fails', 'exception', 'fault', 'defect'
        ],
        patterns: [
            /\bdoes(n't|nt)\s+work\b/i,
            /\bnot\s+working\b/i,
            /\bstops?\s+(working|responding)\b/i
        ],
        weight: 1.0
    },
    feature: {
        keywords: [
            'feature', 'request', 'suggestion', 'idea', 'propose',
            'add', 'implement', 'enhance', 'improve', 'want', 'need',
            'would be nice', 'should have', 'could add'
        ],
        patterns: [
            /\bwould\s+be\s+(nice|great|helpful)\b/i,
            /\bshould\s+(have|add|include)\b/i,
            /\bcan\s+you\s+add\b/i,
            /\bplease\s+add\b/i
        ],
        weight: 1.0
    },
    spam: {
        keywords: [
            'free', 'winner', 'prize', 'click', 'subscribe', 'offer',
            'limited', 'act now', 'exclusive', 'congratulations'
        ],
        patterns: [
            /\bclick\s+here\b/i,
            /\bact\s+now\b/i,
            /\blimited\s+(time|offer)\b/i,
            /\$\d+/,
            /\d+%\s+off\b/i
        ],
        weight: 0.9
    }
};

/**
 * Validates the input parameters for the classify function
 * 
 * @param input - The input to validate
 * @throws ValidationError if input is invalid
 */
function validateInput(input: ClassifyInput): void {
    if (!input.text || typeof input.text !== 'string') {
        throw new ValidationError('Text is required and must be a non-empty string');
    }

    if (input.text.trim().length === 0) {
        throw new ValidationError('Text cannot be empty or whitespace only');
    }

    if (input.categories !== undefined) {
        if (!Array.isArray(input.categories)) {
            throw new ValidationError('Categories must be an array of strings');
        }
        if (input.categories.length === 0) {
            throw new ValidationError('Categories array cannot be empty');
        }
        for (const cat of input.categories) {
            if (typeof cat !== 'string' || cat.trim().length === 0) {
                throw new ValidationError('Each category must be a non-empty string');
            }
        }
    }

    if (input.confidenceThreshold !== undefined) {
        if (typeof input.confidenceThreshold !== 'number') {
            throw new ValidationError('Confidence threshold must be a number');
        }
        if (input.confidenceThreshold < 0 || input.confidenceThreshold > 1) {
            throw new ValidationError('Confidence threshold must be between 0 and 1');
        }
    }
}

/**
 * Calculates the confidence score for a category based on text analysis
 * 
 * @param text - The text to analyze
 * @param pattern - The category pattern to match against
 * @returns Object with confidence score and matched terms
 */
function calculateCategoryScore(
    text: string,
    pattern: CategoryPattern
): { score: number; matches: string[] } {
    const lowerText = text.toLowerCase();
    const matches: string[] = [];
    let score = 0;

    // Check keywords
    for (const keyword of pattern.keywords) {
        const keywordLower = keyword.toLowerCase();
        const regex = new RegExp(`\\b${keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        const keywordMatches = text.match(regex);
        if (keywordMatches) {
            score += keywordMatches.length;
            if (!matches.includes(keyword)) {
                matches.push(keyword);
            }
        }
    }

    // Check patterns
    if (pattern.patterns) {
        for (const regex of pattern.patterns) {
            const patternMatches = text.match(regex);
            if (patternMatches) {
                score += patternMatches.length * 1.5; // Patterns get higher weight
                for (const match of patternMatches) {
                    if (!matches.includes(match)) {
                        matches.push(match);
                    }
                }
            }
        }
    }

    // Apply weight
    const weight = pattern.weight ?? 1.0;
    score *= weight;

    // Normalize score based on text length (words)
    const wordCount = text.split(/\s+/).length;
    const normalizedScore = Math.min(1.0, score / Math.max(1, wordCount * 0.3));

    return { score: normalizedScore, matches };
}

/**
 * Creates a simple pattern for a custom category without predefined patterns
 * 
 * @param category - The category name
 * @returns A basic CategoryPattern
 */
function createSimplePattern(category: string): CategoryPattern {
    // Use the category name itself as a keyword, plus common variations
    const baseKeyword = category.toLowerCase();
    return {
        keywords: [
            baseKeyword,
            `${baseKeyword}s`,  // Plural
            `${baseKeyword}ing`,  // Gerund
            `${baseKeyword}ed`  // Past tense
        ],
        patterns: [
            new RegExp(`\\b${baseKeyword}\\b`, 'i')
        ],
        weight: 1.0
    };
}

/**
 * Global configuration for the classify tool
 */
let globalConfig: ClassifyConfig = {
    categories: metadata.config.categories,
    confidenceThreshold: metadata.config.confidenceThreshold
};

/**
 * Sets the configuration for the classify tool
 * 
 * @param config - The configuration to set
 */
export function setConfig(config: ClassifyConfig): void {
    globalConfig = { ...globalConfig, ...config };
}

/**
 * Gets the current configuration
 * 
 * @returns The current configuration
 */
export function getConfig(): ClassifyConfig {
    return { ...globalConfig };
}

/**
 * Gets the available default categories
 * 
 * @returns Array of default category names
 */
export function getDefaultCategories(): string[] {
    return Object.keys(DEFAULT_PATTERNS);
}

/**
 * Classifies text into categories with confidence scores
 * 
 * This function analyzes the input text and returns classification results
 * for each configured category, sorted by confidence score.
 * 
 * @tool classify
 * @param input - The classification parameters
 * @param input.text - The text to classify (required)
 * @param input.categories - Custom categories to use (optional)
 * @param input.confidenceThreshold - Minimum confidence for results (optional)
 * @param config - Optional configuration override
 * @returns Classification results with confidence scores
 * @throws ValidationError if input is invalid
 * 
 * @example
 * ```typescript
 * // Sentiment classification
 * const sentiment = await classify({
 *   text: "I absolutely love this product!"
 * });
 * console.log(sentiment.topCategory);  // "positive"
 * 
 * // Topic classification
 * const topic = await classify({
 *   text: "The login button crashes the app",
 *   categories: ['bug', 'feature', 'question']
 * });
 * console.log(topic.topCategory);  // "bug"
 * 
 * // Intent detection
 * const intent = await classify({
 *   text: "How do I reset my password?",
 *   categories: ['question', 'complaint', 'feedback']
 * });
 * ```
 */
export async function classify(
    input: ClassifyInput,
    config?: ClassifyConfig
): Promise<ClassifyOutput> {
    // Validate input
    validateInput(input);

    // Merge configs
    const effectiveConfig = { ...globalConfig, ...config };

    // Determine which categories to use
    const useCustomCategories = !!input.categories;
    const categories = input.categories || effectiveConfig.categories || metadata.config.categories;
    const threshold = input.confidenceThreshold ?? effectiveConfig.confidenceThreshold ?? 0.3;

    // Calculate scores for each category
    const results: ClassifyResult[] = [];

    for (const category of categories) {
        // Get pattern for this category
        let pattern: CategoryPattern;

        if (DEFAULT_PATTERNS[category]) {
            pattern = DEFAULT_PATTERNS[category];
        } else if (effectiveConfig.customPatterns?.[category]) {
            pattern = effectiveConfig.customPatterns[category];
        } else {
            // Create simple pattern for unknown custom categories
            pattern = createSimplePattern(category);
        }

        // Calculate score
        const { score, matches } = calculateCategoryScore(input.text, pattern);

        // Only include if above threshold
        if (score >= threshold || matches.length > 0) {
            results.push({
                category,
                confidence: score,
                matches
            });
        }
    }

    // Sort by confidence (descending)
    results.sort((a, b) => b.confidence - a.confidence);

    // Determine top category
    const topCategory = results.length > 0 ? results[0].category : null;

    return {
        results,
        topCategory,
        categoriesEvaluated: categories.length,
        usedCustomCategories: useCustomCategories
    };
}

/**
 * Default export for MCP tool discovery
 */
export default {
    metadata,
    handler: classify
};
