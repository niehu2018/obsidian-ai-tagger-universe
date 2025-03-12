export interface AdapterConfig {
    endpoint?: string;
    apiKey?: string;
    modelName: string;
    [key: string]: any;
}

export class APIError extends Error {
    constructor(message: string, public statusCode: number) {
        super(message);
        this.name = 'APIError';
    }
}

export interface LLMResponse {
    suggestedTags: string[];
    matchedExistingTags: string[];
    id?: string;
    usage?: any;
}

export interface LLMServiceConfig {
    endpoint: string;
    apiKey?: string;
    modelName: string;
    type?: 'openai' | 'gemini' | 'deepseek' | 'aliyun' | 'claude' | 'groq' | 'vertex' | 'openrouter' | 'bedrock' | 'requesty' | 'cohere' | 'grok' | 'mistral' | 'openai-compatible';
    language?: 'default' | 'ar' | 'cs' | 'da' | 'de' | 'en' | 'es' | 'fr' | 'id' | 'it' | 'ja' | 'ko' | 'nl' | 'no' | 'pl' | 'pt' | 'pt-BR' | 'ro' | 'ru' | 'tr' | 'uk' | 'zh' | 'zh-TW';
}

export enum ConnectionTestResult {
    Success = "success",
    Failed = "failed"
}

export interface ConnectionTestError {
    type: "timeout" | "auth" | "network" | "unknown";
    message: string;
}

export interface LLMService {
    analyzeTags(
        content: string, 
        candidateTags: string[], 
        mode?: 'predefined' | 'generate' | 'existing' | 'hybrid',
        maxTags?: number,
        language?: 'default' | 'ar' | 'cs' | 'da' | 'de' | 'en' | 'es' | 'fr' | 'id' | 'it' | 'ja' | 'ko' | 'nl' | 'no' | 'pl' | 'pt' | 'pt-BR' | 'ro' | 'ru' | 'tr' | 'uk' | 'zh' | 'zh-TW'
    ): Promise<LLMResponse>;
    testConnection(): Promise<{ result: ConnectionTestResult; error?: ConnectionTestError }>;
    dispose(): Promise<void>;
}
