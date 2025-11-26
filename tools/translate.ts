/**
 * MCP Tool - Text Translator
 * 
 * A tool that translates text between languages using an external API
 * or mock fallback. Demonstrates credential requirements in MCP tools.
 * 
 * @tool translate
 * @description Translate text between languages
 * @example
 * ```typescript
 * import translate from './translate';
 * 
 * // Basic translation (uses mock if no API key)
 * const result = await translate.handler({
 *   text: "Hello, world!",
 *   targetLanguage: "es"
 * });
 * // Result: "¡Hola, mundo!" (or mock result)
 * 
 * // With source language specified
 * const french = await translate.handler({
 *   text: "Hello",
 *   targetLanguage: "fr",
 *   sourceLanguage: "en"
 * });
 * ```
 */

/**
 * Tool metadata for MCP discovery
 */
export const metadata = {
    name: 'translate',
    description: 'Translate text between languages',
    schemaVersion: '1.0',
    version: '1.0.0',
    capabilities: ['translate', 'detect-language'],
    credentials: [{
        name: 'TRANSLATION_API_KEY',
        type: 'api_key',
        required: false,  // Falls back to mock if not provided
        description: 'API key for translation service (e.g., Google Translate)'
    }]
};

/**
 * Input schema for the translate tool
 */
export interface TranslateInput {
    /** The text to translate (required) */
    text: string;
    /** Target language code (e.g., 'es', 'fr', 'de') */
    targetLanguage: string;
    /** Source language code (auto-detected if not provided) */
    sourceLanguage?: string;
}

/**
 * Output schema for the translate tool
 */
export interface TranslateOutput {
    /** The translated text */
    translatedText: string;
    /** The detected or provided source language */
    sourceLanguage: string;
    /** The target language */
    targetLanguage: string;
    /** Whether the translation used mock or real API */
    usedMock: boolean;
    /** Confidence score for language detection (0-1) */
    detectionConfidence?: number;
}

/**
 * Configuration for the translate tool
 */
export interface TranslateConfig {
    /** API key for translation service */
    apiKey?: string;
    /** Base URL for the translation API */
    apiUrl?: string;
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
 * API error class for external service errors
 */
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

/**
 * Supported language codes and their names
 */
export const SUPPORTED_LANGUAGES: Record<string, string> = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'nl': 'Dutch',
    'pl': 'Polish',
    'sv': 'Swedish',
    'tr': 'Turkish'
};

/**
 * Language detection patterns for common languages
 * Used when API is not available
 */
const LANGUAGE_PATTERNS: Record<string, RegExp[]> = {
    'en': [
        /\b(the|is|are|was|were|have|has|had|will|would|could|should)\b/i,
        /\b(this|that|these|those|what|which|who|where|when|why|how)\b/i
    ],
    'es': [
        /\b(el|la|los|las|un|una|es|son|está|están)\b/i,
        /\b(que|de|en|y|con|para|por|como|más|pero)\b/i,
        /[áéíóúñ¿¡]/i
    ],
    'fr': [
        /\b(le|la|les|un|une|des|est|sont|était|étaient)\b/i,
        /\b(que|de|en|et|avec|pour|par|comme|plus|mais)\b/i,
        /[àâçéèêëîïôûùüÿœæ]/i
    ],
    'de': [
        /\b(der|die|das|ein|eine|ist|sind|war|waren)\b/i,
        /\b(und|oder|aber|weil|dass|wenn|als|für|mit|von)\b/i,
        /[äöüß]/i
    ],
    'it': [
        /\b(il|la|lo|i|gli|le|un|una|è|sono)\b/i,
        /\b(che|di|in|e|con|per|come|più|ma|non)\b/i,
        /[àèéìòù]/i
    ],
    'pt': [
        /\b(o|a|os|as|um|uma|é|são|está|estão)\b/i,
        /\b(que|de|em|e|com|para|por|como|mais|mas)\b/i,
        /[àáâãçéêíóôõú]/i
    ],
    'ru': [
        /[а-яА-ЯёЁ]/,
        /\b(и|в|на|с|к|у|о|за|от|по)\b/i
    ],
    'ja': [
        /[\u3040-\u309F\u30A0-\u30FF]/,  // Hiragana and Katakana
        /[\u4E00-\u9FAF]/  // Kanji
    ],
    'ko': [
        /[\uAC00-\uD7AF]/  // Korean Hangul
    ],
    'zh': [
        /[\u4E00-\u9FFF]/  // Chinese characters
    ],
    'ar': [
        /[\u0600-\u06FF]/  // Arabic script
    ]
};

