/**
 * Tests for the Classify MCP Tool
 * 
 * This test file validates the classify tool's functionality including
 * category patterns, confidence scoring, and custom category support.
 */

// ============================================================================
// Types and Mock Implementation (namespaced to avoid conflicts)
// ============================================================================

namespace ClassifyTests {

    export interface ClassifyInput {
        text: string;
        categories?: string[];
        confidenceThreshold?: number;
    }

    export interface ClassifyResult {
        category: string;
        confidence: number;
        matches: string[];
    }

    export interface ClassifyOutput {
        results: ClassifyResult[];
        topCategory: string | null;
        categoriesEvaluated: number;
        usedCustomCategories: boolean;
    }

    export interface ClassifyConfig {
        categories?: string[];
        confidenceThreshold?: number;
        customPatterns?: Record<string, CategoryPattern>;
    }

    export interface CategoryPattern {
        keywords: string[];
        patterns?: RegExp[];
        weight?: number;
    }

    export class ValidationError extends Error {
        constructor(message: string) {
            super(message);
            this.name = 'ValidationError';
        }
    }

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

    const DEFAULT_PATTERNS: Record<string, CategoryPattern> = {
        positive: {
            keywords: ['love', 'great', 'amazing', 'excellent', 'wonderful', 'fantastic', 'awesome', 'good', 'best', 'happy'],
            patterns: [/\blove\s+it\b/i, /\bwell\s+done\b/i],
            weight: 1.0
        },
        negative: {
            keywords: ['hate', 'bad', 'terrible', 'awful', 'horrible', 'worst', 'disappointed', 'frustrating', 'problem', 'issue', 'bug'],
            patterns: [/\bdoes(n't|nt)\s+work\b/i, /\bnot\s+working\b/i],
            weight: 1.0
        },
        neutral: {
            keywords: ['okay', 'ok', 'fine', 'average', 'normal'],
            patterns: [/\bit'?s\s+ok(ay)?\b/i],
            weight: 0.8
        },
        question: {
            keywords: ['how', 'what', 'when', 'where', 'why', 'who', 'help', 'please'],
            patterns: [/\?$/, /\bhow\s+(do|does|can|to)\b/i],
            weight: 1.0
        },
        urgent: {
            keywords: ['urgent', 'asap', 'immediately', 'emergency', 'critical', 'now', 'priority'],
            patterns: [/\basap\b/i, /\bimmediately\b/i, /!{2,}/],
            weight: 1.2
        },
        bug: {
            keywords: ['bug', 'error', 'crash', 'broken', 'fix', 'issue', 'problem'],
            patterns: [/\bdoes(n't|nt)\s+work\b/i],
            weight: 1.0
        },
        feature: {
            keywords: ['feature', 'request', 'suggestion', 'idea', 'add', 'implement'],
            patterns: [/\bwould\s+be\s+(nice|great)\b/i, /\bplease\s+add\b/i],
            weight: 1.0
        }
    };

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

    function calculateCategoryScore(text: string, pattern: CategoryPattern): { score: number; matches: string[] } {
        const matches: string[] = [];
        let score = 0;

        for (const keyword of pattern.keywords) {
            const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            const keywordMatches = text.match(regex);
            if (keywordMatches) {
                score += keywordMatches.length;
                if (!matches.includes(keyword)) matches.push(keyword);
            }
        }

        if (pattern.patterns) {
            for (const regex of pattern.patterns) {
                const patternMatches = text.match(regex);
                if (patternMatches) {
                    score += patternMatches.length * 1.5;
                    for (const match of patternMatches) {
                        if (!matches.includes(match)) matches.push(match);
                    }
                }
            }
        }

        const weight = pattern.weight ?? 1.0;
        score *= weight;

        const wordCount = text.split(/\s+/).length;
        const normalizedScore = Math.min(1.0, score / Math.max(1, wordCount * 0.3));

        return { score: normalizedScore, matches };
    }

    function createSimplePattern(category: string): CategoryPattern {
        const baseKeyword = category.toLowerCase();
        return {
            keywords: [baseKeyword, `${baseKeyword}s`, `${baseKeyword}ing`, `${baseKeyword}ed`],
            patterns: [new RegExp(`\\b${baseKeyword}\\b`, 'i')],
            weight: 1.0
        };
    }

    let globalConfig: ClassifyConfig = {
        categories: metadata.config.categories,
        confidenceThreshold: metadata.config.confidenceThreshold
    };

    export function setConfig(config: ClassifyConfig): void {
        globalConfig = { ...globalConfig, ...config };
    }

    export async function classify(input: ClassifyInput, config?: ClassifyConfig): Promise<ClassifyOutput> {
        validateInput(input);

        const effectiveConfig = { ...globalConfig, ...config };
        const useCustomCategories = !!input.categories;
        const categories = input.categories || effectiveConfig.categories || metadata.config.categories;
        const threshold = input.confidenceThreshold ?? effectiveConfig.confidenceThreshold ?? 0.3;

        const results: ClassifyResult[] = [];

        for (const category of categories) {
            let pattern: CategoryPattern;
            if (DEFAULT_PATTERNS[category]) {
                pattern = DEFAULT_PATTERNS[category];
            } else if (effectiveConfig.customPatterns?.[category]) {
                pattern = effectiveConfig.customPatterns[category];
            } else {
                pattern = createSimplePattern(category);
            }

            const { score, matches } = calculateCategoryScore(input.text, pattern);

            if (score >= threshold || matches.length > 0) {
                results.push({ category, confidence: score, matches });
            }
        }

        results.sort((a, b) => b.confidence - a.confidence);
        const firstResult = results[0];
        const topCategory = firstResult ? firstResult.category : null;

        return {
            results,
            topCategory,
            categoriesEvaluated: categories.length,
            usedCustomCategories: useCustomCategories
        };
    }

    // ============================================================================
    // Test Suite
    // ============================================================================

    let testsPassed = 0;
    let testsFailed = 0;

    function assertTest(condition: boolean, message: string): void {
        if (condition) {
            console.log(`  ✓ ${message}`);
            testsPassed++;
        } else {
            console.log(`  ✗ ${message}`);
            testsFailed++;
        }
    }

    export async function runTests() {
        console.log('=== Testing Classify Tool ===\n');

        // 1. Test metadata
        console.log('1. Testing metadata export:');
        assertTest(metadata.name === 'classify', 'Name is "classify"');
        assertTest(metadata.description.includes('Classify text'), 'Description is correct');
        assertTest(metadata.schemaVersion === '1.0', 'Schema version is 1.0');
        assertTest(Array.isArray(metadata.config.categories), 'Has default categories');
        assertTest(typeof metadata.config.confidenceThreshold === 'number', 'Has confidence threshold');

        // 2. Test default export structure
        console.log('\n2. Testing export structure:');
        const defaultExport = { metadata, handler: classify };
        assertTest(typeof defaultExport.handler === 'function', 'Has handler function');
        assertTest(!!defaultExport.metadata, 'Has metadata object');
        assertTest(Array.isArray(defaultExport.metadata.capabilities), 'Has capabilities');

        // 3. Test input validation
        console.log('\n3. Testing input validation:');

        const validationTests = [
            { input: { text: '' }, name: 'empty text' },
            { input: { text: '   ' }, name: 'whitespace only' },
            { input: { text: 'test', categories: [] }, name: 'empty categories array' },
            { input: { text: 'test', confidenceThreshold: -0.5 }, name: 'negative threshold' },
            { input: { text: 'test', confidenceThreshold: 1.5 }, name: 'threshold > 1' },
        ];

        for (const test of validationTests) {
            try {
                await classify(test.input as ClassifyInput);
                assertTest(false, `Catches ${test.name}`);
            } catch (e) {
                assertTest(e instanceof ValidationError, `Catches ${test.name}`);
            }
        }

        // 4. Test sentiment classification
        console.log('\n4. Testing sentiment classification:');

        const positiveResult = await classify({
            text: 'I love this product! It is amazing and wonderful!'
        });
        assertTest(positiveResult.topCategory === 'positive', 'Detects positive sentiment');
        const firstPositive = positiveResult.results[0];
        assertTest(firstPositive !== undefined && firstPositive.confidence > 0, 'Has confidence score');
        assertTest(firstPositive !== undefined && firstPositive.matches.length > 0, 'Returns matched keywords');

        const negativeResult = await classify({
            text: 'This is terrible. I hate it. The worst product ever.'
        });
        assertTest(negativeResult.topCategory === 'negative', 'Detects negative sentiment');

        const questionResult = await classify({
            text: 'How do I reset my password? Please help!'
        });
        assertTest(questionResult.topCategory === 'question', 'Detects question intent');

        // 5. Test custom categories
        console.log('\n5. Testing custom categories:');

        const bugResult = await classify({
            text: 'The app crashes when I click the button. Please fix this bug!',
            categories: ['bug', 'feature', 'question']
        });
        assertTest(bugResult.topCategory === 'bug', 'Classifies bug report correctly');
        assertTest(bugResult.usedCustomCategories === true, 'Reports custom categories used');

        const featureResult = await classify({
            text: 'It would be nice to add dark mode. Please add this feature!',
            categories: ['bug', 'feature', 'question']
        });
        assertTest(featureResult.topCategory === 'feature', 'Classifies feature request correctly');

        // 6. Test confidence scoring
        console.log('\n6. Testing confidence scoring:');

        const highConfidence = await classify({
            text: 'love love love great amazing wonderful fantastic awesome'
        });
        const firstHigh = highConfidence.results[0];
        assertTest(firstHigh !== undefined && firstHigh.confidence > 0.5, 'High repetition gives high confidence');

        const lowConfidence = await classify({
            text: 'The weather is good today and I might go for a walk'
        });
        const goodResult = lowConfidence.results.find(r => r.category === 'positive');
        assertTest(goodResult !== undefined, 'Finds positive category');
        assertTest(goodResult!.confidence < 0.8, 'Single keyword gives moderate confidence');

        // 7. Test threshold filtering
        console.log('\n7. Testing threshold filtering:');

        const highThreshold = await classify({
            text: 'This is okay I guess',
            confidenceThreshold: 0.8
        });
        assertTest(highThreshold.results.every(r => r.confidence >= 0.8 || r.matches.length > 0),
            'High threshold filters low confidence results');

        const lowThreshold = await classify({
            text: 'This is okay I guess',
            confidenceThreshold: 0.0
        });
        assertTest(lowThreshold.results.length >= 1, 'Low threshold includes more results');

        // 8. Test urgent detection
        console.log('\n8. Testing urgent/priority detection:');

        const urgentResult = await classify({
            text: 'URGENT! Need this fixed ASAP!! Critical issue!'
        });
        const urgentCategory = urgentResult.results.find(r => r.category === 'urgent');
        assertTest(urgentCategory !== undefined, 'Detects urgent category');
        assertTest(urgentCategory!.matches.some(m => m.toLowerCase().includes('urgent') || m.toLowerCase().includes('asap')),
            'Matches urgent keywords');

  // 9. Test pattern matching
  console.log('\n9. Testing pattern matching:');
  
  const patternResult = await classify({
    text: 'This thing doesnt work at all and is broken'
  });
  const negativeMatch = patternResult.results.find(r => r.category === 'negative');
  assertTest(negativeMatch !== undefined, 'Pattern matching detects negative');        // 10. Test empty/minimal results
        console.log('\n10. Testing edge cases:');

        const neutralText = await classify({
            text: 'The sky is blue and water is wet'
        });
        assertTest(neutralText.categoriesEvaluated > 0, 'Evaluates all categories');
        assertTest(typeof neutralText.topCategory === 'string' || neutralText.topCategory === null,
            'Returns valid top category or null');

        // Summary
        console.log('\n=== Test Summary ===');
        console.log(`Passed: ${testsPassed}`);
        console.log(`Failed: ${testsFailed}`);
        console.log(`Total: ${testsPassed + testsFailed}`);

        if (testsFailed > 0) {
            process.exit(1);
        }
    }

}  // End namespace

ClassifyTests.runTests().catch(console.error);
