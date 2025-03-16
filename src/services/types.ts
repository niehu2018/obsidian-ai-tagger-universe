/**
 * Supported language codes for tag analysis
 */
export type LanguageCode = 
    | 'ar'   // Arabic
    | 'cs'   // Czech
    | 'da'   // Danish
    | 'de'   // German
    | 'en'   // English
    | 'es'   // Spanish
    | 'fr'   // French
    | 'id'   // Indonesian
    | 'it'   // Italian
    | 'ja'   // Japanese
    | 'ko'   // Korean
    | 'nl'   // Dutch
    | 'no'   // Norwegian
    | 'pl'   // Polish
    | 'pt'   // Portuguese
    | 'pt-BR' // Brazilian Portuguese
    | 'ro'   // Romanian
    | 'ru'   // Russian
    | 'tr'   // Turkish
    | 'uk'   // Ukrainian
    | 'zh'   // Chinese (Simplified)
    | 'zh-TW'; // Chinese (Traditional)

/**
 * Supported LLM service types
 */
export type ServiceType = 
    | 'openai'            // OpenAI API
    | 'gemini'            // Google Gemini
    | 'deepseek'          // DeepSeek
    | 'aliyun'            // Alibaba Cloud
    | 'claude'            // Anthropic Claude
    | 'groq'              // Groq
    | 'vertex'            // Google Vertex AI
    | 'openrouter'        // OpenRouter
    | 'bedrock'           // AWS Bedrock
    | 'requesty'          // Requesty
    | 'cohere'            // Cohere
    | 'grok'              // xAI Grok
    | 'mistral'           // Mistral AI
    | 'openai-compatible'; // OpenAI-compatible APIs

/**
 * Configuration for LLM adapters
 */
export interface AdapterConfig {
    /** API endpoint URL */
    endpoint?: string;
    /** API authentication key */
    apiKey?: string;
    /** Model identifier */
    modelName: string;
    /** Additional service-specific configuration */
    [key: string]: unknown;
}

/**
 * Error type for API-related errors
 */
export class APIError extends Error {
    /**
     * Creates a new API error
     * @param message - Error message
     * @param statusCode - HTTP status code
     */
    constructor(message: string, public statusCode: number) {
        super(message);
        this.name = 'APIError';
    }
}

/**
 * Response from LLM tag analysis
 */
export interface LLMResponse {
    /** Array of newly suggested tags */
    suggestedTags: string[];
    /** Array of matched existing tags */
    matchedExistingTags: string[];
    /** Optional response identifier */
    id?: string;
    /** Optional usage statistics */
    usage?: unknown;
}

/**
 * Configuration for LLM services
 */
export interface LLMServiceConfig {
    /** API endpoint URL */
    endpoint: string;
    /** API authentication key */
    apiKey?: string;
    /** Model identifier */
    modelName: string;
    /** Service type */
    type?: ServiceType;
    /** Language for tag analysis */
    language?: LanguageCode | 'default';
}

/**
 * Result of connection test
 */
export enum ConnectionTestResult {
    /** Connection test succeeded */
    Success = "success",
    /** Connection test failed */
    Failed = "failed"
}

/**
 * Error information for connection test failures
 */
export interface ConnectionTestError {
    /** Type of connection error */
    type: "timeout" | "auth" | "network" | "unknown";
    /** Error message */
    message: string;
    /** Optional error details */
    details?: unknown;
}

/**
 * Interface for LLM service implementations
 */
export interface LLMService {
    /**
     * Analyzes content and generates tags
     * @param content - Content to analyze
     * @param candidateTags - Array of candidate tags
     * @param mode - Tagging mode
     * @param maxTags - Maximum number of tags to return
     * @param language - Language for tag analysis
     * @returns Promise resolving to tag analysis result
     */
    analyzeTags(
        content: string, 
        candidateTags: string[], 
        mode?: 'predefined' | 'generate' | 'existing' | 'hybrid' | 'hybrid-generate-existing' | 'hybrid-generate-predefined',
        maxTags?: number,
        language?: LanguageCode | 'default'
    ): Promise<LLMResponse>;

    /**
     * Tests connection to the LLM service
     * @returns Promise resolving to connection test result
     */
    testConnection(): Promise<{ result: ConnectionTestResult; error?: ConnectionTestError }>;

    /**
     * Cleans up service resources
     */
    dispose(): Promise<void>;
}
