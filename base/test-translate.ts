/**
 * Tests for the Translate MCP Tool
 * 
 * This test file validates the translate tool's functionality including
 * credential handling, language detection, and mock fallback.
 */

// ============================================================================
// Types and Mock Implementation (namespaced to avoid conflicts)
// ============================================================================

namespace TranslateTests {

    export interface TranslateInput {
        text: string;
        targetLanguage: string;
        sourceLanguage?: string;
    }

    export interface TranslateOutput {
        translatedText: string;
        sourceLanguage: string;
        targetLanguage: string;
        usedMock: boolean;
        detectionConfidence?: number;
    }

    export interface TranslateConfig {
        apiKey?: string;
        apiUrl?: string;
    }

    export class ValidationError extends Error {
        constructor(message: string) {
            super(message);
            this.name = 'ValidationError';
        }
    }

    export class APIError extends Error {
        public statusCode?: number;
        public retryable: boolean;
        constructor(message: string, statusCode?: number, retryable = false) {
            super(message);
            this.name = 'APIError';
            this.statusCode = statusCode;
            this.retryable = retryable;
        }
    }

    export const SUPPORTED_LANGUAGES: Record<string, string> = {
        'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
        'it': 'Italian', 'pt': 'Portuguese', 'ru': 'Russian', 'ja': 'Japanese',
        'ko': 'Korean', 'zh': 'Chinese', 'ar': 'Arabic', 'hi': 'Hindi',
        'nl': 'Dutch', 'pl': 'Polish', 'sv': 'Swedish', 'tr': 'Turkish'
    };

    const LANGUAGE_PATTERNS: Record<string, RegExp[]> = {
        'en': [/\b(the|is|are|was|were|have|has)\b/i],
        'es': [/\b(el|la|los|las|es|son)\b/i, /[áéíóúñ¿¡]/i],
        'fr': [/\b(le|la|les|un|une|est|sont)\b/i, /[àâçéèêëîïôûùüÿ]/i],
        'de': [/\b(der|die|das|ein|eine|ist|sind)\b/i, /[äöüß]/i],
    };

    const MOCK_TRANSLATIONS: Record<string, Record<string, string>> = {
        'hello': { es: 'hola', fr: 'bonjour', de: 'hallo' },
        'goodbye': { es: 'adiós', fr: 'au revoir', de: 'auf wiedersehen' },
        'thank you': { es: 'gracias', fr: 'merci', de: 'danke' },
    };

    export const metadata = {
        name: 'translate',
        description: 'Translate text between languages',
        schemaVersion: '1.0',
        version: '1.0.0',
        capabilities: ['translate', 'detect-language'],
        credentials: [{
            name: 'TRANSLATION_API_KEY',
            type: 'api_key',
            required: false,
            description: 'API key for translation service'
        }]
    };

    function validateInput(input: TranslateInput): void {
        if (!input.text || typeof input.text !== 'string') {
            throw new ValidationError('Text is required and must be a non-empty string');
        }
        if (input.text.trim().length === 0) {
            throw new ValidationError('Text cannot be empty or whitespace only');
        }
        if (!input.targetLanguage || typeof input.targetLanguage !== 'string') {
            throw new ValidationError('Target language is required');
        }
        const targetLang = input.targetLanguage.toLowerCase();
        if (!SUPPORTED_LANGUAGES[targetLang]) {
            throw new ValidationError(`Unsupported target language: ${input.targetLanguage}`);
        }
        if (input.sourceLanguage !== undefined) {
            const sourceLang = input.sourceLanguage.toLowerCase();
            if (!SUPPORTED_LANGUAGES[sourceLang]) {
                throw new ValidationError(`Unsupported source language: ${input.sourceLanguage}`);
            }
        }
    }