/**
 * Mock translations for common phrases (used when no API key)
 */
const MOCK_TRANSLATIONS: Record<string, Record<string, string>> = {
    'hello': { es: 'hola', fr: 'bonjour', de: 'hallo', it: 'ciao', pt: 'olá' },
    'goodbye': { es: 'adiós', fr: 'au revoir', de: 'auf wiedersehen', it: 'arrivederci', pt: 'adeus' },
    'thank you': { es: 'gracias', fr: 'merci', de: 'danke', it: 'grazie', pt: 'obrigado' },
    'please': { es: 'por favor', fr: 's\'il vous plaît', de: 'bitte', it: 'per favore', pt: 'por favor' },
    'yes': { es: 'sí', fr: 'oui', de: 'ja', it: 'sì', pt: 'sim' },
    'no': { es: 'no', fr: 'non', de: 'nein', it: 'no', pt: 'não' },
    'good morning': { es: 'buenos días', fr: 'bonjour', de: 'guten morgen', it: 'buongiorno', pt: 'bom dia' },
    'good night': { es: 'buenas noches', fr: 'bonne nuit', de: 'gute nacht', it: 'buona notte', pt: 'boa noite' },
    'how are you': { es: '¿cómo estás?', fr: 'comment allez-vous?', de: 'wie geht es dir?', it: 'come stai?', pt: 'como você está?' },
    'i love you': { es: 'te quiero', fr: 'je t\'aime', de: 'ich liebe dich', it: 'ti amo', pt: 'eu te amo' }
};

/**
 * Validates the input parameters for the translate function
 * 
 * @param input - The input to validate
 * @throws ValidationError if input is invalid
 */
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
        throw new ValidationError(
            `Unsupported target language: ${input.targetLanguage}. ` +
            `Supported: ${Object.keys(SUPPORTED_LANGUAGES).join(', ')}`
        );
    }

    if (input.sourceLanguage !== undefined) {
        const sourceLang = input.sourceLanguage.toLowerCase();
        if (!SUPPORTED_LANGUAGES[sourceLang]) {
            throw new ValidationError(
                `Unsupported source language: ${input.sourceLanguage}. ` +
                `Supported: ${Object.keys(SUPPORTED_LANGUAGES).join(', ')}`
            );
        }
    }
}

/**
 * Detects the language of the given text using pattern matching
 * 
 * @param text - The text to analyze
 * @returns Object with detected language code and confidence score
 */
function detectLanguage(text: string): { language: string; confidence: number } {
    const scores: Record<string, number> = {};

    // Initialize scores
    for (const lang of Object.keys(LANGUAGE_PATTERNS)) {
        scores[lang] = 0;
    }

    // Check each language's patterns
    for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
        for (const pattern of patterns) {
            const matches = text.match(new RegExp(pattern, 'gi'));
            if (matches) {
                scores[lang] += matches.length;
            }
        }
    }

    // Find the language with the highest score
    let maxScore = 0;
    let detectedLang = 'en';  // Default to English

    for (const [lang, score] of Object.entries(scores)) {
        if (score > maxScore) {
            maxScore = score;
            detectedLang = lang;
        }
    }

    // Calculate confidence (normalized, capped at 1.0)
    const totalWords = text.split(/\s+/).length;
    const confidence = Math.min(1.0, maxScore / Math.max(1, totalWords * 0.5));

    // If no patterns matched, default to English with low confidence
    if (maxScore === 0) {
        return { language: 'en', confidence: 0.3 };
    }

    return { language: detectedLang, confidence };
}

/**
 * Performs mock translation when no API key is available
 * 
 * @param text - The text to translate
 * @param targetLanguage - The target language code
 * @returns Mock translated text
 */
function mockTranslate(text: string, targetLanguage: string): string {
    const lowerText = text.toLowerCase().trim();

    // Check for known phrases
    if (MOCK_TRANSLATIONS[lowerText] && MOCK_TRANSLATIONS[lowerText][targetLanguage]) {
        return MOCK_TRANSLATIONS[lowerText][targetLanguage];
    }

    // For unknown phrases, create a mock translation marker
    const langName = SUPPORTED_LANGUAGES[targetLanguage] || targetLanguage;
    return `[${langName}] ${text}`;
}

