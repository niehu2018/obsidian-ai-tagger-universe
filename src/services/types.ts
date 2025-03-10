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
    analyzeTags(content: string, existingTags: string[]): Promise<LLMResponse>;
    testConnection(): Promise<{ result: ConnectionTestResult; error?: ConnectionTestError }>;
    dispose(): Promise<void>;
}