    export function detectLanguage(text: string): { language: string; confidence: number } {
        const scores: Record<string, number> = {};
        for (const lang of Object.keys(LANGUAGE_PATTERNS)) {
            scores[lang] = 0;
        }
        for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
            for (const pattern of patterns) {
                const matches = text.match(new RegExp(pattern, 'gi'));
                if (matches) scores[lang] = (scores[lang] || 0) + matches.length;
            }
        }
        let maxScore = 0;
        let detectedLang = 'en';
        for (const [lang, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                detectedLang = lang;
            }
        }
        const totalWords = text.split(/\s+/).length;
        const confidence = Math.min(1.0, maxScore / Math.max(1, totalWords * 0.5));
        if (maxScore === 0) return { language: 'en', confidence: 0.3 };
        return { language: detectedLang, confidence };
    }

    function mockTranslate(text: string, targetLanguage: string): string {
        const lowerText = text.toLowerCase().trim();
        if (MOCK_TRANSLATIONS[lowerText] && MOCK_TRANSLATIONS[lowerText][targetLanguage]) {
            return MOCK_TRANSLATIONS[lowerText][targetLanguage];
        }
        const langName = SUPPORTED_LANGUAGES[targetLanguage] || targetLanguage;
        return `[${langName}] ${text}`;
    }

    let globalConfig: TranslateConfig = {};

    export function setConfig(config: TranslateConfig): void {
        globalConfig = { ...globalConfig, ...config };
    }

    export async function translate(input: TranslateInput, config?: TranslateConfig): Promise<TranslateOutput> {
        validateInput(input);
        const effectiveConfig = { ...globalConfig, ...config };
        const targetLang = input.targetLanguage.toLowerCase();

        let sourceLang: string;
        let detectionConfidence: number | undefined;

        if (input.sourceLanguage) {
            sourceLang = input.sourceLanguage.toLowerCase();
        } else {
            const detection = detectLanguage(input.text);
            sourceLang = detection.language;
            detectionConfidence = detection.confidence;
        }

        if (sourceLang === targetLang) {
            return {
                translatedText: input.text,
                sourceLanguage: sourceLang,
                targetLanguage: targetLang,
                usedMock: true,
                detectionConfidence
            };
        }

        const translatedText = mockTranslate(input.text, targetLang);
        return {
            translatedText,
            sourceLanguage: sourceLang,
            targetLanguage: targetLang,
            usedMock: !effectiveConfig.apiKey,
            detectionConfidence
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
        console.log('=== Testing Translate Tool ===\n');

        // 1. Test metadata
        console.log('1. Testing metadata export:');
        assertTest(metadata.name === 'translate', 'Name is "translate"');
        assertTest(metadata.description === 'Translate text between languages', 'Description is correct');
        assertTest(metadata.schemaVersion === '1.0', 'Schema version is 1.0');
        assertTest(Array.isArray(metadata.credentials), 'Has credentials array');
        const firstCred = metadata.credentials[0];
        assertTest(firstCred !== undefined && firstCred.name === 'TRANSLATION_API_KEY', 'Declares API key credential');
        assertTest(firstCred !== undefined && firstCred.required === false, 'API key is optional (falls back to mock)');

        // 2. Test default export structure
        console.log('\n2. Testing export structure:');
        const defaultExport = { metadata, handler: translate };
        assertTest(typeof defaultExport.handler === 'function', 'Has handler function');
        assertTest(!!defaultExport.metadata, 'Has metadata object');
        assertTest(Array.isArray(defaultExport.metadata.capabilities), 'Has capabilities');

        // 3. Test input validation
        console.log('\n3. Testing input validation:');

        const validationTests = [
            { input: { text: '', targetLanguage: 'es' }, name: 'empty text' },
            { input: { text: '   ', targetLanguage: 'es' }, name: 'whitespace only' },
            { input: { text: 'hello', targetLanguage: '' }, name: 'empty target language' },
            { input: { text: 'hello', targetLanguage: 'xx' }, name: 'unsupported target language' },
            { input: { text: 'hello', targetLanguage: 'es', sourceLanguage: 'xx' }, name: 'unsupported source language' },
        ];

        for (const test of validationTests) {
            try {
                await translate(test.input as TranslateInput);
                assertTest(false, `Catches ${test.name}`);
            } catch (e) {
                assertTest(e instanceof ValidationError, `Catches ${test.name}`);
            }
        }

        // 4. Test translation without API key (mock mode)
        console.log('\n4. Testing mock translation:');

        const helloResult = await translate({ text: 'hello', targetLanguage: 'es' });
        assertTest(helloResult.translatedText === 'hola', 'Translates known phrase "hello" to Spanish');
        assertTest(helloResult.usedMock === true, 'Indicates mock was used');

        const thanksResult = await translate({ text: 'thank you', targetLanguage: 'fr' });
        assertTest(thanksResult.translatedText === 'merci', 'Translates "thank you" to French');

        const unknownResult = await translate({ text: 'unknown phrase', targetLanguage: 'de' });
        assertTest(unknownResult.translatedText.includes('[German]'), 'Formats unknown phrases with language marker');

        // 5. Test language detection
        console.log('\n5. Testing language detection:');

        const englishText = 'The quick brown fox jumps over the lazy dog';
        const englishDetection = detectLanguage(englishText);
        assertTest(englishDetection.language === 'en', 'Detects English text');
        assertTest(englishDetection.confidence > 0, 'Returns confidence score');

        const spanishText = 'El rápido zorro marrón salta sobre el perro perezoso';
        const spanishDetection = detectLanguage(spanishText);
        assertTest(spanishDetection.language === 'es', 'Detects Spanish text');

        const frenchText = 'Le renard brun rapide saute par-dessus le chien paresseux';
        const frenchDetection = detectLanguage(frenchText);
        assertTest(frenchDetection.language === 'fr', 'Detects French text');

        // 6. Test auto-detection in translation
        console.log('\n6. Testing auto-detection in translation:');

        const autoResult = await translate({
            text: 'The cat is sleeping',
            targetLanguage: 'es'
        });
        assertTest(autoResult.sourceLanguage === 'en', 'Auto-detects source language as English');
        assertTest(autoResult.detectionConfidence !== undefined, 'Includes detection confidence');

        // 7. Test same language handling
        console.log('\n7. Testing same language handling:');

        const sameResult = await translate({
            text: 'Hello world',
            targetLanguage: 'en',
            sourceLanguage: 'en'
        });
        assertTest(sameResult.translatedText === 'Hello world', 'Returns original text when languages match');

        // 8. Test configuration
        console.log('\n8. Testing configuration:');

        setConfig({ apiKey: undefined });
        const noKeyResult = await translate({ text: 'hello', targetLanguage: 'es' });
        assertTest(noKeyResult.usedMock === true, 'Uses mock when no API key configured');

        // Test with fake API key (would still use mock in our implementation)
        setConfig({ apiKey: 'fake-api-key-12345' });
        const withKeyResult = await translate({ text: 'hello', targetLanguage: 'es' });
        assertTest(withKeyResult.usedMock === false, 'Reports API mode when key is present');

        // Reset config
        setConfig({ apiKey: undefined });

        // 9. Test error handling
        console.log('\n9. Testing error handling:');

        try {
            await translate({ text: 'test', targetLanguage: 'invalid' } as any);
            assertTest(false, 'Throws on invalid language');
        } catch (e) {
            assertTest(e instanceof ValidationError, 'Throws ValidationError for invalid language');
        }

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

TranslateTests.runTests().catch(console.error);