/**
 * Calls the translation API (when API key is available)
 * This is a stub that would connect to a real API
 * 
 * @param text - The text to translate
 * @param targetLanguage - The target language code
 * @param sourceLanguage - The source language code
 * @param apiKey - The API key
 * @param apiUrl - The API URL
 * @returns The translated text
 */
async function callTranslationAPI(
    text: string,
    targetLanguage: string,
    sourceLanguage: string,
    apiKey: string,
    apiUrl?: string
): Promise<string> {
    // In a real implementation, this would call the translation API
    // For now, we'll simulate an API response

    // Check if API key looks valid (basic check)
    if (!apiKey || apiKey.length < 10) {
        throw new APIError('Invalid API key format', 401, false);
    }

    // Simulate API call with mock translation
    // In production, this would use fetch() or axios
    return mockTranslate(text, targetLanguage);
}

/**
 * Global configuration for the translate tool
 */
let globalConfig: TranslateConfig = {};

/**
 * Sets the configuration for the translate tool
 * 
 * @param config - The configuration to set
 */
export function setConfig(config: TranslateConfig): void {
    globalConfig = { ...globalConfig, ...config };
}

/**
 * Gets the current configuration
 * 
 * @returns The current configuration
 */
export function getConfig(): TranslateConfig {
    return { ...globalConfig };
}

/**
 * Translates text between languages
 * 
 * This function translates text using an external API if an API key is
 * configured, or falls back to mock translation otherwise.
 * 
 * @tool translate
 * @param input - The translation parameters
 * @param input.text - The text to translate (required)
 * @param input.targetLanguage - Target language code (required)
 * @param input.sourceLanguage - Source language code (auto-detected if not provided)
 * @param config - Optional configuration override
 * @returns Translation result with metadata
 * @throws ValidationError if input is invalid
 * @throws APIError if API call fails
 * 
 * @example
 * ```typescript
 * // Simple translation
 * const result = await translate({
 *   text: "Hello, world!",
 *   targetLanguage: "es"
 * });
 * console.log(result.translatedText);  // "hola" or mock
 * 
 * // With source language
 * const result2 = await translate({
 *   text: "Bonjour",
 *   targetLanguage: "en",
 *   sourceLanguage: "fr"
 * });
 * ```
 */
export async function translate(
    input: TranslateInput,
    config?: TranslateConfig
): Promise<TranslateOutput> {
    // Validate input
    validateInput(input);

    // Merge configs
    const effectiveConfig = { ...globalConfig, ...config };

    // Normalize language codes
    const targetLang = input.targetLanguage.toLowerCase();

    // Detect source language if not provided
    let sourceLang: string;
    let detectionConfidence: number | undefined;

    if (input.sourceLanguage) {
        sourceLang = input.sourceLanguage.toLowerCase();
    } else {
        const detection = detectLanguage(input.text);
        sourceLang = detection.language;
        detectionConfidence = detection.confidence;
    }

    // Check if source and target are the same
    if (sourceLang === targetLang) {
        return {
            translatedText: input.text,
            sourceLanguage: sourceLang,
            targetLanguage: targetLang,
            usedMock: true,
            detectionConfidence
        };
    }

    // Perform translation
    let translatedText: string;
    let usedMock: boolean;

    try {
        if (effectiveConfig.apiKey) {
            // Use API
            translatedText = await callTranslationAPI(
                input.text,
                targetLang,
                sourceLang,
                effectiveConfig.apiKey,
                effectiveConfig.apiUrl
            );
            usedMock = false;
        } else {
            // Use mock
            translatedText = mockTranslate(input.text, targetLang);
            usedMock = true;
        }
    } catch (error) {
        if (error instanceof APIError) {
            // Re-throw API errors with context
            throw new APIError(
                `Translation failed: ${error.message}`,
                error.statusCode,
                error.retryable
            );
        }
        // Fallback to mock on unexpected errors
        translatedText = mockTranslate(input.text, targetLang);
        usedMock = true;
    }

    return {
        translatedText,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        usedMock,
        detectionConfidence
    };
}

/**
 * Gets the list of supported languages
 * 
 * @returns Record of language codes to language names
 */
export function getSupportedLanguages(): Record<string, string> {
    return { ...SUPPORTED_LANGUAGES };
}

/**
 * Default export for MCP tool discovery
 */
export default {
    metadata,
    handler: translate
};
