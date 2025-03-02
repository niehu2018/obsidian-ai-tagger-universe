export interface LLMResponse {
    suggestedTags: string[];
    matchedExistingTags: string[];
}

export interface LLMServiceConfig {
    endpoint: string;
    apiKey?: string;
    modelName: string;
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
